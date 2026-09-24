import { CandidateItem, ReconciledCandidate, ReconciliationAction, FieldDiff } from './types.js'
import { ProjectItemMemory, retrieveCandidateMatches } from './memoryRetriever.js'

/**
 * 元素級屬性比對與動作決策引擎 (Element-Level Matching & Action Classification Engine)
 * 核心原則：
 * 1. EXTRACTION ≠ ACTION DECISION: 提取只是事實候選，必須經過 DB 比對才判定動作
 * 2. 動作分類支援：CREATE, UPDATE, CORRECTION, NO_CHANGE, NEEDS_REVIEW, CONFLICT, IGNORE
 * 3. 欄位級 Diff 隔離 (Field-Level Diffing)：精確識別哪個欄位改變，絕不把單欄位變更視為全量覆寫
 * 4. 來源證據強制綁定 (Evidence Grounding): 每個 FieldDiff 皆保留 evidenceRefs
 */
export function reconcileCandidate(
  candidate: CandidateItem,
  existingItems: ProjectItemMemory[],
  members: any[] = []
): ReconciledCandidate {
  // 0. 判斷是否為無意義資訊 (IGNORE)
  if (!candidate.title || candidate.title.trim().length < 2) {
    return {
      candidateId: candidate.candidateId,
      proposalItemId: candidate.proposalItemId,
      action: 'IGNORE',
      candidate,
      confidence: 1.0,
      reason: '文字過短或無有效工單內容，安全略過。'
    }
  }

  // 1. 檢索既有專案記憶 (Multi-Signal Item-Level Semantic Matching)
  const matches = retrieveCandidateMatches(candidate, existingItems)

  // 2. 無任何匹配 ➔ CREATE (New Item Detection) 或 NEEDS_REVIEW (若為推斷條目)
  if (matches.length === 0) {
    if (candidate.inferred || candidate.inferenceStatus === 'INFERENCE' || candidate.classification === 'INFERRED' || candidate.classification === 'INFERRED_SPECULATIVE_RECORD') {
      return {
        candidateId: candidate.candidateId,
        proposalItemId: candidate.proposalItemId,
        proposalNodeId: candidate.proposalNodeId,
        action: 'NEEDS_REVIEW',
        candidate,
        matchStatus: 'NO_MATCH',
        confidence: candidate.confidence ?? 0.6,
        reviewStatus: 'NEEDS_REVIEW',
        reason: 'AI 推斷或非顯式定義條目，未具備直接 CREATE 之權威來源事實，進入 NEEDS_REVIEW。'
      }
    }
    return {
      candidateId: candidate.candidateId,
      proposalItemId: candidate.proposalItemId,
      proposalNodeId: candidate.proposalNodeId,
      action: 'CREATE',
      candidate,
      matchStatus: 'NO_MATCH',
      confidence: candidate.confidence ?? 1.0,
      reason: '資料庫中無相符之既有工單，判定為全新項目。'
    }
  }

  const topMatchResult = matches[0]
  const topMatch = topMatchResult.item

  // 3. 衝突檢測 ➔ CONFLICT
  if (topMatchResult.matchStatus === 'CONFLICT' || (topMatchResult.conflicts && topMatchResult.conflicts.length > 0)) {
    return {
      candidateId: candidate.candidateId,
      proposalItemId: candidate.proposalItemId,
      action: 'CONFLICT',
      candidate,
      existingItemUid: topMatch.item_uid,
      existingDisplayCode: topMatch.item_display_code,
      matchStatus: 'CONFLICT',
      confidence: 0.9,
      reviewStatus: 'CONFLICT',
      reason: topMatchResult.conflicts ? topMatchResult.conflicts.join('; ') : `文件內容與既有權威記錄 [${topMatch.item_display_code || topMatch.item_uid}] 存在衝突，需人工裁決。`
    }
  }

  // 4. 存在多個高分模糊匹配且無確切首選 ➔ NEEDS_REVIEW / AMBIGUOUS
  if (topMatchResult.matchStatus === 'AMBIGUOUS' || (matches.length > 1 && topMatchResult.score >= 7 && matches[1].score >= 7 && Math.abs(topMatchResult.score - matches[1].score) < 1.5)) {
    return {
      candidateId: candidate.candidateId,
      proposalItemId: candidate.proposalItemId,
      action: 'NEEDS_REVIEW',
      candidate,
      existingItemUid: topMatch.item_uid,
      existingDisplayCode: topMatch.item_display_code,
      matchStatus: 'AMBIGUOUS',
      confidence: 0.6,
      reviewStatus: 'NEEDS_REVIEW',
      possibleMatches: matches.slice(0, 3).map(m => ({
        item_uid: m.item.item_uid,
        item_display_code: m.item.item_display_code || m.item.item_uid,
        item_title: m.item.item_title,
        score: m.score,
        matchStatus: m.matchStatus
      })),
      reason: `發現多張高相似度既有工單（如 [${matches[0].item.item_display_code}] 與 [${matches[1].item.item_display_code}]），證據不足以唯一識別，標記為 NEEDS_REVIEW。`
    }
  }

  // 5. 元素級欄位比對 (Element-Level Field Diffing)
  const isSameType = topMatch.item_type === candidate.canonicalType

  if (isSameType && topMatchResult.score >= 6) {
    const existingTitleNorm = topMatch.item_title.trim().toLowerCase()
    const candTitleNorm = candidate.title.trim().toLowerCase()

    // 5.1 會議工單同主題特例 (Meeting Idempotency)
    if (candidate.canonicalType === 'Meeting' && existingTitleNorm === candTitleNorm) {
      return {
        candidateId: candidate.candidateId,
        proposalItemId: candidate.proposalItemId,
        action: 'NO_CHANGE',
        candidate,
        existingItemUid: topMatch.item_uid,
        existingDisplayCode: topMatch.item_display_code,
        matchStatus: topMatchResult.matchStatus,
        confidence: 1.0,
        reason: `會議工單「${topMatch.item_title}」已存在於資料庫中，無需重複建立。`
      }
    }

    const fieldDiffs: FieldDiff[] = []
    const changes: ReconciledCandidate['changes'] = {}
    const evRef = candidate.evidenceId ? [candidate.evidenceId] : []

    // A. 標題比對 (item_title)
    if (existingTitleNorm !== candTitleNorm) {
      if (candidate.title.length > topMatch.item_title.length && candTitleNorm.includes(existingTitleNorm)) {
        fieldDiffs.push({
          field: 'item_title',
          existingValue: topMatch.item_title,
          proposedValue: candidate.title,
          action: 'UPDATE',
          evidenceRefs: evRef,
          reason: '補充更完整之標題名稱'
        })
        changes.itemTitle = candidate.title
      }
    }

    // B. 內文/描述比對 (description / item_content)
    const rawExistingContent = typeof topMatch.item_content === 'string'
      ? topMatch.item_content
      : (topMatch.item_content?.text || topMatch.item_content?.description || '')
    const stripHeaderAndSpaces = (s: string) => {
      const withoutHeadings = s.replace(/^#{1,6}\s+[^\n]+(\r?\n|$)/gm, '')
      const base = withoutHeadings.trim().length > 0 ? withoutHeadings : s
      return base.replace(/\s+/g, ' ').trim().toLowerCase()
    }
    const cleanExisting = stripHeaderAndSpaces(rawExistingContent)
    const candRawContent = candidate.description || candidate.sourceContent || ''
    const cleanCand = stripHeaderAndSpaces(candRawContent)

    if (cleanCand && cleanCand !== cleanExisting && !cleanCand.includes(cleanExisting) && cleanCand.length > cleanExisting.length + 15) {
      fieldDiffs.push({
        field: 'description',
        existingValue: rawExistingContent || '(無內文)',
        proposedValue: candidate.description || candidate.sourceContent,
        action: 'UPDATE',
        evidenceRefs: evRef,
        reason: '會議提供補充實作細節與描述'
      })
      changes.itemContent = { text: candidate.description || candidate.sourceContent, description: candidate.description || candidate.sourceContent }
    }

    // C. 負責人比對 (assignee / item_follow_by)
    const existingFollowBy = (topMatch.follow_by_name || topMatch.item_follow_by || '').toLowerCase().trim()
    const proposedAssignee = (candidate.assigneeName || candidate.assigneeUid || '').toLowerCase().trim()

    if (candidate.assigneeUid && topMatch.item_follow_by && candidate.assigneeUid !== topMatch.item_follow_by) {
      fieldDiffs.push({
        field: 'assignee',
        existingValue: topMatch.follow_by_name || topMatch.item_follow_by,
        proposedValue: candidate.assigneeName || candidate.assigneeUid,
        action: 'UPDATE',
        evidenceRefs: evRef,
        reason: '變更負責人指派'
      })
      changes.itemFollowBy = candidate.assigneeUid
    } else if (candidate.assigneeUid && !topMatch.item_follow_by) {
      fieldDiffs.push({
        field: 'assignee',
        existingValue: '(未指派)',
        proposedValue: candidate.assigneeName || candidate.assigneeUid,
        action: 'UPDATE',
        evidenceRefs: evRef,
        reason: '新增負責人指派'
      })
      changes.itemFollowBy = candidate.assigneeUid
    }

    // D. 截止日期比對 (due_date / item_planned_end_date)
    const rawExistingDate = topMatch.item_planned_end_date || topMatch.item_due_date || topMatch.due_date || ''
    const existingDate = rawExistingDate ? String(rawExistingDate).split('T')[0] : ''
    const candidateDate = candidate.dueDate ? String(candidate.dueDate).split('T')[0] : ''

    if (candidateDate && existingDate && candidateDate !== existingDate) {
      fieldDiffs.push({
        field: 'due_date',
        existingValue: existingDate,
        proposedValue: candidateDate,
        action: 'UPDATE',
        evidenceRefs: evRef,
        reason: '調整交付日期'
      })
      changes.dueDate = candidateDate
    } else if (candidateDate && !existingDate) {
      fieldDiffs.push({
        field: 'due_date',
        existingValue: '(未設定)',
        proposedValue: candidateDate,
        action: 'UPDATE',
        evidenceRefs: evRef,
        reason: '設定交付日期'
      })
      changes.dueDate = candidateDate
    }

    // E. 優先級比對 (priority / item_priority)
    if (candidate.priority && topMatch.item_priority && candidate.priority !== topMatch.item_priority) {
      fieldDiffs.push({
        field: 'item_priority',
        existingValue: topMatch.item_priority,
        proposedValue: candidate.priority,
        action: 'UPDATE',
        evidenceRefs: evRef,
        reason: '調整優先度'
      })
      changes.itemPriority = candidate.priority
    }

    // 檢查是否含有顯式糾正詞語 ➔ CORRECTION
    const isExplicitCorrection = (candidate.sourceContent || candidate.description || '').match(/(?:修正|更正|訂正|correction|corrected|instead\s*of)/i)
    const finalAction: ReconciliationAction = fieldDiffs.length > 0
      ? (isExplicitCorrection ? 'CORRECTION' : 'UPDATE')
      : 'NO_CHANGE'

    if (finalAction === 'UPDATE' || finalAction === 'CORRECTION') {
      return {
        candidateId: candidate.candidateId,
        proposalItemId: candidate.proposalItemId,
        action: finalAction,
        candidate,
        existingItemUid: topMatch.item_uid,
        existingDisplayCode: topMatch.item_display_code,
        matchStatus: topMatchResult.matchStatus,
        fieldDiffs,
        changes,
        confidence: 0.95,
        reason: `比對既有工單 [${topMatch.item_display_code || topMatch.item_uid}]「${topMatch.item_title}」，檢測到 ${fieldDiffs.length} 項欄位屬性變更。`
      }
    } else {
      return {
        candidateId: candidate.candidateId,
        proposalItemId: candidate.proposalItemId,
        action: 'NO_CHANGE',
        candidate,
        existingItemUid: topMatch.item_uid,
        existingDisplayCode: topMatch.item_display_code,
        matchStatus: topMatchResult.matchStatus,
        fieldDiffs: [],
        confidence: 1.0,
        reason: `會議內容與既有工單 [${topMatch.item_display_code || topMatch.item_uid}]「${topMatch.item_title}」完全等價，無實質欄位變更。`
      }
    }
  }

  // 預設為 CREATE
  return {
    candidateId: candidate.candidateId,
    proposalItemId: candidate.proposalItemId,
    action: 'CREATE',
    candidate,
    matchStatus: topMatchResult.matchStatus,
    confidence: candidate.confidence ?? 1.0,
    reason: '經專案記憶比對，判定為新工單項目。'
  }
}
