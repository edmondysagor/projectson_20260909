import { AgentContext, SubAgentResult, SupervisorResult } from './types.js'
import { runSpineAgent } from './spineAgent.js'
import { runCharterAgent } from './charterAgent.js'
import { runDecisionAgent } from './decisionAgent.js'
import { auditAndSynthesizeProposals } from './supervisorCritic.js'

/**
 * Multi-Agent Orchestrator
 * 協同調度 3 大領域專家 (Spine, Charter, Decision) 並交由 Supervisor Critic 嚴格驗收
 */
export async function orchestrateMultiAgentPipeline(
  ctx: AgentContext,
  initialActionPreviews: any[] = []
): Promise<SupervisorResult> {
  // 並行派發給 3 大領域專家
  const [spineRes, charterRes, decisionRes] = await Promise.all([
    runSpineAgent(ctx),
    runCharterAgent(ctx),
    runDecisionAgent(ctx)
  ])

  const subAgentResults: SubAgentResult[] = [spineRes, charterRes, decisionRes]

  // 交給 Supervisor Critic 驗收與合流
  const supervisorOutcome = auditAndSynthesizeProposals(ctx, subAgentResults, initialActionPreviews)

  return supervisorOutcome
}
