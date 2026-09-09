import React, { useState, useEffect, useRef } from 'react';
import { api, type Workspace, type Product, type Project } from '../utils/api';

type TabType = 'kanban' | 'tasks' | 'projects' | 'products' | 'meetings' | 'bottlenecks' | 'knowledge' | 'documents' | 'user' | 'workspaces' | 'settings';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  selectedSubItemId: string | null;
  setSelectedSubItemId: (id: string | null) => void;
  workspaces: Workspace[];
  products: Product[];
  projects: Project[];
  filterProject: string;
  setFilterProject: (id: string) => void;
  filterWorkspace: string;
  setFilterWorkspace: (id: string) => void;
  onRefreshData?: () => Promise<void>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  selectedSubItemId,
  setSelectedSubItemId,
  workspaces,
  products,
  projects,
  filterProject,
  setFilterProject,
  filterWorkspace,
  setFilterWorkspace,
  onRefreshData,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [workspaceSearchTerm, setWorkspaceSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  
  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspacePrefix, setNewWorkspacePrefix] = useState('');
  const [createWorkspaceError, setCreateWorkspaceError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutsideActionMenu = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setIsActionMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideActionMenu);
    return () => document.removeEventListener('mousedown', handleClickOutsideActionMenu);
  }, []);

  const handleCreateWorkspaceSubmit = async () => {
    setCreateWorkspaceError('');
    if (!newWorkspaceName.trim() || !newWorkspacePrefix.trim()) {
      setCreateWorkspaceError('Name and Prefix Code are required.');
      return;
    }
    if (newWorkspacePrefix.trim().length < 3 || newWorkspacePrefix.trim().length > 4) {
      setCreateWorkspaceError('Prefix Code must be 3-4 characters long.');
      return;
    }
    setIsCreating(true);
    try {
      const newWs = await api.createWorkspace({
        prefix_code: newWorkspacePrefix.trim().toUpperCase(),
        workspace_name: newWorkspaceName.trim(),
        last_item_number: 0
      });
      if (onRefreshData) await onRefreshData();
      setFilterWorkspace(String(newWs.workspace_id));
      setFilterProject('');
      setActiveTab('projects');
      setSelectedSubItemId('project-table');
      setIsCreateWorkspaceModalOpen(false);
      setNewWorkspaceName('');
      setNewWorkspacePrefix('');
    } catch (error: any) {
      console.error('Workspace creation failed:', error);
      setCreateWorkspaceError(error.message || 'Failed to create workspace.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleWorkspaceAction = async (action: 'add' | 'rename' | 'delete') => {
    setIsActionMenuOpen(false);
    try {
      if (action === 'add') {
        setNewWorkspaceName('');
        setNewWorkspacePrefix('');
        setCreateWorkspaceError('');
        setIsCreateWorkspaceModalOpen(true);
      } else if (action === 'rename') {
        if (!activeWorkspaceId) return;
        const newName = window.prompt('Enter new workspace name:', activeWorkspace?.workspace_name || '');
        if (newName && newName.trim() !== '') {
          await api.updateWorkspace(activeWorkspaceId, { workspace_name: newName.trim() });
          if (onRefreshData) await onRefreshData();
        }
      } else if (action === 'delete') {
        if (!activeWorkspaceId) return;
        if (window.confirm(`Are you sure you want to delete workspace "${activeWorkspace?.workspace_name}"? THIS WILL DELETE ALL ITS CONTENTS (Projects, Tasks, etc.)!`)) {
          await api.deleteWorkspace(activeWorkspaceId);
          setFilterWorkspace('');
          if (onRefreshData) await onRefreshData();
        }
      }
    } catch (error: any) {
      console.error('Workspace action failed:', error);
      window.alert('Operation failed: ' + error.message);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine active workspace
  const activeWorkspaceId = filterWorkspace || (workspaces.length > 0 ? String(workspaces[0].workspace_id) : '');
  const activeWorkspace = workspaces.find(w => String(w.workspace_id) === activeWorkspaceId);

  // Ensure filterWorkspace is set if it was empty but workspaces exist
  useEffect(() => {
    if (!filterWorkspace && activeWorkspaceId) {
      setFilterWorkspace(activeWorkspaceId);
    }
  }, [filterWorkspace, activeWorkspaceId, setFilterWorkspace]);

  const filteredWorkspaces = workspaces.filter(w => 
    w.workspace_name.toLowerCase().includes(workspaceSearchTerm.toLowerCase())
  );

  const wsProducts = activeWorkspace ? products.filter(p => String(p.related_workspace_id) === String(activeWorkspace.workspace_id)) : [];
  const wsProjects = activeWorkspace ? projects.filter(p => String(p.related_workspace_id) === String(activeWorkspace.workspace_id)) : [];

  const isProductsSelected = activeTab === 'products' && selectedSubItemId === 'product-table';
  const isProjectsSelected = activeTab === 'projects' && selectedSubItemId === 'project-table';
  const isAllItemsSelected = activeTab === 'tasks' && selectedSubItemId === 'task-table' && !filterProject;

  return (
    <aside style={styles.sidebar}>
      {/* Brand Header */}
      <div style={styles.header}>
        <div style={styles.logoContainer}>
          <div style={styles.logoInner}>神</div>
        </div>
        <span style={styles.brandTitle}>Project 神</span>
      </div>

      {/* Tree Navigation Container */}
      <div style={styles.treeContainer}>
        {/* Workspace Dropdown */}
        <div style={{...styles.sectionHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <span>Workspace</span>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }} ref={actionMenuRef}>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsActionMenuOpen(!isActionMenuOpen); }}
              style={{
                background: 'transparent', border: 'none', color: 'var(--text-muted)', 
                cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
              </svg>
            </button>

            {isActionMenuOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: '0',
                marginTop: '4px',
                width: '180px',
                backgroundColor: '#1E293B',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                padding: '4px',
                zIndex: 100
              }}>
                <button 
                  style={{width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '13px', color: '#E2E8F0', background: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => handleWorkspaceAction('add')}
                >
                  <span style={{ marginRight: '8px' }}>+</span> Add new workspace
                </button>
                <button 
                  style={{width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '13px', color: '#E2E8F0', background: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => handleWorkspaceAction('rename')}
                >
                  <span style={{ marginRight: '8px' }}>✎</span> Rename workspace
                </button>
                <button 
                  style={{width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '13px', color: '#EF4444', background: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer'}}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => handleWorkspaceAction('delete')}
                >
                  <span style={{ marginRight: '8px' }}>🗑</span> Delete workspace
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div style={{ position: 'relative', padding: '0 8px', marginBottom: '16px' }} ref={dropdownRef}>
          <button 
            style={styles.workspaceDropdownButton}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <div style={styles.workspaceIcon}>
                {activeWorkspace ? activeWorkspace.workspace_name.charAt(0).toUpperCase() : 'W'}
              </div>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                {activeWorkspace ? activeWorkspace.workspace_name : 'Select Workspace'}
              </span>
            </div>
            <span style={{ fontSize: '10px' }}>{isDropdownOpen ? '▲' : '▼'}</span>
          </button>

          {isDropdownOpen && (
            <div style={styles.dropdownMenu}>
              <div style={{ padding: '8px' }}>
                <input 
                  type="text" 
                  placeholder="Search for a workspace"
                  value={workspaceSearchTerm}
                  onChange={(e) => setWorkspaceSearchTerm(e.target.value)}
                  style={styles.searchInput}
                  autoFocus
                />
              </div>
              <div style={styles.workspaceList}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '4px 12px', fontWeight: 600 }}>
                  My workspaces
                </div>
                {filteredWorkspaces.length > 0 ? filteredWorkspaces.map(ws => (
                  <div 
                    key={ws.workspace_id}
                    style={{
                      ...styles.workspaceMenuItem,
                      ...(String(ws.workspace_id) === activeWorkspaceId ? styles.workspaceMenuItemActive : {})
                    }}
                    onClick={() => {
                      setFilterWorkspace(String(ws.workspace_id));
                      setFilterProject(''); // Clear project filter
                      setWorkspaceSearchTerm('');
                      setIsDropdownOpen(false);
                      // Navigate to projects overview
                      setActiveTab('projects');
                      setSelectedSubItemId('project-table');
                    }}
                    onMouseEnter={e => {
                      if (String(ws.workspace_id) !== activeWorkspaceId) {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (String(ws.workspace_id) !== activeWorkspaceId) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div style={{...styles.workspaceIcon, width: '20px', height: '20px', fontSize: '12px', background: 'var(--accent-secondary)'}}>
                      {ws.workspace_name.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ws.workspace_name}
                    </span>
                  </div>
                )) : (
                  <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    No workspaces found.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Selected Workspace Content */}
        {activeWorkspace && (
          <div style={{ padding: '0 8px' }}>
            <div 
              style={{
                ...styles.treeSubRow,
                ...(isProductsSelected ? styles.treeSubRowActive : {})
              }} 
              onClick={(e) => {
                e.stopPropagation();
                setFilterWorkspace(String(activeWorkspace.workspace_id));
                setFilterProject('');
                setActiveTab('products');
                setSelectedSubItemId('product-table');
              }}
              onMouseEnter={e => {
                if (!isProductsSelected) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                }
              }}
              onMouseLeave={e => {
                if (!isProductsSelected) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span>📦 Product ({wsProducts.length})</span>
            </div>

            <div 
              style={{
                ...styles.treeSubRow,
                ...(isProjectsSelected ? styles.treeSubRowActive : {})
              }} 
              onClick={(e) => {
                e.stopPropagation();
                setFilterWorkspace(String(activeWorkspace.workspace_id));
                setFilterProject('');
                setActiveTab('projects');
                setSelectedSubItemId('project-table');
              }}
              onMouseEnter={e => {
                if (!isProjectsSelected) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                }
              }}
              onMouseLeave={e => {
                if (!isProjectsSelected) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span>💻 Project ({wsProjects.length})</span>
            </div>

            <div 
              style={{
                ...styles.treeSubRow,
                ...(isAllItemsSelected ? styles.treeSubRowActive : {})
              }} 
              onClick={(e) => {
                e.stopPropagation();
                setFilterWorkspace(String(activeWorkspace.workspace_id));
                setFilterProject('');
                setActiveTab('tasks');
                setSelectedSubItemId('task-table');
              }}
              onMouseEnter={e => {
                if (!isAllItemsSelected) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                }
              }}
              onMouseLeave={e => {
                if (!isAllItemsSelected) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span>📊 All item view</span>
            </div>
          </div>
        )}
      </div>

      {/* User Footer Card */}
      <div 
        style={{ 
          ...styles.userFooter, 
          ...(activeTab === 'user' ? styles.userFooterActive : {}) 
        }} 
        onClick={() => {
          setActiveTab('user');
          setSelectedSubItemId(null);
        }}
        title="用戶帳戶設定"
      >
        <div style={styles.avatarInner}>PM</div>
        <div style={styles.userInfo}>
          <div style={styles.userName}>Edmond Chan</div>
          <div style={styles.userRole}>Project Manager</div>
        </div>
      </div>

      {/* Create Workspace Modal */}
      {isCreateWorkspaceModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: '#1E293B',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '24px',
            width: '400px',
            maxWidth: '90%',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#fff', fontSize: '18px' }}>Create New Workspace</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '8px' }}>Workspace Name</label>
              <input 
                autoFocus
                type="text" 
                value={newWorkspaceName}
                onChange={e => setNewWorkspaceName(e.target.value)}
                placeholder="e.g. Acme Corporation"
                style={{
                  width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', 
                  borderRadius: '6px', color: '#fff', fontSize: '14px', outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '8px' }}>Prefix Code (3-4 chars)</label>
              <input 
                type="text" 
                maxLength={4}
                value={newWorkspacePrefix}
                onChange={e => setNewWorkspacePrefix(e.target.value.toUpperCase())}
                placeholder="e.g. ACME"
                style={{
                  width: '100%', padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', 
                  borderRadius: '6px', color: '#fff', fontSize: '14px', outline: 'none', textTransform: 'uppercase'
                }}
              />
            </div>

            {createWorkspaceError && (
              <div style={{ color: '#EF4444', fontSize: '13px', marginBottom: '16px' }}>
                {createWorkspaceError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button 
                onClick={() => setIsCreateWorkspaceModalOpen(false)}
                disabled={isCreating}
                style={{
                  padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px', color: '#E2E8F0', cursor: isCreating ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateWorkspaceSubmit}
                disabled={isCreating}
                style={{
                  padding: '8px 16px', background: 'var(--accent-primary)', border: 'none',
                  borderRadius: '6px', color: '#fff', fontWeight: 600, cursor: isCreating ? 'not-allowed' : 'pointer'
                }}
              >
                {isCreating ? 'Creating...' : 'Create Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

const styles = {
  sidebar: {
    width: '260px',
    backgroundColor: '#07090F',
    borderRight: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    userSelect: 'none' as const,
    overflow: 'hidden',
  },
  header: {
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    background: 'rgba(255, 255, 255, 0.01)',
  },
  logoContainer: {
    flexShrink: 0,
  },
  logoInner: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '16px',
    color: '#fff',
    boxShadow: '0 0 12px var(--accent-primary-glow)',
  },
  brandTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: '0.5px',
  },
  treeContainer: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px 4px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  sectionHeader: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    padding: '4px 12px 8px 12px',
  },
  workspaceDropdownButton: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    padding: '6px 8px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background 0.2s, border-color 0.2s',
  },
  workspaceIcon: {
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    background: '#e0245e', // Use a distinctive color for the workspace initial icon
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 'bold',
    flexShrink: 0,
  },
  dropdownMenu: {
    position: 'absolute' as const,
    top: '100%',
    left: '8px',
    right: '8px',
    marginTop: '4px',
    background: '#1A1E2E',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column' as const,
    maxHeight: '300px',
  },
  searchInput: {
    width: '100%',
    background: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: 'white',
    padding: '6px 8px',
    borderRadius: '4px',
    fontSize: '13px',
    outline: 'none',
  },
  workspaceList: {
    flex: 1,
    overflowY: 'auto' as const,
    paddingBottom: '8px',
  },
  workspaceMenuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    transition: 'background 0.15s, color 0.15s',
  },
  workspaceMenuItemActive: {
    background: 'rgba(99, 102, 241, 0.15)',
    color: 'var(--text-primary)',
  },
  treeSubRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    fontSize: '14px',
    borderRadius: '6px',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    transition: 'all 0.15s ease',
    marginBottom: '2px',
  },
  treeSubRowActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    color: 'var(--text-primary)',
    fontWeight: 600,
  },
  userFooter: {
    padding: '12px 16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    transition: 'all 0.2s',
  },
  userFooterActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  avatarInner: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    color: 'var(--accent-primary)',
    fontWeight: 'bold',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  userName: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  userRole: {
    fontSize: '10px',
    color: 'var(--text-muted)',
  },
};

export default Sidebar;
