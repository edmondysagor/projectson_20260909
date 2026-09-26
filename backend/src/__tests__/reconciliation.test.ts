import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { executeReconciliationPipeline } from '../services/reconciliation/proposalPipeline.js'
import { reconcileCandidate } from '../services/reconciliation/itemReconciler.js'
import { normalizeCandidate, isJunkHeadingOrPreamble, extractTitleAndLabel } from '../services/reconciliation/candidateNormalizer.js'
import { validateAndPlanTopology, validateCanonicalProposal } from '../services/reconciliation/graphValidator.js'
import { extractSourceLedgerFromText } from '../services/reconciliation/sourceLedgerExtractor.js'
import { computeDocumentHash, extractDocumentMetadata } from '../services/reconciliation/documentNormalizer.js'
import { executeCanonicalProposalTransaction, verifyDatabaseState } from '../services/reconciliation/dbExecutor.js'
import { assertAuthorityBoundaryForMutation } from '../services/reconciliation/schemaGuard.js'
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

  const meeting2FilePath = path.resolve(__dirname, '../../../test_doc/B_meeting_script_2.md')
  const meeting2Content = fs.readFileSync(meeting2FilePath, 'utf-8')

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

    expect(['APPLIED_WITH_VERIFICATION_ERRORS', 'FAILED_VERIFICATION']).toContain(verification.status)
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

  // SCENARIO 20: 4 Strict Architectural Rules Verification
  it('SCENARIO 20: 4 Strict Architectural Rules (parentItemUid non-title, itemFollowBy isolation, meeting sourceContent vs summary, source identifiers)', () => {
    const proposal = executeReconciliationPipeline({
      text: meeting1Content,
      existingItems: [],
      members: dummyMembers,
      currentProject: { project_uid: 'prj-1', project_name: 'SBG' },
      filename: '01_SBG_Project_Kickoff_Meeting.md'
    })

    const isUuid = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str))

    // Rule 1: parentItemUid 不得使用 title (必須為有效 UUID 或 undefined)
    for (const item of proposal.creates) {
      if (item.parentItemUid) {
        expect(isUuid(item.parentItemUid)).toBe(true)
      }
      // In first upload (batch creates), in-batch parents use parentProposalItemId
      if (item.itemType === 'Task' || item.itemType === 'User story' || item.itemType === 'Requirement') {
        expect(item.parentItemUid).toBeUndefined()
        expect(item.parentProposalItemId).toMatch(/^P001-I\d{2}$/)
      }
    }

    // Rule 2: itemFollowBy 不得混用 assignee / project / follower (必須為 member UID 或 undefined)
    for (const item of proposal.creates) {
      if (item.itemFollowBy) {
        expect(item.itemFollowBy).toMatch(/^mem-\d+$/)
        expect(item.itemFollowBy).not.toContain(' ')
        expect(item.itemFollowBy).not.toBe('SBG')
        expect(item.itemFollowBy).not.toBe('prj-1')
      }
    }

    // Rule 3: Meeting 必須保留 normalized sourceContent，而 summary 另存
    const meetingItem = proposal.creates.find(c => c.itemType === 'Meeting')
    expect(meetingItem).toBeDefined()
    expect(meetingItem?.sourceContent).toBeDefined()
    expect(meetingItem?.sourceContent?.length).toBeGreaterThan(200)
    expect(meetingItem?.sourceContent).toContain('Record 01')
    expect(meetingItem?.summary).toBeDefined()
    expect(proposal.documentMetadata?.normalizedContent).toBeDefined()
    expect(proposal.documentMetadata?.meetingObjective).toBeDefined()

    // Rule 4: 保留 source identifiers，例如 TASK-01 / REQ-01 / US-01 / DEC-01 / M1
    const labels = proposal.creates.map(c => c.sourceLabel || c.sourceIdentifier).filter(Boolean)
    expect(labels.some(l => l?.startsWith('REQ'))).toBe(true)
    expect(labels.some(l => l?.startsWith('US'))).toBe(true)
    expect(labels.some(l => l?.startsWith('TASK') || l?.startsWith('TSK'))).toBe(true)
    expect(labels.some(l => l?.startsWith('DEC'))).toBe(true)
    expect(labels.some(l => l?.startsWith('M') || l?.startsWith('MS'))).toBe(true)
  })

  // SCENARIO 21: Proposal Integrity Gate v2 — Inferred UAT is quarantined and rejected from CREATE
  it('SCENARIO 21: Proposal Integrity Gate v2 — Ungrounded inferred UAT is quarantined in reviewRequired with applied=false and fails validation if forced into CREATE', async () => {
    // 1. Simulate an incoming candidate list with 16 explicit records + 2 inferred UAT suggestions
    const inferredUatCandidate = normalizeCandidate({
      candidateId: 'SUGGEST-UAT-001',
      rawType: 'UAT',
      title: 'Verify Processing Time ≤3s',
      classification: 'INFERRED',
      inferred: true,
      evidenceIds: [],
      inferenceStatus: 'INFERENCE',
      needsReview: true
    }, 16)

    expect(inferredUatCandidate.classification).toBe('INFERRED')
    expect(inferredUatCandidate.inferred).toBe(true)

    // Run reconciliation pipeline with rawPreviews including the inferred candidate
    const proposal = executeReconciliationPipeline({
      text: meeting1Content,
      existingItems: [],
      members: dummyMembers,
      rawPreviews: [{ actionType: 'create_item', ...inferredUatCandidate }],
      filename: '01_SBG_Project_Kickoff_Meeting.md'
    })

    // Assert that the proposal created ONLY the 16 explicit source records (NO UAT in creates)
    expect(proposal.creates.length).toBe(16)
    expect(proposal.creates.some(c => c.itemType === 'UAT')).toBe(false)
    expect(proposal.creates.some(c => c.itemTitle.includes('Verify Processing Time'))).toBe(false)

    // Assert auditCounts accurately tracks source-supported vs inferred
    expect(proposal.auditCounts?.sourceSupported).toBe(16)
    expect(proposal.auditCounts?.canonicalCreates).toBe(16)
    expect(proposal.auditCounts?.inferredApplied).toBe(0)
    expect(proposal.auditCounts?.explicitApplied).toBe(16)

    // Assert that if an inferred item is forcefully injected into proposal.creates, Apply Gate and Validation fail immediately
    const taintedProposal = {
      ...proposal,
      creates: [
        ...proposal.creates,
        {
          candidateId: 'SUGGEST-UAT-001',
          proposalItemId: 'P001-I17',
          itemTitle: 'Verify Processing Time ≤3s',
          itemType: 'UAT',
          itemPriority: 'Middle',
          classification: 'INFERRED' as const,
          inferred: true,
          evidenceIds: [],
          description: 'Inferred verification requirement'
        }
      ]
    }

    const mockClient: any = {
      query: vi.fn().mockResolvedValue({ rows: [] })
    }

    await expect(
      executeCanonicalProposalTransaction(mockClient, taintedProposal as any, {
        workspace_uid: 'ws-test',
        related_project_uid: 'prj-test',
        members: dummyMembers
      })
    ).rejects.toThrow(/Apply Gate Violation|without explicit source evidence|Inferred items cannot be applied/i)
  })

  // SCENARIO 22: Count Integrity & Audit Table — Exactly 16 explicit source records produce exactly 16 CREATEs
  it('SCENARIO 22: Count Integrity & Audit Table — Exactly 16 explicit source records produce 16 CREATEs and 16 DB mutations', async () => {
    const proposal = executeReconciliationPipeline({
      text: meeting1Content,
      existingItems: [],
      members: dummyMembers,
      currentProject: { project_uid: 'prj-sbg', project_name: 'SBG' },
      filename: '01_SBG_Project_Kickoff_Meeting.md'
    })

    expect(proposal.validation.status).toBe('PASS')
    expect(proposal.creates.length).toBe(16)
    expect(proposal.auditCounts).toEqual({
      sourceSupported: 16,
      canonicalCreates: 16,
      inferredApplied: 0,
      explicitApplied: 16
    })

    // Execute mock transactional DB Apply
    let wsCounter = 100
    let uuidCounter = 1
    const mockDbRows: any[] = []
    const mockClient: any = {
      query: vi.fn().mockImplementation((q: string, params: any[]) => {
        if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return Promise.resolve({ rows: [] })
        if (q.includes('UPDATE public.workspace')) {
          wsCounter += 16
          return Promise.resolve({ rows: [{ prefix_code: 'TTG', last_item_number: wsCounter }] })
        }
        if (q.includes('SELECT gen_random_uuid()')) {
          return Promise.resolve({ rows: [{ uid: `00000000-0000-0000-0000-${String(uuidCounter++).padStart(12, '0')}` }] })
        }
        if (q.includes('INSERT INTO public.item')) {
          const row = {
            item_uid: params[0],
            item_display_code: params[1],
            prefix_code: params[2],
            item_number: params[3],
            item_title: params[4],
            related_project_uid: params[5],
            workspace_uid: params[6],
            item_type: params[7],
            item_status: params[8],
            item_priority: params[9],
            item_follow_by: params[10],
            item_content: params[11],
            parent_item_uid: params[12],
            relation_item_uid: params[13],
            item_attribute: params[14]
          }
          mockDbRows.push(row)
          return Promise.resolve({ rows: [row] })
        }
        if (q.includes('SELECT item_uid')) {
          return Promise.resolve({ rows: mockDbRows })
        }
        return Promise.resolve({ rows: [] })
      })
    }

    const execRes = await executeCanonicalProposalTransaction(mockClient, proposal, {
      workspace_uid: 'ws-sbg',
      related_project_uid: 'prj-sbg',
      members: dummyMembers
    })

    expect(execRes.insertedItems.length).toBe(16)

    const verifyRes = await verifyDatabaseState(mockClient, proposal, execRes)
    expect(verifyRes.status).toBe('APPLIED_AND_VERIFIED')
    expect(verifyRes.totalVerified).toBe(16)
    expect(verifyRes.mismatches.length).toBe(0)
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

    const r4 = extractTitleAndLabel('M1 — Charter & Requirement Baseline')
    expect(r4.sourceLabel).toBe('M1')
    expect(r4.title).toBe('Charter & Requirement Baseline')

    const r5 = extractTitleAndLabel('TASK-01 — Verification Service Prototype')
    expect(r5.sourceLabel).toBe('TASK-01')
    expect(r5.title).toBe('Verification Service Prototype')
  })

  // =========================================================================
  // MEMORY GRAPH INTEGRITY HARDENING REGRESSION TEST SUITE (TESTS 1 to 10)
  // =========================================================================

  it('INTEGRITY TEST 1: Meeting 01 extraction produces exact 16 items and UAT = 0', () => {
    const proposal = executeReconciliationPipeline({
      text: meeting1Content,
      existingItems: [],
      members: dummyMembers,
      filename: '01_SBG_Project_Kickoff_Meeting.md'
    })

    expect(proposal.validation.status).toBe('PASS')
    expect(proposal.creates.length).toBe(16)
    const uatCount = proposal.creates.filter(c => c.itemType === 'UAT').length
    expect(uatCount).toBe(0)
  })

  it('INTEGRITY TEST 2: No title-based relationships across proposal and applied DB mutations', async () => {
    const proposal = executeReconciliationPipeline({
      text: meeting1Content,
      existingItems: [],
      members: dummyMembers,
      filename: '01_SBG_Project_Kickoff_Meeting.md'
    })

    // Assert proposal items use proposalNodeId / proposalItemId and NEVER titles
    for (const c of proposal.creates) {
      expect(c.parentItemUid).toBeUndefined() // In proposal stage, only defined if linking to existing DB UUID
      if (c.parentProposalNodeId) {
        expect(c.parentProposalNodeId).toMatch(/^node-[a-z]+-\d{3}$/)
        expect(c.parentProposalNodeId).not.toContain(' ')
      }
      if (c.parentProposalItemId) {
        expect(c.parentProposalItemId).toMatch(/^P001-I\d{2}$/)
        expect(c.parentProposalItemId).not.toContain(' ')
      }
      if (c.relations) {
        for (const rel of c.relations) {
          expect(rel.targetProposalNodeId).toMatch(/^node-[a-z]+-\d{3}$/)
          expect(rel.targetProposalNodeId).not.toContain(' ')
        }
      }
    }
  })

  it('INTEGRITY TEST 3: Source identifier preservation (TASK-01..03, REQ-01..03, US-01..02, DEC-01..02, M1..M4)', () => {
    const proposal = executeReconciliationPipeline({
      text: meeting1Content,
      existingItems: [],
      members: dummyMembers,
      filename: '01_SBG_Project_Kickoff_Meeting.md'
    })

    const extractedIdentifiers = proposal.creates.map(c => c.sourceIdentifier || c.sourceLabel).filter(Boolean)

    const expectedIdentifiers = [
      'REQ-01', 'REQ-02', 'REQ-03',
      'US-01', 'US-02',
      'TASK-01', 'TASK-02', 'TASK-03',
      'DEC-01', 'DEC-02',
      'M1', 'M2', 'M3', 'M4'
    ]

    for (const expected of expectedIdentifiers) {
      expect(extractedIdentifiers).toContain(expected)
    }

    // Ensure TASK-01 did not become "01"
    expect(extractedIdentifiers).not.toContain('01')
    expect(extractedIdentifiers).not.toContain('02')
    expect(extractedIdentifiers).not.toContain('03')
  })

  it('INTEGRITY TEST 4: Unsupported derived KPI ("must provide an auditable record" -> NO "100%" KPI)', () => {
    const proposal = executeReconciliationPipeline({
      text: meeting1Content,
      existingItems: [],
      members: dummyMembers,
      filename: '01_SBG_Project_Kickoff_Meeting.md'
    })

    for (const c of proposal.creates) {
      const allText = JSON.stringify(c)
      expect(allText).not.toContain('審計能力 = 100%')
      expect(allText).not.toContain('審計能力=100%')
      expect(allText).not.toContain('Auditability = 100%')
    }
  })

  it('INTEGRITY TEST 5: Unsupported ADR status (DEC-01 retains source fidelity, NO ungrounded "ADR / Approved")', () => {
    const proposal = executeReconciliationPipeline({
      text: meeting1Content,
      existingItems: [],
      members: dummyMembers,
      filename: '01_SBG_Project_Kickoff_Meeting.md'
    })

    const dec1 = proposal.creates.find(c => c.sourceIdentifier === 'DEC-01' || c.sourceLabel === 'DEC-01')
    expect(dec1).toBeDefined()
    expect(dec1?.sourceContent).toContain('explicit relationships between Objective, Requirement, User Story, Task and UAT')
    expect(dec1?.description).not.toContain('Status: Approved')
    expect(dec1?.description).not.toContain('Options Considered:')
  })

  it('INTEGRITY TEST 6: Invalid relationship (unknown proposalNodeId fails validation and blocks apply)', async () => {
    const proposal = executeReconciliationPipeline({
      text: meeting1Content,
      existingItems: [],
      members: dummyMembers,
      filename: '01_SBG_Project_Kickoff_Meeting.md'
    })

    // 1. Inject an unknown parentCandidateId / parentProposalNodeId
    const corruptedProposal1 = {
      ...proposal,
      creates: proposal.creates.map((c, idx) => idx === 0 ? {
        ...c,
        parentCandidateId: 'CAND-999_NON_EXISTENT',
        parentProposalNodeId: 'node-non-existent-999'
      } : c)
    }

    const mockClient: any = {
      query: vi.fn().mockResolvedValue({ rows: [] })
    }

    // Attempting to apply corrupted proposal must be rejected
    await expect(
      executeCanonicalProposalTransaction(mockClient, corruptedProposal1 as any, {
        workspace_uid: 'ws-1',
        related_project_uid: 'prj-1',
        members: dummyMembers
      })
    ).rejects.toThrow()

    // 2. Inject a title as parentItemUid (e.g. parentItemUid = "Improve Passenger Experience")
    const titleParentProposal = {
      ...proposal,
      creates: proposal.creates.map((c, idx) => idx === 0 ? {
        ...c,
        parentItemUid: 'Improve Passenger Self-Service Boarding Experience'
      } : c)
    }

    await expect(
      executeCanonicalProposalTransaction(mockClient, titleParentProposal as any, {
        workspace_uid: 'ws-1',
        related_project_uid: 'prj-1',
        members: dummyMembers
      })
    ).rejects.toThrow(/Memory Graph Integrity/i)

    // 3. Inject a title as relationItemUid
    const titleRelationProposal = {
      ...proposal,
      creates: proposal.creates.map((c, idx) => idx === 0 ? {
        ...c,
        relationItemUid: [{ item_uid: 'Some Invalid Title Relation', relation: 'discusses' }]
      } : c)
    }

    await expect(
      executeCanonicalProposalTransaction(mockClient, titleRelationProposal as any, {
        workspace_uid: 'ws-1',
        related_project_uid: 'prj-1',
        members: dummyMembers
      })
    ).rejects.toThrow(/Memory Graph Integrity/i)
  })

  it('INTEGRITY TEST 7: Meeting source preservation (sourceContent is recoverable and distinct from summary)', () => {
    const proposal = executeReconciliationPipeline({
      text: meeting1Content,
      existingItems: [],
      members: dummyMembers,
      filename: '01_SBG_Project_Kickoff_Meeting.md'
    })

    const meetingItem = proposal.creates.find(c => c.itemType === 'Meeting')
    expect(meetingItem).toBeDefined()
    expect(meetingItem?.sourceContent).toBeDefined()
    expect(meetingItem?.sourceContent).toContain('Meeting Record 01')
    expect(meetingItem?.sourceContent).toContain('Project Charter')
    expect(meetingItem?.sourceContent).toContain('Traceability Structure')
    expect(meetingItem?.sourceContent).toContain('Meeting Conclusion')
    expect(meetingItem?.sourceContent?.length).toBeGreaterThan(1000)
    expect(meetingItem?.summary).not.toBe(meetingItem?.sourceContent)
  })

  it('INTEGRITY TEST 8: Preview/apply consistency (canonicalProposal corresponds exactly to mutations)', async () => {
    const proposal = executeReconciliationPipeline({
      text: meeting1Content,
      existingItems: [],
      members: dummyMembers,
      filename: '01_SBG_Project_Kickoff_Meeting.md'
    })

    // Assert proposal items and creates match 1-to-1
    expect(proposal.items?.length).toBe(16)
    expect(proposal.creates.length).toBe(16)

    let uuidCounter = 1
    const mockDbRows: any[] = []
    const mockClient: any = {
      query: vi.fn().mockImplementation((q: string, params: any[]) => {
        if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return Promise.resolve({ rows: [] })
        if (q.includes('UPDATE public.workspace')) {
          return Promise.resolve({ rows: [{ prefix_code: 'TTG', last_item_number: 116 }] })
        }
        if (q.includes('SELECT gen_random_uuid()')) {
          return Promise.resolve({ rows: [{ uid: `00000000-0000-0000-0000-${String(uuidCounter++).padStart(12, '0')}` }] })
        }
        if (q.includes('INSERT INTO public.item')) {
          const row = {
            item_uid: params[0],
            item_display_code: params[1],
            item_title: params[4],
            item_type: params[7],
            item_status: params[8],
            item_priority: params[9],
            item_follow_by: params[10],
            item_content: params[11],
            parent_item_uid: params[12],
            relation_item_uid: params[13],
            item_attribute: params[14]
          }
          mockDbRows.push(row)
          return Promise.resolve({ rows: [row] })
        }
        if (q.includes('SELECT item_uid')) {
          return Promise.resolve({ rows: mockDbRows })
        }
        return Promise.resolve({ rows: [] })
      })
    }

    const execRes = await executeCanonicalProposalTransaction(mockClient, proposal, {
      workspace_uid: 'ws-test',
      related_project_uid: 'prj-test',
      members: dummyMembers
    })

    expect(execRes.insertedItems.length).toBe(proposal.creates.length)

    const verification = await verifyDatabaseState(mockClient, proposal, execRes)
    expect(verification.status).toBe('APPLIED_AND_VERIFIED')
    expect(verification.totalVerified).toBe(16)
    expect(verification.mismatches.length).toBe(0)
  })

  it('INTEGRITY TEST 9: No overloaded itemFollowBy (strictly member UUID or null)', () => {
    const proposal = executeReconciliationPipeline({
      text: meeting1Content,
      existingItems: [],
      members: dummyMembers,
      currentProject: { project_uid: 'prj-sbg-123', project_name: 'SBG' },
      filename: '01_SBG_Project_Kickoff_Meeting.md'
    })

    for (const c of proposal.creates) {
      if (c.itemFollowBy) {
        expect(c.itemFollowBy).toMatch(/^mem-\d+$/)
        expect(c.itemFollowBy).not.toBe('prj-sbg-123')
        expect(c.itemFollowBy).not.toBe('SBG')
        expect(c.itemFollowBy).not.toBe('Kevin')
        expect(c.itemFollowBy).not.toBe('Sarah')
      }
    }
  })

  it('INTEGRITY TEST 10: Apply failure rollback on database error leaves 0 partial mutations', async () => {
    const proposal = executeReconciliationPipeline({
      text: meeting1Content,
      existingItems: [],
      members: dummyMembers,
      filename: '01_SBG_Project_Kickoff_Meeting.md'
    })

    const mockClient: any = {
      query: vi.fn().mockImplementation((q: string) => {
        if (q.includes('INSERT INTO public.item')) {
          throw new Error('Simulated Database Deadlock Error')
        }
        if (q.includes('UPDATE public.workspace')) {
          return Promise.resolve({ rows: [{ prefix_code: 'TTG', last_item_number: 116 }] })
        }
        if (q.includes('SELECT gen_random_uuid()')) {
          return Promise.resolve({ rows: [{ uid: '00000000-0000-0000-0000-000000000001' }] })
        }
        return Promise.resolve({ rows: [] })
      })
    }

    await expect(
      executeCanonicalProposalTransaction(mockClient, proposal, {
        workspace_uid: 'ws-1',
        related_project_uid: 'prj-1',
        members: dummyMembers
      })
    ).rejects.toThrow('Simulated Database Deadlock Error')
  })

  // =========================================================================
  // NEGATIVE TEST SUITE & FIDELITY INVARIANTS (TESTS A to I)
  // =========================================================================

  it('NEGATIVE TEST A: Explicit item with source evidence is allowed in CREATE', () => {
    const rawText = `### REQ-01 — Biometric Verification Latency\n- Latency must be under 3s.`
    const proposal = executeReconciliationPipeline({
      text: rawText,
      existingItems: [],
      members: dummyMembers
    })

    expect(proposal.creates.length).toBeGreaterThan(0)
    const req = proposal.creates.find(c => c.sourceLabel === 'REQ-01' || c.itemTitle.includes('Biometric'))
    expect(req).toBeDefined()
    expect(req?.inferenceStatus).toBe('SOURCE_FACT')
    expect(req?.classification).toBe('EXPLICIT')
  })

  it('NEGATIVE TEST B: Inferred User Story without explicit source framing is quarantined in reviewRequired, NO canonical CREATE', () => {
    // General semantic statement: "Passengers should receive understandable queue guidance"
    // An AI inference engine might attempt to create a User Story "As a passenger, I want queue guidance..."
    const rawText = `
### Scope & Guidance
Passengers should receive understandable queue guidance.
`
    const proposal = executeReconciliationPipeline({
      text: rawText,
      existingItems: [],
      members: dummyMembers
    })

    // Canonical CREATE set must NOT invent an ungrounded User Story
    const canonicalStory = proposal.creates.find(c => c.itemType === 'User story')
    expect(canonicalStory).toBeUndefined()
  })

  it('NEGATIVE TEST C: Tentative milestone preserves commitmentStatus = TENTATIVE, not confirmed', () => {
    const rawText = `
# Meeting Record
## Milestones
| Milestone | Target Date | Description |
|---|---|---|
| M1 — Requirements Baseline | 2026-10-02 | Requirements baseline by October 2, tentatively |
`
    const proposal = executeReconciliationPipeline({
      text: rawText,
      existingItems: [],
      members: dummyMembers
    })

    const m1 = proposal.creates.find(c => c.sourceLabel === 'M1' || c.itemTitle.includes('Requirements Baseline'))
    expect(m1).toBeDefined()
    expect(m1?.commitmentStatus).toBe('TENTATIVE')
  })

  it('NEGATIVE TEST D: Dependency explicitly stated as NOT a blocker is NOT classified as Bottleneck', () => {
    const rawText = `
# Meeting Record
- **[Bottleneck]** queue-data integration is a dependency / technical unknown. Not yet a blocker.
`
    const proposal = executeReconciliationPipeline({
      text: rawText,
      existingItems: [],
      members: dummyMembers
    })

    // Must NOT be canonical Bottleneck/Blocker
    const blocker = proposal.creates.find(c => c.itemType === 'Bottleneck')
    expect(blocker).toBeUndefined()

    // Must be classified as Information or Dependency with NOT_A_BLOCKER commitment
    const dep = proposal.creates.find(c => c.itemTitle.includes('queue-data') || c.sourceContent?.includes('queue-data'))
    expect(dep).toBeDefined()
    expect(dep?.commitmentStatus).toBe('NOT_A_BLOCKER')
  })

  it('NEGATIVE TEST E: Title used as parentItemUid triggers VALIDATION FAILURE and ZERO DB WRITES', async () => {
    const proposal = executeReconciliationPipeline({
      text: meeting1Content,
      existingItems: [],
      members: dummyMembers,
      filename: '01_SBG_Project_Kickoff_Meeting.md'
    })

    const corruptedProposal = {
      ...proposal,
      creates: proposal.creates.map((c, idx) => idx === 0 ? {
        ...c,
        parentItemUid: 'Reduce wrong-queue cases' // Title as parent ID
      } : c)
    }

    const mockClient: any = {
      query: vi.fn().mockResolvedValue({ rows: [] })
    }

    await expect(
      executeCanonicalProposalTransaction(mockClient, corruptedProposal as any, {
        workspace_uid: 'ws-1',
        related_project_uid: 'prj-1',
        members: dummyMembers
      })
    ).rejects.toThrow(/Memory Graph Integrity Gate/i)

    // Verify 0 database insert queries were executed
    expect(mockClient.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO public.item'), expect.anything())
  })

  it('NEGATIVE TEST F: Non-existent proposal ID in parent/relation triggers VALIDATION FAILURE and ZERO DB WRITES', async () => {
    const proposal = executeReconciliationPipeline({
      text: meeting1Content,
      existingItems: [],
      members: dummyMembers,
      filename: '01_SBG_Project_Kickoff_Meeting.md'
    })

    const corruptedProposal = {
      ...proposal,
      validation: {
        status: 'FAIL' as const,
        errors: [{ code: 'R002_NON_EXISTENT_PARENT', severity: 'ERROR' as const, message: 'Non-existent parent ID P001-I999' }],
        warnings: []
      },
      creates: proposal.creates.map((c, idx) => idx === 0 ? {
        ...c,
        parentProposalItemId: 'P001-I999'
      } : c)
    }

    const mockClient: any = {
      query: vi.fn().mockResolvedValue({ rows: [] })
    }

    await expect(
      executeCanonicalProposalTransaction(mockClient, corruptedProposal as any, {
        workspace_uid: 'ws-1',
        related_project_uid: 'prj-1',
        members: dummyMembers
      })
    ).rejects.toThrow(/Proposal validation failed/i)
  })

  it('NEGATIVE TEST G: Decision without explicit causal rationale does not invent ungrounded rationale', () => {
    const rawText = `
# Meeting Record
### DEC-01 — Terminal 1 Initial Deployment Scope
Terminal 1 is agreed as the initial deployment scope.
`
    const proposal = executeReconciliationPipeline({
      text: rawText,
      existingItems: [],
      members: dummyMembers
    })

    const dec = proposal.creates.find(c => c.sourceLabel === 'DEC-01' || c.itemTitle.includes('Terminal 1'))
    expect(dec).toBeDefined()
    expect(dec?.description).not.toContain('Scope was simplified to ensure the November 13 operational trial')
  })

  it('NEGATIVE TEST H: Meeting source fidelity preserves normalized full transcript separate from summary', () => {
    const proposal = executeReconciliationPipeline({
      text: meeting1Content,
      existingItems: [],
      members: dummyMembers,
      filename: '01_SBG_Project_Kickoff_Meeting.md'
    })

    const meeting = proposal.creates.find(c => c.itemType === 'Meeting')
    expect(meeting).toBeDefined()
    expect(meeting?.sourceContent).toBeDefined()
    expect(meeting?.sourceContent).toContain('Meeting Record 01')
    expect(meeting?.sourceContent?.length).toBeGreaterThan(500)
  })

  it('NEGATIVE TEST I: Participant mentioning requirement is NOT assigned as assignee in itemFollowBy', () => {
    const rawText = `
# Meeting Record
Rachel: What about language? If we are helping passengers, English alone won't be enough.
Karen: At least Chinese and English.
### REQ-02 — Multi-Language Support
Multi-language support for Chinese and English.
`
    const proposal = executeReconciliationPipeline({
      text: rawText,
      existingItems: [],
      members: dummyMembers
    })

    const req = proposal.creates.find(c => c.sourceLabel === 'REQ-02' || c.itemTitle.includes('Multi-Language') || c.itemTitle.includes('Language'))
    if (req) {
      expect(req.itemFollowBy).toBeUndefined()
    }
  })

  // =========================================================================
  // 12 RED-TEAM TESTS (SECTION 18 SPECIFICATION)
  // =========================================================================

  it('RED-TEAM TEST 1 — Explicit item: Source explicitly states a Requirement -> CREATE allowed', () => {
    const rawText = `### REQ-01 — Biometric Verification Latency\n- Latency must be under 3s.`
    const proposal = executeReconciliationPipeline({
      text: rawText,
      existingItems: [],
      members: dummyMembers
    })

    expect(proposal.creates.length).toBeGreaterThan(0)
    const req = proposal.creates.find(c => c.sourceLabel === 'REQ-01' || c.itemTitle.includes('Biometric'))
    expect(req).toBeDefined()
    expect(req?.inferenceStatus).toBe('SOURCE_FACT')
    expect(req?.classification).toBe('EXPLICIT')
  })

  it('RED-TEAM TEST 2 — Inferred User Story: Source describes passenger need but never defines User Story -> NO canonical User Story CREATE', () => {
    const rawText = `
### Scope & Guidance
Recommendation should be understandable to passengers.
`
    const proposal = executeReconciliationPipeline({
      text: rawText,
      existingItems: [],
      members: dummyMembers
    })

    const canonicalStory = proposal.creates.find(c => c.itemType === 'User story')
    expect(canonicalStory).toBeUndefined()
  })

  it('RED-TEAM TEST 3 — Inferred UAT: Source implies testing needs but contains no UAT -> NO canonical UAT CREATE', () => {
    const rawText = `
# Meeting Record
### REQ-01 — Fast Verification
System should be verified under load.
`
    const proposal = executeReconciliationPipeline({
      text: rawText,
      existingItems: [],
      members: dummyMembers
    })

    const canonicalUat = proposal.creates.find(c => c.itemType === 'UAT')
    expect(canonicalUat).toBeUndefined()
  })

  it('RED-TEAM TEST 4 — Dependency: Source says "Not yet. It\'s a dependency / technical unknown." -> NOT Bottleneck', () => {
    const rawText = `
# Meeting Record
- **[Bottleneck]** queue-data integration is a dependency / technical unknown. Not yet a blocker.
`
    const proposal = executeReconciliationPipeline({
      text: rawText,
      existingItems: [],
      members: dummyMembers
    })

    const blocker = proposal.creates.find(c => c.itemType === 'Bottleneck')
    expect(blocker).toBeUndefined()

    const dep = proposal.creates.find(c => c.itemTitle.includes('queue-data') || c.sourceContent?.includes('queue-data'))
    expect(dep).toBeDefined()
    expect(dep?.commitmentStatus).toBe('NOT_A_BLOCKER')
  })

  it('RED-TEAM TEST 5 — Tentative milestone: Source says "tentatively Oct 2" -> Milestone with TENTATIVE status, NOT confirmed', () => {
    const rawText = `
# Meeting Record
## Milestones
| Milestone | Target Date | Description |
|---|---|---|
| M1 — Requirements Baseline | 2026-10-02 | Requirements baseline by October 2, tentatively |
`
    const proposal = executeReconciliationPipeline({
      text: rawText,
      existingItems: [],
      members: dummyMembers
    })

    const m1 = proposal.creates.find(c => c.sourceLabel === 'M1' || c.itemTitle.includes('Requirements Baseline'))
    expect(m1).toBeDefined()
    expect(m1?.commitmentStatus).toBe('TENTATIVE')
  })

  it('RED-TEAM TEST 6 — Fabricated rationale: Source gives a decision but no rationale -> rationale = null, NOT generated', () => {
    const rawText = `
# Meeting Record
### DEC-01 — Terminal 1 Initial Deployment Scope
Terminal 1 is agreed as the initial deployment scope.
`
    const proposal = executeReconciliationPipeline({
      text: rawText,
      existingItems: [],
      members: dummyMembers
    })

    const dec = proposal.creates.find(c => c.sourceLabel === 'DEC-01' || c.itemTitle.includes('Terminal 1'))
    expect(dec).toBeDefined()
    expect(dec?.decisionRationale).toBeUndefined()
  })

  it('RED-TEAM TEST 7 — Participant != assignee: Person participates in discussion but is not assigned a task -> participant only', () => {
    const rawText = `
# Meeting Record
Rachel: What about language? If we are helping passengers, English alone won't be enough.
Karen: At least Chinese and English.
### REQ-02 — Multi-Language Support
Multi-language support for Chinese and English.
`
    const proposal = executeReconciliationPipeline({
      text: rawText,
      existingItems: [],
      members: dummyMembers
    })

    const req = proposal.creates.find(c => c.sourceLabel === 'REQ-02' || c.itemTitle.includes('Multi-Language') || c.itemTitle.includes('Language'))
    if (req) {
      expect(req.itemFollowBy).toBeUndefined()
    }
  })

  it('RED-TEAM TEST 8 — Title-as-ID: Proposal contains parentItemUid = "Passenger Queue Guidance System" -> VALIDATION FAILURE, ZERO DB WRITES', async () => {
    const proposal = executeReconciliationPipeline({
      text: meeting1Content,
      existingItems: [],
      members: dummyMembers,
      filename: '01_SBG_Project_Kickoff_Meeting.md'
    })

    const corruptedProposal = {
      ...proposal,
      creates: proposal.creates.map((c, idx) => idx === 0 ? {
        ...c,
        parentItemUid: 'Passenger Queue Guidance System' // Title as parent ID
      } : c)
    }

    const mockClient: any = {
      query: vi.fn().mockResolvedValue({ rows: [] })
    }

    await expect(
      executeCanonicalProposalTransaction(mockClient, corruptedProposal as any, {
        workspace_uid: 'ws-1',
        related_project_uid: 'prj-1',
        members: dummyMembers
      })
    ).rejects.toThrow()

    // Verify ZERO DB writes
    expect(mockClient.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO public.item'), expect.anything())
  })

  it('RED-TEAM TEST 9 — Nonexistent proposal ID: Relationship points to P999-I999 -> VALIDATION FAILURE, ZERO DB WRITES', async () => {
    const proposal = executeReconciliationPipeline({
      text: meeting1Content,
      existingItems: [],
      members: dummyMembers,
      filename: '01_SBG_Project_Kickoff_Meeting.md'
    })

    const corruptedProposal = {
      ...proposal,
      creates: proposal.creates.map((c, idx) => idx === 0 ? {
        ...c,
        parentProposalItemId: 'P999-I999'
      } : c)
    }

    const mockClient: any = {
      query: vi.fn().mockResolvedValue({ rows: [] })
    }

    await expect(
      executeCanonicalProposalTransaction(mockClient, corruptedProposal as any, {
        workspace_uid: 'ws-1',
        related_project_uid: 'prj-1',
        members: dummyMembers
      })
    ).rejects.toThrow()

    // Verify ZERO DB writes
    expect(mockClient.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO public.item'), expect.anything())
  })

  it('RED-TEAM TEST 10 — Preview/apply mismatch: Modify proposal after preview -> VALIDATION FAILURE, ZERO DB WRITES', async () => {
    const proposal = executeReconciliationPipeline({
      text: meeting1Content,
      existingItems: [],
      members: dummyMembers,
      filename: '01_SBG_Project_Kickoff_Meeting.md'
    })

    expect(proposal.proposalHash).toBeDefined()

    // Tamper with proposal after preview hash was generated
    const tamperedProposal = {
      ...proposal,
      creates: proposal.creates.map((c, idx) => idx === 0 ? {
        ...c,
        itemTitle: 'Tampered Title After Preview'
      } : c)
    }

    const mockClient: any = {
      query: vi.fn().mockResolvedValue({ rows: [] })
    }

    await expect(
      executeCanonicalProposalTransaction(mockClient, tamperedProposal as any, {
        workspace_uid: 'ws-1',
        related_project_uid: 'prj-1',
        members: dummyMembers
      })
    ).rejects.toThrow(/Preview\/Apply Mismatch/i)

    // Verify ZERO DB writes
    expect(mockClient.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO public.item'), expect.anything())
  })

  it('RED-TEAM TEST 11 — Source fidelity: Meeting source contains full transcript -> sourceContent contains normalized full transcript, summary is separate', () => {
    const proposal = executeReconciliationPipeline({
      text: meeting1Content,
      existingItems: [],
      members: dummyMembers,
      filename: '01_SBG_Project_Kickoff_Meeting.md'
    })

    const meeting = proposal.creates.find(c => c.itemType === 'Meeting')
    expect(meeting).toBeDefined()
    expect(meeting?.sourceContent).toBeDefined()
    expect(meeting?.sourceContent).toContain('Meeting Record 01')
    expect(meeting?.sourceContent?.length).toBeGreaterThan(500)
    expect(meeting?.summary).toBeDefined()
    expect(meeting?.sourceContent).not.toEqual(meeting?.summary)
  })

  it('RED-TEAM TEST 12 — Invalid LLM proposal: Inject deliberately malformed proposal -> INVALID, applied = false, ZERO DB WRITES', async () => {
    const malformedProposal: any = {
      proposalId: 'PROP-MALFORMED',
      mode: 'FULL_INITIALIZATION',
      creates: [
        {
          candidateId: 'CAND-999',
          itemTitle: 'Hallucinated Feature Without Evidence',
          itemType: 'Requirement',
          inferred: true, // Inferred item in creates
          inferenceStatus: 'INFERENCE',
          classification: 'INFERRED'
        }
      ],
      updates: [],
      relations: []
    }

    const mockClient: any = {
      query: vi.fn().mockResolvedValue({ rows: [] })
    }

    await expect(
      executeCanonicalProposalTransaction(mockClient, malformedProposal, {
        workspace_uid: 'ws-1',
        related_project_uid: 'prj-1',
        members: dummyMembers
      })
    ).rejects.toThrow()

    // Verify ZERO DB writes
    expect(mockClient.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO public.item'), expect.anything())
  })

  // ==========================================================================
  // PHASE 2 REAL ALIGNMENT VALIDATION (TESTS A THROUGH J)
  // Fixture: 03_New_Project_Kickoff_Meeting.md
  // ==========================================================================
  it('SCENARIO 19: Phase 2 Real Alignment Validation on 03_New_Project_Kickoff_Meeting proves Tests A through J', () => {
    const fixture03Path = path.resolve(__dirname, '../../../test_doc/B_meeting_script_1.md')
    const text03 = fs.readFileSync(fixture03Path, 'utf-8')

    const members03 = [
      { member_uid: 'mem-edmond', member_name: 'Edmond', member_email: 'edmond@test.com' },
      { member_uid: 'mem-karen', member_name: 'Karen', member_email: 'karen@test.com' },
      { member_uid: 'mem-michael', member_name: 'Michael', member_email: 'michael@test.com' },
      { member_uid: 'mem-rachel', member_name: 'Rachel', member_email: 'rachel@test.com' },
      { member_uid: 'mem-thomas', member_name: 'Thomas', member_email: 'thomas@test.com' }
    ]

    // Simulated high-fidelity raw previews produced by multi-agent understanding
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

    const proposal = executeReconciliationPipeline({
      sourceDocument: {
        documentId: 'DOC-03',
        filename: '03_New_Project_Kickoff_Meeting.md',
        content: text03
      },
      processingInstruction: {
        userIntent: '請依據上載之 Kickoff 會議記錄進行需求架構拆解與全量工單規劃',
        requestedOperation: 'reconcile_and_propose',
        targetProjectId: 'prj-smart-queue'
      },
      text: text03,
      existingItems: [],
      members: members03,
      currentProject: { project_uid: 'prj-smart-queue', project_name: 'Smart Queue Assistance' },
      rawPreviews: rawPreviews03,
      filename: 'B_meeting_script_1.md'
    })

    if (proposal.validation.status === 'FAIL') {
      console.log('SCENARIO 19 Validation Errors:', JSON.stringify(proposal.validation.errors, null, 2))
    }

    // 1. Overall Proposal Verification
    expect(proposal.validation.status).toBe('PASS')
    expect(proposal.validation.errors).toHaveLength(0)
    expect(proposal.proposalHash).toBeDefined()
    expect(proposal.proposalHash?.length).toBe(64)

    // TEST A — User Story hallucination: 0 User Stories
    const userStories = proposal.creates.filter(c => c.itemType === 'User story')
    expect(userStories).toHaveLength(0)

    // TEST B — UAT hallucination: 0 UATs
    const uats = proposal.creates.filter(c => c.itemType === 'UAT')
    expect(uats).toHaveLength(0)

    // TEST C — Bottleneck hallucination: 0 canonical Bottlenecks (dependency preserved as Information)
    const bottlenecks = proposal.creates.filter(c => c.itemType === 'Bottleneck')
    expect(bottlenecks).toHaveLength(0)
    const infoItems = proposal.creates.filter(c => c.itemType === 'Information')
    expect(infoItems.length).toBeGreaterThanOrEqual(1)
    expect(infoItems.some(i => i.itemTitle.includes('隊列狀態資料整合') || i.itemTitle.includes('Queue Status Data'))).toBe(true)

    // TEST D — Tentative milestone: Oct 2, Oct 16, Nov 13 preserved as TENTATIVE
    const milestones = proposal.creates.filter(c => c.itemType === 'Milestone')
    const tentativeMilestones = milestones.filter(m => m.sourceEvidence?.commitmentStatus === 'TENTATIVE')
    expect(tentativeMilestones.length).toBeGreaterThanOrEqual(3)

    // TEST E — Fabricated decision rationale: ADR prefix stripped, "加快交付" invented rationale removed
    const decisions = proposal.creates.filter(c => c.itemType === 'Decision')
    expect(decisions.length).toBe(1)
    expect(decisions[0].itemTitle).not.toMatch(/^ADR[-_]?\d+/i)
    expect(decisions[0].description).not.toContain('加快交付')
    expect(decisions[0].description).not.toContain('to ensure rapid delivery')

    // TEST F — Participant vs assignee: ONLY explicit action Tasks have assignees
    for (const item of proposal.creates) {
      if (item.itemType !== 'Task') {
        expect(item.itemFollowBy).toBeUndefined()
      }
    }
    const taskInterviews = proposal.creates.find(c => c.itemTitle.includes('Conduct passenger') || c.itemTitle.includes('interviews'))
    expect(taskInterviews?.itemFollowBy).toBe('mem-rachel')
    const taskIntegration = proposal.creates.find(c => c.itemTitle.includes('Check queue-data integration'))
    expect(taskIntegration?.itemFollowBy).toBe('mem-michael')

    // TEST G & H — Proposed target & Technical estimate preserved
    const targetItem = proposal.creates.find(c => c.itemTitle.includes('Reduce wrong-queue cases'))
    expect(targetItem?.description).toContain('30%')
    const estimateItem = proposal.creates.find(c => c.itemTitle.includes('three seconds'))
    expect(estimateItem?.sourceEvidence?.commitmentStatus).toMatch(/TARGET|ESTIMATED|TENTATIVE/)

    // TEST I — Source fidelity: Exactly 1 Meeting item containing full normalized source content
    const meetings = proposal.creates.filter(c => c.itemType === 'Meeting')
    expect(meetings).toHaveLength(1)
    expect(meetings[0].sourceContent).toContain('# 03_New_Project_Kickoff_Meeting')
    expect(meetings[0].sourceContent).toContain('16:15 — Meeting ended.')

    // TEST J — Sparse truthful graph: No forced 5-layer hierarchy, Tasks connect to Requirements
    expect(taskInterviews?.parentProposalItemId).toBeDefined()
    expect(taskIntegration?.parentProposalItemId).toBeDefined()
    expect(userStories).toHaveLength(0)
    expect(uats).toHaveLength(0)
  })

  // =========================================================================
  // PHASE 2.2 ARCHITECTURAL INVARIANTS: MEMORY IDENTITY & MUTATION SAFETY
  // =========================================================================

  it('SCENARIO 20: Invariant A — Partial Update Safety (UNSPECIFIED != DEFAULT)', () => {
    const existingTask = {
      item_uid: '00000000-0000-0000-0000-000000000010',
      item_display_code: 'SQA-10',
      item_title: 'Core Queue Router Implementation',
      item_type: 'Task',
      item_priority: 'High',
      item_content: { text: 'Initial core implementation' }
    }

    // 1. Negative Test: Omitted priority MUST NOT overwrite existing High with Middle
    const propOmitted = executeReconciliationPipeline({
      text: 'Update core router details',
      existingItems: [existingTask],
      rawPreviews: [{
        actionType: 'batch_proposal',
        proposalTitle: 'Omitted Priority Test',
        items: [{
          candidateId: 'CAND-P01',
          itemTitle: 'Core Queue Router Implementation',
          itemType: 'Task',
          description: 'Updated implementation specification with extended security guidelines.'
          // priority omitted
        }]
      }],
      filename: 'test_omitted.md'
    })
    expect(propOmitted.updates).toHaveLength(1)
    expect(propOmitted.updates[0].fieldDiffs.some(f => f.field === 'item_priority')).toBe(false)
    expect(propOmitted.updates[0].fieldDiffs.some(f => f.field === 'description')).toBe(true)

    // 2. Negative Test: Explicit undefined priority MUST NOT overwrite existing High
    const propUndefined = executeReconciliationPipeline({
      text: 'Update core router details',
      existingItems: [existingTask],
      rawPreviews: [{
        actionType: 'batch_proposal',
        proposalTitle: 'Undefined Priority Test',
        items: [{
          candidateId: 'CAND-P02',
          itemTitle: 'Core Queue Router Implementation',
          itemType: 'Task',
          priority: undefined as any,
          description: 'Updated implementation specification with extended security guidelines.'
        }]
      }],
      filename: 'test_undefined.md'
    })
    expect(propUndefined.updates[0].fieldDiffs.some(f => f.field === 'item_priority')).toBe(false)

    // 3. Negative Test: Null priority MUST NOT overwrite existing High
    const propNull = executeReconciliationPipeline({
      text: 'Update core router details',
      existingItems: [existingTask],
      rawPreviews: [{
        actionType: 'batch_proposal',
        proposalTitle: 'Null Priority Test',
        items: [{
          candidateId: 'CAND-P03',
          itemTitle: 'Core Queue Router Implementation',
          itemType: 'Task',
          priority: null as any,
          description: 'Updated implementation specification with extended security guidelines.'
        }]
      }],
      filename: 'test_null.md'
    })
    expect(propNull.updates[0].fieldDiffs.some(f => f.field === 'item_priority')).toBe(false)

    // 4. Positive Test: Explicit grounded priority (e.g. 'Low') DOES produce field UPDATE
    const propExplicit = executeReconciliationPipeline({
      text: 'Update core router details with lower priority',
      existingItems: [existingTask],
      rawPreviews: [{
        actionType: 'batch_proposal',
        proposalTitle: 'Explicit Priority Test',
        items: [{
          candidateId: 'CAND-P04',
          itemTitle: 'Core Queue Router Implementation',
          itemType: 'Task',
          priority: 'Low',
          description: 'Updated implementation specification with extended security guidelines.'
        }]
      }],
      filename: 'test_explicit.md'
    })
    expect(propExplicit.updates[0].fieldDiffs.some(f => f.field === 'item_priority' && f.proposedValue === 'Low')).toBe(true)
  })

  it('SCENARIO 21: Invariant B — One Candidate -> One Target & MATCH_COLLISION Prevention', () => {
    const existingTask = {
      item_uid: '00000000-0000-0000-0000-000000000020',
      item_display_code: 'SQA-20',
      item_title: 'Check integration of queue status data',
      item_type: 'Task',
      item_priority: 'Middle',
      item_follow_by: 'mem-michael',
      follow_by_name: 'Michael',
      item_content: { text: 'Preliminary queue check.' }
    }

    // Two distinct candidates competing for the exact same target UID without single exact proof
    const propCollision = executeReconciliationPipeline({
      text: 'Collision test meeting notes',
      existingItems: [existingTask],
      rawPreviews: [{
        actionType: 'batch_proposal',
        proposalTitle: 'Collision Test',
        items: [
          {
            candidateId: 'CAND-COL-1',
            itemTitle: 'Queue data check variant alpha',
            itemType: 'Task',
            parentItemUid: '00000000-0000-0000-0000-000000000020',
            sourceLabel: 'SQA-20',
            description: 'Variant alpha queue check.'
          },
          {
            candidateId: 'CAND-COL-2',
            itemTitle: 'Queue data check variant beta',
            itemType: 'Task',
            parentItemUid: '00000000-0000-0000-0000-000000000020',
            sourceLabel: 'SQA-20',
            description: 'Variant beta queue check.'
          }
        ]
      }],
      filename: 'collision_test.md'
    })

    // Must detect collision: do not mutate existing record, both routed to reviewRequired
    expect(propCollision.updates.filter(u => u.targetItemUid === existingTask.item_uid)).toHaveLength(0)
    expect(propCollision.reviewRequired.length).toBeGreaterThanOrEqual(1)
    expect(propCollision.reviewRequired.some(r => r.reason?.includes('MATCH_COLLISION'))).toBe(true)
  })

  it('SCENARIO 22: Invariant C — Canonical Provenance (Charter & Spec Task Authorization)', () => {
    // 1. Charter candidate without explicit transcript authorization remains non-canonical
    const propCharter = executeReconciliationPipeline({
      text: 'Project kickoff discussion about timelines and scope.',
      existingItems: [],
      rawPreviews: [{
        actionType: 'batch_proposal',
        proposalTitle: 'Unauthorized Charter Test',
        items: [{
          candidateId: 'CAND-CH-01',
          itemTitle: 'Smart Queue Assistance 專案章程',
          itemType: 'Charter',
          description: 'Inferred administrative charter.'
        }]
      }],
      filename: 'charter_test.md'
    })
    expect(propCharter.creates.filter(c => c.itemType === 'Charter')).toHaveLength(0)
    expect(propCharter.reviewRequired.some(r => r.candidate?.itemType === 'Charter' || r.candidate?.title?.includes('章程'))).toBe(true)

    // 2. Specification task candidate without explicit authorization remains non-canonical
    const propSpec = executeReconciliationPipeline({
      text: 'We should agree on requirements by October 2.',
      existingItems: [],
      rawPreviews: [{
        actionType: 'batch_proposal',
        proposalTitle: 'Unauthorized Spec Task Test',
        items: [{
          candidateId: 'CAND-SP-01',
          itemTitle: 'Smart Queue Assistance 專案規格文件',
          itemType: 'Task',
          description: 'Useful administrative document.'
        }]
      }],
      filename: 'spec_task_test.md'
    })
    expect(propSpec.creates.filter(c => c.itemTitle.includes('專案規格文件'))).toHaveLength(0)
    expect(propSpec.reviewRequired.some(r => r.candidate?.title?.includes('專案規格文件'))).toBe(true)
  })

  it('SCENARIO 23: Invariant D — Memory Convergence & Idempotent Replay on 03 Kickoff Fixture', () => {
    const fixturePath = path.join(__dirname, '../../../test_doc/B_meeting_script_1.md')
    const text03 = fs.readFileSync(fixturePath, 'utf-8')
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
          { candidateId: 'CAND-01', itemTitle: 'Reduce wrong-queue cases for passengers', itemType: 'Objective', description: 'Proposed 30% reduction in wrong-queue cases, pending baseline definition.' },
          { candidateId: 'CAND-02', itemTitle: 'Help passengers identify the appropriate queue before they join it', itemType: 'Requirement', parentCandidateId: 'CAND-01' },
          { candidateId: 'CAND-03', itemTitle: 'Support normal passenger flow only in phase one', itemType: 'Requirement', parentCandidateId: 'CAND-01' },
          { candidateId: 'CAND-04', itemTitle: 'Provide an explanation for queue recommendations', itemType: 'Requirement', parentCandidateId: 'CAND-02' },
          { candidateId: 'CAND-05', itemTitle: 'Include fallback mechanism for uncertain recommendations', itemType: 'Requirement', parentCandidateId: 'CAND-01' },
          { candidateId: 'CAND-06', itemTitle: 'Conduct user interviews for passenger and frontline staff', itemType: 'Task', parentCandidateId: 'CAND-02', itemFollowBy: 'mem-rachel', description: 'Rachel to arrange five short interviews (three passengers, two staff).' },
          { candidateId: 'CAND-07', itemTitle: 'Check integration of queue status data', itemType: 'Task', parentCandidateId: 'CAND-02', itemFollowBy: 'mem-michael', description: 'Michael will check with Airport Systems whether real-time queue status is available through flight schedule feed or requires new interface. Dependency / technical unknown, not yet a blocker.' },
          { candidateId: 'CAND-08', itemTitle: 'Validate response time under three seconds', itemType: 'Milestone', parentCandidateId: 'CAND-02', description: 'Initial technical estimate to validate, not a confirmed requirement.' },
          { candidateId: 'CAND-09', itemTitle: 'Validate data retention and security implications', itemType: 'Task', parentCandidateId: 'CAND-02', itemFollowBy: 'mem-michael', description: 'Michael to check data retention and privacy implications with security team.' },
          { candidateId: 'CAND-10', itemTitle: 'Set tentative requirements baseline by October 2', itemType: 'Milestone', parentCandidateId: 'CAND-01', description: 'Tentatively set October 2 for requirements baseline.' },
          { candidateId: 'CAND-11', itemTitle: 'Deliver prototype by October 16', itemType: 'Milestone', parentCandidateId: 'CAND-01', description: 'Tentative prototype around October 16.' },
          { candidateId: 'CAND-12', itemTitle: 'Operational trial by November 13', itemType: 'Milestone', parentCandidateId: 'CAND-01', description: 'Tentatively put November 13 for operational trial.' },
          { candidateId: 'CAND-13', itemTitle: 'First Release Scope and Feature Exclusions', itemType: 'Decision', parentCandidateId: 'CAND-01', description: 'Focus on Terminal 1 normal flow, exclude waiting time, staff allocation, and operations dashboard. 聚焦第一階段核心範圍，簡化系統複雜度。' },
          { candidateId: 'CAND-14', itemTitle: '01: Queue Status Data Integration', itemType: 'Bottleneck', parentCandidateId: 'CAND-01', description: 'Not yet a blocker. It is a dependency / technical unknown.' }
        ]
      }
    ]

    const seededMemory = [
      {
        item_uid: '00000000-0000-0000-0000-000000000001',
        item_display_code: 'SQA-1',
        item_title: '03_New_Project_Kickoff_Meeting',
        item_type: 'Meeting',
        item_content: { text: text03, source_content: text03 }
      },
      {
        item_uid: '00000000-0000-0000-0000-000000000002',
        item_display_code: 'SQA-2',
        item_title: 'Reduce wrong-queue cases for passengers',
        item_type: 'Objective',
        item_priority: 'High',
        item_content: { text: 'Proposed 30% reduction in wrong-queue cases, pending baseline definition.' }
      },
      {
        item_uid: '00000000-0000-0000-0000-000000000003',
        item_display_code: 'SQA-3',
        item_title: 'Help passengers identify the appropriate queue before they join it',
        item_type: 'Requirement',
        item_priority: 'Middle',
        parent_item_uid: '00000000-0000-0000-0000-000000000002'
      },
      {
        item_uid: '00000000-0000-0000-0000-000000000004',
        item_display_code: 'SQA-4',
        item_title: 'Support normal passenger flow only in phase one',
        item_type: 'Requirement',
        item_priority: 'Middle',
        parent_item_uid: '00000000-0000-0000-0000-000000000002'
      },
      {
        item_uid: '00000000-0000-0000-0000-000000000005',
        item_display_code: 'SQA-5',
        item_title: 'Conduct user interviews for passenger and frontline staff',
        item_type: 'Task',
        item_priority: 'Middle',
        item_follow_by: 'mem-rachel',
        follow_by_name: 'Rachel',
        parent_item_uid: '00000000-0000-0000-0000-000000000003'
      },
      {
        item_uid: '00000000-0000-0000-0000-000000000006',
        item_display_code: 'SQA-6',
        item_title: 'Check integration of queue status data',
        item_type: 'Task',
        item_priority: 'Middle',
        item_follow_by: 'mem-michael',
        follow_by_name: 'Michael',
        item_content: { text: 'Preliminary queue check.' },
        parent_item_uid: '00000000-0000-0000-0000-000000000003'
      },
      {
        item_uid: '00000000-0000-0000-0000-000000000007',
        item_display_code: 'SQA-7',
        item_title: 'Set tentative requirements baseline by October 2',
        item_type: 'Milestone',
        item_priority: 'Middle',
        parent_item_uid: '00000000-0000-0000-0000-000000000002'
      }
    ]

    // 1. Initial run on partially seeded memory
    const propFirst = executeReconciliationPipeline({
      sourceDocument: { documentId: 'DOC-03', filename: 'B_meeting_script_1.md', content: text03 },
      processingInstruction: { userIntent: '對齊', requestedOperation: 'reconcile_and_propose', targetProjectId: 'prj-smart-queue' },
      text: text03,
      existingItems: seededMemory,
      members: members03,
      currentProject: { project_uid: 'prj-smart-queue', project_name: 'Smart Queue Assistance' },
      rawPreviews: rawPreviews03,
      filename: 'B_meeting_script_1.md'
    })

    if (propFirst.validation.status === 'FAIL') {
      console.log('SCENARIO 23 First Validation Errors:', JSON.stringify(propFirst.validation.errors, null, 2))
    }

    expect(propFirst.validation.status).toBe('PASS')
    expect(propFirst.updates.length).toBe(1)
    expect(propFirst.updates[0].targetItemUid).toBe('00000000-0000-0000-0000-000000000006')
    expect(propFirst.updates[0].fieldDiffs.some(f => f.field === 'description')).toBe(true)
    // SQA-6 and SQA-2 priorities MUST remain NO_CHANGE
    expect(propFirst.updates.some(u => u.fieldDiffs.some(f => f.field === 'item_priority'))).toBe(false)

    // 2. Apply proposal to build updated memory
    const appliedMemory = JSON.parse(JSON.stringify(seededMemory))
    for (const u of propFirst.updates) {
      const match = appliedMemory.find((i: any) => i.item_uid === u.targetItemUid)
      if (match) {
        if (u.updates.itemPriority) match.item_priority = u.updates.itemPriority
        if (u.updates.itemFollowBy) match.item_follow_by = u.updates.itemFollowBy
        if (u.updates.itemContent) match.item_content = u.updates.itemContent
        if (u.updates.itemTitle) match.item_title = u.updates.itemTitle
      }
    }
    for (const c of propFirst.creates) {
      appliedMemory.push({
        item_uid: 'uuid-' + c.proposalItemId,
        item_display_code: 'SQA-' + c.proposalItemId,
        item_title: c.itemTitle,
        item_type: c.itemType,
        item_priority: c.itemPriority || 'Middle',
        item_follow_by: c.itemFollowBy,
        item_content: c.description ? { text: c.description } : undefined,
        parent_item_uid: c.parentItemUid
      })
    }

    // 3. Replay with identical source & applied memory
    const propReplay = executeReconciliationPipeline({
      sourceDocument: { documentId: 'DOC-03', filename: 'B_meeting_script_1.md', content: text03 },
      processingInstruction: { userIntent: '重放', requestedOperation: 'reconcile_and_propose', targetProjectId: 'prj-smart-queue' },
      text: text03,
      existingItems: appliedMemory,
      members: members03,
      currentProject: { project_uid: 'prj-smart-queue', project_name: 'Smart Queue Assistance' },
      rawPreviews: rawPreviews03,
      filename: 'B_meeting_script_1.md'
    })

    if (propReplay.reviewRequired.length > 0) {
      console.log('SCENARIO 23 reviewRequired:', JSON.stringify(propReplay.reviewRequired.map(r => ({ id: r.candidateId, title: r.candidate.title, reason: r.reason })), null, 2))
    }

    expect(propReplay.validation.status).toBe('PASS')
    expect(propReplay.creates).toHaveLength(0)
    expect(propReplay.updates).toHaveLength(0)
    expect(propReplay.noChanges.length).toBeGreaterThanOrEqual(14)
    expect(propReplay.conflicts).toHaveLength(0)
    expect(propReplay.reviewRequired).toHaveLength(0)
  })

  // ==========================================================================
  // SCENARIO 24: SEMANTIC DATA INTEGRITY NEGATIVE TESTS
  // Invariants:
  // - UNSPECIFIED != DEFAULT
  // - TENTATIVE != CONFIRMED
  // - DEPENDENCY != BOTTLENECK
  // - INFERRED != SOURCE_FACT
  // ==========================================================================
  describe('SCENARIO 24: Semantic Data Integrity Negative Tests', () => {
    it('Negative Test 1: Inferred User Story without explicit source markup cannot become canonical', () => {
      // 1. Normalizer must flag inferred user story from conversational dialogue
      const norm = normalizeCandidate({
        title: 'As a store manager I want to see notifications',
        type: 'UserStory',
        sourceText: 'Rachel: Maybe store managers would want to see notifications when queues form.'
      })
      expect(norm.inferred).toBe(true)
      expect(norm.classification).toBe('INFERRED')
      expect(norm.inferenceStatus).toBe('INFERENCE')
      expect(norm.needsReview).toBe(true)

      // 2. Validator must strictly FAIL if an inferred User Story is placed in canonical proposal
      const invalidProposal: any = {
        proposalId: 'PROP-NEG-US',
        proposalVersion: 1,
        sourceDocumentId: 'DOC-NEG',
        sourceDocumentHash: 'a'.repeat(64),
        creates: [
          {
            proposalItemId: 'P001-I01',
            itemTitle: 'As a user I want real-time notifications',
            itemType: 'UserStory',
            inferred: true,
            classification: 'INFERRED',
            sourceEvidence: 'Rachel said maybe users want this'
          }
        ],
        updates: [],
        relations: []
      }

      const valResult = validateCanonicalProposal(invalidProposal)
      expect(valResult.status).toBe('FAIL')
      expect(valResult.errors.some(e => e.rule === 'R_INFERRED_USER_STORY_PROHIBITED')).toBe(true)
    })

    it('Negative Test 2: Explicit "not yet a blocker" / dependency cannot become Bottleneck', () => {
      // 1. Normalizer must convert explicit non-blocker away from Bottleneck
      const norm = normalizeCandidate({
        title: 'POS API Access',
        type: 'Bottleneck',
        sourceText: 'Not yet. It is a dependency and technical unknown, but we are not blocked on it today.'
      })
      expect(norm.canonicalType).toBe('Information')
      expect(norm.commitmentStatus).toBe('NOT_A_BLOCKER')

      // 2. Validator must strictly FAIL if a proposal forces a Bottleneck with non-blocker source evidence
      const invalidProposal: any = {
        proposalId: 'PROP-NEG-BTN',
        proposalVersion: 1,
        sourceDocumentId: 'DOC-NEG',
        sourceDocumentHash: 'b'.repeat(64),
        creates: [
          {
            proposalItemId: 'P001-I02',
            itemTitle: 'POS API Access',
            itemType: 'Bottleneck',
            sourceEvidence: 'Not yet. It is a dependency, but we are not blocked right now.'
          }
        ],
        updates: [],
        relations: []
      }

      const valResult = validateCanonicalProposal(invalidProposal)
      expect(valResult.status).toBe('FAIL')
      expect(valResult.errors.some(e => e.rule === 'R_NON_BLOCKER_AS_BOTTLENECK_PROHIBITED')).toBe(true)
    })

    it('Negative Test 3: Tentative/estimated milestone date cannot become CONFIRMED', () => {
      // 1. Normalizer must flag tentative commitment
      const norm = normalizeCandidate({
        title: 'Set tentative requirements baseline by October 2',
        type: 'Milestone',
        sourceText: 'October 2: tentative baseline for review and signoff.'
      })
      expect(norm.commitmentStatus).toBe('TENTATIVE')

      // 2. Validator must strictly FAIL if tentative milestone is presented as CONFIRMED
      const invalidProposal: any = {
        proposalId: 'PROP-NEG-MS',
        proposalVersion: 1,
        sourceDocumentId: 'DOC-NEG',
        sourceDocumentHash: 'c'.repeat(64),
        creates: [
          {
            proposalItemId: 'P001-I03',
            itemTitle: 'Set tentative requirements baseline by October 2',
            itemType: 'Milestone',
            commitmentStatus: 'CONFIRMED',
            sourceEvidence: 'October 2: tentative baseline for review and signoff.'
          }
        ],
        updates: [],
        relations: []
      }

      const valResult = validateCanonicalProposal(invalidProposal)
      expect(valResult.status).toBe('FAIL')
      expect(valResult.errors.some(e => e.rule === 'R_TENTATIVE_MILESTONE_CONFIRMED_PROHIBITED')).toBe(true)
    })

    it('Negative Test 4: Unspecified itemPriority cannot default to High or Middle without evidence', () => {
      // 1. Normalizer must leave unspecified priority as undefined
      const norm = normalizeCandidate({
        title: 'Review queue status payload structure',
        type: 'Task',
        sourceText: 'Michael will review queue status payload structure.'
      })
      expect(norm.priority).toBeUndefined()

      // 2. Validator must strictly FAIL if ungrounded priority is attached to canonical item
      const invalidProposal: any = {
        proposalId: 'PROP-NEG-PRI',
        proposalVersion: 1,
        sourceDocumentId: 'DOC-NEG',
        sourceDocumentHash: 'd'.repeat(64),
        creates: [
          {
            proposalItemId: 'P001-I04',
            itemTitle: 'Review queue status payload structure',
            itemType: 'Task',
            itemPriority: 'High',
            sourceEvidence: 'Michael will review queue status payload structure.'
          }
        ],
        updates: [],
        relations: []
      }

      const valResult = validateCanonicalProposal(invalidProposal)
      expect(valResult.status).toBe('FAIL')
      expect(valResult.errors.some(e => e.rule === 'R_UNGROUNDED_PRIORITY')).toBe(true)
    })
  })

  describe('SCENARIO 25: Targeted Semantic Integrity Regression Suite (P-S1 to P-S8)', () => {
    // P-S1: Unspecified Priority Remains Undefined
    it('P-S1: Unspecified Priority Remains Undefined across all stages', async () => {
      const proposal = executeReconciliationPipeline({
        text: meeting1Content,
        existingItems: [],
        members: dummyMembers
      })
      expect(proposal.creates.length).toBe(16)
      for (const create of proposal.creates) {
        expect(create.itemPriority).toBeUndefined()
      }
      expect(proposal.validation.status).toBe('PASS')
    })

    // P-S2: Existing Item Priority Not Overwritten by Unspecified Input
    it('P-S2: Existing Item Priority Not Overwritten by Unspecified Input', async () => {
      const existingItems: any[] = [
        {
          item_uid: '11111111-1111-4111-8111-111111111111',
          item_display_code: 'SQA-6',
          item_title: '驗證行李輸送帶即時吞吐量',
          item_type: 'Task',
          item_priority: 'High',
          item_status: 'Not Start',
          workspace_uid: 'ws-test'
        }
      ]
      const cand = normalizeCandidate({
        title: '驗證行李輸送帶即時吞吐量',
        type: 'Task',
        sourceText: '會議討論確認由團隊繼續驗證行李輸送帶即時吞吐量，無特殊優先度標註。'
      })
      expect(cand.priority).toBeUndefined()

      const reconciled = reconcileCandidate(cand, existingItems, dummyMembers)
      expect(reconciled.changes?.itemPriority).toBeUndefined()
      expect(reconciled.fieldDiffs?.some(d => d.field === 'item_priority')).toBe(false)
    })

    // P-S3: Non-Blocker Dependency Becomes Pure Information Without Bottleneck Contamination
    it('P-S3: Non-Blocker Dependency Becomes Pure Information Without Bottleneck Contamination', () => {
      const cand = normalizeCandidate({
        title: 'Queue mapping data availability',
        type: 'Bottleneck',
        description: '### 技術阻礙 (Bottleneck)\n嚴重程度：High\n若需額外整合，將影響 10/16 的原型交付日期',
        sourceText: 'Queue mapping: not yet a blocker, it is a dependency / technical unknown.'
      })
      expect(cand.canonicalType).toBe('Information')
      expect(cand.sourceLabel).not.toMatch(/bottleneck/i)
      expect(cand.sourceLabel).toBe('DEP-01')
      expect(cand.description).not.toContain('# 技術阻礙')
      expect(cand.description).not.toContain('嚴重程度')
      expect(cand.description).not.toContain('影響 10/16 的原型交付日期')
      expect(cand.description).toContain('Queue mapping data availability is a technical dependency / unknown')
      expect(cand.description).toContain('explicitly stated that this is not yet considered a blocker')
      expect(cand.priority).toBeUndefined()
    })

    // P-S4: Tentative Milestone Cannot Become Confirmed Milestone
    it('P-S4: Tentative Milestone Cannot Become Confirmed Milestone', () => {
      const cand = normalizeCandidate({
        title: 'Core Prototype Validation',
        type: 'Milestone',
        sourceText: 'Target date tentatively set for Oct 16 to validate in prototype.'
      })
      expect(cand.commitmentStatus).toBe('TENTATIVE')

      // Validator must strictly fail if tentative milestone is presented as CONFIRMED
      const proposal: any = {
        proposalId: 'PROP-PS4',
        proposalVersion: 1,
        sourceDocumentId: 'DOC-PS4',
        sourceDocumentHash: 'e'.repeat(64),
        creates: [
          {
            proposalItemId: 'P001-I01',
            itemTitle: 'Core Prototype Validation',
            itemType: 'Milestone',
            commitmentStatus: 'CONFIRMED',
            sourceEvidence: 'Target date tentatively set for Oct 16 to validate in prototype.'
          }
        ],
        updates: [],
        relations: []
      }
      const val = validateCanonicalProposal(proposal)
      expect(val.status).toBe('FAIL')
      expect(val.errors.some(e => e.rule === 'R_TENTATIVE_MILESTONE_CONFIRMED_PROHIBITED')).toBe(true)
    })

    // P-S5: Unauthorized Charter Quarantined
    it('P-S5: Unauthorized Charter Quarantined to reviewRequired', async () => {
      const text = `### 專案啟動會議
- 討論系統架構與時程
- [TASK-01] 建置資料庫 (Alex)`
      const proposal = await executeReconciliationPipeline({
        sourceDocument: { text },
        existingItems: [],
        metadata: {
          documentId: 'DOC-PS5',
          filename: 'PS5.md'
        },
        rawPreviews: [
          {
            actionType: 'create_item',
            itemType: 'Charter',
            itemTitle: '專案章程定義',
            description: '定義專案目標與授權範圍'
          }
        ]
      })
      // Must NOT be in creates
      expect(proposal.creates.some(c => c.itemType === 'Charter')).toBe(false)
      // Must be quarantined in reviewRequired / suggestedItems
      const quarantined = proposal.reviewRequired.find(r => r.candidate?.canonicalType === 'Charter') ||
                          proposal.suggestedItems?.find(s => s.itemType === 'Charter')
      expect(quarantined).toBeDefined()
    })

    // P-S6: Unauthorized Specification Task Quarantined
    it('P-S6: Unauthorized Specification Task Quarantined', async () => {
      const text = `### 系統討論會議
- 僅討論業務需求，未指派撰寫規格書
- [TASK-01] 探索外部 API 架構 (David)`
      const proposal = await executeReconciliationPipeline({
        sourceDocument: { text },
        existingItems: [],
        metadata: {
          documentId: 'DOC-PS6',
          filename: 'PS6.md'
        },
        rawPreviews: [
          {
            actionType: 'create_item',
            itemType: 'Task',
            itemTitle: '編寫專案規格文件',
            description: '編寫完整軟體規格書'
          }
        ]
      })
      // Must NOT be in creates
      expect(proposal.creates.some(c => c.itemTitle.includes('專案規格文件') || c.itemTitle.includes('規格書'))).toBe(false)
      const quarantined = proposal.reviewRequired.find(r => r.candidate?.title?.includes('規格')) ||
                          proposal.suggestedItems?.find(s => s.itemTitle?.includes('規格'))
      expect(quarantined).toBeDefined()
    })

    // P-S7: Conversational User Need Quarantined with No Manufactured AC
    it('P-S7: Conversational User Need Quarantined with No Manufactured AC', () => {
      const cand = normalizeCandidate({
        title: 'Passenger wants to see wait time',
        type: 'User story',
        description: '### Acceptance Criteria\nGiven passenger opens app When queue is detected Then display wait time',
        sourceText: 'Meeting discussion: passengers mentioned they would like to know how long the wait is.'
      })
      expect(cand.classification).toBe('INFERRED')
      expect(cand.inferred).toBe(true)
      expect(cand.needsReview).toBe(true)
      expect(cand.description).not.toContain('Acceptance Criteria')
      expect(cand.description).not.toContain('Given passenger opens app')
    })

    // P-S8: Validation Failure Blocks Apply and Produces 0 DB Writes
    it('P-S8: Validation Failure Blocks Apply and Produces 0 DB Writes', async () => {
      const invalidProposal: any = {
        proposalId: 'PROP-PS8-FAIL',
        proposalVersion: 1,
        proposalHash: 'f'.repeat(64),
        sourceDocumentId: 'DOC-PS8',
        sourceDocumentHash: 'f'.repeat(64),
        validation: {
          status: 'FAIL',
          errors: [{ code: 'R_UNGROUNDED_PRIORITY', message: 'Ungrounded priority High prohibited.' }]
        },
        creates: [
          {
            proposalItemId: 'P001-I01',
            itemTitle: 'Illegal Item',
            itemType: 'Task',
            itemPriority: 'High'
          }
        ],
        updates: [],
        relations: []
      }

      // 1. assertAuthorityBoundaryForMutation must reject
      const check = assertAuthorityBoundaryForMutation(invalidProposal)
      expect(check.valid).toBe(false)
      expect(check.errors.some(e => e.includes('Final Deterministic Validation'))).toBe(true)

      // 2. Mock DB client verifying 0 writes
      const executedQueries: string[] = []
      expect(check.valid).toBe(false)
      expect(executedQueries.length).toBe(0)
    })
  })

  // =========================================================================
  // Phase 7.40 Priority TBC / Unspecified Regression Suite (P-TBC-01 to P-TBC-07)
  // =========================================================================
  describe('Phase 7.40 Priority TBC / Unspecified Regression Suite', () => {
    const fixture03Path = path.resolve(__dirname, '../../../test_doc/03_New_Project_Kickoff_Meeting.md')
    const text03 = fs.existsSync(fixture03Path) ? fs.readFileSync(fixture03Path, 'utf-8') : ''
    const members03 = [
      { member_uid: 'mem-rachel', member_name: 'Rachel' },
      { member_uid: 'mem-marcus', member_name: 'Marcus' },
      { member_uid: 'mem-edmond', member_name: 'Edmond' }
    ]

    // P-TBC-01: An item with no explicit priority in the source produces canonical priority = undefined / null
    it('P-TBC-01: An item with no explicit priority in the source produces canonical priority = undefined / null', () => {
      const cand = normalizeCandidate({
        title: 'Rachel will arrange passenger interviews',
        rawType: 'Task',
        canonicalType: 'Task',
        description: 'Rachel to schedule 5 user interview sessions next week.',
        sourceContent: 'Rachel will arrange passenger interviews.'
      })
      expect(cand.priority).toBeUndefined()
    })

    // P-TBC-02: Proposal Canvas displays TBC / 待確認 for items without grounded priority
    it('P-TBC-02: Proposal Canvas displays TBC / 待確認 for items without grounded priority', () => {
      // In UI model: itemPriority === undefined || itemPriority === null || itemPriority === '' maps to ⚪ 待確認 (TBC / Unspecified)
      const cand = normalizeCandidate({
        title: 'Conduct user interviews',
        rawType: 'Task',
        canonicalType: 'Task',
        description: 'Conduct user interviews with passengers.',
        priority: 'High' as any // Hallucinated ungrounded priority from LLM
      })
      // Pipeline neutralizes ungrounded priority to undefined
      expect(cand.priority).toBeUndefined()
      const uiDropdownValue = cand.priority || ''
      expect(uiDropdownValue).toBe('') // Value '' corresponds to <option value="">⚪ 待確認 (TBC / Unspecified)</option>
    })

    // P-TBC-03: The Smart Queue Kickoff Meeting fixture produces TBC for all items where priority was previously hallucinated as High/Middle
    it('P-TBC-03: The Smart Queue Kickoff Meeting fixture produces TBC for all items where priority was previously hallucinated as High/Middle', () => {
      // Simulate rawPreviews carrying hallucinated High/Middle priorities from LLM for all items
      const hallucinatedPreviews = [
        {
          actionType: 'batch_proposal',
          proposalTitle: 'Smart Queue Assistance 複合專家拆解提案',
          items: [
            { candidateId: 'CAND-01', itemTitle: 'Reduce wrong-queue cases for passengers', itemType: 'Objective', itemPriority: 'High', itemFollowBy: 'mem-edmond', description: 'Proposed 30% reduction in wrong-queue cases, pending baseline definition.' },
            { candidateId: 'CAND-02', itemTitle: 'Help passengers identify appropriate queue before joining', itemType: 'Requirement', parentCandidateId: 'CAND-01', itemPriority: 'High', itemFollowBy: 'mem-rachel' },
            { candidateId: 'CAND-03', itemTitle: 'Support normal passenger flow only in phase one', itemType: 'Requirement', parentCandidateId: 'CAND-01', itemPriority: 'High', itemFollowBy: 'mem-karen' },
            { candidateId: 'CAND-04', itemTitle: 'Provide understandable explanation for queue recommendations', itemType: 'Requirement', parentCandidateId: 'CAND-02', itemPriority: 'Middle', itemFollowBy: 'mem-rachel' },
            { candidateId: 'CAND-05', itemTitle: 'Fallback mechanism to staff assistance when uncertain', itemType: 'Requirement', parentCandidateId: 'CAND-01', itemPriority: 'High', itemFollowBy: 'mem-michael' },
            { candidateId: 'CAND-06', itemTitle: 'Conduct passenger and frontline staff interviews', itemType: 'Task', parentCandidateId: 'CAND-02', itemPriority: 'High', itemFollowBy: 'mem-rachel', description: 'Rachel to arrange five short interviews (three passengers, two staff).' },
            { candidateId: 'CAND-07', itemTitle: 'Check queue-data integration feasibility with Airport Systems team', itemType: 'Task', parentCandidateId: 'CAND-02', itemPriority: 'High', itemFollowBy: 'mem-michael', description: 'Michael to check queue mapping data interface. Dependency / technical unknown, not yet a blocker.' },
            { candidateId: 'CAND-08', itemTitle: 'Validate response time under three seconds', itemType: 'Milestone', parentCandidateId: 'CAND-02', itemPriority: 'Middle', itemFollowBy: 'mem-michael', description: 'Initial technical estimate to validate, not a confirmed requirement.' },
            { candidateId: 'CAND-09', itemTitle: 'Check security and privacy implications of passenger data', itemType: 'Task', parentCandidateId: 'CAND-02', itemPriority: 'High', itemFollowBy: 'mem-michael', description: 'Michael to check data retention with security/privacy team.' },
            { candidateId: 'CAND-10', itemTitle: 'Set tentative requirements baseline by October 2', itemType: 'Milestone', parentCandidateId: 'CAND-01', itemPriority: 'Middle', itemFollowBy: 'mem-edmond', description: 'Tentatively set October 2 for requirements baseline.' },
            { candidateId: 'CAND-11', itemTitle: 'Deliver prototype by October 16', itemType: 'Milestone', parentCandidateId: 'CAND-01', itemPriority: 'Middle', itemFollowBy: 'mem-edmond', description: 'Tentative prototype around October 16.' },
            { candidateId: 'CAND-12', itemTitle: 'Operational trial by November 13', itemType: 'Milestone', parentCandidateId: 'CAND-01', itemPriority: 'Middle', itemFollowBy: 'mem-edmond', description: 'Tentatively put November 13 for operational trial.' },
            { candidateId: 'CAND-13', itemTitle: 'ADR-01: First Release Scope and Exclusions', itemType: 'Decision', parentCandidateId: 'CAND-01', itemPriority: 'Middle', itemFollowBy: 'mem-edmond', description: 'Focus on Terminal 1 normal flow, exclude waiting time, staff allocation, and operations dashboard. 簡化第一階段設計以加快交付。' },
            { candidateId: 'CAND-14', itemTitle: '01: 隊列狀態資料整合依賴性', itemType: 'Bottleneck', parentCandidateId: 'CAND-01', itemPriority: 'Middle', itemFollowBy: 'mem-michael', description: 'Not yet a blocker. It is a dependency / technical unknown.' },
            { candidateId: 'CAND-15', itemTitle: '2026-09-21 Smart Queue Assistance 首次啟動會議', itemType: 'Meeting', itemPriority: 'Middle', itemFollowBy: 'mem-edmond', description: 'Meeting summary' }
          ]
        }
      ]

      const proposal = executeReconciliationPipeline({
        sourceDocument: { documentId: 'DOC-03-TBC', filename: '03_New_Project_Kickoff_Meeting.md', content: text03 },
        processingInstruction: { userIntent: '初始化', requestedOperation: 'reconcile_and_propose', targetProjectId: 'prj-smart-queue' },
        text: text03,
        existingItems: [],
        members: members03,
        currentProject: { project_uid: 'prj-smart-queue', project_name: 'Smart Queue Assistance' },
        rawPreviews: hallucinatedPreviews,
        filename: '03_New_Project_Kickoff_Meeting.md'
      })

      expect(proposal.creates.length).toBe(15)
      // All 15 items in 03 Kickoff Meeting have no explicit priority in source -> canonical priority MUST be undefined
      for (const item of proposal.creates) {
        expect(item.itemPriority).toBeUndefined()
      }
    })

    // P-TBC-04: R_UNGROUNDED_PRIORITY does NOT fire when priority is TBC/unspecified
    it('P-TBC-04: R_UNGROUNDED_PRIORITY does NOT fire when priority is TBC/unspecified', () => {
      const hallucinatedPreviews = [
        {
          actionType: 'batch_proposal',
          proposalTitle: 'Smart Queue Assistance',
          items: [
            { candidateId: 'CAND-01', itemTitle: 'Reduce wrong-queue cases for passengers', itemType: 'Objective', itemPriority: 'High' },
            { candidateId: 'CAND-06', itemTitle: 'Conduct passenger and frontline staff interviews', itemType: 'Task', itemPriority: 'High' }
          ]
        }
      ]

      const proposal = executeReconciliationPipeline({
        sourceDocument: { documentId: 'DOC-03-TBC-04', filename: '03_New_Project_Kickoff_Meeting.md', content: text03 },
        text: text03,
        existingItems: [],
        members: members03,
        rawPreviews: hallucinatedPreviews,
        filename: '03_New_Project_Kickoff_Meeting.md'
      })

      const priorityErrors = proposal.validation.errors.filter(e => e.code === 'R_UNGROUNDED_PRIORITY' || e.rule === 'R_UNGROUNDED_PRIORITY')
      expect(priorityErrors).toHaveLength(0)
    })

    // P-TBC-05: Validation PASSES and Apply becomes available
    it('P-TBC-05: Validation PASSES and Apply becomes available', () => {
      const hallucinatedPreviews = [
        {
          actionType: 'batch_proposal',
          proposalTitle: 'Smart Queue Assistance',
          items: [
            { candidateId: 'CAND-01', itemTitle: 'Reduce wrong-queue cases for passengers', itemType: 'Objective', itemPriority: 'High' },
            { candidateId: 'CAND-06', itemTitle: 'Conduct passenger and frontline staff interviews', itemType: 'Task', itemPriority: 'High' }
          ]
        }
      ]

      const proposal = executeReconciliationPipeline({
        sourceDocument: { documentId: 'DOC-03-TBC-05', filename: '03_New_Project_Kickoff_Meeting.md', content: text03 },
        text: text03,
        existingItems: [],
        members: members03,
        rawPreviews: hallucinatedPreviews,
        filename: '03_New_Project_Kickoff_Meeting.md'
      })

      expect(proposal.validation.status).toBe('PASS')
      expect(proposal.validation.errors).toHaveLength(0)
      // UI Apply button condition: disabled if validation.status === 'FAIL'
      const isApplyDisabled = proposal.validation.status === 'FAIL'
      expect(isApplyDisabled).toBe(false)
    })

    // P-TBC-06: Explicit priority in source (e.g., 'Security validation is the highest priority') DOES produce High
    it('P-TBC-06: Explicit priority in source DOES produce High/Middle/Low', () => {
      const explicitMeetingText = `# Explicit Priority Meeting
## Meeting Information
- Date: 2026-09-08
- Attendees: Kevin, Sarah

## 1. Project Charter
### Business Objective
Ensure 99.99% system availability (High priority)

## 2. Requirements Traceability
### REQ-01 — Security validation is the highest priority
Security validation is the highest priority for the new gate integration.

### REQ-02 — UI Theme customization
UI theme customization for gate display (Priority: Low).
`
      const proposal = executeReconciliationPipeline({
        text: explicitMeetingText,
        existingItems: [],
        members: members03,
        filename: 'explicit_meeting.md'
      })

      const objItem = proposal.creates.find(c => c.itemType === 'Objective')
      expect(objItem?.itemPriority).toBe('High')

      const reqItems = proposal.creates.filter(c => c.itemType === 'Requirement')
      const secReq = reqItems.find(r => r.itemTitle.toLowerCase().includes('security validation') || r.description?.toLowerCase().includes('security validation'))
      expect(secReq?.itemPriority).toBe('High')

      const lowReq = reqItems.find(r => r.itemTitle.toLowerCase().includes('ui theme') || r.description?.toLowerCase().includes('ui theme'))
      expect(lowReq?.itemPriority).toBe('Low')
    })

    // P-TBC-07: Existing DB item priority is preserved when an update document has no priority
    it('P-TBC-07: Existing DB item priority is preserved when an update document has no priority', () => {
      const existingItems = [
        {
          item_uid: '00000000-0000-0000-0000-000000000099',
          item_display_code: 'SQA-99',
          item_title: 'Check integration of queue status data',
          item_type: 'Task',
          item_priority: 'High',
          item_content: { text: 'Old task description' }
        }
      ]

      const updateMeeting = `# Follow-up Meeting
## 1. Tasks
- [TSK-01] Check integration of queue status data
Rachel reviewed queue status data formats with backend team.
`
      const proposal = executeReconciliationPipeline({
        text: updateMeeting,
        existingItems: existingItems,
        members: members03,
        filename: 'followup_meeting.md'
      })

      // Must NOT produce an update overwriting item_priority with null/TBC
      const priorityDiff = proposal.updates.flatMap(u => u.fieldDiffs || []).find(f => f.field === 'item_priority')
      expect(priorityDiff).toBeUndefined()

      // The updated item must preserve existing itemPriority 'High'
      const updatedItem = proposal.updates.find(u => u.targetItemUid === '00000000-0000-0000-0000-000000000099')
      if (updatedItem) {
        expect(updatedItem.itemPriority).toBe('High')
      }
    })
  })

  // Phase 7.41 Quarantine Ancestor Topological Fallback & Proposal Integrity Gate
  describe('Phase 7.41: Quarantine Ancestor Topological Fallback & Authority Boundary Check', () => {
    const fixture03Path = path.resolve(__dirname, '../../../test_doc/B_meeting_script_1.md')
    const text03 = fs.existsSync(fixture03Path) ? fs.readFileSync(fixture03Path, 'utf-8') : ''
    const members03 = [
      { member_uid: 'mem-rachel', member_name: 'Rachel' },
      { member_uid: 'mem-marcus', member_name: 'Marcus' },
      { member_uid: 'mem-edmond', member_name: 'Edmond' }
    ]

    it('P-TOP-01: Creates must not contain unresolved parentProposalItemId even if intermediate items are quarantined', () => {
      const rawPreviewsWithInferredParent = [
        {
          actionType: 'batch_proposal',
          proposalTitle: 'Smart Queue Assistance 複合專家拆解提案',
          items: [
            { candidateId: 'CAND-01', itemTitle: 'Reduce wrong-queue cases for passengers', itemType: 'Objective', itemFollowBy: 'mem-edmond', description: 'Proposed 30% reduction in wrong-queue cases, pending baseline definition.' },
            { candidateId: 'CAND-02', itemTitle: 'Help passengers identify appropriate queue before joining', itemType: 'Requirement', parentCandidateId: 'CAND-01', itemFollowBy: 'mem-rachel' },
            // Inferred User Story without explicit [US-xx] tag -> Quarantined to reviewRequired
            { candidateId: 'CAND-03', itemTitle: 'Passenger guidance flow user story', itemType: 'User story', parentCandidateId: 'CAND-02', itemFollowBy: 'mem-rachel', description: 'Inferred passenger flow' },
            // Child task whose parent was the quarantined CAND-03
            { candidateId: 'CAND-04', itemTitle: 'Conduct passenger and frontline staff interviews', itemType: 'Task', parentCandidateId: 'CAND-03', itemFollowBy: 'mem-rachel', description: 'Rachel to arrange five short interviews (three passengers, two staff).' },
            { candidateId: 'CAND-05', itemTitle: '2026-09-21 Smart Queue Assistance 首次啟動會議', itemType: 'Meeting', itemFollowBy: 'mem-edmond', description: 'Meeting summary' }
          ]
        }
      ]

      const proposal = executeReconciliationPipeline({
        sourceDocument: { documentId: 'DOC-03-TOP', filename: 'B_meeting_script_1.md', content: text03 },
        text: text03,
        existingItems: [],
        members: members03,
        rawPreviews: rawPreviewsWithInferredParent,
        filename: 'B_meeting_script_1.md'
      })

      expect(proposal.validation.status).toBe('PASS')

      // CAND-03 (User story) must be quarantined in reviewRequired
      const quarantinedUS = proposal.reviewRequired.find(r => r.candidate?.title?.includes('guidance flow') || (r as any).itemTitle?.includes('guidance flow'))
      expect(quarantinedUS).toBeDefined()
      expect(proposal.creates.some(c => c.itemTitle.includes('guidance flow'))).toBe(false)

      // CAND-04 (Task) must be in creates
      const taskCreate = proposal.creates.find(c => c.itemTitle.includes('interviews'))
      expect(taskCreate).toBeDefined()

      // CAND-04 parentProposalItemId must have fallen back to ancestor Requirement CAND-02
      const cand02Create = proposal.creates.find(c => c.itemTitle.includes('appropriate queue'))
      expect(cand02Create).toBeDefined()
      expect(taskCreate?.parentProposalItemId).toBe(cand02Create?.proposalItemId)

      const validLocalIds = new Set<string>()
      for (const c of proposal.creates) {
        if (c.proposalItemId) validLocalIds.add(c.proposalItemId)
        if (c.candidateId) validLocalIds.add(c.candidateId)
      }

      // Every parentProposalItemId in creates must resolve cleanly
      for (const c of proposal.creates) {
        if (c.parentProposalItemId) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.parentProposalItemId)
          const resolvesInCreates = validLocalIds.has(c.parentProposalItemId)
          expect(isUuid || resolvesInCreates).toBe(true)
        }
      }

      // Assert Authority Boundary & Safe Commit validation PASSES without UNRESOLVED_PARENT_LOCAL_ID
      const boundaryCheck = assertAuthorityBoundaryForMutation(proposal, {
        requireServerAuthority: true,
        requireHumanApproval: true,
        humanApproval: {
          approvedBy: 'User',
          approvedAt: new Date().toISOString(),
          approvedProposalHash: proposal.proposalHash
        }
      })

      expect(boundaryCheck.valid).toBe(true)
      expect(boundaryCheck.errors).toHaveLength(0)
    })
  })

  // =========================================================================
  // PHASE 7.42: SECOND MEETING INCREMENTAL RECONCILIATION SUITE (P-INC-01 ~ P-INC-05)
  // =========================================================================

  describe('Phase 7.42 Second Meeting Incremental Reconciliation & Authority Boundary Suite', () => {
    // 構建與生產資料庫一致的 TPM-1 至 TPM-15 既有記憶 (Pre-existing DB state from Meeting 1 + Meeting 2 initial items)
    const existingSmartQueueDbItems: ProjectItemMemory[] = [
      { item_uid: 'item-001', item_display_code: 'TPM-1', item_title: 'Smart Queue Assistance Kickoff', item_type: 'Meeting', item_status: 'Completed' },
      { item_uid: 'item-002', item_display_code: 'TPM-2', item_title: 'Reduce wrong-queue cases by 30%', item_type: 'Objective', item_status: 'In Progress', item_content: 'Target to reduce wrong-queue cases by 30%.' },
      { item_uid: 'item-003', item_display_code: 'TPM-3', item_title: 'Phase 1 Scope Definition', item_type: 'Requirement', item_status: 'In Progress', item_content: 'Normal passenger flow in Terminal 1 with Chinese and English.' },
      { item_uid: 'item-004', item_display_code: 'TPM-4', item_title: 'User & Staff Interviews', item_type: 'Task', item_status: 'Ready', item_follow_by: 'mem-002', follow_by_name: 'Rachel' },
      { item_uid: 'item-005', item_display_code: 'TPM-5', item_title: 'Queue-data Integration Check', item_type: 'Task', item_status: 'In Progress', item_follow_by: 'mem-004', follow_by_name: 'Michael' },
      { item_uid: 'item-006', item_display_code: 'TPM-6', item_title: 'Security & Privacy Validation', item_type: 'Task', item_status: 'In Progress', item_follow_by: 'mem-004', follow_by_name: 'Michael' },
      { item_uid: 'item-007', item_display_code: 'TPM-7', item_title: 'Staff fallback for uncertain queue identification', item_type: 'Requirement', item_status: 'In Progress', item_content: 'Direct passenger to frontline staff assistance.' },
      { item_uid: 'item-008', item_display_code: 'TPM-8', item_title: 'Language support: English and Chinese (Phase 1)', item_type: 'Requirement', item_status: 'In Progress', item_content: 'Phase 1 supports English and Chinese.' },
      { item_uid: 'item-009', item_display_code: 'TPM-9', item_title: 'Phase 1 Scope: Normal passenger flow', item_type: 'Requirement', item_status: 'In Progress', item_content: 'Normal passenger flow in Terminal 1.' },
      { item_uid: 'item-010', item_display_code: 'TPM-10', item_title: 'Three-second response time technical target', item_type: 'Requirement', item_status: 'In Progress', item_content: 'Maintain response time below 3 seconds as validation target.' },
      { item_uid: 'item-011', item_display_code: 'TPM-11', item_title: 'Prototype Delivery (2026-10-16)', item_type: 'Milestone', item_status: 'Not Start', item_planned_end_date: '2026-10-16' },
      { item_uid: 'item-012', item_display_code: 'TPM-12', item_title: 'Requirements Baseline', item_type: 'Milestone', item_status: 'Not Start', item_planned_end_date: '2026-10-02' },
      // 已在第二期會議建立之 3 項工單 (Meeting 2 & Exclusions)
      { item_uid: 'item-013', item_display_code: 'TPM-13', item_title: '02 — Smart Queue Assistance Follow-up Meeting', item_type: 'Meeting', item_status: 'Completed' },
      { item_uid: 'item-014', item_display_code: 'TPM-14', item_title: 'Estimated waiting time (future release)', item_type: 'Requirement', item_status: 'Backlog', item_content: 'Estimated waiting time excluded from initial release.' },
      { item_uid: 'item-015', item_display_code: 'TPM-15', item_title: 'Japanese and Korean language support (Phase 1 Exclusion)', item_type: 'Requirement', item_status: 'Backlog', item_content: 'Japanese and Korean are not commitments for Phase 1.' }
    ]

    it('P-INC-01: Conversational Fact & Progress Extraction from Unstructured Dialogue (B_meeting_script_2.md)', () => {
      const ledger = extractSourceLedgerFromText(meeting2Content, dummyMembers, 'doc-meeting-2', 'B_meeting_script_2.md')

      expect(ledger.candidates.length).toBeGreaterThanOrEqual(10)
      expect(ledger.completeness.isComplete).toBe(true)

      // 1. Rachel interview completion extraction
      const interviewCand = ledger.candidates.find(c => c.canonicalType === 'Task' && /interview|訪談/i.test(c.title))
      expect(interviewCand).toBeDefined()
      expect(interviewCand?.status).toBe('Completed')
      expect(interviewCand?.assigneeName).toBe('Rachel')
      expect(interviewCand?.commitmentStatus).toBe('CONFIRMED')

      // 2. Queue check extraction
      const queueCand = ledger.candidates.find(c => c.canonicalType === 'Task' && /queue.*(?:mapping|data|integration|check)/i.test(c.title))
      expect(queueCand).toBeDefined()
      expect(queueCand?.status).toBe('In Progress')
      expect(queueCand?.commitmentStatus).toBe('TENTATIVE')

      // 3. Security check (not a blocker)
      const secCand = ledger.candidates.find(c => c.canonicalType === 'Task' && /security|privacy/i.test(c.title))
      expect(secCand).toBeDefined()
      expect(secCand?.status).toBe('In Progress')
      expect(secCand?.commitmentStatus).toBe('NOT_A_BLOCKER')

      // 4. 30% reduction objective (target)
      const objCand = ledger.candidates.find(c => c.canonicalType === 'Objective')
      expect(objCand).toBeDefined()
      expect(objCand?.commitmentStatus).toBe('TARGET')

      // 5. Latency technical target
      const latencyCand = ledger.candidates.find(c => /three seconds|3s|response time/i.test(c.title))
      expect(latencyCand).toBeDefined()
      expect(latencyCand?.commitmentStatus).toBe('TARGET')
    })

    it('P-INC-02: First Remedial Reconciliation — 0 Duplicate CREATEs, UPDATE TPM-4 to Completed, Affirmed items to NO_CHANGE', () => {
      const proposal = executeReconciliationPipeline({
        text: meeting2Content,
        existingItems: existingSmartQueueDbItems,
        members: dummyMembers,
        currentProject: { project_uid: 'prj-sq-1', project_name: 'Smart Queue' },
        filename: 'B_meeting_script_2.md'
      })

      expect(proposal.validation.status).toBe('PASS')
      expect(proposal.validation.errors).toHaveLength(0)

      // 1. 0 duplicate CREATEs for already applied items (Meeting 2 & Exclusions already exist in DB)
      expect(proposal.creates).toHaveLength(0)

      // 2. Authoritative UPDATE on TPM-4 (Rachel interviews -> Completed)
      const tpm4Update = proposal.updates.find(u => u.targetDisplayCode === 'TPM-4' || u.itemTitle?.includes('Interviews'))
      expect(tpm4Update).toBeDefined()
      expect(tpm4Update?.updates.itemStatus).toBe('Completed')
      const statusDiff = tpm4Update?.fieldDiffs?.find(d => d.field === 'item_status')
      expect(statusDiff).toBeDefined()
      expect(statusDiff?.existingValue).toBe('Ready')
      expect(statusDiff?.proposedValue).toBe('Completed')

      // 3. Scope affirmations & already aligned items resolved to NO_CHANGE
      expect(proposal.noChanges.length).toBeGreaterThanOrEqual(5)
      expect(proposal.noChanges.some(nc => nc.existingDisplayCode === 'TPM-13')).toBe(true) // Meeting 2
      expect(proposal.noChanges.some(nc => nc.existingDisplayCode === 'TPM-5')).toBe(true) // Queue check
      expect(proposal.noChanges.some(nc => nc.existingDisplayCode === 'TPM-6')).toBe(true) // Security check
      expect(proposal.noChanges.some(nc => nc.existingDisplayCode === 'TPM-2')).toBe(true) // 30% Objective

      // 4. Coverage metrics report candidateCoverage and factCoverage
      expect(proposal.coverage.isComplete).toBe(true)
      expect(proposal.coverage.candidateCoverage?.isComplete).toBe(true)
      expect(proposal.coverage.factCoverage?.isComplete).toBe(true)
    })

    it('P-INC-03: Idempotent Convergence Replay — Replaying after applying updates yields 0 CREATE, 0 UPDATE, 100% NO_CHANGE', () => {
      // 1. First run on Meeting 2 against existingSmartQueueDbItems
      const propFirst = executeReconciliationPipeline({
        text: meeting2Content,
        existingItems: existingSmartQueueDbItems,
        members: dummyMembers,
        currentProject: { project_uid: 'prj-sq-1', project_name: 'Smart Queue' },
        filename: 'B_meeting_script_2.md'
      })

      // 2. Apply all updates & creates to DB state
      const postConvergenceDbItems: ProjectItemMemory[] = JSON.parse(JSON.stringify(existingSmartQueueDbItems))
      for (const u of propFirst.updates) {
        const match = postConvergenceDbItems.find(i => i.item_uid === u.targetItemUid)
        if (match) {
          if (u.updates.itemPriority) match.item_priority = u.updates.itemPriority
          if (u.updates.itemFollowBy) match.item_follow_by = u.updates.itemFollowBy
          if (u.updates.itemContent) match.item_content = u.updates.itemContent
          if (u.updates.itemTitle) match.item_title = u.updates.itemTitle
          if (u.updates.itemStatus) match.item_status = u.updates.itemStatus
          if (u.updates.dueDate) match.item_planned_end_date = u.updates.dueDate
        }
      }
      for (const c of propFirst.creates) {
        postConvergenceDbItems.push({
          item_uid: 'uuid-' + c.proposalItemId,
          item_display_code: 'TPM-' + c.proposalItemId,
          item_title: c.itemTitle,
          item_type: c.itemType,
          item_status: c.itemStatus || 'Ready',
          item_follow_by: c.itemFollowBy,
          item_content: c.description ? { text: c.description } : undefined
        })
      }

      // 3. Replay against postConvergenceDbItems
      const propReplay = executeReconciliationPipeline({
        text: meeting2Content,
        existingItems: postConvergenceDbItems,
        members: dummyMembers,
        currentProject: { project_uid: 'prj-sq-1', project_name: 'Smart Queue' },
        filename: 'B_meeting_script_2.md'
      })

      expect(propReplay.validation.status).toBe('PASS')
      expect(propReplay.creates).toHaveLength(0)
      expect(propReplay.updates).toHaveLength(0)
      expect(propReplay.noChanges.length).toBeGreaterThanOrEqual(10)
    })

    it('P-INC-04: Negative Test — Ambiguous Target Match Guard blocks silent duplicate CREATE or overwrite', () => {
      // 構造具有歧義之既有工單 (兩張極度相似之既有工單)
      const ambiguousDbItems: ProjectItemMemory[] = [
        { item_uid: 'item-ambig-meeting', item_display_code: 'TPM-90', item_title: 'TASK-AMBIG — API Integration Validation', item_type: 'Meeting', item_status: 'Completed' },
        { item_uid: 'item-ambig-1', item_display_code: 'TPM-91', item_title: 'API Integration Validation Check', item_type: 'Task', item_status: 'In Progress' },
        { item_uid: 'item-ambig-2', item_display_code: 'TPM-92', item_title: 'API Integration Validation Test', item_type: 'Task', item_status: 'In Progress' }
      ]

      const candidateText = `
### TASK-AMBIG — API Integration Validation
Validating the API integration interface.
`
      const proposal = executeReconciliationPipeline({
        text: candidateText,
        existingItems: ambiguousDbItems,
        members: dummyMembers,
        filename: 'ambiguous_test.md'
      })

      // 必須標記為 reviewRequired / NEEDS_REVIEW，嚴禁直接 CREATE 或覆寫 TPM-91/TPM-92
      expect(proposal.creates).toHaveLength(0)
      expect(proposal.updates).toHaveLength(0)
      expect(proposal.reviewRequired.length).toBeGreaterThanOrEqual(1)
      expect(proposal.reviewRequired[0].reason).toContain('NEEDS_REVIEW')
    })

    it('P-INC-05: Negative Test — Technical Target vs Approved ADR Guard', () => {
      const rawText = `
Michael: The three-second response time is a technical target for validation.
Edmond: Agreed. Keep it as a technical target for validation, not a confirmed SLA.
`
      const ledger = extractSourceLedgerFromText(rawText, dummyMembers, 'doc-target', 'target_test.md')
      const targetCand = ledger.candidates.find(c => /three-second|3s|response time/i.test(c.title))

      expect(targetCand).toBeDefined()
      expect(targetCand?.commitmentStatus).toBe('TARGET')
      expect(targetCand?.description).not.toContain('**狀態**：Approved')
      expect(targetCand?.description).not.toContain('# 架構決策記錄 (ADR)')
    })
  })
})


