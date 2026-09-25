export type ReconciliationAction = 'CREATE' | 'UPDATE' | 'CORRECTION' | 'NO_CHANGE' | 'NEEDS_REVIEW' | 'CONFLICT' | 'IGNORE'

export type MatchStatus = 'EXACT_MATCH' | 'PROBABLE_MATCH' | 'POSSIBLE_MATCH' | 'NO_MATCH' | 'AMBIGUOUS' | 'CONFLICT'

export type InferenceStatus = 'SOURCE_FACT' | 'DERIVED' | 'DERIVED_VALUE' | 'INFERRED' | 'INFERENCE' | 'NEEDS_REVIEW' | 'UNKNOWN'

export type ItemClassification = 'EXPLICIT' | 'INFERRED' | 'SUGGESTED' | 'EXPLICIT_SOURCE_RECORD' | 'INFERRED_SPECULATIVE_RECORD' | 'DERIVED_VALUE' | 'UNSUPPORTED_ASSUMPTION'

export type CommitmentStatus = 
  | 'CONFIRMED'
  | 'AGREED'
  | 'PROPOSED'
  | 'TENTATIVE'
  | 'TARGET'
  | 'ESTIMATED'
  | 'FUTURE'
  | 'UNKNOWN'
  | 'NOT_DECIDED'
  | 'DEPENDENCY'
  | 'NOT_A_BLOCKER'

export type EvidenceType = 
  | 'SOURCE_FACT'
  | 'SOURCE_DECISION'
  | 'SOURCE_ACTION'
  | 'SOURCE_SCOPE'
  | 'SOURCE_DEPENDENCY'
  | 'SOURCE_STATUS'

export interface ProcessingInstruction {
  userIntent?: string
  requestedOperation?: string
  targetProjectId?: string
}

export interface SourceDocumentInput {
  documentId?: string
  filename?: string
  content: string
  contentHash?: string
}

export interface IncompleteExtractionReport {
  reason: string
  missingEvidenceCount: number
  suspectedItemTypes: string[]
  unresolvedSections: string[]
}

export interface ExtractionDiagnostics {
  sourceDocument: {
    filename?: string
    documentId?: string
    contentHash?: string
  }
  detectedSignals: Record<string, number>
  candidatesExtracted: Record<string, number>
  status: 'COMPLETE' | 'INCOMPLETE'
  incompleteReason?: string
}

export interface SourceEvidence {
  evidenceId?: string
  sourceDocumentId?: string
  sourceDocumentHash?: string
  sourceType?: 'explicit' | 'inferred' | 'derived'
  evidenceType?: EvidenceType
  commitmentStatus?: CommitmentStatus
  sourceSection?: string
  sourceLabel?: string
  sourceLocation?: string
  sourceText?: string
  extractedFact?: string
  candidateType?: string
  extractedValues?: Record<string, any>
  confidence?: number
  inferenceStatus?: InferenceStatus
  excerpt?: string
  line?: number
}

export interface SourceReference {
  documentId?: string
  section?: string
  location?: string
  excerpt?: string
}

export interface FieldDiff {
  field: string
  existingValue: any
  proposedValue: any
  action: ReconciliationAction
  evidenceRefs?: string[]
  reason?: string
}

export interface DocumentMetadata {
  documentId?: string
  documentName?: string
  documentHash: string
  meetingTitle?: string
  meetingDate?: string
  meetingObjective?: string
  attendees?: string[]
  normalizedContent: string
  summary?: string
}

export interface PipelineStageLog {
  stage: 'DOCUMENT_PARSE' | 'EVIDENCE_EXTRACTION' | 'CANDIDATE_DISCOVERY' | 'EXISTING_ITEM_RETRIEVAL' | 'MATCHING' | 'RECONCILIATION' | 'PROPOSAL_BUILD' | 'PROPOSAL_VALIDATION' | 'PREVIEW' | 'APPLY' | 'POST_WRITE_VERIFY'
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED'
  durationMs?: number
  inputRef?: string
  outputRef?: string
  error?: string
  details?: string
}

