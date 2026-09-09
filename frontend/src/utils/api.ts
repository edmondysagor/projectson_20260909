const rawApiUrl = (import.meta.env.VITE_API_URL || 'https://projectson-923554069100.asia-southeast1.run.app').replace(/\/$/, '');
export const API_BASE = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;

export interface RemarkEntry {
  timestamp: string;
  user: string;
  text: string;
  action?: string;
}

export interface Workspace {
  workspace_id: number;
  prefix_code: string;
  workspace_name: string;
  workspace_created_at: string;
  last_item_number?: number;
}

export interface Member {
  member_id: number;
  member_name: string;
  member_email: string | null;
  member_role: string | null;
  member_ad_group: string | null;
  member_status: string | null;
  member_created_at: string;
  member_updated_at: string;
}

export interface ProjectContext {
  id: number; // e.g. 1
  content_name: string;
  content_display_id: string; // e.g. AAP-COT-1
  content_type: 'Project' | 'Product';
  related_workspace_id: number | null;
  parent_content_id: string | null;
  content_status: 'Pipeline' | 'Active' | 'On Hold' | 'Completed' | 'Abandoned';
  project_type: 'Null' | 'Phase' | 'BAU' | null;
  project_type_sequence: number | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  content: any; // JSONB
  content_created_at: string;
  updated_at: string;
  content_update_log: RemarkEntry[];

  // Compatibility fields for old UI components
  name: string;
  type: string;
  phase_number: number | null;
  status: string;
  priority: string;
  business_owner: string | null;
  tech_owner: string | null;
  product_vision: string | null;
  product_id: string;
  end_date: string | null;
  remarks: RemarkEntry[];
  created_at: string;
}

export interface ProjectItem {
  id: any; // Allow either string or number to prevent comparison errors
  item_display_id: string; // e.g. AAP-083
  item_title: string;
  related_context_id: number;
  parent_item_id: number | string | null;
  related_item_id_relation: { target_id: any, relation: string }[];
  item_type: 'Epic' | 'Task' | 'Event' | 'Micro Task' | 'Meeting' | 'Bottleneck' | 'Knowledge' | 'Casual Note' | 'Bug' | 'UAT' | 'Deploy';
  item_status: 'Not Start' | 'Ready' | 'In Progress' | 'Stuck' | 'Review' | 'Completed' | 'Closed' | 'Backlog';
  item_priority: 'High' | 'Middle' | 'Low';
  item_planned_start_date: string | null;
  item_planned_end_date: string | null;
  item_actual_start_date: string | null;
  item_actual_end_date: string | null;
  item_follow_by: number | null;
  item_assigned_by: number | null;
  item_content: any; // JSONB properties
  item_attribute?: any;
  item_comment: any[]; // JSONB array
  item_created_at: string;
  item_updated_at: string;
  item_update_log: RemarkEntry[];

  // Compatibility fields mapping for old UI components
  title: string;
  description: string;
  status: any; // Compatibility with both Task/Meeting/Bottleneck/Knowledge statuses
  nature: string;
  priority: string;
  urgency: string;
  due_date: string | null;
  related_meeting_id: string | null;
  bottleneck_id: string | null;
  reopen_count: number;
  assignees: string[];
  remarks: RemarkEntry[];

  meeting_date: string;
  recap_done: boolean;
  summary: string;
  content: string;
  host: string | null;
  file_path: string | null;

  severity: 'High' | 'Middle' | 'Low';

  term: string;
  definition: string;
  kpi_formula: string | null;
  tag: string | null;
  url: string | null;
  workspace_id?: any;
  project_id: any;
  product_id: any;
  created_at: string;
  updated_at: string;
}


export type Project = ProjectContext;
export type Product = ProjectContext;
export type Task = ProjectItem;
export type Meeting = ProjectItem;
export type Bottleneck = ProjectItem;
export type KnowledgeNote = ProjectItem;

export interface ChatMessage {
  id?: string;
  sender: 'user' | 'assistant';
  message: string;
  created_at: string;
}

export interface ToolProposal {
  id: string;
  type: 'create_new_log' | 'update_existing_log' | 'upsert_charter' | 'create_requirement' | 'update_requirement' | 'upsert_project_plan' | 'create_traceability_link' | 'create_bottleneck' | 'learn_project_knowledge';
  targetType: 'task' | 'meeting' | 'charter' | 'requirement' | 'plan' | 'traceability' | 'bottleneck' | 'knowledge';
  targetId?: string;
  before?: any;
  after: any;
  reason: string;
}

