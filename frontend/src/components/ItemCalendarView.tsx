import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ProjectItem, Member } from '../utils/api';

interface ItemCalendarViewProps {
  items: ProjectItem[];
  members: Member[];
  onRefresh: () => Promise<void>;
  onItemClick: (item: ProjectItem) => void;
}

export const ItemCalendarView: React.FC<ItemCalendarViewProps> = ({
  items,
  onItemClick
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

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

  // Generate days for the month grid (including previous/next month padding)
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

    // Next month padding to complete 35 or 42 grid cells
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false });
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

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#090d16',
      overflow: 'hidden'
    }}>
      {/* Calendar Header Navigation */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0c1222'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
            {year} 年 {monthNames[month]}
          </h2>
          <button
            onClick={handleToday}
            style={{
              padding: '4px 10px',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#cbd5e1',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            今天 (Today)
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={handlePrevMonth}
            style={{
              padding: '6px',
              backgroundColor: '#131b2e',
              border: '1px solid #23304a',
              borderRadius: '6px',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleNextMonth}
            style={{
              padding: '6px',
              backgroundColor: '#131b2e',
              border: '1px solid #23304a',
              borderRadius: '6px',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Weekday Labels Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        borderBottom: '1px solid #1e293b',
        backgroundColor: '#0f172a'
      }}>
        {['日 (Sun)', '一 (Mon)', '二 (Tue)', '三 (Wed)', '四 (Thu)', '五 (Fri)', '六 (Sat)'].map((day, idx) => (
          <div
            key={idx}
            style={{
              padding: '8px',
              textAlign: 'center',
              fontSize: '0.76rem',
              fontWeight: 600,
              color: idx === 0 || idx === 6 ? '#94a3b8' : '#cbd5e1',
              borderRight: idx < 6 ? '1px solid #1e293b' : 'none'
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Month Days Grid */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gridTemplateRows: 'repeat(6, 1fr)',
        overflow: 'hidden'
      }}>
        {calendarDays.map((cell, idx) => {
          const y = cell.date.getFullYear();
          const m = String(cell.date.getMonth() + 1).padStart(2, '0');
          const d = String(cell.date.getDate()).padStart(2, '0');
          const dateStr = `${y}-${m}-${d}`;
          const isToday = dateStr === todayStr;
          const dayItems = itemsByDate[dateStr] || [];

          return (
            <div
              key={idx}
              style={{
                borderRight: (idx + 1) % 7 !== 0 ? '1px solid #1e293b' : 'none',
                borderBottom: '1px solid #1e293b',
                padding: '6px',
                backgroundColor: !cell.isCurrentMonth
                  ? '#090d16'
                  : isToday
                  ? 'rgba(56, 189, 248, 0.04)'
                  : '#0c1222',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              {/* Day Number Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{
                  fontSize: '0.78rem',
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? '#38bdf8' : cell.isCurrentMonth ? '#f8fafc' : '#475569',
                  width: isToday ? '20px' : 'auto',
                  height: isToday ? '20px' : 'auto',
                  borderRadius: isToday ? '50%' : 'none',
                  backgroundColor: isToday ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {cell.date.getDate()}
                </span>
                {dayItems.length > 0 && (
                  <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
                    {dayItems.length} 個項目
                  </span>
                )}
              </div>

              {/* Day Items Container */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {dayItems.map(item => {
                  const isDone = item.item_status === 'Completed' || item.item_status === 'Closed';
                  return (
                    <div
                      key={item.item_uid}
                      onClick={() => onItemClick(item)}
                      style={{
                        padding: '3px 6px',
                        backgroundColor: isDone ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                        border: isDone ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(99, 102, 241, 0.4)',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        color: isDone ? '#6ee7b7' : '#c7d2fe',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title={`[${item.item_display_code}] ${item.item_title} (${item.item_status})`}
                    >
                      <span style={{ fontWeight: 700, color: '#38bdf8' }}>{item.item_display_code}</span>
                      <span>{item.item_title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
