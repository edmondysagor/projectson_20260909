import { AgentContext, SubAgentResult, PolymorphicItemProposal } from './types.js'
import { callSubAgentJson } from './llmClient.js'

function extractTextContent(item: any): string {
  if (!item) return ''
  if (typeof item === 'string') return item
  if (item.item_content) {
    if (typeof item.item_content === 'string') return item.item_content
    if (item.item_content.text) return item.item_content.text
    if (item.item_content.description) return item.item_content.description
  }
  if (item.description && typeof item.description === 'string') return item.description
  return ''
}

/**
 * Spine Specialist (5-Layer Traceability & Milestone Cluster)
 * 專精領域：
 * 1. 5 層核心追溯鏈：Objective ➔ Requirement ➔ User story ➔ Task ➔ UAT
 * 2. 範本格式嗅探（自動學習專案既有 User Story AC 格式、UAT Given-When-Then 格式）
 * 3. 專案里程碑 (Milestone)、史詩 (Epic)、子任務 (Micro Task)
 * 4. 負責人精準匹配與優先級評定 (High/Middle/Low)
 */
export async function runSpineAgent(ctx: AgentContext): Promise<SubAgentResult> {
  const result: SubAgentResult = {
    agentName: 'spine',
    agentTitle: '骨幹專家 (Spine Specialist)',
    itemsToCreate: [],
    itemsToUpdate: [],
    rationale: ''
  }

  try {
    const isSpineRelevant = /(?:objective|requirement|user story|story|task|uat|milestone|epic|micro task|骨幹|追溯|階層|任務|需求|目標|故事|驗收|里程碑|指派|分工)/i.test(ctx.message) ||
      /(?:kick-off|會議|recap|拆解|規劃|會議紀要|todo|action items|項目|全量|批量)/i.test(ctx.message) ||
      (ctx.attachments && ctx.attachments.length > 0)

    if (!isSpineRelevant) {
      result.rationale = '用戶指令未涉及 5 層追溯鏈或里程碑，跳過骨幹專家處理。'
      return result
    }

    // 準備上下文資料
    const memberNames = (ctx.membersContext || []).map(m => m.member_name).filter(Boolean)
    const existingItems = (ctx.itemsContext || []).slice(0, 30).map(i => `[${i.item_display_code || i.item_uid}] (${i.item_type}) ${i.item_title}`)
    
    // 嗅探專案既有 User Story 與 UAT 的範本樣式
    const existingUserStory = (ctx.itemsContext || []).find(i => i.item_type === 'User story')
    const existingUat = (ctx.itemsContext || []).find(i => i.item_type === 'UAT')

    let templateGuidance = ''
    if (existingUserStory) {
      const usText = extractTextContent(existingUserStory)
      if (usText.length > 20) {
        templateGuidance += `\n【專案既有 User Story 範本風格參考】：\n${usText.slice(0, 300)}\n`
      }
    }
    if (existingUat) {
      const uatText = extractTextContent(existingUat)
      if (uatText.length > 20) {
        templateGuidance += `\n【專案既有 UAT 驗收範本風格參考】：\n${uatText.slice(0, 300)}\n`
      }
    }

    // 提取文字附件
    let attachedContent = ''
    if (ctx.attachments && ctx.attachments.length > 0) {
      const textAtts = ctx.attachments.filter((a: any) => a.type === 'text' || a.textContent || a.content)
      if (textAtts.length > 0) {
        attachedContent = '\n\n【上載文件內容】:\n' + textAtts.map((a: any) => `📄 ${a.name}:\n${a.textContent || a.content}`).join('\n\n')
      }
    }

    const systemPrompt = `你是一個資深的敏捷軟體專案架構師與骨幹專家 (Spine Specialist)。
你的核心任務是從用戶提供的專案文件、會議記錄或指令中，精準提煉並輸出源頭真實包含的工單 (Source Fidelity > Hierarchy Completeness)。

【🚨 最核心原則 (Principles)】：
1. 來源真實性 > 階層完整性 (SOURCE FIDELITY > HIERARCHY COMPLETENESS)：
   - 絕不可為了填滿 5 層架構而無中生有！
   - 階層缺層（Incomplete Traceability）是完全合法且受支援的（例如 Requirement ➔ Task 直連，中間無 User Story）。
2. 追溯規劃絕不製造工單 (TRACEABILITY MUST NOT CREATE ITEMS)：
   - 骨幹專家只提煉原文中確實存在的條目，不可憑空捏造 User Story、Requirement 或 Objective。
3. 商業目標絕不拆分 (DO NOT SPLIT OBJECTIVES)：
   - 若原文為「打造新一代 SBG 登機門，過閘縮短至 2.5s 內並達成 99.99% 可用性」，這是一個完整的 Objective（包含量化 KPI 描述），嚴禁拆成兩個獨立 Objective！
4. 保持源頭語義類別 (Preserve Source Semantic Type)：
   - [Decision] 保持 Decision，[Bottleneck] 保持 Bottleneck，[Milestone] 保持 Milestone，絕不可篡改為 Requirement 或 Task。

【工單層級與拓撲掛載規範】：
1. 🎯 'Objective' (頂層商業目標。原文若有則提煉 1 項，絕不拆分)
2. 📋 'Requirement' (業務或功能需求。parentItemUid 指向其所屬的具體 Objective 標題)
3. 👤 'User story' (使用者故事。🚨 嚴禁無中生有：若且唯若原文中明確包含 [User Story] 時才建立！無 User Story 時 Task 直接掛載至 Requirement)
4. 🛠️ 'Task' (具體工程/開發任務。parentItemUid 指向所屬 User story 或所屬 Requirement。🚨 負責人提取：仔細掃描如 '(指派給: Kevin Lau)' ➔ 填入 'Kevin Lau')
5. 🧪 'UAT' (驗收測試案例。🚨 嚴禁憑空推斷：若且唯若原文中明確包含 [UAT] 或明確測試條目時才建立！追溯架構包含 UAT 絕不代表必須建立 UAT 工單；若原文無 UAT 則絕不輸出任何 UAT 工單！)
6. 🚩 'Milestone' (關鍵里程碑節點)
${templateGuidance ? `\n【用戶專案自訂格式指引 (In-Context Template)】:\n${templateGuidance}\n🚨 請盡可能沿用用戶此專案既有的 User Story / UAT 描述風格！` : ''}

【現有團隊成員清單 (請優先匹配填入 itemFollowBy)】：
${memberNames.length > 0 ? memberNames.join(', ') : '暫無成員'}

【現有專案工單 (可作為 parentItemUid 參考)】：
${existingItems.length > 0 ? existingItems.join('\n') : '無現有工單'}

【工單標題規範 (嚴格遵守)】：
- 標題必須為純文字（例如：'縮短登機過閘至 2.5s'、'實現雙模態身份驗證'、'開發 Cloud Run 並行端點'）。
- 嚴禁包含任何 Markdown 粗體語法（如 **）、前綴（如 Objective:、Requirement:）或 LaTeX 數學符號。
- parentItemUid 必須為直接上層工單的純文字標題。

【輸出格式規範】：
請嚴格輸出 JSON 物件，格式如下：
{
  "rationale": "簡述提煉重點、多目標與追溯對應架構",
  "items": [
    {
      "itemTitle": "純文字工單標題 (簡明精準，無 Markdown/符號裝飾)",
      "itemType": "Objective" | "Requirement" | "User story" | "Task" | "UAT" | "Milestone",
      "itemPriority": "High" | "Middle" | "Low",
      "itemFollowBy": "指派負責人姓名 (如 Kevin Lau, Sarah Wong, Edmond Chan，依會議括號或文字指定)",
      "parentItemUid": "直接上層父工單純文字標題",
      "description": "標準 Markdown 詳細描述，包含驗收條件或技術指引",
      "sectionTitle": "分類標題 (如：🎯 專案目標, 📋 核心需求, 👤 使用者故事, 🛠️ 開發任務, 🧪 UAT 驗收)"
    }
  ]
}`

    const userPrompt = `【專案名稱】：${ctx.currentProject?.project_name || '當前專案'}
【用戶指令】：${ctx.message}
${attachedContent}

請拆解並輸出完整的 5 層追溯鏈工單 JSON：`

    const parsed = await callSubAgentJson<{ rationale?: string; items?: PolymorphicItemProposal[] }>({
      systemPrompt,
      userPrompt,
      model: ctx.model,
      temperature: 0.2
    })

    if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
      result.itemsToCreate = parsed.items
      result.rationale = parsed.rationale || `骨幹專家已成功拆解提煉 ${parsed.items.length} 項追溯鏈工單。`
    } else {
      result.rationale = '骨幹專家分析完成，未發現需新增之 5 層工單。'
    }

    return result
  } catch (err: any) {
    console.error('[SpineAgent Error]:', err)
    result.error = err.message
    return result
  }
}
