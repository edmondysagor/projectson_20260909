import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Check, 
  X, 
  ChevronRight
} from 'lucide-react';
import { api } from '../utils/api';
import type { ProjectItem, Project, Member } from '../utils/api';

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
            onClick={() => setShowQuickAdd(!showQuickAdd)}
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

        {showQuickAdd && (
          <form onSubmit={handleQuickCreate} style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            backgroundColor: '#131b2e',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid #2563eb'
          }}>
            <input
              type="text"
              required
              autoFocus
              placeholder="輸入項目名稱 (Item Title)..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: '#090d16',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.9rem'
              }}
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              style={{
                padding: '8px 10px',
                backgroundColor: '#090d16',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.85rem'
              }}
            >
              {['Task', 'Charter', 'Epic', 'Event', 'Meeting', 'Bottleneck', 'Information', 'Bug', 'UAT', 'Deployment', 'Milestone', 'Objective', 'Requirement', 'User story', 'Decision'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={newProjectId}
              onChange={(e) => setNewProjectId(e.target.value)}
              style={{
                padding: '8px 10px',
                backgroundColor: '#090d16',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.85rem'
              }}
            >
              {projects.map(p => (
                <option key={p.project_uid} value={p.project_uid}>{p.project_name}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={addLoading}
              style={{
                padding: '8px 14px',
                backgroundColor: '#16a34a',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {addLoading ? '儲存中...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setShowQuickAdd(false)}
              style={{
                padding: '8px 12px',
                backgroundColor: '#334155',
                color: '#cbd5e1',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              取消
            </button>
          </form>
        )}

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
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                padding: '8px 12px',
                backgroundColor: '#131b2e',
                border: '1px solid #23304a',
                borderRadius: '8px',
                color: '#94a3b8',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">全部類型 (All Types)</option>
              {['Task', 'Charter', 'Epic', 'Meeting', 'Bottleneck', 'Decision', 'Objective', 'Requirement', 'User story', 'UAT', 'Deployment', 'Milestone'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: '8px 12px',
                backgroundColor: '#131b2e',
                border: '1px solid #23304a',
                borderRadius: '8px',
                color: '#94a3b8',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">全部狀態 (All Statuses)</option>
              {['Not Start', 'Ready', 'In Progress', 'Blocked', 'Review', 'Completed', 'Closed', 'Backlog'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div style={{
        flex: 1,
        margin: '16px 24px',
        backgroundColor: '#0f172a',
        borderRadius: '12px',
        border: '1px solid #1e293b',
        overflow: 'auto',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}>
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
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
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
                    <select
                      value={item.item_status}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        await api.patchItem(item.item_uid, { item_status: newStatus });
                        await onRefresh();
                      }}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid #334155',
                        backgroundColor: item.item_status === 'Completed' ? '#064e3b' :
                          item.item_status === 'Blocked' ? '#7f1d1d' :
                          item.item_status === 'In Progress' ? '#1e3a8a' : '#1e293b',
                        color: item.item_status === 'Completed' ? '#6ee7b7' :
                          item.item_status === 'Blocked' ? '#fca5a5' :
                          item.item_status === 'In Progress' ? '#93c5fd' : '#cbd5e1',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {['Not Start', 'Ready', 'In Progress', 'Blocked', 'Review', 'Completed', 'Closed', 'Backlog'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <select
                      value={item.item_priority}
                      onChange={async (e) => {
                        await api.patchItem(item.item_uid, { item_priority: e.target.value as any });
                        await onRefresh();
                      }}
                      style={{
                        padding: '4px 6px',
                        borderRadius: '4px',
                        border: '1px solid #334155',
                        backgroundColor: '#131b2e',
                        color: item.item_priority === 'High' ? '#f87171' : item.item_priority === 'Middle' ? '#fbbf24' : '#94a3b8',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="High">High</option>
                      <option value="Middle">Middle</option>
                      <option value="Low">Low</option>
                    </select>
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <select
                      value={item.item_follow_by || ''}
                      onChange={async (e) => {
                        const val = e.target.value;
                        await api.patchItem(item.item_uid, { item_follow_by: val ? val : undefined });
                        await onRefresh();
                      }}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid #334155',
                        backgroundColor: '#131b2e',
                        color: '#cbd5e1',
                        fontSize: '0.8rem',
                        maxWidth: '120px',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="">-- 未指派 --</option>
                      {members.map(m => (
                        <option key={m.member_uid} value={m.member_uid}>{m.member_name}</option>
                      ))}
                    </select>
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
