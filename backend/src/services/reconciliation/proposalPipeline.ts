import {
  CandidateItem,
  CandidateCoverageSummary,
  ReconciliationProposal,
  ReconciledCandidate,
  DocumentMetadata,
  CanonicalProposalItem,
  SourceEvidence,
  SourceDocumentInput,
  ProcessingInstruction
} from './types.js'
import { normalizeCandidate, isJunkHeadingOrPreamble } from './candidateNormalizer.js'
import { reconcileCandidate } from './itemReconciler.js'
import { validateAndPlanTopology } from './graphValidator.js'
import { ProjectItemMemory } from './memoryRetriever.js'
import { extractSourceLedgerFromText } from './sourceLedgerExtractor.js'
import { extractDocumentMetadata } from './documentNormalizer.js'

export interface PipelineInput {
  text?: string
  sourceDocument?: SourceDocumentInput
  processingInstruction?: ProcessingInstruction
  existingItems: ProjectItemMemory[]
  members: any[]
  currentProject?: { project_uid: string; project_name: string }
  subAgentItems?: any[]
  rawPreviews?: any[]
  filename?: string
  documentId?: string
}

/**
 * 確定性對齊管線 (Deterministic Reconciliation Pipeline)
 * 流程：
 * Document ➔ Normalize (Metadata & SHA-256 Hash) ➔ Extract Facts & Evidence (Stage A: CAND-xxx & EV-xxx)
 * ➔ Completeness Gate (Verify all substantive sections/evidence represented)
 * ➔ Retrieve & Multi-Signal Match against DB ➔ Element-Level Field Diff & Action Classification (Stage B)
 * ➔ Traceability Graph Planning & Validation (Stage C)
 * ➔ Single Canonical Immutable Proposal Assembly
 */
