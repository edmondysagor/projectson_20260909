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
import { validateAndPlanTopology, validateCanonicalProposal, computeProposalHash } from './graphValidator.js'
import { ProjectItemMemory } from './memoryRetriever.js'
import { extractSourceLedgerFromText, extractCommitmentStatus, determineEvidenceType } from './sourceLedgerExtractor.js'
import { extractDocumentMetadata } from './documentNormalizer.js'
import { registerAuthoritativeProposal } from './proposalRegistry.js'

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

  // 若無直接實質項目文字提取（或僅有 1 個 Meeting 標頭工單），則從 rawPreviews 與 subAgentItems 收集
  const hasOnlyMeeting = candidateList.length === 1 && candidateList[0].canonicalType === 'Meeting'
  if (candidateList.length === 0 || hasOnlyMeeting) {
    let candIdx = candidateList.length
    const incomingItems: any[] = []
    for (const prev of rawPreviews) {
      if (prev.actionType === 'batch_proposal' && Array.isArray(prev.items)) {
        incomingItems.push(...prev.items)
      } else if (prev.actionType === 'create_item') {
        incomingItems.push(prev)
      } else if (prev.actionType === 'consensus_proposal') {
        incomingItems.push({
          candidateId: `CAND-CONSENSUS-${Date.now()}`,
          proposalItemId: `P001-I${String(candIdx + 1).padStart(2, '0')}`,
          itemTitle: prev.itemTitle || prev.title,
          itemType: 'Decision',
          itemPriority: 'High',
          description: `【決策內容 (Consensus Statement)】：${prev.statement || ''}\n\n【權衡與理由 (Rationale)】：${prev.rationale || '經對話共識定案'}`,
          statement: prev.statement,
          rationale: prev.rationale
        })
      }
    }
    for (const sub of subAgentItems) {
      if (sub.itemsToCreate && Array.isArray(sub.itemsToCreate)) {
        incomingItems.push(...sub.itemsToCreate)
      }
    }

    const candIdMap = new Map<string, string>()
    const existingMeeting = candidateList.find(c => c.canonicalType === 'Meeting')

    for (const item of incomingItems) {
      const rawTitle = item.itemTitle || item.title || ''
      if (isJunkHeadingOrPreamble(rawTitle)) {
        continue
      }

      const itemType = item.itemType || item.canonicalType || 'Task'
      // 會議工單聚合：若已有源頭核心 Meeting 工單，子專家產生的額外會議工單自動合流，絕不重複建立
      if (itemType === 'Meeting' && existingMeeting) {
        if (item.description && !existingMeeting.summary) {
          existingMeeting.summary = item.description.slice(0, 500)
        }
        continue
      }

      // 保證 Candidate ID 全域唯一，避免多個子專家產出 CAND-01 碰撞
      const candId = `CAND-${String(candIdx + 1).padStart(3, '0')}`
      if (item.candidateId) {
        candIdMap.set(item.candidateId, candId)
      }
      const propId = `P001-I${String(candIdx + 1).padStart(2, '0')}`
      const evId = `EV-${String(candIdx + 1).padStart(3, '0')}`

      // 解析映射後的 parentCandidateId
      let resolvedParentCandidateId = item.parentCandidateId || item.targetCandidateId
      if (resolvedParentCandidateId && candIdMap.has(resolvedParentCandidateId)) {
        resolvedParentCandidateId = candIdMap.get(resolvedParentCandidateId)
      }

      const normalized = normalizeCandidate({
        candidateId: candId,
        proposalItemId: propId,
        evidenceId: evId,
        rawType: itemType,
        title: rawTitle,
        sourceLabel: item.sourceLabel || item.sourceIdentifier,
        description: item.description || (item.item_content?.text || item.item_content?.description || ''),
        priority: item.itemPriority || item.priority || undefined,
        assigneeName: item.itemFollowBy || item.assigneeName,
        parentCandidateId: resolvedParentCandidateId,
        parentRef: item.parentItemUid || item.parentRef,
        sectionTitle: item.sectionTitle,
        sourceEvidence: item.sourceEvidence || {
          evidenceId: evId,
          sourceDocumentId: metadata.documentId,
          sourceDocumentHash: metadata.documentHash,
          sourceType: 'explicit',
          sourceSection: item.sectionTitle || 'General',
          sourceLabel: item.sourceLabel || 'Item',
          sourceText: metadata.normalizedContent || text || '',
          extractedFact: rawTitle,
          candidateType: itemType,
          commitmentStatus: extractCommitmentStatus(rawTitle + ' ' + (item.description || '')),
          evidenceType: determineEvidenceType(itemType, rawTitle + ' ' + (item.description || '')),
          confidence: 1.0,
          inferenceStatus: 'SOURCE_FACT',
          excerpt: rawTitle
        }
      }, candIdx)

      // 解決負責人姓名到 UID 的映射 (僅限 Task)
      if (normalized.assigneeName && members.length > 0 && normalized.canonicalType === 'Task') {
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

    // 第二輪重連：若有前向引用之 parentCandidateId，依照 candIdMap 補正
    for (const c of candidateList) {
      if (c.parentCandidateId && candIdMap.has(c.parentCandidateId)) {
        c.parentCandidateId = candIdMap.get(c.parentCandidateId)
      }
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

  // 3.1 跨提案單一目標約束 (One Candidate -> One Existing Target & Collision Detection)
  // 嚴格落實 Invariant B: 一張既有工單在同一對齊提案中，嚴禁被多個不同候選項目鎖定覆寫
  const targetMap = new Map<string, ReconciledCandidate[]>()
  for (const r of reconciledList) {
    if (r.existingItemUid && ['UPDATE', 'CORRECTION', 'NO_CHANGE'].includes(r.action)) {
      const list = targetMap.get(r.existingItemUid) || []
      list.push(r)
      targetMap.set(r.existingItemUid, list)
    }
  }

  for (const [targetUid, competing] of targetMap.entries()) {
    if (competing.length > 1) {
      // 偵測到 MATCH_COLLISION
      const exactMatches = competing.filter(c => {
        const candTitleNorm = c.candidate.title.trim().toLowerCase()
        const existingItem = existingItems.find(it => it.item_uid === targetUid)
        const existingTitleNorm = (existingItem?.item_title || '').trim().toLowerCase()
        const existingCodeNorm = (existingItem?.item_display_code || '').trim().toLowerCase()
        return candTitleNorm === existingTitleNorm || (c.candidate.sourceLabel && c.candidate.sourceLabel.trim().toLowerCase() === existingCodeNorm)
      })

      if (exactMatches.length === 1) {
        // 唯獨 exactMatches[0] 擁有確切決定性身份證據
        // 其餘競爭者判定為衝突碰撞，標記為 NEEDS_REVIEW
        for (const nonExact of competing) {
          if (nonExact !== exactMatches[0]) {
            nonExact.action = 'NEEDS_REVIEW'
            nonExact.matchStatus = 'CONFLICT'
            nonExact.reviewStatus = 'NEEDS_REVIEW'
            nonExact.fieldDiffs = []
            nonExact.changes = {}
            nonExact.reason = `MATCH_COLLISION: 既有工單 [${nonExact.existingDisplayCode || targetUid}] 已有確切匹配候選項目 [${exactMatches[0].candidateId}]「${exactMatches[0].candidate.title}」，候選項目 [${nonExact.candidateId}]「${nonExact.candidate.title}」存在衝突碰撞，退回人工審查。`
          }
        }
      } else {
        // 多個項目均為模糊匹配或爭奪同一工單 ➔ 嚴禁覆寫既有記錄，全部標記為 NEEDS_REVIEW
        for (const item of competing) {
          item.action = 'NEEDS_REVIEW'
          item.matchStatus = 'CONFLICT'
          item.reviewStatus = 'NEEDS_REVIEW'
          item.fieldDiffs = []
          item.changes = {}
          item.reason = `MATCH_COLLISION: 檢測到 ${competing.length} 個候選項目 (${competing.map(c => c.candidateId).join(', ')}) 同時鎖定既有工單 [${item.existingDisplayCode || targetUid}]，依據架構不變量嚴禁靜默覆寫，標記為 NEEDS_REVIEW。`
        }
      }
    }
  }

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
    const meetingSummary = isMeeting ? (metadata.meetingObjective || metadata.summary || r.candidate.summary) : r.candidate.summary

    const hasExplicitEvidence = Boolean(
      r.candidate.classification === 'EXPLICIT' ||
      (r.candidate.evidenceId && r.candidate.evidenceId.length > 0) ||
      (r.candidate.evidenceIds && r.candidate.evidenceIds.length > 0) ||
      (r.candidate.sourceEvidence && r.candidate.sourceEvidence.sourceType === 'explicit')
    )
    const isInferred = Boolean(
      r.candidate.inferred || 
      r.candidate.classification === 'INFERRED' || 
      r.candidate.classification === 'SUGGESTED' || 
      r.candidate.inferenceStatus === 'INFERENCE' ||
      !hasExplicitEvidence
    )

    if (r.action === 'CREATE') {
      const parentRel = relationships.find(rel => 
        (rel.childCandidateId === r.candidateId || rel.fromProposalItemId === r.candidate.proposalItemId) && 
        (rel.relationshipType === 'parent_child' || rel.relationshipType === 'mitigates')
      )
      const targetParentCandId = parentRel ? parentRel.parentCandidateId : r.candidate.parentCandidateId
      const parentCand = targetParentCandId ? candidateList.find(c => c.candidateId === targetParentCandId) : undefined
      const parentProposalItemId = parentCand?.proposalItemId || parentRel?.toProposalItemId || (targetParentCandId?.startsWith('P001-') ? targetParentCandId : undefined)
      const parentProposalNodeId = parentCand?.proposalNodeId || parentRel?.toProposalNodeId || r.candidate.parentProposalNodeId

      const isUuid = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str))
      const targetParentExistingUid = targetParentCandId ? validatedReconciled.find(v => v.candidateId === targetParentCandId)?.existingItemUid : undefined
      const resolvedParentItemUid = (r.candidate.parentItemUid && isUuid(r.candidate.parentItemUid))
        ? r.candidate.parentItemUid
        : (targetParentExistingUid && isUuid(targetParentExistingUid) ? targetParentExistingUid : undefined)

      // 會議關聯建立：自動為 Meeting 工單注入 discusses 關聯指向同批次所有業務項目
      let meetingRelations: Array<{ targetProposalNodeId?: string; targetProposalItemId?: string; relation: string }> | undefined = undefined
      if (isMeeting) {
        meetingRelations = validatedReconciled
          .filter(other => other.candidate.canonicalType !== 'Meeting')
          .map(other => ({
            targetProposalNodeId: other.candidate.proposalNodeId || other.candidate.proposalItemId || other.candidate.candidateId,
            targetProposalItemId: other.candidate.proposalItemId || other.candidate.candidateId,
            relation: 'discusses'
          }))
      }

      if (isInferred) {
        // 推斷項目 (Inferred Item) 嚴格隔離於 proposal.suggestedItems / reviewRequired，絕不自動進入 creates
        proposal.suggestedItems = proposal.suggestedItems || []
        proposal.suggestedItems.push({
          proposalItemId: r.candidate.proposalItemId || `P001-I${proposalItems.length + 1}`,
          proposalNodeId: r.candidate.proposalNodeId,
          candidateId: r.candidateId,
          action: 'NEEDS_REVIEW',
          itemType: r.candidate.canonicalType,
          itemTitle: r.candidate.title,
          sourceLabel: r.candidate.sourceLabel,
          sourceIdentifier: r.candidate.sourceIdentifier || r.candidate.sourceLabel,
          sourceIdentifiers: r.candidate.sourceIdentifiers || (r.candidate.sourceLabel ? [r.candidate.sourceLabel] : []),
          itemPriority: r.candidate.priority || 'Middle',
          itemFollowBy: r.candidate.assigneeUid || undefined,
          assigneeUid: r.candidate.assigneeUid,
          assigneeId: r.candidate.assigneeUid,
          assigneeName: r.candidate.assigneeName,
          parentCandidateId: targetParentCandId,
          parentProposalItemId,
          parentProposalNodeId,
          parentItemUid: resolvedParentItemUid,
          relationshipStatus: 'NEEDS_REVIEW',
          relations: meetingRelations,
          description: fullContent,
          sourceContent: fullContent,
          summary: meetingSummary,
          classification: 'INFERRED',
          inferred: true,
          confidence: r.candidate.confidence || 0.6,
          inferenceStatus: 'INFERENCE',
          needsReview: true,
          reviewStatus: 'NEEDS_REVIEW',
          applied: false,
          sourceReference: r.candidate.sourceReference,
          sourceEvidence: r.candidate.sourceEvidence,
          evidence: r.candidate.evidence,
          reason: r.reason || 'AI-inferred item based on template expectation. Requires explicit human review before creating.'
        })

        proposal.reviewRequired.push({
          candidateId: r.candidateId,
          proposalItemId: r.candidate.proposalItemId,
          proposalNodeId: r.candidate.proposalNodeId,
          evidenceId: r.candidate.evidenceId,
          evidenceIds: r.candidate.evidenceIds,
          sourceLabel: r.candidate.sourceLabel,
          sourceIdentifier: r.candidate.sourceIdentifier || r.candidate.sourceLabel,
          sourceIdentifiers: r.candidate.sourceIdentifiers || (r.candidate.sourceLabel ? [r.candidate.sourceLabel] : []),
          candidate: { ...r.candidate, classification: 'INFERRED', inferred: true, needsReview: true },
          classification: 'INFERRED',
          needsReview: true,
          applied: false,
          reason: r.reason || 'AI-inferred item based on template expectation. Requires explicit human review before creating.'
        })

        proposalItems.push({
          proposalItemId: r.candidate.proposalItemId || `P001-I${proposalItems.length + 1}`,
          proposalNodeId: r.candidate.proposalNodeId,
          candidateId: r.candidateId,
          action: 'NEEDS_REVIEW',
          itemType: r.candidate.canonicalType,
          itemTitle: r.candidate.title,
          sourceLabel: r.candidate.sourceLabel,
          sourceIdentifier: r.candidate.sourceIdentifier || r.candidate.sourceLabel,
          sourceIdentifiers: r.candidate.sourceIdentifiers || (r.candidate.sourceLabel ? [r.candidate.sourceLabel] : []),
          itemPriority: r.candidate.priority || 'Middle',
          itemFollowBy: r.candidate.assigneeUid || undefined,
          assigneeUid: r.candidate.assigneeUid,
          assigneeId: r.candidate.assigneeUid,
          assigneeName: r.candidate.assigneeName,
          parentCandidateId: targetParentCandId,
          parentProposalItemId,
          parentProposalNodeId,
          parentItemUid: resolvedParentItemUid,
          relationshipStatus: 'NEEDS_REVIEW',
          relations: meetingRelations,
          description: fullContent,
          sourceContent: fullContent,
          summary: meetingSummary,
          classification: 'INFERRED',
          inferred: true,
          confidence: r.candidate.confidence || 0.6,
          inferenceStatus: 'INFERENCE',
          needsReview: true,
          reviewStatus: 'NEEDS_REVIEW',
          applied: false,
          sourceReference: r.candidate.sourceReference,
          sourceEvidence: r.candidate.sourceEvidence,
          evidence: r.candidate.evidence,
          reason: r.reason || 'AI-inferred item based on template expectation. Requires explicit human review before creating.'
        })
      } else {
        proposal.creates.push({
          candidateId: r.candidateId,
          proposalItemId: r.candidate.proposalItemId,
          proposalNodeId: r.candidate.proposalNodeId,
          evidenceId: r.candidate.evidenceId,
          evidenceIds: r.candidate.evidenceIds || (r.candidate.evidenceId ? [r.candidate.evidenceId] : []),
          evidenceType: r.candidate.evidenceType || 'SOURCE_FACT',
          commitmentStatus: r.candidate.commitmentStatus || 'CONFIRMED',
          itemTitle: r.candidate.title,
          sourceLabel: r.candidate.sourceLabel,
          sourceIdentifier: r.candidate.sourceIdentifier || r.candidate.sourceLabel,
          sourceIdentifiers: r.candidate.sourceIdentifiers || (r.candidate.sourceLabel ? [r.candidate.sourceLabel] : []),
          itemType: r.candidate.canonicalType,
          itemPriority: r.candidate.priority || 'Middle',
          itemFollowBy: r.candidate.assigneeUid || undefined,
          assigneeUid: r.candidate.assigneeUid,
          assigneeId: r.candidate.assigneeUid,
          assigneeName: r.candidate.assigneeName,
          mentionedParticipants: r.candidate.mentionedParticipants,
          parentCandidateId: targetParentCandId,
          parentProposalItemId,
          parentProposalNodeId,
          parentItemUid: resolvedParentItemUid,
          relationshipStatus: r.candidate.relationshipStatus || 'CONFIRMED',
          relations: meetingRelations,
          description: fullContent,
          decisionRationale: r.candidate.decisionRationale,
          isFuturePhase: r.candidate.isFuturePhase,
          sourceContent: fullContent,
          summary: meetingSummary,
          classification: 'EXPLICIT',
          inferred: false,
          confidence: r.candidate.confidence || 1.0,
          inferenceStatus: r.candidate.inferenceStatus || 'SOURCE_FACT',
          needsReview: r.candidate.needsReview || (r.candidate.relationshipStatus === 'NEEDS_REVIEW'),
          applied: false,
          sourceReference: r.candidate.sourceReference,
          sourceEvidence: r.candidate.sourceEvidence,
          evidence: r.candidate.evidence
        })

        proposalItems.push({
          proposalItemId: r.candidate.proposalItemId || `P001-I${proposalItems.length + 1}`,
          proposalNodeId: r.candidate.proposalNodeId,
          candidateId: r.candidateId,
          action: 'CREATE',
          itemType: r.candidate.canonicalType,
          itemTitle: r.candidate.title,
          sourceLabel: r.candidate.sourceLabel,
          sourceIdentifier: r.candidate.sourceIdentifier || r.candidate.sourceLabel,
          sourceIdentifiers: r.candidate.sourceIdentifiers || (r.candidate.sourceLabel ? [r.candidate.sourceLabel] : []),
          evidenceType: r.candidate.evidenceType || 'SOURCE_FACT',
          commitmentStatus: r.candidate.commitmentStatus || 'CONFIRMED',
          itemPriority: r.candidate.priority || 'Middle',
          itemFollowBy: r.candidate.assigneeUid || undefined,
          assigneeUid: r.candidate.assigneeUid,
          assigneeId: r.candidate.assigneeUid,
          assigneeName: r.candidate.assigneeName,
          mentionedParticipants: r.candidate.mentionedParticipants,
          parentCandidateId: targetParentCandId,
          parentProposalItemId,
          parentProposalNodeId,
          parentItemUid: resolvedParentItemUid,
          relationshipStatus: r.candidate.relationshipStatus || 'CONFIRMED',
          relations: meetingRelations,
          description: fullContent,
          decisionRationale: r.candidate.decisionRationale,
          isFuturePhase: r.candidate.isFuturePhase,
          sourceContent: fullContent,
          summary: meetingSummary,
          classification: 'EXPLICIT',
          confidence: r.candidate.confidence || 1.0,
          inferenceStatus: r.candidate.inferenceStatus || 'SOURCE_FACT',
          needsReview: r.candidate.needsReview || (r.candidate.relationshipStatus === 'NEEDS_REVIEW'),
          reviewStatus: r.candidate.needsReview ? 'NEEDS_REVIEW' : 'CONFIRMED',
          applied: false,
          sourceReference: r.candidate.sourceReference,
          sourceEvidence: r.candidate.sourceEvidence,
          evidence: r.candidate.evidence,
          reason: r.reason
        })
      }
    } else if (r.action === 'UPDATE') {
      proposal.updates.push({
        candidateId: r.candidateId,
        proposalItemId: r.candidate.proposalItemId,
        proposalNodeId: r.candidate.proposalNodeId,
        evidenceId: r.candidate.evidenceId,
        evidenceIds: r.candidate.evidenceIds || (r.candidate.evidenceId ? [r.candidate.evidenceId] : []),
        targetItemUid: r.existingItemUid,
        targetDisplayCode: r.existingDisplayCode,
        itemTitle: r.candidate.title,
        sourceLabel: r.candidate.sourceLabel,
        sourceIdentifier: r.candidate.sourceIdentifier || r.candidate.sourceLabel,
        sourceIdentifiers: r.candidate.sourceIdentifiers || (r.candidate.sourceLabel ? [r.candidate.sourceLabel] : []),
        fieldDiffs: r.fieldDiffs,
        evidenceRefs: r.candidate.evidenceId ? [r.candidate.evidenceId] : [],
        updates: r.changes || {},
        classification: r.candidate.classification || 'EXPLICIT',
        applied: false,
        summary: r.reason,
        reason: r.reason
      })

      proposalItems.push({
        proposalItemId: r.candidate.proposalItemId || `P001-I${proposalItems.length + 1}`,
        proposalNodeId: r.candidate.proposalNodeId,
        candidateId: r.candidateId,
        action: 'UPDATE',
        itemType: r.candidate.canonicalType,
        itemTitle: r.candidate.title,
        sourceLabel: r.candidate.sourceLabel,
        sourceIdentifier: r.candidate.sourceIdentifier || r.candidate.sourceLabel,
        sourceIdentifiers: r.candidate.sourceIdentifiers || (r.candidate.sourceLabel ? [r.candidate.sourceLabel] : []),
        existingItemId: r.existingItemUid,
        existingDisplayCode: r.existingDisplayCode,
        fieldDiffs: r.fieldDiffs,
        evidenceRefs: r.candidate.evidenceId ? [r.candidate.evidenceId] : [],
        itemPriority: r.changes?.itemPriority || (existingItems.find(it => it.item_uid === r.existingItemUid)?.item_priority) || r.candidate.priority || 'Middle',
        classification: r.candidate.classification || 'EXPLICIT',
        confidence: r.confidence || 0.95,
        reviewStatus: 'CONFIRMED',
        applied: false,
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
        proposalNodeId: r.candidate.proposalNodeId,
        evidenceId: r.candidate.evidenceId,
        evidenceIds: r.candidate.evidenceIds || (r.candidate.evidenceId ? [r.candidate.evidenceId] : []),
        targetItemUid: r.existingItemUid,
        targetDisplayCode: r.existingDisplayCode,
        itemTitle: r.candidate.title,
        sourceLabel: r.candidate.sourceLabel,
        sourceIdentifier: r.candidate.sourceIdentifier || r.candidate.sourceLabel,
        sourceIdentifiers: r.candidate.sourceIdentifiers || (r.candidate.sourceLabel ? [r.candidate.sourceLabel] : []),
        fieldDiffs: r.fieldDiffs,
        evidenceRefs: r.candidate.evidenceId ? [r.candidate.evidenceId] : [],
        updates: r.changes || {},
        classification: r.candidate.classification || 'EXPLICIT',
        applied: false,
        summary: r.reason,
        reason: r.reason
      })

      proposalItems.push({
        proposalItemId: r.candidate.proposalItemId || `P001-I${proposalItems.length + 1}`,
        proposalNodeId: r.candidate.proposalNodeId,
        candidateId: r.candidateId,
        action: 'CORRECTION',
        itemType: r.candidate.canonicalType,
        itemTitle: r.candidate.title,
        sourceLabel: r.candidate.sourceLabel,
        sourceIdentifier: r.candidate.sourceIdentifier || r.candidate.sourceLabel,
        sourceIdentifiers: r.candidate.sourceIdentifiers || (r.candidate.sourceLabel ? [r.candidate.sourceLabel] : []),
        existingItemId: r.existingItemUid,
        existingDisplayCode: r.existingDisplayCode,
        fieldDiffs: r.fieldDiffs,
        evidenceRefs: r.candidate.evidenceId ? [r.candidate.evidenceId] : [],
        itemPriority: r.candidate.priority || 'Middle',
        classification: r.candidate.classification || 'EXPLICIT',
        confidence: r.confidence || 0.95,
        reviewStatus: 'NEEDS_REVIEW',
        applied: false,
        sourceReference: r.candidate.sourceReference,
        sourceEvidence: r.candidate.sourceEvidence,
        evidence: r.candidate.evidence,
        reason: r.reason
      })
    } else if (r.action === 'NO_CHANGE') {
      proposal.noChanges.push({
        candidateId: r.candidateId,
        proposalItemId: r.candidate.proposalItemId,
        proposalNodeId: r.candidate.proposalNodeId,
        evidenceId: r.candidate.evidenceId,
        evidenceIds: r.candidate.evidenceIds || (r.candidate.evidenceId ? [r.candidate.evidenceId] : []),
        existingItemUid: r.existingItemUid,
        existingDisplayCode: r.existingDisplayCode,
        sourceLabel: r.candidate.sourceLabel,
        sourceIdentifier: r.candidate.sourceIdentifier || r.candidate.sourceLabel,
        sourceIdentifiers: r.candidate.sourceIdentifiers || (r.candidate.sourceLabel ? [r.candidate.sourceLabel] : []),
        fieldDiffs: r.fieldDiffs,
        classification: r.candidate.classification || 'EXPLICIT',
        reason: r.reason
      })

      proposalItems.push({
        proposalItemId: r.candidate.proposalItemId || `P001-I${proposalItems.length + 1}`,
        proposalNodeId: r.candidate.proposalNodeId,
        candidateId: r.candidateId,
        action: 'NO_CHANGE',
        itemType: r.candidate.canonicalType,
        itemTitle: r.candidate.title,
        sourceLabel: r.candidate.sourceLabel,
        sourceIdentifier: r.candidate.sourceIdentifier || r.candidate.sourceLabel,
        sourceIdentifiers: r.candidate.sourceIdentifiers || (r.candidate.sourceLabel ? [r.candidate.sourceLabel] : []),
        existingItemId: r.existingItemUid,
        existingDisplayCode: r.existingDisplayCode,
        fieldDiffs: [],
        itemPriority: r.candidate.priority || 'Middle',
        confidence: 1.0,
        reviewStatus: 'CONFIRMED',
        applied: false,
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
        evidenceIds: r.candidate.evidenceIds || (r.candidate.evidenceId ? [r.candidate.evidenceId] : []),
        candidate: r.candidate,
        sourceLabel: r.candidate.sourceLabel,
        sourceIdentifier: r.candidate.sourceIdentifier || r.candidate.sourceLabel,
        sourceIdentifiers: r.candidate.sourceIdentifiers || (r.candidate.sourceLabel ? [r.candidate.sourceLabel] : []),
        possibleMatches: r.possibleMatches,
        classification: r.candidate.classification || (isInferred ? 'INFERRED' : 'EXPLICIT'),
        needsReview: true,
        applied: false,
        reason: r.reason
      })

      proposalItems.push({
        proposalItemId: r.candidate.proposalItemId || `P001-I${proposalItems.length + 1}`,
        candidateId: r.candidateId,
        action: 'NEEDS_REVIEW',
        itemType: r.candidate.canonicalType,
        itemTitle: r.candidate.title,
        sourceLabel: r.candidate.sourceLabel,
        sourceIdentifier: r.candidate.sourceIdentifier || r.candidate.sourceLabel,
        sourceIdentifiers: r.candidate.sourceIdentifiers || (r.candidate.sourceLabel ? [r.candidate.sourceLabel] : []),
        existingItemId: r.existingItemUid,
        existingDisplayCode: r.existingDisplayCode,
        itemPriority: r.candidate.priority || 'Middle',
        confidence: r.confidence || 0.6,
        needsReview: true,
        reviewStatus: 'NEEDS_REVIEW',
        applied: false,
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
        evidenceIds: r.candidate.evidenceIds || (r.candidate.evidenceId ? [r.candidate.evidenceId] : []),
        candidate: r.candidate,
        sourceLabel: r.candidate.sourceLabel,
        sourceIdentifier: r.candidate.sourceIdentifier || r.candidate.sourceLabel,
        sourceIdentifiers: r.candidate.sourceIdentifiers || (r.candidate.sourceLabel ? [r.candidate.sourceLabel] : []),
        conflictingItemUid: r.existingItemUid,
        conflictingDisplayCode: r.existingDisplayCode,
        fieldDiffs: r.fieldDiffs,
        classification: r.candidate.classification || 'EXPLICIT',
        reason: r.reason
      })

      proposalItems.push({
        proposalItemId: r.candidate.proposalItemId || `P001-I${proposalItems.length + 1}`,
        candidateId: r.candidateId,
        action: 'CONFLICT',
        itemType: r.candidate.canonicalType,
        itemTitle: r.candidate.title,
        sourceLabel: r.candidate.sourceLabel,
        sourceIdentifier: r.candidate.sourceIdentifier || r.candidate.sourceLabel,
        sourceIdentifiers: r.candidate.sourceIdentifiers || (r.candidate.sourceLabel ? [r.candidate.sourceLabel] : []),
        existingItemId: r.existingItemUid,
        existingDisplayCode: r.existingDisplayCode,
        fieldDiffs: r.fieldDiffs,
        itemPriority: r.candidate.priority || 'Middle',
        confidence: 0.9,
        reviewStatus: 'CONFLICT',
        applied: false,
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
        evidenceIds: r.candidate.evidenceIds || (r.candidate.evidenceId ? [r.candidate.evidenceId] : []),
        sourceLabel: r.candidate.sourceLabel,
        sourceIdentifier: r.candidate.sourceIdentifier || r.candidate.sourceLabel,
        sourceIdentifiers: r.candidate.sourceIdentifiers || (r.candidate.sourceLabel ? [r.candidate.sourceLabel] : []),
        reason: r.reason
      })
    }
  }

  // 7. Proposal Validation Gate (提案完整性與來源證據門禁)
  const isUuid = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str))

  for (const create of proposal.creates) {
    const hasEvidence = Boolean(
      create.evidenceId || 
      (create.evidenceIds && create.evidenceIds.length > 0) || 
      create.sourceEvidence || 
      (create.evidence && create.evidence.length > 0)
    )
    const isCreateInferred = Boolean(
      create.inferred || 
      create.classification === 'INFERRED' || 
      create.classification === 'SUGGESTED' || 
      create.inferenceStatus === 'INFERENCE' ||
      !hasEvidence
    )

    if (isCreateInferred) {
      validation.status = 'FAIL'
      validation.errors.push({
        code: 'E002_UNSUPPORTED_INFERRED_CREATE',
        severity: 'ERROR',
        message: `CREATE action contains an item without explicit source evidence: [${create.itemTitle} / ${create.candidateId}]. Inferred items cannot become canonical CREATE actions.`,
        candidateId: create.candidateId,
        proposalItemId: create.proposalItemId
      })
    }

    if (create.parentItemUid && !isUuid(create.parentItemUid)) {
      validation.status = 'FAIL'
      validation.errors.push({
        code: 'R003_PARENT_TITLE_ID',
        severity: 'ERROR',
        message: `Fatal: parentItemUid contains non-UUID title string: "${create.parentItemUid}"`,
        candidateId: create.candidateId,
        proposalItemId: create.proposalItemId
      })
    }
  }

  // 計算審核指標 (Audit Counts)
  const sourceSupportedCount = candidateList.filter(c => 
    (c.classification === 'EXPLICIT' || !c.inferred) && 
    (c.evidenceId || (c.evidenceIds && c.evidenceIds.length > 0) || c.sourceEvidence)
  ).length
  const canonicalCreatesCount = proposal.creates.length
  const inferredAppliedCount = proposal.creates.filter(c => c.inferred || c.classification === 'INFERRED').length
  const explicitAppliedCount = canonicalCreatesCount - inferredAppliedCount

  proposal.auditCounts = {
    sourceSupported: sourceSupportedCount,
    canonicalCreates: canonicalCreatesCount,
    inferredApplied: inferredAppliedCount,
    explicitApplied: explicitAppliedCount
  }

  if (inferredAppliedCount > 0) {
    validation.status = 'FAIL'
    validation.errors.push({
      code: 'E003_INFERRED_APPLIED_GATE',
      severity: 'ERROR',
      message: `Proposal contains ${inferredAppliedCount} inferred items in CREATE set. Inferred items must be applied=false and require human approval.`
    })
  }

  if (canonicalCreatesCount > sourceSupportedCount) {
    validation.status = 'FAIL'
    validation.errors.push({
      code: 'E004_PROPOSAL_COUNT_EXCEEDS_SOURCE',
      severity: 'ERROR',
      message: `Proposal CREATE count (${canonicalCreatesCount}) exceeds source-supported records count (${sourceSupportedCount}). Unsupported items detected.`
    })
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

  // 8. 執行全量提案校驗門禁 (Full Canonical Proposal Validation)
  const comprehensiveValidation = validateCanonicalProposal(proposal, existingItems)
  if (comprehensiveValidation.status === 'FAIL') {
    validation.status = 'FAIL'
    for (const err of comprehensiveValidation.errors) {
      if (!validation.errors.some(e => e.message === err.message)) {
        validation.errors.push(err)
      }
    }
  }

  // 9. 計算提案不可變 SHA-256 數位簽章 (Immutable Proposal Hash)
  proposal.proposalHash = computeProposalHash(proposal)

  // 9.1 向服務端權威註冊中心登記 (Server-Side Authoritative Proposal Registry)
  // 🚨 INVARIANT: 只有由此確定性管線產出之 Proposal 才具備寫庫授權
  if (validation.status === 'PASS' && proposal.proposalId && proposal.proposalHash) {
    registerAuthoritativeProposal(proposal)
  }

  // 10. 結構化執行診斷 (Observability & Structured Execution Diagnostics)
  proposal.executionStages = [
    { stage: 'DOCUMENT_PARSE', status: 'SUCCESS', details: `Normalized document "${metadata.meetingTitle || effectiveFilename || 'doc'}" (SHA-256: ${currentDocHash.substring(0, 12)}...)` },
    { stage: 'EVIDENCE_EXTRACTION', status: 'SUCCESS', details: `Extracted explicit source evidence for ${candidateList.length} items.` },
    { stage: 'CANDIDATE_DISCOVERY', status: ledgerCompleteness.isComplete ? 'SUCCESS' : 'FAILED', details: `Discovered ${candidateList.length} candidate items.` },
    { stage: 'EXISTING_ITEM_RETRIEVAL', status: 'SUCCESS', details: `Retrieved ${existingItems.length} existing project items from memory.` },
    { stage: 'MATCHING', status: 'SUCCESS', details: `Multi-signal matching completed across candidates.` },
    { stage: 'RECONCILIATION', status: 'SUCCESS', details: `Reconciled into ${proposal.creates.length} creates, ${proposal.updates.length} updates, ${proposal.noChanges.length} no-changes.` },
    { stage: 'PROPOSAL_BUILD', status: 'SUCCESS', details: `Built single canonical proposal with ${proposalItems.length} items.` },
    { stage: 'PROPOSAL_VALIDATION', status: validation.status === 'PASS' ? 'SUCCESS' : 'FAILED', details: `Validation status: ${validation.status} with ${validation.errors.length} errors.` }
  ]

  return proposal
}
