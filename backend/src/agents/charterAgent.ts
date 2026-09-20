import { AgentContext, SubAgentResult, PolymorphicItemProposal, PolymorphicItemUpdate } from './types.js'
import { callSubAgentJson } from './llmClient.js'

/**
 * Charter Specialist (Charter, Scope & Information Cluster)
 * 專精領域：
 * 1. 專案章程 (Charter) Markdown 表格提取與 100% 欄位填寫
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

    // 提取文字附件
    let attachedContent = ''
    if (ctx.attachments && ctx.attachments.length > 0) {
      const textAtts = ctx.attachments.filter((a: any) => a.type === 'text' || a.textContent || a.content)
      if (textAtts.length > 0) {
        attachedContent = '\n\n【上載文件內容】:\n' + textAtts.map((a: any) => `📄 ${a.name}:\n${a.textContent || a.content}`).join('\n\n')
      }
    }

    const systemPrompt = `你是一個資深的專案管理專家 (PMP) 與章程與範疇專家 (Charter Specialist)。
你的任務是從用戶提供的文件或會議記錄中，提煉出結構化且完整的專案章程 (Project Charter) Markdown 表格與範疇 (In/Out of Scope)。

【現有專案 Charter 現況】：
${existingCharter ? `發現現有 Charter 工單 [${existingCharter.item_display_code || existingCharter.item_uid}]「${existingCharter.item_title}」` : '尚未建立專案 Charter 工單'}

【標準 Charter 表格範式】：
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
| Known Risks | 已知風險與緩解方案 |

【輸出格式規範】：
請輸出嚴格的 JSON 物件：
{
  "rationale": "章程專家分析說明",
  "charterUpdate": {
    "targetDisplayCode": "${existingCharter?.item_display_code || ''}",
    "targetItemUid": "${existingCharter?.item_uid || ''}",
    "itemTitle": "${existingCharter?.item_title || '專案章程 (Project Charter)'}",
    "markdownContent": "完整填寫完成的 Markdown 章程表格",
    "summary": "更新 Project Charter 表格內容"
  },
  "newItems": [
    {
      "itemTitle": "專案章程或 Information 規格文件標題",
      "itemType": "Charter" | "Information",
      "itemPriority": "High" | "Middle" | "Low",
      "description": "Markdown 內容",
      "sectionTitle": "🏛️ 專案章程與規格"
    }
  ]
}`

    const userPrompt = `【專案名稱】：${ctx.currentProject?.project_name || '當前專案'}
【用戶指令】：${ctx.message}
${attachedContent}

請輸出章程分析與表格填寫 JSON：`

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

      // 若有現有 Charter 且生成了表格更新
      if (existingCharter && parsed.charterUpdate && parsed.charterUpdate.markdownContent) {
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
          summary: parsed.charterUpdate.summary || '依據上載文件更新專案章程表格'
        })
      } else if (!existingCharter && parsed.charterUpdate && parsed.charterUpdate.markdownContent) {
        // 若無現有 Charter，則作為新工單建立
        result.itemsToCreate.push({
          itemTitle: parsed.charterUpdate.itemTitle || '專案章程 (Project Charter)',
          itemType: 'Charter',
          itemPriority: 'High',
          description: parsed.charterUpdate.markdownContent,
          sectionTitle: '🏛️ 專案章程 (Charter)'
        })
      }

      if (parsed.newItems && Array.isArray(parsed.newItems)) {
        for (const itm of parsed.newItems) {
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
