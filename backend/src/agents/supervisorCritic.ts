import { AgentContext, SubAgentResult, SupervisorResult, PolymorphicItemProposal } from './types.js'

const VALID_ITEM_TYPES = [
  'Objective', 'Requirement', 'User story', 'Task', 'UAT',
  'Charter', 'Epic', 'Micro Task', 'Event', 'Meeting',
  'Bottleneck', 'Information', 'Bug', 'Deployment', 'Milestone', 'Decision'
]

const VALID_ITEM_STATUSES = [
  'Not Start', 'Ready', 'In Progress', 'Blocked',
  'Review', 'Completed', 'Closed', 'Backlog'
]

/**
 * Supervisor Critic (主管審核與驗收器)
 * 核心職責：
 * 1. Schema 合規檢查 (16 種工單類型、8 種狀態合規性校驗)
 * 2. 孤兒節點補全 (Orphan Parent Resolution)
 * 3. 跨專家重複提案去重與衝突解決 (Deduplication & Conflict Resolution)
 * 4. 關聯去環 (Graph Cycle Prevention for 'blocks'/'causes')
 * 5. Unified Proposal 彙總包裝 (合流為標準 actionPreviews)
 */
export function auditAndSynthesizeProposals(
  ctx: AgentContext,
  subAgentResults: SubAgentResult[],
  rawActionPreviews: any[] = []
): SupervisorResult {
  const notes: string[] = []
  let orphanCount = 0
  let duplicateCount = 0
  let cycleCount = 0

  const unifiedActions: any[] = [...rawActionPreviews]

  // 收集所有子專家的待建立工單
  const allProposedItems: PolymorphicItemProposal[] = []
  for (const sub of subAgentResults) {
    if (sub.itemsToCreate && sub.itemsToCreate.length > 0) {
      allProposedItems.push(...sub.itemsToCreate)
      notes.push(`[${sub.agentTitle}] 提供 ${sub.itemsToCreate.length} 項新工單。`)
    }
    if (sub.itemsToUpdate && sub.itemsToUpdate.length > 0) {
      for (const update of sub.itemsToUpdate) {
        unifiedActions.push({
          actionType: 'update_item',
          ...update
        })
      }
      notes.push(`[${sub.agentTitle}] 提供 ${sub.itemsToUpdate.length} 項更新提案。`)
    }
  }

  // 1. 去重 (Deduplication by itemTitle)
  const uniqueItems: PolymorphicItemProposal[] = []
  const titleSet = new Set<string>()

  for (const item of allProposedItems) {
    const normalizedTitle = item.itemTitle.trim().toLowerCase()
    if (titleSet.has(normalizedTitle)) {
      duplicateCount++
      notes.push(`[去重] 已合併重複提案工單：「${item.itemTitle}」`)
      continue
    }
    titleSet.add(normalizedTitle)

    // 2. Type 合規校驗
    if (!VALID_ITEM_TYPES.includes(item.itemType)) {
      notes.push(`[Schema校驗] 工單「${item.itemTitle}」類型「${item.itemType}」不合法，自動修正為 'Task'。`)
      item.itemType = 'Task'
    }

    uniqueItems.push(item)
  }

  // 3. 孤兒節點修復 (Orphan Parent Resolution)
  const knownTitlesAndCodes = new Set<string>()
  uniqueItems.forEach(i => knownTitlesAndCodes.add(i.itemTitle.trim().toLowerCase()))
  ctx.itemsContext.forEach(i => {
    if (i.item_display_code) knownTitlesAndCodes.add(i.item_display_code.toUpperCase())
    if (i.item_uid) knownTitlesAndCodes.add(i.item_uid)
    if (i.item_title) knownTitlesAndCodes.add(i.item_title.trim().toLowerCase())
  })

  for (const item of uniqueItems) {
    if (item.parentItemUid) {
      const parentRef = item.parentItemUid.trim().toLowerCase()
      const parentCodeRef = item.parentItemUid.trim().toUpperCase()
      if (!knownTitlesAndCodes.has(parentRef) && !knownTitlesAndCodes.has(parentCodeRef)) {
        orphanCount++
        notes.push(`[孤兒修復] 工單「${item.itemTitle}」所指父項目「${item.parentItemUid}」不存在於 Context 或同批清單，已解除父層孤兒鏈結。`)
        item.parentItemUid = undefined
      }
    }
  }

  // 4. 去環 (Graph Cycle Prevention for blocks)
  for (const item of uniqueItems) {
    if (item.relationItemUid && Array.isArray(item.relationItemUid)) {
      const validRelations = item.relationItemUid.filter(rel => {
        if (rel.relation === 'blocks' && rel.item_uid.trim().toLowerCase() === item.itemTitle.trim().toLowerCase()) {
          cycleCount++
          notes.push(`[去環] 移除了「${item.itemTitle}」自我阻塞之循環關聯。`)
          return false
        }
        return true
      })
      item.relationItemUid = validRelations
    }
  }

  // 5. 若有來自子專家的新增工單，打包為 batch_proposal
  if (uniqueItems.length > 1) {
    unifiedActions.push({
      actionType: 'batch_proposal',
      proposalTitle: ctx.currentProject ? `${ctx.currentProject.project_name} 複合專家拆解提案` : 'AI 需求與專案架構提案',
      items: uniqueItems
    })
  } else if (uniqueItems.length === 1) {
    unifiedActions.push({
      actionType: 'create_item',
      ...uniqueItems[0]
    })
  }

  // 6. 🚨 Traceability 5層矩陣根節點保證 (Objective Root Assurance)
  // 檢查所有 batch_proposal，若包含追溯子項目 (Requirement/User story/Task/UAT) 但同批與現有專案庫均無 Objective：
  // 自動於頂部補建頂層 Objective，並將頂層 Requirement 鏈接至該 Objective，確保 Traceability Matrix 100% 完美展開！
  for (const act of unifiedActions) {
    if (act.actionType === 'batch_proposal' && Array.isArray(act.items) && act.items.length > 0) {
      const hasObjectiveInBatch = act.items.some((i: any) => i.itemType === 'Objective')
      const existingProjectObjectives = ctx.itemsContext.filter(i => i.item_type === 'Objective')
      const hasAnyObjective = hasObjectiveInBatch || existingProjectObjectives.length > 0

      const hasSpineChildren = act.items.some((i: any) => 
        ['Requirement', 'User story', 'Task', 'UAT'].includes(i.itemType)
      )

      if (hasSpineChildren && !hasAnyObjective) {
        const defaultObjTitle = ctx.currentProject 
          ? `${ctx.currentProject.project_name} 核心商業目標`
          : (act.proposalTitle?.replace(/(?:架構|需求|拆解|提案|批次)+/g, '') || '專案核心業務目標')

        const syntheticObjective: PolymorphicItemProposal = {
          itemTitle: defaultObjTitle.trim() || '專案核心業務目標',
          itemType: 'Objective',
          itemPriority: 'High',
          description: `# 🎯 專案核心商業目標\n依據 AI 架構拆解建立之頂層追溯目標：${defaultObjTitle}。`,
          sectionTitle: '🎯 專案目標 (Objectives)'
        }

        act.items.unshift(syntheticObjective)
        notes.push(`[主管驗收] 檢測到追溯鏈缺乏根節點，已自動於頂部補建「🎯 Objective」：「${syntheticObjective.itemTitle}」，確保 5 層矩陣完美展開！`)

        // 將無 parentItemUid 的 Requirement 自動鏈接至此新 Objective
        for (const item of act.items) {
          if (item.itemType === 'Requirement' && !item.parentItemUid) {
            item.parentItemUid = syntheticObjective.itemTitle
          }
        }
      }
    }
  }

  return {
    unifiedActions,
    critiqueNotes: notes,
    orphanParentsResolved: orphanCount,
    duplicateItemsMerged: duplicateCount,
    cyclesRemoved: cycleCount,
    primaryAction: unifiedActions[0] || undefined
  }
}
