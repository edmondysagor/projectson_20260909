import { describe, it, expect, vi } from 'vitest'
import { executeBetaMemoryAlignment } from '../services/reconciliation/betaMemoryAlignment.js'

describe('Memory Alignment Beta Service', () => {
  it('should return helpful guidance when no items exist in project', async () => {
    const res = await executeBetaMemoryAlignment({
      projectUid: '00000000-0000-0000-0000-000000000000',
      projectName: 'Empty Project',
      items: [],
      transcriptText: 'Some meeting text'
    })

    expect(res.actionPreview).toBeNull()
    expect(res.summary.totalExisting).toBe(0)
    expect(res.reportMarkdown).toContain('目前在資料庫中尚無既有工單')
  })

  it('should build proper action preview and prevent database writes', async () => {
    const sampleItems = [
      {
        item_uid: '01923a11-0008-7000-8000-000000000008',
        item_display_code: 'TPM-35',
        item_title: 'Conduct User & Staff Interviews',
        item_type: 'Task',
        item_status: 'Ready',
        follow_by_name: 'Rachel',
        item_content: { description: 'Interview passengers' }
      }
    ]

    const res = await executeBetaMemoryAlignment({
      projectUid: '597aaf7e-ebc5-413b-b259-255141dc000e',
      projectName: 'Projectson Phase 1',
      items: sampleItems,
      transcriptText: 'Rachel: I completed the interviews we discussed with 3 passengers and 2 staff.'
    })

    expect(res.actionPreview).toBeDefined()
    expect(res.actionPreview.applied).toBe(false) // Zero DB writes in Beta mode
    expect(res.actionPreview.actionType).toBe('batch_proposal')
    expect(res.summary.totalExisting).toBe(1)
  })

  it('should handle LLM response with missing or undefined field_diffs gracefully without crashing', async () => {
    const sampleItems = [
      {
        item_uid: '01923a11-0008-7000-8000-000000000008',
        item_display_code: 'TPM-35',
        item_title: 'Conduct User & Staff Interviews',
        item_type: 'Task',
        item_status: 'Ready',
        follow_by_name: 'Rachel',
        item_content: { description: 'Interview passengers' }
      }
    ]

    const res = await executeBetaMemoryAlignment({
      projectUid: '597aaf7e-ebc5-413b-b259-255141dc000e',
      projectName: 'Projectson Phase 1',
      items: sampleItems,
      transcriptText: 'Team: No progress today, standard review.'
    })

    expect(res.actionPreview).toBeDefined()
    expect(res.reportMarkdown).toBeDefined()
    expect(res.summary.totalExisting).toBe(1)
  })

  it('should filter out no-op diffs (e.g. null -> null) and exclude NO_CHANGE from actionPreview.items', async () => {
    // Mock callSubAgentJson
    const llmClient = await import('../agents/llmClient.js')
    vi.spyOn(llmClient, 'callSubAgentJson').mockResolvedValueOnce({
      aligned_items: [
        {
          item_uid: '01923a11-0008-7000-8000-000000000008',
          item_display_code: 'TPM-55',
          item_title: 'Unchanged Task with null date',
          item_type: 'Task',
          is_mentioned: true,
          matched_evidence: ['Tentative target remains.'],
          action: 'UPDATE',
          reason: 'Date remains open',
          field_diffs: [
            {
              field: 'item_planned_end_date',
              before: null,
              after: null,
              rationale: 'No change to open date'
            }
          ]
        },
        {
          item_uid: '01923a11-0008-7000-8000-000000000009',
          item_display_code: 'TPM-51',
          item_title: 'Queue Integration and Privacy Review',
          item_type: 'Task',
          is_mentioned: true,
          matched_evidence: ['Queue mapping file received and usable.'],
          action: 'UPDATE',
          reason: 'Status moved to in progress',
          field_diffs: [
            {
              field: 'item_status',
              before: 'Not Start',
              after: 'In Progress',
              rationale: 'Work has begun on integration check'
            }
          ]
        },
        {
          item_uid: '01923a11-0008-7000-8000-000000000010',
          item_display_code: 'TPM-52',
          item_title: 'Unmentioned Requirement',
          item_type: 'Requirement',
          is_mentioned: false,
          matched_evidence: [],
          action: 'NO_CHANGE',
          reason: 'Not mentioned in transcript',
          field_diffs: []
        }
      ],
      unmatched_evidence: []
    })

    const sampleItems = [
      {
        item_uid: '01923a11-0008-7000-8000-000000000008',
        item_display_code: 'TPM-55',
        item_title: 'Unchanged Task with null date',
        item_type: 'Task',
        item_status: 'Ready',
        item_planned_end_date: null
      },
      {
        item_uid: '01923a11-0008-7000-8000-000000000009',
        item_display_code: 'TPM-51',
        item_title: 'Queue Integration and Privacy Review',
        item_type: 'Task',
        item_status: 'Not Start',
        item_planned_end_date: null
      },
      {
        item_uid: '01923a11-0008-7000-8000-000000000010',
        item_display_code: 'TPM-52',
        item_title: 'Unmentioned Requirement',
        item_type: 'Requirement',
        item_status: 'Ready',
        item_planned_end_date: null
      }
    ]

    const res = await executeBetaMemoryAlignment({
      projectUid: '597aaf7e-ebc5-413b-b259-255141dc000e',
      projectName: 'Projectson Phase 1',
      items: sampleItems,
      transcriptText: 'Some transcript'
    })

    // TPM-55 had a no-op diff null->null, so it should be reclassified to NO_CHANGE
    // TPM-52 was NO_CHANGE
    // TPM-51 had a genuine diff (item_status: Not Start -> In Progress), so it is UPDATE
    expect(res.summary.updateCount).toBe(1)
    expect(res.summary.noChangeCount).toBe(2)

    // previewItems must ONLY contain TPM-51 (1 item), not 3 items!
    expect(res.actionPreview.items.length).toBe(1)
    expect(res.actionPreview.items[0].targetDisplayCode).toBe('TPM-51')
    expect(res.actionPreview.items[0].updates).toEqual({ item_status: 'In Progress' })
    // Verify updates does NOT contain rationale/description pollution
    expect(res.actionPreview.items[0].updates.description).toBeUndefined()
    expect(res.actionPreview.items[0].updates.item_content).toBeUndefined()
  })
})