export interface CandidateItem {
  candidateId: string
  proposalItemId?: string
  proposalNodeId?: string
  evidenceId?: string
  evidenceIds?: string[]
  evidenceType?: EvidenceType
  commitmentStatus?: CommitmentStatus
  rawType: string
  canonicalType: 'Objective' | 'Requirement' | 'User story' | 'Task' | 'UAT' | 'Deployment' | 'Meeting' | 'Decision' | 'Bottleneck' | 'Information' | 'Bug' | 'Milestone' | 'Charter'
  title: string
  sourceLabel?: string
  sourceIdentifier?: string
  sourceIdentifiers?: string[]
  description?: string
  decisionRationale?: string
  isFuturePhase?: boolean
  sourceContent?: string
  derivedContent?: string
  summary?: string
  priority?: 'High' | 'Middle' | 'Low'
  projectId?: string
  assigneeName?: string
  assigneeUid?: string
  assigneeId?: string
  followerUid?: string
  followerId?: string
  mentionedParticipants?: string[]
  parentCandidateId?: string
  parentProposalItemId?: string
  parentProposalNodeId?: string
  parentRef?: string
  parentUid?: string
  parentItemUid?: string
  relationItemUid?: any[]
  relation_item_uid?: any[]
  relationshipStatus?: 'CONFIRMED' | 'NEEDS_REVIEW'
  classification?: ItemClassification
  inferred?: boolean
  confidence?: number
  inferenceStatus?: InferenceStatus
  needsReview?: boolean
  dueDate?: string
  uatCode?: string
  sectionTitle?: string
  extractedValues?: Record<string, any>
  keyAttributes?: Record<string, any>
  sourceReference?: SourceReference
  sourceEvidence?: SourceEvidence
  evidence?: SourceEvidence[]
}

export interface CandidateCoverageSummary {
  totalExtracted: number
  counts: {
    objectives: number
    requirements: number
    userStories: number
    tasks: number
    uats: number
    meetings: number
    decisions: number
    bottlenecks?: number
    milestones?: number
    other: number
  }
}

export interface MatchCandidateResult {
  item: any
  score: number
  matchStatus: MatchStatus
  matchedSignals: string[]
  conflicts?: string[]
}

export interface ReconciledCandidate {
  candidateId: string
  proposalItemId?: string
  proposalNodeId?: string
  action: ReconciliationAction
  candidate: CandidateItem
  existingItemUid?: string
  existingDisplayCode?: string
  matchStatus?: MatchStatus
  possibleMatches?: Array<{ item_uid: string; item_display_code: string; item_title: string; score: number; matchStatus?: MatchStatus }>
  fieldDiffs?: FieldDiff[]
  changes?: {
    itemTitle?: string
    itemContent?: any
    itemStatus?: string
    itemPriority?: string
    itemFollowBy?: string
    parentItemUid?: string
    parentCandidateId?: string
    parentProposalNodeId?: string
    dueDate?: string
  }
  confidence?: number
  reviewStatus?: 'CONFIRMED' | 'NEEDS_REVIEW' | 'CONFLICT'
  reason: string
}

export interface RelationshipPlan {
  relationId?: string
  fromProposalItemId?: string
  toProposalItemId?: string
  fromProposalNodeId?: string
  toProposalNodeId?: string
  targetProposalNodeId?: string
  parentRef?: string
  parentCandidateId?: string
  childRef?: string
  childCandidateId?: string
  relationshipType: 'parent_child' | 'discusses' | 'relates_to' | 'blocks' | 'covers' | 'mitigates'
  relationshipStatus?: 'CONFIRMED' | 'NEEDS_REVIEW'
  evidence?: string
  confidence?: number
  inferred?: boolean
  needsReview?: boolean
}

export interface CanonicalProposalRelation {
  relationId: string
  fromProposalItemId?: string
  toProposalItemId?: string
  fromProposalNodeId?: string
  toProposalNodeId?: string
  targetProposalNodeId?: string
  relationType: 'parent_child' | 'discusses' | 'relates_to' | 'blocks' | 'covers' | 'mitigates'
  evidence?: string
  confidence?: number
  inferred?: boolean
  needsReview?: boolean
}

export interface ValidationIssue {
  code: string
  rule?: string
  severity: 'ERROR' | 'WARNING'
  message: string
  candidateId?: string
  proposalItemId?: string
  proposalNodeId?: string
}

