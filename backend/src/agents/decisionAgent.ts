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
 * Decision Specialist (Meetings, ADRs, Bottlenecks & Horizontal Graph Relations)
 * 專精領域：
 * 1. 會議記錄 (Meeting) 紀要結構化與 Action Items 關聯 (discusses)
 * 2. 架構決策記錄 (Decision / ADR)：背景、候選方案權衡、拍板結論 (支援範本格式嗅探)
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

    // 嗅探專案既有 Decision 或 Meeting 的範本樣式
    const existingDecision = (ctx.itemsContext || []).find(i => i.item_type === 'Decision')
    const existingMeeting = (ctx.itemsContext || []).find(i => i.item_type === 'Meeting')

    let templateGuidance = ''
    if (existingDecision) {
      const decText = extractTextContent(existingDecision)
      if (decText.length > 20) {
        templateGuidance += `\n【專案既有 Decision (ADR) 範本風格參考】：\n${decText.slice(0, 300)}\n`
      }
    }
    if (existingMeeting) {
      const mtgText = extractTextContent(existingMeeting)
      if (mtgText.length > 20) {
        templateGuidance += `\n【專案既有 Meeting 會議範本風格參考】：\n${mtgText.slice(0, 300)}\n`
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

    const systemPrompt = `你是一個資深的技術決策顧問與風險專家 (Decision & Risk Specialist)。
你的核心任務是從用戶提供的專案文件、會議記錄或指令中，提煉出結構化的會議記錄 (Meeting)、架構決策 (Decision/ADR) 與技術瓶頸風險 (Bottleneck)，並標註水平關聯網絡 (discusses, blocks, causes)。

【工單類型與格式規範 (Candidate Recommendations Only)】：
1. 📅 'Meeting' (會議記錄候選)：
   包含出席人員、會議日期、核心共識、Action Items 表格。
2. ⚖️ 'Decision' (架構決策 ADR 候選)：
   🚨 必須在原文有明確拍板定案時才推薦！包含問題陳述、候選方案權衡表格 (Trade-offs Table)、拍板結論與核心論據。
3. ⚠️ 'Bottleneck' (技術阻礙與瓶頸候選)：
   🚨 核心禁令：嚴禁將「未定案之外部依賴 (Dependency)」或「技術未知數 (Technical Unknown)」自動升格為 Bottleneck！
   若原文明確說明 "It's a dependency / technical unknown, not yet a blocker"，絕對不可推薦為 Bottleneck！
${templateGuidance ? `\n【用戶專案自訂格式指引 (In-Context Template)】:\n${templateGuidance}\n🚨 請盡可能沿用用戶此專案既有的 Decision / Meeting 描述風格！` : ''}

【現有團隊成員清單】：
${memberNames.length > 0 ? memberNames.join(', ') : '暫無成員'}

【現有專案工單 (可作為 existing DB UID 參考，絕不可直接當作新建立ID)】：
${existingItems.length > 0 ? existingItems.join('\n') : '無現有工單'}

【工單標題與識別規範 (嚴格遵守)】：
- 標題必須為純文字（例如：'2026-09-20 系統第一期架構定案與章程確認會議'、'ADR-01: 資料庫選型'）。
- 嚴禁輸出多張零碎的 Meeting 工單！整個會議紀要只能建立 1 張核心 Meeting 工單。
- 嚴禁在標題中包含任何 Markdown 粗體語法（如 **）、前綴（如 Meeting:、Decision:）或 LaTeX 數學符號。
- 🚨 嚴禁在 relationItemUid 填寫文字標題！關聯僅可使用 targetCandidateId (如 CAND-01) 或現有工單 UUID！

【輸出格式規範】：
請輸出嚴格的 JSON 物件：
{
  "rationale": "簡要說明識別出的會議、架構決策或瓶頸風險",
  "items": [
    {
      "candidateId": "CAND-01",
      "itemTitle": "純文字工單標題 (例如：2026-09-20 啟航會議紀要)",
      "itemType": "Meeting" | "Decision" | "Bottleneck",
      "itemPriority": "High" | "Middle" | "Low",
      "itemFollowBy": "指派負責人姓名 (若有)",
      "proposedRelationships": [
        {
          "targetCandidateId": "同批候選ID如 CAND-01",
          "relationType": "discusses" | "blocks" | "causes"
        }
      ],
      "evidenceRefs": ["EV-01"],
      "description": "標準 Markdown 詳細內文與表格",
      "sectionTitle": "分類標題 (如：📅 會議與決策, ⚠️ 風險與阻礙)"
    }
  ]
}`

    const userPrompt = `【專案名稱】：${ctx.currentProject?.project_name || '當前專案'}
【用戶指令】：${ctx.message}
${attachedContent}

請輸出會議紀要、架構決策與風險瓶頸 JSON：`

    const parsed = await callSubAgentJson<{ rationale?: string; items?: any[] }>({
      systemPrompt,
      userPrompt,
      model: ctx.model,
      temperature: 0.2
    })

    if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
      result.itemsToCreate = parsed.items
        .filter((item: any) => {
          // 🚨 Safeguard: Drop fabricated Bottlenecks if title contains dependency or unknown
          if (item.itemType === 'Bottleneck' && /dependency|technical unknown|未知數|外部依賴/i.test(item.itemTitle || '')) {
            return false
          }
          return true
        })
        .map((item: any, idx: number) => ({
          ...item,
          candidateId: item.candidateId || `CAND-DEC-${String(idx + 1).padStart(2, '0')}`,
          parentItemUid: undefined, // 🚨 Prohibited in candidate layer
          relationItemUid: undefined // 🚨 Converted to proposedRelationships, no title IDs
        }))
      result.rationale = parsed.rationale || `決策專家已提煉 ${result.itemsToCreate.length} 項會議與決策候選。`
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
