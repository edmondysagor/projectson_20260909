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

  const candTitle = candidate.title.toLowerCase().replace(/[`*_~]/g, '').trim()
  const candTokens = candTitle.split(/[\s,，、/_\-：:()（）[\]【】]+/).filter(t => t.length >= 2)
  const results: MatchCandidateResult[] = []

  for (const item of existingItems) {
    // 若為 Meeting 容器工單，僅能與 Meeting 候選項目比對，嚴禁跨類型匹配至業務實體工單
    if ((item.item_type === 'Meeting' && candidate.canonicalType !== 'Meeting') || (item.item_type !== 'Meeting' && candidate.canonicalType === 'Meeting')) {
      continue
    }

    const itemTitle = (item.item_title || '').toLowerCase().replace(/[`*_~]/g, '').trim()
    const itemCode = (item.item_display_code || '').toLowerCase().trim()
    const candCode = (candidate.sourceLabel || '').toLowerCase().trim()
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

    // 2. 工單代碼顯式匹配或顧問提示匹配 (Code & Advisory Hint Signal)
    if (itemCode && (candTitle.includes(itemCode) || (candCode && candCode === itemCode))) {
      score += 10
      matchedSignals.push(`Explicit Code Match: ${item.item_display_code}`)
    } else if (candidate.suggestedTargetCode && itemCode && candidate.suggestedTargetCode.toLowerCase() === itemCode) {
      score += 8.0
      matchedSignals.push(`Advisory Hint Match: ${item.item_display_code}`)
    } else if (candidate.suggestedTargetUid && item.item_uid === candidate.suggestedTargetUid) {
      score += 8.0
      matchedSignals.push(`Advisory UID Hint Match: ${item.item_uid}`)
    }

    // 3. 標題完全一致與語意子字串匹配 (Exact & Substring Title Match)
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
    const itemTokens = itemTitle.split(/[\s,，、/_\-：:()（）[\]【】]+/).filter(t => t.length >= 2)
    const setA = new Set(candTokens)
    const setB = new Set(itemTokens)
    const commonTokens = [...setA].filter(t => setB.has(t))
    const genericWords = new Set([
      'and', 'or', 'the', 'of', 'in', 'on', 'at', 'to', 'by', 'for', 'with', 'from', 'into', 'as', 'is', 'are', 'was', 'were', 'it', 'its', 'an', 'a', 'this', 'that', 'these', 'those',
      'data', 'check', 'system', 'test', 'flow', 'phase', 'project', 'team', 'status', 'view',
      'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'
    ])
    const nonGenericCommon = commonTokens.filter(t => !genericWords.has(t))
    const unionSize = new Set([...setA, ...setB]).size
    const jaccardRatio = unionSize > 0 ? commonTokens.length / unionSize : 0

    if (jaccardRatio >= 0.5 || nonGenericCommon.length >= 2) {
      score += 5.0
      matchedSignals.push(`High Token Overlap (Jaccard: ${(jaccardRatio * 100).toFixed(0)}%, ${commonTokens.length} tokens)`)
    } else if (jaccardRatio >= 0.25 || nonGenericCommon.length >= 1) {
      score += 2.5
      matchedSignals.push(`Moderate Token Overlap (${commonTokens.length} tokens)`)
    } else if (commonTokens.length > 0 && nonGenericCommon.length > 0) {
      score += 1.0
      matchedSignals.push(`Weak Token Overlap (${commonTokens.length} tokens)`)
    }

    // 4.1 領域核心概念比對 (Domain Concept Pattern Matching)
    const isInterview = (t: string) => /(?:訪談|採訪|面談|interview)/i.test(t) && /(?:旅客|乘客|用戶|員工|地勤|一線|passenger|staff|frontline|user)/i.test(t)
    if (isInterview(candTitle) && isInterview(itemTitle)) {
      score += 7.0
      matchedSignals.push('Domain Concept Match: User & Staff Interviews')
    }

    const isQueueData = (t: string) => /(?:隊列|排隊|queue\s*mapping|queue\s*data|queue\s*status)/i.test(t) && /(?:數據|資料|接口|集成|整合|可行性|映射|integration|interface|feasibility|mapping|data|status)/i.test(t)
    if (isQueueData(candTitle) && isQueueData(itemTitle)) {
      score += 7.0
      matchedSignals.push('Domain Concept Match: Queue Data Feasibility & Integration')
    }

    const isPrivacySecurity = (t: string) => /(?:隱私|留存|privacy|retention)/i.test(t) && /(?:安全|數據|資料|信息流|政策|影響|旅客|policy|impact|security|compliance)/i.test(t)
    if (isPrivacySecurity(candTitle) && isPrivacySecurity(itemTitle)) {
      score += 7.0
      matchedSignals.push('Domain Concept Match: Data Privacy & Security Review')
    }

    const isWrongQueue = (t: string) => /(?:wrong-queue|排錯隊|誤排|錯排)/i.test(t) && /(?:reduce|減少|降低|30%|30\s*percent)/i.test(t)
    if (isWrongQueue(candTitle) && isWrongQueue(itemTitle)) {
      score += 7.0
      matchedSignals.push('Domain Concept Match: Reduce Wrong-Queue Cases')
    }

    const isFallback = (t: string) => /(?:fallback|後備|人工)/i.test(t) && /(?:staff|assistance|機制|支援|協助)/i.test(t)
    if (isFallback(candTitle) && isFallback(itemTitle)) {
      score += 7.0
      matchedSignals.push('Domain Concept Match: Staff Fallback Mechanism')
    }

    const isLangSupport = (t: string) => /(?:language|語言)/i.test(t) && /(?:multi-language|english|chinese|中文|英文|雙語)/i.test(t)
    if (isLangSupport(candTitle) && isLangSupport(itemTitle)) {
      score += 7.0
      matchedSignals.push('Domain Concept Match: Multi-Language Support')
    }

    const isMilestoneBaseline = (t: string) => /(?:requirements\s*baseline|需求基準)/i.test(t)
    if (isMilestoneBaseline(candTitle) && isMilestoneBaseline(itemTitle)) {
      score += 7.0
      matchedSignals.push('Domain Concept Match: Requirements Baseline Milestone')
    }

    const isMilestonePrototype = (t: string) => /(?:prototype|原型)/i.test(t) && /(?:delivery|交付|完成|october\s*16|10月16)/i.test(t)
    if (isMilestonePrototype(candTitle) && isMilestonePrototype(itemTitle)) {
      score += 7.0
      matchedSignals.push('Domain Concept Match: Prototype Delivery Milestone')
    }

    const isMilestoneTrial = (t: string) => /(?:trial|試點|試行|運營試驗)/i.test(t) && /(?:operational|運營|november\s*13|11月13)/i.test(t)
    if (isMilestoneTrial(candTitle) && isMilestoneTrial(itemTitle)) {
      score += 7.0
      matchedSignals.push('Domain Concept Match: Operational Trial Milestone')
    }

    // 5. 負責人信號比對 (Assignee Signal)
    const itemAssignee = (item.follow_by_name || item.item_follow_by || '').toLowerCase().trim()
    const candAssignee = (candidate.assigneeName || candidate.assigneeUid || '').toLowerCase().trim()
    if (itemAssignee && candAssignee && (itemAssignee.includes(candAssignee) || candAssignee.includes(itemAssignee))) {
      score += 3.5
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

    // 判定 MatchStatus (嚴格保留 EXACT_MATCH 予確切等價之工單代碼或標題，其餘模糊匹配保留 PROBABLE_MATCH 觸發歧義防護)
    let matchStatus: MatchStatus = 'NO_MATCH'
    const isExactCode = (candCode && itemCode && candCode === itemCode) || (candTitle && itemCode && candTitle === itemCode) || (candidate.suggestedTargetCode && itemCode && candidate.suggestedTargetCode.toLowerCase() === itemCode)
    const isExactTitle = itemTitle === candTitle
    if (conflicts.length > 0 && score >= 6) {
      matchStatus = 'CONFLICT'
    } else if (isExactTitle || isExactCode) {
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

  // 處理 AMBIGUOUS: 多個高分候選且無壓倒性首選 (Ambiguity Guard)
  if (results.length > 1 && results[0].matchStatus !== 'EXACT_MATCH' && results[0].score >= 6 && results[1].score >= 6) {
    if (Math.abs(results[0].score - results[1].score) < 2.0) {
      results[0].matchStatus = 'AMBIGUOUS'
      results[1].matchStatus = 'AMBIGUOUS'
    }
  }

  return results
}
