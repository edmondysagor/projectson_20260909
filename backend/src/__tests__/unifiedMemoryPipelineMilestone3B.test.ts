import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { pool } from '../db.js'
import { executeUnifiedMemoryPipeline } from '../services/reconciliation/unifiedMemoryPipeline.js'
import { executeCanonicalProposalTransaction, verifyDatabaseState } from '../services/reconciliation/dbExecutor.js'
import { recordHumanApproval, clearProposalRegistry } from '../services/reconciliation/proposalRegistry.js'
import { computeProposalHash } from '../services/reconciliation/graphValidator.js'

describe('Unified Memory Pipeline — Milestone 3B Optimistic Concurrency & Transaction Safety Tests', () => {
  let testWorkspaceUid: string
  let testProjectUid: string
  let testPrefixCode: string

  beforeAll(async () => {
    // 1. Create isolated test workspace
    const rand = Math.floor(Math.random() * 900000 + 100000)
    testPrefixCode = `U${rand}`.substring(0, 8)

    const wsRes = await pool.query(
      `INSERT INTO public.workspace (
        prefix_code,
        workspace_name,
        last_item_number,
        last_project_number,
        allow_access_member
      ) VALUES ($1, $2, 0, 1, '[]'::jsonb)
      RETURNING workspace_uid, prefix_code`,
      [testPrefixCode, `Milestone3B Test Workspace ${testPrefixCode}`]
    )
    testWorkspaceUid = wsRes.rows[0].workspace_uid

    // 2. Create isolated test project
    const prjRes = await pool.query(
      `INSERT INTO public.project (
        related_workspace_uid,
        project_name,
        project_display_code,
        project_number,
        project_type
      ) VALUES ($1, $2, $3, 1, 'Project')
      RETURNING project_uid`,
      [testWorkspaceUid, `Milestone3B Test Project ${testPrefixCode}`, `${testPrefixCode}-PRO-1`]
    )
    testProjectUid = prjRes.rows[0].project_uid
  })

  afterAll(async () => {
    if (testWorkspaceUid) {
      await pool.query('DELETE FROM public.workspace WHERE workspace_uid = $1', [testWorkspaceUid])
    }
  })

  beforeEach(() => {
    clearProposalRegistry()
  })

  it('1. Successful mixed CREATE + UPDATE with post-write verification', async () => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const item51Uid = 'b1111111-1111-4000-8000-000000000051'
      const item52Uid = 'b1111111-1111-4000-8000-000000000052'

      await client.query(`
        INSERT INTO public.item (item_uid, related_project_uid, workspace_uid, prefix_code, item_number, item_display_code, item_title, item_type, item_status, item_priority, item_content)
        VALUES 
          ($1, $3, $4, $5, 51, 'TPM-51', 'Queue Integration and Privacy Review', 'Task', 'Not Start', 'High', '{"description":"Queue interface and privacy review","metadata":"v1"}'::jsonb),
          ($2, $3, $4, $5, 52, 'TPM-52', 'Conduct User & Staff Interviews', 'Task', 'Ready', 'High', '{"description":"Interview passengers and staff"}'::jsonb)
        ON CONFLICT (item_uid) DO UPDATE 
        SET item_status = EXCLUDED.item_status, item_content = EXCLUDED.item_content
      `, [item51Uid, item52Uid, testProjectUid, testWorkspaceUid, testPrefixCode])

      const llmClient = await import('../agents/llmClient.js')
      vi.spyOn(llmClient, 'callSubAgentJson').mockResolvedValueOnce({
        aligned_existing_items: [
          {
            item_uid: item51Uid,
            item_display_code: 'TPM-51',
            item_title: 'Queue Integration and Privacy Review',
            item_type: 'Task',
            is_mentioned: true,
            matched_evidence: ['Queue mapping file received and usable.'],
            action: 'UPDATE',
            reason: 'Work started on queue mapping check',
            field_diffs: [
              {
                field: 'item_status',
                before: 'Not Start',
                after: 'In Progress',
                rationale: 'Status moved to In Progress'
              },
              {
                field: 'item_content',
                before: { description: 'Queue interface and privacy review' },
                after: { description: 'Queue interface and privacy review\n\n### 最新進度:\n- 收到 Queue mapping 檔案' },
                rationale: 'Append progress notes'
              }
            ]
          },
          {
            item_uid: item52Uid,
            item_display_code: 'TPM-52',
            item_title: 'Conduct User & Staff Interviews',
            item_type: 'Task',
            is_mentioned: true,
            matched_evidence: ['Rachel: I completed the interviews.'],
            action: 'UPDATE',
            reason: 'Interviews completed with findings',
            field_diffs: [
              {
                field: 'item_status',
                before: 'Ready',
                after: 'Completed',
                rationale: 'Rachel confirmed interviews completed'
              }
            ]
          }
        ],
        new_candidate_items: [
          {
            candidate_id: 'CAND-MEETING-02',
            item_type: 'Meeting',
            item_title: '02 — Smart Queue Assistance Follow-up Meeting',
            item_status: 'Completed',
            item_priority: 'Middle',
            assignee_name: null,
            parent_candidate_id: null,
            parent_item_uid: null,
            reason: 'Follow-up meeting session',
            matched_evidence: ['Meeting 2 transcript'],
            item_content: { description: 'Follow-up discussion notes' }
          }
        ],
        unmatched_evidence: []
      })

      const rawTranscript = 'Meeting 2: Smart Queue Assistance follow-up discussion transcript. The team reviewed queue mapping file and confirmed user interviews are complete.'
      const pipelineRes = await executeUnifiedMemoryPipeline({
        projectUid: testProjectUid,
        projectName: 'Test Project',
        items: [
          { item_uid: item51Uid, item_display_code: 'TPM-51', item_title: 'Queue Integration and Privacy Review', item_type: 'Task', item_status: 'Not Start', item_content: { description: 'Queue interface and privacy review', metadata: 'v1' } },
          { item_uid: item52Uid, item_display_code: 'TPM-52', item_title: 'Conduct User & Staff Interviews', item_type: 'Task', item_status: 'Ready', item_content: { description: 'Interview passengers and staff' } }
        ],
        transcriptText: rawTranscript
      })

      const proposal = pipelineRes.canonicalProposal

      // Record Human Approval
      const approvalResult = recordHumanApproval(proposal.proposalId!, {
        approvedBy: 'Edmond (Project Lead)',
        approvedAt: new Date().toISOString(),
        approvedProposalHash: proposal.proposalHash!
      })
      expect(approvalResult.valid).toBe(true)

      // Execute Transaction
      const execResult = await executeCanonicalProposalTransaction(client, proposal, {
        workspace_uid: testWorkspaceUid,
        related_project_uid: testProjectUid,
        members: []
      })

      expect(execResult.insertedItems.length).toBe(1)
      expect(execResult.updatedItems.length).toBe(2)

      // Post-Write Database Verification
      const verification = await verifyDatabaseState(client, proposal, execResult)
      expect(verification.status).toBe('APPLIED_AND_VERIFIED')
      expect(verification.mismatches.length).toBe(0)

      await client.query('ROLLBACK')
    } finally {
      client.release()
    }
  })

  it('2. Optimistic Concurrency Protection: Rejects stale update when DB row changed after proposal generation', async () => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const item51Uid = 'b1111111-1111-4000-8000-000000000051'
      await client.query(`
        INSERT INTO public.item (item_uid, related_project_uid, workspace_uid, prefix_code, item_number, item_display_code, item_title, item_type, item_status, item_priority, item_content)
        VALUES ($1, $2, $3, $4, 51, 'TPM-51', 'Queue Integration', 'Task', 'Not Start', 'High', '{"description":"Original"}'::jsonb)
        ON CONFLICT (item_uid) DO UPDATE SET item_status = 'Not Start'
      `, [item51Uid, testProjectUid, testWorkspaceUid, testPrefixCode])

      // Generate proposal assuming item_status is 'Not Start'
      const proposal: any = {
        proposalId: `PROP-STALE-${Date.now()}`,
        mode: 'INCREMENTAL_RECONCILIATION',
        creates: [],
        updates: [
          {
            candidateId: 'TPM-51',
            targetItemUid: item51Uid,
            targetDisplayCode: 'TPM-51',
            itemTitle: 'Queue Integration',
            fieldDiffs: [
              {
                field: 'item_status',
                existingValue: 'Not Start',
                proposedValue: 'In Progress',
                action: 'UPDATE',
                reason: 'Work started'
              }
            ],
            updates: { item_status: 'In Progress' }
          }
        ]
      }
      proposal.proposalHash = computeProposalHash(proposal)

      // Simulate a concurrent modification in the DB (e.g. teammate marked it 'Completed')
      await client.query(`UPDATE public.item SET item_status = 'Completed' WHERE item_uid = $1`, [item51Uid])

      // Executing the stale proposal must throw an OPTIMISTIC_CONCURRENCY_CONFLICT error
      await expect(
        executeCanonicalProposalTransaction(client, proposal, {
          workspace_uid: testWorkspaceUid,
          related_project_uid: testProjectUid,
          members: []
        })
      ).rejects.toThrow(/OPTIMISTIC_CONCURRENCY_CONFLICT/)

      await client.query('ROLLBACK')
    } finally {
      client.release()
    }
  })

  it('3. Atomic Rollback: Mid-transaction failure leaves zero partial writes', async () => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const badProposal: any = {
        proposalId: `PROP-FAIL-${Date.now()}`,
        creates: [
          {
            candidateId: 'CAND-VALID-NEW',
            itemTitle: 'Valid New Task Before Failure',
            itemType: 'Task',
            classification: 'EXPLICIT',
            evidenceId: 'EV-001',
            evidenceType: 'SOURCE_FACT',
            commitmentStatus: 'CONFIRMED',
            sourceEvidence: {
              extractedFact: 'Valid fact',
              sourceText: 'Valid text',
              confidence: 1
            },
            description: 'Valid'
          }
        ],
        updates: [
          {
            targetItemUid: '00000000-0000-0000-0000-000000000000', // Non-existent target
            fieldDiffs: [{ field: 'item_status', existingValue: 'Not Start', proposedValue: 'In Progress' }],
            updates: { item_status: 'In Progress' }
          }
        ]
      }

      await expect(
        executeCanonicalProposalTransaction(client, badProposal, {
          workspace_uid: testWorkspaceUid,
          related_project_uid: testProjectUid,
          members: []
        })
      ).rejects.toThrow(/OPTIMISTIC_CONCURRENCY_CONFLICT/)

      await client.query('ROLLBACK')

      // Verify that no partial row was written
      const checkRow = await pool.query(`SELECT * FROM public.item WHERE item_title = 'Valid New Task Before Failure'`)
      expect(checkRow.rows.length).toBe(0)
    } finally {
      client.release()
    }
  })

  it('4. Duplicate Meeting Prevention: Repeated transcript upload is rejected when already persisted', async () => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const rawTranscript = 'Meeting 2: Smart Queue Assistance follow-up discussion transcript. Preserved document text.'
      
      // First insert the Meeting into DB
      await client.query(`
        INSERT INTO public.item (item_uid, related_project_uid, workspace_uid, prefix_code, item_number, item_display_code, item_title, item_type, item_status, item_content, item_attribute)
        VALUES (gen_random_uuid(), $1, $2, $3, 99, 'TPM-99', '02 — Smart Queue Assistance Follow-up Meeting', 'Meeting', 'Completed', $4, '{"source_document_hash":"test_hash_123"}'::jsonb)
      `, [testProjectUid, testWorkspaceUid, testPrefixCode, JSON.stringify({ description: rawTranscript })])

      const duplicateProposal: any = {
        proposalId: `PROP-DUP-${Date.now()}`,
        sourceDocumentHash: 'test_hash_123',
        creates: [
          {
            candidateId: 'CAND-MEETING-02',
            itemTitle: '02 — Smart Queue Assistance Follow-up Meeting',
            itemType: 'Meeting',
            evidenceType: 'SOURCE_FACT',
            commitmentStatus: 'CONFIRMED',
            sourceContent: rawTranscript,
            description: rawTranscript,
            sourceEvidence: { extractedFact: 'Meeting 2', sourceText: rawTranscript, confidence: 1 }
          }
        ],
        updates: []
      }

      // Applying duplicate meeting proposal must throw DUPLICATE_MEETING_PREVENTED
      await expect(
        executeCanonicalProposalTransaction(client, duplicateProposal, {
          workspace_uid: testWorkspaceUid,
          related_project_uid: testProjectUid,
          members: []
        })
      ).rejects.toThrow(/DUPLICATE_MEETING_PREVENTED/)

      await client.query('ROLLBACK')
    } finally {
      client.release()
    }
  })

  it('5. Duplicate Progress Note Prevention: Re-processing identical progress does not duplicate text', async () => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const item51Uid = 'b1111111-1111-4000-8000-000000000051'
      const existingContent = {
        description: 'Queue interface and privacy review\n\n### 最新進度:\n- 收到 Queue mapping 檔案',
        metadata: 'v1'
      }

      await client.query(`
        INSERT INTO public.item (item_uid, related_project_uid, workspace_uid, prefix_code, item_number, item_display_code, item_title, item_type, item_status, item_priority, item_content)
        VALUES ($1, $2, $3, $4, 51, 'TPM-51', 'Queue Integration and Privacy Review', 'Task', 'In Progress', 'High', $5)
        ON CONFLICT (item_uid) DO UPDATE SET item_content = EXCLUDED.item_content, item_status = 'In Progress'
      `, [item51Uid, testProjectUid, testWorkspaceUid, testPrefixCode, JSON.stringify(existingContent)])

      // Pipeline execution against already updated item
      const llmClient = await import('../agents/llmClient.js')
      vi.spyOn(llmClient, 'callSubAgentJson').mockResolvedValueOnce({
        aligned_existing_items: [
          {
            item_uid: item51Uid,
            item_display_code: 'TPM-51',
            item_title: 'Queue Integration and Privacy Review',
            item_type: 'Task',
            is_mentioned: true,
            matched_evidence: ['Queue mapping file confirmed.'],
            action: 'NO_CHANGE',
            reason: 'Progress note already represented in item_content',
            field_diffs: []
          }
        ],
        new_candidate_items: [],
        unmatched_evidence: []
      })

      const res = await executeUnifiedMemoryPipeline({
        projectUid: testProjectUid,
        projectName: 'Test Project',
        items: [
          { item_uid: item51Uid, item_display_code: 'TPM-51', item_title: 'Queue Integration and Privacy Review', item_type: 'Task', item_status: 'In Progress', item_content: existingContent }
        ],
        transcriptText: 'Meeting transcript with already captured facts.'
      })

      // Must produce 0 updates and 1 NO_CHANGE
      expect(res.canonicalProposal.updates.length).toBe(0)
      expect(res.canonicalProposal.noChanges.length).toBe(1)
      expect(res.canonicalProposal.noChanges[0].candidateId).toBe('TPM-51')

      await client.query('ROLLBACK')
    } finally {
      client.release()
    }
  })
})
