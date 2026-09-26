export interface AgentContext {
  workspace_uid: string
  project_uid?: string
  workspaceInfo: {
    workspace_uid: string
    workspace_name: string
    prefix_code: string
    last_item_number?: number
    last_project_number?: number
  }
  projectsContext: any[]
  membersContext: any[]
  itemsContext: any[]
  mentionedItems: any[]
  currentProject: any | null
  message: string
  conversation_history?: any[]
  attachments?: any[]
  model?: string
  enable_thinking?: boolean
}

export interface PolymorphicRelation {
  item_uid: string
  relation: 'blocks' | 'covers' | 'deploys' | 'discusses' | 'causes'
}

export interface PolymorphicItemProposal {
  itemTitle: string
  itemType: 'Objective' | 'Requirement' | 'User story' | 'Task' | 'UAT' | 'Bug' | 'Decision' | 'Information' | 'Bottleneck' | 'Meeting' | 'Milestone' | 'Charter' | 'Epic' | 'Micro Task' | 'Deployment' | 'Event'
  itemPriority?: 'High' | 'Middle' | 'Low' | null
  itemFollowBy?: string
  parentItemUid?: string
  relationItemUid?: PolymorphicRelation[]
  description: string
  sectionTitle?: string
}

export interface PolymorphicItemUpdate {
  targetDisplayCode?: string
  targetItemUid?: string
  itemTitle: string
  updates: {
    item_content?: {
      text?: string
      description?: string
    } | string
    description?: string
    item_status?: 'Not Start' | 'Ready' | 'In Progress' | 'Blocked' | 'Review' | 'Completed' | 'Closed' | 'Backlog'
    item_priority?: 'High' | 'Middle' | 'Low' | null
    item_follow_by?: string
    parent_item_uid?: string
    relation_item_uid?: PolymorphicRelation[]
  }
  summary: string
}

export interface SubAgentResult {
  agentName: 'spine' | 'charter' | 'decision'
  agentTitle: string
  itemsToCreate: PolymorphicItemProposal[]
  itemsToUpdate: PolymorphicItemUpdate[]
  rationale: string
  error?: string
}

export interface SupervisorResult {
  unifiedActions: any[]
  critiqueNotes: string[]
  orphanParentsResolved: number
  duplicateItemsMerged: number
  cyclesRemoved: number
  primaryAction?: any
}

// ============================================================================
// ARCHITECTURAL INVARIANT CONTRACTS (Phase 1A: Safe Boundary Definitions)
//
// LLM may suggest Evidence and Candidates.
// Only deterministic reconciliation may construct CanonicalProposal.
// Only validated CanonicalProposal may reach DB mutation.
// Any validation failure MUST result in ZERO DB WRITES.
// No LLM, Critic, parser, frontend payload, or legacy route may bypass this boundary.
// ============================================================================

export type EvidenceSemanticClassification =
  | 'DIRECT_QUOTE'              // Verbatim source quotation
  | 'PARAPHRASE'                // Faithful paraphrasing
  | 'MODEL_INTERPRETATION'      // AI inference / interpretation (not direct fact)

export type EvidenceCommitmentStatus =
  | 'CONFIRMED'                 // Explicitly agreed and confirmed
  | 'TENTATIVE'                 // Stated tentatively (e.g., "around October 16", "probably")
  | 'TARGET'                    // Aspirational target/KPI (e.g., "<3s")
  | 'DEPENDENCY_UNKNOWN'        // External dependency / technical unknown (NOT a Bottleneck)
  | 'TECHNICAL_UNKNOWN'         // Technical unknown (NOT a Bottleneck)
  | 'NOT_DECIDED'               // Explicitly marked as not decided
  | 'NOT_A_BLOCKER'             // Explicitly stated as not a blocker

export interface EvidenceLedgerEntry {
  evidenceId: string            // EVID-001
  sourceDocumentId: string
  sourceDocumentHash: string    // SHA-256
  sourceText: string            // Preserved exact excerpt
  sourceLocation?: {
    line?: number
    sectionTitle?: string
  }
  classification: EvidenceSemanticClassification
  commitmentStatus: EvidenceCommitmentStatus
  isExplicit: boolean           // true for direct mention, false for inference
  extractedFact: string         // Extracted core statement
  // 🚨 Invariant: MUST NOT contain item_uid, parentItemUid, or relationItemUid
}

export type CandidateItemType =
  | 'Objective' | 'Requirement' | 'User story' | 'Task' | 'UAT'
  | 'Decision' | 'Bottleneck' | 'Milestone' | 'Meeting' | 'Charter'

export interface CandidateRelationshipRef {
  targetCandidateId?: string    // Points to CAND-xxx
  targetExistingDbUid?: string  // Points to existing confirmed DB UUID
  relationType: 'parent_child' | 'discusses' | 'blocks' | 'covers' | 'relates_to'
  confidence: number
  inferenceReason: string
  // 🚨 Invariant: MUST NOT be a Title string
}

export interface CandidateProposal {
  candidateId: string           // CAND-001 (Unique candidate identity)
  candidateType: CandidateItemType
  suggestedTitle: string        // Label only; NEVER used for topological linking
  evidenceRefs: string[]        // Points to EvidenceLedgerEntry.evidenceId
  confidence: number            // 0.0 ~ 1.0 (LLM self-confidence)
  specialistSource: 'SPINE' | 'DECISION' | 'CHARTER' | 'PRIMARY_COPILOT'
  proposedFields: {
    suggestedPriority?: 'High' | 'Middle' | 'Low'
    suggestedAssigneeName?: string // Advisory name only, not UUID
    descriptionMarkdown?: string
    isTentative?: boolean
  }
  proposedRelationships: CandidateRelationshipRef[]
  inferenceNotes?: string
  // 🚨 Invariant: CandidateProposal MUST NOT assert it is QUALIFIED. Qualification is deterministic.
}

export interface CandidatePool {
  documentId: string
  documentHash: string
  ledgerEntries: EvidenceLedgerEntry[]
  candidates: CandidateProposal[]
  critiqueNotes: string[]
}
