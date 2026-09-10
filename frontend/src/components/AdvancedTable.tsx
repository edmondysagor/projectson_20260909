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
import { CustomSelect } from './CustomSelect';
import { MemberSelect } from './MemberSelect';

interface AdvancedTableProps {
  title: string;
  items: ProjectItem[];
  projects: Project[];
  members: Member[];
  onRefresh: () => Promise<void>;
  onItemClick: (item: ProjectItem) => void;
  currentWorkspaceUid?: string;
}

export const AdvancedTable: React.FC<AdvancedTableProps> = ({
  title,
  items,
  projects,
  members,
  onRefresh,
  onItemClick,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

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

  const filteredItems = items.filter((item) => {
    const matchSearch = item.item_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_display_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchType = filterType === 'ALL' || item.item_type === filterType;
    const matchStatus = filterStatus === 'ALL' || item.item_status === filterStatus;
    return matchSearch && matchType && matchStatus;
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
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
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

          <div style={{ display: 'flex', gap: '8px' }}>
            <CustomSelect
              value={filterType}
              options={[
                { value: 'ALL', label: '全部類型 (All Types)' },
                ...['Task', 'Charter', 'Epic', 'Meeting', 'Bottleneck', 'Decision', 'Objective', 'Requirement', 'User story', 'UAT', 'Deployment', 'Milestone'].map(t => ({
                  value: t,
                  label: t
                }))
              ]}
              onChange={(val) => setFilterType(val)}
            />

            <CustomSelect
              value={filterStatus}
              options={[
                { value: 'ALL', label: '全部狀態 (All Statuses)' },
                ...['Not Start', 'Ready', 'In Progress', 'Blocked', 'Review', 'Completed', 'Closed', 'Backlog'].map(s => ({
                  value: s,
                  label: s
                }))
              ]}
              onChange={(val) => setFilterStatus(val)}
            />
          </div>
        </div>
      </div>

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
          borderCollapse: 'collapse',
          textAlign: 'left',
          fontSize: '0.85rem'
        }}>
          <thead>
            <tr style={{
              backgroundColor: '#131b2e',
              borderBottom: '2px solid #1e293b',
              color: '#94a3b8',
              textTransform: 'uppercase',
              fontSize: '0.75rem',
              letterSpacing: '0.5px'
            }}>
              <th style={{ padding: '12px 16px', width: '130px' }}>Display Code</th>
              <th style={{ padding: '12px 16px', width: '120px' }}>Type</th>
              <th style={{ padding: '12px 16px', minWidth: '260px' }}>Title (點擊就地編輯)</th>
              <th style={{ padding: '12px 16px', width: '130px' }}>Status (下拉即改)</th>
              <th style={{ padding: '12px 16px', width: '100px' }}>Priority</th>
              <th style={{ padding: '12px 16px', width: '140px' }}>Follow By</th>
              <th style={{ padding: '12px 16px', width: '130px' }}>Planned End</th>
              <th style={{ padding: '12px 16px', width: '150px' }}>Project</th>
              <th style={{ padding: '12px 16px', width: '60px', textAlign: 'center' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                  目前沒有符合條件的項目
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr
                  key={item.item_uid}
                  style={{
                    borderBottom: '1px solid #1e293b',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#131b2e')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => onItemClick(item)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#38bdf8',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        textDecoration: 'underline'
                      }}
                    >
                      {item.item_display_code}
                      <ChevronRight size={14} />
                    </button>
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: item.item_type === 'Decision' ? '#78350f' :
                        item.item_type === 'Bottleneck' ? '#7f1d1d' :
                        item.item_type === 'Objective' ? '#14532d' : '#1e293b',
                      color: item.item_type === 'Decision' ? '#fde68a' :
                        item.item_type === 'Bottleneck' ? '#fca5a5' :
                        item.item_type === 'Objective' ? '#86efac' : '#cbd5e1'
                    }}>
                      {item.item_type}
                    </span>
                  </td>

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
                            padding: '6px 8px',
                            borderRadius: '4px',
                            border: '1px solid #3b82f6',
                            backgroundColor: '#090d16',
                            color: '#fff',
                            fontSize: '0.85rem'
                          }}
                        />
                        <button
                          onClick={() => handleSaveEdit(item.item_uid, 'item_title')}
                          style={{ background: '#16a34a', border: 'none', color: '#fff', padding: '4px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          style={{ background: '#475569', border: 'none', color: '#fff', padding: '4px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <span
                        onClick={() => handleStartEdit(item.item_uid, 'item_title', item.item_title)}
                        style={{ cursor: 'pointer', borderBottom: '1px dashed #334155' }}
                        title="點擊就地修改"
                      >
                        {item.item_title}
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <CustomSelect
                      size="sm"
                      value={item.item_status}
                      options={[
                        { value: 'Not Start', label: 'Not Start', badgeBg: '#1e293b', badgeColor: '#94a3b8' },
                        { value: 'Ready', label: 'Ready', badgeBg: '#1e293b', badgeColor: '#93c5fd' },
                        { value: 'In Progress', label: 'In Progress', badgeBg: '#1e3a8a', badgeColor: '#93c5fd' },
                        { value: 'Blocked', label: 'Blocked', badgeBg: '#7f1d1d', badgeColor: '#fca5a5' },
                        { value: 'Review', label: 'Review', badgeBg: '#3b0764', badgeColor: '#d8b4fe' },
                        { value: 'Completed', label: 'Completed', badgeBg: '#064e3b', badgeColor: '#6ee7b7' },
                        { value: 'Closed', label: 'Closed', badgeBg: '#334155', badgeColor: '#cbd5e1' },
                        { value: 'Backlog', label: 'Backlog', badgeBg: '#1e293b', badgeColor: '#cbd5e1' }
                      ]}
                      onChange={async (newStatus) => {
                        await api.patchItem(item.item_uid, { item_status: newStatus });
                        await onRefresh();
                      }}
                    />
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <CustomSelect
                      size="sm"
                      value={item.item_priority}
                      options={[
                        { value: 'High', label: 'High', color: '#ef4444' },
                        { value: 'Middle', label: 'Middle', color: '#f59e0b' },
                        { value: 'Low', label: 'Low', color: '#94a3b8' }
                      ]}
                      onChange={async (newPri) => {
                        await api.patchItem(item.item_uid, { item_priority: newPri as any });
                        await onRefresh();
                      }}
                    />
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <MemberSelect
                      size="sm"
                      value={item.item_follow_by || ''}
                      members={members}
                      onChange={async (uid) => {
                        await api.patchItem(item.item_uid, { item_follow_by: uid ? uid : undefined });
                        await onRefresh();
                      }}
                      placeholder="-- 未指派 --"
                    />
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <input
                      type="date"
                      value={item.item_planned_end_date ? item.item_planned_end_date.split('T')[0] : ''}
                      onChange={async (e) => {
                        await api.patchItem(item.item_uid, { item_planned_end_date: e.target.value ? e.target.value : undefined });
                        await onRefresh();
                      }}
                      style={{
                        padding: '4px 6px',
                        borderRadius: '4px',
                        border: '1px solid #334155',
                        backgroundColor: '#131b2e',
                        color: '#cbd5e1',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    />
                  </td>

                  <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                    {projects.find(p => p.project_uid === item.related_project_uid)?.project_name || 'N/A'}
                  </td>

                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button
                      onClick={(e) => handleDeleteItem(e, item)}
                      title="刪除工單"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'color 0.15s, background-color 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#f87171';
                        e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#64748b';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>

        {/* 框底新增功能 Input Bar */}
        <div style={{
          borderTop: '1px solid #1e293b',
          backgroundColor: '#0c1222',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0
        }}>
          {showQuickAdd ? (
            <form onSubmit={handleQuickCreate} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              flexWrap: 'wrap'
            }}>
              {/* Dropdown 1: item_type */}
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                style={{
                  padding: '7px 12px',
                  backgroundColor: '#131b2e',
                  border: '1px solid #3b82f6',
                  borderRadius: '6px',
                  color: '#93c5fd',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {['Task', 'Charter', 'Epic', 'Event', 'Meeting', 'Bottleneck', 'Information', 'Bug', 'UAT', 'Deployment', 'Milestone', 'Objective', 'Requirement', 'User story', 'Decision'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              {/* 若有多於一個 Project，提供選擇所屬 Project (若只有一個則自動歸入) */}
              {projects.length > 1 && (
                <select
                  value={newProjectId || projects[0]?.project_uid || ''}
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
    </div>
  );
};
