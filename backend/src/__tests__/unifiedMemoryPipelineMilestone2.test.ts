import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { pool } from '../db.js'
import { executeUnifiedMemoryPipeline } from '../services/reconciliation/unifiedMemoryPipeline.js'
import { executeCanonicalProposalTransaction, verifyDatabaseState } from '../services/reconciliation/dbExecutor.js'
import { recordHumanApproval, clearProposalRegistry } from '../services/reconciliation/proposalRegistry.js'
import { assertAuthorityBoundaryForMutation } from '../services/reconciliation/schemaGuard.js'

describe('Unified Memory Pipeline — Milestone 2 CanonicalProposal Integration Tests', () => {
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
      [testPrefixCode, `Milestone2 Test Workspace ${testPrefixCode}`]
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
      [testWorkspaceUid, `Milestone2 Test Project ${testPrefixCode}`, `${testPrefixCode}-PRO-1`]
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

  it('1. Generates complete CanonicalProposal with mixed CREATE + UPDATE and valid 64-char SHA-256 hash', async () => {
    const llmClient = await import('../agents/llmClient.js')

    const dbSnapshot10 = [
      {
        item_uid: '01923a11-0008-7000-8000-000000000051',
        item_display_code: 'TPM-51',
        item_title: 'Queue Integration and Privacy Review',
        item_type: 'Task',
        item_status: 'Not Start',
        item_content: { description: 'Queue interface and privacy review', metadata: 'v1' }
      },
      {
        item_uid: '01923a11-0008-7000-8000-000000000052',
        item_display_code: 'TPM-52',
        item_title: 'Conduct User & Staff Interviews',
        item_type: 'Task',
        item_status: 'Ready',
        item_content: { description: 'Interview passengers and staff' }
      },
      ...[48, 49, 50, 53, 54, 55, 56, 57].map(num => ({
        item_uid: `01923a11-0008-7000-8000-0000000000${num}`,
        item_display_code: `TPM-${num}`,
        item_title: `Existing Item ${num}`,
        item_type: 'Requirement',
        item_status: 'Ready',
        item_content: { description: `Description for ${num}` }
      }))
    ]

    vi.spyOn(llmClient, 'callSubAgentJson').mockResolvedValueOnce({
      aligned_existing_items: [
        {
          item_uid: '01923a11-0008-7000-8000-000000000051',
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
          item_uid: '01923a11-0008-7000-8000-000000000052',
          item_display_code: 'TPM-52',
          item_title: 'Conduct User & Staff Interviews',
          item_type: 'Task',
          is_mentioned: true,
          matched_evidence: ['Rachel: I completed the interviews.'],
          action: 'UPDATE',
          reason: 'Interviews completed',
          field_diffs: [
            {
              field: 'item_status',
              before: 'Ready',
              after: 'Completed',
              rationale: 'Rachel confirmed interviews completed'
            }
          ]
        },
        ...[48, 49, 50, 53, 54, 55, 56, 57].map(num => ({
          item_uid: `01923a11-0008-7000-8000-0000000000${num}`,
          item_display_code: `TPM-${num}`,
          item_title: `Existing Item ${num}`,
          item_type: 'Requirement',
          is_mentioned: false,
          matched_evidence: [],
          action: 'NO_CHANGE' as const,
          reason: 'Not mentioned in transcript',
          field_diffs: []
        }))
      ],
      new_candidate_items: [
        {
          candidate_id: 'CAND-MEETING-2',
          item_type: 'Meeting',
          item_title: '02 — Smart Queue Assistance Follow-up Meeting',
          item_status: 'Completed',
          item_priority: 'Middle',
          assignee_name: 'Edmond',
          parent_candidate_id: null,
          parent_item_uid: null,
          reason: 'Follow-up meeting session',
          matched_evidence: ['# 02 — Smart Queue Assistance Follow-up Meeting'],
          item_content: { description: 'Follow-up discussion on queue mapping' }
        }
      ],
      unmatched_evidence: []
    })

    const res = await executeUnifiedMemoryPipeline({
      projectUid: testProjectUid,
      projectName: 'Projectson Phase 1',
      items: dbSnapshot10,
      transcriptText: 'Meeting 2 transcript...'
    })

    const canonical = res.canonicalProposal
    expect(canonical).toBeDefined()
    expect(canonical.creates.length).toBe(1)
    expect(canonical.updates.length).toBe(2)
    expect(canonical.noChanges.length).toBe(8)
    
    // Hash check
    expect(canonical.proposalHash).toBeDefined()
    expect(canonical.proposalHash?.length).toBe(64)
    expect((canonical as any).authorityToken).toBeDefined()

    // Verify structured updates preserves metadata
    const update51 = canonical.updates.find(u => u.targetItemUid === '01923a11-0008-7000-8000-000000000051')
    expect(update51?.updates.item_content.metadata).toBe('v1')
  })

  it('2. Authority Boundary: Unapproved proposal is rejected before DB transaction begins', async () => {
    const unapprovedProposal: any = {
      proposalId: 'PROP-UNAPPROVED-TEST',
      proposalHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      creates: [],
      updates: []
    }

    const check = assertAuthorityBoundaryForMutation(unapprovedProposal, {
      requireServerAuthority: true,
      requireHumanApproval: true,
      humanApproval: undefined
    })

    expect(check.valid).toBe(false)
    expect(check.errors).toBeDefined()
  })

  it('3. DB Execution: Valid mixed CanonicalProposal executes atomically and verifies with zero mismatches', async () => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const item51Uid = 'a1111111-1111-4000-8000-000000000051'
      const item52Uid = 'a1111111-1111-4000-8000-000000000052'

      await client.query(`
        INSERT INTO public.item (item_uid, related_project_uid, workspace_uid, prefix_code, item_number, item_display_code, item_title, item_type, item_status, item_priority, item_content)
        VALUES 
          ($1, $3, $4, $5, 51, 'TPM-51', 'Queue Integration and Privacy Review', 'Task', 'Not Start', 'High', '{"description":"Original 51","metadata":"v1"}'::jsonb),
          ($2, $3, $4, $5, 52, 'TPM-52', 'Conduct User & Staff Interviews', 'Task', 'Ready', 'High', '{"description":"Original 52"}'::jsonb)
        ON CONFLICT (item_uid) DO UPDATE 
        SET item_status = EXCLUDED.item_status, item_content = EXCLUDED.item_content
      `, [item51Uid, item52Uid, testProjectUid, testWorkspaceUid, testPrefixCode])

      // Generate mixed CanonicalProposal via unifiedMemoryPipeline
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
            reason: 'Work started',
            field_diffs: [
              {
                field: 'item_status',
                before: 'Not Start',
                after: 'In Progress',
                rationale: 'Status moved to In Progress'
              },
              {
                field: 'item_content',
                before: { description: 'Original 51' },
                after: { description: 'Original 51\n\n### 最新進度:\n- 收到 Queue mapping 檔案' },
                rationale: 'Append progress'
              }
            ]
          },
          {
            item_uid: item52Uid,
            item_display_code: 'TPM-52',
            item_title: 'Conduct User & Staff Interviews',
            item_type: 'Task',
            is_mentioned: true,
            matched_evidence: ['Interviews done.'],
            action: 'UPDATE',
            reason: 'Done',
            field_diffs: [
              {
                field: 'item_status',
                before: 'Ready',
                after: 'Completed',
                rationale: 'Completed'
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
            reason: 'New follow-up meeting document',
            matched_evidence: ['Meeting 2'],
            item_content: { description: 'Follow-up discussion notes' }
          }
        ],
        unmatched_evidence: []
      })

      const pipelineRes = await executeUnifiedMemoryPipeline({
        projectUid: testProjectUid,
        projectName: 'Test Project',
        items: [
          { item_uid: item51Uid, item_display_code: 'TPM-51', item_title: 'Queue Integration and Privacy Review', item_type: 'Task', item_status: 'Not Start', item_content: { description: 'Original 51', metadata: 'v1' } },
          { item_uid: item52Uid, item_display_code: 'TPM-52', item_title: 'Conduct User & Staff Interviews', item_type: 'Task', item_status: 'Ready', item_content: { description: 'Original 52' } }
        ],
        transcriptText: 'Meeting 2: Smart Queue Assistance follow-up discussion transcript. The team reviewed queue mapping file and confirmed user interviews are complete.'
      })

      const proposal = pipelineRes.canonicalProposal

      // Record Human Approval
      const approvalRecord = {
        approvedBy: 'Edmond (Project Lead)',
        approvedAt: new Date().toISOString(),
        approvedProposalHash: proposal.proposalHash!
      }
      const approvalResult = recordHumanApproval(proposal.proposalId!, approvalRecord)
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

      // Verify row 51 in DB has updated status and preserved metadata
      const r51 = await client.query('SELECT item_status, item_content FROM public.item WHERE item_uid = $1', [item51Uid])
      expect(r51.rows[0].item_status).toBe('In Progress')
      expect(r51.rows[0].item_content.metadata).toBe('v1')
      expect(r51.rows[0].item_content.description).toContain('收到 Queue mapping 檔案')

      // Rollback test isolation transaction so we leave no test traces
      await client.query('ROLLBACK')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  })

  it('4. Atomic Rollback: Mid-transaction failure leaves zero partial writes', async () => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const badProposal: any = {
        proposalId: `PROP-FAIL-${Date.now()}`,
        creates: [
          {
            candidateId: 'CAND-VALID',
            itemTitle: 'Valid New Item Before Crash',
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
            updates: { item_status: 'In Progress' }
          }
        ]
      }

      // Execute proposal
      const execResult = await executeCanonicalProposalTransaction(client, badProposal, {
        workspace_uid: testWorkspaceUid,
        related_project_uid: testProjectUid,
        members: []
      })

      // Verification will detect that updated item was not found in DB
      const verification = await verifyDatabaseState(client, badProposal, execResult)
      expect(verification.status).toBe('FAILED_VERIFICATION')
      expect(verification.mismatches.length).toBeGreaterThan(0)

      // Rollback transaction
      await client.query('ROLLBACK')

      // Verify valid item was NOT committed
      const checkRow = await pool.query(`SELECT * FROM public.item WHERE item_title = 'Valid New Item Before Crash'`)
      expect(checkRow.rows.length).toBe(0)
    } finally {
      client.release()
    }
  })

  it('5. Stale-Proposal Protection: Proposal modified after approval is rejected at authority boundary', async () => {
    const pipelineRes = await executeUnifiedMemoryPipeline({
      projectUid: testProjectUid,
      projectName: 'Test Project',
      items: [
        { item_uid: '01923a11-0008-7000-8000-000000000051', item_display_code: 'TPM-51', item_title: 'Queue Integration', item_type: 'Task', item_status: 'Not Start', item_content: { description: 'Original 51' } }
      ],
      transcriptText: 'Team confirmed Queue Integration is now in progress and mapping file is received.'
    })

    const proposal = pipelineRes.canonicalProposal
    const originalHash = proposal.proposalHash!

    // Human approves the original proposal hash
    const approvalResult = recordHumanApproval(proposal.proposalId!, {
      approvedBy: 'Edmond (Project Lead)',
      approvedAt: new Date().toISOString(),
      approvedProposalHash: originalHash
    })
    expect(approvalResult.valid).toBe(true)

    // Simulate stale/tampered proposal: modifying updates after approval
    const staleProposal = {
      ...proposal,
      updates: [
        {
          ...proposal.updates[0],
          updates: { item_status: 'Completed' } // Stale mutation
        }
      ]
    }

    // 1. Boundary check must reject stale proposal due to hash mismatch
    const boundaryCheck = assertAuthorityBoundaryForMutation(staleProposal, {
      requireServerAuthority: true,
      requireHumanApproval: true,
      humanApproval: {
        approvedBy: 'Edmond (Project Lead)',
        approvedAt: new Date().toISOString(),
        approvedProposalHash: originalHash
      }
    })

    expect(boundaryCheck.valid).toBe(false)
    expect(boundaryCheck.errors.some(e => e.includes('APPROVAL_HASH_MISMATCH') || e.includes('Preview/Apply Mismatch'))).toBe(true)

    // 2. DB transaction execution must abort with 0 writes
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await expect(
        executeCanonicalProposalTransaction(client, staleProposal, {
          workspace_uid: testWorkspaceUid,
          related_project_uid: testProjectUid,
          members: []
        })
      ).rejects.toThrow(/Preview\/Apply Mismatch/)
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }
  })
})
