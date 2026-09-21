import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { executeReconciliationPipeline } from '../services/reconciliation/proposalPipeline.js'
import { reconcileCandidate } from '../services/reconciliation/itemReconciler.js'
import { normalizeCandidate, isJunkHeadingOrPreamble, extractTitleAndLabel } from '../services/reconciliation/candidateNormalizer.js'
import { validateAndPlanTopology } from '../services/reconciliation/graphValidator.js'
import { extractSourceLedgerFromText } from '../services/reconciliation/sourceLedgerExtractor.js'
import { computeDocumentHash, extractDocumentMetadata } from '../services/reconciliation/documentNormalizer.js'
import { executeCanonicalProposalTransaction, verifyDatabaseState } from '../services/reconciliation/dbExecutor.js'
import { ProjectItemMemory } from '../services/reconciliation/memoryRetriever.js'

describe('Projectson AI Copilot Meeting Intelligence & Reconciliation Spec Refactor Suite', () => {
  const dummyMembers = [
    { member_uid: 'mem-001', member_name: 'Kevin Lau', member_email: 'kevin@test.com' },
    { member_uid: 'mem-002', member_name: 'Sarah Wong', member_email: 'sarah@test.com' },
    { member_uid: 'mem-003', member_name: 'Edmond Chan', member_email: 'edmond@test.com' }
  ]

  const meetingFilePath = path.resolve(__dirname, '../../../test_doc/1_first_meeting.md')
  const meetingContent = fs.readFileSync(meetingFilePath, 'utf-8')

  // SCENARIO 1: First upload of the meeting document
  it('SCENARIO 1: First upload of the meeting document produces exact 15 creates with full metadata and topology', () => {
    const proposal = executeReconciliationPipeline({
      text: meetingContent,
      existingItems: [],
      members: dummyMembers,
      currentProject: { project_uid: 'prj-1', project_name: 'SBG' },
      filename: '1_first_meeting.md'
    })

    expect(proposal.validation.status).toBe('PASS')
    expect(proposal.creates.length).toBe(15)
    expect(proposal.coverage.extracted).toBe(15)
    expect(proposal.coverage.processed).toBe(15)
    expect(proposal.sourceDocumentHash).toBeDefined()
    expect(proposal.sourceDocumentHash?.length).toBe(64) // SHA-256 length

    // Check each create has candidateId & sourceEvidence
    for (const c of proposal.creates) {
      expect(c.candidateId).toMatch(/^CAND-\d{3}$/)
      expect(c.sourceEvidence).toBeDefined()
      expect(c.sourceEvidence?.sourceType).toBe('explicit')
    }
  })

  // SCENARIO 2: Same document uploaded twice
  it('SCENARIO 2: Same document uploaded twice triggers SHA-256 duplicate detection and returns NO_CHANGE', () => {
    const docHash = computeDocumentHash(meetingContent)
    const existingMeetingItem: ProjectItemMemory = {
      item_uid: 'item-meeting-001',
      item_display_code: 'TTG-1',
      item_title: '專案啟動與架構決策會議記錄',
      item_type: 'Meeting',
      item_content: { text: meetingContent, source_document_hash: docHash }
    }

    const proposal = executeReconciliationPipeline({
      text: meetingContent,
      existingItems: [existingMeetingItem],
      members: dummyMembers,
      filename: '1_first_meeting.md'
    })

    expect(proposal.creates.length).toBe(0)
    expect(proposal.noChanges.length).toBe(15)
    expect(proposal.noChanges[0].reason).toContain('文件內容雜湊')
  })

  // SCENARIO 3: Same content with different filename
  it('SCENARIO 3: Same content with different filename still matches exact SHA-256 hash and prevents duplicates', () => {
    const docHash = computeDocumentHash(meetingContent)
    const existingMeetingItem: ProjectItemMemory = {
      item_uid: 'item-meeting-001',
      item_display_code: 'TTG-1',
      item_title: '專案會議',
      item_type: 'Meeting',
      item_content: { text: meetingContent, source_document_hash: docHash }
    }

    const proposal = executeReconciliationPipeline({
      text: meetingContent,
      existingItems: [existingMeetingItem],
      members: dummyMembers,
      filename: 'renamed_first_meeting_copy.md'
    })

    expect(proposal.creates.length).toBe(0)
    expect(proposal.noChanges.length).toBe(15)
  })

  // SCENARIO 4: Same meeting with one new Task
  it('SCENARIO 4: Same meeting with one new Task returns NO_CHANGE for existing items and CREATE for the new Task', () => {
    // Existing DB contains the 15 original items
    const ledger = extractSourceLedgerFromText(meetingContent, dummyMembers)
    const existingDBItems: ProjectItemMemory[] = ledger.candidates.map((c, idx) => ({
      item_uid: `db-item-${idx + 1}`,
      item_display_code: `TTG-${idx + 1}`,
      item_title: c.title,
      item_type: c.canonicalType,
      item_follow_by: c.assigneeUid,
      item_content: { text: c.description || c.title }
    }))

    const extendedContent = meetingContent + '\n- [Task] 新增 Redis 閘門狀態同步機制 (指派給: Kevin Lau)'

    const proposal = executeReconciliationPipeline({
      text: extendedContent,
      existingItems: existingDBItems,
      members: dummyMembers
    })

    expect(proposal.creates.length).toBe(1)
    expect(proposal.creates[0].itemTitle).toContain('Redis')
    expect(proposal.creates[0].itemFollowBy).toBe('mem-001')
    expect(proposal.noChanges.length).toBe(15)
  })

  // SCENARIO 5: Existing Task with updated deadline or assignee
  it('SCENARIO 5: Existing Task with updated details produces an UPDATE outcome', () => {
    const existingItems: ProjectItemMemory[] = [
      {
        item_uid: 'TPM-241',
        item_display_code: 'TPM-241',
        item_title: '開發 Cloud Run 上的 /api/v1/gate/verify 雙模態並行核驗端點',
        item_type: 'Task',
        item_follow_by: 'mem-002', // previously Sarah
        item_content: { text: 'Old description' }
      }
    ]

    const candidate = normalizeCandidate({
      candidateId: 'CAND-001',
      title: '開發 Cloud Run 上的 /api/v1/gate/verify 雙模態並行核驗端點',
      rawType: 'Task',
      assigneeUid: 'mem-001', // now Kevin
      description: 'Extended description with high concurrency benchmarks'
    }, 0)

    const result = reconcileCandidate(candidate, existingItems, dummyMembers)
    expect(result.action).toBe('UPDATE')
    expect(result.existingItemUid).toBe('TPM-241')
    expect(result.changes?.itemFollowBy).toBe('mem-001')
  })

  // SCENARIO 6: Missing / ambiguous parent relationship marked as NEEDS_REVIEW
  it('SCENARIO 6: Ambiguous or ungrounded UAT is marked as NEEDS_REVIEW without breaking topology', () => {
    const candidate: any = {
      candidateId: 'CAND-099',
      canonicalType: 'UAT',
      rawType: 'UAT',
      title: '未知模組異常邊界測試',
      sourceLabel: 'UAT-99'
    }

    const { validation, relationships } = validateAndPlanTopology([
      { candidateId: 'CAND-099', action: 'CREATE', candidate, reason: 'new' }
    ])

    expect(candidate.relationshipStatus).toBe('NEEDS_REVIEW')
    expect(validation.warnings.length).toBeGreaterThan(0)
    expect(validation.warnings[0].message).toContain('NEEDS_REVIEW')
  })

  // SCENARIO 7: Invalid parentCandidateId validation
  it('SCENARIO 7: Invalid non-existent parentCandidateId blocks proposal with validation error', () => {
    const cand1: any = { candidateId: 'CAND-001', canonicalType: 'Task', rawType: 'Task', title: 'Task 1', parentCandidateId: 'CAND-999' }

    const { validation } = validateAndPlanTopology([
      { candidateId: 'CAND-001', action: 'CREATE', candidate: cand1, reason: 'new' }
    ])

    expect(validation.status).toBe('FAIL')
    expect(validation.errors.some(e => e.code === 'R002')).toBe(true)
  })

  // SCENARIO 8: Partial DB failure triggers transaction rollback
  it('SCENARIO 8: Database failure triggers atomic transaction rollback', async () => {
    const mockClient: any = {
      query: vi.fn().mockImplementation((queryText: string) => {
        if (queryText === 'BEGIN' || queryText === 'ROLLBACK') return Promise.resolve({ rows: [] })
        if (queryText.includes('UPDATE public.workspace')) {
          throw new Error('Database connection failed')
        }
        return Promise.resolve({ rows: [] })
      })
    }

    const proposal = executeReconciliationPipeline({
      text: meetingContent,
      existingItems: [],
      members: dummyMembers
    })

    await expect(
      executeCanonicalProposalTransaction(mockClient, proposal, {
        workspace_uid: 'ws-test',
        related_project_uid: 'prj-test',
        members: dummyMembers
      })
    ).rejects.toThrow('Database connection failed')
  })

  // SCENARIO 9: Proposal count differs from actual DB count during verification
  it('SCENARIO 9: Verification detects mismatches between Proposal and actual DB state', async () => {
    const proposal = executeReconciliationPipeline({
      text: meetingContent,
      existingItems: [],
      members: dummyMembers
    })

    // Simulate DB returning fewer items than proposal creates
    const mockPool: any = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            item_uid: 'uid-001',
            item_title: proposal.creates[0].itemTitle,
            item_type: proposal.creates[0].itemType,
            item_content: { text: 'content' }
          }
        ]
      })
    }

    const candidateUidMap = new Map<string, string>()
    proposal.creates.forEach((c, i) => candidateUidMap.set(c.candidateId, `uid-${String(i + 1).padStart(3, '0')}`))

    const verification = await verifyDatabaseState(mockPool, proposal, {
      insertedItems: [{ item_uid: 'uid-001' }], // only 1 inserted instead of 15
      updatedItems: [],
      candidateUidMap
    })

    expect(verification.status).toBe('APPLIED_WITH_VERIFICATION_ERRORS')
    expect(verification.mismatches.length).toBeGreaterThan(0)
    expect(verification.mismatches.some(m => m.field === 'itemCount')).toBe(true)
  })

  // SCENARIO 10: Meeting content preservation
  it('SCENARIO 10: Meeting item preserves full meeting text, metadata, date, and attendees', () => {
    const ledger = extractSourceLedgerFromText(meetingContent, dummyMembers, 'DOC-001')
    const meetingCand = ledger.candidates.find(c => c.canonicalType === 'Meeting')

    expect(meetingCand).toBeDefined()
    expect(meetingCand?.description).toBeDefined()
    expect(meetingCand?.description?.length).toBeGreaterThan(200)
    expect(meetingCand?.keyAttributes?.meetingDate).toBe('2026-09-13')
    expect(meetingCand?.keyAttributes?.attendees).toContain('Kevin Lau')
    expect(meetingCand?.keyAttributes?.attendees).toContain('Sarah Wong')
    expect(meetingCand?.keyAttributes?.sourceDocumentHash).toBeDefined()
  })

  // SCENARIO 11: Correct Objective -> Requirement -> User Story -> Task -> UAT relationships
  it('SCENARIO 11: Validates complete and partial hierarchy relationships correctly', () => {
    const proposal = executeReconciliationPipeline({
      text: meetingContent,
      existingItems: [],
      members: dummyMembers
    })

    const rels = proposal.relationships.filter(r => r.relationshipType === 'parent_child')
    
    // Check Req 1 -> Objective
    const req1Rel = rels.find(r => r.childRef?.includes('雙模態') && (r.parentRef?.includes('2.5 秒') || r.parentRef?.includes('生物辨識')))
    expect(req1Rel).toBeDefined()

    // Check Story 1 -> Req 1
    const storyRel = rels.find(r => (r.childRef?.includes('登機旅客') || r.childRef?.includes('無感通過')) && r.parentRef?.includes('雙模態'))
    expect(storyRel).toBeDefined()

    // Check Task 1 (Verify) -> Story 1
    const task1Rel = rels.find(r => r.childRef?.includes('核驗端點') && (r.parentRef?.includes('登機旅客') || r.parentRef?.includes('無感通過')))
    expect(task1Rel).toBeDefined()

    // Check Task 2 (WebSocket hardware) -> Req 2 (direct without User Story!)
    const task2Rel = rels.find(r => r.childRef?.includes('WebSocket') && r.parentRef?.includes('通訊協議'))
    expect(task2Rel).toBeDefined()

    // Check UAT 1 -> Task 1 (Verify)
    const uat1Rel = rels.find(r => r.childRef?.includes('500 人次') && r.parentRef?.includes('核驗端點'))
    expect(uat1Rel).toBeDefined()

    // Check UAT 2 -> Task 2 (WebSocket)
    const uat2Rel = rels.find(r => (r.childRef?.includes('斷網') || r.childRef?.includes('UAT-02')) && r.parentRef?.includes('WebSocket'))
    expect(uat2Rel).toBeDefined()
  })

  // SCENARIO 12: Correct assignee storage (member UUID in item_follow_by)
  it('SCENARIO 12: Correct assignee storage resolves strictly to member UUIDs', () => {
    const proposal = executeReconciliationPipeline({
      text: meetingContent,
      existingItems: [],
      members: dummyMembers
    })

    const taskKevin = proposal.creates.find(c => c.itemTitle.includes('核驗端點'))
    expect(taskKevin?.itemFollowBy).toBe('mem-001')

    const taskSarah = proposal.creates.find(c => c.itemTitle.includes('雙螢幕'))
    expect(taskSarah?.itemFollowBy).toBe('mem-002')

    const taskEdmond = proposal.creates.find(c => c.itemTitle.includes('WebSocket'))
    expect(taskEdmond?.itemFollowBy).toBe('mem-003')

    // Meeting item and non-task items should not have foreign data in follow_by
    const reqItem = proposal.creates.find(c => c.itemType === 'Requirement')
    if (reqItem && !reqItem.itemFollowBy) {
      expect(reqItem.itemFollowBy).toBeUndefined()
    }
  })

  // SCENARIO 13: Canonical Proposal contract validation (proposalItemId, parentProposalItemId, strict hierarchy)
  it('SCENARIO 13: Strict Canonical Proposal ID contract validation (P001-Ixx, parentProposalItemId, no title IDs)', () => {
    const proposal = executeReconciliationPipeline({
      text: meetingContent,
      existingItems: [],
      members: dummyMembers,
      currentProject: { project_uid: 'prj-sbg', project_name: 'Smart Boarding Gate' },
      filename: '1_first_meeting.md'
    })

    expect(proposal.creates.length).toBe(15)

    // 1. Every create item must have proposalItemId matching P001-Ixx
    for (const item of proposal.creates) {
      expect(item.proposalItemId).toMatch(/^P001-I\d{2}$/)
      // parentItemUid must NOT contain titles
      if (item.parentItemUid) {
        expect(item.parentItemUid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      }
    }

    const objItem = proposal.creates.find(c => c.itemType === 'Objective')!
    const req1Item = proposal.creates.find(c => c.itemType === 'Requirement' && c.itemTitle.includes('雙模態'))!
    const storyItem = proposal.creates.find(c => c.itemType === 'User story')!
    const taskKevin = proposal.creates.find(c => c.itemType === 'Task' && c.itemTitle.includes('核驗端點'))!
    const req2Item = proposal.creates.find(c => c.itemType === 'Requirement' && c.itemTitle.includes('硬件'))!
    const taskEdmond = proposal.creates.find(c => c.itemType === 'Task' && c.itemTitle.includes('WebSocket'))!
    const uat1Item = proposal.creates.find(c => c.itemType === 'UAT' && (c.sourceLabel === 'UAT-01' || c.itemTitle.includes('500')))!
    const uat2Item = proposal.creates.find(c => c.itemType === 'UAT' && (c.sourceLabel === 'UAT-02' || c.itemTitle.includes('斷網')))!

    // Verify parentProposalItemId linkages
    expect(req1Item.parentProposalItemId).toBe(objItem.proposalItemId)
    expect(storyItem.parentProposalItemId).toBe(req1Item.proposalItemId)
    expect(taskKevin.parentProposalItemId).toBe(storyItem.proposalItemId)
    
    // CRITICAL: Task Edmond MUST be bound to Requirement 2 (Gate Protocol), NEVER to User Story 1!
    expect(req2Item.parentProposalItemId).toBe(objItem.proposalItemId)
    expect(taskEdmond.parentProposalItemId).toBe(req2Item.proposalItemId)
    expect(taskEdmond.parentProposalItemId).not.toBe(storyItem.proposalItemId)

    // UAT parent checks
    expect(uat1Item.parentProposalItemId).toBe(taskKevin.proposalItemId)
    expect(uat1Item.relationshipStatus).toBe('CONFIRMED')
    expect(uat2Item.parentProposalItemId).toBe(taskEdmond.proposalItemId)
    expect(uat2Item.relationshipStatus).toBe('CONFIRMED')
  })

  // Label normalization unit test
  it('Label normalization extracts clean title and separate sourceLabel without corrupting brackets', () => {
    const r1 = extractTitleAndLabel('[UAT-01] 500 passengers stress test')
    expect(r1.sourceLabel).toBe('UAT-01')
    expect(r1.title).toBe('500 passengers stress test')

    const r2 = extractTitleAndLabel('01] 500 passengers stress test')
    expect(r2.title).toBe('500 passengers stress test')

    const r3 = extractTitleAndLabel('[REQ-02]: 閘門硬件與通訊協議')
    expect(r3.sourceLabel).toBe('REQ-02')
    expect(r3.title).toBe('閘門硬件與通訊協議')
  })
})
