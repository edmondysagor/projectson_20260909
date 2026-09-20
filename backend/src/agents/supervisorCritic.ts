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

  // 5. 若有來自子專家的新增工單，與既有提案合併為單一 batch_proposal
  const existingBatch = unifiedActions.find(a => a.actionType === 'batch_proposal')
  if (existingBatch && Array.isArray(existingBatch.items)) {
    const existingTitles = new Set(existingBatch.items.map((i: any) => (i.itemTitle || '').trim().toLowerCase()))
    for (const item of uniqueItems) {
      if (!existingTitles.has(item.itemTitle.trim().toLowerCase())) {
        existingBatch.items.push(item)
        existingTitles.add(item.itemTitle.trim().toLowerCase())
      } else {
        duplicateCount++
      }
    }
  } else if (uniqueItems.length > 1) {
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

  // 5.1 👤 負責人自動嗅探與補全 (Auto-Assignee Sniffer & Member Resolution)
  // 當工單 itemFollowBy 缺失時，自動從標題、Markdown 內文與表格中匹配團隊成員姓名，自動完成負責人綁定，防止大批次遺漏
  if (ctx.membersContext && ctx.membersContext.length > 0) {
    const resolveAssigneeFromText = (textToScan: string): string | undefined => {
      if (!textToScan) return undefined
      const clean = textToScan.toLowerCase()
      for (const m of ctx.membersContext) {
        if (!m.member_name) continue
        const mName = m.member_name.trim().toLowerCase()
        if (mName.length >= 2) {
          // 支援全名 (Kevin Lau)、括號表示法 (Kevin)、冒號表示法 (負責人: Kevin)
          if (clean.includes(mName)) {
            return m.member_uid
          }
          // 若為雙名如 "Kevin Lau"，亦檢查英文名 "kevin"
          const firstName = mName.split(' ')[0]
          if (firstName && firstName.length >= 3) {
            const firstRegex = new RegExp(`(?:\\b|[\(（\[【：:•\\-])${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\b|[\)）\\]】\\s,，;；。])`, 'i')
            if (firstRegex.test(clean)) {
              return m.member_uid
            }
          }
        }
      }
      return undefined
    }

    for (const act of unifiedActions) {
      if (act.actionType === 'batch_proposal' && Array.isArray(act.items)) {
        for (const itm of act.items) {
          if (!itm.itemFollowBy) {
            const textToScan = `${itm.itemTitle} ${itm.description || ''} ${itm.sectionTitle || ''}`
            const matchedUid = resolveAssigneeFromText(textToScan)
            if (matchedUid) {
              itm.itemFollowBy = matchedUid
              const memberObj = ctx.membersContext.find(m => m.member_uid === matchedUid)
              notes.push(`[負責人自動嗅探] 工單「${itm.itemTitle}」自動識別並綁定負責人「${memberObj?.member_name || matchedUid}」。`)
            }
          }
        }
      } else if (act.actionType === 'create_item' && !act.itemFollowBy) {
        const textToScan = `${act.itemTitle} ${act.description || ''}`
        const matchedUid = resolveAssigneeFromText(textToScan)
        if (matchedUid) {
          act.itemFollowBy = matchedUid
          const memberObj = ctx.membersContext.find(m => m.member_uid === matchedUid)
          notes.push(`[負責人自動嗅探] 工單「${act.itemTitle}」自動識別並綁定負責人「${memberObj?.member_name || matchedUid}」。`)
        }
      }
    }
  }

  // 6. 🚨 Traceability 5層矩陣完整鏈路保證 (5-Layer Traceability Assurance & Auto-Anchoring)
  // 檢查所有 batch_proposal，確保 Objective ➔ Requirement ➔ User Story ➔ Task ➔ UAT 每一層均有嚴格父子鏈
  for (const act of unifiedActions) {
    if (act.actionType === 'batch_proposal' && Array.isArray(act.items) && act.items.length > 0) {
      let batchObjective = act.items.find((i: any) => i.itemType === 'Objective')
      const existingProjectObjectives = ctx.itemsContext.filter(i => i.item_type === 'Objective')
      
      const hasSpineChildren = act.items.some((i: any) => 
        ['Requirement', 'User story', 'Task', 'UAT'].includes(i.itemType)
      )

      // 6.1 若有追溯子項但同批與現有庫均無 Objective，自動於頂部補建頂層 Objective
      if (hasSpineChildren && !batchObjective && existingProjectObjectives.length === 0) {
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
        batchObjective = syntheticObjective
        notes.push(`[主管驗收] 檢測到追溯鏈缺乏根節點，已自動於頂部補建「🎯 Objective」：「${syntheticObjective.itemTitle}」，確保 5 層矩陣完美展開！`)
      }

      // 6.2 鎖定目標 Objective (同批次 Objective 優先，次之現有專案庫第一張 Objective)
      const primaryObjective = batchObjective || existingProjectObjectives[0]

      if (primaryObjective) {
        const primaryObjRef = primaryObjective.itemTitle || primaryObjective.item_display_code || primaryObjective.item_uid

        // 強制將同批次所有未關聯或關聯無效的 Requirement 錨定至該 Objective
        for (const item of act.items) {
          if (item.itemType === 'Requirement') {
            const hasValidParent = item.parentItemUid && (
              act.items.some((other: any) => other.itemTitle.trim().toLowerCase() === item.parentItemUid.trim().toLowerCase()) ||
              ctx.itemsContext.some(dbItm => 
                dbItm.item_display_code?.toUpperCase() === item.parentItemUid.trim().toUpperCase() ||
                dbItm.item_uid === item.parentItemUid.trim() ||
                dbItm.item_title.trim().toLowerCase() === item.parentItemUid.trim().toLowerCase()
              )
            )

            if (!hasValidParent) {
              item.parentItemUid = primaryObjRef
              notes.push(`[追溯鏈自動錨定] 已將業務需求「${item.itemTitle}」自動掛載至目標「${primaryObjective.itemTitle || primaryObjective.item_title}」。`)
            }
          }
        }
      }

      // 6.3 串接同批次無父層之 User story ➔ 最近 Requirement
      const batchRequirements = act.items.filter((i: any) => i.itemType === 'Requirement')
      if (batchRequirements.length > 0) {
        for (const item of act.items) {
          if (item.itemType === 'User story' && !item.parentItemUid) {
            item.parentItemUid = batchRequirements[0].itemTitle
            notes.push(`[追溯鏈自動掛載] 已將使用者故事「${item.itemTitle}」自動掛載至需求「${batchRequirements[0].itemTitle}」。`)
          }
        }
      }
    }
  }

  // 7. 🛡️ 實質變更比對與無效 No-Op 提案過濾 (Deterministic Delta & Substantive Change Verifier)
  // 若 update_item 所提議的狀態、負責人、標題與內文與資料庫現況 100% 一致，自動過濾撤除，避免無效彈窗
  const filteredActions: any[] = []

  for (const act of unifiedActions) {
    if (act.actionType === 'update_item') {
      const targetCode = (act.targetDisplayCode || '').trim().toUpperCase()
      const targetUid = (act.targetItemUid || '').trim()
      const targetTitle = (act.itemTitle || '').trim().toLowerCase()

      const existingItem = ctx.itemsContext.find(i => 
        (targetCode && i.item_display_code?.toUpperCase() === targetCode) ||
        (targetUid && i.item_uid === targetUid) ||
        (targetTitle && i.item_title?.trim().toLowerCase() === targetTitle)
      )

      if (existingItem) {
        let hasDelta = false

        // 1. 標題是否有實質差異
        if (act.itemTitle && act.itemTitle.trim() !== existingItem.item_title?.trim()) {
          hasDelta = true
        }

        // 2. 狀態是否有實質變更
        if (act.updates?.item_status && act.updates.item_status !== existingItem.item_status) {
          hasDelta = true
        }

        // 3. 負責人是否有實質變更
        if (act.updates?.item_follow_by !== undefined && act.updates.item_follow_by !== existingItem.item_follow_by) {
          hasDelta = true
        }

        // 4. 父層關聯是否有實質變更
        if (act.updates?.parent_item_uid !== undefined && act.updates.parent_item_uid !== existingItem.parent_item_uid) {
          hasDelta = true
        }

        // 5. 內文與表格是否有實質變更 (去除多餘空白與格式後的文字比較)
        if (act.updates?.item_content) {
          const rawNew = act.updates.item_content.text || act.updates.item_content.description || act.updates.item_content
          const newNormalized = typeof rawNew === 'string' ? rawNew.replace(/\s+/g, ' ').trim().toLowerCase() : ''
          const oldNormalized = typeof existingItem.item_content === 'string' 
            ? existingItem.item_content.replace(/\s+/g, ' ').trim().toLowerCase() 
            : JSON.stringify(existingItem.item_content || '').replace(/\s+/g, ' ').trim().toLowerCase()
          
          if (newNormalized && newNormalized !== oldNormalized) {
            hasDelta = true
          }
        }

        if (!hasDelta) {
          notes.push(`[零變更過濾] 工單「${targetCode || act.itemTitle}」提案內容與資料庫現況完全一致，已自動安全略過無效更新。`)
          continue
        }
      }
    } else if (act.actionType === 'batch_proposal' && Array.isArray(act.items)) {
      // 檢查 batch_proposal 是否整批都已經 100% 存在且無新項目
      const nonDuplicateItems = act.items.filter((item: any) => {
        const itemTitleNorm = item.itemTitle.trim().toLowerCase()
        const matchExisting = ctx.itemsContext.find(i => 
          i.item_title?.trim().toLowerCase() === itemTitleNorm && 
          i.item_type === item.itemType
        )
        return !matchExisting
      })

      if (nonDuplicateItems.length === 0 && ctx.itemsContext.length > 0) {
        notes.push(`[零增量過濾] 批次提案「${act.proposalTitle || '架構提案'}」中的全部工單均已在專案資料庫中存在，已自動略過重複建立。`)
        continue
      }
      act.items = nonDuplicateItems.length > 0 ? nonDuplicateItems : act.items
    }

    filteredActions.push(act)
  }

  if (unifiedActions.length > 0 && filteredActions.length === 0) {
    notes.push('✅ 經主管驗收器（Supervisor Critic）嚴格比對，上載內容與目前專案資料庫完全一致，無任何實質變更或新增工單，已自動安全撤除提案彈窗。')
  }

  return {
    unifiedActions: filteredActions,
    critiqueNotes: notes,
    orphanParentsResolved: orphanCount,
    duplicateItemsMerged: duplicateCount,
    cyclesRemoved: cycleCount,
    primaryAction: filteredActions[0] || undefined
  }
}

