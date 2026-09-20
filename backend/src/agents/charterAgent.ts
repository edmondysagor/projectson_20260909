import { AgentContext, SubAgentResult } from './types.js'

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
      /(?:kick-off|啟航|初始化|填寫|更新)/i.test(ctx.message)

    if (!isCharterRelevant) {
      result.rationale = '用戶指令未涉及 Charter 章程或 Information 規格文件，跳過章程專家處理。'
      return result
    }

    result.rationale = '已識別章程與範疇需求，負責維護 Charter 表格結構與 Information 文件。'
    return result
  } catch (err: any) {
    result.error = err.message
    return result
  }
}
