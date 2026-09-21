// 統一 API Client 封裝
const API_BASE = import.meta.env.VITE_API_URL || 'https://projectson20260909-production.up.railway.app';

export interface Workspace {
  workspace_uid: string;
  prefix_code: string;
  workspace_name: string;
  workspace_created_at: string;
  last_item_number: number;
  last_project_number: number;
  allow_access_member: Array<{ member_uid: string; role_in_this_workspace: string }>;
  owner_member_uid?: string;
  owner_email?: string;
}

export interface Member {
  member_uid: string;
  member_name: string;
  member_email: string;
  member_ad_group?: string;
  member_status: string;
  is_oauth_verified?: boolean;
  own_workspace_uid?: string[];
  shared_workspace_uid?: Array<string | { workspace_uid: string; role?: 'Owner' | 'Admin' | 'Member' | string }>;
  shared_project_uid?: Array<string | { project_uid: string; role?: 'Owner' | 'Admin' | 'Member' | string }>;
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
  createWorkspace: (data: { prefix_code: string; workspace_name: string; allow_access_member?: any[]; owner_member_uid?: string; owner_email?: string }) =>
    request<Workspace>('/api/workspaces', { method: 'POST', body: JSON.stringify(data) }),
  updateWorkspace: (uid: string, data: Partial<Workspace>) =>
    request<Workspace>(`/api/workspaces/${uid}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWorkspace: (uid: string) =>
    request<{ message: string }>(`/api/workspaces/${uid}`, { method: 'DELETE' }),
  addWorkspaceMember: (wsUid: string, data: { member_uid: string; role_in_this_workspace?: string }) =>
    request<{ message: string }>(`/api/workspaces/${wsUid}/add-member`, { method: 'POST', body: JSON.stringify(data) }),
  removeWorkspaceMember: (wsUid: string, memberUid: string) =>
    request<{ message: string }>(`/api/workspaces/${wsUid}/remove-member/${memberUid}`, { method: 'POST' }),

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
  batchDeleteProjects: (project_uids: string[]) =>
    request<{ message: string; deleted_count: number }>('/api/projects/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ project_uids })
    }),
  batchUpdateProjectStatus: (project_uids: string[], project_status: string) =>
    request<{ message: string; updated_count: number }>('/api/projects/batch-status', {
      method: 'POST',
      body: JSON.stringify({ project_uids, project_status })
    }),

  // Items
  getItems: (params?: { workspace_uid?: string; related_project_uid?: string; item_type?: string; item_status?: string; parent_item_uid?: string }) => {
    const search = new URLSearchParams(params as any).toString();
    return request<ProjectItem[]>(`/api/items${search ? `?${search}` : ''}`);
  },
  getItem: (uid: string) => request<ProjectItem>(`/api/items/${uid}`),
  createItem: (data: Partial<ProjectItem>) =>
    request<ProjectItem>('/api/items', { method: 'POST', body: JSON.stringify(data) }),
  batchCreateItems: (data: {
    workspace_uid?: string;
    related_project_uid?: string;
    items: Array<Partial<ProjectItem> & { audit_remark?: string; description?: string }>;
  }) =>
    request<{ message: string; items: ProjectItem[] }>('/api/items/batch', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  applyProposal: (data: {
    workspace_uid: string;
    related_project_uid?: string;
    proposal: any;
  }) =>
    request<{
      message: string;
      status: 'APPLIED_AND_VERIFIED' | 'APPLIED_WITH_VERIFICATION_ERRORS';
      items: ProjectItem[];
      updatedItems: ProjectItem[];
      verification: any;
    }>('/api/items/apply-proposal', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  patchItem: (uid: string, updates: Partial<ProjectItem>) =>
    request<ProjectItem>(`/api/items/${uid}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteItem: (uid: string) =>
    request<{ message: string }>(`/api/items/${uid}`, { method: 'DELETE' }),
  batchDeleteItems: (item_uids: string[]) =>
    request<{ message: string; deleted_count: number }>('/api/items/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ item_uids })
    }),
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

  copilotChat: (data: {
    message: string;
    workspace_uid: string;
    project_uid?: string;
    conversation_history?: Array<{ sender: 'user' | 'ai'; text: string; attachments?: CopilotAttachment[] }>;
    attachments?: CopilotAttachment[];
    model?: string;
    enable_thinking?: boolean;
  }, signal?: AbortSignal) => request<{
    text: string;
    reasoning_content?: string;
    actionPreview?: any;
    actionPreviews?: any[];
    model_used?: string;
    items_count?: number;
  }>('/api/copilot/chat', {
    method: 'POST',
    body: JSON.stringify(data),
    signal
  }),


  commitConsensus: (data: {
    workspace_uid: string;
    project_uid?: string;
    title: string;
    statement: string;
    rationale?: string;
  }) => request<{ message: string; item: ProjectItem }>('/api/copilot/consensus', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // AI Copilot 歷史對話 Session 管理 (方案 A)
  getCopilotSessions: (params: { workspace_uid: string; member_uid?: string; project_uid?: string }) => {
    const q = new URLSearchParams({ workspace_uid: params.workspace_uid });
    if (params.member_uid) q.append('member_uid', params.member_uid);
    if (params.project_uid) q.append('project_uid', params.project_uid);
    return request<CopilotSession[]>(`/api/copilot/sessions?${q.toString()}`);
  },

  getCopilotSession: (sessionId: string) =>
    request<CopilotSession>(`/api/copilot/sessions/${sessionId}`),

  createCopilotSession: (data: {
    workspace_uid: string;
    project_uid?: string;
    member_uid?: string;
    title?: string;
    messages?: any[];
    last_model_used?: string;
  }) =>
    request<CopilotSession>('/api/copilot/sessions', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateCopilotSession: (
    sessionId: string,
    data: {
      title?: string;
      messages?: any[];
      last_model_used?: string;
      is_pinned?: boolean;
      project_uid?: string;
    }
  ) =>
    request<CopilotSession>(`/api/copilot/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  deleteCopilotSession: (sessionId: string) =>
    request<{ message: string; session_uid: string }>(`/api/copilot/sessions/${sessionId}`, {
      method: 'DELETE'
    }),

  // Auth User API
  syncUser: (data: {
    id: string;
    email: string;
    name?: string;
    avatar_url?: string;
    oauth_provider?: string;
    oauth_provider_id?: string;
    role?: string;
  }) =>
    request<{ user: User; linkedMember?: Member }>('/api/auth/sync-user', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getMe: (params: { email?: string; id?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<User>(`/api/auth/me?${qs}`);
  }
};

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: 'admin' | 'viewer' | string;
  status: 'active' | 'suspended' | string;
  oauth_provider: string;
  oauth_provider_id?: string;
  last_sign_in_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CopilotAttachment {
  name: string;
  type: 'text' | 'image' | 'file';
  mimeType: string;
  size: number;
  dataUrl?: string;
  textContent?: string;
}

export interface CopilotSession {
  session_uid: string;
  workspace_uid: string;
  project_uid?: string;
  member_uid?: string;
  title: string;
  messages: any[];
  last_model_used?: string;
  is_pinned?: boolean;
  message_count?: number;
  project_display_code?: string;
  project_name?: string;
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

