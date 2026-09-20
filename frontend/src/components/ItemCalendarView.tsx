import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Check } from 'lucide-react';
import { api } from '../utils/api';
import type { ProjectItem, Member } from '../utils/api';

interface ItemCalendarViewProps {
  items: ProjectItem[];
  members: Member[];
  onRefresh: () => Promise<void>;
  onItemClick: (item: ProjectItem) => void;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  'Not Start': { label: 'Not Start', bg: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8', border: 'rgba(100, 116, 139, 0.4)' },
  'Ready': { label: 'Ready', bg: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', border: 'rgba(59, 130, 246, 0.4)' },
  'In Progress': { label: 'In Progress', bg: 'rgba(37, 99, 235, 0.25)', color: '#60a5fa', border: 'rgba(59, 130, 246, 0.5)' },
  'Review': { label: 'Review', bg: 'rgba(147, 51, 234, 0.2)', color: '#d8b4fe', border: 'rgba(147, 51, 234, 0.4)' },
  'Blocked': { label: 'Blocked', bg: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: 'rgba(239, 68, 68, 0.4)' },
  'Completed': { label: 'Completed', bg: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', border: 'rgba(16, 185, 129, 0.4)' },
  'Closed': { label: 'Closed', bg: 'rgba(71, 85, 105, 0.2)', color: '#64748b', border: 'rgba(71, 85, 105, 0.4)' },
  'Backlog': { label: 'Backlog', bg: 'rgba(51, 65, 85, 0.2)', color: '#cbd5e1', border: 'rgba(51, 65, 85, 0.4)' }
};

const ALL_STATUS_KEYS = ['Not Start', 'Ready', 'In Progress', 'Review', 'Blocked', 'Completed', 'Closed', 'Backlog'];

export const ItemCalendarView: React.FC<ItemCalendarViewProps> = ({
  items,
  onRefresh,
  onItemClick
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [draggedUid, setDraggedUid] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [activeStatusMenu, setActiveStatusMenu] = useState<{
    itemUid: string;
    currentStatus: string;
    top: number;
    left: number;
  } | null>(null);
  const [isUpdatingDate, setIsUpdatingDate] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveStatusMenu(null);
      }
    };
    if (activeStatusMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeStatusMenu]);

  // Generate days for the month grid (5 weeks = 35 cells)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days = [];

    // Previous month padding
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthDays - i);
      days.push({ date: d, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true });
    }

    // Next month padding to complete exactly 35 grid cells (5 weeks)
    const remaining = 35 - days.length;
    if (remaining > 0) {
      for (let i = 1; i <= remaining; i++) {
        const d = new Date(year, month + 1, i);
        days.push({ date: d, isCurrentMonth: false });
      }
    } else if (days.length > 35) {
      days.splice(35);
    }

    return days;
  }, [year, month]);

  // Group items by date string (YYYY-MM-DD)
  const itemsByDate = useMemo(() => {
    const map: { [dateStr: string]: ProjectItem[] } = {};
    items.forEach(i => {
      const dateVal = i.item_planned_end_date || i.item_planned_start_date || i.created_at;
      if (dateVal) {
        const d = new Date(dateVal);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const key = `${yyyy}-${mm}-${dd}`;
        if (!map[key]) map[key] = [];
        map[key].push(i);
      }
    });
    return map;
  }, [items]);

  const monthNames = [
    '1 月 (January)', '2 月 (February)', '3 月 (March)', '4 月 (April)',
    '5 月 (May)', '6 月 (June)', '7 月 (July)', '8 月 (August)',
    '9 月 (September)', '10 月 (October)', '11 月 (November)', '12 月 (December)'
  ];

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  // Handle Drag & Drop to change planned end date
  const handleDropItem = async (itemUid: string, targetDateStr: string) => {
    try {
      setIsUpdatingDate(true);
      await api.patchItem(itemUid, { item_planned_end_date: targetDateStr });
      await onRefresh();
    } catch (err: any) {
      console.error('Failed to update planned end date:', err);
      alert('更新計劃日期失敗: ' + err.message);
    } finally {
      setIsUpdatingDate(false);
      setDraggedUid(null);
    }
  };

  // Handle opening status menu at top layer
  const handleOpenStatusMenu = (e: React.MouseEvent, item: ProjectItem) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 120;
    const leftPos = Math.min(rect.left, window.innerWidth - menuWidth - 10);
    const topPos = rect.bottom + 4 > window.innerHeight - 200 ? rect.top - 210 : rect.bottom + 4;

    setActiveStatusMenu({
      itemUid: item.item_uid,
      currentStatus: item.item_status || 'Not Start',
      top: topPos,
      left: Math.max(10, leftPos)
    });
  };

  // Handle inline status change
  const handleStatusChange = async (e: React.MouseEvent, itemUid: string, newStatus: string) => {
    e.stopPropagation();
    setActiveStatusMenu(null);
    try {
      await api.patchItem(itemUid, { item_status: newStatus as any });
      await onRefresh();
    } catch (err: any) {
      alert('更新狀態失敗: ' + err.message);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#090d16',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Calendar Header Navigation */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0c1222',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
            {year} 年 {monthNames[month]}
          </h2>
          <button
            onClick={handleToday}
            style={{
              padding: '3px 8px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#cbd5e1',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            今天 (Today)
          </button>
          {isUpdatingDate && (
            <span style={{ fontSize: '0.75rem', color: '#38bdf8' }}>正在更新排程...</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={handlePrevMonth}
            style={{
              padding: '5px',
              backgroundColor: '#131b2e',
              border: '1px solid #23304a',
              borderRadius: '6px',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={handleNextMonth}
            style={{
              padding: '5px',
              backgroundColor: '#131b2e',
              border: '1px solid #23304a',
              borderRadius: '6px',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Weekday Labels Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        borderBottom: '1px solid #1e293b',
        backgroundColor: '#0f172a',
        flexShrink: 0
      }}>
        {['日 (Sun)', '一 (Mon)', '二 (Tue)', '三 (Wed)', '四 (Thu)', '五 (Fri)', '六 (Sat)'].map((day, idx) => (
          <div
            key={idx}
            style={{
              padding: '6px',
              textAlign: 'center',
              fontSize: '0.74rem',
              fontWeight: 600,
              color: idx === 0 || idx === 6 ? '#94a3b8' : '#cbd5e1',
              borderRight: idx < 6 ? '1px solid #1e293b' : 'none'
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Month Days Grid (5 Weeks) */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gridTemplateRows: 'repeat(5, 1fr)',
        overflow: 'hidden'
      }}>
        {calendarDays.map((cell, idx) => {
          const y = cell.date.getFullYear();
          const m = String(cell.date.getMonth() + 1).padStart(2, '0');
          const d = String(cell.date.getDate()).padStart(2, '0');
          const dateStr = `${y}-${m}-${d}`;
          const isToday = dateStr === todayStr;
          const isDragTarget = dragOverDate === dateStr;
          const dayItems = itemsByDate[dateStr] || [];

          return (
            <div
              key={idx}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverDate !== dateStr) setDragOverDate(dateStr);
              }}
              onDragLeave={() => {
                if (dragOverDate === dateStr) setDragOverDate(null);
              }}
              onDrop={async (e) => {
                e.preventDefault();
                setDragOverDate(null);
                const itemUid = e.dataTransfer.getData('text/plain') || draggedUid;
                if (itemUid) {
                  await handleDropItem(itemUid, dateStr);
                }
              }}
              style={{
                borderRight: (idx + 1) % 7 !== 0 ? '1px solid #1e293b' : 'none',
                borderBottom: '1px solid #1e293b',
                padding: '4px',
                backgroundColor: isDragTarget
                  ? 'rgba(59, 130, 246, 0.18)'
                  : !cell.isCurrentMonth
                  ? '#090d16'
                  : isToday
                  ? 'rgba(56, 189, 248, 0.04)'
                  : '#0c1222',
                border: isDragTarget ? '1px dashed #38bdf8' : undefined,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative',
                transition: 'background-color 0.15s ease'
              }}
            >
              {/* Day Number Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px', flexShrink: 0 }}>
                <span style={{
                  fontSize: '0.76rem',
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? '#38bdf8' : cell.isCurrentMonth ? '#f8fafc' : '#475569',
                  width: isToday ? '18px' : 'auto',
                  height: isToday ? '18px' : 'auto',
                  borderRadius: isToday ? '50%' : 'none',
                  backgroundColor: isToday ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {cell.date.getDate()}
                </span>
                {dayItems.length > 0 && (
                  <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>
                    {dayItems.length} 個
                  </span>
                )}
              </div>

              {/* Day Items Container (Scrollable) */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  paddingRight: '2px'
                }}
              >
                {dayItems.map(item => {
                  const statusInfo = STATUS_CONFIG[item.item_status] || {
                    label: item.item_status || 'Not Start',
                    bg: 'rgba(100, 116, 139, 0.2)',
                    color: '#94a3b8',
                    border: 'rgba(100, 116, 139, 0.4)'
                  };

                  return (
                    <div
                      key={item.item_uid}
                      draggable={true}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        e.dataTransfer.setData('text/plain', item.item_uid);
                        setDraggedUid(item.item_uid);
                      }}
                      onDragEnd={() => {
                        setDraggedUid(null);
                        setDragOverDate(null);
                      }}
                      style={{
                        padding: '4px 6px',
                        backgroundColor: '#131b2e',
                        border: '1px solid #23304a',
                        borderRadius: '5px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                        cursor: 'grab',
                        position: 'relative',
                        transition: 'border-color 0.15s, background-color 0.15s',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#38bdf8';
                        e.currentTarget.style.backgroundColor = '#16223b';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#23304a';
                        e.currentTarget.style.backgroundColor = '#131b2e';
                      }}
                      title={`拖曳可修改計劃日期；點擊編號開工單\n[${item.item_display_code}] ${item.item_title} (${item.item_status})`}
                    >
                      {/* Line 1: Display Code + Title */}
                      <div
                        onClick={() => onItemClick(item)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          overflow: 'hidden',
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{
                          fontWeight: 700,
                          color: '#38bdf8',
                          fontSize: '0.72rem',
                          flexShrink: 0
                        }}>
                          {item.item_display_code}
                        </span>
                        <span style={{
                          fontSize: '0.72rem',
                          color: '#e2e8f0',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1
                        }}>
                          {item.item_title}
                        </span>
                      </div>

                      {/* Line 2: Inline Status Button */}
                      <div>
                        <button
                          type="button"
                          onClick={(e) => handleOpenStatusMenu(e, item)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '1px 5px',
                            backgroundColor: statusInfo.bg,
                            border: `1px solid ${statusInfo.border}`,
                            color: statusInfo.color,
                            borderRadius: '4px',
                            fontSize: '0.66rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            outline: 'none',
                            lineHeight: 1.2
                          }}
                        >
                          <span>{statusInfo.label}</span>
                          <ChevronDown size={10} style={{ opacity: 0.8 }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Top-Level Fixed Status Popup Menu (Never clipped by cell overflows) */}
      {activeStatusMenu && (
        <div
          ref={dropdownRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: `${activeStatusMenu.top}px`,
            left: `${activeStatusMenu.left}px`,
            zIndex: 999999,
            backgroundColor: '#0c1222',
            border: '1px solid #2a3854',
            borderRadius: '6px',
            padding: '4px',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255,255,255,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            minWidth: '115px'
          }}
        >
          {ALL_STATUS_KEYS.map(st => {
            const sConf = STATUS_CONFIG[st];
            const isSelected = activeStatusMenu.currentStatus === st;
            return (
              <div
                key={st}
                onClick={(e) => handleStatusChange(e, activeStatusMenu.itemUid, st)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: isSelected ? 700 : 500,
                  color: sConf.color,
                  backgroundColor: isSelected ? sConf.bg : 'transparent',
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
                <span>{sConf.label}</span>
                {isSelected && <Check size={12} color={sConf.color} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
