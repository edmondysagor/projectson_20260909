/**
 * ============================================================================
 * PROJECTSON — PHASE 3.1: REAL POSTGRESQL INTEGRATION VERIFICATION TEST SUITE
 *
 * Replaces simulated mockClient tests with direct, live PostgreSQL integration.
 * Enforces Architectural Invariants:
 * 1. AI MAY PROPOSE, HUMANS APPROVE.
 * 2. ONLY VALIDATED CANONICAL PROPOSALS MAY MUTATE MEMORY.
 * 3. ALL MUTATIONS ARE TRANSACTIONAL (BEGIN -> EXECUTE -> VERIFY -> COMMIT/ROLLBACK).
 * 4. VERIFICATION MUST PASS BEFORE COMMIT.
 * 5. ALL RELATIONSHIPS MUST RESOLVE TO REAL DB UUIDs (NO NATURAL LANGUAGE TITLES).
 * 6. UNSPECIFIED != DEFAULT (PREVENT ACCIDENTAL FIELD OVERWRITES).
 * 7. ZERO PARTIAL WRITES ON ANY ERROR.
 * ============================================================================
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Pool, PoolClient } from 'pg'
import dotenv from 'dotenv'

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

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('PROJECTSON — Phase 3.1 Real PostgreSQL Integration Suite', () => {
  let pool: Pool
  let testWorkspaceUid: string
  let testProjectUid: string
  let testPrefixCode: string
  let testMemberUid: string
  let testMemberMichaelUid: string

  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })

    // Probe connection
    const res = await pool.query('SELECT current_database(), current_user, version()')
    expect(res.rows.length).toBe(1)
  })

  afterAll(async () => {
    // Teardown: Clean up test workspace and all cascades
    if (testWorkspaceUid) {
      await pool.query('DELETE FROM public.workspace WHERE workspace_uid = $1', [testWorkspaceUid])
    }
    if (testMemberUid) {
      await pool.query('DELETE FROM public.member WHERE member_uid = $1', [testMemberUid])
    }
    if (testMemberMichaelUid) {
      await pool.query('DELETE FROM public.member WHERE member_uid = $1', [testMemberMichaelUid])
    }
    await pool.end()
  })

  beforeEach(async () => {
    clearProposalRegistry()

    // Create unique isolated test prefix and test entities
    const rand = Math.floor(Math.random() * 900000 + 100000)
    testPrefixCode = `T${rand}`.substring(0, 8)

    // Clean up any prior test workspace
    if (testWorkspaceUid) {
      await pool.query('DELETE FROM public.workspace WHERE workspace_uid = $1', [testWorkspaceUid])
    }
    if (testMemberUid) {
      await pool.query('DELETE FROM public.member WHERE member_uid = $1', [testMemberUid])
    }
    if (testMemberMichaelUid) {
      await pool.query('DELETE FROM public.member WHERE member_uid = $1', [testMemberMichaelUid])
    }

    // 1. Create isolated test workspace
    const wsRes = await pool.query(
      `INSERT INTO public.workspace (
        prefix_code,
        workspace_name,
        last_item_number,
        last_project_number,
        allow_access_member
      ) VALUES ($1, $2, 0, 1, '[]'::jsonb)
      RETURNING workspace_uid, prefix_code`,
      [testPrefixCode, `Test Workspace ${testPrefixCode}`]
    )
    testWorkspaceUid = wsRes.rows[0].workspace_uid

    // 2. Create isolated test project
    const prjRes = await pool.query(
      `INSERT INTO public.project (
        project_name,
        project_display_code,
        project_number,
        project_type,
        related_workspace_uid,
        project_status,
        project_content,
        project_update_log,
        allow_access_member
      ) VALUES ($1, $2, 1, 'Project', $3, 'Active', '{}'::jsonb, '[]'::jsonb, '[]'::jsonb)
      RETURNING project_uid`,
      [`Test Project ${testPrefixCode}`, `PRJ-${testPrefixCode}`, testWorkspaceUid]
    )
    testProjectUid = prjRes.rows[0].project_uid

    // 3. Create test members
    const memRes1 = await pool.query(
      `INSERT INTO public.member (
        member_name,
        member_email
      ) VALUES ($1, $2)
      RETURNING member_uid`,
      ['Test Admin', `admin_${testPrefixCode}@example.com`]
    )
    testMemberUid = memRes1.rows[0].member_uid

    const memRes2 = await pool.query(
      `INSERT INTO public.member (
        member_name,
        member_email
      ) VALUES ($1, $2)
      RETURNING member_uid`,
      ['Michael Green', `michael_${testPrefixCode}@example.com`]
    )
    testMemberMichaelUid = memRes2.rows[0].member_uid
  })

  // ==========================================================================
  // SECTION 3: MANDATORY TEST CASES (P3.1-01 through P3.1-10)
  // ==========================================================================

  it('P3.1-01: Valid apply with CREATE + UPDATE + relationship commit inside single transaction', async () => {
    // 1. Seed an existing item for UPDATE
    const seedRes = await pool.query(
      `INSERT INTO public.item (
        item_display_code,
        prefix_code,
        item_number,
        item_title,
        related_project_uid,
        workspace_uid,
        item_type,
        item_status,
        item_priority,
        item_content,
        relation_item_uid,
        item_attribute
      ) VALUES ($1, $2, 1, 'Existing Architecture Item', $3, $4, 'Task', 'Not Start', 'Low', '{"text":"Initial"}'::jsonb, '[]'::jsonb, '{}'::jsonb)
      RETURNING item_uid, item_display_code`,
      [`${testPrefixCode}-1`, testPrefixCode, testProjectUid, testWorkspaceUid]
    )
    const existingUid = seedRes.rows[0].item_uid

    // Update workspace sequence
    await pool.query('UPDATE public.workspace SET last_item_number = 1 WHERE workspace_uid = $1', [testWorkspaceUid])

    // 2. Build CanonicalProposal
    const proposal: ReconciliationProposal = {
      proposalId: 'PROP-P31-01',
      proposalVersion: 1,
      mode: 'NORMAL',
      sourceDocumentId: 'DOC-P31-01',
      sourceDocumentHash: 'hash-p31-01',
      createdAt: new Date().toISOString(),
      evidence: [
        {
          evidenceId: 'EV-01',
          evidenceType: 'EXPLICIT_REQUIREMENT',
          sourceSnippet: 'Deploy smart queue microservice with high priority',
          confidence: 1.0,
          semanticClassification: 'DIRECT_QUOTE',
          commitmentStatus: 'CONFIRMED'
        },
        {
          evidenceId: 'EV-02',
          evidenceType: 'EXPLICIT_TASK',
          sourceSnippet: 'Update architecture item priority to High',
          confidence: 1.0,
          semanticClassification: 'DIRECT_QUOTE',
          commitmentStatus: 'CONFIRMED'
        }
      ],
      items: [
        {
          proposalItemId: 'P31-I01',
          action: 'CREATE',
          targetCandidateId: 'CAND-01',
          itemType: 'Task',
          itemTitle: 'Deploy Smart Queue Service',
          itemPriority: 'High',
          evidenceIds: ['EV-01'],
          sourceEvidence: 'Deploy smart queue microservice with high priority'
        },
        {
          proposalItemId: 'P31-I02',
          action: 'UPDATE',
          targetCandidateId: 'CAND-02',
          targetItemUid: existingUid,
          itemType: 'Task',
          itemTitle: 'Existing Architecture Item',
          patch: {
            item_priority: 'High',
            item_status: 'In Progress'
          },
          evidenceIds: ['EV-02'],
          sourceEvidence: 'Update architecture item priority to High'
        }
      ],
      creates: [
        {
          proposalItemId: 'P31-I01',
          candidateId: 'CAND-01',
          itemType: 'Task',
          itemTitle: 'Deploy Smart Queue Service',
          itemPriority: 'High',
          action: 'CREATE',
          sourceEvidence: 'Deploy smart queue microservice with high priority',
          evidenceIds: ['EV-01']
        }
      ],
      updates: [
        {
          targetItemUid: existingUid,
          candidateId: 'CAND-02',
          action: 'UPDATE',
          updates: {
            item_priority: 'High',
            item_status: 'In Progress'
          },
          sourceEvidence: 'Update architecture item priority to High',
          evidenceIds: ['EV-02']
        }
      ],
      relations: [
        {
          fromProposalItemId: 'P31-I01',
          toProposalItemId: existingUid,
          relationType: 'relates_to'
        }
      ],
      corrections: [],
      validation: { status: 'PASS', errors: [] },
      summary: 'P3.1-01 Test'
    }

    const hash = computeProposalHash(proposal)
    proposal.proposalHash = hash

    registerAuthoritativeProposal(proposal)
    const humanApproval: HumanApprovalRecord = {
      approvedBy: 'lead-pm@example.com',
      approvedAt: new Date().toISOString(),
      approvedProposalHash: hash
    }
    recordHumanApproval(proposal.proposalId, humanApproval)

    // Execute via real PostgreSQL transaction
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const executionResult = await executeCanonicalProposalTransaction(client, proposal, {
        workspace_uid: testWorkspaceUid,
        related_project_uid: testProjectUid,
        members: [{ member_uid: testMemberUid, member_name: 'Test Admin' }]
      })

      const verification = await verifyDatabaseState(client, proposal, executionResult)
      expect(verification.status).toBe('APPLIED_AND_VERIFIED')
      expect(verification.mismatches.length).toBe(0)

      await client.query('COMMIT')
      markProposalCommitted(proposal.proposalId)
    } finally {
      client.release()
    }

    // 3. Verify on a BRAND NEW independent connection from the pool
    const newClient = await pool.connect()
    try {
      const createdRes = await newClient.query(
        `SELECT item_uid, item_display_code, item_title, item_priority, item_status, relation_item_uid 
         FROM public.item 
         WHERE workspace_uid = $1 AND item_title = $2`,
        [testWorkspaceUid, 'Deploy Smart Queue Service']
      )
      expect(createdRes.rows.length).toBe(1)
      const createdRow = createdRes.rows[0]
      expect(createdRow.item_display_code).toBe(`${testPrefixCode}-2`)
      expect(createdRow.item_priority).toBe('High')
      expect(createdRow.item_status).toBe('Not Start')

      // Verify relation points to real DB UUID
      const relations = createdRow.relation_item_uid
      expect(relations.length).toBe(1)
      expect(relations[0].item_uid).toBe(existingUid)
      expect(relations[0].relation).toBe('relates_to')

      // Verify updated existing item
      const updatedRes = await newClient.query(
        `SELECT item_uid, item_priority, item_status FROM public.item WHERE item_uid = $1`,
        [existingUid]
      )
      expect(updatedRes.rows[0].item_priority).toBe('High')
      expect(updatedRes.rows[0].item_status).toBe('In Progress')
    } finally {
      newClient.release()
    }
  })

  it('P3.1-02: Mid-transaction failure -> ROLLBACK -> new connection sees 0 partial writes', async () => {
    const preCountRes = await pool.query(
      `SELECT count(*) FROM public.item WHERE workspace_uid = $1`,
      [testWorkspaceUid]
    )
    const preCount = parseInt(preCountRes.rows[0].count, 10)

    const client = await pool.connect()
    let errorCaught = false
    try {
      await client.query('BEGIN')

      // 1. Valid insert
      await client.query(
        `INSERT INTO public.item (
          item_display_code,
          prefix_code,
          item_number,
          item_title,
          related_project_uid,
          workspace_uid,
          item_type,
          item_status,
          item_priority
        ) VALUES ($1, $2, 99, 'Mid Transaction Row 1', $3, $4, 'Task', 'Not Start', 'Middle')`,
        [`${testPrefixCode}-99`, testPrefixCode, testProjectUid, testWorkspaceUid]
      )

      // 2. Trigger check constraint violation on item_type
      await client.query(
        `INSERT INTO public.item (
          item_display_code,
          prefix_code,
          item_number,
          item_title,
          related_project_uid,
          workspace_uid,
          item_type,
          item_status,
          item_priority
        ) VALUES ($1, $2, 100, 'Invalid Row', $3, $4, 'NON_EXISTENT_INVALID_TYPE', 'Not Start', 'Middle')`,
        [`${testPrefixCode}-100`, testPrefixCode, testProjectUid, testWorkspaceUid]
      )

      await client.query('COMMIT')
    } catch (err) {
      errorCaught = true
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }

    expect(errorCaught).toBe(true)

    // Verify on independent connection: 0 partial writes
    const postCountRes = await pool.query(
      `SELECT count(*) FROM public.item WHERE workspace_uid = $1`,
      [testWorkspaceUid]
    )
    const postCount = parseInt(postCountRes.rows[0].count, 10)
    expect(postCount).toBe(preCount)
  })

  it('P3.1-03: Post-write verification mismatch -> ROLLBACK -> 0 rows written', async () => {
    const proposal: ReconciliationProposal = {
      proposalId: 'PROP-P31-03',
      proposalVersion: 1,
      mode: 'NORMAL',
      sourceDocumentId: 'DOC-P31-03',
      sourceDocumentHash: 'hash-p31-03',
      createdAt: new Date().toISOString(),
      evidence: [
        {
          evidenceId: 'EV-01',
          evidenceType: 'EXPLICIT_REQUIREMENT',
          sourceSnippet: 'Deploy monitoring dashboard with middle priority',
          confidence: 1.0,
          semanticClassification: 'DIRECT_QUOTE',
          commitmentStatus: 'CONFIRMED'
        }
      ],
      items: [
        {
          proposalItemId: 'P31-I03',
          action: 'CREATE',
          targetCandidateId: 'CAND-03',
          itemType: 'Task',
          itemTitle: 'Deploy Monitoring Dashboard',
          itemPriority: 'Middle',
          evidenceIds: ['EV-01'],
          sourceEvidence: 'Deploy monitoring dashboard with middle priority'
        }
      ],
      creates: [
        {
          proposalItemId: 'P31-I03',
          candidateId: 'CAND-03',
          itemType: 'Task',
          itemTitle: 'Deploy Monitoring Dashboard',
          itemPriority: 'Middle',
          action: 'CREATE',
          sourceEvidence: 'Deploy monitoring dashboard with middle priority',
          evidenceIds: ['EV-01']
        }
      ],
      updates: [],
      relations: [],
      corrections: [],
      validation: { status: 'PASS', errors: [] },
      summary: 'P3.1-03 Mismatch Test'
    }

    const hash = computeProposalHash(proposal)
    proposal.proposalHash = hash
    registerAuthoritativeProposal(proposal)
    recordHumanApproval(proposal.proposalId, {
      approvedBy: 'lead-pm@example.com',
      approvedAt: new Date().toISOString(),
      approvedProposalHash: hash
    })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const executionResult = await executeCanonicalProposalTransaction(client, proposal, {
        workspace_uid: testWorkspaceUid,
        related_project_uid: testProjectUid,
        members: []
      })

      // Simulate mismatch by altering expected item title in verification
      const alteredProposal = {
        ...proposal,
        creates: [
          {
            ...proposal.creates[0],
            itemTitle: 'Altered Title Expectation'
          }
        ]
      }

      const verification = await verifyDatabaseState(client, alteredProposal, executionResult)
      expect(verification.status).toBe('FAILED_VERIFICATION')
      expect(verification.mismatches.length).toBeGreaterThan(0)

      // Invariant: On mismatch, ROLLBACK must occur
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }

    // Verify on brand new connection: 0 rows written
    const verifyRes = await pool.query(
      `SELECT count(*) FROM public.item WHERE workspace_uid = $1 AND item_title = $2`,
      [testWorkspaceUid, 'Deploy Monitoring Dashboard']
    )
    expect(parseInt(verifyRes.rows[0].count, 10)).toBe(0)
  })

  it('P3.1-04: Relationship and parent foreign key integrity (UUIDs only, no titles, real DB rows)', async () => {
    const proposal: ReconciliationProposal = {
      proposalId: 'PROP-P31-04',
      proposalVersion: 1,
      mode: 'NORMAL',
      sourceDocumentId: 'DOC-P31-04',
      sourceDocumentHash: 'hash-p31-04',
      createdAt: new Date().toISOString(),
      evidence: [
        {
          evidenceId: 'EV-01',
          evidenceType: 'EXPLICIT_REQUIREMENT',
          sourceSnippet: 'Epic: Passenger Flow Management with high priority',
          confidence: 1.0,
          semanticClassification: 'DIRECT_QUOTE',
          commitmentStatus: 'CONFIRMED'
        },
        {
          evidenceId: 'EV-02',
          evidenceType: 'EXPLICIT_TASK',
          sourceSnippet: 'Task: Install camera sensors with middle priority',
          confidence: 1.0,
          semanticClassification: 'DIRECT_QUOTE',
          commitmentStatus: 'CONFIRMED'
        }
      ],
      items: [
        {
          proposalItemId: 'P31-I04-1',
          action: 'CREATE',
          targetCandidateId: 'CAND-EPIC',
          itemType: 'Epic',
          itemTitle: 'Passenger Flow Management',
          itemPriority: 'High',
          evidenceIds: ['EV-01'],
          sourceEvidence: 'Epic: Passenger Flow Management with high priority'
        },
        {
          proposalItemId: 'P31-I04-2',
          action: 'CREATE',
          targetCandidateId: 'CAND-TASK',
          itemType: 'Task',
          itemTitle: 'Install Camera Sensors',
          itemPriority: 'Middle',
          parentCandidateId: 'CAND-EPIC',
          evidenceIds: ['EV-02'],
          sourceEvidence: 'Task: Install camera sensors with middle priority'
        }
      ],
      creates: [
        {
          proposalItemId: 'P31-I04-1',
          candidateId: 'CAND-EPIC',
          itemType: 'Epic',
          itemTitle: 'Passenger Flow Management',
          itemPriority: 'High',
          action: 'CREATE',
          sourceEvidence: 'Epic: Passenger Flow Management with high priority',
          evidenceIds: ['EV-01']
        },
        {
          proposalItemId: 'P31-I04-2',
          candidateId: 'CAND-TASK',
          itemType: 'Task',
          itemTitle: 'Install Camera Sensors',
          itemPriority: 'Middle',
          parentCandidateId: 'CAND-EPIC',
          action: 'CREATE',
          sourceEvidence: 'Task: Install camera sensors with middle priority',
          evidenceIds: ['EV-02']
        }
      ],
      updates: [],
      relations: [
        {
          fromProposalItemId: 'P31-I04-2',
          toProposalItemId: 'P31-I04-1',
          relationType: 'child_of'
        }
      ],
      corrections: [],
      validation: { status: 'PASS', errors: [] },
      summary: 'P3.1-04 Test'
    }

    const hash = computeProposalHash(proposal)
    proposal.proposalHash = hash
    registerAuthoritativeProposal(proposal)
    recordHumanApproval(proposal.proposalId, {
      approvedBy: 'lead-pm@example.com',
      approvedAt: new Date().toISOString(),
      approvedProposalHash: hash
    })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const executionResult = await executeCanonicalProposalTransaction(client, proposal, {
        workspace_uid: testWorkspaceUid,
        related_project_uid: testProjectUid,
        members: []
      })
      const verification = await verifyDatabaseState(client, proposal, executionResult)
      expect(verification.status).toBe('APPLIED_AND_VERIFIED')
      await client.query('COMMIT')
      markProposalCommitted(proposal.proposalId)
    } finally {
      client.release()
    }

    // Verify on independent connection
    const newClient = await pool.connect()
    try {
      const epicRes = await newClient.query(
        `SELECT item_uid, item_display_code FROM public.item WHERE workspace_uid = $1 AND item_title = $2`,
        [testWorkspaceUid, 'Passenger Flow Management']
      )
      const taskRes = await newClient.query(
        `SELECT item_uid, parent_item_uid, relation_item_uid FROM public.item WHERE workspace_uid = $1 AND item_title = $2`,
        [testWorkspaceUid, 'Install Camera Sensors']
      )

      expect(epicRes.rows.length).toBe(1)
      expect(taskRes.rows.length).toBe(1)

      const epicUid = epicRes.rows[0].item_uid
      const taskRow = taskRes.rows[0]

      // 1. parent_item_uid MUST match real DB UUID of Epic
      expect(taskRow.parent_item_uid).toBe(epicUid)
      expect(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskRow.parent_item_uid)).toBe(true)

      // 2. relation_item_uid MUST contain real DB UUID
      const rels = taskRow.relation_item_uid
      expect(rels.length).toBe(1)
      expect(rels[0].item_uid).toBe(epicUid)
      expect(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rels[0].item_uid)).toBe(true)
    } finally {
      newClient.release()
    }
  })

  it('P3.1-05: Rejection of invalid / unresolved proposal-local ID', async () => {
    const proposal: ReconciliationProposal = {
      proposalId: 'PROP-P31-05',
      proposalVersion: 1,
      mode: 'NORMAL',
      sourceDocumentId: 'DOC-P31-05',
      sourceDocumentHash: 'hash-p31-05',
      createdAt: new Date().toISOString(),
      evidence: [
        {
          evidenceId: 'EV-01',
          evidenceType: 'EXPLICIT_TASK',
          sourceSnippet: 'Dangling task',
          confidence: 1.0,
          semanticClassification: 'DIRECT_QUOTE',
          commitmentStatus: 'CONFIRMED'
        }
      ],
      items: [
        {
          proposalItemId: 'P31-I05',
          action: 'CREATE',
          targetCandidateId: 'CAND-DANGLING',
          itemType: 'Task',
          itemTitle: 'Dangling Task',
          parentProposalItemId: 'P999-I99', // NON-EXISTENT
          evidenceIds: ['EV-01'],
          sourceEvidence: 'Dangling task'
        }
      ],
      creates: [
        {
          proposalItemId: 'P31-I05',
          candidateId: 'CAND-DANGLING',
          itemType: 'Task',
          itemTitle: 'Dangling Task',
          parentProposalItemId: 'P999-I99', // NON-EXISTENT
          action: 'CREATE',
          sourceEvidence: 'Dangling task',
          evidenceIds: ['EV-01']
        }
      ],
      updates: [],
      relations: [],
      corrections: [],
      validation: { status: 'PASS', errors: [] },
      summary: 'P3.1-05 Test'
    }

    const client = await pool.connect()
    let errorCaught = false
    try {
      await client.query('BEGIN')
      await executeCanonicalProposalTransaction(client, proposal, {
        workspace_uid: testWorkspaceUid,
        related_project_uid: testProjectUid,
        members: []
      })
      await client.query('COMMIT')
    } catch (err: any) {
      errorCaught = true
      await client.query('ROLLBACK')
      expect(err.message).toMatch(/(nonexistent proposal parent|UNRESOLVED_PARENT_LOCAL_ID)/)
    } finally {
      client.release()
    }

    expect(errorCaught).toBe(true)

    // Verify 0 writes
    const checkRes = await pool.query(
      `SELECT count(*) FROM public.item WHERE workspace_uid = $1 AND item_title = $2`,
      [testWorkspaceUid, 'Dangling Task']
    )
    expect(parseInt(checkRes.rows[0].count, 10)).toBe(0)
  })

  it('P3.1-06: Rejection of unapproved proposal before DB transaction starts', async () => {
    const proposal: ReconciliationProposal = {
      proposalId: 'PROP-P31-06',
      proposalVersion: 1,
      mode: 'NORMAL',
      sourceDocumentId: 'DOC-P31-06',
      sourceDocumentHash: 'hash-p31-06',
      createdAt: new Date().toISOString(),
      evidence: [],
      items: [],
      creates: [],
      updates: [],
      relations: [],
      corrections: [],
      validation: { status: 'PASS', errors: [] }
    }
    proposal.proposalHash = computeProposalHash(proposal)
    registerAuthoritativeProposal(proposal)

    // No approval recorded
    const check = assertAuthorityBoundaryForMutation(proposal, {
      requireHumanApproval: true
    })
    expect(check.valid).toBe(false)
    expect(check.errors.some(e => e.includes('HUMAN_APPROVAL_REQUIRED'))).toBe(true)
  })

  it('P3.1-07: Proposal hash mismatch rejection', async () => {
    const proposal: ReconciliationProposal = {
      proposalId: 'PROP-P31-07',
      proposalVersion: 1,
      mode: 'NORMAL',
      sourceDocumentId: 'DOC-P31-07',
      sourceDocumentHash: 'hash-p31-07',
      createdAt: new Date().toISOString(),
      evidence: [],
      items: [],
      creates: [],
      updates: [],
      relations: [],
      corrections: [],
      validation: { status: 'PASS', errors: [] }
    }
    const realHash = computeProposalHash(proposal)
    proposal.proposalHash = 'a'.repeat(64) // 64-char tampered hash
    registerAuthoritativeProposal(proposal)

    const check = assertAuthorityBoundaryForMutation(proposal, {
      requireHumanApproval: true,
      humanApproval: {
        approvedBy: 'lead-pm@example.com',
        approvedAt: new Date().toISOString(),
        approvedProposalHash: realHash
      }
    })
    expect(check.valid).toBe(false)
    expect(check.errors.some(e => e.includes('APPROVAL_HASH_MISMATCH') || e.includes('proposalHash') || e.includes('hash'))).toBe(true)
  })

  it('P3.1-08: Replay rejection after commit', async () => {
    const proposal: ReconciliationProposal = {
      proposalId: 'PROP-P31-08',
      proposalVersion: 1,
      mode: 'NORMAL',
      sourceDocumentId: 'DOC-P31-08',
      sourceDocumentHash: 'hash-p31-08',
      createdAt: new Date().toISOString(),
      evidence: [],
      items: [],
      creates: [],
      updates: [],
      relations: [],
      corrections: [],
      validation: { status: 'PASS', errors: [] }
    }
    const hash = computeProposalHash(proposal)
    proposal.proposalHash = hash
    registerAuthoritativeProposal(proposal)
    recordHumanApproval(proposal.proposalId, {
      approvedBy: 'lead-pm@example.com',
      approvedAt: new Date().toISOString(),
      approvedProposalHash: hash
    })

    // First commit
    markProposalCommitted(proposal.proposalId)

    // Replay attempt
    const replayCheck = assertAuthorityBoundaryForMutation(proposal, {
      requireServerAuthority: true,
      requireHumanApproval: true,
      humanApproval: {
        approvedBy: 'lead-pm@example.com',
        approvedAt: new Date().toISOString(),
        approvedProposalHash: hash
      }
    })
    expect(replayCheck.valid).toBe(false)
    expect(replayCheck.errors.some(e => e.includes('PROPOSAL_ALREADY_COMMITTED') || e.includes('cannot be replayed'))).toBe(true)
  })

  it('P3.1-09: Meeting sourceContent preservation in public.item', async () => {
    const fullTranscript = `# Smart Queue Kickoff Meeting\n\nDate: 2026-03-24\nAttendees: Michael Green, Sarah Chen, David Wu\n\nObjective: Align on passenger queue telemetry and display system.`
    const proposal: ReconciliationProposal = {
      proposalId: 'PROP-P31-09',
      proposalVersion: 1,
      mode: 'NORMAL',
      sourceDocumentId: 'DOC-P31-09',
      sourceDocumentHash: 'hash-meeting-transcript',
      createdAt: new Date().toISOString(),
      documentMetadata: {
        documentId: 'DOC-P31-09',
        documentHash: 'hash-meeting-transcript',
        meetingTitle: 'Smart Queue Kickoff Meeting',
        meetingDate: '2026-03-24',
        attendees: ['Michael Green', 'Sarah Chen', 'David Wu'],
        summary: 'Align on passenger queue telemetry and display system.',
        meetingObjective: 'Align on passenger queue telemetry and display system.',
        normalizedContent: fullTranscript
      },
      evidence: [
        {
          evidenceId: 'EV-MEET',
          evidenceType: 'EXPLICIT_REQUIREMENT',
          sourceSnippet: 'Smart Queue Kickoff Meeting',
          confidence: 1.0,
          semanticClassification: 'DIRECT_QUOTE',
          commitmentStatus: 'CONFIRMED'
        }
      ],
      items: [
        {
          proposalItemId: 'P31-I09',
          action: 'CREATE',
          targetCandidateId: 'CAND-MEET',
          itemType: 'Meeting',
          itemTitle: 'Smart Queue Kickoff Meeting',
          sourceContent: fullTranscript,
          description: fullTranscript,
          evidenceIds: ['EV-MEET'],
          sourceEvidence: 'Smart Queue Kickoff Meeting'
        }
      ],
      creates: [
        {
          proposalItemId: 'P31-I09',
          candidateId: 'CAND-MEET',
          itemType: 'Meeting',
          itemTitle: 'Smart Queue Kickoff Meeting',
          action: 'CREATE',
          sourceContent: fullTranscript,
          description: fullTranscript,
          sourceEvidence: 'Smart Queue Kickoff Meeting',
          evidenceIds: ['EV-MEET']
        }
      ],
      updates: [],
      relations: [],
      corrections: [],
      validation: { status: 'PASS', errors: [] },
      summary: 'P3.1-09 Meeting Content Preservation'
    }

    const hash = computeProposalHash(proposal)
    proposal.proposalHash = hash
    registerAuthoritativeProposal(proposal)
    recordHumanApproval(proposal.proposalId, {
      approvedBy: 'lead-pm@example.com',
      approvedAt: new Date().toISOString(),
      approvedProposalHash: hash
    })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const executionResult = await executeCanonicalProposalTransaction(client, proposal, {
        workspace_uid: testWorkspaceUid,
        related_project_uid: testProjectUid,
        members: []
      })
      const verification = await verifyDatabaseState(client, proposal, executionResult)
      expect(verification.status).toBe('APPLIED_AND_VERIFIED')
      await client.query('COMMIT')
      markProposalCommitted(proposal.proposalId)
    } finally {
      client.release()
    }

    // Verify on independent connection
    const newClient = await pool.connect()
    try {
      const meetRes = await newClient.query(
        `SELECT item_uid, item_type, item_content FROM public.item WHERE workspace_uid = $1 AND item_type = 'Meeting'`,
        [testWorkspaceUid]
      )
      expect(meetRes.rows.length).toBe(1)
      const content = meetRes.rows[0].item_content
      expect(content.text).toBe(fullTranscript)
      expect(content.meeting_title).toBe('Smart Queue Kickoff Meeting')
      expect(content.meeting_date).toBe('2026-03-24')
      expect(content.attendees).toEqual(['Michael Green', 'Sarah Chen', 'David Wu'])
      expect(content.source_document_hash).toBe('hash-meeting-transcript')
    } finally {
      newClient.release()
    }
  })

  it('P3.1-10: Evidence-grounded field update on existing DB item (UNSPECIFIED != DEFAULT)', async () => {
    // 1. Seed SQA-6: Priority=Middle, Assignee=Michael, Description="Preliminary queue check."
    const seedRes = await pool.query(
      `INSERT INTO public.item (
        item_display_code,
        prefix_code,
        item_number,
        item_title,
        related_project_uid,
        workspace_uid,
        item_type,
        item_status,
        item_priority,
        item_follow_by,
        item_content,
        relation_item_uid,
        item_attribute
      ) VALUES ($1, $2, 6, 'Check Airport Systems Feed Interface', $3, $4, 'Task', 'Not Start', 'Middle', $5, '{"description":"Preliminary queue check."}'::jsonb, '[]'::jsonb, '{}'::jsonb)
      RETURNING item_uid`,
      [`${testPrefixCode}-6`, testPrefixCode, testProjectUid, testWorkspaceUid, testMemberMichaelUid]
    )
    const sqa6Uid = seedRes.rows[0].item_uid

    // 2. Incoming proposal updating ONLY description
    const newDescription = 'Michael will check with Airport Systems whether real-time queue status is available through the flight schedule feed or requires a new interface.'
    const proposal: ReconciliationProposal = {
      proposalId: 'PROP-P31-10',
      proposalVersion: 1,
      mode: 'NORMAL',
      sourceDocumentId: 'DOC-P31-10',
      sourceDocumentHash: 'hash-p31-10',
      createdAt: new Date().toISOString(),
      evidence: [
        {
          evidenceId: 'EV-10',
          evidenceType: 'EXPLICIT_TASK',
          sourceSnippet: newDescription,
          confidence: 1.0,
          semanticClassification: 'DIRECT_QUOTE',
          commitmentStatus: 'CONFIRMED'
        }
      ],
      items: [
        {
          proposalItemId: 'P31-I10',
          action: 'UPDATE',
          targetCandidateId: 'CAND-SQA6',
          targetItemUid: sqa6Uid,
          itemType: 'Task',
          itemTitle: 'Check Airport Systems Feed Interface',
          patch: {
            item_content: { description: newDescription }
          },
          evidenceIds: ['EV-10'],
          sourceEvidence: newDescription
        }
      ],
      creates: [],
      updates: [
        {
          targetItemUid: sqa6Uid,
          candidateId: 'CAND-SQA6',
          action: 'UPDATE',
          updates: {
            item_content: { description: newDescription }
          },
          sourceEvidence: newDescription,
          evidenceIds: ['EV-10']
        }
      ],
      relations: [],
      corrections: [],
      validation: { status: 'PASS', errors: [] },
      summary: 'P3.1-10 Test'
    }

    const hash = computeProposalHash(proposal)
    proposal.proposalHash = hash
    registerAuthoritativeProposal(proposal)
    recordHumanApproval(proposal.proposalId, {
      approvedBy: 'lead-pm@example.com',
      approvedAt: new Date().toISOString(),
      approvedProposalHash: hash
    })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const executionResult = await executeCanonicalProposalTransaction(client, proposal, {
        workspace_uid: testWorkspaceUid,
        related_project_uid: testProjectUid,
        members: [{ member_uid: testMemberMichaelUid, member_name: 'Michael Green' }]
      })
      const verification = await verifyDatabaseState(client, proposal, executionResult)
      expect(verification.status).toBe('APPLIED_AND_VERIFIED')
      await client.query('COMMIT')
      markProposalCommitted(proposal.proposalId)
    } finally {
      client.release()
    }

    // 3. Verify on brand new connection:
    // description: UPDATED
    // priority: NO_CHANGE (Middle)
    // assignee: NO_CHANGE (Michael)
    // type: NO_CHANGE (Task)
    const newClient = await pool.connect()
    try {
      const res = await newClient.query(
        `SELECT item_uid, item_type, item_priority, item_follow_by, item_content FROM public.item WHERE item_uid = $1`,
        [sqa6Uid]
      )
      const row = res.rows[0]
      expect(row.item_content.description).toBe(newDescription)
      expect(row.item_priority).toBe('Middle') // Did NOT become High or Default
      expect(row.item_follow_by).toBe(testMemberMichaelUid) // Untouched
      expect(row.item_type).toBe('Task') // Untouched
    } finally {
      newClient.release()
    }
  })

  // ==========================================================================
  // SECTION 4: REAL TRANSACTION VISIBILITY TEST
  // ==========================================================================

  it('Section 4: Real transaction isolation and visibility test', async () => {
    const clientA = await pool.connect()
    const clientB = await pool.connect()

    const itemNum = 888
    const displayCode = `${testPrefixCode}-${itemNum}`

    try {
      await clientA.query('BEGIN')

      // Client A inserts item
      await clientA.query(
        `INSERT INTO public.item (
          item_display_code,
          prefix_code,
          item_number,
          item_title,
          related_project_uid,
          workspace_uid,
          item_type,
          item_status,
          item_priority
        ) VALUES ($1, $2, $3, 'Isolation Test Item', $4, $5, 'Task', 'Not Start', 'Low')`,
        [displayCode, testPrefixCode, itemNum, testProjectUid, testWorkspaceUid]
      )

      // Client A sees the item in its own transaction
      const queryA = await clientA.query(
        `SELECT count(*) FROM public.item WHERE item_display_code = $1`,
        [displayCode]
      )
      expect(parseInt(queryA.rows[0].count, 10)).toBe(1)

      // Client B queries concurrently -> MUST NOT see uncommitted row
      const queryB1 = await clientB.query(
        `SELECT count(*) FROM public.item WHERE item_display_code = $1`,
        [displayCode]
      )
      expect(parseInt(queryB1.rows[0].count, 10)).toBe(0)

      // Client A commits
      await clientA.query('COMMIT')

      // Client B queries again -> MUST see committed row
      const queryB2 = await clientB.query(
        `SELECT count(*) FROM public.item WHERE item_display_code = $1`,
        [displayCode]
      )
      expect(parseInt(queryB2.rows[0].count, 10)).toBe(1)
    } finally {
      clientA.release()
      clientB.release()
    }
  })

  // ==========================================================================
  // SECTION 5: REAL ROLLBACK PROOF
  // ==========================================================================

  it('Section 5: Real rollback proof - count identical before and after aborted transaction', async () => {
    const clientSnapshot = await pool.connect()
    let initialCount = 0

    try {
      const snapRes = await clientSnapshot.query(
        `SELECT count(*) FROM public.item WHERE workspace_uid = $1`,
        [testWorkspaceUid]
      )
      initialCount = parseInt(snapRes.rows[0].count, 10)
    } finally {
      clientSnapshot.release()
    }

    const clientTx = await pool.connect()
    try {
      await clientTx.query('BEGIN')

      // Insert 2 items
      await clientTx.query(
        `INSERT INTO public.item (
          item_display_code,
          prefix_code,
          item_number,
          item_title,
          related_project_uid,
          workspace_uid,
          item_type,
          item_status,
          item_priority
        ) VALUES ($1, $2, 901, 'Rollback Item 1', $3, $4, 'Task', 'Not Start', 'Middle')`,
        [`${testPrefixCode}-901`, testPrefixCode, testProjectUid, testWorkspaceUid]
      )

      await clientTx.query(
        `INSERT INTO public.item (
          item_display_code,
          prefix_code,
          item_number,
          item_title,
          related_project_uid,
          workspace_uid,
          item_type,
          item_status,
          item_priority
        ) VALUES ($1, $2, 902, 'Rollback Item 2', $3, $4, 'Task', 'Not Start', 'Middle')`,
        [`${testPrefixCode}-902`, testPrefixCode, testProjectUid, testWorkspaceUid]
      )

      // Trigger ROLLBACK
      await clientTx.query('ROLLBACK')
    } finally {
      clientTx.release()
    }

    // Verify on independent connection
    const clientPost = await pool.connect()
    try {
      const postRes = await clientPost.query(
        `SELECT count(*) FROM public.item WHERE workspace_uid = $1`,
        [testWorkspaceUid]
      )
      const postCount = parseInt(postRes.rows[0].count, 10)
      expect(postCount).toBe(initialCount)
    } finally {
      clientPost.release()
    }
  })

  // ==========================================================================
  // SECTION 6: SMART QUEUE REAL DB E2E REPLAY
  // ==========================================================================

  it('Section 6: Smart Queue Kickoff Meeting E2E replay with real Neon DB persistence', async () => {
    // 1. Read transcript fixture
    const fixturePath = path.resolve(__dirname, '../../../test_doc/B_meeting_script_1.md')
    const transcriptText = fs.readFileSync(fixturePath, 'utf8')

    // 2. Seed existing items (SQA-1 and SQA-6) in real DB
    const seedRes1 = await pool.query(
      `INSERT INTO public.item (
        item_display_code,
        prefix_code,
        item_number,
        item_title,
        related_project_uid,
        workspace_uid,
        item_type,
        item_status,
        item_priority,
        item_content,
        relation_item_uid,
        item_attribute
      ) VALUES ($1, $2, 1, 'Passenger Queue Guidance System', $3, $4, 'Objective', 'In Progress', 'High', '{"text":"Core objective"}'::jsonb, '[]'::jsonb, '{}'::jsonb)
      RETURNING item_uid`,
      [`${testPrefixCode}-1`, testPrefixCode, testProjectUid, testWorkspaceUid]
    )
    const sqa1Uid = seedRes1.rows[0].item_uid

    const seedRes6 = await pool.query(
      `INSERT INTO public.item (
        item_display_code,
        prefix_code,
        item_number,
        item_title,
        related_project_uid,
        workspace_uid,
        item_type,
        item_status,
        item_priority,
        item_follow_by,
        item_content,
        relation_item_uid,
        item_attribute
      ) VALUES ($1, $2, 6, 'Check Airport Systems Feed Interface', $3, $4, 'Task', 'Not Start', 'Middle', $5, '{"description":"Preliminary queue check."}'::jsonb, '[]'::jsonb, '{}'::jsonb)
      RETURNING item_uid`,
      [`${testPrefixCode}-6`, testPrefixCode, testProjectUid, testWorkspaceUid, testMemberMichaelUid]
    )
    const sqa6Uid = seedRes6.rows[0].item_uid

    await pool.query('UPDATE public.workspace SET last_item_number = 6 WHERE workspace_uid = $1', [testWorkspaceUid])

    // 3. Query existing memory for pipeline
    const existingItems = [
      {
        item_uid: sqa1Uid,
        item_display_code: `${testPrefixCode}-1`,
        item_title: 'Passenger Queue Guidance System',
        item_type: 'Objective',
        item_status: 'In Progress',
        item_priority: 'High',
        item_follow_by: null,
        parent_item_uid: null,
        relation_item_uid: [],
        item_content: { text: 'Core objective' },
        workspace_uid: testWorkspaceUid,
        related_project_uid: testProjectUid
      },
      {
        item_uid: sqa6Uid,
        item_display_code: `${testPrefixCode}-6`,
        item_title: 'Check Airport Systems Feed Interface',
        item_type: 'Task',
        item_status: 'Not Start',
        item_priority: 'Middle',
        item_follow_by: testMemberMichaelUid,
        parent_item_uid: sqa1Uid,
        relation_item_uid: [],
        item_content: { description: 'Preliminary queue check.' },
        workspace_uid: testWorkspaceUid,
        related_project_uid: testProjectUid
      }
    ]

    const members = [
      { member_uid: testMemberMichaelUid, member_name: 'Michael Green', member_email: `michael_${testPrefixCode}@example.com` },
      { member_uid: testMemberUid, member_name: 'Sarah Chen', member_email: `sarah_${testPrefixCode}@example.com` }
    ]

    const rawPreviews = [
      {
        actionType: 'batch_proposal',
        proposalTitle: 'Smart Queue Assistance 複合專家拆解提案',
        items: [
          { candidateId: 'CAND-01', itemTitle: 'Passenger Queue Guidance System', itemType: 'Objective', itemFollowBy: testMemberUid, description: 'Core objective.' },
          { candidateId: 'CAND-02', itemTitle: 'Help passengers identify appropriate queue before joining', itemType: 'Requirement', parentCandidateId: 'CAND-01', itemFollowBy: testMemberUid },
          { candidateId: 'CAND-03', itemTitle: 'Support normal passenger flow only in phase one', itemType: 'Requirement', parentCandidateId: 'CAND-01', itemFollowBy: testMemberUid },
          { candidateId: 'CAND-04', itemTitle: 'Provide understandable explanation for queue recommendations', itemType: 'Requirement', parentCandidateId: 'CAND-02', itemFollowBy: testMemberUid },
          { candidateId: 'CAND-05', itemTitle: 'Fallback mechanism to staff assistance when uncertain', itemType: 'Requirement', parentCandidateId: 'CAND-01', itemFollowBy: testMemberMichaelUid },
          { candidateId: 'CAND-06', itemTitle: 'Check Airport Systems Feed Interface', itemType: 'Task', parentCandidateId: 'CAND-02', itemFollowBy: testMemberMichaelUid, description: 'Updated interface specification check for airport queue feeds.' },
          { candidateId: 'CAND-07', itemTitle: 'Validate response time under three seconds', itemType: 'Milestone', parentCandidateId: 'CAND-02', itemFollowBy: testMemberMichaelUid, description: 'Initial technical estimate to validate.' },
          { candidateId: 'CAND-08', itemTitle: 'Check security and privacy implications of passenger data', itemType: 'Task', parentCandidateId: 'CAND-02', itemFollowBy: testMemberMichaelUid, description: 'Michael to check data retention.' },
          { candidateId: 'CAND-09', itemTitle: 'Set tentative requirements baseline by October 2', itemType: 'Milestone', parentCandidateId: 'CAND-01', itemFollowBy: testMemberUid, description: 'Tentative requirements baseline.' },
          { candidateId: 'CAND-10', itemTitle: 'Deliver prototype by October 16', itemType: 'Milestone', parentCandidateId: 'CAND-01', itemFollowBy: testMemberUid, description: 'Tentative prototype.' },
          { candidateId: 'CAND-11', itemTitle: 'Operational trial by November 13', itemType: 'Milestone', parentCandidateId: 'CAND-01', itemFollowBy: testMemberUid, description: 'Tentative operational trial.' },
          { candidateId: 'CAND-12', itemTitle: 'ADR-01: First Release Scope and Exclusions', itemType: 'Decision', parentCandidateId: 'CAND-01', itemFollowBy: testMemberUid, description: 'Focus on Terminal 1 normal flow.' },
          { candidateId: 'CAND-13', itemTitle: '01: 隊列狀態資料整合依賴性', itemType: 'Bottleneck', parentCandidateId: 'CAND-01', itemFollowBy: testMemberMichaelUid, description: 'Dependency / technical unknown.' },
          { candidateId: 'CAND-14', itemTitle: '2026-09-21 Smart Queue Assistance 首次啟動會議', itemType: 'Meeting', itemFollowBy: testMemberUid, description: 'Meeting summary' }
        ]
      }
    ]

    // 4. Run real deterministic reconciliation pipeline
    const proposal = executeReconciliationPipeline({
      text: transcriptText,
      sourceDocument: {
        content: transcriptText,
        filename: 'B_meeting_script_1.md',
        documentId: 'DOC-SMART-QUEUE-KICKOFF'
      },
      existingItems: existingItems as any,
      members,
      rawPreviews,
      currentProject: {
        project_uid: testProjectUid,
        project_name: `Test Project ${testPrefixCode}`
      }
    })

    expect(proposal.validation.status).toBe('PASS')
    expect(proposal.creates.length).toBeGreaterThan(0)

    // Register and approve proposal
    registerAuthoritativeProposal(proposal)
    const approval: HumanApprovalRecord = {
      approvedBy: 'lead-architect@example.com',
      approvedAt: new Date().toISOString(),
      approvedProposalHash: proposal.proposalHash!
    }
    recordHumanApproval(proposal.proposalId, approval)

    // 5. Execute transaction in PostgreSQL
    const client = await pool.connect()
    let execResult: any
    try {
      await client.query('BEGIN')
      execResult = await executeCanonicalProposalTransaction(client, proposal, {
        workspace_uid: testWorkspaceUid,
        related_project_uid: testProjectUid,
        members
      })

      const verification = await verifyDatabaseState(client, proposal, execResult)
      expect(verification.status).toBe('APPLIED_AND_VERIFIED')
      expect(verification.mismatches.length).toBe(0)

      await client.query('COMMIT')
      markProposalCommitted(proposal.proposalId)
    } finally {
      client.release()
    }

    // 6. Independent connection verification of committed state
    const newClient = await pool.connect()
    try {
      // A. Verify Meeting item
      const meetRes = await newClient.query(
        `SELECT item_uid, item_display_code, item_type, item_content FROM public.item WHERE workspace_uid = $1 AND item_type = 'Meeting'`,
        [testWorkspaceUid]
      )
      expect(meetRes.rows.length).toBe(1)
      expect(meetRes.rows[0].item_content.text.length).toBeGreaterThan(500)

      // B. Verify SQA-6 updated cleanly without priority overwrite
      const sqa6Res = await newClient.query(
        `SELECT item_uid, item_priority, item_follow_by, item_content FROM public.item WHERE item_uid = $1`,
        [sqa6Uid]
      )
      expect(sqa6Res.rows[0].item_priority).toBe('Middle') // Preserved!
      expect(sqa6Res.rows[0].item_follow_by).toBe(testMemberMichaelUid) // Preserved!

      // C. Verify all created items have sequential display codes and valid UUIDs
      const allCreatedRes = await newClient.query(
        `SELECT item_uid, item_display_code, item_number, parent_item_uid, relation_item_uid 
         FROM public.item 
         WHERE workspace_uid = $1 AND item_number > 6`,
        [testWorkspaceUid]
      )
      expect(allCreatedRes.rows.length).toBe(proposal.creates.length)
      for (const row of allCreatedRes.rows) {
        expect(row.item_display_code).toBe(`${testPrefixCode}-${row.item_number}`)
        // Verify no natural language titles in parent_item_uid
        if (row.parent_item_uid) {
          expect(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.parent_item_uid)).toBe(true)
        }
        // Verify no natural language titles in relation_item_uid
        if (row.relation_item_uid && Array.isArray(row.relation_item_uid)) {
          for (const rel of row.relation_item_uid) {
            expect(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rel.item_uid)).toBe(true)
          }
        }
      }
    } finally {
      newClient.release()
    }
  }, 30000)

  // ==========================================================================
  // SECTION 7: HUMAN DIRECT CRUD REGRESSION TEST ON REAL DB
  // ==========================================================================

  it('Section 7: Human Direct CRUD operations succeed on real DB without CanonicalProposal', async () => {
    // 1. Direct Item Create (Simulating POST /api/items)
    const createRes = await pool.query(
      `INSERT INTO public.item (
        item_display_code,
        prefix_code,
        item_number,
        item_title,
        related_project_uid,
        workspace_uid,
        item_type,
        item_status,
        item_priority,
        item_content,
        relation_item_uid,
        item_attribute
      ) VALUES ($1, $2, 999, 'Direct Human Task', $3, $4, 'Task', 'Not Start', 'High', '{"description":"Created directly by user"}'::jsonb, '[]'::jsonb, '{}'::jsonb)
      RETURNING item_uid, item_display_code`,
      [`${testPrefixCode}-999`, testPrefixCode, testProjectUid, testWorkspaceUid]
    )
    expect(createRes.rows.length).toBe(1)
    const directUid = createRes.rows[0].item_uid

    // 2. Direct Item Update (Simulating PUT /api/items/:uid)
    const updateRes = await pool.query(
      `UPDATE public.item 
       SET item_title = 'Direct Human Task (Updated)', item_priority = 'Middle', updated_at = NOW()
       WHERE item_uid = $1
       RETURNING item_uid, item_title, item_priority`,
      [directUid]
    )
    expect(updateRes.rows[0].item_title).toBe('Direct Human Task (Updated)')
    expect(updateRes.rows[0].item_priority).toBe('Middle')

    // 3. Direct Comment Addition (Simulating POST /api/items/:uid/comments)
    const newComment = {
      comment_id: `cmt_test_${Date.now()}`,
      author_name: 'Lead PM',
      comment_text: 'Human comment on task',
      created_at: new Date().toISOString()
    }
    const commentRes = await pool.query(
      `UPDATE public.item
       SET item_comment = item_comment || $1::jsonb
       WHERE item_uid = $2
       RETURNING item_comment`,
      [JSON.stringify([newComment]), directUid]
    )
    expect(commentRes.rows[0].item_comment.length).toBe(1)
    expect(commentRes.rows[0].item_comment[0].comment_text).toBe('Human comment on task')

    // 4. Direct Item Delete (Simulating DELETE /api/items/:uid)
    const deleteRes = await pool.query(
      `DELETE FROM public.item WHERE item_uid = $1 RETURNING item_uid`,
      [directUid]
    )
    expect(deleteRes.rows.length).toBe(1)
    expect(deleteRes.rows[0].item_uid).toBe(directUid)

    // Verify deletion confirmed on new query
    const verifyRes = await pool.query(`SELECT count(*) FROM public.item WHERE item_uid = $1`, [directUid])
    expect(parseInt(verifyRes.rows[0].count, 10)).toBe(0)
  })

  // ==========================================================================
  // SECTION 8: SEMANTIC DATA INTEGRITY & ZERO DB WRITES VERIFICATION (REAL DB)
  // Invariants enforced at the Authority Boundary and DB Execution Layer:
  // - Inferred User Story cannot become canonical (0 DB writes)
  // - Explicit non-blocker/dependency cannot become Bottleneck (0 DB writes)
  // - Tentative/estimated milestone cannot become CONFIRMED (0 DB writes)
  // - Unspecified priority cannot become High/Middle (0 DB writes)
  // ==========================================================================

  it('P3.1-14: Inferred User Story cannot become canonical -> rejected at boundary & dbExecutor -> 0 rows written', async () => {
    const invalidProposal: ReconciliationProposal = {
      proposalId: 'PROP-NEG-US-DB',
      proposalVersion: 1,
      mode: 'NORMAL',
      sourceDocumentId: 'DOC-NEG-01',
      sourceDocumentHash: '11'.repeat(32),
      createdAt: new Date().toISOString(),
      evidence: [
        {
          evidenceId: 'EV-US-01',
          evidenceType: 'EXPLICIT_REQUIREMENT',
          sourceSnippet: 'Rachel: Maybe store managers would want notifications.',
          confidence: 0.6,
          semanticClassification: 'DIRECT_QUOTE',
          commitmentStatus: 'CONFIRMED'
        }
      ],
      items: [
        {
          proposalItemId: 'P31-US01',
          action: 'CREATE',
          itemType: 'UserStory',
          itemTitle: 'As a store manager I want notifications',
          sourceEvidence: 'Rachel: Maybe store managers would want notifications.',
          inferred: true,
          classification: 'INFERRED'
        }
      ],
      creates: [
        {
          proposalItemId: 'P31-US01',
          itemType: 'UserStory',
          itemTitle: 'As a store manager I want notifications',
          action: 'CREATE',
          sourceEvidence: 'Rachel: Maybe store managers would want notifications.',
          evidenceIds: ['EV-US-01'],
          inferred: true,
          classification: 'INFERRED'
        }
      ],
      updates: [],
      relations: [],
      corrections: [],
      validation: { status: 'FAIL', errors: [{ rule: 'R_INFERRED_USER_STORY_PROHIBITED', message: 'Inferred User Story prohibited from becoming canonical' }] },
      summary: 'Negative Test: Inferred User Story'
    }

    // 1. Authority Boundary Check: must FAIL
    const boundaryCheck = assertAuthorityBoundaryForMutation(invalidProposal)
    expect(boundaryCheck.valid).toBe(false)
    expect(boundaryCheck.errors.some(e => e.includes('Authority Boundary Failure'))).toBe(true)

    // 2. Transaction Execution: must throw and trigger ROLLBACK
    const client = await pool.connect()
    let errorCaught: any = null
    try {
      await client.query('BEGIN')
      await executeCanonicalProposalTransaction(client, invalidProposal, {
        workspace_uid: testWorkspaceUid,
        related_project_uid: testProjectUid,
        members: []
      })
      await client.query('COMMIT')
    } catch (err) {
      errorCaught = err
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }

    expect(errorCaught).toBeDefined()
    expect(errorCaught.message).toMatch(/ZERO DATABASE WRITES|blocking database write|Apply Gate Violation/i)

    // 3. PostgreSQL verification: 0 rows written
    const verifyRes = await pool.query(
      `SELECT count(*) FROM public.item WHERE workspace_uid = $1 AND item_title = $2`,
      [testWorkspaceUid, 'As a store manager I want notifications']
    )
    expect(parseInt(verifyRes.rows[0].count, 10)).toBe(0)
  })

  it('P3.1-15: Explicit "not yet a blocker" / dependency cannot become Bottleneck -> rejected -> 0 rows written', async () => {
    const invalidProposal: ReconciliationProposal = {
      proposalId: 'PROP-NEG-BTN-DB',
      proposalVersion: 1,
      mode: 'NORMAL',
      sourceDocumentId: 'DOC-NEG-02',
      sourceDocumentHash: '22'.repeat(32),
      createdAt: new Date().toISOString(),
      evidence: [
        {
          evidenceId: 'EV-BTN-01',
          evidenceType: 'EXPLICIT_REQUIREMENT',
          sourceSnippet: 'Not yet. It is a dependency and technical unknown, but we are not blocked on it today.',
          confidence: 0.9,
          semanticClassification: 'DIRECT_QUOTE',
          commitmentStatus: 'CONFIRMED'
        }
      ],
      items: [
        {
          proposalItemId: 'P31-BTN01',
          action: 'CREATE',
          itemType: 'Bottleneck',
          itemTitle: 'POS API Access Blocker',
          sourceEvidence: 'Not yet. It is a dependency, but we are not blocked on it today.'
        }
      ],
      creates: [
        {
          proposalItemId: 'P31-BTN01',
          itemType: 'Bottleneck',
          itemTitle: 'POS API Access Blocker',
          action: 'CREATE',
          sourceEvidence: 'Not yet. It is a dependency, but we are not blocked on it today.',
          evidenceIds: ['EV-BTN-01']
        }
      ],
      updates: [],
      relations: [],
      corrections: [],
      validation: { status: 'PASS', errors: [] }, // simulate client falsely claiming PASS
      summary: 'Negative Test: Non-blocker as Bottleneck'
    }

    const client = await pool.connect()
    let errorCaught: any = null
    try {
      await client.query('BEGIN')
      // Server-side deterministic validator inside dbExecutor will catch this!
      await executeCanonicalProposalTransaction(client, invalidProposal, {
        workspace_uid: testWorkspaceUid,
        related_project_uid: testProjectUid,
        members: []
      })
      await client.query('COMMIT')
    } catch (err) {
      errorCaught = err
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }

    expect(errorCaught).toBeDefined()
    expect(errorCaught.message).toMatch(/R_NON_BLOCKER_AS_BOTTLENECK_PROHIBITED|ZERO DATABASE WRITES/i)

    // PostgreSQL verification: 0 rows written
    const verifyRes = await pool.query(
      `SELECT count(*) FROM public.item WHERE workspace_uid = $1 AND item_title = $2`,
      [testWorkspaceUid, 'POS API Access Blocker']
    )
    expect(parseInt(verifyRes.rows[0].count, 10)).toBe(0)
  })

  it('P3.1-16: Tentative/estimated milestone as CONFIRMED -> rejected -> 0 rows written', async () => {
    const invalidProposal: ReconciliationProposal = {
      proposalId: 'PROP-NEG-MS-DB',
      proposalVersion: 1,
      mode: 'NORMAL',
      sourceDocumentId: 'DOC-NEG-03',
      sourceDocumentHash: '33'.repeat(32),
      createdAt: new Date().toISOString(),
      evidence: [
        {
          evidenceId: 'EV-MS-01',
          evidenceType: 'EXPLICIT_REQUIREMENT',
          sourceSnippet: 'October 2: tentative baseline for review and signoff.',
          confidence: 0.9,
          semanticClassification: 'DIRECT_QUOTE',
          commitmentStatus: 'CONFIRMED'
        }
      ],
      items: [
        {
          proposalItemId: 'P31-MS01',
          action: 'CREATE',
          itemType: 'Milestone',
          itemTitle: 'Set tentative requirements baseline by October 2',
          commitmentStatus: 'CONFIRMED',
          sourceEvidence: 'October 2: tentative baseline for review and signoff.'
        }
      ],
      creates: [
        {
          proposalItemId: 'P31-MS01',
          itemType: 'Milestone',
          itemTitle: 'Set tentative requirements baseline by October 2',
          commitmentStatus: 'CONFIRMED',
          action: 'CREATE',
          sourceEvidence: 'October 2: tentative baseline for review and signoff.',
          evidenceIds: ['EV-MS-01']
        }
      ],
      updates: [],
      relations: [],
      corrections: [],
      validation: { status: 'PASS', errors: [] }, // simulate client claiming PASS
      summary: 'Negative Test: Tentative Milestone as CONFIRMED'
    }

    const client = await pool.connect()
    let errorCaught: any = null
    try {
      await client.query('BEGIN')
      await executeCanonicalProposalTransaction(client, invalidProposal, {
        workspace_uid: testWorkspaceUid,
        related_project_uid: testProjectUid,
        members: []
      })
      await client.query('COMMIT')
    } catch (err) {
      errorCaught = err
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }

    expect(errorCaught).toBeDefined()
    expect(errorCaught.message).toMatch(/R_TENTATIVE_MILESTONE_CONFIRMED_PROHIBITED|ZERO DATABASE WRITES/i)

    // PostgreSQL verification: 0 rows written
    const verifyRes = await pool.query(
      `SELECT count(*) FROM public.item WHERE workspace_uid = $1 AND item_title = $2`,
      [testWorkspaceUid, 'Set tentative requirements baseline by October 2']
    )
    expect(parseInt(verifyRes.rows[0].count, 10)).toBe(0)
  })

  it('P3.1-17: Unspecified priority defaulted to High/Middle without evidence -> rejected -> 0 rows written', async () => {
    const invalidProposal: ReconciliationProposal = {
      proposalId: 'PROP-NEG-PRI-DB',
      proposalVersion: 1,
      mode: 'NORMAL',
      sourceDocumentId: 'DOC-NEG-04',
      sourceDocumentHash: '44'.repeat(32),
      createdAt: new Date().toISOString(),
      evidence: [
        {
          evidenceId: 'EV-PRI-01',
          evidenceType: 'EXPLICIT_REQUIREMENT',
          sourceSnippet: 'Michael will review queue status payload structure.',
          confidence: 0.9,
          semanticClassification: 'DIRECT_QUOTE',
          commitmentStatus: 'CONFIRMED'
        }
      ],
      items: [
        {
          proposalItemId: 'P31-PRI01',
          action: 'CREATE',
          itemType: 'Task',
          itemTitle: 'Review queue status payload structure',
          itemPriority: 'High', // Ungrounded priority!
          sourceEvidence: 'Michael will review queue status payload structure.'
        }
      ],
      creates: [
        {
          proposalItemId: 'P31-PRI01',
          itemType: 'Task',
          itemTitle: 'Review queue status payload structure',
          itemPriority: 'High', // Ungrounded priority!
          action: 'CREATE',
          sourceEvidence: 'Michael will review queue status payload structure.',
          evidenceIds: ['EV-PRI-01']
        }
      ],
      updates: [],
      relations: [],
      corrections: [],
      validation: { status: 'PASS', errors: [] }, // simulate ungrounded priority passing preview
      summary: 'Negative Test: Ungrounded Priority'
    }

    const client = await pool.connect()
    let errorCaught: any = null
    try {
      await client.query('BEGIN')
      await executeCanonicalProposalTransaction(client, invalidProposal, {
        workspace_uid: testWorkspaceUid,
        related_project_uid: testProjectUid,
        members: []
      })
      await client.query('COMMIT')
    } catch (err) {
      errorCaught = err
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }

    expect(errorCaught).toBeDefined()
    expect(errorCaught.message).toMatch(/R_UNGROUNDED_PRIORITY|ZERO DATABASE WRITES/i)

    // PostgreSQL verification: 0 rows written
    const verifyRes = await pool.query(
      `SELECT count(*) FROM public.item WHERE workspace_uid = $1 AND item_title = $2`,
      [testWorkspaceUid, 'Review queue status payload structure']
    )
    expect(parseInt(verifyRes.rows[0].count, 10)).toBe(0)
  })
})
