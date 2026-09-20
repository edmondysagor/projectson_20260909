import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Check, Plus, X, ChevronDown } from 'lucide-react';
import { api } from '../utils/api';
import type { ProjectItem, Member, Project } from '../utils/api';
import { MemberSelect } from './MemberSelect';

interface ItemKanbanViewProps {
  items: ProjectItem[];
  members: Member[];
  projects?: Project[];
  onRefresh: () => Promise<void>;
  onItemClick: (item: ProjectItem) => void;
}

const ALL_KANBAN_COLUMNS = [
  { id: 'Not Start', title: 'Not Start', color: '#94a3b8' },
  { id: 'Ready', title: 'Ready', color: '#93c5fd' },
  { id: 'In Progress', title: 'In Progress', color: '#60a5fa' },
  { id: 'Review', title: 'Review', color: '#d8b4fe' },
  { id: 'Blocked', title: 'Blocked', color: '#fca5a5' },
  { id: 'Completed', title: 'Completed', color: '#6ee7b7' },
  { id: 'Backlog', title: 'Backlog', color: '#cbd5e1' },
  { id: 'Closed', title: 'Closed', color: '#64748b' }
];

const ITEM_TYPE_OPTIONS: Array<{ value: string; label: string; icon: string; bg: string; color: string }> = [
  { value: 'Task', label: 'Task', icon: '📝', bg: '#1e293b', color: '#cbd5e1' },
  { value: 'Requirement', label: 'Requirement', icon: '📋', bg: '#1e3a8a', color: '#93c5fd' },
  { value: 'User story', label: 'User story', icon: '👤', bg: '#4c1d95', color: '#c4b5fd' },
  { value: 'Objective', label: 'Objective', icon: '🎯', bg: '#064e3b', color: '#6ee7b7' },
  { value: 'Information', label: 'Information', icon: 'ℹ️', bg: '#075985', color: '#38bdf8' },
  { value: 'Charter', label: 'Charter', icon: '📜', bg: '#312e81', color: '#a5b4fc' },
  { value: 'Epic', label: 'Epic', icon: '⚡', bg: '#3b0764', color: '#d8b4fe' },
  { value: 'Meeting', label: 'Meeting', icon: '📅', bg: '#134e4a', color: '#5eead4' },
  { value: 'Bottleneck', label: 'Bottleneck', icon: '⚠️', bg: '#450a0a', color: '#fca5a5' },
  { value: 'Decision', label: 'Decision', icon: '💡', bg: '#78350f', color: '#fde68a' },
  { value: 'UAT', label: 'UAT', icon: '🧪', bg: '#155e75', color: '#67e8f9' },
  { value: 'Deployment', label: 'Deployment', icon: '🚀', bg: '#7c2d12', color: '#fdba74' },
  { value: 'Milestone', label: 'Milestone', icon: '🚩', bg: '#064e3b', color: '#34d399' },
];

