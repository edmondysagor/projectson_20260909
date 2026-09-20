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
 * 清理標題：移除 Markdown 粗體、行內符號與冗餘類型前綴
 */
function cleanItemTitle(raw: string): string {
  if (!raw) return ''
  let cleaned = raw.trim()
  // 剝離開頭結尾各種 markdown 裝飾 (**, ``, __, #)
  cleaned = cleaned.replace(/^[*`_~#\s]+|[*`_~#\s]+$/g, '').trim()
  // 剝離類型前綴，如 Objective:, **Objective**:, Objective**:, [Requirement] 等
  cleaned = cleaned.replace(/^(?:\[|\()?[\*`_~#\s]*(?:objective|requirement|user\s*story|story|task|uat|bug|decision|bottleneck|meeting|milestone|charter|epic|micro\s*task)[\*`_~#\s]*(?:\]|\))?\s*[:：\s-]+/i, '')
  cleaned = cleaned.replace(/^[*`_~#\s]+|[*`_~#\s]+$/g, '').trim()
  cleaned = cleaned.replace(/[。；;]+$/, '').trim()
  return cleaned
}

/**
 * 判定是否為 AI 產生的對話分析中繼文本或偽工單
 */
function isJunkConversationalItem(title: string): boolean {
  if (!title || title.trim().length < 2) return true
  const lower = title.toLowerCase().trim()
  const junkPatterns = [
    /^(?:上載文件|上傳文件|現有專案狀態|現有項目狀態|增量分析|結論|判定為|分析總結|架構追溯鏈|執行計劃|思考過程|注意事項|前置作業|場景\s*\d|說明|背景|現狀)/i,
    /^鏈路\s*[a-z0-9]/i,
    /^\*\*上載文件/i,
    /^\*\*現有專案狀態/i,
    /^\*\*增量分析/i,
    /^\*\*結論/i,
    /^\*\*鏈路/i,
    /^(?:拆分為|針對.+建立|拆解為後端|建立壓力測試|拆解為|依據.+建立之)/i
  ]
  return junkPatterns.some(p => p.test(lower))
}

/**
 * Supervisor Critic (主管審核與驗收器)
 * 核心職責：
 * 1. 對話廢料與偽工單清洗 (Conversational Preamble & Junk Filtering)
 * 2. 標題與類型 Schema 合規校驗 (Schema Validation & Markdown Sanitization)
 * 3. 5 層矩陣拓撲鏈路全自動鎖定 (5-Layer Cascading Topology Lock: Objective ➔ Requirement ➔ Story ➔ Task ➔ UAT)
 * 4. 會議工單智能聚合 (Meeting Consolidation: 杜絕多張碎片化會議單)
 * 5. 跨專家重複提案去重與衝突解決 (Deduplication & Conflict Resolution)
 * 6. 負責人自動嗅探與補全 (Auto-Assignee Sniffer)
 * 7. 關聯去環與無效 No-Op 提案物理過濾 (Graph Cycle Prevention & Delta Verifier)
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

  const unifiedActions: any[] = []

  // 0. 識別專案是否已存在唯一的 Charter
  const existingProjectCharter = (ctx.itemsContext || []).find(i => 
    i.item_type === 'Charter' || 
    /charter|專案章程/i.test(i.item_title || '')
  )

  // 1. 處理並清洗 rawActionPreviews
  for (const act of rawActionPreviews) {
    if (act.actionType === 'batch_proposal' && Array.isArray(act.items)) {
      const validBatchItems = act.items
        .filter((i: any) => {
          if (isJunkConversationalItem(i.itemTitle)) return false
          // 若專案已有 Charter，嚴禁在批次中新建 Charter
          if (existingProjectCharter && (i.itemType === 'Charter' || /charter|專案章程/i.test(i.itemTitle))) {
            return false
          }
          return true
        })
        .map((i: any) => ({
          ...i,
          itemTitle: cleanItemTitle(i.itemTitle),
          parentItemUid: i.parentItemUid ? cleanItemTitle(i.parentItemUid) : undefined
        }))
      if (validBatchItems.length > 0) {
        unifiedActions.push({
          ...act,
          items: validBatchItems
        })
      }
    } else if (act.actionType === 'create_item') {
      if (!isJunkConversationalItem(act.itemTitle)) {
        if (existingProjectCharter && (act.itemType === 'Charter' || /charter|專案章程/i.test(act.itemTitle))) {
          // 轉為更新既有 Charter
          notes.push(`[單一章程硬鎖定] 專案已存在章程 [${existingProjectCharter.item_display_code || existingProjectCharter.item_uid}]，已物理阻斷新建章程工單。`)
        } else {
          unifiedActions.push({
            ...act,
            itemTitle: cleanItemTitle(act.itemTitle),
            parentItemUid: act.parentItemUid ? cleanItemTitle(act.parentItemUid) : undefined
          })
        }
      }
    } else {
      unifiedActions.push(act)
    }
  }

  // 2. 收集並清洗所有子專家的待建立與待更新工單
  const allProposedItems: PolymorphicItemProposal[] = []
  let bestProposedCharterContent = ''

  for (const sub of subAgentResults) {
    if (sub.itemsToCreate && sub.itemsToCreate.length > 0) {
      for (const item of sub.itemsToCreate) {
        if (isJunkConversationalItem(item.itemTitle)) {
          notes.push(`[過濾廢料] 已自動移除對話分析廢料工單：「${item.itemTitle}」`)
          continue
        }
        // 若已有 Charter，物理阻斷任何子專家新建 Charter，並收集其內容
        if (existingProjectCharter && (item.itemType === 'Charter' || /charter|專案章程/i.test(item.itemTitle))) {
          if (item.description && item.description.length > bestProposedCharterContent.length && !item.description.includes('詳見')) {
            bestProposedCharterContent = item.description
          }
          continue
        }
        allProposedItems.push({
          ...item,
          itemTitle: cleanItemTitle(item.itemTitle),
          parentItemUid: item.parentItemUid ? cleanItemTitle(item.parentItemUid) : undefined
        })
      }
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

  // 3. 去重 (Deduplication by itemTitle)
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

    // Type 合規校驗
    if (!VALID_ITEM_TYPES.includes(item.itemType)) {
      notes.push(`[Schema校驗] 工單「${item.itemTitle}」類型「${item.itemType}」不合法，自動修正為 'Task'。`)
      item.itemType = 'Task'
    }

    uniqueItems.push(item)
  }

  // 4. 與既有 batch_proposal 合流
  const existingBatch = unifiedActions.find(a => a.actionType === 'batch_proposal')
  if (existingBatch && Array.isArray(existingBatch.items)) {
    const existingTitles = new Set(existingBatch.items.map((i: any) => (i.itemTitle || '').trim().toLowerCase()))
    for (const item of uniqueItems) {
      const itemTitleNorm = item.itemTitle.trim().toLowerCase()
      if (!existingTitles.has(itemTitleNorm)) {
        existingBatch.items.push(item)
        existingTitles.add(itemTitleNorm)
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

  // 4.1 Update Actions 嚴格去重與合併 (Update Dedup & Merge)
  const dedupedUpdates: any[] = []
  const seenUpdateKeys = new Set<string>()
  for (let i = unifiedActions.length - 1; i >= 0; i--) {
    const act = unifiedActions[i]
    if (act.actionType === 'update_item') {
      const key = (act.targetItemUid || act.targetDisplayCode || act.itemTitle || '').toLowerCase().trim()
      if (seenUpdateKeys.has(key)) {
        // 合併更新屬性
        const existing = dedupedUpdates.find(u => (u.targetItemUid || u.targetDisplayCode || u.itemTitle || '').toLowerCase().trim() === key)
        if (existing) {
          existing.updates = { ...existing.updates, ...act.updates }
          if (act.updates?.item_content && (!existing.updates?.item_content || JSON.stringify(act.updates.item_content).length > JSON.stringify(existing.updates.item_content).length)) {
            existing.updates.item_content = act.updates.item_content
          }
        }
        unifiedActions.splice(i, 1)
        continue
      }
      seenUpdateKeys.add(key)
      dedupedUpdates.unshift(act)
    }
  }

  // 4.2 若有現有 Charter 且收集到了更佳的章程內容但尚無 Update Action，自動補上 Update
  if (existingProjectCharter && bestProposedCharterContent) {
    const charterUpdateKey = (existingProjectCharter.item_uid || existingProjectCharter.item_display_code || '').toLowerCase()
    const existingUpdate = dedupedUpdates.find(u => (u.targetItemUid || u.targetDisplayCode || '').toLowerCase() === charterUpdateKey)
    if (!existingUpdate) {
      unifiedActions.unshift({
        actionType: 'update_item',
        targetDisplayCode: existingProjectCharter.item_display_code,
        targetItemUid: existingProjectCharter.item_uid,
        itemTitle: existingProjectCharter.item_title,
        updates: {
          item_content: {
            text: bestProposedCharterContent,
            description: bestProposedCharterContent
          }
        },
        summary: '依據上載文件內容填寫專案章程'
      })
    }
  }

  // 5. 👤 負責人自動嗅探與補全 (Auto-Assignee Sniffer & Member Resolution)
  if (ctx.membersContext && ctx.membersContext.length > 0) {
    const resolveAssigneeFromText = (textToScan: string): string | undefined => {
      if (!textToScan) return undefined
      const clean = textToScan.toLowerCase()
      for (const m of ctx.membersContext) {
        if (!m.member_name) continue
        const mName = m.member_name.trim().toLowerCase()
        if (mName.length >= 2) {
          if (clean.includes(mName)) {
            return m.member_uid
          }
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

  // 6. 🚨 5 層矩陣拓撲全自動鎖定與修復 (5-Layer Cascading Topology Lock)
  for (const act of unifiedActions) {
    if (act.actionType === 'batch_proposal' && Array.isArray(act.items) && act.items.length > 0) {
      // 6.0 聚合多餘的碎片化 Meeting 工單，確保 1 次 Recap 只保留 1 張核心 Meeting 單
      const meetingItems = act.items.filter((i: any) => i.itemType === 'Meeting')
      if (meetingItems.length > 1) {
        // 保留最完整的一張 Meeting 單，並將其餘 Meeting 的內容融合
        const primaryMeeting = meetingItems[0]
        const mergedDescParts = meetingItems.map((m: any) => m.description).filter(Boolean)
        primaryMeeting.description = mergedDescParts.join('\n\n---\n\n')
        act.items = act.items.filter((i: any) => i.itemType !== 'Meeting' || i === primaryMeeting)
        notes.push(`[會議聚合] 檢測到 ${meetingItems.length} 張重複會議工單，已自動融合成 1 張完整會議紀要工單。`)
      }

      // 6.0.1 聚合多餘的 Charter 工單，確保 1 個專案批次只保留 1 張核心 Project Charter
      const charterItems = act.items.filter((i: any) => i.itemType === 'Charter' || /charter|專案章程/i.test(i.itemTitle))
      if (existingProjectCharter) {
        // 專案已有 Charter！絕對不允許在批次中新增任何 Charter 工單！
        if (charterItems.length > 0) {
          act.items = act.items.filter((i: any) => i.itemType !== 'Charter' && !/charter|專案章程/i.test(i.itemTitle))
          notes.push(`[單一章程硬鎖定] 專案已存在章程 [${existingProjectCharter.item_display_code || existingProjectCharter.item_uid}]，已物理剔除批次中所有新建章程。`)
        }
      } else if (charterItems.length > 1) {
        const primaryCharter = charterItems.find((c: any) => c.itemTitle.includes('專案章程') || c.itemTitle.includes('Project Charter')) || charterItems[0]
        let longestDesc = primaryCharter.description || ''
        for (const c of charterItems) {
          if ((c.description || '').length > longestDesc.length) {
            longestDesc = c.description
          }
        }
        primaryCharter.description = longestDesc
        primaryCharter.itemType = 'Charter'
        primaryCharter.itemTitle = ctx.currentProject ? `${ctx.currentProject.project_name} 專案章程` : '專案章程 (Project Charter)'
        act.items = act.items.filter((i: any) => (i.itemType !== 'Charter' && !/charter|專案章程/i.test(i.itemTitle)) || i === primaryCharter)
        notes.push(`[章程聚合] 檢測到 ${charterItems.length} 項重複章程工單，已自動融合成 1 張唯一專案章程。`)
      }

      // 6.1 尋找或合成 Objective
      const batchObjectives = act.items.filter((i: any) => i.itemType === 'Objective')
      const existingProjectObjectives = ctx.itemsContext.filter(i => i.item_type === 'Objective')
      const hasSpineChildren = act.items.some((i: any) => 
        ['Requirement', 'User story', 'Task', 'UAT'].includes(i.itemType)
      )

      let primaryObjective = batchObjectives[0] || existingProjectObjectives[0]

      if (hasSpineChildren && !primaryObjective) {
        const defaultObjTitle = ctx.currentProject 
          ? `${ctx.currentProject.project_name} 核心商業目標`
          : (act.proposalTitle?.replace(/(?:架構|需求|拆解|提案|批次)+/g, '') || '專案核心業務目標')

        const syntheticObjective: PolymorphicItemProposal = {
          itemTitle: cleanItemTitle(defaultObjTitle.trim() || '專案核心業務目標'),
          itemType: 'Objective',
          itemPriority: 'High',
          description: `# 🎯 專案核心商業目標\n依據 AI 架構拆解建立之頂層追溯目標：${defaultObjTitle}。`,
          sectionTitle: '🎯 專案目標 (Objectives)'
        }

        act.items.unshift(syntheticObjective)
        primaryObjective = syntheticObjective
        notes.push(`[主管驗收] 自動於頂部補建根節點「🎯 Objective」：「${syntheticObjective.itemTitle}」，確保 5 層矩陣完美展開！`)
      }

      const primaryObjTitle = primaryObjective ? (primaryObjective.itemTitle || primaryObjective.item_title) : undefined

      // 6.2 強制所有 Requirement 錨定至 Objective
      if (primaryObjTitle) {
        for (const item of act.items) {
          if (item.itemType === 'Requirement') {
            const hasValidParentObj = item.parentItemUid && (
              batchObjectives.some((obj: any) => obj.itemTitle.trim().toLowerCase() === item.parentItemUid.trim().toLowerCase()) ||
              existingProjectObjectives.some(dbObj => 
                dbObj.item_display_code?.toUpperCase() === item.parentItemUid.trim().toUpperCase() ||
                dbObj.item_uid === item.parentItemUid.trim() ||
                dbObj.item_title.trim().toLowerCase() === item.parentItemUid.trim().toLowerCase()
              )
            )

            if (!hasValidParentObj) {
              item.parentItemUid = primaryObjTitle
              notes.push(`[追溯鏈強制錨定] 已將業務需求「${item.itemTitle}」強制掛載至商業目標「${primaryObjTitle}」。`)
            }
          }
        }
      }

      // 6.3 串接同批次 User story ➔ Requirement
      const batchRequirements = act.items.filter((i: any) => i.itemType === 'Requirement')
      if (batchRequirements.length > 0) {
        for (const item of act.items) {
          if (item.itemType === 'User story') {
            const hasValidReqParent = item.parentItemUid && (
              batchRequirements.some((r: any) => r.itemTitle.trim().toLowerCase() === item.parentItemUid.trim().toLowerCase()) ||
              ctx.itemsContext.some(dbItm => 
                dbItm.item_type === 'Requirement' && (
                  dbItm.item_display_code?.toUpperCase() === item.parentItemUid.trim().toUpperCase() ||
                  dbItm.item_uid === item.parentItemUid.trim() ||
                  dbItm.item_title.trim().toLowerCase() === item.parentItemUid.trim().toLowerCase()
                )
              )
            )

            if (!hasValidReqParent) {
              item.parentItemUid = batchRequirements[0].itemTitle
              notes.push(`[追溯鏈自動掛載] 已將使用者故事「${item.itemTitle}」自動掛載至需求「${batchRequirements[0].itemTitle}」。`)
            }
          }
        }
      }

      // 6.4 串接同批次 Task ➔ User story
      const batchUserStories = act.items.filter((i: any) => i.itemType === 'User story')
      if (batchUserStories.length > 0) {
        for (const item of act.items) {
          if (item.itemType === 'Task') {
            const hasValidStoryParent = item.parentItemUid && (
              batchUserStories.some((s: any) => s.itemTitle.trim().toLowerCase() === item.parentItemUid.trim().toLowerCase()) ||
              batchRequirements.some((r: any) => r.itemTitle.trim().toLowerCase() === item.parentItemUid.trim().toLowerCase()) ||
              ctx.itemsContext.some(dbItm => 
                ['User story', 'Requirement'].includes(dbItm.item_type) && (
                  dbItm.item_display_code?.toUpperCase() === item.parentItemUid.trim().toUpperCase() ||
                  dbItm.item_uid === item.parentItemUid.trim() ||
                  dbItm.item_title.trim().toLowerCase() === item.parentItemUid.trim().toLowerCase()
                )
              )
            )

            if (!hasValidStoryParent) {
              item.parentItemUid = batchUserStories[0].itemTitle
              notes.push(`[追溯鏈自動掛載] 已將執行任務「${item.itemTitle}」自動掛載至使用者故事「${batchUserStories[0].itemTitle}」。`)
            }
          }
        }
      }

      // 6.5 串接同批次 UAT ➔ Task
      const batchTasks = act.items.filter((i: any) => i.itemType === 'Task')
      if (batchTasks.length > 0) {
        for (const item of act.items) {
          if (item.itemType === 'UAT') {
            const hasValidTaskParent = item.parentItemUid && (
              batchTasks.some((t: any) => t.itemTitle.trim().toLowerCase() === item.parentItemUid.trim().toLowerCase()) ||
              ctx.itemsContext.some(dbItm => 
                dbItm.item_type === 'Task' && (
                  dbItm.item_display_code?.toUpperCase() === item.parentItemUid.trim().toUpperCase() ||
                  dbItm.item_uid === item.parentItemUid.trim() ||
                  dbItm.item_title.trim().toLowerCase() === item.parentItemUid.trim().toLowerCase()
                )
              )
            )

            if (!hasValidTaskParent) {
              item.parentItemUid = batchTasks[0].itemTitle
              notes.push(`[追溯鏈自動掛載] 已將驗收測試「${item.itemTitle}」自動掛載至執行任務「${batchTasks[0].itemTitle}」。`)
            }
          }
        }
      }
    }
  }

  // 7. 去環 (Graph Cycle Prevention for blocks)
  for (const act of unifiedActions) {
    if (act.actionType === 'batch_proposal' && Array.isArray(act.items)) {
      for (const item of act.items) {
        if (item.relationItemUid && Array.isArray(item.relationItemUid)) {
          item.relationItemUid = item.relationItemUid.filter((rel: any) => {
            if (rel.relation === 'blocks' && (rel.item_uid || '').trim().toLowerCase() === item.itemTitle.trim().toLowerCase()) {
              cycleCount++
              notes.push(`[去環] 移除了「${item.itemTitle}」自我阻塞之循環關聯。`)
              return false
            }
            return true
          })
        }
      }
    }
  }

  // 8. 🛡️ 實質變更比對與無效 No-Op 提案過濾 (Deterministic Delta & Substantive Change Verifier)
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

        if (act.itemTitle && act.itemTitle.trim() !== existingItem.item_title?.trim()) {
          hasDelta = true
        }
        if (act.updates?.item_status && act.updates.item_status !== existingItem.item_status) {
          hasDelta = true
        }
        if (act.updates?.item_follow_by !== undefined && act.updates.item_follow_by !== existingItem.item_follow_by) {
          hasDelta = true
        }
        if (act.updates?.parent_item_uid !== undefined && act.updates.parent_item_uid !== existingItem.parent_item_uid) {
          hasDelta = true
        }
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
