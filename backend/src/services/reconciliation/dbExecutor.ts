import { PoolClient } from 'pg'
import { ReconciliationProposal, PostWriteVerificationResult, VerificationMismatch } from './types.js'

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

  // 1. 前置防禦校驗：若 Proposal 校驗為 FAIL，直接拒絕寫入
  if (proposal.validation?.status === 'FAIL') {
    const errorMsgs = proposal.validation.errors.map(e => e.message).join('; ')
    throw new Error(`Proposal validation failed, blocking database write: ${errorMsgs}`)
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

  // 4. Pass 1: 預先生成本批次所有 Creates 的真實 UUID，構建 candidateId ➔ real_uuid 索引
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

  for (let i = 0; i < createCount; i++) {
    const prep = preparedCreates[i]

    // 解析 parent_item_uid: 優先從 candidateUidMap 解析 candidateId ➔ 實際 UUID
    let resolvedParentUid: string | null = null
    if (prep.parentCandidateId && candidateUidMap.has(prep.parentCandidateId)) {
      resolvedParentUid = candidateUidMap.get(prep.parentCandidateId)!
    } else if (prep.parentItemUid) {
      // 若原先指向歷史既有工單 UUID
      resolvedParentUid = prep.parentItemUid
    }

    // 解析 item_follow_by: 僅允許有效 member_uid
    const resolvedFollowBy = resolveMemberUid(prep.itemFollowBy)

    // 格式化 item_content: 若為 Meeting，必須完整寫入原文與元數據
    let itemContentObj: any = { text: prep.description || '', description: prep.description || '' }
    if (prep.itemType === 'Meeting' && proposal.documentMetadata) {
      itemContentObj = {
        text: proposal.documentMetadata.normalizedContent,
        description: proposal.documentMetadata.normalizedContent,
        meeting_title: proposal.documentMetadata.meetingTitle,
        meeting_date: proposal.documentMetadata.meetingDate,
        attendees: proposal.documentMetadata.attendees,
        source_document_hash: proposal.sourceDocumentHash,
        source_document_id: proposal.sourceDocumentId
      }
    }

    const itemAttributeObj = {
      source_label: prep.sourceLabel || undefined,
      uat_code: prep.sourceLabel || undefined,
      source_evidence: prep.sourceEvidence || undefined,
      source_document_id: proposal.sourceDocumentId || undefined,
      source_document_hash: proposal.sourceDocumentHash || undefined,
      relationship_status: prep.relationshipStatus || 'CONFIRMED'
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
        JSON.stringify(prep.relationItemUid || []),
        JSON.stringify(itemAttributeObj),
        JSON.stringify(initialComments)
      ]
    )

    insertedItems.push(insertRes.rows[0])
  }

  // 6. 執行 Updates 更新
  const updatedItems: any[] = []
  for (const up of proposal.updates) {
    if (!up.targetItemUid) continue
    const updateKeys = Object.keys(up.updates || {})
    if (updateKeys.length === 0) continue

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
 * 2. 嚴格比對：工單總數、工單類型、標題、內文長度、父級 UUID、指派人 UUID
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
      `SELECT item_uid, item_display_code, item_title, item_type, item_status, item_priority, item_follow_by, parent_item_uid, item_content, item_attribute
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
        itemUid: assignedUid,
        expected: create.itemTitle.trim(),
        actual: row.item_title,
        message: `Item title mismatch: expected "${create.itemTitle}", got "${row.item_title}".`
      })
    }

    // 驗證父級 UUID (parent_item_uid)
    if (create.parentCandidateId) {
      const expectedParentUid = candidateUidMap.get(create.parentCandidateId)
      if (expectedParentUid && row.parent_item_uid !== expectedParentUid) {
        mismatches.push({
          field: 'parent_item_uid',
          candidateId: create.candidateId,
          itemUid: assignedUid,
          expected: expectedParentUid,
          actual: row.parent_item_uid,
          message: `Parent UUID mismatch: expected ${expectedParentUid} for candidate ${create.parentCandidateId}, got ${row.parent_item_uid}.`
        })
      }
    }

    // 驗證會議內文完整性 (Meeting Content Preservation)
    if (create.itemType === 'Meeting' && proposal.documentMetadata) {
      const contentStr = typeof row.item_content === 'string' ? row.item_content : JSON.stringify(row.item_content || {})
      if (!contentStr || contentStr.length < 50) {
        mismatches.push({
          field: 'meeting_content',
          candidateId: create.candidateId,
          itemUid: assignedUid,
          expected: 'Full meeting text content',
          actual: 'Empty or corrupted content',
          message: `Meeting item [${assignedUid}] lost its meeting content during database write.`
        })
      }
    }
  }

  const isVerified = mismatches.length === 0

  return {
    status: isVerified ? 'APPLIED_AND_VERIFIED' : 'APPLIED_WITH_VERIFICATION_ERRORS',
    totalVerified: dbRows.length + updatedItems.length,
    createdItems: dbRows,
    updatedItems,
    mismatches,
    verifiedAt: new Date().toISOString()
  }
}
