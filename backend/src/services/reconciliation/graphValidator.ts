import { CandidateItem, ReconciledCandidate, ValidationReport, ValidationIssue, RelationshipPlan } from './types.js'

export function validateAndPlanTopology(
  reconciled: ReconciledCandidate[],
  existingItems: any[] = []
): {
  reconciled: ReconciledCandidate[]
  relationships: RelationshipPlan[]
  validation: ValidationReport
} {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const relationships: RelationshipPlan[] = []

  const creates = reconciled.filter(r => r.action === 'CREATE').map(r => r.candidate)
  const candidateIds = new Set<string>()

  // 1. R001: 候選 ID 唯一性
  for (const r of reconciled) {
    if (candidateIds.has(r.candidateId)) {
      errors.push({ code: 'R001', severity: 'ERROR', message: `Duplicate candidateId: ${r.candidateId}`, candidateId: r.candidateId })
    }
    candidateIds.add(r.candidateId)
  }

  // 2. 建立 Meeting 的 discusses 關聯 (Solving Missing Graph Relations in Meeting Item)
  const meetingCandidates = creates.filter(c => c.canonicalType === 'Meeting')
  const nonMeetingCandidates = creates.filter(c => c.canonicalType !== 'Meeting')

  if (meetingCandidates.length > 0) {
    for (const mtg of meetingCandidates) {
      for (const item of nonMeetingCandidates) {
        relationships.push({
          parentRef: mtg.title,
          childRef: item.title,
          relationshipType: 'discusses',
          evidence: `會議「${mtg.title}」討論並建立了工單「${item.title}」。`
        })
      }
    }
  }

  // 3. 5-Layer Hierarchy 語意父子關係規劃
  const objectives = creates.filter(c => c.canonicalType === 'Objective')
  const requirements = creates.filter(c => c.canonicalType === 'Requirement')
  const userStories = creates.filter(c => c.canonicalType === 'User story')
  const tasks = creates.filter(c => c.canonicalType === 'Task')
  const uats = creates.filter(c => c.canonicalType === 'UAT')

  // Requirement ➔ Objective
  for (const req of requirements) {
    if (!req.parentRef && objectives.length > 0) {
      req.parentRef = objectives[0].title
    }
    if (req.parentRef) {
      relationships.push({
        parentRef: req.parentRef,
        childRef: req.title,
        relationshipType: 'parent_child',
        evidence: `Requirement 錨定至 Objective「${req.parentRef}」`
      })
    }
  }

  // User Story ➔ Requirement
  for (const us of userStories) {
    if (!us.parentRef && requirements.length > 0) {
      us.parentRef = requirements[0].title
    }
    if (us.parentRef) {
      relationships.push({
        parentRef: us.parentRef,
        childRef: us.title,
        relationshipType: 'parent_child',
        evidence: `User Story 錨定至 Requirement「${us.parentRef}」`
      })
    }
  }

  // Task ➔ User Story or Requirement
  for (const t of tasks) {
    if (!t.parentRef) {
      if (userStories.length > 0) {
        t.parentRef = userStories[0].title
      } else if (requirements.length > 0) {
        t.parentRef = requirements[0].title
      }
    }
    if (t.parentRef) {
      relationships.push({
        parentRef: t.parentRef,
        childRef: t.title,
        relationshipType: 'parent_child',
        evidence: `Task 錨定至「${t.parentRef}」`
      })
    }
  }

  // UAT ➔ Task
  for (const u of uats) {
    if (!u.parentRef && tasks.length > 0) {
      u.parentRef = tasks[0].title
    }
    if (u.parentRef) {
      relationships.push({
        parentRef: u.parentRef,
        childRef: u.title,
        relationshipType: 'parent_child',
        evidence: `UAT 驗收錨定至 Task「${u.parentRef}」`
      })
    }
  }

  return {
    reconciled,
    relationships,
    validation: {
      status: errors.length === 0 ? 'PASS' : 'FAIL',
      errors,
      warnings
    }
  }
}
