import { describe, it, expect } from 'vitest'
import { executeReconciliationPipeline } from '../services/reconciliation/proposalPipeline.js'
import { reconcileCandidate } from '../services/reconciliation/itemReconciler.js'
import { normalizeCandidate, isJunkHeadingOrPreamble } from '../services/reconciliation/candidateNormalizer.js'
import { validateAndPlanTopology } from '../services/reconciliation/graphValidator.js'
import { ProjectItemMemory } from '../services/reconciliation/memoryRetriever.js'

describe('Projectson AI Copilot Meeting Intelligence & Reconciliation Spec v1.0 Suite', () => {
  const dummyMembers = [
    { member_uid: 'mem-001', member_name: 'Kevin Lau', member_email: 'kevin@test.com' },
    { member_uid: 'mem-002', member_name: 'Sarah Wong', member_email: 'sarah@test.com' },
    { member_uid: 'mem-003', member_name: 'Edmond Chan', member_email: 'edmond@test.com' }
  ]

  const existingItems: ProjectItemMemory[] = [
    {
      item_uid: 'TPM-200',
      item_display_code: 'TPM-200',
      item_title: '縮短登機過閘至 2.5s',
      item_type: 'Objective'
    },
    {
      item_uid: 'TPM-201',
      item_display_code: 'TPM-201',
      item_title: '實現雙模態身份驗證',
      item_type: 'Requirement',
      parent_item_uid: 'TPM-200'
    },
    {
      item_uid: 'TPM-241',
      item_display_code: 'TPM-241',
      item_title: 'Develop Cloud Run verification API',
      item_type: 'Task',
      item_content: { text: 'Initial verification API description' },
      item_follow_by: 'mem-001'
    },
    {
      item_uid: 'TPM-245',
      item_display_code: 'TPM-245',
      item_title: 'Perform load testing for 500 concurrent users',
      item_type: 'Task',
      item_content: { text: 'Perform load testing for 500 concurrent users.' }
    },
    {
      item_uid: 'TPM-259',
      item_display_code: 'TPM-259',
      item_title: 'Develop biometric verification API',
      item_type: 'Task'
    }
  ]

  // TEST 01: One New Task
  it('TEST 01: should CREATE 1 new task when no existing item matches', () => {
    const candidate = normalizeCandidate({
      title: '開發登機門雙螢幕引導 UI',
      rawType: 'Task',
      assigneeName: 'Sarah Wong'
    }, 0)

    const result = reconcileCandidate(candidate, existingItems, dummyMembers)
    expect(result.action).toBe('CREATE')
    expect(result.candidate.title).toBe('開發登機門雙螢幕引導 UI')
  })

  // TEST 02: Multiple New Tasks
  it('TEST 02: should process multiple new tasks without dropping candidates', () => {
    const proposal = executeReconciliationPipeline({
      text: 'Meeting recap',
      existingItems: [],
      members: dummyMembers,
      rawPreviews: [
        {
          actionType: 'batch_proposal',
          items: [
            { itemTitle: 'Task 1: Build WebSocket server', itemType: 'Task', itemFollowBy: 'Kevin' },
            { itemTitle: 'Task 2: Build UI animations', itemType: 'Task', itemFollowBy: 'Sarah' }
          ]
        }
      ]
    })

    expect(proposal.coverage.isComplete).toBe(true)
    expect(proposal.creates.length).toBe(2)
    expect(proposal.creates[0].itemFollowBy).toBe('mem-001')
    expect(proposal.creates[1].itemFollowBy).toBe('mem-002')
  })

  // TEST 03: Existing Task With New Information (UPDATE)
  it('TEST 03: should UPDATE existing task when new implementation details are provided', () => {
    const candidate = normalizeCandidate({
      title: 'Develop Cloud Run /api/v1/gate/verify multimodal verification endpoint',
      description: 'Extended description with detailed architecture and endpoint details for /api/v1/gate/verify',
      rawType: 'Task',
      dueDate: '2026-09-20'
    }, 0)

    const result = reconcileCandidate(candidate, existingItems, dummyMembers)
    expect(result.action).toBe('UPDATE')
    expect(result.existingItemUid).toBe('TPM-241')
  })

  // TEST 04: Existing Information With No Change (NO_CHANGE)
  it('TEST 04: should detect NO_CHANGE for semantically identical information', () => {
    const candidate = normalizeCandidate({
      title: 'Perform load testing for 500 concurrent users',
      description: 'Perform load testing for 500 concurrent users.',
      rawType: 'Task'
    }, 0)

    const result = reconcileCandidate(candidate, existingItems, dummyMembers)
    expect(result.action).toBe('NO_CHANGE')
    expect(result.existingItemUid).toBe('TPM-245')
  })

  // TEST 07: Full 5-Layer Traceability
  it('TEST 07: should construct valid 5-layer hierarchy and Meeting discusses relations', () => {
    const proposal = executeReconciliationPipeline({
      text: 'Meeting recap text',
      existingItems: [],
      members: dummyMembers,
      rawPreviews: [
        {
          actionType: 'batch_proposal',
          items: [
            { itemTitle: '登機門系統研討會', itemType: 'Meeting' },
            { itemTitle: '縮短登機過閘至 2.5s', itemType: 'Objective' },
            { itemTitle: '雙模態身份驗證', itemType: 'Requirement', parentItemUid: '縮短登機過閘至 2.5s' },
            { itemTitle: '作為旅客無感過閘', itemType: 'User story', parentItemUid: '雙模態身份驗證' },
            { itemTitle: '開發核驗端點', itemType: 'Task', parentItemUid: '作為旅客無感過閘', itemFollowBy: 'Kevin' },
            { itemTitle: 'UAT 500人壓力測試', itemType: 'UAT', parentItemUid: '開發核驗端點' }
          ]
        }
      ]
    })

    expect(proposal.validation.status).toBe('PASS')
    const meetingCreate = proposal.creates.find(c => c.itemType === 'Meeting')
    expect(meetingCreate).toBeDefined()
    expect(meetingCreate?.relationItemUid?.length).toBeGreaterThan(0)
    expect(meetingCreate?.relationItemUid?.[0].relation).toBe('discusses')
  })

  // TEST 09: Ambiguous Match (REVIEW_REQUIRED)
  it('TEST 09: should mark REVIEW_REQUIRED when multiple items match with similar score', () => {
    const candidate = normalizeCandidate({
      title: 'Develop verification API',
      rawType: 'Task'
    }, 0)

    const result = reconcileCandidate(candidate, existingItems, dummyMembers)
    expect(result.action).toBe('REVIEW_REQUIRED')
    expect(result.possibleMatches?.length).toBeGreaterThanOrEqual(2)
  })

  // TEST 14: Irrelevant text / Junk heading filter
  it('TEST 14: should ignore chat preamble, LaTeX headings, and non-actionable text', () => {
    expect(isJunkHeadingOrPreamble("$\\rightarrow$ 'Requirement' $\\rightarrow$ 'User story'")).toBe(true)
    expect(isJunkHeadingOrPreamble('Requirements**: 雙模態驗證、硬件通訊')).toBe(true)
    expect(isJunkHeadingOrPreamble('User Stories**: 旅客無感通過體驗')).toBe(true)
    expect(isJunkHeadingOrPreamble('Decisions**: Neon pgvector 方案')).toBe(true)
    expect(isJunkHeadingOrPreamble('開發 Cloud Run 並行核驗端點')).toBe(false)
  })

  // TEST 15: 1_first_meeting.md exact 15 source items extraction & cardinality accounting
  it('TEST 15: should extract exact 15 items from 1_first_meeting.md with 0 hallucinated items', async () => {
    const { extractSourceLedgerFromText } = await import('../services/reconciliation/sourceLedgerExtractor.js')
    const fs = await import('fs')
    const path = await import('path')

    const meetingFilePath = path.resolve(__dirname, '../../../test_doc/1_first_meeting.md')
    const meetingContent = fs.readFileSync(meetingFilePath, 'utf-8')

    const ledger = extractSourceLedgerFromText(meetingContent, dummyMembers)

    expect(ledger.summary.total).toBe(15)
    expect(ledger.summary.meeting).toBe(1)
    expect(ledger.summary.objective).toBe(1)
    expect(ledger.summary.requirement).toBe(2)
    expect(ledger.summary.userStory).toBe(1)
    expect(ledger.summary.task).toBe(3)
    expect(ledger.summary.uat).toBe(2)
    expect(ledger.summary.decision).toBe(2)
    expect(ledger.summary.bottleneck).toBe(1)
    expect(ledger.summary.milestone).toBe(2)

    // Verify assignees
    const taskKevin = ledger.candidates.find(c => c.title.includes('核驗端點'))
    expect(taskKevin?.assigneeName).toBe('Kevin Lau')
    expect(taskKevin?.assigneeUid).toBe('mem-001')

    const taskSarah = ledger.candidates.find(c => c.title.includes('雙螢幕'))
    expect(taskSarah?.assigneeName).toBe('Sarah Wong')
    expect(taskSarah?.assigneeUid).toBe('mem-002')

    const taskEdmond = ledger.candidates.find(c => c.title.includes('WebSocket'))
    expect(taskEdmond?.assigneeName).toBe('Edmond Chan')
    expect(taskEdmond?.assigneeUid).toBe('mem-003')

    // Verify UAT code preservation
    const uat01 = ledger.candidates.find(c => c.uatCode === 'UAT-01')
    expect(uat01?.title).toBe('[UAT-01] 500 人次連續壓力測試')
  })

  // TEST 16: Cardinality Hard Defense (Must NOT expand 15 items into 39 items)
  it('TEST 16: should strictly preserve cardinality and forbid synthetic item inflation (No 39 items bug)', async () => {
    const { extractSourceLedgerFromText } = await import('../services/reconciliation/sourceLedgerExtractor.js')
    const { auditAndSynthesizeProposals } = await import('../agents/supervisorCritic.js')
    const fs = await import('fs')
    const path = await import('path')

    const meetingFilePath = path.resolve(__dirname, '../../../test_doc/1_first_meeting.md')
    const meetingContent = fs.readFileSync(meetingFilePath, 'utf-8')

    const ledger = extractSourceLedgerFromText(meetingContent, dummyMembers)
    const initialBatchItems = ledger.candidates.map(c => ({
      itemTitle: c.title,
      itemType: c.canonicalType,
      itemPriority: c.priority,
      itemFollowBy: c.assigneeUid,
      parentItemUid: c.parentRef,
      description: c.description
    }))

    const mockCtx: any = {
      workspace_uid: 'ws-1',
      project_uid: 'prj-1',
      membersContext: dummyMembers,
      itemsContext: [],
      message: meetingContent,
      attachments: []
    }

    // Simulate sub-agents producing overlapping proposals
    const subAgentResults: any[] = [
      {
        agentName: 'spine',
        agentTitle: 'Spine Specialist',
        itemsToCreate: [
          { itemTitle: '雙模態身份驗證 (QR Code + Face Recognition)', itemType: 'Requirement' },
          { itemTitle: '開發 Cloud Run 上的 /api/v1/gate/verify 雙模態並行核驗端點', itemType: 'Task', itemFollowBy: 'Kevin Lau' },
          { itemTitle: '閘門硬件與通行控制通訊協議 (Gate Controller Protocol)', itemType: 'Requirement' },
          { itemTitle: '封裝 WebSocket/MQTT 閘門開啟/阻擋硬件指令控制層', itemType: 'Task', itemFollowBy: 'Edmond Chan' }
        ]
      },
      {
        agentName: 'decision',
        agentTitle: 'Decision Specialist',
        itemsToCreate: [
          { itemTitle: '人臉特徵比對與資料庫架構', itemType: 'Decision' },
          { itemTitle: '閘門離線降級容災機制 (Offline Fallback)', itemType: 'Decision' }
        ]
      }
    ]

    const outcome = auditAndSynthesizeProposals(mockCtx, subAgentResults, [
      { actionType: 'batch_proposal', items: initialBatchItems }
    ])

    const batch = outcome.unifiedActions.find((a: any) => a.actionType === 'batch_proposal')
    expect(batch).toBeDefined()
    // Must NOT explode into 39 items! Exactly 15 items preserved!
    expect(batch.items.length).toBe(15)

    // Check zero synthetic user stories for Requirement 2
    const userStories = batch.items.filter((i: any) => i.itemType === 'User story')
    expect(userStories.length).toBe(1)

    // Check decisions remain Decision
    const decisions = batch.items.filter((i: any) => i.itemType === 'Decision')
    expect(decisions.length).toBe(2)

    // Check bottleneck remains Bottleneck
    const bottlenecks = batch.items.filter((i: any) => i.itemType === 'Bottleneck')
    expect(bottlenecks.length).toBe(1)
  })

  // TEST 17: Source Evidence Presence & Explicit Traceability on Every Item
  it('TEST 17: every extracted candidate item must have valid sourceEvidence', async () => {
    const { extractSourceLedgerFromText } = await import('../services/reconciliation/sourceLedgerExtractor.js')
    const fs = await import('fs')
    const path = await import('path')

    const meetingFilePath = path.resolve(__dirname, '../../../test_doc/1_first_meeting.md')
    const meetingContent = fs.readFileSync(meetingFilePath, 'utf-8')

    const ledger = extractSourceLedgerFromText(meetingContent, dummyMembers)

    expect(ledger.candidates.length).toBe(15)
    for (const cand of ledger.candidates) {
      expect(cand.proposalItemId).toBeDefined()
      expect(cand.sourceEvidence).toBeDefined()
      expect(cand.sourceEvidence?.sourceType).toBe('explicit')
      expect(cand.sourceEvidence?.excerpt).toBeDefined()
    }
  })

  // TEST 18: End-to-End executeReconciliationPipeline from 1_first_meeting.md
  it('TEST 18: executeReconciliationPipeline must produce exactly 15 creates with zero inflation and valid UAT topology', async () => {
    const { executeReconciliationPipeline } = await import('../services/reconciliation/proposalPipeline.js')
    const fs = await import('fs')
    const path = await import('path')

    const meetingFilePath = path.resolve(__dirname, '../../../test_doc/1_first_meeting.md')
    const meetingContent = fs.readFileSync(meetingFilePath, 'utf-8')

    const proposal = executeReconciliationPipeline({
      text: meetingContent,
      existingItems: [],
      members: dummyMembers,
      currentProject: { project_uid: 'prj-1', project_name: 'SBG' }
    })

    expect(proposal.validation.status).toBe('PASS')
    expect(proposal.creates.length).toBe(15)
    expect(proposal.coverage.extracted).toBe(15)
    expect(proposal.coverage.processed).toBe(15)

    // Check UAT-01 and UAT-02 parent-child relationships
    const relUat01 = proposal.relationships.find(r => r.childRef.includes('UAT-01') && r.relationshipType === 'parent_child')
    expect(relUat01).toBeDefined()
    expect(relUat01?.parentRef).toMatch(/verify|核驗|雙模態/)

    const relUat02 = proposal.relationships.find(r => r.childRef.includes('UAT-02') && r.relationshipType === 'parent_child')
    expect(relUat02).toBeDefined()
    expect(relUat02?.parentRef).toMatch(/WebSocket|MQTT|硬件|協議/)

    // Check Meeting discusses relations
    const discussesRels = proposal.relationships.filter(r => r.relationshipType === 'discusses')
    expect(discussesRels.length).toBe(14) // 1 meeting discusses all 14 other items
  })
})

