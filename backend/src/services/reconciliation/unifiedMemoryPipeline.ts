import crypto from 'crypto'
import { callSubAgentJson } from '../../agents/llmClient.js'
import { ReconciliationProposal } from './types.js'
import { computeProposalHash } from './graphValidator.js'
import { registerAuthoritativeProposal } from './proposalRegistry.js'

export interface UnifiedPipelineOptions {
  projectUid: string
  projectName: string
  items: any[]
  transcriptText: string
  sourceFilename?: string
  model?: string
  includeMeetingRecord?: boolean
}

export interface AlignedItemDiff {
  field: string
  before: any
  after: any
  rationale: string
}

export interface AlignedExistingItem {
  item_uid: string
  item_display_code: string
  item_title: string
  item_type: string
  is_mentioned: boolean
  matched_evidence: string[]
  action: 'UPDATE' | 'NO_CHANGE' | 'NEEDS_REVIEW'
  reason: string
  field_diffs: AlignedItemDiff[]
}

export interface NewCandidateItem {
  candidate_id: string
  item_type: string
  item_title: string
  item_status?: string
  item_priority?: string
  assignee_name?: string | null
  parent_candidate_id?: string | null
  parent_item_uid?: string | null
  reason: string
  matched_evidence: string[]
  item_content?: {
    description?: string
    text?: string
    [key: string]: any
  }
}

export interface UnmatchedObservation {
  topic: string
  excerpt: string
  notes: string
}

export interface LlmUnifiedResponse {
  aligned_existing_items: AlignedExistingItem[]
  new_candidate_items: NewCandidateItem[]
  unmatched_evidence: UnmatchedObservation[]
}

const VALID_ITEM_STATUSES = [
  'Not Start', 'Ready', 'In Progress', 'Blocked', 
  'Review', 'Completed', 'Closed', 'Backlog'
]

