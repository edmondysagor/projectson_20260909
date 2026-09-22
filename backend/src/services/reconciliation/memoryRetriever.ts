import { CandidateItem, MatchStatus, MatchCandidateResult } from './types.js'

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
  item_attribute?: any
  item_planned_end_date?: string
  item_due_date?: string
  due_date?: string
}

/**
 * 語意記憶檢索與多信號比對引擎 (Multi-Signal Item-Level Semantic Matching)
 * 核心準則：
 * 1. 檢索信號涵蓋：類型 (Item Type)、標題 (Title)、工單代碼 (Display Code)、指派人 (Assignee)、日期 (Dates)、關鍵字與技術術語
 * 2. 杜絕單純依賴標題相等作為主鍵，以資料庫實體 item_uid 為錨定標識
 * 3. 輸出明確之比對狀態：EXACT_MATCH, PROBABLE_MATCH, POSSIBLE_MATCH, NO_MATCH, AMBIGUOUS, CONFLICT
 */
export function retrieveCandidateMatches(
  candidate: CandidateItem,
  existingItems: ProjectItemMemory[]
): MatchCandidateResult[] {
  if (!existingItems || existingItems.length === 0) return []

  const candTitle = candidate.title.toLowerCase().trim()
  const candTokens = candTitle.split(/[\s,，、/_\-：:()（）[\]【】]+/).filter(t => t.length >= 2)
  const results: MatchCandidateResult[] = []

  for (const item of existingItems) {
    const itemTitle = (item.item_title || '').toLowerCase().trim()
    const itemCode = (item.item_display_code || '').toLowerCase().trim()
    let score = 0
    const matchedSignals: string[] = []
    const conflicts: string[] = []

    // 1. 同類型信號 (Type Match)
    const isSameType = item.item_type === candidate.canonicalType
    if (isSameType) {
      score += 2.5
      matchedSignals.push(`Same Type: ${candidate.canonicalType}`)
    } else {
      // 檢查語意相容類型 (e.g. Task vs Bug)
      const compatibleTypes: Record<string, string[]> = {
        'Task': ['Bug', 'User story'],
        'Requirement': ['Charter', 'Objective'],
        'Objective': ['Charter', 'Requirement']
      }
      if (compatibleTypes[candidate.canonicalType]?.includes(item.item_type)) {
        score += 1.0
        matchedSignals.push(`Compatible Type: ${candidate.canonicalType} ~ ${item.item_type}`)
      }
    }

    // 2. 工單代碼顯式匹配 (Code Signal)
    if (itemCode && (candTitle.includes(itemCode) || (candidate.sourceLabel && candidate.sourceLabel.toLowerCase() === itemCode))) {
      score += 10
      matchedSignals.push(`Explicit Code Match: ${item.item_display_code}`)
    }

    // 3. 標題完全一致 (Exact Title Match)
    if (itemTitle === candTitle) {
      score += 10
      matchedSignals.push('Exact Title Match')
    } else if (candTitle.length >= 4 && itemTitle.includes(candTitle)) {
      score += 6
      matchedSignals.push('Title Substring Match (Item contains Candidate)')
    } else if (itemTitle.length >= 4 && candTitle.includes(itemTitle)) {
      score += 6
      matchedSignals.push('Title Substring Match (Candidate contains Item)')
    }

    // 4. Token Jaccard 重疊度評分 (Token Overlap)
    let tokenOverlapCount = 0
    for (const token of candTokens) {
      if (itemTitle.includes(token)) {
        tokenOverlapCount++
        score += token.length >= 4 ? 3 : 1.5
      }
    }
    if (tokenOverlapCount > 0) {
      matchedSignals.push(`Token Overlap (${tokenOverlapCount} tokens)`)
    }

    // 5. 負責人信號比對 (Assignee Signal)
    const itemAssignee = (item.follow_by_name || item.item_follow_by || '').toLowerCase().trim()
    const candAssignee = (candidate.assigneeName || candidate.assigneeUid || '').toLowerCase().trim()
    if (itemAssignee && candAssignee && (itemAssignee.includes(candAssignee) || candAssignee.includes(itemAssignee))) {
      score += 2.0
      matchedSignals.push(`Assignee Match: ${candidate.assigneeName}`)
    }

    // 6. 日期信號比對 (Date Signal)
    const rawItemDate = item.item_planned_end_date || item.item_due_date || item.due_date || ''
    const itemDate = rawItemDate ? String(rawItemDate).split('T')[0] : ''
    const candDate = candidate.dueDate ? String(candidate.dueDate).split('T')[0] : ''
    if (itemDate && candDate) {
      if (itemDate === candDate) {
        score += 2.0
        matchedSignals.push(`Date Match: ${candDate}`)
      } else {
        matchedSignals.push(`Date Divergence: ${itemDate} -> ${candDate}`)
      }
    }

    // 7. 衝突偵測 (Conflict Signal for Decisions, Requirements, Milestones)
    if (isSameType && ['Decision', 'Requirement', 'Bottleneck'].includes(candidate.canonicalType)) {
      const rawExistingContent = typeof item.item_content === 'string'
        ? item.item_content
        : (item.item_content?.text || item.item_content?.description || '')
      const candContent = candidate.description || candidate.sourceContent || ''

      const stripHeaderAndSpaces = (s: string) => {
        const withoutHeadings = s.replace(/^#{1,6}\s+[^\n]+(\r?\n|$)/gm, '')
        const base = withoutHeadings.trim().length > 0 ? withoutHeadings : s
        return base.replace(/\s+/g, ' ').trim().toLowerCase()
      }
      const cleanExisting = stripHeaderAndSpaces(rawExistingContent)
      const cleanCand = stripHeaderAndSpaces(candContent)

      // 只有當兩者實質內容不同，且非彼此的子集合時，才進一步比對廢棄或衝突語氣
      const isSubstantiallyDifferent = cleanExisting !== cleanCand &&
        !(cleanExisting.length > 20 && cleanCand.includes(cleanExisting)) &&
        !(cleanCand.length > 20 && cleanExisting.includes(cleanCand))

      if (
        isSubstantiallyDifferent &&
        (
          candContent.includes('淘汰') ||
          candContent.includes('不再使用') ||
          candContent.toLowerCase().includes('no longer') ||
          candContent.toLowerCase().includes('instead of') ||
          candContent.toLowerCase().includes('deprecated')
        )
      ) {
        conflicts.push(`Document explicitly deprecates or overrides existing ${candidate.canonicalType} [${item.item_display_code || item.item_uid}]`)
      }
    }

    // 判定 MatchStatus
    let matchStatus: MatchStatus = 'NO_MATCH'
    if (conflicts.length > 0 && score >= 6) {
      matchStatus = 'CONFLICT'
    } else if (score >= 10 || itemTitle === candTitle) {
      matchStatus = 'EXACT_MATCH'
    } else if (score >= 7) {
      matchStatus = 'PROBABLE_MATCH'
    } else if (score >= 4) {
      matchStatus = 'POSSIBLE_MATCH'
    }

    if (score >= 4 || conflicts.length > 0) {
      results.push({
        item,
        score,
        matchStatus,
        matchedSignals,
        conflicts: conflicts.length > 0 ? conflicts : undefined
      })
    }
  }

  // 排序：高分優先
  results.sort((a, b) => b.score - a.score)

  // 處理 AMBIGUOUS: 多個高分候選且無壓倒性首選
  if (results.length > 1 && results[0].matchStatus !== 'EXACT_MATCH' && results[0].score >= 7 && results[1].score >= 7) {
    if (Math.abs(results[0].score - results[1].score) < 1.5) {
      results[0].matchStatus = 'AMBIGUOUS'
      results[1].matchStatus = 'AMBIGUOUS'
    }
  }

  return results
}
