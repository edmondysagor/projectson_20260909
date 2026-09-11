import React, { useMemo } from 'react';
import type { ProjectItem, Member } from '../utils/api';

interface ItemTimelineViewProps {
  items: ProjectItem[];
  members: Member[];
  onRefresh: () => Promise<void>;
  onItemClick: (item: ProjectItem) => void;
}

export const ItemTimelineView: React.FC<ItemTimelineViewProps> = ({
  items,
  onItemClick
}) => {
  // Sort items by planned start date / created at
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const dateA = a.item_planned_start_date || a.created_at || '';
      const dateB = b.item_planned_start_date || b.created_at || '';
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });
  }, [items]);

  // Determine timeline boundary dates (min and max dates)
  const { minDate, totalDays } = useMemo(() => {
    let min = new Date();
    let max = new Date();
    max.setDate(max.getDate() + 30); // Default 30 days ahead

    sortedItems.forEach(i => {
      if (i.item_planned_start_date) {
        const d = new Date(i.item_planned_start_date);
        if (d < min) min = d;
      }
      if (i.item_planned_end_date) {
        const d = new Date(i.item_planned_end_date);
        if (d > max) max = d;
      }
    });

    // Pad 3 days on left and 7 days on right
    min = new Date(min.getTime() - 3 * 86400000);
    max = new Date(max.getTime() + 7 * 86400000);
    const days = Math.max(14, Math.ceil((max.getTime() - min.getTime()) / 86400000));

    return { minDate: min, totalDays: days };
  }, [sortedItems]);

  // Generate day columns
  const dayColumns = useMemo(() => {
    const cols = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(minDate.getTime() + i * 86400000);
      cols.push({
        date: d,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        isToday: d.toDateString() === new Date().toDateString()
      });
    }
    return cols;
  }, [minDate, totalDays]);

  const DAY_WIDTH = 48; // px per day

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#0c1222',
      overflow: 'hidden'
    }}>
      {/* Scrollable Gantt Container */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex' }}>
        {/* Left Side: Item List */}
        <div style={{
          width: '280px',
          flexShrink: 0,
          borderRight: '1px solid #1e293b',
          backgroundColor: '#090d16',
          position: 'sticky',
          left: 0,
          zIndex: 10
        }}>
          {/* Header */}
          <div style={{
            height: '44px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: '#94a3b8',
            textTransform: 'uppercase'
          }}>
            工單項目 (Work Items)
          </div>

          {/* Rows */}
          {sortedItems.map(item => (
            <div
              key={item.item_uid}
              onClick={() => onItemClick(item)}
              style={{
                height: '44px',
                borderBottom: '1px solid #1e293b',
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                gap: '8px',
                cursor: 'pointer',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#131b2e')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span style={{
                color: '#38bdf8',
                fontWeight: 700,
                fontSize: '0.78rem',
                flexShrink: 0
              }}>
                {item.item_display_code}
              </span>
              <span style={{
                color: '#f8fafc',
                fontSize: '0.82rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {item.item_title}
              </span>
            </div>
          ))}
        </div>

        {/* Right Side: Timeline Grid and Bars */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: `${totalDays * DAY_WIDTH}px` }}>
          {/* Timeline Header (Days) */}
          <div style={{
            height: '44px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            backgroundColor: '#0f172a'
          }}>
            {dayColumns.map((col, idx) => (
              <div
                key={idx}
                style={{
                  width: `${DAY_WIDTH}px`,
                  flexShrink: 0,
                  borderRight: '1px solid #1e293b',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: col.isToday ? 'rgba(56, 189, 248, 0.15)' : col.isWeekend ? 'rgba(255,255,255,0.02)' : 'transparent',
                  color: col.isToday ? '#38bdf8' : col.isWeekend ? '#64748b' : '#94a3b8',
                  fontSize: '0.74rem',
                  fontWeight: col.isToday ? 700 : 500
                }}
              >
                <span>{col.label}</span>
              </div>
            ))}
          </div>

          {/* Timeline Rows */}
          {sortedItems.map(item => {
            // Calculate start and end offsets
            const itemStart = item.item_planned_start_date ? new Date(item.item_planned_start_date) : new Date(item.created_at || Date.now());
            const itemEnd = item.item_planned_end_date ? new Date(item.item_planned_end_date) : new Date(itemStart.getTime() + 3 * 86400000);

            const startOffsetDays = Math.max(0, (itemStart.getTime() - minDate.getTime()) / 86400000);
            const durationDays = Math.max(1, (itemEnd.getTime() - itemStart.getTime()) / 86400000);

            const leftPx = startOffsetDays * DAY_WIDTH;
            const widthPx = durationDays * DAY_WIDTH;

            const isDone = item.item_status === 'Completed' || item.item_status === 'Closed';

            return (
              <div
                key={item.item_uid}
                style={{
                  height: '44px',
                  borderBottom: '1px solid #1e293b',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {/* Background grid vertical lines */}
                {dayColumns.map((col, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: 'absolute',
                      left: `${idx * DAY_WIDTH}px`,
                      top: 0,
                      bottom: 0,
                      width: `${DAY_WIDTH}px`,
                      borderRight: '1px solid rgba(30, 41, 59, 0.4)',
                      backgroundColor: col.isToday ? 'rgba(56, 189, 248, 0.04)' : 'transparent',
                      pointerEvents: 'none'
                    }}
                  />
                ))}

                {/* Timeline Bar */}
                <div
                  onClick={() => onItemClick(item)}
                  style={{
                    position: 'absolute',
                    left: `${leftPx}px`,
                    width: `${Math.max(widthPx, 24)}px`,
                    height: '24px',
                    backgroundColor: isDone ? '#059669' : '#4338ca',
                    borderRadius: '6px',
                    border: isDone ? '1px solid #10b981' : '1px solid #6366f1',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                    color: '#ffffff',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    zIndex: 2
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scaleY(1.1)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scaleY(1)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
                  }}
                  title={`${item.item_display_code}: ${item.item_title} (${item.item_status})`}
                >
                  {item.item_display_code} - {item.item_title}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
