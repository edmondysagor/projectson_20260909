import React, { useState } from 'react';
import { X, Shield, Package, FolderGit2, Check, Sparkles } from 'lucide-react';
import { api } from '../utils/api';
import type { Member, Project, Workspace } from '../utils/api';

interface MemberAccessDrawerProps {
  member: Member | null;
  workspace: Workspace | null;
  products: Project[];
  projects: Project[];
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export const MemberAccessDrawer: React.FC<MemberAccessDrawerProps> = ({
  member,
  workspace,
  products,
  projects,
  isOpen,
  onClose,
  onRefresh
}) => {
  const [loading, setLoading] = useState(false);

  if (!isOpen || !member) return null;

  // 1. 檢查工作空間全域權限
  const wsAccessUids: string[] = (workspace?.allow_access_member || []).map((item: any) =>
    typeof item === 'string' ? item : item?.member_uid
  ).filter(Boolean);
  const hasWorkspaceGlobalAccess = wsAccessUids.includes(member.member_uid);

  // 切換工作空間全域權限
  const handleToggleWorkspaceAccess = async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      let nextUids: string[];
      if (hasWorkspaceGlobalAccess) {
        nextUids = wsAccessUids.filter(id => id !== member.member_uid);
      } else {
        nextUids = [...wsAccessUids, member.member_uid];
      }
      const formatted = nextUids.map(uid => ({ member_uid: uid, role_in_this_workspace: 'Member' }));
      await api.updateWorkspace(workspace.workspace_uid, {
        allow_access_member: formatted as any
      });
      await onRefresh();
    } catch (err: any) {
      alert('更新工作空間權限失敗: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. 切換產品級權限
  const handleToggleProductAccess = async (product: Project) => {
    setLoading(true);
    try {
      const currentUids: string[] = (product.allow_access_member || []).map((item: any) =>
        typeof item === 'string' ? item : item?.member_uid
      ).filter(Boolean);

      let nextUids: string[];
      if (currentUids.includes(member.member_uid)) {
        nextUids = currentUids.filter(id => id !== member.member_uid);
      } else {
        nextUids = [...currentUids, member.member_uid];
      }
      const formatted = nextUids.map(uid => ({ member_uid: uid, role_in_this_workspace: 'Member' }));
      await api.patchProject(product.project_uid, {
        allow_access_member: formatted as any
      });
      await onRefresh();
    } catch (err: any) {
      alert('更新產品權限失敗: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. 切換專案級權限 (個別專案授權)
  const handleToggleProjectAccess = async (project: Project) => {
    setLoading(true);
    try {
      const currentUids: string[] = (project.allow_access_member || []).map((item: any) =>
        typeof item === 'string' ? item : item?.member_uid
      ).filter(Boolean);

      let nextUids: string[];
      if (currentUids.includes(member.member_uid)) {
        nextUids = currentUids.filter(id => id !== member.member_uid);
      } else {
        nextUids = [...currentUids, member.member_uid];
      }
      const formatted = nextUids.map(uid => ({ member_uid: uid, role_in_this_workspace: 'Member' }));
      await api.patchProject(project.project_uid, {
        allow_access_member: formatted as any
      });
      await onRefresh();
    } catch (err: any) {
      alert('更新專案權限失敗: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '560px',
          maxWidth: '90vw',
          height: '100%',
          backgroundColor: '#0c1322',
          borderLeft: '1px solid #1e293b',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#0f172a'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                fontWeight: 700,
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)'
              }}
            >
              {member.member_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', fontWeight: 700 }}>
                  {member.member_name}
                </h2>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: member.member_status === 'Active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                    color: member.member_status === 'Active' ? '#6ee7b7' : '#94a3b8',
                    border: member.member_status === 'Active' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(148, 163, 184, 0.3)',
                    fontWeight: 600
                  }}
                >
                  {member.member_status}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                {member.member_email} {member.member_ad_group ? `• ${member.member_ad_group}` : ''}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 0.15s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#cbd5e1')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {/* 1. 工作空間全域通行層級 */}
          <div
            style={{
              backgroundColor: '#131c31',
              border: hasWorkspaceGlobalAccess ? '1px solid #3b82f6' : '1px solid #23304a',
              borderRadius: '10px',
              padding: '16px 18px',
              transition: 'border-color 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: hasWorkspaceGlobalAccess ? 'rgba(59, 130, 246, 0.2)' : '#1e293b',
                    color: hasWorkspaceGlobalAccess ? '#60a5fa' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Shield size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#f8fafc' }}>
                    🏢 工作空間全域成員 (Workspace Global Member)
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                    開啓後該成員自動具備此工作空間下**所有產品與專案**的完整存取權限。
                  </div>
                </div>
              </div>

              <input
                type="checkbox"
                checked={hasWorkspaceGlobalAccess}
                disabled={loading}
                onChange={handleToggleWorkspaceAccess}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                  accentColor: '#3b82f6'
                }}
              />
            </div>
          </div>

          {/* 若已是全域成員，顯示全通提示 */}
          {hasWorkspaceGlobalAccess && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
                color: '#93c5fd',
                fontSize: '0.82rem'
              }}
            >
              <Sparkles size={16} />
              <span>該成員為全域成員，自動享有下方所有產品及專案之通行權限。</span>
            </div>
          )}

          {/* 2. 產品級存取權限 (Product Scope) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Package size={18} color="#38bdf8" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#f8fafc', fontWeight: 600 }}>
                產品級存取權限 (Product Scope)
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                (授權產品後，自動繼承其底下所有 Phase / BAU 專案)
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {products.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic', padding: '8px' }}>
                  工作空間內尚無任何產品 (Product)
                </div>
              ) : (
                products.map((prod) => {
                  const prodUids: string[] = (prod.allow_access_member || []).map((item: any) =>
                    typeof item === 'string' ? item : item?.member_uid
                  ).filter(Boolean);
                  const isProductAuthorized = prodUids.includes(member.member_uid);

                  return (
                    <div
                      key={prod.project_uid}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        backgroundColor: '#131b2e',
                        border: isProductAuthorized ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid #1e293b',
                        borderRadius: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 700 }}>
                          📦 {prod.project_display_code}
                        </span>
                        <span style={{ fontSize: '0.88rem', color: '#f8fafc', fontWeight: 500 }}>
                          {prod.project_name}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {hasWorkspaceGlobalAccess ? (
                          <span style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={14} /> 全域通行
                          </span>
                        ) : (
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', color: isProductAuthorized ? '#38bdf8' : '#94a3b8' }}>
                            <input
                              type="checkbox"
                              checked={isProductAuthorized}
                              disabled={loading || hasWorkspaceGlobalAccess}
                              onChange={() => handleToggleProductAccess(prod)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#38bdf8' }}
                            />
                            {isProductAuthorized ? '已授權產品' : '未授權'}
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 3. 專案級存取權限 (Project Scope) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <FolderGit2 size={18} color="#a855f7" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#f8fafc', fontWeight: 600 }}>
                專案級存取權限 (Project Scope)
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                (個別專案獨立授權 / 嘉賓權限)
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {projects.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic', padding: '8px' }}>
                  工作空間內尚無任何專案 (Project)
                </div>
              ) : (
                projects.map((prj) => {
                  const prjUids: string[] = (prj.allow_access_member || []).map((item: any) =>
                    typeof item === 'string' ? item : item?.member_uid
                  ).filter(Boolean);
                  const isDirectAuthorized = prjUids.includes(member.member_uid);

                  // 檢查是否由母產品 (Parent Product) 繼承
                  const parentProd = products.find(p => p.project_uid === prj.parent_project_uid);
                  const parentUids: string[] = (parentProd?.allow_access_member || []).map((item: any) =>
                    typeof item === 'string' ? item : item?.member_uid
                  ).filter(Boolean);
                  const isInheritedFromProduct = parentProd ? parentUids.includes(member.member_uid) : false;

                  return (
                    <div
                      key={prj.project_uid}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        backgroundColor: '#131b2e',
                        border: (isDirectAuthorized || isInheritedFromProduct) ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid #1e293b',
                        borderRadius: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#c084fc', fontWeight: 700 }}>
                          📁 {prj.project_display_code}
                        </span>
                        <div>
                          <div style={{ fontSize: '0.88rem', color: '#f8fafc', fontWeight: 500 }}>
                            {prj.project_name}
                          </div>
                          {parentProd && (
                            <div style={{ fontSize: '0.73rem', color: '#94a3b8' }}>
                              母產品: {parentProd.project_name}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {hasWorkspaceGlobalAccess ? (
                          <span style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={14} /> 全域通行
                          </span>
                        ) : isInheritedFromProduct ? (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              backgroundColor: 'rgba(56, 189, 248, 0.15)',
                              color: '#38bdf8',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Check size={12} /> 繼承自產品
                          </span>
                        ) : (
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', color: isDirectAuthorized ? '#c084fc' : '#94a3b8' }}>
                            <input
                              type="checkbox"
                              checked={isDirectAuthorized}
                              disabled={loading || hasWorkspaceGlobalAccess}
                              onChange={() => handleToggleProjectAccess(prj)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#a855f7' }}
                            />
                            {isDirectAuthorized ? '個別專案授權' : '未授權'}
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Drawer Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #1e293b',
            backgroundColor: '#0f172a',
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              backgroundColor: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
