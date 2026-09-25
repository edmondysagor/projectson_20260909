/**
 * ARCHITECTURAL INVARIANT:
 * LLM may suggest Evidence and Candidates.
 * Only deterministic reconciliation may construct CanonicalProposal.
 * Only validated CanonicalProposal may reach DB mutation.
 * Any validation failure MUST result in ZERO DB WRITES.
 * No LLM, Critic, parser, frontend payload, or legacy route may bypass this boundary.
 */

import {
  EvidenceLedgerEntry,
  CandidateProposal,
  CandidatePool,
  EvidenceSemanticClassification,
  EvidenceCommitmentStatus
} from '../../agents/types.js'
import { verifyProposalAuthority, HumanApprovalRecord } from './proposalRegistry.js'

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const PROPOSAL_LOCAL_ID_REGEX = /^P\d{3}-I\d{2,}$/i
export const CANDIDATE_ID_REGEX = /^CAND-\d{1,4}$/i

const VALID_SEMANTIC_CLASSIFICATIONS: EvidenceSemanticClassification[] = [
  'DIRECT_QUOTE',
  'PARAPHRASE',
  'MODEL_INTERPRETATION'
]

const VALID_COMMITMENT_STATUSES: EvidenceCommitmentStatus[] = [
  'CONFIRMED',
  'TENTATIVE',
  'TARGET',
  'DEPENDENCY_UNKNOWN',
  'TECHNICAL_UNKNOWN',
  'NOT_DECIDED',
  'NOT_A_BLOCKER'
]

/**
 * Checks if a string appears to be a descriptive human title rather than a stable machine identifier.
 */
export function isTitleString(val: any): boolean {
  if (typeof val !== 'string') return false
  const trimmed = val.trim()
  if (!trimmed) return false

  // If it's a valid UUID, it's not a title
  if (UUID_REGEX.test(trimmed)) return false

  // If it's a valid Proposal-Local ID, it's not a title
  if (PROPOSAL_LOCAL_ID_REGEX.test(trimmed)) return false

  // If it's a valid Candidate ID, it's not a title
  if (CANDIDATE_ID_REGEX.test(trimmed)) return false

  // Contains whitespace -> definitely a title / label
  if (/\s/.test(trimmed)) return true

  // Contains Chinese / non-ASCII characters -> definitely a title
  if (/[^\x00-\x7F]/.test(trimmed)) return true

  // If it's long and doesn't match standard code pattern (PREFIX-123)
  if (trimmed.length > 20) return true

  return false
}

export interface SchemaValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validates that an EvidenceLedgerEntry strictly preserves source evidence without
 * prematurely inventing DB identifiers or canonical relationships.
 */
