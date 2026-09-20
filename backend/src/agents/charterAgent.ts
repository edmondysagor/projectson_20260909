import { AgentContext, SubAgentResult, PolymorphicItemProposal, PolymorphicItemUpdate } from './types.js'
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
 * Charter Specialist (Charter, Scope & Information Cluster)
 * 專精領域：
 * 1. 專案章程 (Charter) 格式嗅探與動態 Few-Shot 對齊（支援 Table 表格型、Paragraph 段落章節型、自訂欄位型）
 * 2. 專案範疇 (In-Scope & Out-of-Scope) 邊界界定
 * 3. 規格文件、架構指南與技術資料 (Information)
 */
export async function runCharterAgent(ctx: AgentContext): Promise<SubAgentResult> {
  const result: SubAgentResult = {
    agentName: 'charter',
    agentTitle: '章程與範疇專家 (Charter Specialist)',
    itemsToCreate: [],
    itemsToUpdate: [],
    rationale: ''
  }

  try {
    const isCharterRelevant = /(?:charter|章程|立項|範疇|scope|in-scope|out-of-scope|information|規格|文件|sop|api doc|資料庫規格)/i.test(ctx.message) ||
      /(?:kick-off|啟航|初始化|填寫|更新|recap|會議)/i.test(ctx.message) ||
      (ctx.attachments && ctx.attachments.length > 0)

    if (!isCharterRelevant) {
      result.rationale = '用戶指令未涉及 Charter 章程或 Information 規格文件，跳過章程專家處理。'
      return result
    }

    // 尋找專案現有之 Charter 工單
    const existingCharter = (ctx.itemsContext || []).find(i => 
      i.item_type === 'Charter' || 
      /charter|章程/i.test(i.item_title || '')
    )

    const existingCharterText = existingCharter ? extractTextContent(existingCharter) : ''
    const hasExistingTable = existingCharterText.includes('|') && existingCharterText.includes('---')
    const hasExistingSections = /(?:^|\n)#{1,4}\s+/.test(existingCharterText) || /(?:^|\n)[-*\d]+\.\s+/.test(existingCharterText)

    // 提取文字附件
    let attachedContent = ''
    if (ctx.attachments && ctx.attachments.length > 0) {
      const textAtts = ctx.attachments.filter((a: any) => a.type === 'text' || a.textContent || a.content)
      if (textAtts.length > 0) {
        attachedContent = '\n\n【上載文件內容】:\n' + textAtts.map((a: any) => `📄 ${a.name}:\n${a.textContent || a.content}`).join('\n\n')
      }
    }

    // 動態構建範本指引提示詞 (Few-Shot In-Context Template Guidance & Precise Slot-Filling)
    let formatInstruction = ''
    if (existingCharter && existingCharterText.trim().length > 20) {
      if (hasExistingTable) {
        formatInstruction = `【用戶專案既有範本格式（表格型 GFM Table）】：
檢測到專案現有章程工單採用了 GFM Markdown 表格格式。
請 100% 沿用現有的表格欄位結構進行更新填寫，確保所有 Field 說明填入表中。
現有骨架參考：
${existingCharterText.slice(0, 4000)}`
      } else if (hasExistingSections) {
        formatInstruction = `【用戶專案既有範本格式（段落章節/列點結構風格）】：
🚨 檢測到用戶在此專案的章程採用了結構化的「段落章節與列點清單」風格！
【🎯 精準對號入座 (Slot-Filling) 填寫指令】：
1. 必須 100% 原汁原味保留用戶範本中的所有章節標題 (H1/H2/H3) 與列點前綴（例如「# 專案章程 (Project Charter)」、「### 1. 專案背景與願景 (Background & Vision)」、「* **商業背景**：」等）。
2. 將上載文件/會議記錄中的真實資訊，精準填入對應列點的冒號「：」後面或子清單中。
3. 嚴禁更改用戶原有的章節標題名稱與編號！嚴禁強制轉換為表格！嚴禁輸出任何對話報告或開場白！
用戶設定之完整範本骨架：
${existingCharterText.slice(0, 4000)}`
      } else {
        formatInstruction = `【用戶自定義範本骨架】：
請 100% 遵循用戶既有工單的格式與編排方式進行對號入座填寫：
${existingCharterText.slice(0, 4000)}`
      }
    } else {
      formatInstruction = `【預設 Charter 結構範式（若用戶未預置自訂格式則採用此標準）】：
# 專案章程 (Project Charter)
| 欄位 (Field) | 說明與填寫內容 (Description) |
|---|---|
| Project Title | 專案名稱 |
| Business Sponsor | 業務發起人 |
| Business Owner | 業務擁有者 |
| Project Lead | 專案主管 / PM |
| Problem & Opportunity | 業務痛點與機遇 |
| Objectives | 核心業務目標 |
| Quantifiable Benefits | 量化效益與價值 |
| Non-Quantifiable Benefits | 非量化效益 |
| Strategic Alignment | 企業策略對齊 |
| Metric | 核心指標 (KPI) |
| Baseline | 現狀基準值 |
| Target | 目標達成值 |
| In-Scope | 涵蓋範疇清單 |
| Out-of-Scope | 排除範疇清單 |
| Project Team Members | 團隊成員 |
| Stakeholders | 利害關係人 |
| Known Risks | 已知風險與緩解方案 |`
    }

    const systemPrompt = `你是一個資深的專案管理專家 (PMP) 與章程與範疇專家 (Charter Specialist)。
你的核心任務是從用戶提供的專案文件、會議記錄或指令中，提煉出結構化且完整的專案章程 (Project Charter) 與範疇 (In/Out of Scope)。

【現有專案 Charter 現況】：
${existingCharter ? `🚨 發現專案現有唯一 Charter 工單 [${existingCharter.item_display_code || existingCharter.item_uid}]「${existingCharter.item_title}」。本專案永久只維護此一張章程，嚴禁在 newItems 中建立第二張 Charter！請將完整填寫的章程內容放入 charterUpdate.markdownContent！` : '尚未建立專案 Charter 工單，請於 charterUpdate 中完整輸出初版章程內容。'}

${formatInstruction}

【🚨 核心防呆與嚴禁偷懶規範】：
1. 嚴禁敷衍字眼：嚴禁輸出「詳見 TPM-xxx」、「參見某某內容」、「如上所述」等偷懶指代文字！必須 100% 完整撰寫所有章節與欄位內容。
2. 單一章程約束：若專案已有 Charter，所有更新必須放入 charterUpdate，嚴禁在 newItems 中輸出 Charter 類型工單。
3. 工單標題規範：標題必須為純文字（例如：'${ctx.currentProject?.project_name || '專案'} 專案章程'），嚴禁包含任何 Markdown 粗體（如 **）或前綴。

【輸出格式規範】：
請輸出嚴格的 JSON 物件：
{
  "rationale": "章程專家分析說明",
  "charterUpdate": {
    "targetDisplayCode": "${existingCharter?.item_display_code || ''}",
    "targetItemUid": "${existingCharter?.item_uid || ''}",
    "itemTitle": "${existingCharter?.item_title || (ctx.currentProject ? `${ctx.currentProject.project_name} 專案章程` : '專案章程 (Project Charter)')}",
    "markdownContent": "完整填寫完成的 Markdown 章程內容（嚴格遵從上述格式風格，絕不偷懶）",
    "summary": "更新專案章程內容"
  },
  "newItems": [
    ${existingCharter ? '' : `{
      "itemTitle": "專案規格/SOP文件標題",
      "itemType": "Information",
      "itemPriority": "Middle",
      "description": "Markdown 內容",
      "sectionTitle": "🏛️ 專案規格文件"
    }`}
  ]
}`

    const userPrompt = `【專案名稱】：${ctx.currentProject?.project_name || '當前專案'}
【用戶指令】：${ctx.message}
${attachedContent}

請輸出章程分析與內容填寫 JSON：`

    const parsed = await callSubAgentJson<{
      rationale?: string
      charterUpdate?: {
        targetDisplayCode?: string
        targetItemUid?: string
        itemTitle: string
        markdownContent: string
        summary: string
      }
      newItems?: PolymorphicItemProposal[]
    }>({
      systemPrompt,
      userPrompt,
      model: ctx.model,
      temperature: 0.2
    })

    if (parsed) {
      result.rationale = parsed.rationale || '章程專家分析完成。'

      // 若有現有 Charter 且生成了更新
      if (existingCharter && parsed.charterUpdate && parsed.charterUpdate.markdownContent && parsed.charterUpdate.markdownContent.trim().length > 10) {
        result.itemsToUpdate.push({
          targetDisplayCode: existingCharter.item_display_code,
          targetItemUid: existingCharter.item_uid,
          itemTitle: existingCharter.item_title,
          updates: {
            item_content: {
              text: parsed.charterUpdate.markdownContent,
              description: parsed.charterUpdate.markdownContent
            }
          },
          summary: parsed.charterUpdate.summary || '依據上載文件更新專案章程內容'
        })
      } else if (!existingCharter && parsed.charterUpdate && parsed.charterUpdate.markdownContent && parsed.charterUpdate.markdownContent.trim().length > 10) {
        // 若無現有 Charter，則作為新工單建立
        result.itemsToCreate.push({
          itemTitle: parsed.charterUpdate.itemTitle || (ctx.currentProject ? `${ctx.currentProject.project_name} 專案章程` : '專案章程 (Project Charter)'),
          itemType: 'Charter',
          itemPriority: 'High',
          description: parsed.charterUpdate.markdownContent,
          sectionTitle: '🏛️ 專案章程 (Charter)'
        })
      }

      if (parsed.newItems && Array.isArray(parsed.newItems)) {
        for (const itm of parsed.newItems) {
          // 若已有現有 Charter，物理剔除任何新的 Charter 提案
          if (existingCharter && (itm.itemType === 'Charter' || /charter|專案章程/i.test(itm.itemTitle || ''))) {
            continue
          }
          if (itm.itemTitle && itm.description) {
            result.itemsToCreate.push(itm)
          }
        }
      }
    }

    return result
  } catch (err: any) {
    console.error('[CharterAgent Error]:', err)
    result.error = err.message
    return result
  }
}
