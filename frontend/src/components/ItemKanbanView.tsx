import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Check } from 'lucide-react';
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

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

  const activeColumns = ALL_KANBAN_COLUMNS.filter(c => visibleStatusIds.includes(c.id));

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden'
    }}>
      {/* 看板上方操作控制列 (含 3-dot 欄位顯示開關選單) */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: '8px 20px 4px 20px',
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
              padding: '4px 10px',
              backgroundColor: isMenuOpen ? '#1e293b' : '#131b2e',
              border: isMenuOpen ? '1px solid #38bdf8' : '1px solid #23304a',
              borderRadius: '6px',
              color: '#94a3b8',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f8fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.color = isMenuOpen ? '#38bdf8' : '#94a3b8')}
            title="自訂顯示的狀態欄位"
          >
            <MoreHorizontal size={15} />
            <span>自訂欄位 ({activeColumns.length}/{ALL_KANBAN_COLUMNS.length})</span>
          </button>

          {isMenuOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              right: 0,
              zIndex: 100,
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

      {/* 看板大欄容器（寬度較窄：220px） */}
      <div style={{
        flex: 1,
        display: 'flex',
        gap: '12px',
        padding: '6px 20px 16px 20px',
        overflowX: 'auto',
        overflowY: 'hidden',
        boxSizing: 'border-box'
      }}>
        {activeColumns.map(col => {
          const colItems = items.filter(i => (i.item_status || 'Not Start') === col.id);
          const isOver = dragOverColumn === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={() => {
                if (dragOverColumn === col.id) setDragOverColumn(null);
              }}
              onDrop={(e) => handleDrop(e, col.id)}
              style={{
                flex: '0 0 220px',
                backgroundColor: isOver ? 'rgba(30, 41, 59, 0.8)' : '#0c1222',
                borderRadius: '10px',
                border: isOver ? '1px dashed #38bdf8' : '1px solid #1e293b',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '100%',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                transition: 'background-color 0.15s, border-color 0.15s'
              }}
            >
              {/* Column Header */}
              <div style={{
                padding: '10px 12px',
                borderBottom: '1px solid #1e293b',
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
              </div>

              {/* Column Cards Container */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '10px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {colItems.length === 0 ? (
                  <div style={{
                    padding: '24px 8px',
                    textAlign: 'center',
                    color: '#475569',
                    fontSize: '0.76rem',
                    border: '1px dashed #1e293b',
                    borderRadius: '6px'
                  }}>
                    拖曳工單至此
                  </div>
                ) : (
                  colItems.map(item => {
                    const itemProject = projects.find(p => p.project_uid === item.related_project_uid);
                    const projectColor = itemProject?.project_attribute?.color;
                    const projectName = item.project_name || itemProject?.project_name;

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
                        padding: '10px',
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
                      {/* Top Row: Type tag & Code */}
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

                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          padding: '1px 5px',
                          borderRadius: '3px',
                          backgroundColor: '#1e293b',
                          color: '#cbd5e1'
                        }}>
                          {item.item_type}
                        </span>
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
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: projectColor || '#94a3b8',
                          backgroundColor: projectColor ? `${projectColor}18` : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${projectColor ? `${projectColor}40` : '#243049'}`,
                          padding: '2px 7px',
                          borderRadius: '4px',
                          width: 'fit-content',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
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
  );
};
