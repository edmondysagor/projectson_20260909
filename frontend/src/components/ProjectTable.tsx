import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  ChevronRight, 
  Check, 
  X 
} from 'lucide-react';
import { api } from '../utils/api';
import type { Project, Member } from '../utils/api';

interface ProjectTableProps {
  projects: Project[];
  members: Member[];
  onRefresh: () => Promise<void>;
  onSelectProject: (project: Project) => void;
  currentWorkspaceUid: string;
}

export const ProjectTable: React.FC<ProjectTableProps> = ({
  projects,
  members,
  onRefresh,
  onSelectProject,
  currentWorkspaceUid
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newSubType, setNewSubType] = useState<'Phase' | 'BAU'>('Phase');
  const [addLoading, setAddLoading] = useState(false);

  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleStartEdit = (uid: string, currentName: string) => {
    setEditingUid(uid);
    setEditName(currentName);
  };

  const handleSaveName = async (uid: string) => {
    if (!editName.trim()) return;
    try {
      await api.patchProject(uid, { project_name: editName.trim() });
      setEditingUid(null);
      await onRefresh();
    } catch (err: any) {
      alert('更新專案名稱失敗: ' + err.message);
    }
  };

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setAddLoading(true);
    try {
      await api.createProject({
        project_name: newProjectName.trim(),
        project_type: 'Project',
        project_sub_type: newSubType,
        project_status: 'Active',
        related_workspace_uid: currentWorkspaceUid
      });
      setNewProjectName('');
      setShowQuickAdd(false);
      await onRefresh();
    } catch (err: any) {
      alert('建立專案失敗: ' + err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const filteredProjects = projects.filter((p) => {
    const matchSearch = p.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.project_display_code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = filterStatus === 'ALL' || p.project_status === filterStatus;
    return matchSearch && matchStatus;
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
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📊 專案總表 (Project Context Table View)
          </h1>

          <button
            onClick={() => setShowQuickAdd(!showQuickAdd)}
            style={{
              padding: '8px 18px',
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
            <Plus size={16} /> 新建專案
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
              placeholder="輸入專案名稱 (Project Name)..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
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
              value={newSubType}
              onChange={(e) => setNewSubType(e.target.value as 'Phase' | 'BAU')}
              style={{
                padding: '8px 10px',
                backgroundColor: '#090d16',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.85rem'
              }}
            >
              <option value="Phase">Phase (階段專案)</option>
              <option value="BAU">BAU (日常運維)</option>
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
              {addLoading ? '建立中...' : 'Save'}
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

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="搜尋專案代號、名稱..."
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
            {['Pipeline', 'Active', 'On Hold', 'Completed', 'Abandoned'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
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
              <th style={{ padding: '12px 16px', width: '150px' }}>專案代號 (Display Code)</th>
              <th style={{ padding: '12px 16px', minWidth: '260px' }}>專案名稱 (Name)</th>
              <th style={{ padding: '12px 16px', width: '120px' }}>類型</th>
              <th style={{ padding: '12px 16px', width: '120px' }}>性質 (Sub Type)</th>
              <th style={{ padding: '12px 16px', width: '130px' }}>狀態 (Status)</th>
              <th style={{ padding: '12px 16px', width: '140px' }}>負責人 (Owner)</th>
              <th style={{ padding: '12px 16px', width: '130px' }}>預計開始</th>
              <th style={{ padding: '12px 16px', width: '130px' }}>預計截止</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                  目前沒有符合條件的專案，請點擊上方「新建專案」
                </td>
              </tr>
            ) : (
              filteredProjects.map((p) => (
                <tr
                  key={p.project_uid}
                  style={{
                    borderBottom: '1px solid #1e293b',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#131b2e')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => onSelectProject(p)}
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
                        textDecoration: 'underline',
                        fontSize: '0.9rem'
                      }}
                      title="點擊進入該專案詳情與工單視圖"
                    >
                      📁 {p.project_display_code}
                      <ChevronRight size={14} />
                    </button>
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    {editingUid === p.project_uid ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="text"
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveName(p.project_uid);
                            if (e.key === 'Escape') setEditingUid(null);
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
                          onClick={() => handleSaveName(p.project_uid)}
                          style={{ background: '#16a34a', border: 'none', color: '#fff', padding: '4px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingUid(null)}
                          style={{ background: '#475569', border: 'none', color: '#fff', padding: '4px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <span
                        onClick={() => handleStartEdit(p.project_uid, p.project_name)}
                        style={{ cursor: 'pointer', fontWeight: 600, borderBottom: '1px dashed #334155' }}
                        title="點擊就地修改專案名稱"
                      >
                        {p.project_name}
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#064e3b', color: '#6ee7b7', fontSize: '0.75rem', fontWeight: 600 }}>
                      {p.project_type}
                    </span>
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#1e293b', color: '#cbd5e1', fontSize: '0.75rem' }}>
                      {p.project_sub_type || '-'}
                    </span>
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <select
                      value={p.project_status}
                      onChange={async (e) => {
                        await api.patchProject(p.project_uid, { project_status: e.target.value as any });
                        await onRefresh();
                      }}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid #334155',
                        backgroundColor: p.project_status === 'Completed' ? '#064e3b' :
                          p.project_status === 'Active' ? '#1e3a8a' : '#1e293b',
                        color: p.project_status === 'Completed' ? '#6ee7b7' :
                          p.project_status === 'Active' ? '#93c5fd' : '#cbd5e1',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {['Pipeline', 'Active', 'On Hold', 'Completed', 'Abandoned'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <select
                      value={p.project_owner || ''}
                      onChange={async (e) => {
                        const val = e.target.value;
                        await api.patchProject(p.project_uid, { project_owner: val ? val : undefined });
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

                  <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                    {p.planned_start_date ? p.planned_start_date.split('T')[0] : '-'}
                  </td>

                  <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                    {p.planned_end_date ? p.planned_end_date.split('T')[0] : '-'}
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