export interface ValidationReport {
  status: 'PASS' | 'FAIL'
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  validatedAt?: string
}

export interface CanonicalProposalItem {
  proposalItemId: string
  proposalNodeId?: string
  candidateId: string
  action: ReconciliationAction
  itemType: string
  itemTitle: string
  sourceLabel?: string
  sourceIdentifier?: string
  sourceIdentifiers?: string[]
  existingItemId?: string
  existingDisplayCode?: string
  proposedFields?: Record<string, any>
  fieldDiffs?: FieldDiff[]
  evidenceId?: string
  evidenceIds?: string[]
  evidenceRefs?: string[]
  evidenceType?: EvidenceType
  commitmentStatus?: CommitmentStatus
  itemPriority?: string
  projectId?: string
  itemFollowBy?: string // Strictly Member UUID
  assigneeUid?: string
  assigneeId?: string
  assigneeName?: string
  followerUid?: string
  followerId?: string
  mentionedParticipants?: string[]
  parentCandidateId?: string
  parentProposalItemId?: string
  parentProposalNodeId?: string
  parentItemUid?: string // Strictly Database UUID; never title
  relationshipStatus?: 'CONFIRMED' | 'NEEDS_REVIEW'
  relationItemUid?: Array<{ item_uid: string; relation: string }>
  relations?: Array<{ targetProposalNodeId?: string; targetProposalItemId?: string; relation: string }>
  description?: string
  decisionRationale?: string
  isFuturePhase?: boolean
  sourceContent?: string
  derivedContent?: string
  summary?: string
  classification?: ItemClassification
  inferred?: boolean
  confidence?: number
  inferenceStatus?: InferenceStatus
  needsReview?: boolean
  reviewStatus?: 'CONFIRMED' | 'NEEDS_REVIEW' | 'CONFLICT'
  applied?: boolean
  sectionTitle?: string
  extractedValues?: Record<string, any>
  sourceReference?: SourceReference
  sourceEvidence?: SourceEvidence
  evidence?: SourceEvidence[]
  reason?: string
}