export const ItemKanbanView: React.FC<ItemKanbanViewProps> = ({
  items,
  members,
  projects = [],
  onRefresh,
  onItemClick
}) => {
  const [draggedUid, setDraggedUid] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // 狀態欄位顯示控制 (3-dot menu)，預設全部顯示
  const [visibleStatusIds, setVisibleStatusIds] = useState<string[]>(ALL_KANBAN_COLUMNS.map(c => c.id));
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // [+] 欄位快速新增工單狀態
  const [addingInColumnStatus, setAddingInColumnStatus] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('Task');
  const [newProjectId, setNewProjectId] = useState<string>(projects[0]?.project_uid || '');
  const [isCreating, setIsCreating] = useState(false);

  // Type 下拉選單編輯浮動彈窗
  const [activeTypeMenu, setActiveTypeMenu] = useState<{
    itemUid: string;
    currentType: string;
    top: number;
    left: number;
  } | null>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (projects.length > 0 && !newProjectId) {
      setNewProjectId(projects[0].project_uid);
    }
  }, [projects, newProjectId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
      if (typeMenuRef.current && !typeMenuRef.current.contains(e.target as Node)) {
        setActiveTypeMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleColumnVisibility = (colId: string) => {
    if (visibleStatusIds.includes(colId)) {
      if (visibleStatusIds.length > 1) {
        setVisibleStatusIds(visibleStatusIds.filter(id => id !== colId));
      }
    } else {
      setVisibleStatusIds([...visibleStatusIds, colId]);
    }
  };

  const handleDragStart = (e: React.DragEvent, uid: string) => {
    e.dataTransfer.setData('text/plain', uid);
    setDraggedUid(uid);
  };

  const handleDragOver = (e: React.DragEvent, statusId: string) => {
    e.preventDefault();
    if (dragOverColumn !== statusId) {
      setDragOverColumn(statusId);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const itemUid = e.dataTransfer.getData('text/plain') || draggedUid;
    if (!itemUid) return;

    const targetItem = items.find(i => i.item_uid === itemUid);
    if (targetItem && targetItem.item_status !== targetStatus) {
      try {
        await api.patchItem(itemUid, { item_status: targetStatus });
        await onRefresh();
      } catch (err: any) {
        alert('變更狀態失敗: ' + err.message);
      }
    }
    setDraggedUid(null);
  };

  // 處理在指定 status 欄位快速新增工單
  const handleQuickCreateInStatus = async (statusId: string) => {
    if (!newTitle.trim()) return;
    const targetProjectUid = newProjectId || projects[0]?.project_uid;
    if (!targetProjectUid) {
      alert('請先建立或關聯至少一個 Project');
      return;
    }

    setIsCreating(true);
    try {
      await api.createItem({
        item_title: newTitle.trim(),
        item_type: newType,
        related_project_uid: targetProjectUid,
        item_status: statusId,
        item_priority: 'Middle'
      });
      setNewTitle('');
      setAddingInColumnStatus(null);
      await onRefresh();
    } catch (err: any) {
      alert('新增失敗: ' + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  // 打開 Type 下拉彈窗
  const handleOpenTypeMenu = (e: React.MouseEvent, item: ProjectItem) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 140;
    const leftPos = Math.min(rect.left, window.innerWidth - menuWidth - 10);
    const topPos = rect.bottom + 4 > window.innerHeight - 260 ? rect.top - 260 : rect.bottom + 4;

    setActiveTypeMenu({
      itemUid: item.item_uid,
      currentType: item.item_type || 'Task',
      top: Math.max(10, topPos),
      left: Math.max(10, leftPos)
    });
  };

  // 變更 Type
  const handleTypeChange = async (e: React.MouseEvent, itemUid: string, newTypeVal: string) => {
    e.stopPropagation();
    setActiveTypeMenu(null);
    try {
      await api.patchItem(itemUid, { item_type: newTypeVal });
      await onRefresh();
    } catch (err: any) {
      alert('變更類型失敗: ' + err.message);
    }
  };

  const activeColumns = ALL_KANBAN_COLUMNS.filter(c => visibleStatusIds.includes(c.id));

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* 看板上方操作控制列 (含 3-dot 欄位顯示開關選單) */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: '6px 20px 4px 20px',
        flexShrink: 0
      }}>
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              backgroundColor: isMenuOpen ? '#1e293b' : '#131b2e',
              border: isMenuOpen ? '1px solid #38bdf8' : '1px solid #23304a',
              borderRadius: '6px',
              color: '#94a3b8',
              fontSize: '0.76rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f8fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.color = isMenuOpen ? '#38bdf8' : '#94a3b8')}
            title="自訂顯示的狀態欄位"
          >
            <MoreHorizontal size={14} />
            <span>自訂欄位 ({activeColumns.length}/{ALL_KANBAN_COLUMNS.length})</span>
          </button>

          {isMenuOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              right: 0,
              zIndex: 1000,
              width: '200px',
              backgroundColor: '#0c1222',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}>
              <div style={{
                padding: '4px 8px',
                fontSize: '0.72rem',
                color: '#64748b',
                fontWeight: 600,
                textTransform: 'uppercase'
              }}>
                顯示 / 隱藏狀態欄位
              </div>
              <div style={{ height: '1px', backgroundColor: '#1e293b', margin: '2px 0 4px 0' }} />
              {ALL_KANBAN_COLUMNS.map(col => {
                const isVisible = visibleStatusIds.includes(col.id);
                return (
                  <div
                    key={col.id}
                    onClick={() => toggleColumnVisibility(col.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: isVisible ? 600 : 400,
                      color: isVisible ? '#f8fafc' : '#64748b',
                      backgroundColor: isVisible ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      if (!isVisible) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isVisible) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => {}}
                        style={{ cursor: 'pointer', accentColor: '#38bdf8' }}
                      />
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: col.color }} />
                      <span>{col.title}</span>
                    </div>
                    {isVisible && <Check size={13} color="#38bdf8" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 看板全域統一捲動容器 (水平與垂直同步捲動，頂部狀態欄 Sticky 凍結，全欄位滿版響應拖曳) */}
      <div 
        onDragOver={(e) => {
          e.preventDefault();
          // 透過 X 軸座標即時命中判斷當前懸停在哪一欄 (Lane Hit-Testing)
          const colEls = document.querySelectorAll('[data-kanban-col-id]');
          for (const el of Array.from(colEls)) {
            const rect = el.getBoundingClientRect();
            if (e.clientX >= rect.left - 6 && e.clientX <= rect.right + 6) {
              const colId = el.getAttribute('data-kanban-col-id');
              if (colId && dragOverColumn !== colId) {
                setDragOverColumn(colId);
              }
              return;
            }
          }
        }}
        onDragLeave={() => {
          setDragOverColumn(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          // 透過 X 軸座標精準判定放置至目標狀態欄
          const colEls = document.querySelectorAll('[data-kanban-col-id]');
          for (const el of Array.from(colEls)) {
            const rect = el.getBoundingClientRect();
            if (e.clientX >= rect.left - 6 && e.clientX <= rect.right + 6) {
              const colId = el.getAttribute('data-kanban-col-id');
              if (colId) {
                handleDrop(e, colId);
                return;
              }
            }
          }
          setDragOverColumn(null);
        }}
        style={{
          flex: 1,
          overflowX: 'auto',
          overflowY: 'auto',
          padding: '0 20px 20px 20px',
          boxSizing: 'border-box'
        }}
      >
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'stretch',
          minHeight: '100%',
          width: 'fit-content'
        }}>
          {activeColumns.map(col => {
            const colItems = items.filter(i => (i.item_status || 'Not Start') === col.id);
            const isOver = dragOverColumn === col.id;
            const isAddingHere = addingInColumnStatus === col.id;

            return (
              <div
                key={col.id}
                data-kanban-col-id={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={() => {
                  if (dragOverColumn === col.id) setDragOverColumn(null);
                }}
                onDrop={(e) => handleDrop(e, col.id)}
                style={{
                  width: '230px',
                  minWidth: '230px',
                  backgroundColor: isOver ? 'rgba(30, 41, 59, 0.8)' : '#0c1222',
                  borderRadius: '10px',
                  border: isOver ? '1px dashed #38bdf8' : '1px solid #1e293b',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  transition: 'background-color 0.15s, border-color 0.15s',
                  position: 'relative',
                  alignSelf: 'stretch'
                }}
              >
                {/* Column Header (Sticky Frozen at the top!) */}
                <div style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 20,
                  backgroundColor: '#0c1222',
                  padding: '10px 12px',
                  borderBottom: '1px solid #1e293b',
                  borderTopLeftRadius: '10px',
                  borderTopRightRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: col.color }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>
                      {col.title}
                    </span>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      backgroundColor: '#1e293b',
                      color: '#94a3b8',
                      padding: '1px 6px',
                      borderRadius: '8px'
                    }}>
                      {colItems.length}
                    </span>
                  </div>

                  {/* [+] 在此狀態新增工單按鈕 */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isAddingHere) {
                        setAddingInColumnStatus(null);
                      } else {
                        setAddingInColumnStatus(col.id);
                        setNewTitle('');
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '22px',
                      height: '22px',
                      backgroundColor: isAddingHere ? '#ef4444' : 'rgba(56, 189, 248, 0.12)',
                      border: isAddingHere ? '1px solid #ef4444' : '1px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: '4px',
                      color: isAddingHere ? '#ffffff' : '#38bdf8',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    title={isAddingHere ? '取消新增' : `在「${col.title}」新增工單`}
                  >
                    {isAddingHere ? <X size={13} /> : <Plus size={13} />}
                  </button>
                </div>

                {/* Inline Quick Add Form inside Column */}
                {isAddingHere && (
                  <div style={{
                    padding: '8px',
                    margin: '8px 8px 0 8px',
                    backgroundColor: '#131b2e',
                    border: '1px solid #38bdf8',
                    borderRadius: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <input
                      autoFocus
                      type="text"
                      placeholder="輸入工單標題..."
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleQuickCreateInStatus(col.id);
                        if (e.key === 'Escape') setAddingInColumnStatus(null);
                      }}
                      style={{
                        padding: '5px 8px',
                        backgroundColor: '#090d16',
                        border: '1px solid #23304a',
                        borderRadius: '4px',
                        color: '#f8fafc',
                        fontSize: '0.78rem',
                        outline: 'none'
                      }}
                    />

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <select
                        value={newType}
                        onChange={(e) => setNewType(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '3px 4px',
                          backgroundColor: '#090d16',
                          border: '1px solid #23304a',
                          borderRadius: '4px',
                          color: '#94a3b8',
                          fontSize: '0.72rem',
                          outline: 'none'
                        }}
                      >
                        {ITEM_TYPE_OPTIONS.map(t => (
                          <option key={t.value} value={t.value}>
                            {t.icon} {t.label}
                          </option>
                        ))}
                      </select>

                      {projects.length > 1 && (
                        <select
                          value={newProjectId}
                          onChange={(e) => setNewProjectId(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '3px 4px',
                            backgroundColor: '#090d16',
                            border: '1px solid #23304a',
                            borderRadius: '4px',
                            color: '#94a3b8',
                            fontSize: '0.72rem',
                            outline: 'none'
                          }}
                        >
                          {projects.map(p => (
                            <option key={p.project_uid} value={p.project_uid}>
                              {p.project_name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', marginTop: '2px' }}>
                      <button
                        type="button"
                        onClick={() => setAddingInColumnStatus(null)}
                        style={{
                          padding: '3px 8px',
                          backgroundColor: '#1e293b',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#94a3b8',
                          fontSize: '0.72rem',
                          cursor: 'pointer'
                        }}
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        disabled={isCreating || !newTitle.trim()}
                        onClick={() => handleQuickCreateInStatus(col.id)}
                        style={{
                          padding: '3px 10px',
                          backgroundColor: '#2563eb',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#ffffff',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: isCreating || !newTitle.trim() ? 'not-allowed' : 'pointer',
                          opacity: isCreating || !newTitle.trim() ? 0.6 : 1
                        }}
                      >
                        {isCreating ? '建立中...' : '新增'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Column Cards Container */}
                <div style={{
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  minHeight: '120px',
                  flex: 1
                }}>
                  {colItems.length === 0 && !isAddingHere ? (
                    <div style={{
                      padding: '24px 8px',
                      textAlign: 'center',
                      color: '#475569',
                      fontSize: '0.74rem',
                      border: '1px dashed #1e293b',
                      borderRadius: '6px',
                      marginTop: '4px'
                    }}>
                      拖曳工單至此
                    </div>
                  ) : (
                    colItems.map(item => {
                      const itemProject = projects.find(p => p.project_uid === item.related_project_uid);
                      const projectColor = itemProject?.project_attribute?.color;
                      const projectName = item.project_name || itemProject?.project_name;
                      const typeConfig = ITEM_TYPE_OPTIONS.find(t => t.value === item.item_type) || {
                        value: item.item_type,
                        label: item.item_type,
                        icon: '📝',
                        bg: '#1e293b',
                        color: '#cbd5e1'
                      };

                      return (
                        <div
                          key={item.item_uid}
                          draggable
                          onDragStart={(e) => handleDragStart(e, item.item_uid)}
                          onDragEnd={() => setDraggedUid(null)}
                          style={{
                            backgroundColor: '#131b2e',
                            border: '1px solid #243049',
                            borderLeft: projectColor ? `4px solid ${projectColor}` : '1px solid #243049',
                            borderRadius: '6px',
                            padding: '8px 10px',
                            cursor: 'grab',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            transition: 'transform 0.15s, border-color 0.15s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = projectColor || '#38bdf8';
                            if (projectColor) e.currentTarget.style.borderLeftColor = projectColor;
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#243049';
                            if (projectColor) e.currentTarget.style.borderLeftColor = projectColor;
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          {/* Top Row: Type tag (Clickable dropdown) & Code */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                            <button
                              onClick={() => onItemClick(item)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#38bdf8',
                                fontWeight: 700,
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                padding: 0
                              }}
                            >
                              {item.item_display_code}
                            </button>

                            {/* Clickable Type Badge */}
                            <button
                              type="button"
                              onClick={(e) => handleOpenTypeMenu(e, item)}
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 600,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: typeConfig.bg,
                                border: `1px solid ${typeConfig.color}40`,
                                color: typeConfig.color,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                outline: 'none'
                              }}
                              title="點擊修改工單類型 (Type)"
                            >
                              <span>{typeConfig.icon}</span>
                              <span>{typeConfig.label}</span>
                              <ChevronDown size={10} style={{ opacity: 0.7 }} />
                            </button>
                          </div>

                          {/* Title */}
                          <div
                            onClick={() => onItemClick(item)}
                            style={{
                              fontSize: '0.8rem',
                              color: '#f8fafc',
                              fontWeight: 500,
                              lineHeight: 1.35,
                              cursor: 'pointer'
                            }}
                          >
                            {item.item_title}
                          </div>

                          {/* Project Name Badge with corresponding project color */}
                          {projectName && (
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              color: projectColor || '#94a3b8',
                              backgroundColor: projectColor ? `${projectColor}18` : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${projectColor ? `${projectColor}40` : '#243049'}`,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              width: 'fit-content',
                              maxWidth: '100%',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              <span style={{
                                width: '5px',
                                height: '5px',
                                borderRadius: '50%',
                                backgroundColor: projectColor || '#64748b',
                                boxShadow: projectColor ? `0 0 6px ${projectColor}99` : 'none',
                                flexShrink: 0
                              }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {projectName}
                              </span>
                            </div>
                          )}

                          {/* Bottom Row: Follow By & Date */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginTop: '2px',
                            paddingTop: '4px',
                            borderTop: '1px solid #1e293b'
                          }}>
                            <div onClick={(e) => e.stopPropagation()} style={{ flex: 1, minWidth: 0 }}>
                              <MemberSelect
                                value={item.item_follow_by || undefined}
                                members={members}
                                placeholder="未指派"
                                size="sm"
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
                                buttonStyle={{
                                  backgroundColor: 'transparent',
                                  border: 'none',
                                  padding: '1px 3px',
                                  color: item.follow_by_name ? '#94a3b8' : '#64748b',
                                  fontSize: '0.7rem',
                                  boxShadow: 'none',
                                  fontWeight: 500
                                }}
                              />
                            </div>

                            {item.item_planned_end_date && (
                              <span style={{ fontSize: '0.68rem', color: '#64748b', flexShrink: 0 }}>
                                📅 {item.item_planned_end_date.split('T')[0]}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top-Level Fixed Type Popup Menu (Never clipped by board or card borders) */}
      {activeTypeMenu && (
        <div
          ref={typeMenuRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: `${activeTypeMenu.top}px`,
            left: `${activeTypeMenu.left}px`,
            zIndex: 999999,
            backgroundColor: '#0c1222',
            border: '1px solid #2a3854',
            borderRadius: '8px',
            padding: '4px',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255,255,255,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            minWidth: '140px',
            maxHeight: '260px',
            overflowY: 'auto'
          }}
        >
          <div style={{
            fontSize: '0.68rem',
            color: '#64748b',
            fontWeight: 600,
            padding: '3px 6px',
            borderBottom: '1px solid #1e293b',
            marginBottom: '2px'
          }}>
            選擇工單類型
          </div>
          {ITEM_TYPE_OPTIONS.map(opt => {
            const isSelected = activeTypeMenu.currentType === opt.value;
            return (
              <div
                key={opt.value}
                onClick={(e) => handleTypeChange(e, activeTypeMenu.itemUid, opt.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 8px',
                  borderRadius: '4px',
                  fontSize: '0.74rem',
                  fontWeight: isSelected ? 700 : 500,
                  color: opt.color,
                  backgroundColor: isSelected ? opt.bg : 'transparent',
                  cursor: 'pointer',
                  transition: 'background-color 0.1s'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </div>
                {isSelected && <Check size={12} color={opt.color} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
