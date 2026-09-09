// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { AdvancedTable } from './AdvancedTable';
import type { Task, Meeting, Bottleneck, KnowledgeNote, RemarkEntry, Project, Product, Workspace, Member, } from '../utils/api';
import { api, API_BASE, getTemplates, applyTemplate, uploadFile, deleteFile, deleteTemplate } from '../utils/api';
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteSchema, createCodeBlockSpec, defaultBlockSpecs } from "@blocknote/core";
import { codeBlockOptions } from "@blocknote/code-block";
import { EditorToolbar } from "./EditorToolbar";
import { CodeBlockToolbar } from "./CodeBlockToolbar";
import { TemplateBuilderModal } from './TemplateBuilderModal';
import { TableViewToolbar, type ToolbarState } from './TableViewToolbar';
import { ClickOutsideWrapper } from './ClickOutsideWrapper';
const customSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    codeBlock: createCodeBlockSpec(codeBlockOptions),
  },
});

const ReadOnlyCommentEditor = ({ content }: { content: any }) => {

  const editor = useCreateBlockNote({
    uploadFile: async (file: File) => {
      const url = await uploadFile(file);
      sessionUploadedUrls.current.push(url);
      return url;
    },
    schema: customSchema,
    initialContent: Array.isArray(content) && content.length > 0 ? (content as any) : undefined
  });
  return (
    <div className="readonly-comment-editor">
      <BlockNoteView editor={editor} editable={false} theme="dark" />
    </div>
  );
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any; errorInfo: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  componentDidCatch(error: any, errorInfo: any) {
    this.setState({ hasError: true, error, errorInfo });
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', background: '#0F172A', border: '1px solid #EF4444', borderRadius: '8px', color: '#F8FAFC', fontFamily: 'monospace', margin: '20px', maxWidth: '800px' }}>
          <h3 style={{ color: '#EF4444', marginTop: 0 }}>Something went wrong while rendering this section:</h3>
          <p style={{ fontWeight: 'bold', wordBreak: 'break-all' }}>{this.state.error?.toString()}</p>
          <pre style={{ background: '#1E293B', padding: '12px', borderRadius: '6px', fontSize: '12px', overflowX: 'auto', color: '#CBD5E1' }}>
            {this.state.errorInfo?.componentStack}
          </pre>
          <button 
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })} 
            style={{ background: '#3B82F6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';

const reactSelectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderColor: state.isFocused ? '#6366F1' : '#334155',
    color: '#F8FAFC',
    boxShadow: 'none',
    minHeight: '42px',
    '&:hover': {
      borderColor: '#6366F1'
    }
  }),
  menu: (base: any) => ({
    ...base,
    backgroundColor: '#1E293B',
    border: '1px solid #334155',
    zIndex: 9999
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isFocused ? '#334155' : '#1E293B',
    color: '#F8FAFC',
    '&:active': {
      backgroundColor: '#475569'
    }
  }),
  singleValue: (base: any) => ({
    ...base,
    color: '#F8FAFC'
  }),
  input: (base: any) => ({
    ...base,
    color: '#F8FAFC'
  })
};

type TabType = 'kanban' | 'tasks' | 'projects' | 'products' | 'meetings' | 'bottlenecks' | 'knowledge' | 'documents' | 'user' | 'workspaces' | 'settings';

interface CanvasPaneProps {
  activeTab: TabType;
  selectedSubItemId: string | null;
  tasks: Task[];
  meetings: Meeting[];
  bottlenecks: Bottleneck[];
  knowledge: KnowledgeNote[];
  projects: Project[];
  products: Product[];
  workspaces: Workspace[];
  members: Member[];
  onUpdateTask: (id: string, updates: any) => Promise<void>;
  onUpdateMeeting: (id: string, updates: any) => Promise<void>;
  onUpdateCharter: (id: string, updates: any) => Promise<void>;
  onUpdateRequirement: (id: string, updates: any) => Promise<void>;
  onUpdatePlan: (id: string, updates: any) => Promise<void>;
  onUpdateBottleneck: (id: string, updates: any) => Promise<void>;
  onUpdateKnowledge: (id: string, updates: any) => Promise<void>;
  onUpdateProduct: (id: string, updates: any) => Promise<void>;
  onUpdateProject: (id: string, updates: any) => Promise<void>;
  onUpdateMember: (id: string, updates: any) => Promise<void>;
  onUpdateWorkspace: (id: string, updates: any) => Promise<void>;
  onCreateTraceability: (reqId: string, taskId: string) => Promise<void>;
  onDeleteTraceability: (id: string) => Promise<void>;
  onDeleteItem?: (id: string) => Promise<void>;
  onDeleteProject?: (id: string) => Promise<void>;
  onDeleteProduct?: (id: string) => Promise<void>;
  onDeleteMember?: (id: string) => Promise<void>;
  onDeleteWorkspace?: (id: string) => Promise<void>;
  onSelectSubItem: (id: string) => void;
  onCreateNew?: () => Promise<any>;
  onRefreshData?: () => Promise<void>;
  filterProject: string;
  setFilterProject: (id: string) => void;
  filterWorkspace: string;
  setFilterWorkspace: (id: string) => void;
}

const formatChineseDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

const formatChineseDateTime = (dateStr: string | null) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const hours = d.getHours();
  const ampm = hours >= 12 ? '下午' : '上午';
  const hr = hours % 12 || 12;
  const mins = d.getMinutes().toString().padStart(2, '0');
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${ampm}${hr}:${mins}`;
};

export const getItemTypeStyles = (type: string) => {
  switch (type) {
    case 'Charter': return { bg: '#0284C7', icon: '📜', text: '#BAE6FD' };
    case 'Epic': return { bg: '#8B5CF6', icon: '🚀', text: '#C4B5FD' };
    case 'Bug': return { bg: '#EF4444', icon: '🐛', text: '#FCA5A5' };
    case 'Task': return { bg: '#3B82F6', icon: '📝', text: '#93C5FD' };
    case 'Micro Task': return { bg: '#6366F1', icon: '🔬', text: '#A5B4FC' };
    case 'Event': return { bg: '#F59E0B', icon: '📅', text: '#FCD34D' };
    case 'UAT': return { bg: '#14B8A6', icon: '🧪', text: '#5EEAD4' };
    case 'Deploy': case 'Deployment': return { bg: '#06B6D4', icon: '📦', text: '#67E8F9' };
    case 'Business Objective': return { bg: '#F97316', icon: '🎯', text: '#FDBA74' };
    case 'Business Requirement': return { bg: '#EAB308', icon: '📋', text: '#FDE047' };
    case 'User Story': return { bg: '#84CC16', icon: '👤', text: '#BEF264' };
    case 'Meeting': return { bg: '#64748B', icon: '💬', text: '#CBD5E1' };
    case 'Bottleneck': return { bg: '#DC2626', icon: '🚧', text: '#FCA5A5' };
    case 'Knowledge': return { bg: '#EC4899', icon: '🧠', text: '#F9A8D4' };
    case 'Casual Note': return { bg: '#D946EF', icon: '📓', text: '#F0ABFC' };
    case 'Milestone': return { bg: '#10B981', icon: '🏆', text: '#6EE7B7' };
    default: return { bg: '#6366F1', icon: '⚡️', text: '#A5B4FC' };
  }
};

export const getItemStatusStyles = (status: string) => {
  switch (status) {
    case 'Not Start': return { bg: '#9CA3AF', text: '#E5E7EB' };
    case 'Ready': return { bg: '#F59E0B', text: '#FDE68A' };
    case 'In Progress': return { bg: '#3B82F6', text: '#BFDBFE' };
    case 'Stuck': return { bg: '#EF4444', text: '#FECACA' };
    case 'Review': return { bg: '#A855F7', text: '#E9D5FF' };
    case 'Completed': return { bg: '#22C55E', text: '#BBF7D0' };
    case 'Closed': return { bg: '#6B7280', text: '#D1D5DB' };
    case 'Backlog': return { bg: '#4B5563', text: '#9CA3AF' };
    default: return { bg: '#9CA3AF', text: '#E5E7EB' };
  }
};

export const getItemStatusBadge = (status: string) => {
  const styles = getItemStatusStyles(status);
  return (
    <span style={{
      backgroundColor: `${styles.bg}25`,
      color: styles.text,
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 500,
      display: 'inline-block',
      whiteSpace: 'nowrap'
    }}>
      {status}
    </span>
  );
};

const getRemainingTime = (dueDateStr: string | null) => {
  if (!dueDateStr) return '—';
  const now = new Date();
  const due = new Date(dueDateStr);
  if (isNaN(due.getTime())) return '—';
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return `⏳ 已過期${Math.abs(diffDays)}天`;
  } else if (diffDays === 0) {
    return `⏳ 今天到期`;
  } else {
    return `⏳ 剩餘${diffDays}天`;
  }
};


const getProjectStatusClass = (status: string) => {
  switch (status) {
    case 'Active': return 'status-badge-progress';
    case 'Completed': return 'status-badge-done';
    case 'Pipeline': return 'status-badge-todo';
    case 'On Hold': return 'status-badge-review';
    case 'Abandoned': return 'status-badge-archive';
    default: return 'status-badge-todo';
  }
};

const getRemainingProjectItemColumns = (members: any[], workspaces: any[], projects: any[], existingIds: string[]) => {
  const allCols = [
    { id: 'id', header: '內部ID', accessor: 'id' as const, cell: (t: any) => t.id || '—' },
    { id: 'item_display_id', header: '識別碼 (ID)', accessor: 'item_display_id' as const, cell: (t: any) => t.item_display_id || '—' },
    { id: 'item_title', header: '標題', accessor: 'item_title' as const, cell: (t: any) => t.item_title || t.title || '—' },
    { id: 'workspace_id', header: '工作空間', accessor: 'workspace_id' as const, cell: (t: any) => workspaces.find((w: any) => String(w.workspace_id) === String(t.workspace_id))?.workspace_name || t.workspace_id || '—' },
    { id: 'related_context_id', header: '關聯專案 (Context ID)', accessor: 'related_context_id' as const, cell: (t: any) => projects.find((p: any) => String(p.id) === String(t.related_context_id))?.name || t.related_context_id || '—' },
    { id: 'parent_item_id', header: '父工單 (Parent ID)', accessor: 'parent_item_id' as const, cell: (t: any) => t.parent_item_id || '—' },
    { id: 'related_item_id_relation', header: '關聯工單關係', accessor: 'related_item_id_relation' as const, cell: (t: any) => <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{JSON.stringify(t.related_item_id_relation || {})}</span> },
    { id: 'item_type', header: '性質 (Item Type)', accessor: 'item_type' as const, cell: (t: any) => t.item_type || '—' },
    { id: 'item_status', header: '狀態 (Item Status)', accessor: 'item_status' as const, cell: (t: any) => t.item_status || '—' },
    { id: 'item_priority', header: '優先級 / 嚴重度', accessor: 'item_priority' as const, cell: (t: any) => t.item_priority || '—' },
    { id: 'item_planned_start_date', header: '預計開始', accessor: 'item_planned_start_date' as const, cell: (t: any) => formatChineseDate(t.item_planned_start_date) },
    { id: 'item_planned_end_date', header: '截止 / 預計結束', accessor: 'item_planned_end_date' as const, cell: (t: any) => formatChineseDate(t.item_planned_end_date) },
    { id: 'item_actual_start_date', header: '實際開始', accessor: 'item_actual_start_date' as const, cell: (t: any) => formatChineseDate(t.item_actual_start_date) },
    { id: 'item_actual_end_date', header: '實際結束', accessor: 'item_actual_end_date' as const, cell: (t: any) => formatChineseDate(t.item_actual_end_date) },
    { id: 'item_follow_by', header: '負責人', accessor: 'item_follow_by' as const, cell: (t: any) => members.find((mem: any) => String(mem.member_id) === String(t.item_follow_by))?.member_name || t.item_follow_by || 'Edmond Chan' },
    { id: 'item_assigned_by', header: '指派人', accessor: 'item_assigned_by' as const, cell: (t: any) => members.find((mem: any) => String(mem.member_id) === String(t.item_assigned_by))?.member_name || t.item_assigned_by || '—' },
    { id: 'item_content', header: '內容 (Content JSON)', accessor: 'item_content' as const, cell: (t: any) => <span style={{ fontFamily: 'monospace', fontSize: '11px', maxWidth: '150px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={JSON.stringify(t.item_content || {})}>{JSON.stringify(t.item_content || {})}</span> },
    { id: 'item_attribute', header: '客製屬性 (Attribute JSON)', accessor: 'item_attribute' as const, cell: (t: any) => <span style={{ fontFamily: 'monospace', fontSize: '11px', maxWidth: '150px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={JSON.stringify(t.item_attribute || {})}>{JSON.stringify(t.item_attribute || {})}</span> },
    { id: 'item_comment', header: '評論 (Comment JSON)', accessor: 'item_comment' as const, cell: (t: any) => <span style={{ fontFamily: 'monospace', fontSize: '11px', maxWidth: '150px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={JSON.stringify(t.item_comment || {})}>{JSON.stringify(t.item_comment || {})}</span> },
    { id: 'item_update_log', header: '變更日誌 (Update Log JSON)', accessor: 'item_update_log' as const, cell: (t: any) => <span style={{ fontFamily: 'monospace', fontSize: '11px', maxWidth: '150px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={JSON.stringify(t.item_update_log || {})}>{JSON.stringify(t.item_update_log || {})}</span> },
    { id: 'item_created_at', header: '建立時間', accessor: 'item_created_at' as const, cell: (t: any) => formatChineseDateTime(t.item_created_at || t.created_at) },
    { id: 'item_updated_at', header: '更新時間', accessor: 'item_updated_at' as const, cell: (t: any) => formatChineseDateTime(t.item_updated_at || t.updated_at) },
  ];
  return allCols.filter(c => !existingIds.includes(c.id));
};

const getRemainingProjectContextColumns = (workspaces: any[], products: any[], existingIds: string[]) => {
  const allCols = [
    { id: 'id', header: '內部ID', accessor: 'id' as const, cell: (c: any) => c.id || '—' },
    { id: 'content_display_id', header: '代號 (Display ID)', accessor: 'content_display_id' as const, cell: (c: any) => c.content_display_id || '—' },
    { id: 'content_name', header: '名稱 (Name)', accessor: 'content_name' as const, cell: (c: any) => c.content_name || '—' },
    { id: 'content_type', header: '類型 (Type)', accessor: 'content_type' as const, cell: (c: any) => c.content_type || '—' },
    { id: 'related_workspace_id', header: '工作空間', accessor: 'related_workspace_id' as const, cell: (c: any) => workspaces.find((w: any) => String(w.workspace_id) === String(c.related_workspace_id))?.workspace_name || c.related_workspace_id || '—' },
    { id: 'parent_content_id', header: '父級產品 (Parent Product)', accessor: 'parent_content_id' as const, cell: (c: any) => products.find((prod: any) => String(prod.id) === String(c.parent_content_id))?.content_name || c.parent_content_id || '—' },
    { id: 'content_status', header: '狀態 (Status)', accessor: 'content_status' as const, cell: (c: any) => c.content_status || '—' },
    { id: 'project_type', header: '專案性質 (Project Type)', accessor: 'project_type' as const, cell: (c: any) => c.project_type || '—' },
    { id: 'project_type_sequence', header: '階段序號 (Sequence)', accessor: 'project_type_sequence' as const, cell: (c: any) => c.project_type_sequence || '—' },
    { id: 'planned_start_date', header: '計劃開始', accessor: 'planned_start_date' as const, cell: (c: any) => formatChineseDate(c.planned_start_date) },
    { id: 'planned_end_date', header: '計劃結束', accessor: 'planned_end_date' as const, cell: (c: any) => formatChineseDate(c.planned_end_date) },
    { id: 'actual_start_date', header: '實際開始', accessor: 'actual_start_date' as const, cell: (c: any) => formatChineseDate(c.actual_start_date) },
    { id: 'actual_end_date', header: '實際結束', accessor: 'actual_end_date' as const, cell: (c: any) => formatChineseDate(c.actual_end_date) },
    { id: 'content_json', header: '額外內容 (Content JSON)', accessor: 'content' as const, cell: (c: any) => <span style={{ fontFamily: 'monospace', fontSize: '11px', maxWidth: '150px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={JSON.stringify(c.content || {})}>{JSON.stringify(c.content || {})}</span> },
    { id: 'content_update_log', header: '變更日誌 (Update Log JSON)', accessor: 'content_update_log' as const, cell: (c: any) => <span style={{ fontFamily: 'monospace', fontSize: '11px', maxWidth: '150px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={JSON.stringify(c.content_update_log || {})}>{JSON.stringify(c.content_update_log || {})}</span> },
    { id: 'content_created_at', header: '建立時間', accessor: 'content_created_at' as const, cell: (c: any) => formatChineseDateTime(c.content_created_at || c.created_at) },
    { id: 'updated_at', header: '更新時間', accessor: 'updated_at' as const, cell: (c: any) => formatChineseDateTime(c.updated_at) },
  ];
  return allCols.filter(col => !existingIds.includes(col.id));
};




const FloatingToolbar = ({ selectedTaskIds, onClear, onDelete, onDuplicate }: { selectedTaskIds: string[], onClear: () => void, onDelete: (ids: string[]) => void, onDuplicate: (ids: string[]) => void }) => {
  if (selectedTaskIds.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '32px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'var(--bg-panel, #1E293B)',
      color: 'var(--text-primary, #F8FAFC)',
      padding: '12px 24px',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      gap: '24px',
      zIndex: 1100,
      fontFamily: 'Inter, sans-serif',
      border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
          {selectedTaskIds.length}
        </div>
        <span style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap' }}>Item{selectedTaskIds.length > 1 ? 's' : ''} selected</span>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '24px' }}>
        <button 
          onClick={() => onDuplicate(selectedTaskIds)}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 16px', borderRadius: '8px', color: 'var(--text-secondary, #94A3B8)', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'var(--text-primary, #F8FAFC)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary, #94A3B8)'; }}
        >
          <span style={{ fontSize: '16px' }}>📋</span>
          <span style={{ fontSize: '12px', fontWeight: 500 }}>Duplicate</span>
        </button>
        <button 
          onClick={() => onDelete(selectedTaskIds)}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 16px', borderRadius: '8px', color: 'var(--text-secondary, #94A3B8)', transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'; e.currentTarget.style.color = '#F87171'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary, #94A3B8)'; }}
        >
          <span style={{ fontSize: '16px' }}>🗑️</span>
          <span style={{ fontSize: '12px', fontWeight: 500 }}>Delete</span>
        </button>
      </div>

      <button 
        onClick={onClear}
        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '8px', marginLeft: '8px', fontSize: '18px', color: 'var(--text-muted, #64748B)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'all 0.2s' }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'var(--text-primary, #F8FAFC)'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted, #64748B)'; }}
      >
        ✕
      </button>
    </div>
  );
};

export const CanvasPane: React.FC<CanvasPaneProps> = ({

  activeTab,
  selectedSubItemId,
  tasks,
  meetings,
  bottlenecks,
  knowledge,
  projects,
  products,
  workspaces,
  members,
  onUpdateTask,
  onUpdateMeeting,
  onUpdateCharter,
  onUpdateRequirement,
  onUpdatePlan,
  onUpdateBottleneck,
  onUpdateKnowledge,
  onUpdateProduct,
  onUpdateProject,
  onUpdateMember,
  onUpdateWorkspace,
  onCreateTraceability,
  onDeleteTraceability,
  onDeleteItem,
  onDeleteProject,
  onDeleteProduct,
  onDeleteMember,
  onDeleteWorkspace,
  onSelectSubItem,
  onCreateNew,
  onRefreshData,
  filterProject,
  setFilterProject,
  filterWorkspace,
  setFilterWorkspace,
}) => {
  
  const isValidDropTarget = (dragType: string, targetType: string, activeTab: string) => {
    if (activeTab === 'deployment') {
      return (dragType === 'User Story' || dragType === 'Bug' || dragType === 'Task' || dragType === 'Micro Task') && targetType === 'Deploy';
    }
    
    // hierarchy drop
    if (dragType === 'Epic' && (targetType === 'Business Objective' || targetType === 'Deploy')) return true;
    if ((dragType === 'User Story' || dragType === 'Bug') && (targetType === 'Epic' || targetType === 'Business Requirement' || targetType === 'Deploy')) return true;
    if ((dragType === 'Task' || dragType === 'Micro Task') && (targetType === 'User Story' || targetType === 'Bug' || targetType === 'Deploy')) return true;
    if ((dragType === 'UAT' || dragType === 'Bug' || dragType === 'Test Case') && (targetType === 'Task' || targetType === 'Micro Task' || targetType === 'User Story')) return true;

    return false;
  };

  const handleDnDDrop = async (e: React.DragEvent, targetId: number | string, targetType: string) => {
    e.preventDefault();
    setDndHoverTargetId(null);
                            setDndDraggingItem(null);
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) {
        alert("Drop Failed: Missing dataTransfer payload.");
        return;
      }
      const data = JSON.parse(dataStr);
      
      const { id: sourceId, type: sourceType, sourceParentId } = data;
      if (!sourceId || String(sourceId) === String(targetId)) {
        console.log("DnD Ignore:", { sourceId, targetId });
        return; 
      }

      console.log("DnD Drop Received:", { sourceId, sourceType, sourceParentId, targetId, targetType });

      // Case 1: Dropping User Story or Bug on Deploy
      if ((sourceType === 'User Story' || sourceType === 'Bug') && targetType === 'Deploy') {
        const itemToUpdate = tasks.find(t => String(t.id) === String(sourceId));
        if (!itemToUpdate) {
          alert(`Drop Failed: Source item ${sourceId} not found in tasks.`);
          return;
        }
        
        // Remove old 'is_deployed' relation to sourceParentId, add new to targetId
        let rels = itemToUpdate.related_item_id_relation;
        if (typeof rels === 'string') {
          try { rels = JSON.parse(rels); } catch(e) { rels = []; }
        }
        if (!Array.isArray(rels)) rels = [];
        
        rels = rels.filter(r => !(String(r.target_id) === String(sourceParentId) && r.relation === 'is_deployed'));
        rels.push({ target_id: Number(targetId), relation: 'is_deployed' });
        
        try {
          await api.updateTask(sourceId, { ...itemToUpdate, related_item_id_relation: rels });
          if (onRefreshData) await onRefreshData();
        } catch(err: any) {
          alert("API Error: " + err.message);
        }
        return;
      }
      
      // Case 2: Hierarchy / Traceability WBS Drop (updating parent_item_id)
      const isHierarchyDrop = (
        (sourceType === 'Business Requirement' && targetType === 'Business Objective') ||
        ((sourceType === 'User Story' || sourceType === 'Epic' || sourceType === 'Bug') && (targetType === 'Business Requirement' || targetType === 'Business Objective')) ||
        ((sourceType === 'Task' || sourceType === 'Micro Task') && (targetType === 'User Story' || targetType === 'Epic' || targetType === 'Bug' || targetType === 'Business Requirement')) ||
        ((sourceType === 'UAT' || sourceType === 'Bug' || sourceType === 'Test Case') && (targetType === 'Task' || targetType === 'Micro Task' || targetType === 'User Story')) ||
        (sourceType !== 'Deploy' && targetType !== 'Deploy' && sourceType !== targetType)
      );

      if (isHierarchyDrop) {
        const itemToUpdate = tasks.find(t => String(t.id) === String(sourceId));
        if (!itemToUpdate) {
          alert(`Drop Failed: Source item ${sourceId} not found in tasks.`);
          return;
        }
        
        try {
          await api.updateTask(sourceId, { ...itemToUpdate, parent_item_id: Number(targetId) });
          if (onRefreshData) await onRefreshData();
        } catch(err: any) {
          alert("API Error: " + err.message);
        }
        return;
      }

      alert(`Drop Failed: Unsupported drag-and-drop. Source: ${sourceType}, Target: ${targetType}`);
    } catch (err: any) {
      alert("DnD Drop Error: " + err.message);
    }
  };

  // Safe runtime fallbacks for legacy document tables that were migrated to project_item
  const charters: any[] = [];
  const requirements: any[] = [];
  const plans: any[] = [];
  const traceability: any[] = [];
  const documents: any[] = [];

  // Common states
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const handleDuplicateTasks = async (ids: string[]) => {
    for (const id of ids) {
      const task: any = [...tasks, ...meetings, ...bottlenecks, ...knowledge].find((t: any) => String(t.id) === String(id));
      if (task) {
        const { id: _, created_at, updated_at, ...rest } = task;
        await api.createTask({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
          ...rest,
          item_title: (task.item_title || task.title || task.content_name || 'Task') + ' (Copy)'
        });
      }
    }
    setSelectedTaskIds([]);
    if (onRefreshData) await onRefreshData();
  };

  const handleDeleteTasks = async (ids: string[]) => {
    if (window.confirm(`確定要刪除這 ${ids.length} 個項目嗎？`)) {
      for (const id of ids) {
        if (onDeleteItem) await onDeleteItem(id);
      }
      setSelectedTaskIds([]);
      if (onRefreshData) await onRefreshData();
    }
  };

  const [isEditing, setIsEditing] = useState(false);
  const [tableSortConfig, setTableSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [inlineCreatingTaskProject, setInlineCreatingTaskProject] = useState<string | null>(null);
  const [inlineCreatingTaskTitle, setInlineCreatingTaskTitle] = useState('');
  const [inlineCreatingTaskType, setInlineCreatingTaskType] = useState('Task');
  const [inlineCreatingMeetingProject, setInlineCreatingMeetingProject] = useState<string | null>(null);
  const [inlineCreatingMeetingTitle, setInlineCreatingMeetingTitle] = useState('');
  const [inlineCreatingBottleneckProject, setInlineCreatingBottleneckProject] = useState<string | null>(null);
  const [inlineCreatingBottleneckTitle, setInlineCreatingBottleneckTitle] = useState('');
  const [inlineCreatingKnowledgeProject, setInlineCreatingKnowledgeProject] = useState<string | null>(null);
  const [inlineCreatingKnowledgeTitle, setInlineCreatingKnowledgeTitle] = useState('');
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<number | null>(null);
  const [dndHoverTargetId, setDndHoverTargetId] = useState<string | null>(null);
  const [dndDraggingItem, setDndDraggingItem] = useState<{ id: string, type: string } | null>(null);
  const sessionUploadedUrls = React.useRef<string[]>([]);
  const [editingCommentIndex, setEditingCommentIndex] = useState<number | null>(null);
  const wrappedUploadFile = async (file: File) => {
    const url = await uploadFile(file);
    sessionUploadedUrls.current.push(url);
    return url;
  };
  const editCommentEditor = useCreateBlockNote({ schema: customSchema, uploadFile: wrappedUploadFile });
  const [isCommentEditing, setIsCommentEditing] = useState(false);
  const [isAddingRelation, setIsAddingRelation] = useState(false);
  const [relType, setRelType] = useState('blocks');
  const [relTargetId, setRelTargetId] = useState('');
  const [relCreateItemType, setRelCreateItemType] = useState('Task');
  const [remarkInput, setRemarkInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Traceability link form states
  const [traceReqId, setTraceReqId] = useState('');
  const [traceTaskId, setTraceTaskId] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  // Traceability inline child creation states
  const [inlineCreatingTraceChildFor, setInlineCreatingTraceChildFor] = useState<string | null>(null);
  const [inlineLinkingTraceChildFor, setInlineLinkingTraceChildFor] = useState<string | null>(null);
  const [inlineLinkingTraceChildType, setInlineLinkingTraceChildType] = useState<string>('');
  const [inlineCreatingTraceChildType, setInlineCreatingTraceChildType] = useState<string>('');
  const [inlineCreatingTraceChildTitle, setInlineCreatingTraceChildTitle] = useState<string>('');
  const [inlineEditingTraceTitleFor, setInlineEditingTraceTitleFor] = useState<string | null>(null);
  const [inlineEditingTraceTitleValue, setInlineEditingTraceTitleValue] = useState<string>('');
  const [inlineEditingTraceProjectFor, setInlineEditingTraceProjectFor] = useState<string | null>(null);
  const [inlineEditingTraceStatusFor, setInlineEditingTraceStatusFor] = useState<string | null>(null);
  const [inlineEditingTypeFor, setInlineEditingTypeFor] = useState<string | null>(null);
  const [inlineEditingPriorityFor, setInlineEditingPriorityFor] = useState<string | null>(null);
  const [inlineEditingContentFor, setInlineEditingContentFor] = useState<string | null>(null);
  const [inlineEditingContentValue, setInlineEditingContentValue] = useState<string>('');
  const [inlineEditingPlannedStartFor, setInlineEditingPlannedStartFor] = useState<string | null>(null);
  const [inlineEditingPlannedEndFor, setInlineEditingPlannedEndFor] = useState<string | null>(null);
  const [inlineEditingActualStartFor, setInlineEditingActualStartFor] = useState<string | null>(null);
  const [inlineEditingActualEndFor, setInlineEditingActualEndFor] = useState<string | null>(null);
  const [inlineEditingFollowByFor, setInlineEditingFollowByFor] = useState<string | null>(null);
  const [inlineEditingAssignedByFor, setInlineEditingAssignedByFor] = useState<string | null>(null);
  // Settings State
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('MOCK_GEMINI_KEY') || 'your_gemini_api_key_here');
  const [isDbResetting, setIsDbResetting] = useState(false);

  // Calendar Day Events Selection
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<Date | null>(null);

  // Document states
  const [editTitle, setEditTitle] = useState('');
  const [editDescOrContent, setEditDescOrContent] = useState<any>('');
  
  const blockNoteEditor = useCreateBlockNote({ schema: customSchema, uploadFile: wrappedUploadFile });
  const commentEditor = useCreateBlockNote({ schema: customSchema, uploadFile: uploadFile });

  const sanitizeBlocks = (blocks: any[]): any[] => {
    if (!Array.isArray(blocks)) return [];
    const sanitized: any[] = [];
    for (const block of blocks) {
      if (!block || typeof block !== 'object') continue;
      const cleanBlock = { ...block };
      let children = Array.isArray(cleanBlock.children) ? sanitizeBlocks(cleanBlock.children) : [];
      const typesWithChildren = ['bulletListItem', 'numberedListItem', 'toggle'];
      if (typesWithChildren.includes(cleanBlock.type)) {
        cleanBlock.children = children;
        sanitized.push(cleanBlock);
      } else {
        cleanBlock.children = [];
        sanitized.push(cleanBlock);
        sanitized.push(...children);
      }
    }
    return sanitized;
  };


  const safeReplaceBlocks = (editor: any, blocks: any) => {
    if (!editor) return;
    setTimeout(() => {
      try {
        if (editor._tiptapEditor?.isDestroyed) return;
        if (!editor._tiptapEditor?.view?.dom) return;
        editor.replaceBlocks(editor.document, blocks);
      } catch (err) {
        console.warn("safeReplaceBlocks failed:", err);
      }
    }, 150);
  };

  const extractPlainText = (doc: any): string => {
    if (!doc) return '';
    if (typeof doc === 'string') return doc;
    if (!Array.isArray(doc)) return '';
    let text = '';
    for (const block of doc) {
      if (block.content) {
        if (Array.isArray(block.content)) {
          for (const inline of block.content) {
            if (inline.text) text += inline.text;
          }
        } else if (typeof block.content === 'object' && block.content !== null) {
          if (block.content.rows) {
            for (const row of block.content.rows) {
              if (row.cells) {
                for (const cell of row.cells) {
                  for (const inlineBlock of cell) {
                    if (inlineBlock.content && Array.isArray(inlineBlock.content)) {
                      for (const inline of inlineBlock.content) {
                        if (inline.text) text += inline.text + ' ';
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      if (block.children && Array.isArray(block.children)) {
        text += ' ' + extractPlainText(block.children);
      }
      text += ' ';
    }
    return text.trim();
  };

  useEffect(() => {
    let isMounted = true;
    const loadBlocks = async () => {
      if (!blockNoteEditor || editDescOrContent === undefined) return;
      
      // Delay to ensure BlockNoteView is mounted in the DOM before we attempt to manipulate the editor
      await new Promise(r => setTimeout(r, 100));
      if (!isMounted) return;

      try {
        if (Array.isArray(editDescOrContent) || (typeof editDescOrContent === 'object' && editDescOrContent !== null)) {
          const sanitized = sanitizeBlocks(editDescOrContent);
          const currentJson = JSON.stringify(blockNoteEditor.document);
          const targetJson = JSON.stringify(sanitized);
          if (currentJson !== targetJson) {
            safeReplaceBlocks(blockNoteEditor, sanitized as any);
          }
        } else if (typeof editDescOrContent === 'string') {
          const trimmed = editDescOrContent.trim();
          if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            const blocks = sanitizeBlocks(JSON.parse(trimmed));
            const currentJson = JSON.stringify(blockNoteEditor.document);
            const targetJson = JSON.stringify(blocks);
            if (currentJson !== targetJson) {
              safeReplaceBlocks(blockNoteEditor, blocks);
            }
          } else {
            const currentMarkdown = await blockNoteEditor.blocksToMarkdownLossy(blockNoteEditor.document);
            if (currentMarkdown.trim() !== trimmed) {
              const blocks = await blockNoteEditor.tryParseMarkdownToBlocks(editDescOrContent);
              if (isMounted) safeReplaceBlocks(blockNoteEditor, sanitizeBlocks(blocks));
            }
          }
        }
      } catch (err: any) {
        if (err?.message?.includes('domAtPos') || err?.message?.includes('view')) {
           console.warn("BlockNote not mounted yet, skipping replaceBlocks");
        } else {
           console.error("BlockNote failed to parse or sync blocks:", err);
        }
      }
    };
    loadBlocks();
    return () => { isMounted = false; };
  }, [editDescOrContent, blockNoteEditor]);
  
  // Specific view states
  const [editStatus, setEditStatus] = useState<string>('Not Start');
  const [editNature, setEditNature] = useState<string>('Task');
  const [editPriority, setEditPriority] = useState<string>('Middle');
  const [editContextId, setEditContextId] = useState<string>('');
  const [editMeetingId, setEditMeetingId] = useState<string>('');
  const [editBottleneckId, setEditBottleneckId] = useState<string>('');

  const [editFollowBy, setEditFollowBy] = useState<string>('');
  const [editAssignedBy, setEditAssignedBy] = useState<string>('');
  const [newCommentInput, setNewCommentInput] = useState('');
  const [charterGoals, setCharterGoals] = useState('');
  const [charterScope, setCharterScope] = useState('');
  const [charterOutScope, setCharterOutScope] = useState('');
  const [w5h2Who, setW5h2Who] = useState('');
  const [w5h2Why, setW5h2Why] = useState('');
  const [w5h2How, setW5h2How] = useState('');
  const [w5h2What, setW5h2What] = useState('');
  const [w5h2When, setW5h2When] = useState('');
  const [w5h2Where, setW5h2Where] = useState('');
  const [w5h2HowMuch, setW5h2HowMuch] = useState('');
  const [reqCategory, setReqCategory] = useState('Functional');
  const [reqPriority, setReqPriority] = useState('Medium');
  const [reqStatus, setReqStatus] = useState('DRAFT');
  const [planMilestoneDate, setPlanMilestoneDate] = useState('');
  const [rAssignees, setRAssignees] = useState('');
  const [aAssignees, setAAssignees] = useState('');
  const [cAssignees, setCAssignees] = useState('');
  const [iAssignees, setIAssignees] = useState('');
  const [bottleneckSeverity, setBottleneckSeverity] = useState<'High' | 'Middle' | 'Low'>('Middle');
  const [bottleneckStatus, setBottleneckStatus] = useState<string>('Not Start');
  const [knowledgeTerm, setKnowledgeTerm] = useState('');
  const [knowledgeKpi, setKnowledgeKpi] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingHost, setMeetingHost] = useState('');
  const [meetingProjectId, setMeetingProjectId] = useState('');
  const [productBusinessOwner, setProductBusinessOwner] = useState('');
  const [productTechOwner, setProductTechOwner] = useState('');
  const [productVision, setProductVision] = useState('');
  const [selectedProductProjectId, setSelectedProductProjectId] = useState<string | null>(null);
  const [selectedDrawerMeetingId, setSelectedDrawerMeetingId] = useState<string | null>(null);
  const [selectedModalTaskId, setSelectedModalTaskId] = useState<any>(null);
  const [draftTaskUpdates, setDraftTaskUpdates] = useState<Partial<any>>({});
  const [draftComment, setDraftComment] = useState('');
  const [selectedModalBottleneckId, setSelectedModalBottleneckId] = useState<any>(null);
  const [selectedModalKnowledgeId, setSelectedModalKnowledgeId] = useState<any>(null);
  const [selectedModalProjectId, setSelectedModalProjectId] = useState<string | null>(null);
  const [isProjectDrawerClosing, setIsProjectDrawerClosing] = useState(false);
  const [isProductDrawerClosing, setIsProductDrawerClosing] = useState(false);
  const [projectDrawerActiveTab, setProjectDrawerActiveTab] = useState<'Charter' | 'Milestones' | 'Traceability' | 'UpdateDeployment' | 'Tasks' | 'Meetings' | 'Bottlenecks' | 'Knowledge'>('Charter');
  const [taskModalActiveTab, setTaskModalActiveTab] = useState<'All' | 'Tasks' | 'Meetings' | 'Bottlenecks' | 'Knowledge'>('All');
  const [selectedModalProductId, setSelectedModalProductId] = useState<string | null>(null);
  const [selectedModalMemberId, setSelectedModalMemberId] = useState<string | null>(null);
  const [selectedModalWorkspaceId, setSelectedModalWorkspaceId] = useState<string | null>(null);
  
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [activeTaskView, setActiveTaskView] = useState<'List' | 'Kanban' | 'Timeline' | 'Calendar'>('List');
  const [activeProjectView, setActiveProjectView] = useState<'List' | 'Kanban' | 'Timeline' | 'Calendar'>('List');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [expandedTimelineNodes, setExpandedTimelineNodes] = useState<Set<string>>(new Set());
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  
  const [kanbanInlineCreateStatus, setKanbanInlineCreateStatus] = useState<string | null>(null);
  const [kanbanInlineCreateTitle, setKanbanInlineCreateTitle] = useState('');
  const [kanbanInlineCreateType, setKanbanInlineCreateType] = useState('Task');
  const [hoveredKanbanColumn, setHoveredKanbanColumn] = useState<string | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  
  const [toolbarState, setToolbarState] = useState<ToolbarState>({
    searchQuery: '',
    owners: [],
    filters: [],
    sorts: [],
    hiddenColumns: [],
    groupBy: null
  });

  useEffect(() => {
    setToolbarState({
      searchQuery: '',
      owners: [],
      filters: [],
      sorts: [],
      hiddenColumns: [],
      groupBy: null
    });
  }, [activeTab, selectedSubItemId]);

  const applyToolbar = (data: any[], columns: any[]) => {
    let result = [...data];
    // Search
    if (toolbarState.searchQuery) {
      const q = toolbarState.searchQuery.toLowerCase();
      result = result.filter(item => 
        (item.item_title && String(item.item_title).toLowerCase().includes(q)) || 
        (item.item_display_id && String(item.item_display_id).toLowerCase().includes(q)) ||
        (item.content_name && String(item.content_name).toLowerCase().includes(q)) ||
        (item.content_display_id && String(item.content_display_id).toLowerCase().includes(q)) ||
        (item.member_name && String(item.member_name).toLowerCase().includes(q)) ||
        (item.email && String(item.email).toLowerCase().includes(q)) ||
        (item.workspace_name && String(item.workspace_name).toLowerCase().includes(q))
      );
    }
    // Person (Owners)
    if (toolbarState.owners.length > 0) {
      result = result.filter(item => toolbarState.owners.includes(String(item.item_follow_by || '')));
    }
    // Advanced Filters
    if (toolbarState.filters.length > 0) {
      toolbarState.filters.forEach(filter => {
        result = result.filter(item => {
          const col = columns.find(c => c.id === filter.columnId);
          let val = item[col?.accessor || filter.columnId];
          if (val === undefined || val === null) val = '';
          return filter.values.includes(String(val));
        });
      });
    }
    // Advanced Sorts
    if (toolbarState.sorts.length > 0) {
      result = result.sort((a, b) => {
        for (const sort of toolbarState.sorts) {
          const col = columns.find(c => c.id === sort.columnId);
          let valA = a[col?.accessor || sort.columnId] || '';
          let valB = b[col?.accessor || sort.columnId] || '';
          if (typeof valA === 'number' && typeof valB === 'number') {
            if (valA !== valB) return sort.direction === 'asc' ? valA - valB : valB - valA;
          } else {
            const strA = String(valA).toLowerCase();
            const strB = String(valB).toLowerCase();
            if (strA < strB) return sort.direction === 'asc' ? -1 : 1;
            if (strA > strB) return sort.direction === 'asc' ? 1 : -1;
          }
        }
        return 0;
      });
    }
    return result;
  };

  const getVisibleColumns = (columns: any[]) => {
    return columns.filter(c => !toolbarState.hiddenColumns.includes(c.id));
  };

  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterPriority, setFilterPriority] = useState<string[]>([]);
  const [filterRole, setFilterRole] = useState<string[]>([]);
  const [filterTaskType, setFilterTaskType] = useState<string>('All');
  const [filterItemType, setFilterItemType] = useState<string[]>([]);
  const [filterFollowBy, setFilterFollowBy] = useState<string[]>([]);

  // Project/Product inline edit states
  const [inlineEditProjectId, setInlineEditProjectId] = useState<string | number | null>(null);
  const [inlineEditProjectField, setInlineEditProjectField] = useState<string | null>(null);
  const [inlineEditProjectData, setInlineEditProjectData] = useState<Partial<any>>({});
  
  const [inlineEditProductId, setInlineEditProductId] = useState<string | number | null>(null);
  const [inlineEditProductField, setInlineEditProductField] = useState<string | null>(null);
  const [inlineEditProductData, setInlineEditProductData] = useState<Partial<any>>({});

  // Project/Product edit states
  const [editWorkspaceId, setEditWorkspaceId] = useState<number | ''>('');
  const [editParentId, setEditParentId] = useState<string | ''>('');
  const [editProjectType, setEditProjectType] = useState<string>('Phase');
  const [editProjectSeq, setEditProjectSeq] = useState<number>(1);
  const [editPlannedStart, setEditPlannedStart] = useState<string>('');
  const [editPlannedEnd, setEditPlannedEnd] = useState<string>('');
  const [editActualStart, setEditActualStart] = useState<string>('');
  const [editActualEnd, setEditActualEnd] = useState<string>('');

  // Member edit states
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberEmail, setEditMemberEmail] = useState('');
  const [editMemberRole, setEditMemberRole] = useState('');
  const [editMemberAdGroup, setEditMemberAdGroup] = useState('');
  const [editMemberStatus, setEditMemberStatus] = useState('');

  const [inlineCreatingMeetingTaskTitle, setInlineCreatingMeetingTaskTitle] = useState('');
  const [inlineCreatingMeetingBottleneckProject, setInlineCreatingMeetingBottleneckProject] = useState<string | null>(null);
  const [inlineCreatingMeetingBottleneckTitle, setInlineCreatingMeetingBottleneckTitle] = useState('');
  const [inlineCreatingMeetingKnowledgeProject, setInlineCreatingMeetingKnowledgeProject] = useState<string | null>(null);
  const [inlineCreatingMeetingKnowledgeTitle, setInlineCreatingMeetingKnowledgeTitle] = useState('');

  const [inlineCreatingTaskTaskProject, setInlineCreatingTaskTaskProject] = useState<string | null>(null);
  const [inlineCreatingTaskTaskTitle, setInlineCreatingTaskTaskTitle] = useState('');

  const [inlineCreatingAllItemOpen, setInlineCreatingAllItemOpen] = useState(false);
  const [inlineCreatingAllItemTitle, setInlineCreatingAllItemTitle] = useState('');
  const [inlineCreatingAllItemType, setInlineCreatingAllItemType] = useState('Task');

  const [inlineCreatingProjectOpen, setInlineCreatingProjectOpen] = useState(false);
  const [inlineCreatingProjectTitle, setInlineCreatingProjectTitle] = useState('');
  const [inlineCreatingProjectType, setInlineCreatingProjectType] = useState('Phase');

  const [inlineCreatingProductOpen, setInlineCreatingProductOpen] = useState(false);
  const [inlineCreatingProductTitle, setInlineCreatingProductTitle] = useState('');

  const [inlineCreatingProductRelatedProjectOpen, setInlineCreatingProductRelatedProjectOpen] = useState<string | null>(null);
  const [inlineCreatingProductRelatedProjectTitle, setInlineCreatingProductRelatedProjectTitle] = useState('');
  const [inlineCreatingProductRelatedProjectType, setInlineCreatingProductRelatedProjectType] = useState('Phase');

  const [inlineCreatingProductDeploymentOpen, setInlineCreatingProductDeploymentOpen] = useState<string | null>(null);
  const [inlineCreatingProductDeploymentTitle, setInlineCreatingProductDeploymentTitle] = useState('');
  const [inlineCreatingProductDeploymentProjectId, setInlineCreatingProductDeploymentProjectId] = useState('');


  const [selectedTemplateProjectId, setSelectedTemplateProjectId] = useState('');

  const selectedWorkspaceId = filterWorkspace ? Number(filterWorkspace) : (workspaces[0]?.workspace_id || 1);

  // Templates state
  const [templates, setTemplates] = useState<any[]>([]);
  const [isTemplateBuilderOpen, setIsTemplateBuilderOpen] = useState(false);
  const [editTemplateTarget, setEditTemplateTarget] = useState<any>(null);
  const [templateDropdownTarget, setTemplateDropdownTarget] = useState<string | null>(null); // 'task', 'project', 'product'
  
  const fetchTemplates = async () => {
    if (!selectedWorkspaceId) return;
    try {
      const data = await getTemplates(selectedWorkspaceId);
      setTemplates(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch templates:', e);
      setTemplates([]);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [selectedWorkspaceId]);

  const handleApplyTemplate = async (templateId: string, projectId: number) => {
    if (!selectedWorkspaceId) return;
    try {
      await applyTemplate(templateId, projectId, selectedWorkspaceId);
      if (onRefreshData) await onRefreshData();
      setTemplateDropdownTarget(null);
    } catch (err) {
      alert('範本套用失敗');
    }
  };

  const renderTemplateDropdown = (targetType: string, contextId: number | null = null) => {
    return (
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setTemplateDropdownTarget(templateDropdownTarget === targetType ? null : targetType)}
          style={{
            background: 'var(--accent-primary)',
            color: 'white',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          新建 <span style={{ fontSize: '10px' }}>▼</span>
        </button>
        {templateDropdownTarget === targetType && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            background: '#1E293B',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            minWidth: '200px',
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-muted)' }}>
              範本 · 用於 {targetType}
            </div>
            {templates.length > 0 ? templates.map(t => (
              <div 
                key={t.id}
                onClick={() => {
                  if (!contextId) {
                    alert('請先選擇一個專案 (Context ID) 才能套用範本');
                    return;
                  }
                  handleApplyTemplate(t.id, contextId);
                }}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: 'var(--text-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexGrow: 1 }}>
                  📄 {t.template_name}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <div 
                    style={{ cursor: 'pointer', opacity: 0.7, padding: '2px 4px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditTemplateTarget(t);
                      setTemplateDropdownTarget(null);
                      setIsTemplateBuilderOpen(true);
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                    title="編輯範本"
                  >
                    ✏️
                  </div>
                  <div 
                    style={{ cursor: 'pointer', opacity: 0.7, padding: '2px 4px' }}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (window.confirm('確定要刪除這個範本嗎？此操作無法復原。')) {
                        try {
                          await deleteTemplate(t.id);
                          await fetchTemplates();
                        } catch(err) {
                          alert('刪除範本失敗');
                        }
                      }
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
                    title="刪除範本"
                  >
                    🗑️
                  </div>
                </div>
              </div>
            )) : (
              <div style={{ padding: '8px 12px', fontSize: '13px', color: 'var(--text-muted)' }}>無可用範本</div>
            )}
            <div style={{ borderTop: '1px solid var(--border-color)' }}>
              <div 
                onClick={() => {
                  setEditTemplateTarget(null);
                  setTemplateDropdownTarget(null);
                  setIsTemplateBuilderOpen(true);
                }}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: 'var(--accent-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                + 新增範本
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Auto-save typing states
  const [editWorkspaceCode, setEditWorkspaceCode] = useState('');
  const [editWorkspaceName, setEditWorkspaceName] = useState('');
  const [editWorkspaceLastNumber, setEditWorkspaceLastNumber] = useState<number>(0);

  const [drawerTab, setDrawerTab] = useState<'overview' | 'charter' | 'plan' | 'traceability' | 'requirements'>('overview');

  const isLightTheme = false;
  
  const getContainerBg = () => {
    if (isLightTheme) return '#F8FAFC';
    return '#0E1321';
  };

  const getThemeClass = () => {
    if (isLightTheme) return 'theme-light';
    return '';
  };

  const containerBg = getContainerBg();
  const themeClass = getThemeClass();

  const getTitleColor = () => {
    return isLightTheme ? '#0F172A' : 'var(--text-primary)';
  };
  const getBorderColor = () => {
    return isLightTheme ? '#E2E8F0' : 'var(--border-color)';
  };

  const renderCategoryTabBar = () => {
    let tabs: { id: string; label: string }[] = [];
    if (activeTab === 'products') {
      tabs = [
        { id: 'product-table', label: '📊 產品總表' }
      ];
    } else if (activeTab === 'tasks') {
      tabs = [
        { id: 'task-table', label: '📊 所有工單總表' }
      ];
    } else if (activeTab === 'projects') {
      tabs = [
        { id: 'project-table', label: '📊 專案總表' }
      ];
    } else if (activeTab === 'meetings') {
      tabs = [
        { id: 'meeting-table', label: '📊 所有會議總表' }
      ];
    } else if (activeTab === 'bottlenecks') {
      tabs = [
        { id: 'bottleneck-table', label: '📊 樽頸風險總表' }
      ];
    } else if (activeTab === 'knowledge') {
      tabs = [
        { id: 'knowledge-table', label: '📊 業務知識總表' }
      ];
    } else if (activeTab === 'documents') {
      tabs = [
        { id: 'document-table', label: '📊 所有文件總表' }
      ];
    } else if (activeTab === 'user') {
      tabs = [
        { id: 'user-table', label: '📊 用戶帳號總表' }
      ];
    } else if (activeTab === 'workspaces') {
      tabs = [
        { id: 'workspace-table', label: '📊 工作空間總表' }
      ];
    }

    if (tabs.length <= 1) return null;

    return (
      <div 
        style={{
          display: 'flex',
          gap: '8px',
          padding: '16px 40px 0px',
          borderBottom: '1px solid ' + getBorderColor(),
          userSelect: 'none',
        }}
      >
        {tabs.map((tab) => {
          const isActive = String(selectedSubItemId) === String(tab.id);
          return (
            <div
              key={tab.id}
              onClick={() => onSelectSubItem(tab.id)}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 400,
                color: isActive 
                  ? (isLightTheme ? '#0f172a' : '#ffffff') 
                  : (isLightTheme ? '#64748b' : 'var(--text-secondary)'),
                borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </div>
          );
        })}
      </div>
    );
  };

;

  const renderNewPageRow = (colSpan: number) => {
    return (
      <tr 
        style={{ cursor: 'pointer' }} 
        onClick={async () => {
          if (onCreateNew) {
            const newItem = await onCreateNew();
            if (newItem) {
              const strId = String(newItem.id || newItem.member_id || newItem.workspace_id);
              if (activeTab === 'tasks') {
                setSelectedModalTaskId(strId);
                setIsEditing(true);
              } else if (activeTab === 'bottlenecks') {
                setSelectedModalBottleneckId(strId);
                setIsEditing(true);
              } else if (activeTab === 'meetings') {
                setSelectedDrawerMeetingId(strId);
                setIsEditing(true);
              } else if (activeTab === 'knowledge') {
                setSelectedModalKnowledgeId(strId);
                setIsEditing(true);
              } else if (activeTab === 'projects') {
                setSelectedModalProjectId(strId);
                setIsEditing(true);
              } else if (activeTab === 'products') {
                setSelectedModalProductId(strId);
                setIsEditing(true);
              } else if (activeTab === 'user') {
                setSelectedModalMemberId(strId);
                setIsEditing(true);
              } else if (activeTab === 'workspaces') {
                setSelectedModalWorkspaceId(strId);
                setIsEditing(true);
              }
            }
          }
        }}
      >
        <td colSpan={colSpan} style={{ padding: '10px 16px', color: (isLightTheme ? '#64748b' : 'var(--text-muted)'), fontSize: '13px', borderBottom: 'none' }}>
          <span style={{ marginRight: '6px' }}>+</span>新頁面
        </td>
      </tr>
    );
  };

  // 1. Resolve Active Document pointers based on selectedSubItemId
  const currentTask = tasks.find(t => String(t.id) === String(selectedSubItemId)) || null;
  const currentMeeting = meetings.find(m => String(m.id) === String(selectedSubItemId)) || null;
  const currentRequirement = requirements.find(r => String(r.id) === String(selectedSubItemId)) || null;
  const currentBottleneck = bottlenecks.find(b => String(b.id) === String(selectedSubItemId)) || null;
  const currentKnowledge = knowledge.find(k => String(k.id) === String(selectedSubItemId)) || null;
  const currentProduct = products.find(p => String(p.id) === String(selectedSubItemId)) || null;
  const currentCharter = charters.length > 0 ? charters[0] : null; // Typically 1 project charter seeded
  const currentPlan = plans.length > 0 ? plans[0] : null;

  // Filtered lists for table views
  const filteredTasks = tasks.filter(t => {
    const matchesSearch = !searchQuery || t.item_title.toLowerCase().includes(searchQuery.toLowerCase()) || t.item_display_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = !filterProject || String(t.related_context_id) === String(filterProject);
    const matchesWorkspace = !filterWorkspace || String(t.workspace_id) === String(filterWorkspace);
    const matchesStatus = filterStatus.length === 0 || filterStatus.includes(t.item_status);
    const matchesPriority = filterPriority.length === 0 || filterPriority.includes(t.item_priority);
    const matchesItemType = filterItemType.length === 0 || filterItemType.includes(t.item_type);
    const matchesFollowBy = filterFollowBy.length === 0 || (t.item_follow_by ? filterFollowBy.includes(String(t.item_follow_by)) : filterFollowBy.includes('unassigned'));
    
    let matchesType = true;
    if (filterTaskType !== 'All') {
      if (filterTaskType === 'Knowledge | Casual Note') {
        matchesType = t.item_type === 'Knowledge' || t.item_type === 'Casual Note';
      } else {
        matchesType = t.item_type === filterTaskType;
      }
    }
    
    return matchesSearch && matchesProject && matchesWorkspace && matchesStatus && matchesPriority && matchesItemType && matchesFollowBy && matchesType;
  });

  const filteredMeetings = meetings.filter(m => {
    const matchesSearch = !searchQuery || m.item_title.toLowerCase().includes(searchQuery.toLowerCase()) || m.item_display_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = !filterProject || String(m.related_context_id) === String(filterProject);
    const matchesWorkspace = !filterWorkspace || String(m.workspace_id) === String(filterWorkspace);
    const matchesStatus = filterStatus.length === 0 || filterStatus.includes(m.item_status);
    const matchesItemType = filterItemType.length === 0 || filterItemType.includes(m.item_type || 'Meeting');
    const matchesFollowBy = filterFollowBy.length === 0 || (m.item_follow_by ? filterFollowBy.includes(String(m.item_follow_by)) : filterFollowBy.includes('unassigned'));
    return matchesSearch && matchesProject && matchesWorkspace && matchesStatus && matchesItemType && matchesFollowBy;
  });

  const filteredBottlenecks = bottlenecks.filter(b => {
    const matchesSearch = !searchQuery || b.item_title.toLowerCase().includes(searchQuery.toLowerCase()) || b.item_display_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = !filterProject || String(b.related_context_id) === String(filterProject);
    const matchesWorkspace = !filterWorkspace || String(b.workspace_id) === String(filterWorkspace);
    const matchesStatus = filterStatus.length === 0 || filterStatus.includes(b.item_status);
    const matchesPriority = filterPriority.length === 0 || filterPriority.includes(b.item_priority);
    const matchesItemType = filterItemType.length === 0 || filterItemType.includes(b.item_type || 'Bottleneck');
    const matchesFollowBy = filterFollowBy.length === 0 || (b.item_follow_by ? filterFollowBy.includes(String(b.item_follow_by)) : filterFollowBy.includes('unassigned'));
    return matchesSearch && matchesProject && matchesWorkspace && matchesStatus && matchesPriority && matchesItemType && matchesFollowBy;
  });

  const filteredKnowledge = knowledge.filter(k => {
    const matchesSearch = !searchQuery || k.item_title.toLowerCase().includes(searchQuery.toLowerCase()) || k.item_display_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = !filterProject || String(k.related_context_id) === String(filterProject);
    const matchesWorkspace = !filterWorkspace || String(k.workspace_id) === String(filterWorkspace);
    const matchesItemType = filterItemType.length === 0 || filterItemType.includes(k.item_type || 'Knowledge');
    const matchesFollowBy = filterFollowBy.length === 0 || (k.item_follow_by ? filterFollowBy.includes(String(k.item_follow_by)) : filterFollowBy.includes('unassigned'));
    return matchesSearch && matchesProject && matchesWorkspace && matchesItemType && matchesFollowBy;
  });

  const filteredProjects = projects.filter(p => {
    const matchesSearch = !searchQuery || p.content_name.toLowerCase().includes(searchQuery.toLowerCase()) || p.content_display_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesWorkspace = !filterWorkspace || String(p.related_workspace_id) === String(filterWorkspace);
    const matchesStatus = filterStatus.length === 0 || filterStatus.includes(p.content_status);
    return matchesSearch && matchesWorkspace && matchesStatus;
  });

  const filteredProducts = products.filter(p => {
    const matchesSearch = !searchQuery || p.content_name.toLowerCase().includes(searchQuery.toLowerCase()) || p.content_display_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesWorkspace = !filterWorkspace || String(p.related_workspace_id) === String(filterWorkspace);
    const matchesStatus = filterStatus.length === 0 || filterStatus.includes(p.content_status);
    return matchesSearch && matchesWorkspace && matchesStatus;
  });

  const filteredMembers = members.filter(m => {
    const matchesSearch = !searchQuery || m.member_name.toLowerCase().includes(searchQuery.toLowerCase()) || (m.member_email && m.member_email.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole = filterRole.length === 0 || filterRole.includes(m.member_role);
    const matchesStatus = filterStatus.length === 0 || filterStatus.includes(m.member_status);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const filteredWorkspaces = workspaces.filter(w => {
    const matchesSearch = !searchQuery || w.workspace_name.toLowerCase().includes(searchQuery.toLowerCase()) || w.prefix_code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const filteredRequirements = requirements.filter(r => {
    const matchesSearch = !searchQuery || r.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus.length === 0 || filterStatus.includes(r.status);
    const matchesPriority = filterPriority.length === 0 || filterPriority.includes(r.priority);
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const filteredDocuments = documents.filter(d => {
    const matchesSearch = !searchQuery || d.document_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus.length === 0 || filterStatus.includes(d.document_status);
    return matchesSearch && matchesStatus;
  });

  // 2. Sync local edit state when item changes
  useEffect(() => {
    setSearchQuery('');
    setFilterStatus([]);
    setFilterPriority([]);
    setFilterRole([]);
    setFilterTaskType('All');
    setFilterItemType([]);
    setFilterFollowBy([]);
    setInlineEditProjectId(null);
    setInlineEditProductId(null);
  }, [activeTab]);

  // Synchronize local edit state when project changes
  useEffect(() => {
    setIsEditing(false);
    setRemarkInput('');
    if (selectedModalProjectId) {
      const p = projects.find(x => String(x.id) === String(selectedModalProjectId));
      if (p) {
        setEditTitle(p.content_name);
        setEditStatus(p.content_status || 'Active');
        setEditProjectType(p.project_type || 'Phase');
        setEditProjectSeq(p.project_type_sequence ?? 1);
        setEditPlannedStart(p.planned_start_date ? p.planned_start_date.split('T')[0] : '');
        setEditPlannedEnd(p.planned_end_date ? p.planned_end_date.split('T')[0] : '');
        setEditActualStart(p.actual_start_date ? p.actual_start_date.split('T')[0] : '');
        setEditActualEnd(p.actual_end_date ? p.actual_end_date.split('T')[0] : '');
        setEditWorkspaceId(p.related_workspace_id || 1);
        setEditParentId(p.parent_content_id || '');
        setEditDescOrContent(p.content?.description || '');
      }
    }
  }, [selectedModalProjectId, projects]);

  // Synchronize local edit state when product changes
  useEffect(() => {
    setIsEditing(false);
    setRemarkInput('');
    if (selectedModalProductId) {
      const p = products.find(x => String(x.id) === String(selectedModalProductId));
      if (p) {
        setEditTitle(p.content_name);
        setEditStatus(p.content_status || 'Active');
        setEditWorkspaceId(p.related_workspace_id || 1);
        setProductBusinessOwner(p.business_owner || 'Eric (CED AM)');
        setProductTechOwner(p.tech_owner || 'Paul');
        setProductVision(p.product_vision || '');
      }
    }
  }, [selectedModalProductId, products]);

  // Synchronize local edit state when member changes
  useEffect(() => {
    setIsEditing(false);
    if (selectedModalMemberId) {
      const m = members.find(x => String(x.member_id) === String(selectedModalMemberId));
      if (m) {
        setEditMemberName(m.member_name);
        setEditMemberEmail(m.member_email || '');
        setEditMemberRole(m.member_role || 'Collaborator');
        setEditMemberAdGroup(m.member_ad_group || '');
        setEditMemberStatus(m.member_status || 'Active');
      }
    }
  }, [selectedModalMemberId, members]);

  // Synchronize local edit state when workspace changes
  useEffect(() => {
    setIsEditing(false);
    if (selectedModalWorkspaceId) {
      const w = workspaces.find(x => String(x.workspace_id) === String(selectedModalWorkspaceId));
      if (w) {
        setEditWorkspaceCode(w.prefix_code);
        setEditWorkspaceName(w.workspace_name);
        setEditWorkspaceLastNumber(w.last_item_number || 0);
      }
    }
  }, [selectedModalWorkspaceId, workspaces]);

  useEffect(() => {
    setIsEditing(false);
    setRemarkInput('');

    if (selectedSubItemId) {
      const task = tasks.find(t => String(t.id) === String(selectedSubItemId));
      if (task) {
        setSelectedModalTaskId(task.id);
        const defaultSubItems: Record<string, string> = {
          kanban: 'kanban-board',
          products: 'product-table',
          tasks: 'task-table',
          projects: 'project-table',
          meetings: 'meeting-table',
          bottlenecks: 'bottleneck-table',
          knowledge: 'knowledge-table'
        };
        const def = defaultSubItems[activeTab] || 'task-table';
        onSelectSubItem(def);
        return;
      }

      const bn = bottlenecks.find(b => String(b.id) === String(selectedSubItemId));
      if (bn) {
        setSelectedModalBottleneckId(bn.id);
        const defaultSubItems: Record<string, string> = {
          kanban: 'kanban-board',
          products: 'product-table',
          tasks: 'task-table',
          projects: 'project-table',
          meetings: 'meeting-table',
          bottlenecks: 'bottleneck-table',
          knowledge: 'knowledge-table'
        };
        const def = defaultSubItems[activeTab] || 'bottleneck-table';
        onSelectSubItem(def);
        return;
      }

      const kn = knowledge.find(k => String(k.id) === String(selectedSubItemId));
      if (kn) {
        setSelectedModalKnowledgeId(kn.id);
        const defaultSubItems: Record<string, string> = {
          kanban: 'kanban-board',
          products: 'product-table',
          tasks: 'task-table',
          projects: 'project-table',
          meetings: 'meeting-table',
          bottlenecks: 'bottleneck-table',
          knowledge: 'knowledge-table'
        };
        const def = defaultSubItems[activeTab] || 'knowledge-table';
        onSelectSubItem(def);
        return;
      }
    }

    if (activeTab === 'meetings' && selectedSubItemId && selectedSubItemId !== 'meeting-table') {
      const meet = meetings.find(m => String(m.id) === String(selectedSubItemId));
      if (meet) {
        setSelectedDrawerMeetingId(meet.id);
        onSelectSubItem('meeting-table');
        return;
      }
    }

    if (activeTab === 'products' && currentProduct) {
      setEditTitle(currentProduct.name);
      setProductBusinessOwner(currentProduct.business_owner || '');
      setProductTechOwner(currentProduct.tech_owner || '');
      setProductVision(currentProduct.product_vision || '');
      setSelectedProductProjectId(null);
      setDrawerTab('overview');
    } else if (activeTab === 'tasks' && currentTask) {
      setEditTitle(currentTask.item_title);
      setEditDescOrContent(currentTask.item_content?.description || '');
      setEditStatus(currentTask.item_status || 'Not Start');
      setEditNature(currentTask.item_type || 'Task');
      setEditPriority(currentTask.item_priority || 'Middle');
      setEditContextId(currentTask.related_context_id || '');
      setEditMeetingId(currentTask.item_attribute?.related_meeting_id || '');
      setEditBottleneckId(currentTask.item_attribute?.bottleneck_id || '');

      setEditFollowBy(currentTask.item_follow_by ? String(currentTask.item_follow_by) : '');
      setEditAssignedBy(currentTask.item_assigned_by ? String(currentTask.item_assigned_by) : '');
    } else if (activeTab === 'meetings' && currentMeeting) {
      setEditTitle(currentMeeting.title);
      setEditDescOrContent(currentMeeting.content || '');
      setMeetingDate(currentMeeting.meeting_date ? currentMeeting.meeting_date.split('T')[0] : '');
      setMeetingHost(currentMeeting.host || '');
      setMeetingProjectId(currentMeeting.project_id || '');
      setEditFollowBy(currentMeeting.item_follow_by ? String(currentMeeting.item_follow_by) : '');
      setEditAssignedBy(currentMeeting.item_assigned_by ? String(currentMeeting.item_assigned_by) : '');
    } else if (activeTab === 'projects') {
      if (selectedSubItemId === 'project-charter' && currentCharter) {
        setEditTitle(currentCharter.title);
        setCharterGoals(currentCharter.content?.goals || '');
        setCharterScope(currentCharter.content?.scope || '');
        setCharterOutScope(currentCharter.content?.out_of_scope || '');
        
        const w5h2 = currentCharter.content?.w5h2 || {};
        setW5h2Who(w5h2.who || '');
        setW5h2Why(w5h2.why || '');
        setW5h2How(w5h2.how || '');
        setW5h2What(w5h2.what || '');
        setW5h2When(w5h2.when || '');
        setW5h2Where(w5h2.where || '');
        setW5h2HowMuch(w5h2.how_much || '');
      } else if (selectedSubItemId === 'project-plan' && currentPlan) {
        setEditTitle(currentPlan.title);
        setEditDescOrContent(currentPlan.description || '');
        setPlanMilestoneDate(currentPlan.milestone_date ? currentPlan.milestone_date.split('T')[0] : '');
        setRAssignees(currentPlan.r_assignees?.join(', ') || '');
        setAAssignees(currentPlan.a_assignees?.join(', ') || '');
        setCAssignees(currentPlan.c_assignees?.join(', ') || '');
        setIAssignees(currentPlan.i_assignees?.join(', ') || '');
      } else if (currentRequirement) {
        setEditTitle(currentRequirement.title);
        setEditDescOrContent(currentRequirement.description || '');
        setReqCategory(currentRequirement.category || 'Functional');
        setReqPriority(currentRequirement.priority || 'Medium');
        setReqStatus(currentRequirement.status || 'DRAFT');
      }
    } else if (activeTab === 'bottlenecks' && currentBottleneck) {
      setEditTitle(currentBottleneck.item_title);
      setEditDescOrContent(currentBottleneck.item_content?.description || '');
      setBottleneckSeverity(currentBottleneck.item_priority || 'Middle');
      setBottleneckStatus(currentBottleneck.item_status || 'Not Start');
      setEditFollowBy(currentBottleneck.item_follow_by ? String(currentBottleneck.item_follow_by) : '');
      setEditAssignedBy(currentBottleneck.item_assigned_by ? String(currentBottleneck.item_assigned_by) : '');
    } else if (activeTab === 'knowledge' && currentKnowledge) {
      setEditTitle(currentKnowledge.term);
      setKnowledgeTerm(currentKnowledge.term);
      setEditDescOrContent(currentKnowledge.definition || '');
      setKnowledgeKpi(currentKnowledge.kpi_formula || '');
      setEditFollowBy(currentKnowledge.item_follow_by ? String(currentKnowledge.item_follow_by) : '');
      setEditAssignedBy(currentKnowledge.item_assigned_by ? String(currentKnowledge.item_assigned_by) : '');
    }
  }, [activeTab, selectedSubItemId, currentTask, currentMeeting, currentCharter, currentPlan, currentRequirement, currentBottleneck, currentKnowledge, tasks, bottlenecks, knowledge, meetings]);

  // Synchronize local edit state when drawer meeting changes
  useEffect(() => {
    if (selectedDrawerMeetingId) {
      const meet = meetings.find(m => String(m.id) === String(selectedDrawerMeetingId));
      if (meet) {
        setEditTitle(meet.title);
        setEditDescOrContent(meet.content || '');
        setMeetingDate(meet.meeting_date ? meet.meeting_date.split('T')[0] : '');
        setMeetingHost(meet.host || '');
        setMeetingProjectId(meet.project_id || '');
        setEditFollowBy(meet.item_follow_by ? String(meet.item_follow_by) : '');
        setEditAssignedBy(meet.item_assigned_by ? String(meet.item_assigned_by) : '');
        setRemarkInput('');
        setIsEditing(false);
      }
    }
  }, [selectedDrawerMeetingId, meetings]);

  // Synchronize local edit state when modal task changes
  useEffect(() => {
    setIsEditing(false);
    setRemarkInput('');
    setNewCommentInput('');
    if (selectedModalTaskId) {
      const t = tasks.find(x => String(x.id) === String(selectedModalTaskId));
      if (t) {
        setEditTitle(t.item_title);
        setEditDescOrContent(t.item_content?.description || '');
        setEditStatus(t.item_status || 'Not Start');
        setEditNature(t.item_type || 'Task');
        setEditPriority(t.item_priority || 'Middle');
        setEditContextId(t.related_context_id || '');
        setEditMeetingId(t.item_attribute?.related_meeting_id || '');
        setEditBottleneckId(t.item_attribute?.bottleneck_id || '');

        setEditFollowBy(t.item_follow_by ? String(t.item_follow_by) : '');
        setEditAssignedBy(t.item_assigned_by ? String(t.item_assigned_by) : '');
      }
    }
  }, [selectedModalTaskId, tasks]);

  // Synchronize local edit state when modal bottleneck changes
  useEffect(() => {
    setIsEditing(false);
    setRemarkInput('');
    if (selectedModalBottleneckId) {
      const b = bottlenecks.find(x => String(x.id) === String(selectedModalBottleneckId));
      if (b) {
        setEditTitle(b.item_title);
        setEditDescOrContent(b.item_content?.description || '');
        setBottleneckSeverity(b.item_priority || 'Middle');
        setBottleneckStatus(b.item_status || 'Not Start');
        setEditFollowBy(b.item_follow_by ? String(b.item_follow_by) : '');
        setEditAssignedBy(b.item_assigned_by ? String(b.item_assigned_by) : '');
      }
    }
  }, [selectedModalBottleneckId, bottlenecks]);

  // Synchronize local edit state when modal knowledge changes
  useEffect(() => {
    setIsEditing(false);
    setRemarkInput('');
    if (selectedModalKnowledgeId) {
      const k = knowledge.find(x => String(x.id) === String(selectedModalKnowledgeId));
      if (k) {
        setKnowledgeTerm(k.term);
        setEditDescOrContent(k.definition || '');
        setKnowledgeKpi(k.kpi_formula || '');
        setEditFollowBy(k.item_follow_by ? String(k.item_follow_by) : '');
        setEditAssignedBy(k.item_assigned_by ? String(k.item_assigned_by) : '');
      }
    }
  }, [selectedModalKnowledgeId, knowledge]);

  // 3. Save edits handler
  const cleanupR2Images = async (oldDesc: any, newDesc: any) => {
    try {
      const extractImageUrls = (blocks: any[]): string[] => {
        const urls: string[] = [];
        const traverse = (nodes: any[]) => {
          if (!Array.isArray(nodes)) return;
          for (const node of nodes) {
            if (node.type === 'image' && node.props?.url) {
              urls.push(node.props.url);
            }
            if (node.children && Array.isArray(node.children)) {
              traverse(node.children);
            }
          }
        };
        traverse(blocks);
        return urls;
      };

      const oldUrls = extractImageUrls(Array.isArray(oldDesc) ? oldDesc : []);
      const newUrls = extractImageUrls(Array.isArray(newDesc) ? newDesc : []);
      
      const sessionUrls = sessionUploadedUrls.current;
      
      const candidateUrls = Array.from(new Set([...oldUrls, ...sessionUrls]));
      const deletedUrls = candidateUrls.filter(url => !newUrls.includes(url));
      
      for (const url of deletedUrls) {
        if (url.includes('pub-0ca2e372fc4445a09a9c7cb68e89a56d.r2.dev') || url.includes('.r2.dev')) {
          try {
            await deleteFile(url);
            console.log('Successfully deleted from R2:', url);
          } catch (e) {
            console.error('Failed to delete from R2:', url, e);
          }
        }
      }

      if (deletedUrls.length > 0) {
        alert(`已嘗試從 R2 刪除 ${deletedUrls.length} 張圖片！(請檢查 Cloudflare)`);
      }
      
      sessionUploadedUrls.current = [];
    } catch (e) {
      console.error('Error during image cleanup:', e);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (activeTab === 'tasks' && currentTask) {
        const parsedContent = {
          ...(currentTask.item_content || {}),
          description: editDescOrContent,
          related_meeting_id: editMeetingId,
          bottleneck_id: editBottleneckId
        };
        // Explicitly remove assignees if it existed
        delete (parsedContent as any).assignees;

        let finalComments = currentTask.item_comment || [];
        if (newCommentInput.trim()) {
          const commentEntry = {
            timestamp: new Date().toISOString(),
            user: 'User',
            text: newCommentInput.trim()
          };
          finalComments = [commentEntry, ...finalComments];
        }

        // Find deleted images and remove them from Cloudflare R2
        await cleanupR2Images(currentTask.item_content?.description || [], parsedContent.description || []);

        await onUpdateTask(currentTask.id, {
          item_title: editTitle,
          item_content: parsedContent,
          item_status: editStatus,
          item_type: editNature,
          item_priority: editPriority,
          related_context_id: editContextId,
          item_follow_by: editFollowBy ? parseInt(editFollowBy, 10) : null,
          item_assigned_by: editAssignedBy ? parseInt(editAssignedBy, 10) : null,
          item_comment: finalComments,
          remarks_entry: remarkInput || '手動修改任務工單',
        });
      } else if (activeTab === 'meetings' && currentMeeting) {
        await onUpdateMeeting(currentMeeting.id, {
          title: editTitle,
          content: editDescOrContent,
          meeting_date: meetingDate ? new Date(meetingDate).toISOString() : currentMeeting.meeting_date,
          host: meetingHost,
          project_id: meetingProjectId || null,
          remarks_entry: remarkInput || '手動修改會議記錄',
        });
      } else if (activeTab === 'projects') {
        if (selectedSubItemId === 'project-charter' && currentCharter) {
          await onUpdateCharter(currentCharter.id, {
            project_id: currentCharter.project_id,
            title: editTitle,
            content: {
              goals: charterGoals,
              scope: charterScope,
              out_of_scope: charterOutScope,
              w5h2: {
                who: w5h2Who,
                why: w5h2Why,
                how: w5h2How,
                what: w5h2What,
                when: w5h2When,
                where: w5h2Where,
                how_much: w5h2HowMuch
              }
            },
            remarks_entry: remarkInput || '手動變更專案章程'
          });
        } else if (selectedSubItemId === 'project-plan' && currentPlan) {
          await onUpdatePlan(currentPlan.id, {
            title: editTitle,
            description: editDescOrContent,
            milestone_date: planMilestoneDate ? new Date(planMilestoneDate).toISOString() : currentPlan.milestone_date,
            r_assignees: rAssignees.split(',').map(x => x.trim()).filter(Boolean),
            a_assignees: aAssignees.split(',').map(x => x.trim()).filter(Boolean),
            c_assignees: cAssignees.split(',').map(x => x.trim()).filter(Boolean),
            i_assignees: iAssignees.split(',').map(x => x.trim()).filter(Boolean),
            remarks_entry: remarkInput || '手動更新里程碑/RACI'
          });
        } else if (currentRequirement) {
          await onUpdateRequirement(currentRequirement.id, {
            title: editTitle,
            description: editDescOrContent,
            category: reqCategory,
            priority: reqPriority,
            status: reqStatus,
            remarks_entry: remarkInput || '手動修改需求內容'
          });
        }
      } else if (activeTab === 'bottlenecks' && currentBottleneck) {
        await onUpdateBottleneck(currentBottleneck.id, {
          item_title: editTitle,
          item_content: {
            ...currentBottleneck.item_content,
            description: editDescOrContent
          },
          item_priority: bottleneckSeverity,
          item_status: bottleneckStatus,
          remarks_entry: remarkInput || `手動變更樽頸狀態為 ${bottleneckStatus}`
        });
      } else if (activeTab === 'knowledge' && currentKnowledge) {
        await onUpdateKnowledge(currentKnowledge.id, {
          term: knowledgeTerm,
          definition: editDescOrContent,
          kpi_formula: knowledgeKpi,
          remarks_entry: remarkInput || '手動變更知識庫詞條'
        });
      } else if (activeTab === 'products' && currentProduct) {
        await onUpdateProduct(currentProduct.id, {
          name: editTitle,
          business_owner: productBusinessOwner,
          tech_owner: productTechOwner,
          product_vision: productVision,
          remarks_entry: remarkInput || '手動修改產品資料',
        });
      }
      setIsEditing(false);
      setRemarkInput('');
    } catch (err) {
      alert('變更儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDrawerMeetingSave = async () => {
    if (!selectedDrawerMeetingId) return;
    setIsSaving(true);
    try {
      const meet = meetings.find(m => String(m.id) === String(selectedDrawerMeetingId));
      await onUpdateMeeting(selectedDrawerMeetingId, {
        title: editTitle,
        content: editDescOrContent,
        meeting_date: meetingDate ? new Date(meetingDate).toISOString() : (meet ? meet.meeting_date : null),
        host: meetingHost,
        project_id: meetingProjectId || null,
        item_follow_by: editFollowBy ? parseInt(editFollowBy, 10) : null,
        item_assigned_by: editAssignedBy ? parseInt(editAssignedBy, 10) : null,
        remarks_entry: remarkInput || '手動修改會議記錄',
      });
      setIsEditing(false);
      setRemarkInput('');
    } catch (err) {
      alert('變更儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };


  const handleModalBottleneckSave = async () => {
    if (!selectedModalBottleneckId) return;
    setIsSaving(true);
    try {
      const b = bottlenecks.find(x => String(x.id) === String(selectedModalBottleneckId));
      await onUpdateBottleneck(selectedModalBottleneckId, {
        item_title: editTitle,
        item_content: {
          ...(b ? b.item_content : {}),
          description: editDescOrContent
        },
        item_priority: bottleneckSeverity,
        item_status: bottleneckStatus,
        item_follow_by: editFollowBy ? parseInt(editFollowBy, 10) : null,
        item_assigned_by: editAssignedBy ? parseInt(editAssignedBy, 10) : null,
        remarks_entry: remarkInput || `手動變更樽頸狀態為 ${bottleneckStatus}`
      });
      setIsEditing(false);
      setRemarkInput('');
    } catch (err) {
      alert('變更儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleModalKnowledgeSave = async () => {
    if (!selectedModalKnowledgeId) return;
    setIsSaving(true);
    try {
      await onUpdateKnowledge(selectedModalKnowledgeId, {
        term: knowledgeTerm,
        definition: editDescOrContent,
        kpi_formula: knowledgeKpi,
        item_follow_by: editFollowBy ? parseInt(editFollowBy, 10) : null,
        item_assigned_by: editAssignedBy ? parseInt(editAssignedBy, 10) : null,
        remarks_entry: remarkInput || '手動變更知識庫詞條'
      });
      setIsEditing(false);
      setRemarkInput('');
    } catch (err) {
      alert('變更儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleModalProjectSave = async () => {
    if (!selectedModalProjectId) return;
    setIsSaving(true);
    try {
      const p = projects.find(x => String(x.id) === String(selectedModalProjectId));
      const parsedContent = {
        ...(p?.content || {}),
        description: editDescOrContent
      };
      await onUpdateProject(selectedModalProjectId, {
        content_name: editTitle,
        content_status: editStatus,
        project_type: editProjectType,
        project_type_sequence: editProjectSeq ? Number(editProjectSeq) : null,
        planned_start_date: editPlannedStart ? new Date(editPlannedStart).toISOString() : null,
        planned_end_date: editPlannedEnd ? new Date(editPlannedEnd).toISOString() : null,
        actual_start_date: editActualStart ? new Date(editActualStart).toISOString() : null,
        actual_end_date: editActualEnd ? new Date(editActualEnd).toISOString() : null,
        related_workspace_id: editWorkspaceId ? Number(editWorkspaceId) : null,
        parent_content_id: editParentId || null,
        content: parsedContent,
        remarks_entry: remarkInput || '手動修改專案資料'
      });
      setIsEditing(false);
      setRemarkInput('');
    } catch (err) {
      alert('變更儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleModalProductSave = async () => {
    if (!selectedModalProductId) return;
    setIsSaving(true);
    try {
      const p = products.find(x => String(x.id) === String(selectedModalProductId));
      const parsedContent = {
        ...(p?.content || {}),
        business_owner: productBusinessOwner,
        tech_owner: productTechOwner,
        product_vision: productVision
      };
      await onUpdateProduct(selectedModalProductId, {
        content_name: editTitle,
        content_status: editStatus,
        related_workspace_id: editWorkspaceId ? Number(editWorkspaceId) : null,
        content: parsedContent,
        remarks_entry: remarkInput || '手動修改產品資料'
      });
      setIsEditing(false);
      setRemarkInput('');
    } catch (err) {
      alert('變更儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleModalMemberSave = async () => {
    if (!selectedModalMemberId) return;
    setIsSaving(true);
    try {
      await onUpdateMember(selectedModalMemberId, {
        member_name: editMemberName,
        member_email: editMemberEmail || null,
        member_role: editMemberRole,
        member_ad_group: editMemberAdGroup || null,
        member_status: editMemberStatus
      });
      setIsEditing(false);
    } catch (err) {
      alert('變更儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleModalWorkspaceSave = async () => {
    if (!selectedModalWorkspaceId) return;
    setIsSaving(true);
    try {
      await onUpdateWorkspace(selectedModalWorkspaceId, {
        prefix_code: editWorkspaceCode.toUpperCase(),
        workspace_name: editWorkspaceName,
        last_item_number: Number(editWorkspaceLastNumber)
      });
      setIsEditing(false);
    } catch (err) {
      alert('變更儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('確定要刪除這個項目嗎？此操作無法還原。')) {
      try {
        if (activeTab === 'projects') {
          if (onDeleteProject) {
            await onDeleteProject(id);
            setSelectedModalProjectId(null);
          }
        } else if (activeTab === 'products') {
          if (onDeleteProduct) {
            await onDeleteProduct(id);
            setSelectedModalProductId(null);
          }
        } else if (activeTab === 'user') {
          if (onDeleteMember) {
            await onDeleteMember(id);
            setSelectedModalMemberId(null);
          }
        } else if (activeTab === 'workspaces') {
          if (onDeleteWorkspace) {
            await onDeleteWorkspace(id);
            setSelectedModalWorkspaceId(null);
          }
        } else {
          if (onDeleteItem) {
            await onDeleteItem(id);
            if (activeTab === 'meetings') setSelectedDrawerMeetingId(null);
            else if (activeTab === 'bottlenecks') setSelectedModalBottleneckId(null);
            else if (activeTab === 'knowledge') setSelectedModalKnowledgeId(null);
            else if (activeTab === 'tasks') setSelectedModalTaskId(null);
          }
        }
        setIsEditing(false);
        // Default back to appropriate table
        const defaultSubItems: Record<string, string> = {
          kanban: 'kanban-board',
          products: 'product-table',
          tasks: 'task-table',
          projects: 'project-table',
          meetings: 'meeting-table',
          bottlenecks: 'bottleneck-table',
          knowledge: 'knowledge-table',
          user: 'user-table',
          workspaces: 'workspace-table'
        };
        onSelectSubItem(defaultSubItems[activeTab] || 'task-table');
      } catch (err) {
        alert('刪除失敗');
      }
    }
  };

  // 4. Traceability actions
  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!traceReqId || !traceTaskId) return;
    setIsLinking(true);
    try {
      await onCreateTraceability(traceReqId, traceTaskId);
      setTraceReqId('');
      setTraceTaskId('');
    } catch (err) {
      alert('建立 Traceability 對接失敗');
    } finally {
      setIsLinking(false);
    }
  };

  // 5. Config bindings
  const saveApiKey = () => {
    localStorage.setItem('MOCK_GEMINI_KEY', geminiKey);
    alert('AI API 金鑰已儲存於瀏覽器 LocalStorage！');
  };

  const handleResetDb = async () => {
    if (!window.confirm('確定要清除資料庫並重新載入 Sprint 3 的初始 Seed 數據嗎？')) return;
    setIsDbResetting(true);
    try {
      // Call standard reset if backend implements it, or fetch reset command
      const res = await fetch(API_BASE.replace('/api', '/health'));
      if (res.ok) {
        alert('資料庫連線狀況正常。請於終端機執行 `npm run init-db` 進行安全重設。');
      }
    } catch (err) {
      alert('連線失敗');
    } finally {
      setIsDbResetting(false);
    }
  };



  const renderInlineContent = (contentArr: any[]): React.ReactNode => {
    if (!Array.isArray(contentArr)) return null;
    return contentArr.map((item, idx) => {
      if (item.type === 'link') {
        return (
          <a key={idx} href={item.href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>
            {renderInlineContent(item.content)}
          </a>
        );
      }
      if (item.type === 'text') {
        let styles: React.CSSProperties = {};
        if (item.styles?.bold) styles.fontWeight = 'bold';
        if (item.styles?.italic) styles.fontStyle = 'italic';
        if (item.styles?.underline) styles.textDecoration = 'underline';
        if (item.styles?.strike) styles.textDecoration = (styles.textDecoration ? styles.textDecoration + ' ' : '') + 'line-through';
        if (item.styles?.code) {
          return (
            <code key={idx} style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px' }}>
              {item.text}
            </code>
          );
        }
        return (
          <span key={idx} style={styles}>
            {item.text}
          </span>
        );
      }
      return null;
    });
  };

  const renderJsonBlock = (block: any, index: number): React.ReactNode => {
    const key = `block-${block.id || index}`;
    
    const renderChildren = () => {
      if (Array.isArray(block.children) && block.children.length > 0) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
            {block.children.map((child: any, childIdx: number) => renderJsonBlock(child, childIdx))}
          </div>
        );
      }
      return null;
    };

    switch (block.type) {
      case 'heading': {
        const level = block.props?.level || 1;
        const fontSize = level === 1 ? '20px' : level === 2 ? '17px' : '15px';
        return (
          <div key={key} style={{ margin: '14px 0 8px 0' }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize, fontWeight: 'bold' }}>
              {renderInlineContent(block.content)}
            </h2>
            {renderChildren()}
          </div>
        );
      }
      case 'bulletListItem':
        return (
          <div key={key} style={{ margin: '4px 0 4px 20px', display: 'list-item', listStyleType: 'disc', color: 'var(--text-secondary)' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>
              {renderInlineContent(block.content)}
            </div>
            {renderChildren()}
          </div>
        );
      case 'numberedListItem':
        return (
          <div key={key} style={{ margin: '4px 0 4px 20px', display: 'list-item', listStyleType: 'decimal', color: 'var(--text-secondary)' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>
              {renderInlineContent(block.content)}
            </div>
            {renderChildren()}
          </div>
        );
      case 'toggle':
        return (
          <details key={key} open style={{ margin: '12px 0', padding: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <summary style={{ fontWeight: 'bold', color: 'var(--accent-primary)', cursor: 'pointer', outline: 'none', userSelect: 'none' }}>
              {renderInlineContent(block.content) || '折疊內容'}
            </summary>
            <div style={{ marginTop: '8px', paddingLeft: '8px', borderLeft: '2px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>
              {renderChildren()}
            </div>
          </details>
        );
      case 'table': {
        const rows = block.content?.rows || [];
        return (
          <div key={key} style={{ overflowX: 'auto', margin: '12px 0', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', background: 'rgba(255,255,255,0.01)' }}>
              <tbody>
                {rows.map((row: any, rIdx: number) => (
                  <tr key={rIdx} style={{ borderBottom: rIdx === rows.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
                    {row.cells?.map((cell: any, cIdx: number) => (
                      <td key={cIdx} style={{ padding: '8px 12px', color: 'var(--text-secondary)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                        {renderInlineContent(cell?.content)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {renderChildren()}
          </div>
        );
      }
      case 'paragraph':
      default:
        return (
          <div key={key} style={{ margin: '6px 0' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>
              {renderInlineContent(block.content) || <br />}
            </p>
            {renderChildren()}
          </div>
        );
    }
  };

  // 5.5 Universal Markdown Parser with Headings, Lists, Tables and Toggles
  const parseMarkdownToReact = (md: any): React.ReactNode => {
    if (!md) return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>無內容</span>;

    if (Array.isArray(md)) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {md.map((block: any, idx: number) => renderJsonBlock(block, idx))}
        </div>
      );
    }

    if (typeof md === 'string') {
      const trimmedMd = md.trim();
      if (trimmedMd.startsWith('[') || trimmedMd.startsWith('{')) {
        try {
          const blocks = JSON.parse(trimmedMd);
          if (Array.isArray(blocks)) {
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {blocks.map((block: any, idx: number) => renderJsonBlock(block, idx))}
              </div>
            );
          }
        } catch (err) {
          console.error("Failed to parse block JSON in preview:", err);
        }
      }
    }

    const lines = typeof md === 'string' ? md.split('\n') : [];
    const elements: React.ReactNode[] = [];
    
    let inTable = false;
    let tableRows: string[][] = [];
    let inDetails = false;
    let detailsSummary = '';
    let detailsContentLines: string[] = [];
    let listItems: string[] = [];
    let inList = false;

    const flushList = (key: string) => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={key} style={{ margin: '8px 0', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
            {listItems.map((item, idx) => (
              <li key={idx} style={{ marginBottom: '4px', lineHeight: '1.5' }}>{item}</li>
            ))}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    const flushTable = (key: string) => {
      if (tableRows.length > 0) {
        const headers = tableRows[0];
        const rows = tableRows.slice(1);
        const cleanRows = rows.filter(r => !r.every(cell => cell.trim().startsWith('-') || cell.trim() === ''));

        elements.push(
          <div key={key} style={{ overflowX: 'auto', margin: '12px 0', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', background: 'rgba(255,255,255,0.01)' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)' }}>
                  {headers.map((h, idx) => (
                    <th key={idx} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 'bold', color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cleanRows.map((r, rIdx) => (
                  <tr key={rIdx} style={{ borderBottom: rIdx === cleanRows.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)', background: rIdx % 2 === 1 ? 'rgba(255,255,255,0.005)' : 'transparent' }}>
                    {r.map((cell, cIdx) => {
                      let color = 'var(--text-secondary)';
                      const cellTrim = cell.trim();
                      if (cellTrim === '已完成' || cellTrim === 'DONE' || cellTrim === 'Completed') {
                        color = '#10B981';
                      } else if (cellTrim === '進行中' || cellTrim === 'IN_PROGRESS' || cellTrim === 'In Progress') {
                        color = '#3B82F6';
                      }
                      return (
                        <td key={cIdx} style={{ padding: '8px 12px', color }}>{cell}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
        inTable = false;
      }
    };

    const flushDetails = (key: string) => {
      if (inDetails) {
        elements.push(
          <details key={key} style={{ margin: '12px 0', padding: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <summary style={{ fontWeight: 'bold', color: 'var(--accent-primary)', cursor: 'pointer', outline: 'none', userSelect: 'none' }}>
              {detailsSummary || '詳細資訊 (點擊展開)'}
            </summary>
            <div style={{ marginTop: '8px', paddingLeft: '8px', borderLeft: '2px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>
              {parseMarkdownToReact(detailsContentLines.join('\n'))}
            </div>
          </details>
        );
        inDetails = false;
        detailsSummary = '';
        detailsContentLines = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();
      const key = `item-${i}`;

      if (trimmed.startsWith('<details>')) {
        flushList(key + '-list');
        flushTable(key + '-table');
        inDetails = true;
        detailsContentLines = [];
        const summaryMatch = trimmed.match(/<summary>(.*?)<\/summary>/);
        if (summaryMatch) {
          detailsSummary = summaryMatch[1];
        }
        continue;
      }
      if (inDetails) {
        if (trimmed.startsWith('</details>')) {
          flushDetails(key + '-details');
          continue;
        }
        const summaryMatch = trimmed.match(/<summary>(.*?)<\/summary>/);
        if (summaryMatch) {
          detailsSummary = summaryMatch[1];
        } else {
          detailsContentLines.push(rawLine);
        }
        continue;
      }

      if (trimmed.startsWith('|')) {
        flushList(key + '-list');
        inTable = true;
        const row = trimmed.split('|').slice(1, -1).map(cell => cell.trim());
        tableRows.push(row);
        continue;
      } else if (inTable) {
        flushTable(key + '-table');
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.match(/^\d+\.\s/)) {
        inList = true;
        const content = trimmed.replace(/^(-|\*|\d+\.)\s+/, '');
        listItems.push(content);
        continue;
      } else if (inList) {
        flushList(key + '-list');
      }

      if (trimmed.startsWith('# ')) {
        elements.push(<h1 key={key} style={{ color: 'var(--accent-primary)', fontSize: '20px', margin: '14px 0 8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '4px' }}>{trimmed.slice(2)}</h1>);
      } else if (trimmed.startsWith('## ')) {
        elements.push(<h2 key={key} style={{ color: 'var(--accent-secondary)', fontSize: '17px', margin: '12px 0 6px 0' }}>{trimmed.slice(3)}</h2>);
      } else if (trimmed.startsWith('### ')) {
        elements.push(<h3 key={key} style={{ color: 'var(--text-primary)', fontSize: '15px', margin: '10px 0 4px 0', fontWeight: 'bold' }}>{trimmed.slice(4)}</h3>);
      } else if (trimmed === '') {
        elements.push(<div key={key} style={{ height: '6px' }} />);
      } else {
        elements.push(
          <p key={key} style={{ margin: '6px 0', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>
            {trimmed}
          </p>
        );
      }
    }

    const endKey = 'end-flush';
    if (inTable) flushTable(endKey + '-table');
    if (inList) flushList(endKey + '-list');
    if (inDetails) flushDetails(endKey + '-details');

    return <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{elements}</div>;
  };

  // 6. Grid Parser for Meeting markdown records
  const renderProjectDrawer = () => {
    if (!selectedProductProjectId) return null;
    const selectedProjectName = projects.find(p => String(p.id) === String(selectedProductProjectId))?.name || '未知專案';
    const associatedCharter = charters.find(c => c.project_id === selectedProductProjectId);
    const associatedPlan = plans.find(p => p.project_id === selectedProductProjectId);
    const projectReqs = requirements.filter(r => r.project_id === selectedProductProjectId);
    const projectReqIds = projectReqs.map(r => r.id);
    const projectTraceability = traceability.filter(t => projectReqIds.includes(t.requirement_id));

    return (
      <>
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>

        {/* Backdrop Overlay */}
        <div 
          onClick={() => setSelectedProductProjectId(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 2000,
            cursor: 'pointer',
            animation: 'fadeIn 0.2s ease-out',
          }}
        />
        
        {/* Sliding Drawer Panel */}
        <div 
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '65%',
            maxWidth: '900px',
            minWidth: '500px',
            backgroundColor: '#0A0F1D',
            borderLeft: '1px solid var(--border-color)',
            boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.6)',
            zIndex: 2001,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Drawer Sticky Header */}
          <div style={{
            padding: '24px 32px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            backgroundColor: '#0A0F1D',
            zIndex: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>📂</span>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  {selectedProjectName}
                </h2>
              </div>
              
              {/* Horizontal active tab navigation shortcuts inside drawer */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  onClick={() => setDrawerTab('overview')}
                  style={{
                    ...styles.drawerTabBtn,
                    backgroundColor: drawerTab === 'overview' ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                    borderColor: drawerTab === 'overview' ? 'var(--accent-primary)' : 'var(--border-color)',
                  }}
                >
                  📊 關聯概覽
                </button>
                <button 
                  onClick={() => setDrawerTab('charter')}
                  style={{
                    ...styles.drawerTabBtn,
                    backgroundColor: drawerTab === 'charter' ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                    borderColor: drawerTab === 'charter' ? 'var(--accent-primary)' : 'var(--border-color)',
                  }}
                >
                  📄 專案章程
                </button>
                <button 
                  onClick={() => setDrawerTab('plan')}
                  style={{
                    ...styles.drawerTabBtn,
                    backgroundColor: drawerTab === 'plan' ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                    borderColor: drawerTab === 'plan' ? 'var(--accent-primary)' : 'var(--border-color)',
                  }}
                >
                  📅 WBS / RACI 計劃表
                </button>
                <button 
                  onClick={() => setDrawerTab('traceability')}
                  style={{
                    ...styles.drawerTabBtn,
                    backgroundColor: drawerTab === 'traceability' ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                    borderColor: drawerTab === 'traceability' ? 'var(--accent-primary)' : 'var(--border-color)',
                  }}
                >
                  🔗 需求對接追蹤矩陣
                </button>
                <button 
                  onClick={() => setDrawerTab('requirements')}
                  style={{
                    ...styles.drawerTabBtn,
                    backgroundColor: drawerTab === 'requirements' ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                    borderColor: drawerTab === 'requirements' ? 'var(--accent-primary)' : 'var(--border-color)',
                  }}
                >
                  📋 需求基準總表
                </button>
              </div>
            </div>
            <button 
              onClick={() => setSelectedProductProjectId(null)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1
              }}
            >
              &times;
            </button>
          </div>

          {/* Drawer Body Container */}
          <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
            
            {/* 1. OVERVIEW TAB */}
            {drawerTab === 'overview' && (
              <>
                {/* Project Objective / Goals Block */}
                {associatedCharter && (
                  <div style={styles.charterBlock}>
                    <h3 style={styles.sectionTitle}>🎯 專案核心目標 (Project Goals)</h3>
                    <p style={styles.charterText}>{associatedCharter.content?.goals || '無目標說明'}</p>
                  </div>
                )}

                {/* Related Tasks Table */}
                <div>
                  <strong style={{ display: 'block', marginBottom: '10px', fontSize: '14px', color: 'var(--text-primary)' }}>📋 相關任務工單 ({tasks.filter(t => t.project_id === selectedProductProjectId).length})</strong>
                  {(() => {
                    const taskColumns = [
                      {
                        id: 'title',
                        header: '標題',
                        cell: (t: any) => <span style={{ fontWeight: 'bold' }}>📄 {t.title}</span>
                      },
                      {
                        id: 'priority',
                        header: '優先級',
                        cell: (t: any) => (
                          <>
                            {t.priority === 'High' && <span className="priority-high">High</span>}
                            {t.priority === 'Middle' && <span className="priority-middle">Middle</span>}
                            {t.priority === 'Low' && <span className="priority-low">Low</span>}
                            {!['High', 'Middle', 'Low'].includes(t.priority || '') && <span className="priority-middle">Middle</span>}
                          </>
                        )
                      },
                      {
                        id: 'status',
                        header: '狀態',
                        cell: (t: any) => (
                          <>
                            <span className={`status-lamp ${t.status.toLowerCase().replace('_', '')}`} style={{ marginRight: '6px' }} />
                            {t.status}
                          </>
                        )
                      },
                      {
                        id: 'due_date',
                        header: '截止日期',
                        cell: (t: any) => formatChineseDate(t.due_date)
                      },
                      {
                        id: 'follow_by',
                        header: '負責人',
                        cell: (t: any) => members.find(mem => String(mem.member_id) === String(t.item_follow_by))?.member_name || '未指派'
                      },
                      ...getRemainingProjectItemColumns(members, workspaces, projects, ['item_title', 'item_priority', 'item_status', 'item_planned_end_date', 'item_follow_by'])
                    ];

                    const taskData = tasks.filter(t => t.project_id === selectedProductProjectId);

                    return (
                      <AdvancedTable
                        tableId={`related_tasks_${selectedProductProjectId}`}
                        data={taskData}
                        columns={taskColumns}
                        onRowClick={(t) => setSelectedModalTaskId(t.id)}
                      />
                    );
                  })()}
                </div>

                {/* Related Meetings Table */}
                <div>
                  <strong style={{ display: 'block', marginBottom: '10px', fontSize: '14px', color: 'var(--text-primary)' }}>📅 相關會議記錄 ({meetings.filter(m => m.project_id === selectedProductProjectId).length})</strong>
                  {(() => {
                    const meetingColumns = [
                      {
                        id: 'title',
                        header: '會議名稱',
                        cell: (m: any) => <span style={{ fontWeight: 'bold' }}>📅 {m.title}</span>
                      },
                      {
                        id: 'meeting_date',
                        header: '日期',
                        cell: (m: any) => formatChineseDate(m.meeting_date)
                      },
                      {
                        id: 'host',
                        header: '主持人',
                        cell: (m: any) => m.host || '—'
                      },
                      {
                        id: 'summary',
                        header: '摘要',
                        cell: (m: any) => m.summary || '—'
                      },
                      ...getRemainingProjectItemColumns(members, workspaces, projects, ['item_title', 'item_planned_start_date', 'item_attribute'])
                    ];

                    const meetingData = meetings.filter(m => m.project_id === selectedProductProjectId);

                    return (
                      <AdvancedTable
                        tableId={`related_meetings_${selectedProductProjectId}`}
                        data={meetingData}
                        columns={meetingColumns}
                        onRowClick={(m) => setSelectedDrawerMeetingId(m.id)}
                      />
                    );
                  })()}
                </div>

                {/* Related Bottlenecks Table */}
                <div>
                  <strong style={{ display: 'block', marginBottom: '10px', fontSize: '14px', color: 'var(--text-primary)' }}>⚠️ 相關樽頸與風險 ({bottlenecks.filter(b => b.project_id === selectedProductProjectId).length})</strong>
                  {(() => {
                    const bottleneckColumns = [
                      {
                        id: 'title',
                        header: '阻礙名稱',
                        cell: (b: any) => <span style={{ fontWeight: 'bold' }}>📄 {b.title}</span>
                      },
                      {
                        id: 'severity',
                        header: '嚴重程度',
                        cell: (b: any) => (
                          <>
                            {b.severity === 'High' && <span className="priority-high">High</span>}
                            {b.severity === 'Middle' && <span className="priority-middle">Middle</span>}
                            {b.severity === 'Low' && <span className="priority-low">Low</span>}
                          </>
                        )
                      },
                      {
                        id: 'status',
                        header: '狀態',
                        cell: (b: any) => (
                          <>
                            <span className={`status-lamp ${b.status === 'ACTIVE' ? 'blocked' : 'done'}`} style={{ marginRight: '6px' }} />
                            {b.status}
                          </>
                        )
                      },
                      ...getRemainingProjectItemColumns(members, workspaces, projects, ['item_title', 'item_priority', 'item_status'])
                    ];

                    const bottleneckData = bottlenecks.filter(b => b.project_id === selectedProductProjectId);

                    return (
                      <AdvancedTable
                        tableId={`related_bottlenecks_${selectedProductProjectId}`}
                        data={bottleneckData}
                        columns={bottleneckColumns}
                        onRowClick={(b) => setSelectedModalBottleneckId(b.id)}
                      />
                    );
                  })()}
                </div>

                {/* Related Knowledge Notes Table */}
                <div>
                  <strong style={{ display: 'block', marginBottom: '10px', fontSize: '14px', color: 'var(--text-primary)' }}>🧠 相關業務知識 ({knowledge.filter(k => k.project_id === selectedProductProjectId).length})</strong>
                  {(() => {
                    const knowledgeColumns = [
                      {
                        id: 'term',
                        header: '詞條名稱',
                        cell: (k: any) => <span style={{ fontWeight: 'bold' }}>📄 {k.term}</span>
                      },
                      {
                        id: 'definition',
                        header: '定義描述',
                        cell: (k: any) => (
                          <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={k.definition}>
                            {k.definition}
                          </span>
                        )
                      },
                      {
                        id: 'kpi_formula',
                        header: 'KPI 公式',
                        cell: (k: any) => (
                          <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={k.kpi_formula || ''}>
                            {k.kpi_formula || '—'}
                          </span>
                        )
                      },
                      {
                        id: 'tag',
                        header: '標籤',
                        cell: (k: any) => k.tag ? <span className="relation-badge">{k.tag}</span> : '—'
                      },
                      {
                        id: 'status',
                        header: '狀態',
                        cell: (k: any) => (
                          <>
                            {k.status === '完成' && <span className="status-badge-done">● 完成</span>}
                            {k.status === '封存' && <span className="status-badge-archive">● 封存</span>}
                            {k.status === '進行中' && <span className="status-badge-progress">● 進行中</span>}
                            {k.status === 'INBOX' && <span className="status-badge-inbox">● INBOX</span>}
                            {!['完成', '封存', '進行中', 'INBOX'].includes(k.status) && <span className="status-badge-todo">● {k.status}</span>}
                          </>
                        )
                      },
                      ...getRemainingProjectItemColumns(members, workspaces, projects, ['item_title', 'item_content', 'item_attribute', 'item_status'])
                    ];

                    const knowledgeData = knowledge.filter(k => k.project_id === selectedProductProjectId);

                    return (
                      <AdvancedTable
                        tableId={`related_knowledge_${selectedProductProjectId}`}
                        data={knowledgeData}
                        columns={knowledgeColumns}
                        onRowClick={(k) => setSelectedModalKnowledgeId(k.id)}
                      />
                    );
                  })()}
                </div>
              </>
            )}

            {/* 2. CHARTER TAB */}
            {drawerTab === 'charter' && (
              <div style={styles.contentSection}>
                <div style={styles.charterBlock}>
                  <h3 style={styles.sectionTitle}>專案核心目標 (Goals)</h3>
                  <p style={styles.charterText}>{associatedCharter?.content?.goals || '無明確目標。'}</p>
                </div>
                <div style={styles.charterBlock}>
                  <h3 style={styles.sectionTitle}>專案範圍 (In-Scope)</h3>
                  <p style={styles.charterText}>{associatedCharter?.content?.scope || '無範圍說明。'}</p>
                </div>
                <div style={styles.charterBlock}>
                  <h3 style={styles.sectionTitle}>排除範圍 (Out-of-Scope)</h3>
                  <p style={styles.charterText}>{associatedCharter?.content?.out_of_scope || '無排除說明。'}</p>
                </div>
                <div>
                  <h3 style={styles.sectionTitle}>5W2H 專案骨架屬性</h3>
                  <div style={styles.w5h2Grid}>
                    {[
                      { label: 'WHAT (產品是什麼)', val: associatedCharter?.content?.w5h2?.what },
                      { label: 'WHY (核心痛點/價值)', val: associatedCharter?.content?.w5h2?.why },
                      { label: 'WHO (干係人/用戶群)', val: associatedCharter?.content?.w5h2?.who },
                      { label: 'WHERE (部署或交付處)', val: associatedCharter?.content?.w5h2?.where },
                      { label: 'WHEN (里程碑時段)', val: associatedCharter?.content?.w5h2?.when },
                      { label: 'HOW (技術手段方法)', val: associatedCharter?.content?.w5h2?.how },
                      { label: 'HOW MUCH (預算估算)', val: associatedCharter?.content?.w5h2?.how_much },
                    ].map((item, idx) => (
                      <div key={idx} style={styles.w5h2Card}>
                        <span style={styles.w5h2Label}>{item.label}</span>
                        <span style={styles.w5h2Val}>{item.val || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 3. PLAN TAB */}
            {drawerTab === 'plan' && (
              <div style={styles.contentSection}>
                {associatedPlan ? (
                  <>
                    <div style={styles.propertiesGrid}>
                      <div style={styles.propertyItem}>
                        <span style={styles.propertyLabel}>里程碑日期：</span>
                        <strong>{formatDateString(associatedPlan.milestone_date)}</strong>
                      </div>
                      <div style={styles.propertyItem}>
                        <span style={styles.propertyLabel}>R - Responsible (執行者)：</span>
                        <span className="nature-tag">{associatedPlan.r_assignees?.join(', ') || '無'}</span>
                      </div>
                      <div style={styles.propertyItem}>
                        <span style={styles.propertyLabel}>A - Accountable (核准者)：</span>
                        <span className="nature-tag" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-done)' }}>
                          {associatedPlan.a_assignees?.join(', ') || '無'}
                        </span>
                      </div>
                      <div style={styles.propertyItem}>
                        <span style={styles.propertyLabel}>C - Consulted (諮詢者)：</span>
                        <span>{associatedPlan.c_assignees?.join(', ') || '無'}</span>
                      </div>
                      <div style={styles.propertyItem}>
                        <span style={styles.propertyLabel}>I - Informed (知會者)：</span>
                        <span>{associatedPlan.i_assignees?.join(', ') || '無'}</span>
                      </div>
                    </div>
                    <div style={styles.charterBlock}>
                      <h3 style={styles.sectionTitle}>WBS 里程碑目標描述</h3>
                      <p style={styles.charterText}>{associatedPlan.description || '無描述'}</p>
                    </div>
                  </>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>本專案目前無 WBS RACI 計畫數據。</div>
                )}
              </div>
            )}

            {/* 4. TRACEABILITY TAB */}
            {drawerTab === 'traceability' && (
              <div style={styles.contentSection}>
                <h3 style={styles.sectionTitle}>已對接的對照矩陣 ({projectTraceability.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {projectTraceability.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>本專案目前無 Traceability 對接連結。</div>
                  ) : (
                    projectTraceability.map(link => (
                      <div key={link.id} style={{ ...styles.charterBlock, padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--accent-secondary)', fontWeight: 600 }}>
                            {link.requirement_title || '未知需求 ID'}
                          </span>
                          <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                            ➡️ {link.task_title || '未知工單 ID'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 5. REQUIREMENTS TAB */}
            {drawerTab === 'requirements' && (
              <div style={styles.contentSection}>
                <h3 style={styles.sectionTitle}>專案需求基準總表 ({projectReqs.length})</h3>
                {projectReqs.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>本專案目前無需求基準數據。</div>
                ) : (
                  (() => {
                    const reqColumns = [
                      {
                        id: 'title',
                        header: '需求標題',
                        cell: (r: any) => <span style={{ fontWeight: 'bold' }}>📄 {r.title}</span>
                      },
                      {
                        id: 'category',
                        header: '分類',
                        cell: (r: any) => r.category
                      },
                      {
                        id: 'priority',
                        header: 'MoSCoW 優先級',
                        cell: (r: any) => (
                          <>
                            {r.priority === 'Must' && <span className="priority-high">Must</span>}
                            {r.priority === 'Should' && <span className="priority-middle">Should</span>}
                            {r.priority === 'Could' && <span className="priority-low">Could</span>}
                            {r.priority === 'Won\'t' && <span className="priority-low" style={{ textDecoration: 'line-through' }}>Won't</span>}
                          </>
                        )
                      },
                      {
                        id: 'status',
                        header: '狀態',
                        cell: (r: any) => (
                          <>
                            {r.status === 'APPROVED' ? (
                              <span className="status-badge-done">● APPROVED</span>
                            ) : r.status === 'REJECTED' ? (
                              <span className="status-badge-archive">● REJECTED</span>
                            ) : (
                              <span className="status-badge-todo">● DRAFT</span>
                            )}
                          </>
                        )
                      }
                    ];

                    return (
                      <AdvancedTable
                        tableId={`project_requirements_${selectedProductProjectId}`}
                        data={projectReqs}
                        columns={reqColumns}
                      />
                    );
                  })()
                )}
              </div>
            )}

          </div>
        </div>
      </>
    );
  };

  const renderTaskModal = () => {
    if (!selectedModalTaskId) return null;
    const task = tasks.find(t => String(t.id) === String(selectedModalTaskId));
    if (!task) return null;

    const remarks = task.remarks || [];

    return (
      <>
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes zoomIn {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        `}</style>
        {/* Modal Wrapper Container (Centering to avoid drag-and-drop transform bugs) */}
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2009,
          }}
        >
          {/* Backdrop Overlay */}
          <div 
            onClick={() => {
              setSelectedModalTaskId(null);
              setIsEditing(false);
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              animation: 'fadeIn 0.2s ease-out',
            }}
          />
          {/* Modal Window */}
          <div 
            style={{
              position: 'relative',
              width: '96vw',
              maxWidth: '1800px',
              height: '90vh',
            backgroundColor: '#0A0F1D',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.8)',
            zIndex: 2010,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            color: 'var(--text-primary)',
            animation: 'zoomIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Jira-style Header with Breadcrumbs */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px 8px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
              {(() => {
                const draftParentId = draftTaskUpdates.parent_item_id !== undefined ? draftTaskUpdates.parent_item_id : task.parent_item_id;
                const proj = projects.find(p => String(p.id) === String(task.related_context_id) || String(p.id) === String(task.project_id));
                const parentTask = draftParentId ? tasks.find(t => String(t.id) === String(draftParentId)) : null;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                    {proj && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span 
                          style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--text-primary)' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedModalTaskId(null);
                            setSelectedModalProjectId(String(proj.id));
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-primary)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                          title="前往所屬專案"
                        >
                          📁 {proj.name}
                        </span>
                        <span style={{ margin: '0 4px', color: 'var(--text-muted)' }}>/</span>
                      </span>
                    )}
                    {parentTask && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ cursor: 'pointer' }} onClick={() => setSelectedModalTaskId(parentTask.id)}>
                          <span style={{ textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'inherit')}
                            title={parentTask.item_type || 'Task'}
                          ><span>{getItemTypeStyles(parentTask.item_type || 'Task').icon}</span> {parentTask.item_display_id || `ID: ${parentTask.id}`}</span>
                        </span>
                        <span 
                          style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)', marginLeft: '2px', padding: '0 2px' }}
                          onClick={async () => {
                            setDraftTaskUpdates(prev => ({ ...prev, parent_item_id: null }));
                            try {
                              await onUpdateTask(task.id, { ...task, parent_item_id: null });
                            } catch (e) { alert('更新失敗'); }
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >✕</span>
                        <span style={{ margin: '0 4px', color: 'var(--text-muted)' }}>/</span>
                      </span>
                    )}
                    
                    {!parentTask && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        <Select
                          value={null}
                          onChange={async (option: any) => {
                            if (option) {
                              setDraftTaskUpdates(prev => ({ ...prev, parent_item_id: option.value }));
                              try {
                                await onUpdateTask(task.id, { ...task, parent_item_id: option.value });
                              } catch (e) { alert('更新失敗'); }
                            }
                          }}
                          options={tasks.filter(t => String(t.id) !== String(task.id) && String(t.related_context_id) === String(task.related_context_id)).map(t => ({
                            value: String(t.id),
                            label: `${t.item_display_id} - ${t.item_title}`,
                            type: t.item_type || 'Task'
                          }))}
                          formatOptionLabel={(option: any) => (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{getItemTypeStyles(option.type).icon}</span>
                              <span>{option.label}</span>
                            </div>
                          )}
                          placeholder="Add parent"
                          isClearable={false}
                          styles={{
                            control: (base) => ({
                              ...base,
                              background: 'transparent',
                              border: 'none',
                              boxShadow: 'none',
                              minHeight: '24px',
                              height: '24px',
                              cursor: 'pointer',
                              width: '100px',
                            }),
                            valueContainer: (base) => ({
                              ...base,
                              padding: '0 4px',
                            }),
                            input: (base) => ({
                              ...base,
                              margin: 0,
                              padding: 0,
                              color: 'var(--text-primary)'
                            }),
                            placeholder: (base) => ({
                              ...base,
                              color: 'var(--text-primary)',
                              fontSize: '13px'
                            }),
                            singleValue: (base) => ({
                              ...base,
                              color: 'var(--text-primary)',
                              fontSize: '13px'
                            }),
                            dropdownIndicator: () => ({ display: 'none' }),
                            indicatorSeparator: () => ({ display: 'none' }),
                            menu: (base) => ({
                              ...base,
                              width: '300px',
                              background: '#1E293B',
                              zIndex: 100,
                              border: '1px solid rgba(255,255,255,0.1)'
                            }),
                            option: (base, state) => ({
                              ...base,
                              background: state.isFocused ? '#334155' : 'transparent',
                              color: '#FFF',
                              fontSize: '13px',
                              cursor: 'pointer'
                            })
                          }}
                        />
                        <span style={{ margin: '0 4px', color: 'var(--text-muted)' }}>/</span>
                      </div>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-primary)' }}>
                      <span title={task.item_type || 'Task'}>{getItemTypeStyles(task.item_type || 'Task').icon}</span>
                      {task.item_display_id || task.id}
                    </span>
                  </div>
                );
              })()}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button 
                onClick={async () => {
                  if (window.confirm('確定要刪除此任務嗎？')) {
                    try {
                      await api.deleteItem(String(task.id));
                      setSelectedModalTaskId(null);
                      if (onRefreshData) onRefreshData();
                    } catch (err) {
                      alert('刪除失敗');
                    }
                  }
                }}
                style={{ background: 'transparent', border: 'none', color: '#EF4444', fontSize: '16px', cursor: 'pointer', opacity: 0.8 }}
                title="刪除任務"
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
              <button 
                onClick={() => { setSelectedModalTaskId(null); setIsEditing(false); setDraftTaskUpdates({}); setDraftComment(''); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '24px', cursor: 'pointer', lineHeight: 1, padding: '4px', transition: 'color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                &times;
              </button>
            </div>
          </div>

          {/* Body: Two columns */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Left Panel: Content / Remarks */}
            <div style={{ flex: 1, padding: '0 24px 24px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', borderRight: '1px solid rgba(255, 255, 255, 0.08)' }}>

              {/* Title Section */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginTop: '8px' }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '4px', flexShrink: 0, marginTop: '4px',
                  background: getItemTypeStyles(task.item_type || 'Task').bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px'
                }} title={task.item_type || 'Task'}>
                  {getItemTypeStyles(task.item_type || 'Task').icon}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={e => {
                          setEditTitle(e.target.value);
                          setDraftTaskUpdates((prev: any) => ({ ...prev, item_title: e.target.value }));
                        }}
                        style={{
                          flex: 1, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)', fontSize: '24px', fontWeight: 'bold', padding: '8px 12px',
                          borderRadius: '8px', outline: 'none',
                        }}
                      />
                      <button
                        onClick={async () => {
                          try {
                            const updates = { ...draftTaskUpdates };
                            if (editDescOrContent) {
                              const html = await blockNoteEditor.blocksToHTMLLossy(editDescOrContent);
                              updates.item_content = { ...task.item_content, description: html };
                            }
                            await onUpdateTask(task.id, updates);
                            setIsEditing(false);
                            setDraftTaskUpdates({});
                          } catch (err) { alert('儲存失敗'); }
                        }}
                        style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setEditTitle(task.item_title || task.title);
                          setDraftTaskUpdates({});
                        }}
                        style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '15px' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <h2 
                      onClick={() => setIsEditing(true)} 
                      style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', lineHeight: 1.3, cursor: 'text' }}
                    >
                      {task.item_title || task.title}
                    </h2>
                  )}

                  {/* Jira-style Action Buttons */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                    </button>
                    <button style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    </button>
                  </div>
                </div>
              </div>
              {/* Description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Description</strong>
                <ClickOutsideWrapper active={isEditingDesc} onOutsideClick={() => {
                  setIsEditingDesc(false);
                  if (task.item_content?.description) {
                    safeReplaceBlocks(blockNoteEditor, task.item_content.description);
                  } else {
                    safeReplaceBlocks(blockNoteEditor, [{ type: "paragraph", content: "" }]);
                  }
                }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div 
                    style={{ 
                      background: isEditingDesc ? '#0F1524' : 'transparent', 
                      borderRadius: '8px', 
                      border: isEditingDesc ? '1px solid var(--border-color)' : '1px solid transparent', 
                      minHeight: isEditingDesc ? '200px' : 'auto', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      position: 'relative' 
                    }}
                    onMouseEnter={e => { if (!isEditingDesc) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                    onMouseLeave={e => { if (!isEditingDesc) e.currentTarget.style.background = 'transparent' }}
                  >
                    {isEditingDesc && <CodeBlockToolbar editor={blockNoteEditor} />}
                    {isEditingDesc && <EditorToolbar editor={blockNoteEditor} />}
                    <div 
                      style={{ padding: isEditingDesc ? '12px' : '0', flex: 1, cursor: isEditingDesc ? 'text' : 'pointer' }} 
                      onClick={() => {
                        if (!isEditingDesc) setIsEditingDesc(true);
                        else blockNoteEditor.focus();
                      }}
                    >
                      {(() => {
                        const desc = task.item_content?.description;
                        const isEmpty = !desc || 
                          (Array.isArray(desc) && desc.length === 0) ||
                          (Array.isArray(desc) && desc.length === 1 && desc[0].type === 'paragraph' && (!desc[0].content || desc[0].content.length === 0)) ||
                          (!Array.isArray(desc) && Object.keys(desc).length === 0);

                        return (
                          <>
                            {!isEditingDesc && isEmpty && (
                              <span style={{ fontStyle: 'italic', opacity: 0.5, display: 'block', padding: '4px' }}>Add a description...</span>
                            )}
                            <div style={{ display: (!isEditingDesc && isEmpty) ? 'none' : 'block' }}>
                              <BlockNoteView 
                                editor={blockNoteEditor} 
                                editable={isEditingDesc}
                                onChange={() => {
                                  if (isEditingDesc) setEditDescOrContent(blockNoteEditor.document);
                                }} 
                                theme="dark" 
                              />
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  {isEditingDesc && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button 
                        onClick={async () => {
                          try {
                            await cleanupR2Images(task.item_content?.description || [], blockNoteEditor.document);
                            
                            const updatedTask = { 
                              ...task, 
                              description: blockNoteEditor.document,
                              item_content: { ...(task.item_content || {}), description: blockNoteEditor.document } 
                            };
                            await onUpdateTask(task.id, updatedTask);
                            setIsEditingDesc(false);
                          } catch (err) {
                            alert('儲存失敗');
                          }
                        }}
                        style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        Save
                      </button>
                      <button 
                        onClick={() => {
                          setIsEditingDesc(false);
                          // Revert editor contents
                          if (task.item_content?.description) {
                            safeReplaceBlocks(blockNoteEditor, task.item_content.description);
                          } else {
                            safeReplaceBlocks(blockNoteEditor, [{ type: "paragraph", content: "" }]);
                          }
                        }}
                        style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 16px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                </ClickOutsideWrapper>
              </div>

              {/* Jira-style Child Work Items Progress and List */}
              {(() => {
                const childTasks = tasks.filter(t => t.parent_item_id && String(t.parent_item_id) === String(task.id));
                const childMeetings = meetings.filter(m => m.parent_item_id && String(m.parent_item_id) === String(task.id));
                const childBottlenecks = bottlenecks.filter(b => b.parent_item_id && String(b.parent_item_id) === String(task.id));
                const childKnowledge = knowledge.filter(k => k.parent_item_id && String(k.parent_item_id) === String(task.id));

                const completedCount = childTasks.filter(t => t.item_status === 'Completed' || t.item_status === 'Closed').length;
                const progressPercent = childTasks.length > 0 ? Math.round((completedCount / childTasks.length) * 100) : 0;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Child work items</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)' }}>
                        <span style={{ fontSize: '16px', cursor: 'pointer', fontWeight: 'bold', letterSpacing: '2px' }}>...</span>
                        <span style={{ fontSize: '18px', cursor: 'pointer' }}>+</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setTaskModalActiveTab('All')}
                        style={{ ...styles.drawerTabBtn, background: taskModalActiveTab === 'All' ? 'rgba(255, 255, 255, 0.1)' : 'transparent', color: taskModalActiveTab === 'All' ? '#FFF' : 'var(--text-muted)', fontWeight: taskModalActiveTab === 'All' ? 'bold' : 'normal', padding: '6px 12px', fontSize: '12px' }}
                      >
                        所有
                      </button>
                      <button
                        onClick={() => setTaskModalActiveTab('Tasks')}
                        style={{ ...styles.drawerTabBtn, background: taskModalActiveTab === 'Tasks' ? 'rgba(59, 130, 246, 0.2)' : 'transparent', color: taskModalActiveTab === 'Tasks' ? '#60A5FA' : 'var(--text-muted)', fontWeight: taskModalActiveTab === 'Tasks' ? 'bold' : 'normal', padding: '6px 12px', fontSize: '12px' }}
                      >
                        📋 任務與工作項 ({childTasks.length})
                      </button>
                      <button
                        onClick={() => setTaskModalActiveTab('Meetings')}
                        style={{ ...styles.drawerTabBtn, background: taskModalActiveTab === 'Meetings' ? 'rgba(99, 102, 241, 0.2)' : 'transparent', color: taskModalActiveTab === 'Meetings' ? '#818CF8' : 'var(--text-muted)', fontWeight: taskModalActiveTab === 'Meetings' ? 'bold' : 'normal', padding: '6px 12px', fontSize: '12px' }}
                      >
                        📅 會議記錄 ({childMeetings.length})
                      </button>
                      <button
                        onClick={() => setTaskModalActiveTab('Bottlenecks')}
                        style={{ ...styles.drawerTabBtn, background: taskModalActiveTab === 'Bottlenecks' ? 'rgba(234, 179, 8, 0.2)' : 'transparent', color: taskModalActiveTab === 'Bottlenecks' ? '#FBBF24' : 'var(--text-muted)', fontWeight: taskModalActiveTab === 'Bottlenecks' ? 'bold' : 'normal', padding: '6px 12px', fontSize: '12px' }}
                      >
                        ⚠️ 阻礙與樽頸 ({childBottlenecks.length})
                      </button>
                      <button
                        onClick={() => setTaskModalActiveTab('Knowledge')}
                        style={{ ...styles.drawerTabBtn, background: taskModalActiveTab === 'Knowledge' ? 'rgba(236, 72, 153, 0.2)' : 'transparent', color: taskModalActiveTab === 'Knowledge' ? '#F472B6' : 'var(--text-muted)', fontWeight: taskModalActiveTab === 'Knowledge' ? 'bold' : 'normal', padding: '6px 12px', fontSize: '12px' }}
                      >
                        🧠 知識與隨筆 ({childKnowledge.length})
                      </button>
                    </div>

                    {(taskModalActiveTab === 'All' || taskModalActiveTab === 'Tasks') && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                          <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div 
                              style={{ 
                                width: `${progressPercent}%`, height: '100%', 
                                background: progressPercent === 100 ? '#4ADE80' : 'var(--accent-primary)', 
                                transition: 'width 0.3s ease'
                              }} 
                            />
                          </div>
                          {childTasks.length > 0 && (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {progressPercent}% Done
                            </span>
                          )}
                        </div>

                        {childTasks.length === 0 ? (
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>尚無子工單</span>
                        ) : (
                          <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                              <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                                  <th style={{ padding: '8px 12px', fontWeight: 'normal', width: '60%' }}>Work</th>
                                  <th style={{ padding: '8px 12px', fontWeight: 'normal', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>Pri...</th>
                                  <th style={{ padding: '8px 12px', fontWeight: 'normal', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>Stor...</th>
                                  <th style={{ padding: '8px 12px', fontWeight: 'normal', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>As...</th>
                                  <th style={{ padding: '8px 12px', fontWeight: 'normal', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {childTasks.map(c => {
                                  const isDone = c.item_status === 'Completed' || c.item_status === 'Closed';
                                  return (
                                    <tr 
                                      key={c.id} 
                                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'default', background: 'transparent' }}
                                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                      <td style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ display: 'inline-block', width: '12px', height: '12px', background: c.item_type === 'Bug' ? '#EF4444' : '#10B981', borderRadius: '2px' }}></span>
                                        <span 
                                          style={{ color: 'var(--accent-secondary)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }} 
                                          title={c.item_type || 'Task'}
                                          onClick={(e) => { e.stopPropagation(); setSelectedModalTaskId(c.id); }}
                                        >
                                          <span>{getItemTypeStyles(c.item_type || 'Task').icon}</span> {c.item_display_id}
                                        </span>
                                        {inlineEditingTraceTitleFor === String(c.id) ? (
                                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flex: 1 }}>
                                            <input
                                              autoFocus
                                              value={inlineEditingTraceTitleValue}
                                              onChange={e => setInlineEditingTraceTitleValue(e.target.value)}
                                              onKeyDown={async (e) => {
                                                if (e.key === 'Enter') {
                                                  try {
                                                    await api.updateTask(c.id, { ...c, item_title: inlineEditingTraceTitleValue });
                                                    if (onRefreshData) await onRefreshData();
                                                    setInlineEditingTraceTitleFor(null);
                                                  } catch(err) { alert('更新失敗'); }
                                                } else if (e.key === 'Escape') {
                                                  setInlineEditingTraceTitleFor(null);
                                                }
                                              }}
                                              style={{ flex: 1, fontSize: '13px', padding: '2px 4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none', borderRadius: '4px', minWidth: '100px' }}
                                            />
                                            <button style={{ background: 'transparent', border: 'none', color: '#10B981', cursor: 'pointer', padding: '2px' }}
                                              onMouseDown={async (e) => {
                                                e.preventDefault();
                                                try {
                                                  await api.updateTask(c.id, { ...c, item_title: inlineEditingTraceTitleValue });
                                                  if (onRefreshData) await onRefreshData();
                                                  setInlineEditingTraceTitleFor(null);
                                                } catch(err) { alert('更新失敗'); }
                                              }}
                                            >✓</button>
                                            <button style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
                                              onMouseDown={(e) => { e.preventDefault(); setInlineEditingTraceTitleFor(null); }}
                                            >✕</button>
                                          </div>
                                        ) : (
                                          <span 
                                            style={{ color: 'var(--text-primary)', cursor: 'text', flex: 1 }}
                                            onClick={() => {
                                              setInlineEditingTraceTitleFor(String(c.id));
                                              setInlineEditingTraceTitleValue(c.item_title || c.title || '');
                                            }}
                                          >
                                            {c.item_title}
                                          </span>
                                        )}
                                      </td>
                                      <td style={{ padding: '10px 12px', borderLeft: '1px solid rgba(255,255,255,0.05)', color: c.item_priority === 'High' ? '#EF4444' : 'var(--text-secondary)' }}>
                                        {c.item_priority === 'High' ? '↑ H' : c.item_priority === 'Low' ? '↓ L' : '= M'}
                                      </td>
                                      <td style={{ padding: '10px 12px', borderLeft: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>None</td>
                                      <td style={{ padding: '10px 12px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#fff' }}>
                                          {members.find(m => String(m.member_id) === String(c.item_assigned_by))?.member_name.charAt(0) || 'U'}
                                        </div>
                                      </td>
                                      <td style={{ padding: '10px 12px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                                        {inlineEditingTraceStatusFor === String(c.id) ? (
                                          <ThemedSelect 
                                            autoFocus
                                            defaultValue={c.item_status || 'Not Start'}
                                            style={{ fontSize: '11px', padding: '2px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: 'none', outline: 'none', borderRadius: '4px' }}
                                            onBlur={() => setInlineEditingTraceStatusFor(null)}
                                            onChange={async (e) => {
                                              try {
                                                await api.updateTask(c.id, { ...c, item_status: e.target.value });
                                                if (onRefreshData) await onRefreshData();
                                                setInlineEditingTraceStatusFor(null);
                                              } catch(err) { alert('更新失敗'); }
                                            }}
                                          >
                                            {['Not Start', 'Ready', 'In Progress', 'Stuck', 'Review', 'Completed', 'Closed', 'Backlog'].map(s => <option key={s} value={s}>{s}</option>)}
                                          </ThemedSelect>
                                        ) : (
                                          <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                            padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold',
                                            background: isDone ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                                            color: isDone ? '#4ADE80' : 'var(--text-secondary)',
                                            cursor: 'pointer'
                                          }}
                                          onClick={(e) => { e.stopPropagation(); setInlineEditingTraceStatusFor(String(c.id)); }}
                                          >
                                            {c.item_status.toUpperCase()} ⌄
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        <form 
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const form = e.currentTarget;
                            const input = form.elements.namedItem('newChildTitle') as HTMLInputElement;
                            const typeSelect = form.elements.namedItem('newChildType') as HTMLInputElement | HTMLSelectElement;
                            const title = input.value.trim();
                            const type = typeSelect ? typeSelect.value : 'Task';
                            if (!title) return;
                            try {
                              await api.createTask({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                related_context_id: task.related_context_id,
                                item_title: title,
                                item_type: type,
                                item_status: 'Not Start',
                                item_priority: 'Middle',
                                parent_item_id: task.id,
                                remarks_entry: `為父工單 TASK-${task.id} 新增子工單`
                              });
                              input.value = '';
                              if (onRefreshData) await onRefreshData();
                            } catch (err) {
                              alert('新增子工單失敗');
                            }
                          }}
                          style={{ display: 'flex', gap: '8px', marginTop: '4px' }}
                        >
                          <Select
                            name="newChildType"
                            defaultValue={{ value: 'Task', label: 'Task' }}
                            styles={{
                              ...reactSelectStyles,
                              control: (base: any, state: any) => ({
                                ...reactSelectStyles.control(base, state),
                                minHeight: '32px',
                                width: '150px'
                              }),
                              valueContainer: (base: any) => ({
                                ...base,
                                padding: '0 8px'
                              })
                            }}
                            options={["Charter", "Epic", "Task", "Event", "Micro Task", "Meeting", "Bottleneck", "Knowledge", "Casual Note", "Bug", "UAT", "Deployment", "Milestone", "Business Objective", "Business Requirement", "User Story"].map(v => ({ value: v, label: v }))}
                            formatOptionLabel={(option: any) => (
                              <span style={{ 
                                backgroundColor: `${getItemTypeStyles(option.value).bg}20`,
                                color: getItemTypeStyles(option.value).text,
                                padding: '2px 6px', borderRadius: '4px', fontSize: '11px',
                                display: 'inline-flex', alignItems: 'center', gap: '4px'
                              }}>
                                <span>{getItemTypeStyles(option.value).icon}</span> {option.label}
                              </span>
                            )}
                            isSearchable={false}
                            menuPlacement="top"
                          />
                          <input
                            type="text"
                            name="newChildTitle"
                            placeholder="➕ 新增子工單標題..."
                            style={{
                              flex: 1,
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-primary)',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              fontSize: '12px',
                              outline: 'none'
                            }}
                          />
                          <button 
                            type="submit"
                            style={{
                              background: 'var(--accent-primary)',
                              border: 'none',
                              color: '#fff',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            新增
                          </button>
                        </form>
                      </>
                    )}

                    {taskModalActiveTab === 'Meetings' && (
                      <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden', marginTop: '0' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                              <th style={{ padding: '8px 12px', fontWeight: 'normal' }}>會議名稱</th>
                              <th style={{ padding: '8px 12px', fontWeight: 'normal' }}>日期</th>
                              <th style={{ padding: '8px 12px', fontWeight: 'normal' }}>主持人</th>
                            </tr>
                          </thead>
                          <tbody>
                            {childMeetings.length === 0 ? (
                              <tr>
                                <td colSpan={3} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>尚無會議記錄</td>
                              </tr>
                            ) : childMeetings.map(m => (
                              <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }} onClick={() => setSelectedDrawerMeetingId(m.id)}>
                                <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>📅 {m.item_title}</td>
                                <td style={{ padding: '10px 12px' }}>{formatChineseDate(m.item_planned_start_date || m.item_created_at)}</td>
                                <td style={{ padding: '10px 12px' }}>{m.item_attribute?.host || 'Edmond Chan'}</td>
                              </tr>
                            ))}
                            {inlineCreatingMeetingProject === String(task.id) ? (
                              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <td colSpan={3} style={{ padding: '10px 12px', borderBottom: 'none' }}>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                      type="text"
                                      autoFocus
                                      placeholder="輸入會議名稱..."
                                      value={inlineCreatingMeetingTitle}
                                      onChange={(e) => setInlineCreatingMeetingTitle(e.target.value)}
                                      onKeyDown={async (e) => {
                                        if (e.key === 'Enter' && inlineCreatingMeetingTitle.trim()) {
                                          try {
                                            await api.createMeeting({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                              related_context_id: task.related_context_id,
                                              item_title: inlineCreatingMeetingTitle,
                                              content: '| 序號 | 討論事項 | 決議/行動方案 | 負責人 | 狀態 |\n|---|---|---|---|---|\n| 1 | 初始化 | 建立文件流水帳 | Edmond | 已完成 |',
                                              summary: '手動建立的會議記錄。',
                                              parent_item_id: task.id,
                                              remarks_entry: '從工單分頁新增會議'
                                            });
                                            if (onRefreshData) await onRefreshData();
                                            setInlineCreatingMeetingTitle('');
                                          } catch (err) { alert('建立會議失敗'); }
                                        } else if (e.key === 'Escape') {
                                          setInlineCreatingMeetingProject(null);
                                        }
                                      }}
                                      style={{ flex: 1, background: 'transparent', color: 'var(--text-primary)', border: 'none', borderBottom: '1px solid var(--accent-primary)', outline: 'none', padding: '6px' }}
                                    />
                                    <button 
                                      onClick={async () => {
                                        if (inlineCreatingMeetingTitle.trim()) {
                                          try {
                                            await api.createMeeting({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                              related_context_id: task.related_context_id,
                                              item_title: inlineCreatingMeetingTitle,
                                              content: '| 序號 | 討論事項 | 決議/行動方案 | 負責人 | 狀態 |\n|---|---|---|---|---|\n| 1 | 初始化 | 建立文件流水帳 | Edmond | 已完成 |',
                                              summary: '手動建立的會議記錄。',
                                              parent_item_id: task.id,
                                              remarks_entry: '從工單分頁新增會議'
                                            });
                                            if (onRefreshData) await onRefreshData();
                                            setInlineCreatingMeetingTitle('');
                                          } catch (err) { alert('建立會議失敗'); }
                                        }
                                      }}
                                      style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
                                    >
                                      Save
                                    </button>
                                    <button 
                                      onClick={() => setInlineCreatingMeetingProject(null)}
                                      style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              <tr style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.01)' }} onClick={() => {
                                setInlineCreatingMeetingProject(String(task.id));
                                setInlineCreatingMeetingTitle('');
                              }}>
                                <td colSpan={3} style={{ padding: '10px 12px', color: 'var(--text-muted)' }}><span style={{ marginRight: '6px' }}>+</span>新增會議記錄</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {taskModalActiveTab === 'Bottlenecks' && (
                      <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden', marginTop: '0' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                              <th style={{ padding: '8px 12px', fontWeight: 'normal' }}>阻礙名稱</th>
                              <th style={{ padding: '8px 12px', fontWeight: 'normal' }}>嚴重程度</th>
                              <th style={{ padding: '8px 12px', fontWeight: 'normal' }}>狀態</th>
                            </tr>
                          </thead>
                          <tbody>
                            {childBottlenecks.length === 0 ? (
                              <tr>
                                <td colSpan={3} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>尚無阻礙與樽頸</td>
                              </tr>
                            ) : childBottlenecks.map(b => (
                              <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }} onClick={() => setSelectedModalBottleneckId(b.id)}>
                                <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>⚠️ {b.item_title}</td>
                                <td style={{ padding: '10px 12px' }}>{b.item_priority}</td>
                                <td style={{ padding: '10px 12px' }}>{b.item_status}</td>
                              </tr>
                            ))}
                            {inlineCreatingBottleneckProject === String(task.id) ? (
                              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <td colSpan={3} style={{ padding: '10px 12px', borderBottom: 'none' }}>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                      type="text"
                                      autoFocus
                                      placeholder="輸入阻礙/樽頸名稱..."
                                      value={inlineCreatingBottleneckTitle}
                                      onChange={(e) => setInlineCreatingBottleneckTitle(e.target.value)}
                                      onKeyDown={async (e) => {
                                        if (e.key === 'Enter' && inlineCreatingBottleneckTitle.trim()) {
                                          try {
                                            await api.createBottleneck({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                              related_context_id: task.related_context_id,
                                              item_title: inlineCreatingBottleneckTitle,
                                              description: '阻礙詳細說明...',
                                              severity: 'Middle',
                                              status: 'Not Start',
                                              parent_item_id: task.id,
                                              remarks_entry: '從工單分頁新增專案樽頸'
                                            });
                                            if (onRefreshData) await onRefreshData();
                                            setInlineCreatingBottleneckTitle('');
                                          } catch (err) { alert('建立樽頸失敗'); }
                                        } else if (e.key === 'Escape') {
                                          setInlineCreatingBottleneckProject(null);
                                        }
                                      }}
                                      style={{ flex: 1, background: 'transparent', color: 'var(--text-primary)', border: 'none', borderBottom: '1px solid var(--accent-primary)', outline: 'none', padding: '6px' }}
                                    />
                                    <button 
                                      onClick={async () => {
                                        if (inlineCreatingBottleneckTitle.trim()) {
                                          try {
                                            await api.createBottleneck({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                              related_context_id: task.related_context_id,
                                              item_title: inlineCreatingBottleneckTitle,
                                              description: '阻礙詳細說明...',
                                              severity: 'Middle',
                                              status: 'Not Start',
                                              parent_item_id: task.id,
                                              remarks_entry: '從工單分頁新增專案樽頸'
                                            });
                                            if (onRefreshData) await onRefreshData();
                                            setInlineCreatingBottleneckTitle('');
                                          } catch (err) { alert('建立樽頸失敗'); }
                                        }
                                      }}
                                      style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
                                    >
                                      Save
                                    </button>
                                    <button 
                                      onClick={() => setInlineCreatingBottleneckProject(null)}
                                      style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              <tr style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.01)' }} onClick={() => {
                                setInlineCreatingBottleneckProject(String(task.id));
                                setInlineCreatingBottleneckTitle('');
                              }}>
                                <td colSpan={3} style={{ padding: '10px 12px', color: 'var(--text-muted)' }}><span style={{ marginRight: '6px' }}>+</span>新增樽頸與風險</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {taskModalActiveTab === 'Knowledge' && (
                      <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden', marginTop: '0' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                              <th style={{ padding: '8px 12px', fontWeight: 'normal' }}>詞條名稱</th>
                              <th style={{ padding: '8px 12px', fontWeight: 'normal' }}>類型</th>
                              <th style={{ padding: '8px 12px', fontWeight: 'normal' }}>標籤</th>
                            </tr>
                          </thead>
                          <tbody>
                            {childKnowledge.length === 0 ? (
                              <tr>
                                <td colSpan={3} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>尚無知識與隨筆</td>
                              </tr>
                            ) : childKnowledge.map(k => (
                              <tr key={k.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }} onClick={() => setSelectedModalKnowledgeId(k.id)}>
                                <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>🧠 {k.item_title}</td>
                                <td style={{ padding: '10px 12px' }}><span className="nature-tag" style={{ backgroundColor: `${getItemTypeStyles(k.item_type || 'Task').bg}20`, color: getItemTypeStyles(k.item_type || 'Task').text, padding: '2px 6px', borderRadius: '4px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span>{getItemTypeStyles(k.item_type || 'Task').icon}</span> {k.item_type}</span></td>
                                <td style={{ padding: '10px 12px' }}>{k.item_attribute?.tag ? <span className="relation-badge">{k.item_attribute.tag}</span> : '—'}</td>
                              </tr>
                            ))}
                            {inlineCreatingKnowledgeProject === String(task.id) ? (
                              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <td colSpan={3} style={{ padding: '10px 12px', borderBottom: 'none' }}>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                      type="text"
                                      autoFocus
                                      placeholder="輸入詞條名稱..."
                                      value={inlineCreatingKnowledgeTitle}
                                      onChange={(e) => setInlineCreatingKnowledgeTitle(e.target.value)}
                                      onKeyDown={async (e) => {
                                        if (e.key === 'Enter' && inlineCreatingKnowledgeTitle.trim()) {
                                          try {
                                            await api.createKnowledge({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                              related_context_id: task.related_context_id,
                                              item_title: inlineCreatingKnowledgeTitle,
                                              definition: '定義內容...',
                                              kpi_formula: null,
                                              parent_item_id: task.id,
                                              remarks_entry: '從工單分頁新增術語定義'
                                            });
                                            if (onRefreshData) await onRefreshData();
                                            setInlineCreatingKnowledgeTitle('');
                                          } catch (err) { alert('建立知識隨筆失敗'); }
                                        } else if (e.key === 'Escape') {
                                          setInlineCreatingKnowledgeProject(null);
                                        }
                                      }}
                                      style={{ flex: 1, background: 'transparent', color: 'var(--text-primary)', border: 'none', borderBottom: '1px solid var(--accent-primary)', outline: 'none', padding: '6px' }}
                                    />
                                    <button 
                                      onClick={async () => {
                                        if (inlineCreatingKnowledgeTitle.trim()) {
                                          try {
                                            await api.createKnowledge({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                              related_context_id: task.related_context_id,
                                              item_title: inlineCreatingKnowledgeTitle,
                                              definition: '定義內容...',
                                              kpi_formula: null,
                                              parent_item_id: task.id,
                                              remarks_entry: '從工單分頁新增術語定義'
                                            });
                                            if (onRefreshData) await onRefreshData();
                                            setInlineCreatingKnowledgeTitle('');
                                          } catch (err) { alert('建立知識隨筆失敗'); }
                                        }
                                      }}
                                      style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
                                    >
                                      Save
                                    </button>
                                    <button 
                                      onClick={() => setInlineCreatingKnowledgeProject(null)}
                                      style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              <tr style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.01)' }} onClick={() => {
                                setInlineCreatingKnowledgeProject(String(task.id));
                                setInlineCreatingKnowledgeTitle('');
                              }}>
                                <td colSpan={3} style={{ padding: '10px 12px', color: 'var(--text-muted)' }}><span style={{ marginRight: '6px' }}>+</span>新增業務知識與隨筆</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Related Items Section */}
              {(() => {
                // Get all related items (both outgoing and incoming)
                const getRelatedItems = () => {
                  const list: any[] = [];
                  
                  const INVERSE_RELATIONS: Record<string, string> = {
                    'blocks': 'blocked_by',
                    'blocked_by': 'blocks',
                    'covers': 'is_covered_by',
                    'is_covered_by': 'covers',
  'deploys': 'is_deployed',
  'is_deployed': 'deploys',
                    'causes': 'is_caused_by',
                    'is_caused_by': 'causes',
                    'discusses': 'discussed_in',
                    'discussed_in': 'discusses'
                  };

                  // Outgoing
                  const outgoing = task.related_item_id_relation || [];
                  if (Array.isArray(outgoing)) {
                    outgoing.forEach((rel: any) => {
                      const targetId = String(rel.target_id);
                      const targetItem = tasks.find(t => String(t.id) === targetId) ||
                                         meetings.find(m => String(m.id) === targetId) ||
                                         bottlenecks.find(b => String(b.id) === targetId) ||
                                         knowledge.find(k => String(k.id) === targetId);
                      if (targetItem) {
                        list.push({
                          id: targetItem.id,
                          item_display_id: targetItem.item_display_id || String(targetItem.id),
                          item_title: targetItem.item_title || targetItem.title || '',
                          item_type: targetItem.item_type || 'Task',
                          item_status: targetItem.item_status || targetItem.status || 'Active',
                          relation: rel.relation,
                          original_relation: rel.relation,
                          direction: 'outgoing'
                        });
                      }
                    });
                  }

                  // Incoming
                  const allItems = [...tasks, ...meetings, ...bottlenecks, ...knowledge];
                  // Deduplicate allItems by id
                  const uniqueItems = Array.from(new Map(allItems.map(item => [String(item.id), item])).values());
                  
                  uniqueItems.forEach(item => {
                    if (String(item.id) === String(task.id)) return;
                    const rels = item.related_item_id_relation || [];
                    if (Array.isArray(rels)) {
                      rels.forEach((rel: any) => {
                        if (String(rel.target_id) === String(task.id)) {
                          list.push({
                            id: item.id,
                            item_display_id: item.item_display_id || String(item.id),
                            item_title: item.item_title || item.title || '',
                            item_type: item.item_type || 'Task',
                            item_status: item.item_status || item.status || 'Active',
                            relation: INVERSE_RELATIONS[rel.relation] || rel.relation,
                            original_relation: rel.relation,
                            direction: 'incoming'
                          });
                        }
                      });
                    }
                  });

                  return list;
                };

                const relatedItems = getRelatedItems();

                const handleUpdateRelation = async (relItem: any, newRelation: string) => {
                  if (relItem.relation === newRelation) return;
                  try {
                    const INVERSE_RELATIONS: Record<string, string> = {
                      'blocks': 'blocked_by',
                      'blocked_by': 'blocks',
                      'covers': 'is_covered_by',
                      'is_covered_by': 'covers',
                      'deploys': 'is_deployed',
                      'is_deployed': 'deploys',
                      'causes': 'is_caused_by',
                      'is_caused_by': 'causes',
                      'discusses': 'discussed_in',
                      'discussed_in': 'discusses'
                    };

                    if (relItem.direction === 'outgoing') {
                      let currentRelations = task.related_item_id_relation;
                      if (typeof currentRelations === 'string') {
                        try { currentRelations = JSON.parse(currentRelations); } catch(err) { currentRelations = []; }
                      }
                      if (!Array.isArray(currentRelations)) currentRelations = [];

                      const newRelations = currentRelations.map((r: any) => {
                        if (String(r.target_id) === String(relItem.id) && r.relation === relItem.original_relation) {
                          return { ...r, relation: newRelation };
                        }
                        return r;
                      });
                      await api.updateTask(task.id, {
                        ...task,
                        related_item_id_relation: newRelations
                      });
                    } else {
                      // Incoming: update the other item
                      const otherItem = tasks.find(t => String(t.id) === String(relItem.id)) ||
                                        meetings.find(m => String(m.id) === String(relItem.id)) ||
                                        bottlenecks.find(b => String(b.id) === String(relItem.id)) ||
                                        knowledge.find(k => String(k.id) === String(relItem.id));
                      if (otherItem) {
                        let otherRelations = otherItem.related_item_id_relation;
                        if (typeof otherRelations === 'string') {
                          try { otherRelations = JSON.parse(otherRelations); } catch(err) { otherRelations = []; }
                        }
                        if (!Array.isArray(otherRelations)) otherRelations = [];

                        const newOriginalRelation = INVERSE_RELATIONS[newRelation] || newRelation;

                        const newRelations = otherRelations.map((r: any) => {
                          if (String(r.target_id) === String(task.id) && r.relation === relItem.original_relation) {
                            return { ...r, relation: newOriginalRelation };
                          }
                          return r;
                        });
                        await api.updateTask(otherItem.id, {
                          ...otherItem,
                          related_item_id_relation: newRelations
                        });
                      }
                    }
                    if (onRefreshData) await onRefreshData();
                  } catch (err) {
                    alert('更新關聯失敗');
                  }
                };

                // Handler to delete a relation
                const handleDeleteRelation = async (relItem: any) => {
                  try {
                    if (relItem.direction === 'outgoing') {
                      let currentRelations = task.related_item_id_relation;
                      if (typeof currentRelations === 'string') {
                        try { currentRelations = JSON.parse(currentRelations); } catch(err) { currentRelations = []; }
                      }
                      if (!Array.isArray(currentRelations)) currentRelations = [];

                      const newRelations = currentRelations.filter(
                        (r: any) => !(String(r.target_id) === String(relItem.id) && r.relation === relItem.original_relation)
                      );
                      await api.updateTask(task.id, {
                        ...task,
                        related_item_id_relation: newRelations
                      });
                    } else {
                      // Incoming: update the other item
                      const otherItem = tasks.find(t => String(t.id) === String(relItem.id)) ||
                                        meetings.find(m => String(m.id) === String(relItem.id)) ||
                                        bottlenecks.find(b => String(b.id) === String(relItem.id)) ||
                                        knowledge.find(k => String(k.id) === String(relItem.id));
                      if (otherItem) {
                        let otherRelations = otherItem.related_item_id_relation;
                        if (typeof otherRelations === 'string') {
                          try { otherRelations = JSON.parse(otherRelations); } catch(err) { otherRelations = []; }
                        }
                        if (!Array.isArray(otherRelations)) otherRelations = [];

                        const newRelations = otherRelations.filter(
                          (r: any) => !(String(r.target_id) === String(task.id) && r.relation === relItem.original_relation)
                        );
                        await api.updateTask(otherItem.id, {
                          ...otherItem,
                          related_item_id_relation: newRelations
                        });
                      }
                    }
                    if (onRefreshData) await onRefreshData();
                  } catch (err) {
                    alert('刪除關聯失敗');
                  }
                };

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                        <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Related items (關聯工單)</strong>
                      </div>
                    </div>

                    {relatedItems.length > 0 && (
                      <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                              <th style={{ padding: '8px 12px', fontWeight: 'normal', width: '45%' }}>Work</th>
                              <th style={{ padding: '8px 12px', fontWeight: 'normal', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>Relation Type</th>
                              <th style={{ padding: '8px 12px', fontWeight: 'normal', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>Direction</th>
                              <th style={{ padding: '8px 12px', fontWeight: 'normal', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>Status</th>
                              <th style={{ padding: '8px 12px', fontWeight: 'normal', borderLeft: '1px solid rgba(255,255,255,0.05)', width: '60px' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {relatedItems.map(rel => {
                              const isDone = rel.item_status === 'Completed' || rel.item_status === 'Closed';
                              return (
                                <tr 
                                  key={`${rel.id}-${rel.relation}-${rel.direction}`}
                                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'transparent' }}
                                >
                                  <td style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span 
                                      style={{ color: 'var(--accent-secondary)', textDecoration: 'underline', cursor: 'pointer' }} 
                                      onClick={() => { setSelectedModalTaskId(rel.id); }}
                                    >
                                      <span>{getItemTypeStyles(rel.item_type).icon}</span> {rel.item_display_id}
                                    </span>
                                    <span style={{ color: 'var(--text-primary)' }}>{rel.item_title}</span>
                                  </td>
                                  <td style={{ padding: '6px 8px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                                    <ThemedSelect
                                      value={rel.relation}
                                      onChange={(e: any) => handleUpdateRelation(rel, e.target.value)}
                                      style={{ width: '100%', background: 'transparent', color: 'var(--text-secondary)', border: 'none', outline: 'none', cursor: 'pointer' }}
                                    >
                                      <option value="blocks">Blocks (阻礙)</option>
                                      <option value="blocked_by">Blocked by (被阻礙)</option>
                                      <option value="covers">Covers (覆蓋)</option>
                                      <option value="is_covered_by">Is covered by (被覆蓋)</option>
                                      <option value="deploys">Deploys (部署)</option>
                                      <option value="is_deployed">Is deployed (被部署)</option>
                                      <option value="causes">Causes (導致)</option>
                                      <option value="is_caused_by">Is caused by (起因於)</option>
                                      <option value="discussed_in">Discussed in (於會議討論)</option>
                                      <option value="discusses">Discusses (討論工單)</option>
                                    </ThemedSelect>
                                  </td>
                                  <td style={{ padding: '10px 12px', borderLeft: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                                    {rel.direction === 'outgoing' ? 'Outgoing' : 'Incoming'}
                                  </td>
                                  <td style={{ padding: '10px 12px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                                      padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold',
                                      background: isDone ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                                      color: isDone ? '#4ADE80' : 'var(--text-secondary)'
                                    }}>
                                      {rel.item_status.toUpperCase()}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 12px', borderLeft: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                                    <button 
                                      onClick={() => handleDeleteRelation(rel)}
                                      style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '12px' }}
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Add Relation UI */}
                    {!isAddingRelation ? (
                      <div 
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0', cursor: 'pointer', color: 'var(--text-muted)' }}
                        onClick={() => setIsAddingRelation(true)}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        <span style={{ fontSize: '16px' }}>+</span> 
                        <span style={{ fontSize: '13px' }}>Create linked work item</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <ThemedSelect 
                            value={relType}
                            onChange={(e: any) => setRelType(e.target.value)}
                            style={{ width: '160px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '13px' }}
                          >
                            <option value="blocks">Blocks (阻礙)</option>
                            <option value="blocked_by">Blocked by (被阻礙)</option>
                            <option value="covers">Covers (覆蓋)</option>
                            <option value="is_covered_by">Is covered by (被覆蓋)</option>
                            <option value="deploys">Deploys (部署)</option>
                            <option value="is_deployed">Is deployed (被部署)</option>
                            <option value="causes">Causes (導致)</option>
                            <option value="is_caused_by">Is caused by (起因於)</option>
                            <option value="discussed_in">Discussed in (於會議討論)</option>
                            <option value="discusses">Discusses (討論工單)</option>
                          </ThemedSelect>

                          <ThemedSelect
                            value={relCreateItemType}
                            onChange={(e: any) => setRelCreateItemType(e.target.value)}
                            style={{ width: '140px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '13px' }}
                          >
                            <option value="Task">🔹 Task</option>
                            <option value="Bug">🐛 Bug</option>
                            <option value="Epic">👑 Epic</option>
                            <option value="User Story">📝 User Story</option>
                            <option value="Business Objective">🎯 Business Objective</option>
                          </ThemedSelect>

                          <div style={{ flex: 1, minWidth: '200px' }}>
                            <CreatableSelect 
                              value={relTargetId ? { value: relTargetId, label: tasks.find(t => String(t.id) === String(relTargetId)) ? `[${tasks.find(t => String(t.id) === String(relTargetId))?.item_type || 'Task'}] ${tasks.find(t => String(t.id) === String(relTargetId))?.item_display_id || relTargetId} - ${tasks.find(t => String(t.id) === String(relTargetId))?.item_title}` : relTargetId } : null}
                              onChange={(selectedOption: any) => setRelTargetId(selectedOption ? selectedOption.value : '')}
                              options={tasks.filter(item => item.id !== task.id).map(item => ({
                                value: String(item.id),
                                label: `[${item.item_type || 'Task'}] ${item.item_display_id || item.id} - ${item.item_title || item.title}`
                              }))}
                              placeholder="Type to search or create new item..."
                              isClearable
                              formatCreateLabel={(inputValue: string) => `Create new item: "${inputValue}"`}
                              styles={{
                                ...reactSelectStyles,
                                control: (base: any, state: any) => ({
                                  ...reactSelectStyles.control(base, state),
                                  minHeight: '32px',
                                  backgroundColor: 'rgba(255,255,255,0.05)',
                                  border: '1px solid var(--border-color)',
                                  fontSize: '13px'
                                }),
                                menu: (base: any) => ({
                                  ...reactSelectStyles.menu(base),
                                  zIndex: 9999
                                })
                              }}
                            />
                          </div>

                          <button 
                            onClick={async () => {
                              if (!relTargetId || !relType) return;
                              try {
                                let targetId = relTargetId;
                                const existingTask = tasks.find(t => String(t.id) === String(relTargetId));
                                
                                if (!existingTask) {
                                  // Create new item
                                  const res = await api.createTask({
                                    workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined,
                                    related_context_id: selectedModalProjectId,
                                    item_title: relTargetId,
                                    item_type: relCreateItemType,
                                    item_status: 'Not Start',
                                    item_priority: 'Middle'
                                  });
                                  targetId = res.id;
                                }

                                let currentRelations = task.related_item_id_relation;
                                if (typeof currentRelations === 'string') {
                                  try { currentRelations = JSON.parse(currentRelations); } catch(err) { currentRelations = []; }
                                }
                                if (!Array.isArray(currentRelations)) currentRelations = [];
                                
                                if (!currentRelations.some((r: any) => Number(r.target_id) === Number(targetId) && r.relation === relType)) {
                                  const newRelations = [...currentRelations, { target_id: Number(targetId), relation: relType }];
                                  await api.updateTask(task.id, {
                                    ...task,
                                    related_item_id_relation: newRelations
                                  });
                                  if (onRefreshData) await onRefreshData();
                                }
                                setIsAddingRelation(false);
                                setRelTargetId('');
                                setRelType('blocks');
                              } catch (err) {
                                alert('操作失敗');
                              }
                            }}
                            style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap', flexShrink: 0 }}
                          >
                            Link / Create
                          </button>
                          <button 
                            onClick={() => {
                              setIsAddingRelation(false);
                              setRelTargetId('');
                              setRelType('blocks');
                            }}
                            style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap', flexShrink: 0 }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Comments History */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Comments</strong>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#fff', flexShrink: 0 }}>
                    M
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {!isCommentEditing ? (
                      <div 
                        onClick={() => setIsCommentEditing(true)} 
                        style={{ 
                          border: '1px solid rgba(255,255,255,0.15)', 
                          borderRadius: '6px', 
                          padding: '12px 16px', 
                          background: 'rgba(255,255,255,0.01)', 
                          cursor: 'text', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '12px' 
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'}
                      >
                        <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Add a comment...</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsCommentEditing(true);
                              setTimeout(() => {
                                const block = commentEditor.getTextCursorPosition().block;
                                commentEditor.insertBlocks([{ type: "paragraph", content: "Suggest a reply..." }], block, "after");
                              }, 50);
                            }} 
                            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                          >
                            Suggest a reply...
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsCommentEditing(true);
                              setTimeout(() => {
                                const block = commentEditor.getTextCursorPosition().block;
                                commentEditor.insertBlocks([{ type: "paragraph", content: "Status update..." }], block, "after");
                              }, 50);
                            }} 
                            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                          >
                            Status update...
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsCommentEditing(true);
                              setTimeout(() => {
                                const block = commentEditor.getTextCursorPosition().block;
                                commentEditor.insertBlocks([{ type: "paragraph", content: "Thanks..." }], block, "after");
                              }, 50);
                            }} 
                            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
                          >
                            Thanks...
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                          <CodeBlockToolbar editor={commentEditor} />
                          <EditorToolbar editor={commentEditor} />
                          <div 
                            style={{ padding: '12px 16px', minHeight: '80px', background: 'transparent', cursor: 'text' }} 
                            onClick={() => {
                              commentEditor.focus();
                            }}
                          >
                            <BlockNoteView
                              editor={commentEditor}
                              theme="dark"
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '8px', padding: '8px 16px', background: 'rgba(255,255,255,0.02)', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => {
                                 const block = commentEditor.getTextCursorPosition().block;
                                 commentEditor.insertBlocks([{ type: "paragraph", content: "Suggest a reply..." }], block, "after");
                              }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Suggest a reply...</button>
                              <button onClick={() => {
                                 const block = commentEditor.getTextCursorPosition().block;
                                 commentEditor.insertBlocks([{ type: "paragraph", content: "Can I get more info...?" }], block, "after");
                              }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Can I get more info...?</button>
                              <button onClick={() => {
                                 const block = commentEditor.getTextCursorPosition().block;
                                 commentEditor.insertBlocks([{ type: "paragraph", content: "Status update..." }], block, "after");
                              }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>Status update...</button>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <button onClick={async () => {
                            const doc = commentEditor.document;
                            if (doc.length === 1 && (!doc[0].content || doc[0].content.length === 0)) return;
                            
                            try {
                              const newCommentObj = { user: 'Me', text: doc, timestamp: new Date().toISOString() };
                              const updatedTask = {
                                ...task,
                                item_comment: [...(task.item_comment || []), newCommentObj]
                              };
                              await onUpdateTask(task.id, updatedTask);
                              safeReplaceBlocks(commentEditor, [{ type: "paragraph", content: "" }]);
                              setIsCommentEditing(false);
                            } catch (err) {
                              alert('留言失敗');
                            }
                          }} style={{ background: 'var(--accent-primary)', border: 'none', color: '#fff', padding: '6px 16px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>Save</button>
                          <button onClick={() => {
                            safeReplaceBlocks(commentEditor, [{ type: "paragraph", content: "" }]);
                            setIsCommentEditing(false);
                          }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', padding: '6px 16px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                        </div>
                      </>
                    )}
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Pro tip: press <b>M</b> to comment</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
                  {(!task.item_comment || task.item_comment.length === 0) ? (
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', marginLeft: '44px' }}>尚無評論記錄</span>
                  ) : (
                    task.item_comment.map((c: any, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#fff', flexShrink: 0 }}>
                          {c.user ? c.user.charAt(0) : 'U'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>{c.user || 'User'}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatChineseDateTime(c.timestamp)}</span>
                          </div>
                          {editingCommentIndex === i ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                <CodeBlockToolbar editor={editCommentEditor} />
                                <EditorToolbar editor={editCommentEditor} />
                                <div style={{ padding: '12px 16px', minHeight: '80px', background: 'transparent', cursor: 'text' }} onClick={() => editCommentEditor.focus()}>
                                  <BlockNoteView editor={editCommentEditor} theme="dark" />
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={async () => {
                                  try {
                                    const doc = editCommentEditor.document;
                                    const updatedComments = [...task.item_comment];
                                    updatedComments[i] = {
                                      ...updatedComments[i],
                                      text: doc,
                                      timestamp: new Date().toISOString()
                                    };
                                    await onUpdateTask(task.id, { ...task, item_comment: updatedComments });
                                    setEditingCommentIndex(null);
                                  } catch (err) {
                                    alert('修改留言失敗');
                                  }
                                }} style={{ background: 'var(--accent-primary)', border: 'none', color: '#fff', padding: '6px 16px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold' }}>Save</button>
                                <button onClick={() => {
                                  setEditingCommentIndex(null);
                                }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', padding: '6px 16px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                              {typeof c.text === 'string' && c.text.startsWith('[') ? (
                                <ReadOnlyCommentEditor content={JSON.parse(c.text)} />
                              ) : typeof c.text === 'object' ? (
                                <ReadOnlyCommentEditor content={c.text} />
                              ) : (
                                c.text
                              )}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                            <span style={{ cursor: 'pointer' }}>Reply</span>
                            <span 
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                setEditingCommentIndex(i);
                                const commentContent = c.text;
                                if (Array.isArray(commentContent)) {
                                  safeReplaceBlocks(editCommentEditor, commentContent);
                                } else if (typeof commentContent === 'string' && commentContent.startsWith('[')) {
                                  safeReplaceBlocks(editCommentEditor, JSON.parse(commentContent));
                                } else {
                                  safeReplaceBlocks(editCommentEditor, [{ type: "paragraph", content: commentContent }]);
                                }
                              }}
                            >
                              Edit
                            </span>
                            <span 
                              style={{ cursor: 'pointer' }}
                              onClick={async () => {
                                if (window.confirm('確定要刪除此留言嗎？')) {
                                  try {
                                    const updatedComments = task.item_comment.filter((_: any, idx: number) => idx !== i);
                                    await onUpdateTask(task.id, { ...task, item_comment: updatedComments });
                                  } catch (err) {
                                    alert('刪除失敗');
                                  }
                                }
                              }}
                            >
                              Delete
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Remarks History */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                <strong style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Remarks 歷史接龍 ({remarks.length})</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                  {remarks.length === 0 ? (
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>尚無備註記錄</span>
                  ) : (
                    remarks.map((r, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '10px 14px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--accent-secondary)', fontWeight: 'bold' }}>{r.user}</span>
                          <span>{formatChineseDateTime(r.timestamp)}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{r.text}</div>
                      </div>
                    ))
                  )}
                </div>
                {isEditing && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>新增備註 (Append Remark)</span>
                    <input
                      type="text"
                      placeholder="輸入備註文字（例如：已確認阻礙因素解決）"
                      value={remarkInput}
                      onChange={e => setRemarkInput(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '13px',
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: Metadata Properties */}
            <div style={{ flex: '0 0 320px', padding: '24px', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', rowGap: '16px', columnGap: '8px', fontSize: '13px', alignItems: 'center' }}>
                  
                  <div style={{ color: 'var(--text-muted)' }}>任務狀態</div>
                  <div>
                    <Select
                      styles={reactSelectStyles}
                      value={{ value: task.item_status || 'Not Start', label: task.item_status || 'Not Start' }}
                      onChange={async (s: any) => {
                        const val = s ? s.value : '';
                        try {
                          await onUpdateTask(task.id, { ...task, item_status: val });
                        } catch (err) { alert('更新狀態失敗'); }
                      }}
                      options={["Not Start", "Ready", "In Progress", "Stuck", "Review", "Completed", "Closed", "Backlog"].map(v => ({ value: v, label: v }))}
                      formatOptionLabel={(option: any) => getItemStatusBadge(option.value)}
                      isSearchable={false}
                    />
                  </div>

                  <div style={{ color: 'var(--text-muted)' }}>工單性質</div>
                  <div>
                    <Select
                      styles={reactSelectStyles}
                      value={{ value: task.item_type || 'Task', label: task.item_type || 'Task' }}
                      onChange={async (s: any) => {
                        const val = s ? s.value : '';
                        try {
                          await onUpdateTask(task.id, { ...task, item_type: val });
                        } catch (err) { alert('更新工單性質失敗'); }
                      }}
                      options={["Charter", "Epic", "Task", "Event", "Micro Task", "Meeting", "Bottleneck", "Knowledge", "Casual Note", "Bug", "UAT", "Deployment", "Milestone", "Business Objective", "Business Requirement", "User Story"].map(v => ({ value: v, label: v }))}
                      formatOptionLabel={(option: any) => (
                        <span style={{ 
                          backgroundColor: `${getItemTypeStyles(option.value).bg}20`,
                          color: getItemTypeStyles(option.value).text,
                          padding: '2px 6px', borderRadius: '4px', fontSize: '12px',
                          display: 'inline-flex', alignItems: 'center', gap: '4px'
                        }}>
                          <span>{getItemTypeStyles(option.value).icon}</span> {option.label}
                        </span>
                      )}
                      isSearchable={false}
                    />
                  </div>

                  <div style={{ color: 'var(--text-muted)' }}>負責人 (Follow By)</div>
                  <div>
                    <CreatableSelect 
                      styles={reactSelectStyles}
                      value={task.item_follow_by ? { value: String(task.item_follow_by), label: members.find(m => String(m.member_id) === String(task.item_follow_by))?.member_name || String(task.item_follow_by) } : null}
                      onChange={async (selected: any) => {
                        const val = selected ? selected.value : '';
                        try {
                          await onUpdateTask(task.id, { ...task, item_follow_by: val });
                        } catch (err) { alert('更新負責人失敗'); }
                      }}
                      onCreateOption={async (inputValue: string) => {
                        const trimmed = inputValue.trim();
                        if (!trimmed) return;
                        try {
                          const newMem = await api.createMember({ member_name: trimmed, member_email: null, member_role: 'Developer', member_status: 'Active' });
                          if (onRefreshData) await onRefreshData();
                          await onUpdateTask(task.id, { ...task, item_follow_by: String(newMem.member_id) });
                        } catch (err) { alert('新增成員失敗'); }
                      }}
                      options={members.map(m => ({ value: String(m.member_id), label: m.member_name }))}
                      placeholder="Select..."
                      isClearable
                    />
                  </div>

                  <div style={{ color: 'var(--text-muted)' }}>指派者 (Assigner)</div>
                  <div>
                    <CreatableSelect 
                      styles={reactSelectStyles}
                      value={task.item_assigned_by ? { value: String(task.item_assigned_by), label: members.find(m => String(m.member_id) === String(task.item_assigned_by))?.member_name || String(task.item_assigned_by) } : null}
                      onChange={async (selected: any) => {
                        const val = selected ? selected.value : '';
                        try {
                          await onUpdateTask(task.id, { ...task, item_assigned_by: val });
                        } catch (err) { alert('更新指派者失敗'); }
                      }}
                      onCreateOption={async (inputValue: string) => {
                        const trimmed = inputValue.trim();
                        if (!trimmed) return;
                        try {
                          const newMem = await api.createMember({ member_name: trimmed, member_email: null, member_role: 'Developer', member_status: 'Active' });
                          if (onRefreshData) await onRefreshData();
                          await onUpdateTask(task.id, { ...task, item_assigned_by: String(newMem.member_id) });
                        } catch (err) { alert('新增成員失敗'); }
                      }}
                      options={members.map(m => ({ value: String(m.member_id), label: m.member_name }))}
                      placeholder="Select..."
                      isClearable
                    />
                  </div>

                  <div style={{ color: 'var(--text-muted)' }}>重要性</div>
                  <div>
                    <Select
                      styles={reactSelectStyles}
                      value={{ value: task.item_priority || 'Middle', label: task.item_priority || 'Middle' }}
                      onChange={async (s: any) => {
                        const val = s ? s.value : '';
                        try {
                          await onUpdateTask(task.id, { ...task, item_priority: val });
                        } catch (err) { alert('更新重要性失敗'); }
                      }}
                      options={["High", "Middle", "Low"].map(v => ({ value: v, label: v }))}
                      formatOptionLabel={(option: any) => (
                        <span style={{ 
                          color: option.value === 'High' ? '#EF4444' : option.value === 'Low' ? '#10B981' : '#F59E0B',
                          fontWeight: 'bold'
                        }}>
                          {option.label}
                        </span>
                      )}
                      isSearchable={false}
                    />
                  </div>

                  <div style={{ color: 'var(--text-muted)' }}>緊急程度</div>
                  <div>
                    <Select
                      styles={reactSelectStyles}
                      value={{ value: task.item_priority === 'High' ? '緊急' : '非緊急', label: task.item_priority === 'High' ? '緊急' : '非緊急' }}
                      onChange={async (s: any) => {
                        if (!s) return;
                        const val = s.value === '緊急' ? 'High' : 'Middle';
                        try {
                          await onUpdateTask(task.id, { ...task, item_priority: val });
                        } catch (err) { alert('更新緊急程度失敗'); }
                      }}
                      options={[{ value: '緊急', label: '緊急' }, { value: '非緊急', label: '非緊急' }]}
                      formatOptionLabel={(option: any) => (
                        <span style={{ 
                          color: option.value === '緊急' ? '#EF4444' : '#6B7280',
                          fontWeight: 'bold'
                        }}>
                          {option.label}
                        </span>
                      )}
                      isSearchable={false}
                    />
                  </div>

                  <div style={{ color: 'var(--text-muted)' }}>關聯專案</div>
                  <div>
                    <Select 
                      styles={reactSelectStyles}
                      value={task.related_context_id ? { value: String(task.related_context_id), label: projects.find(p => String(p.id) === String(task.related_context_id))?.name || String(task.related_context_id) } : null}
                      onChange={async (selected: any) => {
                        const val = selected ? selected.value : '';
                        try {
                          await onUpdateTask(task.id, { ...task, related_context_id: val });
                        } catch (err) { alert('更新關聯專案失敗'); }
                      }}
                      options={[
                        { value: '', label: '-- 無關聯 --' },
                        ...projects.map(p => ({ value: String(p.id), label: p.name }))
                      ]}
                      placeholder="Select..."
                      isClearable
                    />
                  </div>

                  <div style={{ color: 'var(--text-muted)', paddingTop: '4px' }}>計劃開始</div>
                  <div>
                    <input 
                      type="date" 
                      value={task.item_planned_start_date ? task.item_planned_start_date.split('T')[0] : ''} 
                      onChange={async (e) => {
                        try {
                          await onUpdateTask(task.id, { ...task, item_planned_start_date: e.target.value || null });
                        } catch (err) { alert('更新失敗'); }
                      }}
                      style={{ ...styles.textInput, padding: '4px 8px', fontSize: '13px', width: '100%', height: '36px' }}
                    />
                  </div>

                  <div style={{ color: 'var(--text-muted)' }}>計劃結束</div>
                  <div>
                    <input 
                      type="date" 
                      value={task.item_planned_end_date ? task.item_planned_end_date.split('T')[0] : ''} 
                      onChange={async (e) => {
                        try {
                          await onUpdateTask(task.id, { ...task, item_planned_end_date: e.target.value || null });
                        } catch (err) { alert('更新失敗'); }
                      }}
                      style={{ ...styles.textInput, padding: '4px 8px', fontSize: '13px', width: '100%', height: '36px' }}
                    />
                  </div>

                  <div style={{ color: 'var(--text-muted)', paddingTop: '4px' }}>實際開始</div>
                  <div>
                    <input 
                      type="date" 
                      value={task.item_actual_start_date ? task.item_actual_start_date.split('T')[0] : ''} 
                      onChange={async (e) => {
                        try {
                          await onUpdateTask(task.id, { ...task, item_actual_start_date: e.target.value || null });
                        } catch (err) { alert('更新失敗'); }
                      }}
                      style={{ ...styles.textInput, padding: '4px 8px', fontSize: '13px', width: '100%', height: '36px' }}
                    />
                  </div>

                  <div style={{ color: 'var(--text-muted)' }}>實際結束</div>
                  <div>
                    <input 
                      type="date" 
                      value={task.item_actual_end_date ? task.item_actual_end_date.split('T')[0] : ''} 
                      onChange={async (e) => {
                        try {
                          await onUpdateTask(task.id, { ...task, item_actual_end_date: e.target.value || null });
                        } catch (err) { alert('更新失敗'); }
                      }}
                      style={{ ...styles.textInput, padding: '4px 8px', fontSize: '13px', width: '100%', height: '36px' }}
                    />
                  </div>

                  <div style={{ color: 'var(--text-muted)' }}>重開次數</div>
                  <div>{task.reopen_count || 0} 次</div>
                </div>
              </div>

              {/* Timestamps */}
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                <div>創建時間: {formatChineseDateTime(task.created_at)}</div>
                <div style={{ marginTop: '4px' }}>更新時間: {formatChineseDateTime(task.updated_at)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </>
    );
  };

  const renderBottleneckModal = () => {
    if (!selectedModalBottleneckId) return null;
    const bn = bottlenecks.find(b => String(b.id) === String(selectedModalBottleneckId));
    if (!bn) return null;

    const proj = projects.find(p => String(p.id) === String(bn.project_id));
    const bnTasks = tasks.filter(t => String(t.bottleneck_id) === String(bn.id));
    const remarks = bn.remarks || [];

    const severityStyle = 
      bn.severity === 'High' ? { backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#FCA5A5' } :
      bn.severity === 'Middle' ? { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#FDE047' } :
      { backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34D399' };

    return (
      <>
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes zoomIn {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        `}</style>
        {/* Modal Wrapper Container (Centering to avoid drag-and-drop transform bugs) */}
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2009,
          }}
        >
          {/* Backdrop Overlay */}
          <div 
            onClick={() => {
              setSelectedModalBottleneckId(null);
              setIsEditing(false);
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              animation: 'fadeIn 0.2s ease-out',
            }}
          />
          {/* Modal Window */}
          <div 
            style={{
              position: 'relative',
              width: '96vw',
              maxWidth: '1800px',
              height: '90vh',
            backgroundColor: '#0A0F1D',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.8)',
            zIndex: 2010,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            color: 'var(--text-primary)',
            animation: 'zoomIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.01)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
              <span>⚠️</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} title={bn.item_type || 'Bottleneck'}>
                <span>{getItemTypeStyles(bn.item_type || 'Bottleneck').icon}</span>
                <strong>{bn.item_display_id || `BOTTLENECK-${bn.id}`}</strong>
              </span>
            </div>
            <button 
              onClick={() => {
                setSelectedModalBottleneckId(null);
                setIsEditing(false);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '24px',
                cursor: 'pointer',
                lineHeight: 1,
                padding: '4px',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              &times;
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Left Panel */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px', borderRight: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div>
                {isEditing ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontSize: '20px',
                      fontWeight: 'bold',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      outline: 'none',
                    }}
                  />
                ) : (
                  <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold' }}>{bn.title}</h2>
                )}
              </div>

              {/* Description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <strong style={{ fontSize: '13px', color: 'var(--text-muted)' }}>阻礙與風險描述 (item_content)</strong>
                {isEditing ? (
                  <div style={{ background: '#0F1524', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '300px', padding: '12px' }}>
                    <BlockNoteView
                      editor={blockNoteEditor}
                      onChange={() => {
                        setEditDescOrContent(blockNoteEditor.document);
                      }}
                      theme="dark"
                    />
                  </div>
                ) : (
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '16px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.6' }}>
                    <BlockNoteView editor={blockNoteEditor} editable={false} theme="dark" />
                  </div>
                )}
              </div>

              {/* Related Tasks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <strong style={{ fontSize: '13px', color: 'var(--text-muted)' }}>受阻礙關聯工單 ({bnTasks.length})</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {bnTasks.length === 0 ? (
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>尚無受阻礙的工單</span>
                  ) : (
                    bnTasks.map(t => (
                      <span 
                        key={t.id} 
                        className="relation-badge relation-badge-task"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedModalBottleneckId(null);
                          setSelectedModalTaskId(t.id);
                        }}
                      >
                        📄 {t.title}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Remarks History */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                <strong style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Remarks 歷史接龍 ({remarks.length})</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                  {remarks.length === 0 ? (
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>尚無備註記錄</span>
                  ) : (
                    remarks.map((r, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '10px 14px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--accent-secondary)', fontWeight: 'bold' }}>{r.user}</span>
                          <span>{formatChineseDateTime(r.timestamp)}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{r.text}</div>
                      </div>
                    ))
                  )}
                </div>
                {isEditing && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>新增備註 (Append Remark)</span>
                    <input
                      type="text"
                      placeholder="輸入備註文字（例如：阻礙已向客戶確認）"
                      value={remarkInput}
                      onChange={e => setRemarkInput(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '13px',
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel */}
            <div style={{ flex: '0 0 320px', padding: '24px', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '16px' }}>
                  {isEditing ? (
                    <>
                      <button 
                        onClick={() => {
                          setIsEditing(false);
                          setRemarkInput('');
                        }}
                        style={{ ...styles.cancelBtn, padding: '6px 12px', fontSize: '13px' }}
                      >
                        取消
                      </button>
                      <button 
                        onClick={handleModalBottleneckSave} 
                        disabled={isSaving}
                        style={{ ...styles.saveBtn, padding: '6px 12px', fontSize: '13px' }}
                      >
                        {isSaving ? '儲存中...' : '儲存變更'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => {
                          if (bn.id) handleDelete(bn.id);
                        }}
                        style={{ ...styles.cancelBtn, color: '#ef4444', padding: '6px 12px', fontSize: '13px' }}
                      >
                        🗑️ 刪除
                      </button>
                      <button 
                        onClick={() => setIsEditing(true)} 
                        style={{ ...styles.editBtn, padding: '6px 12px', fontSize: '13px' }}
                      >
                        ✏️ 編輯樽頸
                      </button>
                    </>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', rowGap: '16px', columnGap: '8px', fontSize: '13px' }}>
                  <div style={{ color: 'var(--text-muted)' }}>嚴重程度</div>
                  <div>
                    {isEditing ? (
                      <ThemedSelect 
                        value={bottleneckSeverity} 
                        onChange={e => setBottleneckSeverity(e.target.value as any)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          outline: 'none',
                          width: '100%',
                        }}
                      >
                        <option value="High">High</option>
                        <option value="Middle">Middle</option>
                        <option value="Low">Low</option>
                      </ThemedSelect>
                    ) : (
                      <span className="relation-badge" style={{ ...severityStyle, fontSize: '12px', padding: '3px 8px' }}>
                        {bn.item_priority || 'Middle'} Severity
                      </span>
                    )}
                  </div>

                  <div style={{ color: 'var(--text-muted)' }}>處理狀態</div>
                  <div>
                    {isEditing ? (
                      <ThemedSelect 
                        value={bottleneckStatus} 
                        onChange={e => setBottleneckStatus(e.target.value)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          outline: 'none',
                          width: '100%',
                        }}
                      >
                        <option value="Not Start">Not Start</option>
                        <option value="Ready">Ready</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Stuck">Stuck</option>
                        <option value="Review">Review</option>

                        <option value="Completed">Completed</option>
                        <option value="Closed">Closed</option>
                        <option value="Backlog">Backlog</option>
                      </ThemedSelect>
                    ) : (
                      getItemStatusBadge(bn.item_status || 'Not Start')
                    )}
                  </div>

                  <div style={{ color: 'var(--text-muted)' }}>關聯專案</div>
                  <div>
                    {proj ? (
                      <span 
                        className="relation-badge relation-badge-project"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedModalBottleneckId(null);
                          setSelectedProductProjectId(proj.id);
                        }}
                      >
                        💻 {proj.name}
                      </span>
                    ) : '—'}
                  </div>

                  <div style={{ color: 'var(--text-muted)' }}>負責人 (Follow By)</div>
                  <div>
                    {isEditing ? (
                      <CreatableSelect
                        styles={reactSelectStyles}
                        value={editFollowBy ? { value: editFollowBy, label: members.find(m => String(m.member_id) === editFollowBy)?.member_name || editFollowBy } : null}
                        onChange={(selected: any) => setEditFollowBy(selected ? selected.value : '')}
                        onCreateOption={async (inputValue: string) => {
                          const trimmed = inputValue.trim();
                          if (!trimmed) return;
                          try {
                            const newMem = await api.createMember({
                              member_name: trimmed,
                              member_email: null,
                              member_role: 'Developer',
                              member_status: 'Active'
                            });
                            if (onRefreshData) await onRefreshData();
                            setEditFollowBy(String(newMem.member_id));
                          } catch (err) {
                            alert('新增成員失敗');
                          }
                        }}
                        options={members.map(m => ({ value: String(m.member_id), label: m.member_name }))}
                        placeholder="選擇或輸入新增負責人..."
                        isClearable
                      />
                    ) : (
                      <span>{members.find(m => String(m.member_id) === String(bn.item_follow_by))?.member_name || bn.item_follow_by || '—'}</span>
                    )}
                  </div>

                  <div style={{ color: 'var(--text-muted)' }}>指派者 (Assigner)</div>
                  <div>
                    {isEditing ? (
                      <CreatableSelect
                        styles={reactSelectStyles}
                        value={editAssignedBy ? { value: editAssignedBy, label: members.find(m => String(m.member_id) === editAssignedBy)?.member_name || editAssignedBy } : null}
                        onChange={(selected: any) => setEditAssignedBy(selected ? selected.value : '')}
                        onCreateOption={async (inputValue: string) => {
                          const trimmed = inputValue.trim();
                          if (!trimmed) return;
                          try {
                            const newMem = await api.createMember({
                              member_name: trimmed,
                              member_email: null,
                              member_role: 'Developer',
                              member_status: 'Active'
                            });
                            if (onRefreshData) await onRefreshData();
                            setEditAssignedBy(String(newMem.member_id));
                          } catch (err) {
                            alert('新增成員失敗');
                          }
                        }}
                        options={members.map(m => ({ value: String(m.member_id), label: m.member_name }))}
                        placeholder="選擇或輸入新增指派者..."
                        isClearable
                      />
                    ) : (
                      <span>{members.find(m => String(m.member_id) === String(bn.item_assigned_by))?.member_name || bn.item_assigned_by || '—'}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                <div>創建時間: {formatChineseDateTime(bn.created_at)}</div>
                <div style={{ marginTop: '4px' }}>更新時間: {formatChineseDateTime(bn.updated_at)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </>
    );
  };

  const renderKnowledgeModal = () => {
    if (!selectedModalKnowledgeId) return null;
    const k = knowledge.find(kn => String(kn.id) === String(selectedModalKnowledgeId));
    if (!k) return null;

    const proj = projects.find(p => String(p.id) === String(k.project_id));
    const remarks = k.remarks || [];

    const statusBadgeCls = 
      k.status === '完成' ? 'status-badge-done' :
      k.status === '進行中' ? 'status-badge-progress' :
      k.status === '封存' ? 'status-badge-archive' : 'status-badge-todo';

    return (
      <>
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes zoomIn {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        `}</style>
        {/* Modal Wrapper Container (Centering to avoid drag-and-drop transform bugs) */}
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2009,
          }}
        >
          {/* Backdrop Overlay */}
          <div 
            onClick={() => {
              setSelectedModalKnowledgeId(null);
              setIsEditing(false);
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              animation: 'fadeIn 0.2s ease-out',
            }}
          />
          {/* Modal Window */}
          <div 
            style={{
              position: 'relative',
              width: '96vw',
              maxWidth: '1800px',
              height: '90vh',
            backgroundColor: '#0A0F1D',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.8)',
            zIndex: 2010,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            color: 'var(--text-primary)',
            animation: 'zoomIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.01)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
              <span>📖</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} title={k.item_type || 'Knowledge'}>
                <span>{getItemTypeStyles(k.item_type || 'Knowledge').icon}</span>
                <strong>{k.item_display_id || `GLOSSARY-${k.id}`}</strong>
              </span>
            </div>
            <button 
              onClick={() => {
                setSelectedModalKnowledgeId(null);
                setIsEditing(false);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '24px',
                cursor: 'pointer',
                lineHeight: 1,
                padding: '4px',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              &times;
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Left Panel */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px', borderRight: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div>
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <strong style={{ fontSize: '13px', color: 'var(--text-muted)' }}>業務術語名稱 (Term Name)</strong>
                    <input
                      type="text"
                      value={knowledgeTerm}
                      onChange={e => setKnowledgeTerm(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        outline: 'none',
                      }}
                    />
                  </div>
                ) : (
                  <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold' }}>{k.term}</h2>
                )}
              </div>

              {/* Definition */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <strong style={{ fontSize: '13px', color: 'var(--text-muted)' }}>定義與內容 (item_content)</strong>
                {isEditing ? (
                  <div style={{ background: '#0F1524', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '300px', padding: '12px' }}>
                    <BlockNoteView
                      editor={blockNoteEditor}
                      onChange={() => {
                        setEditDescOrContent(blockNoteEditor.document);
                      }}
                      theme="dark"
                    />
                  </div>
                ) : (
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '16px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.6' }}>
                    <BlockNoteView editor={blockNoteEditor} editable={false} theme="dark" />
                  </div>
                )}
              </div>

              {/* KPI formula */}
              {((!isEditing && k.kpi_formula) || isEditing) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <strong style={{ fontSize: '13px', color: 'var(--text-muted)' }}>指標計算公式 (KPI Formula / Formula Spec)</strong>
                  {isEditing ? (
                    <input
                      type="text"
                      value={knowledgeKpi}
                      onChange={e => setKnowledgeKpi(e.target.value)}
                      placeholder="例如：(滿足條件數 / 總數) * 100%"
                      style={{
                        width: '100%',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                      }}
                    />
                  ) : (
                    <div style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.15)', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', fontFamily: 'monospace', color: 'var(--accent-secondary)' }}>
                      📐 {k.kpi_formula}
                    </div>
                  )}
                </div>
              )}

              {/* Remarks History */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                <strong style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Remarks 歷史接龍 ({remarks.length})</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                  {remarks.length === 0 ? (
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>尚無備註記錄</span>
                  ) : (
                    remarks.map((r, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '10px 14px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--accent-secondary)', fontWeight: 'bold' }}>{r.user}</span>
                          <span>{formatChineseDateTime(r.timestamp)}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{r.text}</div>
                      </div>
                    ))
                  )}
                </div>
                {isEditing && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>新增備註 (Append Remark)</span>
                    <input
                      type="text"
                      placeholder="輸入備註文字"
                      value={remarkInput}
                      onChange={e => setRemarkInput(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '13px',
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel */}
            <div style={{ flex: '0 0 320px', padding: '24px', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '16px' }}>
                  {isEditing ? (
                    <>
                      <button 
                        onClick={() => {
                          setIsEditing(false);
                          setRemarkInput('');
                        }}
                        style={{ ...styles.cancelBtn, padding: '6px 12px', fontSize: '13px' }}
                      >
                        取消
                      </button>
                      <button 
                        onClick={handleModalKnowledgeSave} 
                        disabled={isSaving}
                        style={{ ...styles.saveBtn, padding: '6px 12px', fontSize: '13px' }}
                      >
                        {isSaving ? '儲存中...' : '儲存變更'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => {
                          if (k.id) handleDelete(k.id);
                        }}
                        style={{ ...styles.cancelBtn, color: '#ef4444', padding: '6px 12px', fontSize: '13px' }}
                      >
                        🗑️ 刪除
                      </button>
                      <button 
                        onClick={() => setIsEditing(true)} 
                        style={{ ...styles.editBtn, padding: '6px 12px', fontSize: '13px' }}
                      >
                        ✏️ 編輯詞條
                      </button>
                    </>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', rowGap: '16px', columnGap: '8px', fontSize: '13px' }}>
                  <div style={{ color: 'var(--text-muted)' }}>詞條狀態</div>
                  <div>
                    <span className={statusBadgeCls}>● {k.status}</span>
                  </div>

                  <div style={{ color: 'var(--text-muted)' }}>學科/標籤</div>
                  <div>
                    {k.tag ? (
                      <span className="relation-badge" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}>{k.tag}</span>
                    ) : '—'}
                  </div>

                  <div style={{ color: 'var(--text-muted)' }}>參考網址</div>
                  <div>
                    {k.url ? (
                      <a href={`https://${k.url}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-secondary)', textDecoration: 'underline' }}>
                        {k.url}
                      </a>
                    ) : '—'}
                  </div>

                  <div style={{ color: 'var(--text-muted)' }}>關聯專案</div>
                  <div>
                    {proj ? (
                      <span 
                        className="relation-badge relation-badge-project"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedModalKnowledgeId(null);
                          setSelectedProductProjectId(proj.id);
                        }}
                      >
                        💻 {proj.name}
                      </span>
                    ) : '—'}
                  </div>

                  <div style={{ color: 'var(--text-muted)' }}>負責人 (Follow By)</div>
                  <div>
                    {isEditing ? (
                      <CreatableSelect
                        styles={reactSelectStyles}
                        value={editFollowBy ? { value: editFollowBy, label: members.find(m => String(m.member_id) === editFollowBy)?.member_name || editFollowBy } : null}
                        onChange={(selected: any) => setEditFollowBy(selected ? selected.value : '')}
                        onCreateOption={async (inputValue: string) => {
                          const trimmed = inputValue.trim();
                          if (!trimmed) return;
                          try {
                            const newMem = await api.createMember({
                              member_name: trimmed,
                              member_email: null,
                              member_role: 'Developer',
                              member_status: 'Active'
                            });
                            if (onRefreshData) await onRefreshData();
                            setEditFollowBy(String(newMem.member_id));
                          } catch (err) {
                            alert('新增成員失敗');
                          }
                        }}
                        options={members.map(m => ({ value: String(m.member_id), label: m.member_name }))}
                        placeholder="選擇或輸入新增負責人..."
                        isClearable
                      />
                    ) : (
                      <span>{members.find(m => String(m.member_id) === String(k.item_follow_by))?.member_name || k.item_follow_by || '—'}</span>
                    )}
                  </div>

                  <div style={{ color: 'var(--text-muted)' }}>指派者 (Assigner)</div>
                  <div>
                    {isEditing ? (
                      <CreatableSelect
                        styles={reactSelectStyles}
                        value={editAssignedBy ? { value: editAssignedBy, label: members.find(m => String(m.member_id) === editAssignedBy)?.member_name || editAssignedBy } : null}
                        onChange={(selected: any) => setEditAssignedBy(selected ? selected.value : '')}
                        onCreateOption={async (inputValue: string) => {
                          const trimmed = inputValue.trim();
                          if (!trimmed) return;
                          try {
                            const newMem = await api.createMember({
                              member_name: trimmed,
                              member_email: null,
                              member_role: 'Developer',
                              member_status: 'Active'
                            });
                            if (onRefreshData) await onRefreshData();
                            setEditAssignedBy(String(newMem.member_id));
                          } catch (err) {
                            alert('新增成員失敗');
                          }
                        }}
                        options={members.map(m => ({ value: String(m.member_id), label: m.member_name }))}
                        placeholder="選擇或輸入新增指派者..."
                        isClearable
                      />
                    ) : (
                      <span>{members.find(m => String(m.member_id) === String(k.item_assigned_by))?.member_name || k.item_assigned_by || '—'}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                <div>創建時間: {formatChineseDateTime(k.created_at)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </>
    );
  };

  const renderMeetingModal = () => {
    if (!selectedDrawerMeetingId) return null;
    const meet = meetings.find(m => String(m.id) === String(selectedDrawerMeetingId));
    if (!meet) return null;

    const associatedProj = projects.find(p => p.id === (isEditing ? meetingProjectId : meet.project_id));
    const meetingTasks = tasks.filter(t => String(t.related_meeting_id) === String(meet.id));
    const relatedBottleneckIds = meetingTasks.map(t => t.bottleneck_id).filter(Boolean);
    const meetingBottlenecks = bottlenecks.filter(b => relatedBottleneckIds.includes(b.id));
    const meetingKnowledge = knowledge.filter(k => 
      k.project_id === meet.project_id || 
      (meet.content && meet.content.includes(k.term)) ||
      (meet.summary && meet.summary.includes(k.term))
    );
    const remarks = meet.remarks || [];

    return (
      <>
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes zoomIn {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        `}</style>
        {/* Modal Wrapper Container */}
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2009,
          }}
        >
          {/* Backdrop Overlay */}
          <div 
            onClick={() => {
              setSelectedDrawerMeetingId(null);
              setIsEditing(false);
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              animation: 'fadeIn 0.2s ease-out',
            }}
          />
          {/* Modal Window */}
          <div 
            style={{
              position: 'relative',
              width: '96vw',
              maxWidth: '1800px',
              height: '90vh',
              backgroundColor: '#0A0F1D',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.8)',
              zIndex: 2010,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              color: 'var(--text-primary)',
              animation: 'zoomIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.01)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
                <span>📅</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} title={meet.item_type || 'Meeting'}>
                  <span>{getItemTypeStyles(meet.item_type || 'Meeting').icon}</span>
                  <strong>{meet.item_display_id || `MEETING-${meet.id}`}</strong>
                </span>
              </div>
              <button 
                onClick={() => {
                  setSelectedDrawerMeetingId(null);
                  setIsEditing(false);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '24px',
                  cursor: 'pointer',
                  lineHeight: 1,
                  padding: '4px',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                &times;
              </button>
            </div>

            {/* Body: Two columns */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Left Panel: Content / Remarks */}
              <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px', borderRight: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        fontSize: '20px',
                        fontWeight: 'bold',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        outline: 'none',
                      }}
                    />
                  ) : (
                    <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold' }}>{meet.title}</h2>
                  )}
                </div>

                {/* Markdown Recap Block */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <strong style={{ fontSize: '13px', color: 'var(--text-muted)' }}>🎯 AI 會議摘要 & 決議事項 (item_content)</strong>
                  {isEditing ? (
                    <div style={{ background: '#0F1524', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '300px', padding: '12px' }}>
                      <BlockNoteView
                        editor={blockNoteEditor}
                        onChange={() => {
                          setEditDescOrContent(blockNoteEditor.document);
                        }}
                        theme="dark"
                      />
                    </div>
                  ) : (
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '16px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.6' }}>
                      <BlockNoteView editor={blockNoteEditor} editable={false} theme="dark" />
                    </div>
                  )}
                </div>

                {/* Related Tasks Table */}
                <div>
                  <strong style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    📋 關聯任務工單 ({meetingTasks.length})
                  </strong>
                  {(() => {
                    const taskColumns = [
                      {
                        id: 'title',
                        header: '標題',
                        cell: (t: any) => <span style={{ fontWeight: 'bold' }}>📄 {t.title}</span>
                      },
                      {
                        id: 'priority',
                        header: '優先級',
                        cell: (t: any) => (
                          <>
                            {t.priority === 'High' && <span className="priority-high">High</span>}
                            {t.priority === 'Middle' && <span className="priority-middle">Middle</span>}
                            {t.priority === 'Low' && <span className="priority-low">Low</span>}
                            {!['High', 'Middle', 'Low'].includes(t.priority || '') && <span className="priority-middle">Middle</span>}
                          </>
                        )
                      },
                      {
                        id: 'status',
                        header: '狀態',
                        cell: (t: any) => (
                          <>
                            <span className={`status-lamp ${t.status.toLowerCase().replace('_', '')}`} style={{ marginRight: '6px' }} />
                            {t.status}
                          </>
                        )
                      },
                      {
                        id: 'due_date',
                        header: '截止日期',
                        cell: (t: any) => formatChineseDate(t.due_date)
                      },
                      {
                        id: 'follow_by',
                        header: '負責人',
                        cell: (t: any) => members.find(mem => String(mem.member_id) === String(t.item_follow_by))?.member_name || '未指派'
                      }
                    ];

                    const inlineCreateBlock = (
                      <div style={{ marginTop: '8px' }}>
                        {inlineCreatingMeetingTaskProject === String(meet.id) ? (
                          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input
                                type="text"
                                autoFocus
                                placeholder="輸入任務名稱..."
                                value={inlineCreatingMeetingTaskTitle}
                                onChange={(e) => setInlineCreatingMeetingTaskTitle(e.target.value)}
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter' && inlineCreatingMeetingTaskTitle.trim()) {
                                    try {
                                      await api.createTask({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                        related_context_id: meet.project_id || undefined,
                                        related_meeting_id: meet.id,
                                        item_title: inlineCreatingMeetingTaskTitle,
                                        item_type: 'Task',
                                        item_status: 'Not Start',
                                        item_priority: 'Middle',
                                        item_content: { description: '與會議關聯的任務。' },
                                        remarks_entry: `從會議 MEETING-${meet.id} 新增任務`
                                      });
                                      if (onRefreshData) await onRefreshData();
                                      setInlineCreatingMeetingTaskTitle('');
                                    } catch (err) { alert('建立任務失敗'); }
                                  } else if (e.key === 'Escape') {
                                    setInlineCreatingMeetingTaskProject(null);
                                  }
                                }}
                                style={{ flex: 1, background: 'transparent', color: 'var(--text-primary)', border: 'none', borderBottom: '1px solid var(--accent-primary)', outline: 'none', padding: '6px' }}
                              />
                              <button 
                                onClick={async () => {
                                  if (inlineCreatingMeetingTaskTitle.trim()) {
                                    try {
                                      await api.createTask({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                        related_context_id: meet.project_id || undefined,
                                        related_meeting_id: meet.id,
                                        item_title: inlineCreatingMeetingTaskTitle,
                                        item_type: 'Task',
                                        item_status: 'Not Start',
                                        item_priority: 'Middle',
                                        item_content: { description: '與會議關聯的任務。' },
                                        remarks_entry: `從會議 MEETING-${meet.id} 新增任務`
                                      });
                                      if (onRefreshData) await onRefreshData();
                                      setInlineCreatingMeetingTaskTitle('');
                                    } catch (err) { alert('建立任務失敗'); }
                                  }
                                }}
                                style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
                              >
                                Save
                              </button>
                              <button 
                                onClick={() => setInlineCreatingMeetingTaskProject(null)}
                                style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ cursor: 'pointer', padding: '10px 16px', color: 'var(--text-muted)', fontSize: '13px', borderRadius: '6px' }} onClick={() => {
                            setInlineCreatingMeetingTaskProject(String(meet.id));
                            setInlineCreatingMeetingTaskTitle('');
                          }} onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                            <span style={{ marginRight: '6px' }}>+</span>新增任務/工作項
                          </div>
                        )}
                      </div>
                    );

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <AdvancedTable
                          tableId={`meeting_tasks_${meet.id}`}
                          data={meetingTasks}
                          columns={taskColumns}
                          onRowClick={(t) => { setSelectedModalTaskId(t.id); setSelectedDrawerMeetingId(null); }}
                        />
                        {inlineCreateBlock}
                      </div>
                    );
                  })()}
                </div>

                {/* Related Bottlenecks Table */}
                <div>
                  <strong style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    ⚠️ 關聯樽頸與風險 ({meetingBottlenecks.length})
                  </strong>
                  {(() => {
                    const bottleneckColumns = [
                      {
                        id: 'title',
                        header: '阻礙名稱',
                        cell: (b: any) => <span style={{ fontWeight: 'bold' }}>📄 {b.title}</span>
                      },
                      {
                        id: 'severity',
                        header: '嚴重程度',
                        cell: (b: any) => (
                          <>
                            {b.severity === 'High' && <span className="priority-high">High</span>}
                            {b.severity === 'Middle' && <span className="priority-middle">Middle</span>}
                            {b.severity === 'Low' && <span className="priority-low">Low</span>}
                          </>
                        )
                      },
                      {
                        id: 'status',
                        header: '狀態',
                        cell: (b: any) => (
                          <>
                            <span className={`status-lamp ${b.status === 'ACTIVE' ? 'blocked' : 'done'}`} style={{ marginRight: '6px' }} />
                            {b.status}
                          </>
                        )
                      }
                    ];

                    const bottleneckFooter = (
                      <>
                        {inlineCreatingMeetingBottleneckProject === String(meet.id) ? (
                          <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <td colSpan={3} style={{ padding: '10px 12px', borderBottom: 'none' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  autoFocus
                                  placeholder="輸入阻礙/樽頸名稱..."
                                  value={inlineCreatingMeetingBottleneckTitle}
                                  onChange={(e) => setInlineCreatingMeetingBottleneckTitle(e.target.value)}
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter' && inlineCreatingMeetingBottleneckTitle.trim()) {
                                      try {
                                        const newBottleneck = await api.createBottleneck({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                          related_context_id: meet.project_id || undefined,
                                          item_title: inlineCreatingMeetingBottleneckTitle,
                                          description: '樽頸與阻礙說明...',
                                          severity: 'Middle',
                                          status: 'Not Start',
                                          remarks_entry: `從會議 MEETING-${meet.id} 新增樽頸風險`
                                        });
                                        await api.createTask({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                          related_context_id: meet.project_id || undefined,
                                          related_meeting_id: meet.id,
                                          item_title: `Resolve Bottleneck: ${newBottleneck.title}`,
                                          item_type: 'Task',
                                          item_status: 'Not Start',
                                          item_priority: 'Middle',
                                          item_content: { description: '關聯樽頸的任務。' }, item_attribute: { bottleneck_id: newBottleneck.id },
                                          remarks_entry: `自動建立與會議關聯的樽頸任務`
                                        });
                                        if (onRefreshData) await onRefreshData();
                                        setInlineCreatingMeetingBottleneckTitle('');
                                      } catch (err) { alert('建立樽頸失敗'); }
                                    } else if (e.key === 'Escape') {
                                      setInlineCreatingMeetingBottleneckProject(null);
                                    }
                                  }}
                                  style={{ flex: 1, background: 'transparent', color: 'var(--text-primary)', border: 'none', borderBottom: '1px solid var(--accent-primary)', outline: 'none', padding: '6px' }}
                                />
                                <button 
                                  onClick={async () => {
                                    if (inlineCreatingMeetingBottleneckTitle.trim()) {
                                      try {
                                        const newBottleneck = await api.createBottleneck({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                          related_context_id: meet.project_id || undefined,
                                          item_title: inlineCreatingMeetingBottleneckTitle,
                                          description: '樽頸與阻礙說明...',
                                          severity: 'Middle',
                                          status: 'Not Start',
                                          remarks_entry: `從會議 MEETING-${meet.id} 新增樽頸風險`
                                        });
                                        await api.createTask({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                          related_context_id: meet.project_id || undefined,
                                          related_meeting_id: meet.id,
                                          item_title: `Resolve Bottleneck: ${newBottleneck.title}`,
                                          item_type: 'Task',
                                          item_status: 'Not Start',
                                          item_priority: 'Middle',
                                          item_content: { description: '關聯樽頸的任務。' }, item_attribute: { bottleneck_id: newBottleneck.id },
                                          remarks_entry: `自動建立與會議關聯的樽頸任務`
                                        });
                                        if (onRefreshData) await onRefreshData();
                                        setInlineCreatingMeetingBottleneckTitle('');
                                      } catch (err) { alert('建立樽頸失敗'); }
                                    }
                                  }}
                                  style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
                                >
                                  Save
                                </button>
                                <button 
                                  onClick={() => setInlineCreatingMeetingBottleneckProject(null)}
                                  style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr style={{ cursor: 'pointer' }} onClick={() => {
                            setInlineCreatingMeetingBottleneckProject(String(meet.id));
                            setInlineCreatingMeetingBottleneckTitle('');
                          }}>
                            <td colSpan={3} style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: '13px', borderBottom: 'none' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                              <span style={{ marginRight: '6px' }}>+</span>新增樽頸與風險
                            </td>
                          </tr>
                        )}
                      </>
                    );

                    return (
                      <AdvancedTable
                        tableId={`meeting_bottlenecks_${meet.id}`}
                        data={meetingBottlenecks}
                        columns={bottleneckColumns}
                        onRowClick={(b) => { setSelectedModalBottleneckId(b.id); setSelectedDrawerMeetingId(null); }}
                        footerContent={bottleneckFooter}
                      />
                    );
                  })()}
                </div>

                {/* Related Knowledge Notes Table */}
                <div>
                  <strong style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    🧠 關聯業務知識 ({meetingKnowledge.length})
                  </strong>
                  {(() => {
                    const knowledgeColumns = [
                      {
                        id: 'term',
                        header: '詞條名稱',
                        cell: (k: any) => <span style={{ fontWeight: 'bold' }}>📄 {k.term}</span>
                      },
                      {
                        id: 'definition',
                        header: '定義描述',
                        cell: (k: any) => (
                          <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={k.definition}>
                            {k.definition}
                          </span>
                        )
                      },
                      {
                        id: 'status',
                        header: '狀態',
                        cell: (k: any) => <span className="status-badge-progress">{k.status}</span>
                      }
                    ];

                    const knowledgeFooter = (
                      <>
                        {inlineCreatingMeetingKnowledgeProject === String(meet.id) ? (
                          <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <td colSpan={3} style={{ padding: '10px 12px', borderBottom: 'none' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  autoFocus
                                  placeholder="輸入詞條名稱..."
                                  value={inlineCreatingMeetingKnowledgeTitle}
                                  onChange={(e) => setInlineCreatingMeetingKnowledgeTitle(e.target.value)}
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter' && inlineCreatingMeetingKnowledgeTitle.trim()) {
                                      try {
                                        await api.createKnowledge({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                          related_context_id: meet.project_id || undefined,
                                          item_title: inlineCreatingMeetingMeetingKnowledgeTitle ?? inlineCreatingMeetingKnowledgeTitle,
                                          definition: '定義內容...',
                                          kpi_formula: undefined,
                                          remarks_entry: `從會議 MEETING-${meet.id} 新增術語定義`
                                        });
                                        if (onRefreshData) await onRefreshData();
                                        setInlineCreatingMeetingKnowledgeTitle('');
                                      } catch (err) { alert('建立知識隨筆失敗'); }
                                    } else if (e.key === 'Escape') {
                                      setInlineCreatingMeetingKnowledgeProject(null);
                                    }
                                  }}
                                  style={{ flex: 1, background: 'transparent', color: 'var(--text-primary)', border: 'none', borderBottom: '1px solid var(--accent-primary)', outline: 'none', padding: '6px' }}
                                />
                                <button 
                                  onClick={async () => {
                                    if (inlineCreatingMeetingKnowledgeTitle.trim()) {
                                      try {
                                        await api.createKnowledge({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                          related_context_id: meet.project_id || undefined,
                                          item_title: inlineCreatingMeetingMeetingKnowledgeTitle ?? inlineCreatingMeetingKnowledgeTitle,
                                          definition: '定義內容...',
                                          kpi_formula: undefined,
                                          remarks_entry: `從會議 MEETING-${meet.id} 新增術語定義`
                                        });
                                        if (onRefreshData) await onRefreshData();
                                        setInlineCreatingMeetingKnowledgeTitle('');
                                      } catch (err) { alert('建立知識隨筆失敗'); }
                                    }
                                  }}
                                  style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
                                >
                                  Save
                                </button>
                                <button 
                                  onClick={() => setInlineCreatingMeetingKnowledgeProject(null)}
                                  style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr style={{ cursor: 'pointer' }} onClick={() => {
                            setInlineCreatingMeetingKnowledgeProject(String(meet.id));
                            setInlineCreatingMeetingKnowledgeTitle('');
                          }}>
                            <td colSpan={3} style={{ padding: '10px 16px', color: 'var(--text-muted)', fontSize: '13px', borderBottom: 'none' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                              <span style={{ marginRight: '6px' }}>+</span>新增業務知識與隨筆
                            </td>
                          </tr>
                        )}
                      </>
                    );

                    return (
                      <AdvancedTable
                        tableId={`meeting_knowledge_${meet.id}`}
                        data={meetingKnowledge}
                        columns={knowledgeColumns}
                        onRowClick={(k) => { setSelectedModalKnowledgeId(k.id); setSelectedDrawerMeetingId(null); }}
                        footerContent={knowledgeFooter}
                      />
                    );
                  })()}
                </div>

                {/* Remarks History */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  <strong style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Remarks 歷史軌跡 ({remarks.length})</strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                    {remarks.length === 0 ? (
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>尚無變更紀錄</span>
                    ) : (
                      remarks.map((remark: RemarkEntry, idx: number) => (
                        <div key={idx} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '10px 14px', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--accent-secondary)', fontWeight: 'bold' }}>{remark.user}</span>
                            <span>{formatChineseDateTime(remark.timestamp)}</span>
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{remark.text}</div>
                        </div>
                      ))
                    )}
                  </div>
                  {isEditing && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>新增變更備註 (Append Remark)</span>
                      <input
                        type="text"
                        placeholder="輸入此次修改的備註原因"
                        value={remarkInput}
                        onChange={e => setRemarkInput(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          fontSize: '13px',
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Right Panel: Metadata Properties */}
              <div style={{ flex: '0 0 320px', padding: '24px', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Save/Edit Actions */}
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '16px' }}>
                    {isEditing ? (
                      <>
                        <button 
                          onClick={() => {
                            setIsEditing(false);
                            setRemarkInput('');
                          }}
                          style={{ ...styles.cancelBtn, padding: '6px 12px', fontSize: '13px' }}
                        >
                          取消
                        </button>
                        <button 
                          onClick={handleDrawerMeetingSave} 
                          disabled={isSaving}
                          style={{ ...styles.saveBtn, padding: '6px 12px', fontSize: '13px' }}
                        >
                          {isSaving ? '儲存中...' : '儲存變更'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={() => {
                            if (meet.id) handleDelete(meet.id);
                          }}
                          style={{ ...styles.cancelBtn, color: '#ef4444', padding: '6px 12px', fontSize: '13px' }}
                        >
                          🗑️ 刪除
                        </button>
                        <button 
                          onClick={() => setIsEditing(true)} 
                          style={{ ...styles.editBtn, padding: '6px 12px', fontSize: '13px' }}
                        >
                          ✏️ 編輯會議
                        </button>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', rowGap: '16px', columnGap: '8px', fontSize: '13px' }}>
                    <div style={{ color: 'var(--text-muted)' }}>會議日期</div>
                    <div>
                      {isEditing ? (
                        <input style={{ ...styles.textInput, width: '100%' }} type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
                      ) : (
                        <strong>{formatChineseDate(meet.meeting_date)}</strong>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>與會主持</div>
                    <div>
                      {isEditing ? (
                        <input style={{ ...styles.textInput, width: '100%' }} type="text" value={meetingHost} onChange={(e) => setMeetingHost(e.target.value)} />
                      ) : (
                        <strong>{meet.host || '—'}</strong>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>關聯專案</div>
                    <div>
                      {isEditing ? (
                        <Select
                          styles={reactSelectStyles}
                          value={projects.find(p => String(p.id) === String(meetingProjectId)) ? { value: meetingProjectId, label: projects.find(p => String(p.id) === String(meetingProjectId))?.name } : null}
                          onChange={(selected: any) => setMeetingProjectId(selected ? selected.value : '')}
                          options={[
                            { value: '', label: '-- 未指定 --' },
                            ...projects.map(p => ({ value: p.id, label: p.name }))
                          ]}
                          placeholder="-- 未指定 --"
                          isClearable
                        />
                      ) : (
                        associatedProj ? (
                          <span 
                            className="relation-badge relation-badge-project"
                            style={{ cursor: 'pointer' }}
                            onClick={() => { setSelectedProductProjectId(associatedProj.id); setSelectedDrawerMeetingId(null); }}
                          >
                            {associatedProj.name}
                          </span>
                        ) : '—'
                      )}
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>負責人 (Follow By)</div>
                    <div>
                      {isEditing ? (
                        <CreatableSelect
                          styles={reactSelectStyles}
                          value={editFollowBy ? { value: editFollowBy, label: members.find(m => String(m.member_id) === editFollowBy)?.member_name || editFollowBy } : null}
                          onChange={(selected: any) => setEditFollowBy(selected ? selected.value : '')}
                          onCreateOption={async (inputValue: string) => {
                            const trimmed = inputValue.trim();
                            if (!trimmed) return;
                            try {
                              const newMem = await api.createMember({
                                member_name: trimmed,
                                member_email: null,
                                member_role: 'Developer',
                                member_status: 'Active'
                              });
                              if (onRefreshData) await onRefreshData();
                              setEditFollowBy(String(newMem.member_id));
                            } catch (err) {
                              alert('新增成員失敗');
                            }
                          }}
                          options={members.map(m => ({ value: String(m.member_id), label: m.member_name }))}
                          placeholder="選擇或輸入新增負責人..."
                          isClearable
                        />
                      ) : (
                        <span>{members.find(m => String(m.member_id) === String(meet.item_follow_by))?.member_name || meet.item_follow_by || '—'}</span>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>指派者 (Assigner)</div>
                    <div>
                      {isEditing ? (
                        <CreatableSelect
                          styles={reactSelectStyles}
                          value={editAssignedBy ? { value: editAssignedBy, label: members.find(m => String(m.member_id) === editAssignedBy)?.member_name || editAssignedBy } : null}
                          onChange={(selected: any) => setEditAssignedBy(selected ? selected.value : '')}
                          onCreateOption={async (inputValue: string) => {
                            const trimmed = inputValue.trim();
                            if (!trimmed) return;
                            try {
                              const newMem = await api.createMember({
                                member_name: trimmed,
                                member_email: null,
                                member_role: 'Developer',
                                member_status: 'Active'
                              });
                              if (onRefreshData) await onRefreshData();
                              setEditAssignedBy(String(newMem.member_id));
                            } catch (err) {
                              alert('新增成員失敗');
                            }
                          }}
                          options={members.map(m => ({ value: String(m.member_id), label: m.member_name }))}
                          placeholder="選擇或輸入新增指派者..."
                          isClearable
                        />
                      ) : (
                        <span>{members.find(m => String(m.member_id) === String(meet.item_assigned_by))?.member_name || meet.item_assigned_by || '—'}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  const closeProjectDrawer = () => {
    setIsProjectDrawerClosing(true);
    setTimeout(() => {
      setSelectedModalProjectId(null);
      setIsProjectDrawerClosing(false);
      setIsEditing(false);
    }, 250); // Match animation duration
  };

  const closeProductDrawer = () => {
    setIsProductDrawerClosing(true);
    setTimeout(() => {
      setSelectedModalProductId(null);
      setIsProductDrawerClosing(false);
      setIsEditing(false);
    }, 250); // Match animation duration
  };

  const renderProjectModal = () => {
    if (!selectedModalProjectId && !isProjectDrawerClosing) return null;
    const p = projects.find(x => String(x.id) === String(selectedModalProjectId));
    if (!p) return null;

    const remarks = p.remarks || [];
    const workspaceName = workspaces.find(w => w.workspace_id === p.related_workspace_id)?.workspace_name || '—';
    const parentProjName = products.find(prod => String(prod.id) === String(p.parent_content_id))?.name || products.find(prod => String(prod.id) === String(p.parent_content_id))?.content_name || '—';

    // Filter project items for this project
    const projCharter = tasks.filter(t => 
      (String(t.project_id) === String(p.id) || String(t.related_context_id) === String(p.id)) &&
      t.item_type === 'Charter'
    );

    const projMilestones = tasks.filter(t => 
      (String(t.project_id) === String(p.id) || String(t.related_context_id) === String(p.id)) &&
      t.item_type === 'Milestone'
    );

    const projTasks = tasks.filter(t => 
      (String(t.project_id) === String(p.id) || String(t.related_context_id) === String(p.id)) &&
      ['Epic', 'Task', 'Event', 'Micro Task', 'Bug', 'UAT'].includes(t.item_type)
    );

    const projMeetings = meetings.filter(m => 
      (String(m.project_id) === String(p.id) || String(m.related_context_id) === String(p.id)) &&
      m.item_type === 'Meeting'
    );

    const projBottlenecks = bottlenecks.filter(b => 
      (String(b.project_id) === String(p.id) || String(b.related_context_id) === String(p.id)) &&
      b.item_type === 'Bottleneck'
    );

    const projKnowledge = knowledge.filter(k => 
      (String(k.project_id) === String(p.id) || String(k.related_context_id) === String(p.id)) &&
      ['Knowledge', 'Casual Note'].includes(k.item_type)
    );

                      const inlineCreateBlock = (() => {
                        // Determine create configuration per tab
                        const tabCreateConfig: Record<string, { placeholder: string; label: string; defaultType: string; stateGetter: string | null; stateSetter: ((v: string | null) => void) | null; titleGetter: string; titleSetter: ((v: string) => void) | null; createFn: (title: string) => Promise<void> }> = {
                          'Meetings': {
                            placeholder: '輸入會議名稱...',
                            label: '新增會議記錄',
                            defaultType: 'Meeting',
                            stateGetter: inlineCreatingMeetingProject,
                            stateSetter: setInlineCreatingMeetingProject,
                            titleGetter: inlineCreatingMeetingTitle,
                            titleSetter: setInlineCreatingMeetingTitle,
                            createFn: async (title: string) => {
                              await api.createMeeting({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                related_context_id: p.id,
                                item_title: title,
                                content: '| 序號 | 討論事項 | 決議/行動方案 | 負責人 | 狀態 |\n|---|---|---|---|---|\n| 1 | 初始化 | 建立文件流水帳 | Edmond | 已完成 |',
                                summary: '手動建立的會議記錄。',
                                remarks_entry: '從專案分頁新增會議'
                              });
                            }
                          },
                          'Bottlenecks': {
                            placeholder: '輸入阻礙/樽頸名稱...',
                            label: '新增樽頸與風險',
                            defaultType: 'Bottleneck',
                            stateGetter: inlineCreatingBottleneckProject,
                            stateSetter: setInlineCreatingBottleneckProject,
                            titleGetter: inlineCreatingBottleneckTitle,
                            titleSetter: setInlineCreatingBottleneckTitle,
                            createFn: async (title: string) => {
                              await api.createBottleneck({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                related_context_id: p.id,
                                item_title: title,
                                description: '阻礙詳細說明...',
                                severity: 'Middle',
                                status: 'Not Start',
                                remarks_entry: '從專案分頁新增專案樽頸'
                              });
                            }
                          },
                          'Knowledge': {
                            placeholder: '輸入詞條名稱...',
                            label: '新增業務知識與隨筆',
                            defaultType: 'Knowledge',
                            stateGetter: inlineCreatingKnowledgeProject,
                            stateSetter: setInlineCreatingKnowledgeProject,
                            titleGetter: inlineCreatingKnowledgeTitle,
                            titleSetter: setInlineCreatingKnowledgeTitle,
                            createFn: async (title: string) => {
                              await api.createKnowledge({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                related_context_id: p.id,
                                item_title: title,
                                definition: '定義內容...',
                                kpi_formula: null,
                                remarks_entry: '從專案分頁新增術語定義'
                              });
                            }
                          }
                        };

                        const config = tabCreateConfig[projectDrawerActiveTab];

                        // For tabs with specific create configs (Meetings, Bottlenecks, Knowledge)
                        if (config) {
                          const isCreating = config.stateGetter === String(p.id);
                          return (
                            <div style={{ marginTop: '8px' }}>
                              {isCreating ? (
                                <ClickOutsideWrapper active={true} onOutsideClick={() => config.stateSetter?.(null)}>
                                <div style={{ padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '8px' }}>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                      type="text"
                                      autoFocus
                                      placeholder={config.placeholder}
                                      value={config.titleGetter}
                                      onChange={(e) => config.titleSetter?.(e.target.value)}
                                      onKeyDown={async (e) => {
                                        if (e.key === 'Enter' && config.titleGetter.trim()) {
                                          try {
                                            await config.createFn(config.titleGetter);
                                            if (onRefreshData) await onRefreshData();
                                            config.titleSetter?.('');
                                            config.stateSetter?.(null);
                                          } catch (err) {
                                            alert('建立失敗');
                                          }
                                        } else if (e.key === 'Escape') {
                                          config.stateSetter?.(null);
                                        }
                                      }}
                                      style={{ flex: 1, background: 'transparent', color: 'var(--text-primary)', border: 'none', borderBottom: '1px solid var(--accent-primary)', outline: 'none', padding: '6px' }}
                                    />
                                    <button 
                                      onClick={async () => {
                                        if (config.titleGetter.trim()) {
                                          try {
                                            await config.createFn(config.titleGetter);
                                            if (onRefreshData) await onRefreshData();
                                            config.titleSetter?.('');
                                            config.stateSetter?.(null);
                                          } catch (err) {
                                            alert('建立失敗');
                                          }
                                        }
                                      }}
                                      style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
                                    >
                                      Save
                                    </button>
                                    <button 
                                      onClick={() => config.stateSetter?.(null)}
                                      style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                                </ClickOutsideWrapper>
                              ) : (
                                <div style={{ cursor: 'pointer', padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '8px', color: 'var(--text-muted)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => {
                                  config.stateSetter?.(String(p.id));
                                  config.titleSetter?.('');
                                }} onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                                  <span style={{ marginRight: '6px' }}>+</span>{config.label}
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Default: Tasks/Charter/Milestones inline create
                        return (
                          <div style={{ marginTop: '8px' }}>
                            {inlineCreatingTaskProject === String(p.id) ? (
                              <ClickOutsideWrapper active={true} onOutsideClick={() => setInlineCreatingTaskProject(null)}>
                              <div style={{ padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '8px' }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <Select
                                    value={{ value: inlineCreatingTaskType, label: inlineCreatingTaskType === 'Knowledge | Note' ? 'Knowledge' : inlineCreatingTaskType }}
                                    onChange={(s: any) => setInlineCreatingTaskType(s ? s.value : 'Task')}
                                    styles={{
                                      ...reactSelectStyles,
                                      control: (base: any, state: any) => ({
                                        ...reactSelectStyles.control(base, state),
                                        minHeight: '32px',
                                        width: '150px'
                                      }),
                                      valueContainer: (base: any) => ({
                                        ...base,
                                        padding: '0 8px'
                                      })
                                    }}
                                    options={["Charter", "Epic", "Task", "Event", "Micro Task", "Meeting", "Bottleneck", "Knowledge", "Casual Note", "Bug", "UAT", "Deployment", "Milestone", "Business Objective", "Business Requirement", "User Story"].map(v => ({ value: v, label: v }))}
                                    formatOptionLabel={(option: any) => (
                                      <span style={{ 
                                        backgroundColor: `${getItemTypeStyles(option.value).bg}20`,
                                        color: getItemTypeStyles(option.value).text,
                                        padding: '2px 6px', borderRadius: '4px', fontSize: '11px',
                                        display: 'inline-flex', alignItems: 'center', gap: '4px'
                                      }}>
                                        <span>{getItemTypeStyles(option.value).icon}</span> {option.label}
                                      </span>
                                    )}
                                    isSearchable={false}
                                    menuPlacement="top"
                                  />
                                  <input
                                    type="text"
                                    autoFocus
                                    placeholder="輸入任務標題..."
                                    value={inlineCreatingTaskTitle}
                                    onChange={(e) => setInlineCreatingTaskTitle(e.target.value)}
                                    onKeyDown={async (e) => {
                                      if (e.key === 'Enter' && inlineCreatingTaskTitle.trim()) {
                                        try {
                                          if (inlineCreatingTaskType === 'Meeting') {
                                            await api.createMeeting({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                              related_context_id: p.id,
                                              item_title: inlineCreatingTaskTitle,
                                              item_planned_start_date: new Date().toISOString(),
                                              item_status: 'Not Start',
                                            });
                                          } else {
                                            await api.createTask({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                              related_context_id: p.id,
                                              item_title: inlineCreatingTaskTitle,
                                              item_type: inlineCreatingTaskType,
                                              item_status: 'Not Start',
                                              item_priority: 'Middle',
                                            });
                                          }
                                          if (onRefreshData) await onRefreshData();
                                          setInlineCreatingTaskTitle('');
                                          setInlineCreatingTaskProject(null);
                                        } catch (err) {
                                          alert('建立失敗');
                                        }
                                      } else if (e.key === 'Escape') {
                                        setInlineCreatingTaskProject(null);
                                      }
                                    }}
                                    style={{ flex: 1, background: 'transparent', color: 'var(--text-primary)', border: 'none', borderBottom: '1px solid var(--accent-primary)', outline: 'none', padding: '6px' }}
                                  />
                                  <button 
                                    onClick={async () => {
                                      if (inlineCreatingTaskTitle.trim()) {
                                        try {
                                          if (inlineCreatingTaskType === 'Meeting') {
                                            await api.createMeeting({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                              related_context_id: p.id,
                                              item_title: inlineCreatingTaskTitle,
                                              item_planned_start_date: new Date().toISOString(),
                                              item_status: 'Not Start',
                                            });
                                          } else {
                                            await api.createTask({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                              related_context_id: p.id,
                                              item_title: inlineCreatingTaskTitle,
                                              item_type: inlineCreatingTaskType,
                                              item_status: 'Not Start',
                                              item_priority: 'Middle',
                                            });
                                          }
                                          if (onRefreshData) await onRefreshData();
                                          setInlineCreatingTaskTitle('');
                                          setInlineCreatingTaskProject(null);
                                        } catch (err) {
                                          alert('建立失敗');
                                        }
                                      }
                                    }}
                                    style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
                                  >
                                    Save
                                  </button>
                                  <button 
                                    onClick={() => setInlineCreatingTaskProject(null)}
                                    style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                              </ClickOutsideWrapper>
                            ) : (
                              <div style={{ cursor: 'pointer', padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '8px', color: 'var(--text-muted)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => {
                                setInlineCreatingTaskProject(String(p.id));
                                setInlineCreatingTaskTitle('');
                                  const defaultTypeMap: Record<string, string> = {
                                    'Charter': 'Charter',
                                    'Milestones': 'Milestone',
                                    'Tasks': 'Task',
                                  };
                                  setInlineCreatingTaskType(defaultTypeMap[projectDrawerActiveTab] || 'Task');
                              }} onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                                <span style={{ marginRight: '6px' }}>+</span>新增任務/工作項
                              </div>
                            )}
                          </div>
                        );
                      })();
    return (
      <>
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes zoomIn {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0.5; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
          }
        `}</style>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'flex-end', zIndex: 1000, pointerEvents: isProjectDrawerClosing ? 'none' : 'auto' }}>
          <div onClick={closeProjectDrawer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', animation: isProjectDrawerClosing ? 'fadeOut 0.2s ease-out forwards' : 'fadeIn 0.2s ease-out' }} />
          <div style={{ position: 'relative', width: 'calc(100vw - 260px)', maxWidth: 'none', height: '100vh', backgroundColor: '#0A0F1D', borderLeft: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '-24px 0 48px rgba(0, 0, 0, 0.8)', zIndex: 1001, display: 'flex', flexDirection: 'column', overflow: 'hidden', color: 'var(--text-primary)', animation: isProjectDrawerClosing ? 'slideOutRight 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.01)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button 
                  onClick={closeProjectDrawer}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '14px', cursor: 'pointer', padding: '6px 12px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.05)', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                  返回專案分頁
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-muted)', marginLeft: '8px', paddingLeft: '24px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                  <span>📂</span>
                  <strong>{p?.context_display_code || p?.content_display_id || (p ? `PROJECT-${p.id}` : '')}</strong>
                </div>
              </div>
              <button onClick={closeProjectDrawer} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '24px', cursor: 'pointer', lineHeight: 1, padding: '4px', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>&times;</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px', borderRight: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div>
                  {isEditing ? (
                    <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ width: '100%', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '20px', fontWeight: 'bold', padding: '8px 12px', borderRadius: '8px', outline: 'none' }} />
                  ) : (
                    <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold' }}>{p.content_name}</h2>
                  )}
                </div>

                {/* Description W/ BlockNote */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <strong style={{ fontSize: '13px', color: 'var(--text-muted)' }}>詳細說明 (Description)</strong>
                  {isEditing ? (
                    <div style={{ background: '#0F1524', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '220px', padding: '12px' }}>
                      <BlockNoteView editor={blockNoteEditor} onChange={() => setEditDescOrContent(blockNoteEditor.document)} theme="dark" />
                    </div>
                  ) : (
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '16px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.6' }}>
                      <BlockNoteView editor={blockNoteEditor} editable={false} theme="dark" />
                    </div>
                  )}
                </div>

                {/* 關聯工單表格 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '12px' }}>
                  {/* Tabs for Tasks, Meetings, Bottlenecks, Knowledge */}
                  <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px', gap: '16px' }}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setProjectDrawerActiveTab('Charter')}
                          style={{ ...styles.drawerTabBtn, background: projectDrawerActiveTab === 'Charter' ? 'rgba(2, 132, 199, 0.2)' : 'transparent', color: projectDrawerActiveTab === 'Charter' ? '#38BDF8' : 'var(--text-muted)', borderColor: projectDrawerActiveTab === 'Charter' ? 'rgba(2, 132, 199, 0.3)' : 'transparent', fontWeight: projectDrawerActiveTab === 'Charter' ? 'bold' : 'normal', padding: '8px 16px', fontSize: '13px' }}
                        >
                          📜 專案章程 ({projCharter.length})
                        </button>
                        <button
                          onClick={() => setProjectDrawerActiveTab('Milestones')}
                          style={{ ...styles.drawerTabBtn, background: projectDrawerActiveTab === 'Milestones' ? 'rgba(16, 185, 129, 0.2)' : 'transparent', color: projectDrawerActiveTab === 'Milestones' ? '#34D399' : 'var(--text-muted)', borderColor: projectDrawerActiveTab === 'Milestones' ? 'rgba(16, 185, 129, 0.3)' : 'transparent', fontWeight: projectDrawerActiveTab === 'Milestones' ? 'bold' : 'normal', padding: '8px 16px', fontSize: '13px' }}
                        >
                          🚩 專案里程碑 ({projMilestones.length})
                        </button>
                        <button
                          onClick={() => setProjectDrawerActiveTab('Traceability')}
                          style={{ ...styles.drawerTabBtn, background: projectDrawerActiveTab === 'Traceability' ? 'rgba(139, 92, 246, 0.2)' : 'transparent', color: projectDrawerActiveTab === 'Traceability' ? '#A78BFA' : 'var(--text-muted)', borderColor: projectDrawerActiveTab === 'Traceability' ? 'rgba(139, 92, 246, 0.3)' : 'transparent', fontWeight: projectDrawerActiveTab === 'Traceability' ? 'bold' : 'normal', padding: '8px 16px', fontSize: '13px' }}
                        >
                          🔗 Requirement Traceability
                        </button>
                        <button
                          onClick={() => setProjectDrawerActiveTab('UpdateDeployment')}
                          style={{ ...styles.drawerTabBtn, background: projectDrawerActiveTab === 'UpdateDeployment' ? 'rgba(249, 115, 22, 0.2)' : 'transparent', color: projectDrawerActiveTab === 'UpdateDeployment' ? '#FB923C' : 'var(--text-muted)', borderColor: projectDrawerActiveTab === 'UpdateDeployment' ? 'rgba(249, 115, 22, 0.3)' : 'transparent', fontWeight: projectDrawerActiveTab === 'UpdateDeployment' ? 'bold' : 'normal', padding: '8px 16px', fontSize: '13px' }}
                        >
                          🚀 Update & Deployment
                        </button>
                        <button
                          onClick={() => setProjectDrawerActiveTab('Tasks')}
                          style={{ ...styles.drawerTabBtn, background: projectDrawerActiveTab === 'Tasks' ? 'rgba(59, 130, 246, 0.2)' : 'transparent', color: projectDrawerActiveTab === 'Tasks' ? '#60A5FA' : 'var(--text-muted)', borderColor: projectDrawerActiveTab === 'Tasks' ? 'rgba(59, 130, 246, 0.3)' : 'transparent', fontWeight: projectDrawerActiveTab === 'Tasks' ? 'bold' : 'normal', padding: '8px 16px', fontSize: '13px' }}
                        >
                          📋 相關任務 ({projTasks.length})
                        </button>
                        <button
                          onClick={() => setProjectDrawerActiveTab('Meetings')}
                          style={{ ...styles.drawerTabBtn, background: projectDrawerActiveTab === 'Meetings' ? 'rgba(99, 102, 241, 0.2)' : 'transparent', color: projectDrawerActiveTab === 'Meetings' ? '#818CF8' : 'var(--text-muted)', borderColor: projectDrawerActiveTab === 'Meetings' ? 'rgba(99, 102, 241, 0.3)' : 'transparent', fontWeight: projectDrawerActiveTab === 'Meetings' ? 'bold' : 'normal', padding: '8px 16px', fontSize: '13px' }}
                        >
                          📅 相關會議 ({projMeetings.length})
                        </button>
                        <button
                          onClick={() => setProjectDrawerActiveTab('Bottlenecks')}
                          style={{ ...styles.drawerTabBtn, background: projectDrawerActiveTab === 'Bottlenecks' ? 'rgba(234, 179, 8, 0.2)' : 'transparent', color: projectDrawerActiveTab === 'Bottlenecks' ? '#FBBF24' : 'var(--text-muted)', borderColor: projectDrawerActiveTab === 'Bottlenecks' ? 'rgba(234, 179, 8, 0.3)' : 'transparent', fontWeight: projectDrawerActiveTab === 'Bottlenecks' ? 'bold' : 'normal', padding: '8px 16px', fontSize: '13px' }}
                        >
                          ⚠️ 相關阻礙 ({projBottlenecks.length})
                        </button>
                        <button
                          onClick={() => setProjectDrawerActiveTab('Knowledge')}
                          style={{ ...styles.drawerTabBtn, background: projectDrawerActiveTab === 'Knowledge' ? 'rgba(236, 72, 153, 0.2)' : 'transparent', color: projectDrawerActiveTab === 'Knowledge' ? '#F472B6' : 'var(--text-muted)', borderColor: projectDrawerActiveTab === 'Knowledge' ? 'rgba(236, 72, 153, 0.3)' : 'transparent', fontWeight: projectDrawerActiveTab === 'Knowledge' ? 'bold' : 'normal', padding: '8px 16px', fontSize: '13px' }}
                        >
                          🧠 相關知識筆記 ({projKnowledge.length})
                        </button>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        {renderTemplateDropdown('task_context', p.id)}
                      </div>
                    </div>

                    {/* Table: Requirement Traceability */}
                    {projectDrawerActiveTab === 'Traceability' && (() => {
                      const projectTasks = tasks.filter(t => String(t.project_id) === String(selectedModalProjectId));
                      
                      const getChildren = (parentId: any, type: string) => {
                        return projectTasks.filter(t => 
                          t.item_type === type && 
                          t.parent_item_id && 
                          String(t.parent_item_id) === String(parentId)
                        );
                      };

                      const buildTree = () => {
                        const objectives = projectTasks.filter(t => t.item_type === 'Business Objective');
                        return objectives.map(obj => {
                          const reqs = getChildren(obj.id, 'Business Requirement').map(req => {
                            const stories = getChildren(req.id, 'User Story').map(story => {
                              const storyTasks = getChildren(story.id, 'Task').map(task => {
                                const uats = getChildren(task.id, 'UAT').map(uat => ({
                                  item: uat,
                                  rowSpan: 1
                                }));
                                return {
                                  item: task,
                                  children: uats,
                                  rowSpan: Math.max(1, uats.reduce((sum, u) => sum + u.rowSpan, 0))
                                };
                              });
                              return {
                                item: story,
                                children: storyTasks,
                                rowSpan: Math.max(1, storyTasks.reduce((sum, t) => sum + t.rowSpan, 0))
                              };
                            });
                            return {
                              item: req,
                              children: stories,
                              rowSpan: Math.max(1, stories.reduce((sum, s) => sum + s.rowSpan, 0))
                            };
                          });
                          return {
                            item: obj,
                            children: reqs,
                            rowSpan: Math.max(1, reqs.reduce((sum, r) => sum + r.rowSpan, 0))
                          };
                        });
                      };

                      const tree = buildTree();
                      const rows: React.ReactNode[] = [];

                      const renderItemCell = (item: any, childType?: string, currentParentId?: string) => (
                        <div 
                          draggable={item.item_type !== 'Deploy'}
                          onDragEnd={() => setDndDraggingItem(null)}
                          onDragStart={(e) => {
                            setDndDraggingItem({ id: String(item.id), type: item.item_type || '' });
                            e.dataTransfer.setData('text/plain', JSON.stringify({
                              id: item.id,
                              type: item.item_type,
                              sourceParentId: currentParentId
                            }));
                            if (item.item_type !== 'Deploy') {
                              const childTasks = tasks.filter(t => {
                                if (t.id === item.id) return false;
                                if (t.item_type === 'Deploy' || t.item_type === 'Epic') return false;
                                if (item.item_type === 'User Story' || item.item_type === 'Bug') {
                                  if (t.item_type !== 'Task' && t.item_type !== 'Micro Task') return false;
                                } else if (item.item_type === 'Business Requirement') {
                                  if (t.item_type !== 'User Story' && t.item_type !== 'Epic' && t.item_type !== 'Bug') return false;
                                } else if (item.item_type === 'Business Objective') {
                                  if (t.item_type !== 'Business Requirement') return false;
                                }
                                if (t.parent_item_id && String(t.parent_item_id) === String(item.id)) return true;
                                if (item.item_type === 'Epic' || item.item_type === 'User Story' || item.item_type === 'Bug' || item.item_type === 'Business Requirement' || item.item_type === 'Business Objective') {
                                  let rels = t.related_item_id_relation;
                                  if (typeof rels === 'string') {
                                    try { rels = JSON.parse(rels); } catch(e) { rels = []; }
                                  }
                                  if (Array.isArray(rels)) {
                                    if (rels.some((r: any) => String(r.target_id) === String(item.id))) return true;
                                  }
                                  let pRels = item.related_item_id_relation;
                                  if (typeof pRels === 'string') {
                                    try { pRels = JSON.parse(pRels); } catch(e) { pRels = []; }
                                  }
                                  if (Array.isArray(pRels)) {
                                    if (pRels.some((r: any) => String(r.target_id) === String(t.id))) return true;
                                  }
                                }
                                return false;
                              });
                              let tasksHtml = '';
                              if (childTasks.length > 0) {
                                tasksHtml = `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.2); font-size: 11px; color: #94A3B8;">
                                  <div style="font-weight: bold; color: #38BDF8; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                                    <span>⚡</span> 連同底下 ${childTasks.length} 個關聯子項目一起整組移動：
                                  </div>
                                  <div style="display: flex; flex-direction: column; gap: 3px; max-height: 120px; overflow: hidden;">
                                    ${childTasks.slice(0, 4).map(ct => `<div style="display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.05); padding: 3px 6px; border-radius: 4px;"><span style="color: #10B981; font-weight: bold;">✓</span> <span style="color: #F1F5F9; font-weight: 500;">${ct.item_display_id || ct.content_display_id || 'Item'}</span> <span style="color: #CBD5E1; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${ct.item_title || ''}</span></div>`).join('')}
                                    ${childTasks.length > 4 ? `<div style="color: #94A3B8; font-style: italic; padding-left: 4px;">...以及其他 ${childTasks.length - 4} 個關聯子項目</div>` : ''}
                                  </div>
                                </div>`;
                              } else {
                                tasksHtml = `<div style="font-size: 11px; color: #64748B; margin-top: 6px; font-style: italic;">(目前無直接關聯之子項目)</div>`;
                              }
                              const dragPreview = document.createElement('div');
                              dragPreview.style.position = 'absolute';
                              dragPreview.style.top = '-9999px';
                              dragPreview.style.left = '-9999px';
                              dragPreview.style.background = '#0F172A';
                              dragPreview.style.border = '2px solid #38BDF8';
                              dragPreview.style.borderRadius = '12px';
                              dragPreview.style.padding = '12px 16px';
                              dragPreview.style.color = '#F8FAFC';
                              dragPreview.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 20px rgba(56, 189, 248, 0.3)';
                              dragPreview.style.width = '280px';
                              dragPreview.style.pointerEvents = 'none';
                              dragPreview.style.zIndex = '999999';
                              dragPreview.style.fontFamily = 'Inter, system-ui, sans-serif';
                              dragPreview.innerHTML = `
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                                  <span style="background: rgba(56, 189, 248, 0.2); color: #38BDF8; font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(56, 189, 248, 0.4);">📦 整組群組拖曳</span>
                                  <span style="font-size: 11px; color: #94A3B8; font-weight: 600;">${item.item_type || 'User Story'}</span>
                                </div>
                                <div style="font-weight: bold; font-size: 13px; color: #FFFFFF; line-height: 1.4;">
                                  <span style="color: #38BDF8;">${item.item_display_id || item.content_display_id || ''}</span> ${item.item_title || ''}
                                </div>
                                ${tasksHtml}
                              `;
                              document.body.appendChild(dragPreview);
                              if (e.dataTransfer.setDragImage) {
                                e.dataTransfer.setDragImage(dragPreview, 30, 30);
                              }
                              setTimeout(() => {
                                if (dragPreview.parentNode) dragPreview.parentNode.removeChild(dragPreview);
                              }, 0);
                            } else {
                              const dragPreview = document.createElement('div');
                              dragPreview.style.position = 'absolute';
                              dragPreview.style.top = '-9999px';
                              dragPreview.style.left = '-9999px';
                              dragPreview.style.background = '#0F172A';
                              dragPreview.style.border = '2px solid #A855F7';
                              dragPreview.style.borderRadius = '10px';
                              dragPreview.style.padding = '10px 14px';
                              dragPreview.style.color = '#F8FAFC';
                              dragPreview.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(168, 85, 247, 0.3)';
                              dragPreview.style.width = '240px';
                              dragPreview.style.pointerEvents = 'none';
                              dragPreview.style.zIndex = '999999';
                              dragPreview.style.fontFamily = 'Inter, system-ui, sans-serif';
                              dragPreview.innerHTML = `
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                                  <span style="background: rgba(168, 85, 247, 0.2); color: #C084FC; font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(168, 85, 247, 0.4);">🎯 任務拖曳</span>
                                  <span style="font-size: 11px; color: #94A3B8; font-weight: 600;">${item.item_type || 'Task'}</span>
                                </div>
                                <div style="font-weight: bold; font-size: 13px; color: #FFFFFF; line-height: 1.4;">
                                  <span style="color: #C084FC;">${item.item_display_id || item.content_display_id || ''}</span> ${item.item_title || ''}
                                </div>
                              `;
                              document.body.appendChild(dragPreview);
                              if (e.dataTransfer.setDragImage) {
                                e.dataTransfer.setDragImage(dragPreview, 25, 25);
                              }
                              setTimeout(() => {
                                if (dragPreview.parentNode) dragPreview.parentNode.removeChild(dragPreview);
                              }, 0);
                            }
                          }}
                          onDragEnd={() => setDndHoverTargetId(null)}
                          onDragOver={(e) => {
                            const validTargets = ['Deploy', 'Business Objective', 'Business Requirement', 'User Story', 'Epic', 'Bug', 'Task', 'Micro Task'];
                            if (validTargets.includes(item.item_type || '')) {
                              e.preventDefault();
                              e.stopPropagation();
                              if (dndHoverTargetId !== String(item.id)) setDndHoverTargetId(String(item.id));
                            }
                          }}
                          onDragLeave={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                              if (dndHoverTargetId === String(item.id)) setDndHoverTargetId(null);
                            setDndDraggingItem(null);
                            }
                          }}
                          onDrop={(e) => {
                            setDndHoverTargetId(null);
                            setDndDraggingItem(null);
                            const validTargets = ['Deploy', 'Business Objective', 'Business Requirement', 'User Story', 'Epic', 'Bug', 'Task', 'Micro Task'];
                            if (validTargets.includes(item.item_type || '')) {
                              e.stopPropagation();
                              handleDnDDrop(e, item.id, item.item_type || 'User Story');
                            }
                          }}
                          style={{ 
                            position: 'relative', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '4px', 
                            height: '100%', 
                            minHeight: '40px', 
                            cursor: item.item_type !== 'Deploy' ? 'grab' : 'default',
                            border: dndHoverTargetId === String(item.id) ? '2px dashed #10B981' : (dndDraggingItem && dndDraggingItem.id !== String(item.id) && isValidDropTarget(dndDraggingItem.type, item.item_type || '', activeTab) ? '1px dashed rgba(16, 185, 129, 0.6)' : '1px solid rgba(255,255,255,0.05)'),
                            backgroundColor: dndHoverTargetId === String(item.id) ? 'rgba(16, 185, 129, 0.25)' : (dndDraggingItem && dndDraggingItem.id !== String(item.id) && isValidDropTarget(dndDraggingItem.type, item.item_type || '', activeTab) ? 'rgba(16, 185, 129, 0.05)' : (item.item_type === 'Deploy' ? 'rgba(255,255,255,0.03)' : 'transparent')),
                            boxShadow: dndHoverTargetId === String(item.id) ? '0 0 25px rgba(16, 185, 129, 0.6), inset 0 0 15px rgba(16, 185, 129, 0.3)' : (dndDraggingItem && dndDraggingItem.id !== String(item.id) && isValidDropTarget(dndDraggingItem.type, item.item_type || '', activeTab) ? '0 0 10px rgba(16, 185, 129, 0.2)' : 'none'),
                            borderRadius: '8px',
                            padding: '8px',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            transform: dndHoverTargetId === String(item.id) ? 'scale(1.02)' : 'none',
                            zIndex: (inlineCreatingTraceChildFor === String(item.id) || inlineLinkingTraceChildFor === String(item.id) || inlineEditingTraceProjectFor === String(item.id) || inlineEditingTraceStatusFor === String(item.id)) ? 9999 : (dndHoverTargetId === String(item.id) ? 10 : 1),
                          }}
                          onMouseEnter={(e) => {
                            const btn = e.currentTarget.querySelector('.inline-create-btn');
                            if (btn) (btn as HTMLElement).style.opacity = '1';
                          }}
                          onMouseLeave={(e) => {
                            const btn = e.currentTarget.querySelector('.inline-create-btn');
                            if (btn) (btn as HTMLElement).style.opacity = '0';
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span 
                                style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'color 0.2s' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedModalTaskId(item.id);
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-primary)')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} title={item.item_type || 'Task'}>
                                  <span>{getItemTypeStyles(item.item_type || 'Task').icon}</span> {item.item_display_id || item.content_display_id}
                                </span>
                              </span>
                              
                              {inlineEditingTraceStatusFor === String(item.id) ? (
                                <ThemedSelect 
                                  autoFocus
                                  defaultValue={item.item_status || 'Not Start'}
                                  style={{ fontSize: '10px', padding: '2px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: 'none', outline: 'none', borderRadius: '4px' }}
                                  onBlur={() => setInlineEditingTraceStatusFor(null)}
                                  onChange={async (e) => {
                                    const newStatus = e.target.value;
                                    setInlineEditingTraceStatusFor(null);
                                    try {
                                      await api.updateTask(item.id, { ...item, item_status: newStatus });
                                      if (onRefreshData) await onRefreshData();
                                    } catch(err) { alert('更新失敗'); }
                                  }}
                                  onClick={e => e.stopPropagation()}
                                >
                                  {['Not Start', 'Ready', 'In Progress', 'Stuck', 'Review', 'Completed', 'Closed', 'Backlog'].map(s => <option key={s} value={s}>{s}</option>)}
                                </ThemedSelect>
                              ) : (
                                <span style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setInlineEditingTraceStatusFor(String(item.id)); }}>
                                  {getItemStatusBadge(item.item_status || 'Not Start')}
                                </span>
                              )}
                            </div>
                            
                            {inlineEditingTraceTitleFor === String(item.id) ? (
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                <input
                                  autoFocus
                                  value={inlineEditingTraceTitleValue}
                                  onChange={e => setInlineEditingTraceTitleValue(e.target.value)}
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                      try {
                                        await api.updateTask(item.id, { ...item, item_title: inlineEditingTraceTitleValue });
                                        if (onRefreshData) await onRefreshData();
                                        setInlineEditingTraceTitleFor(null);
                                      } catch(err) { alert('更新失敗'); }
                                    } else if (e.key === 'Escape') {
                                      setInlineEditingTraceTitleFor(null);
                                    }
                                  }}
                                  style={{ flex: 1, fontSize: '13px', padding: '2px 4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none', borderRadius: '4px' }}
                                />
                                <button style={{ background: 'transparent', border: 'none', color: '#10B981', cursor: 'pointer', padding: '2px' }}
                                  onClick={async () => {
                                    try {
                                      await api.updateTask(item.id, { ...item, item_title: inlineEditingTraceTitleValue });
                                      if (onRefreshData) await onRefreshData();
                                      setInlineEditingTraceTitleFor(null);
                                    } catch(err) { alert('更新失敗'); }
                                  }}
                                >✓</button>
                                <button style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
                                  onClick={() => setInlineEditingTraceTitleFor(null)}
                                >✕</button>
                              </div>
                            ) : (
                              <div 
                                style={{ fontSize: '13px', lineHeight: '1.4', cursor: 'text', padding: '2px 0', transition: 'color 0.2s' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInlineEditingTraceTitleFor(String(item.id));
                                  setInlineEditingTraceTitleValue(item.item_title || item.title || '');
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = 'inherit')}
                              >{item.item_title || item.title}</div>
                            )}
                          </div>
                          {childType && inlineCreatingTraceChildFor !== String(item.id) && (
                            <div 
                              className="inline-create-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInlineCreatingTraceChildFor(String(item.id));
                                setInlineCreatingTraceChildType(childType);
                                setInlineCreatingTraceChildTitle('');
                              }}
                              style={{ 
                                position: 'absolute', right: '-8px', top: '-8px', 
                                opacity: 0, transition: 'opacity 0.2s', 
                                cursor: 'pointer', color: 'var(--accent-primary)',
                                background: 'rgba(255,255,255,0.1)', borderRadius: '50%',
                                width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '16px', fontWeight: 'bold'
                              }}
                              title={`新增 ${childType}`}
                            >
                              +
                            </div>
                          )}
                          {inlineCreatingTraceChildFor === String(item.id) && (
                            <>
                              <div style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,0.5)' }} onClick={(e) => { e.stopPropagation(); setInlineCreatingTraceChildFor(null); }} />
                              <div style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '320px', background: '#0B1120', border: '1px solid #38BDF8', boxShadow: '0 15px 35px rgba(0,0,0,0.85), 0 0 15px rgba(56, 189, 248, 0.35)', padding: '16px', borderRadius: '12px', zIndex: 99999 }} onClick={e => e.stopPropagation()}>
                                <div style={{ fontSize: '12px', color: '#38BDF8', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(56, 189, 248, 0.2)', paddingBottom: '6px' }}><span>✨</span> 新增至右側 {childType} 欄位</div>
                                {childType === 'User Story' && (
                                  <div style={{ marginBottom: '8px' }}>
                                    <select
                                      value={inlineCreatingTraceChildType}
                                      onChange={(e: any) => setInlineCreatingTraceChildType(e.target.value)}
                                      style={{ width: '100%', background: '#000', color: 'var(--text-primary)', border: '1px solid #333', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', outline: 'none' }}
                                    >
                                      <option value="User Story" style={{ background: '#0B1120' }}>User Story</option>
                                      <option value="Bug" style={{ background: '#0B1120' }}>Bug</option>
                                    </select>
                                  </div>
                                )}
                                <input 
                                  autoFocus
                                  placeholder={`輸入 ${childType} 標題...`}
                                  value={inlineCreatingTraceChildTitle}
                                  onChange={e => setInlineCreatingTraceChildTitle(e.target.value)}
                                  onKeyDown={async e => {
                                    if (e.key === 'Enter' && inlineCreatingTraceChildTitle.trim()) {
                                      try {
                                        await api.createTask({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                          related_context_id: p.id,
                                          parent_item_id: item.id,
                                          item_title: inlineCreatingTraceChildTitle,
                                          item_type: inlineCreatingTraceChildType,
                                          item_status: 'Not Start',
                                          item_priority: 'Middle',
                                        });
                                        if (onRefreshData) await onRefreshData();
                                        setInlineCreatingTraceChildFor(null);
                                        setInlineCreatingTraceChildTitle('');
                                      } catch(err) { alert('建立失敗'); }
                                    } else if (e.key === 'Escape') {
                                      setInlineCreatingTraceChildFor(null);
                                    }
                                  }}
                                  style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent-primary)', color: '#fff', outline: 'none', fontSize: '12px', padding: '4px' }}
                                />
                                <div style={{ display: 'flex', gap: '4px', marginTop: '6px', justifyContent: 'flex-end' }}>
                                  <button style={{ background: 'var(--accent-primary)', border: 'none', color: '#fff', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                                    onClick={async () => {
                                      if (inlineCreatingTraceChildTitle.trim()) {
                                        try {
                                          await api.createTask({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                            related_context_id: p.id,
                                            parent_item_id: item.id,
                                            item_title: inlineCreatingTraceChildTitle,
                                            item_type: inlineCreatingTraceChildType,
                                            item_status: 'Not Start',
                                            item_priority: 'Middle',
                                          });
                                          if (onRefreshData) await onRefreshData();
                                          setInlineCreatingTraceChildFor(null);
                                          setInlineCreatingTraceChildTitle('');
                                        } catch(err) { alert('建立失敗'); }
                                      }
                                    }}
                                  >Save</button>
                                  <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '11px', padding: '2px 8px', cursor: 'pointer' }} onClick={() => setInlineCreatingTraceChildFor(null)}>Cancel</button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );

                      tree.forEach(objNode => {
                        let isFirstObjRow = true;
                        if (objNode.children.length === 0) {
                          rows.push(
                            <tr key={`obj-${objNode.item.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td rowSpan={1} style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                {renderItemCell(objNode.item, 'Business Requirement')}
                              </td>
                              <td colSpan={4} style={{ padding: '16px', verticalAlign: 'top', color: 'var(--text-muted)', textAlign: 'center' }}>—</td>
                            </tr>
                          );
                        } else {
                          objNode.children.forEach(reqNode => {
                            let isFirstReqRow = true;
                            if (reqNode.children.length === 0) {
                              rows.push(
                                <tr key={`req-${reqNode.item.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                  {isFirstObjRow && (
                                    <td rowSpan={objNode.rowSpan} style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                      {renderItemCell(objNode.item, 'Business Requirement')}
                                    </td>
                                  )}
                                  <td rowSpan={1} style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                    {renderItemCell(reqNode.item, 'User Story')}
                                  </td>
                                  <td colSpan={3} style={{ padding: '16px', verticalAlign: 'top', color: 'var(--text-muted)', textAlign: 'center' }}>—</td>
                                </tr>
                              );
                              isFirstObjRow = false;
                            } else {
                              reqNode.children.forEach(storyNode => {
                                let isFirstStoryRow = true;
                                if (storyNode.children.length === 0) {
                                  rows.push(
                                    <tr key={`story-${storyNode.item.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                      {isFirstObjRow && (
                                        <td rowSpan={objNode.rowSpan} style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                          {renderItemCell(objNode.item, 'Business Requirement')}
                                        </td>
                                      )}
                                      {isFirstReqRow && (
                                        <td rowSpan={reqNode.rowSpan} style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                          {renderItemCell(reqNode.item, 'User Story')}
                                        </td>
                                      )}
                                      <td rowSpan={1} style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                        {renderItemCell(storyNode.item, 'Task')}
                                      </td>
                                      <td colSpan={2} style={{ padding: '16px', verticalAlign: 'top', color: 'var(--text-muted)', textAlign: 'center' }}>—</td>
                                    </tr>
                                  );
                                  isFirstObjRow = false;
                                  isFirstReqRow = false;
                                } else {
                                  storyNode.children.forEach(taskNode => {
                                    let isFirstTaskRow = true;
                                    if (taskNode.children.length === 0) {
                                      rows.push(
                                        <tr key={`task-${taskNode.item.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                          {isFirstObjRow && (
                                            <td rowSpan={objNode.rowSpan} style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                              {renderItemCell(objNode.item, 'Business Requirement')}
                                            </td>
                                          )}
                                          {isFirstReqRow && (
                                            <td rowSpan={reqNode.rowSpan} style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                              {renderItemCell(reqNode.item, 'User Story')}
                                            </td>
                                          )}
                                          {isFirstStoryRow && (
                                            <td rowSpan={storyNode.rowSpan} style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                              {renderItemCell(storyNode.item, 'Task')}
                                            </td>
                                          )}
                                          <td rowSpan={1} style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                            {renderItemCell(taskNode.item, 'UAT')}
                                          </td>
                                          <td colSpan={1} style={{ padding: '16px', verticalAlign: 'top', color: 'var(--text-muted)', textAlign: 'center' }}>—</td>
                                        </tr>
                                      );
                                      isFirstObjRow = false;
                                      isFirstReqRow = false;
                                      isFirstStoryRow = false;
                                    } else {
                                      taskNode.children.forEach(uatNode => {
                                        rows.push(
                                          <tr key={`uat-${uatNode.item.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            {isFirstObjRow && (
                                              <td rowSpan={objNode.rowSpan} style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                                {renderItemCell(objNode.item, 'Business Requirement')}
                                              </td>
                                            )}
                                            {isFirstReqRow && (
                                              <td rowSpan={reqNode.rowSpan} style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                                {renderItemCell(reqNode.item, 'User Story')}
                                              </td>
                                            )}
                                            {isFirstStoryRow && (
                                              <td rowSpan={storyNode.rowSpan} style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                                {renderItemCell(storyNode.item, 'Task')}
                                              </td>
                                            )}
                                            {isFirstTaskRow && (
                                              <td rowSpan={taskNode.rowSpan} style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                                {renderItemCell(taskNode.item, 'UAT')}
                                              </td>
                                            )}
                                            <td rowSpan={1} style={{ padding: '16px', verticalAlign: 'top' }}>
                                              {renderItemCell(uatNode.item)}
                                            </td>
                                          </tr>
                                        );
                                        isFirstObjRow = false;
                                        isFirstReqRow = false;
                                        isFirstStoryRow = false;
                                        isFirstTaskRow = false;
                                      });
                                    }
                                  });
                                }
                              });
                            }
                          });
                        }
                      });

                      return (
                        <>
                          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden', marginTop: '8px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)' }}>
                              <thead style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <tr>
                                  <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, width: '20%', borderRight: '1px solid rgba(255,255,255,0.05)' }}>Business Objective</th>
                                  <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, width: '20%', borderRight: '1px solid rgba(255,255,255,0.05)' }}>Business Requirement</th>
                                  <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, width: '20%', borderRight: '1px solid rgba(255,255,255,0.05)' }}>User Story</th>
                                  <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, width: '20%', borderRight: '1px solid rgba(255,255,255,0.05)' }}>Task</th>
                                  <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, width: '20%' }}>UAT</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.length > 0 ? rows : (
                                  <tr>
                                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                      暫無資料
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                          <div style={{ marginTop: '8px' }}>
                          {inlineCreatingTaskProject === String(p.id) ? (
                            <ClickOutsideWrapper active={true} onOutsideClick={() => setInlineCreatingTaskProject(null)}>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <Select
                                  value={{ value: inlineCreatingTaskType, label: inlineCreatingTaskType === 'Knowledge | Note' ? 'Knowledge' : inlineCreatingTaskType }}
                                  onChange={(s: any) => setInlineCreatingTaskType(s ? s.value : 'Task')}
                                  styles={{
                                    ...reactSelectStyles,
                                    control: (base: any, state: any) => ({
                                      ...reactSelectStyles.control(base, state),
                                      minHeight: '32px',
                                      width: '150px'
                                    }),
                                    valueContainer: (base: any) => ({
                                      ...base,
                                      padding: '0 8px'
                                    })
                                  }}
                                  options={["Charter", "Epic", "Task", "Event", "Micro Task", "Meeting", "Bottleneck", "Knowledge", "Casual Note", "Bug", "UAT", "Deployment", "Milestone", "Business Objective", "Business Requirement", "User Story"].map(v => ({ value: v, label: v }))}
                                  formatOptionLabel={(option: any) => (
                                    <span style={{ 
                                      backgroundColor: `${getItemTypeStyles(option.value).bg}20`,
                                      color: getItemTypeStyles(option.value).text,
                                      padding: '2px 6px', borderRadius: '4px', fontSize: '11px',
                                      display: 'inline-flex', alignItems: 'center', gap: '4px'
                                    }}>
                                      <span>{getItemTypeStyles(option.value).icon}</span> {option.label}
                                    </span>
                                  )}
                                  isSearchable={false}
                                  menuPlacement="top"
                                />
                                <input
                                  type="text"
                                  autoFocus
                                  placeholder="輸入任務標題..."
                                  value={inlineCreatingTaskTitle}
                                  onChange={(e) => setInlineCreatingTaskTitle(e.target.value)}
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter' && inlineCreatingTaskTitle.trim()) {
                                      try {
                                        if (inlineCreatingTaskType === 'Meeting') {
                                          await api.createMeeting({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                            related_context_id: p.id,
                                            item_title: inlineCreatingTaskTitle,
                                            item_planned_start_date: new Date().toISOString(),
                                            item_status: 'Not Start',
                                          });
                                        } else {
                                          await api.createTask({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                            related_context_id: p.id,
                                            item_title: inlineCreatingTaskTitle,
                                            item_type: inlineCreatingTaskType,
                                            item_status: 'Not Start',
                                            item_priority: 'Middle',
                                          });
                                        }
                                        if (onRefreshData) await onRefreshData();
                                        setInlineCreatingTaskTitle('');
                                      } catch (err) {
                                        alert('建立失敗');
                                      }
                                    } else if (e.key === 'Escape') {
                                      setInlineCreatingTaskProject(null);
                                    }
                                  }}
                                  style={{ flex: 1, background: 'transparent', color: 'var(--text-primary)', border: 'none', borderBottom: '1px solid var(--accent-primary)', outline: 'none', padding: '6px' }}
                                />
                                <button 
                                  onClick={async () => {
                                    if (inlineCreatingTaskTitle.trim()) {
                                      try {
                                        if (inlineCreatingTaskType === 'Meeting') {
                                          await api.createMeeting({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                            related_context_id: p.id,
                                            item_title: inlineCreatingTaskTitle,
                                            item_planned_start_date: new Date().toISOString(),
                                            item_status: 'Not Start',
                                          });
                                        } else {
                                          await api.createTask({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                            related_context_id: p.id,
                                            item_title: inlineCreatingTaskTitle,
                                            item_type: inlineCreatingTaskType,
                                            item_status: 'Not Start',
                                            item_priority: 'Middle',
                                          });
                                        }
                                        if (onRefreshData) await onRefreshData();
                                        setInlineCreatingTaskTitle('');
                                      } catch (err) {
                                        alert('建立失敗');
                                      }
                                    }
                                  }}
                                  style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
                                >
                                  Save
                                </button>
                                <button 
                                  onClick={() => setInlineCreatingTaskProject(null)}
                                  style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                            </ClickOutsideWrapper>
                          ) : (
                            <div style={{ cursor: 'pointer', padding: '10px 16px', color: 'var(--text-muted)', fontSize: '13px', borderRadius: '6px' }} onClick={() => {
                              setInlineCreatingTaskProject(String(p.id));
                              setInlineCreatingTaskTitle('');
                              setInlineCreatingTaskType('Business Objective');
                            }} onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                              <span style={{ marginRight: '6px' }}>+</span>新增任務/工作項
                            </div>
                          )}
                        </div>
                        </>
                      );
                    })()}

                    {/* Table: Update & Deployment */}
                    {projectDrawerActiveTab === 'UpdateDeployment' && (() => {
                      const projectTasks = tasks.filter(t => String(t.project_id) === String(selectedModalProjectId));
                      
                      const getChildren = (parentId: any, type: string) => {
                        return projectTasks.filter(t => {
                          if (t.item_type !== type) return false;
                          if (t.parent_item_id && String(t.parent_item_id) === String(parentId)) return true;
                          
                          let rels = t.related_item_id_relation;
                          if (typeof rels === 'string') {
                            try { rels = JSON.parse(rels); } catch(e) { rels = []; }
                          }
                          if (Array.isArray(rels)) {
                            if (rels.some((r: any) => String(r.target_id) === String(parentId) && (r.relation === 'is_deployed' || r.relation === 'deploys'))) return true;
                          }
                          
                          const parentItem = projectTasks.find(p => String(p.id) === String(parentId));
                          if (parentItem) {
                            let pRels = parentItem.related_item_id_relation;
                            if (typeof pRels === 'string') {
                              try { pRels = JSON.parse(pRels); } catch(e) { pRels = []; }
                            }
                            if (Array.isArray(pRels)) {
                              if (pRels.some((r: any) => String(r.target_id) === String(t.id) && (r.relation === 'is_deployed' || r.relation === 'deploys'))) return true;
                            }
                          }
                          return false;
                        });
                      };

                      const buildTree = () => {
                        const deploys = projectTasks.filter(t => t.item_type === 'Deploy');
                        return deploys.map(deploy => {
                          const stories = [
                            ...getChildren(deploy.id, 'User Story'),
                            ...getChildren(deploy.id, 'Bug')
                          ].map(story => {
                            const storyTasks = getChildren(story.id, 'Task').concat(getChildren(story.id, 'Micro Task')).map(task => ({
                              item: task,
                              rowSpan: 1
                            }));
                            return {
                              item: story,
                              children: storyTasks,
                              rowSpan: Math.max(1, storyTasks.reduce((sum, t) => sum + t.rowSpan, 0))
                            };
                          });
                          return {
                            item: deploy,
                            children: stories,
                            rowSpan: Math.max(1, stories.reduce((sum, s) => sum + s.rowSpan, 0))
                          };
                        });
                      };

                      const tree = buildTree();
                      const rows: React.ReactNode[] = [];

                      const renderItemCell = (item: any, childType?: string, currentParentId?: string) => (
                        <div 
                          draggable={item.item_type !== 'Deploy'}
                          onDragEnd={() => setDndDraggingItem(null)}
                          onDragStart={(e) => {
                            setDndDraggingItem({ id: String(item.id), type: item.item_type || '' });
                            e.dataTransfer.setData('text/plain', JSON.stringify({
                              id: item.id,
                              type: item.item_type,
                              sourceParentId: currentParentId
                            }));
                            if (item.item_type !== 'Deploy') {
                              const childTasks = tasks.filter(t => {
                                if (t.id === item.id) return false;
                                if (t.item_type === 'Deploy' || t.item_type === 'Epic') return false;
                                if (item.item_type === 'User Story' || item.item_type === 'Bug') {
                                  if (t.item_type !== 'Task' && t.item_type !== 'Micro Task') return false;
                                } else if (item.item_type === 'Business Requirement') {
                                  if (t.item_type !== 'User Story' && t.item_type !== 'Epic' && t.item_type !== 'Bug') return false;
                                } else if (item.item_type === 'Business Objective') {
                                  if (t.item_type !== 'Business Requirement') return false;
                                }
                                if (t.parent_item_id && String(t.parent_item_id) === String(item.id)) return true;
                                if (item.item_type === 'Epic' || item.item_type === 'User Story' || item.item_type === 'Bug' || item.item_type === 'Business Requirement' || item.item_type === 'Business Objective') {
                                  let rels = t.related_item_id_relation;
                                  if (typeof rels === 'string') {
                                    try { rels = JSON.parse(rels); } catch(e) { rels = []; }
                                  }
                                  if (Array.isArray(rels)) {
                                    if (rels.some((r: any) => String(r.target_id) === String(item.id))) return true;
                                  }
                                  let pRels = item.related_item_id_relation;
                                  if (typeof pRels === 'string') {
                                    try { pRels = JSON.parse(pRels); } catch(e) { pRels = []; }
                                  }
                                  if (Array.isArray(pRels)) {
                                    if (pRels.some((r: any) => String(r.target_id) === String(t.id))) return true;
                                  }
                                }
                                return false;
                              });
                              let tasksHtml = '';
                              if (childTasks.length > 0) {
                                tasksHtml = `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.2); font-size: 11px; color: #94A3B8;">
                                  <div style="font-weight: bold; color: #38BDF8; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                                    <span>⚡</span> 連同底下 ${childTasks.length} 個關聯子項目一起整組移動：
                                  </div>
                                  <div style="display: flex; flex-direction: column; gap: 3px; max-height: 120px; overflow: hidden;">
                                    ${childTasks.slice(0, 4).map(ct => `<div style="display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.05); padding: 3px 6px; border-radius: 4px;"><span style="color: #10B981; font-weight: bold;">✓</span> <span style="color: #F1F5F9; font-weight: 500;">${ct.item_display_id || ct.content_display_id || 'Item'}</span> <span style="color: #CBD5E1; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${ct.item_title || ''}</span></div>`).join('')}
                                    ${childTasks.length > 4 ? `<div style="color: #94A3B8; font-style: italic; padding-left: 4px;">...以及其他 ${childTasks.length - 4} 個關聯子項目</div>` : ''}
                                  </div>
                                </div>`;
                              } else {
                                tasksHtml = `<div style="font-size: 11px; color: #64748B; margin-top: 6px; font-style: italic;">(目前無直接關聯之子項目)</div>`;
                              }
                              const dragPreview = document.createElement('div');
                              dragPreview.style.position = 'absolute';
                              dragPreview.style.top = '-9999px';
                              dragPreview.style.left = '-9999px';
                              dragPreview.style.background = '#0F172A';
                              dragPreview.style.border = '2px solid #38BDF8';
                              dragPreview.style.borderRadius = '12px';
                              dragPreview.style.padding = '12px 16px';
                              dragPreview.style.color = '#F8FAFC';
                              dragPreview.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 20px rgba(56, 189, 248, 0.3)';
                              dragPreview.style.width = '280px';
                              dragPreview.style.pointerEvents = 'none';
                              dragPreview.style.zIndex = '999999';
                              dragPreview.style.fontFamily = 'Inter, system-ui, sans-serif';
                              dragPreview.innerHTML = `
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                                  <span style="background: rgba(56, 189, 248, 0.2); color: #38BDF8; font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(56, 189, 248, 0.4);">📦 整組群組拖曳</span>
                                  <span style="font-size: 11px; color: #94A3B8; font-weight: 600;">${item.item_type || 'User Story'}</span>
                                </div>
                                <div style="font-weight: bold; font-size: 13px; color: #FFFFFF; line-height: 1.4;">
                                  <span style="color: #38BDF8;">${item.item_display_id || item.content_display_id || ''}</span> ${item.item_title || ''}
                                </div>
                                ${tasksHtml}
                              `;
                              document.body.appendChild(dragPreview);
                              if (e.dataTransfer.setDragImage) {
                                e.dataTransfer.setDragImage(dragPreview, 30, 30);
                              }
                              setTimeout(() => {
                                if (dragPreview.parentNode) dragPreview.parentNode.removeChild(dragPreview);
                              }, 0);
                            } else {
                              const dragPreview = document.createElement('div');
                              dragPreview.style.position = 'absolute';
                              dragPreview.style.top = '-9999px';
                              dragPreview.style.left = '-9999px';
                              dragPreview.style.background = '#0F172A';
                              dragPreview.style.border = '2px solid #A855F7';
                              dragPreview.style.borderRadius = '10px';
                              dragPreview.style.padding = '10px 14px';
                              dragPreview.style.color = '#F8FAFC';
                              dragPreview.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(168, 85, 247, 0.3)';
                              dragPreview.style.width = '240px';
                              dragPreview.style.pointerEvents = 'none';
                              dragPreview.style.zIndex = '999999';
                              dragPreview.style.fontFamily = 'Inter, system-ui, sans-serif';
                              dragPreview.innerHTML = `
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                                  <span style="background: rgba(168, 85, 247, 0.2); color: #C084FC; font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(168, 85, 247, 0.4);">🎯 任務拖曳</span>
                                  <span style="font-size: 11px; color: #94A3B8; font-weight: 600;">${item.item_type || 'Task'}</span>
                                </div>
                                <div style="font-weight: bold; font-size: 13px; color: #FFFFFF; line-height: 1.4;">
                                  <span style="color: #C084FC;">${item.item_display_id || item.content_display_id || ''}</span> ${item.item_title || ''}
                                </div>
                              `;
                              document.body.appendChild(dragPreview);
                              if (e.dataTransfer.setDragImage) {
                                e.dataTransfer.setDragImage(dragPreview, 25, 25);
                              }
                              setTimeout(() => {
                                if (dragPreview.parentNode) dragPreview.parentNode.removeChild(dragPreview);
                              }, 0);
                            }
                          }}
                          onDragEnd={() => setDndHoverTargetId(null)}
                          onDragOver={(e) => {
                            const validTargets = ['Deploy', 'Business Objective', 'Business Requirement', 'User Story', 'Epic', 'Bug', 'Task', 'Micro Task'];
                            if (validTargets.includes(item.item_type || '')) {
                              e.preventDefault();
                              e.stopPropagation();
                              if (dndHoverTargetId !== String(item.id)) setDndHoverTargetId(String(item.id));
                            }
                          }}
                          onDragLeave={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                              if (dndHoverTargetId === String(item.id)) setDndHoverTargetId(null);
                            setDndDraggingItem(null);
                            }
                          }}
                          onDrop={(e) => {
                            setDndHoverTargetId(null);
                            setDndDraggingItem(null);
                            const validTargets = ['Deploy', 'Business Objective', 'Business Requirement', 'User Story', 'Epic', 'Bug', 'Task', 'Micro Task'];
                            if (validTargets.includes(item.item_type || '')) {
                              e.stopPropagation();
                              handleDnDDrop(e, item.id, item.item_type || 'User Story');
                            }
                          }}
                          style={{ 
                            position: 'relative', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '4px', 
                            height: '100%', 
                            minHeight: '40px', 
                            cursor: item.item_type !== 'Deploy' ? 'grab' : 'default',
                            border: dndHoverTargetId === String(item.id) ? '2px dashed #10B981' : (dndDraggingItem && dndDraggingItem.id !== String(item.id) && isValidDropTarget(dndDraggingItem.type, item.item_type || '', activeTab) ? '1px dashed rgba(16, 185, 129, 0.6)' : '1px solid rgba(255,255,255,0.05)'),
                            backgroundColor: dndHoverTargetId === String(item.id) ? 'rgba(16, 185, 129, 0.25)' : (dndDraggingItem && dndDraggingItem.id !== String(item.id) && isValidDropTarget(dndDraggingItem.type, item.item_type || '', activeTab) ? 'rgba(16, 185, 129, 0.05)' : (item.item_type === 'Deploy' ? 'rgba(255,255,255,0.03)' : 'transparent')),
                            boxShadow: dndHoverTargetId === String(item.id) ? '0 0 25px rgba(16, 185, 129, 0.6), inset 0 0 15px rgba(16, 185, 129, 0.3)' : (dndDraggingItem && dndDraggingItem.id !== String(item.id) && isValidDropTarget(dndDraggingItem.type, item.item_type || '', activeTab) ? '0 0 10px rgba(16, 185, 129, 0.2)' : 'none'),
                            borderRadius: '8px',
                            padding: '8px',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            transform: dndHoverTargetId === String(item.id) ? 'scale(1.02)' : 'none',
                            zIndex: (inlineCreatingTraceChildFor === String(item.id) || inlineLinkingTraceChildFor === String(item.id) || inlineEditingTraceProjectFor === String(item.id) || inlineEditingTraceStatusFor === String(item.id)) ? 9999 : (dndHoverTargetId === String(item.id) ? 10 : 1),
                          }}
                          onMouseEnter={(e) => {
                            const btn = e.currentTarget.querySelector('.inline-create-btn');
                            if (btn) (btn as HTMLElement).style.opacity = '1';
                          }}
                          onMouseLeave={(e) => {
                            const btn = e.currentTarget.querySelector('.inline-create-btn');
                            if (btn) (btn as HTMLElement).style.opacity = '0';
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span 
                                style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'color 0.2s' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedModalTaskId(item.id);
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-primary)')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                              >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} title={item.item_type || 'Task'}>
                                  <span>{getItemTypeStyles(item.item_type || 'Task').icon}</span> {item.item_display_id || item.content_display_id}
                                </span>
                              </span>
                              
                              {inlineEditingTraceStatusFor === String(item.id) ? (
                                <ThemedSelect 
                                  autoFocus
                                  defaultValue={item.item_status || 'Not Start'}
                                  style={{ fontSize: '10px', padding: '2px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: 'none', outline: 'none', borderRadius: '4px' }}
                                  onBlur={() => setInlineEditingTraceStatusFor(null)}
                                  onChange={async (e) => {
                                    const newStatus = e.target.value;
                                    setInlineEditingTraceStatusFor(null);
                                    try {
                                      await api.updateTask(item.id, { ...item, item_status: newStatus });
                                      if (onRefreshData) await onRefreshData();
                                    } catch(err) { alert('更新失敗'); }
                                  }}
                                  onClick={e => e.stopPropagation()}
                                >
                                  {['Not Start', 'Ready', 'In Progress', 'Stuck', 'Review', 'Completed', 'Closed', 'Backlog'].map(s => <option key={s} value={s}>{s}</option>)}
                                </ThemedSelect>
                              ) : (
                                <span style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setInlineEditingTraceStatusFor(String(item.id)); }}>
                                  {getItemStatusBadge(item.item_status || 'Not Start')}
                                </span>
                              )}
                            </div>
                            
                            {inlineEditingTraceTitleFor === String(item.id) ? (
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                <input
                                  autoFocus
                                  value={inlineEditingTraceTitleValue}
                                  onChange={e => setInlineEditingTraceTitleValue(e.target.value)}
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                      try {
                                        await api.updateTask(item.id, { ...item, item_title: inlineEditingTraceTitleValue });
                                        if (onRefreshData) await onRefreshData();
                                        setInlineEditingTraceTitleFor(null);
                                      } catch(err) { alert('更新失敗'); }
                                    } else if (e.key === 'Escape') {
                                      setInlineEditingTraceTitleFor(null);
                                    }
                                  }}
                                  style={{ flex: 1, fontSize: '13px', padding: '2px 4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none', borderRadius: '4px' }}
                                />
                                <button style={{ background: 'transparent', border: 'none', color: '#10B981', cursor: 'pointer', padding: '2px' }}
                                  onClick={async () => {
                                    try {
                                      await api.updateTask(item.id, { ...item, item_title: inlineEditingTraceTitleValue });
                                      if (onRefreshData) await onRefreshData();
                                      setInlineEditingTraceTitleFor(null);
                                    } catch(err) { alert('更新失敗'); }
                                  }}
                                >✓</button>
                                <button style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
                                  onClick={() => setInlineEditingTraceTitleFor(null)}
                                >✕</button>
                              </div>
                            ) : (
                              <div 
                                style={{ fontSize: '13px', lineHeight: '1.4', cursor: 'text', padding: '2px 0', transition: 'color 0.2s' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInlineEditingTraceTitleFor(String(item.id));
                                  setInlineEditingTraceTitleValue(item.item_title || item.title || '');
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = 'inherit')}
                              >{item.item_title || item.title}</div>
                            )}
                          </div>
                          {childType && inlineCreatingTraceChildFor !== String(item.id) && inlineLinkingTraceChildFor !== String(item.id) && (
                            <div 
                              className="inline-create-btn"
                              style={{ 
                                position: 'absolute', right: '-8px', top: '-8px', 
                                opacity: 0, transition: 'opacity 0.2s', 
                                display: 'flex', gap: '4px'
                              }}
                            >
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInlineLinkingTraceChildFor(String(item.id));
                                  setInlineLinkingTraceChildType(childType);
                                }}
                                style={{ 
                                  cursor: 'pointer', color: 'var(--accent-primary)',
                                  background: 'rgba(255,255,255,0.1)', borderRadius: '50%',
                                  width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '12px'
                                }}
                                title={`連結現有 ${childType}`}
                              >
                                🔗
                              </div>
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInlineCreatingTraceChildFor(String(item.id));
                                  setInlineCreatingTraceChildType(childType);
                                  setInlineCreatingTraceChildTitle('');
                                }}
                                style={{ 
                                  cursor: 'pointer', color: 'var(--accent-primary)',
                                  background: 'rgba(255,255,255,0.1)', borderRadius: '50%',
                                  width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '16px', fontWeight: 'bold'
                                }}
                                title={`新增 ${childType}`}
                              >
                                +
                              </div>
                            </div>
                          )}
                          {inlineLinkingTraceChildFor === String(item.id) && (
                            <>
                              <div style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,0.5)' }} onClick={(e) => { e.stopPropagation(); setInlineLinkingTraceChildFor(null); }} />
                              <div style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '320px', background: '#0B1120', border: '1px solid #38BDF8', boxShadow: '0 15px 35px rgba(0,0,0,0.85), 0 0 15px rgba(56, 189, 248, 0.35)', padding: '16px', borderRadius: '12px', zIndex: 99999 }} onClick={e => e.stopPropagation()}>
                                <div style={{ fontSize: '12px', color: '#38BDF8', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(56, 189, 248, 0.2)', paddingBottom: '6px' }}><span>🔗</span> 連結至右側 {childType} 欄位</div>
                                <Select
                                  autoFocus
                                  placeholder="-- 請選擇 --"
                                  options={projectTasks
                                    .filter(t => {
                                      if (inlineLinkingTraceChildType === 'User Story' ? (t.item_type !== 'User Story' && t.item_type !== 'Bug') : (t.item_type !== inlineLinkingTraceChildType)) return false;
                                      if (String(t.parent_item_id) === String(item.id)) return false;
                                      let rels = t.related_item_id_relation;
                                      if (typeof rels === 'string') {
                                        try { rels = JSON.parse(rels); } catch(e) { rels = []; }
                                      }
                                      if (Array.isArray(rels)) {
                                        if (rels.some((r: any) => String(r.target_id) === String(item.id) && r.relation === 'is_deployed')) return false;
                                      }
                                      return true;
                                    })
                                    .map(t => ({ value: String(t.id), label: `${t.item_display_id || t.content_display_id || ''} ${t.item_title || t.title || ''}`.trim() }))}
                                  onChange={async (selectedOption: any) => {
                                    if (!selectedOption) return;
                                    const selectedChildId = selectedOption.value;
                                    try {
                                      const childItem = tasks.find(t => String(t.id) === selectedChildId);
                                      if (childItem) {
                                        let currentRels = childItem.related_item_id_relation;
                                        if (typeof currentRels === 'string') {
                                          try { currentRels = JSON.parse(currentRels); } catch(e) { currentRels = []; }
                                        }
                                        if (!Array.isArray(currentRels)) currentRels = [];
                                        
                                        if (!currentRels.some((r: any) => String(r.target_id) === String(item.id) && r.relation === 'is_deployed')) {
                                          const newRelations = [...currentRels, { target_id: Number(item.id), relation: 'is_deployed' }];
                                          await api.updateTask(childItem.id, { 
                                            ...childItem, 
                                            related_item_id_relation: newRelations 
                                          });
                                          if (onRefreshData) await onRefreshData();
                                        }
                                      }
                                      setInlineLinkingTraceChildFor(null);
                                    } catch(err) { alert('連結失敗'); }
                                  }}
                                  styles={{
                                    control: (base) => ({ ...base, background: '#000', borderColor: '#333', minHeight: '30px', fontSize: '12px' }),
                                    menu: (base) => ({ ...base, background: '#0B1120', border: '1px solid #333', zIndex: 9999 }),
                                    option: (base, state) => ({ ...base, background: state.isFocused ? '#1e293b' : 'transparent', color: '#fff', fontSize: '12px', cursor: 'pointer' }),
                                    singleValue: (base) => ({ ...base, color: '#fff' }),
                                    input: (base) => ({ ...base, color: '#fff' })
                                  }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                                  <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '11px', padding: '2px 8px', cursor: 'pointer' }} onClick={() => setInlineLinkingTraceChildFor(null)}>Cancel</button>
                                </div>
                              </div>
                            </>
                          )}
                          {inlineCreatingTraceChildFor === String(item.id) && (
                            <>
                              <div style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,0.5)' }} onClick={(e) => { e.stopPropagation(); setInlineCreatingTraceChildFor(null); }} />
                              <div style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '320px', background: '#0B1120', border: '1px solid #38BDF8', boxShadow: '0 15px 35px rgba(0,0,0,0.85), 0 0 15px rgba(56, 189, 248, 0.35)', padding: '16px', borderRadius: '12px', zIndex: 99999 }} onClick={e => e.stopPropagation()}>
                                <div style={{ fontSize: '12px', color: '#38BDF8', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(56, 189, 248, 0.2)', paddingBottom: '6px' }}><span>✨</span> 新增至右側 {childType} 欄位</div>
                                {childType === 'User Story' && (
                                  <div style={{ marginBottom: '8px' }}>
                                    <select
                                      value={inlineCreatingTraceChildType}
                                      onChange={(e: any) => setInlineCreatingTraceChildType(e.target.value)}
                                      style={{ width: '100%', background: '#000', color: 'var(--text-primary)', border: '1px solid #333', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', outline: 'none' }}
                                    >
                                      <option value="User Story" style={{ background: '#0B1120' }}>User Story</option>
                                      <option value="Bug" style={{ background: '#0B1120' }}>Bug</option>
                                    </select>
                                  </div>
                                )}
                                <input 
                                  autoFocus
                                  placeholder={`輸入 ${childType} 標題...`}
                                  value={inlineCreatingTraceChildTitle}
                                  onChange={e => setInlineCreatingTraceChildTitle(e.target.value)}
                                  onKeyDown={async e => {
                                    if (e.key === 'Enter' && inlineCreatingTraceChildTitle.trim()) {
                                      try {
                                        await api.createTask({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                          related_context_id: p.id,
                                          item_title: inlineCreatingTraceChildTitle,
                                          item_type: inlineCreatingTraceChildType,
                                          item_status: 'Not Start',
                                          item_priority: 'Middle',
                                          parent_item_id: Number(item.id), related_item_id_relation: [{ target_id: Number(item.id), relation: 'is_deployed' }]
                                        });
                                        if (onRefreshData) await onRefreshData();
                                        setInlineCreatingTraceChildFor(null);
                                        setInlineCreatingTraceChildTitle('');
                                      } catch(err) { alert('建立失敗'); }
                                    } else if (e.key === 'Escape') {
                                      setInlineCreatingTraceChildFor(null);
                                    }
                                  }}
                                  style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent-primary)', color: '#fff', outline: 'none', fontSize: '12px', padding: '4px' }}
                                />
                                <div style={{ display: 'flex', gap: '4px', marginTop: '6px', justifyContent: 'flex-end' }}>
                                  <button style={{ background: 'var(--accent-primary)', border: 'none', color: '#fff', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                                    onClick={async () => {
                                      if (inlineCreatingTraceChildTitle.trim()) {
                                        try {
                                          await api.createTask({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                            related_context_id: p.id,
                                            item_title: inlineCreatingTraceChildTitle,
                                            item_type: inlineCreatingTraceChildType,
                                            item_status: 'Not Start',
                                            item_priority: 'Middle',
                                            parent_item_id: Number(item.id), related_item_id_relation: [{ target_id: Number(item.id), relation: 'is_deployed' }]
                                          });
                                          if (onRefreshData) await onRefreshData();
                                          setInlineCreatingTraceChildFor(null);
                                          setInlineCreatingTraceChildTitle('');
                                        } catch(err) { alert('建立失敗'); }
                                      }
                                    }}
                                  >Save</button>
                                  <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '11px', padding: '2px 8px', cursor: 'pointer' }} onClick={() => setInlineCreatingTraceChildFor(null)}>Cancel</button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );

                      tree.forEach(deployNode => {
                        let isFirstDeployRow = true;
                        if (deployNode.children.length === 0) {
                          rows.push(
                            <tr key={`deploy-${deployNode.item.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td rowSpan={1} 
                                  onDragOver={e => { e.preventDefault(); if (dndHoverTargetId !== String(deployNode.item.id)) setDndHoverTargetId(String(deployNode.item.id)); }}
                                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDndHoverTargetId(null);
                            setDndDraggingItem(null); }}
                                  onDrop={e => handleDnDDrop(e, deployNode.item.id, 'Deploy')}
                                  style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                {renderItemCell(deployNode.item, 'User Story')}
                              </td>
                              <td colSpan={2} style={{ padding: '16px', verticalAlign: 'top', color: 'var(--text-muted)', textAlign: 'center' }}>—</td>
                            </tr>
                          );
                        } else {
                          deployNode.children.forEach(storyNode => {
                            let isFirstStoryRow = true;
                            if (storyNode.children.length === 0) {
                              rows.push(
                                <tr key={`story-${storyNode.item.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                  {isFirstDeployRow && (
                                    <td rowSpan={deployNode.rowSpan} 
                                      onDragOver={e => { e.preventDefault(); if (dndHoverTargetId !== String(deployNode.item.id)) setDndHoverTargetId(String(deployNode.item.id)); }}
                                      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDndHoverTargetId(null);
                            setDndDraggingItem(null); }}
                                      onDrop={e => handleDnDDrop(e, deployNode.item.id, 'Deploy')}
                                      style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                      {renderItemCell(deployNode.item, 'User Story')}
                                    </td>
                                  )}
                                  <td rowSpan={1} 
                                    onDragOver={e => { e.preventDefault(); if (dndHoverTargetId !== String(storyNode.item.id)) setDndHoverTargetId(String(storyNode.item.id)); }}
                                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDndHoverTargetId(null);
                            setDndDraggingItem(null); }}
                                    onDrop={e => handleDnDDrop(e, storyNode.item.id, 'User Story')}
                                    style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                    {renderItemCell(storyNode.item, 'Task', String(deployNode.item.id))}
                                  </td>
                                  <td colSpan={1} style={{ padding: '16px', verticalAlign: 'top', color: 'var(--text-muted)', textAlign: 'center' }}>—</td>
                                </tr>
                              );
                              isFirstDeployRow = false;
                            } else {
                              storyNode.children.forEach(taskNode => {
                                rows.push(
                                  <tr key={`task-${taskNode.item.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    {isFirstDeployRow && (
                                      <td rowSpan={deployNode.rowSpan} 
                                        onDragOver={e => { e.preventDefault(); if (dndHoverTargetId !== String(deployNode.item.id)) setDndHoverTargetId(String(deployNode.item.id)); }}
                                        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDndHoverTargetId(null);
                            setDndDraggingItem(null); }}
                                        onDrop={e => handleDnDDrop(e, deployNode.item.id, 'Deploy')}
                                        style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                        {renderItemCell(deployNode.item, 'User Story')}
                                      </td>
                                    )}
                                    {isFirstStoryRow && (
                                      <td rowSpan={storyNode.rowSpan} 
                                        onDragOver={e => { e.preventDefault(); if (dndHoverTargetId !== String(storyNode.item.id)) setDndHoverTargetId(String(storyNode.item.id)); }}
                                        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDndHoverTargetId(null);
                            setDndDraggingItem(null); }}
                                        onDrop={e => handleDnDDrop(e, storyNode.item.id, 'User Story')}
                                        style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                        {renderItemCell(storyNode.item, 'Task', String(deployNode.item.id))}
                                      </td>
                                    )}
                                    <td rowSpan={1} style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                      {renderItemCell(taskNode.item, undefined, String(storyNode.item.id))}
                                    </td>
                                  </tr>
                                );
                                isFirstDeployRow = false;
                                isFirstStoryRow = false;
                              });
                            }
                          });
                        }
                      });

                      return (
                        <>
                          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden', marginTop: '8px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)' }}>
                              <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '13px' }}>
                                  <th style={{ padding: '12px 16px', textAlign: 'left', width: '33%', fontWeight: 600 }}>Deployment</th>
                                  <th style={{ padding: '12px 16px', textAlign: 'left', width: '33%', fontWeight: 600 }}>User Story</th>
                                  <th style={{ padding: '12px 16px', textAlign: 'left', width: '34%', fontWeight: 600 }}>Task</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.length > 0 ? rows : (
                                  <tr>
                                    <td colSpan={3} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                      尚未建立任何 Deployment 項目
                                    </td>
                                  </tr>
                                )}
                                {inlineCreatingTaskProject === String(p.id) && inlineCreatingTaskType === 'Deploy' ? (
                                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                    <td style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                      <input
                                        type="text"
                                        autoFocus
                                        placeholder="輸入 Deployment 名稱..."
                                        value={inlineCreatingTaskTitle}
                                        onChange={(e) => setInlineCreatingTaskTitle(e.target.value)}
                                        onKeyDown={async (e) => {
                                          if (e.key === 'Enter' && inlineCreatingTaskTitle.trim()) {
                                            try {
                                              await api.createTask({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                                related_context_id: p.id,
                                                item_title: inlineCreatingTaskTitle,
                                                item_type: 'Deploy',
                                                item_status: 'Not Start',
                                                item_priority: 'Middle',
                                              });
                                              if (onRefreshData) await onRefreshData();
                                              setInlineCreatingTaskTitle('');
                                              setInlineCreatingTaskProject(null);
                                            } catch (err) { alert('建立失敗'); }
                                          } else if (e.key === 'Escape') {
                                            setInlineCreatingTaskProject(null);
                                          }
                                        }}
                                        style={{ width: '100%', background: 'transparent', color: 'var(--text-primary)', border: 'none', borderBottom: '1px solid var(--accent-primary)', outline: 'none', padding: '4px', fontSize: '13px', marginBottom: '8px' }}
                                      />
                                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start' }}>
                                        <button 
                                          onClick={async () => {
                                            if (inlineCreatingTaskTitle.trim()) {
                                              try {
                                                await api.createTask({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                                  related_context_id: p.id,
                                                  item_title: inlineCreatingTaskTitle,
                                                  item_type: 'Deploy',
                                                  item_status: 'Not Start',
                                                  item_priority: 'Middle',
                                                });
                                                if (onRefreshData) await onRefreshData();
                                                setInlineCreatingTaskTitle('');
                                                setInlineCreatingTaskProject(null);
                                              } catch (err) { alert('建立失敗'); }
                                            }
                                          }}
                                          style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '11px' }}
                                        >Save</button>
                                        <button 
                                          onClick={() => setInlineCreatingTaskProject(null)}
                                          style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontSize: '11px', padding: '2px 8px' }}
                                        >Cancel</button>
                                      </div>
                                    </td>
                                    <td style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', borderTop: '1px solid rgba(255,255,255,0.05)' }}></td>
                                    <td style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', borderTop: '1px solid rgba(255,255,255,0.05)' }}></td>
                                  </tr>
                                ) : (
                                  <tr>
                                    <td colSpan={3} style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                      <button 
                                        onClick={() => {
                                          setInlineCreatingTaskProject(String(p.id));
                                          setInlineCreatingTaskType('Deploy');
                                          setInlineCreatingTaskTitle('');
                                        }}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 0' }}
                                      >
                                        + 新增 Deployment
                                      </button>
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                          

                        </>
                      );
                    })()}


                    {/* Table 1: 任務與工作項 */}
                    {(projectDrawerActiveTab === 'Charter' || projectDrawerActiveTab === 'Milestones') && (() => {
                      let currentTasksList = projectDrawerActiveTab === 'Charter' ? projCharter : projMilestones;
                      
                      if (tableSortConfig) {
                        currentTasksList = [...currentTasksList].sort((a, b) => {
                          const key = tableSortConfig.key as keyof typeof a;
                          let aVal = a[key] || '';
                          let bVal = b[key] || '';
                          if (key === 'item_follow_by') {
                            const aMem = members.find(m => m.member_id === a.item_follow_by);
                            const bMem = members.find(m => m.member_id === b.item_follow_by);
                            aVal = aMem?.name || '';
                            bVal = bMem?.name || '';
                          }
                          if (aVal < bVal) return tableSortConfig.direction === 'asc' ? -1 : 1;
                          if (aVal > bVal) return tableSortConfig.direction === 'asc' ? 1 : -1;
                          return 0;
                        });
                      }

                      const handleSort = (key: string) => {
                        let direction: 'asc' | 'desc' = 'asc';
                        if (tableSortConfig && tableSortConfig.key === key && tableSortConfig.direction === 'asc') {
                          direction = 'desc';
                        }
                        setTableSortConfig({ key, direction });
                      };

                      const SortIcon = ({ columnKey }: { columnKey: string }) => {
                        if (tableSortConfig?.key !== columnKey) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕</span>;
                        return <span style={{ color: 'var(--accent-primary)', marginLeft: '4px' }}>{tableSortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
                      };

                        const taskColumns = [
                          {
                            id: 'item_display_id',
                            header: '識別碼 (ID)',
                            accessor: 'item_display_id' as const,
                            cell: (t: any) => (
                              <span 
                                onClick={() => setSelectedModalTaskId(t.id)}
                                style={{ fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--accent-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', textDecoration: 'underline' }} 
                                title={t.item_type || 'Task'}
                              >
                                <span>{getItemTypeStyles(t.item_type || 'Task').icon}</span> {t.item_display_id}
                              </span>
                            )
                          },
                          {
                            id: 'item_title',
                            header: '標題',
                            accessor: 'item_title' as const,
                            cell: (t: any) => {
                              return inlineEditingTraceTitleFor === String(t.id) ? (
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  <input
                                    autoFocus
                                    value={inlineEditingTraceTitleValue}
                                    onChange={e => setInlineEditingTraceTitleValue(e.target.value)}
                                    onKeyDown={async (e) => {
                                      if (e.key === 'Enter') {
                                        try {
                                          await api.updateTask(t.id, { ...t, item_title: inlineEditingTraceTitleValue });
                                          if (onRefreshData) await onRefreshData();
                                          setInlineEditingTraceTitleFor(null);
                                        } catch(err) { alert('更新失敗'); }
                                      } else if (e.key === 'Escape') {
                                        setInlineEditingTraceTitleFor(null);
                                      }
                                    }}
                                    style={{ flex: 1, fontSize: '13px', padding: '2px 4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none', borderRadius: '4px', minWidth: '150px' }}
                                  />
                                  <button style={{ background: 'transparent', border: 'none', color: '#10B981', cursor: 'pointer', padding: '2px' }}
                                    onMouseDown={async (e) => {
                                      e.preventDefault();
                                      try {
                                        await api.updateTask(t.id, { ...t, item_title: inlineEditingTraceTitleValue });
                                        if (onRefreshData) await onRefreshData();
                                        setInlineEditingTraceTitleFor(null);
                                      } catch(err) { alert('更新失敗'); }
                                    }}
                                  >✓</button>
                                  <button style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
                                    onMouseDown={(e) => { e.preventDefault(); setInlineEditingTraceTitleFor(null); }}
                                  >✕</button>
                                </div>
                              ) : (
                                <span 
                                  style={{ fontWeight: 'bold', cursor: 'text' }}
                                  onClick={() => {
                                    setInlineEditingTraceTitleFor(String(t.id));
                                    setInlineEditingTraceTitleValue(t.item_title || t.title || '');
                                  }}
                                >📄 {t.item_title}</span>
                              );
                            }
                          },
                          {
                            id: 'item_type',
                            header: '類型',
                            accessor: 'item_type' as const,
                            cell: (t: any) => {
                              return inlineEditingTypeFor === String(t.id) ? (
                                <ThemedSelect 
                                  autoFocus
                                  defaultValue={t.item_type || 'Task'}
                                  style={{ fontSize: '11px', padding: '2px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: 'none', outline: 'none', borderRadius: '4px' }}
                                  onBlur={() => setInlineEditingTypeFor(null)}
                                  onChange={async (e) => {
                                    try {
                                      await api.updateTask(t.id, { ...t, item_type: e.target.value });
                                      if (onRefreshData) await onRefreshData();
                                      setInlineEditingTypeFor(null);
                                    } catch(err) { alert('更新失敗'); }
                                  }}
                                >
                                  {['Charter', 'Epic', 'Task', 'Event', 'Micro Task', 'Meeting', 'Bottleneck', 'Knowledge', 'Casual Note', 'Bug', 'UAT', 'Deployment', 'Milestone', 'Business Objective', 'Business Requirement', 'User Story'].map(s => <option key={s} value={s}>{s}</option>)}
                                </ThemedSelect>
                              ) : (
                                <span 
                                  className="nature-tag" 
                                  style={{ backgroundColor: `${getItemTypeStyles(t.item_type || 'Task').bg}20`, color: getItemTypeStyles(t.item_type || 'Task').text, padding: '2px 6px', borderRadius: '4px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                                  onClick={(e) => { e.stopPropagation(); setInlineEditingTypeFor(String(t.id)); }}
                                >
                                  <span>{getItemTypeStyles(t.item_type || 'Task').icon}</span> {t.item_type}
                                </span>
                              );
                            }
                          },
                          {
                            id: 'item_status',
                            header: '狀態',
                            accessor: 'item_status' as const,
                            cell: (t: any) => {
                              return inlineEditingTraceStatusFor === String(t.id) ? (
                                <ThemedSelect 
                                  autoFocus
                                  defaultValue={t.item_status || 'Not Start'}
                                  style={{ fontSize: '11px', padding: '2px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: 'none', outline: 'none', borderRadius: '4px' }}
                                  onBlur={() => setInlineEditingTraceStatusFor(null)}
                                  onChange={async (e) => {
                                    try {
                                      await api.updateTask(t.id, { ...t, item_status: e.target.value });
                                      if (onRefreshData) await onRefreshData();
                                      setInlineEditingTraceStatusFor(null);
                                    } catch(err) { alert('更新失敗'); }
                                  }}
                                >
                                  {['Not Start', 'Ready', 'In Progress', 'Stuck', 'Review', 'Completed', 'Closed', 'Backlog'].map(s => <option key={s} value={s}>{s}</option>)}
                                </ThemedSelect>
                              ) : (
                                <span style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setInlineEditingTraceStatusFor(String(t.id)); }}>
                                  {getItemStatusBadge(t.item_status || 'Not Start')}
                                </span>
                              );
                            }
                          },
                          {
                            id: 'item_priority',
                            header: '優先級',
                            accessor: 'item_priority' as const,
                            cell: (t: any) => {
                              return inlineEditingPriorityFor === String(t.id) ? (
                                <ThemedSelect 
                                  autoFocus
                                  defaultValue={t.item_priority || 'Middle'}
                                  style={{ fontSize: '11px', padding: '2px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: 'none', outline: 'none', borderRadius: '4px' }}
                                  onBlur={() => setInlineEditingPriorityFor(null)}
                                  onChange={async (e) => {
                                    try {
                                      await api.updateTask(t.id, { ...t, item_priority: e.target.value });
                                      if (onRefreshData) await onRefreshData();
                                      setInlineEditingPriorityFor(null);
                                    } catch(err) { alert('更新失敗'); }
                                  }}
                                >
                                  {['High', 'Middle', 'Low'].map(s => <option key={s} value={s}>{s}</option>)}
                                </ThemedSelect>
                              ) : (
                                <span 
                                  className={
                                    t.item_priority === 'High' ? 'priority-high' :
                                    t.item_priority === 'Low' ? 'priority-low' : 'priority-middle'
                                  }
                                  style={{ cursor: 'pointer' }}
                                  onClick={(e) => { e.stopPropagation(); setInlineEditingPriorityFor(String(t.id)); }}
                                >{t.item_priority}</span>
                              );
                            }
                          },
                        {
                          id: 'item_planned_end_date',
                          header: '截止日期',
                          accessor: 'item_planned_end_date' as const,
                          cell: (t: any) => formatChineseDate(t.item_planned_end_date)
                        },
                        {
                          id: 'item_follow_by',
                          header: '負責人',
                          accessor: 'item_follow_by' as const,
                          cell: (t: any) => members.find(mem => String(mem.member_id) === String(t.item_follow_by))?.member_name || t.item_follow_by || 'Edmond Chan'
                        }
                      ];

                      if (projectDrawerActiveTab === 'Charter') {
                        // Insert content column after title (index 2)
                        taskColumns.splice(2, 0, {
                          id: 'item_content',
                          header: '內容 (Content)',
                          accessor: 'item_content' as const,
                          cell: (t: any) => {
                            let textStr = '';
                            try {
                              let parsed = t.item_content?.description;
                              if (typeof parsed === 'string') {
                                try {
                                  parsed = JSON.parse(parsed);
                                } catch (e) {
                                  // Not JSON, just use the string
                                  textStr = parsed;
                                }
                              }
                              
                              if (Array.isArray(parsed) || typeof parsed === 'object') {
                                const extract = (nodes: any[]) => {
                                  for (const node of nodes) {
                                    if (node && typeof node.text === 'string') textStr += node.text;
                                    if (node && node.content && Array.isArray(node.content)) extract(node.content);
                                    if (node && node.children && Array.isArray(node.children)) extract(node.children);
                                  }
                                };
                                if (Array.isArray(parsed)) extract(parsed);
                                else if (parsed && typeof parsed === 'object') extract([parsed]);
                              } else if (!textStr && typeof parsed === 'string') {
                                textStr = parsed;
                              }
                            } catch(e) {
                              textStr = '';
                            }
                            
                            textStr = String(textStr || '');
                            
                            if (inlineEditingContentFor === String(t.id)) {
                              return (
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  <input
                                    autoFocus
                                    value={inlineEditingContentValue}
                                    onChange={e => setInlineEditingContentValue(e.target.value)}
                                    onBlur={() => setInlineEditingContentFor(null)}
                                    onKeyDown={async (e) => {
                                      if (e.key === 'Enter') {
                                        try {
                                          const newContent = { ...t.item_content, description: inlineEditingContentValue };
                                          await api.updateTask(t.id, { ...t, item_content: newContent, description: inlineEditingContentValue });
                                          if (onRefreshData) await onRefreshData();
                                          setInlineEditingContentFor(null);
                                        } catch(err) { alert('更新失敗'); }
                                      } else if (e.key === 'Escape') {
                                        setInlineEditingContentFor(null);
                                      }
                                    }}
                                    style={{ flex: 1, fontSize: '13px', padding: '2px 4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none', borderRadius: '4px', minWidth: '150px' }}
                                  />
                                  <button style={{ background: 'transparent', border: 'none', color: '#10B981', cursor: 'pointer', padding: '2px' }}
                                    onMouseDown={async (e) => {
                                      e.preventDefault();
                                      try {
                                        const newContent = { ...t.item_content, description: inlineEditingContentValue };
                                        await api.updateTask(t.id, { ...t, item_content: newContent, description: inlineEditingContentValue });
                                        if (onRefreshData) await onRefreshData();
                                        setInlineEditingContentFor(null);
                                      } catch(err) { alert('更新失敗'); }
                                    }}
                                  >✓</button>
                                  <button style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
                                    onMouseDown={(e) => { e.preventDefault(); setInlineEditingContentFor(null); }}
                                  >✕</button>
                                </div>
                              );
                            }
                            
                            let displayText = textStr;
                            if (displayText.length > 80) displayText = displayText.substring(0, 80) + '...';
                            return (
                              <div 
                                style={{ color: 'var(--text-muted)', fontSize: '12px', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'text' }} 
                                title={textStr}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInlineEditingContentFor(String(t.id));
                                  setInlineEditingContentValue(textStr);
                                }}
                              >
                                {displayText || '—'}
                              </div>
                            );
                          }
                        });
                      }

                      let finalTaskColumns: any[] = [
                        ...taskColumns,
                        ...getRemainingProjectItemColumns(members, workspaces, projects, taskColumns.map(c => c.id))
                      ];

                      if (projectDrawerActiveTab === 'Milestones') {
                        const raciMembers: number[] = p.content?.raci_members || [];
                        const raciCols = raciMembers.map(memId => {
                          const mem = members.find(m => String(m.member_id) === String(memId));
                          return {
                            id: `raci_${memId}`,
                            header: (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', minHeight: '160px', justifyContent: 'space-between', paddingTop: '4px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginTop: '0' }}>
                                  <span 
                                    style={{ 
                                      fontSize: '12px', 
                                      color: 'var(--text-muted)',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      writingMode: 'vertical-rl', textOrientation: 'mixed', maxHeight: '120px',
                                      display: 'inline-block'
                                    }}
                                    title={mem?.member_name || 'Unknown'}
                                  >
                                    {mem?.member_name || 'Unknown'}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', paddingBottom: '4px', writingMode: 'horizontal-tb', WebkitWritingMode: 'horizontal-tb', width: '100%' }}>
                                  <select
                                    value=""
                                    onChange={async (e) => {
                                      const val = e.target.value;
                                      if (!val) return;
                                      if (!window.confirm(`確定要將此直欄全部設為 ${val} 嗎？`)) {
                                        e.target.value = "";
                                        return;
                                      }
                                      try {
                                        const tasksToUpdate = currentTasksList.filter(t => t.item_attribute?.raci?.[memId] !== val);
                                        for (const t of tasksToUpdate) {
                                          const newRaci = { ...(t.item_attribute?.raci || {}), [memId]: val };
                                          if (onUpdateTask) await onUpdateTask(t.id, { ...t, item_attribute: { ...t.item_attribute, raci: newRaci } }, true);
                                        }
                                      } catch(err) { alert('批量更新失敗'); }
                                      e.target.value = "";
                                    }}
                                    style={{
                                      background: 'rgba(255,255,255,0.05)',
                                      color: 'var(--text-muted)',
                                      border: '1px solid rgba(255,255,255,0.1)',
                                      outline: 'none',
                                      fontSize: '12px',
                                      borderRadius: '4px',
                                      padding: '0',
                                      cursor: 'pointer',
                                      width: '24px',
                                      height: '22px',
                                      textAlign: 'center',
                                      appearance: 'none',
                                      WebkitAppearance: 'none',
                                      writingMode: 'horizontal-tb',
                                      WebkitWritingMode: 'horizontal-tb'
                                    }}
                                    title="批量設定 (Batch Set)"
                                  >
                                    <option style={{writingMode: 'horizontal-tb'}} value="" disabled hidden>⇅</option>
                                    <option style={{writingMode: 'horizontal-tb'}} value="R">全設 R</option>
                                    <option style={{writingMode: 'horizontal-tb'}} value="A">全設 A</option>
                                    <option style={{writingMode: 'horizontal-tb'}} value="C">全設 C</option>
                                    <option style={{writingMode: 'horizontal-tb'}} value="I">全設 I</option>
                                  </select>
                                  <button 
                                    onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const newMembers = raciMembers.filter(id => Number(id) !== Number(memId));
                                    try {
                                      if (onUpdateProject) await onUpdateProject(p.id, { ...p, content: { ...p.content, raci_members: newMembers } });
                                      const tasksToUpdate = currentTasksList.filter(t => t.item_attribute?.raci?.[memId] !== undefined);
                                      for (const t of tasksToUpdate) {
                                        const newRaci = { ...t.item_attribute?.raci };
                                        delete newRaci[memId];
                                        if (onUpdateTask) await onUpdateTask(t.id, { ...t, item_attribute: { ...t.item_attribute, raci: newRaci } }, true);
                                      }
                                      if (tasksToUpdate.length > 0 && onRefreshData) {
                                        await onRefreshData();
                                      }
                                    } catch(err: any) { alert('移除失敗: ' + err.message); }
                                  }}
                                  style={{ background: 'transparent', border: 'none', color: '#EF4444', fontSize: '10px', cursor: 'pointer', padding: '0', margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '22px', writingMode: 'horizontal-tb', WebkitWritingMode: 'horizontal-tb' }}
                                  title="移除 RACI 成員"
                                >
                                  ✕
                                </button>
                                </div>
                              </div>
                            ),
                            width: 60,
                            cell: (t: any) => {
                              const currentRaci = t.item_attribute?.raci?.[memId] || '';
                              return (
                                <select 
                                  value={currentRaci}
                                  onChange={async (e) => {
                                    const val = e.target.value;
                                    const newRaci = { ...(t.item_attribute?.raci || {}), [memId]: val };
                                    try {
                                      if (onUpdateTask) await onUpdateTask(t.id, { ...t, item_attribute: { ...t.item_attribute, raci: newRaci } }, true);
                                    } catch(err) { alert('更新失敗'); }
                                  }}
                                  style={{ 
                                    background: 'transparent', color: 'white', border: 'none', outline: 'none', 
                                    fontSize: '14px', width: '28px', height: '28px', padding: 0, margin: 'auto', display: 'block', textAlign: 'center', textAlignLast: 'center', cursor: 'pointer', borderRadius: '4px',
                                    fontWeight: currentRaci ? 'bold' : 'normal',
                                    appearance: 'none', WebkitAppearance: 'none',
                                    backgroundColor: currentRaci === 'R' ? 'rgba(59, 130, 246, 0.2)' : 
                                                     currentRaci === 'A' ? 'rgba(239, 68, 68, 0.2)' :
                                                     currentRaci === 'C' ? 'rgba(16, 185, 129, 0.2)' :
                                                     currentRaci === 'I' ? 'rgba(245, 158, 11, 0.2)' : 'transparent'
                                  }}
                                  title="點擊以修改 RACI"
                                >
                                  <option value="" style={{ color: 'black' }}></option>
                                  <option value="R" style={{ color: 'black' }}>R</option>
                                  <option value="A" style={{ color: 'black' }}>A</option>
                                  <option value="C" style={{ color: 'black' }}>C</option>
                                  <option value="I" style={{ color: 'black' }}>I</option>
                                </select>
                              );
                            }
                          };
                        });
                        
                        finalTaskColumns = [...raciCols, ...finalTaskColumns];
                      }



                      const emptyState = (
                        currentTasksList.length === 0 && projectDrawerActiveTab === 'Milestones' ? (
                          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            暫無資料
                          </div>
                        ) : undefined
                      );

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {projectDrawerActiveTab === 'Milestones' && (
                            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '8px' }}>
                              <ThemedSelect 
                                placeholder="+ 新增 RACI 成員"
                                onChange={async (e) => {
                                  const memId = parseInt(e.target.value);
                                  if (!memId) return;
                                  const currentRaci = p.content?.raci_members || [];
                                  if (!currentRaci.includes(memId)) {
                                    try {
                                      if (onUpdateProject) await onUpdateProject(p.id, { ...p, content: { ...p.content, raci_members: [...currentRaci, memId] } });
                                    } catch(err) { alert('新增失敗'); }
                                  }
                                  e.target.value = "";
                                }}
                                style={{ width: '240px', background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer', outline: 'none' }}
                              >
                                {members.filter(m => !(p.content?.raci_members || []).includes(Number(m.member_id))).map(m => (
                                  <option key={m.member_id} value={m.member_id}>{m.member_name}</option>
                                ))}
                              </ThemedSelect>
                            </div>
                          )}
                          <AdvancedTable
                            tableId={`project_tasks_${p.id}_${projectDrawerActiveTab}`}
                            selectable={true}
                            selectedRowIds={selectedTaskIds}
                            onSelectionChange={setSelectedTaskIds}
                            rowIdAccessor="id"
                            data={currentTasksList}
                            columns={finalTaskColumns}
                            sortConfig={tableSortConfig}
                            onSort={handleSort}
                            emptyState={emptyState}
                          />
                          {inlineCreateBlock}
                        </div>
                      );
                    })()}

                    {['Tasks', 'Meetings', 'Bottlenecks', 'Knowledge'].includes(projectDrawerActiveTab) && (() => {
                      const listToUse = projectDrawerActiveTab === 'Tasks' ? projTasks :
                                        projectDrawerActiveTab === 'Meetings' ? projMeetings :
                                        projectDrawerActiveTab === 'Bottlenecks' ? projBottlenecks :
                                        projKnowledge;

                      const filteredTasks = listToUse; // Alias for the copied logic

            // Build hierarchy
            const taskMap = new Map<string, any>();
            filteredTasks.forEach(t => taskMap.set(String(t.id), t));
            
            const rootTasks: any[] = [];
            const childTasksMap = new Map<string, any[]>();
            
            filteredTasks.forEach(t => {
              const pid = t.parent_item_id;
              const hasValidParent = pid && taskMap.has(String(pid));
              if (!hasValidParent) {
                rootTasks.push(t);
              } else {
                const pidStr = String(pid);
                if (!childTasksMap.has(pidStr)) childTasksMap.set(pidStr, []);
                childTasksMap.get(pidStr)!.push(t);
              }
            });

            const flattenTree = (tasks: any[], depth: number, visited: Set<string>): any[] => {
              let result: any[] = [];
              tasks.forEach(t => {
                const idStr = String(t.id);
                if (visited.has(idStr)) return; // Prevent infinite loops
                visited.add(idStr);
                
                const children = childTasksMap.get(idStr) || [];
                const hasChildren = children.length > 0;
                result.push({ ...t, _depth: depth, _hasChildren: hasChildren });
                
                if (expandedTaskIds.has(idStr) && hasChildren) {
                  result = result.concat(flattenTree(children, depth + 1, new Set(visited)));
                }
              });
              return result;
            };

            const hierarchicalTasks = flattenTree(rootTasks, 0, new Set());

            const taskColumns = [
              {
                id: 'id',
                header: 'ID',
                cell: (t: any) => <span style={{ fontWeight: 'bold' }}>{t.id}</span>
              },
              {
                id: 'item_display_id',
                header: '代號 (Display ID)',
                cell: (t: any) => (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: `${(t._depth || 0) * 20}px` }}>
                    {t._hasChildren ? (
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          const newSet = new Set(expandedTaskIds);
                          const idStr = String(t.id);
                          if (newSet.has(idStr)) newSet.delete(idStr);
                          else newSet.add(idStr);
                          setExpandedTaskIds(newSet);
                        }}
                        style={{ cursor: 'pointer', width: '16px', display: 'inline-block', textAlign: 'center', userSelect: 'none', color: 'var(--text-secondary)' }}
                      >
                        {expandedTaskIds.has(String(t.id)) ? '▼' : '▶'}
                      </span>
                    ) : (
                      <span style={{ width: '16px', display: 'inline-block' }}></span>
                    )}
                    <span 
                      onClick={() => setSelectedModalTaskId(t.id)}
                      style={{ fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--accent-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', textDecoration: 'underline' }} 
                      title={t.item_type || 'Task'}
                    >
                      <span>{getItemTypeStyles(t.item_type || 'Task').icon}</span> {t.item_display_id}
                    </span>
                  </span>
                )
              },
              {
                id: 'item_title',
                header: '任務標題 (Title)',
                cell: (t: any) => {
                  return inlineEditingTraceTitleFor === String(t.id) ? (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <input
                        autoFocus
                        value={inlineEditingTraceTitleValue}
                        onChange={e => setInlineEditingTraceTitleValue(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            try {
                              await api.updateTask(t.id, { ...t, item_title: inlineEditingTraceTitleValue });
                              if (onRefreshData) await onRefreshData();
                              setInlineEditingTraceTitleFor(null);
                            } catch(err) { alert('更新失敗'); }
                          } else if (e.key === 'Escape') {
                            setInlineEditingTraceTitleFor(null);
                          }
                        }}
                        style={{ flex: 1, fontSize: '13px', padding: '2px 4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none', borderRadius: '4px', minWidth: '150px' }}
                      />
                      <button style={{ background: 'transparent', border: 'none', color: '#10B981', cursor: 'pointer', padding: '2px' }}
                        onMouseDown={async (e) => {
                          e.preventDefault();
                          try {
                            await api.updateTask(t.id, { ...t, item_title: inlineEditingTraceTitleValue });
                            if (onRefreshData) await onRefreshData();
                            setInlineEditingTraceTitleFor(null);
                          } catch(err) { alert('更新失敗'); }
                        }}
                      >✓</button>
                      <button style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
                        onMouseDown={(e) => { e.preventDefault(); setInlineEditingTraceTitleFor(null); }}
                      >✕</button>
                    </div>
                  ) : (
                    <span 
                      style={{ fontWeight: 'bold', cursor: 'text' }}
                      onClick={() => {
                        setInlineEditingTraceTitleFor(String(t.id));
                        setInlineEditingTraceTitleValue(t.item_title || t.title || '');
                      }}
                    >📄 {t.item_title}</span>
                  );
                }
              },
              {
                id: 'related_context_id',
                header: '關聯專案 (Context ID)',
                cell: (t: any) => (
                  <span className="relation-badge relation-badge-project">
                    {projects.find(p => String(p.id) === String(t.related_context_id))?.name || t.related_context_id || '—'}
                  </span>
                )
              },
              {
                id: 'item_type',
                header: '性質 (Item Type)',
                cell: (t: any) => {
                  return inlineEditingTypeFor === String(t.id) ? (
                    <ThemedSelect 
                      autoFocus
                      defaultValue={t.item_type || 'Task'}
                      style={{ fontSize: '11px', padding: '2px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: 'none', outline: 'none', borderRadius: '4px' }}
                      onBlur={() => setInlineEditingTypeFor(null)}
                      onChange={async (e) => {
                        try {
                          await api.updateTask(t.id, { ...t, item_type: e.target.value });
                          if (onRefreshData) await onRefreshData();
                          setInlineEditingTypeFor(null);
                        } catch(err) { alert('更新失敗'); }
                      }}
                    >
                      {['Charter', 'Epic', 'Task', 'Event', 'Micro Task', 'Meeting', 'Bottleneck', 'Knowledge', 'Casual Note', 'Bug', 'UAT', 'Deployment', 'Milestone', 'Business Objective', 'Business Requirement', 'User Story'].map(s => <option key={s} value={s}>{s}</option>)}
                    </ThemedSelect>
                  ) : (
                    <span 
                      className="nature-tag" 
                      style={{ backgroundColor: `${getItemTypeStyles(t.item_type || 'Task').bg}20`, color: getItemTypeStyles(t.item_type || 'Task').text, padding: '2px 6px', borderRadius: '4px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); setInlineEditingTypeFor(String(t.id)); }}
                    >
                      <span>{getItemTypeStyles(t.item_type || 'Task').icon}</span> {t.item_type}
                    </span>
                  );
                }
              },
              {
                id: 'item_status',
                header: '狀態 (Item Status)',
                cell: (t: any) => {
                  return inlineEditingTraceStatusFor === String(t.id) ? (
                    <ThemedSelect 
                      autoFocus
                      defaultValue={t.item_status || 'Not Start'}
                      style={{ fontSize: '11px', padding: '2px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: 'none', outline: 'none', borderRadius: '4px' }}
                      onBlur={() => setInlineEditingTraceStatusFor(null)}
                      onChange={async (e) => {
                        try {
                          await api.updateTask(t.id, { ...t, item_status: e.target.value });
                          if (onRefreshData) await onRefreshData();
                          setInlineEditingTraceStatusFor(null);
                        } catch(err) { alert('更新失敗'); }
                      }}
                    >
                      {['Not Start', 'Ready', 'In Progress', 'Stuck', 'Review', 'Completed', 'Closed', 'Backlog'].map(s => <option key={s} value={s}>{s}</option>)}
                    </ThemedSelect>
                  ) : (
                    <span style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setInlineEditingTraceStatusFor(String(t.id)); }}>
                      {getItemStatusBadge(t.item_status || 'Not Start')}
                    </span>
                  );
                }
              },
              {
                id: 'item_priority',
                header: '優先級 (Item Priority)',
                cell: (t: any) => {
                  return inlineEditingPriorityFor === String(t.id) ? (
                    <ThemedSelect 
                      autoFocus
                      defaultValue={t.item_priority || 'Middle'}
                      style={{ fontSize: '11px', padding: '2px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: 'none', outline: 'none', borderRadius: '4px' }}
                      onBlur={() => setInlineEditingPriorityFor(null)}
                      onChange={async (e) => {
                        try {
                          await api.updateTask(t.id, { ...t, item_priority: e.target.value });
                          if (onRefreshData) await onRefreshData();
                          setInlineEditingPriorityFor(null);
                        } catch(err) { alert('更新失敗'); }
                      }}
                    >
                      {['High', 'Middle', 'Low'].map(s => <option key={s} value={s}>{s}</option>)}
                    </ThemedSelect>
                  ) : (
                    <span 
                      className={
                        t.item_priority === 'High' ? 'priority-high' :
                        t.item_priority === 'Low' ? 'priority-low' : 'priority-middle'
                      }
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); setInlineEditingPriorityFor(String(t.id)); }}
                    >{t.item_priority}</span>
                  );
                }
              },
              {
                id: 'item_planned_start_date',
                header: '預計開始 (Planned Start)',
                cell: (t: any) => {
                  return inlineEditingPlannedStartFor === String(t.id) ? (
                    <input 
                      type="date"
                      autoFocus
                      value={t.item_planned_start_date ? t.item_planned_start_date.split('T')[0] : ''}
                      onBlur={() => setInlineEditingPlannedStartFor(null)}
                      onChange={async (e) => {
                        try {
                          await api.updateTask(t.id, { ...t, item_planned_start_date: e.target.value || null });
                          if (onRefreshData) await onRefreshData();
                          setInlineEditingPlannedStartFor(null);
                        } catch(err) { alert('更新失敗'); }
                      }}
                      style={{ fontSize: '11px', padding: '2px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: 'none', outline: 'none', borderRadius: '4px' }}
                    />
                  ) : (
                    <span style={{ cursor: 'pointer', display: 'inline-block', minHeight: '18px', minWidth: '40px' }} onClick={(e) => { e.stopPropagation(); setInlineEditingPlannedStartFor(String(t.id)); }}>
                      {formatChineseDate(t.item_planned_start_date) || '—'}
                    </span>
                  );
                }
              },
              {
                id: 'item_planned_end_date',
                header: '預計結束 (Planned End)',
                cell: (t: any) => {
                  return inlineEditingPlannedEndFor === String(t.id) ? (
                    <input 
                      type="date"
                      autoFocus
                      value={t.item_planned_end_date ? t.item_planned_end_date.split('T')[0] : ''}
                      onBlur={() => setInlineEditingPlannedEndFor(null)}
                      onChange={async (e) => {
                        try {
                          await api.updateTask(t.id, { ...t, item_planned_end_date: e.target.value || null });
                          if (onRefreshData) await onRefreshData();
                          setInlineEditingPlannedEndFor(null);
                        } catch(err) { alert('更新失敗'); }
                      }}
                      style={{ fontSize: '11px', padding: '2px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: 'none', outline: 'none', borderRadius: '4px' }}
                    />
                  ) : (
                    <span style={{ cursor: 'pointer', display: 'inline-block', minHeight: '18px', minWidth: '40px' }} onClick={(e) => { e.stopPropagation(); setInlineEditingPlannedEndFor(String(t.id)); }}>
                      {formatChineseDate(t.item_planned_end_date) || '—'}
                    </span>
                  );
                }
              },
              {
                id: 'item_actual_start_date',
                header: '實際開始 (Actual Start)',
                cell: (t: any) => {
                  return inlineEditingActualStartFor === String(t.id) ? (
                    <input 
                      type="date"
                      autoFocus
                      value={t.item_actual_start_date ? t.item_actual_start_date.split('T')[0] : ''}
                      onBlur={() => setInlineEditingActualStartFor(null)}
                      onChange={async (e) => {
                        try {
                          await api.updateTask(t.id, { ...t, item_actual_start_date: e.target.value || null });
                          if (onRefreshData) await onRefreshData();
                          setInlineEditingActualStartFor(null);
                        } catch(err) { alert('更新失敗'); }
                      }}
                      style={{ fontSize: '11px', padding: '2px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: 'none', outline: 'none', borderRadius: '4px' }}
                    />
                  ) : (
                    <span style={{ cursor: 'pointer', display: 'inline-block', minHeight: '18px', minWidth: '40px' }} onClick={(e) => { e.stopPropagation(); setInlineEditingActualStartFor(String(t.id)); }}>
                      {formatChineseDate(t.item_actual_start_date) || '—'}
                    </span>
                  );
                }
              },
              {
                id: 'item_actual_end_date',
                header: '實際結束 (Actual End)',
                cell: (t: any) => {
                  return inlineEditingActualEndFor === String(t.id) ? (
                    <input 
                      type="date"
                      autoFocus
                      value={t.item_actual_end_date ? t.item_actual_end_date.split('T')[0] : ''}
                      onBlur={() => setInlineEditingActualEndFor(null)}
                      onChange={async (e) => {
                        try {
                          await api.updateTask(t.id, { ...t, item_actual_end_date: e.target.value || null });
                          if (onRefreshData) await onRefreshData();
                          setInlineEditingActualEndFor(null);
                        } catch(err) { alert('更新失敗'); }
                      }}
                      style={{ fontSize: '11px', padding: '2px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: 'none', outline: 'none', borderRadius: '4px' }}
                    />
                  ) : (
                    <span style={{ cursor: 'pointer', display: 'inline-block', minHeight: '18px', minWidth: '40px' }} onClick={(e) => { e.stopPropagation(); setInlineEditingActualEndFor(String(t.id)); }}>
                      {formatChineseDate(t.item_actual_end_date) || '—'}
                    </span>
                  );
                }
              },
              {
                id: 'item_follow_by',
                header: '負責人 (Follow By)',
                cell: (t: any) => {
                  return inlineEditingFollowByFor === String(t.id) ? (
                    <div style={{ minWidth: '150px' }} onClick={(e) => e.stopPropagation()}>
                      <CreatableSelect
                        autoFocus
                        menuPortalTarget={document.body}
                        styles={{
                          ...reactSelectStyles,
                          menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
                          control: (base: any) => ({ ...base, minHeight: '28px', height: '28px', fontSize: '11px', backgroundColor: 'rgba(255,255,255,0.1)', border: 'none' }),
                          dropdownIndicator: (base: any) => ({ ...base, padding: '2px' }),
                          clearIndicator: (base: any) => ({ ...base, padding: '2px' }),
                          valueContainer: (base: any) => ({ ...base, padding: '0 4px' })
                        }}
                        value={t.item_follow_by ? { value: String(t.item_follow_by), label: members.find(m => String(m.member_id) === String(t.item_follow_by))?.member_name || t.item_follow_by } : null}
                        onChange={async (selected: any) => {
                          try {
                            const followByVal = selected && selected.value ? parseInt(selected.value, 10) : null;
                            await api.updateTask(t.id, { ...t, item_follow_by: followByVal });
                            if (onRefreshData) await onRefreshData();
                            setInlineEditingFollowByFor(null);
                          } catch(err) { alert('更新失敗'); }
                        }}
                        onCreateOption={async (inputValue: string) => {
                          const trimmed = inputValue.trim();
                          if (!trimmed) return;
                          try {
                            const newMem = await api.createMember({ member_name: trimmed, member_email: null, member_role: 'Developer', member_status: 'Active' });
                            await api.updateTask(t.id, { ...t, item_follow_by: newMem.member_id });
                            if (onRefreshData) await onRefreshData();
                            setInlineEditingFollowByFor(null);
                          } catch (err: any) { alert('新增成員失敗: ' + (err.message || String(err))); }
                        }}
                        options={members.map(m => ({ value: String(m.member_id), label: m.member_name }))}
                        placeholder="選擇..."
                        isClearable
                        onBlur={() => setInlineEditingFollowByFor(null)}
                      />
                    </div>
                  ) : (
                    <span style={{ cursor: 'pointer', display: 'inline-block', minHeight: '18px', minWidth: '40px' }} onClick={(e) => { e.stopPropagation(); setInlineEditingFollowByFor(String(t.id)); }}>
                      {members.find(mem => String(mem.member_id) === String(t.item_follow_by))?.member_name || t.item_follow_by || '—'}
                    </span>
                  );
                }
              },
              {
                id: 'item_assigned_by',
                header: '指派者 (Assigner)',
                cell: (t: any) => {
                  return inlineEditingAssignedByFor === String(t.id) ? (
                    <div style={{ minWidth: '150px' }} onClick={(e) => e.stopPropagation()}>
                      <CreatableSelect
                        autoFocus
                        menuPortalTarget={document.body}
                        styles={{
                          ...reactSelectStyles,
                          menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
                          control: (base: any) => ({ ...base, minHeight: '28px', height: '28px', fontSize: '11px', backgroundColor: 'rgba(255,255,255,0.1)', border: 'none' }),
                          dropdownIndicator: (base: any) => ({ ...base, padding: '2px' }),
                          clearIndicator: (base: any) => ({ ...base, padding: '2px' }),
                          valueContainer: (base: any) => ({ ...base, padding: '0 4px' })
                        }}
                        value={t.item_assigned_by ? { value: String(t.item_assigned_by), label: members.find(m => String(m.member_id) === String(t.item_assigned_by))?.member_name || t.item_assigned_by } : null}
                        onChange={async (selected: any) => {
                          try {
                            const assignedByVal = selected && selected.value ? parseInt(selected.value, 10) : null;
                            await api.updateTask(t.id, { ...t, item_assigned_by: assignedByVal });
                            if (onRefreshData) await onRefreshData();
                            setInlineEditingAssignedByFor(null);
                          } catch(err) { alert('更新失敗'); }
                        }}
                        onCreateOption={async (inputValue: string) => {
                          const trimmed = inputValue.trim();
                          if (!trimmed) return;
                          try {
                            const newMem = await api.createMember({ member_name: trimmed, member_email: null, member_role: 'Developer', member_status: 'Active' });
                            await api.updateTask(t.id, { ...t, item_assigned_by: newMem.member_id });
                            if (onRefreshData) await onRefreshData();
                            setInlineEditingAssignedByFor(null);
                          } catch (err: any) { alert('新增成員失敗: ' + (err.message || String(err))); }
                        }}
                        options={members.map(m => ({ value: String(m.member_id), label: m.member_name }))}
                        placeholder="選擇..."
                        isClearable
                        onBlur={() => setInlineEditingAssignedByFor(null)}
                      />
                    </div>
                  ) : (
                    <span style={{ cursor: 'pointer', display: 'inline-block', minHeight: '18px', minWidth: '40px' }} onClick={(e) => { e.stopPropagation(); setInlineEditingAssignedByFor(String(t.id)); }}>
                      {members.find(mem => String(mem.member_id) === String(t.item_assigned_by))?.member_name || t.item_assigned_by || '—'}
                    </span>
                  );
                }
              },
              {
                id: 'item_content',
                header: '詳細內容 (Content JSON)',
                cell: (t: any) => (
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {JSON.stringify(t.item_content)}
                  </span>
                )
              },
              {
                id: 'parent_item_id',
                header: '父工單 (Parent Item ID)',
                cell: (t: any) => (
                  <span>{t.parent_item_id || ''}</span>
                )
              },
              {
                id: 'related_item_id_relation',
                header: '關聯工單 (Related Items)',
                cell: (t: any) => (
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {JSON.stringify(t.related_item_id_relation || [])}
                  </span>
                )
              },
              {
                id: 'item_comment',
                header: '工單評論 (Comments JSON)',
                cell: (t: any) => (
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {JSON.stringify(t.item_comment || [])}
                  </span>
                )
              },
              {
                id: 'item_update_log',
                header: '變更日誌 (Update Log JSON)',
                cell: (t: any) => (
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {JSON.stringify(t.item_update_log || [])}
                  </span>
                )
              },
              {
                id: 'item_created_at',
                header: '創建時間 (Created At)',
                cell: (t: any) => formatChineseDateTime(t.item_created_at)
              },
              {
                id: 'item_updated_at',
                header: '更新時間 (Updated At)',
                cell: (t: any) => formatChineseDateTime(t.item_updated_at)
              },
              ...getRemainingProjectItemColumns(members, workspaces, projects, ['id', 'item_display_id', 'item_title', 'related_context_id', 'parent_item_id', 'related_item_id_relation', 'item_type', 'item_status', 'item_priority', 'item_planned_start_date', 'item_planned_end_date', 'item_actual_start_date', 'item_actual_end_date', 'item_follow_by', 'item_assigned_by', 'item_content', 'item_comment', 'item_update_log', 'item_created_at', 'item_updated_at'])
            ];


                      return (
                        <div style={{ marginTop: '16px', overflowX: 'auto', paddingBottom: '12px' }}>
                          <TableViewToolbar data={hierarchicalTasks} columns={taskColumns} state={toolbarState} onChange={setToolbarState} />
                          <AdvancedTable
                            tableId={`project_drawer_${projectDrawerActiveTab}_table`}
                            selectable={true}
                            selectedRowIds={selectedTaskIds}
                            onSelectionChange={setSelectedTaskIds}
                            rowIdAccessor="id"
                            data={applyToolbar(hierarchicalTasks, taskColumns)}
                            columns={getVisibleColumns(taskColumns)}
                            onSort={() => {}} // Disable sorting to maintain hierarchy
                            sortConfig={null}
                          />
                          {inlineCreateBlock}
                        </div>
                      );
                    })()}

                  </div>
                </div>

                {/* Remarks History */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  <strong style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Remarks 歷史軌跡 ({remarks.length})</strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', paddingRight: '4px' }}>
                    {remarks.length === 0 ? (
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>尚無變更備註</span>
                    ) : (
                      remarks.map((r, i) => (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '10px 14px', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--accent-secondary)', fontWeight: 'bold' }}>{r.user}</span>
                            <span>{formatChineseDateTime(r.timestamp)}</span>
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{r.text}</div>
                        </div>
                      ))
                    )}
                  </div>
                  {isEditing && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>新增備註 (Append Remark)</span>
                      <input type="text" placeholder="輸入此次變更的備註說明..." value={remarkInput} onChange={e => setRemarkInput(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }} />
                    </div>
                  )}
                </div>
              </div>

              {/* Right Panel */}
              <div style={{ flex: '0 0 320px', padding: '24px', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '16px' }}>
                    {isEditing ? (
                      <>
                        <button onClick={() => { setIsEditing(false); setRemarkInput(''); }} style={{ ...styles.cancelBtn, padding: '6px 12px', fontSize: '13px' }}>取消</button>
                        <button onClick={handleModalProjectSave} disabled={isSaving} style={{ ...styles.saveBtn, padding: '6px 12px', fontSize: '13px' }}>{isSaving ? '儲存中...' : '儲存變更'}</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleDelete(p.id)} style={{ ...styles.cancelBtn, color: '#ef4444', padding: '6px 12px', fontSize: '13px' }}>🗑️ 刪除專案</button>
                        <button onClick={() => setIsEditing(true)} style={{ ...styles.editBtn, padding: '6px 12px', fontSize: '13px' }}>✏️ 編輯專案</button>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', rowGap: '16px', columnGap: '8px', fontSize: '13px' }}>
                    <div style={{ color: 'var(--text-muted)' }}>專案狀態</div>
                    <div>
                      {isEditing ? (
                        <ThemedSelect value={editStatus} onChange={e => setEditStatus(e.target.value)} style={{ ...styles.selectInput, width: '100%' }}>
                          <option value="Pipeline">Pipeline</option>
                          <option value="Active">Active</option>
                          <option value="On Hold">On Hold</option>
                          <option value="Completed">Completed</option>
                          <option value="Abandoned">Abandoned</option>
                        </ThemedSelect>
                      ) : (
                        <span className={getProjectStatusClass(p.content_status)}>● {p.content_status}</span>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>專案性質</div>
                    <div>
                      {isEditing ? (
                        <ThemedSelect value={editProjectType} onChange={e => setEditProjectType(e.target.value)} style={{ ...styles.selectInput, width: '100%' }}>
                          <option value="Null">Null</option>
                          <option value="Phase">Phase</option>
                          <option value="BAU">BAU</option>
                        </ThemedSelect>
                      ) : (
                        <span className="relation-badge">{p.project_type || 'Null'}</span>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>階段序號</div>
                    <div>
                      {isEditing ? (
                        <input type="number" value={editProjectSeq} onChange={e => setEditProjectSeq(Number(e.target.value))} style={{ ...styles.textInput, width: '100%' }} />
                      ) : (
                        <strong>{p.project_type_sequence ?? '—'}</strong>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>工作空間</div>
                    <div>
                      {isEditing ? (
                        <Select
                          styles={reactSelectStyles}
                          value={workspaces.find(w => w.workspace_id === editWorkspaceId) ? { value: editWorkspaceId, label: workspaces.find(w => w.workspace_id === editWorkspaceId)?.workspace_name } : null}
                          onChange={(selected: any) => setEditWorkspaceId(selected ? Number(selected.value) : 0)}
                          options={workspaces.map(w => ({ value: w.workspace_id, label: w.workspace_name }))}
                          placeholder="選擇工作空間"
                        />
                      ) : (
                        <strong>🏢 {workspaceName}</strong>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>父級產品</div>
                    <div>
                      {isEditing ? (
                        <Select
                          styles={reactSelectStyles}
                          value={products.find(prod => String(prod.id) === String(editParentId)) ? { value: editParentId, label: products.find(prod => String(prod.id) === String(editParentId))?.name || products.find(prod => String(prod.id) === String(editParentId))?.content_name } : null}
                          onChange={(selected: any) => setEditParentId(selected ? selected.value : '')}
                          options={[
                            { value: '', label: '-- 未指定 --' },
                            ...products.map(prod => ({ value: String(prod.id), label: prod.name || prod.content_name || '' }))
                          ]}
                          placeholder="-- 未指定 --"
                          isClearable
                        />
                      ) : (
                        <strong>📦 {parentProjName}</strong>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>計劃開始</div>
                    <div>
                      {isEditing ? (
                        <input type="date" value={editPlannedStart} onChange={e => setEditPlannedStart(e.target.value)} style={{ ...styles.textInput, width: '100%' }} />
                      ) : (
                        <strong>{formatChineseDate(p.planned_start_date)}</strong>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>計劃結束</div>
                    <div>
                      {isEditing ? (
                        <input type="date" value={editPlannedEnd} onChange={e => setEditPlannedEnd(e.target.value)} style={{ ...styles.textInput, width: '100%' }} />
                      ) : (
                        <strong>{formatChineseDate(p.planned_end_date)}</strong>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>實際開始</div>
                    <div>
                      {isEditing ? (
                        <input type="date" value={editActualStart} onChange={e => setEditActualStart(e.target.value)} style={{ ...styles.textInput, width: '100%' }} />
                      ) : (
                        <strong>{formatChineseDate(p.actual_start_date)}</strong>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>實際結束</div>
                    <div>
                      {isEditing ? (
                        <input type="date" value={editActualEnd} onChange={e => setEditActualEnd(e.target.value)} style={{ ...styles.textInput, width: '100%' }} />
                      ) : (
                        <strong>{formatChineseDate(p.actual_end_date)}</strong>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderProductModal = () => {
    if (!selectedModalProductId) return null;
    const p = products.find(x => String(x.id) === String(selectedModalProductId));
    if (!p) return null;

    const remarks = p.remarks || [];
    const workspaceName = workspaces.find(w => w.workspace_id === p.related_workspace_id)?.workspace_name || '—';

    return (
      <>
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0.5; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
          }
          @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
          }
        `}</style>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'flex-end', zIndex: 2009, pointerEvents: isProductDrawerClosing ? 'none' : 'auto' }}>
          <div onClick={closeProductDrawer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', animation: isProductDrawerClosing ? 'fadeOut 0.2s ease-out forwards' : 'fadeIn 0.2s ease-out' }} />
          <div style={{ position: 'relative', width: 'calc(100vw - 260px)', maxWidth: 'none', height: '100vh', backgroundColor: '#0A0F1D', borderLeft: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '-24px 0 48px rgba(0, 0, 0, 0.8)', zIndex: 2010, display: 'flex', flexDirection: 'column', overflow: 'hidden', color: 'var(--text-primary)', animation: isProductDrawerClosing ? 'slideOutRight 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.01)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button 
                  onClick={closeProductDrawer}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '14px', cursor: 'pointer', padding: '6px 12px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.05)', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                  返回產品分頁
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-muted)', marginLeft: '8px', paddingLeft: '24px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                  <span>📦</span>
                  <strong>{p?.context_display_code || p?.content_display_id || (p ? `PRODUCT-${p.id}` : '')}</strong>
                </div>
              </div>
              <button onClick={closeProductDrawer} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '24px', cursor: 'pointer', lineHeight: 1, padding: '4px', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>&times;</button>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px', borderRight: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div>
                  {isEditing ? (
                    <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ width: '100%', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '20px', fontWeight: 'bold', padding: '8px 12px', borderRadius: '8px', outline: 'none' }} />
                  ) : (
                    <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold' }}>{p.content_name}</h2>
                  )}
                </div>

                {/* Product Vision */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <strong style={{ fontSize: '13px', color: 'var(--text-muted)' }}>產品願景 (Product Vision)</strong>
                  {isEditing ? (
                    <textarea value={productVision} onChange={e => setProductVision(e.target.value)} style={{ width: '100%', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.6', height: '180px', resize: 'vertical', outline: 'none' }} />
                  ) : (
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '16px', borderRadius: '8px', fontSize: '13px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                      {p.product_vision || '尚未設定產品願景。'}
                    </div>
                  )}
                </div>

                {/* Related Projects Table */}
                {!isEditing && (
                  <div>
                    <strong style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                      📁 關聯專案 ({projects.filter(proj => String(proj.parent_content_id) === String(p.id)).length})
                    </strong>
                    {projects.filter(proj => String(proj.parent_content_id) === String(p.id)).length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '10px', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                        本產品目前無關聯專案
                      </div>
                    ) : (
                      <div style={styles.tableWrapper}>
                      {(() => {
                        const relatedProjColumns = [
                          {
                            id: 'content_display_id',
                            header: '專案代號',
                            cell: (proj: any) => <span style={{ fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--accent-secondary)' }}>{proj.content_display_id}</span>
                          },
                          {
                            id: 'content_name',
                            header: '專案名稱',
                            cell: (proj: any) => <span style={{ fontWeight: 'bold' }}>📁 {proj.content_name}</span>
                          },
                          {
                            id: 'workspace',
                            header: '工作空間',
                            cell: (proj: any) => {
                              const wsName = workspaces.find(w => w.workspace_id === proj.related_workspace_id)?.workspace_name || '—';
                              return <span>🏢 {wsName}</span>;
                            }
                          },
                          {
                            id: 'status',
                            header: '狀態',
                            cell: (proj: any) => <span className={getProjectStatusClass(proj.content_status)}>● {proj.content_status}</span>
                          },
                          ...getRemainingProjectContextColumns(workspaces, products, ['content_display_id', 'content_name', 'related_workspace_id', 'content_status'])
                        ];

                        const relatedProjectsData = projects.filter(proj => String(proj.parent_content_id) === String(p.id));

                        return (
                          <>
                          <AdvancedTable
                            tableId={`product_related_projects_${p.id}`}
                            data={relatedProjectsData}
                            columns={relatedProjColumns}
                            onRowClick={(proj) => { setSelectedModalProjectId(proj.id); setSelectedModalProductId(null); }}
                          />
                          
                          {inlineCreatingProductRelatedProjectOpen === String(p.id) ? (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '8px' }}>
                              <Select
                                value={{ value: inlineCreatingProductRelatedProjectType, label: inlineCreatingProductRelatedProjectType }}
                                onChange={(s: any) => setInlineCreatingProductRelatedProjectType(s ? s.value : 'Phase')}
                                styles={{
                                  ...reactSelectStyles,
                                  control: (base: any, state: any) => ({
                                    ...reactSelectStyles.control(base, state),
                                    minHeight: '32px',
                                    width: '150px'
                                  }),
                                  valueContainer: (base: any) => ({
                                    ...base,
                                    padding: '0 8px'
                                  })
                                }}
                                options={['Phase', 'BAU', 'Retainer', 'POC', 'Support', 'Ad-hoc', 'Workshop', 'Training', 'Meeting', 'Consultation', 'Implementation', 'Rollout', 'Review', 'Handover'].map(t => ({ value: t, label: t }))}
                                isSearchable={false}
                                menuPlacement="top"
                              />
                              <input 
                                type="text"
                                autoFocus
                                placeholder="輸入專案名稱..."
                                value={inlineCreatingProductRelatedProjectTitle}
                                onChange={e => setInlineCreatingProductRelatedProjectTitle(e.target.value)}
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter' && inlineCreatingProductRelatedProjectTitle.trim()) {
                                    try {
                                      await api.createProject({
                                        content_name: inlineCreatingProductRelatedProjectTitle,
                                        related_workspace_id: filterWorkspace ? Number(filterWorkspace) : (workspaces[0]?.workspace_id || 1),
                                        content_status: 'Active',
                                        project_type: inlineCreatingProductRelatedProjectType,
                                        project_type_sequence: 1,
                                        parent_content_id: p.id,
                                        content: {}
                                      });
                                      setInlineCreatingProductRelatedProjectOpen(null);
                                      setInlineCreatingProductRelatedProjectTitle('');
                                      if (onRefreshData) await onRefreshData();
                                    } catch(err) { alert('建立失敗'); }
                                  } else if (e.key === 'Escape') {
                                    setInlineCreatingProductRelatedProjectOpen(null);
                                  }
                                }}
                                style={{ flex: 1, background: 'transparent', color: 'var(--text-primary)', border: 'none', borderBottom: '1px solid var(--accent-primary)', outline: 'none', padding: '6px' }}
                              />
                              <button 
                                onClick={async () => {
                                  if (inlineCreatingProductRelatedProjectTitle.trim()) {
                                    try {
                                      await api.createProject({
                                        content_name: inlineCreatingProductRelatedProjectTitle,
                                        related_workspace_id: filterWorkspace ? Number(filterWorkspace) : (workspaces[0]?.workspace_id || 1),
                                        content_status: 'Active',
                                        project_type: inlineCreatingProductRelatedProjectType,
                                        project_type_sequence: 1,
                                        parent_content_id: p.id,
                                        content: {}
                                      });
                                      setInlineCreatingProductRelatedProjectOpen(null);
                                      setInlineCreatingProductRelatedProjectTitle('');
                                      if (onRefreshData) await onRefreshData();
                                    } catch(err) { alert('建立失敗'); }
                                  }
                                }}
                                style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
                              >Save</button>
                              <button 
                                onClick={() => setInlineCreatingProductRelatedProjectOpen(null)}
                                style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
                              >Cancel</button>
                            </div>
                          ) : (
                            <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                              <button 
                                onClick={() => {
                                  setInlineCreatingProductRelatedProjectOpen(String(p.id));
                                  setInlineCreatingProductRelatedProjectTitle('');
                                }}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}
                              >
                                + 新增
                              </button>
                            </div>
                          )}
                          </>
                        );
                      })()}
                      </div>
                    )}
                  </div>
                )}

{/* Product Update & Deployment Table */}
                {!isEditing && (
                  <div style={{ marginTop: '24px', marginBottom: '24px' }}>
                    <strong style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                      🚀 Update & Deployment
                    </strong>
                    {(() => {
                      const relatedProjectIds = projects.filter(proj => String(proj.parent_content_id) === String(p.id)).map(proj => String(proj.id));
                      const productTasks = tasks.filter(t => relatedProjectIds.includes(String(t.project_id)));
                      
                      const getChildren = (parentId: any, type: string) => {
                        return productTasks.filter(t => {
                          if (t.item_type !== type) return false;
                          if (t.parent_item_id && String(t.parent_item_id) === String(parentId)) return true;
                          
                          let rels = t.related_item_id_relation;
                          if (typeof rels === 'string') {
                            try { rels = JSON.parse(rels); } catch(e) { rels = []; }
                          }
                          if (Array.isArray(rels)) {
                            if (rels.some((r: any) => String(r.target_id) === String(parentId) && (r.relation === 'is_deployed' || r.relation === 'deploys'))) return true;
                          }
                          
                          const parentItem = productTasks.find(p => String(p.id) === String(parentId));
                          if (parentItem) {
                            let pRels = parentItem.related_item_id_relation;
                            if (typeof pRels === 'string') {
                              try { pRels = JSON.parse(pRels); } catch(e) { pRels = []; }
                            }
                            if (Array.isArray(pRels)) {
                              if (pRels.some((r: any) => String(r.target_id) === String(t.id) && (r.relation === 'is_deployed' || r.relation === 'deploys'))) return true;
                            }
                          }
                          return false;
                        });
                      };

                      const buildTree = () => {
                        const deploys = productTasks.filter(t => t.item_type === 'Deploy');
                        return deploys.map(deploy => {
                          const stories = [
                            ...getChildren(deploy.id, 'User Story'),
                            ...getChildren(deploy.id, 'Bug')
                          ].map(story => {
                            const storyTasks = getChildren(story.id, 'Task').concat(getChildren(story.id, 'Micro Task')).map(task => ({
                              item: task,
                              rowSpan: 1
                            }));
                            return {
                              item: story,
                              children: storyTasks,
                              rowSpan: Math.max(1, storyTasks.reduce((sum, t) => sum + t.rowSpan, 0))
                            };
                          });
                          return {
                            item: deploy,
                            children: stories,
                            rowSpan: Math.max(1, stories.reduce((sum, s) => sum + s.rowSpan, 0))
                          };
                        });
                      };

                      const tree = buildTree();
                      const rows: React.ReactNode[] = [];

                      const renderItemCell = (item: any, childType?: string, currentParentId?: string) => (
                        <div 
                          draggable={item.item_type !== 'Deploy'}
                          onDragEnd={() => setDndDraggingItem(null)}
                          onDragStart={(e) => {
                            setDndDraggingItem({ id: String(item.id), type: item.item_type || '' });
                            e.dataTransfer.setData('text/plain', JSON.stringify({
                              id: item.id,
                              type: item.item_type,
                              sourceParentId: currentParentId
                            }));
                            if (item.item_type !== 'Deploy') {
                              const childTasks = tasks.filter(t => {
                                if (t.id === item.id) return false;
                                if (t.item_type === 'Deploy' || t.item_type === 'Epic') return false;
                                if (item.item_type === 'User Story' || item.item_type === 'Bug') {
                                  if (t.item_type !== 'Task' && t.item_type !== 'Micro Task') return false;
                                } else if (item.item_type === 'Business Requirement') {
                                  if (t.item_type !== 'User Story' && t.item_type !== 'Epic' && t.item_type !== 'Bug') return false;
                                } else if (item.item_type === 'Business Objective') {
                                  if (t.item_type !== 'Business Requirement') return false;
                                }
                                if (t.parent_item_id && String(t.parent_item_id) === String(item.id)) return true;
                                if (item.item_type === 'Epic' || item.item_type === 'User Story' || item.item_type === 'Bug' || item.item_type === 'Business Requirement' || item.item_type === 'Business Objective') {
                                  let rels = t.related_item_id_relation;
                                  if (typeof rels === 'string') {
                                    try { rels = JSON.parse(rels); } catch(e) { rels = []; }
                                  }
                                  if (Array.isArray(rels)) {
                                    if (rels.some((r: any) => String(r.target_id) === String(item.id))) return true;
                                  }
                                  let pRels = item.related_item_id_relation;
                                  if (typeof pRels === 'string') {
                                    try { pRels = JSON.parse(pRels); } catch(e) { pRels = []; }
                                  }
                                  if (Array.isArray(pRels)) {
                                    if (pRels.some((r: any) => String(r.target_id) === String(t.id))) return true;
                                  }
                                }
                                return false;
                              });
                              let tasksHtml = '';
                              if (childTasks.length > 0) {
                                tasksHtml = `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.2); font-size: 11px; color: #94A3B8;">
                                  <div style="font-weight: bold; color: #38BDF8; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                                    <span>⚡</span> 連同底下 ${childTasks.length} 個關聯子項目一起整組移動：
                                  </div>
                                  <div style="display: flex; flex-direction: column; gap: 3px; max-height: 120px; overflow: hidden;">
                                    ${childTasks.slice(0, 4).map(ct => `<div style="display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.05); padding: 3px 6px; border-radius: 4px;"><span style="color: #10B981; font-weight: bold;">✓</span> <span style="color: #F1F5F9; font-weight: 500;">${ct.item_display_id || ct.content_display_id || 'Item'}</span> <span style="color: #CBD5E1; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${ct.item_title || ''}</span></div>`).join('')}
                                    ${childTasks.length > 4 ? `<div style="color: #94A3B8; font-style: italic; padding-left: 4px;">...以及其他 ${childTasks.length - 4} 個關聯子項目</div>` : ''}
                                  </div>
                                </div>`;
                              } else {
                                tasksHtml = `<div style="font-size: 11px; color: #64748B; margin-top: 6px; font-style: italic;">(目前無直接關聯之子項目)</div>`;
                              }
                              const dragPreview = document.createElement('div');
                              dragPreview.style.position = 'absolute';
                              dragPreview.style.top = '-9999px';
                              dragPreview.style.left = '-9999px';
                              dragPreview.style.background = '#0F172A';
                              dragPreview.style.border = '2px solid #38BDF8';
                              dragPreview.style.borderRadius = '12px';
                              dragPreview.style.padding = '12px 16px';
                              dragPreview.style.color = '#F8FAFC';
                              dragPreview.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 20px rgba(56, 189, 248, 0.3)';
                              dragPreview.style.width = '280px';
                              dragPreview.style.pointerEvents = 'none';
                              dragPreview.style.zIndex = '999999';
                              dragPreview.style.fontFamily = 'Inter, system-ui, sans-serif';
                              dragPreview.innerHTML = `
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                                  <span style="background: rgba(56, 189, 248, 0.2); color: #38BDF8; font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(56, 189, 248, 0.4);">📦 整組群組拖曳</span>
                                  <span style="font-size: 11px; color: #94A3B8; font-weight: 600;">${item.item_type || 'User Story'}</span>
                                </div>
                                <div style="font-weight: bold; font-size: 13px; color: #FFFFFF; line-height: 1.4;">
                                  <span style="color: #38BDF8;">${item.item_display_id || item.content_display_id || ''}</span> ${item.item_title || ''}
                                </div>
                                ${tasksHtml}
                              `;
                              document.body.appendChild(dragPreview);
                              if (e.dataTransfer.setDragImage) {
                                e.dataTransfer.setDragImage(dragPreview, 30, 30);
                              }
                              setTimeout(() => {
                                if (dragPreview.parentNode) dragPreview.parentNode.removeChild(dragPreview);
                              }, 0);
                            } else {
                              const dragPreview = document.createElement('div');
                              dragPreview.style.position = 'absolute';
                              dragPreview.style.top = '-9999px';
                              dragPreview.style.left = '-9999px';
                              dragPreview.style.background = '#0F172A';
                              dragPreview.style.border = '2px solid #A855F7';
                              dragPreview.style.borderRadius = '10px';
                              dragPreview.style.padding = '10px 14px';
                              dragPreview.style.color = '#F8FAFC';
                              dragPreview.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 0 15px rgba(168, 85, 247, 0.3)';
                              dragPreview.style.width = '240px';
                              dragPreview.style.pointerEvents = 'none';
                              dragPreview.style.zIndex = '999999';
                              dragPreview.style.fontFamily = 'Inter, system-ui, sans-serif';
                              dragPreview.innerHTML = `
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                                  <span style="background: rgba(168, 85, 247, 0.2); color: #C084FC; font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(168, 85, 247, 0.4);">🎯 任務拖曳</span>
                                  <span style="font-size: 11px; color: #94A3B8; font-weight: 600;">${item.item_type || 'Task'}</span>
                                </div>
                                <div style="font-weight: bold; font-size: 13px; color: #FFFFFF; line-height: 1.4;">
                                  <span style="color: #C084FC;">${item.item_display_id || item.content_display_id || ''}</span> ${item.item_title || ''}
                                </div>
                              `;
                              document.body.appendChild(dragPreview);
                              if (e.dataTransfer.setDragImage) {
                                e.dataTransfer.setDragImage(dragPreview, 25, 25);
                              }
                              setTimeout(() => {
                                if (dragPreview.parentNode) dragPreview.parentNode.removeChild(dragPreview);
                              }, 0);
                            }
                          }}
                          onDragEnd={() => setDndHoverTargetId(null)}
                          onDragOver={(e) => {
                            const validTargets = ['Deploy', 'Business Objective', 'Business Requirement', 'User Story', 'Epic', 'Bug', 'Task', 'Micro Task'];
                            if (validTargets.includes(item.item_type || '')) {
                              e.preventDefault();
                              e.stopPropagation();
                              if (dndHoverTargetId !== String(item.id)) setDndHoverTargetId(String(item.id));
                            }
                          }}
                          onDragLeave={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                              if (dndHoverTargetId === String(item.id)) setDndHoverTargetId(null);
                            setDndDraggingItem(null);
                            }
                          }}
                          onDrop={(e) => {
                            setDndHoverTargetId(null);
                            setDndDraggingItem(null);
                            const validTargets = ['Deploy', 'Business Objective', 'Business Requirement', 'User Story', 'Epic', 'Bug', 'Task', 'Micro Task'];
                            if (validTargets.includes(item.item_type || '')) {
                              e.stopPropagation();
                              handleDnDDrop(e, item.id, item.item_type || 'User Story');
                            }
                          }}
                          style={{ 
                            position: 'relative', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '4px', 
                            height: '100%', 
                            minHeight: '40px', 
                            cursor: item.item_type !== 'Deploy' ? 'grab' : 'default',
                            border: dndHoverTargetId === String(item.id) ? '2px dashed #10B981' : (dndDraggingItem && dndDraggingItem.id !== String(item.id) && isValidDropTarget(dndDraggingItem.type, item.item_type || '', activeTab) ? '1px dashed rgba(16, 185, 129, 0.6)' : '1px solid rgba(255,255,255,0.05)'),
                            backgroundColor: dndHoverTargetId === String(item.id) ? 'rgba(16, 185, 129, 0.25)' : (dndDraggingItem && dndDraggingItem.id !== String(item.id) && isValidDropTarget(dndDraggingItem.type, item.item_type || '', activeTab) ? 'rgba(16, 185, 129, 0.05)' : (item.item_type === 'Deploy' ? 'rgba(255,255,255,0.03)' : 'transparent')),
                            boxShadow: dndHoverTargetId === String(item.id) ? '0 0 25px rgba(16, 185, 129, 0.6), inset 0 0 15px rgba(16, 185, 129, 0.3)' : (dndDraggingItem && dndDraggingItem.id !== String(item.id) && isValidDropTarget(dndDraggingItem.type, item.item_type || '', activeTab) ? '0 0 10px rgba(16, 185, 129, 0.2)' : 'none'),
                            borderRadius: '8px',
                            padding: '8px',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            transform: dndHoverTargetId === String(item.id) ? 'scale(1.02)' : 'none',
                            zIndex: (inlineCreatingTraceChildFor === String(item.id) || inlineLinkingTraceChildFor === String(item.id) || inlineEditingTraceProjectFor === String(item.id) || inlineEditingTraceStatusFor === String(item.id)) ? 9999 : (dndHoverTargetId === String(item.id) ? 10 : 1),
                          }}
                          onMouseEnter={(e) => {
                            const btn = e.currentTarget.querySelector('.inline-create-btn');
                            if (btn) (btn as HTMLElement).style.opacity = '1';
                          }}
                          onMouseLeave={(e) => {
                            const btn = e.currentTarget.querySelector('.inline-create-btn');
                            if (btn) (btn as HTMLElement).style.opacity = '0';
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span 
                                style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'color 0.2s' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedModalTaskId(item.id);
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-primary)')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                              >
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} title={item.item_type || 'Task'}>
                                <span>{getItemTypeStyles(item.item_type || 'Task').icon}</span> {item.item_display_id || item.content_display_id}
                              </span>
                            </span>
                            
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <span 
                                onClick={(e) => { e.stopPropagation(); setInlineEditingTraceProjectFor(String(item.id)); }}
                                style={{ cursor: 'pointer', background: inlineEditingTraceProjectFor === String(item.id) ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.05)', color: inlineEditingTraceProjectFor === String(item.id) ? '#38BDF8' : '#94A3B8', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} 
                                title="所屬專案"
                              >
                                📁 {projects.find(proj => String(proj.id) === String(item.related_context_id || item.project_id))?.name || '無'}
                              </span>
                              {inlineEditingTraceProjectFor === String(item.id) && (
                                <>
                                  <div style={{ position: 'fixed', inset: 0, zIndex: 99998 }} onClick={(e) => { e.stopPropagation(); setInlineEditingTraceProjectFor(null); }} />
                                  <div style={{ position: 'absolute', left: '0', top: 'calc(100% + 8px)', width: '280px', background: '#0B1120', border: '1px solid #38BDF8', boxShadow: '0 15px 35px rgba(0,0,0,0.85), 0 0 15px rgba(56, 189, 248, 0.35)', padding: '12px', borderRadius: '8px', zIndex: 99999 }} onClick={e => e.stopPropagation()}>
                                    <div style={{ fontSize: '12px', color: '#38BDF8', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(56, 189, 248, 0.2)', paddingBottom: '6px' }}><span>🔗</span> 變更所屬專案</div>
                                    <Select
                                      autoFocus
                                      placeholder="-- 請選擇 --"
                                      options={projects.filter(proj => !proj.parent_content_id || String(proj.parent_content_id) === String(p.id) || String(proj.id) === String(item.related_context_id || item.project_id)).map(proj => ({ value: String(proj.id), label: proj.name }))}
                                      onChange={async (selectedOption: any) => {
                                        const newProjId = selectedOption ? selectedOption.value : null;
                                        setInlineEditingTraceProjectFor(null);
                                        try {
                                          await api.updateTask(item.id, { ...item, related_context_id: newProjId ? Number(newProjId) : null });
                                          if (onRefreshData) await onRefreshData();
                                        } catch(err) { alert('更新失敗'); }
                                      }}
                                      styles={{
                                        control: (base) => ({ ...base, background: '#000', borderColor: '#333', minHeight: '30px', fontSize: '12px' }),
                                        menu: (base) => ({ ...base, background: '#0B1120', border: '1px solid #333', zIndex: 9999 }),
                                        option: (base, state) => ({ ...base, background: state.isFocused ? '#1e293b' : 'transparent', color: '#fff', fontSize: '12px', cursor: 'pointer' }),
                                        singleValue: (base) => ({ ...base, color: '#fff' }),
                                        input: (base) => ({ ...base, color: '#fff' })
                                      }}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                                      <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '11px', padding: '2px 8px', cursor: 'pointer' }} onClick={() => setInlineEditingTraceProjectFor(null)}>Cancel</button>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                              
                              {inlineEditingTraceStatusFor === String(item.id) ? (
                                <ThemedSelect 
                                  autoFocus
                                  defaultValue={item.item_status || 'Not Start'}
                                  style={{ fontSize: '10px', padding: '2px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: 'none', outline: 'none', borderRadius: '4px' }}
                                  onBlur={() => setInlineEditingTraceStatusFor(null)}
                                  onChange={async (e) => {
                                    const newStatus = e.target.value;
                                    setInlineEditingTraceStatusFor(null);
                                    try {
                                      await api.updateTask(item.id, { ...item, item_status: newStatus });
                                      if (onRefreshData) await onRefreshData();
                                    } catch(err) { alert('更新失敗'); }
                                  }}
                                  onClick={e => e.stopPropagation()}
                                >
                                  {['Not Start', 'Ready', 'In Progress', 'Stuck', 'Review', 'Completed', 'Closed', 'Backlog'].map(s => <option key={s} value={s}>{s}</option>)}
                                </ThemedSelect>
                              ) : (
                                <span style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setInlineEditingTraceStatusFor(String(item.id)); }}>
                                  {getItemStatusBadge(item.item_status || 'Not Start')}
                                </span>
                              )}
                            </div>
                            
                            {inlineEditingTraceTitleFor === String(item.id) ? (
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                <input
                                  autoFocus
                                  value={inlineEditingTraceTitleValue}
                                  onChange={e => setInlineEditingTraceTitleValue(e.target.value)}
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                      try {
                                        await api.updateTask(item.id, { ...item, item_title: inlineEditingTraceTitleValue });
                                        if (onRefreshData) await onRefreshData();
                                        setInlineEditingTraceTitleFor(null);
                                      } catch(err) { alert('更新失敗'); }
                                    } else if (e.key === 'Escape') {
                                      setInlineEditingTraceTitleFor(null);
                                    }
                                  }}
                                  style={{ flex: 1, fontSize: '13px', padding: '2px 4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none', borderRadius: '4px' }}
                                />
                                <button style={{ background: 'transparent', border: 'none', color: '#10B981', cursor: 'pointer', padding: '2px' }}
                                  onClick={async () => {
                                    try {
                                      await api.updateTask(item.id, { ...item, item_title: inlineEditingTraceTitleValue });
                                      if (onRefreshData) await onRefreshData();
                                      setInlineEditingTraceTitleFor(null);
                                    } catch(err) { alert('更新失敗'); }
                                  }}
                                >✓</button>
                                <button style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
                                  onClick={() => setInlineEditingTraceTitleFor(null)}
                                >✕</button>
                              </div>
                            ) : (
                              <div 
                                style={{ fontSize: '13px', lineHeight: '1.4', cursor: 'text', padding: '2px 0', transition: 'color 0.2s' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInlineEditingTraceTitleFor(String(item.id));
                                  setInlineEditingTraceTitleValue(item.item_title || item.title || '');
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = 'inherit')}
                              >{item.item_title || item.title}</div>
                            )}
                          </div>
                          {childType && inlineCreatingTraceChildFor !== String(item.id) && inlineLinkingTraceChildFor !== String(item.id) && (
                            <div 
                              className="inline-create-btn"
                              style={{ 
                                position: 'absolute', right: '-8px', top: '-8px', 
                                opacity: 0, transition: 'opacity 0.2s', 
                                display: 'flex', gap: '4px'
                              }}
                            >
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInlineLinkingTraceChildFor(String(item.id));
                                  setInlineLinkingTraceChildType(childType);
                                }}
                                style={{ 
                                  cursor: 'pointer', color: 'var(--accent-primary)',
                                  background: 'rgba(255,255,255,0.1)', borderRadius: '50%',
                                  width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '12px'
                                }}
                                title={`連結現有 ${childType}`}
                              >
                                🔗
                              </div>
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInlineCreatingTraceChildFor(String(item.id));
                                  setInlineCreatingTraceChildType(childType);
                                  setInlineCreatingTraceChildTitle('');
                                }}
                                style={{ 
                                  cursor: 'pointer', color: 'var(--accent-primary)',
                                  background: 'rgba(255,255,255,0.1)', borderRadius: '50%',
                                  width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '16px', fontWeight: 'bold'
                                }}
                                title={`新增 ${childType}`}
                              >
                                +
                              </div>
                            </div>
                          )}
                          {inlineLinkingTraceChildFor === String(item.id) && (
                            <>
                              <div style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,0.5)' }} onClick={(e) => { e.stopPropagation(); setInlineLinkingTraceChildFor(null); }} />
                              <div style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '320px', background: '#0B1120', border: '1px solid #38BDF8', boxShadow: '0 15px 35px rgba(0,0,0,0.85), 0 0 15px rgba(56, 189, 248, 0.35)', padding: '16px', borderRadius: '12px', zIndex: 99999 }} onClick={e => e.stopPropagation()}>
                                <div style={{ fontSize: '12px', color: '#38BDF8', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(56, 189, 248, 0.2)', paddingBottom: '6px' }}><span>🔗</span> 連結至右側 {childType} 欄位</div>
                                <Select
                                  autoFocus
                                  placeholder="-- 請選擇 --"
                                  options={productTasks
                                    .filter(t => {
                                      if (inlineLinkingTraceChildType === 'User Story' ? (t.item_type !== 'User Story' && t.item_type !== 'Bug') : (t.item_type !== inlineLinkingTraceChildType)) return false;
                                      if (String(t.parent_item_id) === String(item.id)) return false;
                                      let rels = t.related_item_id_relation;
                                      if (typeof rels === 'string') {
                                        try { rels = JSON.parse(rels); } catch(e) { rels = []; }
                                      }
                                      if (Array.isArray(rels)) {
                                        if (rels.some((r: any) => String(r.target_id) === String(item.id) && r.relation === 'is_deployed')) return false;
                                      }
                                      return true;
                                    })
                                    .map(t => ({ value: String(t.id), label: `${t.item_display_id || t.content_display_id || ''} ${t.item_title || t.title || ''}`.trim() }))}
                                  onChange={async (selectedOption: any) => {
                                    if (!selectedOption) return;
                                    const selectedChildId = selectedOption.value;
                                    try {
                                      const childItem = tasks.find(t => String(t.id) === selectedChildId);
                                      if (childItem) {
                                        let currentRels = childItem.related_item_id_relation;
                                        if (typeof currentRels === 'string') {
                                          try { currentRels = JSON.parse(currentRels); } catch(e) { currentRels = []; }
                                        }
                                        if (!Array.isArray(currentRels)) currentRels = [];
                                        
                                        if (!currentRels.some((r: any) => String(r.target_id) === String(item.id) && r.relation === 'is_deployed')) {
                                          const newRelations = [...currentRels, { target_id: Number(item.id), relation: 'is_deployed' }];
                                          await api.updateTask(childItem.id, { 
                                            ...childItem, 
                                            related_item_id_relation: newRelations 
                                          });
                                          if (onRefreshData) await onRefreshData();
                                        }
                                      }
                                      setInlineLinkingTraceChildFor(null);
                                    } catch(err) { alert('連結失敗'); }
                                  }}
                                  styles={{
                                    control: (base) => ({ ...base, background: '#000', borderColor: '#333', minHeight: '30px', fontSize: '12px' }),
                                    menu: (base) => ({ ...base, background: '#0B1120', border: '1px solid #333', zIndex: 9999 }),
                                    option: (base, state) => ({ ...base, background: state.isFocused ? '#1e293b' : 'transparent', color: '#fff', fontSize: '12px', cursor: 'pointer' }),
                                    singleValue: (base) => ({ ...base, color: '#fff' }),
                                    input: (base) => ({ ...base, color: '#fff' })
                                  }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                                  <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '11px', padding: '2px 8px', cursor: 'pointer' }} onClick={() => setInlineLinkingTraceChildFor(null)}>Cancel</button>
                                </div>
                              </div>
                            </>
                          )}
                          {inlineCreatingTraceChildFor === String(item.id) && (
                            <>
                              <div style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,0.5)' }} onClick={(e) => { e.stopPropagation(); setInlineCreatingTraceChildFor(null); }} />
                              <div style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '320px', background: '#0B1120', border: '1px solid #38BDF8', boxShadow: '0 15px 35px rgba(0,0,0,0.85), 0 0 15px rgba(56, 189, 248, 0.35)', padding: '16px', borderRadius: '12px', zIndex: 99999 }} onClick={e => e.stopPropagation()}>
                                <div style={{ fontSize: '12px', color: '#38BDF8', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(56, 189, 248, 0.2)', paddingBottom: '6px' }}><span>✨</span> 新增至右側 {childType} 欄位</div>
                                {childType === 'User Story' && (
                                  <div style={{ marginBottom: '8px' }}>
                                    <select
                                      value={inlineCreatingTraceChildType}
                                      onChange={(e: any) => setInlineCreatingTraceChildType(e.target.value)}
                                      style={{ width: '100%', background: '#000', color: 'var(--text-primary)', border: '1px solid #333', padding: '6px 8px', borderRadius: '4px', fontSize: '12px', outline: 'none' }}
                                    >
                                      <option value="User Story" style={{ background: '#0B1120' }}>User Story</option>
                                      <option value="Bug" style={{ background: '#0B1120' }}>Bug</option>
                                    </select>
                                  </div>
                                )}
                                <input 
                                  autoFocus
                                  placeholder={`輸入 ${childType} 標題...`}
                                  value={inlineCreatingTraceChildTitle}
                                  onChange={e => setInlineCreatingTraceChildTitle(e.target.value)}
                                  onKeyDown={async e => {
                                    if (e.key === 'Enter' && inlineCreatingTraceChildTitle.trim()) {
                                      try {
                                        await api.createTask({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                          related_context_id: item.project_id,
                                          item_title: inlineCreatingTraceChildTitle,
                                          item_type: inlineCreatingTraceChildType,
                                          item_status: 'Not Start',
                                          item_priority: 'Middle',
                                          parent_item_id: Number(item.id), related_item_id_relation: [{ target_id: Number(item.id), relation: 'is_deployed' }]
                                        });
                                        if (onRefreshData) await onRefreshData();
                                        setInlineCreatingTraceChildFor(null);
                                        setInlineCreatingTraceChildTitle('');
                                      } catch(err) { alert('建立失敗'); }
                                    } else if (e.key === 'Escape') {
                                      setInlineCreatingTraceChildFor(null);
                                    }
                                  }}
                                  style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent-primary)', color: '#fff', outline: 'none', fontSize: '12px', padding: '4px' }}
                                />
                                <div style={{ display: 'flex', gap: '4px', marginTop: '6px', justifyContent: 'flex-end' }}>
                                  <button style={{ background: 'var(--accent-primary)', border: 'none', color: '#fff', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}
                                    onClick={async () => {
                                      if (inlineCreatingTraceChildTitle.trim()) {
                                        try {
                                          await api.createTask({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined, 
                                            related_context_id: item.project_id,
                                            item_title: inlineCreatingTraceChildTitle,
                                            item_type: inlineCreatingTraceChildType,
                                            item_status: 'Not Start',
                                            item_priority: 'Middle',
                                            parent_item_id: Number(item.id), related_item_id_relation: [{ target_id: Number(item.id), relation: 'is_deployed' }]
                                          });
                                          if (onRefreshData) await onRefreshData();
                                          setInlineCreatingTraceChildFor(null);
                                          setInlineCreatingTraceChildTitle('');
                                        } catch(err) { alert('建立失敗'); }
                                      }
                                    }}
                                  >Save</button>
                                  <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '11px', padding: '2px 8px', cursor: 'pointer' }} onClick={() => setInlineCreatingTraceChildFor(null)}>Cancel</button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );

                      tree.forEach(deployNode => {
                        let isFirstDeployRow = true;
                        if (deployNode.children.length === 0) {
                          rows.push(
                            <tr key={`deploy-${deployNode.item.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td rowSpan={1} 
                                  onDragOver={e => { e.preventDefault(); if (dndHoverTargetId !== String(deployNode.item.id)) setDndHoverTargetId(String(deployNode.item.id)); }}
                                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDndHoverTargetId(null);
                            setDndDraggingItem(null); }}
                                  onDrop={e => handleDnDDrop(e, deployNode.item.id, 'Deploy')}
                                  style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                {renderItemCell(deployNode.item, 'User Story')}
                              </td>
                              <td colSpan={2} style={{ padding: '16px', verticalAlign: 'top', color: 'var(--text-muted)', textAlign: 'center' }}>—</td>
                            </tr>
                          );
                        } else {
                          deployNode.children.forEach(storyNode => {
                            let isFirstStoryRow = true;
                            if (storyNode.children.length === 0) {
                              rows.push(
                                <tr key={`story-${storyNode.item.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                  {isFirstDeployRow && (
                                    <td rowSpan={deployNode.rowSpan} 
                                      onDragOver={e => { e.preventDefault(); if (dndHoverTargetId !== String(deployNode.item.id)) setDndHoverTargetId(String(deployNode.item.id)); }}
                                      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDndHoverTargetId(null);
                            setDndDraggingItem(null); }}
                                      onDrop={e => handleDnDDrop(e, deployNode.item.id, 'Deploy')}
                                      style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                      {renderItemCell(deployNode.item, 'User Story')}
                                    </td>
                                  )}
                                  <td rowSpan={1} 
                                    onDragOver={e => { e.preventDefault(); if (dndHoverTargetId !== String(storyNode.item.id)) setDndHoverTargetId(String(storyNode.item.id)); }}
                                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDndHoverTargetId(null);
                            setDndDraggingItem(null); }}
                                    onDrop={e => handleDnDDrop(e, storyNode.item.id, 'User Story')}
                                    style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                    {renderItemCell(storyNode.item, 'Task', String(deployNode.item.id))}
                                  </td>
                                  <td colSpan={1} style={{ padding: '16px', verticalAlign: 'top', color: 'var(--text-muted)', textAlign: 'center' }}>—</td>
                                </tr>
                              );
                              isFirstDeployRow = false;
                            } else {
                              storyNode.children.forEach(taskNode => {
                                rows.push(
                                  <tr key={`task-${taskNode.item.id}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    {isFirstDeployRow && (
                                      <td rowSpan={deployNode.rowSpan} 
                                        onDragOver={e => { e.preventDefault(); if (dndHoverTargetId !== String(deployNode.item.id)) setDndHoverTargetId(String(deployNode.item.id)); }}
                                        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDndHoverTargetId(null);
                            setDndDraggingItem(null); }}
                                        onDrop={e => handleDnDDrop(e, deployNode.item.id, 'Deploy')}
                                        style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                        {renderItemCell(deployNode.item, 'User Story')}
                                      </td>
                                    )}
                                    {isFirstStoryRow && (
                                      <td rowSpan={storyNode.rowSpan} 
                                        onDragOver={e => { e.preventDefault(); if (dndHoverTargetId !== String(storyNode.item.id)) setDndHoverTargetId(String(storyNode.item.id)); }}
                                        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDndHoverTargetId(null);
                            setDndDraggingItem(null); }}
                                        onDrop={e => handleDnDDrop(e, storyNode.item.id, 'User Story')}
                                        style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                                        {renderItemCell(storyNode.item, 'Task', String(deployNode.item.id))}
                                      </td>
                                    )}
                                    <td rowSpan={1} style={{ padding: '16px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                                      {renderItemCell(taskNode.item, undefined, String(storyNode.item.id))}
                                    </td>
                                  </tr>
                                );
                                isFirstDeployRow = false;
                                isFirstStoryRow = false;
                              });
                            }
                          });
                        }
                      });

                      return (
                        <>
                          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden', marginTop: '8px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)' }}>
                              <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '13px' }}>
                                  <th style={{ padding: '12px 16px', textAlign: 'left', width: '33%', fontWeight: 600 }}>Deployment</th>
                                  <th style={{ padding: '12px 16px', textAlign: 'left', width: '33%', fontWeight: 600 }}>User Story</th>
                                  <th style={{ padding: '12px 16px', textAlign: 'left', width: '34%', fontWeight: 600 }}>Task</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.length > 0 ? rows : (
                                  <tr>
                                    <td colSpan={3} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                      尚未建立任何 Deployment 項目
                                    </td>
                                  </tr>
                                )}
                                {inlineCreatingProductDeploymentOpen === String(p.id) ? (
                                  <tr>
                                    <td colSpan={3} style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <ThemedSelect
                                          value={inlineCreatingProductDeploymentProjectId}
                                          onChange={e => setInlineCreatingProductDeploymentProjectId(e.target.value)}
                                          style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '4px', outline: 'none' }}
                                        >
                                          <option value="" disabled>-- 選擇關聯專案 --</option>
                                          {projects.filter(proj => String(proj.parent_content_id) === String(p.id)).map(proj => (
                                            <option key={proj.id} value={proj.id}>{proj.content_name || proj.name}</option>
                                          ))}
                                        </ThemedSelect>
                                        <input
                                          autoFocus
                                          placeholder="輸入 Deployment 名稱..."
                                          value={inlineCreatingProductDeploymentTitle}
                                          onChange={e => setInlineCreatingProductDeploymentTitle(e.target.value)}
                                          onKeyDown={async (e) => {
                                            if (e.key === 'Enter' && inlineCreatingProductDeploymentTitle.trim() && inlineCreatingProductDeploymentProjectId) {
                                              try {
                                                await api.createTask({
                                                  workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined,
                                                  related_context_id: inlineCreatingProductDeploymentProjectId,
                                                  item_title: inlineCreatingProductDeploymentTitle,
                                                  item_type: 'Deploy',
                                                  item_status: 'Not Start',
                                                  item_priority: 'Middle',
                                                });
                                                setInlineCreatingProductDeploymentOpen(null);
                                                setInlineCreatingProductDeploymentTitle('');
                                                if (onRefreshData) await onRefreshData();
                                              } catch(err) { alert('建立失敗'); }
                                            }
                                          }}
                                          style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent-primary)', color: '#fff', outline: 'none', padding: '6px 0' }}
                                        />
                                        <button 
                                          onClick={async () => {
                                            if (inlineCreatingProductDeploymentTitle.trim() && inlineCreatingProductDeploymentProjectId) {
                                              try {
                                                await api.createTask({
                                                  workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined,
                                                  related_context_id: inlineCreatingProductDeploymentProjectId,
                                                  item_title: inlineCreatingProductDeploymentTitle,
                                                  item_type: 'Deploy',
                                                  item_status: 'Not Start',
                                                  item_priority: 'Middle',
                                                });
                                                setInlineCreatingProductDeploymentOpen(null);
                                                setInlineCreatingProductDeploymentTitle('');
                                                if (onRefreshData) await onRefreshData();
                                              } catch(err) { alert('建立失敗'); }
                                            } else {
                                              alert('請選擇專案並輸入名稱');
                                            }
                                          }}
                                          style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer' }}
                                        >Save</button>
                                        <button 
                                          onClick={() => setInlineCreatingProductDeploymentOpen(null)}
                                          style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', padding: '4px 12px', cursor: 'pointer' }}
                                        >Cancel</button>
                                      </div>
                                    </td>
                                  </tr>
                                ) : (
                                  <tr>
                                    <td colSpan={3} style={{ padding: '0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                      <button 
                                        onClick={() => {
                                          setInlineCreatingProductDeploymentOpen(String(p.id));
                                          setInlineCreatingProductDeploymentTitle('');
                                          setInlineCreatingProductDeploymentProjectId(projects.filter(proj => String(proj.parent_content_id) === String(p.id))[0]?.id || '');
                                        }}
                                        style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 16px', fontSize: '13px' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                      >
                                        + 新增
                                      </button>
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                          

                        </>
                      );
                    
                    })()}
                  </div>
                )}

                {/* Remarks History */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  <strong style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Remarks 歷史軌跡 ({remarks.length})</strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', paddingRight: '4px' }}>
                    {remarks.length === 0 ? (
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>尚無變更備註</span>
                    ) : (
                      remarks.map((r, i) => (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '10px 14px', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--accent-secondary)', fontWeight: 'bold' }}>{r.user}</span>
                            <span>{formatChineseDateTime(r.timestamp)}</span>
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{r.text}</div>
                        </div>
                      ))
                    )}
                  </div>
                  {isEditing && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>新增備註 (Append Remark)</span>
                      <input type="text" placeholder="輸入此次變更的備註說明..." value={remarkInput} onChange={e => setRemarkInput(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }} />
                    </div>
                  )}
                </div>
              </div>

              <div style={{ flex: '0 0 320px', padding: '24px', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '16px' }}>
                    {isEditing ? (
                      <>
                        <button onClick={() => { setIsEditing(false); setRemarkInput(''); }} style={{ ...styles.cancelBtn, padding: '6px 12px', fontSize: '13px' }}>取消</button>
                        <button onClick={handleModalProductSave} disabled={isSaving} style={{ ...styles.saveBtn, padding: '6px 12px', fontSize: '13px' }}>{isSaving ? '儲存中...' : '儲存變更'}</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleDelete(p.id)} style={{ ...styles.cancelBtn, color: '#ef4444', padding: '6px 12px', fontSize: '13px' }}>🗑️ 刪除</button>
                        <button onClick={() => setIsEditing(true)} style={{ ...styles.editBtn, padding: '6px 12px', fontSize: '13px' }}>✏️ 編輯產品</button>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', rowGap: '16px', columnGap: '8px', fontSize: '13px' }}>
                    <div style={{ color: 'var(--text-muted)' }}>產品狀態</div>
                    <div>
                      {isEditing ? (
                        <ThemedSelect value={editStatus} onChange={e => setEditStatus(e.target.value)} style={{ ...styles.selectInput, width: '100%' }}>
                          <option value="Pipeline">Pipeline</option>
                          <option value="Active">Active</option>
                          <option value="On Hold">On Hold</option>
                          <option value="Completed">Completed</option>
                          <option value="Abandoned">Abandoned</option>
                        </ThemedSelect>
                      ) : (
                        <span className={getProjectStatusClass(p.content_status)}>● {p.content_status}</span>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>工作空間</div>
                    <div>
                      {isEditing ? (
                        <ThemedSelect value={editWorkspaceId} onChange={e => setEditWorkspaceId(Number(e.target.value))} style={{ ...styles.selectInput, width: '100%' }}>
                          {workspaces.map(w => (
                            <option key={w.workspace_id} value={w.workspace_id}>{w.workspace_name}</option>
                          ))}
                        </ThemedSelect>
                      ) : (
                        <strong>🏢 {workspaceName}</strong>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>業務負責人</div>
                    <div>
                      {isEditing ? (
                        <input type="text" value={productBusinessOwner} onChange={e => setProductBusinessOwner(e.target.value)} style={{ ...styles.textInput, width: '100%' }} />
                      ) : (
                        <strong>👤 {p.business_owner || '—'}</strong>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>技術負責人</div>
                    <div>
                      {isEditing ? (
                        <input type="text" value={productTechOwner} onChange={e => setProductTechOwner(e.target.value)} style={{ ...styles.textInput, width: '100%' }} />
                      ) : (
                        <strong>👤 {p.tech_owner || '—'}</strong>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderUserModal = () => {
    if (!selectedModalMemberId) return null;
    const m = members.find(x => String(x.member_id) === String(selectedModalMemberId));
    if (!m) return null;

    return (
      <>
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes zoomIn {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        `}</style>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2009 }}>
          <div onClick={() => { setSelectedModalMemberId(null); setIsEditing(false); }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', animation: 'fadeIn 0.2s ease-out' }} />
          <div style={{ position: 'relative', width: '96vw', maxWidth: '600px', height: '60vh', backgroundColor: '#0A0F1D', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', boxShadow: '0 24px 48px rgba(0, 0, 0, 0.8)', zIndex: 2010, display: 'flex', flexDirection: 'column', overflow: 'hidden', color: 'var(--text-primary)', animation: 'zoomIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.01)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
                <span>👤</span>
                <strong>MEMBER-{m.member_id}</strong>
              </div>
              <button onClick={() => { setSelectedModalMemberId(null); setIsEditing(false); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '24px', cursor: 'pointer', lineHeight: 1, padding: '4px', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>&times;</button>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '16px' }}>
                    {isEditing ? (
                      <>
                        <button onClick={() => setIsEditing(false)} style={{ ...styles.cancelBtn, padding: '6px 12px', fontSize: '13px' }}>取消</button>
                        <button onClick={handleModalMemberSave} disabled={isSaving} style={{ ...styles.saveBtn, padding: '6px 12px', fontSize: '13px' }}>{isSaving ? '儲存中...' : '儲存變更'}</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleDelete(String(m.member_id))} style={{ ...styles.cancelBtn, color: '#ef4444', padding: '6px 12px', fontSize: '13px' }}>🗑️ 刪除</button>
                        <button onClick={() => setIsEditing(true)} style={{ ...styles.editBtn, padding: '6px 12px', fontSize: '13px' }}>✏️ 編輯用戶</button>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: '16px', columnGap: '8px', fontSize: '13px' }}>
                    <div style={{ color: 'var(--text-muted)' }}>姓名</div>
                    <div>
                      {isEditing ? (
                        <input type="text" value={editMemberName} onChange={e => setEditMemberName(e.target.value)} style={{ ...styles.textInput, width: '100%' }} />
                      ) : (
                        <strong>{m.member_name}</strong>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>電子郵件</div>
                    <div>
                      {isEditing ? (
                        <input type="email" value={editMemberEmail} onChange={e => setEditMemberEmail(e.target.value)} style={{ ...styles.textInput, width: '100%' }} />
                      ) : (
                        <strong>{m.member_email || '—'}</strong>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>系統角色</div>
                    <div>
                      {isEditing ? (
                        <ThemedSelect value={editMemberRole} onChange={e => setEditMemberRole(e.target.value)} style={{ ...styles.selectInput, width: '100%' }}>
                          <option value="Collaborator">Collaborator</option>
                          <option value="Administrator">Administrator</option>
                          <option value="Viewer">Viewer</option>
                        </ThemedSelect>
                      ) : (
                        <span className="nature-tag" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#818CF8' }}>{m.member_role}</span>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>AD Group</div>
                    <div>
                      {isEditing ? (
                        <input type="text" value={editMemberAdGroup} onChange={e => setEditMemberAdGroup(e.target.value)} style={{ ...styles.textInput, width: '100%' }} />
                      ) : (
                        <strong>{m.member_ad_group || '—'}</strong>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>狀態</div>
                    <div>
                      {isEditing ? (
                        <ThemedSelect value={editMemberStatus} onChange={e => setEditMemberStatus(e.target.value)} style={{ ...styles.selectInput, width: '100%' }}>
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </ThemedSelect>
                      ) : (
                        <span className="status-badge-done">● {m.member_status}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderWorkspaceModal = () => {
    if (!selectedModalWorkspaceId) return null;
    const w = workspaces.find(x => String(x.workspace_id) === String(selectedModalWorkspaceId));
    if (!w) return null;

    return (
      <>
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes zoomIn {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        `}</style>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2009 }}>
          <div onClick={() => { setSelectedModalWorkspaceId(null); setIsEditing(false); }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', animation: 'fadeIn 0.2s ease-out' }} />
          <div style={{ position: 'relative', width: '96vw', maxWidth: '600px', height: '50vh', backgroundColor: '#0A0F1D', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', boxShadow: '0 24px 48px rgba(0, 0, 0, 0.8)', zIndex: 2010, display: 'flex', flexDirection: 'column', overflow: 'hidden', color: 'var(--text-primary)', animation: 'zoomIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.01)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
                <span>🗃️</span>
                <strong>WORKSPACE-{w.workspace_id}</strong>
              </div>
              <button onClick={() => { setSelectedModalWorkspaceId(null); setIsEditing(false); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '24px', cursor: 'pointer', lineHeight: 1, padding: '4px', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>&times;</button>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '16px' }}>
                    {isEditing ? (
                      <>
                        <button onClick={() => setIsEditing(false)} style={{ ...styles.cancelBtn, padding: '6px 12px', fontSize: '13px' }}>取消</button>
                        <button onClick={handleModalWorkspaceSave} disabled={isSaving} style={{ ...styles.saveBtn, padding: '6px 12px', fontSize: '13px' }}>{isSaving ? '儲存中...' : '儲存變更'}</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleDelete(String(w.workspace_id))} style={{ ...styles.cancelBtn, color: '#ef4444', padding: '6px 12px', fontSize: '13px' }}>🗑️ 刪除</button>
                        <button onClick={() => setIsEditing(true)} style={{ ...styles.editBtn, padding: '6px 12px', fontSize: '13px' }}>✏️ 編輯工作區</button>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: '16px', columnGap: '8px', fontSize: '13px' }}>
                    <div style={{ color: 'var(--text-muted)' }}>代碼 (Prefix Code)</div>
                    <div>
                      {isEditing ? (
                        <input type="text" value={editWorkspaceCode} onChange={e => setEditWorkspaceCode(e.target.value)} style={{ ...styles.textInput, width: '100%' }} />
                      ) : (
                        <span className="nature-tag" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24' }}>{w.prefix_code}</span>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>工作區名稱</div>
                    <div>
                      {isEditing ? (
                        <input type="text" value={editWorkspaceName} onChange={e => setEditWorkspaceName(e.target.value)} style={{ ...styles.textInput, width: '100%' }} />
                      ) : (
                        <strong>{w.workspace_name}</strong>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-muted)' }}>流水號 (Last Number)</div>
                    <div>
                      {isEditing ? (
                        <input type="number" value={editWorkspaceLastNumber} onChange={e => setEditWorkspaceLastNumber(Number(e.target.value))} style={{ ...styles.textInput, width: '100%' }} />
                      ) : (
                        <strong>{w.last_item_number || 0}</strong>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderAllOverlays = () => {
    return (
      <ErrorBoundary>
        {renderProjectDrawer()}
        {renderMeetingModal()}
        {renderTaskModal()}
        {renderBottleneckModal()}
        {renderKnowledgeModal()}
        {renderProjectModal()}
        {renderProductModal()}
        {renderUserModal()}
        {renderWorkspaceModal()}
        <FloatingToolbar selectedTaskIds={selectedTaskIds} onClear={() => setSelectedTaskIds([])} onDuplicate={handleDuplicateTasks} onDelete={handleDeleteTasks} />
        {selectedWorkspaceId && (
          <TemplateBuilderModal 
            workspaceId={selectedWorkspaceId}
            isOpen={isTemplateBuilderOpen}
            onClose={() => {
              setIsTemplateBuilderOpen(false);
              setEditTemplateTarget(null);
            }}
            onSave={fetchTemplates}
            initialTemplate={editTemplateTarget}
          />
        )}
      </ErrorBoundary>
    );
  };

  // Helper date conversions
  const formatDateString = (dStr: string) => {
    if (!dStr) return '';
    return new Date(dStr).toLocaleDateString('zh-HK');
  };

  const getRemarksList = (): RemarkEntry[] => {
    if (activeTab === 'products') return currentProduct?.remarks || [];
    if (activeTab === 'tasks') return currentTask?.remarks || [];
    if (activeTab === 'meetings') return currentMeeting?.remarks || [];
    if (activeTab === 'projects') {
      if (selectedSubItemId === 'project-charter') return currentCharter?.remarks || [];
      if (selectedSubItemId === 'project-plan') return currentPlan?.remarks || [];
      return currentRequirement?.remarks || [];
    }
    if (activeTab === 'bottlenecks') return currentBottleneck?.remarks || [];
    return currentKnowledge?.remarks || [];
  };

  const activeRemarks = getRemarksList();

  // ----------------------------------------------------
  // VISUAL RENDERERS
  // ----------------------------------------------------

  // 1. Kanban Board & Calendar View Visualizers
  if (activeTab === 'kanban') {
    if (selectedSubItemId === 'kanban-board') {
      const todoTasks = tasks.filter(t => t.status === 'TODO');
      const progressTasks = tasks.filter(t => t.status === 'IN_PROGRESS');
      const blockedTasks = tasks.filter(t => t.status === 'BLOCKED');
      const doneTasks = tasks.filter(t => t.status === 'DONE');

      const moveTaskStatus = async (task: Task, newStatus: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE') => {
        await onUpdateTask(task.id, {
          status: newStatus,
          remarks_entry: `看板拖曳：更改狀態為 ${newStatus}`
        });
      };

      const renderColumn = (title: string, count: number, list: Task[], colStatus: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE', bulletColor: string) => (
        <div className="kanban-column">
          <div className="kanban-column-header">
            <div className="kanban-column-title">
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: bulletColor }} />
              {title}
            </div>
            <span className="kanban-column-count">{count}</span>
          </div>
          <div className="kanban-cards-wrapper">
            {list.map(t => (
              <div key={t.id} className="kanban-card" onClick={() => setSelectedModalTaskId(t.id)}>
                <div className="kanban-card-title">{t.title}</div>
                {t.description && <div className="kanban-card-desc">{extractPlainText(t.description)}</div>}
                <div className="kanban-card-footer">
                  <span className="nature-tag" style={{ fontSize: '9px', padding: '1px 6px' }}>{t.nature || '工單'}</span>
                  <span style={{ color: 'var(--text-muted)' }}>👤 {members.find(mem => String(mem.member_id) === String(t.item_follow_by))?.member_name || '未指派'}</span>
                </div>
                {/* Board Column Shifters */}
                <div className="kanban-card-actions" onClick={e => e.stopPropagation()}>
                  {colStatus !== 'TODO' && <button className="kanban-action-btn" onClick={() => moveTaskStatus(t, 'TODO')} title="移至 To Do">◀</button>}
                  {colStatus !== 'IN_PROGRESS' && <button className="kanban-action-btn" onClick={() => moveTaskStatus(t, 'IN_PROGRESS')} title="移至 In Progress">⚙️</button>}
                  {colStatus !== 'BLOCKED' && <button className="kanban-action-btn" onClick={() => moveTaskStatus(t, 'BLOCKED')} title="移至 Blocked">⚠️</button>}
                  {colStatus !== 'DONE' && <button className="kanban-action-btn" onClick={() => moveTaskStatus(t, 'DONE')} title="移至 Done">▶</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

      return (
        <div className={themeClass} style={{ ...styles.container, backgroundColor: containerBg }}>
          {renderCategoryTabBar()}
          <div style={styles.wrapper}>
            <h1 style={{ ...styles.visualTitle, color: getTitleColor(), borderBottomColor: getBorderColor() }}>📋 專案任務看板 (Kanban Board)</h1>
            <div className="kanban-board-container">
              {renderColumn('待辦 (To Do)', todoTasks.length, todoTasks, 'TODO', 'var(--color-todo)')}
              {renderColumn('進行中 (In Progress)', progressTasks.length, progressTasks, 'IN_PROGRESS', 'var(--color-progress)')}
              {renderColumn('已卡住 (Blocked)', blockedTasks.length, blockedTasks, 'BLOCKED', 'var(--color-blocked)')}
              {renderColumn('已完成 (Completed)', doneTasks.length, doneTasks, 'DONE', 'var(--color-done)')}
            </div>
          </div>
          {/* Popup Modal Detail Overlay */}
          {renderAllOverlays()}
        </div>
    );
    }

    if (selectedSubItemId === 'kanban-todo' || selectedSubItemId === 'kanban-done' || selectedSubItemId === 'kanban-archive') {
      const matchStatus = selectedSubItemId === 'kanban-todo' ? ['TODO', 'IN_PROGRESS', 'BLOCKED'] : ['DONE'];
      const filtered = tasks.filter(t => matchStatus.includes(t.status));
      return (
        <div className={themeClass} style={{ ...styles.container, backgroundColor: containerBg }}>
          {renderCategoryTabBar()}
          <div style={styles.wrapper}>
            <h1 style={styles.visualTitle}>
              {selectedSubItemId === 'kanban-todo' ? '📋 待辦工單列表 (To Do Tasks)' : '✅ 已完成工單列表 (Completed Tasks)'}
            </h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              {filtered.length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }}>無對應狀態的任務工單。</div>
              ) : (
                filtered.map(t => (
                  <div key={t.id} style={{ ...styles.charterBlock, padding: '16px', cursor: 'pointer' }} onClick={() => setSelectedModalTaskId(t.id)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{t.title}</strong>
                      <span className={`nature-tag`} style={{ background: t.status === 'DONE' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: t.status === 'DONE' ? 'var(--color-done)' : 'var(--color-blocked)' }}>{t.status}</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>{extractPlainText(t.description) || '無描述'}</p>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>負責人: {members.find(mem => String(mem.member_id) === String(t.item_follow_by))?.member_name || '未指派'} | 建立於: {formatDateString(t.created_at)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        {renderAllOverlays()}
      </div>
    );
    }

    if (selectedSubItemId === 'kanban-calendar') {
      // Calendar Month grid generator for May 2026
      const startCell = new Date(2026, 3, 26); // April 26, 2026 (Sunday)
      const dayCells: Date[] = [];
      for (let i = 0; i < 42; i++) {
        const d = new Date(startCell);
        d.setDate(startCell.getDate() + i);
        dayCells.push(d);
      }

      const activeEvents = selectedCalendarDay ? [
        ...tasks.filter(t => new Date(t.created_at).toDateString() === selectedCalendarDay.toDateString()).map(t => ({ type: 'task', id: t.id, title: `Task: ${t.title}` })),
        ...plans.filter(p => new Date(p.milestone_date).toDateString() === selectedCalendarDay.toDateString()).map(p => ({ type: 'plan', id: p.id, title: `WBS: ${p.title}` }))
      ] : [];

      return (
        <div className={themeClass} style={{ ...styles.container, backgroundColor: containerBg }}>
          {renderCategoryTabBar()}
          <div style={styles.wrapper}>
            <h1 style={styles.visualTitle}>📅 專案行事曆 (Calendar View) - 2026年5月</h1>
            <div className="calendar-container" style={{ marginTop: '16px' }}>
              <div className="calendar-grid">
                {['日', '一', '二', '三', '四', '五', '六'].map((day, i) => (
                  <div key={i} className="calendar-day-name">{day}</div>
                ))}
                {dayCells.map((day, idx) => {
                  const isOtherMonth = day.getMonth() !== 4; // Not May
                  const isToday = day.getDate() === 25 && day.getMonth() === 4 && day.getFullYear() === 2026;
                  const dayTasks = tasks.filter(t => new Date(t.created_at).toDateString() === day.toDateString());
                  const dayPlans = plans.filter(p => new Date(p.milestone_date).toDateString() === day.toDateString());

                  return (
                    <div
                      key={idx}
                      className={`calendar-cell ${isOtherMonth ? 'calendar-cell-other-month' : ''} ${isToday ? 'calendar-cell-today' : ''}`}
                      onClick={() => setSelectedCalendarDay(day)}
                    >
                      <div className="calendar-cell-num">{day.getDate()}</div>
                      <div className="calendar-cell-indicators">
                        {dayTasks.slice(0, 2).map((t, i) => (
                          <div 
                            key={i} 
                            className="calendar-event-pill calendar-event-task"
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedModalTaskId(t.id);
                            }}
                          >
                            {t.title}
                          </div>
                        ))}
                        {dayPlans.slice(0, 1).map((p, i) => <div key={i} className="calendar-event-pill calendar-event-plan">{p.title}</div>)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Day Details panel */}
              <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', padding: '20px', borderRadius: '12px' }}>
                <h3 style={styles.sectionTitle}>
                  {selectedCalendarDay ? `${selectedCalendarDay.getMonth() + 1}月${selectedCalendarDay.getDate()}日 的日程安排` : '請點選日期查看日程'}
                </h3>
                {selectedCalendarDay ? (
                  activeEvents.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px' }}>本日無任務工單或 WBS 里程碑。</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                      {activeEvents.map((ev, i) => (
                        <div 
                          key={i} 
                          style={{ 
                            padding: '8px 12px', 
                            background: 'rgba(0,0,0,0.2)', 
                            borderLeft: ev.type === 'task' ? '3px solid var(--accent-primary)' : '3px solid var(--accent-secondary)', 
                            borderRadius: '4px', 
                            fontSize: '13px',
                            cursor: ev.type === 'task' ? 'pointer' : 'default'
                          }}
                          onClick={() => {
                            if (ev.type === 'task') {
                              setSelectedModalTaskId(ev.id);
                            }
                          }}
                        >
                          {ev.title}
                        </div>
                      ))}
                    </div>
                  )
                ) : null}
              </div>
            </div>
          </div>
        {renderAllOverlays()}
      </div>
    );
    }
  }

  // 1.5 Table View Visualizers for Tasks, Projects (Requirements), Meetings, Bottlenecks, and Knowledge
  if (selectedSubItemId === 'product-table') {
    return (
      <div className={themeClass} style={{ ...styles.container, backgroundColor: containerBg }}>
        {renderCategoryTabBar()}
        
        <div style={styles.wrapper}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h1 style={{ ...styles.visualTitle, color: getTitleColor(), borderBottomColor: getBorderColor(), margin: 0, padding: 0 }}>📊 產品大主表 (Product Context Table View)</h1>
            {renderTemplateDropdown('product_context')}
          </div>
          {(() => {
            const productColumns = [
              {
                id: 'id',
                header: 'ID',
                cell: (p: any) => <span style={{ fontWeight: 'bold' }}>{p.id}</span>
              },
              {
                id: 'content_display_id',
                header: '產品代號 (Display ID)',
                cell: (p: any) => (
                  <span 
                    style={{ fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--accent-secondary)', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={(e) => { e.stopPropagation(); setSelectedModalProductId(p.id); }}
                  >
                    {p.content_display_id}
                  </span>
                )
              },
              {
                id: 'content_name',
                header: '產品名稱 (Name)',
                cell: (p: any) => {
                  if (inlineEditProductId === p.id && inlineEditProductField === 'content_name') {
                    return (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <input
                          autoFocus
                          value={inlineEditProductData.content_name || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={e => setInlineEditProductData({ ...inlineEditProductData, content_name: e.target.value })}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              try {
                                if (onUpdateProduct) await onUpdateProduct(p.id, { name: inlineEditProductData.content_name, remarks_entry: 'Inline Update' });
                                if (onRefreshData) await onRefreshData();
                                setInlineEditProductId(null);
                                setInlineEditProductField(null);
                              } catch(err) { alert('更新失敗'); }
                            } else if (e.key === 'Escape') {
                              setInlineEditProductId(null);
                              setInlineEditProductField(null);
                            }
                          }}
                          style={{ flex: 1, padding: '2px 4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', outline: 'none' }}
                        />
                        <button style={{ background: 'transparent', border: 'none', color: '#10B981', cursor: 'pointer', padding: '2px' }}
                          onMouseDown={async (e) => {
                            e.preventDefault();
                            try {
                              if (onUpdateProduct) await onUpdateProduct(p.id, { name: inlineEditProductData.content_name, remarks_entry: 'Inline Update' });
                              if (onRefreshData) await onRefreshData();
                              setInlineEditProductId(null);
                              setInlineEditProductField(null);
                            } catch(err) { alert('更新失敗'); }
                          }}
                        >✓</button>
                        <button style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
                          onMouseDown={(e) => { e.preventDefault(); setInlineEditProductId(null); setInlineEditProductField(null); }}
                        >✕</button>
                      </div>
                    );
                  }
                  return (
                    <span 
                      style={{ fontWeight: 'bold', cursor: 'text' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setInlineEditProductId(p.id);
                        setInlineEditProductField('content_name');
                        setInlineEditProductData({ content_name: p.content_name });
                      }}
                    >📁 {p.content_name}</span>
                  );
                }
              },
              {
                id: 'content_type',
                header: '類型 (Content Type)',
                cell: (p: any) => <span className="nature-tag" style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#4ADE80' }}>{p.content_type}</span>
              },
              {
                id: 'related_workspace_id',
                header: '工作空間 ID (Workspace ID)',
                cell: (p: any) => p.related_workspace_id || '—'
              },
              {
                id: 'content_status',
                header: '狀態 (Status)',
                cell: (p: any) => {
                  if (inlineEditProductId === p.id && inlineEditProductField === 'content_status') {
                    return (
                      <ThemedSelect
                        autoFocus
                        value={inlineEditProductData.content_status || ''}
                        onClick={(e) => e.stopPropagation()}
                        onChange={async (e) => {
                          const val = e.target.value;
                          setInlineEditProductData({ ...inlineEditProductData, content_status: val });
                          try {
                            if (onUpdateProduct) await onUpdateProduct(p.id, { content_status: val, remarks_entry: 'Inline Update' });
                            if (onRefreshData) await onRefreshData();
                            setInlineEditProductId(null);
                            setInlineEditProductField(null);
                          } catch(err) { alert('更新失敗'); }
                        }}
                        onBlur={() => { setInlineEditProductId(null); setInlineEditProductField(null); }}
                        style={{ width: '100%', padding: '4px', background: 'rgba(30,41,59,1)', border: '1px solid var(--accent-primary)', color: 'white', borderRadius: '4px', outline: 'none' }}
                      >
                        <option value="Pipeline">Pipeline</option>
                        <option value="Active">Active</option>
                        <option value="On Hold">On Hold</option>
                        <option value="Completed">Completed</option>
                        <option value="Abandoned">Abandoned</option>
                      </ThemedSelect>
                    );
                  }
                  return (
                    <span 
                      className="status-badge-progress"
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setInlineEditProductId(p.id);
                        setInlineEditProductField('content_status');
                        setInlineEditProductData({ content_status: p.content_status });
                      }}
                    >● {p.content_status}</span>
                  );
                }
              },
              {
                id: 'content_json',
                header: '額外內容 (Content JSON)',
                cell: (p: any) => (
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {JSON.stringify(p.content)}
                  </span>
                )
              },
              {
                id: 'content_created_at',
                header: '建立時間 (Created At)',
                cell: (p: any) => formatChineseDateTime(p.content_created_at)
              },
              {
                id: 'updated_at',
                header: '更新時間 (Updated At)',
                cell: (p: any) => formatChineseDateTime(p.updated_at)
              },
              ...getRemainingProjectContextColumns(workspaces, products, ['id', 'content_display_id', 'content_name', 'content_type', 'related_workspace_id', 'content_status', 'content_json', 'content_created_at', 'updated_at'])
            ];

            return (
              <>
                <TableViewToolbar data={filteredProducts} columns={productColumns} state={toolbarState} onChange={setToolbarState} />
                <AdvancedTable
                tableId="product_large_main_table"
                data={applyToolbar(filteredProducts, productColumns)}
                columns={getVisibleColumns(productColumns)}
                onRowClick={(p) => {
                  // Reverting the onRowClick behaviour as we use cell clicks now
                  setSelectedModalProductId(p.id);
                }}
              />
              </>
            );
          })()}

          {/* Frozen New Item Row */}
          <div style={{
            borderTop: '1px solid ' + getBorderColor(),
            padding: '12px 16px',
            backgroundColor: containerBg,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            {inlineCreatingProductOpen ? (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
                <input
                  type="text"
                  autoFocus
                  placeholder="輸入產品名稱..."
                  value={inlineCreatingProductTitle}
                  onChange={(e) => setInlineCreatingProductTitle(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && inlineCreatingProductTitle.trim()) {
                      try {
                        const wsId = filterWorkspace || workspaces[0]?.workspace_id || 'a0000000-0000-0000-0000-000000000001';
                        const newProduct = await api.createProduct({
                          id: 'PROD-' + Date.now(),
                          name: inlineCreatingProductTitle,
                          business_owner: 'Unassigned',
                          tech_owner: 'Unassigned',
                          product_vision: '請在此輸入產品願景。',
                          related_workspace_id: wsId,
                          remarks_entry: '從 Product View 新增產品'
                        });
                        if (onRefreshData) await onRefreshData();
                        setSelectedModalProductId(newProduct.id);
                        setIsEditing(true);
                        setInlineCreatingProductTitle('');
                        setInlineCreatingProductOpen(false);
                      } catch (err) { alert('建立失敗'); }
                    } else if (e.key === 'Escape') {
                      setInlineCreatingProductOpen(false);
                    }
                  }}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    border: 'none',
                    borderBottom: '1px solid var(--accent-primary)',
                    outline: 'none',
                    padding: '8px',
                    fontSize: '13px'
                  }}
                />
                <button 
                  onClick={async () => {
                    if (inlineCreatingProductTitle.trim()) {
                      try {
                        const wsId = filterWorkspace || workspaces[0]?.workspace_id || 'a0000000-0000-0000-0000-000000000001';
                        const newProduct = await api.createProduct({
                          id: 'PROD-' + Date.now(),
                          name: inlineCreatingProductTitle,
                          business_owner: 'Unassigned',
                          tech_owner: 'Unassigned',
                          product_vision: '請在此輸入產品願景。',
                          related_workspace_id: wsId,
                          remarks_entry: '從 Product View 新增產品'
                        });
                        if (onRefreshData) await onRefreshData();
                        setSelectedModalProductId(newProduct.id);
                        setIsEditing(true);
                        setInlineCreatingProductTitle('');
                        setInlineCreatingProductOpen(false);
                      } catch (err) { alert('建立失敗'); }
                    }
                  }}
                  style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                >
                  Save
                </button>
                <button onClick={() => setInlineCreatingProductOpen(false)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
              </div>
            ) : (
              <div 
                style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px', width: '100%', display: 'flex', alignItems: 'center' }}
                onClick={() => { setInlineCreatingProductOpen(true); setInlineCreatingProductTitle(''); }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-primary)'} 
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <span style={{ marginRight: '6px', fontSize: '16px' }}>+</span>新增頁面
              </div>
            )}
          </div>

        </div>
        {renderAllOverlays()}
      </div>
    );
  }

  if (selectedSubItemId === 'product-gallery') {
    return (
      <div className={themeClass} style={{ ...styles.container, backgroundColor: containerBg }}>
        {renderCategoryTabBar()}
        
        <div style={styles.wrapper}>
          <h1 style={{ ...styles.visualTitle, color: getTitleColor(), borderBottomColor: getBorderColor() }}>🎴 產品圖庫視圖 (Product Gallery View)</h1>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginTop: '10px' }}>
            {filteredProducts.map(p => {
              const associatedProjects = projects.filter(proj => String(proj.product_id) === String(p.id));
              return (
                <div 
                  key={p.id} 
                  className="glass-panel" 
                  style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer' }}
                  onClick={() => setSelectedModalProductId(p.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--accent-secondary)', fontWeight: 'bold' }}>📁 {p.id}</span>
                    <span className="relation-badge relation-badge-project">{associatedProjects.length} 專案</span>
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <div>👤 Owner: <strong>{p.business_owner || '—'}</strong></div>
                    <div>💻 Tech: <strong>{p.tech_owner || '—'}</strong></div>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', fontStyle: 'italic', margin: '4px 0' }}>
                    🚀 {p.product_vision || '無願景說明'}
                  </p>
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <div>📅 建立時間：{formatChineseDateTime(p.created_at)}</div>
                    <div>🔄 更新時間：{formatChineseDateTime(p.updated_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {renderAllOverlays()}
      </div>
    );
  }

  if (selectedSubItemId === 'task-table' || (activeTab === 'tasks' && !!currentTask)) {
    return (
      <div className={themeClass} style={{ ...styles.container, backgroundColor: containerBg, overflowY: 'hidden' }}>
        {renderCategoryTabBar()}
        
        <div style={{ ...styles.wrapper, flex: 1, overflow: 'hidden' }}>
          <div style={{
            borderBottom: '1px solid ' + getBorderColor(),
            paddingBottom: '16px',
            marginBottom: '16px',
          }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: getTitleColor(), margin: 0, padding: 0 }}>📊 所有工單總表 (Task Table View)</h1>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px', gap: '4px' }}>
              {(['List', 'Kanban', 'Timeline', 'Calendar'] as const).map(view => (
                <button
                  key={view}
                  onClick={() => setActiveTaskView(view)}
                  style={{
                    background: activeTaskView === view ? 'var(--accent-primary)' : 'transparent',
                    color: activeTaskView === view ? '#fff' : 'var(--text-secondary)',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    transition: 'all 0.2s'
                  }}
                >
                  {view === 'List' ? '≣ List' : view === 'Kanban' ? '◫ Kanban' : view === 'Timeline' ? '◤ Timeline' : '📅 Calendar'}
                </button>
              ))}
            </div>
            
            <div>
              {renderTemplateDropdown('task_context', 1)} {/* Default context_id 1 for global tasks */}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px', color: 'var(--text-muted)', fontSize: '13px', paddingLeft: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <span style={{ fontSize: '14px' }}>🔍</span> Search
            </div>
            <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.15)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <span style={{ fontSize: '14px' }}>👤</span> Person
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <span style={{ fontSize: '14px' }}>⽄</span> Filter <span style={{ fontSize: '10px', marginLeft: '2px' }}>⌄</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <span style={{ fontSize: '14px' }}>⇅</span> Sort
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <span style={{ fontSize: '14px' }}>👁️</span> Hide
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <span style={{ fontSize: '14px' }}>◫</span> Group by
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              ...
            </div>
          </div>
          {activeTaskView === 'List' && (() => {
            // Build hierarchy
            const taskMap = new Map<string, any>();
            filteredTasks.forEach(t => taskMap.set(String(t.id), t));
            
            const rootTasks: any[] = [];
            const childTasksMap = new Map<string, any[]>();
            
            filteredTasks.forEach(t => {
              const pid = t.parent_item_id;
              const hasValidParent = pid && taskMap.has(String(pid));
              if (!hasValidParent) {
                rootTasks.push(t);
              } else {
                const pidStr = String(pid);
                if (!childTasksMap.has(pidStr)) childTasksMap.set(pidStr, []);
                childTasksMap.get(pidStr)!.push(t);
              }
            });

            const flattenTree = (tasks: any[], depth: number, visited: Set<string>): any[] => {
              let result: any[] = [];
              tasks.forEach(t => {
                const idStr = String(t.id);
                if (visited.has(idStr)) return; // Prevent infinite loops
                visited.add(idStr);
                
                const children = childTasksMap.get(idStr) || [];
                const hasChildren = children.length > 0;
                result.push({ ...t, _depth: depth, _hasChildren: hasChildren });
                
                if (expandedTaskIds.has(idStr) && hasChildren) {
                  result = result.concat(flattenTree(children, depth + 1, new Set(visited)));
                }
              });
              return result;
            };

            const hierarchicalTasks = flattenTree(rootTasks, 0, new Set());

            const taskColumns = [
              {
                id: 'id',
                header: 'ID',
                cell: (t: any) => <span style={{ fontWeight: 'bold' }}>{t.id}</span>
              },
              {
                id: 'item_display_id',
                header: '代號 (Display ID)',
                cell: (t: any) => (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: `${(t._depth || 0) * 20}px` }}>
                    {t._hasChildren ? (
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          const newSet = new Set(expandedTaskIds);
                          const idStr = String(t.id);
                          if (newSet.has(idStr)) newSet.delete(idStr);
                          else newSet.add(idStr);
                          setExpandedTaskIds(newSet);
                        }}
                        style={{ cursor: 'pointer', width: '16px', display: 'inline-block', textAlign: 'center', userSelect: 'none', color: 'var(--text-secondary)' }}
                      >
                        {expandedTaskIds.has(String(t.id)) ? '▼' : '▶'}
                      </span>
                    ) : (
                      <span style={{ width: '16px', display: 'inline-block' }}></span>
                    )}
                    <span 
                      onClick={() => setSelectedModalTaskId(t.id)}
                      style={{ fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--accent-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', textDecoration: 'underline' }} 
                      title={t.item_type || 'Task'}
                    >
                      <span>{getItemTypeStyles(t.item_type || 'Task').icon}</span> {t.item_display_id}
                    </span>
                  </span>
                )
              },
              {
                id: 'item_title',
                header: '任務標題 (Title)',
                cell: (t: any) => {
                  return inlineEditingTraceTitleFor === String(t.id) ? (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <input
                        autoFocus
                        value={inlineEditingTraceTitleValue}
                        onChange={e => setInlineEditingTraceTitleValue(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            try {
                              await api.updateTask(t.id, { ...t, item_title: inlineEditingTraceTitleValue });
                              if (onRefreshData) await onRefreshData();
                              setInlineEditingTraceTitleFor(null);
                            } catch(err) { alert('更新失敗'); }
                          } else if (e.key === 'Escape') {
                            setInlineEditingTraceTitleFor(null);
                          }
                        }}
                        style={{ flex: 1, fontSize: '13px', padding: '2px 4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', outline: 'none', borderRadius: '4px', minWidth: '150px' }}
                      />
                      <button style={{ background: 'transparent', border: 'none', color: '#10B981', cursor: 'pointer', padding: '2px' }}
                        onMouseDown={async (e) => {
                          e.preventDefault();
                          try {
                            await api.updateTask(t.id, { ...t, item_title: inlineEditingTraceTitleValue });
                            if (onRefreshData) await onRefreshData();
                            setInlineEditingTraceTitleFor(null);
                          } catch(err) { alert('更新失敗'); }
                        }}
                      >✓</button>
                      <button style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
                        onMouseDown={(e) => { e.preventDefault(); setInlineEditingTraceTitleFor(null); }}
                      >✕</button>
                    </div>
                  ) : (
                    <span 
                      style={{ fontWeight: 'bold', cursor: 'text' }}
                      onClick={() => {
                        setInlineEditingTraceTitleFor(String(t.id));
                        setInlineEditingTraceTitleValue(t.item_title || t.title || '');
                      }}
                    >📄 {t.item_title}</span>
                  );
                }
              },
              {
                id: 'related_context_id',
                header: '關聯專案 (Context ID)',
                cell: (t: any) => (
                  <span className="relation-badge relation-badge-project">
                    {projects.find(p => String(p.id) === String(t.related_context_id))?.name || t.related_context_id || '—'}
                  </span>
                )
              },
              {
                id: 'item_type',
                header: '性質 (Item Type)',
                cell: (t: any) => {
                  return inlineEditingTypeFor === String(t.id) ? (
                    <ThemedSelect 
                      autoFocus
                      defaultValue={t.item_type || 'Task'}
                      style={{ fontSize: '11px', padding: '2px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: 'none', outline: 'none', borderRadius: '4px' }}
                      onBlur={() => setInlineEditingTypeFor(null)}
                      onChange={async (e) => {
                        try {
                          await api.updateTask(t.id, { ...t, item_type: e.target.value });
                          if (onRefreshData) await onRefreshData();
                          setInlineEditingTypeFor(null);
                        } catch(err) { alert('更新失敗'); }
                      }}
                    >
                      {['Charter', 'Epic', 'Task', 'Event', 'Micro Task', 'Meeting', 'Bottleneck', 'Knowledge', 'Casual Note', 'Bug', 'UAT', 'Deployment', 'Milestone', 'Business Objective', 'Business Requirement', 'User Story'].map(s => <option key={s} value={s}>{s}</option>)}
                    </ThemedSelect>
                  ) : (
                    <span 
                      className="nature-tag" 
                      style={{ backgroundColor: `${getItemTypeStyles(t.item_type || 'Task').bg}20`, color: getItemTypeStyles(t.item_type || 'Task').text, padding: '2px 6px', borderRadius: '4px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); setInlineEditingTypeFor(String(t.id)); }}
                    >
                      <span>{getItemTypeStyles(t.item_type || 'Task').icon}</span> {t.item_type}
                    </span>
                  );
                }
              },
              {
                id: 'item_status',
                header: '狀態 (Item Status)',
                cell: (t: any) => {
                  return inlineEditingTraceStatusFor === String(t.id) ? (
                    <ThemedSelect 
                      autoFocus
                      defaultValue={t.item_status || 'Not Start'}
                      style={{ fontSize: '11px', padding: '2px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: 'none', outline: 'none', borderRadius: '4px' }}
                      onBlur={() => setInlineEditingTraceStatusFor(null)}
                      onChange={async (e) => {
                        try {
                          await api.updateTask(t.id, { ...t, item_status: e.target.value });
                          if (onRefreshData) await onRefreshData();
                          setInlineEditingTraceStatusFor(null);
                        } catch(err) { alert('更新失敗'); }
                      }}
                    >
                      {['Not Start', 'Ready', 'In Progress', 'Stuck', 'Review', 'Completed', 'Closed', 'Backlog'].map(s => <option key={s} value={s}>{s}</option>)}
                    </ThemedSelect>
                  ) : (
                    <span style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setInlineEditingTraceStatusFor(String(t.id)); }}>
                      {getItemStatusBadge(t.item_status || 'Not Start')}
                    </span>
                  );
                }
              },
              {
                id: 'item_priority',
                header: '優先級 (Item Priority)',
                cell: (t: any) => {
                  return inlineEditingPriorityFor === String(t.id) ? (
                    <ThemedSelect 
                      autoFocus
                      defaultValue={t.item_priority || 'Middle'}
                      style={{ fontSize: '11px', padding: '2px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: 'none', outline: 'none', borderRadius: '4px' }}
                      onBlur={() => setInlineEditingPriorityFor(null)}
                      onChange={async (e) => {
                        try {
                          await api.updateTask(t.id, { ...t, item_priority: e.target.value });
                          if (onRefreshData) await onRefreshData();
                          setInlineEditingPriorityFor(null);
                        } catch(err) { alert('更新失敗'); }
                      }}
                    >
                      {['High', 'Middle', 'Low'].map(s => <option key={s} value={s}>{s}</option>)}
                    </ThemedSelect>
                  ) : (
                    <span 
                      className={
                        t.item_priority === 'High' ? 'priority-high' :
                        t.item_priority === 'Low' ? 'priority-low' : 'priority-middle'
                      }
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); setInlineEditingPriorityFor(String(t.id)); }}
                    >{t.item_priority}</span>
                  );
                }
              },
              {
                id: 'item_planned_start_date',
                header: '預計開始 (Planned Start)',
                cell: (t: any) => {
                  return inlineEditingPlannedStartFor === String(t.id) ? (
                    <input 
                      type="date"
                      autoFocus
                      value={t.item_planned_start_date ? t.item_planned_start_date.split('T')[0] : ''}
                      onBlur={() => setInlineEditingPlannedStartFor(null)}
                      onChange={async (e) => {
                        try {
                          await api.updateTask(t.id, { ...t, item_planned_start_date: e.target.value || null });
                          if (onRefreshData) await onRefreshData();
                          setInlineEditingPlannedStartFor(null);
                        } catch(err) { alert('更新失敗'); }
                      }}
                      style={{ fontSize: '11px', padding: '2px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: 'none', outline: 'none', borderRadius: '4px' }}
                    />
                  ) : (
                    <span style={{ cursor: 'pointer', display: 'inline-block', minHeight: '18px', minWidth: '40px' }} onClick={(e) => { e.stopPropagation(); setInlineEditingPlannedStartFor(String(t.id)); }}>
                      {formatChineseDate(t.item_planned_start_date) || '—'}
                    </span>
                  );
                }
              },
              {
                id: 'item_planned_end_date',
                header: '預計結束 (Planned End)',
                cell: (t: any) => {
                  return inlineEditingPlannedEndFor === String(t.id) ? (
                    <input 
                      type="date"
                      autoFocus
                      value={t.item_planned_end_date ? t.item_planned_end_date.split('T')[0] : ''}
                      onBlur={() => setInlineEditingPlannedEndFor(null)}
                      onChange={async (e) => {
                        try {
                          await api.updateTask(t.id, { ...t, item_planned_end_date: e.target.value || null });
                          if (onRefreshData) await onRefreshData();
                          setInlineEditingPlannedEndFor(null);
                        } catch(err) { alert('更新失敗'); }
                      }}
                      style={{ fontSize: '11px', padding: '2px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: 'none', outline: 'none', borderRadius: '4px' }}
                    />
                  ) : (
                    <span style={{ cursor: 'pointer', display: 'inline-block', minHeight: '18px', minWidth: '40px' }} onClick={(e) => { e.stopPropagation(); setInlineEditingPlannedEndFor(String(t.id)); }}>
                      {formatChineseDate(t.item_planned_end_date) || '—'}
                    </span>
                  );
                }
              },
              {
                id: 'item_actual_start_date',
                header: '實際開始 (Actual Start)',
                cell: (t: any) => {
                  return inlineEditingActualStartFor === String(t.id) ? (
                    <input 
                      type="date"
                      autoFocus
                      value={t.item_actual_start_date ? t.item_actual_start_date.split('T')[0] : ''}
                      onBlur={() => setInlineEditingActualStartFor(null)}
                      onChange={async (e) => {
                        try {
                          await api.updateTask(t.id, { ...t, item_actual_start_date: e.target.value || null });
                          if (onRefreshData) await onRefreshData();
                          setInlineEditingActualStartFor(null);
                        } catch(err) { alert('更新失敗'); }
                      }}
                      style={{ fontSize: '11px', padding: '2px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: 'none', outline: 'none', borderRadius: '4px' }}
                    />
                  ) : (
                    <span style={{ cursor: 'pointer', display: 'inline-block', minHeight: '18px', minWidth: '40px' }} onClick={(e) => { e.stopPropagation(); setInlineEditingActualStartFor(String(t.id)); }}>
                      {formatChineseDate(t.item_actual_start_date) || '—'}
                    </span>
                  );
                }
              },
              {
                id: 'item_actual_end_date',
                header: '實際結束 (Actual End)',
                cell: (t: any) => {
                  return inlineEditingActualEndFor === String(t.id) ? (
                    <input 
                      type="date"
                      autoFocus
                      value={t.item_actual_end_date ? t.item_actual_end_date.split('T')[0] : ''}
                      onBlur={() => setInlineEditingActualEndFor(null)}
                      onChange={async (e) => {
                        try {
                          await api.updateTask(t.id, { ...t, item_actual_end_date: e.target.value || null });
                          if (onRefreshData) await onRefreshData();
                          setInlineEditingActualEndFor(null);
                        } catch(err) { alert('更新失敗'); }
                      }}
                      style={{ fontSize: '11px', padding: '2px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)', border: 'none', outline: 'none', borderRadius: '4px' }}
                    />
                  ) : (
                    <span style={{ cursor: 'pointer', display: 'inline-block', minHeight: '18px', minWidth: '40px' }} onClick={(e) => { e.stopPropagation(); setInlineEditingActualEndFor(String(t.id)); }}>
                      {formatChineseDate(t.item_actual_end_date) || '—'}
                    </span>
                  );
                }
              },
              {
                id: 'item_follow_by',
                header: '負責人 (Follow By)',
                cell: (t: any) => {
                  return inlineEditingFollowByFor === String(t.id) ? (
                    <div style={{ minWidth: '150px' }} onClick={(e) => e.stopPropagation()}>
                      <CreatableSelect
                        autoFocus
                        menuPortalTarget={document.body}
                        styles={{
                          ...reactSelectStyles,
                          menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
                          control: (base: any) => ({ ...base, minHeight: '28px', height: '28px', fontSize: '11px', backgroundColor: 'rgba(255,255,255,0.1)', border: 'none' }),
                          dropdownIndicator: (base: any) => ({ ...base, padding: '2px' }),
                          clearIndicator: (base: any) => ({ ...base, padding: '2px' }),
                          valueContainer: (base: any) => ({ ...base, padding: '0 4px' })
                        }}
                        value={t.item_follow_by ? { value: String(t.item_follow_by), label: members.find(m => String(m.member_id) === String(t.item_follow_by))?.member_name || t.item_follow_by } : null}
                        onChange={async (selected: any) => {
                          try {
                            const followByVal = selected && selected.value ? parseInt(selected.value, 10) : null;
                            await api.updateTask(t.id, { ...t, item_follow_by: followByVal });
                            if (onRefreshData) await onRefreshData();
                            setInlineEditingFollowByFor(null);
                          } catch(err) { alert('更新失敗'); }
                        }}
                        onCreateOption={async (inputValue: string) => {
                          const trimmed = inputValue.trim();
                          if (!trimmed) return;
                          try {
                            const newMem = await api.createMember({ member_name: trimmed, member_email: null, member_role: 'Developer', member_status: 'Active' });
                            await api.updateTask(t.id, { ...t, item_follow_by: newMem.member_id });
                            if (onRefreshData) await onRefreshData();
                            setInlineEditingFollowByFor(null);
                          } catch (err: any) { alert('新增成員失敗: ' + (err.message || String(err))); }
                        }}
                        options={members.map(m => ({ value: String(m.member_id), label: m.member_name }))}
                        placeholder="選擇..."
                        isClearable
                        onBlur={() => setInlineEditingFollowByFor(null)}
                      />
                    </div>
                  ) : (
                    <span style={{ cursor: 'pointer', display: 'inline-block', minHeight: '18px', minWidth: '40px' }} onClick={(e) => { e.stopPropagation(); setInlineEditingFollowByFor(String(t.id)); }}>
                      {members.find(mem => String(mem.member_id) === String(t.item_follow_by))?.member_name || t.item_follow_by || '—'}
                    </span>
                  );
                }
              },
              {
                id: 'item_assigned_by',
                header: '指派者 (Assigner)',
                cell: (t: any) => {
                  return inlineEditingAssignedByFor === String(t.id) ? (
                    <div style={{ minWidth: '150px' }} onClick={(e) => e.stopPropagation()}>
                      <CreatableSelect
                        autoFocus
                        menuPortalTarget={document.body}
                        styles={{
                          ...reactSelectStyles,
                          menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
                          control: (base: any) => ({ ...base, minHeight: '28px', height: '28px', fontSize: '11px', backgroundColor: 'rgba(255,255,255,0.1)', border: 'none' }),
                          dropdownIndicator: (base: any) => ({ ...base, padding: '2px' }),
                          clearIndicator: (base: any) => ({ ...base, padding: '2px' }),
                          valueContainer: (base: any) => ({ ...base, padding: '0 4px' })
                        }}
                        value={t.item_assigned_by ? { value: String(t.item_assigned_by), label: members.find(m => String(m.member_id) === String(t.item_assigned_by))?.member_name || t.item_assigned_by } : null}
                        onChange={async (selected: any) => {
                          try {
                            const assignedByVal = selected && selected.value ? parseInt(selected.value, 10) : null;
                            await api.updateTask(t.id, { ...t, item_assigned_by: assignedByVal });
                            if (onRefreshData) await onRefreshData();
                            setInlineEditingAssignedByFor(null);
                          } catch(err) { alert('更新失敗'); }
                        }}
                        onCreateOption={async (inputValue: string) => {
                          const trimmed = inputValue.trim();
                          if (!trimmed) return;
                          try {
                            const newMem = await api.createMember({ member_name: trimmed, member_email: null, member_role: 'Developer', member_status: 'Active' });
                            await api.updateTask(t.id, { ...t, item_assigned_by: newMem.member_id });
                            if (onRefreshData) await onRefreshData();
                            setInlineEditingAssignedByFor(null);
                          } catch (err: any) { alert('新增成員失敗: ' + (err.message || String(err))); }
                        }}
                        options={members.map(m => ({ value: String(m.member_id), label: m.member_name }))}
                        placeholder="選擇..."
                        isClearable
                        onBlur={() => setInlineEditingAssignedByFor(null)}
                      />
                    </div>
                  ) : (
                    <span style={{ cursor: 'pointer', display: 'inline-block', minHeight: '18px', minWidth: '40px' }} onClick={(e) => { e.stopPropagation(); setInlineEditingAssignedByFor(String(t.id)); }}>
                      {members.find(mem => String(mem.member_id) === String(t.item_assigned_by))?.member_name || t.item_assigned_by || '—'}
                    </span>
                  );
                }
              },
              {
                id: 'item_content',
                header: '詳細內容 (Content JSON)',
                cell: (t: any) => (
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {JSON.stringify(t.item_content)}
                  </span>
                )
              },
              {
                id: 'parent_item_id',
                header: '父工單 (Parent Item ID)',
                cell: (t: any) => (
                  <span>{t.parent_item_id || ''}</span>
                )
              },
              {
                id: 'related_item_id_relation',
                header: '關聯工單 (Related Items)',
                cell: (t: any) => (
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {JSON.stringify(t.related_item_id_relation || [])}
                  </span>
                )
              },
              {
                id: 'item_comment',
                header: '工單評論 (Comments JSON)',
                cell: (t: any) => (
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {JSON.stringify(t.item_comment || [])}
                  </span>
                )
              },
              {
                id: 'item_update_log',
                header: '變更日誌 (Update Log JSON)',
                cell: (t: any) => (
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {JSON.stringify(t.item_update_log || [])}
                  </span>
                )
              },
              {
                id: 'item_created_at',
                header: '創建時間 (Created At)',
                cell: (t: any) => formatChineseDateTime(t.item_created_at)
              },
              {
                id: 'item_updated_at',
                header: '更新時間 (Updated At)',
                cell: (t: any) => formatChineseDateTime(t.item_updated_at)
              },
              ...getRemainingProjectItemColumns(members, workspaces, projects, ['id', 'item_display_id', 'item_title', 'related_context_id', 'parent_item_id', 'related_item_id_relation', 'item_type', 'item_status', 'item_priority', 'item_planned_start_date', 'item_planned_end_date', 'item_actual_start_date', 'item_actual_end_date', 'item_follow_by', 'item_assigned_by', 'item_content', 'item_comment', 'item_update_log', 'item_created_at', 'item_updated_at'])
            ];

            return (
              <>
                <TableViewToolbar data={hierarchicalTasks} columns={taskColumns} state={toolbarState} onChange={setToolbarState} />
                <AdvancedTable
                tableId="tasks_large_main_table"
                selectable={true}
                selectedRowIds={selectedTaskIds}
                onSelectionChange={setSelectedTaskIds}
                rowIdAccessor="id"
                data={applyToolbar(hierarchicalTasks, taskColumns)}
                columns={getVisibleColumns(taskColumns)}
                onSort={() => {}} // Disable sorting to maintain hierarchy
                sortConfig={null}
              />
              </>
            );
          })()}

          {activeTaskView === 'Kanban' && (
            <div style={{ display: 'flex', gap: '16px', padding: '16px', overflowX: 'auto', minHeight: '500px' }}>
              {['Not Start', 'Ready', 'In Progress', 'Stuck', 'Review', 'Completed', 'Closed', 'Backlog'].map(status => {
                const columnTasks = filteredTasks.filter(t => t.item_status === status);
                return (
                  <div 
                    key={status} 
                    onMouseEnter={() => setHoveredKanbanColumn(status)}
                    onMouseLeave={() => setHoveredKanbanColumn(null)}
                    style={{ 
                      minWidth: '300px', maxWidth: '300px', 
                      background: dragOverStatus === status ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)', 
                      borderRadius: '8px', padding: '12px', border: dragOverStatus === status ? '1px dashed var(--accent-primary)' : '1px solid var(--border-color)', 
                      display: 'flex', flexDirection: 'column', gap: '8px',
                      transition: 'all 0.2s',
                      maxHeight: 'calc(100vh - 250px)'
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverStatus !== status) setDragOverStatus(status);
                    }}
                    onDragLeave={() => setDragOverStatus(null)}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setDragOverStatus(null);
                      const taskId = e.dataTransfer.getData('text/plain');
                      if (taskId) {
                        try {
                          const taskToUpdate = tasks.find(t => String(t.id) === taskId);
                          if (taskToUpdate && taskToUpdate.item_status !== status) {
                            await api.updateTask(taskToUpdate.id, { ...taskToUpdate, item_status: status });
                            if (onRefreshData) await onRefreshData();
                          }
                        } catch (err) {
                          alert('更新狀態失敗');
                        }
                      }
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{status}</span>
                      <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>{columnTasks.length}</span>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                      {columnTasks.map(t => (
                        <div 
                          key={t.id} 
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', String(t.id));
                          }}
                          style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', cursor: 'grab', flexShrink: 0 }} 
                          onClick={() => setSelectedModalTaskId(t.id)}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{t.item_display_id}</span>
                            <span style={{ fontSize: '11px', background: `${getItemTypeStyles(t.item_type || 'Task').bg}20`, color: getItemTypeStyles(t.item_type || 'Task').text, padding: '2px 6px', borderRadius: '4px' }}>
                              {getItemTypeStyles(t.item_type || 'Task').icon} {t.item_type}
                            </span>
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px', lineHeight: '1.4' }}>{t.item_title}</div>
                          {t.item_follow_by && (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>👤 {members.find(m => String(m.member_id) === String(t.item_follow_by))?.member_name || t.item_follow_by}</div>
                          )}
                        </div>
                      ))}
                      {columnTasks.length === 0 && (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>無工單</div>
                      )}
                    </div>
                    
                    {kanbanInlineCreateStatus === status ? (
                      <div style={{ background: 'rgba(30, 41, 59, 0.9)', padding: '12px', borderRadius: '6px', border: '1px solid var(--accent-primary)', marginTop: '8px' }}>
                        <ThemedSelect 
                          value={kanbanInlineCreateType} 
                          onChange={(e) => setKanbanInlineCreateType(e.target.value)}
                          style={{ width: '100%', marginBottom: '8px', padding: '6px', borderRadius: '4px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', fontSize: '13px' }}
                        >
                          <option value="Task">Task</option>
                          <option value="Bug">Bug</option>
                          <option value="Milestone">Milestone</option>
                          <option value="UAT">UAT</option>
                          <option value="Deploy">Deploy</option>
                          <option value="Event">Event</option>
                          <option value="User Story">User Story</option>
                          <option value="Meeting">Meeting</option>
                          <option value="Bottleneck">Bottleneck</option>
                        </ThemedSelect>
                        <input 
                          type="text" 
                          placeholder="輸入名稱..."
                          value={kanbanInlineCreateTitle}
                          onChange={(e) => setKanbanInlineCreateTitle(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && kanbanInlineCreateTitle.trim()) {
                              try {
                                if (kanbanInlineCreateType === 'Meeting') {
                                  await api.createMeeting({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined,  item_title: kanbanInlineCreateTitle, content: '| 序號 | 討論事項 | 決議/行動方案 | 負責人 | 狀態 |\\n|---|---|---|---|---|\\n| 1 | 初始化 | 建立文件流水帳 | Edmond | 已完成 |', summary: '手動建立的會議記錄。', remarks_entry: '從 Kanban view 新增會議' });
                                } else if (kanbanInlineCreateType === 'Bottleneck') {
                                  await api.createBottleneck({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined,  item_title: kanbanInlineCreateTitle, description: '阻礙詳細說明...', severity: 'Middle', status: status, remarks_entry: '從 Kanban view 新增專案瓶頸' });
                                } else if (kanbanInlineCreateType === 'Knowledge') {
                                  await api.createKnowledge({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined,  item_title: kanbanInlineCreateTitle, definition: '定義內容...', kpi_formula: undefined, remarks_entry: '從 Kanban view 新增術語定義' });
                                } else {
                                  await api.createTask({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined,  item_title: kanbanInlineCreateTitle, item_type: kanbanInlineCreateType, item_status: status, item_priority: 'Middle', item_content: { description: `手動建立的${kanbanInlineCreateType}工單。` }, remarks_entry: `從 Kanban view 新增${kanbanInlineCreateType}` });
                                }
                                setKanbanInlineCreateStatus(null);
                                setKanbanInlineCreateTitle('');
                                if (onRefreshData) await onRefreshData();
                              } catch (err) {
                                alert('建立失敗');
                              }
                            }
                          }}
                          autoFocus
                          style={{ width: '100%', marginBottom: '8px', padding: '6px', borderRadius: '4px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', fontSize: '13px' }}
                        />
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button 
                            onClick={() => { setKanbanInlineCreateStatus(null); setKanbanInlineCreateTitle(''); }}
                            style={{ cursor: 'pointer', background: 'transparent', border: 'none', fontSize: '16px', color: 'var(--text-danger)' }}
                            title="取消"
                          >
                            ❌
                          </button>
                          <button 
                            onClick={async () => {
                              if (kanbanInlineCreateTitle.trim()) {
                                try {
                                  if (kanbanInlineCreateType === 'Meeting') {
                                    await api.createMeeting({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined,  item_title: kanbanInlineCreateTitle, content: '| 序號 | 討論事項 | 決議/行動方案 | 負責人 | 狀態 |\\n|---|---|---|---|---|\\n| 1 | 初始化 | 建立文件流水帳 | Edmond | 已完成 |', summary: '手動建立的會議記錄。', remarks_entry: '從 Kanban view 新增會議' });
                                  } else if (kanbanInlineCreateType === 'Bottleneck') {
                                    await api.createBottleneck({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined,  item_title: kanbanInlineCreateTitle, description: '阻礙詳細說明...', severity: 'Middle', status: status, remarks_entry: '從 Kanban view 新增專案瓶頸' });
                                  } else if (kanbanInlineCreateType === 'Knowledge') {
                                    await api.createKnowledge({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined,  item_title: kanbanInlineCreateTitle, definition: '定義內容...', kpi_formula: undefined, remarks_entry: '從 Kanban view 新增術語定義' });
                                  } else {
                                    await api.createTask({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined,  item_title: kanbanInlineCreateTitle, item_type: kanbanInlineCreateType, item_status: status, item_priority: 'Middle', item_content: { description: `手動建立的${kanbanInlineCreateType}工單。` }, remarks_entry: `從 Kanban view 新增${kanbanInlineCreateType}` });
                                  }
                                  setKanbanInlineCreateStatus(null);
                                  setKanbanInlineCreateTitle('');
                                  if (onRefreshData) await onRefreshData();
                                } catch (err) {
                                  alert('建立失敗');
                                }
                              }
                            }}
                            style={{ cursor: 'pointer', background: 'transparent', border: 'none', fontSize: '16px', color: 'var(--text-success)' }}
                            title="新增"
                          >
                            ✅
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ visibility: hoveredKanbanColumn === status ? 'visible' : 'hidden', textAlign: 'center', marginTop: 'auto', paddingTop: '8px' }}>
                        <button 
                          onClick={() => { setKanbanInlineCreateStatus(status); setKanbanInlineCreateTitle(''); }}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', fontSize: '13px', width: '100%', transition: 'color 0.2s' }}
                          onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                          onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                        >
                          + Create
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeTaskView === 'Timeline' && (() => {
            const tasksWithDates = filteredTasks.map(t => {
              const start = new Date(t.item_planned_start_date || t.item_created_at);
              let end = new Date(t.item_planned_end_date || t.item_planned_start_date || t.item_created_at);
              if (end < start) end = start;
              return { ...t, parsedStart: start, parsedEnd: end };
            });
            
            if (tasksWithDates.length === 0) {
              return <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>無任務資料</div>;
            }

            const minDate = new Date(Math.min(...tasksWithDates.map(t => t.parsedStart.getTime())));
            const maxDate = new Date(Math.max(...tasksWithDates.map(t => t.parsedEnd.getTime())));
            
            // Add some padding to dates
            minDate.setDate(minDate.getDate() - 3);
            maxDate.setDate(maxDate.getDate() + 7);
            
            const totalDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)));
            const dayWidth = 40; // px per day

            // Generate days array for header
            const days = [];
            for (let i = 0; i < totalDays; i++) {
              const d = new Date(minDate);
              d.setDate(d.getDate() + i);
              days.push(d);
            }

            return (
              <div style={{ margin: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', overflowX: 'auto', backgroundColor: containerBg }}>
                <div style={{ minWidth: `${totalDays * dayWidth + 200}px` }}>
                  {/* Timeline Header */}
                  <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ width: '200px', minWidth: '200px', padding: '12px', borderRight: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      任務名稱
                    </div>
                    <div style={{ display: 'flex', flex: 1 }}>
                      {days.map((d, idx) => (
                        <div key={idx} style={{ 
                          width: `${dayWidth}px`, 
                          minWidth: `${dayWidth}px`, 
                          padding: '8px 0', 
                          textAlign: 'center', 
                          borderRight: '1px solid var(--border-color)',
                          color: d.getDay() === 0 || d.getDay() === 6 ? 'var(--text-danger)' : 'var(--text-secondary)',
                          fontSize: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px'
                        }}>
                          <span style={{ fontWeight: 600 }}>{d.getDate()}</span>
                          <span style={{ fontSize: '10px', opacity: 0.7 }}>{d.getMonth() + 1}月</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Timeline Rows */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {tasksWithDates.map(t => {
                      const startOffsetDays = Math.max(0, (t.parsedStart.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
                      const durationDays = Math.max(1, Math.ceil((t.parsedEnd.getTime() - t.parsedStart.getTime()) / (1000 * 60 * 60 * 24)));
                      
                      const leftPos = startOffsetDays * dayWidth;
                      const barWidth = durationDays * dayWidth;
                      
                      return (
                        <div key={t.id} style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
                          <div 
                            style={{ 
                              width: '200px', 
                              minWidth: '200px', 
                              padding: '12px', 
                              borderRight: '1px solid var(--border-color)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              fontSize: '13px',
                              cursor: 'pointer',
                              color: 'var(--text-primary)'
                            }}
                            onClick={() => setSelectedModalTaskId(t.id)}
                            title={t.item_title}
                          >
                            {t.item_title}
                          </div>
                          <div style={{ flex: 1, position: 'relative', padding: '8px 0' }}>
                            <div 
                              onClick={() => setSelectedModalTaskId(t.id)}
                              draggable={true}
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', t.id.toString());
                                e.dataTransfer.effectAllowed = 'move';
                                e.currentTarget.dataset.startX = e.clientX.toString();
                              }}
                              onDragEnd={async (e) => {
                                const startX = parseInt(e.currentTarget.dataset.startX || '0', 10);
                                const dx = e.clientX - startX;
                                if (dx === 0) return;
                                const daysShifted = Math.round(dx / dayWidth);
                                if (daysShifted === 0) return;
                                
                                const newStart = new Date(t.parsedStart);
                                newStart.setDate(newStart.getDate() + daysShifted);
                                const newEnd = new Date(t.parsedEnd);
                                newEnd.setDate(newEnd.getDate() + daysShifted);
                                
                                try {
                                  await api.updateTask(t.id, { 
                                    ...t, 
                                    item_planned_start_date: newStart.toISOString(), 
                                    item_planned_end_date: newEnd.toISOString() 
                                  });
                                  if (onRefreshData) await onRefreshData();
                                } catch (err) { alert('更新失敗'); }
                              }}
                              style={{
                                position: 'absolute',
                                left: `${leftPos}px`,
                                width: `${barWidth}px`,
                                height: '24px',
                                backgroundColor: 'var(--accent-primary)',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '11px',
                                color: '#fff',
                                cursor: 'move',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                              }}
                              title={`${t.item_title} (${t.parsedStart.toLocaleDateString()} - ${t.parsedEnd.toLocaleDateString()})`}
                            >
                              <div
                                draggable={true}
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  e.currentTarget.dataset.startX = e.clientX.toString();
                                }}
                                onDragEnd={async (e) => {
                                  e.stopPropagation();
                                  const startX = parseInt(e.currentTarget.dataset.startX || '0', 10);
                                  const dx = e.clientX - startX;
                                  const daysShifted = Math.round(dx / dayWidth);
                                  if (daysShifted === 0) return;
                                  const newStart = new Date(t.parsedStart);
                                  newStart.setDate(newStart.getDate() + daysShifted);
                                  if (newStart > t.parsedEnd) return;
                                  try {
                                    await api.updateTask(t.id, { ...t, item_planned_start_date: newStart.toISOString() });
                                    if (onRefreshData) await onRefreshData();
                                  } catch (err) { alert('更新失敗'); }
                                }}
                                style={{ width: '8px', height: '100%', cursor: 'col-resize', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px 0 0 4px' }}
                              />
                              <div style={{ flex: 1, padding: '0 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.item_title}</div>
                              <div
                                draggable={true}
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  e.currentTarget.dataset.startX = e.clientX.toString();
                                }}
                                onDragEnd={async (e) => {
                                  e.stopPropagation();
                                  const startX = parseInt(e.currentTarget.dataset.startX || '0', 10);
                                  const dx = e.clientX - startX;
                                  const daysShifted = Math.round(dx / dayWidth);
                                  if (daysShifted === 0) return;
                                  const newEnd = new Date(t.parsedEnd);
                                  newEnd.setDate(newEnd.getDate() + daysShifted);
                                  if (newEnd < t.parsedStart) return;
                                  try {
                                    await api.updateTask(t.id, { ...t, item_planned_end_date: newEnd.toISOString() });
                                    if (onRefreshData) await onRefreshData();
                                  } catch (err) { alert('更新失敗'); }
                                }}
                                style={{ width: '8px', height: '100%', cursor: 'col-resize', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '0 4px 4px 0' }}
                              />
                            </div>
                            
                            {/* Grid lines */}
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', pointerEvents: 'none' }}>
                                {days.map((_, idx) => (
                                  <div key={idx} style={{ width: `${dayWidth}px`, minWidth: `${dayWidth}px`, borderRight: '1px solid rgba(255,255,255,0.05)' }} />
                                ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {activeTaskView === 'Calendar' && (() => {
            // Simplified Calendar View
            const today = new Date();
            const year = today.getFullYear();
            const month = today.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const firstDayIndex = new Date(year, month, 1).getDay();
            
            const calendarDays = [];
            // Padding empty cells for first week
            for (let i = 0; i < firstDayIndex; i++) {
              calendarDays.push(null);
            }
            // Actual days
            for (let i = 1; i <= daysInMonth; i++) {
              calendarDays.push(new Date(year, month, i));
            }
            // Padding empty cells for last week
            while (calendarDays.length % 7 !== 0) {
              calendarDays.push(null);
            }

            return (
              <div style={{ margin: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', backgroundColor: containerBg }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', backgroundColor: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--border-color)' }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} style={{ padding: '12px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {day}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', autoRows: 'minmax(120px, auto)' }}>
                  {calendarDays.map((date, idx) => {
                    if (!date) return <div key={idx} style={{ borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)' }} />;
                    
                    const isToday = date.toDateString() === today.toDateString();
                    
                    // Find tasks active on this date
                    const tasksOnThisDay = filteredTasks.filter(t => {
                      const start = new Date(t.item_planned_start_date || t.item_created_at);
                      let end = new Date(t.item_planned_end_date || t.item_planned_start_date || t.item_created_at);
                      if (end < start) end = start;
                      
                      // Normalize to midnight for comparison
                      start.setHours(0,0,0,0);
                      end.setHours(23,59,59,999);
                      
                      return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
                    });

                    return (
                      <div key={idx} style={{ borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ textAlign: 'right', fontWeight: isToday ? 800 : 500, color: isToday ? 'var(--accent-primary)' : 'var(--text-primary)', marginBottom: '4px' }}>
                          <span style={{ 
                            display: 'inline-block', 
                            width: '24px', height: '24px', 
                            lineHeight: '24px', textAlign: 'center', 
                            borderRadius: '50%', 
                            backgroundColor: isToday ? 'rgba(79, 70, 229, 0.2)' : 'transparent' 
                          }}>
                            {date.getDate()}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', flex: 1, maxHeight: '80px' }}>
                          {tasksOnThisDay.map(t => (
                            <div 
                              key={t.id}
                              onClick={() => setSelectedModalTaskId(t.id)}
                              style={{
                                fontSize: '11px',
                                padding: '2px 6px',
                                backgroundColor: 'rgba(255,255,255,0.08)',
                                color: 'var(--text-primary)',
                                borderRadius: '4px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                cursor: 'pointer',
                                borderLeft: `3px solid var(--accent-primary)`
                              }}
                              title={t.item_title}
                            >
                              {t.item_title}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          
          {/* Frozen New Item Row */}
          <div style={{
            borderTop: '1px solid ' + getBorderColor(),
            padding: '12px 16px',
            backgroundColor: containerBg,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            {inlineCreatingAllItemOpen ? (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
                <Select
                  value={{ value: inlineCreatingAllItemType, label: inlineCreatingAllItemType === 'Knowledge' ? 'Knowledge | Note' : inlineCreatingAllItemType }}
                  onChange={(s: any) => setInlineCreatingAllItemType(s ? s.value : 'Task')}
                  styles={{
                    ...reactSelectStyles,
                    control: (base: any, state: any) => ({
                      ...reactSelectStyles.control(base, state),
                      minHeight: '32px',
                      width: '180px'
                    }),
                    valueContainer: (base: any) => ({
                      ...base,
                      padding: '0 8px'
                    })
                  }}
                  options={["Charter", "Epic", "Task", "Event", "Micro Task", "Meeting", "Bottleneck", "Knowledge", "Casual Note", "Bug", "UAT", "Deployment", "Milestone", "Business Objective", "Business Requirement", "User Story"].map(v => ({ value: v, label: v }))}
                  formatOptionLabel={(option: any) => (
                    <span style={{ 
                      backgroundColor: `${getItemTypeStyles(option.value).bg}20`,
                      color: getItemTypeStyles(option.value).text,
                      padding: '2px 6px', borderRadius: '4px', fontSize: '11px',
                      display: 'inline-flex', alignItems: 'center', gap: '4px'
                    }}>
                      <span>{getItemTypeStyles(option.value).icon}</span> {option.label}
                    </span>
                  )}
                  isSearchable={false}
                  menuPlacement="top"
                />

                <input
                  type="text"
                  autoFocus
                  placeholder={`輸入${inlineCreatingAllItemType}名稱...`}
                  value={inlineCreatingAllItemTitle}
                  onChange={(e) => setInlineCreatingAllItemTitle(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && inlineCreatingAllItemTitle.trim()) {
                      try {
                        if (inlineCreatingAllItemType === 'Meeting') {
                          await api.createMeeting({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined,  item_title: inlineCreatingAllItemTitle, content: '| 序號 | 討論事項 | 決議/行動方案 | 負責人 | 狀態 |\n|---|---|---|---|---|\n| 1 | 初始化 | 建立文件流水帳 | Edmond | 已完成 |', summary: '手動建立的會議記錄。', remarks_entry: '從 All item view 新增會議' });
                        } else if (inlineCreatingAllItemType === 'Bottleneck') {
                          await api.createBottleneck({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined,  item_title: inlineCreatingAllItemTitle, description: '阻礙詳細說明...', severity: 'Middle', status: 'Not Start', remarks_entry: '從 All item view 新增專案瓶頸' });
                        } else if (inlineCreatingAllItemType === 'Knowledge') {
                          await api.createKnowledge({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined,  item_title: inlineCreatingAllItemTitle, definition: '定義內容...', kpi_formula: undefined, remarks_entry: '從 All item view 新增術語定義' });
                        } else {
                          await api.createTask({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined,  item_title: inlineCreatingAllItemTitle, item_type: inlineCreatingAllItemType, item_status: 'Not Start', item_priority: 'Middle', item_content: { description: `手動建立的${inlineCreatingAllItemType}工單。` }, remarks_entry: `從 All item view 新增${inlineCreatingAllItemType}` });
                        }
                        if (onRefreshData) await onRefreshData();
                        setInlineCreatingAllItemTitle('');
                      } catch (err) { alert('建立失敗'); }
                    } else if (e.key === 'Escape') {
                      setInlineCreatingAllItemOpen(false);
                    }
                  }}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    border: 'none',
                    borderBottom: '1px solid var(--accent-primary)',
                    outline: 'none',
                    padding: '8px',
                    fontSize: '13px'
                  }}
                />
                
                <button 
                  onClick={async () => {
                    if (inlineCreatingAllItemTitle.trim()) {
                      try {
                        if (inlineCreatingAllItemType === 'Meeting') {
                          await api.createMeeting({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined,  item_title: inlineCreatingAllItemTitle, content: '| 序號 | 討論事項 | 決議/行動方案 | 負責人 | 狀態 |\n|---|---|---|---|---|\n| 1 | 初始化 | 建立文件流水帳 | Edmond | 已完成 |', summary: '手動建立的會議記錄。', remarks_entry: '從 All item view 新增會議' });
                        } else if (inlineCreatingAllItemType === 'Bottleneck') {
                          await api.createBottleneck({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined,  item_title: inlineCreatingAllItemTitle, description: '阻礙詳細說明...', severity: 'Middle', status: 'Not Start', remarks_entry: '從 All item view 新增專案瓶頸' });
                        } else if (inlineCreatingAllItemType === 'Knowledge') {
                          await api.createKnowledge({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined,  item_title: inlineCreatingAllItemTitle, definition: '定義內容...', kpi_formula: undefined, remarks_entry: '從 All item view 新增術語定義' });
                        } else {
                          await api.createTask({ workspace_id: filterWorkspace ? parseInt(filterWorkspace, 10) : undefined,  item_title: inlineCreatingAllItemTitle, item_type: inlineCreatingAllItemType, item_status: 'Not Start', item_priority: 'Middle', item_content: { description: `手動建立的${inlineCreatingAllItemType}工單。` }, remarks_entry: `從 All item view 新增${inlineCreatingAllItemType}` });
                        }
                        if (onRefreshData) await onRefreshData();
                        setInlineCreatingAllItemTitle('');
                      } catch (err) { alert('建立失敗'); }
                    }
                  }}
                  style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                >
                  Save
                </button>
                <button 
                  onClick={() => setInlineCreatingAllItemOpen(false)}
                  style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div 
                style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px', width: '100%', display: 'flex', alignItems: 'center' }}
                onClick={() => {
                  setInlineCreatingAllItemOpen(true);
                  setInlineCreatingAllItemTitle('');
                  setInlineCreatingAllItemType('Task');
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-primary)'} 
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <span style={{ marginRight: '6px', fontSize: '16px' }}>+</span>新增頁面
              </div>
            )}
          </div>
        </div>
        {renderAllOverlays()}
      </div>
    );
  }

  if (selectedSubItemId === 'project-table') {
    return (
      <div className={themeClass} style={{ ...styles.container, backgroundColor: containerBg }}>
        {renderCategoryTabBar()}
        
        <div style={styles.wrapper}>
          <div style={{
            borderBottom: '1px solid ' + getBorderColor(),
            paddingBottom: '16px',
            marginBottom: '16px',
          }}>
            <h1 style={styles.visualTitle}>📊 專案總表 (Project Context Table View)</h1>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px', gap: '4px' }}>
              {(['List', 'Timeline'] as const).map(view => (
                <button
                  key={view}
                  onClick={() => setActiveProjectView(view)}
                  style={{
                    background: activeProjectView === view ? 'var(--accent-primary)' : 'transparent',
                    color: activeProjectView === view ? '#fff' : 'var(--text-secondary)',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    transition: 'all 0.2s'
                  }}
                >
                  {view === 'List' ? '≣ List' : '◤ Timeline'}
                </button>
              ))}
            </div>
            <div>
              {renderTemplateDropdown('project_context')}
            </div>
          </div>
          {activeProjectView === 'List' && (() => {
            const projectColumns = [
              {
                id: 'id',
                header: 'ID',
                cell: (p: any) => <span style={{ fontWeight: 'bold' }}>{p.id}</span>
              },
              {
                id: 'content_display_id',
                header: '專案代號 (Display ID)',
                cell: (p: any) => (
                  <span 
                    style={{ fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--accent-secondary)', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={(e) => { e.stopPropagation(); setSelectedModalProjectId(p.id); }}
                  >
                    {p.content_display_id}
                  </span>
                )
              },
              {
                id: 'content_name',
                header: '專案名稱 (Name)',
                cell: (p: any) => {
                  if (inlineEditProjectId === p.id && inlineEditProjectField === 'content_name') {
                    return (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <input
                          autoFocus
                          value={inlineEditProjectData.content_name || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={e => setInlineEditProjectData({ ...inlineEditProjectData, content_name: e.target.value })}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              try {
                                if (onUpdateProject) await onUpdateProject(p.id, { content_name: inlineEditProjectData.content_name, remarks_entry: 'Inline Update' });
                                if (onRefreshData) await onRefreshData();
                                setInlineEditProjectId(null);
                                setInlineEditProjectField(null);
                              } catch(err) { alert('更新失敗'); }
                            } else if (e.key === 'Escape') {
                              setInlineEditProjectId(null);
                              setInlineEditProjectField(null);
                            }
                          }}
                          style={{ flex: 1, padding: '2px 4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', outline: 'none' }}
                        />
                        <button style={{ background: 'transparent', border: 'none', color: '#10B981', cursor: 'pointer', padding: '2px' }}
                          onMouseDown={async (e) => {
                            e.preventDefault();
                            try {
                              if (onUpdateProject) await onUpdateProject(p.id, { content_name: inlineEditProjectData.content_name, remarks_entry: 'Inline Update' });
                              if (onRefreshData) await onRefreshData();
                              setInlineEditProjectId(null);
                              setInlineEditProjectField(null);
                            } catch(err) { alert('更新失敗'); }
                          }}
                        >✓</button>
                        <button style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
                          onMouseDown={(e) => { e.preventDefault(); setInlineEditProjectId(null); setInlineEditProjectField(null); }}
                        >✕</button>
                      </div>
                    );
                  }
                  return (
                    <span 
                      style={{ fontWeight: 'bold', cursor: 'text' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setInlineEditProjectId(p.id);
                        setInlineEditProjectField('content_name');
                        setInlineEditProjectData({ content_name: p.content_name });
                      }}
                    >📁 {p.content_name}</span>
                  );
                }
              },
              {
                id: 'content_type',
                header: '類型 (Content Type)',
                cell: (p: any) => <span className="nature-tag" style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#4ADE80' }}>{p.content_type}</span>
              },
              {
                id: 'workspace',
                header: '工作空間 (Workspace)',
                cell: (p: any) => {
                  const wsName = workspaces.find(w => w.workspace_id === p.related_workspace_id)?.workspace_name || String(p.related_workspace_id || '—');
                  return <span>🏢 {wsName}</span>;
                }
              },
              {
                id: 'parent_product',
                header: '父級產品 (Parent Product)',
                cell: (p: any) => {
                  const prodName = products.find(prod => String(prod.id) === String(p.parent_content_id))?.name || 
                                   products.find(prod => String(prod.id) === String(p.parent_content_id))?.content_name || 
                                   String(p.parent_content_id || '—');
                  return <span>📦 {prodName}</span>;
                }
              },
              {
                id: 'content_status',
                header: '狀態 (Status)',
                cell: (p: any) => {
                  if (inlineEditProjectId === p.id && inlineEditProjectField === 'content_status') {
                    return (
                      <ThemedSelect
                        autoFocus
                        value={inlineEditProjectData.content_status || ''}
                        onClick={(e) => e.stopPropagation()}
                        onChange={async (e) => {
                          const val = e.target.value;
                          setInlineEditProjectData({ ...inlineEditProjectData, content_status: val });
                          try {
                            if (onUpdateProject) await onUpdateProject(p.id, { content_status: val, remarks_entry: 'Inline Update' });
                            if (onRefreshData) await onRefreshData();
                            setInlineEditProjectId(null);
                            setInlineEditProjectField(null);
                          } catch(err) { alert('更新失敗'); }
                        }}
                        onBlur={() => { setInlineEditProjectId(null); setInlineEditProjectField(null); }}
                        style={{ width: '100%', padding: '4px', background: 'rgba(30,41,59,1)', border: '1px solid var(--accent-primary)', color: 'white', borderRadius: '4px', outline: 'none' }}
                      >
                        <option value="Pipeline">Pipeline</option>
                        <option value="Active">Active</option>
                        <option value="On Hold">On Hold</option>
                        <option value="Completed">Completed</option>
                        <option value="Abandoned">Abandoned</option>
                      </ThemedSelect>
                    );
                  }
                  return (
                    <span 
                      className={getProjectStatusClass(p.content_status)}
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setInlineEditProjectId(p.id);
                        setInlineEditProjectField('content_status');
                        setInlineEditProjectData({ content_status: p.content_status });
                      }}
                    >● {p.content_status}</span>
                  );
                }
              },
              {
                id: 'project_type',
                header: '專案性質 (Project Type)',
                cell: (p: any) => {
                  if (inlineEditProjectId === p.id && inlineEditProjectField === 'project_type') {
                    return (
                      <ThemedSelect
                        autoFocus
                        value={inlineEditProjectData.project_type || ''}
                        onClick={(e) => e.stopPropagation()}
                        onChange={async (e) => {
                          const val = e.target.value;
                          setInlineEditProjectData({ ...inlineEditProjectData, project_type: val });
                          try {
                            if (onUpdateProject) await onUpdateProject(p.id, { project_type: val, remarks_entry: 'Inline Update' });
                            if (onRefreshData) await onRefreshData();
                            setInlineEditProjectId(null);
                            setInlineEditProjectField(null);
                          } catch(err) { alert('更新失敗'); }
                        }}
                        onBlur={() => { setInlineEditProjectId(null); setInlineEditProjectField(null); }}
                        style={{ width: '100%', padding: '4px', background: 'rgba(30,41,59,1)', border: '1px solid var(--accent-primary)', color: 'white', borderRadius: '4px', outline: 'none' }}
                      >
                        <option value="Phase">Phase</option>
                        <option value="BAU">BAU</option>
                        <option value="Epic">Epic</option>
                      </ThemedSelect>
                    );
                  }
                  return (
                    <span 
                      className="relation-badge"
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setInlineEditProjectId(p.id);
                        setInlineEditProjectField('project_type');
                        setInlineEditProjectData({ project_type: p.project_type });
                      }}
                    >{p.project_type || 'Null'}</span>
                  );
                }
              },
              {
                id: 'project_type_sequence',
                header: '階段序號 (Sequence)',
                cell: (p: any) => {
                  if (inlineEditProjectId === p.id && inlineEditProjectField === 'project_type_sequence') {
                    return (
                      <input
                        type="number"
                        autoFocus
                        value={inlineEditProjectData.project_type_sequence || ''}
                        onClick={(e) => e.stopPropagation()}
                        onChange={e => setInlineEditProjectData({ ...inlineEditProjectData, project_type_sequence: parseInt(e.target.value) || 0 })}
                        onBlur={async () => {
                          try {
                            if (onUpdateProject) await onUpdateProject(p.id, { project_type_sequence: inlineEditProjectData.project_type_sequence, remarks_entry: 'Inline Update' });
                            if (onRefreshData) await onRefreshData();
                            setInlineEditProjectId(null);
                            setInlineEditProjectField(null);
                          } catch(err) { alert('更新失敗'); }
                        }}
                        style={{ width: '100%', padding: '4px', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--accent-primary)', color: 'white', borderRadius: '4px', outline: 'none' }}
                      />
                    );
                  }
                  return (
                    <span 
                      style={{ cursor: 'text', padding: '2px 4px', display: 'inline-block', minWidth: '20px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setInlineEditProjectId(p.id);
                        setInlineEditProjectField('project_type_sequence');
                        setInlineEditProjectData({ project_type_sequence: p.project_type_sequence });
                      }}
                    >{p.project_type_sequence ?? '—'}</span>
                  );
                }
              },
              {
                id: 'planned_start_date',
                header: '計劃開始 (Planned Start)',
                cell: (p: any) => formatChineseDate(p.planned_start_date)
              },
              {
                id: 'planned_end_date',
                header: '計劃結束 (Planned End)',
                cell: (p: any) => formatChineseDate(p.planned_end_date)
              },
              {
                id: 'actual_start_date',
                header: '實際開始 (Actual Start)',
                cell: (p: any) => formatChineseDate(p.actual_start_date)
              },
              {
                id: 'actual_end_date',
                header: '實際結束 (Actual End)',
                cell: (p: any) => formatChineseDate(p.actual_end_date)
              },
              {
                id: 'content_json',
                header: '額外內容 (Content JSON)',
                cell: (p: any) => (
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {JSON.stringify(p.content)}
                  </span>
                )
              },
              {
                id: 'content_created_at',
                header: '建立時間 (Created At)',
                cell: (p: any) => formatChineseDateTime(p.content_created_at)
              },
              {
                id: 'updated_at',
                header: '更新時間 (Updated At)',
                cell: (p: any) => formatChineseDateTime(p.updated_at)
              },
              ...getRemainingProjectContextColumns(workspaces, products, ['id', 'content_display_id', 'content_name', 'content_type', 'workspace', 'related_workspace_id', 'parent_product', 'parent_content_id', 'status', 'content_status', 'project_type', 'project_type_sequence', 'planned_start_date', 'planned_end_date', 'actual_start_date', 'actual_end_date', 'content', 'content_json', 'content_created_at', 'updated_at'])
            ];

            return (
              <>
                <TableViewToolbar data={filteredProjects} columns={projectColumns} state={toolbarState} onChange={setToolbarState} />
                <AdvancedTable
                tableId="projects_large_main_table"
                data={applyToolbar(filteredProjects, projectColumns)}
                columns={getVisibleColumns(projectColumns)}
                onRowClick={(p) => {
                  setSelectedModalProjectId(p.id);
                }}
              />
              </>
            );
          })()}

          {activeProjectView === 'Timeline' && (() => {
            const filteredProjs = projects.filter(p => p.content_status !== 'Null' && p.content_status !== 'Abandoned' && (!filterWorkspace || p.related_workspace_id === parseInt(filterWorkspace, 10)));
            const projIds = filteredProjs.map(p => p.id);
            const projMilestones = tasks.filter(t => t.item_type === 'Milestone' && (projIds.includes(t.related_context_id) || projIds.includes(t.project_id)));
            const milestoneIds = projMilestones.map(m => m.id);
            const projTasks = tasks.filter(t => t.item_type !== 'Milestone' && (projIds.includes(t.related_context_id) || projIds.includes(t.project_id) || milestoneIds.includes(t.parent_item_id)));

            // Compute min/max dates
            let minDate = new Date();
            let maxDate = new Date();
            minDate.setMonth(minDate.getMonth() - 1);
            maxDate.setMonth(maxDate.getMonth() + 2);

            [...filteredProjs, ...projMilestones, ...projTasks].forEach((item: any) => {
              let s, e;
              if (item.planned_start_date !== undefined) {
                s = item.planned_start_date;
                e = item.planned_end_date;
              } else {
                s = item.item_planned_start_date || item.item_created_at;
                e = item.item_planned_end_date || item.item_planned_start_date || item.item_created_at;
              }
              if (s) { const d = new Date(s); if (d < minDate) minDate = new Date(d); }
              if (e) { const d = new Date(e); if (d > maxDate) maxDate = new Date(d); }
            });

            // Add padding
            minDate.setDate(minDate.getDate() - 3);
            maxDate.setDate(maxDate.getDate() + 7);

            const totalDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)));
            const dayWidth = 40;

            const days = [];
            for (let i = 0; i < totalDays; i++) {
              const d = new Date(minDate);
              d.setDate(d.getDate() + i);
              days.push(d);
            }

            const toggleNode = (nodeId: string) => {
              const newSet = new Set(expandedTimelineNodes);
              if (newSet.has(nodeId)) newSet.delete(nodeId);
              else newSet.add(nodeId);
              setExpandedTimelineNodes(newSet);
            };

            const renderBar = (item: any, type: 'Project' | 'Milestone' | 'Task', indent: number) => {
              let s, e;
              if (type === 'Project') {
                s = new Date(item.planned_start_date || item.content_created_at);
                e = new Date(item.planned_end_date || item.planned_start_date || item.content_created_at);
              } else {
                s = new Date(item.item_planned_start_date || item.item_created_at);
                e = new Date(item.item_planned_end_date || item.item_planned_start_date || item.item_created_at);
              }
              if (e < s) e = s;

              const startOffsetDays = Math.max(0, (s.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
              const durationDays = Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
              
              const leftPos = startOffsetDays * dayWidth;
              const barWidth = durationDays * dayWidth;

              const nodeId = `${type.toLowerCase()}-${item.id}`;
              const isExpanded = expandedTimelineNodes.has(nodeId);

              // Find children
              let children: any[] = [];
              if (type === 'Project') {
                children = projMilestones.filter((m: any) => m.related_context_id === item.id || m.project_id === item.id);
              } else if (type === 'Milestone') {
                children = projTasks.filter((t: any) => t.parent_item_id === item.id);
              }
              const hasChildren = children.length > 0;

              const title = type === 'Project' ? item.content_name : item.item_title;
              const barColor = type === 'Project' ? '#10B981' : (type === 'Milestone' ? '#F59E0B' : 'var(--accent-primary)');

              return (
                <div key={nodeId} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', backgroundColor: type === 'Project' ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                    <div style={{ 
                      width: '280px', minWidth: '280px', padding: '12px', borderRight: '1px solid var(--border-color)',
                      paddingLeft: `${12 + indent * 20}px`, display: 'flex', alignItems: 'center', gap: '8px',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      fontSize: type === 'Project' ? '14px' : '13px', fontWeight: type === 'Project' ? 600 : 400,
                      color: 'var(--text-primary)', position: 'sticky', left: 0, zIndex: 10, backgroundColor: containerBg
                    }}>
                      <div 
                        onClick={() => hasChildren && toggleNode(nodeId)} 
                        style={{ cursor: hasChildren ? 'pointer' : 'default', width: '16px', textAlign: 'center', color: hasChildren ? 'var(--text-secondary)' : 'transparent', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                      >
                        ▶
                      </div>
                      {type === 'Project' && <span>📁</span>}
                      {type === 'Milestone' && <span>🚩</span>}
                      {type === 'Task' && <span>📋</span>}
                      <span title={title} style={{ cursor: 'pointer' }} onClick={() => {
                        if (type === 'Project') setSelectedModalProjectId(item.id);
                        else setSelectedModalTaskId(item.id);
                      }}>{title}</span>
                    </div>
                    <div style={{ flex: 1, position: 'relative', padding: '8px 0', minWidth: `${totalDays * dayWidth}px` }}>
                      <div 
                        onClick={() => {
                          if (type === 'Project') setSelectedModalProjectId(item.id);
                          else setSelectedModalTaskId(item.id);
                        }}
                        style={{
                          position: 'absolute', left: `${leftPos}px`, width: `${barWidth}px`, height: '24px',
                          backgroundColor: barColor, borderRadius: type === 'Milestone' ? '12px' : '4px',
                          display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: '11px', color: '#fff',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', zIndex: 5
                        }} title={`${title} (${s.toLocaleDateString()} - ${e.toLocaleDateString()})`}
                      >
                        {title}
                      </div>
                      
                      {/* Grid lines inside row */}
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', pointerEvents: 'none' }}>
                          {days.map((_, idx) => (
                            <div key={idx} style={{ width: `${dayWidth}px`, minWidth: `${dayWidth}px`, borderRight: '1px solid rgba(255,255,255,0.05)' }} />
                          ))}
                      </div>
                    </div>
                  </div>

                  {isExpanded && type === 'Project' && children.map(m => renderBar(m, 'Milestone', indent + 1))}
                  {isExpanded && type === 'Milestone' && children.map(t => renderBar(t, 'Task', indent + 1))}
                </div>
              );
            };

            return (
              <div style={{ margin: '16px 0', border: '1px solid var(--border-color)', borderRadius: '8px', overflowX: 'auto', backgroundColor: containerBg }}>
                <div style={{ minWidth: `${totalDays * dayWidth + 280}px` }}>
                  {/* Timeline Header */}
                  <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ width: '280px', minWidth: '280px', padding: '12px', borderRight: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--text-primary)', position: 'sticky', left: 0, zIndex: 10, backgroundColor: containerBg }}>
                      專案階層 (Hierarchy)
                    </div>
                    <div style={{ display: 'flex', flex: 1 }}>
                      {days.map((d, idx) => (
                        <div key={idx} style={{ 
                          width: `${dayWidth}px`, minWidth: `${dayWidth}px`, padding: '8px 0', textAlign: 'center', 
                          borderRight: '1px solid var(--border-color)', color: d.getDay() === 0 || d.getDay() === 6 ? 'var(--text-danger)' : 'var(--text-secondary)',
                          fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px'
                        }}>
                          <span style={{ fontWeight: 600 }}>{d.getDate()}</span>
                          <span style={{ fontSize: '10px', opacity: 0.7 }}>{d.getMonth() + 1}月</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Timeline Rows */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {filteredProjs.map(p => renderBar(p, 'Project', 0))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Frozen New Item Row */}
          <div style={{
            borderTop: '1px solid ' + getBorderColor(),
            padding: '12px 16px',
            backgroundColor: containerBg,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            {inlineCreatingProjectOpen ? (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
                <ThemedSelect
                  value={inlineCreatingProjectType}
                  onChange={(e) => setInlineCreatingProjectType(e.target.value)}
                  style={{ padding: '8px', borderRadius: '6px', border: '1px solid ' + getBorderColor(), background: 'rgba(30, 41, 59, 0.5)', color: 'var(--text-primary)', outline: 'none', fontSize: '13px' }}
                >
                  <option value="Phase">Phase</option>
                  <option value="BAU">BAU</option>
                  <option value="Epic">Epic</option>
                </ThemedSelect>

                <input
                  type="text"
                  autoFocus
                  placeholder="輸入專案名稱..."
                  value={inlineCreatingProjectTitle}
                  onChange={(e) => setInlineCreatingProjectTitle(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && inlineCreatingProjectTitle.trim()) {
                      try {
                        const newProj = await api.createProject({
                          content_name: inlineCreatingProjectTitle,
                          related_workspace_id: filterWorkspace ? Number(filterWorkspace) : 1,
                          content_status: 'Active',
                          project_type: inlineCreatingProjectType,
                          project_type_sequence: 1,
                          content: {},
                          remarks_entry: '從 Project View 新增專案'
                        } as any);
                        if (onRefreshData) await onRefreshData();
                        setSelectedModalProjectId(newProj.id);
                        setIsEditing(true);
                        setInlineCreatingProjectTitle('');
                        setInlineCreatingProjectOpen(false);
                      } catch (err) { alert('建立失敗'); }
                    } else if (e.key === 'Escape') {
                      setInlineCreatingProjectOpen(false);
                    }
                  }}
                  style={{ flex: 1, background: 'transparent', color: 'var(--text-primary)', border: 'none', borderBottom: '1px solid var(--accent-primary)', outline: 'none', padding: '8px', fontSize: '13px' }}
                />
                
                <button 
                  onClick={async () => {
                    if (inlineCreatingProjectTitle.trim()) {
                      try {
                        const newProj = await api.createProject({
                          content_name: inlineCreatingProjectTitle,
                          related_workspace_id: filterWorkspace ? Number(filterWorkspace) : 1,
                          content_status: 'Active',
                          project_type: inlineCreatingProjectType,
                          project_type_sequence: 1,
                          content: {},
                          remarks_entry: '從 Project View 新增專案'
                        } as any);
                        if (onRefreshData) await onRefreshData();
                        setSelectedModalProjectId(newProj.id);
                        setIsEditing(true);
                        setInlineCreatingProjectTitle('');
                        setInlineCreatingProjectOpen(false);
                      } catch (err) { alert('建立失敗'); }
                    }
                  }}
                  style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                >
                  Save
                </button>
                <button onClick={() => setInlineCreatingProjectOpen(false)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
              </div>
            ) : (
              <div 
                style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px', width: '100%', display: 'flex', alignItems: 'center' }}
                onClick={() => { setInlineCreatingProjectOpen(true); setInlineCreatingProjectTitle(''); setInlineCreatingProjectType('Phase'); }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-primary)'} 
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <span style={{ marginRight: '6px', fontSize: '16px' }}>+</span>新增頁面
              </div>
            )}
          </div>

        </div>
        {renderAllOverlays()}
      </div>
    );
  }

  if (selectedSubItemId === 'requirement-table') {
    return (
      <div className={themeClass} style={{ ...styles.container, backgroundColor: containerBg }}>
        {renderCategoryTabBar()}
        
        <div style={styles.wrapper}>
          <h1 style={styles.visualTitle}>📊 需求基準總表 (Requirement Table View)</h1>
          {(() => {
            const reqColumns = [
              {
                id: 'select',
                header: <input type="checkbox" readOnly checked style={{ opacity: 0.5 }} />,
                cell: (r: any) => (
                  <div style={{ textAlign: 'center' }}>
                    <input type="checkbox" className="table-checkbox" checked={r.status === 'APPROVED'} readOnly />
                  </div>
                )
              },
              {
                id: 'title',
                header: '需求標題',
                cell: (r: any) => <span style={{ fontWeight: 'bold' }}>📄 {r.title}</span>
              },
              {
                id: 'category',
                header: '分類',
                cell: (r: any) => r.category
              },
              {
                id: 'priority',
                header: 'MoSCoW 優先級',
                cell: (r: any) => (
                  <>
                    {r.priority === 'Must' && <span className="priority-high">Must</span>}
                    {r.priority === 'Should' && <span className="priority-middle">Should</span>}
                    {r.priority === 'Could' && <span className="priority-low">Could</span>}
                    {r.priority === 'Won\'t' && <span className="priority-low" style={{ textDecoration: 'line-through' }}>Won't</span>}
                  </>
                )
              },
              {
                id: 'status',
                header: '狀態',
                cell: (r: any) => (
                  <>
                    {r.status === 'APPROVED' ? (
                      <span className="status-badge-done">● APPROVED</span>
                    ) : r.status === 'REJECTED' ? (
                      <span className="status-badge-archive">● REJECTED</span>
                    ) : (
                      <span className="status-badge-todo">● DRAFT</span>
                    )}
                  </>
                )
              },
              {
                id: 'created_at',
                header: '建立日期',
                cell: (r: any) => formatChineseDate(r.created_at)
              }
            ];

            return (
              <>
                <TableViewToolbar data={filteredRequirements} columns={reqColumns} state={toolbarState} onChange={setToolbarState} />
                <AdvancedTable
                tableId="requirements_main_table"
                data={applyToolbar(filteredRequirements, reqColumns)}
                columns={getVisibleColumns(reqColumns)}
                onRowClick={(r) => onSelectSubItem(r.id)}
                footerContent={renderNewPageRow(6)}
              />
              </>
            );
          })()}
        </div>
        {renderAllOverlays()}
      </div>
    );
  }

  if (selectedSubItemId === 'meeting-table') {
    return (
      <div className={themeClass} style={{ ...styles.container, backgroundColor: containerBg }}>
        {renderCategoryTabBar()}
        
        <div style={styles.wrapper}>
          <h1 style={styles.visualTitle}>📊 所有會議總表 (Meeting Item Table View)</h1>
          {(() => {
            const meetingColumns = [
              {
                id: 'id',
                header: 'ID',
                cell: (m: any) => <span style={{ fontWeight: 'bold' }}>{m.id}</span>
              },
              {
                id: 'item_display_id',
                header: '會議代號 (Display ID)',
                cell: (m: any) => <span style={{ fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--accent-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }} title={m.item_type || 'Meeting'}><span>{getItemTypeStyles(m.item_type || 'Meeting').icon}</span> {m.item_display_id}</span>
              },
              {
                id: 'item_title',
                header: '會議名稱 (Title)',
                cell: (m: any) => <span style={{ fontWeight: 'bold' }}>📄 {m.item_title}</span>
              },
              {
                id: 'related_context_id',
                header: '關聯專案 (Context ID)',
                cell: (m: any) => (
                  <span className="relation-badge relation-badge-project">
                    {projects.find(p => String(p.id) === String(m.related_context_id))?.name || m.related_context_id || '—'}
                  </span>
                )
              },
              {
                id: 'item_type',
                header: '性質 (Item Type)',
                cell: (m: any) => <span className="nature-tag" style={{ backgroundColor: `${getItemTypeStyles(m.item_type || 'Meeting').bg}20`, color: getItemTypeStyles(m.item_type || 'Meeting').text, padding: '2px 6px', borderRadius: '4px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span>{getItemTypeStyles(m.item_type || 'Meeting').icon}</span> {m.item_type}</span>
              },
              {
                id: 'item_status',
                header: '狀態 (Item Status)',
                cell: (m: any) => getItemStatusBadge(m.item_status || 'Not Start')
              },
              {
                id: 'item_priority',
                header: '優先級 (Item Priority)',
                cell: (m: any) => <span className="priority-middle">{m.item_priority}</span>
              },
              {
                id: 'item_planned_start_date',
                header: '會議日期 (Planned Start)',
                cell: (m: any) => formatChineseDate(m.item_planned_start_date)
              },
              {
                id: 'item_planned_end_date',
                header: '預計結束 (Planned End)',
                cell: (m: any) => formatChineseDate(m.item_planned_end_date)
              },
              {
                id: 'item_actual_start_date',
                header: '實際開始 (Actual Start)',
                cell: (m: any) => formatChineseDate(m.item_actual_start_date)
              },
              {
                id: 'item_actual_end_date',
                header: '實際結束 (Actual End)',
                cell: (m: any) => formatChineseDate(m.item_actual_end_date)
              },
              {
                id: 'item_follow_by',
                header: '主持人 (Follow By)',
                cell: (m: any) => members.find(mem => String(mem.member_id) === String(m.item_follow_by))?.member_name || m.item_follow_by || '—'
              },
              {
                id: 'item_content',
                header: '詳細內容 (Content JSON)',
                cell: (m: any) => (
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {JSON.stringify(m.item_content)}
                  </span>
                )
              },
              ...getRemainingProjectItemColumns(members, workspaces, projects, ['id', 'item_display_id', 'item_title', 'related_context_id', 'item_type', 'item_status', 'item_priority', 'item_planned_start_date', 'item_planned_end_date', 'item_actual_start_date', 'item_actual_end_date', 'item_follow_by', 'item_content'])
            ];

            return (
              <>
                <TableViewToolbar data={filteredMeetings} columns={meetingColumns} state={toolbarState} onChange={setToolbarState} />
                <AdvancedTable
                tableId="meetings_main_table"
                data={applyToolbar(filteredMeetings, meetingColumns)}
                columns={getVisibleColumns(meetingColumns)}
                onRowClick={(m) => setSelectedDrawerMeetingId(m.id)}
                footerContent={renderNewPageRow(15)}
              />
              </>
            );
          })()}
        </div>
        {renderAllOverlays()}
      </div>
    );
  }

  if (selectedSubItemId === 'bottleneck-table' || (activeTab === 'bottlenecks' && !!currentBottleneck)) {
    return (
      <div className={themeClass} style={{ ...styles.container, backgroundColor: containerBg }}>
        {renderCategoryTabBar()}
        
        <div style={styles.wrapper}>
          <h1 style={styles.visualTitle}>📊 樽頸風險總表 (Bottleneck Item Table View)</h1>
          {(() => {
            const bottleneckColumns = [
              {
                id: 'id',
                header: 'ID',
                cell: (b: any) => <span style={{ fontWeight: 'bold' }}>{b.id}</span>
              },
              {
                id: 'item_display_id',
                header: '樽頸代號 (Display ID)',
                cell: (b: any) => <span style={{ fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--accent-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }} title={b.item_type || 'Bottleneck'}><span>{getItemTypeStyles(b.item_type || 'Bottleneck').icon}</span> {b.item_display_id}</span>
              },
              {
                id: 'item_title',
                header: '阻礙名稱 (Title)',
                cell: (b: any) => <span style={{ fontWeight: 'bold' }}>📄 {b.item_title}</span>
              },
              {
                id: 'related_context_id',
                header: '關聯專案 (Context ID)',
                cell: (b: any) => (
                  <span className="relation-badge relation-badge-project">
                    {projects.find(p => String(p.id) === String(b.related_context_id))?.name || b.related_context_id || '—'}
                  </span>
                )
              },
              {
                id: 'item_type',
                header: '性質 (Item Type)',
                cell: (b: any) => <span className="nature-tag" style={{ backgroundColor: `${getItemTypeStyles(b.item_type || 'Bottleneck').bg}20`, color: getItemTypeStyles(b.item_type || 'Bottleneck').text, padding: '2px 6px', borderRadius: '4px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span>{getItemTypeStyles(b.item_type || 'Bottleneck').icon}</span> {b.item_type}</span>
              },
              {
                id: 'item_status',
                header: '狀態 (Item Status)',
                cell: (b: any) => getItemStatusBadge(b.item_status || 'Not Start')
              },
              {
                id: 'item_priority',
                header: '嚴重程度 (Item Priority)',
                cell: (b: any) => <span className="priority-high">{b.item_priority}</span>
              },
              {
                id: 'item_planned_start_date',
                header: '預計開始 (Planned Start)',
                cell: (b: any) => formatChineseDate(b.item_planned_start_date)
              },
              {
                id: 'item_planned_end_date',
                header: '預計結束 (Planned End)',
                cell: (b: any) => formatChineseDate(b.item_planned_end_date)
              },
              {
                id: 'item_actual_start_date',
                header: '實際開始 (Actual Start)',
                cell: (b: any) => formatChineseDate(b.item_actual_start_date)
              },
              {
                id: 'item_actual_end_date',
                header: '實際結束 (Actual End)',
                cell: (b: any) => formatChineseDate(b.item_actual_end_date)
              },
              {
                id: 'item_follow_by',
                header: '負責人 (Follow By)',
                cell: (b: any) => members.find(mem => String(mem.member_id) === String(b.item_follow_by))?.member_name || b.item_follow_by || '—'
              },
              {
                id: 'item_content',
                header: '詳細內容 (Content JSON)',
                cell: (b: any) => (
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {JSON.stringify(b.item_content)}
                  </span>
                )
              },
              {
                id: 'item_created_at',
                header: '創建時間 (Created At)',
                cell: (b: any) => formatChineseDateTime(b.item_created_at)
              },
              {
                id: 'item_updated_at',
                header: '更新時間 (Updated At)',
                cell: (b: any) => formatChineseDateTime(b.item_updated_at)
              },
              ...getRemainingProjectItemColumns(members, workspaces, projects, ['id', 'item_display_id', 'item_title', 'related_context_id', 'item_type', 'item_status', 'item_priority', 'item_planned_start_date', 'item_planned_end_date', 'item_actual_start_date', 'item_actual_end_date', 'item_follow_by', 'item_content', 'item_created_at', 'item_updated_at'])
            ];

            return (
              <>
                <TableViewToolbar data={filteredBottlenecks} columns={bottleneckColumns} state={toolbarState} onChange={setToolbarState} />
                <AdvancedTable
                tableId="bottlenecks_main_table"
                data={applyToolbar(filteredBottlenecks, bottleneckColumns)}
                columns={getVisibleColumns(bottleneckColumns)}
                onRowClick={(b) => setSelectedModalBottleneckId(b.id)}
                footerContent={renderNewPageRow(15)}
              />
              </>
            );
          })()}
        </div>
        {renderAllOverlays()}
      </div>
    );
  }

  if (selectedSubItemId === 'knowledge-table' || (activeTab === 'knowledge' && !!currentKnowledge)) {
    return (
      <div className={themeClass} style={{ ...styles.container, backgroundColor: containerBg }}>
        {renderCategoryTabBar()}
        
        <div style={styles.wrapper}>
          <h1 style={styles.visualTitle}>📊 業務知識總表 (Knowledge Glossary Item Table View)</h1>
          {(() => {
            const knowledgeColumns = [
              {
                id: 'id',
                header: 'ID',
                cell: (k: any) => <span style={{ fontWeight: 'bold' }}>{k.id}</span>
              },
              {
                id: 'item_display_id',
                header: '詞條代號 (Display ID)',
                cell: (k: any) => <span style={{ fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--accent-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }} title={k.item_type || 'Knowledge'}><span>{getItemTypeStyles(k.item_type || 'Knowledge').icon}</span> {k.item_display_id}</span>
              },
              {
                id: 'item_title',
                header: '詞條名稱 (Title)',
                cell: (k: any) => <span style={{ fontWeight: 'bold' }}>📄 {k.item_title}</span>
              },
              {
                id: 'related_context_id',
                header: '關聯環境 (Context ID)',
                cell: (k: any) => (
                  <span className="relation-badge relation-badge-project">
                    {projects.find(p => String(p.id) === String(k.related_context_id))?.name || k.related_context_id || '—'}
                  </span>
                )
              },
              {
                id: 'item_type',
                header: '性質 (Item Type)',
                cell: (k: any) => <span className="nature-tag" style={{ backgroundColor: `${getItemTypeStyles(k.item_type || 'Knowledge').bg}20`, color: getItemTypeStyles(k.item_type || 'Knowledge').text, padding: '2px 6px', borderRadius: '4px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span>{getItemTypeStyles(k.item_type || 'Knowledge').icon}</span> {k.item_type}</span>
              },
              {
                id: 'item_status',
                header: '狀態 (Item Status)',
                cell: (k: any) => getItemStatusBadge(k.item_status || 'Not Start')
              },
              {
                id: 'item_priority',
                header: '優先級 (Item Priority)',
                cell: (k: any) => <span className="priority-middle">{k.item_priority}</span>
              },
              {
                id: 'item_content',
                header: '詳細內容 (Content JSON)',
                cell: (k: any) => (
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {JSON.stringify(k.item_content)}
                  </span>
                )
              },
              {
                id: 'item_created_at',
                header: '創建時間 (Created At)',
                cell: (k: any) => formatChineseDateTime(k.item_created_at)
              },
              {
                id: 'item_updated_at',
                header: '更新時間 (Updated At)',
                cell: (k: any) => formatChineseDateTime(k.item_updated_at)
              },
              ...getRemainingProjectItemColumns(members, workspaces, projects, ['id', 'item_display_id', 'item_title', 'related_context_id', 'item_type', 'item_status', 'item_priority', 'item_content', 'item_created_at', 'item_updated_at'])
            ];

            return (
              <>
                <TableViewToolbar data={filteredKnowledge} columns={knowledgeColumns} state={toolbarState} onChange={setToolbarState} />
                <AdvancedTable
                tableId="knowledge_main_table"
                data={applyToolbar(filteredKnowledge, knowledgeColumns)}
                columns={getVisibleColumns(knowledgeColumns)}
                onRowClick={(k) => setSelectedModalKnowledgeId(k.id)}
                footerContent={renderNewPageRow(10)}
              />
              </>
            );
          })()}
        </div>
        {renderAllOverlays()}
      </div>
    );
  }

  // 2. Settings Views (System settings, AI key setups, DB statuses)
  if (activeTab === 'settings') {
    return (
      <div className={themeClass} style={{ ...styles.container, backgroundColor: containerBg }}>
        {renderCategoryTabBar()}
        <div style={styles.wrapper}>
          <h1 style={styles.visualTitle}>⚙️ {selectedSubItemId === 'setting-ai' ? 'AI Co-pilot 代理設定' : selectedSubItemId === 'setting-database' ? 'Neon 資料庫連線狀態' : '全域系統設定'}</h1>
          
          {selectedSubItemId === 'setting-ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
              <div style={styles.charterBlock}>
                <h3 style={styles.sectionTitle}>Google Gemini API Key</h3>
                <input
                  style={{ ...styles.textInput, width: '100%', marginTop: '10px' }}
                  type="password"
                  value={geminiKey}
                  onChange={e => setGeminiKey(e.target.value)}
                  placeholder="請輸入 GEMINI_API_KEY"
                />
                <button style={{ ...styles.saveBtn, marginTop: '12px' }} onClick={saveApiKey}>
                  儲存 API 金鑰
                </button>
              </div>
              <div style={styles.charterBlock}>
                <h3 style={styles.sectionTitle}>AI 路由決策模式</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.6' }}>
                  目前系統連線模式：<strong>{geminiKey && geminiKey !== 'your_gemini_api_key_here' ? 'Google Gemini 2.5 Cloud' : 'Offline Fallback Simulator'}</strong>
                </p>
              </div>
            </div>
          )}

          {selectedSubItemId === 'setting-database' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
              <div style={styles.charterBlock}>
                <h3 style={styles.sectionTitle}>資料庫主機狀態</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '10px' }}>
                  主機類型：<strong>Neon Cloud Serverless PostgreSQL (Singapore Pooler)</strong><br />
                  最大連線池連線逾時：<strong>15000 ms</strong>
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-done)', fontSize: '13px', fontWeight: 'bold', marginTop: '12px' }}>
                  <span className="status-lamp done" />
                  已連接成功 (ACTIVE)
                </div>
              </div>
              <div style={styles.charterBlock}>
                <h3 style={styles.sectionTitle}>重新初始化種子數據 (Seed Reset)</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  這將會清除現有的 10 張表格並載入 Sprint 3 的預置專案、章程與任務。
                </p>
                <button
                  style={{ ...styles.cancelBtn, color: 'var(--color-blocked)', borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', marginTop: '12px' }}
                  onClick={handleResetDb}
                  disabled={isDbResetting}
                >
                  {isDbResetting ? '重設中...' : '⚠️ 重設資料庫'}
                </button>
              </div>
            </div>
          )}

          {selectedSubItemId === 'setting-system' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
              <div style={styles.charterBlock}>
                <h3 style={styles.sectionTitle}>偏好樣式與主題</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '10px' }}>
                  系統主題：<strong>深色磨砂玻璃 (Dark Space Glassmorphic)</strong><br />
                  當前字型：<strong>Outfit (標題) & Plus Jakarta Sans (內文)</strong>
                </p>
              </div>
              <div style={styles.charterBlock}>
                <h3 style={styles.sectionTitle}>一鍵匯出 Excel 標準報表</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  系統支援將數據庫一鍵匯出符合企業 PMO 標準的 Traceability Matrix 與 RACI Excel 表格。
                </p>
                <button style={{ ...styles.editBtn, marginTop: '12px' }} onClick={() => alert('Excel 匯出引擎 PoC 正常！')}>
                  📥 匯出 Excel 報表
                </button>
              </div>
            </div>
          )}
        </div>
        {renderAllOverlays()}
      </div>
    );
  }

  // 3. User Account Views (Member User Table)
  if (activeTab === 'user' || selectedSubItemId === 'user-table') {
    return (
      <div className={themeClass} style={{ ...styles.container, backgroundColor: containerBg }}>
        {renderCategoryTabBar()}
        
        <div style={styles.wrapper}>
          <h1 style={{ ...styles.visualTitle, color: getTitleColor(), borderBottomColor: getBorderColor() }}>👤 用戶帳號總表 (Member User Table View)</h1>
          {(() => {
            const userColumns = [
              {
                id: 'member_id',
                header: 'Member ID',
                cell: (m: any) => <span style={{ fontWeight: 'bold' }}>{m.member_id}</span>
              },
              {
                id: 'member_name',
                header: '姓名 (Name)',
                cell: (m: any) => <span>👤 {m.member_name}</span>
              },
              {
                id: 'member_email',
                header: '電子郵件 (Email)',
                cell: (m: any) => m.member_email || '—'
              },
              {
                id: 'member_role',
                header: '角色 (Role)',
                cell: (m: any) => (
                  <span className="nature-tag" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#818CF8' }}>
                    {m.member_role || '—'}
                  </span>
                )
              },
              {
                id: 'member_ad_group',
                header: 'AD Group',
                cell: (m: any) => m.member_ad_group || '—'
              },
              {
                id: 'member_status',
                header: '狀態 (Status)',
                cell: (m: any) => (
                  <>
                    {m.member_status === 'Active' ? (
                      <span className="status-badge-done">● {m.member_status}</span>
                    ) : (
                      <span className="status-badge-todo">● {m.member_status || 'Offline'}</span>
                    )}
                  </>
                )
              },
              {
                id: 'member_created_at',
                header: '創建時間 (Created At)',
                cell: (m: any) => formatChineseDateTime(m.member_created_at)
              },
              {
                id: 'member_updated_at',
                header: '更新時間 (Updated At)',
                cell: (m: any) => formatChineseDateTime(m.member_updated_at)
              }
            ];

            return (
              <>
                <TableViewToolbar data={filteredMembers} columns={userColumns} state={toolbarState} onChange={setToolbarState} />
                <AdvancedTable
                tableId="member_user_main_table"
                data={applyToolbar(filteredMembers, userColumns)}
                columns={getVisibleColumns(userColumns)}
                onRowClick={(m) => setSelectedModalMemberId(String(m.member_id))}
                footerContent={renderNewPageRow(8)}
              />
              </>
            );
          })()}
        </div>
        {renderAllOverlays()}
      </div>
    );
  }

  // 3b. Document Items Views
  if (activeTab === 'documents' || selectedSubItemId === 'document-table') {
    return (
      <div className={themeClass} style={{ ...styles.container, backgroundColor: containerBg }}>
        {renderCategoryTabBar()}
        
        <div style={styles.wrapper}>
          <h1 style={{ ...styles.visualTitle, color: getTitleColor(), borderBottomColor: getBorderColor() }}>📄 所有文件總表 (Document Item Table View)</h1>
          {(() => {
            const documentColumns = [
              {
                id: 'document_id',
                header: 'Document ID',
                cell: (d: any) => <span style={{ fontWeight: 'bold' }}>{d.document_id}</span>
              },
              {
                id: 'document_name',
                header: '文件名稱 (Name)',
                cell: (d: any) => <span style={{ fontWeight: 'bold' }}>📄 {d.document_name}</span>
              },
              {
                id: 'document_type',
                header: '文件類型 (Type)',
                cell: (d: any) => (
                  <span className="nature-tag" style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#4ADE80' }}>
                    {d.document_type}
                  </span>
                )
              },
              {
                id: 'document_status',
                header: '文件狀態 (Status)',
                cell: (d: any) => <span className="status-badge-progress">● {d.document_status}</span>
              },
              {
                id: 'project_context',
                header: '專案環境 (Project Context)',
                cell: (d: any) => (
                  <span className="relation-badge relation-badge-project">
                    {projects.find(p => String(p.id) === String(d.project_context))?.name || d.project_context || '—'}
                  </span>
                )
              },
              {
                id: 'document_content',
                header: '文件內容摘要 (Content JSON)',
                cell: (d: any) => (
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {JSON.stringify(d.document_content)}
                  </span>
                )
              },
              {
                id: 'document_created_by',
                header: '建立人 ID (Created By)',
                cell: (d: any) => d.document_created_by || '—'
              },
              {
                id: 'document_created_at',
                header: '建立時間 (Created At)',
                cell: (d: any) => formatChineseDateTime(d.document_created_at)
              },
              {
                id: 'document_updated_at',
                header: '更新時間 (Updated At)',
                cell: (d: any) => formatChineseDateTime(d.document_updated_at)
              }
            ];

            return (
              <>
                <TableViewToolbar data={filteredDocuments} columns={documentColumns} state={toolbarState} onChange={setToolbarState} />
                <AdvancedTable
                tableId="documents_main_table"
                data={applyToolbar(filteredDocuments, documentColumns)}
                columns={getVisibleColumns(documentColumns)}
              />
              </>
            );
          })()}
        </div>
        {renderAllOverlays()}
      </div>
    );
  }

  // 3c. Workspaces Views
  if (activeTab === 'workspaces' || selectedSubItemId === 'workspace-table') {
    return (
      <div className={themeClass} style={{ ...styles.container, backgroundColor: containerBg }}>
        {renderCategoryTabBar()}
        
        <div style={styles.wrapper}>
          <h1 style={{ ...styles.visualTitle, color: getTitleColor(), borderBottomColor: getBorderColor() }}>🗃️ 工作空間總表 (Workspace Table View)</h1>
          {(() => {
            const workspaceColumns = [
              {
                id: 'workspace_id',
                header: 'Workspace ID',
                cell: (w: any) => <span style={{ fontWeight: 'bold' }}>{w.workspace_id}</span>
              },
              {
                id: 'prefix_code',
                header: '代碼 (Prefix Code)',
                cell: (w: any) => (
                  <span className="nature-tag" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24' }}>
                    {w.prefix_code}
                  </span>
                )
              },
              {
                id: 'workspace_name',
                header: '工作區名稱 (Workspace Name)',
                cell: (w: any) => <span style={{ fontWeight: 'bold' }}>🏢 {w.workspace_name}</span>
              },
              {
                id: 'workspace_created_at',
                header: '建立時間 (Created At)',
                cell: (w: any) => formatChineseDateTime(w.workspace_created_at)
              }
            ];

            return (
              <>
                <TableViewToolbar data={filteredWorkspaces} columns={workspaceColumns} state={toolbarState} onChange={setToolbarState} />
                <AdvancedTable
                tableId="workspaces_main_table"
                data={applyToolbar(filteredWorkspaces, workspaceColumns)}
                columns={getVisibleColumns(workspaceColumns)}
                onRowClick={(w) => setSelectedModalWorkspaceId(String(w.workspace_id))}
                footerContent={renderNewPageRow(4)}
              />
              </>
            );
          })()}
        </div>
        {renderAllOverlays()}
      </div>
    );
  }

  // 4. Traceability Matrix Grid Detail (Inside Projects category)
  if (activeTab === 'projects' && selectedSubItemId === 'project-traceability') {
    return (
      <div className={themeClass} style={{ ...styles.container, backgroundColor: containerBg }}>
        {renderCategoryTabBar()}
        <div style={styles.wrapper}>
          <h1 style={styles.visualTitle}>🔗 需求對接追蹤矩陣 (Traceability Matrix)</h1>
          
          {/* Quick link creation form */}
          <div style={{ ...styles.charterBlock, marginTop: '20px' }}>
            <h3 style={styles.sectionTitle}>新增需求對接連結</h3>
            <form onSubmit={handleCreateLink} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>選擇需求基準 (Requirement)</label>
                <ThemedSelect style={styles.selectInput} value={traceReqId} onChange={e => setTraceReqId(e.target.value)} required>
                  <option value="">-- 請選擇 --</option>
                  {requirements.map(r => <option key={r.id} value={r.id}>{r.title} ({r.priority})</option>)}
                </ThemedSelect>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>選擇開發工單 (Task)</label>
                <ThemedSelect style={styles.selectInput} value={traceTaskId} onChange={e => setTraceTaskId(e.target.value)} required>
                  <option value="">-- 請選擇 --</option>
                  {tasks.map(t => <option key={t.id} value={t.id}>{t.title} ({t.status})</option>)}
                </ThemedSelect>
              </div>
              <button type="submit" style={styles.saveBtn} disabled={isLinking}>
                {isLinking ? '建立中...' : '🔗 綁定 Traceability'}
              </button>
            </form>
          </div>

          {/* List of active traceability matrix connections */}
          <div style={{ marginTop: '24px' }}>
            <h3 style={styles.sectionTitle}>已對接的對照矩陣 ({traceability.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              {traceability.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>尚未建立任何對接關聯。請在上方選擇進行連結。</div>
              ) : (
                traceability.map(link => (
                  <div key={link.id} style={{ ...styles.charterBlock, padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, marginRight: '16px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--accent-secondary)', fontWeight: 600 }}>
                        {link.requirement_title || '未知需求 ID'}
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                        ➡️ {link.task_title || '未知工單 ID'}
                      </span>
                    </div>
                    <button
                      style={{ ...styles.cancelBtn, padding: '4px 8px', fontSize: '11px', color: 'var(--color-blocked)', borderColor: 'rgba(239,68,68,0.2)' }}
                      onClick={() => onDeleteTraceability(link.id)}
                    >
                      解除綁定
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        {renderAllOverlays()}
      </div>
    );
  }

  // ----------------------------------------------------
  // STANDARD EDITOR VIEWS (Tasks, Meetings, Charter, RACI, Bottleneck, Glossary)
  // ----------------------------------------------------
  
  // Render empty state if nothing selected
  const hasActiveItem = currentTask || currentMeeting || currentRequirement || currentBottleneck || currentKnowledge || currentProduct || (selectedSubItemId === 'project-charter' && currentCharter) || (selectedSubItemId === 'project-plan' && currentPlan);
  if (!hasActiveItem) {
    return <div style={styles.emptyState}>請從左二欄選擇項目以編輯或查閱詳細內容。</div>;
  }

  return (
    <div className={themeClass} style={{ ...styles.container, backgroundColor: containerBg }}>
      {renderCategoryTabBar()}
      <div style={styles.docWrapper}>
        
        {/* Doc Header */}
        <div style={styles.docHeader}>
          <div>
            <div style={{ ...styles.metaRow, alignItems: 'center' }}>
              <button
                style={{
                  marginRight: '12px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 500,
                  backgroundColor: isLightTheme ? '#FFFFFF' : 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid ' + (isLightTheme ? '#E2E8F0' : 'var(--border-color)'),
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: isLightTheme ? '#475569' : 'var(--text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: isLightTheme ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                }}
                onClick={() => {
                  if (activeTab === 'products') onSelectSubItem('product-table');
                  else if (activeTab === 'tasks') onSelectSubItem('task-table');
                  else if (activeTab === 'meetings') onSelectSubItem('meeting-table');
                  else if (activeTab === 'projects') {
                    onSelectSubItem('project-table');
                  }
                  else if (activeTab === 'bottlenecks') onSelectSubItem('bottleneck-table');
                  else if (activeTab === 'knowledge') onSelectSubItem('knowledge-table');
                }}
              >
                ⬅️ 返回總表
              </button>
              <span style={styles.metaBadge}>
                ID: {
                  activeTab === 'products' ? currentProduct?.id :
                  activeTab === 'tasks' ? currentTask?.id :
                  activeTab === 'meetings' ? currentMeeting?.id :
                  selectedSubItemId === 'project-charter' ? currentCharter?.id :
                  selectedSubItemId === 'project-plan' ? currentPlan?.id :
                  currentRequirement ? currentRequirement.id :
                  activeTab === 'bottlenecks' ? currentBottleneck?.id :
                  currentKnowledge?.id
                }
              </span>
            </div>
            {isEditing && selectedSubItemId !== 'project-charter' && selectedSubItemId !== 'project-plan' && !currentKnowledge ? (
              <input
                style={styles.titleInput}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            ) : (
              <h1 style={styles.docTitle}>
                {
                  activeTab === 'products' ? currentProduct?.name :
                  activeTab === 'tasks' ? currentTask?.title :
                  activeTab === 'meetings' ? currentMeeting?.title :
                  selectedSubItemId === 'project-charter' ? currentCharter?.title :
                  selectedSubItemId === 'project-plan' ? currentPlan?.title :
                  currentRequirement ? currentRequirement.title :
                  activeTab === 'bottlenecks' ? currentBottleneck?.title :
                  currentKnowledge?.term
                }
              </h1>
            )}
          </div>
          
          <div style={styles.headerActions}>
            {isEditing ? (
              <>
                <button style={styles.cancelBtn} onClick={() => setIsEditing(false)}>
                  取消
                </button>
                <button style={styles.saveBtn} onClick={handleSave} disabled={isSaving}>
                  {isSaving ? '儲存中...' : '儲存變更'}
                </button>
              </>
            ) : (
              <>
                <button 
                  style={{ ...styles.cancelBtn, color: '#ef4444' }} 
                  onClick={() => {
                    const idToDelete = currentTask?.id || currentMeeting?.id || currentBottleneck?.id || currentKnowledge?.id || currentRequirement?.id;
                    if (idToDelete) handleDelete(idToDelete);
                  }}
                >
                  🗑️ 刪除
                </button>
                <button style={styles.editBtn} onClick={() => setIsEditing(true)}>
                  編輯文件
                </button>
              </>
            )}
          </div>
        </div>

        {/* METADATA FORM SECTIONS */}

        {/* Task Properties */}
        {activeTab === 'tasks' && currentTask && (
          <div style={styles.propertiesGrid}>
            <div style={styles.propertyItem}>
              <span style={styles.propertyLabel}>狀態：</span>
              {isEditing ? (
                <ThemedSelect style={styles.selectInput} value={editStatus} onChange={(e: any) => setEditStatus(e.target.value)}>
                  <option value="Not Start">Not Start</option>
                  <option value="Ready">Ready</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Stuck">Stuck</option>
                  <option value="Review">Review</option>

                  <option value="Completed">Completed</option>
                  <option value="Closed">Closed</option>
                  <option value="Backlog">Backlog</option>
                </ThemedSelect>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`status-lamp ${currentTask.item_status?.toLowerCase().replace(' ', '')}`} />
                  <strong style={{ color: `var(--color-${currentTask.item_status?.toLowerCase().replace(' ', '')})` }}>
                    {currentTask.item_status}
                  </strong>
                </span>
              )}
            </div>
            <div style={styles.propertyItem}>
              <span style={styles.propertyLabel}>任務性質：</span>
              {isEditing ? (
                <ThemedSelect style={styles.selectInput} value={editNature} onChange={(e: any) => setEditNature(e.target.value)}>
                  <option value="Epic">Epic</option>
                  <option value="Task">Task</option>
                  <option value="Event">Event</option>
                  <option value="Micro Task">Micro Task</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Bottleneck">Bottleneck</option>
                  <option value="Knowledge">Knowledge</option>
                  <option value="Casual Note">Casual Note</option>
                  <option value="Bug">Bug</option>
                  <option value="UAT">UAT</option>
                  <option value="Deployment">Deployment</option>
                  <option value="Milestone">Milestone</option>
                  <option value="Business Objective">Business Objective</option>
                  <option value="Business Requirement">Business Requirement</option>
                  <option value="User Story">User Story</option>
                </ThemedSelect>
              ) : (
                currentTask.item_type ? <span className="nature-tag" style={{ backgroundColor: `${getItemTypeStyles(currentTask.item_type).bg}20`, color: getItemTypeStyles(currentTask.item_type).text, padding: '2px 6px', borderRadius: '4px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span>{getItemTypeStyles(currentTask.item_type).icon}</span> {currentTask.item_type}</span> : '-'
              )}
            </div>
            <div style={styles.propertyItem}>
              <span style={styles.propertyLabel}>優先級：</span>
              {isEditing ? (
                <ThemedSelect style={styles.selectInput} value={editPriority} onChange={(e: any) => setEditPriority(e.target.value)}>
                  <option value="High">High</option>
                  <option value="Middle">Middle</option>
                  <option value="Low">Low</option>
                </ThemedSelect>
              ) : (
                <span className={currentTask.item_priority === 'High' ? 'priority-high' : currentTask.item_priority === 'Low' ? 'priority-low' : 'priority-middle'}>
                  {currentTask.item_priority || 'Middle'}
                </span>
              )}
            </div>

            <div style={styles.propertyItem}>
              <span style={styles.propertyLabel}>負責人 (Follow By)：</span>
              {isEditing ? (
                <div style={{ flex: 1 }}>
                  <CreatableSelect
                    styles={reactSelectStyles}
                    value={editFollowBy ? { value: editFollowBy, label: members.find(m => String(m.member_id) === editFollowBy)?.member_name || editFollowBy } : null}
                    onChange={(selected: any) => setEditFollowBy(selected ? selected.value : '')}
                    onCreateOption={async (inputValue: string) => {
                      const trimmed = inputValue.trim();
                      if (!trimmed) return;
                      try {
                        const newMem = await api.createMember({
                          member_name: trimmed,
                          member_email: null,
                          member_role: 'Developer',
                          member_status: 'Active'
                        });
                        if (onRefreshData) await onRefreshData();
                        setEditFollowBy(String(newMem.member_id));
                      } catch (err) {
                        alert('新增成員失敗');
                      }
                    }}
                    options={members.map(m => ({ value: String(m.member_id), label: m.member_name }))}
                    placeholder="選擇或輸入新增負責人..."
                    isClearable
                  />
                </div>
              ) : (
                members.find(m => String(m.member_id) === String(currentTask.item_follow_by))?.member_name || currentTask.item_follow_by || '—'
              )}
            </div>
            <div style={styles.propertyItem}>
              <span style={styles.propertyLabel}>指派者 (Assigner)：</span>
              {isEditing ? (
                <div style={{ flex: 1 }}>
                  <CreatableSelect
                    styles={reactSelectStyles}
                    value={editAssignedBy ? { value: editAssignedBy, label: members.find(m => String(m.member_id) === editAssignedBy)?.member_name || editAssignedBy } : null}
                    onChange={(selected: any) => setEditAssignedBy(selected ? selected.value : '')}
                    onCreateOption={async (inputValue: string) => {
                      const trimmed = inputValue.trim();
                      if (!trimmed) return;
                      try {
                        const newMem = await api.createMember({
                          member_name: trimmed,
                          member_email: null,
                          member_role: 'Developer',
                          member_status: 'Active'
                        });
                        if (onRefreshData) await onRefreshData();
                        setEditAssignedBy(String(newMem.member_id));
                      } catch (err) {
                        alert('新增成員失敗');
                      }
                    }}
                    options={members.map(m => ({ value: String(m.member_id), label: m.member_name }))}
                    placeholder="選擇或輸入新增指派者..."
                    isClearable
                  />
                </div>
              ) : (
                members.find(m => String(m.member_id) === String(currentTask.item_assigned_by))?.member_name || currentTask.item_assigned_by || '—'
              )}
            </div>
            <div style={styles.propertyItem}>
              <span style={styles.propertyLabel}>關聯專案：</span>
              {isEditing ? (
                <Select
                  styles={reactSelectStyles}
                  value={projects.find(p => String(p.id) === String(editContextId)) ? { value: editContextId, label: projects.find(p => String(p.id) === String(editContextId))?.name } : null}
                  onChange={(selected: any) => setEditContextId(selected ? selected.value : '')}
                  options={[
                    { value: '', label: '-- 無關聯 --' },
                    ...projects.map(p => ({ value: String(p.id), label: p.name }))
                  ]}
                  placeholder="-- 無關聯 --"
                  isClearable
                />
              ) : (
                (() => {
                  const proj = projects.find(p => String(p.id) === String(currentTask.related_context_id));
                  return proj ? (
                    <span 
                      className="relation-badge relation-badge-project"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedProductProjectId(proj.id);
                      }}
                    >
                      💻 {proj.name}
                    </span>
                  ) : '—';
                })()
              )}
            </div>
            <div style={styles.propertyItem}>
              <span style={styles.propertyLabel}>關聯會議：</span>
              {isEditing ? (
                <Select
                  styles={reactSelectStyles}
                  value={meetings.find(m => String(m.id) === String(editMeetingId)) ? { value: editMeetingId, label: meetings.find(m => String(m.id) === String(editMeetingId))?.title } : null}
                  onChange={(selected: any) => setEditMeetingId(selected ? selected.value : '')}
                  options={[
                    { value: '', label: '-- 無關聯 --' },
                    ...meetings.map(m => ({ value: String(m.id), label: m.title }))
                  ]}
                  placeholder="-- 無關聯 --"
                  isClearable
                />
              ) : (
                (() => {
                  const meeting = meetings.find(m => String(m.id) === String(currentTask.item_attribute?.related_meeting_id));
                  return meeting ? (
                    <span 
                      className="relation-badge relation-badge-meeting"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        // Assuming you might want a way to select meeting in main pane too
                        // But there is no general setSelectedDrawerMeetingId in main pane view?
                        // Let's just display it.
                      }}
                    >
                      💬 {meeting.title}
                    </span>
                  ) : '—';
                })()
              )}
            </div>
            <div style={styles.propertyItem}>
              <span style={styles.propertyLabel}>關聯樽頸風險：</span>
              {isEditing ? (
                <Select
                  styles={reactSelectStyles}
                  value={bottlenecks.find(b => String(b.id) === String(editBottleneckId)) ? { value: editBottleneckId, label: bottlenecks.find(b => String(b.id) === String(editBottleneckId))?.item_title || bottlenecks.find(b => String(b.id) === String(editBottleneckId))?.title } : null}
                  onChange={(selected: any) => setEditBottleneckId(selected ? selected.value : '')}
                  options={[
                    { value: '', label: '-- 無關聯 --' },
                    ...bottlenecks.map(b => ({ value: String(b.id), label: b.item_title || b.title }))
                  ]}
                  placeholder="-- 無關聯 --"
                  isClearable
                />
              ) : (
                (() => {
                  const bn = bottlenecks.find(b => String(b.id) === String(currentTask.item_attribute?.bottleneck_id));
                  return bn ? (
                    <span 
                      className="relation-badge relation-badge-bottleneck"
                      style={{ cursor: 'pointer' }}
                    >
                      ⚠️ {bn.title || bn.item_title}
                    </span>
                  ) : '—';
                })()
              )}
            </div>
          </div>
        )}

        {/* Requirement Properties */}
        {activeTab === 'projects' && currentRequirement && (
          <div style={styles.propertiesGrid}>
            <div style={styles.propertyItem}>
              <span style={styles.propertyLabel}>需求狀態：</span>
              {isEditing ? (
                <ThemedSelect style={styles.selectInput} value={reqStatus} onChange={(e) => setReqStatus(e.target.value)}>
                  <option value="DRAFT">DRAFT (草案)</option>
                  <option value="APPROVED">APPROVED (已核准)</option>
                  <option value="REJECTED">REJECTED (已駁回)</option>
                </ThemedSelect>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`status-lamp ${currentRequirement.status === 'APPROVED' ? 'done' : 'progress'}`} />
                  <strong>{currentRequirement.status}</strong>
                </span>
              )}
            </div>
            <div style={styles.propertyItem}>
              <span style={styles.propertyLabel}>MoSCoW 優先級：</span>
              {isEditing ? (
                <ThemedSelect style={styles.selectInput} value={reqPriority} onChange={(e) => setReqPriority(e.target.value)}>
                  <option value="Must">Must (必須擁有)</option>
                  <option value="Should">Should (應該擁有)</option>
                  <option value="Could">Could (可以擁有)</option>
                  <option value="Won't">Won't (暫不擁有)</option>
                </ThemedSelect>
              ) : (
                <span className="nature-tag">{currentRequirement.priority}</span>
              )}
            </div>
            <div style={styles.propertyItem}>
              <span style={styles.propertyLabel}>需求分類：</span>
              {isEditing ? (
                <ThemedSelect style={styles.selectInput} value={reqCategory} onChange={(e) => setReqCategory(e.target.value)}>
                  <option value="Functional">Functional (功能需求)</option>
                  <option value="Non-Functional">Non-Functional (非功能需求)</option>
                  <option value="Technical">Technical (技術需求)</option>
                </ThemedSelect>
              ) : (
                <strong>{currentRequirement.category}</strong>
              )}
            </div>
          </div>
        )}

        {/* WBS Plans / RACI Properties */}
        {activeTab === 'projects' && selectedSubItemId === 'project-plan' && currentPlan && (
          <div style={styles.propertiesGrid}>
            <div style={styles.propertyItem}>
              <span style={styles.propertyLabel}>里程碑日期：</span>
              {isEditing ? (
                <input style={styles.textInput} type="date" value={planMilestoneDate} onChange={(e) => setPlanMilestoneDate(e.target.value)} />
              ) : (
                <strong>{formatDateString(currentPlan.milestone_date)}</strong>
              )}
            </div>
            <div style={styles.propertyItem}>
              <span style={styles.propertyLabel}>R - Responsible (執行者)：</span>
              {isEditing ? (
                <input style={styles.textInput} type="text" value={rAssignees} onChange={(e) => setRAssignees(e.target.value)} />
              ) : (
                <span className="nature-tag">{currentPlan.r_assignees?.join(', ') || '無'}</span>
              )}
            </div>
            <div style={styles.propertyItem}>
              <span style={styles.propertyLabel}>A - Accountable (核准者)：</span>
              {isEditing ? (
                <input style={styles.textInput} type="text" value={aAssignees} onChange={(e) => setAAssignees(e.target.value)} />
              ) : (
                <span className="nature-tag" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-done)' }}>
                  {currentPlan.a_assignees?.join(', ') || '無'}
                </span>
              )}
            </div>
            <div style={styles.propertyItem}>
              <span style={styles.propertyLabel}>C - Consulted (諮詢者)：</span>
              {isEditing ? (
                <input style={styles.textInput} type="text" value={cAssignees} onChange={(e) => setCAssignees(e.target.value)} />
              ) : (
                <span>{currentPlan.c_assignees?.join(', ') || '無'}</span>
              )}
            </div>
            <div style={styles.propertyItem}>
              <span style={styles.propertyLabel}>I - Informed (知會者)：</span>
              {isEditing ? (
                <input style={styles.textInput} type="text" value={iAssignees} onChange={(e) => setIAssignees(e.target.value)} />
              ) : (
                <span>{currentPlan.i_assignees?.join(', ') || '無'}</span>
              )}
            </div>
          </div>
        )}

        {/* Bottleneck Properties */}
        {activeTab === 'bottlenecks' && currentBottleneck && (
          <div style={styles.propertiesGrid}>
            <div style={styles.propertyItem}>
              <span style={styles.propertyLabel}>樽頸狀態：</span>
              {isEditing ? (
                <ThemedSelect style={styles.selectInput} value={bottleneckStatus} onChange={(e: any) => setBottleneckStatus(e.target.value)}>
                  <option value="Not Start">Not Start</option>
                  <option value="Ready">Ready</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Stuck">Stuck</option>
                  <option value="Review">Review</option>

                  <option value="Completed">Completed</option>
                  <option value="Closed">Closed</option>
                  <option value="Backlog">Backlog</option>
                </ThemedSelect>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`status-lamp ${currentBottleneck.item_status?.toLowerCase().replace(' ', '')}`} />
                  <strong>{currentBottleneck.item_status}</strong>
                </span>
              )}
            </div>
            <div style={styles.propertyItem}>
              <span style={styles.propertyLabel}>嚴重程度：</span>
              {isEditing ? (
                <ThemedSelect style={styles.selectInput} value={bottleneckSeverity} onChange={(e: any) => setBottleneckSeverity(e.target.value)}>
                  <option value="High">High</option>
                  <option value="Middle">Middle</option>
                  <option value="Low">Low</option>
                </ThemedSelect>
              ) : (
                <strong style={{ color: currentBottleneck.item_priority === 'High' ? 'var(--color-blocked)' : 'var(--text-secondary)' }}>
                  {currentBottleneck.item_priority || 'Middle'} Severity
                </strong>
              )}
            </div>
          </div>
        )}

        {/* Meeting Properties */}
        {activeTab === 'meetings' && currentMeeting && (
          <div style={styles.propertiesGrid}>
            <div style={styles.propertyItem}>
              <span style={styles.propertyLabel}>會議日期：</span>
              {isEditing ? (
                <input style={styles.textInput} type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
              ) : (
                <strong>{formatChineseDate(currentMeeting.meeting_date)}</strong>
              )}
            </div>
            <div style={styles.propertyItem}>
              <span style={styles.propertyLabel}>與會主持：</span>
              {isEditing ? (
                <input style={styles.textInput} type="text" value={meetingHost} onChange={(e) => setMeetingHost(e.target.value)} />
              ) : (
                <strong>{currentMeeting.host || '—'}</strong>
              )}
            </div>
            <div style={styles.propertyItem}>
              <span style={styles.propertyLabel}>關聯專案：</span>
              {isEditing ? (
                <ThemedSelect style={styles.selectInput} value={meetingProjectId} onChange={(e) => setMeetingProjectId(e.target.value)}>
                  <option value="">-- 未指定 --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </ThemedSelect>
              ) : (
                (() => {
                  const proj = projects.find(p => String(p.id) === String(currentMeeting.project_id));
                  return proj ? (
                    <span className="relation-badge relation-badge-project">{proj.name}</span>
                  ) : '—';
                })()
              )}
            </div>
          </div>
        )}

        {/* CONTENT SECTIONS */}

        {/* Charter Content Block */}
        {activeTab === 'projects' && selectedSubItemId === 'project-charter' && currentCharter && (
          <div style={styles.contentSection}>
            <div style={styles.charterBlock}>
              <h3 style={styles.sectionTitle}>專案核心目標 (Goals)</h3>
              {isEditing ? (
                <textarea style={styles.textareaInput} rows={3} value={charterGoals} onChange={(e) => setCharterGoals(e.target.value)} />
              ) : (
                <p style={styles.charterText}>{charterGoals || '無明確目標目標。'}</p>
              )}
            </div>

            <div style={styles.charterBlock}>
              <h3 style={styles.sectionTitle}>專案範圍 (In-Scope)</h3>
              {isEditing ? (
                <textarea style={styles.textareaInput} rows={3} value={charterScope} onChange={(e) => setCharterScope(e.target.value)} />
              ) : (
                <p style={styles.charterText}>{charterScope || '無範圍範圍。'}</p>
              )}
            </div>

            <div style={styles.charterBlock}>
              <h3 style={styles.sectionTitle}>排除範圍 (Out-of-Scope)</h3>
              {isEditing ? (
                <textarea style={styles.textareaInput} rows={3} value={charterOutScope} onChange={(e) => setCharterOutScope(e.target.value)} />
              ) : (
                <p style={styles.charterText}>{charterOutScope || '無排除說明。'}</p>
              )}
            </div>

            <div>
              <h3 style={styles.sectionTitle}>5W2H 專案骨架屬性</h3>
              <div style={styles.w5h2Grid}>
                {[
                  { label: 'WHAT (產品是什麼)', val: w5h2What, set: setW5h2What },
                  { label: 'WHY (核心痛點/價值)', val: w5h2Why, set: setW5h2Why },
                  { label: 'WHO (干係人/用戶群)', val: w5h2Who, set: setW5h2Who },
                  { label: 'WHERE (部署或交付處)', val: w5h2Where, set: setW5h2Where },
                  { label: 'WHEN (里程碑時段)', val: w5h2When, set: setW5h2When },
                  { label: 'HOW (技術手段方法)', val: w5h2How, set: setW5h2How },
                  { label: 'HOW MUCH (預算估算)', val: w5h2HowMuch, set: setW5h2HowMuch },
                ].map((item, idx) => (
                  <div key={idx} style={styles.w5h2Card}>
                    <span style={styles.w5h2Label}>{item.label}</span>
                    {isEditing ? (
                      <input style={styles.w5h2Input} type="text" value={item.val} onChange={(e) => item.set(e.target.value)} />
                    ) : (
                      <span style={styles.w5h2Val}>{item.val || '-'}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Knowledge Glossary Content Block */}
        {activeTab === 'knowledge' && currentKnowledge && (
          <div style={styles.contentSection}>
            <div style={styles.charterBlock}>
              <h3 style={styles.sectionTitle}>知識名詞拼寫 (Term)</h3>
              {isEditing ? (
                <input style={styles.textInput} type="text" value={knowledgeTerm} onChange={(e) => setKnowledgeTerm(e.target.value)} />
              ) : (
                <strong style={{ fontSize: '18px', color: 'var(--accent-secondary)' }}>{currentKnowledge.term}</strong>
              )}
            </div>

            <div style={styles.charterBlock}>
              <h3 style={styles.sectionTitle}>術語定義 (Definition)</h3>
              {isEditing ? (
                <textarea style={styles.textareaInput} rows={5} value={editDescOrContent} onChange={(e) => setEditDescOrContent(e.target.value)} />
              ) : (
                <p style={styles.charterText}>{editDescOrContent}</p>
              )}
            </div>

            <div style={styles.charterBlock}>
              <h3 style={styles.sectionTitle}>KPI 計算口徑 (KPI Formula)</h3>
              {isEditing ? (
                <input style={{ ...styles.textInput, width: '100%' }} type="text" value={knowledgeKpi} onChange={(e) => setKnowledgeKpi(e.target.value)} />
              ) : (
                <code style={{ fontSize: '14px', color: '#34D399', fontFamily: 'monospace' }}>
                  {currentKnowledge.kpi_formula || '無對應KPI計算口徑'}
                </code>
              )}
            </div>
          </div>
        )}

        {/* Product Details Content Block */}
        {activeTab === 'products' && currentProduct && (
          <div style={styles.contentSection}>
            <div style={styles.charterBlock}>
              <h3 style={styles.sectionTitle}>產品 Vision 終極願景</h3>
              {isEditing ? (
                <textarea 
                  style={styles.textareaInput} 
                  rows={4} 
                  value={productVision} 
                  onChange={(e) => setProductVision(e.target.value)} 
                />
              ) : (
                <p style={{ ...styles.charterText, fontSize: '15px', color: 'var(--accent-secondary)', fontStyle: 'italic' }}>
                  🚀 {currentProduct.product_vision || '無設定產品願景'}
                </p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={styles.charterBlock}>
                <h3 style={styles.sectionTitle}>Business Owner (業務話事人)</h3>
                {isEditing ? (
                  <input 
                    style={styles.textInput} 
                    type="text" 
                    value={productBusinessOwner} 
                    onChange={(e) => setProductBusinessOwner(e.target.value)} 
                  />
                ) : (
                  <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                    👤 {currentProduct.business_owner || 'Unassigned'}
                  </div>
                )}
              </div>

              <div style={styles.charterBlock}>
                <h3 style={styles.sectionTitle}>Technical Owner (技術總負責人)</h3>
                {isEditing ? (
                  <input 
                    style={styles.textInput} 
                    type="text" 
                    value={productTechOwner} 
                    onChange={(e) => setProductTechOwner(e.target.value)} 
                  />
                ) : (
                  <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                    💻 {currentProduct.tech_owner || 'Unassigned'}
                  </div>
                )}
              </div>
            </div>

            <div style={styles.charterBlock}>
              <h3 style={styles.sectionTitle}>🔗 跨專案核心資產鏈結</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
                <div>
                  <strong style={{ display: 'block', marginBottom: '10px' }}>* 關聯專案列表:</strong>
                  {(() => {
                    const projectColumns = [
                      {
                        id: 'name',
                        header: '專案名稱',
                        cell: (proj: any) => {
                          const getProjectIcon = (name: string) => {
                            if (name.includes('Airport') || name.includes('Performance')) return '📈';
                            if (name.includes('Self Service') || name.includes('HKIA')) return '👤';
                            if (name.includes('Baggage')) return '💼';
                            if (name.includes('Water')) return '💧';
                            return '💻';
                          };
                          return <span>{getProjectIcon(proj.name)} {proj.name}</span>;
                        }
                      },
                      {
                        id: 'status',
                        header: '狀態',
                        cell: (proj: any) => (
                          <>
                            {proj.status === '進行中' && <span className="status-badge-progress">● 進行中</span>}
                            {proj.status === '未開始' && <span className="status-badge-todo">● 未開始</span>}
                            {proj.status === '已完成' && <span className="status-badge-done">● 已完成</span>}
                          </>
                        )
                      },
                      {
                        id: 'end_date',
                        header: '專案完成日',
                        cell: (proj: any) => formatChineseDate(proj.end_date)
                      },
                      {
                        id: 'remaining',
                        header: '剩餘時間',
                        cell: (proj: any) => getRemainingTime(proj.end_date)
                      },
                      {
                        id: 'completion_rate',
                        header: '完成度',
                        cell: (proj: any) => {
                          const projTasks = tasks.filter(tk => String(tk.project_id) === String(proj.id));
                          const totalTasks = projTasks.length;
                          const doneTasks = projTasks.filter(tk => tk.status === 'DONE').length;
                          const completionRate = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;
                          const isCompleted = completionRate === 100 && totalTasks > 0;
                          return (
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <div className="progress-bar-container" style={{ marginRight: '8px' }}>
                                <div className="progress-bar-fill" style={{ width: `${completionRate}%`, backgroundColor: isCompleted ? '#10B981' : '#34D399' }} />
                              </div>
                              <span style={{ fontFamily: 'monospace' }}>{completionRate.toFixed(2)}%</span>
                            </div>
                          );
                        }
                      },
                      {
                        id: 'task_count',
                        header: '任務數量',
                        cell: (proj: any) => tasks.filter(tk => String(tk.project_id) === String(proj.id)).length
                      },
                      {
                        id: 'priority',
                        header: '優先級',
                        cell: (proj: any) => (
                          <>
                            {proj.priority === 'High' && <span className="priority-high">High</span>}
                            {proj.priority === 'Middle' && <span className="priority-middle">Middle</span>}
                            {proj.priority === 'Low' && <span className="priority-low">Low</span>}
                          </>
                        )
                      }
                    ];

                    const productProjects = projects.filter(proj => String(proj.product_id) === String(currentProduct.id));

                    return (
                      <AdvancedTable
                        tableId={`product_projects_${currentProduct.id}`}
                        data={productProjects}
                        columns={projectColumns}
                        onRowClick={(proj) => setSelectedProductProjectId(String(selectedProductProjectId) === String(proj.id) ? null : proj.id)}
                      />
                    );
                  })()}
                </div>


                <div style={{ marginTop: '8px' }}>
                  <strong>* 核心業務字典 (KPI):</strong>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {knowledge.filter(k => String(k.product_id) === String(currentProduct.id)).length === 0 ? (
                      <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>目前無綁定業務指標</span>
                    ) : (
                      knowledge.filter(k => String(k.product_id) === String(currentProduct.id)).map(k => (
                        <span key={k.id} className="relation-badge">
                          📖 {k.term}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Standard Task / Meeting / Requirement Descriptions */}
        {selectedSubItemId !== 'project-charter' && activeTab !== 'knowledge' && activeTab !== 'products' && !selectedSubItemId.endsWith('-table') && (
          <div style={styles.contentSection}>
            <h3 style={styles.sectionTitle}>
              {
                activeTab === 'tasks' ? '任務說明' : 
                activeTab === 'meetings' ? '5 欄會議 Markdown 網格' : 
                currentRequirement ? '需求詳細描述' : 
                selectedSubItemId === 'project-plan' ? 'WBS 里程碑目標描述' :
                '樽頸阻礙說明與排查指示'
              }
            </h3>
            {isEditing ? (
              <div style={{ background: '#0F1524', borderRadius: '8px', border: '1px solid var(--border-color)', minHeight: '300px', padding: '12px' }}>
                <BlockNoteView
                  editor={blockNoteEditor}
                  onChange={() => {
                    setEditDescOrContent(blockNoteEditor.document);
                  }}
                  theme="dark"
                />
              </div>
            ) : (
              <div style={{ ...styles.descriptionBlock, background: 'transparent', border: 'none', padding: 0 }}>
                <BlockNoteView editor={blockNoteEditor} editable={false} theme="dark" />
              </div>
            )}
          </div>
        )}

        {/* Related Assets for Meetings Detail View */}
        {!isEditing && activeTab === 'meetings' && currentMeeting && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', marginTop: '16px' }}>
            
            {/* 1. Related Tasks Table */}
            {/* 1. Related Tasks Table */}
            <div>
              <strong style={{ display: 'block', marginBottom: '10px', fontSize: '14px', color: 'var(--text-primary)' }}>
                📋 關聯任務工單 ({tasks.filter(t => String(t.related_meeting_id) === String(currentMeeting.id)).length})
              </strong>
              {(() => {
                const taskColumns = [
                  {
                    id: 'title',
                    header: '標題',
                    cell: (t: any) => <span style={{ fontWeight: 'bold' }}>📄 {t.title}</span>
                  },
                  {
                    id: 'priority',
                    header: '優先級',
                    cell: (t: any) => (
                      <>
                        {t.priority === 'High' && <span className="priority-high">High</span>}
                        {t.priority === 'Middle' && <span className="priority-middle">Middle</span>}
                        {t.priority === 'Low' && <span className="priority-low">Low</span>}
                        {!['High', 'Middle', 'Low'].includes(t.priority || '') && <span className="priority-middle">Middle</span>}
                      </>
                    )
                  },
                  {
                    id: 'status',
                    header: '狀態',
                    cell: (t: any) => (
                      <>
                        <span className={`status-lamp ${t.status.toLowerCase().replace('_', '')}`} style={{ marginRight: '6px' }} />
                        {t.status}
                      </>
                    )
                  },
                  {
                    id: 'due_date',
                    header: '截止日期',
                    cell: (t: any) => formatChineseDate(t.due_date)
                  },
                  {
                    id: 'follow_by',
                    header: '負責人',
                    cell: (t: any) => members.find(mem => String(mem.member_id) === String(t.item_follow_by))?.member_name || '未指派'
                  },
                  ...getRemainingProjectItemColumns(members, workspaces, projects, ['item_title', 'item_priority', 'item_status', 'item_planned_end_date', 'item_follow_by'])
                ];

                const meetingTaskData = tasks.filter(t => String(t.related_meeting_id) === String(currentMeeting.id));

                return (
                  <AdvancedTable
                    tableId={`meeting_detail_tasks_${currentMeeting.id}`}
                    data={meetingTaskData}
                    columns={taskColumns}
                    onRowClick={(t) => setSelectedModalTaskId(t.id)}
                  />
                );
              })()}
            </div>

            {/* 2. Related Bottlenecks Table */}
            {(() => {
              const meetingTasks = tasks.filter(t => String(t.related_meeting_id) === String(currentMeeting.id));
              const relatedBottleneckIds = meetingTasks.map(t => t.bottleneck_id).filter(Boolean);
              const meetingBottlenecks = bottlenecks.filter(b => relatedBottleneckIds.includes(b.id));

              const bottleneckColumns = [
                {
                  id: 'title',
                  header: '阻礙名稱',
                  cell: (b: any) => <span style={{ fontWeight: 'bold' }}>📄 {b.title}</span>
                },
                {
                  id: 'severity',
                  header: '嚴重程度',
                  cell: (b: any) => (
                    <>
                      {b.severity === 'High' && <span className="priority-high">High</span>}
                      {b.severity === 'Middle' && <span className="priority-middle">Middle</span>}
                      {b.severity === 'Low' && <span className="priority-low">Low</span>}
                    </>
                  )
                },
                {
                  id: 'status',
                  header: '狀態',
                  cell: (b: any) => (
                    <>
                      <span className={`status-lamp ${b.status === 'ACTIVE' ? 'blocked' : 'done'}`} style={{ marginRight: '6px' }} />
                      {b.status}
                    </>
                  )
                }
              ];

              return (
                <div>
                  <strong style={{ display: 'block', marginBottom: '10px', fontSize: '14px', color: 'var(--text-primary)' }}>
                    ⚠️ 關聯樽頸與風險 ({meetingBottlenecks.length})
                  </strong>
                  <AdvancedTable
                    tableId={`meeting_detail_bottlenecks_${currentMeeting.id}`}
                    data={meetingBottlenecks}
                    columns={bottleneckColumns}
                    onRowClick={(b) => setSelectedModalBottleneckId(b.id)}
                  />
                </div>
              );
            })()}

            {/* 3. Related Knowledge Notes Table */}
            {(() => {
              const meetingKnowledge = knowledge.filter(k => 
                k.project_id === currentMeeting.project_id || 
                (currentMeeting.content && currentMeeting.content.includes(k.term)) ||
                (currentMeeting.summary && currentMeeting.summary.includes(k.term))
              );

              const knowledgeColumns = [
                {
                  id: 'term',
                  header: '詞條名稱',
                  cell: (k: any) => <span style={{ fontWeight: 'bold' }}>📄 {k.term}</span>
                },
                {
                  id: 'definition',
                  header: '定義描述',
                  cell: (k: any) => (
                    <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={k.definition}>
                      {k.definition}
                    </span>
                  )
                },
                {
                  id: 'kpi_formula',
                  header: 'KPI 公式',
                  cell: (k: any) => (
                    <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={k.kpi_formula || ''}>
                      {k.kpi_formula || '—'}
                    </span>
                  )
                },
                {
                  id: 'tag',
                  header: '標籤',
                  cell: (k: any) => k.tag ? <span className="relation-badge">{k.tag}</span> : '—'
                },
                {
                  id: 'status',
                  header: '狀態',
                  cell: (k: any) => (
                    <>
                      {k.status === '完成' && <span className="status-badge-done">● 完成</span>}
                      {k.status === '封存' && <span className="status-badge-archive">● 封存</span>}
                      {k.status === '進行中' && <span className="status-badge-progress">● 進行中</span>}
                      {k.status === 'INBOX' && <span className="status-badge-inbox">● INBOX</span>}
                      {!['完成', '封存', '進行中', 'INBOX'].includes(k.status) && <span className="status-badge-todo">● {k.status}</span>}
                    </>
                  )
                }
              ];

              return (
                <div>
                  <strong style={{ display: 'block', marginBottom: '10px', fontSize: '14px', color: 'var(--text-primary)' }}>
                    🧠 關聯業務知識 ({meetingKnowledge.length})
                  </strong>
                  <AdvancedTable
                    tableId={`meeting_detail_knowledge_${currentMeeting.id}`}
                    data={meetingKnowledge}
                    columns={knowledgeColumns}
                    onRowClick={(k) => setSelectedModalKnowledgeId(k.id)}
                  />
                </div>
              );
            })()}

          </div>
        )}

        {/* Append-only Remarks Append Input Reason */}
        {isEditing && (
          <div style={styles.remarkInputWrapper}>
            <label style={styles.remarkLabel}>此次變更的備註說明（會被寫入 append-only remarks 歷史中）：</label>
            <input
              style={styles.remarkInputField}
              type="text"
              placeholder="e.g. 根據與 Edmond 的會議決議更新"
              value={remarkInput}
              onChange={(e) => setRemarkInput(e.target.value)}
            />
          </div>
        )}

        {/* Timeline / Remarks History Tracking */}
        <div style={styles.timelineSection}>
          <h3 style={styles.sectionTitle}>Remarks 歷史軌跡 (Append-only)</h3>
          {activeRemarks.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>尚無修改紀錄。</p>
          ) : (
            <div style={styles.timeline}>
              {activeRemarks.map((remark, idx) => (
                <div key={idx} style={styles.timelineItem}>
                  <div style={styles.timelineDot} />
                  <div style={styles.timelineContent}>
                    <div style={styles.timelineHeader}>
                      <span style={styles.timelineUser}>{remark.user}</span>
                      <span style={styles.timelineTime}>{formatDateString(remark.timestamp)}</span>
                    </div>
                    <p style={styles.timelineText}>{remark.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {renderAllOverlays()}
    </div>
  );
};

const styles = {
  container: {
    flex: 1,
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: '#0E1321',
    overflowY: 'auto' as const,
  },
  wrapper: {
    padding: '40px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },
  visualTitle: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '16px',
  },
  docWrapper: {
    padding: '40px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '32px',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
    fontSize: '15px',
    padding: '40px',
    textAlign: 'center' as const,
    backgroundColor: '#0E1321',
  },
  docHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: '24px',
  },
  metaRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '12px',
  },
  metaBadge: {
    fontSize: '10px',
    fontFamily: 'monospace',
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
  },
  docTitle: {
    fontSize: '28px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  jiraDropdownBtn: {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '4px',
    color: 'var(--text-primary)',
    padding: '4px 8px',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.2s',
  },
  jiraDropdownMenu: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    backgroundColor: '#1E2538',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    zIndex: 1100,
    width: '160px',
    display: 'flex',
    flexDirection: 'column' as const,
    marginTop: '4px',
  },
  jiraDropdownItem: {
    padding: '8px 12px',
    fontSize: '12px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'background 0.2s',
  },
  jiraToolbarBtn: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '4px',
    color: 'var(--text-secondary)',
    padding: '4px 8px',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  toolbarBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '4px',
    color: 'var(--text-primary)',
    padding: '4px 8px',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  slashMenu: {
    position: 'absolute' as const,
    bottom: '100%',
    left: '10px',
    backgroundColor: '#1E2538',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
    width: '240px',
    maxHeight: '300px',
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    marginBottom: '8px',
  },
  slashMenuHeader: {
    padding: '8px 12px',
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'var(--text-muted)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  slashMenuItem: {
    padding: '8px 12px',
    fontSize: '13px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'background 0.2s',
  },
  titleInput: {
    fontSize: '28px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--accent-primary)',
    borderRadius: '8px',
    padding: '4px 12px',
    width: '100%',
    outline: 'none',
    fontFamily: 'var(--font-heading)',
  },
  headerActions: {
    display: 'flex',
    gap: '10px',
  },
  editBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-primary)',
    transition: 'all 0.2s',
  },
  saveBtn: {
    backgroundColor: 'var(--color-done)',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#fff',
  },
  cancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
  },
  propertiesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
    backgroundColor: 'rgba(255,255,255,0.01)',
    border: '1px solid var(--border-color)',
    padding: '20px',
    borderRadius: '12px',
  },
  propertyItem: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '13px',
  },
  propertyLabel: {
    color: 'var(--text-secondary)',
    width: '150px',
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '13px',
    width: '200px',
    outline: 'none',
  },
  selectInput: {
    backgroundColor: '#161E32',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '13px',
    width: '100%',
    outline: 'none',
  },
  contentSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    borderLeft: '3px solid var(--accent-primary)',
    paddingLeft: '10px',
    marginBottom: '12px',
  },
  descriptionBlock: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: '1.7',
    whiteSpace: 'pre-line' as const,
  },
  rawMarkdown: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: '16px',
    borderRadius: '8px',
    color: '#34D399',
    fontSize: '12px',
    fontFamily: 'monospace',
    overflowX: 'auto' as const,
  },
  tableWrapper: {
    overflowX: 'auto' as const,
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
  },
  gridTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13px',
    textAlign: 'left' as const,
  },
  th: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-color)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    color: 'var(--text-primary)',
    fontWeight: 600,
  },
  td: {
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
    color: 'var(--text-secondary)',
  },
  tr: {},
  textareaInput: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    borderRadius: '8px',
    padding: '16px',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'var(--font-body)',
    lineHeight: '1.6',
    resize: 'vertical' as const,
  },
  remarkInputWrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    backgroundColor: 'rgba(99, 102, 241, 0.05)',
    border: '1px dashed var(--accent-primary)',
    padding: '16px',
    borderRadius: '8px',
  },
  remarkLabel: {
    fontSize: '12px',
    color: 'var(--text-primary)',
    fontWeight: 500,
  },
  remarkInputField: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    padding: '8px 12px',
    color: 'var(--text-primary)',
    fontSize: '13px',
    outline: 'none',
  },
  timelineSection: {
    borderTop: '1px solid var(--border-color)',
    paddingTop: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
    position: 'relative' as const,
    paddingLeft: '16px',
  },
  timelineItem: {
    display: 'flex',
    gap: '12px',
    position: 'relative' as const,
  },
  timelineDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-primary)',
    marginTop: '6px',
    flexShrink: 0,
    boxShadow: '0 0 8px var(--accent-primary-glow)',
  },
  timelineContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    backgroundColor: 'rgba(255,255,255,0.01)',
    border: '1px solid rgba(255,255,255,0.03)',
    padding: '10px 14px',
    borderRadius: '8px',
    flex: 1,
  },
  timelineHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineUser: {
    fontWeight: 600,
    fontSize: '12px',
    color: 'var(--accent-secondary)',
  },
  timelineTime: {
    fontSize: '10px',
    color: 'var(--text-muted)',
  },
  timelineText: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
  },
  charterBlock: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    border: '1px solid var(--border-color)',
    padding: '20px',
    borderRadius: '12px',
  },
  charterText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
  },
  w5h2Grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '14px',
    marginTop: '12px',
  },
  w5h2Card: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid var(--border-color)',
    padding: '14px',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  w5h2Label: {
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--accent-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  w5h2Val: {
    fontSize: '13px',
    color: 'var(--text-primary)',
    lineHeight: '1.4',
  },
  w5h2Input: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    padding: '6px 8px',
    color: 'var(--text-primary)',
    fontSize: '13px',
    outline: 'none',
  },
  drawerTabBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '11px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.2s',
  }
};

export const ThemedSelect = ({ value, defaultValue, onChange, children, style, autoFocus, onBlur, onClick, placeholder }: any) => {
  const options = React.useMemo(() => {
    const opts: any[] = [];
    const traverse = (child: any) => {
      if (!child) return;
      if (Array.isArray(child)) {
        child.forEach(traverse);
      } else if (child.type === 'option') {
        opts.push({ value: child.props.value, label: child.props.children });
      } else if (child.props && child.props.children) {
         traverse(child.props.children);
      }
    };
    React.Children.forEach(children, traverse);
    return opts;
  }, [children]);

  const valToMatch = value !== undefined ? value : defaultValue;
  const selectedOption = options.find(o => String(o.value) === String(valToMatch)) || (valToMatch ? { value: valToMatch, label: valToMatch } : null);

  const isItemTypeDropdown = options.some(o => o.value === 'Task' || o.value === 'Epic' || o.value === 'Deploy' || o.value === 'User Story' || o.value === 'Business Objective');
  const isStatusDropdown = options.some(o => o.value === 'Not Start' || o.value === 'In Progress' || o.value === 'Completed');
  const isPriorityDropdown = options.some(o => o.value === 'High' && options.some(p => p.value === 'Low'));
  
  const formatLabel = (option: any) => {
    if (isItemTypeDropdown) {
      const styleObj = getItemTypeStyles(option.value) || { bg: '#334155', icon: '🔹', text: '#CBD5E1' };
      return (
        <span style={{ 
          backgroundColor: `${styleObj.bg}20`,
          color: styleObj.text,
          padding: '2px 6px', borderRadius: '4px', fontSize: '11px',
          display: 'inline-flex', alignItems: 'center', gap: '4px'
        }}>
          <span>{styleObj.icon}</span> {option.label}
        </span>
      );
    } else if (isStatusDropdown) {
      const styleObj = getItemStatusStyles(option.value) || { bg: '#9CA3AF', text: '#E5E7EB' };
      return (
        <span style={{ 
          backgroundColor: `${styleObj.bg}20`,
          color: styleObj.text,
          padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold',
          display: 'inline-flex', alignItems: 'center', gap: '4px'
        }}>
          {option.label}
        </span>
      );
    } else if (isPriorityDropdown) {
      let bg = '#334155', text = '#CBD5E1';
      if (option.value === 'High' || option.value === 'Must') { bg = '#EF4444'; text = '#FECACA'; }
      else if (option.value === 'Middle' || option.value === 'Should') { bg = '#F59E0B'; text = '#FDE68A'; }
      else if (option.value === 'Low' || option.value === 'Could' || option.value === "Won't") { bg = '#6B7280'; text = '#D1D5DB'; }
      
      return (
        <span style={{ 
          backgroundColor: `${bg}20`,
          color: text,
          padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold',
          display: 'inline-flex', alignItems: 'center', gap: '4px'
        }}>
          {option.label}
        </span>
      );
    }
    return option.label;
  };

  return (
    <div style={{ ...style, width: style?.width || '100%', minWidth: style?.minWidth || '120px' }} onClick={onClick}>
      <Select
        value={selectedOption}
        onChange={(s: any) => {
          if (onChange) {
            onChange({ target: { value: s ? s.value : '' } });
          }
        }}
        options={options}
        styles={{
          ...reactSelectStyles,
          control: (base: any, state: any) => ({
            ...reactSelectStyles.control(base, state),
            minHeight: style?.height || '32px',
            backgroundColor: style?.backgroundColor || style?.background || reactSelectStyles.control(base, state).backgroundColor,
            border: style?.border || reactSelectStyles.control(base, state).border,
            boxShadow: 'none',
          }),
          singleValue: (base: any) => ({
            ...base,
            color: style?.color || base.color,
            fontSize: style?.fontSize || base.fontSize
          }),
          placeholder: (base: any) => ({
            ...base,
            color: style?.color || base.color,
            fontSize: style?.fontSize || base.fontSize
          }),
          menuPortal: (base: any) => ({ ...base, zIndex: 9999 })
        }}
        formatOptionLabel={formatLabel}
        autoFocus={autoFocus}
        onBlur={onBlur}
        placeholder={placeholder || 'Select...'}
        menuPortalTarget={document.body}
        menuPosition="fixed"
        menuPlacement="auto"
      />
    </div>
  );
};

export default CanvasPane;