export function validateEvidenceLedgerEntry(entry: any): SchemaValidationResult {
  const errors: string[] = []

  if (!entry || typeof entry !== 'object') {
    return { valid: false, errors: ['EvidenceLedgerEntry must be a non-null object'] }
  }

  if (!entry.evidenceId || typeof entry.evidenceId !== 'string') {
    errors.push('evidenceId is required and must be a string')
  }

  if (!entry.sourceDocumentId || typeof entry.sourceDocumentId !== 'string') {
    errors.push('sourceDocumentId is required and must be a string')
  }

  if (!entry.sourceDocumentHash || typeof entry.sourceDocumentHash !== 'string' || entry.sourceDocumentHash.length !== 64) {
    errors.push('sourceDocumentHash is required and must be a 64-character SHA-256 hash')
  }

  if (!entry.sourceText || typeof entry.sourceText !== 'string' || entry.sourceText.trim().length === 0) {
    errors.push('sourceText is required and must be non-empty')
  }

  if (!entry.classification || !VALID_SEMANTIC_CLASSIFICATIONS.includes(entry.classification)) {
    errors.push(`classification must be one of: ${VALID_SEMANTIC_CLASSIFICATIONS.join(', ')}`)
  }

  if (!entry.commitmentStatus || !VALID_COMMITMENT_STATUSES.includes(entry.commitmentStatus)) {
    errors.push(`commitmentStatus must be one of: ${VALID_COMMITMENT_STATUSES.join(', ')}`)
  }

  // 🚨 INVARIANT CHECK: Evidence layer must NEVER contain DB or Canonical IDs
  if (entry.item_uid || entry.itemUid) {
    errors.push('INVARIANT VIOLATION: EvidenceLedgerEntry must not contain DB item_uid')
  }

  if (entry.parent_item_uid || entry.parentItemUid) {
    errors.push('INVARIANT VIOLATION: EvidenceLedgerEntry must not contain parentItemUid')
  }

  if (entry.relation_item_uid || entry.relationItemUid) {
    errors.push('INVARIANT VIOLATION: EvidenceLedgerEntry must not contain relationItemUid')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validates that a CandidateProposal is purely an advisory recommendation:
 * - Must NOT assert qualification (qualification is deterministic).
 * - Relationships must point ONLY to candidateId or existing confirmed DB UUID.
 * - Must NEVER use Title strings as relationship targets.
 */
export function validateCandidateProposal(candidate: any): SchemaValidationResult {
  const errors: string[] = []

  if (!candidate || typeof candidate !== 'object') {
    return { valid: false, errors: ['CandidateProposal must be a non-null object'] }
  }

  if (!candidate.candidateId || !CANDIDATE_ID_REGEX.test(candidate.candidateId)) {
    errors.push(`candidateId must match pattern ^CAND-\\d+$ (received: ${candidate.candidateId})`)
  }

  if (!candidate.suggestedTitle || typeof candidate.suggestedTitle !== 'string' || candidate.suggestedTitle.trim().length === 0) {
    errors.push('suggestedTitle is required and must be non-empty')
  }

  if (!Array.isArray(candidate.evidenceRefs) || candidate.evidenceRefs.length === 0) {
    errors.push('evidenceRefs must be a non-empty array of evidence IDs')
  }

  // 🚨 INVARIANT CHECK: LLM specialist must NOT assert itself as QUALIFIED
  if (candidate.qualificationStatus === 'QUALIFIED' || candidate.isQualified === true) {
    errors.push('INVARIANT VIOLATION: CandidateProposal must NOT assert qualificationStatus = QUALIFIED. Qualification is deterministic.')
  }

  // 🚨 INVARIANT CHECK: Prohibit newly invented DB UUIDs in candidate identity
  if (candidate.item_uid || candidate.itemUid) {
    errors.push('INVARIANT VIOLATION: CandidateProposal must NOT invent its own DB item_uid')
  }

  // Validate proposed relationships
  if (candidate.proposedRelationships && Array.isArray(candidate.proposedRelationships)) {
    for (let i = 0; i < candidate.proposedRelationships.length; i++) {
      const rel = candidate.proposedRelationships[i]
      if (!rel || typeof rel !== 'object') {
        errors.push(`proposedRelationships[${i}] must be an object`)
        continue
      }

      if (rel.targetTitle || isTitleString(rel.targetCandidateId) || isTitleString(rel.targetExistingDbUid) || isTitleString(rel.targetRef)) {
        errors.push(`INVARIANT VIOLATION: proposedRelationships[${i}] uses Title string as target identifier`)
      }

      if (rel.targetCandidateId && !CANDIDATE_ID_REGEX.test(rel.targetCandidateId)) {
        errors.push(`proposedRelationships[${i}].targetCandidateId must match ^CAND-\\d+$`)
      }

      if (rel.targetExistingDbUid && !UUID_REGEX.test(rel.targetExistingDbUid)) {
        errors.push(`proposedRelationships[${i}].targetExistingDbUid must be a valid UUID`)
      }

      if (!rel.targetCandidateId && !rel.targetExistingDbUid) {
        errors.push(`proposedRelationships[${i}] must specify either targetCandidateId or targetExistingDbUid`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Asserts that no title strings exist in any parent or relation fields of an item or proposal.
 */
export function assertNoTitleInRelationships(item: any): SchemaValidationResult {
  const errors: string[] = []
  if (!item || typeof item !== 'object') return { valid: true, errors: [] }

  const title = item.itemTitle || item.item_title || item.title || 'Untitled'

  // 1. Check parentItemUid / parent_item_uid
  const parentVal = item.parentItemUid || item.parent_item_uid
  if (parentVal) {
    if (isTitleString(parentVal)) {
      errors.push(`TITLE_AS_PARENT_ID: Item "${title}" has title string in parentItemUid: "${parentVal}"`)
    } else if (!UUID_REGEX.test(parentVal) && !PROPOSAL_LOCAL_ID_REGEX.test(parentVal)) {
      errors.push(`INVALID_PARENT_ID_FORMAT: Item "${title}" has invalid parent ID format: "${parentVal}"`)
    }
  }

  // 2. Check parentProposalItemId
  const parentProposalId = item.parentProposalItemId || item.parent_proposal_item_id
  if (parentProposalId) {
    if (isTitleString(parentProposalId)) {
      errors.push(`TITLE_AS_PARENT_ID: Item "${title}" has title string in parentProposalItemId: "${parentProposalId}"`)
    } else if (!PROPOSAL_LOCAL_ID_REGEX.test(parentProposalId)) {
      errors.push(`INVALID_PARENT_LOCAL_ID: Item "${title}" parentProposalItemId must match ^P\\d{3}-I\\d{2,}$`)
    }
  }

  // 3. Check relationItemUid
  const rels = item.relationItemUid || item.relation_item_uid
  if (Array.isArray(rels)) {
    for (let i = 0; i < rels.length; i++) {
      const targetId = rels[i]?.item_uid || rels[i]?.target_item_uid
      if (targetId && isTitleString(targetId)) {
        errors.push(`TITLE_AS_RELATION_ID: Item "${title}" relation[${i}] has title string: "${targetId}"`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Comprehensive Authority Boundary Guard for DB Execution.
 * Ensures:
 * 1. Proposal was constructed deterministically.
 * 2. Proposal hash matches and is valid.
 * 3. Validation passed without errors.
 * 4. Zero title-as-ID instances in any mutation.
 * 5. Inferred items are NOT set to applied=true in CREATE plan.
 */
export function assertAuthorityBoundaryForMutation(
  proposal: any,
  options?: {
    requireServerAuthority?: boolean
    requireHumanApproval?: boolean
    humanApproval?: HumanApprovalRecord
  }
): SchemaValidationResult {
  const errors: string[] = []

  if (!proposal || typeof proposal !== 'object') {
    return { valid: false, errors: ['Authority Boundary Failure: Proposal must be a non-null object'] }
  }

  // 1. Proposal Hash check
  if (!proposal.proposalHash || typeof proposal.proposalHash !== 'string' || proposal.proposalHash.length !== 64) {
    errors.push('Authority Boundary Failure: Valid 64-character SHA-256 proposalHash is strictly required')
  }

  // Phase 3A: Human Approval Gate
  const effectiveApproval = options?.humanApproval || proposal.humanApproval
  if (options?.requireHumanApproval) {
    if (!effectiveApproval || !effectiveApproval.approvedBy || !effectiveApproval.approvedBy.trim()) {
      errors.push('HUMAN_APPROVAL_REQUIRED: No AI-originated proposal may be applied without explicit human approval.')
    } else if (effectiveApproval.approvedProposalHash !== proposal.proposalHash) {
      errors.push(`APPROVAL_HASH_MISMATCH: Human approval hash (${effectiveApproval.approvedProposalHash}) does not match current proposal hash (${proposal.proposalHash}).`)
    }
  }

  // 2. Server-Side Authority Registry Check (Step 4: Distinguish authoritative vs forged/client-crafted proposals)
  if (options?.requireServerAuthority === true) {
    const authCheck = verifyProposalAuthority(
      proposal.proposalId,
      proposal.proposalHash,
      proposal.authorityToken,
      {
        requireHumanApproval: options?.requireHumanApproval,
        humanApproval: effectiveApproval
      }
    )
    if (!authCheck.valid && authCheck.error) {
      errors.push(`Authority Boundary Failure: ${authCheck.error}`)
    }
  }

  // 3. Validation Status check
  const valStatus = proposal.validation?.status || (proposal.validationResult?.isValid ? 'PASS' : 'FAIL')
  if (valStatus !== 'PASS') {
    const valErrors = (proposal.validation?.errors || proposal.validationResult?.errors || []).map((e: any) => e.message || e)
    errors.push(`Authority Boundary Failure: Proposal has not passed Final Deterministic Validation (${valErrors.join('; ')})`)
  }

  // 4. Proposal-local ID resolution and integrity check (Phase 3C)
  const creates = proposal.creates || proposal.executionPlan?.filter((m: any) => m.mutationType === 'CREATE') || []
  const validProposalLocalIds = new Set<string>()
  for (const c of creates) {
    if (c.proposalItemId) validProposalLocalIds.add(c.proposalItemId)
    if (c.proposalNodeId) validProposalLocalIds.add(c.proposalNodeId)
    if (c.candidateId) validProposalLocalIds.add(c.candidateId)
  }

  // 5. Inspect all creates and updates for title-as-ID and local ID violations
  for (const c of creates) {
    const titleCheck = assertNoTitleInRelationships(c)
    if (!titleCheck.valid) {
      errors.push(...titleCheck.errors)
    }

    // Check parent local ID integrity
    if (c.parentProposalItemId) {
      if (!UUID_REGEX.test(c.parentProposalItemId) && !validProposalLocalIds.has(c.parentProposalItemId)) {
        errors.push(`UNRESOLVED_PARENT_LOCAL_ID: Parent proposalItemId "${c.parentProposalItemId}" does not resolve to any item in proposal or valid UUID`)
      }
    }

    // Inferred items cannot have applied=true without human approval gate
    if ((c.inferred || c.classification === 'INFERRED' || c.inferenceStatus === 'INFERRED') && c.applied === true) {
      errors.push(`Authority Boundary Failure: Inferred item "${c.itemTitle}" cannot be applied=true in CREATE plan`)
    }
  }

  // Check relations local ID integrity
  if (proposal.relations && Array.isArray(proposal.relations)) {
    for (const rel of proposal.relations) {
      const target = rel.toProposalItemId || rel.targetProposalNodeId || rel.toProposalNodeId
      if (target && !UUID_REGEX.test(target) && !validProposalLocalIds.has(target)) {
        errors.push(`UNRESOLVED_RELATION_LOCAL_ID: Relation target "${target}" does not resolve to any item in proposal or valid UUID`)
      }
    }
  }

  const updates = proposal.updates || proposal.executionPlan?.filter((m: any) => m.mutationType === 'UPDATE') || []
  for (const u of updates) {
    const titleCheck = assertNoTitleInRelationships(u)
    if (!titleCheck.valid) {
      errors.push(...titleCheck.errors)
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
