import { AgentContext, SubAgentResult, PolymorphicItemProposal } from './types.js'

/**
 * Spine Specialist (5-Layer Traceability & Milestone Cluster)
 * 專精領域：
 * 1. 5 層核心追溯鏈：Objective ➔ Requirement ➔ User story ➔ Task ➔ UAT
 * 2. 專案里程碑 (Milestone)、史詩 (Epic)、子任務 (Micro Task)
 * 3. 負責人精準匹配與優先級評定
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
      /(?:kick-off|會議|recap|拆解|規劃|會議紀要|todo|action items)/i.test(ctx.message)

    if (!isSpineRelevant) {
      result.rationale = '用戶指令未涉及 5 層追溯鏈或里程碑，跳過骨幹專家處理。'
      return result
    }

    result.rationale = '已識別骨幹需求，負責規劃 5 層追溯鏈 (Objective, Requirement, User story, Task, UAT) 與 Milestone。'
    return result
  } catch (err: any) {
    result.error = err.message
    return result
  }
}
