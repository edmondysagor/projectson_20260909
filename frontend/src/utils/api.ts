// 統一 API Client 封裝
const API_BASE = import.meta.env.VITE_API_URL || 'https://certifyai-yes-college-git-923554069100.asia-southeast1.run.app';

export interface Workspace {
  workspace_uid: string;
  prefix_code: string;
  workspace_name: string;
  workspace_created_at: string;
  last_item_number: number;
  last_project_number: number;
  allow_access_member: Array<{ member_uid: string; role_in_this_workspace: string }>;
}

export interface Member {
  member_uid: string;
  member_name: string;
  member_email: string;
  member_ad_group?: string;
  member_status: string;
}

export interface Project {
  project_uid: string;
  project_name: string;
  project_display_code: string;
  project_number: number;
  project_type: 'Product' | 'Project';
  related_workspace_uid: string;
  parent_project_uid?: string;
  project_status: 'Pipeline' | 'Active' | 'On Hold' | 'Completed' | 'Abandoned';
  project_sub_type?: 'Phase' | 'BAU';
  project_type_sequence: number;
  project_owner?: string;
  owner_name?: string;
  workspace_name?: string;
  workspace_prefix?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  project_content: any;
  project_attribute?: any;
  allow_access_member?: Array<{ member_uid: string; role_in_this_workspace?: string } | string>;
  created_at: string;
  updated_at: string;
}

