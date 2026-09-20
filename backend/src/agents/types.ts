export interface AgentContext {
  workspace_uid: string
  project_uid?: string
  workspaceInfo: {
    workspace_uid: string
    workspace_name: string
    prefix_code: string
    last_item_number?: number
    last_project_number?: number
  }
  projectsContext: any[]
  membersContext: any[]
  itemsContext: any[]
  mentionedItems: any[]
  currentProject: any | null
  message: string
  conversation_history?: any[]
  attachments?: any[]
  model?: string
  enable_thinking?: boolean
}

export interface PolymorphicRelation {
  item_uid: string
  relation: 'blocks' | 'covers' | 'deploys' | 'discusses' | 'causes'
}

export interface PolymorphicItemProposal {
  itemTitle: string
  itemType: 'Objective' | 'Requirement' | 'User story' | 'Task' | 'UAT' | 'Bug' | 'Decision' | 'Information' | 'Bottleneck' | 'Meeting' | 'Milestone' | 'Charter' | 'Epic' | 'Micro Task' | 'Deployment' | 'Event'
  itemPriority?: 'High' | 'Middle' | 'Low'
  itemFollowBy?: string
  parentItemUid?: string
  relationItemUid?: PolymorphicRelation[]
  description: string
  sectionTitle?: string
}

export interface PolymorphicItemUpdate {
  targetDisplayCode?: string
  targetItemUid?: string
  itemTitle: string
  updates: {
    item_content?: {
      text?: string
      description?: string
    } | string
    description?: string
    item_status?: 'Not Start' | 'Ready' | 'In Progress' | 'Blocked' | 'Review' | 'Completed' | 'Closed' | 'Backlog'
    item_priority?: 'High' | 'Middle' | 'Low'
    item_follow_by?: string
    parent_item_uid?: string
    relation_item_uid?: PolymorphicRelation[]
  }
  summary: string
}

export interface SubAgentResult {
  agentName: 'spine' | 'charter' | 'decision'
  agentTitle: string
  itemsToCreate: PolymorphicItemProposal[]
  itemsToUpdate: PolymorphicItemUpdate[]
  rationale: string
  error?: string
}

export interface SupervisorResult {
  unifiedActions: any[]
  critiqueNotes: string[]
  orphanParentsResolved: number
  duplicateItemsMerged: number
  cyclesRemoved: number
  primaryAction?: any
}
