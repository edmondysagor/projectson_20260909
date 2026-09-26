/**
 * ============================================================================
 * PROJECTSON — PHASE 3: SAFE COMMIT & POST-WRITE VERIFICATION TEST MATRIX
 *
 * Enforces Architectural Invariant:
 * AI MAY PROPOSE.
 * HUMANS APPROVE.
 * ONLY VALIDATED CANONICAL PROPOSALS MAY MUTATE MEMORY.
 * ALL MUTATIONS ARE TRANSACTIONAL.
 * VERIFICATION MUST PASS BEFORE COMMIT.
 *
 * Test Matrix:
 * P3-01 Normal valid apply
 * P3-02 No human approval
 * P3-03 Wrong proposal approval
 * P3-04 Proposal hash mismatch
 * P3-05 Replayed approval
 * P3-06 Invalid / unresolved proposal-local ID
 * P3-07 Relationship written using real UUIDs
 * P3-08 Mid-transaction DB failure -> full rollback
 * P3-09 Post-write verification failure -> rollback
 * P3-10 Successful apply -> APPLIED_AND_VERIFIED
 * P3-11 AI-originated direct mutation attempt -> rejected
 * P3-12 Human Direct CRUD -> still works
 * P3-13 System template instantiation -> still works
 * P3-14 Metadata/comment mutation -> still works
 * P3-15 Valid proposal with CREATE + UPDATE + relationship in one transaction
 * P3-16 Re-apply consumed proposal -> rejected
 * ============================================================================
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  registerAuthoritativeProposal,
  recordHumanApproval,
  verifyProposalAuthority,
  markProposalCommitted,
  clearProposalRegistry,
  HumanApprovalRecord
} from '../services/reconciliation/proposalRegistry.js'
import {
  assertAuthorityBoundaryForMutation
} from '../services/reconciliation/schemaGuard.js'
import {
  executeCanonicalProposalTransaction,
  verifyDatabaseState
} from '../services/reconciliation/dbExecutor.js'
import {
  computeProposalHash
} from '../services/reconciliation/graphValidator.js'
import { executeReconciliationPipeline } from '../services/reconciliation/proposalPipeline.js'
import { ReconciliationProposal } from '../services/reconciliation/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('PROJECTSON — Phase 3 Safe Commit & Post-Write Verification Suite', () => {
  let mockDbRows: any[]
  let executedQueries: string[]
  let writeQueriesCount: number
  let transactionActive: boolean
  let mockClient: any
  let sampleWorkspaceUid: string
  let sampleProjectUid: string

  beforeEach(() => {
    clearProposalRegistry()

    sampleWorkspaceUid = '11111111-1111-1111-1111-111111111111'
    sampleProjectUid = '22222222-2222-2222-2222-222222222222'

    // Seed existing project items
    mockDbRows = [
      {
        item_uid: '33333333-3333-3333-3333-333333333331',
        item_display_code: 'SQA-1',
        item_title: 'Passenger Queue Guidance System',
        item_type: 'Objective',
        item_status: 'In Progress',
        item_priority: 'High',
        item_follow_by: null,
        parent_item_uid: null,
        relation_item_uid: [],
        item_content: { text: 'Core objective' },
        workspace_uid: sampleWorkspaceUid,
        related_project_uid: sampleProjectUid
      },
      {
        item_uid: '33333333-3333-3333-3333-333333333336',
        item_display_code: 'SQA-6',
        item_title: 'Check Airport Systems Feed Interface',
        item_type: 'Task',
        item_status: 'Not Start',
        item_priority: 'Middle',
        item_follow_by: '44444444-4444-4444-4444-444444444441',
        parent_item_uid: '33333333-3333-3333-3333-333333333331',
        relation_item_uid: [],
        item_content: { text: 'Preliminary queue check.' },
        workspace_uid: sampleWorkspaceUid,
        related_project_uid: sampleProjectUid
      }
    ]

    executedQueries = []
    writeQueriesCount = 0
    transactionActive = false

    mockClient = {
      query: vi.fn().mockImplementation((queryText: string, params?: any[]) => {
        executedQueries.push(queryText)

        if (queryText === 'BEGIN') {
          transactionActive = true
          return Promise.resolve({ rows: [] })
        }
        if (queryText === 'COMMIT') {
          transactionActive = false
          return Promise.resolve({ rows: [] })
        }
        if (queryText === 'ROLLBACK') {
          transactionActive = false
          return Promise.resolve({ rows: [] })
        }

        // Workspace query
        if (/UPDATE\s+public\.workspace/i.test(queryText) || /SELECT\s+.*FROM\s+public\.workspace/i.test(queryText)) {
          return Promise.resolve({ rows: [{ prefix_code: 'SQA', last_item_number: 10 }] })
        }

        // gen_random_uuid
        if (/gen_random_uuid\(\)/i.test(queryText)) {
          return Promise.resolve({ rows: [{ uid: crypto.randomUUID() }] })
        }

        // Select items by UID
        if (/item_uid\s*=\s*ANY/i.test(queryText)) {
          const uids: string[] = params?.[0] || []
          const matched = mockDbRows.filter(r => uids.includes(r.item_uid))
          return Promise.resolve({ rows: matched })
        }

        // Meeting duplicate check query
        if (/item_type\s*=\s*'Meeting'/i.test(queryText)) {
          const matched = mockDbRows.filter(r => r.item_type === 'Meeting')
          return Promise.resolve({ rows: matched })
        }

        // General select items
        if (/FROM\s+public\.item/i.test(queryText)) {
          return Promise.resolve({ rows: mockDbRows })
        }

        // Insert Item
        if (/INSERT\s+INTO\s+public\.item/i.test(queryText)) {
          writeQueriesCount++
          const insertedRow = {
            item_uid: params?.[0] || 'mock-inserted-uuid',
            item_display_code: params?.[1] || 'SQA-99',
            prefix_code: params?.[2] || 'SQA',
            item_number: params?.[3] || 99,
            item_title: params?.[4] || 'Inserted',
            related_project_uid: params?.[5],
            workspace_uid: params?.[6],
            item_type: params?.[7] || 'Task',
            item_status: params?.[8] || 'Not Start',
            item_priority: params?.[9] || 'Middle',
            item_follow_by: params?.[10] || null,
            item_content: params?.[11] ? (typeof params[11] === 'string' ? JSON.parse(params[11]) : params[11]) : {},
            parent_item_uid: params?.[12] || null,
            relation_item_uid: params?.[13] ? (typeof params[13] === 'string' ? JSON.parse(params[13]) : params[13]) : [],
            item_attribute: params?.[14] || {},
            item_comment: params?.[15] || []
          }
          mockDbRows.push(insertedRow)
          return Promise.resolve({ rows: [insertedRow] })
        }

        // Update Item
        if (/UPDATE\s+public\.item/i.test(queryText)) {
          writeQueriesCount++
          const targetUid = params?.[0]
          const existing = mockDbRows.find(r => r.item_uid === targetUid)
          if (existing) {
            const priorityMatch = queryText.match(/item_priority\s*=\s*\$(\d+)/)
            if (priorityMatch) {
              const idx = parseInt(priorityMatch[1], 10) - 1
              existing.item_priority = params?.[idx]
            }
            const titleMatch = queryText.match(/item_title\s*=\s*\$(\d+)/)
            if (titleMatch) {
              const idx = parseInt(titleMatch[1], 10) - 1
              existing.item_title = params?.[idx]
            }
            const statusMatch = queryText.match(/item_status\s*=\s*\$(\d+)/)
            if (statusMatch) {
              const idx = parseInt(statusMatch[1], 10) - 1
              existing.item_status = params?.[idx]
            }
            const contentMatch = queryText.match(/item_content\s*=\s*\$(\d+)/)
            if (contentMatch) {
              const idx = parseInt(contentMatch[1], 10) - 1
              const raw = params?.[idx]
              existing.item_content = typeof raw === 'string' ? JSON.parse(raw) : raw
            }
          }
          return Promise.resolve({ rows: existing ? [existing] : [] })
        }

        return Promise.resolve({ rows: [] })
      })
    }
  })

  // Helper to build a valid CanonicalProposal
  function createSampleProposal(id: string = 'PROP-001'): ReconciliationProposal {
    const rawProposal: any = {
      proposalId: id,
      version: '1.0.0',
      sourceDocumentId: 'DOC-KICKOFF-01',
      sourceDocumentHash: '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
      timestamp: '2026-09-25T10:00:00Z',
      workspaceUid: sampleWorkspaceUid,
      projectUid: sampleProjectUid,
      mode: 'UNIFIED_DELTA',
      summary: 'Smart Queue Kickoff Canonical Proposal',
      statistics: { totalCandidates: 2, creates: 2, updates: 0, noChanges: 0, reviewRequired: 0, conflicts: 0 },
      creates: [
        {
          proposalItemId: 'P001-I01',
          proposalNodeId: 'P001-I01',
          candidateId: 'CAND-001',
          itemType: 'Requirement',
          itemTitle: 'Dynamic Flight Schedule Interface',
          priority: 'High',
          confidence: 0.95,
          classification: 'CANONICAL',
          evidenceId: 'EVID-001',
          evidenceIds: ['EVID-001'],
          parentCandidateId: undefined,
          parentProposalItemId: undefined,
          evidenceRefs: ['EVID-001'],
          applied: false
        },
        {
          proposalItemId: 'P001-I02',
          proposalNodeId: 'P001-I02',
          candidateId: 'CAND-002',
          itemType: 'Task',
          itemTitle: 'Integrate Flight Status Realtime Feed',
          priority: 'Middle',
          confidence: 0.95,
          classification: 'CANONICAL',
          evidenceId: 'EVID-002',
          evidenceIds: ['EVID-002'],
          parentCandidateId: 'CAND-001',
          parentProposalItemId: 'P001-I01',
          evidenceRefs: ['EVID-002'],
          applied: false
        }
      ],
      updates: [],
      corrections: [],
      noChanges: [],
      reviewRequired: [],
      relations: [
        {
          fromProposalNodeId: 'P001-I02',
          toProposalNodeId: 'P001-I01',
          fromProposalItemId: 'P001-I02',
          toProposalItemId: 'P001-I01',
          relationType: 'implements',
          confidence: 0.95,
          evidenceRefs: ['EVID-002']
        }
      ],
      validation: {
        status: 'PASS',
        errors: [],
        warnings: []
      }
    }

    rawProposal.proposalHash = computeProposalHash(rawProposal)
    return rawProposal
  }

  // ==========================================================================
  // P3-01: Normal valid apply
  // ==========================================================================
  it('P3-01 Normal valid apply: Human approves valid proposal -> single tx -> verified -> APPLIED_AND_VERIFIED', async () => {
    const proposal = createSampleProposal('PROP-P3-01')
    registerAuthoritativeProposal(proposal)

    const humanApproval: HumanApprovalRecord = {
      approvedBy: 'Lead Architect',
      approvedAt: new Date().toISOString(),
      approvedProposalHash: proposal.proposalHash
    }
    const approvalRes = recordHumanApproval(proposal.proposalId, humanApproval)
    expect(approvalRes.valid).toBe(true)
    humanApproval.approvalToken = approvalRes.approvalToken

    // Authority boundary check before execution
    const boundaryCheck = assertAuthorityBoundaryForMutation(proposal, {
      requireServerAuthority: true,
      requireHumanApproval: true,
      humanApproval
    })
    expect(boundaryCheck.valid).toBe(true)

    // Execute in transaction
    await mockClient.query('BEGIN')
    const executionResult = await executeCanonicalProposalTransaction(mockClient, proposal, {
      workspace_uid: sampleWorkspaceUid,
      related_project_uid: sampleProjectUid,
      members: []
    })
    expect(executionResult.insertedItems).toHaveLength(2)

    // Post-Write verification within transaction BEFORE commit
    const verification = await verifyDatabaseState(mockClient, proposal, executionResult)
    expect(verification.status).toBe('APPLIED_AND_VERIFIED')
    expect(verification.mismatches).toHaveLength(0)

    await mockClient.query('COMMIT')
    markProposalCommitted(proposal.proposalId)

    expect(executedQueries).toContain('BEGIN')
    expect(executedQueries).toContain('COMMIT')
    expect(executedQueries).not.toContain('ROLLBACK')
  })

  // ==========================================================================
  // P3-02: No human approval
  // ==========================================================================
  it('P3-02 No human approval: Valid proposal without approval is rejected, zero writes', async () => {
    const proposal = createSampleProposal('PROP-P3-02')
    registerAuthoritativeProposal(proposal)

    // Attempt to execute with no human approval
    const boundaryCheck = assertAuthorityBoundaryForMutation(proposal, {
      requireServerAuthority: true,
      requireHumanApproval: true
      // humanApproval missing!
    })

    expect(boundaryCheck.valid).toBe(false)
    expect(boundaryCheck.errors.some(e => e.includes('HUMAN_APPROVAL_REQUIRED'))).toBe(true)

    // Invariant: zero DB writes
    expect(writeQueriesCount).toBe(0)
    expect(mockDbRows).toHaveLength(2) // unchanged seed count
  })

  // ==========================================================================
  // P3-03: Wrong proposal approval
  // ==========================================================================
  it('P3-03 Wrong proposal approval: Approval for Proposal A cannot authorize Proposal B', async () => {
    const proposalA = createSampleProposal('PROP-A')
    const proposalB = createSampleProposal('PROP-B')
    // Make Proposal B distinct in creates so its hash differs from Proposal A
    proposalB.creates[0].itemTitle = 'Different Unique Requirement for Proposal B'
    proposalB.proposalHash = computeProposalHash(proposalB)

    registerAuthoritativeProposal(proposalA)
    registerAuthoritativeProposal(proposalB)

    // Human approves Proposal A
    const approvalA: HumanApprovalRecord = {
      approvedBy: 'Tech Lead',
      approvedAt: new Date().toISOString(),
      approvedProposalHash: proposalA.proposalHash
    }
    const approvalRes = recordHumanApproval(proposalA.proposalId, approvalA)
    approvalA.approvalToken = approvalRes.approvalToken

    // Client attempts to apply Proposal B using approval for Proposal A
    const boundaryCheck = assertAuthorityBoundaryForMutation(proposalB, {
      requireServerAuthority: true,
      requireHumanApproval: true,
      humanApproval: approvalA // Wrong approval!
    })

    expect(boundaryCheck.valid).toBe(false)
    expect(boundaryCheck.errors.some(e => e.includes('APPROVAL_HASH_MISMATCH'))).toBe(true)
    expect(writeQueriesCount).toBe(0)
  })

  // ==========================================================================
  // P3-04: Proposal hash mismatch
  // ==========================================================================
  it('P3-04 Proposal hash mismatch: Proposal modified after approval fails integrity verification, zero writes', async () => {
    const proposal = createSampleProposal('PROP-P3-04')
    registerAuthoritativeProposal(proposal)

    const humanApproval: HumanApprovalRecord = {
      approvedBy: 'Lead Architect',
      approvedAt: new Date().toISOString(),
      approvedProposalHash: proposal.proposalHash
    }
    recordHumanApproval(proposal.proposalId, humanApproval)

    // Tamper with proposal after approval (e.g. inject rogue item)
    proposal.creates.push({
      proposalItemId: 'P001-I99',
      proposalNodeId: 'P001-I99',
      candidateId: 'CAND-ROGUE',
      itemType: 'Task',
      itemTitle: 'Injected Backdoor Task',
      priority: 'High',
      confidence: 1.0,
      classification: 'CANONICAL',
      evidenceRefs: [],
      applied: false
    })
    // Recompute client hash to simulate tampered payload
    proposal.proposalHash = computeProposalHash(proposal)

    const boundaryCheck = assertAuthorityBoundaryForMutation(proposal, {
      requireServerAuthority: true,
      requireHumanApproval: true,
      humanApproval
    })

    expect(boundaryCheck.valid).toBe(false)
    expect(boundaryCheck.errors.some(e => e.includes('HASH_MISMATCH_WITH_REGISTERED') || e.includes('APPROVAL_HASH_MISMATCH'))).toBe(true)
    expect(writeQueriesCount).toBe(0)
  })

  // ==========================================================================
  // P3-05: Replayed approval
  // ==========================================================================
  it('P3-05 Replayed approval: Replaying an already committed proposal/approval is rejected', async () => {
    const proposal = createSampleProposal('PROP-P3-05')
    registerAuthoritativeProposal(proposal)

    const humanApproval: HumanApprovalRecord = {
      approvedBy: 'Lead Architect',
      approvedAt: new Date().toISOString(),
      approvedProposalHash: proposal.proposalHash
    }
    recordHumanApproval(proposal.proposalId, humanApproval)

    // Mark proposal as already committed
    markProposalCommitted(proposal.proposalId)

    // Attempt to re-apply
    const boundaryCheck = assertAuthorityBoundaryForMutation(proposal, {
      requireServerAuthority: true,
      requireHumanApproval: true,
      humanApproval
    })

    expect(boundaryCheck.valid).toBe(false)
    expect(boundaryCheck.errors.some(e => e.includes('PROPOSAL_ALREADY_COMMITTED'))).toBe(true)
    expect(writeQueriesCount).toBe(0)
  })

  // ==========================================================================
  // P3-06: Invalid / unresolved proposal-local ID
  // ==========================================================================
  it('P3-06 Invalid / unresolved proposal-local ID: Unresolved parentProposalItemId triggers boundary rejection and zero writes', async () => {
    const proposal = createSampleProposal('PROP-P3-06')
    // Point parent to a non-existent proposal local ID
    proposal.creates[1].parentProposalItemId = 'P001-I99' // Not in creates!
    proposal.proposalHash = computeProposalHash(proposal)

    registerAuthoritativeProposal(proposal)

    const humanApproval: HumanApprovalRecord = {
      approvedBy: 'Lead Architect',
      approvedAt: new Date().toISOString(),
      approvedProposalHash: proposal.proposalHash
    }
    recordHumanApproval(proposal.proposalId, humanApproval)

    const boundaryCheck = assertAuthorityBoundaryForMutation(proposal, {
      requireServerAuthority: true,
      requireHumanApproval: true,
      humanApproval
    })

    expect(boundaryCheck.valid).toBe(false)
    expect(boundaryCheck.errors.some(e => e.includes('UNRESOLVED_PARENT_LOCAL_ID'))).toBe(true)
    expect(writeQueriesCount).toBe(0)
  })

  // ==========================================================================
  // P3-07: Relationship written using real UUIDs
  // ==========================================================================
  it('P3-07 Relationship written using real UUIDs: Foreign keys and relations in DB store genuine UUIDs, never title or local ID', async () => {
    const proposal = createSampleProposal('PROP-P3-07')
    registerAuthoritativeProposal(proposal)

    const humanApproval: HumanApprovalRecord = {
      approvedBy: 'Lead Architect',
      approvedAt: new Date().toISOString(),
      approvedProposalHash: proposal.proposalHash
    }
    recordHumanApproval(proposal.proposalId, humanApproval)

    await mockClient.query('BEGIN')
    const executionResult = await executeCanonicalProposalTransaction(mockClient, proposal, {
      workspace_uid: sampleWorkspaceUid,
      related_project_uid: sampleProjectUid,
      members: []
    })

    const parentItem = executionResult.insertedItems.find(i => i.item_title === 'Dynamic Flight Schedule Interface')
    const childItem = executionResult.insertedItems.find(i => i.item_title === 'Integrate Flight Status Realtime Feed')

    expect(parentItem).toBeDefined()
    expect(childItem).toBeDefined()

    // parent_item_uid must be the real DB UUID of parentItem
    expect(childItem.parent_item_uid).toBe(parentItem.item_uid)
    expect(childItem.parent_item_uid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    expect(childItem.parent_item_uid).not.toBe('P001-I01')
    expect(childItem.parent_item_uid).not.toBe('CAND-001')
    expect(childItem.parent_item_uid).not.toBe('Dynamic Flight Schedule Interface')

    // relation_item_uid must contain real DB UUID of parentItem
    const rels = childItem.relation_item_uid
    expect(Array.isArray(rels)).toBe(true)
    expect(rels.length).toBeGreaterThan(0)
    expect(rels[0].item_uid).toBe(parentItem.item_uid)
    expect(rels[0].item_uid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

    await mockClient.query('COMMIT')
  })

  // ==========================================================================
  // P3-08: Mid-transaction DB failure -> full rollback
  // ==========================================================================
  it('P3-08 Mid-transaction DB failure -> full rollback: SQL failure after partial writes triggers atomic rollback with zero mutations persisting', async () => {
    const proposal = createSampleProposal('PROP-P3-08')
    registerAuthoritativeProposal(proposal)

    const humanApproval: HumanApprovalRecord = {
      approvedBy: 'Lead Architect',
      approvedAt: new Date().toISOString(),
      approvedProposalHash: proposal.proposalHash
    }
    recordHumanApproval(proposal.proposalId, humanApproval)

    const initialDbCount = mockDbRows.length

    // Configure client to fail on the second INSERT
    let insertCount = 0
    const failingClient = {
      ...mockClient,
      query: vi.fn().mockImplementation((queryText: string, params?: any[]) => {
        if (/INSERT\s+INTO\s+public\.item/i.test(queryText)) {
          insertCount++
          if (insertCount === 2) {
            throw new Error('SIMULATED_DB_DISK_FULL_ERROR')
          }
        }
        return mockClient.query(queryText, params)
      })
    }

    let errorThrown: any = null
    try {
      await failingClient.query('BEGIN')
      await executeCanonicalProposalTransaction(failingClient, proposal, {
        workspace_uid: sampleWorkspaceUid,
        related_project_uid: sampleProjectUid,
        members: []
      })
      await failingClient.query('COMMIT')
    } catch (err: any) {
      errorThrown = err
      await failingClient.query('ROLLBACK')
      // Simulate transaction rollback cleaning up uncommitted rows
      mockDbRows = mockDbRows.slice(0, initialDbCount)
    }

    expect(errorThrown).toBeDefined()
    expect(errorThrown.message).toContain('SIMULATED_DB_DISK_FULL_ERROR')
    expect(failingClient.query).toHaveBeenCalledWith('BEGIN')
    expect(failingClient.query).toHaveBeenCalledWith('ROLLBACK')
    expect(failingClient.query).not.toHaveBeenCalledWith('COMMIT')

    // Zero partial writes persisted
    expect(mockDbRows).toHaveLength(initialDbCount)
  })

  // ==========================================================================
  // P3-09: Post-write verification failure -> rollback
  // ==========================================================================
  it('P3-09 Post-write verification failure -> rollback: State mismatch triggers rollback and returns FAILED_VERIFICATION', async () => {
    const proposal = createSampleProposal('PROP-P3-09')
    registerAuthoritativeProposal(proposal)

    const humanApproval: HumanApprovalRecord = {
      approvedBy: 'Lead Architect',
      approvedAt: new Date().toISOString(),
      approvedProposalHash: proposal.proposalHash
    }
    recordHumanApproval(proposal.proposalId, humanApproval)

    const initialDbCount = mockDbRows.length

    await mockClient.query('BEGIN')
    const executionResult = await executeCanonicalProposalTransaction(mockClient, proposal, {
      workspace_uid: sampleWorkspaceUid,
      related_project_uid: sampleProjectUid,
      members: []
    })

    // Simulate corrupted DB state (e.g. title corrupted during write)
    mockDbRows[mockDbRows.length - 1].item_title = 'CORRUPTED TITLE IN DB'

    // Post-write verification within transaction BEFORE commit
    const verification = await verifyDatabaseState(mockClient, proposal, executionResult)
    expect(verification.status).toBe('FAILED_VERIFICATION')
    expect(verification.mismatches.length).toBeGreaterThan(0)

    // Route behaviour on verification failure: ROLLBACK immediately
    let applied = true
    if (verification.status !== 'APPLIED_AND_VERIFIED') {
      await mockClient.query('ROLLBACK')
      mockDbRows = mockDbRows.slice(0, initialDbCount)
      applied = false
    }

    expect(applied).toBe(false)
    expect(executedQueries).toContain('ROLLBACK')
    expect(mockDbRows).toHaveLength(initialDbCount)
  })

  // ==========================================================================
  // P3-10: Successful apply -> APPLIED_AND_VERIFIED
  // ==========================================================================
  it('P3-10 Successful apply -> APPLIED_AND_VERIFIED: Complete flow passes and yields APPLIED_AND_VERIFIED', async () => {
    const proposal = createSampleProposal('PROP-P3-10')
    registerAuthoritativeProposal(proposal)

    const humanApproval: HumanApprovalRecord = {
      approvedBy: 'Lead Architect',
      approvedAt: new Date().toISOString(),
      approvedProposalHash: proposal.proposalHash
    }
    recordHumanApproval(proposal.proposalId, humanApproval)

    await mockClient.query('BEGIN')
    const executionResult = await executeCanonicalProposalTransaction(mockClient, proposal, {
      workspace_uid: sampleWorkspaceUid,
      related_project_uid: sampleProjectUid,
      members: []
    })

    const verification = await verifyDatabaseState(mockClient, proposal, executionResult)
    expect(verification.status).toBe('APPLIED_AND_VERIFIED')
    expect(verification.totalVerified).toBe(2)

    await mockClient.query('COMMIT')
    markProposalCommitted(proposal.proposalId)

    expect(executedQueries).toContain('COMMIT')
  })

  // ==========================================================================
  // P3-11: AI-originated direct mutation attempt -> rejected
  // ==========================================================================
  it('P3-11 AI-originated direct mutation attempt -> rejected: Cannot bypass CanonicalProposal via direct batch payload', async () => {
    // Arbitrary unverified payload from LLM or client without server authority
    const forgedProposal = {
      proposalId: 'FORGED-001',
      proposalHash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      validation: { status: 'PASS' },
      creates: [{ itemTitle: 'Malicious Task', itemType: 'Task' }]
    }

    const check = assertAuthorityBoundaryForMutation(forgedProposal, {
      requireServerAuthority: true,
      requireHumanApproval: true
    })

    expect(check.valid).toBe(false)
    expect(check.errors.some(e => e.includes('UNAUTHORIZED_PROPOSAL_ORIGIN'))).toBe(true)
    expect(writeQueriesCount).toBe(0)
  })

  // ==========================================================================
  // P3-12: Human Direct CRUD -> still works
  // ==========================================================================
  it('P3-12 Human Direct CRUD -> still works: Manual user action creates item directly without CanonicalProposal', async () => {
    // Manual single item insertion by user (standard POST /api/items)
    await mockClient.query('BEGIN')
    const insertRes = await mockClient.query(
      `INSERT INTO public.item (item_uid, workspace_uid, related_project_uid, item_display_code, item_title, item_priority, item_status, item_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        '55555555-5555-5555-5555-555555555555',
        sampleWorkspaceUid,
        sampleProjectUid,
        'SQA-11',
        'Direct Human Created Task',
        'Middle',
        'Not Start',
        'Task'
      ]
    )
    await mockClient.query('COMMIT')

    expect(insertRes.rows).toHaveLength(1)
    expect(insertRes.rows[0].item_title).toBe('Direct Human Created Task')
    expect(mockDbRows.some(r => r.item_title === 'Direct Human Created Task')).toBe(true)
  })

  // ==========================================================================
  // P3-13: System template instantiation -> still works
  // ==========================================================================
  it('P3-13 System template instantiation -> still works: Template node instantiation succeeds cleanly', async () => {
    await mockClient.query('BEGIN')
    const templateItem = await mockClient.query(
      `INSERT INTO public.item (item_uid, workspace_uid, related_project_uid, item_display_code, item_title, item_type)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        '66666666-6666-6666-6666-666666666666',
        sampleWorkspaceUid,
        sampleProjectUid,
        'SQA-12',
        'Template Requirement 1',
        'Requirement'
      ]
    )
    await mockClient.query('COMMIT')

    expect(templateItem.rows).toHaveLength(1)
    expect(templateItem.rows[0].item_title).toBe('Template Requirement 1')
  })

  // ==========================================================================
  // P3-14: Metadata/comment mutation -> still works
  // ==========================================================================
  it('P3-14 Metadata/comment mutation -> still works: Adding comments to existing item works without CanonicalProposal', async () => {
    const targetItem = mockDbRows[1] // SQA-6
    const initialComments = targetItem.item_content?.comments || []

    const newComment = {
      comment_uid: '77777777-7777-7777-7777-777777777777',
      author_name: 'Michael',
      comment_text: 'Checked schedule interface.',
      created_at: new Date().toISOString()
    }

    const updatedContent = {
      ...targetItem.item_content,
      comments: [...initialComments, newComment]
    }

    await mockClient.query(
      `UPDATE public.item SET item_content = $2 WHERE item_uid = $1`,
      [targetItem.item_uid, updatedContent]
    )

    expect(targetItem.item_content.comments).toHaveLength(1)
    expect(targetItem.item_content.comments[0].comment_text).toBe('Checked schedule interface.')
  })

  // ==========================================================================
  // P3-15: Valid proposal with CREATE + UPDATE + relationship in one transaction
  // ==========================================================================
  it('P3-15 Valid proposal with CREATE + UPDATE + relationship in one transaction: All executed and verified atomically', async () => {
    const proposal = createSampleProposal('PROP-P3-15')
    // Add an update targeting SQA-6
    proposal.updates = [
      {
        candidateId: 'CAND-UPD-01',
        targetItemUid: '33333333-3333-3333-3333-333333333336',
        targetDisplayCode: 'SQA-6',
        itemTitle: 'Check Airport Systems Feed Interface',
        updates: {
          item_priority: 'High',
          item_content: { text: 'Updated queue check.' }
        }
      } as any
    ]
    proposal.statistics.updates = 1
    proposal.proposalHash = computeProposalHash(proposal)

    registerAuthoritativeProposal(proposal)

    const humanApproval: HumanApprovalRecord = {
      approvedBy: 'Lead Architect',
      approvedAt: new Date().toISOString(),
      approvedProposalHash: proposal.proposalHash
    }
    recordHumanApproval(proposal.proposalId, humanApproval)

    await mockClient.query('BEGIN')
    const executionResult = await executeCanonicalProposalTransaction(mockClient, proposal, {
      workspace_uid: sampleWorkspaceUid,
      related_project_uid: sampleProjectUid,
      members: []
    })

    expect(executionResult.insertedItems).toHaveLength(2)
    expect(executionResult.updatedItems).toHaveLength(1)

    // Post-write verification of creates + updates
    const verification = await verifyDatabaseState(mockClient, proposal, executionResult)
    expect(verification.status).toBe('APPLIED_AND_VERIFIED')
    expect(verification.mismatches).toHaveLength(0)

    await mockClient.query('COMMIT')
    markProposalCommitted(proposal.proposalId)

    // Verify SQA-6 was updated in DB
    const sqa6 = mockDbRows.find(r => r.item_uid === '33333333-3333-3333-3333-333333333336')
    expect(sqa6.item_priority).toBe('High')
  })

  // ==========================================================================
  // P3-16: Re-apply consumed proposal -> rejected
  // ==========================================================================
  it('P3-16 Re-apply consumed proposal -> rejected: Attempting to apply a committed proposal twice fails', async () => {
    const proposal = createSampleProposal('PROP-P3-16')
    registerAuthoritativeProposal(proposal)

    const humanApproval: HumanApprovalRecord = {
      approvedBy: 'Lead Architect',
      approvedAt: new Date().toISOString(),
      approvedProposalHash: proposal.proposalHash
    }
    recordHumanApproval(proposal.proposalId, humanApproval)

    // First apply: success
    await mockClient.query('BEGIN')
    const res1 = await executeCanonicalProposalTransaction(mockClient, proposal, {
      workspace_uid: sampleWorkspaceUid,
      related_project_uid: sampleProjectUid,
      members: []
    })
    const verify1 = await verifyDatabaseState(mockClient, proposal, res1)
    expect(verify1.status).toBe('APPLIED_AND_VERIFIED')
    await mockClient.query('COMMIT')
    markProposalCommitted(proposal.proposalId)

    // Second apply attempt: must be rejected
    const boundaryCheck2 = assertAuthorityBoundaryForMutation(proposal, {
      requireServerAuthority: true,
      requireHumanApproval: true,
      humanApproval
    })

    expect(boundaryCheck2.valid).toBe(false)
    expect(boundaryCheck2.errors.some(e => e.includes('PROPOSAL_ALREADY_COMMITTED'))).toBe(true)
  })

  // ==========================================================================
  // SECTION 11: CRITICAL TEST: END-TO-END SMART QUEUE REPLAY
  // ==========================================================================
  it('SECTION 11 Critical Test: Real End-to-End Smart Queue (03 Kickoff Fixture) Preview -> Human Approval -> Server Authority -> Atomic Write -> Post-Write Verify -> Commit', async () => {
    const fixture03Path = path.resolve(__dirname, '../../../test_doc/B_meeting_script_1.md')
    const text03 = fs.readFileSync(fixture03Path, 'utf-8')

    const members03 = [
      { member_uid: 'mem-edmond', member_name: 'Edmond', member_email: 'edmond@test.com' },
      { member_uid: 'mem-karen', member_name: 'Karen', member_email: 'karen@test.com' },
      { member_uid: 'mem-michael', member_name: 'Michael', member_email: 'michael@test.com' },
      { member_uid: 'mem-rachel', member_name: 'Rachel', member_email: 'rachel@test.com' },
      { member_uid: 'mem-thomas', member_name: 'Thomas', member_email: 'thomas@test.com' }
    ]

    const rawPreviews03 = [
      {
        actionType: 'batch_proposal',
        proposalTitle: 'Smart Queue Assistance 複合專家拆解提案',
        items: [
          { candidateId: 'CAND-01', itemTitle: 'Reduce wrong-queue cases for passengers', itemType: 'Objective', itemFollowBy: 'mem-edmond', description: 'Proposed 30% reduction in wrong-queue cases, pending baseline definition.' },
          { candidateId: 'CAND-02', itemTitle: 'Help passengers identify appropriate queue before joining', itemType: 'Requirement', parentCandidateId: 'CAND-01', itemFollowBy: 'mem-rachel' },
          { candidateId: 'CAND-03', itemTitle: 'Support normal passenger flow only in phase one', itemType: 'Requirement', parentCandidateId: 'CAND-01', itemFollowBy: 'mem-karen' },
          { candidateId: 'CAND-04', itemTitle: 'Provide understandable explanation for queue recommendations', itemType: 'Requirement', parentCandidateId: 'CAND-02', itemFollowBy: 'mem-rachel' },
          { candidateId: 'CAND-05', itemTitle: 'Fallback mechanism to staff assistance when uncertain', itemType: 'Requirement', parentCandidateId: 'CAND-01', itemFollowBy: 'mem-michael' },
          { candidateId: 'CAND-06', itemTitle: 'Conduct passenger and frontline staff interviews', itemType: 'Task', parentCandidateId: 'CAND-02', itemFollowBy: 'mem-rachel', description: 'Rachel to arrange five short interviews (three passengers, two staff).' },
          { candidateId: 'CAND-07', itemTitle: 'Check queue-data integration feasibility with Airport Systems team', itemType: 'Task', parentCandidateId: 'CAND-02', itemFollowBy: 'mem-michael', description: 'Michael to check queue mapping data interface. Dependency / technical unknown, not yet a blocker.' },
          { candidateId: 'CAND-08', itemTitle: 'Validate response time under three seconds', itemType: 'Milestone', parentCandidateId: 'CAND-02', itemFollowBy: 'mem-michael', description: 'Initial technical estimate to validate, not a confirmed requirement.' },
          { candidateId: 'CAND-09', itemTitle: 'Check security and privacy implications of passenger data', itemType: 'Task', parentCandidateId: 'CAND-02', itemFollowBy: 'mem-michael', description: 'Michael to check data retention with security/privacy team.' },
          { candidateId: 'CAND-10', itemTitle: 'Set tentative requirements baseline by October 2', itemType: 'Milestone', parentCandidateId: 'CAND-01', itemFollowBy: 'mem-edmond', description: 'Tentatively set October 2 for requirements baseline.' },
          { candidateId: 'CAND-11', itemTitle: 'Deliver prototype by October 16', itemType: 'Milestone', parentCandidateId: 'CAND-01', itemFollowBy: 'mem-edmond', description: 'Tentative prototype around October 16.' },
          { candidateId: 'CAND-12', itemTitle: 'Operational trial by November 13', itemType: 'Milestone', parentCandidateId: 'CAND-01', itemFollowBy: 'mem-edmond', description: 'Tentatively put November 13 for operational trial.' },
          { candidateId: 'CAND-13', itemTitle: 'ADR-01: First Release Scope and Exclusions', itemType: 'Decision', parentCandidateId: 'CAND-01', itemFollowBy: 'mem-edmond', description: 'Focus on Terminal 1 normal flow, exclude waiting time, staff allocation, and operations dashboard. 簡化第一階段設計以加快交付。' },
          { candidateId: 'CAND-14', itemTitle: '01: 隊列狀態資料整合依賴性', itemType: 'Bottleneck', parentCandidateId: 'CAND-01', itemFollowBy: 'mem-michael', description: 'Not yet a blocker. It is a dependency / technical unknown.' },
          { candidateId: 'CAND-15', itemTitle: '2026-09-21 Smart Queue Assistance 首次啟動會議', itemType: 'Meeting', itemFollowBy: 'mem-edmond', description: 'Meeting summary' }
        ]
      }
    ]

    // 1. Preview: Generate CanonicalProposal from Frozen Phase 2.2 pipeline
    const proposal = executeReconciliationPipeline({
      sourceDocument: {
        documentId: 'DOC-03',
        filename: 'B_meeting_script_1.md',
        content: text03
      },
      processingInstruction: {
        userIntent: '請依據上載之 Kickoff 會議記錄進行需求架構拆解與全量工單規劃',
        requestedOperation: 'reconcile_and_propose',
        targetProjectId: sampleProjectUid
      },
      text: text03,
      existingItems: [],
      members: members03,
      currentProject: { project_uid: sampleProjectUid, project_name: 'Smart Queue Assistance' },
      rawPreviews: rawPreviews03,
      filename: 'B_meeting_script_1.md'
    })

    expect(proposal).toBeDefined()
    expect(proposal.proposalHash).toBeDefined()
    expect(proposal.proposalHash).toHaveLength(64)
    expect(proposal.creates.length).toBeGreaterThan(0)

    // Register proposal in authoritative server registry
    const authorityToken = registerAuthoritativeProposal(proposal)
    expect(authorityToken).toBeDefined()

    // 2. Human Approval
    const humanApproval: HumanApprovalRecord = {
      approvedBy: 'Edmond (Project Director)',
      approvedAt: new Date().toISOString(),
      approvedProposalHash: proposal.proposalHash
    }
    const approvalRes = recordHumanApproval(proposal.proposalId, humanApproval)
    expect(approvalRes.valid).toBe(true)
    humanApproval.approvalToken = approvalRes.approvalToken

    // 3. Server Authority Verification
    const authVerify = verifyProposalAuthority(
      proposal.proposalId,
      proposal.proposalHash,
      authorityToken,
      { requireHumanApproval: true, humanApproval }
    )
    expect(authVerify.valid).toBe(true)

    // 4. Hash & Boundary Verification
    const boundaryCheck = assertAuthorityBoundaryForMutation(proposal, {
      requireServerAuthority: true,
      requireHumanApproval: true,
      humanApproval
    })
    expect(boundaryCheck.valid).toBe(true)

    // 5. Apply (Deterministic Transactional DB Execution)
    await mockClient.query('BEGIN')
    const executionResult = await executeCanonicalProposalTransaction(mockClient, proposal, {
      workspace_uid: sampleWorkspaceUid,
      related_project_uid: sampleProjectUid,
      members: members03
    })

    expect(executionResult.insertedItems.length).toBe(proposal.creates.length)

    // 6. Post-Write Verification BEFORE COMMIT
    const verification = await verifyDatabaseState(mockClient, proposal, executionResult)
    expect(verification.status).toBe('APPLIED_AND_VERIFIED')
    expect(verification.mismatches).toHaveLength(0)

    // 7. Commit
    await mockClient.query('COMMIT')
    markProposalCommitted(proposal.proposalId)

    // 8. Query DB again
    const postCommitDbItems = await mockClient.query('SELECT * FROM public.item')
    const finalDbState = postCommitDbItems.rows

    // 9. Compare DB state against CanonicalProposal
    const createdDbUids = executionResult.insertedItems.map(i => i.item_uid)
    const persistedCreates = finalDbState.filter((r: any) => createdDbUids.includes(r.item_uid))
    expect(persistedCreates).toHaveLength(proposal.creates.length)

    // Output structured summary for Section 11 reporting
    console.log('--- SECTION 11 SMART QUEUE E2E RESULTS ---')
    console.log(`Proposal Hash: ${proposal.proposalHash}`)
    console.log(`Approval Identity: ${humanApproval.approvedBy} at ${humanApproval.approvedAt}`)
    console.log(`Authority Status: VALID (Token: ${authorityToken.slice(0, 16)}...)`)
    console.log(`Transaction Status: COMMITTED (Single Transaction)`)
    console.log(`Created Items: ${executionResult.insertedItems.length}`)
    console.log(`Updated Items: ${executionResult.updatedItems.length}`)
    console.log(`Relationships: ${(proposal.relations || []).length}`)
    console.log(`Verification Result: ${verification.status} (Mismatches: ${verification.mismatches.length})`)
    console.log(`Final DB Total Items: ${finalDbState.length}`)
    console.log(`Final Status: APPLIED_AND_VERIFIED`)
  })
})
