import React, { useState } from 'react';
import { api } from '../utils/api';
import type { ProjectItem, Member } from '../utils/api';
import { MemberSelect } from './MemberSelect';

interface ItemKanbanViewProps {
  items: ProjectItem[];
  members: Member[];
  onRefresh: () => Promise<void>;
  onItemClick: (item: ProjectItem) => void;
}

const KANBAN_COLUMNS = [
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
  onRefresh,
  onItemClick
}) => {
  const [draggedUid, setDraggedUid] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

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

  return (
    <div style={{
      display: 'flex',
      gap: '16px',
      padding: '16px 20px',
      height: '100%',
      overflowX: 'auto',
      overflowY: 'hidden',
      boxSizing: 'border-box'
    }}>
      {KANBAN_COLUMNS.map(col => {
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
              flex: '0 0 280px',
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
              padding: '12px 14px',
              borderBottom: '1px solid #1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: col.color }} />
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc' }}>
                  {col.title}
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  backgroundColor: '#1e293b',
                  color: '#94a3b8',
                  padding: '2px 7px',
                  borderRadius: '10px'
                }}>
                  {colItems.length}
                </span>
              </div>
            </div>

            {/* Column Cards Container */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {colItems.length === 0 ? (
                <div style={{
                  padding: '28px 12px',
                  textAlign: 'center',
                  color: '#475569',
                  fontSize: '0.8rem',
                  border: '1px dashed #1e293b',
                  borderRadius: '8px'
                }}>
                  拖曳工單至此狀態
                </div>
              ) : (
                colItems.map(item => (
                  <div
                    key={item.item_uid}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.item_uid)}
                    onDragEnd={() => setDraggedUid(null)}
                    style={{
                      backgroundColor: '#131b2e',
                      border: '1px solid #243049',
                      borderRadius: '8px',
                      padding: '12px',
                      cursor: 'grab',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      transition: 'transform 0.15s, border-color 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#38bdf8';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#243049';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Top Row: Type tag & Code */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <button
                        onClick={() => onItemClick(item)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#38bdf8',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        {item.item_display_code}
                      </button>

                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '4px',
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
                        fontSize: '0.85rem',
                        color: '#f8fafc',
                        fontWeight: 500,
                        lineHeight: 1.4,
                        cursor: 'pointer'
                      }}
                    >
                      {item.item_title}
                    </div>

                    {/* Project Name (if available) */}
                    {item.project_name && (
                      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                        📁 {item.project_name}
                      </div>
                    )}

                    {/* Bottom Row: Follow By & Date */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '4px',
                      paddingTop: '6px',
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
                            padding: '2px 4px',
                            color: item.follow_by_name ? '#94a3b8' : '#64748b',
                            fontSize: '0.74rem',
                            boxShadow: 'none',
                            fontWeight: 500
                          }}
                        />
                      </div>

                      {item.item_planned_end_date && (
                        <span style={{ fontSize: '0.72rem', color: '#64748b', flexShrink: 0 }}>
                          📅 {item.item_planned_end_date.split('T')[0]}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
