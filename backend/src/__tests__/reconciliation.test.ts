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
    { member_uid: 'mem-003', member_name: 'Edmond Chan', member_email: 'edmond@test.com' },
    { member_uid: 'mem-004', member_name: 'David Lee', member_email: 'david@test.com' }
  ]

  const meeting1FilePath = path.resolve(__dirname, '../../../test_doc/01_SBG_Project_Kickoff_Meeting.md')
  const meeting1Content = fs.readFileSync(meeting1FilePath, 'utf-8')

  const legacyFilePath = path.resolve(__dirname, '../../../test_doc/1_first_meeting_legacy.md')
  const legacyMeetingContent = fs.readFileSync(legacyFilePath, 'utf-8')

  // SCENARIO 1: First upload of the meeting document (01_SBG_Project_Kickoff_Meeting.md)
  it('SCENARIO 1: First upload of Meeting 1 produces exact 16 substantive items with full metadata and topology', () => {
    const proposal = executeReconciliationPipeline({
      text: meeting1Content,
      existingItems: [],
      members: dummyMembers,
      currentProject: { project_uid: 'prj-1', project_name: 'SBG' },
      filename: '01_SBG_Project_Kickoff_Meeting.md'
    })

    expect(proposal.validation.status).toBe('PASS')
    expect(proposal.creates.length).toBe(16)
    expect(proposal.coverage.extracted).toBe(16)
    expect(proposal.coverage.processed).toBe(16)
    expect(proposal.coverage.isComplete).toBe(true)
    expect(proposal.sourceDocumentHash).toBeDefined()
    expect(proposal.sourceDocumentHash?.length).toBe(64) // SHA-256 length

    // Check breakdown of canonical types
    const byType = proposal.creates.reduce((acc, c) => {
      acc[c.itemType] = (acc[c.itemType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    expect(byType['Meeting']).toBe(1)
    expect(byType['Objective']).toBe(1)
    expect(byType['Milestone']).toBe(4)
    expect(byType['Requirement']).toBe(3)
    expect(byType['User story']).toBe(2)
    expect(byType['Task']).toBe(3)
    expect(byType['Decision']).toBe(2)

    // Check each create has candidateId & sourceEvidence
    for (const c of proposal.creates) {
      expect(c.candidateId).toMatch(/^CAND-\d{3}$/)
      expect(c.proposalItemId).toMatch(/^P001-I\d{2}$/)
      expect(c.sourceEvidence).toBeDefined()
      expect(c.sourceEvidence?.sourceType).toBe('explicit')
    }

    // Verify task assignees
    const taskKevin = proposal.creates.find(c => c.itemTitle.includes('Verification Service Prototype'))
    expect(taskKevin).toBeDefined()
    expect(taskKevin?.itemFollowBy).toBe('mem-001')

    const taskSarah = proposal.creates.find(c => c.itemTitle.includes('Passenger Guidance UI'))
    expect(taskSarah).toBeDefined()
    expect(taskSarah?.itemFollowBy).toBe('mem-002')

    const taskAudit = proposal.creates.find(c => c.itemTitle.includes('Transaction Audit Logging'))
    expect(taskAudit).toBeDefined()
    expect(taskAudit?.itemFollowBy).toBe('mem-001')

    // Verify parent relationships
    const us1 = proposal.creates.find(c => c.sourceLabel === 'US-01' || c.itemTitle.includes('Passenger Self-Service Verification'))!
    const us2 = proposal.creates.find(c => c.sourceLabel === 'US-02' || c.itemTitle.includes('Operations Transaction Visibility'))!
    expect(taskKevin?.parentProposalItemId).toBe(us1.proposalItemId)
    expect(taskSarah?.parentProposalItemId).toBe(us1.proposalItemId)
    expect(taskAudit?.parentProposalItemId).toBe(us2.proposalItemId)
  })

  // SCENARIO 2: Same document uploaded twice
  it('SCENARIO 2: Same document uploaded twice triggers SHA-256 duplicate detection and returns NO_CHANGE', () => {
    const docHash = computeDocumentHash(meeting1Content)
    const existingMeetingItem: ProjectItemMemory = {
      item_uid: 'item-meeting-001',
      item_display_code: 'TTG-1',
      item_title: 'Record 01 — Project Kickoff Meeting',
      item_type: 'Meeting',
      item_content: { text: meeting1Content, source_document_hash: docHash }
    }

    const proposal = executeReconciliationPipeline({
      text: meeting1Content,
      existingItems: [existingMeetingItem],
      members: dummyMembers,
      filename: '01_SBG_Project_Kickoff_Meeting.md'
    })

    expect(proposal.creates.length).toBe(0)
    expect(proposal.noChanges.length).toBe(16)
    expect(proposal.noChanges[0].reason).toContain('文件內容雜湊')
  })

  // SCENARIO 3: Same content with different filename
  it('SCENARIO 3: Same content with different filename still matches exact SHA-256 hash and prevents duplicates', () => {
    const docHash = computeDocumentHash(meeting1Content)
    const existingMeetingItem: ProjectItemMemory = {
      item_uid: 'item-meeting-001',
      item_display_code: 'TTG-1',
      item_title: 'Record 01 — Project Kickoff Meeting',
      item_type: 'Meeting',
      item_content: { text: meeting1Content, source_document_hash: docHash }
    }

    const proposal = executeReconciliationPipeline({
      text: meeting1Content,
      existingItems: [existingMeetingItem],
      members: dummyMembers,
      filename: 'renamed_first_meeting_copy.md'
    })

    expect(proposal.creates.length).toBe(0)
    expect(proposal.noChanges.length).toBe(16)
  })

  // SCENARIO 4: Same meeting with one new Task
  it('SCENARIO 4: Same meeting with one new Task returns NO_CHANGE for existing items and CREATE for the new Task', () => {
    // Existing DB contains the 16 original items
    const ledger = extractSourceLedgerFromText(meeting1Content, dummyMembers)
    const existingDBItems: ProjectItemMemory[] = ledger.candidates.map((c, idx) => ({
      item_uid: `db-item-${idx + 1}`,
      item_display_code: `TTG-${idx + 1}`,
      item_title: c.title,
      item_type: c.canonicalType,
      item_priority: c.priority,
      item_planned_end_date: c.dueDate,
      item_follow_by: c.assigneeUid,
      item_content: { text: c.description || c.title }
    }))

    const extendedContent = meeting1Content + '\n\n### TASK-04 — Redis State Synchronization\n- Owner: Kevin\n- Due: 2026-10-30\n'

    const proposal = executeReconciliationPipeline({
      text: extendedContent,
      existingItems: existingDBItems,
      members: dummyMembers
    })

    expect(proposal.creates.length).toBe(1)
    expect(proposal.creates[0].itemTitle).toContain('Redis')
    expect(proposal.creates[0].itemFollowBy).toBe('mem-001')
    expect(proposal.noChanges.length).toBe(16)
    expect(proposal.summaryStats?.created).toBe(1)
    expect(proposal.summaryStats?.noChange).toBe(16)
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
    expect(candidate.needsReview).toBe(true)
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
    expect(validation.errors.some(e => e.code === 'R002_NON_EXISTENT_PARENT')).toBe(true)
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
      text: meeting1Content,
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
      text: meeting1Content,
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
      insertedItems: [{ item_uid: 'uid-001' }], // only 1 inserted instead of 16
      updatedItems: [],
      candidateUidMap
    })

    expect(verification.status).toBe('APPLIED_WITH_VERIFICATION_ERRORS')
    expect(verification.mismatches.length).toBeGreaterThan(0)
    expect(verification.mismatches.some(m => m.field === 'itemCount')).toBe(true)
  })

  // SCENARIO 10: Meeting content preservation
  it('SCENARIO 10: Meeting item preserves full meeting text, metadata, date, and attendees', () => {
    const ledger = extractSourceLedgerFromText(legacyMeetingContent, dummyMembers, 'DOC-001')
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
  it('SCENARIO 11: Validates complete and partial hierarchy relationships correctly and avoids fabricated parents', () => {
    const proposal = executeReconciliationPipeline({
      text: legacyMeetingContent,
      existingItems: [],
      members: dummyMembers
    })

    const rels = proposal.relationships
    
    // Check Req 1 -> Objective
    const req1Rel = rels.find(r => r.childRef?.includes('雙模態') && r.parentRef?.includes('生物辨識'))
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

    // Check Local Cache Worker -> Bottleneck (mitigates relation)
    const cacheWorkerRel = rels.find(r => r.childRef?.includes('Local Cache Worker') && r.parentRef?.includes('DCS'))
    expect(cacheWorkerRel).toBeDefined()
    expect(cacheWorkerRel?.relationshipType).toBe('mitigates')

    // Check UAT 1 -> Task 1 (Verify)
    const uat1Rel = rels.find(r => r.childRef?.includes('500 人次') && r.parentRef?.includes('核驗端點'))
    expect(uat1Rel).toBeDefined()

    // Check UAT 2 -> Unresolved without fabricated parent
    const uat2Item = proposal.creates.find(c => c.sourceLabel === 'UAT-02' || c.itemTitle.includes('斷網'))
    expect(uat2Item?.parentCandidateId).toBeUndefined()
    expect(uat2Item?.parentProposalItemId).toBeUndefined()
    expect(uat2Item?.relationshipStatus).toBe('NEEDS_REVIEW')
  })

  // SCENARIO 12: Correct assignee storage (member UUID in item_follow_by)
  it('SCENARIO 12: Correct assignee storage resolves strictly to member UUIDs', () => {
    const proposal = executeReconciliationPipeline({
      text: legacyMeetingContent,
      existingItems: [],
      members: dummyMembers
    })

    const taskKevin = proposal.creates.find(c => c.itemTitle.includes('核驗端點'))
    expect(taskKevin?.itemFollowBy).toBe('mem-001')

    const taskSarah = proposal.creates.find(c => c.itemTitle.includes('雙螢幕'))
    expect(taskSarah?.itemFollowBy).toBe('mem-002')

    const taskEdmond = proposal.creates.find(c => c.itemTitle.includes('WebSocket'))
    expect(taskEdmond?.itemFollowBy).toBe('mem-003')

    const cacheWorker = proposal.creates.find(c => c.itemTitle.includes('Local Cache Worker'))
    expect(cacheWorker?.itemFollowBy).toBe('mem-001')

    // Meeting item and non-task items should not have foreign data in follow_by
    const reqItem = proposal.creates.find(c => c.itemType === 'Requirement')
    if (reqItem && !reqItem.itemFollowBy) {
      expect(reqItem.itemFollowBy).toBeUndefined()
    }
  })

  // SCENARIO 13: Canonical Proposal contract validation (proposalItemId, parentProposalItemId, strict hierarchy)
  it('SCENARIO 13: Strict Canonical Proposal ID contract validation (P001-Ixx, parentProposalItemId, no title IDs)', () => {
    const proposal = executeReconciliationPipeline({
      text: legacyMeetingContent,
      existingItems: [],
      members: dummyMembers,
      currentProject: { project_uid: 'prj-sbg', project_name: 'Smart Boarding Gate' },
      filename: '1_first_meeting_legacy.md'
    })

    expect(proposal.creates.length).toBe(16)

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
    const btnItem = proposal.creates.find(c => c.itemType === 'Bottleneck')!
    const taskCacheWorker = proposal.creates.find(c => c.itemType === 'Task' && c.itemTitle.includes('Local Cache Worker'))!
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

    // Bottleneck & Local Cache Worker linkage
    expect(taskCacheWorker.parentProposalItemId).toBe(btnItem.proposalItemId)

    // UAT parent checks
    expect(uat1Item.parentProposalItemId).toBe(taskKevin.proposalItemId)
    expect(uat1Item.relationshipStatus).toBe('CONFIRMED')
    expect(uat2Item.parentProposalItemId).toBeUndefined()
    expect(uat2Item.relationshipStatus).toBe('NEEDS_REVIEW')
  })

  // SCENARIO 14: Source-Fact Integrity & Anti-Hallucination verification
  it('SCENARIO 14: Strict Source-Fact Integrity removes 52-min & 200ms hallucinations from Objective and User Story', () => {
    const proposal = executeReconciliationPipeline({
      text: legacyMeetingContent,
      existingItems: [],
      members: dummyMembers
    })

    const objItem = proposal.creates.find(c => c.itemType === 'Objective')!
    expect(objItem.itemTitle).toBe('打造全球領先的新一代生物辨識自動登機門 (SBG)')
    expect(objItem.description).not.toContain('52 分鐘')
    expect(objItem.description).not.toContain('52分鐘')

    const userStoryItem = proposal.creates.find(c => c.itemType === 'User story')!
    expect(userStoryItem.description).not.toContain('200ms')
    expect(userStoryItem.description).toContain('2.5 秒')
  })

  // SCENARIO 15: Field-Level Diffing Isolation
  it('SCENARIO 15: Field-level diffing isolates single field changes (e.g. only due_date modified)', () => {
    const existingTask: ProjectItemMemory = {
      item_uid: 'TASK-101',
      item_display_code: 'TTG-101',
      item_title: '開發 DCS 閘門核驗核心端點',
      item_type: 'Task',
      item_follow_by: 'mem-001',
      follow_by_name: 'Kevin Lau',
      item_priority: 'Middle',
      item_planned_end_date: '2026-09-20',
      item_content: { text: '原有實作細節與端點規格' }
    }

    const candidate = normalizeCandidate({
      candidateId: 'CAND-501',
      title: '開發 DCS 閘門核驗核心端點',
      rawType: 'Task',
      assigneeUid: 'mem-001',
      assigneeName: 'Kevin Lau',
      priority: 'Middle',
      dueDate: '2026-09-25', // ONLY due date changed
      description: '原有實作細節與端點規格'
    }, 0)
    candidate.evidenceId = 'EV-501'

    const result = reconcileCandidate(candidate, [existingTask], dummyMembers)
    expect(result.action).toBe('UPDATE')
    expect(result.fieldDiffs).toBeDefined()
    expect(result.fieldDiffs?.length).toBe(1)
    expect(result.fieldDiffs?.[0].field).toBe('due_date')
    expect(result.fieldDiffs?.[0].existingValue).toBe('2026-09-20')
    expect(result.fieldDiffs?.[0].proposedValue).toBe('2026-09-25')
    expect(result.fieldDiffs?.[0].evidenceRefs).toContain('EV-501')
  })

  // SCENARIO 16: Explicit Correction Classification
  it('SCENARIO 16: Explicit correction classification marks action as CORRECTION with evidenceRefs', () => {
    const existingTask: ProjectItemMemory = {
      item_uid: 'TASK-102',
      item_display_code: 'TTG-102',
      item_title: '雙模態硬體通訊模組',
      item_type: 'Task',
      item_follow_by: 'mem-002',
      follow_by_name: 'Sarah Wong',
      item_priority: 'Middle',
      item_content: { text: '舊版通訊規範' }
    }

    const candidate = normalizeCandidate({
      candidateId: 'CAND-502',
      title: '雙模態硬體通訊模組',
      rawType: 'Task',
      assigneeUid: 'mem-001',
      assigneeName: 'Kevin Lau',
      priority: 'Middle',
      description: '更正：負責人由 Sarah 修正為 Kevin Lau (corrected specification)'
    }, 0)
    candidate.evidenceId = 'EV-502'

    const result = reconcileCandidate(candidate, [existingTask], dummyMembers)
    expect(result.action).toBe('CORRECTION')
    expect(result.fieldDiffs?.some(d => d.field === 'assignee')).toBe(true)
    expect(result.fieldDiffs?.[0].evidenceRefs).toContain('EV-502')
  })

  // SCENARIO 17: Conflict Detection
  it('SCENARIO 17: Explicit deprecation or conflict detection yields CONFLICT action', () => {
    const existingDecision: ProjectItemMemory = {
      item_uid: 'DEC-101',
      item_display_code: 'TTG-DEC-1',
      item_title: '採用 MQTT 協議作為閘門硬體通訊基礎',
      item_type: 'Decision',
      item_content: { text: '選定 MQTT' }
    }

    const candidate = normalizeCandidate({
      candidateId: 'CAND-503',
      title: '採用 MQTT 協議作為閘門硬體通訊基礎',
      rawType: 'Decision',
      description: '全體決議：淘汰舊版 MQTT 協議，改採 gRPC (deprecated and no longer used)'
    }, 0)

    const result = reconcileCandidate(candidate, [existingDecision], dummyMembers)
    expect(result.action).toBe('CONFLICT')
    expect(result.matchStatus).toBe('CONFLICT')
    expect(result.reviewStatus).toBe('CONFLICT')
  })

  // SCENARIO 18: Seeded Partially-Initialized SBG Project Reconciliation Test (MANDATORY REGRESSION TEST)
  it('SCENARIO 18: Seeded Partially-Initialized SBG Project proves full reconciliation: CREATE, UPDATE, NO_CHANGE, NEEDS_REVIEW', () => {
    // 1. Seed deterministic existing items
    const seededExistingItems: ProjectItemMemory[] = [
      {
        item_uid: 'uuid-obj-001',
        item_display_code: 'TTG-1',
        item_title: '打造全球領先的新一代生物辨識自動登機門 (SBG)',
        item_type: 'Objective',
        item_priority: 'High',
        item_content: { text: '打造全球領先的新一代生物辨識自動登機門 (SBG)，將旅客平均登機過閘時間縮短至 2.5 秒內，並達成 99.99% 的系統可用性。' }
      },
      {
        item_uid: 'uuid-req-001',
        item_display_code: 'TTG-2',
        item_title: '雙模態身份驗證 (QR Code + Face Recognition)',
        item_type: 'Requirement',
        item_priority: 'Middle',
        item_content: { text: '雙模態身份驗證 (QR Code + Face Recognition)' }
      },
      {
        item_uid: 'uuid-tsk-001',
        item_display_code: 'TTG-3',
        item_title: '開發 Cloud Run 上的 /api/v1/gate/verify 雙模態並行核驗端點',
        item_type: 'Task',
        item_follow_by: 'mem-001',
        follow_by_name: 'Kevin Lau',
        item_priority: 'Middle',
        item_planned_end_date: '2026-09-10', // Seeded with old date: 2026-09-10 (Source says 9月20日 -> 2026-09-20)
        item_content: { text: '開發 Cloud Run 上的 /api/v1/gate/verify 雙模態並行核驗端點' }
      },
      {
        item_uid: 'uuid-tsk-002',
        item_display_code: 'TTG-4',
        item_title: '開發登機門雙螢幕引導動畫與即時狀態回饋 UI (React + Tailwind)',
        item_type: 'Task',
        item_follow_by: 'mem-002',
        follow_by_name: 'Sarah Wong',
        item_priority: 'Middle',
        item_planned_end_date: '2026-09-22', // Identical to source (9月22日 -> 2026-09-22)
        item_content: { text: '開發登機門雙螢幕引導動畫與即時狀態回饋 UI (React + Tailwind)' }
      },
      {
        item_uid: 'uuid-btn-001',
        item_display_code: 'TTG-5',
        item_title: '第三方 DCS API 響應延遲與 Rate Limit',
        item_type: 'Bottleneck',
        item_priority: 'High',
        item_content: { text: '機場舊版 DCS 系統在高峰期 API 響應高達 800ms，且缺乏批量查詢介面，可能導致閘門等待逾時。需由 Kevin 負責構建 Local Cache Worker 進行預先拉取緩存。' }
      },
      {
        item_uid: 'uuid-dec-001',
        item_display_code: 'TTG-6',
        item_title: '人臉特徵比對與資料庫架構',
        item_type: 'Decision',
        item_priority: 'Middle',
        item_content: { text: '經討論一致決定採用 Neon PostgreSQL + pgvector (768-dim) 作為人臉特徵向量比對引擎，淘汰舊版 Redis 方案，以確保完全符合 Google OKF 知識圖譜標準。' }
      },
      {
        item_uid: 'uuid-ms-002',
        item_display_code: 'TTG-7',
        item_title: '於 12 號登機門進行現場 UAT 壓力驗收測試 (2026-11-30)',
        item_type: 'Milestone',
        item_priority: 'High',
        item_planned_end_date: '2026-11-30', // Identical to source
        item_content: { text: '於 12 號登機門進行現場 UAT 壓力驗收測試' }
      }
    ]

    const proposal = executeReconciliationPipeline({
      text: legacyMeetingContent,
      existingItems: seededExistingItems,
      members: dummyMembers,
      currentProject: { project_uid: 'prj-sbg', project_name: 'SBG' },
      filename: '1_first_meeting_legacy.md'
    })

    if (proposal.validation.status === 'FAIL') {
      console.log('Validation Errors:', proposal.validation.errors)
    }

    expect(proposal.validation.status).toBe('PASS')

    // 1. Check UPDATE: Kevin verification Task due date modified (2026-09-10 -> 2026-09-20)
    expect(proposal.updates.length).toBeGreaterThanOrEqual(1)
    const kevinTaskUpdate = proposal.updates.find(u => u.itemTitle?.includes('核驗端點'))
    expect(kevinTaskUpdate).toBeDefined()
    expect(kevinTaskUpdate?.targetItemUid).toBe('uuid-tsk-001')
    expect(kevinTaskUpdate?.fieldDiffs?.some(f => f.field === 'due_date' && f.proposedValue === '2026-09-20')).toBe(true)

    console.log('Scenario 18 Updates Detail:', JSON.stringify(proposal.updates.map(u => ({ title: u.itemTitle, diffs: u.fieldDiffs })), null, 2))
    console.log('Scenario 18 Conflicts:', JSON.stringify(proposal.conflicts, null, 2))
    console.log('Scenario 18 ReviewRequired:', JSON.stringify(proposal.reviewRequired, null, 2))

    // 2. Check NO_CHANGE: Objective, Bottleneck, Decision Neon, Sarah Task, Milestone 2
    expect(proposal.noChanges.length).toBeGreaterThanOrEqual(5)
    expect(proposal.noChanges.some(n => n.existingItemUid === 'uuid-obj-001')).toBe(true)
    expect(proposal.noChanges.some(n => n.existingItemUid === 'uuid-btn-001')).toBe(true)
    expect(proposal.noChanges.some(n => n.existingItemUid === 'uuid-dec-001')).toBe(true)
    expect(proposal.noChanges.some(n => n.existingItemUid === 'uuid-tsk-002')).toBe(true)
    expect(proposal.noChanges.some(n => n.existingItemUid === 'uuid-ms-002')).toBe(true)

    // 3. Check CREATE: Local Cache Worker is created as an independent Task (crucial regression)
    expect(proposal.creates.length).toBeGreaterThanOrEqual(1)
    const cacheWorkerTask = proposal.creates.find(c => c.itemTitle.includes('Local Cache Worker'))
    expect(cacheWorkerTask).toBeDefined()
    expect(cacheWorkerTask?.itemType).toBe('Task')
    expect(cacheWorkerTask?.itemFollowBy).toBe('mem-001')
    expect(cacheWorkerTask?.sourceEvidence).toBeDefined()

    // 4. Check NEEDS_REVIEW: UAT-02 ungrounded relationship
    const uat2Item = proposal.creates.find(c => c.sourceLabel === 'UAT-02' || c.itemTitle.includes('斷網'))
    expect(uat2Item).toBeDefined()
    expect(uat2Item?.relationshipStatus).toBe('NEEDS_REVIEW')
    expect(uat2Item?.needsReview).toBe(true)

    // 5. Check Summary Stats & All Actions Represented
    expect(proposal.summaryStats?.created).toBe(proposal.creates.length)
    expect(proposal.summaryStats?.updated).toBe(proposal.updates.length)
    expect(proposal.summaryStats?.noChange).toBe(proposal.noChanges.length)
    expect(proposal.summaryStats?.created).toBeGreaterThan(0)
    expect(proposal.summaryStats?.updated).toBeGreaterThan(0)
    expect(proposal.summaryStats?.noChange).toBeGreaterThan(0)
  })

  // SCENARIO 19: Negative Test — Upstream Extraction Incomplete Gate blocks database mutation and fails validation
  it('SCENARIO 19: Negative Test — Extraction Incomplete Gate aborts proposal and rejects DB transaction', async () => {
    // Simulate candidate extraction producing only 1 Meeting when the source document has 6+ substantive sections
    const incompleteLedgerCompleteness = {
      isComplete: false,
      diagnostics: {
        detectedSignals: {
          hasMeeting: true,
          hasObjective: true,
          hasMilestones: true,
          hasRequirements: true,
          hasUserStories: true,
          hasTasks: true,
          hasDecisions: true
        },
        candidateCounts: {
          meeting: 1,
          objective: 0,
          milestone: 0,
          requirement: 0,
          userStory: 0,
          task: 0,
          decision: 0,
          total: 1
        }
      },
      report: {
        missingSections: ['Objective', 'Milestone', 'Requirement', 'User story', 'Task', 'Decision'],
        reason: 'Source document contains Objective, Milestones, Requirements, User Stories, Tasks, Decisions, but candidate discovery only produced 1 Meeting candidate.'
      }
    }

    const incompleteProposal: any = {
      proposalId: 'PROP-TEST-INCOMPLETE',
      mode: 'EXTRACTION_INCOMPLETE',
      createdAt: new Date().toISOString(),
      validation: {
        status: 'FAIL',
        errors: [{ code: 'EXTRACTION_INCOMPLETE', severity: 'ERROR', message: incompleteLedgerCompleteness.report.reason }],
        warnings: []
      },
      coverage: {
        extracted: 1,
        processed: 0,
        isComplete: false,
        incompleteExtraction: incompleteLedgerCompleteness.report,
        diagnostics: incompleteLedgerCompleteness.diagnostics
      },
      creates: [],
      updates: [],
      corrections: [],
      noChanges: [],
      reviewRequired: [],
      conflicts: [],
      ignored: [],
      relationships: [],
      relations: []
    }

    expect(incompleteProposal.mode).toBe('EXTRACTION_INCOMPLETE')
    expect(incompleteProposal.coverage.isComplete).toBe(false)
    expect(incompleteProposal.validation.status).toBe('FAIL')

    // Verify executeCanonicalProposalTransaction explicitly rejects this proposal before any DB query
    const mockClient: any = {
      query: vi.fn().mockResolvedValue({ rows: [] })
    }

    await expect(
      executeCanonicalProposalTransaction(mockClient, incompleteProposal, {
        workspace_uid: 'ws-test',
        related_project_uid: 'prj-test',
        members: dummyMembers
      })
    ).rejects.toThrow(/EXTRACTION_INCOMPLETE|Incomplete extraction|validation failed/i)

    // Assert that NO database queries were issued (transaction was never opened)
    expect(mockClient.query).not.toHaveBeenCalled()
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

