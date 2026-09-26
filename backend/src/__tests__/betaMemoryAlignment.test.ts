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
})

