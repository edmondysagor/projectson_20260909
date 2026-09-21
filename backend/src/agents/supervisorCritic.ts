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

  /**
   * 語意去重判定器 (Semantic Deduplication Matcher)
   * 避免不同 Agent 以略微不同的標題措辭生成重複工單 (如「實現雙模態核驗」vs「開發雙模態核驗端點」)
   */
  function isSemanticDuplicate(a: { itemTitle: string; itemType: string }, b: { itemTitle: string; itemType: string }): boolean {
    if (a.itemType !== b.itemType) return false
    const tA = cleanItemTitle(a.itemTitle).toLowerCase().trim()
    const tB = cleanItemTitle(b.itemTitle).toLowerCase().trim()
    if (!tA || !tB) return false
    if (tA === tB) return true
    if (tA.length >= 6 && (tA.includes(tB) || tB.includes(tA))) return true

    // Token Jaccard Overlap
    const tokensA = new Set(tA.split(/[\s,，、/_\-：:()（）[\]【】]+/).filter(w => w.length >= 2))
    const tokensB = new Set(tB.split(/[\s,，、/_\-：:()（）[\]【】]+/).filter(w => w.length >= 2))
    if (tokensA.size === 0 || tokensB.size === 0) return false

    let intersection = 0
    for (const tok of tokensA) {
      if (tokensB.has(tok)) intersection++
    }
    const union = new Set([...tokensA, ...tokensB]).size
    const jaccard = intersection / union
    return jaccard >= 0.45
  }

  // 3. 去重 (Deduplication by exact and semantic similarity)
  const uniqueItems: PolymorphicItemProposal[] = []

  for (const item of allProposedItems) {
    const existing = uniqueItems.find(u => isSemanticDuplicate(u, item))
    if (existing) {
      duplicateCount++
      notes.push(`[去重] 已合併重複提案工單：「${item.itemTitle}」➔「${existing.itemTitle}」`)
      // 若新提案有更詳盡的描述或指派人，合併至現有工單
      if (item.description && (!existing.description || item.description.length > existing.description.length)) {
        existing.description = item.description
      }
      if (!existing.itemFollowBy && item.itemFollowBy) {
        existing.itemFollowBy = item.itemFollowBy
      }
      continue
    }

    // Type 合規校驗
    if (!VALID_ITEM_TYPES.includes(item.itemType)) {
      notes.push(`[Schema校驗] 工單「${item.itemTitle}」類型「${item.itemType}」不合法，自動修正為 'Task'。`)
      item.itemType = 'Task'
    }

    uniqueItems.push(item)
  }

  // 4. 與既有 batch_proposal 合流 (來源帳本主權性：若已有來源候選集，子專家僅能 Enrich，絕對禁止追加新工單)
  const existingBatch = unifiedActions.find(a => a.actionType === 'batch_proposal')
  if (existingBatch && Array.isArray(existingBatch.items)) {
    for (const item of uniqueItems) {
      const matchInBatch = existingBatch.items.find((bItem: any) => isSemanticDuplicate(bItem, item))
      if (matchInBatch) {
        duplicateCount++
        notes.push(`[批次去重與內容增強] 已將子專家提煉內容合併至源頭工單：「${item.itemTitle}」`)
        if (item.description && (!matchInBatch.description || item.description.length > (matchInBatch.description || '').length)) {
          matchInBatch.description = item.description
        }
        if (!matchInBatch.itemFollowBy && item.itemFollowBy) {
          matchInBatch.itemFollowBy = item.itemFollowBy
        }
      } else {
        // 🚨 來源帳本主權防禦 (Source Ledger Sovereignty):
        // 當批次已由來源帳本定義時，子專家輸出的未匹配項目（例如從章節標題捏造的 Charter、或由 User Story 轉化的 Task）必須被物理阻斷！
        notes.push(`[來源主權攔截] 物理阻斷非源頭工單：「${item.itemTitle}」(${item.itemType})`)
      }
    }

    // 4.0 嚴格物理過濾各類合成廢料與型別複製 (Rules 2, 4, 5, 6)
    const seenUserStories = new Set<string>()
    for (const itm of existingBatch.items) {
      if (itm.itemType === 'User story') {
        seenUserStories.add(cleanItemTitle(itm.itemTitle).toLowerCase())
      }
    }

    existingBatch.items = existingBatch.items.filter((itm: any) => {
      const t = cleanItemTitle(itm.itemTitle).toLowerCase()
      // Rule 2: Section is NOT item (章節標題不是工單，嚴禁由「專案章程總體目標」產生 Charter)
      if (itm.itemType === 'Charter' && (/總體目標|章程總體|charter & core|core objectives/i.test(t) || !itm.sourceEvidence)) {
        notes.push(`[章節過濾] 阻斷由章節標題生成之偽 Charter：「${itm.itemTitle}」`)
        return false
      }
      // Rule 4: No Type Duplication (若已存在 User Story，嚴禁額外產生 Task: US-01: 旅客無感通過)
      if (itm.itemType === 'Task' && (t.startsWith('us-') || t.startsWith('user story') || Array.from(seenUserStories).some(us => t.includes(us) || us.includes(t)))) {
        notes.push(`[型別複製過濾] 阻斷由 User Story 衍生之偽 Task：「${itm.itemTitle}」`)
        return false
      }
      return true
    })
  } else if (uniqueItems.length > 1) {
    const filteredUnique = uniqueItems.filter(item => {
      if (item.itemType === 'Charter' && /總體目標|章程總體|charter & core/i.test(item.itemTitle)) return false
      return true
    })
    unifiedActions.push({
      actionType: 'batch_proposal',
      proposalTitle: ctx.currentProject ? `${ctx.currentProject.project_name} 複合專家拆解提案` : 'AI 需求與專案架構提案',
      items: filteredUnique
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
      // 深度清洗：若 updates.item_content 混入了對話分析報告廢料，立刻剔除廢料
      if (act.updates?.item_content) {
        const textVal = typeof act.updates.item_content === 'string' 
          ? act.updates.item_content 
          : (act.updates.item_content.text || act.updates.item_content.description || '')
        if (textVal.includes('📋 文件與現有工單比對核對報告') || textVal.includes('比對結果：') || textVal.includes('增量分析：')) {
          if (bestProposedCharterContent) {
            act.updates.item_content = { text: bestProposedCharterContent, description: bestProposedCharterContent }
          } else {
            delete act.updates.item_content
          }
        }
      }

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

  // 4.2 若有現有 Charter 且收集到了更佳的章程內容，確保 Update Action 採用最佳提煉內容
  if (existingProjectCharter) {
    const charterUpdateKey = (existingProjectCharter.item_uid || existingProjectCharter.item_display_code || '').toLowerCase()
    const existingUpdate = dedupedUpdates.find(u => (u.targetItemUid || u.targetDisplayCode || '').toLowerCase() === charterUpdateKey)
    if (existingUpdate && bestProposedCharterContent) {
      existingUpdate.updates.item_content = {
        text: bestProposedCharterContent,
        description: bestProposedCharterContent
      }
    } else if (!existingUpdate && bestProposedCharterContent) {
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
      const clean = textToScan.toLowerCase().trim()
      
      // 1. 精確 UID 匹配
      const exactUid = ctx.membersContext.find(m => m.member_uid.toLowerCase() === clean)
      if (exactUid) return exactUid.member_uid

      // 2. 全名 / Email 匹配
      for (const m of ctx.membersContext) {
        if (!m.member_name) continue
        const mName = m.member_name.trim().toLowerCase()
        const mEmail = (m.member_email || '').trim().toLowerCase()
        if (clean === mName || (mEmail && clean === mEmail)) {
          return m.member_uid
        }
      }

      // 3. 名稱分詞與括號匹配 (如 "Kevin", "(Kevin)", "Sarah", "(Sarah)")
      for (const m of ctx.membersContext) {
        if (!m.member_name) continue
        const mName = m.member_name.trim().toLowerCase()
        const parts = mName.split(/[\s_-]+/).filter((p: string) => p.length >= 2)
        for (const part of parts) {
          if (clean === part || clean === `(${part})` || clean === `（${part}）`) {
            return m.member_uid
          }
        }
      }

      // 4. 文字內嵌掃描 (如 "開發並行端點 (Kevin)")
      for (const m of ctx.membersContext) {
        if (!m.member_name) continue
        const mName = m.member_name.trim().toLowerCase()
        if (mName.length >= 2 && clean.includes(mName)) {
          return m.member_uid
        }
        const firstName = mName.split(' ')[0]
        if (firstName && firstName.length >= 2) {
          const firstRegex = new RegExp(`(?:\\b|[\(（\[【：:•\\-])${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\b|[\)）\\]】\\s,，;；。])`, 'i')
          if (firstRegex.test(clean)) {
            return m.member_uid
          }
        }
      }
      return undefined
    }

    for (const act of unifiedActions) {
      if (act.actionType === 'batch_proposal' && Array.isArray(act.items)) {
        for (const itm of act.items) {
          // 若已指定了名字或代號（如 "Kevin"），優先將其轉化為 member_uid
          if (itm.itemFollowBy) {
            const resolvedUid = resolveAssigneeFromText(itm.itemFollowBy)
            if (resolvedUid) {
              itm.itemFollowBy = resolvedUid
            }
          }
          // 若仍未填寫負責人，則從工單標題與描述中智能嗅探
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
      } else if (act.actionType === 'create_item') {
        if (act.itemFollowBy) {
          const resolvedUid = resolveAssigneeFromText(act.itemFollowBy)
          if (resolvedUid) act.itemFollowBy = resolvedUid
        }
        if (!act.itemFollowBy) {
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
  }

  // 6. 🚨 5 層矩陣拓撲全自動鎖定與修復 (5-Layer Cascading Topology Lock)
  for (const act of unifiedActions) {
    if (act.actionType === 'batch_proposal' && Array.isArray(act.items) && act.items.length > 0) {
      // 若為正規 Canonical Proposal，其拓撲結構已由 graphValidator 精確驗證並保留 P001-Ixx / CAND-xxx 錨定，直接保留！
      if (act.canonicalProposal || act.items.some((i: any) => i.proposalItemId || i.candidateId)) {
        continue
      }

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

      // 6.0.0 自動為 Meeting 工單注入 discusses 關聯，鏈接所有由該會議提煉出的工單 (解決會議工單 Related items 為空的問題)
      const primaryMeeting = act.items.find((i: any) => i.itemType === 'Meeting')
      if (primaryMeeting) {
        const nonMeetingItems = act.items.filter((i: any) => i.itemType !== 'Meeting')
        const currentRelations = Array.isArray(primaryMeeting.relationItemUid) ? [...primaryMeeting.relationItemUid] : []
        const existingRelTitles = new Set(currentRelations.map((r: any) => (r.item_uid || '').trim().toLowerCase()))

        for (const itm of nonMeetingItems) {
          const tNorm = (itm.itemTitle || '').trim().toLowerCase()
          if (tNorm && !existingRelTitles.has(tNorm)) {
            currentRelations.push({
              item_uid: itm.itemTitle,
              relation: 'discusses'
            })
            existingRelTitles.add(tNorm)
          }
        }
        primaryMeeting.relationItemUid = currentRelations
        notes.push(`[會議網狀關聯] 已自動為會議工單「${primaryMeeting.itemTitle}」建立 ${currentRelations.length} 項 discusses (討論) 關聯。`)
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

      // 6.1 尋找既有或候選 Objective (Principle 2: 嚴禁無中生有合成 Objective)
      const batchObjectives = act.items.filter((i: any) => i.itemType === 'Objective')
      const existingProjectObjectives = ctx.itemsContext.filter(i => i.item_type === 'Objective')
      const primaryObjective = batchObjectives[0] || existingProjectObjectives[0]
      const primaryObjTitle = primaryObjective ? (primaryObjective.itemTitle || primaryObjective.item_title) : undefined

/**
 * 語意模糊父節點匹配器 (Fuzzy Semantic Parent Matcher)
 * 支援：
 * 1. 精確匹配 (Display Code, UUID, Title)
 * 2. 子字串包含 (Candidate title in parentRef or parentRef in candidate title)
 * 3. 關鍵字重疊評分 (Keyword Overlap Scoring)
 */
function findBestParentMatch(parentRef: string | undefined, candidates: any[]): any | null {
  if (!parentRef || !candidates || candidates.length === 0) return null
  const cleanRef = cleanItemTitle(parentRef).toLowerCase().trim()
  if (!cleanRef) return null

  // 1. 精確匹配
  const exact = candidates.find(c => {
    const t = cleanItemTitle(c.itemTitle || c.item_title || '').toLowerCase().trim()
    const code = (c.item_display_code || '').toLowerCase().trim()
    const uid = (c.item_uid || '').toLowerCase().trim()
    return t === cleanRef || (code && code === cleanRef) || (uid && uid === cleanRef)
  })
  if (exact) return exact

  // 2. 子字串相互包含匹配 (長度 >= 3)
  const substr = candidates.find(c => {
    const t = cleanItemTitle(c.itemTitle || c.item_title || '').toLowerCase().trim()
    if (t.length >= 3 && cleanRef.includes(t)) return true
    if (cleanRef.length >= 3 && t.includes(cleanRef)) return true
    return false
  })
  if (substr) return substr

  // 3. 關鍵詞重疊評分匹配 (Keyword Overlap Scoring)
  const refWords = cleanRef.split(/[\s,，、/_\-：:()（）[\]【】]+/).filter(w => w.length >= 2)
  let bestScore = 0
  let bestCand: any = null

  for (const c of candidates) {
    const t = cleanItemTitle(c.itemTitle || c.item_title || '').toLowerCase().trim()
    let score = 0
    for (const rw of refWords) {
      if (t.includes(rw)) score++
    }
    if (score > bestScore) {
      bestScore = score
      bestCand = c
    }
  }

  if (bestScore >= 1) return bestCand
  return null
}

      // 6.2 強制所有 Requirement 錨定至 Objective (支援多目標精確對位)
      if (batchObjectives.length > 0 || primaryObjTitle) {
        const allObjCandidates = [...batchObjectives, ...existingProjectObjectives]
        for (const item of act.items) {
          if (item.itemType === 'Requirement') {
            const matchedObj = findBestParentMatch(item.parentItemUid, allObjCandidates)
            if (matchedObj) {
              const matchedObjTitle = matchedObj.itemTitle || matchedObj.item_title
              item.parentItemUid = matchedObjTitle
              notes.push(`[追溯鏈目標錨定] 已將業務需求「${item.itemTitle}」精準掛載至商業目標「${matchedObjTitle}」。`)
            } else if (primaryObjTitle) {
              item.parentItemUid = primaryObjTitle
              notes.push(`[追溯鏈強制錨定] 已將業務需求「${item.itemTitle}」強制掛載至商業目標「${primaryObjTitle}」。`)
            }
          }
        }
      }

      // 6.2.1 剔除重複的空頭目標與空頭需求 (Ghost Branches Pruner)
      const reqsWithChildren = new Set<string>()
      for (const item of act.items) {
        if (['User story', 'Task'].includes(item.itemType) && item.parentItemUid) {
          reqsWithChildren.add(item.parentItemUid.toLowerCase().trim())
        }
      }

      act.items = act.items.filter((item: any) => {
        if (item.itemType === 'Requirement') {
          const itemTitleNorm = (item.itemTitle || '').toLowerCase().trim()
          const hasChildren = reqsWithChildren.has(itemTitleNorm) || Array.from(reqsWithChildren).some(c => c.includes(itemTitleNorm) || itemTitleNorm.includes(c))
          const isDuplicateGeneric = act.items.some((other: any) => 
            other !== item && other.itemType === 'Requirement' && (reqsWithChildren.has((other.itemTitle || '').toLowerCase().trim()) || Array.from(reqsWithChildren).some(c => c.includes((other.itemTitle || '').toLowerCase().trim()))) &&
            (other.itemTitle?.toLowerCase().includes(itemTitleNorm) || itemTitleNorm.includes(other.itemTitle?.toLowerCase()))
          )
          if (!hasChildren && isDuplicateGeneric) {
            notes.push(`[幽靈分支剔除] 已自動剔除無子工單之重複概括需求：「${item.itemTitle}」`)
            return false
          }
        }
        return true
      })

      const objsWithReqs = new Set<string>()
      for (const item of act.items) {
        if (item.itemType === 'Requirement' && item.parentItemUid) {
          objsWithReqs.add(item.parentItemUid.toLowerCase().trim())
        }
      }

      if (batchObjectives.length > 1) {
        act.items = act.items.filter((item: any) => {
          if (item.itemType === 'Objective') {
            const itemTitleNorm = (item.itemTitle || '').toLowerCase().trim()
            const hasReqs = objsWithReqs.has(itemTitleNorm) || Array.from(objsWithReqs).some(c => c.includes(itemTitleNorm) || itemTitleNorm.includes(c))
            if (!hasReqs && objsWithReqs.size > 0) {
              notes.push(`[幽靈目標剔除] 已自動剔除無下屬需求之空頭目標：「${item.itemTitle}」`)
              return false
            }
          }
          return true
        })
      }

      // 6.3 串接同批次 User story ➔ Requirement (語意模糊對位，絕不暴力全部歸入第 1 項)
      const batchRequirements = act.items.filter((i: any) => i.itemType === 'Requirement')
      const existingProjectRequirements = ctx.itemsContext.filter(i => i.item_type === 'Requirement')
      const allReqCandidates = [...batchRequirements, ...existingProjectRequirements]

      if (allReqCandidates.length > 0) {
        for (const item of act.items) {
          if (item.itemType === 'User story') {
            let matchedReq = findBestParentMatch(item.parentItemUid, allReqCandidates)
            
            // 若 parentItemUid 未能匹配，嘗試使用故事自身標題或描述與候選需求做關鍵詞評分
            if (!matchedReq) {
              matchedReq = findBestParentMatch(`${item.itemTitle} ${item.description || ''}`, allReqCandidates)
            }

            if (matchedReq) {
              const reqTitle = matchedReq.itemTitle || matchedReq.item_title
              item.parentItemUid = reqTitle
              notes.push(`[追溯鏈語意掛載] 已將使用者故事「${item.itemTitle}」精準掛載至需求「${reqTitle}」。`)
            } else if (allReqCandidates.length === 1) {
              item.parentItemUid = allReqCandidates[0].itemTitle || allReqCandidates[0].item_title
            }
          }
        }
      }

      // 6.4 串接同批次 Task ➔ User story (語意模糊對位)
      const batchUserStories = act.items.filter((i: any) => i.itemType === 'User story')
      const existingProjectStories = ctx.itemsContext.filter(i => i.item_type === 'User story')
      const allStoryCandidates = [...batchUserStories, ...existingProjectStories]

      if (allStoryCandidates.length > 0) {
        for (const item of act.items) {
          if (item.itemType === 'Task') {
            let matchedStory = findBestParentMatch(item.parentItemUid, allStoryCandidates)
            
            // 嘗試用任務標題或描述做關鍵詞比對
            if (!matchedStory) {
              matchedStory = findBestParentMatch(`${item.itemTitle} ${item.description || ''}`, allStoryCandidates)
            }

            // 亦允許 Task 直接掛載至 Requirement (若該需求無專屬 Story)
            if (!matchedStory && allReqCandidates.length > 0) {
              matchedStory = findBestParentMatch(item.parentItemUid, allReqCandidates)
            }

            if (matchedStory) {
              const pTitle = matchedStory.itemTitle || matchedStory.item_title
              item.parentItemUid = pTitle
              notes.push(`[追溯鏈語意掛載] 已將執行任務「${item.itemTitle}」精準掛載至父工單「${pTitle}」。`)
            } else if (allStoryCandidates.length === 1) {
              item.parentItemUid = allStoryCandidates[0].itemTitle || allStoryCandidates[0].item_title
            }
          }
        }
      }

      // 6.5 串接同批次 UAT ➔ Task (語意模糊對位)
      const batchTasks = act.items.filter((i: any) => i.itemType === 'Task')
      const existingProjectTasks = ctx.itemsContext.filter(i => i.item_type === 'Task')
      const allTaskCandidates = [...batchTasks, ...existingProjectTasks]

      if (allTaskCandidates.length > 0) {
        for (const item of act.items) {
          if (item.itemType === 'UAT') {
            let matchedTask = findBestParentMatch(item.parentItemUid, allTaskCandidates)
            
            // 嘗試用 UAT 標題或描述比對
            if (!matchedTask) {
              matchedTask = findBestParentMatch(`${item.itemTitle} ${item.description || ''}`, allTaskCandidates)
            }

            if (matchedTask) {
              const taskTitle = matchedTask.itemTitle || matchedTask.item_title
              item.parentItemUid = taskTitle
              notes.push(`[追溯鏈語意掛載] 已將驗收測試「${item.itemTitle}」精準掛載至任務「${taskTitle}」。`)
            } else if (allTaskCandidates.length === 1) {
              item.parentItemUid = allTaskCandidates[0].itemTitle || allTaskCandidates[0].item_title
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
