export interface RemarkEntry {
  timestamp: string;
  user: string;
  text: string;
  action?: string;
}

export interface Project {
  id: string;
  product_id: string;
  name: string;
  type: string;
  phase_number: number | null;
  status: string;
  end_date: string | null;
  priority: string;
  created_at: string;
}

export interface Task {
  id: string;
  product_id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';
  nature: string | null;
  priority: string | null;
  urgency: string | null;
  due_date: string | null;
  related_meeting_id: string | null;
  bottleneck_id: string | null;
  reopen_count: number;
  assignees: string[];
  remarks: RemarkEntry[];
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  product_id: string;
  project_id: string;
  title: string;
  meeting_date: string;
  recap_done: boolean;
  summary: string | null;
  content: string; // The 5-column Markdown grid
  host: string | null;
  file_path: string | null;
  remarks: RemarkEntry[];
  created_at: string;
  updated_at: string;
}

export interface ChatHistory {
  id: string;
  session_id: string;
  sender: 'user' | 'assistant';
  message: string;
  created_at: string;
}

export interface Charter {
  id: string;
  project_id: string;
  title: string;
  content: {
    goals?: string;
    scope?: string;
    out_of_scope?: string;
    w5h2?: {
      who?: string;
      why?: string;
      how?: string;
      what?: string;
      when?: string;
      where?: string;
      how_much?: string;
    };
  };
  remarks: RemarkEntry[];
  created_at: string;
  updated_at: string;
}

export interface Requirement {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  remarks: RemarkEntry[];
  created_at: string;
  updated_at: string;
}

export interface ProjectPlan {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  milestone_date: string;
  r_assignees: string[];
  a_assignees: string[];
  c_assignees: string[];
  i_assignees: string[];
  remarks: RemarkEntry[];
  created_at: string;
  updated_at: string;
}

export interface TraceabilityLink {
  id: string;
  project_id: string;
  requirement_id: string;
  task_id: string;
  requirement_title?: string;
  task_title?: string;
  created_at: string;
}

export interface Bottleneck {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  severity: 'High' | 'Medium' | 'Low';
  status: string;
  remarks: RemarkEntry[];
  created_at: string;
  updated_at: string;
}

export interface KnowledgeNote {
  id: string;
  product_id: string;
  project_id: string | null;
  term: string;
  definition: string;
  kpi_formula: string | null;
  tag: string | null;
  url: string | null;
  status: string;
  remarks: RemarkEntry[];
  created_at: string;
  updated_at: string;
}

export interface ToolProposal {
  id: string; // Generated on the fly by backend to reference in HITL flow
  type: 'create_new_log' | 'update_existing_log' | 'upsert_charter' | 'create_requirement' | 'update_requirement' | 'upsert_project_plan' | 'create_traceability_link' | 'create_bottleneck' | 'learn_project_knowledge';
  targetType: 'task' | 'meeting' | 'charter' | 'requirement' | 'plan' | 'traceability' | 'bottleneck' | 'knowledge';
  targetId?: string; // Present for updates
  before?: any;
  after: any;
  reason: string;
}
