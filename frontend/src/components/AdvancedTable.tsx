import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Check, 
  X, 
  ChevronRight,
  Trash2,
  Copy,
  CheckSquare,
  Square,
  MinusSquare,
  Layers
} from 'lucide-react';
import { api } from '../utils/api';
import type { ProjectItem, Project, Member } from '../utils/api';
import { MultiSelect } from './MultiSelect';
import { MemberSelect } from './MemberSelect';
import { CustomSelect } from './CustomSelect';
import type { CustomSelectOption } from './CustomSelect';
import { ViewSwitcher } from './ViewSwitcher';
import type { ViewMode } from './ViewSwitcher';
import { ItemKanbanView } from './ItemKanbanView';
import { ItemTimelineView } from './ItemTimelineView';
import { ItemCalendarView } from './ItemCalendarView';
import { useColumnResize, Resizer } from '../hooks/useColumnResize';

const ITEM_TYPE_OPTIONS: CustomSelectOption[] = [
  { value: 'Task', label: 'Task', icon: <span>📝</span>, badgeBg: '#1e293b', badgeColor: '#cbd5e1' },
  { value: 'Requirement', label: 'Requirement', icon: <span>📋</span>, badgeBg: '#1e3a8a', badgeColor: '#93c5fd' },
  { value: 'User story', label: 'User story', icon: <span>👤</span>, badgeBg: '#4c1d95', badgeColor: '#c4b5fd' },
  { value: 'Objective', label: 'Objective', icon: <span>🎯</span>, badgeBg: '#064e3b', badgeColor: '#6ee7b7' },
  { value: 'Information', label: 'Information', icon: <span>ℹ️</span>, badgeBg: '#075985', badgeColor: '#38bdf8' },
  { value: 'Charter', label: 'Charter', icon: <span>📜</span>, badgeBg: '#312e81', badgeColor: '#a5b4fc' },
  { value: 'Epic', label: 'Epic', icon: <span>⚡</span>, badgeBg: '#3b0764', badgeColor: '#d8b4fe' },
  { value: 'Meeting', label: 'Meeting', icon: <span>📅</span>, badgeBg: '#134e4a', badgeColor: '#5eead4' },
  { value: 'Bottleneck', label: 'Bottleneck', icon: <span>⚠️</span>, badgeBg: '#450a0a', badgeColor: '#fca5a5' },
  { value: 'Decision', label: 'Decision', icon: <span>💡</span>, badgeBg: '#78350f', badgeColor: '#fde68a' },
  { value: 'UAT', label: 'UAT', icon: <span>🧪</span>, badgeBg: '#155e75', badgeColor: '#67e8f9' },
  { value: 'Deployment', label: 'Deployment', icon: <span>🚀</span>, badgeBg: '#7c2d12', badgeColor: '#fdba74' },
  { value: 'Milestone', label: 'Milestone', icon: <span>🚩</span>, badgeBg: '#064e3b', badgeColor: '#34d399' },
];

interface AdvancedTableProps {
  title: string;
  items: ProjectItem[];
  projects: Project[];
  members: Member[];
  onRefresh: () => Promise<void>;
  onItemClick: (item: ProjectItem) => void;
  currentWorkspaceUid?: string;
  hideTopAddButton?: boolean;
}

