import { CandidateItem } from './types.js'

export interface CleanedTitleResult {
  title: string
  sourceLabel?: string
}

/**
 * 分離並純化標題與標籤元數據 (如 [UAT-01] 500人次壓力測試 ➔ sourceLabel: 'UAT-01', title: '500人次壓力測試')
 */
export function extractTitleAndLabel(raw: string): CleanedTitleResult {
  if (!raw) return { title: '' }
  let text = raw.trim()

  // 1. 剝離外圍 Markdown 裝飾與 LaTeX 符號
  text = text.replace(/^[*`_~#\$\\]+|[*`_~#\$\\]+$/g, '').trim()

  // 2. 檢測結構化編號 (如 [UAT-01], [REQ-02], [TSK-03], [US-01], [OBJ-01], UAT-01:, REQ-02:)
  let sourceLabel: string | undefined
  const labelMatch = text.match(/^(?:\[|\()?([A-Za-z0-9_-]+(?:[-_]\d+)?)(?:\]|\))?\s*[:：\-]?\s*(.*)$/)
  if (labelMatch) {
    const candidateLabel = labelMatch[1].toUpperCase()
    // 檢查是否為有意義的標籤編號（如 UAT-01, REQ-01, US-01, TSK-01, OBJ-01, D-01, BT-01 等）
    if (/^(?:UAT|REQ|US|TSK|TASK|OBJ|DEC|DECISION|BT|BOTTLENECK|MS|MIL|DOC|P\d+)[-_]?\d+$/i.test(candidateLabel)) {
      sourceLabel = candidateLabel
      text = labelMatch[2].trim()
    }
  }

  // 3. 剝離殘留的破損前綴 (如 "01] ", "] ", ": ")
  text = text.replace(/^\d{1,3}\]\s*/, '').replace(/^[\]\):：\-]+\s*/, '').trim()

  // 4. 剝離類型通用名 (如 Objective:, Requirement:, Task:)
  text = text.replace(/^(?:\[|\()?[\*`_~#\s]*(?:objective|requirement|user\s*story|story|task|uat|bug|decision|bottleneck|meeting|milestone|charter|epic|micro\s*task)[\*`_~#\s]*(?:\]|\))?\s*[:：\s-]+/i, '')
  text = text.replace(/^[*`_~#\$\\]+|[*`_~#\$\\]+$/g, '').trim()

  // 5. 移除尾部標點
  text = text.replace(/[。；;]+$/, '').trim()

  return {
    title: text,
    sourceLabel
  }
}

export function cleanTitle(raw: string): string {
  return extractTitleAndLabel(raw).title
}

export function cleanAssigneeName(raw?: string): string | undefined {
  if (!raw) return undefined
  let cleaned = raw.trim()
  cleaned = cleaned.replace(/^[\(（\[【"'`]+|[\)）\]】"'`]+$/g, '').trim()
  cleaned = cleaned.replace(/^(?:指派給|指派|負責人|負責|assignee|assigned\s*to|owner|lead)\s*[:：\s-]+/i, '').trim()
  cleaned = cleaned.replace(/^[\(（\[【"'`]+|[\)）\]】"'`]+$/g, '').trim()
  return cleaned || undefined
}

export function isJunkHeadingOrPreamble(text: string): boolean {
  if (!text || text.trim().length < 2) return true
  const lower = text.toLowerCase().trim()
  const junkPatterns = [
    /^(?:上載文件|上傳文件|現有專案狀態|現有項目狀態|增量分析|結論|判定為|分析總結|架構追溯鏈|執行計劃|思考過程|注意事項|前置作業|場景\s*\d|說明|背景|現狀)/i,
    /^鏈路\s*[a-z0-9]/i,
    /^(?:requirements?\*?\*?|user\s*stories\*?\*?|tasks?\*?\*?|uats?\*?\*?|decisions?\*?\*?|objectives?\*?\*?)\s*[:：]/i,
    /(?:rightarrow|->|=>|➔|➜|➡).*(?:requirement|user\s*story|task|uat|objective|5\s*層|骨架|追溯)/i,
    /(?:5\s*層|五層).*(?:溯源|骨架|追溯|矩陣)/i,
    /^\s*[\$*`_~#\\]*(?:\\rightarrow|->|=>|➔|➜|➡)\s*['"`]?(?:requirement|user\s*story|task|uat|objective)/i,
    /^(?:拆分為|針對.+建立|拆解為後端|建立壓力測試|拆解為|依據.+建立之)/i
  ]
  return junkPatterns.some(p => p.test(lower))
}

export function normalizeCandidate(cand: Partial<CandidateItem>, index: number): CandidateItem {
  const candidateId = cand.candidateId || `CAND-${String(index + 1).padStart(3, '0')}`
  const { title: cleanedTitle, sourceLabel: extractedLabel } = extractTitleAndLabel(cand.title || '')
  
  let canonicalType: CandidateItem['canonicalType'] = 'Task'
  const rawTypeLower = (cand.rawType || cand.canonicalType || '').toLowerCase()

  if (/objective|商業目標|專案目標|總目標|目標/.test(rawTypeLower)) {
    canonicalType = 'Objective'
  } else if (/requirement|需求|功能需求|業務需求/.test(rawTypeLower)) {
    canonicalType = 'Requirement'
  } else if (/user\s*story|story|使用者故事|用戶故事|故事/.test(rawTypeLower)) {
    canonicalType = 'User story'
  } else if (/uat|驗收測試|測試案例|驗收/.test(rawTypeLower)) {
    canonicalType = 'UAT'
  } else if (/meeting|會議|會議記錄|紀要/.test(rawTypeLower)) {
    canonicalType = 'Meeting'
  } else if (/decision|決策|架構決策/.test(rawTypeLower)) {
    canonicalType = 'Decision'
  } else if (/bottleneck|阻礙|瓶頸|風險/.test(rawTypeLower)) {
    canonicalType = 'Bottleneck'
  } else if (/milestone|里程碑/.test(rawTypeLower)) {
    canonicalType = 'Milestone'
  } else if (/charter|章程/.test(rawTypeLower)) {
    canonicalType = 'Charter'
  } else if (/bug|缺陷|修復/.test(rawTypeLower)) {
    canonicalType = 'Bug'
  }

  return {
    candidateId,
    proposalItemId: cand.proposalItemId,
    rawType: cand.rawType || canonicalType,
    canonicalType,
    title: cleanedTitle || cand.title || '未命名項目',
    sourceLabel: cand.sourceLabel || extractedLabel,
    description: cand.description || '',
    priority: cand.priority || 'Middle',
    assigneeName: cand.assigneeName || undefined,
    assigneeUid: cand.assigneeUid || undefined,
    parentCandidateId: cand.parentCandidateId || undefined,
    parentRef: cand.parentRef ? cleanTitle(cand.parentRef) : undefined,
    parentUid: cand.parentUid || undefined,
    relationshipStatus: cand.relationshipStatus || 'CONFIRMED',
    dueDate: cand.dueDate || undefined,
    uatCode: cand.uatCode || extractedLabel || undefined,
    keyAttributes: cand.keyAttributes || {},
    sourceReference: cand.sourceReference || undefined,
    sourceEvidence: cand.sourceEvidence || undefined
  }
}
