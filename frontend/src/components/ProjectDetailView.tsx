import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, X, Plus, Check, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { api } from '../utils/api';
import type { Project, ProjectItem, Member, Template, TemplateNode } from '../utils/api';
import { TraceabilityMatrix } from './TraceabilityMatrix';
import { DeploymentTraceabilityMatrix } from './DeploymentTraceabilityMatrix';
import { MilestoneRaciTable } from './MilestoneRaciTable';
import { AdvancedTable } from './AdvancedTable';
import { CustomSelect } from './CustomSelect';
import type { CustomSelectOption } from './CustomSelect';
import { MemberSelect } from './MemberSelect';
import { ProductSelect } from './ProductSelect';
import { AccessMemberSelect } from './AccessMemberSelect';
import { TemplateModal } from './TemplateModal';

interface ProjectDetailViewProps {
  project: Project;
  items: ProjectItem[];
  members: Member[];
  products?: Project[];
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onRefreshMembers?: () => Promise<void>;
  onItemClick: (item: ProjectItem) => void;
}

const PROJECT_COLOR_OPTIONS: CustomSelectOption[] = [
  {
    value: '#38bdf8',
    label: 'Sky Blue (天藍)',
    badgeBg: '#0284c7',
    badgeColor: '#e0f2fe',
    icon: <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#38bdf8', display: 'inline-block', flexShrink: 0, boxShadow: '0 0 6px rgba(56, 189, 248, 0.8)' }} />
  },
  {
    value: '#6366f1',
    label: 'Indigo (靛藍)',
    badgeBg: '#4338ca',
    badgeColor: '#e0e7ff',
    icon: <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#6366f1', display: 'inline-block', flexShrink: 0, boxShadow: '0 0 6px rgba(99, 102, 241, 0.8)' }} />
  },
  {
    value: '#a855f7',
    label: 'Purple (紫色)',
    badgeBg: '#7e22ce',
    badgeColor: '#f3e8ff',
    icon: <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#a855f7', display: 'inline-block', flexShrink: 0, boxShadow: '0 0 6px rgba(168, 85, 247, 0.8)' }} />
  },
  {
    value: '#10b981',
    label: 'Emerald (翡翠綠)',
    badgeBg: '#047857',
    badgeColor: '#d1fae5',
    icon: <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', flexShrink: 0, boxShadow: '0 0 6px rgba(16, 185, 129, 0.8)' }} />
  },
  {
    value: '#f59e0b',
    label: 'Amber (琥珀黃)',
    badgeBg: '#b45309',
    badgeColor: '#fef3c7',
    icon: <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block', flexShrink: 0, boxShadow: '0 0 6px rgba(245, 158, 11, 0.8)' }} />
  },
  {
    value: '#f43f5e',
    label: 'Rose (玫瑰紅)',
    badgeBg: '#be123c',
    badgeColor: '#ffe4e6',
    icon: <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#f43f5e', display: 'inline-block', flexShrink: 0, boxShadow: '0 0 6px rgba(244, 63, 94, 0.8)' }} />
  },
  {
    value: '#06b6d4',
    label: 'Cyan (青色)',
    badgeBg: '#0e7490',
    badgeColor: '#cffafe',
    icon: <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#06b6d4', display: 'inline-block', flexShrink: 0, boxShadow: '0 0 6px rgba(6, 182, 212, 0.8)' }} />
  },
  {
    value: '#ec4899',
    label: 'Pink (粉紅)',
    badgeBg: '#be185d',
    badgeColor: '#fce7f3',
    icon: <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ec4899', display: 'inline-block', flexShrink: 0, boxShadow: '0 0 6px rgba(236, 72, 153, 0.8)' }} />
  },
  {
    value: '#fb923c',
    label: 'Orange (橙色)',
    badgeBg: '#c2410c',
    badgeColor: '#ffedd5',
    icon: <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#fb923c', display: 'inline-block', flexShrink: 0, boxShadow: '0 0 6px rgba(251, 146, 60, 0.8)' }} />
  },
  {
    value: '#64748b',
    label: 'Slate (預設灰藍)',
    badgeBg: '#334155',
    badgeColor: '#f1f5f9',
    icon: <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#64748b', display: 'inline-block', flexShrink: 0, boxShadow: '0 0 6px rgba(100, 116, 139, 0.8)' }} />
  },
];

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  project,
  items,
  members,
  products = [],
  onBack,
  onRefresh,
  onRefreshMembers,
  onItemClick
}) => {
  const [activeTab, setActiveTab] = useState<string>('traceability');
  const [showRightSidebar, setShowRightSidebar] = useState<boolean>(true);

  // 專案標題 inline edit 狀態
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(project.project_name);

  // 專案色彩狀態
  const [selectedColor, setSelectedColor] = useState<string>(project.project_attribute?.color || '#38bdf8');

  useEffect(() => {
    setTitleValue(project.project_name);
  }, [project.project_name]);

  useEffect(() => {
    setSelectedColor(project.project_attribute?.color || '#38bdf8');
  }, [project.project_attribute?.color]);

  const handleColorChange = async (newColor: string) => {
    setSelectedColor(newColor);
    try {
      await api.patchProject(project.project_uid, {
        project_attribute: {
          ...(project.project_attribute || {}),
          color: newColor
        }
      });
      await onRefresh();
    } catch (err: any) {
      console.error('Update project color error:', err);
      alert('更新專案顏色失敗: ' + err.message);
    }
  };

  const handleSaveTitle = async () => {
    if (!titleValue.trim()) return;
    try {
      await api.patchProject(project.project_uid, { project_name: titleValue.trim() });
      setEditingTitle(false);
      await onRefresh();
    } catch (err: any) {
      alert('更新專案名稱失敗: ' + err.message);
    }
  };

  const [editingDesc, setEditingDesc] = useState(false);
  const [descText, setDescText] = useState(project.project_content?.vision || '');

  // 範本管理狀態
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const templateMenuRef = useRef<HTMLDivElement>(null);

  // 產品清單狀態
  const [productsList, setProductsList] = useState<Project[]>(products);

  const loadProducts = async () => {
    try {
      const list = await api.getProjects({
        workspace_uid: project.related_workspace_uid,
        project_type: 'Product'
      });
      setProductsList(list);
    } catch (err) {
      console.error('載入產品清單失敗:', err);
    }
  };

  useEffect(() => {
    if (products && products.length > 0) {
      setProductsList(products);
    } else {
      loadProducts();
    }
  }, [products, project.related_workspace_uid]);

  // 載入範本列表
  const loadTemplates = async () => {
    try {
      const list = await api.getTemplates();
      setTemplates(list);
    } catch (err: any) {
      console.error('載入範本失敗:', err);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  // 點擊選單外部關閉
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target as Node)) {
        setIsTemplateMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // 套用範本至當前專案
  const handleApplyTemplate = async (template: Template) => {
    if (!confirm(`確定要將範本 [${template.template_name}] 套用至目前專案嗎？\n這將會即時建立該範本內定義的所有項目與階層結構。`)) {
      return;
    }
    setApplyingTemplate(true);
    setIsTemplateMenuOpen(false);
    try {
      const res = await api.applyTemplate(template.template_uid, project.project_uid);
      await onRefresh();
      alert(`成功套用範本！已新增 ${res.created_count || res.items?.length || 0} 個工單項目。`);
    } catch (err: any) {
      alert('套用範本失敗: ' + err.message);
    } finally {
      setApplyingTemplate(false);
    }
  };

  // 刪除範本
  const handleDeleteTemplate = async (e: React.MouseEvent, template: Template) => {
    e.stopPropagation();
    if (!confirm(`確定要刪除範本 [${template.template_name}] 嗎？此操作不可逆。`)) {
      return;
    }
    try {
      await api.deleteTemplate(template.template_uid);
      await loadTemplates();
    } catch (err: any) {
      alert('刪除範本失敗: ' + err.message);
    }
  };

  // 開啟編輯範本彈窗
  const handleOpenEditTemplate = (e: React.MouseEvent, template: Template) => {
    e.stopPropagation();
    setEditingTemplate(template);
    setIsTemplateModalOpen(true);
    setIsTemplateMenuOpen(false);
  };

  // 開啟新增範本彈窗
  const handleOpenCreateTemplate = () => {
    setEditingTemplate(null);
    setIsTemplateModalOpen(true);
    setIsTemplateMenuOpen(false);
  };

  // 儲存範本 (新增或更新)
  const handleSaveTemplate = async (name: string, schema: TemplateNode[]) => {
    if (editingTemplate) {
      await api.updateTemplate(editingTemplate.template_uid, {
        template_name: name,
        template_schema: schema
      });
    } else {
      await api.createTemplate({
        template_name: name,
        template_schema: schema
      });
    }
    await loadTemplates();
  };

  const projectItems = items.filter(i => i.related_project_uid === project.project_uid);

  const handleSaveDesc = async () => {
    try {
      await api.patchProject(project.project_uid, {
        project_content: { ...project.project_content, vision: descText }
      });
      setEditingDesc(false);
      await onRefresh();
    } catch (err: any) {
      alert('更新專案說明失敗: ' + err.message);
    }
  };

  const getCount = (type: string) => projectItems.filter(i => i.item_type === type).length;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#090d16',
      color: '#f8fafc',
      overflow: 'hidden'
    }}>
      {/* 1. 頂部返回導航條 (對齊 圖1 & 圖2) */}
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
            <ArrowLeft size={14} /> 返回專案分頁
          </button>
          <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 600 }}>
            Project 專案專頁
          </span>
          <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.95rem' }}>
            📁 {project.project_display_code}
          </span>
        </div>

        {/* 頂部右側動作區：新建範本下拉選單 (對齊 圖1: 新建 ▼) + 關閉按鈕 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* 範本新建下拉選單 (對齊 圖1) */}
          <div style={{ position: 'relative' }} ref={templateMenuRef}>
            <button
              onClick={() => setIsTemplateMenuOpen(!isTemplateMenuOpen)}
              disabled={applyingTemplate}
              style={{
                padding: '7px 16px',
                backgroundColor: '#5b5cf6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: applyingTemplate ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 10px rgba(91, 92, 246, 0.4)',
                transition: 'all 0.15s ease'
              }}
            >
              {applyingTemplate ? '套用中...' : '新建 ▼'}
            </button>

            {/* 下拉選單彈窗 (對齊 圖1) */}
            {isTemplateMenuOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '260px',
                backgroundColor: '#131b2e',
                border: '1px solid #2a3854',
                borderRadius: '10px',
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6)',
                zIndex: 100,
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {/* 選單標題 (對齊 圖1: 範本 · 用於 project) */}
                <div style={{
                  fontSize: '0.8rem',
                  color: '#94a3b8',
                  paddingBottom: '8px',
                  borderBottom: '1px solid #1e293b',
                  fontWeight: 500
                }}>
                  範本 · 用於 project
                </div>

                {/* 既有範本列表 (對齊 圖1: 📄 Trial template ✏️ 🗑️) */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {templates.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: '#64748b', padding: '8px 4px', textAlign: 'center' }}>
                      尚未建立範本
                    </div>
                  ) : (
                    templates.map((tpl) => (
                      <div
                        key={tpl.template_uid}
                        onClick={() => handleApplyTemplate(tpl)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          backgroundColor: '#090d16',
                          border: '1px solid #1e293b',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1e293b')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#090d16')}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          color: '#f8fafc',
                          fontSize: '0.85rem',
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1
                        }}>
                          <span style={{ fontSize: '1rem' }}>📄</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{tpl.template_name}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <button
                            type="button"
                            title="編輯範本"
                            onClick={(e) => handleOpenEditTemplate(e, tpl)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '2px',
                              fontSize: '0.9rem',
                              opacity: 0.8
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.8')}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            title="刪除範本"
                            onClick={(e) => handleDeleteTemplate(e, tpl)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '2px',
                              fontSize: '0.9rem',
                              opacity: 0.8
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.8')}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* 底部新增範本連結 (對齊 圖1: + 新增範本) */}
                <div
                  onClick={handleOpenCreateTemplate}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#06b6d4',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '8px 4px 4px 4px',
                    borderTop: '1px solid #1e293b',
                    transition: 'color 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#22d3ee')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#06b6d4')}
                >
                  <Plus size={15} />
                  新增範本
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowRightSidebar(!showRightSidebar)}
            style={{
              padding: '6px 12px',
              backgroundColor: showRightSidebar ? '#1e293b' : '#0f172a',
              color: showRightSidebar ? '#93c5fd' : '#94a3b8',
              border: showRightSidebar ? '1px solid #3b82f6' : '1px solid #334155',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title={showRightSidebar ? '隱藏專案屬性側欄 (收合)' : '顯示專案屬性側欄 (展開)'}
          >
            {showRightSidebar ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
            <span>{showRightSidebar ? '隱藏側欄' : '顯示側欄'}</span>
          </button>

          <button
            onClick={onBack}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
            title="關閉返回總表"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 範本編輯彈窗 (對齊 圖2) */}
      <TemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onSave={handleSaveTemplate}
        initialTemplate={editingTemplate}
      />

      {/* 2. 主視圖區塊 (左側大內容 + 右側專案資訊屬性欄，對齊 圖2) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左側主面板 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px 20px' }}>
          {/* 精簡標題列 */}
          <div style={{ marginBottom: '10px', flexShrink: 0 }}>
            {editingTitle ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  autoFocus
                  type="text"
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') {
                      setTitleValue(project.project_name);
                      setEditingTitle(false);
                    }
                  }}
                  style={{
                    fontSize: '1.3rem',
                    fontWeight: 700,
                    color: '#f8fafc',
                    backgroundColor: '#0f172a',
                    border: '1px solid #3b82f6',
                    borderRadius: '6px',
                    padding: '3px 10px',
                    outline: 'none',
                    minWidth: '280px',
                    maxWidth: '520px'
                  }}
                />
                <button
                  onClick={handleSaveTitle}
                  style={{ padding: '5px 8px', background: '#16a34a', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center' }}
                  title="儲存"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => {
                    setTitleValue(project.project_name);
                    setEditingTitle(false);
                  }}
                  style={{ padding: '5px 8px', background: '#334155', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  title="取消"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <h1
                onClick={() => setEditingTitle(true)}
                style={{
                  margin: 0,
                  fontSize: '1.35rem',
                  fontWeight: 700,
                  color: '#f8fafc',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: '6px',
                  padding: '2px 6px',
                  marginLeft: '-6px',
                  transition: 'background-color 0.15s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#131b2e')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                title="點擊就地編輯標題"
              >
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: selectedColor,
                  boxShadow: `0 0 8px ${selectedColor}80`,
                  flexShrink: 0
                }} />
                <span>{project.project_name}</span>
              </h1>
            )}
          </div>

          {/* 3. 精緻微型分頁導航條 (Compact Tab Pills) */}
          <div style={{
            display: 'flex',
            gap: '5px',
            flexWrap: 'wrap',
            alignItems: 'center',
            borderBottom: '1px solid #1e293b',
            paddingBottom: '8px',
            marginBottom: '10px',
            flexShrink: 0
          }}>
            <button
              onClick={() => setActiveTab('traceability')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: activeTab === 'traceability' ? '1px solid #3b82f6' : '1px solid rgba(51, 65, 85, 0.4)',
                backgroundColor: activeTab === 'traceability' ? 'rgba(59, 130, 246, 0.18)' : 'rgba(30, 41, 59, 0.35)',
                color: activeTab === 'traceability' ? '#60a5fa' : '#94a3b8',
                fontSize: '0.78rem',
                fontWeight: activeTab === 'traceability' ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s'
              }}
            >
              🔗 Requirement Traceability
            </button>

            <button
              onClick={() => setActiveTab('deployment')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: activeTab === 'deployment' ? '1px solid #3b82f6' : '1px solid rgba(51, 65, 85, 0.4)',
                backgroundColor: activeTab === 'deployment' ? 'rgba(59, 130, 246, 0.18)' : 'rgba(30, 41, 59, 0.35)',
                color: activeTab === 'deployment' ? '#60a5fa' : '#94a3b8',
                fontSize: '0.78rem',
                fontWeight: activeTab === 'deployment' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              🚀 Update & Deployment ({getCount('Deployment')})
            </button>

            <button
              onClick={() => setActiveTab('charter')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: activeTab === 'charter' ? '1px solid #3b82f6' : '1px solid rgba(51, 65, 85, 0.4)',
                backgroundColor: activeTab === 'charter' ? 'rgba(59, 130, 246, 0.18)' : 'rgba(30, 41, 59, 0.35)',
                color: activeTab === 'charter' ? '#60a5fa' : '#94a3b8',
                fontSize: '0.78rem',
                fontWeight: activeTab === 'charter' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              📜 專案章程 ({getCount('Charter')})
            </button>

            <button
              onClick={() => setActiveTab('milestone')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: activeTab === 'milestone' ? '1px solid #3b82f6' : '1px solid rgba(51, 65, 85, 0.4)',
                backgroundColor: activeTab === 'milestone' ? 'rgba(59, 130, 246, 0.18)' : 'rgba(30, 41, 59, 0.35)',
                color: activeTab === 'milestone' ? '#60a5fa' : '#94a3b8',
                fontSize: '0.78rem',
                fontWeight: activeTab === 'milestone' ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s'
              }}
            >
              🚩 專案里程碑 ({getCount('Milestone')})
            </button>

            <button
              onClick={() => setActiveTab('task')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: activeTab === 'task' ? '1px solid #3b82f6' : '1px solid rgba(51, 65, 85, 0.4)',
                backgroundColor: activeTab === 'task' ? 'rgba(59, 130, 246, 0.18)' : 'rgba(30, 41, 59, 0.35)',
                color: activeTab === 'task' ? '#60a5fa' : '#94a3b8',
                fontSize: '0.78rem',
                fontWeight: activeTab === 'task' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              📋 任務 ({getCount('Task')})
            </button>

            <button
              onClick={() => setActiveTab('information')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: activeTab === 'information' ? '1px solid #3b82f6' : '1px solid rgba(51, 65, 85, 0.4)',
                backgroundColor: activeTab === 'information' ? 'rgba(59, 130, 246, 0.18)' : 'rgba(30, 41, 59, 0.35)',
                color: activeTab === 'information' ? '#60a5fa' : '#94a3b8',
                fontSize: '0.78rem',
                fontWeight: activeTab === 'information' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              ℹ️ 資訊 ({getCount('Information')})
            </button>

            <button
              onClick={() => setActiveTab('meeting')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: activeTab === 'meeting' ? '1px solid #3b82f6' : '1px solid rgba(51, 65, 85, 0.4)',
                backgroundColor: activeTab === 'meeting' ? 'rgba(59, 130, 246, 0.18)' : 'rgba(30, 41, 59, 0.35)',
                color: activeTab === 'meeting' ? '#60a5fa' : '#94a3b8',
                fontSize: '0.78rem',
                fontWeight: activeTab === 'meeting' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              📅 會議 ({getCount('Meeting')})
            </button>

            <button
              onClick={() => setActiveTab('bottleneck')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: activeTab === 'bottleneck' ? '1px solid #3b82f6' : '1px solid rgba(51, 65, 85, 0.4)',
                backgroundColor: activeTab === 'bottleneck' ? 'rgba(59, 130, 246, 0.18)' : 'rgba(30, 41, 59, 0.35)',
                color: activeTab === 'bottleneck' ? '#60a5fa' : '#94a3b8',
                fontSize: '0.78rem',
                fontWeight: activeTab === 'bottleneck' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              ⚠️ 阻礙 ({getCount('Bottleneck')})
            </button>

            <button
              onClick={() => setActiveTab('decision')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: activeTab === 'decision' ? '1px solid #3b82f6' : '1px solid rgba(51, 65, 85, 0.4)',
                backgroundColor: activeTab === 'decision' ? 'rgba(59, 130, 246, 0.18)' : 'rgba(30, 41, 59, 0.35)',
                color: activeTab === 'decision' ? '#60a5fa' : '#94a3b8',
                fontSize: '0.78rem',
                fontWeight: activeTab === 'decision' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              💡 決策 ({getCount('Decision')})
            </button>
          </div>

          {/* 4. Tab 內容渲染 */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {activeTab === 'traceability' ? (
              <TraceabilityMatrix
                items={projectItems}
                members={members}
                onRefresh={onRefresh}
                onItemClick={onItemClick}
                projectId={project.project_uid}
                hideTopAddButton={true}
                projectColor={selectedColor}
              />
            ) : activeTab === 'deployment' ? (
              <DeploymentTraceabilityMatrix
                items={projectItems}
                members={members}
                onRefresh={onRefresh}
                onItemClick={onItemClick}
                projectId={project.project_uid}
                hideTopAddButton={true}
                projectColor={selectedColor}
              />
            ) : activeTab === 'milestone' ? (
              <MilestoneRaciTable
                items={projectItems}
                project={project}
                members={members}
                onRefresh={onRefresh}
                onItemClick={onItemClick}
                hideTopAddButton={true}
              />
            ) : (
              <AdvancedTable
                title={
                  activeTab === 'charter' ? '專案章程列表 (Charters)' :
                  activeTab === 'task' ? '任務工單清單 (Tasks)' :
                  activeTab === 'information' ? '專案資訊清單 (Information)' :
                  activeTab === 'meeting' ? '專案會議紀錄 (Meetings)' :
                  activeTab === 'bottleneck' ? '阻塞阻礙事項 (Bottlenecks)' : '架構決策日誌 (Decisions)'
                }
                items={projectItems.filter(i => {
                  if (activeTab === 'charter') return i.item_type === 'Charter';
                  if (activeTab === 'task') return i.item_type === 'Task';
                  if (activeTab === 'information') return i.item_type === 'Information';
                  if (activeTab === 'meeting') return i.item_type === 'Meeting';
                  if (activeTab === 'bottleneck') return i.item_type === 'Bottleneck';
                  if (activeTab === 'decision') return i.item_type === 'Decision';
                  return true;
                })}
                projects={[project]}
                members={members}
                onRefresh={onRefresh}
                onItemClick={onItemClick}
                hideTopAddButton={true}
              />
            )}
          </div>
        </div>

        {/* 右側專案屬性欄 (對齊 圖2 右側側欄，支援摺疊) */}
        <div style={{
          width: showRightSidebar ? '290px' : '0px',
          minWidth: showRightSidebar ? '290px' : '0px',
          opacity: showRightSidebar ? 1 : 0,
          pointerEvents: showRightSidebar ? 'auto' : 'none',
          backgroundColor: '#0f172a',
          borderLeft: showRightSidebar ? '1px solid #1e293b' : 'none',
          padding: showRightSidebar ? '20px' : '0px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflowY: 'auto',
          overflowX: 'hidden',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          boxSizing: 'border-box'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
              專案狀態 (Status)
            </label>
            <CustomSelect
              value={project.project_status}
              style={{ width: '100%' }}
              options={[
                { value: 'Pipeline', label: 'Pipeline', badgeBg: '#1e293b', badgeColor: '#cbd5e1' },
                { value: 'Active', label: 'Active', badgeBg: '#1e3a8a', badgeColor: '#93c5fd' },
                { value: 'On Hold', label: 'On Hold', badgeBg: '#78350f', badgeColor: '#fde68a' },
                { value: 'Completed', label: 'Completed', badgeBg: '#064e3b', badgeColor: '#6ee7b7' },
                { value: 'Abandoned', label: 'Abandoned', badgeBg: '#334155', badgeColor: '#94a3b8' }
              ]}
              onChange={async (newStatus) => {
                await api.patchProject(project.project_uid, { project_status: newStatus as any });
                await onRefresh();
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
              專案色彩 (Project Color)
            </label>
            <CustomSelect
              value={selectedColor}
              options={PROJECT_COLOR_OPTIONS}
              style={{ width: '100%' }}
              onChange={handleColorChange}
            />
          </div>

          {/* 專案詳細說明 (Description / Vision) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                詳細說明 (Description)
              </label>
              {!editingDesc && (
                <button
                  onClick={() => setEditingDesc(true)}
                  style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '0.72rem', cursor: 'pointer', padding: 0 }}
                >
                  編輯
                </button>
              )}
            </div>

            {editingDesc ? (
              <div>
                <textarea
                  rows={4}
                  autoFocus
                  value={descText}
                  onChange={(e) => setDescText(e.target.value)}
                  placeholder="輸入專案目標、願景或說明..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    backgroundColor: '#090d16',
                    border: '1px solid #3b82f6',
                    borderRadius: '6px',
                    color: '#fff',
                    boxSizing: 'border-box',
                    fontSize: '0.82rem',
                    lineHeight: 1.45,
                    resize: 'vertical'
                  }}
                />
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <button
                    onClick={handleSaveDesc}
                    style={{ padding: '4px 10px', background: '#16a34a', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}
                  >
                    儲存
                  </button>
                  <button
                    onClick={() => {
                      setDescText(project.project_content?.vision || '');
                      setEditingDesc(false);
                    }}
                    style={{ padding: '4px 10px', background: '#334155', border: 'none', borderRadius: '4px', color: '#cbd5e1', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => setEditingDesc(true)}
                style={{
                  padding: '8px 10px',
                  backgroundColor: '#131b2e',
                  border: '1px solid #1e293b',
                  borderRadius: '6px',
                  color: descText ? '#cbd5e1' : '#64748b',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  minHeight: '44px',
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  transition: 'border-color 0.15s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#334155')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1e293b')}
                title="點擊編輯說明"
              >
                {descText || '點擊新增專案願景與說明...'}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
              專案負責人 (Owner)
            </label>
            <MemberSelect
              value={project.project_owner || ''}
              members={members}
              style={{ width: '100%' }}
              onChange={async (uid) => {
                await api.patchProject(project.project_uid, { project_owner: uid ? uid : undefined });
                await onRefresh();
              }}
              onRefreshMembers={onRefreshMembers}
              placeholder="-- 未指定 --"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
              關聯產品 (Parent Product)
            </label>
            <ProductSelect
              value={project.parent_project_uid || ''}
              products={productsList}
              workspaceUid={project.related_workspace_uid}
              style={{ width: '100%' }}
              onChange={async (prodUid) => {
                await api.patchProject(project.project_uid, { parent_project_uid: prodUid ? prodUid : null as any });
                await onRefresh();
              }}
              onRefreshProducts={loadProducts}
              placeholder="-- 未關聯產品 (None) --"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
              Access Member
            </label>
            <AccessMemberSelect
              allowAccessMembers={project.allow_access_member || []}
              members={members}
              onChange={async (newMembers) => {
                await api.patchProject(project.project_uid, { allow_access_member: newMembers as any });
                await onRefresh();
              }}
              onRefreshMembers={onRefreshMembers}
              placeholder="+ 指派 Access Member..."
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
              計劃開始日期
            </label>
            <input
              type="date"
              value={project.planned_start_date ? project.planned_start_date.split('T')[0] : ''}
              onChange={async (e) => {
                await api.patchProject(project.project_uid, {
                  planned_start_date: e.target.value ? e.target.value : null as any
                });
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
                outline: 'none',
                cursor: 'pointer',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
              計劃結束日期
            </label>
            <input
              type="date"
              value={project.planned_end_date ? project.planned_end_date.split('T')[0] : ''}
              onChange={async (e) => {
                await api.patchProject(project.project_uid, {
                  planned_end_date: e.target.value ? e.target.value : null as any
                });
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
                outline: 'none',
                cursor: 'pointer',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginTop: 'auto', borderTop: '1px solid #1e293b', paddingTop: '16px', fontSize: '0.75rem', color: '#64748b' }}>
            <div>建立時間: {new Date(project.created_at).toLocaleDateString()}</div>
            <div>更新時間: {new Date(project.updated_at).toLocaleDateString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
