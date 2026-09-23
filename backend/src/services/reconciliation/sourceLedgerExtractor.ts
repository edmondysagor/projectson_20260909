import {
  CandidateItem,
  SourceReference,
  SourceEvidence,
  IncompleteExtractionReport,
  ExtractionDiagnostics
} from './types.js'
import { extractTitleAndLabel, cleanAssigneeName, isJunkHeadingOrPreamble } from './candidateNormalizer.js'
import { extractDocumentMetadata } from './documentNormalizer.js'

export interface ExtractedSourceLedger {
  candidates: CandidateItem[]
  metadata: ReturnType<typeof extractDocumentMetadata>
  completeness: {
    isComplete: boolean
    report?: IncompleteExtractionReport
    diagnostics: ExtractionDiagnostics
  }
  summary: {
    meeting: number
    objective: number
    requirement: number
    userStory: number
    task: number
    uat: number
    decision: number
    bottleneck: number
    milestone: number
    other: number
    total: number
  }
}

/**
 * 日期字串正規化為 ISO-8601 (YYYY-MM-DD)
 */
function normalizeDateString(raw?: string, defaultYear: string = '2026'): string | undefined {
  if (!raw) return undefined
  const clean = raw.trim()
  const isoMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`
  }
  const cnMatch = clean.match(/^(\d{1,2})月(\d{1,2})日$/)
  if (cnMatch) {
    return `${defaultYear}-${cnMatch[1].padStart(2, '0')}-${cnMatch[2].padStart(2, '0')}`
  }
  return clean
}

/**
 * 文件結構偵測 (Document Structure & Signal Detection)
 * 掃描標題與信號特徵，預期應提取之候選項目基數
 */
export function detectDocumentStructureSignals(
  text: string,
  metadata: ReturnType<typeof extractDocumentMetadata>
): {
  detectedSections: string[]
  detectedItemSignals: Record<string, number>
  totalSignals: number
} {
  const lines = text.split('\n')
  const detectedSections: string[] = []
  for (const line of lines) {
    if (line.startsWith('#')) {
      const sec = line.replace(/^#+\s*/, '').trim()
      if (sec && !detectedSections.includes(sec)) {
        detectedSections.push(sec)
      }
    }
  }

  const signals: Record<string, number> = {
    meeting: 0,
    objective: 0,
    milestone: 0,
    requirement: 0,
    userStory: 0,
    task: 0,
    decision: 0,
    bottleneck: 0,
    uat: 0
  }

  // 1. 會議記錄信號
  if (
    /^(?:#\s*Meeting Record|#.*?會議記錄)/m.test(text) ||
    /Meeting Information|\*\*會議主題\*\*|[-*•]?\s*Meeting[:：]/i.test(text)
  ) {
    signals.meeting = 1
  }

  // 2. 專案目標信號
  if (/###\s*(?:(?:Change\s*\d+\s*[-—–]\s*)?Business\s*Objective|Objective)|商業總目標|專案總目標|\[Objective\]/i.test(text)) {
    signals.objective = 1
  }

  // 3. 里程碑信號 (表格行數或清單項)
  const msTableRows = (text.match(/\|\s*M\d+\b/gi) || []).length
  const msBullets = (text.match(/(?:[-*•]|\d+\.)?\s*\d{4}[-/]\d{2}[-/]\d{2}\s*[:：].*?(?:Alpha|Beta|UAT|驗收|部署|Baseline|Complete)/gi) || []).length
  signals.milestone = msTableRows > 0 ? msTableRows : msBullets

  // 4. 需求信號
  const reqHeadings = (text.match(/^###\s*REQ[-_]\d+/gim) || []).length
  const reqBullets = (text.match(/\[Requirement\]/gi) || []).length
  signals.requirement = reqHeadings > 0 ? reqHeadings : reqBullets

  // 5. 使用者故事信號
  const usHeadings = (text.match(/^###\s*US[-_]\d+/gim) || []).length
  const usBullets = (text.match(/\[User Story\]/gi) || []).length
  signals.userStory = usHeadings > 0 ? usHeadings : usBullets

  // 6. 任務信號
  const taskHeadings = (text.match(/^###\s*TASK[-_]\d+/gim) || []).length
  const taskBullets = (text.match(/\[Task\]/gi) || []).length
  const mitActions = (text.match(/(?:需由|由)\s*[^\s,，]+\s*(?:負責|負責在[^\s,，]+上)?\s*(?:構建|建立|開發|實現)/gi) || []).length
  signals.task = taskHeadings > 0 ? taskHeadings : (taskBullets + mitActions)

  // 7. 決策信號
  const decHeadings = (text.match(/^###\s*DEC[-_]\d+/gim) || []).length
  const decBullets = (text.match(/\[Decision\]/gi) || []).length
  signals.decision = decHeadings > 0 ? decHeadings : decBullets

  // 8. 阻礙與瓶頸信號
  const btnBullets = (text.match(/\[Bottleneck\]/gi) || []).length
  signals.bottleneck = btnBullets

  // 9. 驗收測試信號
  const uatBullets = (text.match(/\[UAT[-_]\d+\]/gi) || []).length
  signals.uat = uatBullets

  const totalSignals = Object.values(signals).reduce((a, b) => a + b, 0)
  return { detectedSections, detectedItemSignals: signals, totalSignals }
}

/**
 * 完整度門禁評估 (Extraction Completeness Gate)
 * 嚴禁「成功提取 1 項即視為 isComplete=true」
 */
export function evaluateExtractionCompleteness(
  candidates: CandidateItem[],
  signals: ReturnType<typeof detectDocumentStructureSignals>,
  metadata: ReturnType<typeof extractDocumentMetadata>
): {
  isComplete: boolean
  report?: IncompleteExtractionReport
  diagnostics: ExtractionDiagnostics
} {
  const suspectedTypes: string[] = []
  const unresolvedSections: string[] = []
  let missingEvidenceCount = 0

  const candidateCounts: Record<string, number> = {
    meeting: candidates.filter(c => c.canonicalType === 'Meeting').length,
    objective: candidates.filter(c => c.canonicalType === 'Objective').length,
    milestone: candidates.filter(c => c.canonicalType === 'Milestone').length,
    requirement: candidates.filter(c => c.canonicalType === 'Requirement').length,
    userStory: candidates.filter(c => c.canonicalType === 'User story').length,
    task: candidates.filter(c => c.canonicalType === 'Task').length,
    decision: candidates.filter(c => c.canonicalType === 'Decision').length,
    bottleneck: candidates.filter(c => c.canonicalType === 'Bottleneck').length,
    uat: candidates.filter(c => c.canonicalType === 'UAT').length,
    total: candidates.length
  }

  const signalMap: Array<{ key: string; typeName: string; sectionHints: string[] }> = [
    { key: 'meeting', typeName: 'Meeting', sectionHints: ['Meeting Information', '會議記錄', '會議主題'] },
    { key: 'objective', typeName: 'Objective', sectionHints: ['Project Charter', '商業總目標', 'Objective'] },
    { key: 'milestone', typeName: 'Milestone', sectionHints: ['Milestones', 'Timeline', '里程碑', '時程'] },
    { key: 'requirement', typeName: 'Requirement', sectionHints: ['Requirements', '需求', '具體功能需求'] },
    { key: 'userStory', typeName: 'User story', sectionHints: ['User Stories', '使用者故事'] },
    { key: 'task', typeName: 'Task', sectionHints: ['Tasks', '任務', 'Action Items'] },
    { key: 'decision', typeName: 'Decision', sectionHints: ['Decisions', '決策', '重大架構決策'] },
    { key: 'bottleneck', typeName: 'Bottleneck', sectionHints: ['Bottlenecks', '技術阻礙', '瓶頸'] },
    { key: 'uat', typeName: 'UAT', sectionHints: ['UAT', '驗收測試', 'Acceptance Criteria'] }
  ]

  for (const item of signalMap) {
    const detected = signals.detectedItemSignals[item.key] || 0
    const extracted = candidateCounts[item.key] || 0
    if (detected > 0 && extracted === 0) {
      suspectedTypes.push(item.typeName)
      missingEvidenceCount += detected
      const matchingSec = signals.detectedSections.find(s =>
        item.sectionHints.some(h => s.toLowerCase().includes(h.toLowerCase()))
      )
      if (matchingSec && !unresolvedSections.includes(matchingSec)) {
        unresolvedSections.push(matchingSec)
      }
    } else if (detected > 1 && extracted < Math.floor(detected * 0.5)) {
      suspectedTypes.push(item.typeName)
      missingEvidenceCount += (detected - extracted)
    }
  }

  const isComplete = suspectedTypes.length === 0

  const diagnostics: ExtractionDiagnostics = {
    sourceDocument: {
      filename: metadata.documentName,
      documentId: metadata.documentId,
      contentHash: metadata.documentHash
    },
    detectedSignals: signals.detectedItemSignals,
    candidatesExtracted: candidateCounts,
    status: isComplete ? 'COMPLETE' : 'INCOMPLETE',
    incompleteReason: isComplete
      ? undefined
      : `Detected project-relevant sections were not represented in candidates (suspected missing: ${suspectedTypes.join(', ')})`
  }

  if (!isComplete) {
    return {
      isComplete: false,
      report: {
        reason: diagnostics.incompleteReason || 'Detected project-relevant sections/evidence were not represented in candidates',
        missingEvidenceCount,
        suspectedItemTypes: suspectedTypes,
        unresolvedSections: unresolvedSections.length > 0 ? unresolvedSections : ['Project Record Sections']
      },
      diagnostics
    }
  }

  return {
    isComplete: true,
    diagnostics
  }
}

/**
 * 依據 Spec 規範之 Stage A: 來源帳本顯式候選項目與證據提取器
 */
export function extractSourceLedgerFromText(
  text: string,
  members: any[] = [],
  documentId: string = 'doc-meeting',
  filename?: string
): ExtractedSourceLedger {
  const metadata = extractDocumentMetadata(text, filename, documentId)
  const meetingYear = metadata.meetingDate ? metadata.meetingDate.split('-')[0] : '2026'
  const candidates: CandidateItem[] = []

  const signals = detectDocumentStructureSignals(text, metadata)

  if (!text || text.trim() === '') {
    const completeness = evaluateExtractionCompleteness([], signals, metadata)
    return {
      candidates: [],
      metadata,
      completeness,
      summary: { meeting: 0, objective: 0, requirement: 0, userStory: 0, task: 0, uat: 0, decision: 0, bottleneck: 0, milestone: 0, other: 0, total: 0 }
    }
  }

  const lines = metadata.normalizedContent.split('\n')
  let currentSectionContext = ''
  let pendingProjectTitle = ''
  let candIdx = 0

  const resolveAssignee = (rawName?: string): { name?: string; uid?: string } => {
    const cleanedName = cleanAssigneeName(rawName)
    if (!cleanedName) return {}

    const cleanLower = cleanedName.toLowerCase()
    for (const m of members) {
      if (!m.member_name) continue
      const mName = m.member_name.toLowerCase().trim()
      if (cleanLower === mName || cleanLower.includes(mName) || mName.includes(cleanLower)) {
        return { name: m.member_name, uid: m.member_uid }
      }
      const firstName = mName.split(' ')[0]
      if (firstName && firstName.length >= 2 && (cleanLower === firstName || cleanLower.includes(firstName))) {
        return { name: m.member_name, uid: m.member_uid }
      }
    }
    return { name: cleanedName }
  }

  const createEvidence = (
    evId: string,
    section: string,
    label: string,
    rawText: string,
    fact: string,
    cType: string,
    values: Record<string, any>
  ): SourceEvidence => ({
    evidenceId: evId,
    sourceDocumentId: metadata.documentId,
    sourceDocumentHash: metadata.documentHash,
    sourceType: 'explicit',
    sourceSection: section,
    sourceLabel: label,
    sourceLocation: section,
    sourceText: rawText,
    extractedFact: fact,
    candidateType: cType,
    extractedValues: values,
    confidence: 1.0,
    inferenceStatus: 'SOURCE_FACT',
    excerpt: rawText
  })

  // 0. 檢測會議主題工單 (Meeting Candidate)
  const explicitMeetingMatch = text.match(/(?:^|[\r\n])[-*•]?\s*(?:\*{0,2}(?:會議主題|會議名稱|會議標題|主題|Meeting)\*{0,2})[：:]\s*([^\n\r]+)/im)
  const meetingHeaderMatch = text.match(/^#\s*(?:(?:Meeting Record\s*\d*|專案啟動與架構決策)?會議記錄[^\n\r]*|Meeting Record[^\n\r]*)/im)
  
  if (explicitMeetingMatch || meetingHeaderMatch || metadata.meetingTitle) {
    const rawTitle = explicitMeetingMatch
      ? explicitMeetingMatch[1]
      : (meetingHeaderMatch ? meetingHeaderMatch[0].replace(/^#+\s*/, '') : metadata.meetingTitle)
    const { title: meetingTitle } = extractTitleAndLabel(rawTitle || '專案會議記錄')

    if (meetingTitle && !isJunkHeadingOrPreamble(meetingTitle)) {
      candIdx++
      const candId = `CAND-${String(candIdx).padStart(3, '0')}`
      const propId = `P001-I${String(candIdx).padStart(2, '0')}`
      const evId = `EV-${String(candIdx).padStart(3, '0')}`
      const excerpt = explicitMeetingMatch ? explicitMeetingMatch[0] : (meetingHeaderMatch ? meetingHeaderMatch[0] : '')

      const evidence = createEvidence(
        evId,
        'Meeting Header',
        'Meeting',
        excerpt,
        meetingTitle,
        'Meeting',
        { title: meetingTitle, date: metadata.meetingDate, attendees: metadata.attendees }
      )

      candidates.push({
        candidateId: candId,
        proposalItemId: propId,
        evidenceId: evId,
        rawType: 'Meeting',
        canonicalType: 'Meeting',
        title: meetingTitle,
        sourceLabel: 'Meeting',
        sourceIdentifier: 'Meeting',
        description: metadata.normalizedContent,
        sourceContent: metadata.normalizedContent,
        summary: metadata.meetingObjective || metadata.summary || undefined,
        priority: 'High',
        confidence: 1.0,
        inferenceStatus: 'SOURCE_FACT',
        keyAttributes: {
          meetingTitle: metadata.meetingTitle,
          meetingDate: metadata.meetingDate,
          meetingObjective: metadata.meetingObjective,
          summary: metadata.meetingObjective || metadata.summary || undefined,
          attendees: metadata.attendees,
          sourceDocumentHash: metadata.documentHash,
          sourceDocumentId: metadata.documentId,
          sourceContent: metadata.normalizedContent
        },
        sourceReference: { documentId: metadata.documentId, section: 'Meeting Header', excerpt },
        sourceEvidence: evidence,
        evidence: [evidence]
      })
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // 記錄當前章節
    if (line.startsWith('#')) {
      const hClean = line.replace(/^#+\s*/, '').trim()
      if (line.startsWith('# ') || line.startsWith('## ')) {
        currentSectionContext = hClean
      }
    }

    if (line.match(/(?:[-*•]|\d+\.)?\s*(?:\*\*)?(?:目標里程碑|里程碑|Milestones?)(?:\*\*)?/i)) {
      currentSectionContext = `${currentSectionContext} - 里程碑`
    }

    // A. 專案標題捕捉 (用於補足 Objective 標題)
    const projTitleM = line.match(/^###\s*(?:Project\s*Title|專案名稱|專案標題)[:：]?\s*(.*)$/i)
    if (projTitleM) {
      if (projTitleM[1]?.trim()) {
        pendingProjectTitle = projTitleM[1].trim()
      } else if (i + 1 < lines.length && lines[i + 1].trim() && !lines[i + 1].startsWith('#')) {
        pendingProjectTitle = lines[i + 1].trim()
      }
    }

    // B. 檢測 [Objective] / 商業總目標
    // 1) 標題模式 (### Business Objective 或 ### 1. 專案章程總體目標)
    const objHeadingM = line.match(/^###\s*(?:(?:Change\s*\d+\s*[-—–]\s*)?Business\s*Objective|商業總目標|專案總目標|核心目標|Objective)[:：]?\s*(.*)$/i)
    if (objHeadingM) {
      let objDesc = objHeadingM[1]?.trim() || ''
      if (!objDesc) {
        for (let j = i + 1; j < lines.length; j++) {
          const nextL = lines[j].trim()
          if (!nextL) continue
          if (nextL.startsWith('#') || nextL.startsWith('---')) break
          objDesc += (objDesc ? '\n' : '') + nextL.replace(/^>+\s*/, '')
        }
      }

      candIdx++
      const candId = `CAND-${String(candIdx).padStart(3, '0')}`
      const propId = `P001-I${String(candIdx).padStart(2, '0')}`
      const evId = `EV-${String(candIdx).padStart(3, '0')}`

      let title = pendingProjectTitle || 'Customer Self-Service Boarding Enhancement'
      if (!pendingProjectTitle && objDesc) {
        title = objDesc.split(/[.!?。！？\n]/)[0].trim()
      }

      const evidence = createEvidence(
        evId,
        currentSectionContext,
        'Objective',
        line,
        title,
        'Objective',
        { title, description: objDesc }
      )

      candidates.push({
        candidateId: candId,
        proposalItemId: propId,
        evidenceId: evId,
        rawType: 'Objective',
        canonicalType: 'Objective',
        title,
        sourceLabel: 'Objective',
        description: objDesc ? `### 專案商業目標\n${objDesc}` : `### 專案商業目標\n${title}`,
        sourceContent: objDesc || title,
        priority: 'High',
        confidence: 1.0,
        inferenceStatus: 'SOURCE_FACT',
        sourceEvidence: evidence,
        evidence: [evidence]
      })
      continue
    }

    // 2) 清單模式 (- **商業總目標 (Objective)**：...)
    const objBulletM = line.match(/(?:[-*•]|\d+\.)?\s*(?:\*\*)?(?:\[?Objective\]?|商業總目標|專案總目標|核心目標)(?:[^\*]*\*\*)?\s*[:：]\s*(.*)$/i)
    if (objBulletM) {
      const rawText = objBulletM[1].trim()
      let cleanObjTitle = rawText
      let cleanObjDesc = ''
      if (rawText.includes('，') || rawText.includes('。')) {
        const parts = rawText.split(/[，。]/)
        cleanObjTitle = parts[0].trim()
        cleanObjDesc = rawText.substring(cleanObjTitle.length).replace(/^[，。\s]+/, '').trim()
      }

      candIdx++
      const candId = `CAND-${String(candIdx).padStart(3, '0')}`
      const propId = `P001-I${String(candIdx).padStart(2, '0')}`
      const evId = `EV-${String(candIdx).padStart(3, '0')}`

      const evidence = createEvidence(
        evId,
        currentSectionContext,
        '[Objective]',
        line,
        cleanObjTitle,
        'Objective',
        { title: cleanObjTitle, description: cleanObjDesc }
      )

      candidates.push({
        candidateId: candId,
        proposalItemId: propId,
        evidenceId: evId,
        rawType: 'Objective',
        canonicalType: 'Objective',
        title: cleanObjTitle,
        sourceLabel: 'Objective',
        description: cleanObjDesc ? `### 專案商業目標\n${cleanObjDesc}` : `### 專案商業目標\n${cleanObjTitle}`,
        sourceContent: rawText,
        priority: 'High',
        confidence: 1.0,
        inferenceStatus: 'SOURCE_FACT',
        sourceReference: { documentId: metadata.documentId, section: currentSectionContext, excerpt: line },
        sourceEvidence: evidence,
        evidence: [evidence]
      })
      continue
    }

    // C. 檢測目標里程碑 (Milestones)
    // 1) Markdown 表格行 (如: | M1 — Charter & Requirement Baseline | 2026-09-15 | Confirm initial... |)
    const isTableLine = line.startsWith('|') && line.endsWith('|')
    const inMilestoneCtx = currentSectionContext.includes('Milestone') || currentSectionContext.includes('Timeline') || currentSectionContext.includes('里程碑') || currentSectionContext.includes('時程')
    if (isTableLine && inMilestoneCtx) {
      if (/milestone|target date|description|時程|目標日期/i.test(line) || /---\|---/.test(line)) {
        continue
      }
      const cells = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
      if (cells.length >= 2) {
        const col1 = cells[0]
        const col2 = cells[1]
        const col3 = cells[2] || ''

        const mMatch = col1.match(/^(M\d+)\s*[-—–:]\s*(.*)$/i)
        const mLabel = mMatch ? mMatch[1].toUpperCase() : 'Milestone'
        const mTitle = mMatch ? mMatch[2].trim() : col1
        const mDate = normalizeDateString(col2, meetingYear)

        candIdx++
        const candId = `CAND-${String(candIdx).padStart(3, '0')}`
        const propId = `P001-I${String(candIdx).padStart(2, '0')}`
        const evId = `EV-${String(candIdx).padStart(3, '0')}`

        const fullTitle = `${col1} (${mDate})`
        const evidence = createEvidence(
          evId,
          currentSectionContext,
          mLabel,
          line,
          mTitle,
          'Milestone',
          { title: mTitle, dueDate: mDate, description: col3 }
        )

        candidates.push({
          candidateId: candId,
          proposalItemId: propId,
          evidenceId: evId,
          rawType: 'Milestone',
          canonicalType: 'Milestone',
          title: fullTitle,
          sourceLabel: mLabel,
          dueDate: mDate,
          description: col3 || undefined,
          priority: 'High',
          confidence: 1.0,
          inferenceStatus: 'SOURCE_FACT',
          sourceEvidence: evidence,
          evidence: [evidence]
        })
        continue
      }
    }

    // 2) 清單日期里程碑 (如: - 2026-10-15：完成 Alpha 版...)
    const msBulletM = line.match(/(?:[-*•]|\d+\.)?\s*(\d{4}[-/]\d{2}[-/]\d{2})\s*[:：]\s*(.*)$/i)
    if (msBulletM && inMilestoneCtx) {
      const date = msBulletM[1]
      const { title: msTitle, sourceLabel } = extractTitleAndLabel(msBulletM[2])
      if (msTitle && !isJunkHeadingOrPreamble(msTitle)) {
        candIdx++
        const candId = `CAND-${String(candIdx).padStart(3, '0')}`
        const propId = `P001-I${String(candIdx).padStart(2, '0')}`
        const evId = `EV-${String(candIdx).padStart(3, '0')}`

        const evidence = createEvidence(
          evId,
          currentSectionContext,
          'Milestone',
          line,
          msTitle,
          'Milestone',
          { title: msTitle, dueDate: date }
        )

        candidates.push({
          candidateId: candId,
          proposalItemId: propId,
          evidenceId: evId,
          rawType: 'Milestone',
          canonicalType: 'Milestone',
          title: `${msTitle} (${date})`,
          sourceLabel: sourceLabel || 'Milestone',
          dueDate: date,
          priority: 'High',
          confidence: 1.0,
          inferenceStatus: 'SOURCE_FACT',
          sourceReference: { documentId: metadata.documentId, section: currentSectionContext, excerpt: line },
          sourceEvidence: evidence,
          evidence: [evidence]
        })
        continue
      }
    }

    // D. 檢測 [Requirement] / 核心需求
    // 1) 標題模式 (### REQ-01 — Faster Passenger Processing)
    const reqHeadingM = line.match(/^###\s*(REQ[-_]\d+)\s*[-—–:]\s*(.*)$/i) || line.match(/^###\s*Requirement\s*(\d*)[:：\-—–]\s*(.*)$/i)
    if (reqHeadingM) {
      const reqCode = reqHeadingM[1].toUpperCase().startsWith('REQ') ? reqHeadingM[1].toUpperCase() : `REQ-${reqHeadingM[1]}`
      const reqTitle = reqHeadingM[2].trim()
      let reqDesc = ''
      for (let j = i + 1; j < lines.length; j++) {
        const nextL = lines[j].trim()
        if (!nextL) continue
        if (nextL.startsWith('#') || nextL.startsWith('---')) break
        reqDesc += (reqDesc ? '\n' : '') + nextL
      }

      candIdx++
      const candId = `CAND-${String(candIdx).padStart(3, '0')}`
      const propId = `P001-I${String(candIdx).padStart(2, '0')}`
      const evId = `EV-${String(candIdx).padStart(3, '0')}`

      const evidence = createEvidence(
        evId,
        currentSectionContext,
        reqCode,
        line,
        reqTitle,
        'Requirement',
        { title: reqTitle, reqCode, description: reqDesc }
      )

      candidates.push({
        candidateId: candId,
        proposalItemId: propId,
        evidenceId: evId,
        rawType: 'Requirement',
        canonicalType: 'Requirement',
        title: reqTitle,
        sourceLabel: reqCode,
        description: reqDesc || undefined,
        sourceContent: reqDesc || reqTitle,
        priority: 'High',
        confidence: 1.0,
        inferenceStatus: 'SOURCE_FACT',
        sourceEvidence: evidence,
        evidence: [evidence]
      })
      continue
    }

    // 2) 清單標籤模式 (1. **[Requirement] 雙模態身份驗證...**)
    const reqBulletM = line.match(/(?:[-*•]|\d+\.)?\s*(?:\*\*)?\[Requirement\]\s*(.*?)(?:\*\*)?\s*(?:[:：]\s*(.*))?$/i)
    if (reqBulletM) {
      const { title: reqTitle, sourceLabel } = extractTitleAndLabel(reqBulletM[1])
      if (reqTitle && !isJunkHeadingOrPreamble(reqTitle)) {
        candIdx++
        const candId = `CAND-${String(candIdx).padStart(3, '0')}`
        const propId = `P001-I${String(candIdx).padStart(2, '0')}`
        const evId = `EV-${String(candIdx).padStart(3, '0')}`

        const evidence = createEvidence(
          evId,
          currentSectionContext,
          '[Requirement]',
          line,
          reqTitle,
          'Requirement',
          { title: reqTitle }
        )

        candidates.push({
          candidateId: candId,
          proposalItemId: propId,
          evidenceId: evId,
          rawType: 'Requirement',
          canonicalType: 'Requirement',
          title: reqTitle,
          sourceLabel: sourceLabel || 'Requirement',
          priority: 'High',
          confidence: 1.0,
          inferenceStatus: 'SOURCE_FACT',
          sourceReference: { documentId: metadata.documentId, section: currentSectionContext, excerpt: line },
          sourceEvidence: evidence,
          evidence: [evidence]
        })
        continue
      }
    }

    // E. 檢測 [User Story] / 使用者故事
    // 1) 標題模式 (### US-01 — Passenger Self-Service Verification)
    const usHeadingM = line.match(/^###\s*(US[-_]\d+)\s*[-—–:]\s*(.*)$/i) || line.match(/^###\s*User\s*Story\s*(\d*)[:：\-—–]\s*(.*)$/i)
    if (usHeadingM) {
      const usCode = usHeadingM[1].toUpperCase().startsWith('US') ? usHeadingM[1].toUpperCase() : `US-${usHeadingM[1]}`
      const usTitle = usHeadingM[2].trim()
      let usDesc = ''
      for (let j = i + 1; j < lines.length; j++) {
        const nextL = lines[j].trim()
        if (!nextL) continue
        if (nextL.startsWith('#') || nextL.startsWith('---')) break
        usDesc += (usDesc ? '\n' : '') + nextL
      }

      candIdx++
      const candId = `CAND-${String(candIdx).padStart(3, '0')}`
      const propId = `P001-I${String(candIdx).padStart(2, '0')}`
      const evId = `EV-${String(candIdx).padStart(3, '0')}`

      const evidence = createEvidence(
        evId,
        currentSectionContext,
        usCode,
        line,
        usTitle,
        'User story',
        { title: usTitle, usCode, description: usDesc }
      )

      candidates.push({
        candidateId: candId,
        proposalItemId: propId,
        evidenceId: evId,
        rawType: 'User story',
        canonicalType: 'User story',
        title: usTitle,
        sourceLabel: usCode,
        description: usDesc ? `### 使用者故事 (${usCode})\n${usDesc}` : undefined,
        sourceContent: usDesc || usTitle,
        priority: 'Middle',
        confidence: 1.0,
        inferenceStatus: 'SOURCE_FACT',
        sourceEvidence: evidence,
        evidence: [evidence]
      })
      continue
    }

    // 2) 清單標籤模式 (- **[User Story]** 作為登機旅客...)
    const usBulletM = line.match(/(?:[-*•]|\d+\.)?\s*(?:\*\*)?\[User Story\](?:\*\*)?\s*(.*)$/i)
    if (usBulletM) {
      const { title: usTitle, sourceLabel } = extractTitleAndLabel(usBulletM[1])
      if (usTitle && !isJunkHeadingOrPreamble(usTitle)) {
        candIdx++
        const candId = `CAND-${String(candIdx).padStart(3, '0')}`
        const propId = `P001-I${String(candIdx).padStart(2, '0')}`
        const evId = `EV-${String(candIdx).padStart(3, '0')}`

        const evidence = createEvidence(
          evId,
          currentSectionContext,
          '[User Story]',
          line,
          usTitle,
          'User story',
          { title: usTitle }
        )

        candidates.push({
          candidateId: candId,
          proposalItemId: propId,
          evidenceId: evId,
          rawType: 'User story',
          canonicalType: 'User story',
          title: usTitle,
          sourceLabel: sourceLabel || 'User Story',
          description: `### 使用者故事 (User Story)\n${usTitle}`,
          sourceContent: usTitle,
          priority: 'Middle',
          confidence: 1.0,
          inferenceStatus: 'SOURCE_FACT',
          sourceReference: { documentId: metadata.documentId, section: currentSectionContext, excerpt: line },
          sourceEvidence: evidence,
          evidence: [evidence]
        })
        continue
      }
    }

    // F. 檢測 [Task] / 具體任務
    // 1) 標題模式 (### TASK-01 — Verification Service Prototype)
    const taskHeadingM = line.match(/^###\s*(TASK[-_]\d+)\s*[-—–:]\s*(.*)$/i) || line.match(/^###\s*Task\s*(\d*)[:：\-—–]\s*(.*)$/i)
    if (taskHeadingM) {
      const taskCode = taskHeadingM[1].toUpperCase().startsWith('TASK') ? taskHeadingM[1].toUpperCase() : `TASK-${taskHeadingM[1]}`
      const taskTitle = taskHeadingM[2].trim()
      let assigneeNameRaw = ''
      let dueDateRaw: string | undefined = undefined
      let parentRefRaw = ''
      let taskDesc = ''

      for (let j = i + 1; j < lines.length; j++) {
        const nextL = lines[j].trim()
        if (!nextL) continue
        if (nextL.startsWith('#') || nextL.startsWith('---')) break

        const ownerM = nextL.match(/^[-*•]?\s*(?:Owner|指派給|負責人|Assignee)[:：]\s*(.*)$/i)
        if (ownerM) {
          assigneeNameRaw = ownerM[1].trim()
          continue
        }

        const dueM = nextL.match(/^[-*•]?\s*(?:Due|截止日期|交付日期|交付|Target Date)[:：]\s*(.*)$/i)
        if (dueM) {
          dueDateRaw = normalizeDateString(dueM[1], meetingYear)
          continue
        }

        const relStoryM = nextL.match(/^[-*•]?\s*(?:Related User Story|關聯使用者故事|Parent)[:：]\s*(.*)$/i)
        if (relStoryM) {
          parentRefRaw = relStoryM[1].trim()
          continue
        }

        taskDesc += (taskDesc ? '\n' : '') + nextL
      }

      candIdx++
      const candId = `CAND-${String(candIdx).padStart(3, '0')}`
      const propId = `P001-I${String(candIdx).padStart(2, '0')}`
      const evId = `EV-${String(candIdx).padStart(3, '0')}`

      const { name, uid } = resolveAssignee(assigneeNameRaw)
      const evidence = createEvidence(
        evId,
        currentSectionContext,
        taskCode,
        line,
        taskTitle,
        'Task',
        { title: taskTitle, taskCode, assignee: name || assigneeNameRaw, dueDate: dueDateRaw, parentRef: parentRefRaw }
      )

      candidates.push({
        candidateId: candId,
        proposalItemId: propId,
        evidenceId: evId,
        rawType: 'Task',
        canonicalType: 'Task',
        title: taskTitle,
        sourceLabel: taskCode,
        description: taskDesc || undefined,
        sourceContent: taskDesc || taskTitle,
        priority: 'Middle',
        assigneeName: name,
        assigneeUid: uid,
        dueDate: dueDateRaw,
        parentRef: parentRefRaw || undefined,
        confidence: 1.0,
        inferenceStatus: 'SOURCE_FACT',
        sourceEvidence: evidence,
        evidence: [evidence]
      })
      continue
    }

    // 2) 清單標籤模式 (- **[Task]** (指派給: Kevin Lau) 開發 Cloud Run 上的...)
    if (/\[Task\]/i.test(line)) {
      let remainder = line
        .replace(/^(?:[-*•]|\d+\.)\s*/, '')
        .replace(/\*\*\[Task\]\*\*/i, '')
        .replace(/\[Task\]/i, '')
        .trim()

      let assigneeName: string | undefined = undefined
      let dueDateRaw: string | undefined = undefined

      const dateMatch = remainder.match(/(\d{1,2}月\d{1,2}日|\d{4}[-/]\d{1,2}[-/]\d{1,2})/i)
      if (dateMatch) {
        dueDateRaw = normalizeDateString(dateMatch[1], meetingYear)
      }

      remainder = remainder.replace(/，?\s*預計\s*.*?(?:前)?交付[。]?/i, '').trim()

      const assigneeMatch = remainder.match(/[\(（](?:指派給|指派|負責人|負責|assignee|assigned\s*to)?[:：\s]*([^\)）]+)[\)）]/i)
      if (assigneeMatch) {
        assigneeName = assigneeMatch[1].trim()
        remainder = remainder.replace(assigneeMatch[0], '').trim()
      }

      remainder = remainder.replace(/^[:：\s]+/, '').trim()
      const { title: finalTitle, sourceLabel } = extractTitleAndLabel(remainder)

      if (finalTitle && !isJunkHeadingOrPreamble(finalTitle)) {
        candIdx++
        const { name, uid } = resolveAssignee(assigneeName)
        const candId = `CAND-${String(candIdx).padStart(3, '0')}`
        const propId = `P001-I${String(candIdx).padStart(2, '0')}`
        const evId = `EV-${String(candIdx).padStart(3, '0')}`

        const evidence = createEvidence(
          evId,
          currentSectionContext,
          '[Task]',
          line,
          finalTitle,
          'Task',
          { title: finalTitle, assignee: name || assigneeName, dueDate: dueDateRaw }
        )

        candidates.push({
          candidateId: candId,
          proposalItemId: propId,
          evidenceId: evId,
          rawType: 'Task',
          canonicalType: 'Task',
          title: finalTitle,
          sourceLabel: sourceLabel || 'Task',
          priority: 'Middle',
          assigneeName: name,
          assigneeUid: uid,
          dueDate: dueDateRaw,
          confidence: 1.0,
          inferenceStatus: 'SOURCE_FACT',
          sourceReference: { documentId: metadata.documentId, section: currentSectionContext, excerpt: line },
          sourceEvidence: evidence,
          evidence: [evidence]
        })
        continue
      }
    }

    // G. 檢測 [Decision] / 架構決策
    // 1) 標題模式 (### DEC-01 — Traceability)
    const decHeadingM = line.match(/^###\s*(DEC[-_]\d+)\s*[-—–:]\s*(.*)$/i) || line.match(/^###\s*Decision\s*(\d*)[:：\-—–]\s*(.*)$/i)
    if (decHeadingM) {
      const decCode = decHeadingM[1].toUpperCase().startsWith('DEC') ? decHeadingM[1].toUpperCase() : `DEC-${decHeadingM[1]}`
      const decTitle = decHeadingM[2].trim()
      let decDesc = ''
      for (let j = i + 1; j < lines.length; j++) {
        const nextL = lines[j].trim()
        if (!nextL) continue
        if (nextL.startsWith('#') || nextL.startsWith('---')) break
        decDesc += (decDesc ? '\n' : '') + nextL
      }

      candIdx++
      const candId = `CAND-${String(candIdx).padStart(3, '0')}`
      const propId = `P001-I${String(candIdx).padStart(2, '0')}`
      const evId = `EV-${String(candIdx).padStart(3, '0')}`

      const evidence = createEvidence(
        evId,
        currentSectionContext,
        decCode,
        line,
        decTitle,
        'Decision',
        { title: decTitle, decCode, description: decDesc }
      )

      candidates.push({
        candidateId: candId,
        proposalItemId: propId,
        evidenceId: evId,
        rawType: 'Decision',
        canonicalType: 'Decision',
        title: decTitle,
        sourceLabel: decCode,
        description: decDesc || undefined,
        sourceContent: decDesc || decTitle,
        priority: 'Middle',
        confidence: 1.0,
        inferenceStatus: 'SOURCE_FACT',
        sourceEvidence: evidence,
        evidence: [evidence]
      })
      continue
    }

    // 2) 清單標籤模式 (1. **[Decision] 人臉特徵比對...**)
    const decBulletM = line.match(/(?:[-*•]|\d+\.)?\s*(?:\*\*)?\[Decision\]\s*(.*?)(?:\*\*)?\s*(?:[:：]\s*(.*))?$/i)
    if (decBulletM) {
      const { title: decTitle, sourceLabel } = extractTitleAndLabel(decBulletM[1])
      let decDesc = decBulletM[2]?.trim() || ''
      if (!decDesc && i + 1 < lines.length && lines[i + 1].trim().startsWith('-')) {
        decDesc = lines[i + 1].trim().replace(/^[-*•]\s*/, '')
      }
      if (decTitle && !isJunkHeadingOrPreamble(decTitle)) {
        candIdx++
        const candId = `CAND-${String(candIdx).padStart(3, '0')}`
        const propId = `P001-I${String(candIdx).padStart(2, '0')}`
        const evId = `EV-${String(candIdx).padStart(3, '0')}`

        const evidence = createEvidence(
          evId,
          currentSectionContext,
          '[Decision]',
          line,
          decTitle,
          'Decision',
          { title: decTitle, description: decDesc }
        )

        candidates.push({
          candidateId: candId,
          proposalItemId: propId,
          evidenceId: evId,
          rawType: 'Decision',
          canonicalType: 'Decision',
          title: decTitle,
          sourceLabel: sourceLabel || 'Decision',
          description: decDesc ? `### 架構決策：${decTitle}\n${decDesc}` : undefined,
          sourceContent: decDesc || decTitle,
          priority: 'Middle',
          confidence: 1.0,
          inferenceStatus: 'SOURCE_FACT',
          sourceReference: { documentId: metadata.documentId, section: currentSectionContext, excerpt: line },
          sourceEvidence: evidence,
          evidence: [evidence]
        })
        continue
      }
    }

    // H. 檢測 [Bottleneck] / 技術阻礙與風險
    const btnMatch = line.match(/(?:[-*•]|\d+\.)?\s*(?:\*\*)?\[Bottleneck\]\s*(.*?)(?:\*\*)?\s*(?:[:：]\s*(.*))?$/i)
    if (btnMatch) {
      const { title: btnTitle, sourceLabel } = extractTitleAndLabel(btnMatch[1])
      let btnDesc = btnMatch[2]?.trim() || ''
      if (!btnDesc && i + 1 < lines.length && lines[i + 1].trim().startsWith('-')) {
        btnDesc = lines[i + 1].trim().replace(/^[-*•]\s*/, '')
      }
      if (btnTitle && !isJunkHeadingOrPreamble(btnTitle)) {
        candIdx++
        const btnCandId = `CAND-${String(candIdx).padStart(3, '0')}`
        const btnPropId = `P001-I${String(candIdx).padStart(2, '0')}`
        const btnEvId = `EV-${String(candIdx).padStart(3, '0')}`

        const btnEvidence = createEvidence(
          btnEvId,
          currentSectionContext,
          '[Bottleneck]',
          line,
          btnTitle,
          'Bottleneck',
          { title: btnTitle, description: btnDesc }
        )

        candidates.push({
          candidateId: btnCandId,
          proposalItemId: btnPropId,
          evidenceId: btnEvId,
          rawType: 'Bottleneck',
          canonicalType: 'Bottleneck',
          title: btnTitle,
          sourceLabel: sourceLabel || 'Bottleneck',
          description: btnDesc ? `### 技術阻礙與瓶頸：${btnTitle}\n${btnDesc}` : undefined,
          sourceContent: btnDesc || btnTitle,
          priority: 'High',
          confidence: 1.0,
          inferenceStatus: 'SOURCE_FACT',
          sourceReference: { documentId: metadata.documentId, section: currentSectionContext, excerpt: line },
          sourceEvidence: btnEvidence,
          evidence: [btnEvidence]
        })

        // 檢查源頭是否顯式包含指派任務 (如: 由 Kevin 負責構建 Local Cache Worker)
        const actionMatch = btnDesc.match(/(?:需由|由)\s*([^\s,，]+)\s*(?:負責|負責在[^\s,，]+上)?\s*(?:構建|建立|開發|實現)\s*([^,，。\n\r]+)/i)
        if (actionMatch) {
          const assigneeNameRaw = actionMatch[1]
          const actionTitleRaw = actionMatch[2].trim()
          const { name: resName, uid: resUid } = resolveAssignee(assigneeNameRaw)
          const fullActionTitle = actionTitleRaw.includes('Cache') ? `構建 ${actionTitleRaw}` : actionTitleRaw

          candIdx++
          const actCandId = `CAND-${String(candIdx).padStart(3, '0')}`
          const actPropId = `P001-I${String(candIdx).padStart(2, '0')}`
          const actEvId = `EV-${String(candIdx).padStart(3, '0')}`

          const actEvidence = createEvidence(
            actEvId,
            currentSectionContext,
            '[Action Item]',
            btnDesc,
            fullActionTitle,
            'Task',
            { title: fullActionTitle, assignee: resName || assigneeNameRaw, mitigatesBottleneck: btnTitle }
          )

          candidates.push({
            candidateId: actCandId,
            proposalItemId: actPropId,
            evidenceId: actEvId,
            rawType: 'Task',
            canonicalType: 'Task',
            title: fullActionTitle,
            sourceLabel: 'Task',
            priority: 'High',
            assigneeName: resName,
            assigneeUid: resUid,
            parentCandidateId: btnCandId,
            parentProposalItemId: btnPropId,
            parentRef: btnTitle,
            confidence: 0.95,
            inferenceStatus: 'SOURCE_FACT',
            description: `### 技術風險緩解任務 (Mitigation Task)\n依據瓶頸「${btnTitle}」，由 ${resName || assigneeNameRaw} 執行：${btnDesc}`,
            sourceContent: btnDesc,
            sourceReference: { documentId: metadata.documentId, section: currentSectionContext, excerpt: btnDesc },
            sourceEvidence: actEvidence,
            evidence: [actEvidence]
          })
        }
        continue
      }
    }

    // I. 檢測 [UAT-01] / [UAT-02] 驗收測試案例
    const uatMatch = line.match(/(?:[-*•]|\d+\.)?\s*(?:\*\*)?\[(UAT[-_]\d+)\]\s*(.*?)(?:\*\*)?\s*(?:[:：]\s*(.*))?$/i)
    if (uatMatch) {
      const uatCode = uatMatch[1].toUpperCase()
      const { title: uatTitle } = extractTitleAndLabel(uatMatch[2])
      let uatDesc = uatMatch[3]?.trim() || ''
      if (!uatDesc && i + 1 < lines.length && lines[i + 1].trim().startsWith('-')) {
        uatDesc = lines[i + 1].trim().replace(/^[-*•]\s*/, '')
      }
      const displayTitle = uatTitle || `驗收測試 ${uatCode}`

      if (displayTitle && !isJunkHeadingOrPreamble(displayTitle)) {
        candIdx++
        const candId = `CAND-${String(candIdx).padStart(3, '0')}`
        const propId = `P001-I${String(candIdx).padStart(2, '0')}`
        const evId = `EV-${String(candIdx).padStart(3, '0')}`

        const evidence = createEvidence(
          evId,
          currentSectionContext,
          `[${uatCode}]`,
          line,
          displayTitle,
          'UAT',
          { title: displayTitle, uatCode, description: uatDesc }
        )

        candidates.push({
          candidateId: candId,
          proposalItemId: propId,
          evidenceId: evId,
          rawType: 'UAT',
          canonicalType: 'UAT',
          title: displayTitle,
          sourceLabel: uatCode,
          uatCode,
          description: uatDesc ? `### [${uatCode}] ${displayTitle}\n${uatDesc}` : undefined,
          priority: 'Middle',
          confidence: 1.0,
          inferenceStatus: 'SOURCE_FACT',
          sourceReference: { documentId: metadata.documentId, section: currentSectionContext, excerpt: line },
          sourceEvidence: evidence,
          evidence: [evidence]
        })
        continue
      }
    }
  }

  // 拓撲後置關聯解析：透過 parentRef (例如 'US-01' 或 Bottleneck 標題) 確定性關聯父級
  for (const cand of candidates) {
    if (cand.parentRef) {
      const pRef = cand.parentRef.trim()
      const parentCand = candidates.find(c =>
        c.sourceLabel?.toUpperCase() === pRef.toUpperCase() ||
        c.title === pRef ||
        (c.sourceLabel && pRef.toUpperCase().includes(c.sourceLabel.toUpperCase())) ||
        c.title.includes(pRef)
      )
      if (parentCand) {
        cand.parentCandidateId = parentCand.candidateId
        cand.parentProposalItemId = parentCand.proposalItemId
        cand.relationshipStatus = 'CONFIRMED'
      }
    }
  }

  // 完整度門禁評估 (Completeness Gate Evaluation)
  const completeness = evaluateExtractionCompleteness(candidates, signals, metadata)

  const summary = {
    meeting: candidates.filter(c => c.canonicalType === 'Meeting').length,
    objective: candidates.filter(c => c.canonicalType === 'Objective').length,
    requirement: candidates.filter(c => c.canonicalType === 'Requirement').length,
    userStory: candidates.filter(c => c.canonicalType === 'User story').length,
    task: candidates.filter(c => c.canonicalType === 'Task').length,
    uat: candidates.filter(c => c.canonicalType === 'UAT').length,
    decision: candidates.filter(c => c.canonicalType === 'Decision').length,
    bottleneck: candidates.filter(c => c.canonicalType === 'Bottleneck').length,
    milestone: candidates.filter(c => c.canonicalType === 'Milestone').length,
    other: candidates.filter(c => !['Meeting', 'Objective', 'Requirement', 'User story', 'Task', 'UAT', 'Decision', 'Bottleneck', 'Milestone'].includes(c.canonicalType)).length,
    total: candidates.length
  }

  return { candidates, metadata, completeness, summary }
}
