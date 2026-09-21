import { CandidateItem } from './types.js'

export interface ProjectItemMemory {
  item_uid: string
  item_display_code?: string
  item_title: string
  item_type: string
  item_status?: string
  item_priority?: string
  item_follow_by?: string
  follow_by_name?: string
  parent_item_uid?: string
  item_content?: any
}

export function retrieveCandidateMatches(
  candidate: CandidateItem,
  existingItems: ProjectItemMemory[]
): Array<{ item: ProjectItemMemory; score: number }> {
  if (!existingItems || existingItems.length === 0) return []

  const candTitle = candidate.title.toLowerCase().trim()
  const candTokens = candTitle.split(/[\s,，、/_\-：:()（）[\]【】]+/).filter(t => t.length >= 2)
  const results: Array<{ item: ProjectItemMemory; score: number }> = []

  for (const item of existingItems) {
    const itemTitle = (item.item_title || '').toLowerCase().trim()
    const itemCode = (item.item_display_code || '').toLowerCase().trim()
    let score = 0

    // 1. 同類型加權
    const isSameType = item.item_type === candidate.canonicalType
    if (isSameType) score += 2

    // 2. 完全一致
    if (itemTitle === candTitle || (itemCode && candTitle.includes(itemCode))) {
      score += 10
    }

    // 3. 子字串包含
    if (candTitle.length >= 4 && itemTitle.includes(candTitle)) {
      score += 6
    } else if (itemTitle.length >= 4 && candTitle.includes(itemTitle)) {
      score += 6
    }

    // 4. Token 重疊評分
    let tokenOverlapCount = 0
    for (const token of candTokens) {
      if (itemTitle.includes(token)) {
        tokenOverlapCount++
        score += token.length >= 4 ? 3 : 1.5
      }
    }

    if (score >= 4) {
      results.push({ item, score })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}