export interface ReconciliationProposal {
  proposalId?: string
  proposalVersion?: number
  proposalHash?: string
  mode?: 'FULL_INITIALIZATION' | 'INCREMENTAL_RECONCILIATION' | 'DUPLICATE_NOOP' | 'EXTRACTION_INCOMPLETE'
  sourceDocumentId?: string
  sourceDocumentHash?: string
  createdAt?: string
  documentMetadata?: DocumentMetadata
  evidence?: SourceEvidence[]
  items?: CanonicalProposalItem[]
  creates: Array<{
    candidateId: string
    proposalItemId?: string
    proposalNodeId?: string
    evidenceId?: string
    evidenceIds?: string[]
    itemTitle: string
    sourceLabel?: string
    sourceIdentifier?: string
    sourceIdentifiers?: string[]
    itemType: string
    itemPriority?: string
    projectId?: string
    evidenceType?: EvidenceType
    commitmentStatus?: CommitmentStatus
    itemFollowBy?: string // Strictly Member UUID
    assigneeUid?: string
    assigneeId?: string
    assigneeName?: string
    followerUid?: string
    followerId?: string
    mentionedParticipants?: string[]
    parentCandidateId?: string
    parentProposalItemId?: string
    parentProposalNodeId?: string
    parentItemUid?: string // Strictly Database UUID; never title
    relationshipStatus?: 'CONFIRMED' | 'NEEDS_REVIEW'
    relationItemUid?: Array<{ item_uid: string; relation: string }>
    relations?: Array<{ targetProposalNodeId?: string; targetProposalItemId?: string; relation: string }>
    description?: string
    decisionRationale?: string
    isFuturePhase?: boolean
    sourceContent?: string
    derivedContent?: string
    summary?: string
    classification?: ItemClassification
    inferred?: boolean
    confidence?: number
    inferenceStatus?: InferenceStatus
    needsReview?: boolean
    applied?: boolean
    sectionTitle?: string
    extractedValues?: Record<string, any>
    sourceReference?: SourceReference
    sourceEvidence?: SourceEvidence
    evidence?: SourceEvidence[]
  }>
  updates: Array<{
    candidateId?: string
    proposalItemId?: string
    proposalNodeId?: string
    evidenceId?: string
    evidenceIds?: string[]
    targetItemUid?: string
    targetDisplayCode?: string
    itemTitle?: string
    sourceLabel?: string
    sourceIdentifier?: string
    sourceIdentifiers?: string[]
    fieldDiffs?: FieldDiff[]
    evidenceRefs?: string[]
    updates: any
    classification?: ItemClassification
    applied?: boolean
    summary?: string
    reason?: string
  }>
  corrections?: Array<{
    candidateId?: string
    proposalItemId?: string
    proposalNodeId?: string
    evidenceId?: string
    evidenceIds?: string[]
    targetItemUid?: string
    targetDisplayCode?: string
    itemTitle?: string
    sourceLabel?: string
    sourceIdentifier?: string
    sourceIdentifiers?: string[]
    fieldDiffs?: FieldDiff[]
    evidenceRefs?: string[]
    updates: any
    classification?: ItemClassification
    applied?: boolean
    summary?: string
    reason?: string
  }>
  noChanges: Array<{
    candidateId: string
    proposalItemId?: string
    proposalNodeId?: string
    evidenceId?: string
    evidenceIds?: string[]
    sourceLabel?: string
    sourceIdentifier?: string
    sourceIdentifiers?: string[]
    existingItemUid?: string
    existingDisplayCode?: string
    fieldDiffs?: FieldDiff[]
    classification?: ItemClassification
    reason: string
  }>
  reviewRequired: Array<{
    candidateId: string
    proposalItemId?: string
    proposalNodeId?: string
    evidenceId?: string
    evidenceIds?: string[]
    sourceLabel?: string
    sourceIdentifier?: string
    sourceIdentifiers?: string[]
    candidate: CandidateItem
    possibleMatches?: any[]
    classification?: ItemClassification
    needsReview?: boolean
    applied?: boolean
    reason: string
  }>
  conflicts?: Array<{
    candidateId: string
    proposalItemId?: string
    proposalNodeId?: string
    evidenceId?: string
    evidenceIds?: string[]
    sourceLabel?: string
    sourceIdentifier?: string
    sourceIdentifiers?: string[]
    candidate: CandidateItem
    conflictingItemUid?: string
    conflictingDisplayCode?: string
    fieldDiffs?: FieldDiff[]
    classification?: ItemClassification
    reason: string
  }>
  ignored: Array<{
    candidateId: string
    proposalItemId?: string
    proposalNodeId?: string
    evidenceId?: string
    evidenceIds?: string[]
    sourceLabel?: string
    sourceIdentifier?: string
    sourceIdentifiers?: string[]
    reason: string
  }>
  suggestedItems?: CanonicalProposalItem[]
  inferredItems?: CanonicalProposalItem[]
  relationships: RelationshipPlan[]
  relations?: CanonicalProposalRelation[]
  executionStages?: PipelineStageLog[]
  validation: ValidationReport
  coverage: {
    extracted: number
    processed: number
    isComplete: boolean
    incompleteExtraction?: IncompleteExtractionReport
    diagnostics?: ExtractionDiagnostics
  }
  auditCounts?: {
    sourceSupported: number
    canonicalCreates: number
    inferredApplied: number
    explicitApplied: number
  }
  summaryStats?: {
    total: number
    creates: number
    created?: number
    updates: number
    updated?: number
    corrections: number
    corrected?: number
    noChanges: number
    noChange?: number
    reviewRequired: number
    needsReview?: number
    conflicts: number
    conflict?: number
  }
}

export interface VerificationMismatch {
  field: string
  candidateId?: string
  proposalItemId?: string
  itemUid?: string
  expected: any
  actual: any
  message: string
}

export interface PostWriteVerificationResult {
  status: 'APPLIED_AND_VERIFIED' | 'APPLIED_WITH_VERIFICATION_ERRORS' | 'FAILED_VERIFICATION'
  totalVerified: number
  createdItems: any[]
  updatedItems: any[]
  mismatches: VerificationMismatch[]
  verifiedAt: string
}

export type {
  EvidenceSemanticClassification,
  EvidenceCommitmentStatus,
  EvidenceLedgerEntry,
  CandidateItemType,
  CandidateRelationshipRef,
  CandidateProposal,
  CandidatePool
} from '../../agents/types.js'