export interface ProjectItem {
  item_uid: string;
  item_display_code: string;
  prefix_code: string;
  item_number: number;
  item_title: string;
  related_project_uid: string;
  project_name?: string;
  project_display_code?: string;
  workspace_uid: string;
  workspace_name?: string;
  item_type: string;
  item_status: string;
  item_priority: 'High' | 'Middle' | 'Low';
  item_planned_start_date?: string;
  item_planned_end_date?: string;
  item_actual_start_date?: string;
  item_actual_end_date?: string;
  item_follow_by?: string;
  follow_by_name?: string;
  item_assigned_by?: string;
  assigned_by_name?: string;
  item_content: any;
  item_comment: any[];
  parent_item_uid?: string;
  parent_item_title?: string;
  parent_display_code?: string;
  relation_item_uid: Array<{ item_uid: string; relation: string }>;
  item_attribute: any;
  created_at: string;
  updated_at: string;
  inverse_relations?: Array<{ item_uid: string; item_display_code: string; item_title: string; item_type: string; relation: string; item_status: string }>;
  child_items?: Array<{ 
    item_uid: string; 
    item_display_code: string; 
    item_title: string; 
    item_type: string; 
    item_status: string; 
    item_priority: string;
    item_follow_by?: string;
    follow_by_name?: string;
  }>;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Workspaces
  getWorkspaces: () => request<Workspace[]>('/api/workspaces'),
  getWorkspace: (uid: string) => request<Workspace>(`/api/workspaces/${uid}`),
  createWorkspace: (data: { prefix_code: string; workspace_name: string }) =>
    request<Workspace>('/api/workspaces', { method: 'POST', body: JSON.stringify(data) }),
  updateWorkspace: (uid: string, data: Partial<Workspace>) =>
    request<Workspace>(`/api/workspaces/${uid}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWorkspace: (uid: string) =>
    request<{ message: string }>(`/api/workspaces/${uid}`, { method: 'DELETE' }),

  // Members
  getMembers: () => request<Member[]>('/api/members'),
  provisionMember: (data: { member_name: string; member_email?: string; member_ad_group?: string }) =>
    request<Member>('/api/members/provision', { method: 'POST', body: JSON.stringify(data) }),
  patchMember: (uid: string, updates: Partial<Member>) =>
    request<Member>(`/api/members/${uid}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteMember: (uid: string) =>
    request<{ message: string }>(`/api/members/${uid}`, { method: 'DELETE' }),

  // Projects
  getProjects: (params?: { workspace_uid?: string; project_type?: string; project_status?: string }) => {
    const search = new URLSearchParams(params as any).toString();
    return request<Project[]>(`/api/projects${search ? `?${search}` : ''}`);
  },
  getProject: (uid: string) => request<Project>(`/api/projects/${uid}`),
  createProject: (data: Partial<Project>) =>
    request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  patchProject: (uid: string, updates: Partial<Project>) =>
    request<Project>(`/api/projects/${uid}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteProject: (uid: string) =>
    request<{ message: string }>(`/api/projects/${uid}`, { method: 'DELETE' }),

  // Items
  getItems: (params?: { workspace_uid?: string; related_project_uid?: string; item_type?: string; item_status?: string; parent_item_uid?: string }) => {
    const search = new URLSearchParams(params as any).toString();
    return request<ProjectItem[]>(`/api/items${search ? `?${search}` : ''}`);
  },
  getItem: (uid: string) => request<ProjectItem>(`/api/items/${uid}`),
  createItem: (data: Partial<ProjectItem>) =>
    request<ProjectItem>('/api/items', { method: 'POST', body: JSON.stringify(data) }),
  patchItem: (uid: string, updates: Partial<ProjectItem>) =>
    request<ProjectItem>(`/api/items/${uid}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteItem: (uid: string) =>
    request<{ message: string }>(`/api/items/${uid}`, { method: 'DELETE' }),
  addComment: (uid: string, comment: { author_name: string; comment_text: string }) =>
    request<any[]>(`/api/items/${uid}/comments`, { method: 'POST', body: JSON.stringify(comment) }),

  // Templates
  getTemplates: () => request<Template[]>('/api/templates'),
  getTemplate: (uid: string) => request<Template>(`/api/templates/${uid}`),
  createTemplate: (data: { template_name: string; template_schema: TemplateNode[]; member_uid?: string }) =>
    request<Template>('/api/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (uid: string, data: { template_name?: string; template_schema?: TemplateNode[]; member_uid?: string }) =>
    request<Template>(`/api/templates/${uid}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTemplate: (uid: string) =>
    request<{ message: string }>(`/api/templates/${uid}`, { method: 'DELETE' }),
  applyTemplate: (uid: string, project_uid: string) =>
    request<{ message: string; created_count: number; items: ProjectItem[] }>(`/api/templates/${uid}/apply`, {
      method: 'POST',
      body: JSON.stringify({ project_uid })
    }),

  // Knowledge Sources (OKF + RAG)
  getSources: (params: { workspace_uid: string; project_uid?: string }) => {
    const search = new URLSearchParams(params as any).toString();
    return request<KnowledgeSource[]>(`/api/sources?${search}`);
  },
  createSource: (data: {
    workspace_uid: string;
    project_uid?: string;
    file_name: string;
    file_size?: number;
    file_type?: string;
    r2_url?: string;
    page_count?: number;
    content_text?: string;
  }) => request<KnowledgeSource>('/api/sources', { method: 'POST', body: JSON.stringify(data) }),
  toggleSourceActive: (uid: string, is_active: boolean) =>
    request<KnowledgeSource>(`/api/sources/${uid}`, { method: 'PATCH', body: JSON.stringify({ is_active }) }),
  deleteSource: (uid: string) =>
    request<{ message: string; deleted: KnowledgeSource }>(`/api/sources/${uid}`, { method: 'DELETE' }),

  // AI Copilot Chat (Backend Qwen + Ground Truth SQL + Multi-Model & Thinking Mode)
  copilotChat: (data: {
    message: string;
    workspace_uid: string;
    project_uid?: string;
    conversation_history?: Array<{ sender: 'user' | 'ai'; text: string }>;
    model?: string;
    enable_thinking?: boolean;
  }) => request<{
    text: string;
    reasoning_content?: string;
    actionPreview?: any;
    model_used?: string;
    items_count?: number;
  }>('/api/copilot/chat', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
};

export interface KnowledgeSource {
  source_uid: string;
  workspace_uid: string;
  project_uid?: string;
  file_name: string;
  file_size: number;
  file_type: string;
  r2_url?: string;
  page_count: number;
  status: 'uploaded' | 'parsing' | 'chunking' | 'indexed' | 'failed';
  error_message?: string;
  is_active: boolean;
  chunk_count?: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateNode {
  id: string;
  item_type: string;
  item_title: string;
  item_content: { description?: string; [key: string]: any };
  children?: TemplateNode[];
}

export interface Template {
  template_uid: string;
  member_uid?: string;
  template_name: string;
  template_schema: TemplateNode[];
  created_at: string;
  updated_at: string;
}