export const AdvancedTable: React.FC<AdvancedTableProps> = ({
  title,
  items,
  projects,
  members,
  onRefresh,
  onItemClick,
  hideTopAddButton = false,
}) => {
  const { columnWidths, onResizeStart } = useColumnResize({
    select: 44,
    code: 120,
    type: 110,
    title: 260,
    status: 130,
    priority: 100,
    follow_by: 140,
    planned_end: 130,
    project: 150,
    action: 60
  });

  const [currentView, setCurrentView] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTypes, setFilterTypes] = useState<string[]>(['ALL']);
  const [filterStatuses, setFilterStatuses] = useState<string[]>(['ALL']);
  const [filterFollowBys, setFilterFollowBys] = useState<string[]>(['ALL']);
  const [filterProjects, setFilterProjects] = useState<string[]>(['ALL']);

  // 多選 / 全選 / 批次操作狀態 (Selection & Batch Processing)
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('Task');
  const [newProjectId, setNewProjectId] = useState(projects[0]?.project_uid || '');
  const [addLoading, setAddLoading] = useState(false);

  const [editingCell, setEditingCell] = useState<{ uid: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const handleStartEdit = (uid: string, field: string, initialVal: string) => {
    setEditingCell({ uid, field });
    setEditValue(initialVal || '');
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleSaveEdit = async (uid: string, field: string) => {
    try {
      await api.patchItem(uid, { [field]: editValue });
      setEditingCell(null);
      await onRefresh();
    } catch (err: any) {
      alert('更新失敗: ' + err.message);
    }
  };

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const targetProject = newProjectId || projects[0]?.project_uid;
    if (!targetProject) {
      alert('請先建立或選擇至少一個 Project');
      return;
    }

    setAddLoading(true);
    try {
      await api.createItem({
        item_title: newTitle.trim(),
        item_type: newType,
        related_project_uid: targetProject,
        item_status: 'Not Start',
        item_priority: 'Middle',
      });
      setNewTitle('');
      setShowQuickAdd(false);
      await onRefresh();
    } catch (err: any) {
      alert('新增失敗: ' + err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteItem = async (e: React.MouseEvent, item: ProjectItem) => {
    e.stopPropagation();
    if (confirm(`確定要刪除工單 [${item.item_display_code}] ${item.item_title} 嗎？此操作不可逆。`)) {
      try {
        await api.deleteItem(item.item_uid);
        setSelectedUids(prev => prev.filter(id => id !== item.item_uid));
        await onRefresh();
      } catch (err: any) {
        alert('刪除失敗: ' + err.message);
      }
    }
  };

  const handleToggleSelectAll = () => {
    if (filteredItems.length === 0) return;
    const allFilteredUids = filteredItems.map(i => i.item_uid);
    const isAllSelected = allFilteredUids.every(uid => selectedUids.includes(uid));
    if (isAllSelected) {
      setSelectedUids(prev => prev.filter(uid => !allFilteredUids.includes(uid)));
    } else {
      setSelectedUids(prev => Array.from(new Set([...prev, ...allFilteredUids])));
    }
  };

  const handleToggleSelectItem = (uid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedUids(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const handleBatchDuplicate = async () => {
    if (selectedUids.length === 0) return;
    const selectedItems = items.filter(i => selectedUids.includes(i.item_uid));
    if (selectedItems.length === 0) return;

    if (!confirm(`確定要複製選取的 ${selectedItems.length} 張工單嗎？`)) return;

    setIsBatchProcessing(true);
    try {
      const payloadItems = selectedItems.map(item => ({
        item_title: `${item.item_title} (副本)`,
        item_type: item.item_type,
        item_priority: item.item_priority,
        item_status: 'Not Start',
        item_follow_by: item.item_follow_by || undefined,
        related_project_uid: item.related_project_uid,
        parent_item_uid: item.parent_item_uid || undefined,
        item_content: item.item_content || undefined,
        item_attribute: item.item_attribute || undefined,
        audit_remark: `📋 複製自 [${item.item_display_code}] ${item.item_title}`
      }));

      for (const item of payloadItems) {
        if (!item.related_project_uid) continue;
        await api.createItem({
          item_title: item.item_title,
          related_project_uid: item.related_project_uid,
          item_type: item.item_type,
          item_status: item.item_status,
          item_priority: item.item_priority,
          item_follow_by: item.item_follow_by,
          parent_item_uid: item.parent_item_uid,
          item_content: item.item_content,
          item_attribute: item.item_attribute
        });
      }

      setSelectedUids([]);
      await onRefresh();
    } catch (err: any) {
      alert('批次複製失敗: ' + err.message);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedUids.length === 0) return;
    if (!confirm(`⚠️ 確定要批次刪除選取的 ${selectedUids.length} 張工單嗎？此操作不可逆。`)) return;

    setIsBatchProcessing(true);
    try {
      await api.batchDeleteItems(selectedUids);
      setSelectedUids([]);
      await onRefresh();
    } catch (err: any) {
      alert('批次刪除失敗: ' + err.message);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleDuplicateSingleItem = async (e: React.MouseEvent, item: ProjectItem) => {
    e.stopPropagation();
    try {
      await api.createItem({
        item_title: `${item.item_title} (副本)`,
        item_type: item.item_type,
        item_priority: item.item_priority,
        item_status: 'Not Start',
        item_follow_by: item.item_follow_by || undefined,
        related_project_uid: item.related_project_uid,
        parent_item_uid: item.parent_item_uid || undefined,
        item_content: item.item_content || undefined,
        item_attribute: item.item_attribute || undefined
      });
      await onRefresh();
    } catch (err: any) {
      alert('複製工單失敗: ' + err.message);
    }
  };

  const filteredItems = items
    .filter((item) => {
      const matchSearch = item.item_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.item_display_code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = filterTypes.includes('ALL') || filterTypes.includes(item.item_type);
      const matchStatus = filterStatuses.includes('ALL') || filterStatuses.includes(item.item_status);
      
      const matchFollowBy = filterFollowBys.includes('ALL') || 
        (filterFollowBys.includes('UNASSIGNED') && (!item.item_follow_by || item.item_follow_by === '')) ||
        (item.item_follow_by && filterFollowBys.includes(item.item_follow_by));

      const matchProject = filterProjects.includes('ALL') ||
        (item.related_project_uid && filterProjects.includes(item.related_project_uid));

      return matchSearch && matchType && matchStatus && matchFollowBy && matchProject;
    })
    .sort((a, b) => {
      if (a.item_number !== b.item_number) {
        return (a.item_number ?? 0) - (b.item_number ?? 0);
      }
      return new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime();
    });

  const isAllSelected = filteredItems.length > 0 && filteredItems.every(i => selectedUids.includes(i.item_uid));
  const isSomeSelected = selectedUids.length > 0 && !isAllSelected;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#090d16',
      color: '#f8fafc',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: hideTopAddButton ? '8px 16px' : '10px 20px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        gap: hideTopAddButton ? '0px' : '10px',
        flexShrink: 0,
        position: 'relative',
        zIndex: 25,
        overflow: 'visible'
      }}>
        {!hideTopAddButton && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.3px' }}>
              {title}
            </h1>

            <button
              onClick={() => setShowQuickAdd(true)}
              style={{
                padding: '6px 14px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.4)'
              }}
            >
              <Plus size={15} /> 新增項目
            </button>
          </div>
        )}

        {/* 單行工具列：搜尋 + 篩選 + View 切換器 全部同處一行 (Single Line Toolbar) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'nowrap', overflow: 'visible' }}>
          {/* 左側：Search + Multi-select Filters (類型、狀態、負責人 Follow By、專案 Project) */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flex: 1, minWidth: 0, overflow: 'visible' }}>
            <div style={{ position: 'relative', width: '160px', minWidth: '110px', flexShrink: 0 }}>
              <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: '8px', top: '7.5px' }} />
              <input
                type="text"
                placeholder="搜尋編號、標題..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '4px 8px 4px 26px',
                  backgroundColor: '#131b2e',
                  border: '1px solid #23304a',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '0.75rem',
                  height: '28px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <MultiSelect
              values={filterTypes}
              allLabel="全部類型"
              buttonStyle={{ height: '28px', minHeight: '28px', padding: '3px 7px', fontSize: '0.74rem', gap: '4px' }}
              options={ITEM_TYPE_OPTIONS.map(t => ({
                value: t.value,
                label: t.label,
                icon: t.icon,
                badgeBg: t.badgeBg,
                badgeColor: t.badgeColor
              }))}
              onChange={(vals) => setFilterTypes(vals)}
            />

            <MultiSelect
              values={filterStatuses}
              allLabel="全部狀態"
              buttonStyle={{ height: '28px', minHeight: '28px', padding: '3px 7px', fontSize: '0.74rem', gap: '4px' }}
              options={[
                { value: 'Not Start', label: 'Not Start', badgeBg: '#1e293b', badgeColor: '#94a3b8' },
                { value: 'Ready', label: 'Ready', badgeBg: '#1e3a8a', badgeColor: '#93c5fd' },
                { value: 'In Progress', label: 'In Progress', badgeBg: '#1e3a8a', badgeColor: '#60a5fa' },
                { value: 'Blocked', label: 'Blocked', badgeBg: '#450a0a', badgeColor: '#fca5a5' },
                { value: 'Review', label: 'Review', badgeBg: '#3b0764', badgeColor: '#d8b4fe' },
                { value: 'Completed', label: 'Completed', badgeBg: '#064e3b', badgeColor: '#6ee7b7' },
                { value: 'Closed', label: 'Closed', badgeBg: '#1e293b', badgeColor: '#64748b' },
                { value: 'Backlog', label: 'Backlog', badgeBg: '#334155', badgeColor: '#cbd5e1' }
              ]}
              onChange={(vals) => setFilterStatuses(vals)}
            />

            <MultiSelect
              values={filterFollowBys}
              allLabel="全部負責人"
              buttonStyle={{ height: '28px', minHeight: '28px', padding: '3px 7px', fontSize: '0.74rem', gap: '4px' }}
              options={[
                { value: 'UNASSIGNED', label: '未指派' },
                ...members.map(m => ({
                  value: m.member_uid,
                  label: m.member_name
                }))
              ]}
              onChange={(vals) => setFilterFollowBys(vals)}
            />

            {projects && projects.length > 1 && (
              <MultiSelect
                values={filterProjects}
                allLabel="全部專案"
                buttonStyle={{ height: '28px', minHeight: '28px', padding: '3px 7px', fontSize: '0.74rem', gap: '4px' }}
                options={projects.map(p => ({
                  value: p.project_uid,
                  label: p.project_name ? `${p.project_display_code ? `[${p.project_display_code}] ` : ''}${p.project_name}` : p.project_display_code || '未命名專案'
                }))}
                onChange={(vals) => setFilterProjects(vals)}
              />
            )}
          </div>

          {/* 右側：View 切換功能鍵 (List, Kanban, Timeline, Calendar) */}
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <ViewSwitcher
              currentView={currentView}
              onViewChange={(view) => setCurrentView(view)}
              compact={true}
            />
          </div>
        </div>
      </div>

      {/* 批次操作浮動列 (Batch Action Bar) */}
      {selectedUids.length > 0 && currentView === 'list' && (
        <div style={{
          margin: '0 24px 8px 24px',
          padding: '10px 18px',
          backgroundColor: '#111c35',
          border: '1px solid #2563eb',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 16px rgba(37, 99, 235, 0.25)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={18} color="#60a5fa" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
              已選取 <span style={{ color: '#38bdf8' }}>{selectedUids.length}</span> 項工單
            </span>
            <button
              type="button"
              onClick={() => setSelectedUids([])}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#93c5fd',
                fontSize: '0.75rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0
              }}
            >
              取消選取
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              disabled={isBatchProcessing}
              onClick={handleBatchDuplicate}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#1e3a8a',
                color: '#93c5fd',
                border: '1px solid #3b82f6',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: isBatchProcessing ? 'not-allowed' : 'pointer'
              }}
            >
              <Copy size={14} />
              <span>{isBatchProcessing ? '處理中...' : '複製工單 (Duplicate)'}</span>
            </button>

            <button
              type="button"
              disabled={isBatchProcessing}
              onClick={handleBatchDelete}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#450a0a',
                color: '#fca5a5',
                border: '1px solid #991b1b',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: isBatchProcessing ? 'not-allowed' : 'pointer'
              }}
            >
              <Trash2 size={14} />
              <span>{isBatchProcessing ? '處理中...' : '批次刪除 (Delete)'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 視圖內容渲染 */}
      {currentView === 'kanban' ? (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ItemKanbanView
            items={filteredItems}
            members={members}
            projects={projects}
            onRefresh={onRefresh}
            onItemClick={onItemClick}
          />
        </div>
      ) : currentView === 'timeline' ? (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ItemTimelineView
            items={filteredItems}
            members={members}
            onRefresh={onRefresh}
            onItemClick={onItemClick}
          />
        </div>
      ) : currentView === 'calendar' ? (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ItemCalendarView
            items={filteredItems}
            members={members}
            onRefresh={onRefresh}
            onItemClick={onItemClick}
          />
        </div>
      ) : (
        /* List (Table) View */
        <div style={{
          flex: 1,
          margin: '8px 24px 16px 24px',
          backgroundColor: '#0f172a',
          borderRadius: '12px',
          border: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}>
          <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{
            width: '100%',
            minWidth: '1000px',
            borderCollapse: 'separate',
            borderSpacing: 0,
            textAlign: 'left',
            fontSize: '0.85rem'
          }}>
            <thead>
              <tr style={{
                color: '#94a3b8',
                textTransform: 'uppercase',
                fontSize: '0.75rem',
                letterSpacing: '0.5px'
              }}>
                <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 12, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 14px', width: '44px', minWidth: '44px', textAlign: 'center', borderRight: '1px solid #1e293b' }}>
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: isAllSelected ? '#38bdf8' : (isSomeSelected ? '#93c5fd' : '#64748b') }}
                    title={isAllSelected ? '取消全選' : '全選所有工單'}
                  >
                    {isAllSelected ? <CheckSquare size={16} /> : (isSomeSelected ? <MinusSquare size={16} /> : <Square size={16} />)}
                  </button>
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: `${columnWidths.code}px`, minWidth: `${columnWidths.code}px` }}>
                  <span>Display Code</span>
                  <Resizer onMouseDown={(e) => onResizeStart('code', columnWidths.code, e)} />
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: `${columnWidths.type}px`, minWidth: `${columnWidths.type}px` }}>
                  <span>Type</span>
                  <Resizer onMouseDown={(e) => onResizeStart('type', columnWidths.type, e)} />
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: `${columnWidths.title}px`, minWidth: `${columnWidths.title}px` }}>
                  <span>Title (點擊就地編輯)</span>
                  <Resizer onMouseDown={(e) => onResizeStart('title', columnWidths.title, e)} />
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: `${columnWidths.status}px`, minWidth: `${columnWidths.status}px` }}>
                  <span>Status (下拉即改)</span>
                  <Resizer onMouseDown={(e) => onResizeStart('status', columnWidths.status, e)} />
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: `${columnWidths.priority}px`, minWidth: `${columnWidths.priority}px` }}>
                  <span>Priority</span>
                  <Resizer onMouseDown={(e) => onResizeStart('priority', columnWidths.priority, e)} />
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: `${columnWidths.follow_by}px`, minWidth: `${columnWidths.follow_by}px` }}>
                  <span>Follow By</span>
                  <Resizer onMouseDown={(e) => onResizeStart('follow_by', columnWidths.follow_by, e)} />
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: `${columnWidths.planned_end}px`, minWidth: `${columnWidths.planned_end}px` }}>
                  <span>Planned End</span>
                  <Resizer onMouseDown={(e) => onResizeStart('planned_end', columnWidths.planned_end, e)} />
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: `${columnWidths.project}px`, minWidth: `${columnWidths.project}px` }}>
                  <span>Project</span>
                  <Resizer onMouseDown={(e) => onResizeStart('project', columnWidths.project, e)} />
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: `${columnWidths.action}px`, minWidth: `${columnWidths.action}px` }}>
                  <span>操作</span>
                  <Resizer onMouseDown={(e) => onResizeStart('action', columnWidths.action, e)} />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    沒有找到符合條件的工單項目
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selectedUids.includes(item.item_uid);
                  return (
                  <tr 
                    key={item.item_uid}
                    style={{
                      borderBottom: '1px solid #1e293b',
                      backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isSelected ? 'rgba(56, 189, 248, 0.08)' : 'transparent';
                    }}
                  >
                    {/* Checkbox (多選/單選) */}
                    <td style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 5,
                      backgroundColor: isSelected ? '#112240' : '#0f172a',
                      padding: '12px 14px',
                      textAlign: 'center',
                      borderRight: '1px solid #1e293b'
                    }}>
                      <button
                        type="button"
                        onClick={(e) => handleToggleSelectItem(item.item_uid, e)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isSelected ? '#38bdf8' : '#475569'
                        }}
                        title={isSelected ? '取消勾選' : '勾選工單'}
                      >
                        {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                    </td>
                    {/* Display Code */}
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => onItemClick(item)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#38bdf8',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: 0
                        }}
                      >
                        {item.item_display_code}
                        <ChevronRight size={12} />
                      </button>
                    </td>

                    {/* Type */}
                    <td style={{ padding: '12px 16px' }}>
                      {(() => {
                        const opt = ITEM_TYPE_OPTIONS.find(o => o.value === item.item_type) || {
                          badgeBg: '#1e293b',
                          badgeColor: '#cbd5e1',
                          icon: <span>📝</span>
                        };
                        return (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: opt.badgeBg,
                            color: opt.badgeColor || '#cbd5e1',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                          }}>
                            {opt.icon}
                            <span>{item.item_type}</span>
                          </span>
                        );
                      })()}
                    </td>

                    {/* Title (Inline editable) */}
                    <td style={{ padding: '12px 16px' }}>
                      {editingCell?.uid === item.item_uid && editingCell?.field === 'item_title' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="text"
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(item.item_uid, 'item_title');
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            style={{
                              flex: 1,
                              backgroundColor: '#0c1222',
                              border: '1px solid #38bdf8',
                              borderRadius: '4px',
                              color: '#fff',
                              padding: '4px 8px',
                              fontSize: '0.85rem',
                              outline: 'none'
                            }}
                          />
                          <button onClick={() => handleSaveEdit(item.item_uid, 'item_title')} style={{ background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer' }}>
                            <Check size={16} />
                          </button>
                          <button onClick={handleCancelEdit} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div 
                          onClick={() => handleStartEdit(item.item_uid, 'item_title', item.item_title)}
                          style={{
                            cursor: 'pointer',
                            color: '#f8fafc',
                            fontWeight: 500,
                            padding: '4px 6px',
                            borderRadius: '4px',
                            transition: 'background-color 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          title="點擊就地修改標題"
                        >
                          {item.item_title}
                        </div>
                      )}
                    </td>

                    {/* Status (Direct update) */}
                    <td style={{ padding: '12px 16px' }}>
                      <select
                        value={item.item_status || 'Not Start'}
                        onChange={async (e) => {
                          try {
                            await api.patchItem(item.item_uid, { item_status: e.target.value });
                            await onRefresh();
                          } catch (err: any) {
                            alert('更新狀態失敗: ' + err.message);
                          }
                        }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid #334155',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          backgroundColor: 
                            item.item_status === 'Ready' ? '#1e3a8a' :
                            item.item_status === 'In Progress' ? '#1e3a8a' :
                            item.item_status === 'Review' ? '#3b0764' :
                            item.item_status === 'Completed' ? '#064e3b' :
                            item.item_status === 'Blocked' ? '#450a0a' : '#1e293b',
                          color:
                            item.item_status === 'Ready' ? '#93c5fd' :
                            item.item_status === 'In Progress' ? '#60a5fa' :
                            item.item_status === 'Review' ? '#d8b4fe' :
                            item.item_status === 'Completed' ? '#6ee7b7' :
                            item.item_status === 'Blocked' ? '#fca5a5' : '#cbd5e1',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        {['Not Start', 'Ready', 'In Progress', 'Blocked', 'Review', 'Completed', 'Closed', 'Backlog'].map(s => (
                          <option key={s} value={s} style={{ backgroundColor: '#0f172a', color: '#cbd5e1' }}>{s}</option>
                        ))}
                      </select>
                    </td>

                    {/* Priority */}
                    <td style={{ padding: '12px 16px' }}>
                      <select
                        value={item.item_priority || 'Middle'}
                        onChange={async (e) => {
                          try {
                            await api.patchItem(item.item_uid, { item_priority: e.target.value as any });
                            await onRefresh();
                          } catch (err: any) {
                            alert('更新優先度失敗: ' + err.message);
                          }
                        }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid #334155',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          backgroundColor: 
                            item.item_priority === 'High' ? '#7f1d1d' :
                            item.item_priority === 'Middle' ? '#1e293b' : '#064e3b',
                          color:
                            item.item_priority === 'High' ? '#fca5a5' :
                            item.item_priority === 'Middle' ? '#cbd5e1' : '#6ee7b7',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="High" style={{ backgroundColor: '#0f172a', color: '#cbd5e1' }}>High</option>
                        <option value="Middle" style={{ backgroundColor: '#0f172a', color: '#cbd5e1' }}>Middle</option>
                        <option value="Low" style={{ backgroundColor: '#0f172a', color: '#cbd5e1' }}>Low</option>
                      </select>
                    </td>

                    {/* Follow By (MemberSelect Search & Create) */}
                    <td style={{ padding: '12px 16px' }}>
                      <MemberSelect
                        value={item.item_follow_by || undefined}
                        members={members}
                        size="sm"
                        placeholder="-- 未指派 --"
                        onChange={async (newUid) => {
                          const selected = members.find(m => m.member_uid === newUid);
                          try {
                            await api.patchItem(item.item_uid, { 
                              item_follow_by: newUid || '',
                              follow_by_name: selected ? selected.member_name : ''
                            });
                            await onRefresh();
                          } catch (err: any) {
                            alert('更新負責人失敗: ' + err.message);
                          }
                        }}
                      />
                    </td>

                    {/* Planned End Date */}
                    <td style={{ padding: '12px 16px' }}>
                      <input
                        type="date"
                        value={item.item_planned_end_date ? item.item_planned_end_date.split('T')[0] : ''}
                        onChange={async (e) => {
                          try {
                            await api.patchItem(item.item_uid, { 
                              item_planned_end_date: e.target.value ? new Date(e.target.value).toISOString() : '' 
                            });
                            await onRefresh();
                          } catch (err: any) {
                            alert('更新結束日失敗: ' + err.message);
                          }
                        }}
                        style={{
                          backgroundColor: '#131b2e',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          color: '#cbd5e1',
                          padding: '4px 6px',
                          fontSize: '0.78rem',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      />
                    </td>

                    {/* Project Name */}
                    <td style={{ padding: '12px 16px', fontSize: '0.8rem' }}>
                      {(() => {
                        const itemPrj = projects.find(p => p.project_uid === item.related_project_uid);
                        const prjColor = itemPrj?.project_attribute?.color;
                        const prjName = item.project_name || itemPrj?.project_name;
                        if (!prjName) return <span style={{ color: '#64748b' }}>無所屬專案</span>;
                        return (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            color: prjColor || '#94a3b8',
                            backgroundColor: prjColor ? `${prjColor}15` : 'transparent',
                            border: prjColor ? `1px solid ${prjColor}35` : 'none',
                            padding: prjColor ? '2px 8px' : '0',
                            borderRadius: '4px',
                            fontWeight: 500
                          }}>
                            {prjColor && (
                              <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: prjColor,
                                flexShrink: 0
                              }} />
                            )}
                            {prjName}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Action */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={(e) => handleDuplicateSingleItem(e, item)}
                          style={{
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: '#64748b',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#38bdf8'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                          title="複製此工單 (Duplicate)"
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteItem(e, item)}
                          style={{
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: '#64748b',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                          title="刪除工單"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>

          {/* 表格底部快捷新增列 */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid #1e293b',
            backgroundColor: '#090d16'
          }}>
            {showQuickAdd ? (
              <form onSubmit={handleQuickCreate} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Select Type */}
                <CustomSelect
                  value={newType}
                  options={ITEM_TYPE_OPTIONS}
                  onChange={(val) => setNewType(val)}
                  style={{ minWidth: '150px' }}
                />

                {/* Select Project if multiple */}
                {projects.length > 1 && (
                  <CustomSelect
                    value={newProjectId || projects[0]?.project_uid}
                    options={projects.map(p => {
                      const pColor = p.project_attribute?.color;
                      return {
                        value: p.project_uid,
                        label: p.project_name,
                        icon: pColor ? <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: pColor, display: 'inline-block' }} /> : <span>📁</span>
                      };
                    })}
                    onChange={(val) => setNewProjectId(val)}
                    style={{ minWidth: '160px', maxWidth: '240px' }}
                  />
                )}

                {/* Input Bar: item title */}
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="輸入工單名稱 (Item Title)..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: '220px',
                    padding: '7px 12px',
                    backgroundColor: '#090d16',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />

                <button
                  type="submit"
                  disabled={addLoading}
                  style={{
                    padding: '7px 14px',
                    backgroundColor: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <Check size={15} /> {addLoading ? '儲存中...' : '儲存'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowQuickAdd(false);
                    setNewTitle('');
                  }}
                  style={{
                    padding: '7px 12px',
                    backgroundColor: '#334155',
                    color: '#cbd5e1',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <X size={15} /> 取消
                </button>
              </form>
            ) : (
              <button
                onClick={() => setShowQuickAdd(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  transition: 'color 0.15s, background-color 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#38bdf8';
                  e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#64748b';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Plus size={16} /> + 新增頁面 (Item)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
