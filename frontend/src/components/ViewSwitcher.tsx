import React from 'react';
import { AlignLeft, Kanban, Clock } from 'lucide-react';

export type ViewMode = 'list' | 'kanban' | 'timeline' | 'calendar';

interface ViewSwitcherProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  availableViews?: ViewMode[];
  compact?: boolean;
}

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  currentView,
  onViewChange,
  availableViews = ['list', 'kanban', 'timeline', 'calendar'],
  compact = true
}) => {
  const btnPadding = compact ? '3px 8px' : '5px 12px';
  const fontSize = compact ? '0.75rem' : '0.82rem';
  const iconSize = compact ? 13 : 15;
  const gap = compact ? '4px' : '6px';

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        backgroundColor: '#131b2e',
        border: '1px solid #23304a',
        borderRadius: '6px',
        padding: compact ? '2px' : '3px',
        gap: '2px',
        flexShrink: 0
      }}
    >
      {availableViews.includes('list') && (
        <button
          type="button"
          onClick={() => onViewChange('list')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap,
            padding: btnPadding,
            borderRadius: '4px',
            border: 'none',
            backgroundColor: currentView === 'list' ? '#6366f1' : 'transparent',
            color: currentView === 'list' ? '#ffffff' : '#94a3b8',
            fontSize,
            fontWeight: currentView === 'list' ? 600 : 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            if (currentView !== 'list') e.currentTarget.style.color = '#f8fafc';
          }}
          onMouseLeave={(e) => {
            if (currentView !== 'list') e.currentTarget.style.color = '#94a3b8';
          }}
        >
          <AlignLeft size={iconSize} />
          <span>List</span>
        </button>
      )}

      {availableViews.includes('kanban') && (
        <button
          type="button"
          onClick={() => onViewChange('kanban')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap,
            padding: btnPadding,
            borderRadius: '4px',
            border: 'none',
            backgroundColor: currentView === 'kanban' ? '#6366f1' : 'transparent',
            color: currentView === 'kanban' ? '#ffffff' : '#94a3b8',
            fontSize,
            fontWeight: currentView === 'kanban' ? 600 : 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            if (currentView !== 'kanban') e.currentTarget.style.color = '#f8fafc';
          }}
          onMouseLeave={(e) => {
            if (currentView !== 'kanban') e.currentTarget.style.color = '#94a3b8';
          }}
        >
          <Kanban size={iconSize} />
          <span>Kanban</span>
        </button>
      )}

      {availableViews.includes('timeline') && (
        <button
          type="button"
          onClick={() => onViewChange('timeline')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap,
            padding: btnPadding,
            borderRadius: '4px',
            border: 'none',
            backgroundColor: currentView === 'timeline' ? '#6366f1' : 'transparent',
            color: currentView === 'timeline' ? '#ffffff' : '#94a3b8',
            fontSize,
            fontWeight: currentView === 'timeline' ? 600 : 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            if (currentView !== 'timeline') e.currentTarget.style.color = '#f8fafc';
          }}
          onMouseLeave={(e) => {
            if (currentView !== 'timeline') e.currentTarget.style.color = '#94a3b8';
          }}
        >
          <Clock size={iconSize} />
          <span>Timeline</span>
        </button>
      )}

      {availableViews.includes('calendar') && (
        <button
          type="button"
          onClick={() => onViewChange('calendar')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap,
            padding: btnPadding,
            borderRadius: '4px',
            border: 'none',
            backgroundColor: currentView === 'calendar' ? '#6366f1' : 'transparent',
            color: currentView === 'calendar' ? '#ffffff' : '#94a3b8',
            fontSize,
            fontWeight: currentView === 'calendar' ? 600 : 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            if (currentView !== 'calendar') e.currentTarget.style.color = '#f8fafc';
          }}
          onMouseLeave={(e) => {
            if (currentView !== 'calendar') e.currentTarget.style.color = '#94a3b8';
          }}
        >
          <span style={{ fontSize: `${iconSize}px`, lineHeight: 1 }}>📅</span>
          <span>Calendar</span>
        </button>
      )}
    </div>
  );
};
