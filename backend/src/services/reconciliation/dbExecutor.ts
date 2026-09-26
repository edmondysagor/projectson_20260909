import { PoolClient } from 'pg'
import { ReconciliationProposal, PostWriteVerificationResult, VerificationMismatch } from './types.js'
import { validateCanonicalProposal, computeProposalHash } from './graphValidator.js'

export interface ExecutionContext {
  workspace_uid: string
  related_project_uid: string
  members: any[]
}

/**
 * 確定性資料庫事務寫入引擎 (Deterministic Transactional DB Writer)
 * 核心原則：
 * 1. 嚴格由應用層解析 candidateId ➔ 實際資料庫 UUID (LLM 絕不介入 UUID 與外鍵生成)
 * 2. 欄位單一責任：
 *    - parent_item_uid: 100% 為有效之父級工單 UUID，絕不寫入標題或候選 ID
 *    - item_follow_by: 100% 為有效之成員 UUID，絕不寫入專案代碼或關聯
 *    - item_content: 會議工單完整保留原文、日期、出席者與雜湊元數據
 * 3. 任何寫入失敗皆觸發原子事務回滾 (Rollback)
 */
export async function executeCanonicalProposalTransaction(
  client: PoolClient,
  proposal: ReconciliationProposal,
  context: ExecutionContext
): Promise<{
  insertedItems: any[]
  updatedItems: any[]
  candidateUidMap: Map<string, string>
}> {
  const { workspace_uid, related_project_uid, members } = context

  // 1. Memory Graph Integrity Gate: 嚴格拒絕任何自然語言標題作為 parentItemUid 或 relationItemUid
  const isUuid = (val?: string | null): boolean => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim()))
  for (const create of (proposal.creates || [])) {
    if (create.parentItemUid && !isUuid(create.parentItemUid)) {
      throw new Error(`Memory Graph Integrity Gate: Item "${create.itemTitle}" (${create.candidateId}) contains non-UUID title in parentItemUid: "${create.parentItemUid}". Transaction aborted.`)
    }
    if (create.relationItemUid && Array.isArray(create.relationItemUid)) {
      for (const rel of create.relationItemUid) {
        const rawTarget = (rel as any).item_uid || (rel as any).target_item_uid
        if (rawTarget && !isUuid(rawTarget) && (rawTarget.includes(' ') || rawTarget.length > 30)) {
          throw new Error(`Memory Graph Integrity Gate: Item "${create.itemTitle}" (${create.candidateId}) contains title in relationItemUid: "${rawTarget}". Transaction aborted.`)
        }
      }
    }
  }

  // 2. Apply Gate: 嚴格驗收每個 CREATE 動作必須具備真實來源事實證據，絕不可寫入推斷條目
  for (const create of (proposal.creates || [])) {
    const hasEvidence = Boolean(
      create.evidenceId || 
      (create.evidenceIds && create.evidenceIds.length > 0) || 
      create.sourceEvidence || 
      (create.evidence && create.evidence.length > 0)
    )
    if (!hasEvidence || create.inferred || create.classification === 'INFERRED' || create.classification === 'SUGGESTED') {
      throw new Error(`Apply Gate Violation: Attempted to apply item without explicit source evidence: "${create.itemTitle}" (${create.candidateId}). Inferred items cannot be applied without human approval.`)
    }
  }

  // 3. 前置防禦校驗：若 Proposal 校驗為 FAIL 或提取未完整，直接拒絕寫入 (Prevent False Success)
  if (proposal.validation?.status === 'FAIL' || proposal.mode === 'EXTRACTION_INCOMPLETE' || proposal.coverage?.isComplete === false) {
    const errorMsgs = proposal.validation?.errors ? proposal.validation.errors.map(e => e.message || String(e)).join('; ') : 'Extraction incomplete'
    throw new Error(`Proposal validation failed or extraction incomplete, blocking database write: ${errorMsgs}`)
  }

  // 4. 全量提案校驗引擎 (Stage D Validator Run)
  const fullValidation = validateCanonicalProposal(proposal)
  if (fullValidation.status === 'FAIL') {
    const errorMsgs = fullValidation.errors.map(e => e.message || String(e)).join('; ')
    throw new Error(`Proposal validation failed: ${errorMsgs}. ZERO DATABASE WRITES performed.`)
  }

  // 5. 提案不可變數位簽章校驗 (Preview vs Apply Proposal Hash Verification)
  if (proposal.proposalHash) {
    const expectedHash = computeProposalHash(proposal)
    if (proposal.proposalHash !== expectedHash) {
      throw new Error(`Preview/Apply Mismatch: Proposal hash verification failed. The proposal was modified after validation. Transaction aborted with 0 writes.`)
    }
  }

  // 2. 建立成員解析映射表 (Only resolve to real member_uid)
  const memberMap = new Map<string, string>()
  for (const m of members) {
    if (!m.member_uid) continue
    memberMap.set(m.member_uid.toLowerCase(), m.member_uid)
    if (m.member_name) {
      memberMap.set(m.member_name.toLowerCase().trim(), m.member_uid)
      const firstName = m.member_name.toLowerCase().trim().split(' ')[0]
      if (firstName && firstName.length >= 2) {
        memberMap.set(firstName, m.member_uid)
      }
    }
    if (m.member_email) {
      memberMap.set(m.member_email.toLowerCase().trim(), m.member_uid)
    }
  }

  const resolveMemberUid = (val?: string): string | null => {
    if (!val) return null
    const clean = val.replace(/[*`[\]"()（）]/g, '').trim().toLowerCase()
    return memberMap.get(clean) || null
  }

  // 3. 鎖定並取得 Workspace 自增流水號
  const createCount = proposal.creates.length
  let prefixCode = 'TTG'
  let startNumber = 1

  if (createCount > 0) {
    const wsRes = await client.query(
      `UPDATE public.workspace
       SET last_item_number = last_item_number + $1
       WHERE workspace_uid = $2
       RETURNING prefix_code, last_item_number`,
      [createCount, workspace_uid]
    )

    if (wsRes.rows.length === 0) {
      throw new Error(`Workspace ${workspace_uid} not found.`)
    }

    prefixCode = wsRes.rows[0].prefix_code
    startNumber = wsRes.rows[0].last_item_number - createCount + 1
  }

  // 4. Pass 1: 預先生成本批次所有 Creates 的真實 UUID，構建 candidateId / proposalNodeId ➔ real_uuid 索引
  const candidateUidMap = new Map<string, string>()
  const preparedCreates: any[] = []

  for (let i = 0; i < createCount; i++) {
    const item = proposal.creates[i]
    const itemNum = startNumber + i
    const displayCode = `${prefixCode}-${itemNum}`

    const uuidRes = await client.query(`SELECT gen_random_uuid() AS uid`)
    const assignedUid: string = uuidRes.rows[0].uid

    candidateUidMap.set(item.candidateId, assignedUid)
    if (item.proposalItemId) candidateUidMap.set(item.proposalItemId, assignedUid)
    if (item.proposalNodeId) candidateUidMap.set(item.proposalNodeId, assignedUid)
    if (item.sourceLabel) candidateUidMap.set(item.sourceLabel.toUpperCase(), assignedUid)
    if (item.sourceIdentifier) candidateUidMap.set(item.sourceIdentifier.toUpperCase(), assignedUid)
    candidateUidMap.set(item.itemTitle.trim().toLowerCase(), assignedUid)

    preparedCreates.push({
      ...item,
      assignedUid,
      displayCode,
      itemNum
    })
  }

  // 5. Pass 2: 逐項寫入資料庫 (Transactional Insert)
  const insertedItems: any[] = []
  const nowIso = new Date().toISOString()

  const isValidUuid = (val?: string | null): boolean => {
    if (!val) return false
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim())
  }

  for (let i = 0; i < createCount; i++) {
    const prep = preparedCreates[i]

    // 解析 parent_item_uid: 優先從 candidateUidMap 解析 proposalNodeId / proposalItemId / candidateId ➔ 實際 UUID
    let resolvedParentUid: string | null = null
    if (prep.parentProposalNodeId && candidateUidMap.has(prep.parentProposalNodeId)) {
      resolvedParentUid = candidateUidMap.get(prep.parentProposalNodeId)!
    } else if (prep.parentProposalItemId && candidateUidMap.has(prep.parentProposalItemId)) {
      resolvedParentUid = candidateUidMap.get(prep.parentProposalItemId)!
    } else if (prep.parentCandidateId && candidateUidMap.has(prep.parentCandidateId)) {
      resolvedParentUid = candidateUidMap.get(prep.parentCandidateId)!
    } else if (prep.parentItemUid && isValidUuid(prep.parentItemUid)) {
      // 若原先指向歷史既有工單 UUID
      resolvedParentUid = prep.parentItemUid
    } else if (prep.parentProposalItemId || prep.parentProposalNodeId) {
      const unres = prep.parentProposalItemId || prep.parentProposalNodeId
      if (!isValidUuid(unres)) {
        throw new Error(`UNRESOLVED_PARENT_LOCAL_ID: Could not resolve parentProposalItemId "${unres}" to a database UUID`)
      }
    }

    // 嚴防標題作為 parent_item_uid 寫入資料庫
    if (resolvedParentUid && !isValidUuid(resolvedParentUid)) {
      resolvedParentUid = null
    }

    // 解析 item_follow_by: 僅允許有效 member_uid，絕不存入專案 UUID 或自然語言
    const resolvedFollowBy = resolveMemberUid(prep.itemFollowBy || prep.assigneeUid || prep.assigneeId || prep.assigneeName)

    // 解析 relation_item_uid: 將所有關聯目標精確解析為真實 DB UUID
    const resolvedRelations: Array<{ item_uid: string; relation: string }> = []
    
    // 1) 優先從 proposal.relations (標準圖譜) 解析
    if (proposal.relations && Array.isArray(proposal.relations)) {
      const myPropId = prep.proposalItemId || prep.candidateId
      const myCandId = prep.candidateId
      const myNodeId = prep.proposalNodeId
      for (const rel of proposal.relations) {
        if (rel.fromProposalNodeId === myNodeId || rel.fromProposalItemId === myPropId || rel.fromProposalItemId === myCandId) {
          const targetKey = rel.targetProposalNodeId || rel.toProposalNodeId || rel.toProposalItemId
          const targetUid = targetKey ? (candidateUidMap.get(targetKey) || (isValidUuid(targetKey) ? targetKey : null)) : null
          if (targetUid && targetUid !== prep.assignedUid && isValidUuid(targetUid) && !resolvedRelations.some(r => r.item_uid === targetUid)) {
            resolvedRelations.push({
              item_uid: targetUid,
              relation: rel.relationType
            })
          }
        }
      }
    }

    // 2) 從 prep.relations 解析
    if (prep.relations && Array.isArray(prep.relations)) {
      for (const r of prep.relations) {
        const targetKey = r.targetProposalNodeId || r.targetProposalItemId
        const targetUid = targetKey ? (candidateUidMap.get(targetKey) || (isValidUuid(targetKey) ? targetKey : null)) : null
        if (targetUid && targetUid !== prep.assignedUid && isValidUuid(targetUid) && !resolvedRelations.some(rel => rel.item_uid === targetUid)) {
          resolvedRelations.push({
            item_uid: targetUid,
            relation: r.relation || 'discusses'
          })
        }
      }
    }

    // 3) 補充從 prep.relationItemUid 解析
    if (prep.relationItemUid && Array.isArray(prep.relationItemUid)) {
      for (const r of prep.relationItemUid) {
        const rawTarget = r.item_uid || (r as any).target_item_uid || ''
        const targetUid = candidateUidMap.get(rawTarget) || (isValidUuid(rawTarget) ? rawTarget : null)
        if (targetUid && targetUid !== prep.assignedUid && isValidUuid(targetUid) && !resolvedRelations.some(rel => rel.item_uid === targetUid)) {
          resolvedRelations.push({
            item_uid: targetUid,
            relation: r.relation || 'relates_to'
          })
        }
      }
    }

    // 4.1 Duplicate Meeting Prevention
    if (prep.itemType === 'Meeting') {
      const existMeetingRes = await client.query(
        `SELECT item_uid, item_display_code, item_title FROM public.item
         WHERE related_project_uid = $1 AND item_type = 'Meeting'
           AND (item_title = $2 OR (item_attribute->>'source_document_hash' = $3 AND $3 IS NOT NULL))
         LIMIT 1`,
        [related_project_uid, prep.itemTitle.trim(), proposal.sourceDocumentHash || null]
      )
      if (existMeetingRes.rows.length > 0) {
        const existM = existMeetingRes.rows[0]
        throw new Error(`DUPLICATE_MEETING_PREVENTED: Meeting item "${existM.item_title}" [${existM.item_display_code}] has already been persisted for this project. Transaction aborted with 0 writes.`)
      }
    }

    // 格式化 item_content: 若為 Meeting，必須完整寫入原文與元數據，且 summary / meeting_objective 另存
    let itemContentObj: any = { 
      text: prep.description || prep.sourceContent || '', 
      description: prep.description || prep.sourceContent || '',
      source_content: prep.sourceContent || prep.description || undefined,
      summary: prep.summary || undefined
    }
    if (prep.itemType === 'Meeting' && proposal.documentMetadata) {
      itemContentObj = {
        text: proposal.documentMetadata.normalizedContent,
        description: proposal.documentMetadata.normalizedContent,
        source_content: proposal.documentMetadata.normalizedContent,
        summary: proposal.documentMetadata.summary || proposal.documentMetadata.meetingObjective || prep.summary,
        meeting_objective: proposal.documentMetadata.meetingObjective || proposal.documentMetadata.summary,
        meeting_title: proposal.documentMetadata.meetingTitle,
        meeting_date: proposal.documentMetadata.meetingDate,
        attendees: proposal.documentMetadata.attendees,
        source_document_hash: proposal.sourceDocumentHash,
        source_document_id: proposal.sourceDocumentId
      }
    }

    const itemAttributeObj = {
      source_label: prep.sourceLabel || prep.sourceIdentifier || undefined,
      source_identifier: prep.sourceIdentifier || prep.sourceLabel || undefined,
      uat_code: prep.sourceLabel || prep.sourceIdentifier || undefined,
      source_evidence: prep.sourceEvidence || undefined,
      source_document_id: proposal.sourceDocumentId || undefined,
      source_document_hash: proposal.sourceDocumentHash || undefined,
      relationship_status: prep.relationshipStatus || 'CONFIRMED',
      inferred: prep.inferred || false,
      confidence: prep.confidence || 1.0,
      needs_review: prep.needsReview || (prep.relationshipStatus === 'NEEDS_REVIEW')
    }

    const initialComments = [
      {
        comment_id: `cmt_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        author_name: '🤖 AI Copilot (Reconciliation)',
        author_email: 'copilot@projectson.local',
        comment_text: `依據提案 [${proposal.proposalId || 'P001'}]（來源候選: ${prep.candidateId}）結構化批次寫入 [${prep.displayCode}]。`,
        created_at: nowIso
      }
    ]

    const insertRes = await client.query(
      `INSERT INTO public.item (
        item_uid,
        item_display_code,
        prefix_code,
        item_number,
        item_title,
        related_project_uid,
        workspace_uid,
        item_type,
        item_status,
        item_priority,
        item_follow_by,
        item_content,
        parent_item_uid,
        relation_item_uid,
        item_attribute,
        item_comment
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        prep.assignedUid,
        prep.displayCode,
        prefixCode,
        prep.itemNum,
        prep.itemTitle.trim(),
        related_project_uid,
        workspace_uid,
        prep.itemType,
        'Not Start',
        prep.itemPriority || 'Middle',
        resolvedFollowBy,
        JSON.stringify(itemContentObj),
        resolvedParentUid,
        JSON.stringify(resolvedRelations),
        JSON.stringify(itemAttributeObj),
        JSON.stringify(initialComments)
      ]
    )

    insertedItems.push(insertRes.rows[0])
  }

  // 6. 執行 Updates 與 Corrections 更新
  const updatedItems: any[] = []
  const allMutationUpdates = [...(proposal.updates || []), ...(proposal.corrections || [])]

  for (const up of allMutationUpdates) {
    if (!up.targetItemUid) continue
    const updateKeys = Object.keys(up.updates || {})
    if (updateKeys.length === 0) continue

    // 🌟 True Optimistic Concurrency Protection: Re-read row and verify no conflicting concurrent changes
    const curRes = await client.query(
      `SELECT item_uid, item_display_code, item_title, item_type, item_status, item_priority, item_follow_by, item_content, parent_item_uid, item_planned_end_date, updated_at
       FROM public.item
       WHERE item_uid = $1
       FOR UPDATE`,
      [up.targetItemUid]
    )

    if (curRes.rows.length === 0) {
      throw new Error(`OPTIMISTIC_CONCURRENCY_CONFLICT: Target item [${up.targetDisplayCode || up.targetItemUid}] was not found in the database. ZERO DATABASE WRITES performed.`)
    }

    const currentDbRow = curRes.rows[0]

    // Verify each expected Before value from fieldDiffs
    if (up.fieldDiffs && Array.isArray(up.fieldDiffs)) {
      for (const diff of up.fieldDiffs) {
        const fieldName = diff.field
        const expectedBefore = diff.existingValue !== undefined ? diff.existingValue : (diff as any).before

        if (fieldName === 'item_status' || fieldName === 'status') {
          const currentStatus = (currentDbRow.item_status || '').trim().toLowerCase()
          const expStatus = String(expectedBefore || '').trim().toLowerCase()
          if (expStatus && currentStatus !== expStatus) {
            throw new Error(`OPTIMISTIC_CONCURRENCY_CONFLICT: Item [${currentDbRow.item_display_code || up.targetDisplayCode}] "${currentDbRow.item_title}" has been modified in the database after proposal generation (current DB status is "${currentDbRow.item_status}", but proposal expected "${expectedBefore}"). The proposal is stale. Please refresh and regenerate proposal. Transaction aborted with ZERO DATABASE WRITES.`)
          }
        } else if (fieldName === 'item_title' || fieldName === 'title') {
          if (expectedBefore && currentDbRow.item_title?.trim() !== String(expectedBefore).trim()) {
            throw new Error(`OPTIMISTIC_CONCURRENCY_CONFLICT: Item [${currentDbRow.item_display_code || up.targetDisplayCode}] title has changed in the database (current "${currentDbRow.item_title}", expected "${expectedBefore}"). Transaction aborted with ZERO DATABASE WRITES.`)
          }
        }
      }
    }

    const setClauses: string[] = []
    const values: any[] = [up.targetItemUid]

    if (up.updates.item_title) {
      values.push(up.updates.item_title)
      setClauses.push(`item_title = $${values.length}`)
    }
    if (up.updates.item_status) {
      values.push(up.updates.item_status)
      setClauses.push(`item_status = $${values.length}`)
    }
    if (up.updates.item_priority) {
      values.push(up.updates.item_priority)
      setClauses.push(`item_priority = $${values.length}`)
    }
    if (up.updates.item_follow_by) {
      const fBy = resolveMemberUid(up.updates.item_follow_by)
      values.push(fBy)
      setClauses.push(`item_follow_by = $${values.length}`)
    }
    if (up.updates.item_planned_end_date || up.updates.due_date) {
      values.push(up.updates.item_planned_end_date || up.updates.due_date)
      setClauses.push(`item_planned_end_date = $${values.length}`)
    }
    if (up.updates.parent_item_uid !== undefined) {
      const pUid = isValidUuid(up.updates.parent_item_uid) ? up.updates.parent_item_uid : null
      values.push(pUid)
      setClauses.push(`parent_item_uid = $${values.length}`)
    }
    if (up.updates.item_content) {
      values.push(JSON.stringify(up.updates.item_content))
      setClauses.push(`item_content = $${values.length}`)
    }

    if (setClauses.length > 0) {
      const updateRes = await client.query(
        `UPDATE public.item
         SET ${setClauses.join(', ')}, updated_at = NOW()
         WHERE item_uid = $1
         RETURNING *`,
        values
      )
      if (updateRes.rows.length > 0) {
        updatedItems.push(updateRes.rows[0])
      }
    }
  }

  return {
    insertedItems,
    updatedItems,
    candidateUidMap
  }
}

/**
 * 寫入後資料庫狀態強制二度比對與驗收器 (Post-Write Database State Verifier)
 * 核心原則：
 * 1. 重新從資料庫查詢實際寫入之工單與關聯
 * 2. 嚴格比對：工單總數、工單類型、標題、內文長度、父級 UUID、指派人 UUID、關係 UUID
 * 3. 唯有 100% 吻合方回傳 APPLIED_AND_VERIFIED，絕不單憑提案聲稱成功
 */
export async function verifyDatabaseState(
  clientOrPool: any,
  proposal: ReconciliationProposal,
  executionResult: {
    insertedItems: any[]
    updatedItems: any[]
    candidateUidMap: Map<string, string>
  }
): Promise<PostWriteVerificationResult> {
  const { insertedItems, updatedItems, candidateUidMap } = executionResult
  const mismatches: VerificationMismatch[] = []

  const isValidUuid = (val?: string | null): boolean => {
    if (!val) return false
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim())
  }

  // 1. 驗證寫入數量
  if (insertedItems.length !== proposal.creates.length) {
    mismatches.push({
      field: 'itemCount',
      expected: proposal.creates.length,
      actual: insertedItems.length,
      message: `Expected ${proposal.creates.length} created items, but database contains ${insertedItems.length}.`
    })
  }

  // 2. 從資料庫重新讀取真實記錄
  const itemUids = insertedItems.map(i => i.item_uid)
  let dbRows: any[] = []
  if (itemUids.length > 0) {
    const res = await clientOrPool.query(
      `SELECT item_uid, item_display_code, item_title, item_type, item_status, item_priority, item_follow_by, parent_item_uid, relation_item_uid, item_content, item_attribute
       FROM public.item
       WHERE item_uid = ANY($1)`,
      [itemUids]
    )
    dbRows = res.rows
  }

  const dbRowMap = new Map<string, any>(dbRows.map(r => [r.item_uid, r]))

  // 3. 逐項驗收提案與資料庫實際狀態
  for (const create of proposal.creates) {
    const assignedUid = candidateUidMap.get(create.candidateId)
    if (!assignedUid) {
      mismatches.push({
        field: 'candidateIdMapping',
        candidateId: create.candidateId,
        proposalItemId: create.proposalItemId,
        expected: create.candidateId,
        actual: null,
        message: `Candidate ${create.candidateId} was not mapped to a database UUID.`
      })
      continue
    }

    const row = dbRowMap.get(assignedUid)
    if (!row) {
      mismatches.push({
        field: 'databasePersistence',
        candidateId: create.candidateId,
        proposalItemId: create.proposalItemId,
        itemUid: assignedUid,
        expected: 'Persisted row in public.item',
        actual: 'Row not found in DB query',
        message: `Created item [${assignedUid}] not found during DB re-read.`
      })
      continue
    }

    // 驗證類型
    if (row.item_type !== create.itemType) {
      mismatches.push({
        field: 'item_type',
        candidateId: create.candidateId,
        proposalItemId: create.proposalItemId,
        itemUid: assignedUid,
        expected: create.itemType,
        actual: row.item_type,
        message: `Item type mismatch: expected ${create.itemType}, got ${row.item_type}.`
      })
    }

    // 驗證標題
    if (row.item_title !== create.itemTitle.trim()) {
      mismatches.push({
        field: 'item_title',
        candidateId: create.candidateId,
        proposalItemId: create.proposalItemId,
        itemUid: assignedUid,
        expected: create.itemTitle.trim(),
        actual: row.item_title,
        message: `Item title mismatch: expected "${create.itemTitle}", got "${row.item_title}".`
      })
    }

    // 驗證父級 UUID (parent_item_uid 必須是有效 UUID 或 null，絕不可為標題)
    if (row.parent_item_uid && !isValidUuid(row.parent_item_uid)) {
      mismatches.push({
        field: 'parent_item_uid_format',
        candidateId: create.candidateId,
        proposalItemId: create.proposalItemId,
        itemUid: assignedUid,
        expected: 'Valid UUID or null',
        actual: row.parent_item_uid,
        message: `Fatal: parent_item_uid contains non-UUID title string: "${row.parent_item_uid}"`
      })
    }

    if (create.parentCandidateId) {
      const expectedParentUid = candidateUidMap.get(create.parentCandidateId)
      if (expectedParentUid && row.parent_item_uid !== expectedParentUid) {
        mismatches.push({
          field: 'parent_item_uid',
          candidateId: create.candidateId,
          proposalItemId: create.proposalItemId,
          itemUid: assignedUid,
          expected: expectedParentUid,
          actual: row.parent_item_uid,
          message: `Parent UUID mismatch: expected ${expectedParentUid} for candidate ${create.parentCandidateId}, got ${row.parent_item_uid}.`
        })
      }
    }

    // 驗證關聯 relation_item_uid 中的 UUID 格式 (絕不可為標題)
    if (row.relation_item_uid) {
      const rels = typeof row.relation_item_uid === 'string' ? JSON.parse(row.relation_item_uid) : row.relation_item_uid
      if (Array.isArray(rels)) {
        for (const rel of rels) {
          if (rel.item_uid && !isValidUuid(rel.item_uid)) {
            mismatches.push({
              field: 'relation_item_uid_format',
              candidateId: create.candidateId,
              proposalItemId: create.proposalItemId,
              itemUid: assignedUid,
              expected: 'Valid UUID in relation',
              actual: rel.item_uid,
              message: `Fatal: relation_item_uid contains non-UUID title string: "${rel.item_uid}"`
            })
          }
        }
      }
    }

    // 驗證指派人 item_follow_by 格式 (必須是有效 UUID 或 member UID，絕不可為專案代碼或姓名)
    const isValidMemberId = (val?: string | null): boolean => Boolean(
      val && (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim()) ||
        /^mem[-_]\w+$/i.test(val.trim()) ||
        /^usr[-_]\w+$/i.test(val.trim())
      )
    )
    if (row.item_follow_by && !isValidMemberId(row.item_follow_by)) {
      mismatches.push({
        field: 'item_follow_by_format',
        candidateId: create.candidateId,
        proposalItemId: create.proposalItemId,
        itemUid: assignedUid,
        expected: 'Valid member UUID or null',
        actual: row.item_follow_by,
        message: `Fatal: item_follow_by contains invalid format: "${row.item_follow_by}"`
      })
    }

    // 驗證會議內文完整性 (Meeting Content Preservation)
    if (create.itemType === 'Meeting' && proposal.documentMetadata) {
      const contentStr = typeof row.item_content === 'string' ? row.item_content : JSON.stringify(row.item_content || {})
      if (!contentStr || contentStr.length < 50) {
        mismatches.push({
          field: 'meeting_content',
          candidateId: create.candidateId,
          proposalItemId: create.proposalItemId,
          itemUid: assignedUid,
          expected: 'Full meeting text content',
          actual: 'Empty or corrupted content',
          message: `Meeting item [${assignedUid}] lost its meeting content during database write.`
        })
      }
    }
  }

  // 4. 逐項驗收更新工單狀態 (Updates Verification)
  const updateList: any[] = [...(proposal.updates || []), ...(proposal.corrections || [])]
  const updatedItemUids = updateList.map(u => u.targetItemUid || u.itemUid).filter(Boolean)
  let updatedDbRows: any[] = []
  if (updatedItemUids.length > 0) {
    const res = await clientOrPool.query(
      `SELECT item_uid, item_display_code, item_title, item_type, item_status, item_priority, item_follow_by, parent_item_uid, relation_item_uid, item_content, item_attribute
       FROM public.item
       WHERE item_uid = ANY($1)`,
      [updatedItemUids]
    )
    updatedDbRows = res.rows
  }

  const updatedDbRowMap = new Map<string, any>(updatedDbRows.map(r => [r.item_uid, r]))
  for (const update of updateList) {
    const uid = update.targetItemUid || update.itemUid
    if (!uid) continue
    const row = updatedDbRowMap.get(uid)
    if (!row) {
      mismatches.push({
        field: 'databasePersistence',
        itemUid: uid,
        expected: 'Persisted updated row in public.item',
        actual: 'Row not found in DB query',
        message: `Updated item [${uid}] not found during DB re-read.`
      })
      continue
    }

    const patch = update.updates || update.patch || {}
    if (patch) {
      if (patch.item_title !== undefined && row.item_title !== patch.item_title.trim()) {
        mismatches.push({
          field: 'item_title',
          itemUid: uid,
          expected: patch.item_title.trim(),
          actual: row.item_title,
          message: `Updated item title mismatch on [${uid}]: expected "${patch.item_title}", got "${row.item_title}".`
        })
      }
      if (patch.item_priority !== undefined && row.item_priority !== patch.item_priority) {
        mismatches.push({
          field: 'item_priority',
          itemUid: uid,
          expected: patch.item_priority,
          actual: row.item_priority,
          message: `Updated item priority mismatch on [${uid}]: expected "${patch.item_priority}", got "${row.item_priority}".`
        })
      }
      if (patch.item_status !== undefined && row.item_status !== patch.item_status) {
        mismatches.push({
          field: 'item_status',
          itemUid: uid,
          expected: patch.item_status,
          actual: row.item_status,
          message: `Updated item status mismatch on [${uid}]: expected "${patch.item_status}", got "${row.item_status}".`
        })
      }
      if (patch.item_follow_by !== undefined && row.item_follow_by !== patch.item_follow_by) {
        mismatches.push({
          field: 'item_follow_by',
          itemUid: uid,
          expected: patch.item_follow_by,
          actual: row.item_follow_by,
          message: `Updated item follow_by mismatch on [${uid}]: expected "${patch.item_follow_by}", got "${row.item_follow_by}".`
        })
      }
    }
  }

  const isVerified = mismatches.length === 0

  return {
    status: isVerified ? 'APPLIED_AND_VERIFIED' : 'FAILED_VERIFICATION',
    totalVerified: dbRows.length + updatedDbRows.length,
    createdItems: dbRows,
    updatedItems: updatedDbRows.length > 0 ? updatedDbRows : updatedItems,
    mismatches,
    verifiedAt: new Date().toISOString()
  }
}