function normalizeStatusValue(status?: any): string | null {
  if (status === null || status === undefined) return null
  const clean = String(status).replace(/[*`[\]"']/g, '').trim()
  const lower = clean.toLowerCase()
  if (['cancelled', 'canceled', 'abandoned', 'closed', 'rejected', '作廢', '取消', '關閉'].includes(lower)) return 'Closed'
  if (['done', 'completed', 'finish', 'finished', 'approved', 'pass', 'passed', '完成'].includes(lower)) return 'Completed'
  if (['in progress', 'in_progress', 'doing', 'wip', '進行中'].includes(lower)) return 'In Progress'
  if (['not start', 'not_start', 'todo', 'pending', '未開始'].includes(lower)) return 'Not Start'
  if (['ready', '準備好'].includes(lower)) return 'Ready'
  if (['blocked', 'block', '阻塞', '阻礙'].includes(lower)) return 'Blocked'
  if (['review', 'testing', 'test', '審查', '測試'].includes(lower)) return 'Review'
  if (['backlog', '待辦', '儲備'].includes(lower)) return 'Backlog'
  const matched = VALID_ITEM_STATUSES.find(v => v.toLowerCase() === lower)
  return matched || null
}

function normalizeDateValue(val: any): string | null {
  if (!val) return null
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'tbc') return null
    const m = trimmed.match(/^\d{4}-\d{2}-\d{2}/)
    if (m) return m[0]
    return trimmed
  }
  return null
}

function extractContentText(val: any): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val.trim()
  if (typeof val === 'object') {
    if (val.description && typeof val.description === 'string') return val.description.trim()
    if (val.text && typeof val.text === 'string') return val.text.trim()
    if (val.markdown && typeof val.markdown === 'string') return val.markdown.trim()
    try {
      return JSON.stringify(val)
    } catch {
      return ''
    }
  }
  return String(val)
}

function isFieldDiffReal(field: string, beforeVal: any, afterVal: any): boolean {
  if (field === 'item_status' || field === 'status') {
    const normBefore = normalizeStatusValue(beforeVal)
    const normAfter = normalizeStatusValue(afterVal)
    if (!normAfter) return false
    return normBefore !== normAfter
  }

  if (field.includes('date')) {
    const normBefore = normalizeDateValue(beforeVal)
    const normAfter = normalizeDateValue(afterVal)
    if (normBefore === null && normAfter === null) return false
    return normBefore !== normAfter
  }

  if (field === 'item_content' || field === 'description') {
    const textBefore = extractContentText(beforeVal)
    const textAfter = extractContentText(afterVal)
    if (!textAfter || textBefore === textAfter) return false
    if (textBefore.includes(textAfter)) return false
    return true
  }

  if (beforeVal === null || beforeVal === undefined) {
    if (afterVal === null || afterVal === undefined || afterVal === '') return false
    return true
  }
  if (afterVal === null || afterVal === undefined) {
    if (beforeVal === null || beforeVal === undefined || beforeVal === '') return false
    return true
  }

  if (typeof beforeVal === 'object' || typeof afterVal === 'object') {
    const bStr = JSON.stringify(beforeVal || {})
    const aStr = JSON.stringify(afterVal || {})
    return bStr !== aStr
  }

  return String(beforeVal).trim() !== String(afterVal).trim()
}

export async function executeUnifiedMemoryPipeline(options: UnifiedPipelineOptions): Promise<{
  reportMarkdown: string
  actionPreview: any
  canonicalProposal: ReconciliationProposal
  summary: {
    totalExisting: number
    mentionedExistingCount: number
    updateCount: number
    noChangeCount: number
    createCount: number
    needsReviewCount: number
    unmatchedCount: number
  }
  details: {
    alignedExisting: any[]
    newCandidates: any[]
    needsReview: any[]
    unmatched: any[]
  }
}> {
  const { projectUid, projectName, items = [], transcriptText, model } = options

  // 1. Prepare minimal, authoritative Project Memory payload
  const memorySnapshot = (items || []).map(i => ({
    item_uid: i.item_uid,
    item_display_code: i.item_display_code,
    item_type: i.item_type,
    item_title: i.item_title,
    item_status: i.item_status,
    item_priority: i.item_priority || 'Middle',
    assignee: i.follow_by_name || null,
    item_planned_end_date: i.item_planned_end_date || null,
    parent_item_uid: i.parent_item_uid || null,
    item_content: { description: extractContentText(i.item_content) }
  }))

  const memoryMap = new Map(memorySnapshot.map(m => [m.item_uid, m]))
  const memoryCodeMap = new Map(memorySnapshot.map(m => [m.item_display_code, m]))
  const originalItemsMap = new Map(items.map(i => [i.item_uid, i]))

  // 2. Build Single-LLM Unified Prompt
  const systemPrompt = `You are the authoritative Unified AI Project Reconciliation Engine for Projectson.
Your task is to analyze a source document/transcript against an authoritative list of EXISTING project items (Project Memory) and determine:
1. ALIGNED EXISTING ITEMS (UPDATE, NO_CHANGE, NEEDS_REVIEW)
2. GENUINELY NEW ITEMS (CREATE)
3. UNMATCHED OBSERVATIONS (non-mutating facts/future ideas)

CRITICAL ARCHITECTURAL CONSTRAINTS:
1. EXISTING-ITEM ALIGNMENT FIRST:
   - For every existing item in Project Memory, determine if the document mentions it.
   - If substantive progress or completed facts are reported, propose UPDATE with precise field_diffs.
   - If reaffirmed without changes or not mentioned, propose NO_CHANGE.
   - If ambiguous, propose NEEDS_REVIEW.
   - Never generate a CREATE item for a concept that corresponds to an existing item.

2. GENUINELY NEW ITEMS (CREATE):
   - Only extract items that represent substantive new scope, new tasks, or new meeting sessions that DO NOT exist in Project Memory.
   - For Meeting items: Propose a Meeting CREATE ONLY if this specific meeting session does not already exist in Project Memory.
   - Assign temporary candidate IDs (CAND-001, CAND-002, ...).
   - Preserve direct parent relationships (parent_candidate_id or parent_item_uid).
   - DO NOT invent missing intermediate hierarchy levels (e.g. do not invent dummy user stories or epics). Direct relationships across sparse levels are fully valid.

3. PRESERVATION OF FIDELITY & NO-OP REJECTION:
   - Preserve all existing fields unless explicitly modified by source evidence.
   - NEVER propose a field diff where Before and After are identical (e.g. item_planned_end_date: null -> null is STRICTLY FORBIDDEN).
   - Do NOT promote tentative/proposed targets to confirmed commitments.
   - Append factual progress notes under item_content rather than overwriting original task definitions.

4. UNMATCHED OBSERVATIONS:
   - Ideas explicitly rejected, deferred to future releases, or general observations must be placed in unmatched_evidence.

OUTPUT FORMAT:
Return a strictly valid JSON object matching this schema:
{
  "aligned_existing_items": [
    {
      "item_uid": string (exact match from Project Memory),
      "item_display_code": string (exact match from Project Memory),
      "item_title": string,
      "item_type": string,
      "is_mentioned": boolean,
      "matched_evidence": string[],
      "action": "UPDATE" | "NO_CHANGE" | "NEEDS_REVIEW",
      "reason": string,
      "field_diffs": [
        {
          "field": string (e.g. "item_status", "item_planned_end_date", "item_content"),
          "before": any,
          "after": any,
          "rationale": string
        }
      ]
    }
  ],
  "new_candidate_items": [
    {
      "candidate_id": string (e.g. "CAND-001"),
      "item_type": string (e.g. "Meeting", "Objective", "Requirement", "User story", "Task", "UAT", "Decision", "Bug"),
      "item_title": string,
      "item_status": string (e.g. "Not Start", "Completed"),
      "item_priority": string ("High" | "Middle" | "Low"),
      "assignee_name": string | null,
      "parent_candidate_id": string | null,
      "parent_item_uid": string | null,
      "reason": string,
      "matched_evidence": string[],
      "item_content": {
        "description": string
      }
    }
  ],
  "unmatched_evidence": [
    {
      "topic": string,
      "excerpt": string,
      "notes": string
    }
  ]
}`

  const userPrompt = `### EXISTING PROJECT MEMORY (AUTHORITATIVE DATABASE SNAPSHOT)
${JSON.stringify(memorySnapshot, null, 2)}

### SOURCE DOCUMENT TRANSCRIPT
${transcriptText}

Perform the unified reconciliation and output valid JSON.`

  const llmRes = await callSubAgentJson<LlmUnifiedResponse>({
    systemPrompt,
    userPrompt,
    model,
    temperature: 0.1,
    timeoutMs: 120000
  })

  const rawAlignedItems = llmRes?.aligned_existing_items || []
  const rawNewCandidates = llmRes?.new_candidate_items || []
  const unmatchedEvidence = llmRes?.unmatched_evidence || []

  // 3. Reconcile Existing Items with Authoritative DB Snapshot
  const processedAlignedItems: AlignedExistingItem[] = []

  for (const rawItem of rawAlignedItems) {
    const memoryItem = memoryMap.get(rawItem.item_uid) || memoryCodeMap.get(rawItem.item_display_code)
    if (!memoryItem) continue
    const originalRawItem = originalItemsMap.get(memoryItem.item_uid) || {}

    const matchedEvidence = Array.isArray(rawItem.matched_evidence) ? rawItem.matched_evidence.filter(Boolean) : []
    const rawDiffs = Array.isArray(rawItem.field_diffs) ? rawItem.field_diffs : []

    const validDiffs: (AlignedItemDiff & { displayBefore: string; displayAfter: string; patchValue: any })[] = []
    for (const diff of rawDiffs) {
      if (!diff || !diff.field) continue

      const field = diff.field
      let actualBefore = (originalRawItem as any)[field]
      if (actualBefore === undefined) {
        if (field === 'status') actualBefore = originalRawItem.item_status
        else if (field === 'planned_end_date') actualBefore = originalRawItem.item_planned_end_date
        else if (field === 'description') actualBefore = originalRawItem.item_content
        else actualBefore = null
      }

      let targetAfter = diff.after
      let patchValue: any = targetAfter
      let displayBefore = String(actualBefore ?? '無')
      let displayAfter = String(targetAfter ?? '無')

      if (field === 'item_status' || field === 'status') {
        const normStatus = normalizeStatusValue(targetAfter)
        if (!normStatus) continue
        targetAfter = normStatus
        patchValue = normStatus
        displayBefore = originalRawItem.item_status || 'Not Start'
        displayAfter = normStatus
      } else if (field.includes('date')) {
        targetAfter = normalizeDateValue(targetAfter)
        patchValue = targetAfter
        displayBefore = actualBefore ? String(actualBefore).split('T')[0] : '無'
        displayAfter = targetAfter || '無'
      } else if (field === 'item_content' || field === 'description') {
        const existingRaw = originalRawItem.item_content || {}
        const beforeText = extractContentText(existingRaw)
        const afterText = extractContentText(targetAfter)

        if (!afterText || beforeText === afterText) continue

        patchValue = typeof existingRaw === 'object' && existingRaw !== null
          ? { ...existingRaw, description: afterText, text: afterText }
          : { description: afterText, text: afterText }

        displayBefore = beforeText || '無'
        displayAfter = afterText
      }

      const canonicalField = (field === 'status' ? 'item_status' : (field === 'description' ? 'item_content' : field))

      if (isFieldDiffReal(canonicalField, actualBefore, patchValue)) {
        validDiffs.push({
          field: canonicalField,
          before: actualBefore,
          after: patchValue,
          displayBefore,
          displayAfter,
          patchValue,
          rationale: diff.rationale || rawItem.reason || '欄位對齊變更'
        })
      }
    }

    let finalAction: 'UPDATE' | 'NO_CHANGE' | 'NEEDS_REVIEW' = rawItem.action || 'NO_CHANGE'
    if (finalAction === 'UPDATE') {
      if (validDiffs.length === 0 || matchedEvidence.length === 0) {
        finalAction = 'NO_CHANGE'
      }
    }

    processedAlignedItems.push({
      item_uid: memoryItem.item_uid,
      item_display_code: memoryItem.item_display_code,
      item_title: memoryItem.item_title,
      item_type: memoryItem.item_type,
      is_mentioned: Boolean(rawItem.is_mentioned),
      matched_evidence: matchedEvidence,
      action: finalAction,
      reason: rawItem.reason || (finalAction === 'NO_CHANGE' ? '維持現狀（無實質變更）' : ''),
      field_diffs: validDiffs
    })
  }

  // Ensure all existing items are represented
  const processedUids = new Set(processedAlignedItems.map(p => p.item_uid))
  for (const m of memorySnapshot) {
    if (!processedUids.has(m.item_uid)) {
      processedAlignedItems.push({
        item_uid: m.item_uid,
        item_display_code: m.item_display_code,
        item_title: m.item_title,
        item_type: m.item_type,
        is_mentioned: false,
        matched_evidence: [],
        action: 'NO_CHANGE',
        reason: '會議記錄未提及此工單',
        field_diffs: []
      })
    }
  }

  const orderMap = new Map(memorySnapshot.map((m, idx) => [m.item_uid, idx]))
  processedAlignedItems.sort((a, b) => (orderMap.get(a.item_uid) ?? 0) - (orderMap.get(b.item_uid) ?? 0))

  // 4. Reconcile New Candidates (Duplicate Protection & Parent Validation)
  const candidateIdSet = new Set(rawNewCandidates.map(c => c.candidate_id))
  const validatedNewCandidates: NewCandidateItem[] = []
  const needsReviewItems: any[] = []

  for (const cand of rawNewCandidates) {
    // Check if semantically identical item already exists in DB
    const lowerTitle = (cand.item_title || '').trim().toLowerCase()
    const duplicateExisting = items.find(existing => 
      existing.item_type?.toLowerCase() === cand.item_type?.toLowerCase() &&
      existing.item_title?.trim().toLowerCase() === lowerTitle
    )

    if (duplicateExisting) {
      // Already persisted - do not recreate duplicate
      continue
    }

    // Validate parent references
    let validatedParentCandidateId: string | null = null
    let validatedParentItemUid: string | null = null

    if (cand.parent_item_uid) {
      if (memoryMap.has(cand.parent_item_uid)) {
        validatedParentItemUid = cand.parent_item_uid
      } else {
        // Unknown DB parent UID -> flag for review
        needsReviewItems.push({
          candidateId: cand.candidate_id,
          title: cand.item_title,
          type: cand.item_type,
          issue: `參照之父工單 UID (${cand.parent_item_uid}) 在資料庫中不存在`,
          evidence: cand.matched_evidence
        })
      }
    }

    if (cand.parent_candidate_id) {
      if (candidateIdSet.has(cand.parent_candidate_id)) {
        validatedParentCandidateId = cand.parent_candidate_id
      } else {
        // Unknown candidate parent ID -> flag for review
        needsReviewItems.push({
          candidateId: cand.candidate_id,
          title: cand.item_title,
          type: cand.item_type,
          issue: `參照之父候選項目 (${cand.parent_candidate_id}) 在本批次中不存在`,
          evidence: cand.matched_evidence
        })
      }
    }

    validatedNewCandidates.push({
      candidate_id: cand.candidate_id,
      item_type: cand.item_type || 'Task',
      item_title: cand.item_title,
      item_status: normalizeStatusValue(cand.item_status) || 'Not Start',
      item_priority: cand.item_priority || 'Middle',
      assignee_name: cand.assignee_name || null,
      parent_candidate_id: validatedParentCandidateId,
      parent_item_uid: validatedParentItemUid,
      reason: cand.reason || '從文件萃取之全新項目',
      matched_evidence: Array.isArray(cand.matched_evidence) ? cand.matched_evidence : [],
      item_content: cand.item_content || { description: '' }
    })
  }

  const updateItems = processedAlignedItems.filter(i => i.action === 'UPDATE')
  const noChangeItems = processedAlignedItems.filter(i => i.action === 'NO_CHANGE')
  const existingNeedsReview = processedAlignedItems.filter(i => i.action === 'NEEDS_REVIEW')

  // 5. Build Unified ActionPreview Items (Mixed CREATE + UPDATE)
  const previewItems: any[] = []

  // Add CREATE actions
  for (const cand of validatedNewCandidates) {
    previewItems.push({
      actionType: 'create_item' as const,
      candidateId: cand.candidate_id,
      itemType: cand.item_type,
      itemTitle: cand.item_title,
      proposalTitle: `➕ 新建項目：${cand.item_title}`,
      description: cand.reason,
      rationale: cand.reason,
      itemStatus: cand.item_status,
      itemPriority: cand.item_priority,
      assigneeName: cand.assignee_name,
      parentCandidateId: cand.parent_candidate_id,
      parentItemUid: cand.parent_item_uid,
      updates: {
        item_content: cand.item_content,
        item_status: cand.item_status,
        item_priority: cand.item_priority
      },
      relationshipStatus: 'CONFIRMED' as const,
      sourceEvidence: {
        extractedFact: cand.matched_evidence.join('\n'),
        sourceText: cand.matched_evidence.join('\n'),
        sourceLabel: cand.item_type,
        confidence: 0.95
      }
    })
  }

  // Add UPDATE actions
  for (const item of updateItems) {
    if (item.field_diffs.length === 0) continue

    const updatesObj: Record<string, any> = {}
    for (const diff of item.field_diffs) {
      updatesObj[diff.field] = (diff as any).patchValue !== undefined ? (diff as any).patchValue : diff.after
    }

    const diffSummary = item.field_diffs.map((d: any) => {
      const beforeStr = d.displayBefore || extractContentText(d.before) || '無'
      const afterStr = d.displayAfter || extractContentText(d.after) || '無'
      const singleBefore = beforeStr.replace(/\n+/g, ' ').slice(0, 30)
      const singleAfter = afterStr.replace(/\n+/g, ' ').slice(0, 30)
      return `${d.field}: ${singleBefore || '無'} ➔ ${singleAfter}`
    }).join(', ')

    previewItems.push({
      actionType: 'update_item' as const,
      targetItemUid: item.item_uid,
      targetDisplayCode: item.item_display_code,
      itemTitle: item.item_title,
      itemType: item.item_type,
      proposalTitle: `🔄 更新工單：${item.item_display_code} ${item.item_title}`,
      description: `變更欄位：${diffSummary}`,
      rationale: item.reason,
      updates: updatesObj,
      relationshipStatus: 'CONFIRMED' as const,
      sourceEvidence: {
        extractedFact: item.matched_evidence.join('\n'),
        sourceText: item.matched_evidence.join('\n'),
        sourceLabel: item.item_type,
        confidence: 0.95
      }
    })
  }

  const actionPreviewPayload = {
    actionId: `unified-reconcile-${Date.now()}`,
    actionType: 'batch_proposal' as const,
    applied: false, // Read-only until human approval
    summary: `🧠 **統一專案記憶對齊提案**：比對 ${items.length} 筆既有工單，提議 ${validatedNewCandidates.length} 項新建 (CREATE)、${updateItems.length} 項更新 (UPDATE)（其餘 ${noChangeItems.length} 項維持現狀）。`,
    items: previewItems
  }

  // 6. Build Markdown Report
  let reportMarkdown = `### 🧠 統一專案記憶對齊報告 (Unified Project Memory Alignment)

- **目標專案**：\`${projectName}\`
- **對齊工單數**：\`${items.length}\` 筆既有工單
- **分析結果**：\`${validatedNewCandidates.length}\` 處新建 (CREATE) ｜ \`${updateItems.length}\` 處更新 (UPDATE) ｜ \`${noChangeItems.length}\` 處維持現狀 (NO_CHANGE) ｜ \`${existingNeedsReview.length + needsReviewItems.length}\` 處待審核 (NEEDS_REVIEW)
- **提案生成**：\`${previewItems.length}\` 筆可執行提案（已排除 NO_CHANGE 與重複項）
- **寫入狀態**：唯讀安全預覽模式（需經人類審批後方可提交寫入）

---
`

  if (validatedNewCandidates.length > 0) {
    reportMarkdown += `\n#### ➕ 新建項目提議 (CREATE)\n\n`
    reportMarkdown += `| 候選代碼 | 項目標題 | 類型 | 狀態 | 父層關聯 | 佐證與理由 |\n`
    reportMarkdown += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`
    for (const cand of validatedNewCandidates) {
      const parentInfo = cand.parent_candidate_id ? `候選 \`${cand.parent_candidate_id}\`` : (cand.parent_item_uid ? `既有 \`${cand.parent_item_uid.slice(0, 8)}...\`` : '*直屬專案*')
      const ev = cand.matched_evidence.length > 0 ? `"${cand.matched_evidence[0].slice(0, 50)}..."` : cand.reason
      reportMarkdown += `| \`${cand.candidate_id}\` | **${cand.item_title}** | \`${cand.item_type}\` | \`${cand.item_status}\` | ${parentInfo} | ${ev} |\n`
    }
  }

  if (processedAlignedItems.length > 0) {
    reportMarkdown += `\n#### 📋 既有工單對齊明細 (EXISTING ITEMS)\n\n`
    reportMarkdown += `| 代碼 | 工單標題 | 類型 | 狀態 | 決策 | 變更詳情 / 依據 |\n`
    reportMarkdown += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`
    for (const item of processedAlignedItems) {
      const action = item.action
      const statusIcon = action === 'UPDATE' ? '🔄' : (action === 'NEEDS_REVIEW' ? '⚠️' : '✅')
      const diffs = item.field_diffs
      const matchedEv = item.matched_evidence

      let diffText = '*未在會議中提及*'
      if (diffs.length > 0) {
        diffText = diffs.map((d: any) => {
          const beforeStr = d.displayBefore || extractContentText(d.before) || '無'
          const afterStr = d.displayAfter || extractContentText(d.after) || '無'
          const cleanBefore = beforeStr.length > 40 ? `${beforeStr.replace(/\n+/g, ' ').slice(0, 40)}...` : (beforeStr || '無')
          const cleanAfter = afterStr.length > 40 ? `${afterStr.replace(/\n+/g, ' ').slice(0, 40)}...` : (afterStr || '無')
          return `**${d.field}**: \`${cleanBefore}\` ➔ \`${cleanAfter}\`<br>*理由*: ${d.rationale}`
        }).join('<br>')
      } else if (matchedEv.length > 0) {
        diffText = `*依據確認*: "${matchedEv[0].slice(0, 50)}..."`
      } else if (action === 'NO_CHANGE') {
        diffText = '*維持現狀 (無實質變更)*'
      }

      reportMarkdown += `| \`${item.item_display_code}\` | **${item.item_title}** | \`${item.item_type}\` | ${item.is_mentioned ? '🟢 已提及' : '⚪ 未提及'} | ${statusIcon} \`${action}\` | ${diffText} |\n`
    }
  }

  if (unmatchedEvidence.length > 0) {
    reportMarkdown += `\n---\n\n#### 📌 未映射之會議事實（非工單觀察）\n\n`
    for (const u of unmatchedEvidence) {
      reportMarkdown += `- **${u.topic}**: > "${u.excerpt}"\n  *備註*: ${u.notes}\n`
    }
  }

  // 7. Build Authoritative CanonicalProposal (ReconciliationProposal)
  const docHash = crypto.createHash('sha256').update(transcriptText).digest('hex')
  const proposalId = `PROP-UNIFIED-${Date.now().toString(36).toUpperCase()}`

  const canonicalCreates = validatedNewCandidates.map((cand, idx) => ({
    candidateId: cand.candidate_id,
    proposalItemId: `P001-I${String(idx + 1).padStart(2, '0')}`,
    itemTitle: cand.item_title,
    itemType: cand.item_type,
    itemPriority: cand.item_type === 'Meeting' ? undefined : (cand.item_priority || undefined),
    parentCandidateId: cand.parent_candidate_id || undefined,
    parentItemUid: cand.parent_item_uid || undefined,
    relationshipStatus: (cand.parent_candidate_id || cand.parent_item_uid ? 'CONFIRMED' : undefined) as any,
    description: cand.item_content?.description || cand.reason,
    sourceContent: cand.item_type === 'Meeting' ? transcriptText : (cand.item_content?.description || cand.reason),
    evidenceType: 'SOURCE_FACT' as const,
    commitmentStatus: 'CONFIRMED' as const,
    sourceLabel: cand.item_type,
    sourceEvidence: {
      extractedFact: cand.matched_evidence.join('\n') || cand.item_title,
      sourceText: cand.item_type === 'Meeting' ? transcriptText : (cand.matched_evidence.join('\n') || cand.item_title),
      sourceLabel: cand.item_type,
      confidence: 0.95
    }
  }))

  const canonicalUpdates = updateItems.filter(i => i.field_diffs.length > 0).map((up, idx) => {
    const updatesObj: Record<string, any> = {}
    for (const diff of up.field_diffs) {
      updatesObj[diff.field] = (diff as any).patchValue !== undefined ? (diff as any).patchValue : diff.after
    }
    return {
      candidateId: up.item_display_code,
      proposalItemId: `P001-U${String(idx + 1).padStart(2, '0')}`,
      targetItemUid: up.item_uid,
      targetDisplayCode: up.item_display_code,
      itemTitle: up.item_title,
      sourceLabel: up.item_type,
      updates: updatesObj,
      fieldDiffs: up.field_diffs.map(d => ({
        field: d.field,
        existingValue: d.before,
        proposedValue: d.after,
        action: 'UPDATE' as const,
        reason: d.rationale
      })),
      reason: up.reason
    }
  })

  const canonicalNoChanges = noChangeItems.map((nc, idx) => ({
    candidateId: nc.item_display_code,
    proposalItemId: `P001-N${String(idx + 1).padStart(2, '0')}`,
    existingItemUid: nc.item_uid,
    existingDisplayCode: nc.item_display_code,
    reason: nc.reason,
    sourceLabel: nc.item_type
  }))

  const canonicalProposal: ReconciliationProposal = {
    proposalId,
    proposalVersion: 1,
    mode: items.length === 0 ? 'FULL_INITIALIZATION' : 'INCREMENTAL_RECONCILIATION',
    sourceDocumentHash: docHash,
    createdAt: new Date().toISOString(),
    creates: canonicalCreates,
    updates: canonicalUpdates,
    noChanges: canonicalNoChanges,
    reviewRequired: [...existingNeedsReview, ...needsReviewItems].map(nr => ({
      candidateId: nr.candidateId || nr.item_display_code || 'NEEDS_REVIEW',
      candidate: (nr.candidate || {
        candidateId: nr.candidateId || nr.item_display_code || 'NEEDS_REVIEW',
        itemTitle: nr.item_title || nr.candidateId || '待審核項目',
        itemType: nr.item_type || 'Task',
        description: nr.reason || nr.issue || '待審核項目'
      }) as any,
      reason: nr.issue || nr.reason || '待審核項目'
    })),
    relations: [],
    relationships: [],
    ignored: [],
    coverage: {
      extracted: validatedNewCandidates.length + updateItems.length,
      processed: validatedNewCandidates.length + updateItems.length,
      isComplete: true
    },
    validation: {
      status: 'PASS',
      errors: [],
      warnings: []
    }
  }

  // Compute deterministic SHA-256 hash & register with server authority
  canonicalProposal.proposalHash = computeProposalHash(canonicalProposal)
  registerAuthoritativeProposal(canonicalProposal)

  return {
    reportMarkdown,
    actionPreview: actionPreviewPayload,
    canonicalProposal,
    summary: {
      totalExisting: items.length,
      mentionedExistingCount: processedAlignedItems.filter(i => i.is_mentioned).length,
      updateCount: updateItems.length,
      noChangeCount: noChangeItems.length,
      createCount: validatedNewCandidates.length,
      needsReviewCount: existingNeedsReview.length + needsReviewItems.length,
      unmatchedCount: unmatchedEvidence.length
    },
    details: {
      alignedExisting: processedAlignedItems,
      newCandidates: validatedNewCandidates,
      needsReview: [...existingNeedsReview, ...needsReviewItems],
      unmatched: unmatchedEvidence
    }
  }
}
