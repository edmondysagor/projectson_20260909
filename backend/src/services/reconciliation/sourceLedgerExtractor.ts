import { CandidateItem, SourceReference } from './types.js'
import { cleanTitle, cleanAssigneeName, isJunkHeadingOrPreamble } from './candidateNormalizer.js'

export interface ExtractedSourceLedger {
  candidates: CandidateItem[]
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
 * 依據 Spec v1.0 規範之 Source Ledger 提取器
 * 核心原則：
 * 1. 嚴格保留源頭語義類別 (Preserve Source Semantic Type: Decision 永遠是 Decision, Bottleneck 永遠是 Bottleneck)
 * 2. 嚴禁無中生有 (No Invention: 不強制補齊缺失的 User Story，Requirement ➔ Task 直接鏈接)
 * 3. 來源真實性 > 階層完整性 (Source Fidelity > Hierarchy Completeness)
 * 4. 精確基數對齊 (Source Cardinality Preservation: 15 個源頭條目對齊 15 項候選)
 */
export function extractSourceLedgerFromText(
  text: string,
  members: any[] = [],
  documentId: string = 'doc-meeting'
): ExtractedSourceLedger {
  const candidates: CandidateItem[] = []
  if (!text || text.trim() === '') {
    return {
      candidates: [],
      summary: { meeting: 0, objective: 0, requirement: 0, userStory: 0, task: 0, uat: 0, decision: 0, bottleneck: 0, milestone: 0, other: 0, total: 0 }
    }
  }

  const lines = text.split('\n')
  let currentSectionContext = ''
  let currentParentObjective: string | undefined = undefined
  let currentParentRequirement: string | undefined = undefined
  let currentParentUserStory: string | undefined = undefined
  let currentParentTask: string | undefined = undefined

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

  // 0. 檢測會議標題/主題工單 (Meeting Candidate)
  const meetingThemeMatch = text.match(/(?:\*\*會議主題\*\*|會議主題|會議名稱|會議標題)[:：]\s*([^\n\r]+)/i)
  const meetingHeaderMatch = text.match(/^#\s*(?:專案啟動與架構決策)?會議記錄[^\n\r]*/im)
  if (meetingThemeMatch || meetingHeaderMatch) {
    const meetingTitle = cleanTitle(meetingThemeMatch ? meetingThemeMatch[1] : (meetingHeaderMatch ? meetingHeaderMatch[0].replace(/^#+\s*/, '') : '專案會議記錄'))
    if (meetingTitle && !isJunkHeadingOrPreamble(meetingTitle)) {
      candIdx++
      candidates.push({
        candidateId: `CAND-${String(candIdx).padStart(3, '0')}`,
        rawType: 'Meeting',
        canonicalType: 'Meeting',
        title: meetingTitle,
        priority: 'High',
        sourceReference: { documentId, section: 'Meeting Header', excerpt: meetingThemeMatch ? meetingThemeMatch[0] : (meetingHeaderMatch ? meetingHeaderMatch[0] : '') }
      })
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // 0.1 記錄當前大章節與子章節
    if (line.startsWith('#')) {
      currentSectionContext = line.replace(/^#+\s*/, '').trim()
      continue
    }

    if (line.match(/(?:[-*•]|\d+\.)?\s*(?:\*\*)?(?:目標里程碑|里程碑|Milestones?)(?:\*\*)?/i)) {
      currentSectionContext = `${currentSectionContext} - 里程碑`
      continue
    }

    // 1. 檢測 [Objective] / 商業總目標 (Principle 7: 絕不拆分單一商業目標)
    const objMatch = line.match(/(?:[-*•]|\d+\.)?\s*(?:\*\*)?(?:\[?Objective\]?|商業總目標|專案總目標|核心目標)(?:[^\*]*\*\*)?\s*[:：]\s*(.*)$/i)
    if (objMatch) {
      const title = cleanTitle(objMatch[1])
      if (title && !isJunkHeadingOrPreamble(title)) {
        candIdx++
        const cand: CandidateItem = {
          candidateId: `CAND-${String(candIdx).padStart(3, '0')}`,
          rawType: 'Objective',
          canonicalType: 'Objective',
          title,
          priority: 'High',
          sourceReference: { documentId, section: currentSectionContext, excerpt: line }
        }
        candidates.push(cand)
        currentParentObjective = title
        continue
      }
    }

    // 2. 檢測 [Decision] / 架構決策 (Rule 1: 保持 Decision，絕不篡改為 Requirement)
    const decMatch = line.match(/(?:[-*•]|\d+\.)?\s*(?:\*\*)?\[Decision\]\s*(.*?)(?:\*\*)?\s*(?:[:：]\s*(.*))?$/i)
    if (decMatch) {
      const decTitle = cleanTitle(decMatch[1])
      let decDesc = decMatch[2]?.trim() || ''
      if (!decDesc && i + 1 < lines.length && lines[i + 1].trim().startsWith('-')) {
        decDesc = lines[i + 1].trim().replace(/^[-*•]\s*/, '')
      }
      if (decTitle && !isJunkHeadingOrPreamble(decTitle)) {
        candIdx++
        candidates.push({
          candidateId: `CAND-${String(candIdx).padStart(3, '0')}`,
          rawType: 'Decision',
          canonicalType: 'Decision',
          title: decTitle,
          description: decDesc ? `### 架構決策：${decTitle}\n${decDesc}` : undefined,
          priority: 'Middle',
          sourceReference: { documentId, section: currentSectionContext, excerpt: line }
        })
        continue
      }
    }

    // 3. 檢測 [Bottleneck] / 技術阻礙與風險 (Rule 1: 保持 Bottleneck，絕不篡改為 Requirement)
    const btnMatch = line.match(/(?:[-*•]|\d+\.)?\s*(?:\*\*)?\[Bottleneck\]\s*(.*?)(?:\*\*)?\s*(?:[:：]\s*(.*))?$/i)
    if (btnMatch) {
      const btnTitle = cleanTitle(btnMatch[1])
      let btnDesc = btnMatch[2]?.trim() || ''
      if (!btnDesc && i + 1 < lines.length && lines[i + 1].trim().startsWith('-')) {
        btnDesc = lines[i + 1].trim().replace(/^[-*•]\s*/, '')
      }
      if (btnTitle && !isJunkHeadingOrPreamble(btnTitle)) {
        candIdx++
        candidates.push({
          candidateId: `CAND-${String(candIdx).padStart(3, '0')}`,
          rawType: 'Bottleneck',
          canonicalType: 'Bottleneck',
          title: btnTitle,
          description: btnDesc ? `### 技術阻礙與瓶頸：${btnTitle}\n${btnDesc}` : undefined,
          priority: 'High',
          sourceReference: { documentId, section: currentSectionContext, excerpt: line }
        })
        continue
      }
    }

    // 4. 檢測 [Requirement] / 具體需求
    const reqMatch = line.match(/(?:[-*•]|\d+\.)?\s*(?:\*\*)?\[Requirement\]\s*(.*?)(?:\*\*)?\s*(?:[:：]\s*(.*))?$/i)
    if (reqMatch) {
      const reqTitle = cleanTitle(reqMatch[1])
      if (reqTitle && !isJunkHeadingOrPreamble(reqTitle)) {
        candIdx++
        const cand: CandidateItem = {
          candidateId: `CAND-${String(candIdx).padStart(3, '0')}`,
          rawType: 'Requirement',
          canonicalType: 'Requirement',
          title: reqTitle,
          priority: 'High',
          parentRef: currentParentObjective,
          sourceReference: { documentId, section: currentSectionContext, excerpt: line }
        }
        candidates.push(cand)
        currentParentRequirement = reqTitle
        currentParentUserStory = undefined // 重設 User Story，無 User Story 時 Task 直接掛載至此 Requirement
        continue
      }
    }

    // 5. 檢測 [User Story] / 使用者故事
    const usMatch = line.match(/(?:[-*•]|\d+\.)?\s*(?:\*\*)?\[User Story\](?:\*\*)?\s*(.*)$/i)
    if (usMatch) {
      const usTitle = cleanTitle(usMatch[1])
      if (usTitle && !isJunkHeadingOrPreamble(usTitle)) {
        candIdx++
        const cand: CandidateItem = {
          candidateId: `CAND-${String(candIdx).padStart(3, '0')}`,
          rawType: 'User story',
          canonicalType: 'User story',
          title: usTitle,
          priority: 'Middle',
          parentRef: currentParentRequirement,
          sourceReference: { documentId, section: currentSectionContext, excerpt: line }
        }
        candidates.push(cand)
        currentParentUserStory = usTitle
        continue
      }
    }

    // 6. 檢測 [Task] / 具體任務與負責人提取
    if (/\[Task\]/i.test(line)) {
      // 移除開頭 bullet 與 [Task] 標記及包圍的 **
      let remainder = line
        .replace(/^(?:[-*•]|\d+\.)\s*/, '')
        .replace(/\*\*\[Task\]\*\*/i, '')
        .replace(/\[Task\]/i, '')
        .trim()

      let assigneeName: string | undefined = undefined
      // 提取 (指派給: Kevin Lau) 或 (負責人: Sarah Wong) 或 (David Cheung)
      const assigneeMatch = remainder.match(/[\(（](?:指派給|指派|負責人|負責|assignee|assigned\s*to)?[:：\s]*([^\)）]+)[\)）]/i)
      if (assigneeMatch) {
        assigneeName = assigneeMatch[1].trim()
        remainder = remainder.replace(assigneeMatch[0], '').trim()
      }

      // 清理剩餘標點
      remainder = remainder.replace(/^[:：\s]+/, '').trim()
      const finalTitle = cleanTitle(remainder)

      if (finalTitle && !isJunkHeadingOrPreamble(finalTitle)) {
        candIdx++
        const { name, uid } = resolveAssignee(assigneeName)
        // Rule 3: 若有 User Story 則掛 User Story；若無 User Story 則直接掛 Requirement！
        const parentRef = currentParentUserStory || currentParentRequirement || currentParentObjective

        const cand: CandidateItem = {
          candidateId: `CAND-${String(candIdx).padStart(3, '0')}`,
          rawType: 'Task',
          canonicalType: 'Task',
          title: finalTitle,
          priority: 'Middle',
          assigneeName: name,
          assigneeUid: uid,
          parentRef,
          sourceReference: { documentId, section: currentSectionContext, excerpt: line }
        }
        candidates.push(cand)
        currentParentTask = finalTitle
        continue
      }
    }

    // 7. 檢測 [UAT-01] / [UAT-02] 驗收測試案例
    const uatMatch = line.match(/(?:[-*•]|\d+\.)?\s*(?:\*\*)?\[(UAT[-_]\d+)\]\s*(.*?)(?:\*\*)?\s*(?:[:：]\s*(.*))?$/i)
    if (uatMatch) {
      const uatCode = uatMatch[1].toUpperCase()
      const uatTitle = cleanTitle(uatMatch[2])
      let uatDesc = uatMatch[3]?.trim() || ''
      if (!uatDesc && i + 1 < lines.length && lines[i + 1].trim().startsWith('-')) {
        uatDesc = lines[i + 1].trim().replace(/^[-*•]\s*/, '')
      }
      const fullUatTitle = `[${uatCode}] ${uatTitle}`

      if (uatTitle && !isJunkHeadingOrPreamble(uatTitle)) {
        candIdx++
        candidates.push({
          candidateId: `CAND-${String(candIdx).padStart(3, '0')}`,
          rawType: 'UAT',
          canonicalType: 'UAT',
          title: fullUatTitle,
          uatCode,
          description: uatDesc ? `### ${fullUatTitle}\n${uatDesc}` : undefined,
          priority: 'Middle',
          parentRef: currentParentTask,
          sourceReference: { documentId, section: currentSectionContext, excerpt: line }
        })
        continue
      }
    }

    // 8. 檢測目標里程碑 (Milestones)
    const msMatch = line.match(/(?:[-*•]|\d+\.)?\s*(\d{4}[-/]\d{2}[-/]\d{2})\s*[:：]\s*(.*)$/i)
    if (msMatch && (currentSectionContext.includes('里程碑') || currentSectionContext.includes('Milestone'))) {
      const date = msMatch[1]
      const msTitle = cleanTitle(msMatch[2])
      if (msTitle && !isJunkHeadingOrPreamble(msTitle)) {
        candIdx++
        candidates.push({
          candidateId: `CAND-${String(candIdx).padStart(3, '0')}`,
          rawType: 'Milestone',
          canonicalType: 'Milestone',
          title: `${msTitle} (${date})`,
          dueDate: date,
          priority: 'High',
          sourceReference: { documentId, section: currentSectionContext, excerpt: line }
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

  return { candidates, summary }
}
