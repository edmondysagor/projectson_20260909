export type ReconciliationAction = 'CREATE' | 'UPDATE' | 'NO_CHANGE' | 'REVIEW_REQUIRED' | 'IGNORE'

export interface SourceEvidence {
  sourceType: 'explicit' | 'inferred' | 'derived'
  sourceSection?: string
  sourceLabel?: string
  sourceText?: string
  excerpt?: string
  line?: number
}

export interface SourceReference {
  documentId?: string
  section?: string
  location?: string
  excerpt?: string
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
  relationshipStatus?: 'CONFIRMED' | 'NEEDS_REVIEW'
  inferred?: boolean
  confidence?: number
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

export interface ReconciledCandidate {
  candidateId: string
  action: ReconciliationAction
  candidate: CandidateItem
  existingItemUid?: string
  existingDisplayCode?: string
  possibleMatches?: Array<{ item_uid: string; item_display_code: string; item_title: string; score: number }>
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
  candidateId: string
  proposalItemId?: string
  itemTitle: string
  sourceLabel?: string
  itemType: string
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
  needsReview?: boolean
  sectionTitle?: string
  sourceReference?: SourceReference
  sourceEvidence?: SourceEvidence
  evidence?: SourceEvidence[]
  operation: ReconciliationAction
}

export interface ReconciliationProposal {
  proposalId?: string
  proposalVersion?: number
  mode?: 'FULL_INITIALIZATION' | 'INCREMENTAL_RECONCILIATION' | 'DUPLICATE_NOOP'
  sourceDocumentId?: string
  sourceDocumentHash?: string
  documentMetadata?: DocumentMetadata
  creates: Array<{
    candidateId: string
    proposalItemId?: string
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
    needsReview?: boolean
    sectionTitle?: string
    sourceReference?: SourceReference
    sourceEvidence?: SourceEvidence
    evidence?: SourceEvidence[]
  }>
  updates: Array<{
    candidateId?: string
    proposalItemId?: string
    targetItemUid?: string
    targetDisplayCode?: string
    itemTitle?: string
    updates: any
    summary?: string
    reason?: string
  }>
  noChanges: Array<{
    candidateId: string
    proposalItemId?: string
    existingItemUid?: string
    existingDisplayCode?: string
    reason: string
  }>
  reviewRequired: Array<{
    candidateId: string
    proposalItemId?: string
    candidate: CandidateItem
    possibleMatches?: any[]
    reason: string
  }>
  ignored: Array<{
    candidateId: string
    proposalItemId?: string
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
