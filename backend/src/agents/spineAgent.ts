import { AgentContext, SubAgentResult, PolymorphicItemProposal } from './types.js'
import { callSubAgentJson } from './llmClient.js'

/**
 * Spine Specialist (5-Layer Traceability & Milestone Cluster)
 * 專精領域：
 * 1. 5 層核心追溯鏈：Objective ➔ Requirement ➔ User story ➔ Task ➔ UAT
 * 2. 專案里程碑 (Milestone)、史詩 (Epic)、子任務 (Micro Task)
 * 3. 負責人精準匹配與優先級評定 (High/Middle/Low)
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
    
    // 提取文字附件
    let attachedContent = ''
    if (ctx.attachments && ctx.attachments.length > 0) {
      const textAtts = ctx.attachments.filter((a: any) => a.type === 'text' || a.textContent || a.content)
      if (textAtts.length > 0) {
        attachedContent = '\n\n【上載文件內容】:\n' + textAtts.map((a: any) => `📄 ${a.name}:\n${a.textContent || a.content}`).join('\n\n')
      }
    }

    const systemPrompt = `你是一個資深的敏捷軟體專案架構師與骨幹專家 (Spine Specialist)。
你的核心任務是從用戶提供的專案文件、會議記錄或指令中，精準提煉並輸出 5 層追溯鏈 (5-Layer Traceability) 與專案里程碑工單。

【工單層級與類型規範】：
1. 🎯 'Objective' (頂層商業/專案目標，必須為所有 Requirement 的根節點)
2. 📋 'Requirement' (業務或功能需求，parentItemUid 必須指向上層 Objective 標題)
3. 👤 'User story' (使用者故事，格式：作為...我希望...以便於...，parentItemUid 指向上層 Requirement 標題)
4. 🛠️ 'Task' (具體工程/開發任務，parentItemUid 指向上層 User story 標題)
5. 🧪 'UAT' (驗收測試案例，包含 Given-When-Then，parentItemUid 指向上層 Task 標題)
6. 🚩 'Milestone' (關鍵里程碑節點)

【現有團隊成員清單 (請優先匹配填入 itemFollowBy)】：
${memberNames.length > 0 ? memberNames.join(', ') : '暫無成員'}

【現有專案工單 (可作為 parentItemUid 參考)】：
${existingItems.length > 0 ? existingItems.join('\n') : '無現有工單'}

【工單標題規範 (嚴格遵守)】：
- 標題必須為純文字（例如：'打造新一代生物辨識自動登機門系統'、'實現雙模態身份驗證'）。
- 嚴禁包含任何 Markdown 粗體語法（如 **）、前綴（如 Objective:、Requirement:）或 LaTeX 數學符號。
- parentItemUid 必須與同批父項目的 itemTitle 純文字完全一致。

【輸出格式規範】：
請嚴格輸出 JSON 物件，格式如下：
{
  "rationale": "簡述提煉重點與層級架構",
  "items": [
    {
      "itemTitle": "純文字工單標題 (簡明精準，無 Markdown/符號裝飾)",
      "itemType": "Objective" | "Requirement" | "User story" | "Task" | "UAT" | "Milestone",
      "itemPriority": "High" | "Middle" | "Low",
      "itemFollowBy": "指派負責人姓名 (如 Kevin Lau, Sarah Wong，若無則留空)",
      "parentItemUid": "同批父工單純文字標題或現有工單編號",
      "description": "標準 Markdown 詳細描述，包含驗收條件或技術指引",
      "sectionTitle": "分類標題 (如：🎯 專案目標, 📋 核心需求, 🛠️ 開發任務)"
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
