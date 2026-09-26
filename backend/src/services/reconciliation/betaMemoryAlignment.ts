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
   - If mentioned and evidence shows substantive progress or completed work, propose UPDATE with precise field_diffs.
   - If mentioned to reaffirm existing scope, tentative targets, or ongoing validation without status changes, propose NO_CHANGE.
   - If not mentioned at all, propose NO_CHANGE.
   - If ambiguous or conflicting, propose NEEDS_REVIEW.
   - DO NOT generate CREATE proposals. DO NOT generate new items.

2. PRESERVATION OF FIDELITY:
   - Preserve all existing fields unless explicitly modified by meeting evidence.
   - Do NOT promote tentative targets (e.g. proposed 30% reduction, rough <3s performance) to confirmed commitments.
   - Do NOT invent or assume new milestone dates if the meeting explicitly states not to invent a new date.
   - If an item had a planned date that was missed and explicitly left open pending validation, set item_planned_end_date to null or note the update with clear rationale.

3. UNMATCHED OBSERVATIONS:
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
          "field": string (e.g. "item_status", "item_planned_end_date"),
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

  const alignedItems: AlignedItem[] = llmRes?.aligned_items || []
  const unmatchedEvidence: UnmatchedObservation[] = llmRes?.unmatched_evidence || []

  // 3. Reconcile with Original DB Snapshot for Safety
  const memoryMap = new Map(memorySnapshot.map(m => [m.item_uid, m]))
  
  const updateItems = alignedItems.filter(i => i.action === 'UPDATE')
  const noChangeItems = alignedItems.filter(i => i.action === 'NO_CHANGE')
  const needsReviewItems = alignedItems.filter(i => i.action === 'NEEDS_REVIEW')

  // Build Standard UI ActionPreview Items
  const previewItems = alignedItems.map(item => {
    const original = memoryMap.get(item.item_uid)
    const updatesObj: Record<string, any> = {}
    for (const diff of item.field_diffs) {
      updatesObj[diff.field] = diff.after
    }

    return {
      actionType: 'update_item' as const,
      targetItemUid: item.item_uid,
      targetDisplayCode: item.item_display_code,
      itemTitle: item.item_title,
      itemType: item.item_type,
      proposalTitle: `對齊工單：${item.item_display_code} ${item.item_title}`,
      description: item.reason,
      rationale: item.reason,
      updates: Object.keys(updatesObj).length > 0 ? updatesObj : undefined,
      relationshipStatus: item.action === 'NEEDS_REVIEW' ? ('NEEDS_REVIEW' as const) : ('CONFIRMED' as const),
      sourceEvidence: {
        extractedFact: item.matched_evidence.join('\n'),
        sourceText: item.matched_evidence.join('\n'),
        sourceLabel: item.item_type,
        confidence: item.action === 'UPDATE' ? 0.95 : 0.8
      }
    }
  })

  const actionPreviewPayload = {
    actionId: `beta-align-${Date.now()}`,
    actionType: 'batch_proposal' as const,
    applied: false, // Read-only in Beta version 1
    summary: `🧠 **記憶對齊 (Beta) 提案**：比對 ${items.length} 筆既有工單，提議 ${updateItems.length} 項更新、${noChangeItems.length} 項維持現狀、${needsReviewItems.length} 項待審核。`,
    items: previewItems
  }

  // 4. Build Markdown Report
  let reportMarkdown = `### 🧠 專案記憶對齊報告 (Single-LLM Memory Alignment Beta)

- **目標專案**：\`${projectName}\`
- **對齊工單數**：\`${items.length}\` 筆既有工單
- **比對結果**：\`${updateItems.length}\` 處更新 (UPDATE) ｜ \`${noChangeItems.length}\` 處確認無變更 (NO_CHANGE) ｜ \`${needsReviewItems.length}\` 處待審核 (NEEDS_REVIEW)
- **寫入狀態**：唯讀安全預覽模式（Beta 模式不主動寫入資料庫）

---

#### 📋 工單對齊明細與 Before / After 變更

| 代碼 | 工單標題 | 類型 | 狀態 | 決策 | 變更詳情 / 證據 |
| :--- | :--- | :--- | :--- | :--- | :--- |
`

  for (const item of alignedItems) {
    const statusIcon = item.action === 'UPDATE' ? '🔄' : (item.action === 'NEEDS_REVIEW' ? '⚠️' : '✅')
    const diffText = item.field_diffs.length > 0
      ? item.field_diffs.map(d => `**${d.field}**: \`${d.before}\` ➔ \`${d.after}\`<br>*理由*: ${d.rationale}`).join('<br>')
      : (item.matched_evidence.length > 0 ? `*依據確認*: "${item.matched_evidence[0].slice(0, 50)}..."` : '*未在會議中提及*')

    reportMarkdown += `| \`${item.item_display_code}\` | **${item.item_title}** | \`${item.item_type}\` | ${item.is_mentioned ? '🟢 已提及' : '⚪ 未提及'} | ${statusIcon} \`${item.action}\` | ${diffText} |\n`
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
      mentionedCount: alignedItems.filter(i => i.is_mentioned).length,
      updateCount: updateItems.length,
      noChangeCount: noChangeItems.length,
      needsReviewCount: needsReviewItems.length,
      unmatchedCount: unmatchedEvidence.length
    }
  }
}
