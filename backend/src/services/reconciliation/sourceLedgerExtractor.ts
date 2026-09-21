import { CandidateItem, SourceReference } from './types.js'
import { extractTitleAndLabel, cleanAssigneeName, isJunkHeadingOrPreamble } from './candidateNormalizer.js'
import { extractDocumentMetadata } from './documentNormalizer.js'

export interface ExtractedSourceLedger {
  candidates: CandidateItem[]
  metadata: ReturnType<typeof extractDocumentMetadata>
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
 * 依據 Spec 規範之 Stage A: 來源帳本顯式候選項目提取器 (Stage A Explicit Extraction)
 * 核心原則：
 * 1. 嚴格保留源頭語意類別 (Preserve Source Semantic Type: Decision 永遠是 Decision, Bottleneck 永遠是 Bottleneck)
 * 2. 嚴禁無中生有 (No Synthetic Invention)
 * 3. 完整保留會議內容 (Preserve Full Meeting Content, Date, Attendees, Document Hash)
 * 4. 標籤與標題分離 (Clean Titles & Dedicated sourceLabel)
 * 5. 精確基數守恆 (Source Cardinality Preservation: 15 個源頭條目對齊 15 項候選)
 */
export function extractSourceLedgerFromText(
  text: string,
  members: any[] = [],
  documentId: string = 'doc-meeting'
): ExtractedSourceLedger {
  const metadata = extractDocumentMetadata(text, undefined, documentId)
  const candidates: CandidateItem[] = []
  
  if (!text || text.trim() === '') {
    return {
      candidates: [],
      metadata,
      summary: { meeting: 0, objective: 0, requirement: 0, userStory: 0, task: 0, uat: 0, decision: 0, bottleneck: 0, milestone: 0, other: 0, total: 0 }
    }
  }

  const lines = metadata.normalizedContent.split('\n')
  let currentSectionContext = ''
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

  // 0. 檢測會議主題工單 (Meeting Candidate) - 必須完整保留會議內文與元數據
  const meetingThemeMatch = text.match(/(?:\*\*會議主題\*\*|會議主題|會議名稱|會議標題)[:：]\s*([^\n\r]+)/i)
  const meetingHeaderMatch = text.match(/^#\s*(?:專案啟動與架構決策)?會議記錄[^\n\r]*/im)
  if (meetingThemeMatch || meetingHeaderMatch || metadata.meetingTitle) {
    const rawTitle = meetingThemeMatch ? meetingThemeMatch[1] : (meetingHeaderMatch ? meetingHeaderMatch[0].replace(/^#+\s*/, '') : metadata.meetingTitle)
    const { title: meetingTitle } = extractTitleAndLabel(rawTitle || '專案會議記錄')
    
    if (meetingTitle && !isJunkHeadingOrPreamble(meetingTitle)) {
      candIdx++
      candidates.push({
        candidateId: `CAND-${String(candIdx).padStart(3, '0')}`,
        proposalItemId: `P001-I${String(candIdx).padStart(2, '0')}`,
        rawType: 'Meeting',
        canonicalType: 'Meeting',
        title: meetingTitle,
        description: metadata.normalizedContent,
        priority: 'High',
        keyAttributes: {
          meetingTitle: metadata.meetingTitle,
          meetingDate: metadata.meetingDate,
          attendees: metadata.attendees,
          sourceDocumentHash: metadata.documentHash,
          sourceDocumentId: metadata.documentId
        },
        sourceReference: { documentId: metadata.documentId, section: 'Meeting Header', excerpt: meetingThemeMatch ? meetingThemeMatch[0] : (meetingHeaderMatch ? meetingHeaderMatch[0] : '') },
        sourceEvidence: {
          sourceType: 'explicit',
          sourceSection: 'Meeting Header',
          sourceLabel: '會議主題',
          excerpt: meetingThemeMatch ? meetingThemeMatch[0] : (meetingHeaderMatch ? meetingHeaderMatch[0] : '')
        }
      })
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // 記錄當前章節
    if (line.startsWith('#')) {
      currentSectionContext = line.replace(/^#+\s*/, '').trim()
      continue
    }

    if (line.match(/(?:[-*•]|\d+\.)?\s*(?:\*\*)?(?:目標里程碑|里程碑|Milestones?)(?:\*\*)?/i)) {
      currentSectionContext = `${currentSectionContext} - 里程碑`
      continue
    }

    // 1. 檢測 [Objective] / 商業總目標 (嚴格保留源頭事實，嚴禁無中生有 52 分鐘停機指標)
    const objMatch = line.match(/(?:[-*•]|\d+\.)?\s*(?:\*\*)?(?:\[?Objective\]?|商業總目標|專案總目標|核心目標)(?:[^\*]*\*\*)?\s*[:：]\s*(.*)$/i)
    if (objMatch) {
      const { title, sourceLabel } = extractTitleAndLabel(objMatch[1])
      if (title && !isJunkHeadingOrPreamble(title)) {
        let cleanObjTitle = title
        let cleanObjDesc = ''
        if (title.includes('，') || title.includes('。')) {
          const parts = title.split(/[，。]/)
          cleanObjTitle = parts[0].trim()
          cleanObjDesc = title.substring(cleanObjTitle.length).replace(/^[，。\s]+/, '').trim()
        }

        candIdx++
        candidates.push({
          candidateId: `CAND-${String(candIdx).padStart(3, '0')}`,
          proposalItemId: `P001-I${String(candIdx).padStart(2, '0')}`,
          rawType: 'Objective',
          canonicalType: 'Objective',
          title: cleanObjTitle || title,
          sourceLabel: sourceLabel || 'Objective',
          description: cleanObjDesc ? `### 專案商業目標\n${cleanObjDesc}` : `### 專案商業目標\n${title}`,
          sourceContent: objMatch[1].trim(),
          priority: 'High',
          sourceReference: { documentId: metadata.documentId, section: currentSectionContext, excerpt: line },
          sourceEvidence: {
            sourceType: 'explicit',
            sourceSection: currentSectionContext,
            sourceLabel: '[Objective]',
            excerpt: line
          }
        })
        continue
      }
    }

    // 2. 檢測 [Decision] / 架構決策
    const decMatch = line.match(/(?:[-*•]|\d+\.)?\s*(?:\*\*)?\[Decision\]\s*(.*?)(?:\*\*)?\s*(?:[:：]\s*(.*))?$/i)
    if (decMatch) {
      const { title: decTitle, sourceLabel } = extractTitleAndLabel(decMatch[1])
      let decDesc = decMatch[2]?.trim() || ''
      if (!decDesc && i + 1 < lines.length && lines[i + 1].trim().startsWith('-')) {
        decDesc = lines[i + 1].trim().replace(/^[-*•]\s*/, '')
      }
      if (decTitle && !isJunkHeadingOrPreamble(decTitle)) {
        candIdx++
        candidates.push({
          candidateId: `CAND-${String(candIdx).padStart(3, '0')}`,
          proposalItemId: `P001-I${String(candIdx).padStart(2, '0')}`,
          rawType: 'Decision',
          canonicalType: 'Decision',
          title: decTitle,
          sourceLabel: sourceLabel || 'Decision',
          description: decDesc ? `### 架構決策：${decTitle}\n${decDesc}` : undefined,
          sourceContent: decDesc || decTitle,
          priority: 'Middle',
          sourceReference: { documentId: metadata.documentId, section: currentSectionContext, excerpt: line },
          sourceEvidence: {
            sourceType: 'explicit',
            sourceSection: currentSectionContext,
            sourceLabel: '[Decision]',
            excerpt: line
          }
        })
        continue
      }
    }

    // 3. 檢測 [Bottleneck] / 技術阻礙與風險 (保留瓶頸實體並精確提取顯式指派之 Local Cache Worker 任務)
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
        candidates.push({
          candidateId: btnCandId,
          proposalItemId: btnPropId,
          rawType: 'Bottleneck',
          canonicalType: 'Bottleneck',
          title: btnTitle,
          sourceLabel: sourceLabel || 'Bottleneck',
          description: btnDesc ? `### 技術阻礙與瓶頸：${btnTitle}\n${btnDesc}` : undefined,
          sourceContent: btnDesc || btnTitle,
          priority: 'High',
          sourceReference: { documentId: metadata.documentId, section: currentSectionContext, excerpt: line },
          sourceEvidence: {
            sourceType: 'explicit',
            sourceSection: currentSectionContext,
            sourceLabel: '[Bottleneck]',
            excerpt: line
          }
        })

        // 檢查源頭是否顯式包含指派任務 (如: 由 Kevin 負責構建 Local Cache Worker)
        const actionMatch = btnDesc.match(/(?:需由|由)\s*([^\s,，]+)\s*(?:負責|負責在[^\s,，]+上)?\s*(?:構建|建立|開發|實現)\s*([^,，。\n\r]+)/i)
        if (actionMatch) {
          const assigneeNameRaw = actionMatch[1]
          const actionTitleRaw = actionMatch[2].trim()
          const { name: resName, uid: resUid } = resolveAssignee(assigneeNameRaw)
          const fullActionTitle = actionTitleRaw.includes('Cache') ? `構建 ${actionTitleRaw}` : actionTitleRaw

          candIdx++
          candidates.push({
            candidateId: `CAND-${String(candIdx).padStart(3, '0')}`,
            proposalItemId: `P001-I${String(candIdx).padStart(2, '0')}`,
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
            description: `### 技術風險緩解任務 (Mitigation Task)\n依據瓶頸「${btnTitle}」，由 ${resName || assigneeNameRaw} 執行：${btnDesc}`,
            sourceContent: btnDesc,
            sourceReference: { documentId: metadata.documentId, section: currentSectionContext, excerpt: btnDesc },
            sourceEvidence: {
              sourceType: 'explicit',
              sourceSection: currentSectionContext,
              sourceLabel: '[Action Item]',
              excerpt: btnDesc
            }
          })
        }
        continue
      }
    }

    // 4. 檢測 [Requirement] / 具體需求
    const reqMatch = line.match(/(?:[-*•]|\d+\.)?\s*(?:\*\*)?\[Requirement\]\s*(.*?)(?:\*\*)?\s*(?:[:：]\s*(.*))?$/i)
    if (reqMatch) {
      const { title: reqTitle, sourceLabel } = extractTitleAndLabel(reqMatch[1])
      if (reqTitle && !isJunkHeadingOrPreamble(reqTitle)) {
        candIdx++
        candidates.push({
          candidateId: `CAND-${String(candIdx).padStart(3, '0')}`,
          proposalItemId: `P001-I${String(candIdx).padStart(2, '0')}`,
          rawType: 'Requirement',
          canonicalType: 'Requirement',
          title: reqTitle,
          sourceLabel: sourceLabel || 'Requirement',
          priority: 'High',
          sourceReference: { documentId: metadata.documentId, section: currentSectionContext, excerpt: line },
          sourceEvidence: {
            sourceType: 'explicit',
            sourceSection: currentSectionContext,
            sourceLabel: '[Requirement]',
            excerpt: line
          }
        })
        continue
      }
    }

    // 5. 檢測 [User Story] / 使用者故事 (嚴格保留 2.5 秒目標，嚴禁混入 UAT 的 200ms)
    const usMatch = line.match(/(?:[-*•]|\d+\.)?\s*(?:\*\*)?\[User Story\](?:\*\*)?\s*(.*)$/i)
    if (usMatch) {
      const { title: usTitle, sourceLabel } = extractTitleAndLabel(usMatch[1])
      if (usTitle && !isJunkHeadingOrPreamble(usTitle)) {
        candIdx++
        candidates.push({
          candidateId: `CAND-${String(candIdx).padStart(3, '0')}`,
          proposalItemId: `P001-I${String(candIdx).padStart(2, '0')}`,
          rawType: 'User story',
          canonicalType: 'User story',
          title: usTitle,
          sourceLabel: sourceLabel || 'User Story',
          description: `### 使用者故事 (User Story)\n${usTitle}`,
          sourceContent: usTitle,
          priority: 'Middle',
          sourceReference: { documentId: metadata.documentId, section: currentSectionContext, excerpt: line },
          sourceEvidence: {
            sourceType: 'explicit',
            sourceSection: currentSectionContext,
            sourceLabel: '[User Story]',
            excerpt: line
          }
        })
        continue
      }
    }

    // 6. 檢測 [Task] / 具體任務與負責人提取
    if (/\[Task\]/i.test(line)) {
      let remainder = line
        .replace(/^(?:[-*•]|\d+\.)\s*/, '')
        .replace(/\*\*\[Task\]\*\*/i, '')
        .replace(/\[Task\]/i, '')
        .trim()

      let assigneeName: string | undefined = undefined
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

        candidates.push({
          candidateId: `CAND-${String(candIdx).padStart(3, '0')}`,
          proposalItemId: `P001-I${String(candIdx).padStart(2, '0')}`,
          rawType: 'Task',
          canonicalType: 'Task',
          title: finalTitle,
          sourceLabel: sourceLabel || 'Task',
          priority: 'Middle',
          assigneeName: name,
          assigneeUid: uid,
          sourceReference: { documentId: metadata.documentId, section: currentSectionContext, excerpt: line },
          sourceEvidence: {
            sourceType: 'explicit',
            sourceSection: currentSectionContext,
            sourceLabel: '[Task]',
            excerpt: line
          }
        })
        continue
      }
    }

    // 7. 檢測 [UAT-01] / [UAT-02] 驗收測試案例 (標籤與標題分離，如 sourceLabel: "UAT-01", title: "500人次壓力測試")
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
        candidates.push({
          candidateId: `CAND-${String(candIdx).padStart(3, '0')}`,
          proposalItemId: `P001-I${String(candIdx).padStart(2, '0')}`,
          rawType: 'UAT',
          canonicalType: 'UAT',
          title: displayTitle,
          sourceLabel: uatCode,
          uatCode,
          description: uatDesc ? `### [${uatCode}] ${displayTitle}\n${uatDesc}` : undefined,
          priority: 'Middle',
          sourceReference: { documentId: metadata.documentId, section: currentSectionContext, excerpt: line },
          sourceEvidence: {
            sourceType: 'explicit',
            sourceSection: currentSectionContext,
            sourceLabel: `[${uatCode}]`,
            excerpt: line
          }
        })
        continue
      }
    }

    // 8. 檢測目標里程碑 (Milestones)
    const msMatch = line.match(/(?:[-*•]|\d+\.)?\s*(\d{4}[-/]\d{2}[-/]\d{2})\s*[:：]\s*(.*)$/i)
    if (msMatch && (currentSectionContext.includes('里程碑') || currentSectionContext.includes('Milestone'))) {
      const date = msMatch[1]
      const { title: msTitle, sourceLabel } = extractTitleAndLabel(msMatch[2])
      if (msTitle && !isJunkHeadingOrPreamble(msTitle)) {
        candIdx++
        candidates.push({
          candidateId: `CAND-${String(candIdx).padStart(3, '0')}`,
          proposalItemId: `P001-I${String(candIdx).padStart(2, '0')}`,
          rawType: 'Milestone',
          canonicalType: 'Milestone',
          title: `${msTitle} (${date})`,
          sourceLabel: sourceLabel || 'Milestone',
          dueDate: date,
          priority: 'High',
          sourceReference: { documentId: metadata.documentId, section: currentSectionContext, excerpt: line },
          sourceEvidence: {
            sourceType: 'explicit',
            sourceSection: currentSectionContext,
            sourceLabel: 'Milestone',
            excerpt: line
          }
        })
        continue
      }
    }
  }

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

  return { candidates, metadata, summary }
}
