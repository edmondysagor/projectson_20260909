import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Check, 
  X, 
  ChevronRight,
  Trash2
} from 'lucide-react';
import { api } from '../utils/api';
import type { ProjectItem, Project, Member } from '../utils/api';
import { MultiSelect } from './MultiSelect';
import { MemberSelect } from './MemberSelect';
import { ViewSwitcher } from './ViewSwitcher';
import type { ViewMode } from './ViewSwitcher';
import { ItemKanbanView } from './ItemKanbanView';
import { ItemTimelineView } from './ItemTimelineView';
import { ItemCalendarView } from './ItemCalendarView';
import { useColumnResize, Resizer } from '../hooks/useColumnResize';

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
    code: 130,
    type: 120,
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
        await onRefresh();
      } catch (err: any) {
        alert('刪除失敗: ' + err.message);
      }
    }
  };

  const filteredItems = items
    .filter((item) => {
      const matchSearch = item.item_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.item_display_code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = filterTypes.includes('ALL') || filterTypes.includes(item.item_type);
      const matchStatus = filterStatuses.includes('ALL') || filterStatuses.includes(item.item_status);
      return matchSearch && matchType && matchStatus;
    })
    .sort((a, b) => {
      if (a.item_number !== b.item_number) {
        return (a.item_number ?? 0) - (b.item_number ?? 0);
      }
      return new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime();
    });

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
        padding: '16px 24px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.3px' }}>
            {title}
          </h1>

          {!hideTopAddButton && (
            <button
              onClick={() => setShowQuickAdd(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)'
              }}
            >
              <Plus size={16} /> 新增項目
            </button>
          )}
        </div>

        {/* 搜尋與多選 Filter 列（長度縮短至中間）+ 右側 View 切換按鈕群 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* 左側：Search + Multi-select Filters */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: '0 1 520px', minWidth: '300px' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
              <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
              <input
                type="text"
                placeholder="搜尋編號、標題..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px 8px 34px',
                  backgroundColor: '#131b2e',
                  border: '1px solid #23304a',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <MultiSelect
                values={filterTypes}
                allLabel="全部類型 (All Types)"
                options={['Task', 'Charter', 'Epic', 'Meeting', 'Bottleneck', 'Decision', 'Objective', 'Requirement', 'User story', 'UAT', 'Deployment', 'Milestone'].map(t => ({
                  value: t,
                  label: t
                }))}
                onChange={(vals) => setFilterTypes(vals)}
              />

              <MultiSelect
                values={filterStatuses}
                allLabel="全部狀態 (All Statuses)"
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
            </div>
          </div>

          {/* 右側：View 切換功能鍵 (List, Kanban, Timeline, Calendar) */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <ViewSwitcher
              currentView={currentView}
              onViewChange={(view) => setCurrentView(view)}
            />
          </div>
        </div>
      </div>

      {/* 視圖內容渲染 */}
      {currentView === 'kanban' ? (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ItemKanbanView
            items={filteredItems}
            members={members}
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
          margin: '16px 24px',
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
            minWidth: '950px',
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
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                    沒有找到符合條件的工單項目
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr 
                    key={item.item_uid}
                    style={{
                      borderBottom: '1px solid #1e293b',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
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
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: 
                          item.item_type === 'Task' ? '#1e293b' :
                          item.item_type === 'Epic' ? '#3b0764' :
                          item.item_type === 'Requirement' ? '#1e3a8a' :
                          item.item_type === 'Objective' ? '#064e3b' :
                          item.item_type === 'Bottleneck' ? '#450a0a' :
                          item.item_type === 'Decision' ? '#78350f' : '#1e293b',
                        color:
                          item.item_type === 'Task' ? '#cbd5e1' :
                          item.item_type === 'Epic' ? '#d8b4fe' :
                          item.item_type === 'Requirement' ? '#93c5fd' :
                          item.item_type === 'Objective' ? '#6ee7b7' :
                          item.item_type === 'Bottleneck' ? '#fca5a5' :
                          item.item_type === 'Decision' ? '#fde68a' : '#cbd5e1',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                      }}>
                        {item.item_type}
                      </span>
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
                    <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.8rem' }}>
                      {item.project_name || '無所屬專案'}
                    </td>

                    {/* Action */}
                    <td style={{ padding: '12px 16px' }}>
                      <button
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
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
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
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  style={{
                    padding: '7px 12px',
                    backgroundColor: '#131b2e',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#cbd5e1',
                    fontSize: '0.85rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {['Task', 'Charter', 'Epic', 'Meeting', 'Bottleneck', 'Decision', 'Objective', 'Requirement', 'User story', 'UAT', 'Deployment', 'Milestone'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                {/* Select Project if multiple */}
                {projects.length > 1 && (
                  <select
                    value={newProjectId}
                    onChange={(e) => setNewProjectId(e.target.value)}
                    style={{
                      padding: '7px 12px',
                      backgroundColor: '#131b2e',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#cbd5e1',
                      fontSize: '0.85rem',
                      outline: 'none',
                      cursor: 'pointer',
                      maxWidth: '180px'
                    }}
                  >
                    {projects.map(p => (
                      <option key={p.project_uid} value={p.project_uid}>{p.project_name}</option>
                    ))}
                  </select>
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
