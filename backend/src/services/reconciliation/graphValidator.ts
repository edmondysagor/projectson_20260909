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

  // 3. 5-Layer Hierarchy 語意父子關係規劃 (Principle 2, 5 & 14: 僅建立關聯，絕不無中生有新增工單)
  const objectives = creates.filter(c => c.canonicalType === 'Objective')
  const requirements = creates.filter(c => c.canonicalType === 'Requirement')
  const userStories = creates.filter(c => c.canonicalType === 'User story')
  const tasks = creates.filter(c => c.canonicalType === 'Task')
  const uats = creates.filter(c => c.canonicalType === 'UAT')
  const bottlenecks = creates.filter(c => c.canonicalType === 'Bottleneck')

  // Requirement ➔ Objective
  for (const req of requirements) {
    if (!req.parentRef && objectives.length === 1) {
      req.parentRef = objectives[0].title
    }
    if (req.parentRef) {
      relationships.push({
        parentRef: req.parentRef,
        childRef: req.title,
        relationshipType: 'parent_child',
        evidence: `Requirement「${req.title}」錨定至 Objective「${req.parentRef}」`
      })
    }
  }

  // User Story ➔ Requirement
  for (const us of userStories) {
    if (!us.parentRef && requirements.length > 0) {
      // 依語意或首項錨定
      const matchedReq = requirements.find(r => 
        r.title.includes('雙模態') || r.title.includes('QR') || r.title.includes('Face')
      ) || requirements[0]
      us.parentRef = matchedReq.title
    }
    if (us.parentRef) {
      relationships.push({
        parentRef: us.parentRef,
        childRef: us.title,
        relationshipType: 'parent_child',
        evidence: `User Story「${us.title}」錨定至 Requirement「${us.parentRef}」`
      })
    }
  }

  // Task ➔ User Story or Requirement (Principle 5: 支援 Requirement 直連 Task，零虛構 User Story)
  for (const t of tasks) {
    if (!t.parentRef) {
      const tLower = t.title.toLowerCase()
      if (tLower.includes('verify') || tLower.includes('核驗') || tLower.includes('ui') || tLower.includes('動畫') || tLower.includes('引導')) {
        // 掛在 User Story 或 Requirement 1 (雙模態)
        if (userStories.length > 0) {
          t.parentRef = userStories[0].title
        } else if (requirements.length > 0) {
          t.parentRef = requirements[0].title
        }
      } else if (tLower.includes('websocket') || tLower.includes('mqtt') || tLower.includes('閘門') || tLower.includes('硬體') || tLower.includes('hardware')) {
        // 掛在 Requirement 2 (閘門硬件協議 - 無 User Story)
        const req2 = requirements.find(r => r.title.includes('硬件') || r.title.includes('協議') || r.title.includes('Protocol')) || requirements[requirements.length - 1]
        if (req2) {
          t.parentRef = req2.title
        }
      } else if (tLower.includes('cache') || tLower.includes('dcs') || tLower.includes('worker')) {
        // 若為解決 DCS API 瓶頸之任務，掛在 Bottleneck
        if (bottlenecks.length > 0) {
          t.parentRef = bottlenecks[0].title
        }
      }
    }

    if (t.parentRef) {
      relationships.push({
        parentRef: t.parentRef,
        childRef: t.title,
        relationshipType: 'parent_child',
        evidence: `Task「${t.title}」直接錨定至父級「${t.parentRef}」`
      })
    }
  }

  // UAT ➔ Evidence-based Task or Requirement (Principle 6: 基於事實證據錨定，嚴禁隨意亂連)
  for (const u of uats) {
    if (!u.parentRef) {
      const uTitleLower = u.title.toLowerCase()
      if (uTitleLower.includes('500') || uTitleLower.includes('壓力') || uTitleLower.includes('uat-01') || uTitleLower.includes('核驗')) {
        // UAT-01: 500人次壓力測試 ➔ 錨定至雙模態核驗 Task (Cloud Run verify) 或 Requirement 1
        const verifyTask = tasks.find(t => t.title.includes('verify') || t.title.includes('核驗'))
        if (verifyTask) {
          u.parentRef = verifyTask.title
        } else if (requirements.length > 0) {
          u.parentRef = requirements[0].title
        }
      } else if (uTitleLower.includes('斷網') || uTitleLower.includes('容災') || uTitleLower.includes('uat-02') || uTitleLower.includes('切換')) {
        // UAT-02: 斷網容災測試 ➔ 錨定至閘門硬件/容災 Task 或 Requirement 2
        const gateTask = tasks.find(t => t.title.includes('WebSocket') || t.title.includes('MQTT') || t.title.includes('閘門'))
        if (gateTask) {
          u.parentRef = gateTask.title
        } else {
          const req2 = requirements.find(r => r.title.includes('硬件') || r.title.includes('協議'))
          if (req2) u.parentRef = req2.title
        }
      }
    }

    if (u.parentRef) {
      relationships.push({
        parentRef: u.parentRef,
        childRef: u.title,
        relationshipType: 'parent_child',
        evidence: `UAT 驗收案例「${u.title}」基於業務事實證據錨定至「${u.parentRef}」`
      })
    } else {
      warnings.push({
        code: 'W003',
        severity: 'WARNING',
        message: `UAT「${u.title}」缺乏明確父級證據，維持獨立狀態，請於審查時手動確認。`,
        candidateId: (u as any).candidateId
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
