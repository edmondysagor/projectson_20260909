export type ReconciliationAction = 'CREATE' | 'UPDATE' | 'CORRECTION' | 'NO_CHANGE' | 'NEEDS_REVIEW' | 'CONFLICT' | 'IGNORE'

export type MatchStatus = 'EXACT_MATCH' | 'PROBABLE_MATCH' | 'POSSIBLE_MATCH' | 'NO_MATCH' | 'AMBIGUOUS' | 'CONFLICT'

export type InferenceStatus = 'SOURCE_FACT' | 'DERIVED_VALUE' | 'INFERENCE' | 'NEEDS_REVIEW'

export interface SourceEvidence {
  evidenceId?: string
  sourceDocumentId?: string
  sourceDocumentHash?: string
  sourceType?: 'explicit' | 'inferred' | 'derived'
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
  attendees?: string[]
  normalizedContent: string
}

export interface CandidateItem {
  candidateId: string
  proposalItemId?: string
  evidenceId?: string
  rawType: string
  canonicalType: 'Objective' | 'Requirement' | 'User story' | 'Task' | 'UAT' | 'Deployment' | 'Meeting' | 'Decision' | 'Bottleneck' | 'Information' | 'Bug' | 'Milestone' | 'Charter'
  title: string
  sourceLabel?: string
  description?: string
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
  parentCandidateId?: string
  parentProposalItemId?: string
  parentRef?: string
  parentUid?: string
  parentItemUid?: string
  relationshipStatus?: 'CONFIRMED' | 'NEEDS_REVIEW'
  inferred?: boolean
  confidence?: number
  inferenceStatus?: InferenceStatus
  needsReview?: boolean
  dueDate?: string
  uatCode?: string
  sectionTitle?: string
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
  fromProposalItemId: string
  toProposalItemId: string
  relationType: 'parent_child' | 'discusses' | 'relates_to' | 'blocks' | 'covers' | 'mitigates'
  evidence?: string
  confidence?: number
  inferred?: boolean
  needsReview?: boolean
}

export interface ValidationIssue {
  code: string
  severity: 'ERROR' | 'WARNING'
  message: string
  candidateId?: string
  proposalItemId?: string
}

export interface ValidationReport {
  status: 'PASS' | 'FAIL'
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

export interface CanonicalProposalItem {
  proposalItemId: string
  candidateId: string
  action: ReconciliationAction
  itemType: string
  itemTitle: string
  sourceLabel?: string
  existingItemId?: string
  existingDisplayCode?: string
  proposedFields?: Record<string, any>
  fieldDiffs?: FieldDiff[]
  evidenceRefs?: string[]
  itemPriority: string
  projectId?: string
  itemFollowBy?: string
  assigneeUid?: string
  assigneeId?: string
  assigneeName?: string
  followerUid?: string
  followerId?: string
  parentCandidateId?: string
  parentProposalItemId?: string
  parentItemUid?: string
  relationshipStatus?: 'CONFIRMED' | 'NEEDS_REVIEW'
  relationItemUid?: Array<{ item_uid: string; relation: string }>
  description?: string
  sourceContent?: string
  derivedContent?: string
  summary?: string
  inferred?: boolean
  confidence?: number
  inferenceStatus?: InferenceStatus
  needsReview?: boolean
  reviewStatus?: 'CONFIRMED' | 'NEEDS_REVIEW' | 'CONFLICT'
  sectionTitle?: string
  sourceReference?: SourceReference
  sourceEvidence?: SourceEvidence
  evidence?: SourceEvidence[]
  reason?: string
}

export interface ReconciliationProposal {
  proposalId?: string
  proposalVersion?: number
  mode?: 'FULL_INITIALIZATION' | 'INCREMENTAL_RECONCILIATION' | 'DUPLICATE_NOOP'
  sourceDocumentId?: string
  sourceDocumentHash?: string
  createdAt?: string
  documentMetadata?: DocumentMetadata
  evidence?: SourceEvidence[]
  items?: CanonicalProposalItem[]
  creates: Array<{
    candidateId: string
    proposalItemId?: string
    evidenceId?: string
    itemTitle: string
    sourceLabel?: string
    itemType: string
    itemPriority: string
    projectId?: string
    itemFollowBy?: string
    assigneeUid?: string
    assigneeId?: string
    assigneeName?: string
    parentCandidateId?: string
    parentProposalItemId?: string
    parentItemUid?: string
    relationshipStatus?: 'CONFIRMED' | 'NEEDS_REVIEW'
    relationItemUid?: Array<{ item_uid: string; relation: string }>
    description?: string
    sourceContent?: string
    derivedContent?: string
    summary?: string
    inferred?: boolean
    confidence?: number
    inferenceStatus?: InferenceStatus
    needsReview?: boolean
    sectionTitle?: string
    sourceReference?: SourceReference
    sourceEvidence?: SourceEvidence
    evidence?: SourceEvidence[]
  }>
  updates: Array<{
    candidateId?: string
    proposalItemId?: string
    evidenceId?: string
    targetItemUid?: string
    targetDisplayCode?: string
    itemTitle?: string
    fieldDiffs?: FieldDiff[]
    evidenceRefs?: string[]
    updates: any
    summary?: string
    reason?: string
  }>
  corrections?: Array<{
    candidateId?: string
    proposalItemId?: string
    evidenceId?: string
    targetItemUid?: string
    targetDisplayCode?: string
    itemTitle?: string
    fieldDiffs?: FieldDiff[]
    evidenceRefs?: string[]
    updates: any
    summary?: string
    reason?: string
  }>
  noChanges: Array<{
    candidateId: string
    proposalItemId?: string
    evidenceId?: string
    existingItemUid?: string
    existingDisplayCode?: string
    fieldDiffs?: FieldDiff[]
    reason: string
  }>
  reviewRequired: Array<{
    candidateId: string
    proposalItemId?: string
    evidenceId?: string
    candidate: CandidateItem
    possibleMatches?: any[]
    reason: string
  }>
  conflicts?: Array<{
    candidateId: string
    proposalItemId?: string
    evidenceId?: string
    candidate: CandidateItem
    conflictingItemUid?: string
    conflictingDisplayCode?: string
    fieldDiffs?: FieldDiff[]
    reason: string
  }>
  ignored: Array<{
    candidateId: string
    proposalItemId?: string
    evidenceId?: string
    reason: string
  }>
  relationships: RelationshipPlan[]
  relations?: CanonicalProposalRelation[]
  validation: ValidationReport
  coverage: {
    extracted: number
    processed: number
    isComplete: boolean
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
  status: 'APPLIED_AND_VERIFIED' | 'APPLIED_WITH_VERIFICATION_ERRORS'
  totalVerified: number
  createdItems: any[]
  updatedItems: any[]
  mismatches: VerificationMismatch[]
  verifiedAt: string
}
