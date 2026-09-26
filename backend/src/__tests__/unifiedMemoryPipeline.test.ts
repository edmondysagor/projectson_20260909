import { describe, it, expect, vi } from 'vitest'
import { executeUnifiedMemoryPipeline } from '../services/reconciliation/unifiedMemoryPipeline.js'

describe('Unified Memory Pipeline — Milestone 1 Tests', () => {
  it('1. Empty project + Meeting 1: produces pure CREATE proposals with direct sparse relationships', async () => {
    const llmClient = await import('../agents/llmClient.js')
    
    vi.spyOn(llmClient, 'callSubAgentJson').mockResolvedValueOnce({
      aligned_existing_items: [],
      new_candidate_items: [
        {
          candidate_id: 'CAND-001',
          item_type: 'Meeting',
          item_title: '01 — Smart Queue Assistance Kickoff Meeting',
          item_status: 'Completed',
          item_priority: 'Middle',
          assignee_name: 'Edmond',
          parent_candidate_id: null,
          parent_item_uid: null,
          reason: 'Initial project kickoff meeting',
          matched_evidence: ['Kickoff meeting header'],
          item_content: { description: 'Kickoff notes' }
        },
        {
          candidate_id: 'CAND-002',
          item_type: 'Task',
          item_title: 'Conduct User & Staff Interviews',
          item_status: 'Ready',
          item_priority: 'High',
          assignee_name: 'Rachel',
          parent_candidate_id: 'CAND-001', // Direct relationship without invented intermediate layer
          parent_item_uid: null,
          reason: 'Rachel will conduct 3 passenger and 2 staff interviews',
          matched_evidence: ['Rachel: I will interview 3 passengers and 2 staff.'],
          item_content: { description: 'Interview passengers and staff' }
        },
        {
          candidate_id: 'CAND-003',
          item_type: 'Task',
          item_title: 'Queue Integration and Privacy Review',
          item_status: 'Not Start',
          item_priority: 'High',
          assignee_name: 'Michael',
          parent_candidate_id: 'CAND-001', // Direct sparse relationship
          parent_item_uid: null,
          reason: 'Michael to check queue interface and privacy',
          matched_evidence: ['Michael: I will check the queue interface and security.'],
          item_content: { description: 'Queue interface and privacy review' }
        }
      ],
      unmatched_evidence: []
    })

    const res = await executeUnifiedMemoryPipeline({
      projectUid: '11111111-2222-3333-4444-555555555555',
      projectName: 'Projectson Phase 1',
      items: [],
      transcriptText: 'Kickoff meeting transcript...'
    })

    expect(res.summary.totalExisting).toBe(0)
    expect(res.summary.createCount).toBe(3)
    expect(res.summary.updateCount).toBe(0)
    expect(res.actionPreview.items.length).toBe(3)
    expect(res.actionPreview.applied).toBe(false)
    
    // Direct sparse relationship preserved
    const taskRachel = res.actionPreview.items.find((i: any) => i.candidateId === 'CAND-002')
    expect(taskRachel.parentCandidateId).toBe('CAND-001')
    expect(taskRachel.parentItemUid).toBeNull()
  })

  it('2. Existing 10 items + Meeting 2: produces 2 UPDATEs, 8 NO_CHANGEs, and 1 Meeting CREATE', async () => {
    const llmClient = await import('../agents/llmClient.js')

    // Real-style authoritative DB snapshot with 10 existing items
    const sampleItems = [
      {
        item_uid: 'real-db-uid-51',
        item_display_code: 'TPM-51',
        item_title: 'Queue Integration and Privacy Review',
        item_type: 'Task',
        item_status: 'Not Start',
        item_content: { description: 'Queue interface and privacy review', metadata: 'v1' }
      },
      {
        item_uid: 'real-db-uid-52',
        item_display_code: 'TPM-52',
        item_title: 'Conduct User & Staff Interviews',
        item_type: 'Task',
        item_status: 'Ready',
        item_content: { description: 'Interview passengers and staff' }
      },
      // 8 unchanged items (TPM-48..50, TPM-53..57)
      ...[48, 49, 50, 53, 54, 55, 56, 57].map(num => ({
        item_uid: `real-db-uid-${num}`,
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
          item_uid: 'real-db-uid-51',
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
              after: { description: 'Queue interface and privacy review\n\n### 進度記錄:\n- 收到 Queue mapping 檔案' },
              rationale: 'Append progress notes'
            }
          ]
        },
        {
          item_uid: 'real-db-uid-52',
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
              rationale: 'Rachel confirmed 3 passengers & 2 staff interviewed'
            }
          ]
        },
        ...[48, 49, 50, 53, 54, 55, 56, 57].map(num => ({
          item_uid: `real-db-uid-${num}`,
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
      unmatched_evidence: [
        {
          topic: 'Estimated waiting time',
          excerpt: 'Keep estimated waiting time outside initial release.',
          notes: 'Future release idea'
        }
      ]
    })

    const res = await executeUnifiedMemoryPipeline({
      projectUid: '11111111-2222-3333-4444-555555555555',
      projectName: 'Projectson Phase 1',
      items: sampleItems,
      transcriptText: 'Meeting 2 transcript...'
    })

    expect(res.summary.totalExisting).toBe(10)
    expect(res.summary.updateCount).toBe(2)
    expect(res.summary.noChangeCount).toBe(8)
    expect(res.summary.createCount).toBe(1) // 1 Meeting CREATE

    // Actionable preview contains strictly 3 items (1 CREATE + 2 UPDATEs, 0 NO_CHANGE)
    expect(res.actionPreview.items.length).toBe(3)
    
    const createItem = res.actionPreview.items.find((i: any) => i.actionType === 'create_item')
    expect(createItem.candidateId).toBe('CAND-MEETING-2')
    expect(createItem.itemTitle).toBe('02 — Smart Queue Assistance Follow-up Meeting')

    const updateItem51 = res.actionPreview.items.find((i: any) => i.targetDisplayCode === 'TPM-51')
    expect(updateItem51.targetItemUid).toBe('real-db-uid-51')
    expect(updateItem51.updates.item_status).toBe('In Progress')
    expect(updateItem51.updates.item_content.metadata).toBe('v1') // Preserves unrelated JSONB metadata
  })

  it('3. Repeated source document with Meeting item already persisted: does NOT duplicate Meeting CREATE or progress', async () => {
    const llmClient = await import('../agents/llmClient.js')

    const itemsWithMeetingAlreadyPersisted = [
      {
        item_uid: 'real-db-meeting-2-uid',
        item_display_code: 'TPM-60',
        item_title: '02 — Smart Queue Assistance Follow-up Meeting',
        item_type: 'Meeting',
        item_status: 'Completed',
        item_content: { description: 'Follow-up discussion on queue mapping' }
      },
      {
        item_uid: 'real-db-uid-51',
        item_display_code: 'TPM-51',
        item_title: 'Queue Integration and Privacy Review',
        item_type: 'Task',
        item_status: 'In Progress',
        item_content: { description: 'Queue interface and privacy review\n\n### 進度記錄:\n- 收到 Queue mapping 檔案' }
      }
    ]

    vi.spyOn(llmClient, 'callSubAgentJson').mockResolvedValueOnce({
      aligned_existing_items: [
        {
          item_uid: 'real-db-uid-51',
          item_display_code: 'TPM-51',
          item_title: 'Queue Integration and Privacy Review',
          item_type: 'Task',
          is_mentioned: true,
          matched_evidence: ['Queue mapping file received and usable.'],
          action: 'UPDATE',
          reason: 'Same progress mentioned',
          field_diffs: [
            {
              field: 'item_status',
              before: 'In Progress',
              after: 'In Progress',
              rationale: 'Status unchanged'
            },
            {
              field: 'item_content',
              before: { description: 'Queue interface and privacy review\n\n### 進度記錄:\n- 收到 Queue mapping 檔案' },
              after: { description: 'Queue interface and privacy review\n\n### 進度記錄:\n- 收到 Queue mapping 檔案' },
              rationale: 'Same progress'
            }
          ]
        },
        {
          item_uid: 'real-db-meeting-2-uid',
          item_display_code: 'TPM-60',
          item_title: '02 — Smart Queue Assistance Follow-up Meeting',
          item_type: 'Meeting',
          is_mentioned: true,
          matched_evidence: ['Header'],
          action: 'NO_CHANGE',
          reason: 'Meeting already recorded',
          field_diffs: []
        }
      ],
      new_candidate_items: [
        {
          candidate_id: 'CAND-DUPLICATE-MEETING',
          item_type: 'Meeting',
          item_title: '02 — Smart Queue Assistance Follow-up Meeting',
          item_status: 'Completed',
          item_priority: 'Middle',
          assignee_name: 'Edmond',
          parent_candidate_id: null,
          parent_item_uid: null,
          reason: 'Attempted duplicate',
          matched_evidence: [],
          item_content: { description: 'Duplicate notes' }
        }
      ],
      unmatched_evidence: []
    })

    const res = await executeUnifiedMemoryPipeline({
      projectUid: '11111111-2222-3333-4444-555555555555',
      projectName: 'Projectson Phase 1',
      items: itemsWithMeetingAlreadyPersisted,
      transcriptText: 'Meeting 2 transcript...'
    })

    // Duplicate meeting CREATE is dropped deterministically!
    expect(res.summary.createCount).toBe(0)
    // No-op diffs on TPM-51 are dropped deterministically!
    expect(res.summary.updateCount).toBe(0)
    expect(res.summary.noChangeCount).toBe(2)
    expect(res.actionPreview.items.length).toBe(0)
  })

  it('4. Invalid parent references are flagged as NEEDS_REVIEW instead of silently crashing', async () => {
    const llmClient = await import('../agents/llmClient.js')

    vi.spyOn(llmClient, 'callSubAgentJson').mockResolvedValueOnce({
      aligned_existing_items: [],
      new_candidate_items: [
        {
          candidate_id: 'CAND-001',
          item_type: 'Task',
          item_title: 'Orphan Task With Nonexistent Parent UID',
          item_status: 'Not Start',
          item_priority: 'Middle',
          assignee_name: null,
          parent_candidate_id: null,
          parent_item_uid: 'nonexistent-db-parent-uid',
          reason: 'Task with broken parent reference',
          matched_evidence: ['Some task text'],
          item_content: { description: 'Task description' }
        }
      ],
      unmatched_evidence: []
    })

    const res = await executeUnifiedMemoryPipeline({
      projectUid: '11111111-2222-3333-4444-555555555555',
      projectName: 'Projectson Phase 1',
      items: [],
      transcriptText: 'Some transcript'
    })

    expect(res.details.needsReview.length).toBeGreaterThan(0)
    expect(res.details.needsReview[0].issue).toContain('在資料庫中不存在')
  })
})
