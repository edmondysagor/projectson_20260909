import React, { useState } from 'react';
import { 
  FolderKanban, 
  Package, 
  Layers, 
  Users, 
  MoreVertical, 
  Plus, 
  Edit3, 
  Trash2, 
  ChevronDown, 
  Check 
} from 'lucide-react';
import { api } from '../utils/api';
import type { Workspace } from '../utils/api';

interface SidebarProps {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  onSelectWorkspace: (ws: Workspace) => void;
  onRefreshWorkspaces: () => Promise<void>;
  activeNav: 'product' | 'project' | 'all_items' | 'members';
  onNavChange: (nav: 'product' | 'project' | 'all_items' | 'members') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  workspaces,
  currentWorkspace,
  onSelectWorkspace,
  onRefreshWorkspaces,
  activeNav,
  onNavChange,
}) => {
  const [showWsDropdown, setShowWsDropdown] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'rename' | 'delete' | null>(null);

  const [formName, setFormName] = useState('');
  const [formPrefix, setFormPrefix] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const openCreateModal = () => {
    setShowMenu(false);
    setFormName('');
    setFormPrefix('');
    setModalError(null);
    setModalMode('create');
  };

  const openRenameModal = () => {
    setShowMenu(false);
    if (!currentWorkspace) return;
    setFormName(currentWorkspace.workspace_name);
    setModalError(null);
    setModalMode('rename');
  };

  const openDeleteModal = () => {
    setShowMenu(false);
    setModalError(null);
    setModalMode('delete');
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalLoading(true);

    try {
      if (modalMode === 'create') {
        const newWs = await api.createWorkspace({
          workspace_name: formName.trim(),
          prefix_code: formPrefix.trim().toUpperCase(),
        });
        await onRefreshWorkspaces();
        onSelectWorkspace(newWs);
        setModalMode(null);
      } else if (modalMode === 'rename' && currentWorkspace) {
        const updated = await api.updateWorkspace(currentWorkspace.workspace_uid, {
          workspace_name: formName.trim(),
        });
        await onRefreshWorkspaces();
        onSelectWorkspace(updated);
        setModalMode(null);
      } else if (modalMode === 'delete' && currentWorkspace) {
        await api.deleteWorkspace(currentWorkspace.workspace_uid);
        await onRefreshWorkspaces();
        setModalMode(null);
      }
    } catch (err: any) {
      setModalError(err.message || '操作失敗');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <aside style={{
      width: '260px',
      height: '100vh',
      backgroundColor: '#0f172a',
      color: '#e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid #1e293b',
      userSelect: 'none',
      flexShrink: 0
    }}>
      <div style={{
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        borderBottom: '1px solid #1e293b'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          backgroundColor: '#3b82f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: 700,
          fontSize: '1.1rem'
        }}>
          P
        </div>
        <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.5px' }}>
          Projectson
        </span>
      </div>

      <div style={{ padding: '16px 16px 8px 16px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Workspace
          </span>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Workspace 選項"
            >
              <MoreVertical size={16} />
            </button>

            {showMenu && (
              <div style={{
                position: 'absolute',
                top: '24px',
                right: 0,
                width: '180px',
                backgroundColor: '#1e293b',
                borderRadius: '8px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                border: '1px solid #334155',
                padding: '4px',
                zIndex: 50
              }}>
                <button
                  onClick={openCreateModal}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={14} color="#38bdf8" /> Add new workspace
                </button>
                <button
                  onClick={openRenameModal}
                  disabled={!currentWorkspace}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: currentWorkspace ? '#f8fafc' : '#64748b',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                    borderRadius: '4px',
                    cursor: currentWorkspace ? 'pointer' : 'not-allowed'
                  }}
                >
                  <Edit3 size={14} color="#fbbf24" /> Rename workspace
                </button>
                <button
                  onClick={openDeleteModal}
                  disabled={!currentWorkspace}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: currentWorkspace ? '#f87171' : '#64748b',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                    borderRadius: '4px',
                    cursor: currentWorkspace ? 'pointer' : 'not-allowed'
                  }}
                >
                  <Trash2 size={14} color="#f87171" /> Delete workspace
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowWsDropdown(!showWsDropdown)}
            style={{
              width: '100%',
              padding: '10px 12px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                backgroundColor: '#0284c7',
                color: '#fff',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {currentWorkspace?.prefix_code?.[0] || 'W'}
              </div>
              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {currentWorkspace ? currentWorkspace.workspace_name : '選擇 Workspace...'}
              </span>
            </div>
            <ChevronDown size={16} color="#94a3b8" />
          </button>

          {showWsDropdown && (
            <div style={{
              position: 'absolute',
              top: '46px',
              left: 0,
              width: '100%',
              backgroundColor: '#1e293b',
              borderRadius: '8px',
              border: '1px solid #334155',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              maxHeight: '220px',
              overflowY: 'auto',
              zIndex: 40,
              padding: '4px'
            }}>
              {workspaces.map((ws) => (
                <button
                  key={ws.workspace_uid}
                  onClick={() => {
                    onSelectWorkspace(ws);
                    setShowWsDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: currentWorkspace?.workspace_uid === ws.workspace_uid ? '#334155' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.8rem', minWidth: '36px' }}>
                      [{ws.prefix_code}]
                    </span>
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {ws.workspace_name}
                    </span>
                  </div>
                  {currentWorkspace?.workspace_uid === ws.workspace_uid && <Check size={14} color="#38bdf8" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <button
          onClick={() => onNavChange('product')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeNav === 'product' ? '#1d4ed8' : 'transparent',
            color: activeNav === 'product' ? '#ffffff' : '#94a3b8',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <Package size={18} />
          <span>Product (產品總覽)</span>
        </button>

        <button
          onClick={() => onNavChange('project')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeNav === 'project' ? '#1d4ed8' : 'transparent',
            color: activeNav === 'project' ? '#ffffff' : '#94a3b8',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <FolderKanban size={18} />
          <span>Project (專案矩陣)</span>
        </button>

        <button
          onClick={() => onNavChange('all_items')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeNav === 'all_items' ? '#1d4ed8' : 'transparent',
            color: activeNav === 'all_items' ? '#ffffff' : '#94a3b8',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <Layers size={18} />
          <span>All Items (工單總表)</span>
        </button>

        <button
          onClick={() => onNavChange('members')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeNav === 'members' ? '#1d4ed8' : 'transparent',
            color: activeNav === 'members' ? '#ffffff' : '#94a3b8',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <Users size={18} />
          <span>Workspace Member</span>
        </button>
      </nav>

      <div style={{ padding: '16px', borderTop: '1px solid #1e293b', fontSize: '0.75rem', color: '#64748b' }}>
        <div>Neon DB: Connected</div>
        <div>Prefix: {currentWorkspace?.prefix_code || 'N/A'}</div>
      </div>

      {modalMode && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div style={{
            width: '400px',
            backgroundColor: '#1e293b',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid #334155',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#f8fafc', fontSize: '1.2rem' }}>
              {modalMode === 'create' && '新增工作區 (Add Workspace)'}
              {modalMode === 'rename' && '重新命名工作區 (Rename)'}
              {modalMode === 'delete' && '確認刪除工作區 (Delete)'}
            </h3>

            {modalError && (
              <div style={{ padding: '10px', backgroundColor: '#7f1d1d', color: '#fecaca', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '14px' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleModalSubmit}>
              {modalMode === 'delete' ? (
                <p style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  確定要刪除「<strong>{currentWorkspace?.workspace_name}</strong>」嗎？此操作將同時刪除該工作區下所有專案與項目。
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                      工作區名稱 (Name)
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="例如: Airport Analytics & Insights"
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '6px',
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  {modalMode === 'create' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                        代號前綴 Prefix (例如: AAP, PRJ, 2-5個英文字母)
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={5}
                        value={formPrefix}
                        onChange={(e) => setFormPrefix(e.target.value.toUpperCase())}
                        placeholder="例如: AAP"
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '6px',
                          backgroundColor: '#0f172a',
                          border: '1px solid #334155',
                          color: '#f8fafc',
                          boxSizing: 'border-box',
                          textTransform: 'uppercase'
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    backgroundColor: '#334155',
                    color: '#f8fafc',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    backgroundColor: modalMode === 'delete' ? '#dc2626' : '#2563eb',
                    color: '#f8fafc',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {modalLoading ? '處理中...' : modalMode === 'delete' ? '確認刪除' : '儲存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
};
