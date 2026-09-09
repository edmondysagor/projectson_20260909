const rawApiUrl = (import.meta.env.VITE_API_URL || 'https://projectson-923554069100.asia-southeast1.run.app').replace(/\/$/, '');
export const API_BASE = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;

export interface RemarkEntry {
  timestamp: string;
  user: string;
  text: string;
  action?: string;
}

export interface Workspace {
  workspace_id: any;
  workspace_uid?: string;
  prefix_code: string;
  workspace_name: string;
  workspace_created_at: string;
  last_item_number?: number;
  last_context_number?: number;
}

export interface Member {
  member_id: any;
  member_uid?: string;
  member_name: string;
  member_email: string | null;
  member_role: string | null;
  member_ad_group: string | null;
  member_status: string | null;
  member_created_at: string;
  member_updated_at: string;
}

export interface ProjectContext {
  id: any; // e.g. UUID or number
  context_uid?: string;
  context_display_code?: string;
  context_name?: string;
  context_number?: number;
  content_name: string;
  content_display_id: string; // e.g. AAP-COT-1
  content_type: 'Project' | 'Product';
  related_workspace_id: any;
  related_workspace_uid?: string;
  parent_content_id: string | null;
  parent_content_uid?: string | null;
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
  item_uid?: string;
  item_display_code?: string;
  item_display_id: string; // e.g. AAP-083
  item_title: string;
  related_context_id: any;
  related_context_uid?: string;
  parent_item_id: number | string | null;
  parent_item_uid?: string | null;
  related_item_id_relation: { target_id: any, relation: string }[];
  item_type: 'Epic' | 'Task' | 'Event' | 'Micro Task' | 'Meeting' | 'Bottleneck' | 'Knowledge' | 'Casual Note' | 'Bug' | 'UAT' | 'Deploy';
  item_status: 'Not Start' | 'Ready' | 'In Progress' | 'Stuck' | 'Review' | 'Completed' | 'Closed' | 'Backlog';
  item_priority: 'High' | 'Middle' | 'Low';
  item_planned_start_date: string | null;
  item_planned_end_date: string | null;
  item_actual_start_date: string | null;
  item_actual_end_date: string | null;
  item_follow_by: any;
  item_assigned_by: any;
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
  workspace_uid?: any;
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
    const data: any[] = await res.json();
    return data.map(item => ({
      ...item,
      workspace_id: item.workspace_uid || item.workspace_id || item.id,
      workspace_uid: item.workspace_uid || item.workspace_id || item.id,
      prefix_code: item.prefix_code || 'AAP',
      workspace_name: item.workspace_name || 'Default Workspace',
      workspace_created_at: item.workspace_created_at || item.created_at || new Date().toISOString(),
      last_item_number: item.last_item_number || 0,
      last_context_number: item.last_context_number || 0
    }));
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
    const data: any[] = await res.json();
    return data.map(item => ({
      ...item,
      member_id: item.member_uid || item.member_id || item.id,
      member_uid: item.member_uid || item.member_id || item.id,
      member_name: item.member_name || 'Unknown Member',
      member_email: item.member_email || null,
      member_role: item.member_role || 'Member',
      member_ad_group: item.member_ad_group || null,
      member_status: item.member_status || 'Active',
      member_created_at: item.created_at || item.member_created_at || new Date().toISOString(),
      member_updated_at: item.updated_at || item.member_updated_at || new Date().toISOString()
    }));
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
    const data: any[] = await res.json();
    return data.map(item => {
      const displayCode = item.context_display_code || item.content_display_id || (item.context_number ? `COT-${item.context_number}` : `PROJECT-${item.context_uid || item.id}`);
      const name = item.context_name || item.content_name || 'Untitled Project';
      const wsId = item.related_workspace_uid || item.related_workspace_id || item.workspace_id || null;
      const parentId = item.parent_content_uid || item.parent_content_id || null;
      const status = item.context_status || item.content_status || 'Active';
      const createdAt = item.created_at || item.content_created_at || new Date().toISOString();
      const updatedAt = item.updated_at || createdAt;

      return {
        ...item,
        id: item.context_uid || item.id,
        context_uid: item.context_uid || item.id,
        context_display_code: displayCode,
        content_display_id: displayCode,
        context_name: name,
        content_name: name,
        name: name,
        type: item.project_type || item.content_type || 'Phase',
        content_type: 'Project',
        phase_number: item.project_type_sequence,
        status: status,
        content_status: status,
        priority: 'Medium',
        end_date: item.planned_end_date,
        business_owner: item.content?.business_owner || 'Unassigned',
        tech_owner: item.content?.tech_owner || 'Unassigned',
        product_vision: '',
        product_id: parentId || '',
        parent_content_id: parentId,
        parent_content_uid: parentId,
        related_workspace_id: wsId,
        related_workspace_uid: wsId,
        remarks: item.content_update_log || [],
        created_at: createdAt,
        content_created_at: createdAt,
        updated_at: updatedAt
      };
    });
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
    const data: any[] = await res.json();
    return data.map(item => {
      const displayCode = item.context_display_code || item.content_display_id || (item.context_number ? `COT-${item.context_number}` : `PRODUCT-${item.context_uid || item.id}`);
      const name = item.context_name || item.content_name || 'Untitled Product';
      const wsId = item.related_workspace_uid || item.related_workspace_id || item.workspace_id || null;
      const status = item.context_status || item.content_status || 'Active';
      const createdAt = item.created_at || item.content_created_at || new Date().toISOString();
      const updatedAt = item.updated_at || createdAt;

      return {
        ...item,
        id: item.context_uid || item.id,
        context_uid: item.context_uid || item.id,
        context_display_code: displayCode,
        content_display_id: displayCode,
        context_name: name,
        content_name: name,
        name: name,
        type: 'Product',
        content_type: 'Product',
        status: status,
        content_status: status,
        priority: 'Medium',
        phase_number: null,
        business_owner: item.content?.business_owner || 'Eric (CED AM)',
        tech_owner: item.content?.tech_owner || 'Paul',
        product_vision: item.content?.product_vision || '',
        remarks: item.content_update_log || [],
        created_at: createdAt,
        content_created_at: createdAt,
        updated_at: updatedAt,
        product_id: '',
        parent_content_id: null,
        parent_content_uid: null,
        related_workspace_id: wsId,
        related_workspace_uid: wsId,
        end_date: null
      };
    });
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
    const data: any[] = await res.json();
    return data.map(item => {
      const id = String(item.item_uid || item.id);
      const displayCode = item.item_display_code || item.item_display_id || (item.item_number ? `AAP-${String(item.item_number).padStart(3, '0')}` : `MEETING-${id.substring(0, 8)}`);
      const title = item.item_title || item.title || 'Untitled Meeting';
      const ctxId = item.related_context_uid || item.related_context_id || item.project_id || '';
      const wsId = item.workspace_uid || item.workspace_id || '';
      const createdAt = item.created_at || item.item_created_at || new Date().toISOString();
      const updatedAt = item.updated_at || item.item_updated_at || createdAt;

      return {
        ...item,
        id: id,
        item_uid: id,
        item_display_code: displayCode,
        item_display_id: displayCode,
        item_title: title,
        title: title,
        related_context_id: ctxId,
        related_context_uid: ctxId,
        project_id: ctxId,
        workspace_id: wsId,
        workspace_uid: wsId,
        parent_item_id: item.parent_item_uid || item.parent_item_id || null,
        parent_item_uid: item.parent_item_uid || item.parent_item_id || null,
        item_type: 'Meeting',
        item_status: item.item_status || 'Completed',
        item_priority: item.item_priority || 'Middle',
        item_planned_start_date: item.item_planned_start_date || null,
        item_planned_end_date: item.item_planned_end_date || null,
        item_actual_start_date: item.item_actual_start_date || null,
        item_actual_end_date: item.item_actual_end_date || null,
        item_follow_by: item.item_follow_by || null,
        item_assigned_by: item.item_assigned_by || null,
        item_content: item.item_content || {},
        item_attribute: item.item_attribute || {},
        item_comment: item.item_comment || [],
        item_update_log: item.item_update_log || [],
        meeting_date: item.item_planned_start_date || createdAt,
        recap_done: item.item_status === 'Completed',
        summary: item.item_attribute?.summary || item.item_content?.summary || '',
        content: item.item_content?.content || '',
        host: item.item_attribute?.host || 'Edmond Chan',
        remarks: item.item_update_log || [],
        product_id: '',
        created_at: createdAt,
        item_created_at: createdAt,
        updated_at: updatedAt,
        item_updated_at: updatedAt,
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
      };
    });
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
    const data: any[] = await res.json();
    return data.map(item => {
      const id = String(item.item_uid || item.id);
      const displayCode = item.item_display_code || item.item_display_id || (item.item_number ? `AAP-${String(item.item_number).padStart(3, '0')}` : `TASK-${id.substring(0, 8)}`);
      const title = item.item_title || item.title || item.term || 'Untitled Task';
      const ctxId = item.related_context_uid || item.related_context_id || item.project_id || '';
      const wsId = item.workspace_uid || item.workspace_id || '';
      const createdAt = item.created_at || item.item_created_at || new Date().toISOString();
      const updatedAt = item.updated_at || item.item_updated_at || createdAt;

      return {
        ...item,
        id: id,
        item_uid: id,
        item_display_code: displayCode,
        item_display_id: displayCode,
        item_title: title,
        title: title,
        related_context_id: ctxId,
        related_context_uid: ctxId,
        project_id: ctxId,
        workspace_id: wsId,
        workspace_uid: wsId,
        parent_item_id: item.parent_item_uid || item.parent_item_id || null,
        parent_item_uid: item.parent_item_uid || item.parent_item_id || null,
        item_type: item.item_type || 'Task',
        item_status: item.item_status || 'Not Start',
        item_priority: item.item_priority || 'Middle',
        item_planned_start_date: item.item_planned_start_date || null,
        item_planned_end_date: item.item_planned_end_date || null,
        item_actual_start_date: item.item_actual_start_date || null,
        item_actual_end_date: item.item_actual_end_date || null,
        item_follow_by: item.item_follow_by || null,
        item_assigned_by: item.item_assigned_by || null,
        item_content: item.item_content || {},
        item_attribute: item.item_attribute || {},
        item_comment: item.item_comment || [],
        item_update_log: item.item_update_log || [],
        description: item.item_content?.description || '',
        status: item.item_status === 'Completed' ? 'DONE' : item.item_status === 'In Progress' ? 'IN_PROGRESS' : item.item_status === 'Stuck' ? 'BLOCKED' : 'TODO',
        nature: item.item_type || 'Task',
        priority: item.item_priority || 'Middle',
        urgency: item.item_priority === 'High' ? '緊急' : '非緊急',
        due_date: item.item_planned_end_date,
        assignees: item.item_attribute?.assignees || [],
        remarks: item.item_update_log || [],
        product_id: '',
        created_at: createdAt,
        item_created_at: createdAt,
        updated_at: updatedAt,
        item_updated_at: updatedAt,
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
      };
    });
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
    const data: any[] = await res.json();
    return data.map(item => {
      const id = String(item.item_uid || item.id);
      const displayCode = item.item_display_code || item.item_display_id || (item.item_number ? `AAP-${String(item.item_number).padStart(3, '0')}` : `BOTTLENECK-${id.substring(0, 8)}`);
      const title = item.item_title || item.title || 'Untitled Bottleneck';
      const ctxId = item.related_context_uid || item.related_context_id || item.project_id || '';
      const wsId = item.workspace_uid || item.workspace_id || '';
      const createdAt = item.created_at || item.item_created_at || new Date().toISOString();
      const updatedAt = item.updated_at || item.item_updated_at || createdAt;

      return {
        ...item,
        id: id,
        item_uid: id,
        item_display_code: displayCode,
        item_display_id: displayCode,
        item_title: title,
        title: title,
        related_context_id: ctxId,
        related_context_uid: ctxId,
        project_id: ctxId,
        workspace_id: wsId,
        workspace_uid: wsId,
        parent_item_id: item.parent_item_uid || item.parent_item_id || null,
        parent_item_uid: item.parent_item_uid || item.parent_item_id || null,
        item_type: 'Bottleneck',
        item_status: item.item_status || 'Active',
        item_priority: item.item_priority || 'High',
        item_planned_start_date: item.item_planned_start_date || null,
        item_planned_end_date: item.item_planned_end_date || null,
        item_actual_start_date: item.item_actual_start_date || null,
        item_actual_end_date: item.item_actual_end_date || null,
        item_follow_by: item.item_follow_by || null,
        item_assigned_by: item.item_assigned_by || null,
        item_content: item.item_content || {},
        item_attribute: item.item_attribute || {},
        item_comment: item.item_comment || [],
        item_update_log: item.item_update_log || [],
        description: item.item_content?.description || '',
        severity: (item.item_priority === 'Middle' ? 'Middle' : item.item_priority) || 'Middle',
        status: item.item_status || 'Active',
        remarks: item.item_update_log || [],
        created_at: createdAt,
        item_created_at: createdAt,
        updated_at: updatedAt,
        item_updated_at: updatedAt,
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
      };
    });
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
    const data: any[] = await res.json();
    return data.map(item => {
      const id = String(item.item_uid || item.id);
      const displayCode = item.item_display_code || item.item_display_id || (item.item_number ? `AAP-${String(item.item_number).padStart(3, '0')}` : `GLOSSARY-${id.substring(0, 8)}`);
      const title = item.item_title || item.title || item.term || 'Untitled Term';
      const ctxId = item.related_context_uid || item.related_context_id || item.project_id || '';
      const wsId = item.workspace_uid || item.workspace_id || '';
      const createdAt = item.created_at || item.item_created_at || new Date().toISOString();
      const updatedAt = item.updated_at || item.item_updated_at || createdAt;

      return {
        ...item,
        id: id,
        item_uid: id,
        item_display_code: displayCode,
        item_display_id: displayCode,
        item_title: title,
        title: title,
        term: title,
        related_context_id: ctxId,
        related_context_uid: ctxId,
        project_id: ctxId,
        workspace_id: wsId,
        workspace_uid: wsId,
        parent_item_id: item.parent_item_uid || item.parent_item_id || null,
        parent_item_uid: item.parent_item_uid || item.parent_item_id || null,
        item_type: 'Knowledge',
        item_status: item.item_status || 'Active',
        item_priority: item.item_priority || 'Low',
        item_planned_start_date: item.item_planned_start_date || null,
        item_planned_end_date: item.item_planned_end_date || null,
        item_actual_start_date: item.item_actual_start_date || null,
        item_actual_end_date: item.item_actual_end_date || null,
        item_follow_by: item.item_follow_by || null,
        item_assigned_by: item.item_assigned_by || null,
        item_content: item.item_content || {},
        item_attribute: item.item_attribute || {},
        item_comment: item.item_comment || [],
        item_update_log: item.item_update_log || [],
        definition: item.item_content?.definition || '',
        kpi_formula: item.item_attribute?.kpi_formula || item.item_content?.kpi_formula || null,
        tag: item.item_attribute?.tag || item.item_content?.tag || null,
        url: item.item_attribute?.url || item.item_content?.url || null,
        status: item.item_status || 'Active',
        remarks: item.item_update_log || [],
        created_at: createdAt,
        item_created_at: createdAt,
        updated_at: updatedAt,
        item_updated_at: updatedAt,
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
      };
    });
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
