import { callSubAgentJson } from '../../agents/llmClient.js'

export interface BetaAlignmentOptions {
  projectUid: string
  projectName: string
  items: any[]
  transcriptText: string
  model?: string
}

export interface AlignedItemDiff {
  field: string
  before: any
  after: any
  rationale: string
}

export interface AlignedItem {
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

export interface UnmatchedObservation {
  topic: string
  excerpt: string
  notes: string
}

export interface LlmAlignmentResponse {
  aligned_items: AlignedItem[]
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

function isFieldDiffReal(field: string, beforeVal: any, afterVal: any): boolean {
  // 1. Status comparison
  if (field === 'item_status' || field === 'status') {
    const normBefore = normalizeStatusValue(beforeVal)
    const normAfter = normalizeStatusValue(afterVal)
    if (!normAfter) return false
    return normBefore !== normAfter
  }

  // 2. Date comparison
  if (field.includes('date')) {
    const normBefore = normalizeDateValue(beforeVal)
    const normAfter = normalizeDateValue(afterVal)
    if (normBefore === null && normAfter === null) return false
    return normBefore !== normAfter
  }

  // 3. String / null comparison
  if (beforeVal === null || beforeVal === undefined) {
    if (afterVal === null || afterVal === undefined || afterVal === '') return false
    return true
  }
  if (afterVal === null || afterVal === undefined) {
    if (beforeVal === null || beforeVal === undefined || beforeVal === '') return false
    return true
  }

  // 4. Object / JSON comparison (e.g. item_content)
  if (typeof beforeVal === 'object' || typeof afterVal === 'object') {
    const bStr = JSON.stringify(beforeVal || {})
    const aStr = JSON.stringify(afterVal || {})
    return bStr !== aStr
  }

  return String(beforeVal).trim() !== String(afterVal).trim()
}

export async function executeBetaMemoryAlignment(options: BetaAlignmentOptions): Promise<{
  reportMarkdown: string
  actionPreview: any
  summary: {
    totalExisting: number
    mentionedCount: number
    updateCount: number
    noChangeCount: number
    needsReviewCount: number
    unmatchedCount: number
  }
}> {
  const { projectUid, projectName, items, transcriptText, model } = options

  if (!items || items.length === 0) {
    return {
      reportMarkdown: `### ⚠️ 專案記憶對齊 (Beta) 提示\n\n專案 **${projectName}** 目前在資料庫中尚無既有工單。\n\n**記憶對齊 (Memory Alignment Beta)** 專門用於比對與更新現有專案記憶，不支援全新工單的初次建立 (CREATE)。\n若要全量初始化專案骨架，請切換至標準 Copilot 模式。`,
      actionPreview: null,
      summary: {
        totalExisting: 0,
        mentionedCount: 0,
        updateCount: 0,
        noChangeCount: 0,
        needsReviewCount: 0,
        unmatchedCount: 0
      }
    }
  }

  // 1. Prepare minimal, authoritative Project Memory payload
  const memorySnapshot = items.map(i => ({
    item_uid: i.item_uid,
    item_display_code: i.item_display_code,
    item_type: i.item_type,
    item_title: i.item_title,
    item_status: i.item_status,
    item_priority: i.item_priority || 'Middle',
    assignee: i.follow_by_name || null,
    item_planned_end_date: i.item_planned_end_date || null,
    parent_item_uid: i.parent_item_uid || null,
    item_content: typeof i.item_content === 'object' && i.item_content?.description
      ? { description: i.item_content.description }
      : (typeof i.item_content === 'string' ? { description: i.item_content } : {})
  }))

  // 2. Single-LLM Alignment Prompt (Exact Generic Pattern)
  const systemPrompt = `You are an expert Project Alignment Engine for Projectson.
Your task is to compare a NEW meeting transcript against an authoritative list of EXISTING project items (Project Memory).

CRITICAL CONSTRAINTS & BEHAVIOR:
1. EXISTING-ITEM ALIGNMENT ONLY:
   - For every existing item in the provided Project Memory, evaluate whether the meeting mentions it.
   - If mentioned and evidence shows substantive progress or completed work, propose UPDATE with precise, genuine field_diffs.
   - If mentioned to reaffirm existing scope, tentative targets, or ongoing validation without status changes, propose NO_CHANGE.
   - If not mentioned at all, propose NO_CHANGE.
   - If ambiguous or conflicting, propose NEEDS_REVIEW.
   - DO NOT generate CREATE proposals. DO NOT generate new items.

2. PRESERVATION OF FIDELITY & NO-OP REJECTION:
   - Preserve all existing fields unless explicitly modified by meeting evidence.
   - NEVER propose a field diff where the Before and After values are identical (e.g., item_planned_end_date: null -> null is STRICTLY FORBIDDEN).
   - Do NOT promote tentative targets (e.g. proposed 30% reduction, rough <3s performance) to confirmed commitments.
   - Do NOT invent or assume new milestone dates if the meeting explicitly states not to invent a new date.
   - Never map alignment rationales or evidence notes into item_content or descriptions unless proposing a grounded, factual progress update.

3. PRESERVE FACTUAL PROGRESS DETAILS IN ITEM_CONTENT:
   - When a task's status updates (e.g. "Not Start" -> "In Progress") and the meeting reveals specific factual progress details (such as files received, pending integrations, completed checks, or outstanding reviews):
     - Preserve the original task description and append a factual progress update under item_content, e.g.:
       {
         "description": "<existing description>\\n\\n### 進度記錄 (Progress Update):\\n- <factual point 1>\\n- <factual point 2>"
       }
     - Do NOT overwrite or erase the original task definition.

4. UNMATCHED OBSERVATIONS:
   - Any document-level facts, future ideas, or out-of-scope discussions that do not correspond to existing items must be placed in "unmatched_evidence" as non-mutating observations.

OUTPUT FORMAT:
Return a strictly valid JSON object matching this schema:
{
  "aligned_items": [
    {
      "item_uid": string (exact match from Project Memory),
      "item_display_code": string (exact match from Project Memory),
      "item_title": string (exact match),
      "item_type": string (exact match),
      "is_mentioned": boolean,
      "matched_evidence": string[] (verbatim or close quotes from meeting),
      "action": "UPDATE" | "NO_CHANGE" | "NEEDS_REVIEW",
      "reason": string (clear explanation of why this action was selected),
      "field_diffs": [
        {
          "field": string (e.g. "item_status", "item_planned_end_date", "item_content"),
          "before": any (exact value from Project Memory),
          "after": any (new value grounded in transcript evidence),
          "rationale": string
        }
      ]
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

### NEW MEETING TRANSCRIPT
${transcriptText}

Perform the alignment analysis and output valid JSON.`

  const llmRes = await callSubAgentJson<LlmAlignmentResponse>({
    systemPrompt,
    userPrompt,
    model,
    temperature: 0.1,
    timeoutMs: 120000
  })

  const rawAlignedItems: AlignedItem[] = llmRes?.aligned_items || []
  const unmatchedEvidence: UnmatchedObservation[] = llmRes?.unmatched_evidence || []

  // 3. Reconcile with Authoritative DB Snapshot for Safety
  const memoryMap = new Map(memorySnapshot.map(m => [m.item_uid, m]))
  const memoryCodeMap = new Map(memorySnapshot.map(m => [m.item_display_code, m]))

  const processedAlignedItems: AlignedItem[] = []

  for (const rawItem of rawAlignedItems) {
    const original = memoryMap.get(rawItem.item_uid) || memoryCodeMap.get(rawItem.item_display_code)
    if (!original) continue

    const matchedEvidence = Array.isArray(rawItem.matched_evidence) ? rawItem.matched_evidence.filter(Boolean) : []
    const rawDiffs = Array.isArray(rawItem.field_diffs) ? rawItem.field_diffs : []

    // Filter and normalize field diffs against authoritative DB values
    const validDiffs: AlignedItemDiff[] = []
    for (const diff of rawDiffs) {
      if (!diff || !diff.field) continue

      const field = diff.field
      let actualBefore = (original as any)[field]
      if (actualBefore === undefined) {
        if (field === 'status') actualBefore = original.item_status
        else if (field === 'planned_end_date') actualBefore = original.item_planned_end_date
        else actualBefore = null
      }

      let targetAfter = diff.after
      if (field === 'item_status' || field === 'status') {
        const normStatus = normalizeStatusValue(targetAfter)
        if (!normStatus) continue
        targetAfter = normStatus
      } else if (field.includes('date')) {
        targetAfter = normalizeDateValue(targetAfter)
      }

      if (isFieldDiffReal(field, actualBefore, targetAfter)) {
        validDiffs.push({
          field,
          before: actualBefore,
          after: targetAfter,
          rationale: diff.rationale || rawItem.reason || '欄位對齊變更'
        })
      }
    }

    // Determine final validated action
    let finalAction: 'UPDATE' | 'NO_CHANGE' | 'NEEDS_REVIEW' = rawItem.action || 'NO_CHANGE'
    if (finalAction === 'UPDATE') {
      if (validDiffs.length === 0 || matchedEvidence.length === 0) {
        finalAction = 'NO_CHANGE'
      }
    }

    const displayCode = original.item_display_code
    const title = original.item_title
    const type = original.item_type
    const reason = rawItem.reason || (finalAction === 'NO_CHANGE' ? '維持現狀（無實質變更）' : '')

    processedAlignedItems.push({
      item_uid: original.item_uid,
      item_display_code: displayCode,
      item_title: title,
      item_type: type,
      is_mentioned: Boolean(rawItem.is_mentioned),
      matched_evidence: matchedEvidence,
      action: finalAction,
      reason,
      field_diffs: validDiffs
    })
  }

  // Ensure all items in memorySnapshot are represented
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

  const updateItems = processedAlignedItems.filter(i => i.action === 'UPDATE')
  const noChangeItems = processedAlignedItems.filter(i => i.action === 'NO_CHANGE')
  const needsReviewItems = processedAlignedItems.filter(i => i.action === 'NEEDS_REVIEW')

  // Build Standard UI ActionPreview Items (STRICTLY ONLY GENUINE UPDATES)
  const previewItems = updateItems
    .filter(item => item.field_diffs.length > 0)
    .map(item => {
      const updatesObj: Record<string, any> = {}
      for (const diff of item.field_diffs) {
        updatesObj[diff.field] = diff.after
      }

      const diffSummary = item.field_diffs.map(d => `${d.field}: ${d.before ?? '無'} ➔ ${d.after}`).join(', ')

      return {
        actionType: 'update_item' as const,
        targetItemUid: item.item_uid,
        targetDisplayCode: item.item_display_code,
        itemTitle: item.item_title,
        itemType: item.item_type,
        proposalTitle: `更新工單：${item.item_display_code} ${item.item_title}`,
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
      }
    })

  const actionPreviewPayload = {
    actionId: `beta-align-${Date.now()}`,
    actionType: 'batch_proposal' as const,
    applied: false, // Read-only in Beta
    summary: previewItems.length > 0
      ? `🧠 **記憶對齊 (Beta) 提案**：比對 ${items.length} 筆既有工單，提議 ${previewItems.length} 項實質更新（其餘 ${noChangeItems.length} 項維持現狀）。`
      : `🧠 **記憶對齊 (Beta) 分析完成**：比對 ${items.length} 筆既有工單，所有項目均維持現狀或無實質變更，無需產生更新提案。`,
    items: previewItems
  }

  // 4. Build Markdown Report (Displays all items with their status)
  let reportMarkdown = `### 🧠 專案記憶對齊報告 (Single-LLM Memory Alignment Beta)

- **目標專案**：\`${projectName}\`
- **對齊工單數**：\`${items.length}\` 筆既有工單
- **比對結果**：\`${updateItems.length}\` 處實質更新 (UPDATE) ｜ \`${noChangeItems.length}\` 處維持現狀 (NO_CHANGE) ｜ \`${needsReviewItems.length}\` 處待審核 (NEEDS_REVIEW)
- **提案生成**：\`${previewItems.length}\` 筆可執行更新提案（已嚴格過濾 0 變更項目）
- **寫入狀態**：唯讀安全預覽模式（Beta 模式不主動寫入資料庫）

---

#### 📋 工單對齊明細與 Before / After 變更

| 代碼 | 工單標題 | 類型 | 狀態 | 決策 | 變更詳情 / 依據 |
| :--- | :--- | :--- | :--- | :--- | :--- |
`

  for (const item of processedAlignedItems) {
    const action = item.action
    const statusIcon = action === 'UPDATE' ? '🔄' : (action === 'NEEDS_REVIEW' ? '⚠️' : '✅')
    const diffs = item.field_diffs
    const matchedEv = item.matched_evidence

    let diffText = '*未在會議中提及*'
    if (diffs.length > 0) {
      diffText = diffs.map(d => `**${d.field}**: \`${d.before ?? '無'}\` ➔ \`${d.after}\`<br>*理由*: ${d.rationale}`).join('<br>')
    } else if (matchedEv.length > 0) {
      diffText = `*依據確認*: "${matchedEv[0].slice(0, 60)}..."`
    } else if (action === 'NO_CHANGE') {
      diffText = '*維持現狀 (無實質變更)*'
    }

    reportMarkdown += `| \`${item.item_display_code}\` | **${item.item_title}** | \`${item.item_type}\` | ${item.is_mentioned ? '🟢 已提及' : '⚪ 未提及'} | ${statusIcon} \`${action}\` | ${diffText} |\n`
  }

  if (unmatchedEvidence.length > 0) {
    reportMarkdown += `\n---\n\n#### 📌 未映射之會議事實（非工單觀察）\n\n`
    for (const u of unmatchedEvidence) {
      reportMarkdown += `- **${u.topic}**: > "${u.excerpt}"\n  *備註*: ${u.notes}\n`
    }
  }

  return {
    reportMarkdown,
    actionPreview: actionPreviewPayload,
    summary: {
      totalExisting: items.length,
      mentionedCount: processedAlignedItems.filter(i => i.is_mentioned).length,
      updateCount: updateItems.length,
      noChangeCount: noChangeItems.length,
      needsReviewCount: needsReviewItems.length,
      unmatchedCount: unmatchedEvidence.length
    }
  }
}

