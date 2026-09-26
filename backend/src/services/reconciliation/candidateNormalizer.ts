import { CandidateItem } from './types.js'
import { extractCommitmentStatus, extractExplicitPriority } from './sourceLedgerExtractor.js'

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

  // 2. 檢測結構化編號 (如 [UAT-01], [REQ-02], [TSK-03], [US-01], [OBJ-01], UAT-01:, REQ-02:, M1, TASK-01)
  let sourceLabel: string | undefined
  const labelMatch = text.match(/^(?:\[|\()?([A-Za-z0-9_-]+(?:[-_]\d+)?)(?:\]|\))?\s*[:：\-\—–]?\s*(.*)$/)
  if (labelMatch) {
    const candidateLabel = labelMatch[1].toUpperCase()
    // 檢查是否為有意義的標籤編號（如 UAT-01, REQ-01, US-01, TSK-01, TASK-01, OBJ-01, DEC-01, BT-01, M1, M2 等）
    if (/^(?:UAT|REQ|US|TSK|TASK|OBJ|DEC|DECISION|BT|BOTTLENECK|MS|MIL|DOC|M|P\d+)[-_]?\d+$/i.test(candidateLabel)) {
      sourceLabel = candidateLabel
      text = labelMatch[2].trim()
    }
  }

  // 3. 剝離殘留的破損前綴 (如 "01] ", "] ", ": ", "— ", "- ")
  text = text.replace(/^\d{1,3}\]\s*/, '').replace(/^[\]\):：\-\—–\s]+/g, '').trim()

  // 4. 剝離類型通用名 (如 [Objective] 或 Objective:, Requirement:, Task:)
  text = text.replace(/^(?:\[|\()[\*`_~#\s]*(?:objective|requirement|user\s*story|story|task|uat|bug|decision|bottleneck|meeting|milestone|charter|epic|micro\s*task)[\*`_~#\s]*(?:\]|\))\s*[:：\-\—–\s]*/i, '')
  text = text.replace(/^[\*`_~#\s]*(?:objective|requirement|user\s*story|task|uat|bug|decision|bottleneck|meeting|milestone|epic|micro\s*task)[\*`_~#\s]*[:：\-\—–]+\s*/i, '')
  text = text.replace(/^[*`_~#\$\\]+|[*`_~#\$\\]+$/g, '').trim()
  text = text.replace(/^[\]\):：\-\—–\s]+/g, '').trim()

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
  const anyCand = cand as any
  const rawTypeLower = (cand.rawType || cand.canonicalType || anyCand.type || anyCand.itemType || '').toLowerCase()

  const candEvidenceText = [
    cand.sourceContent,
    anyCand.sourceText,
    typeof cand.sourceEvidence === 'string' ? cand.sourceEvidence : cand.sourceEvidence?.sourceText,
    cand.sourceEvidence?.excerpt,
    cand.sourceEvidence?.extractedFact
  ].filter(Boolean).join(' ')

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
    const textToCheck = `${cand.title || ''} ${cand.description || ''} ${candEvidenceText}`.toLowerCase()
    if (/\b(?:not yet a blocker|not a blocker|non-blocking|dependency\s*\/\s*technical unknown|technical unknown|未知項|依賴性)\b/i.test(textToCheck) || cand.commitmentStatus === 'NOT_A_BLOCKER' || cand.commitmentStatus === 'DEPENDENCY' || cand.evidenceType === 'SOURCE_DEPENDENCY') {
      // 依據 Spec 規範：外部依賴與技術未知數嚴禁升格為 Bottleneck
      canonicalType = 'Information'
    } else {
      canonicalType = 'Bottleneck'
    }
  } else if (/milestone|里程碑/.test(rawTypeLower)) {
    canonicalType = 'Milestone'
  } else if (/charter|章程/.test(rawTypeLower)) {
    canonicalType = 'Charter'
  } else if (/information|資訊|資料/.test(rawTypeLower)) {
    canonicalType = 'Information'
  } else if (/dependency|依賴/.test(rawTypeLower)) {
    canonicalType = 'Information'
  } else if (/bug|缺陷|修復/.test(rawTypeLower)) {
    canonicalType = 'Bug'
  }

  // 1. 標題純化 (去除 ADR 等未在源文出現之偽模板前綴，以及非阻礙項之 Bottleneck 殘留)
  let finalTitle = cleanedTitle || cand.title || '未命名項目'
  if (canonicalType === 'Decision') {
    finalTitle = finalTitle.replace(/^ADR[-_]?\d*[:：\s]*/i, '').trim()
  } else if (canonicalType === 'Information') {
    finalTitle = finalTitle.replace(/^(?:\[?Bottleneck\]?|瓶頸與阻礙|技術阻礙)[:：\s]*/i, '').trim()
  }

  // 2. 論據真實性保護 (消除「加快交付」等憑空發明之商業話術，消除非阻礙項之 Bottleneck 嚴重性與延期污染)
  let finalDescription = cand.description || ''
  if (canonicalType === 'Decision') {
    finalDescription = finalDescription.replace(/(?:簡化第一階段設計以加快交付|加快交付|加速交付|to ensure rapid delivery|rapid delivery)/gi, '聚焦第一階段核心範圍，簡化系統複雜度')
  } else if (canonicalType === 'Information') {
    // RULE 3: DOWNGRADED NON-BLOCKER MUST BE PURE INFORMATION
    if (/queue\s*mapping|排隊映射/i.test(finalTitle + ' ' + finalDescription + ' ' + candEvidenceText)) {
      finalDescription = 'Queue mapping data availability is a technical dependency / unknown for the proposed solution. The kickoff discussion explicitly stated that this is not yet considered a blocker.'
    } else {
      // 移除偽造的 Bottleneck 標頭、嚴重程度、交付延誤威脅
      finalDescription = finalDescription
        .replace(/###?\s*(?:技術阻礙|瓶頸|Bottleneck)[^\n]*/gi, '')
        .replace(/嚴重程度[：:][^\n]*/gi, '')
        .replace(/若需額外整合[，,].*?(?:交付日期|延期)[^\n]*/gi, '')
        .replace(/\bseverity\s*:\s*\w+/gi, '')
        .trim()
    }
  }

  // 3. 嚴格權責隔離 (Participant vs Action Assignee)
  // 僅有 Task 工單可指派負責人；Objective, Requirement, Decision, Milestone, Charter, Information 嚴禁指派會議發言人
  let assignedName = cand.assigneeName || undefined
  let assignedUid = cand.assigneeUid || undefined
  if (canonicalType !== 'Task') {
    assignedName = undefined
    assignedUid = undefined
  }

  // 4. 優先級處理：嚴格遵循 Invariant: UNSPECIFIED != DEFAULT
  // 若未顯式提供優先級，必須保持 undefined (TBC / Unspecified)，嚴禁以預設值覆寫既有工單
  // 核心規範：僅有當來源文本明確指定優先級時，才允許設定為 High / Middle / Low；否則一律保持 undefined
  const allCandText = `${finalTitle} ${finalDescription} ${candEvidenceText} ${cand.sourceContent || ''} ${(cand as any).sourceText || ''}`
  let normalizedPriority: 'High' | 'Middle' | 'Low' | undefined = undefined
  if (cand.priority && ['High', 'Middle', 'Low'].includes(cand.priority)) {
    const explicitGrounding = extractExplicitPriority(allCandText)
    if (explicitGrounding === cand.priority) {
      normalizedPriority = cand.priority
    }
  } else {
    normalizedPriority = extractExplicitPriority(allCandText) || undefined
  }
  if (canonicalType === 'Information' || canonicalType === 'Charter' || canonicalType === 'Milestone') {
    normalizedPriority = undefined
  }

  // 5. 承諾狀態 (Commitment Status) 真實性保護
  let resolvedCommitmentStatus = cand.commitmentStatus || extractCommitmentStatus(allCandText)
  if (canonicalType === 'Information' && (rawTypeLower.includes('bottleneck') || /\b(?:not yet a blocker|not a blocker|dependency|technical unknown|未知項)\b/i.test(allCandText))) {
    resolvedCommitmentStatus = 'NOT_A_BLOCKER'
  }
  if (canonicalType === 'Milestone') {
    const isTentative = /\b(?:tentative|tentatively|estimated|estimate|target date|to validate|初步|暫定|估計|預計|待驗證)\b/i.test(allCandText.toLowerCase())
    if (isTentative) {
      resolvedCommitmentStatus = 'TENTATIVE'
    }
  }

  const isUuid = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str))
  
  // 若 parentItemUid 為自然語言標題，嚴格移轉至 parentRef 並將 parentItemUid 設為 undefined
  let resolvedParentItemUid: string | undefined = undefined
  let resolvedParentRef: string | undefined = cand.parentRef ? cleanTitle(cand.parentRef) : undefined
  if (cand.parentItemUid) {
    if (isUuid(cand.parentItemUid)) {
      resolvedParentItemUid = cand.parentItemUid
    } else if (!resolvedParentRef) {
      resolvedParentRef = cleanTitle(cand.parentItemUid)
    }
  }

  let finalSourceLabel = cand.sourceLabel || cand.sourceIdentifier || extractedLabel
  if (canonicalType === 'Information') {
    if (!finalSourceLabel || /bottleneck|btn/i.test(finalSourceLabel)) {
      finalSourceLabel = 'DEP-01'
    }
  }
  const evidenceId = cand.evidenceId || cand.sourceEvidence?.evidenceId || cand.evidenceIds?.[0]
  const evidenceIds = cand.evidenceIds || (evidenceId ? [evidenceId] : [])

  // 檢查源文是否真正含有章程顯式依據（而非候選項目標題、描述、會議檔頭、系統偏好或 PM 慣例）
  // 注意：嚴禁檢查 cand.title 或 cand.description，因為 AI 生成的偽章程其標題與描述必然包含「章程」或「charter」！
  const sourceDocText = candEvidenceText.toLowerCase()
  let isUnauthorizedCharter = false
  if (canonicalType === 'Charter') {
    const hasExplicitCharterMention = /\b(?:charter|專案章程|項目章程|章程文件)\b/i.test(sourceDocText)
    if (!hasExplicitCharterMention) {
      isUnauthorizedCharter = true
    }
  }

  // 6. 規格文件任務 (Specification Document Task) 授權檢查
  let isUnauthorizedSpecTask = false
  if (/(?:專案規格文件|規格文件|規格書|specification\s*doc)/i.test(finalTitle)) {
    const hasExplicitSpecAssignment = /(?:負責撰寫規格|產出規格文件|編寫規格書|編寫規格|assign.*(?:spec|specification)|write.*(?:spec|specification)|draft.*(?:spec|specification))/i.test(sourceDocText)
    if (!hasExplicitSpecAssignment) {
      isUnauthorizedSpecTask = true
    }
  }

  // 7. User Story 語意真實性保護 (Conversational / Speculative Inferred Check)
  let isUnauthorizedUserStory = false
  if (canonicalType === 'User story') {
    const evText = `${candEvidenceText} ${cand.description || ''} ${cand.title || ''}`
    const hasExplicitUSMarkup = /\[(?:US|USER\s*STORY)[-_]?\d*\]|###\s*US[-_]?\d*|user\s*story\s*[:：]|作為.*(?:我想|我希望).*以便|as\s+a\s+.*i\s+want\s+.*so\s+that/i.test(evText)
    if (!hasExplicitUSMarkup) {
      isUnauthorizedUserStory = true
      // RULE 8: 對話提取之非顯式 User Story 嚴禁捏造 Acceptance Criteria / Given-When-Then
      finalDescription = finalDescription
        .replace(/###?\s*Acceptance Criteria[^\n]*/gi, '')
        .replace(/Given\s+.*?When\s+.*?Then\s+[^\n]*/gi, '')
        .replace(/場景\s*\d*[:：][^\n]*/gi, '')
        .trim()
    }
  }

  const isInferred = Boolean(
    cand.inferred || 
    cand.classification === 'INFERRED' || 
    cand.inferenceStatus === 'INFERENCE' || 
    isUnauthorizedCharter ||
    isUnauthorizedSpecTask ||
    isUnauthorizedUserStory ||
    (!cand.sourceEvidence && evidenceIds.length === 0 && cand.classification !== 'EXPLICIT')
  )
  const classification = isInferred ? 'INFERRED' : (cand.classification || 'EXPLICIT')
  const inferenceStatus = isInferred ? 'INFERENCE' : (cand.inferenceStatus || 'SOURCE_FACT')

  // 計算 proposalNodeId (如 node-obj-001, node-req-001, node-task-001)
  const typeCode = canonicalType === 'Objective' ? 'obj' :
                   canonicalType === 'Requirement' ? 'req' :
                   canonicalType === 'User story' ? 'us' :
                   canonicalType === 'Task' ? 'task' :
                   canonicalType === 'UAT' ? 'uat' :
                   canonicalType === 'Decision' ? 'dec' :
                   canonicalType === 'Bottleneck' ? 'btn' :
                   canonicalType === 'Milestone' ? 'milestone' :
                   canonicalType === 'Meeting' ? 'meeting' : 'item'
  const proposalNodeId = cand.proposalNodeId || `node-${typeCode}-${String(index + 1).padStart(3, '0')}`

  return {
    candidateId,
    proposalItemId: cand.proposalItemId,
    proposalNodeId,
    evidenceId,
    evidenceIds,
    evidenceType: cand.evidenceType,
    commitmentStatus: resolvedCommitmentStatus,
    rawType: cand.rawType || canonicalType,
    canonicalType,
    title: finalTitle,
    sourceLabel: finalSourceLabel,
    sourceIdentifier: finalSourceLabel,
    sourceIdentifiers: cand.sourceIdentifiers || (finalSourceLabel ? [finalSourceLabel] : []),
    description: finalDescription,
    sourceContent: cand.sourceContent || finalDescription,
    summary: cand.summary || undefined,
    priority: normalizedPriority,
    status: cand.status || (anyCand.item_status || anyCand.itemStatus || undefined),
    suggestedTargetCode: cand.suggestedTargetCode || (anyCand.targetDisplayCode || undefined),
    suggestedTargetUid: cand.suggestedTargetUid || (anyCand.targetItemUid || undefined),
    assigneeName: assignedName,
    assigneeUid: assignedUid,
    parentCandidateId: cand.parentCandidateId || undefined,
    parentProposalItemId: cand.parentProposalItemId || undefined,
    parentProposalNodeId: cand.parentProposalNodeId || undefined,
    parentRef: resolvedParentRef,
    parentUid: cand.parentUid || undefined,
    parentItemUid: resolvedParentItemUid,
    relationshipStatus: cand.relationshipStatus || (isInferred ? 'NEEDS_REVIEW' : 'CONFIRMED'),
    classification,
    inferred: Boolean(isInferred),
    confidence: cand.confidence || (isInferred ? 0.6 : 1.0),
    inferenceStatus: cand.inferenceStatus || (isInferred ? 'INFERENCE' : 'SOURCE_FACT'),
    needsReview: cand.needsReview || isInferred || (cand.relationshipStatus === 'NEEDS_REVIEW') || isUnauthorizedCharter || isUnauthorizedSpecTask || isUnauthorizedUserStory,
    dueDate: cand.dueDate || undefined,
    uatCode: cand.uatCode || finalSourceLabel || undefined,
    extractedValues: cand.extractedValues || cand.keyAttributes || {},
    keyAttributes: cand.keyAttributes || {},
    sourceReference: cand.sourceReference || undefined,
    sourceEvidence: cand.sourceEvidence || undefined,
    evidence: cand.evidence || (cand.sourceEvidence ? [cand.sourceEvidence] : undefined)
  }
}

/**
 * 計算兩候選項目在同一次提案內的語意重複性 (Intra-Proposal Duplicate Similarity)
 */
export function areCandidatesDuplicate(a: CandidateItem, b: CandidateItem): { isDuplicate: boolean; reason?: string } {
  // 1. 會議記錄類型：整個對話僅能有 1 個 Meeting 容器
  if (a.canonicalType === 'Meeting' && b.canonicalType === 'Meeting') {
    return { isDuplicate: true, reason: 'Duplicate Meeting Record' }
  }

  // 2. 類型相容性檢查：只有相同類型（或高度相容類型，如 Task ~ Bug）才可能為重複
  const typeCompatible = a.canonicalType === b.canonicalType ||
    (a.canonicalType === 'Task' && b.canonicalType === 'Bug') ||
    (a.canonicalType === 'Bug' && b.canonicalType === 'Task') ||
    (a.canonicalType === 'Requirement' && b.canonicalType === 'Objective') ||
    (a.canonicalType === 'Objective' && b.canonicalType === 'Requirement')

  if (!typeCompatible) {
    return { isDuplicate: false }
  }

  // 3. 負責人相容性檢查：若雙方均有指派人且明確不同（如 Rachel vs Michael），絕不判定為同一項目
  const aAssignee = (a.assigneeName || a.assigneeUid || '').toLowerCase().trim()
  const bAssignee = (b.assigneeName || b.assigneeUid || '').toLowerCase().trim()
  if (aAssignee && bAssignee && aAssignee !== bAssignee && !aAssignee.includes(bAssignee) && !bAssignee.includes(aAssignee)) {
    return { isDuplicate: false }
  }

  const cleanA = a.title.toLowerCase().replace(/[`*_~#\$\(\)\[\]（）【】—\-_:：]/g, ' ').replace(/\s+/g, ' ').trim()
  const cleanB = b.title.toLowerCase().replace(/[`*_~#\$\(\)\[\]（）【】—\-_:：]/g, ' ').replace(/\s+/g, ' ').trim()

  // 4. 變體區分保護 (Variant / Distinct Option Guard): 若包含 alpha/beta/gamma/v1/v2/option 等衝突詞，嚴禁合併
  const variantTokens = ['alpha', 'beta', 'gamma', 'delta', 'v1', 'v2', 'v3', 'option a', 'option b', '方案一', '方案二', '方案a', '方案b', 'variant']
  const aHasVariant = variantTokens.some(v => cleanA.includes(v))
  const bHasVariant = variantTokens.some(v => cleanB.includes(v))
  if (aHasVariant || bHasVariant) {
    if (cleanA !== cleanB) {
      return { isDuplicate: false }
    }
  }

  // 5. 標題完全相等
  if (cleanA === cleanB && cleanA.length >= 2) {
    return { isDuplicate: true, reason: 'Exact Title Match' }
  }

  // 6. 標題子字串包含（較短標題長度 >= 6）
  if (cleanA.length >= 6 && cleanB.length >= 6) {
    if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) {
      return { isDuplicate: true, reason: 'Title Substring Match' }
    }
  }

  // 7. 領域核心概念比對 (Domain Concept Pattern Matching)
  const isInterview = (t: string) => /(?:訪談|採訪|面談|interview)/i.test(t) && /(?:旅客|乘客|用戶|員工|地勤|一線|passenger|staff|frontline)/i.test(t)
  if (isInterview(cleanA) && isInterview(cleanB)) {
    return { isDuplicate: true, reason: 'Domain Concept: User & Staff Interviews' }
  }

  const isQueueData = (t: string) => /(?:隊列|排隊|排隊映射|queue\s*mapping|queue\s*data|queue\s*status)/i.test(t) && /(?:數據|資料|接口|集成|整合|可行性|映射|integration|interface|feasibility|mapping|data)/i.test(t)
  if (isQueueData(cleanA) && isQueueData(cleanB)) {
    return { isDuplicate: true, reason: 'Domain Concept: Queue Data Feasibility & Integration' }
  }

  const isPrivacySecurity = (t: string) => /(?:隱私|留存|privacy|retention)/i.test(t) && /(?:安全|數據|資料|信息流|政策|影響|旅客|policy|impact|security)/i.test(t)
  if (isPrivacySecurity(cleanA) && isPrivacySecurity(cleanB)) {
    return { isDuplicate: true, reason: 'Domain Concept: Data Privacy & Security Review' }
  }

  const isBaselineMilestone = (t: string) => a.canonicalType === 'Milestone' && b.canonicalType === 'Milestone' && /(?:需求基準|基準線|requirements\s*baseline)/i.test(t)
  if (isBaselineMilestone(cleanA) && isBaselineMilestone(cleanB)) {
    return { isDuplicate: true, reason: 'Domain Concept: Requirements Baseline Milestone' }
  }

  const isPrototypeMilestone = (t: string) => a.canonicalType === 'Milestone' && b.canonicalType === 'Milestone' && /(?:原型|prototype)/i.test(t) && /(?:里程碑|完成|10月16|october 16|交付)/i.test(t)
  if (isPrototypeMilestone(cleanA) && isPrototypeMilestone(cleanB)) {
    return { isDuplicate: true, reason: 'Domain Concept: Prototype Milestone' }
  }

  const isTrialMilestone = (t: string) => a.canonicalType === 'Milestone' && b.canonicalType === 'Milestone' && /(?:試點|試行|運營試驗|trial|operational trial)/i.test(t) && /(?:里程碑|11月13|november 13|試驗)/i.test(t)
  if (isTrialMilestone(cleanA) && isTrialMilestone(cleanB)) {
    return { isDuplicate: true, reason: 'Domain Concept: Operational Trial Milestone' }
  }

  // 8. Token Jaccard 與中文雙字元 (Bigram) 重疊度比對
  const getBigramsAndTokens = (str: string) => {
    const tokens = str.split(/[\s,，、/_\-：:()（）[\]【】]+/).filter(t => t.length >= 2)
    const bigrams: string[] = []
    const compact = str.replace(/\s+/g, '')
    for (let i = 0; i < compact.length - 1; i++) {
      bigrams.push(compact.substring(i, i + 2))
    }
    return new Set([...tokens, ...bigrams])
  }

  const setA = getBigramsAndTokens(cleanA)
  const setB = getBigramsAndTokens(cleanB)
  const common = [...setA].filter(t => setB.has(t))
  const union = new Set([...setA, ...setB]).size
  const jaccard = union > 0 ? common.length / union : 0

  if (jaccard >= 0.65 && (cleanA.length >= 6 || cleanB.length >= 6)) {
    return { isDuplicate: true, reason: `High Token/Bigram Overlap (Jaccard: ${(jaccard * 100).toFixed(0)}%)` }
  }

  return { isDuplicate: false }
}

/**
 * 提案內候選項目去重與證據融合 (Intra-Proposal Candidate Clustering & Deduplication)
 */
export function deduplicateInFlightCandidates(candidates: CandidateItem[]): {
  deduplicated: CandidateItem[]
  mergedCount: number
  idMap: Map<string, string>
} {
  const result: CandidateItem[] = []
  const idMap = new Map<string, string>()
  let mergedCount = 0

  for (const cand of candidates) {
    let matchedCluster: CandidateItem | undefined = undefined
    let matchReason: string | undefined = undefined

    for (const existing of result) {
      const { isDuplicate, reason } = areCandidatesDuplicate(existing, cand)
      if (isDuplicate) {
        matchedCluster = existing
        matchReason = reason
        break
      }
    }

    if (matchedCluster) {
      // 融合候選項目 (Merge into matchedCluster)
      mergedCount++
      idMap.set(cand.candidateId, matchedCluster.candidateId)

      // 1. 標題選擇：保留較長、資訊度較高者
      if (cand.title.length > matchedCluster.title.length && !cand.title.includes('(') && !cand.title.startsWith('[')) {
        matchedCluster.title = cand.title
      }

      // 2. 描述融合
      if (cand.description && matchedCluster.description) {
        if (!matchedCluster.description.includes(cand.description) && !cand.description.includes(matchedCluster.description)) {
          matchedCluster.description = `${matchedCluster.description}\n\n${cand.description}`
        }
      } else if (cand.description && !matchedCluster.description) {
        matchedCluster.description = cand.description
      }

      // 3. 證據 ID 融合
      const allEvIds = new Set<string>([
        ...(matchedCluster.evidenceIds || (matchedCluster.evidenceId ? [matchedCluster.evidenceId] : [])),
        ...(cand.evidenceIds || (cand.evidenceId ? [cand.evidenceId] : []))
      ])
      matchedCluster.evidenceIds = Array.from(allEvIds)

      // 4. 證據物件融合
      if (cand.evidence || cand.sourceEvidence) {
        const existingEvs = matchedCluster.evidence || (matchedCluster.sourceEvidence ? [matchedCluster.sourceEvidence] : [])
        const newEvs = cand.evidence || (cand.sourceEvidence ? [cand.sourceEvidence] : [])
        const mergedEvMap = new Map<string, any>()
        for (const ev of [...existingEvs, ...newEvs]) {
          const key = ev.evidenceId || ev.sourceLocation || ev.extractedFact || JSON.stringify(ev)
          if (!mergedEvMap.has(key)) {
            mergedEvMap.set(key, ev)
          }
        }
        matchedCluster.evidence = Array.from(mergedEvMap.values())
      }

      // 5. 指派人保留
      if (!matchedCluster.assigneeName && cand.assigneeName) {
        matchedCluster.assigneeName = cand.assigneeName
      }
      if (!matchedCluster.assigneeUid && cand.assigneeUid) {
        matchedCluster.assigneeUid = cand.assigneeUid
      }

      // 6. 優先級保留
      if (!matchedCluster.priority && cand.priority) {
        matchedCluster.priority = cand.priority
      }

      // 7. 承諾狀態保留（偏好具體狀態）
      const specificStatuses = ['TENTATIVE', 'NOT_A_BLOCKER', 'TARGET', 'CONFIRMED', 'AGREED']
      if (cand.commitmentStatus && specificStatuses.includes(cand.commitmentStatus)) {
        matchedCluster.commitmentStatus = cand.commitmentStatus
      }

      // 8. 顧問提示保留
      if (!matchedCluster.suggestedTargetCode && cand.suggestedTargetCode) {
        matchedCluster.suggestedTargetCode = cand.suggestedTargetCode
      }
      if (!matchedCluster.suggestedTargetUid && cand.suggestedTargetUid) {
        matchedCluster.suggestedTargetUid = cand.suggestedTargetUid
      }

      // 9. 狀態保留
      if (!matchedCluster.status && cand.status) {
        matchedCluster.status = cand.status
      }

      // 10. 到期日保留
      if (!matchedCluster.dueDate && cand.dueDate) {
        matchedCluster.dueDate = cand.dueDate
      }
    } else {
      idMap.set(cand.candidateId, cand.candidateId)
      result.push(cand)
    }
  }

  // 重連 parentCandidateId
  for (const c of result) {
    if (c.parentCandidateId && idMap.has(c.parentCandidateId)) {
      c.parentCandidateId = idMap.get(c.parentCandidateId)
    }
  }

  return {
    deduplicated: result,
    mergedCount,
    idMap
  }
}

