export type ReconciliationAction = 'CREATE' | 'UPDATE' | 'NO_CHANGE' | 'REVIEW_REQUIRED' | 'IGNORE'

export interface SourceReference {
  documentId?: string
  section?: string
  location?: string
  excerpt?: string
}

export interface CandidateItem {
  candidateId: string
  rawType: string
  canonicalType: 'Objective' | 'Requirement' | 'User story' | 'Task' | 'UAT' | 'Deployment' | 'Meeting' | 'Decision' | 'Bottleneck' | 'Information' | 'Bug' | 'Milestone' | 'Charter'
  title: string
  description?: string
  priority?: 'High' | 'Middle' | 'Low'
  assigneeName?: string
  assigneeUid?: string
  parentRef?: string
  parentUid?: string
  dueDate?: string
  uatCode?: string
  sectionTitle?: string
  keyAttributes?: Record<string, any>
  sourceReference?: SourceReference
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
    dueDate?: string
  }
  reason: string
}

export interface RelationshipPlan {
  parentRef: string
  childRef: string
  relationshipType: 'parent_child' | 'discusses' | 'relates_to' | 'blocks' | 'covers'
  evidence?: string
}

export interface ValidationIssue {
  code: string
  severity: 'ERROR' | 'WARNING'
  message: string
  candidateId?: string
}

export interface ValidationReport {
  status: 'PASS' | 'FAIL'
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

export interface ReconciliationProposal {
  creates: Array<{
    candidateId: string
    itemTitle: string
    itemType: string
    itemPriority: string
    itemFollowBy?: string
    parentItemUid?: string
    relationItemUid?: Array<{ item_uid: string; relation: string }>
    description?: string
    sectionTitle?: string
    sourceReference?: SourceReference
  }>
  updates: Array<{
    candidateId?: string
    targetItemUid?: string
    targetDisplayCode?: string
    itemTitle?: string
    updates: any
    summary?: string
    reason?: string
  }>
  noChanges: Array<{
    candidateId: string
    existingItemUid?: string
    existingDisplayCode?: string
    reason: string
  }>
  reviewRequired: Array<{
    candidateId: string
    candidate: CandidateItem
    possibleMatches?: any[]
    reason: string
  }>
  ignored: Array<{
    candidateId: string
    reason: string
  }>
  relationships: RelationshipPlan[]
  validation: ValidationReport
  coverage: {
    extracted: number
    processed: number
    isComplete: boolean
  }
}
