import { CandidateItem, CandidateCoverageSummary, ReconciliationProposal, ReconciledCandidate, DocumentMetadata } from './types.js'
import { cleanTitle, normalizeCandidate, isJunkHeadingOrPreamble } from './candidateNormalizer.js'
import { reconcileCandidate } from './itemReconciler.js'
import { validateAndPlanTopology } from './graphValidator.js'
import { ProjectItemMemory } from './memoryRetriever.js'
import { extractSourceLedgerFromText } from './sourceLedgerExtractor.js'
import { computeDocumentHash, extractDocumentMetadata } from './documentNormalizer.js'

export interface PipelineInput {
  text: string
  existingItems: ProjectItemMemory[]
  members: any[]
  currentProject?: { project_uid: string; project_name: string }
  subAgentItems?: any[]
  rawPreviews?: any[]
  filename?: string
  documentId?: string
}

export function executeReconciliationPipeline(input: PipelineInput): ReconciliationProposal {
  const { text, existingItems, members, currentProject, subAgentItems = [], rawPreviews = [], filename, documentId } = input

  // 1. 文件正規化與元數據/雜湊計算 (Document Normalization & Hash)
  const metadata: DocumentMetadata = extractDocumentMetadata(text, filename, documentId)
  const currentDocHash = metadata.documentHash

  // 1.1 檢查是否為重複文件 (Exact Document Hash Match)
  const isDuplicateDoc = existingItems.some(item => {
    if (item.item_type === 'Meeting' && item.item_content) {
      const contentStr = typeof item.item_content === 'string' ? item.item_content : JSON.stringify(item.item_content)
      return contentStr.includes(currentDocHash)
    }
    return false
  })

  // 2. Stage A: 顯式候選項目提取 (Stage A Explicit Item Extraction)
  let candidateList: CandidateItem[] = []

  if (text && text.trim().length > 10) {
    const ledger = extractSourceLedgerFromText(text, members, metadata.documentId)
    if (ledger.candidates.length > 0) {
      candidateList = ledger.candidates
    }
  }

  // 若無直接文字提取，則從 rawPreviews 與 subAgentItems 收集
  if (candidateList.length === 0) {
    let candIdx = 0
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
        candidateId: item.candidateId || `CAND-${String(candIdx + 1).padStart(3, '0')}`,
        proposalItemId: item.proposalItemId || `P001-I${String(candIdx + 1).padStart(2, '0')}`,
        rawType: item.itemType || item.canonicalType || 'Task',
        title: rawTitle,
        description: item.description || (item.item_content?.text || item.item_content?.description || ''),
        priority: item.itemPriority || item.priority || 'Middle',
        assigneeName: item.itemFollowBy || item.assigneeName,
        parentCandidateId: item.parentCandidateId,
        parentRef: item.parentItemUid || item.parentRef,
        sectionTitle: item.sectionTitle,
        sourceEvidence: item.sourceEvidence
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
  }

  // 2.1 計算覆蓋率指標
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

  // 3. Stage B: 記憶對齊與重複偵測 (Stage B Reconciliation)
  const reconciledList: ReconciledCandidate[] = candidateList.map(cand => {
    if (isDuplicateDoc) {
      return {
        candidateId: cand.candidateId,
        action: 'NO_CHANGE',
        candidate: cand,
        reason: `文件內容雜湊 [${currentDocHash.substring(0, 8)}] 已完全存在於專案資料庫中，安全略過。`
      }
    }
    return reconcileCandidate(cand, existingItems, members)
  })

  // 4. Stage C: 拓撲圖譜規劃與校驗 (Stage C Topology & Graph Validation)
  const { reconciled: validatedReconciled, relationships, validation } = validateAndPlanTopology(reconciledList, existingItems)

  // 5. 構建標準 Canonical Proposal 物件
  const proposal: ReconciliationProposal = {
    proposalId: `PROP-${Date.now().toString(36).toUpperCase()}`,
    sourceDocumentId: metadata.documentId,
    sourceDocumentHash: currentDocHash,
    documentMetadata: metadata,
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
      const parentRel = relationships.find(rel => rel.childCandidateId === r.candidateId && rel.relationshipType === 'parent_child')
      const discussesRels = relationships
        .filter(rel => rel.parentCandidateId === r.candidateId && rel.relationshipType === 'discusses')
        .map(rel => ({ item_uid: rel.childCandidateId || rel.childRef || '', relation: 'discusses' }))

      proposal.creates.push({
        candidateId: r.candidateId,
        proposalItemId: r.candidate.proposalItemId,
        itemTitle: r.candidate.title,
        sourceLabel: r.candidate.sourceLabel,
        itemType: r.candidate.canonicalType,
        itemPriority: r.candidate.priority || 'Middle',
        itemFollowBy: r.candidate.assigneeUid || r.candidate.assigneeName || undefined,
        parentCandidateId: parentRel ? parentRel.parentCandidateId : r.candidate.parentCandidateId,
        parentItemUid: undefined,
        relationshipStatus: r.candidate.relationshipStatus || 'CONFIRMED',
        relationItemUid: discussesRels.length > 0 ? discussesRels : undefined,
        description: r.candidate.description || undefined,
        sourceReference: r.candidate.sourceReference,
        sourceEvidence: r.candidate.sourceEvidence
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

  // 硬性基數守恆防線
  const totalOutcomes = proposal.creates.length + proposal.updates.length + proposal.noChanges.length + proposal.reviewRequired.length + proposal.ignored.length
  if (totalOutcomes !== candidateList.length) {
    validation.status = 'FAIL'
    validation.errors.push({
      code: 'E001_CARDINALITY_MISMATCH',
      severity: 'ERROR',
      message: `Cardinality mismatch: extracted ${candidateList.length} items, but reconciled into ${totalOutcomes} outcomes.`
    })
  }

  return proposal
}