export const api = {
  getWorkspaces: async (): Promise<Workspace[]> => {
    const res = await fetch(`${API_BASE}/workspaces`);
    if (!res.ok) throw new Error('Failed to fetch workspaces');
    return res.json();
  },

  createWorkspace: async (data: Partial<Workspace>): Promise<Workspace> => {
    const res = await fetch(`${API_BASE}/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create workspace');
    return res.json();
  },

  updateWorkspace: async (id: any, data: Partial<Workspace>): Promise<Workspace> => {
    const res = await fetch(`${API_BASE}/workspaces/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update workspace');
    return res.json();
  },

  deleteWorkspace: async (id: any): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_BASE}/workspaces/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete workspace');
    return res.json();
  },

  getMembers: async (): Promise<Member[]> => {
    const res = await fetch(`${API_BASE}/members`);
    if (!res.ok) throw new Error('Failed to fetch members');
    return res.json();
  },

  createMember: async (data: Partial<Member>): Promise<Member> => {
    const res = await fetch(`${API_BASE}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create member');
    return res.json();
  },

  updateMember: async (id: any, data: Partial<Member>): Promise<Member> => {
    const res = await fetch(`${API_BASE}/members/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update member');
    return res.json();
  },

  deleteMember: async (id: any): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_BASE}/members/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete member');
    return res.json();
  },

  // Projects API
  getProjects: async (): Promise<ProjectContext[]> => {
    const res = await fetch(`${API_BASE}/projects`);
    if (!res.ok) throw new Error('Failed to fetch projects');
    const data: ProjectContext[] = await res.json();
    return data.map(item => ({
      ...item,
      name: item.content_name,
      type: item.project_type || 'Phase',
      phase_number: item.project_type_sequence,
      status: item.content_status,
      priority: 'Medium',
      end_date: item.planned_end_date,
      business_owner: 'Unassigned',
      tech_owner: 'Unassigned',
      product_vision: '',
      product_id: item.parent_content_id || '',
      remarks: item.content_update_log || [],
      created_at: item.content_created_at
    }));
  },

  createProject: async (data: Partial<ProjectContext>): Promise<ProjectContext> => {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create project');
    return res.json();
  },

  updateProject: async (id: any, data: Partial<ProjectContext>): Promise<ProjectContext> => {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update project');
    return res.json();
  },

  deleteProject: async (id: any): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete project');
    return res.json();
  },

  copyProjectTasks: async (targetProjectId: any, sourceProjectId: any): Promise<{ success: boolean, count: number, message: string }> => {
    const res = await fetch(`${API_BASE}/templates/copy-tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetProjectId, sourceProjectId })
    });
    if (!res.ok) throw new Error('Failed to copy template tasks');
    return res.json();
  },

  deleteItem: async (id: string): Promise<{ success: boolean }> => {
    // Both Tasks and Meetings use the same project_item table and the DELETE /api/tasks/:id route deletes any project_item
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete item');
    return res.json();
  },

  // Products API
  getProducts: async (): Promise<ProjectContext[]> => {
    const res = await fetch(`${API_BASE}/products`);
    if (!res.ok) throw new Error('Failed to fetch products');
    const data: ProjectContext[] = await res.json();
    return data.map(item => ({
      ...item,
      name: item.content_name,
      type: 'Product',
      status: item.content_status,
      priority: 'Medium',
      phase_number: null,
      business_owner: item.content?.business_owner || 'Eric (CED AM)',
      tech_owner: item.content?.tech_owner || 'Paul',
      product_vision: item.content?.product_vision || '',
      remarks: item.content_update_log || [],
      created_at: item.content_created_at,
      product_id: '',
      end_date: null
    }));
  },

  createProduct: async (data: Partial<ProjectContext> & { remarks_entry?: string }): Promise<ProjectContext> => {
    const res = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create product');
    return res.json();
  },

  updateProduct: async (id: any, data: Partial<ProjectContext> & { remarks_entry?: string }): Promise<ProjectContext> => {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update product');
    return res.json();
  },

  deleteProduct: async (id: any): Promise<{ message: string; product: ProjectContext }> => {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete product');
    return res.json();
  },

  // Meetings API
  getMeetings: async (): Promise<ProjectItem[]> => {
    const res = await fetch(`${API_BASE}/meetings`);
    if (!res.ok) throw new Error('Failed to fetch meetings');
    const data: ProjectItem[] = await res.json();
    return data.map(item => ({
      ...item,
      id: String(item.id), // String compatibility
      title: item.item_title,
      meeting_date: item.item_planned_start_date || item.item_created_at,
      recap_done: item.item_status === 'Completed',
      summary: item.item_attribute?.summary || item.item_content?.summary || '',
      content: item.item_content?.content || '',
      host: item.item_attribute?.host || 'Edmond Chan',
      remarks: item.item_update_log || [],
      project_id: item.related_context_id,
      product_id: '',
      created_at: item.item_created_at,
      updated_at: item.item_updated_at || item.item_created_at,
      status: 'DONE',
      description: '',
      nature: 'Meeting',
      priority: 'Middle',
      urgency: '非緊急',
      due_date: null,
      assignees: item.item_attribute?.assignees || [],
      host_name: item.item_attribute?.host || 'Edmond Chan',
      file_path: item.item_attribute?.file_path || null,
      severity: 'Middle',
      term: '',
      definition: '',
      kpi_formula: null,
      tag: null,
      url: null
    }));
  },

  createMeeting: async (data: Partial<ProjectItem> & { remarks_entry?: string }): Promise<ProjectItem> => {
    const res = await fetch(`${API_BASE}/meetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create meeting');
    return res.json();
  },

  updateMeeting: async (id: any, data: Partial<ProjectItem> & { remarks_entry?: string }): Promise<ProjectItem> => {
    const res = await fetch(`${API_BASE}/meetings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update meeting');
    return res.json();
  },

  // Tasks API
  getTasks: async (): Promise<ProjectItem[]> => {
    const res = await fetch(`${API_BASE}/tasks`);
    if (!res.ok) throw new Error('Failed to fetch tasks');
    const data: ProjectItem[] = await res.json();
    return data.map(item => ({
      ...item,
      id: String(item.id), // String compatibility
      title: item.item_title,
      description: item.item_content?.description || '',
      status: item.item_status === 'Completed' ? 'DONE' : item.item_status === 'In Progress' ? 'IN_PROGRESS' : item.item_status === 'Stuck' ? 'BLOCKED' : 'TODO',
      nature: item.item_type,
      priority: item.item_priority,
      urgency: item.item_priority === 'High' ? '緊急' : '非緊急',
      due_date: item.item_planned_end_date,
      assignees: item.item_attribute?.assignees || [],
      remarks: item.item_update_log || [],
      project_id: item.related_context_id,
      product_id: '',
      created_at: item.item_created_at,
      updated_at: item.item_updated_at || item.item_created_at,
      meeting_date: '',
      recap_done: false,
      summary: '',
      content: '',
      host: null,
      file_path: null,
      severity: 'Middle',
      term: '',
      definition: '',
      kpi_formula: null,
      tag: null,
      url: null
    }));
  },

  createTask: async (data: Partial<ProjectItem> & { remarks_entry?: string }): Promise<ProjectItem> => {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create task');
    return res.json();
  },

  updateTask: async (id: any, data: Partial<ProjectItem> & { remarks_entry?: string }): Promise<ProjectItem> => {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update task');
    return res.json();
  },






  // Plans / RACI API



  // Traceability Link API


  deleteTraceability: async (id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_BASE}/traceability/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to unlink traceability mapping');
    return res.json();
  },


  // Bottlenecks API
  getBottlenecks: async (): Promise<ProjectItem[]> => {
    const res = await fetch(`${API_BASE}/bottlenecks`);
    if (!res.ok) throw new Error('Failed to fetch bottlenecks');
    const data: ProjectItem[] = await res.json();
    return data.map(item => ({
      ...item,
      id: String(item.id),
      title: item.item_title,
      description: item.item_content?.description || '',
      severity: (item.item_priority === 'Middle' ? 'Middle' : item.item_priority) || 'Middle',
      status: item.item_status,
      remarks: item.item_update_log || [],
      project_id: item.related_context_id,
      created_at: item.item_created_at,
      updated_at: item.item_updated_at || item.item_created_at,
      meeting_date: '',
      recap_done: false,
      summary: '',
      content: '',
      host: null,
      file_path: null,
      term: '',
      definition: '',
      kpi_formula: null,
      tag: null,
      url: null,
      product_id: '',
      nature: 'Bottleneck',
      priority: 'High',
      urgency: '緊急',
      due_date: null,
      assignees: []
    }));
  },

  createBottleneck: async (data: Partial<ProjectItem> & { remarks_entry?: string }): Promise<ProjectItem> => {
    const res = await fetch(`${API_BASE}/bottlenecks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create bottleneck');
    return res.json();
  },

  updateBottleneck: async (id: any, data: Partial<ProjectItem> & { remarks_entry?: string }): Promise<ProjectItem> => {
    const res = await fetch(`${API_BASE}/bottlenecks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update bottleneck');
    return res.json();
  },

  // Knowledge Note API
  getKnowledge: async (): Promise<ProjectItem[]> => {
    const res = await fetch(`${API_BASE}/knowledge`);
    if (!res.ok) throw new Error('Failed to fetch glossary dictionary');
    const data: ProjectItem[] = await res.json();
    return data.map(item => ({
      ...item,
      id: String(item.id),
      term: item.item_title,
      definition: item.item_content?.definition || '',
      kpi_formula: item.item_attribute?.kpi_formula || item.item_content?.kpi_formula || null,
      tag: item.item_attribute?.tag || item.item_content?.tag || null,
      url: item.item_attribute?.url || item.item_content?.url || null,
      status: item.item_status,
      remarks: item.item_update_log || [],
      project_id: item.related_context_id,
      created_at: item.item_created_at,
      updated_at: item.item_updated_at || item.item_created_at,
      title: item.item_title,
      description: '',
      meeting_date: '',
      recap_done: false,
      summary: '',
      content: '',
      host: null,
      file_path: null,
      severity: 'Low',
      product_id: '',
      nature: 'Knowledge',
      priority: 'Low',
      urgency: '非緊急',
      due_date: null,
      assignees: []
    }));
  },

  createKnowledge: async (data: Partial<ProjectItem> & { remarks_entry?: string }): Promise<ProjectItem> => {
    const res = await fetch(`${API_BASE}/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to record term definition');
    return res.json();
  },

  updateKnowledge: async (id: any, data: Partial<ProjectItem> & { remarks_entry?: string }): Promise<ProjectItem> => {
    const res = await fetch(`${API_BASE}/knowledge/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to edit term definition');
    return res.json();
  },

  // Agent API
  getChatHistory: async (): Promise<ChatMessage[]> => {
    const res = await fetch(`${API_BASE}/agent/chat-history`);
    if (!res.ok) throw new Error('Failed to fetch chat history');
    return res.json();
  },

  parseTranscript: async (message: string, sessionId = 'default-session'): Promise<{ proposals: ToolProposal[], chatMessage: ChatMessage }> => {
    const res = await fetch(`${API_BASE}/agent/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, session_id: sessionId }),
    });
    if (!res.ok) throw new Error('Failed to parse transcript');
    return res.json();
  },

  // Proposals API
  acceptProposal: async (proposal: ToolProposal): Promise<{ success: boolean, record: any }> => {
    const res = await fetch(`${API_BASE}/proposals/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposal }),
    });
    if (!res.ok) throw new Error('Failed to accept proposal');
    return res.json();
  }
};

// Templates API
export const getTemplates = async (workspaceId: number, targetType?: string) => {
  let url = `${API_BASE}/templates?workspaceId=${workspaceId}`;
  if (targetType) url += `&targetType=${targetType}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch templates');
  return res.json();
};

export const createTemplate = async (templateData: any) => {
  const res = await fetch(`${API_BASE}/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(templateData)
  });
  if (!res.ok) throw new Error('Failed to create template');
  return res.json();
};

export const updateTemplate = async (id: string, templateData: any) => {
  const res = await fetch(`${API_BASE}/templates/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(templateData)
  });
  if (!res.ok) throw new Error('Failed to update template');
  return res.json();
};

export const deleteTemplate = async (id: string) => {
  const res = await fetch(`${API_BASE}/templates/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete template');
  return res.json();
};

export const applyTemplate = async (templateId: string, projectId: number, workspaceId: number) => {
  const res = await fetch(`${API_BASE}/templates/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId, projectId, workspaceId })
  });
  if (!res.ok) throw new Error('Failed to apply template');
  return res.json();
};

export const uploadFile = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });
  
  if (!res.ok) {
    throw new Error('Failed to upload file');
  }
  
  const data = await res.json();
  return data.url;
};

export const deleteFile = async (url: string): Promise<void> => {
  const res = await fetch(`${API_BASE}/upload`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });
  
  if (!res.ok) {
    throw new Error('Failed to delete file');
  }
};
