import { AgentContext, SubAgentResult, PolymorphicItemProposal } from './types.js'
import { callSubAgentJson } from './llmClient.js'

/**
 * Decision Specialist (Meetings, ADRs, Bottlenecks & Horizontal Graph Relations)
 * 專精領域：
 * 1. 會議記錄 (Meeting) 紀要結構化與 Action Items 關聯 (discusses)
 * 2. 架構決策記錄 (Decision / ADR)：背景、候選方案權衡、拍板結論
 * 3. 技術阻礙與風險 (Bottleneck)：現象、根因剖析、緩解對策 (blocks)
 * 4. 水平依賴網絡：discusses, blocks, causes, deploys
 */
export async function runDecisionAgent(ctx: AgentContext): Promise<SubAgentResult> {
  const result: SubAgentResult = {
    agentName: 'decision',
    agentTitle: '決策與風險專家 (Decision & Risk Specialist)',
    itemsToCreate: [],
    itemsToUpdate: [],
    rationale: ''
  }

  try {
    const isDecisionRelevant = /(?:meeting|會議|recap|紀要|開會|決策|decision|adr|架構決策|拍板|共識|bottleneck|瓶頸|阻礙|卡住|風險|依賴|blocks|discusses)/i.test(ctx.message) ||
      /(?:kick-off|啟航|初始化|全量|拆解)/i.test(ctx.message) ||
      (ctx.attachments && ctx.attachments.length > 0)

    if (!isDecisionRelevant) {
      result.rationale = '用戶指令未涉及會議、架構決策或瓶頸風險，跳過決策專家處理。'
      return result
    }

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

    const systemPrompt = `你是一個資深的技術決策顧問與風險專家 (Decision & Risk Specialist)。
你的核心任務是從用戶提供的專案文件、會議記錄或指令中，提煉出結構化的會議記錄 (Meeting)、架構決策 (Decision/ADR) 與技術瓶頸風險 (Bottleneck)，並標註水平關聯網絡 (discusses, blocks, causes)。

【工單類型與格式規範】：
1. 📅 'Meeting' (會議記錄)：
   包含出席人員、會議日期、核心共識、Action Items 表格，並透過 relationItemUid 標註 discusses (討論了哪些任務或決策)。
2. ⚖️ 'Decision' (架構決策 ADR)：
   包含狀態 (Approved)、問題陳述、候選方案權衡表格 (Trade-offs Table)、拍板結論與核心論據。
3. ⚠️ 'Bottleneck' (技術阻礙與瓶頸)：
   包含嚴重度 (High/Medium/Low)、阻礙現象、根因剖析、緩解處置方案，並透過 relationItemUid 標註 blocks (阻塞了哪些工單)。

【現有團隊成員清單】：
${memberNames.length > 0 ? memberNames.join(', ') : '暫無成員'}

【現有專案工單】：
${existingItems.length > 0 ? existingItems.join('\n') : '無現有工單'}

【工單標題與數量規範 (嚴格遵守)】：
- 標題必須為純文字（例如：'2026-09-20 系統第一期架構定案與章程確認會議'、'ADR-01: 資料庫選型'）。
- 嚴禁輸出多張零碎的 Meeting 工單！整個會議紀要只能建立 1 張核心 Meeting 工單。
- 嚴禁在標題中包含任何 Markdown 粗體語法（如 **）、前綴（如 Meeting:、Decision:）或 LaTeX 數學符號。

【輸出格式規範】：
請輸出嚴格的 JSON 物件：
{
  "rationale": "簡要說明識別出的會議、架構決策或瓶頸風險",
  "items": [
    {
      "itemTitle": "純文字工單標題 (例如：2026-09-20 啟航會議紀要)",
      "itemType": "Meeting" | "Decision" | "Bottleneck",
      "itemPriority": "High" | "Middle" | "Low",
      "itemFollowBy": "指派負責人姓名 (若有)",
      "relationItemUid": [
        {
          "item_uid": "關聯工單純文字標題或代碼",
          "relation": "discusses" | "blocks" | "causes"
        }
      ],
      "description": "標準 Markdown 詳細內文與表格",
      "sectionTitle": "分類標題 (如：📅 會議與決策, ⚠️ 風險與阻礙)"
    }
  ]
}`

    const userPrompt = `【專案名稱】：${ctx.currentProject?.project_name || '當前專案'}
【用戶指令】：${ctx.message}
${attachedContent}

請輸出會議紀要、架構決策與風險瓶頸 JSON：`

    const parsed = await callSubAgentJson<{ rationale?: string; items?: PolymorphicItemProposal[] }>({
      systemPrompt,
      userPrompt,
      model: ctx.model,
      temperature: 0.2
    })

    if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
      result.itemsToCreate = parsed.items
      result.rationale = parsed.rationale || `決策專家已提煉 ${parsed.items.length} 項會議與決策工單。`
    } else {
      result.rationale = '決策專家分析完成，未發現需新增之會議或決策工單。'
    }

    return result
  } catch (err: any) {
    console.error('[DecisionAgent Error]:', err)
    result.error = err.message
    return result
  }
}
