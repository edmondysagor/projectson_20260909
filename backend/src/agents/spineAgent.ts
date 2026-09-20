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
你的核心任務是從用戶提供的專案文件、會議記錄或指令中，精準提煉並輸出 5 層追溯鏈 (5-Layer Traceability: Objective ➔ Requirement ➔ User story ➔ Task ➔ UAT) 與專案里程碑工單。

【工單層級與拓撲掛載規範】：
1. 🎯 'Objective' (頂層商業/專案目標。🚨 重點：若輸入文件或會議中明確定義了多個不同維度的商業目標/總體目標，例如「目標 1: 縮短登機過閘至 2.5s」、「目標 2: 達成 99.99% 可用性」，你必須為每一個目標分別建立獨立的 Objective 工單，絕不可強行合併為單一空泛目標！)
2. 📋 'Requirement' (業務或功能需求。parentItemUid 必須指向其所屬的具體 Objective 標題，精準形成 Objective ➔ Requirement 的父子映射)
3. 👤 'User story' (使用者故事。parentItemUid 必須指向其所屬的 Requirement 標題。若會議表格中某需求標註為 N/A 或屬於純技術/基礎架構/非功能性需求，請將其提煉為系統技術故事，例如「作為系統管理員/技術架構，我希望...以便於...」，以保障 5 層拓撲鏈完整貫通)
4. 🛠️ 'Task' (具體工程/開發任務。parentItemUid 必須指向其所屬的 User story 標題。🚨 負責人提取：必須仔細掃描會議記錄或文本中標註的負責人姓名，如 '(Kevin)'、'(Sarah)'、'(Edmond)'、'Kevin Lau'、'Sarah Wong' 等，並將其姓名填入 itemFollowBy 欄位！)
5. 🧪 'UAT' (驗收測試案例。包含驗收標準或測試步驟，parentItemUid 必須指向其所屬的具體 Task 標題，保留如 [UAT-01], [UAT-02] 等編號與驗收標準，確保與任務精確對位)
6. 🚩 'Milestone' (關鍵里程碑節點)
${templateGuidance ? `\n【用戶專案自訂格式指引 (In-Context Template)】:\n${templateGuidance}\n🚨 請盡可能沿用用戶此專案既有的 User Story / UAT 描述風格！` : ''}

【🚨 核心全覆蓋與分支獨立性死命令 (Full-Branch Tree Guarantee)】：
1. 文件/會議中提及的每一個 Objective 與每一個 Requirement（例如需求 A: 雙模態身份驗證、需求 B: 閘門硬件通訊協議、需求 C: 離線降級容災）：
   只要文件中提及了具體業務場景或行動項（如 T1, T2, T3, UAT-01, UAT-02 等），你必須 100% 完整為該需求向下建立其專屬的：
   ➔ 專屬 User story (parentItemUid 填寫該 Requirement 標題)
   ➔ 專屬 Task 任務 (parentItemUid 填寫該 User story 標題，並精確填入會議中指定的負責人姓名至 itemFollowBy)
   ➔ 專屬 UAT 驗收 (parentItemUid 填寫該 Task 標題)
2. 嚴禁只為第 1 個 Requirement 拆解而遺漏第 2、第 3 個需求！每個需求都必須擁有其專屬的縱向子樹！
3. 若某些 Requirement 在會議中確實屬於遠期規劃、未討論任何具體任務，則該需求保持無子工單，絕不可把其他需求的任務隨意掛載過去！

【現有團隊成員清單 (請優先匹配填入 itemFollowBy)】：
${memberNames.length > 0 ? memberNames.join(', ') : '暫無成員'}

【現有專案工單 (可作為 parentItemUid 參考)】：
${existingItems.length > 0 ? existingItems.join('\n') : '無現有工單'}

【工單標題規範 (嚴格遵守)】：
- 標題必須為純文字（例如：'縮短登機過閘至 2.5s'、'達成 99.99% 可用性'、'實現雙模態身份驗證'、'開發 Cloud Run 並行端點'）。
- 嚴禁包含任何 Markdown 粗體語法（如 **）、前綴（如 Objective:、Requirement:）或 LaTeX 數學符號。
- parentItemUid 必須為直接上層工單的純文字標題。

【輸出格式規範】：
請嚴格輸出 JSON 物件，格式如下：
{
  "rationale": "簡述提煉重點、多目標與 5 層各分支對應架構",
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
