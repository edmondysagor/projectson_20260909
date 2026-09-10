import React, { useState } from 'react';
import { ArrowLeft, X, Plus, Trash2, Edit3 } from 'lucide-react';
import { api } from '../utils/api';
import type { Project, ProjectItem, Member } from '../utils/api';

interface ProductDetailViewProps {
  product: Project;
  allProjects: Project[];
  items: ProjectItem[];
  members: Member[];
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onSelectProject: (project: Project) => void;
  onItemClick: (item: ProjectItem) => void;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  product,
  allProjects,
  items,
  members,
  onBack,
  onRefresh,
  onSelectProject,
  onItemClick
}) => {
  // 產品願景編輯狀態
  const [editingVision, setEditingVision] = useState(false);
  const [visionText, setVisionText] = useState(product.project_content?.vision || '');

  // 關聯專案新增 Bar 狀態
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newSubType, setNewSubType] = useState<'Phase' | 'BAU'>('Phase');
  const [addProjectLoading, setAddProjectLoading] = useState(false);

  // 1. 篩選歸屬於此 Product 的關聯 Projects
  const childProjects = allProjects.filter(
    p => p.parent_project_uid === product.project_uid || 
         (p.project_type === 'Project' && p.project_name.toLowerCase().includes(product.project_name.toLowerCase()))
  );

  // 2. 獲取關聯專案的 UID 集合 (包含本 Product 本身及子專案)
  const relatedProjectUids = new Set([
    product.project_uid,
    ...childProjects.map(p => p.project_uid)
  ]);

  // 3. 所有與本 Product 相關的 items
  const productItems = items.filter(i => relatedProjectUids.has(i.related_project_uid));

  // 篩選 Deployment items
  const deployments = productItems.filter(i => i.item_type === 'Deployment');

  // 計算每個 Deployment 對應的 User Story
  const getUserStoriesForDeployment = (deployUid: string) => {
    return productItems.filter(i => 
      i.item_type === 'User story' && 
      (i.parent_item_uid === deployUid || i.relation_item_uid?.some((r: any) => r.item_uid === deployUid))
    );
  };

  // 計算每個 User Story 對應的 Task
  const getTasksForUserStory = (usUid: string) => {
    return productItems.filter(i => 
      i.item_type === 'Task' && 
      (i.parent_item_uid === usUid || i.relation_item_uid?.some((r: any) => r.item_uid === usUid))
    );
  };

  // 儲存願景說明
  const handleSaveVision = async () => {
    try {
      await api.patchProject(product.project_uid, {
        project_content: { ...product.project_content, vision: visionText }
      });
      setEditingVision(false);
      await onRefresh();
    } catch (err: any) {
      alert('更新產品願景失敗: ' + err.message);
    }
  };

  // 新增附屬專案
  const handleCreateChildProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setAddProjectLoading(true);
    try {
      await api.createProject({
        project_name: newProjectName.trim(),
        project_type: 'Project',
        project_sub_type: newSubType,
        parent_project_uid: product.project_uid,
        related_workspace_uid: product.related_workspace_uid,
        project_status: 'Active'
      });
      setNewProjectName('');
      setShowAddProject(false);
      await onRefresh();
    } catch (err: any) {
      alert('建立附屬專案失敗: ' + err.message);
    } finally {
      setAddProjectLoading(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    const isCompleted = status === 'Completed' || status === 'Closed';
    const isActive = status === 'Active' || status === 'In Progress';
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: 600,
        backgroundColor: isCompleted ? 'rgba(16, 185, 129, 0.15)' : isActive ? 'rgba(59, 130, 246, 0.15)' : 'rgba(148, 163, 184, 0.15)',
        color: isCompleted ? '#34d399' : isActive ? '#60a5fa' : '#94a3b8'
      }}>
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: isCompleted ? '#10b981' : isActive ? '#3b82f6' : '#94a3b8'
        }} />
        {status}
      </span>
    );
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#090d16',
      color: '#f8fafc',
      overflow: 'hidden'
    }}>
      {/* 1. 頂部返回導航條 (對齊 圖1: ❮ 返回產品分頁  📦 AAP-COT-2) */}
      <div style={{
        padding: '12px 24px',
        backgroundColor: '#131b2e',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onBack}
            style={{
              padding: '6px 12px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#cbd5e1',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={14} /> 返回產品分頁
          </button>
          <span style={{ color: '#fb923c', fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            📦 {product.project_display_code}
          </span>
        </div>

        <button
          onClick={onBack}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* 2. 主視圖區塊 (左側大內容 + 右側產品屬性欄，對齊 圖1) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左側主面板 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '28px 32px' }}>
          
          {/* Header 標題與操作按鈕 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <h1 style={{ margin: '0 0 6px 0', fontSize: '1.8rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.4px' }}>
                {product.project_name} (Product)
              </h1>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={async () => {
                  if (confirm(`確定要刪除產品 ${product.project_name} 嗎？`)) {
                    await api.deleteProject(product.project_uid);
                    await onRefresh();
                    onBack();
                  }
                }}
                style={{
                  padding: '6px 14px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={14} /> 刪除
              </button>

              <button
                onClick={() => setEditingVision(true)}
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#1e293b',
                  color: '#cbd5e1',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Edit3 size={14} /> 編輯產品
              </button>
            </div>
          </div>

          {/* 產品願景 (Product Vision) */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>
              產品願景 (Product Vision)
            </div>

            {editingVision ? (
              <div>
                <textarea
                  rows={3}
                  value={visionText}
                  onChange={(e) => setVisionText(e.target.value)}
                  placeholder="輸入產品長期願景、業務目標或核心定位..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #3b82f6',
                    borderRadius: '8px',
                    color: '#fff',
                    boxSizing: 'border-box',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    onClick={handleSaveVision}
                    style={{ padding: '6px 14px', background: '#16a34a', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingVision(false)}
                    style={{ padding: '6px 14px', background: '#334155', border: 'none', borderRadius: '6px', color: '#cbd5e1', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setEditingVision(true)}
                style={{
                  padding: '14px 18px',
                  backgroundColor: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  color: visionText ? '#cbd5e1' : '#64748b',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  minHeight: '48px',
                  lineHeight: 1.5
                }}
              >
                {visionText || '尚未設定產品願景。點擊以新增產品願景...'}
              </div>
            )}
          </div>

          {/* 區塊 1: 關聯專案 (2) 表格清單 */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📁 關聯專案 ({childProjects.length})
            </div>

            <div style={{
              backgroundColor: '#0f172a',
              borderRadius: '10px',
              border: '1px solid #1e293b',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#131b2e', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <th style={{ padding: '10px 16px', width: '150px' }}>專案代號</th>
                    <th style={{ padding: '10px 16px' }}>專案名稱</th>
                    <th style={{ padding: '10px 16px', width: '160px' }}>工作空間</th>
                    <th style={{ padding: '10px 16px', width: '130px' }}>狀態</th>
                    <th style={{ padding: '10px 16px', width: '90px' }}>內部 ID</th>
                  </tr>
                </thead>
                <tbody>
                  {childProjects.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                        尚未建立附屬於此產品的專案
                      </td>
                    </tr>
                  ) : (
                    childProjects.map(cp => (
                      <tr
                        key={cp.project_uid}
                        style={{ borderBottom: '1px solid #1e293b', transition: 'background-color 0.15s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#131b2e')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '10px 16px' }}>
                          <button
                            onClick={() => onSelectProject(cp)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#38bdf8',
                              fontWeight: 700,
                              cursor: 'pointer',
                              padding: 0
                            }}
                          >
                            {cp.project_display_code}
                          </button>
                        </td>
                        <td style={{ padding: '10px 16px', color: '#f8fafc', fontWeight: 600 }}>
                          📁 {cp.project_name}
                        </td>
                        <td style={{ padding: '10px 16px', color: '#94a3b8' }}>
                          🗄️ {product.workspace_name || '預設工作區'}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          {renderStatusBadge(cp.project_status)}
                        </td>
                        <td style={{ padding: '10px 16px', color: '#64748b' }}>
                          {cp.project_number}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* 關聯專案框底新增 Bar */}
              <div style={{
                padding: '8px 16px',
                borderTop: '1px solid #1e293b',
                backgroundColor: '#0c1222'
              }}>
                {showAddProject ? (
                  <form onSubmit={handleCreateChildProject} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      value={newSubType}
                      onChange={(e) => setNewSubType(e.target.value as 'Phase' | 'BAU')}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: '#131b2e',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#93c5fd',
                        fontSize: '0.85rem'
                      }}
                    >
                      <option value="Phase">Phase (階段專案)</option>
                      <option value="BAU">BAU (日常運維)</option>
                    </select>

                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="輸入新附屬專案名稱..."
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: '200px',
                        padding: '6px 12px',
                        backgroundColor: '#090d16',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '0.85rem'
                      }}
                    />

                    <button
                      type="submit"
                      disabled={addProjectLoading}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#16a34a',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {addProjectLoading ? '建立中...' : '儲存'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowAddProject(false)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#334155',
                        color: '#cbd5e1',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      取消
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowAddProject(true)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      padding: '4px 0'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#38bdf8')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
                  >
                    <Plus size={15} /> + 新增
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 區塊 2: Update & Deployment (對齊 圖1: 3欄式矩陣 Deployment > User Story > Task) */}
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🚀 Update & Deployment
            </div>

            <div style={{
              backgroundColor: '#0f172a',
              borderRadius: '10px',
              border: '1px solid #1e293b',
              overflow: 'hidden'
            }}>
              {/* 欄位標題 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                backgroundColor: '#131b2e',
                borderBottom: '1px solid #1e293b',
                padding: '10px 16px',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#94a3b8'
              }}>
                <div>Deployment</div>
                <div>User Story</div>
                <div>Task</div>
              </div>

              {/* 內容區塊 */}
              <div style={{ padding: '16px' }}>
                {deployments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '0.85rem' }}>
                    目前尚無部署卡片紀錄 (可至子專案中建立 Deployment 工單)
                  </div>
                ) : (
                  deployments.map(dep => {
                    const userStories = getUserStoriesForDeployment(dep.item_uid);

                    return (
                      <div
                        key={dep.item_uid}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: '16px',
                          marginBottom: '16px',
                          paddingBottom: '16px',
                          borderBottom: '1px solid #1e293b'
                        }}
                      >
                        {/* 1. Deployment 卡片 */}
                        <div>
                          <div
                            onClick={() => onItemClick(dep)}
                            style={{
                              backgroundColor: '#131b2e',
                              borderRadius: '8px',
                              border: '1px solid #23304a',
                              padding: '12px 14px',
                              cursor: 'pointer',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <span style={{ color: '#fb923c', fontWeight: 700, fontSize: '0.8rem' }}>
                                📦 {dep.item_display_code}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                📁 {allProjects.find(p => p.project_uid === dep.related_project_uid)?.project_name || '專案'}
                              </span>
                            </div>

                            <div style={{ marginBottom: '8px' }}>
                              {renderStatusBadge(dep.item_status)}
                            </div>

                            <div style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: 600, lineHeight: 1.4 }}>
                              {dep.item_title}
                            </div>
                          </div>
                        </div>

                        {/* 2. User Story 列表卡片 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {userStories.length === 0 ? (
                            <div style={{ color: '#475569', fontSize: '0.8rem', fontStyle: 'italic', padding: '8px' }}>
                              無關聯 User Story
                            </div>
                          ) : (
                            userStories.map(us => (
                              <div
                                key={us.item_uid}
                                onClick={() => onItemClick(us)}
                                style={{
                                  backgroundColor: '#131b2e',
                                  borderRadius: '8px',
                                  border: '1px solid #23304a',
                                  padding: '10px 12px',
                                  cursor: 'pointer'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                  <span style={{ color: '#38bdf8', fontWeight: 600, fontSize: '0.75rem' }}>
                                    👤 {us.item_display_code}
                                  </span>
                                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                    📁 {allProjects.find(p => p.project_uid === us.related_project_uid)?.project_name || '專案'}
                                  </span>
                                </div>
                                <div style={{ marginBottom: '6px' }}>
                                  {renderStatusBadge(us.item_status)}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 500 }}>
                                  {us.item_title}
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* 3. Task 列表卡片 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {userStories.flatMap(us => getTasksForUserStory(us.item_uid)).length === 0 ? (
                            <div style={{ color: '#475569', fontSize: '0.8rem', fontStyle: 'italic', padding: '8px' }}>
                              無關聯 Task
                            </div>
                          ) : (
                            userStories.flatMap(us => getTasksForUserStory(us.item_uid)).map(t => (
                              <div
                                key={t.item_uid}
                                onClick={() => onItemClick(t)}
                                style={{
                                  backgroundColor: '#131b2e',
                                  borderRadius: '8px',
                                  border: '1px solid #23304a',
                                  padding: '10px 12px',
                                  cursor: 'pointer'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                  <span style={{ color: '#38bdf8', fontWeight: 600, fontSize: '0.75rem' }}>
                                    📋 {t.item_display_code}
                                  </span>
                                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                    📁 {allProjects.find(p => p.project_uid === t.related_project_uid)?.project_name || '專案'}
                                  </span>
                                </div>
                                <div style={{ marginBottom: '6px' }}>
                                  {renderStatusBadge(t.item_status)}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 500 }}>
                                  {t.item_title}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>

        {/* 右側產品資訊屬性欄 (對齊 圖1 右側: 產品狀態, 工作空間, 業務負責人, 技術負責人) */}
        <div style={{
          width: '280px',
          backgroundColor: '#0f172a',
          borderLeft: '1px solid #1e293b',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          overflowY: 'auto'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
              產品狀態
            </label>
            <select
              value={product.project_status}
              onChange={async (e) => {
                await api.patchProject(product.project_uid, { project_status: e.target.value as any });
                await onRefresh();
              }}
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: '6px',
                backgroundColor: '#131b2e',
                border: '1px solid #334155',
                color: product.project_status === 'Completed' ? '#6ee7b7' : '#93c5fd',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {['Pipeline', 'Active', 'On Hold', 'Completed', 'Abandoned'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
              工作空間
            </label>
            <div style={{ fontSize: '0.85rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🏢 {product.workspace_name || 'ASD Ops Analytics & Insight'}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
              業務負責人 (Owner)
            </label>
            <select
              value={product.project_owner || ''}
              onChange={async (e) => {
                const val = e.target.value;
                await api.patchProject(product.project_uid, { project_owner: val ? val : undefined });
                await onRefresh();
              }}
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: '6px',
                backgroundColor: '#131b2e',
                border: '1px solid #334155',
                color: '#cbd5e1',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <option value="">-- 未指派 --</option>
              {members.map(m => (
                <option key={m.member_uid} value={m.member_uid}>👤 {m.member_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
              技術負責人
            </label>
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '6px' }}>
              👤 {members[1]?.member_name || members[0]?.member_name || '未指定'}
            </div>
          </div>

          <div style={{ marginTop: 'auto', borderTop: '1px solid #1e293b', paddingTop: '16px', fontSize: '0.75rem', color: '#64748b' }}>
            <div>建立時間: {new Date(product.created_at).toLocaleDateString()}</div>
            <div>更新時間: {new Date(product.updated_at).toLocaleDateString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
