import { CandidateItem, ReconciledCandidate, ReconciliationAction } from './types.js'
import { ProjectItemMemory, retrieveCandidateMatches } from './memoryRetriever.js'

export function reconcileCandidate(
  candidate: CandidateItem,
  existingItems: ProjectItemMemory[],
  members: any[] = []
): ReconciledCandidate {
  // 0. 判斷是否為無意義資訊 (IGNORE)
  if (!candidate.title || candidate.title.trim().length < 2) {
    return {
      candidateId: candidate.candidateId,
      action: 'IGNORE',
      candidate,
      reason: '文字過短或無有效工單內容，安全略過。'
    }
  }

  // 1. 檢索既有專案記憶
  const matches = retrieveCandidateMatches(candidate, existingItems)

  // 2. 無任何匹配 ➔ CREATE
  if (matches.length === 0) {
    return {
      candidateId: candidate.candidateId,
      action: 'CREATE',
      candidate,
      reason: '資料庫中無相同或相關之既有工單，判定為新建項目。'
    }
  }

  const topMatch = matches[0]
  const isTopExactMatch = topMatch.score >= 10 || topMatch.item.item_title.trim().toLowerCase() === candidate.title.trim().toLowerCase()

  // 3. 存在多個高分模糊匹配且無確切首選 ➔ REVIEW_REQUIRED
  if (!isTopExactMatch && matches.length > 1 && matches[0].score >= 8 && matches[1].score >= 8 && Math.abs(matches[0].score - matches[1].score) < 1.5) {
    return {
      candidateId: candidate.candidateId,
      action: 'REVIEW_REQUIRED',
      candidate,
      possibleMatches: matches.slice(0, 3).map(m => ({
        item_uid: m.item.item_uid,
        item_display_code: m.item.item_display_code || m.item.item_uid,
        item_title: m.item.item_title,
        score: m.score
      })),
      reason: `發現多張高相似度既有工單（如 [${matches[0].item.item_display_code}] 與 [${matches[1].item.item_display_code}]），需人工審核確認。`
    }
  }

  // 4. 比對實質變更
  const existingItem = topMatch.item
  const isSameType = existingItem.item_type === candidate.canonicalType

  if (isSameType && topMatch.score >= 8) {
    const existingTitleNorm = existingItem.item_title.trim().toLowerCase()
    const candTitleNorm = candidate.title.trim().toLowerCase()

    // 若為會議工單且主題完全一致，直接判定為同一場會議
    if (candidate.canonicalType === 'Meeting' && existingTitleNorm === candTitleNorm) {
      return {
        candidateId: candidate.candidateId,
        action: 'NO_CHANGE',
        candidate,
        existingItemUid: existingItem.item_uid,
        existingDisplayCode: existingItem.item_display_code,
        reason: `會議工單「${existingItem.item_title}」已存在於資料庫中，無需重複建立。`
      }
    }

    const rawExistingContent = typeof existingItem.item_content === 'string'
      ? existingItem.item_content
      : (existingItem.item_content?.text || existingItem.item_content?.description || '')
    const existingContentNorm = rawExistingContent.replace(/\s+/g, ' ').trim().toLowerCase()
    const candContentNorm = (candidate.description || '').replace(/\s+/g, ' ').trim().toLowerCase()

    let hasSubstantiveChanges = false
    const changes: ReconciledCandidate['changes'] = {}

    if (existingTitleNorm !== candTitleNorm && candidate.title.length > existingItem.item_title.length) {
      hasSubstantiveChanges = true
      changes.itemTitle = candidate.title
    }

    if (candidate.description && candContentNorm && candContentNorm !== existingContentNorm && candContentNorm.length > existingContentNorm.length + 20) {
      hasSubstantiveChanges = true
      changes.itemContent = { text: candidate.description, description: candidate.description }
    }

    if (candidate.assigneeUid && existingItem.item_follow_by && candidate.assigneeUid !== existingItem.item_follow_by) {
      hasSubstantiveChanges = true
      changes.itemFollowBy = candidate.assigneeUid
    }

    if (candidate.dueDate && (existingItem as any).item_due_date && candidate.dueDate !== (existingItem as any).item_due_date) {
      hasSubstantiveChanges = true
      changes.dueDate = candidate.dueDate
    }

    if (hasSubstantiveChanges) {
      return {
        candidateId: candidate.candidateId,
        action: 'UPDATE',
        candidate,
        existingItemUid: existingItem.item_uid,
        existingDisplayCode: existingItem.item_display_code,
        changes,
        reason: `比對既有工單 [${existingItem.item_display_code || existingItem.item_uid}]「${existingItem.item_title}」，會議提供補充實作或指派資訊。`
      }
    } else {
      return {
        candidateId: candidate.candidateId,
        action: 'NO_CHANGE',
        candidate,
        existingItemUid: existingItem.item_uid,
        existingDisplayCode: existingItem.item_display_code,
        reason: `會議內容與既有工單 [${existingItem.item_display_code || existingItem.item_uid}]「${existingItem.item_title}」完全語意等價，無需重複建立或更新。`
      }
    }
  }

  // 預設為 CREATE
  return {
    candidateId: candidate.candidateId,
    action: 'CREATE',
    candidate,
    reason: '經專案記憶比對，判定為新工單項目。'
  }
}
