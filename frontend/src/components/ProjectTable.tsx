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
import { CustomSelect } from './CustomSelect';
import { MemberSelect } from './MemberSelect';

interface ProjectTableProps {
  projects: Project[];
  members: Member[];
  onRefresh: () => Promise<void>;
  onSelectProject: (project: Project) => void;
  currentWorkspaceUid: string;
  defaultType?: 'Product' | 'Project';
}

export const ProjectTable: React.FC<ProjectTableProps> = ({
  projects,
  members,
  onRefresh,
  onSelectProject,
  currentWorkspaceUid,
  defaultType = 'Project'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectType, setNewProjectType] = useState<'Product' | 'Project'>(defaultType);
  const [newSubType, setNewSubType] = useState<'Phase' | 'BAU'>('Phase');
  const [addLoading, setAddLoading] = useState(false);

  // 當 defaultType 改變時同步預設
  React.useEffect(() => {
    setNewProjectType(defaultType);
  }, [defaultType]);

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
      alert('更新名稱失敗: ' + err.message);
    }
  };

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setAddLoading(true);
    try {
      await api.createProject({
        project_name: newProjectName.trim(),
        project_type: newProjectType,
        project_sub_type: newProjectType === 'Project' ? newSubType : undefined,
        project_status: 'Active',
        related_workspace_uid: currentWorkspaceUid
      });
      setNewProjectName('');
      setShowQuickAdd(false);
      await onRefresh();
    } catch (err: any) {
      alert('建立失敗: ' + err.message);
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

  const isProductMode = defaultType === 'Product';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#090d16',
      color: '#f8fafc',
      overflow: 'hidden'
    }}>
      {/* 頂部標題與篩選器 */}
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
            {isProductMode ? '📦 產品總表 (Product Context Table View)' : '📊 專案總表 (Project Context Table View)'}
          </h1>

          <button
            onClick={() => setShowQuickAdd(true)}
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
            <Plus size={16} /> {isProductMode ? '新建產品' : '新建專案'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder={isProductMode ? '搜尋產品代號、名稱...' : '搜尋專案代號、名稱...'}
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

          <CustomSelect
            value={filterStatus}
            options={[
              { value: 'ALL', label: '全部狀態 (All Statuses)' },
              { value: 'Active', label: 'Active', badgeBg: '#1e3a8a', badgeColor: '#93c5fd' },
              { value: 'Pipeline', label: 'Pipeline', badgeBg: '#1e293b', badgeColor: '#cbd5e1' },
              { value: 'On Hold', label: 'On Hold', badgeBg: '#78350f', badgeColor: '#fde68a' },
              { value: 'Completed', label: 'Completed', badgeBg: '#064e3b', badgeColor: '#6ee7b7' },
              { value: 'Abandoned', label: 'Abandoned', badgeBg: '#334155', badgeColor: '#94a3b8' }
            ]}
            onChange={(val) => setFilterStatus(val)}
          />
        </div>
      </div>

      {/* 總表表格容器 */}
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
              <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: '150px' }}>專案代號 (Display Code)</th>
              <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', minWidth: '260px' }}>專案名稱 (Name)</th>
              <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: '120px' }}>類型</th>
              <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: '120px' }}>性質 (Sub Type)</th>
              <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: '130px' }}>狀態 (Status)</th>
              <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: '140px' }}>負責人 (Owner)</th>
              <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: '130px' }}>預計開始</th>
              <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: '130px' }}>預計截止</th>
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
                    <CustomSelect
                      size="sm"
                      value={p.project_status}
                      options={[
                        { value: 'Pipeline', label: 'Pipeline', badgeBg: '#1e293b', badgeColor: '#cbd5e1' },
                        { value: 'Active', label: 'Active', badgeBg: '#1e3a8a', badgeColor: '#93c5fd' },
                        { value: 'On Hold', label: 'On Hold', badgeBg: '#78350f', badgeColor: '#fde68a' },
                        { value: 'Completed', label: 'Completed', badgeBg: '#064e3b', badgeColor: '#6ee7b7' },
                        { value: 'Abandoned', label: 'Abandoned', badgeBg: '#334155', badgeColor: '#94a3b8' }
                      ]}
                      onChange={async (newStatus) => {
                        await api.patchProject(p.project_uid, { project_status: newStatus as any });
                        await onRefresh();
                      }}
                    />
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <MemberSelect
                      size="sm"
                      value={p.project_owner || ''}
                      members={members}
                      onChange={async (uid) => {
                        await api.patchProject(p.project_uid, { project_owner: uid ? uid : undefined });
                        await onRefresh();
                      }}
                      placeholder="-- 未指派 --"
                    />
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
              {/* Dropdown 1: project_type (如果 Product 則預設 Product, 如果 Project 則預設 Project) */}
              <select
                value={newProjectType}
                onChange={(e) => setNewProjectType(e.target.value as 'Product' | 'Project')}
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
                <option value="Product">Product (產品)</option>
                <option value="Project">Project (專案)</option>
              </select>

              {/* Dropdown 2: project_sub_type (如果是 Project 才顯示) */}
              {newProjectType === 'Project' && (
                <select
                  value={newSubType}
                  onChange={(e) => setNewSubType(e.target.value as 'Phase' | 'BAU')}
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
                  <option value="Phase">Phase (階段專案)</option>
                  <option value="BAU">BAU (日常運維)</option>
                </select>
              )}

              {/* Input Bar: project_name */}
              <input
                type="text"
                required
                autoFocus
                placeholder={newProjectType === 'Product' ? '輸入產品名稱 (Product Name)...' : '輸入專案名稱 (Project Name)...'}
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
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
                <Check size={15} /> {addLoading ? '建立中...' : '儲存'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowQuickAdd(false);
                  setNewProjectName('');
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
              <Plus size={16} /> + 新增頁面 ({isProductMode ? 'Product' : 'Project'})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