export function executeReconciliationPipeline(input: PipelineInput): ReconciliationProposal {
  const {
    text,
    sourceDocument,
    processingInstruction,
    existingItems,
    members,
    currentProject,
    subAgentItems = [],
    rawPreviews = [],
    filename,
    documentId
  } = input

  // 0. 嚴格隔離來源文檔與處理指令 (Source Document vs Processing Instruction)
  const sourceText = sourceDocument?.content || text || ''
  const effectiveFilename = sourceDocument?.filename || filename
  const effectiveDocId = sourceDocument?.documentId || documentId

  // 1. 文件正規化與元數據/雜湊計算 (Document Normalization & Hash)
  const metadata: DocumentMetadata = extractDocumentMetadata(sourceText, effectiveFilename, effectiveDocId)
  const currentDocHash = metadata.documentHash

  // 1.1 檢查是否為重複文件 (Exact Document Hash Match)
  const isDuplicateDoc = existingItems.some(item => {
    if (item.item_type === 'Meeting' && item.item_content) {
      const contentStr = typeof item.item_content === 'string' ? item.item_content : JSON.stringify(item.item_content)
      return contentStr.includes(currentDocHash)
    }
    return false
  })

  // 2. Stage A: 顯式候選項目提取與完整度評估 (Stage A Explicit Item & Evidence Extraction)
  let candidateList: CandidateItem[] = []
  let ledgerCompleteness: any = { isComplete: true }

  if (sourceText && sourceText.trim().length > 10) {
    const ledger = extractSourceLedgerFromText(sourceText, members, metadata.documentId, effectiveFilename)
    if (ledger.candidates.length > 0) {
      candidateList = ledger.candidates
    }
    ledgerCompleteness = ledger.completeness
  }

  // 2.1 完整度門禁 (Extraction Completeness Gate Check)
  // 若文件顯式包含多個專案項目區塊，但候選項目未能代表所有區塊，嚴格阻斷進入對齊與套用
  if (!ledgerCompleteness.isComplete) {
    const reasonMsg = ledgerCompleteness.report?.reason || 'Detected project-relevant sections were not represented in candidates'
    return {
      proposalId: `PROP-${Date.now().toString(36).toUpperCase()}`,
      proposalVersion: 1,
      mode: 'EXTRACTION_INCOMPLETE',
      sourceDocumentId: metadata.documentId,
      sourceDocumentHash: currentDocHash,
      createdAt: new Date().toISOString(),
      documentMetadata: metadata,
      evidence: [],
      items: [],
      creates: [],
      updates: [],
      corrections: [],
      noChanges: [],
      reviewRequired: [],
      conflicts: [],
      ignored: [],
      relationships: [],
      relations: [],
      validation: {
        status: 'FAIL',
        errors: [{ code: 'EXTRACTION_INCOMPLETE', severity: 'ERROR', message: `Extraction incomplete: ${reasonMsg}` }],
        warnings: [],
        validatedAt: new Date().toISOString()
      },
      coverage: {
        extracted: candidateList.length,
        processed: 0,
        isComplete: false,
        incompleteExtraction: ledgerCompleteness.report,
        diagnostics: ledgerCompleteness.diagnostics
      },
      summaryStats: {
        total: 0,
        creates: 0,
        created: 0,
        updates: 0,
        updated: 0,
        corrections: 0,
        corrected: 0,
        noChanges: 0,
        noChange: 0,
        reviewRequired: 0,
        needsReview: 0,
        conflicts: 0,
        conflict: 0
      }
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

      const candId = item.candidateId || `CAND-${String(candIdx + 1).padStart(3, '0')}`
      const propId = item.proposalItemId || `P001-I${String(candIdx + 1).padStart(2, '0')}`
      const evId = `EV-${String(candIdx + 1).padStart(3, '0')}`

      const normalized = normalizeCandidate({
        candidateId: candId,
        proposalItemId: propId,
        evidenceId: evId,
        rawType: item.itemType || item.canonicalType || 'Task',
        title: rawTitle,
        description: item.description || (item.item_content?.text || item.item_content?.description || ''),
        priority: item.itemPriority || item.priority || 'Middle',
        assigneeName: item.itemFollowBy || item.assigneeName,
        parentCandidateId: item.parentCandidateId,
        parentRef: item.parentItemUid || item.parentRef,
        sectionTitle: item.sectionTitle,
        sourceEvidence: item.sourceEvidence || {
          evidenceId: evId,
          sourceDocumentId: metadata.documentId,
          sourceDocumentHash: metadata.documentHash,
          sourceType: 'explicit',
          sourceSection: item.sectionTitle || 'General',
          sourceLabel: item.sourceLabel || 'Item',
          extractedFact: rawTitle,
          candidateType: item.itemType || item.canonicalType || 'Task',
          confidence: 1.0,
          inferenceStatus: 'SOURCE_FACT',
          excerpt: rawTitle
        }
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
      bottlenecks: candidateList.filter(c => c.canonicalType === 'Bottleneck').length,
      milestones: candidateList.filter(c => c.canonicalType === 'Milestone').length,
      other: candidateList.filter(c => !['Objective', 'Requirement', 'User story', 'Task', 'UAT', 'Meeting', 'Decision', 'Bottleneck', 'Milestone'].includes(c.canonicalType)).length
    }
  }

  // 3. Stage B: 記憶檢索與元素級對齊 (Stage B Semantic Matching & Element Diffing)
  const reconciledList: ReconciledCandidate[] = candidateList.map(cand => {
    if (isDuplicateDoc) {
      return {
        candidateId: cand.candidateId,
        proposalItemId: cand.proposalItemId,
        action: 'NO_CHANGE',
        candidate: cand,
        confidence: 1.0,
        reason: `文件內容雜湊 [${currentDocHash.substring(0, 8)}] 已完全存在於專案資料庫中，安全略過。`
      }
    }
    return reconcileCandidate(cand, existingItems, members)
  })

  // 4. Stage C: 拓撲圖譜規劃與校驗 (Stage C Topology & Graph Validation)
  const { reconciled: validatedReconciled, relationships, validation } = validateAndPlanTopology(reconciledList, existingItems)

  // 5. 收集所有 SourceEvidence 實體
  const allEvidence: SourceEvidence[] = []
  for (const cand of candidateList) {
    if (cand.sourceEvidence) {
      allEvidence.push(cand.sourceEvidence)
    } else if (cand.evidence && Array.isArray(cand.evidence)) {
      allEvidence.push(...cand.evidence)
    }
  }

  // 6. 構建標準 Canonical Proposal 物件
  const canonicalRelations = relationships.map((rel, idx) => ({
    relationId: rel.relationId || `REL-${String(idx + 1).padStart(3, '0')}`,
    fromProposalItemId: rel.fromProposalItemId || rel.childCandidateId || '',
    toProposalItemId: rel.toProposalItemId || rel.parentCandidateId || '',
    relationType: rel.relationshipType,
    evidence: rel.evidence,
    confidence: rel.confidence ?? 1.0,
    inferred: rel.inferred ?? false,
    needsReview: rel.needsReview ?? (rel.relationshipStatus === 'NEEDS_REVIEW')
  }))

  const proposalItems: CanonicalProposalItem[] = []

  const proposal: ReconciliationProposal = {
    proposalId: `PROP-${Date.now().toString(36).toUpperCase()}`,
    proposalVersion: 1,
    mode: isDuplicateDoc ? 'DUPLICATE_NOOP' : (existingItems.length === 0 ? 'FULL_INITIALIZATION' : 'INCREMENTAL_RECONCILIATION'),
    sourceDocumentId: metadata.documentId,
    sourceDocumentHash: currentDocHash,
    createdAt: new Date().toISOString(),
    documentMetadata: metadata,
    evidence: allEvidence,
    items: proposalItems,
    creates: [],
    updates: [],
    corrections: [],
    noChanges: [],
    reviewRequired: [],
    conflicts: [],
    ignored: [],
    relationships,
    relations: canonicalRelations,
    validation,
    coverage: {
      extracted: candidateList.length,
      processed: validatedReconciled.length,
      isComplete: true,
      diagnostics: ledgerCompleteness.diagnostics
    }
  }

  for (const r of validatedReconciled) {
    const isMeeting = r.candidate.canonicalType === 'Meeting'
    const fullContent = isMeeting ? metadata.normalizedContent : (r.candidate.sourceContent || r.candidate.description || undefined)

    if (r.action === 'CREATE') {
      const parentRel = relationships.find(rel => 
        (rel.childCandidateId === r.candidateId || rel.fromProposalItemId === r.candidate.proposalItemId) && 
        (rel.relationshipType === 'parent_child' || rel.relationshipType === 'mitigates')
      )
      const targetParentCandId = parentRel ? parentRel.parentCandidateId : r.candidate.parentCandidateId
      const parentCand = targetParentCandId ? candidateList.find(c => c.candidateId === targetParentCandId) : undefined
      const parentProposalItemId = parentCand?.proposalItemId || parentRel?.toProposalItemId || (targetParentCandId?.startsWith('P001-') ? targetParentCandId : undefined)

      proposal.creates.push({
        candidateId: r.candidateId,
        proposalItemId: r.candidate.proposalItemId,
        evidenceId: r.candidate.evidenceId,
        itemTitle: r.candidate.title,
        sourceLabel: r.candidate.sourceLabel,
        itemType: r.candidate.canonicalType,
        itemPriority: r.candidate.priority || 'Middle',
        itemFollowBy: r.candidate.assigneeUid || r.candidate.assigneeName || undefined,
        assigneeUid: r.candidate.assigneeUid,
        assigneeId: r.candidate.assigneeUid,
        assigneeName: r.candidate.assigneeName,
        parentCandidateId: targetParentCandId,
        parentProposalItemId,
        parentItemUid: r.candidate.parentItemUid || (targetParentCandId ? validatedReconciled.find(v => v.candidateId === targetParentCandId)?.existingItemUid : undefined),
        relationshipStatus: r.candidate.relationshipStatus || 'CONFIRMED',
        description: fullContent,
        sourceContent: fullContent,
        inferred: r.candidate.inferred || false,
        confidence: r.candidate.confidence || 1.0,
        inferenceStatus: r.candidate.inferenceStatus || 'SOURCE_FACT',
        needsReview: r.candidate.needsReview || (r.candidate.relationshipStatus === 'NEEDS_REVIEW'),
        sourceReference: r.candidate.sourceReference,
        sourceEvidence: r.candidate.sourceEvidence,
        evidence: r.candidate.evidence
      })

      proposalItems.push({
        proposalItemId: r.candidate.proposalItemId || `P001-I${proposalItems.length + 1}`,
        candidateId: r.candidateId,
        action: 'CREATE',
        itemType: r.candidate.canonicalType,
        itemTitle: r.candidate.title,
        sourceLabel: r.candidate.sourceLabel,
        itemPriority: r.candidate.priority || 'Middle',
        assigneeUid: r.candidate.assigneeUid,
        assigneeId: r.candidate.assigneeUid,
        assigneeName: r.candidate.assigneeName,
        parentCandidateId: targetParentCandId,
        parentProposalItemId,
        parentItemUid: r.candidate.parentItemUid || (targetParentCandId ? validatedReconciled.find(v => v.candidateId === targetParentCandId)?.existingItemUid : undefined),
        relationshipStatus: r.candidate.relationshipStatus || 'CONFIRMED',
        description: fullContent,
        sourceContent: fullContent,
        confidence: r.candidate.confidence || 1.0,
        inferenceStatus: r.candidate.inferenceStatus || 'SOURCE_FACT',
        needsReview: r.candidate.needsReview || (r.candidate.relationshipStatus === 'NEEDS_REVIEW'),
        reviewStatus: r.candidate.needsReview ? 'NEEDS_REVIEW' : 'CONFIRMED',
        sourceReference: r.candidate.sourceReference,
        sourceEvidence: r.candidate.sourceEvidence,
        evidence: r.candidate.evidence,
        reason: r.reason
      })
    } else if (r.action === 'UPDATE') {
      proposal.updates.push({
        candidateId: r.candidateId,
        proposalItemId: r.candidate.proposalItemId,
        evidenceId: r.candidate.evidenceId,
        targetItemUid: r.existingItemUid,
        targetDisplayCode: r.existingDisplayCode,
        itemTitle: r.candidate.title,
        fieldDiffs: r.fieldDiffs,
        evidenceRefs: r.candidate.evidenceId ? [r.candidate.evidenceId] : [],
        updates: r.changes || {},
        summary: r.reason,
        reason: r.reason
      })

      proposalItems.push({
        proposalItemId: r.candidate.proposalItemId || `P001-I${proposalItems.length + 1}`,
        candidateId: r.candidateId,
        action: 'UPDATE',
        itemType: r.candidate.canonicalType,
        itemTitle: r.candidate.title,
        existingItemId: r.existingItemUid,
        existingDisplayCode: r.existingDisplayCode,
        fieldDiffs: r.fieldDiffs,
        evidenceRefs: r.candidate.evidenceId ? [r.candidate.evidenceId] : [],
        itemPriority: r.candidate.priority || 'Middle',
        confidence: r.confidence || 0.95,
        reviewStatus: 'CONFIRMED',
        sourceReference: r.candidate.sourceReference,
        sourceEvidence: r.candidate.sourceEvidence,
        evidence: r.candidate.evidence,
        reason: r.reason
      })
    } else if (r.action === 'CORRECTION') {
      proposal.corrections = proposal.corrections || []
      proposal.corrections.push({
        candidateId: r.candidateId,
        proposalItemId: r.candidate.proposalItemId,
        evidenceId: r.candidate.evidenceId,
        targetItemUid: r.existingItemUid,
        targetDisplayCode: r.existingDisplayCode,
        itemTitle: r.candidate.title,
        fieldDiffs: r.fieldDiffs,
        evidenceRefs: r.candidate.evidenceId ? [r.candidate.evidenceId] : [],
        updates: r.changes || {},
        summary: r.reason,
        reason: r.reason
      })

      proposalItems.push({
        proposalItemId: r.candidate.proposalItemId || `P001-I${proposalItems.length + 1}`,
        candidateId: r.candidateId,
        action: 'CORRECTION',
        itemType: r.candidate.canonicalType,
        itemTitle: r.candidate.title,
        existingItemId: r.existingItemUid,
        existingDisplayCode: r.existingDisplayCode,
        fieldDiffs: r.fieldDiffs,
        evidenceRefs: r.candidate.evidenceId ? [r.candidate.evidenceId] : [],
        itemPriority: r.candidate.priority || 'Middle',
        confidence: r.confidence || 0.95,
        reviewStatus: 'NEEDS_REVIEW',
        sourceReference: r.candidate.sourceReference,
        sourceEvidence: r.candidate.sourceEvidence,
        evidence: r.candidate.evidence,
        reason: r.reason
      })
    } else if (r.action === 'NO_CHANGE') {
      proposal.noChanges.push({
        candidateId: r.candidateId,
        proposalItemId: r.candidate.proposalItemId,
        evidenceId: r.candidate.evidenceId,
        existingItemUid: r.existingItemUid,
        existingDisplayCode: r.existingDisplayCode,
        fieldDiffs: r.fieldDiffs,
        reason: r.reason
      })

      proposalItems.push({
        proposalItemId: r.candidate.proposalItemId || `P001-I${proposalItems.length + 1}`,
        candidateId: r.candidateId,
        action: 'NO_CHANGE',
        itemType: r.candidate.canonicalType,
        itemTitle: r.candidate.title,
        existingItemId: r.existingItemUid,
        existingDisplayCode: r.existingDisplayCode,
        fieldDiffs: [],
        itemPriority: r.candidate.priority || 'Middle',
        confidence: 1.0,
        reviewStatus: 'CONFIRMED',
        sourceReference: r.candidate.sourceReference,
        sourceEvidence: r.candidate.sourceEvidence,
        evidence: r.candidate.evidence,
        reason: r.reason
      })
    } else if (r.action === 'NEEDS_REVIEW') {
      proposal.reviewRequired.push({
        candidateId: r.candidateId,
        proposalItemId: r.candidate.proposalItemId,
        evidenceId: r.candidate.evidenceId,
        candidate: r.candidate,
        possibleMatches: r.possibleMatches,
        reason: r.reason
      })

      proposalItems.push({
        proposalItemId: r.candidate.proposalItemId || `P001-I${proposalItems.length + 1}`,
        candidateId: r.candidateId,
        action: 'NEEDS_REVIEW',
        itemType: r.candidate.canonicalType,
        itemTitle: r.candidate.title,
        existingItemId: r.existingItemUid,
        existingDisplayCode: r.existingDisplayCode,
        itemPriority: r.candidate.priority || 'Middle',
        confidence: r.confidence || 0.6,
        needsReview: true,
        reviewStatus: 'NEEDS_REVIEW',
        sourceReference: r.candidate.sourceReference,
        sourceEvidence: r.candidate.sourceEvidence,
        evidence: r.candidate.evidence,
        reason: r.reason
      })
    } else if (r.action === 'CONFLICT') {
      proposal.conflicts = proposal.conflicts || []
      proposal.conflicts.push({
        candidateId: r.candidateId,
        proposalItemId: r.candidate.proposalItemId,
        evidenceId: r.candidate.evidenceId,
        candidate: r.candidate,
        conflictingItemUid: r.existingItemUid,
        conflictingDisplayCode: r.existingDisplayCode,
        fieldDiffs: r.fieldDiffs,
        reason: r.reason
      })

      proposalItems.push({
        proposalItemId: r.candidate.proposalItemId || `P001-I${proposalItems.length + 1}`,
        candidateId: r.candidateId,
        action: 'CONFLICT',
        itemType: r.candidate.canonicalType,
        itemTitle: r.candidate.title,
        existingItemId: r.existingItemUid,
        existingDisplayCode: r.existingDisplayCode,
        fieldDiffs: r.fieldDiffs,
        itemPriority: r.candidate.priority || 'Middle',
        confidence: 0.9,
        reviewStatus: 'CONFLICT',
        sourceReference: r.candidate.sourceReference,
        sourceEvidence: r.candidate.sourceEvidence,
        evidence: r.candidate.evidence,
        reason: r.reason
      })
    } else if (r.action === 'IGNORE') {
      proposal.ignored.push({
        candidateId: r.candidateId,
        proposalItemId: r.candidate.proposalItemId,
        evidenceId: r.candidate.evidenceId,
        reason: r.reason
      })
    }
  }

  // 計算匯總統計指標 (Summary Statistics)
  proposal.summaryStats = {
    total: candidateList.length,
    creates: proposal.creates.length,
    created: proposal.creates.length,
    updates: proposal.updates.length,
    updated: proposal.updates.length,
    corrections: (proposal.corrections || []).length,
    corrected: (proposal.corrections || []).length,
    noChanges: proposal.noChanges.length,
    noChange: proposal.noChanges.length,
    reviewRequired: proposal.reviewRequired.length,
    needsReview: proposal.reviewRequired.length,
    conflicts: (proposal.conflicts || []).length,
    conflict: (proposal.conflicts || []).length
  }

  // 硬性基數守恆防線
  const totalOutcomes = proposal.creates.length + proposal.updates.length + (proposal.corrections || []).length + proposal.noChanges.length + proposal.reviewRequired.length + (proposal.conflicts || []).length + proposal.ignored.length
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
