import { AgentContext, SubAgentResult } from './types.js'

/**
 * Decision Specialist (Meetings, ADRs, Bottlenecks & Horizontal Graph Relations)
 * 專精領域：
 * 1. 會議記錄 (Meeting) 紀要結構化與 Action Items 關聯
 * 2. 架構決策記錄 (Decision / ADR)：背景、候選方案權衡、拍板結論
 * 3. 技術阻礙與風險 (Bottleneck)：現象、根因剖析、緩解對策
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
    const isDecisionRelevant = /(?:meeting|會議|recap|紀要|開會|決策|decision|adr|架構決策|拍板|共識|bottleneck|瓶頸|阻礙|卡住|風險|依賴|blocks|discusses)/i.test(ctx.message)

    if (!isDecisionRelevant) {
      result.rationale = '用戶指令未涉及會議、架構決策或瓶頸風險，跳過決策專家處理。'
      return result
    }

    result.rationale = '已識別會議/決策/風險需求，負責產生 Meeting、Decision、Bottleneck 及水平關係網 (discusses, blocks)。'
    return result
  } catch (err: any) {
    result.error = err.message
    return result
  }
}
