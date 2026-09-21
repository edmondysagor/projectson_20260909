import { CandidateItem, CandidateCoverageSummary, ReconciliationProposal, ReconciledCandidate } from './types.js'
import { cleanTitle, normalizeCandidate, isJunkHeadingOrPreamble } from './candidateNormalizer.js'
import { reconcileCandidate } from './itemReconciler.js'
import { validateAndPlanTopology } from './graphValidator.js'
import { ProjectItemMemory } from './memoryRetriever.js'

export interface PipelineInput {
  text: string
  existingItems: ProjectItemMemory[]
  members: any[]
  currentProject?: { project_uid: string; project_name: string }
  subAgentItems?: any[]
  rawPreviews?: any[]
}

export function executeReconciliationPipeline(input: PipelineInput): ReconciliationProposal {
  const { text, existingItems, members, currentProject, subAgentItems = [], rawPreviews = [] } = input

  // 1. 收集候選項目 (Candidate Items)
  const candidateList: CandidateItem[] = []
  let candIdx = 0

  // 1.1 從 subAgentItems 與 rawPreviews 收集候選項目
  const incomingItems: any[] = []
  for (const prev of rawPreviews) {
    if (prev.actionType === 'batch_proposal' && Array.isArray(prev.items)) {
      incomingItems.push(...prev.items)
    } else if (prev.actionType === 'create_item') {
      incomingItems.push(prev)
    }
  }
  for (const sub of subAgentItems) {
    if (sub.itemsToCreate && Array.isArray(sub.itemsToCreate)) {
      incomingItems.push(...sub.itemsToCreate)
    }
  }

  for (const item of incomingItems) {
    const rawTitle = item.itemTitle || item.title || ''
    if (isJunkHeadingOrPreamble(rawTitle)) {
      continue
    }

    const normalized = normalizeCandidate({
      candidateId: `CAND-${String(candIdx + 1).padStart(3, '0')}`,
      rawType: item.itemType || item.canonicalType || 'Task',
      title: rawTitle,
      description: item.description || (item.item_content?.text || item.item_content?.description || ''),
      priority: item.itemPriority || item.priority || 'Middle',
      assigneeName: item.itemFollowBy || item.assigneeName,
      parentRef: item.parentItemUid || item.parentRef,
      sectionTitle: item.sectionTitle
    }, candIdx)

    // 解決負責人姓名到 UID 的映射
    if (normalized.assigneeName && members.length > 0) {
      const matchName = normalized.assigneeName.toLowerCase().replace(/[*`[\]"()（）]/g, '').trim()
      for (const m of members) {
        if (!m.member_name) continue
        const mName = m.member_name.toLowerCase().trim()
        if (matchName === mName || matchName === m.member_uid?.toLowerCase()) {
          normalized.assigneeUid = m.member_uid
          break
        }
        const firstName = mName.split(' ')[0]
        if (firstName && firstName.length >= 2 && matchName === firstName) {
          normalized.assigneeUid = m.member_uid
          break
        }
      }
    }

    candidateList.push(normalized)
    candIdx++
  }

  // 1.2 計算覆蓋率指標
  const coverageSummary: CandidateCoverageSummary = {
    totalExtracted: candidateList.length,
    counts: {
      objectives: candidateList.filter(c => c.canonicalType === 'Objective').length,
      requirements: candidateList.filter(c => c.canonicalType === 'Requirement').length,
      userStories: candidateList.filter(c => c.canonicalType === 'User story').length,
      tasks: candidateList.filter(c => c.canonicalType === 'Task').length,
      uats: candidateList.filter(c => c.canonicalType === 'UAT').length,
      meetings: candidateList.filter(c => c.canonicalType === 'Meeting').length,
      decisions: candidateList.filter(c => c.canonicalType === 'Decision').length,
      other: candidateList.filter(c => !['Objective', 'Requirement', 'User story', 'Task', 'UAT', 'Meeting', 'Decision'].includes(c.canonicalType)).length
    }
  }

  // 2. 逐項進行專案記憶對齊 (Stage 4 Reconciliation)
  const reconciledList: ReconciledCandidate[] = candidateList.map(cand => 
    reconcileCandidate(cand, existingItems, members)
  )

  // 3. 圖譜與拓撲規劃 (Stage 5 & 6 Validation)
  const { reconciled: validatedReconciled, relationships, validation } = validateAndPlanTopology(reconciledList, existingItems)

  // 4. 構建標準 Proposal 物件
  const proposal: ReconciliationProposal = {
    creates: [],
    updates: [],
    noChanges: [],
    reviewRequired: [],
    ignored: [],
    relationships,
    validation,
    coverage: {
      extracted: candidateList.length,
      processed: validatedReconciled.length,
      isComplete: candidateList.length === validatedReconciled.length
    }
  }

  for (const r of validatedReconciled) {
    if (r.action === 'CREATE') {
      const parentRel = relationships.find(rel => rel.childRef === r.candidate.title && rel.relationshipType === 'parent_child')
      const discussesRels = relationships
        .filter(rel => rel.parentRef === r.candidate.title && rel.relationshipType === 'discusses')
        .map(rel => ({ item_uid: rel.childRef, relation: 'discusses' }))

      proposal.creates.push({
        candidateId: r.candidateId,
        itemTitle: r.candidate.title,
        itemType: r.candidate.canonicalType,
        itemPriority: r.candidate.priority || 'Middle',
        itemFollowBy: r.candidate.assigneeUid || r.candidate.assigneeName || undefined,
        parentItemUid: parentRel ? parentRel.parentRef : (r.candidate.parentRef || undefined),
        relationItemUid: discussesRels.length > 0 ? discussesRels : undefined,
        description: r.candidate.description || undefined,
        sourceReference: r.candidate.sourceReference
      })
    } else if (r.action === 'UPDATE') {
      proposal.updates.push({
        candidateId: r.candidateId,
        targetItemUid: r.existingItemUid,
        targetDisplayCode: r.existingDisplayCode,
        itemTitle: r.candidate.title,
        updates: r.changes || {},
        summary: r.reason,
        reason: r.reason
      })
    } else if (r.action === 'NO_CHANGE') {
      proposal.noChanges.push({
        candidateId: r.candidateId,
        existingItemUid: r.existingItemUid,
        existingDisplayCode: r.existingDisplayCode,
        reason: r.reason
      })
    } else if (r.action === 'REVIEW_REQUIRED') {
      proposal.reviewRequired.push({
        candidateId: r.candidateId,
        candidate: r.candidate,
        possibleMatches: r.possibleMatches,
        reason: r.reason
      })
    } else if (r.action === 'IGNORE') {
      proposal.ignored.push({
        candidateId: r.candidateId,
        reason: r.reason
      })
    }
  }

  return proposal
}
