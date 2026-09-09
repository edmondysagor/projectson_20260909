import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ThemedSelect } from './CanvasPane';

export interface FilterRule {
  columnId: string;
  values: string[];
}

export interface SortRule {
  columnId: string;
  direction: 'asc' | 'desc';
}

export interface ToolbarState {
  searchQuery: string;
  owners: string[];
  filters: FilterRule[];
  sorts: SortRule[];
  hiddenColumns: string[];
  groupBy: string | null;
}

interface TableViewToolbarProps {
  columns: { id: string; header: string | React.ReactNode; accessor?: string }[];
  data: any[];
  state: ToolbarState;
  onChange: (newState: ToolbarState) => void;
  onSaveView?: () => void;
}

function useClickOutside(ref: React.RefObject<any>, handler: () => void) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler();
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

export const TableViewToolbar: React.FC<TableViewToolbarProps> = ({ columns, data, state, onChange, onSaveView }) => {
  const [activePopover, setActivePopover] = useState<'search' | 'person' | 'filter' | 'sort' | 'hide' | 'group' | null>(null);
  
  const popoverRef = useRef<HTMLDivElement>(null);
  useClickOutside(popoverRef, () => setActivePopover(null));

  const btnStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '4px',
    background: isActive ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
    color: isActive ? '#60A5FA' : 'var(--text-secondary)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 0.2s',
  });

  const getHeaderText = (header: string | React.ReactNode) => {
    if (typeof header === 'string') return header;
    return 'Column'; // Fallback for complex headers like RACI
  };

  // Generate unique values for each column for the Filter popover
  const filterOptions = useMemo(() => {
    const options: Record<string, { value: string, count: number }[]> = {};
    columns.forEach(col => {
      if (col.id === 'item_display_id' || col.id === 'item_title' || col.id.startsWith('raci_') || col.id === 'item_content') return; // Skip these for now
      
      const counts: Record<string, number> = {};
      data.forEach(item => {
        let val = item[col.accessor || col.id];
        if (val === undefined || val === null) val = '';
        val = String(val);
        counts[val] = (counts[val] || 0) + 1;
      });
      options[col.id] = Object.entries(counts).map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
    });
    return options;
  }, [columns, data]);

  const handleFilterToggle = (columnId: string, value: string) => {
    const existingRule = state.filters.find(f => f.columnId === columnId);
    if (existingRule) {
      if (existingRule.values.includes(value)) {
        const newValues = existingRule.values.filter(v => v !== value);
        if (newValues.length === 0) {
          onChange({ ...state, filters: state.filters.filter(f => f.columnId !== columnId) });
        } else {
          onChange({ ...state, filters: state.filters.map(f => f.columnId === columnId ? { ...f, values: newValues } : f) });
        }
      } else {
        onChange({ ...state, filters: state.filters.map(f => f.columnId === columnId ? { ...f, values: [...f.values, value] } : f) });
      }
    } else {
      onChange({ ...state, filters: [...state.filters, { columnId, values: [value] }] });
    }
  };

  const isFilterActive = (columnId: string, value: string) => {
    return state.filters.find(f => f.columnId === columnId)?.values.includes(value) || false;
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '4px', padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      {/* Search */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <span style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)' }}>🔍</span>
        <input 
          type="text" 
          placeholder="Search" 
          value={state.searchQuery}
          onChange={(e: any) => onChange({ ...state, searchQuery: e.target.value })}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: '13px',
            padding: '6px 8px 6px 28px',
            width: state.searchQuery ? '160px' : '100px',
            transition: 'width 0.2s',
            outline: 'none',
            borderRadius: '4px',
          }}
          onFocus={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          onBlur={e => e.currentTarget.style.background = 'transparent'}
        />
      </div>

      <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />

      <button style={btnStyle(activePopover === 'person')} onClick={() => setActivePopover(activePopover === 'person' ? null : 'person')}>
        👤 Person {state.owners.length > 0 && <span style={{ background: '#3B82F6', color: '#fff', borderRadius: '50%', padding: '0 6px', fontSize: '11px' }}>{state.owners.length}</span>}
      </button>

      <button style={btnStyle(activePopover === 'filter' || state.filters.length > 0)} onClick={() => setActivePopover(activePopover === 'filter' ? null : 'filter')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg> Filter {state.filters.length > 0 && <span style={{ background: '#3B82F6', color: '#fff', borderRadius: '50%', padding: '0 6px', fontSize: '11px' }}>{state.filters.length}</span>} ⌄
      </button>

      <button style={btnStyle(activePopover === 'sort' || state.sorts.length > 0)} onClick={() => setActivePopover(activePopover === 'sort' ? null : 'sort')}>
        ⇅ Sort {state.sorts.length > 0 && <span style={{ background: '#3B82F6', color: '#fff', borderRadius: '50%', padding: '0 6px', fontSize: '11px' }}>{state.sorts.length}</span>}
      </button>

      <button style={btnStyle(activePopover === 'hide' || state.hiddenColumns.length > 0)} onClick={() => setActivePopover(activePopover === 'hide' ? null : 'hide')}>
        👁 Hide {state.hiddenColumns.length > 0 && <span style={{ background: '#3B82F6', color: '#fff', borderRadius: '50%', padding: '0 6px', fontSize: '11px' }}>{state.hiddenColumns.length}</span>}
      </button>

      <button style={btnStyle(activePopover === 'group' || !!state.groupBy)} onClick={() => setActivePopover(activePopover === 'group' ? null : 'group')}>
        ◫ Group by {state.groupBy && <span style={{ background: '#3B82F6', color: '#fff', borderRadius: '50%', padding: '0 6px', fontSize: '11px' }}>1</span>}
      </button>

      <button style={btnStyle(false)}>...</button>

      {/* Popovers */}
      {activePopover && (
        <div ref={popoverRef} style={{
          position: 'absolute',
          top: '100%',
          left: activePopover === 'person' ? '120px' : activePopover === 'filter' ? '200px' : activePopover === 'sort' ? '280px' : '360px',
          marginTop: '4px',
          background: '#1E293B',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          zIndex: 1000,
          minWidth: '320px',
          maxWidth: 'min(800px, 90vw)',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600 }}>
              {activePopover === 'filter' ? 'Quick filters' : activePopover === 'sort' ? 'Sort by' : activePopover === 'hide' ? 'Display columns' : 'Options'}
            </h4>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => {
                if (activePopover === 'filter') onChange({ ...state, filters: [] });
                if (activePopover === 'sort') onChange({ ...state, sorts: [] });
                if (activePopover === 'hide') onChange({ ...state, hiddenColumns: [] });
                if (activePopover === 'person') onChange({ ...state, owners: [] });
              }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}>Clear all</button>
              <button onClick={onSaveView} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Save as new view</button>
            </div>
          </div>
          
          {/* FILTER POPOVER */}
          {activePopover === 'filter' && (
            <div style={{ display: 'flex', gap: '24px', maxWidth: '100%' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>All columns</div>
                <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
                  {Object.entries(filterOptions).map(([colId, opts]) => {
                    if (opts.length === 0) return null;
                    return (
                      <div key={colId} style={{ minWidth: '120px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          {getHeaderText(columns.find(c => c.id === colId)?.header)}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                          {opts.map(opt => {
                            const active = isFilterActive(colId, opt.value);
                            return (
                              <div 
                                key={opt.value} 
                                onClick={() => handleFilterToggle(colId, opt.value)}
                                style={{ 
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                                  padding: '6px 8px', borderRadius: '4px', cursor: 'pointer',
                                  background: active ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.02)',
                                  border: `1px solid ${active ? '#3B82F6' : 'transparent'}`,
                                }}
                              >
                                <span style={{ fontSize: '12px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }}>
                                  {opt.value || '(Empty)'}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{opt.count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* SORT POPOVER */}
          {activePopover === 'sort' && (
            <div>
              {state.sorts.map((sort, index) => (
                <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <ThemedSelect 
                    value={sort.columnId}
                    onChange={(e: any) => {
                      const newSorts = [...state.sorts];
                      newSorts[index].columnId = e.target.value;
                      onChange({ ...state, sorts: newSorts });
                    }}
                    style={{ flex: 1, padding: '6px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}
                  >
                    {columns.filter(c => typeof c.header === 'string' && !c.id.startsWith('raci_')).map(c => <option key={c.id} value={c.id}>{c.header}</option>)}
                  </ThemedSelect>
                  <ThemedSelect 
                    value={sort.direction}
                    onChange={(e: any) => {
                      const newSorts = [...state.sorts];
                      newSorts[index].direction = e.target.value as 'asc' | 'desc';
                      onChange({ ...state, sorts: newSorts });
                    }}
                    style={{ padding: '6px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </ThemedSelect>
                  <button 
                    onClick={() => {
                      const newSorts = [...state.sorts];
                      newSorts.splice(index, 1);
                      onChange({ ...state, sorts: newSorts });
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px 8px' }}
                  >✕</button>
                </div>
              ))}
              <button 
                onClick={() => {
                  const firstCol = columns.find(c => typeof c.header === 'string' && !c.id.startsWith('raci_'));
                  onChange({ ...state, sorts: [...state.sorts, { columnId: firstCol?.id || '', direction: 'asc' }] });
                }}
                style={{ background: 'transparent', border: 'none', color: '#60A5FA', cursor: 'pointer', fontSize: '13px', marginTop: '8px', padding: 0 }}
              >+ New sort</button>
            </div>
          )}

          {/* HIDE POPOVER */}
          {activePopover === 'hide' && (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <div style={{ padding: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <input 
                    type="checkbox" 
                    checked={state.hiddenColumns.length === 0}
                    onChange={(e: any) => onChange({ ...state, hiddenColumns: e.target.checked ? [] : columns.map(c => c.id) })}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>All columns</span>
                </div>
                {columns.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', marginLeft: '12px' }}>
                    <input 
                      type="checkbox" 
                      checked={!state.hiddenColumns.includes(c.id)}
                      onChange={(e: any) => {
                        if (e.target.checked) {
                          onChange({ ...state, hiddenColumns: state.hiddenColumns.filter(id => id !== c.id) });
                        } else {
                          onChange({ ...state, hiddenColumns: [...state.hiddenColumns, c.id] });
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{getHeaderText(c.header)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PERSON POPOVER */}
          {activePopover === 'person' && (
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Filter by Person</div>
              {/* To be implemented - requires passing members data or using filterOptions on item_follow_by */}
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Use the Filter tab to filter by Person.</div>
            </div>
          )}
          
        </div>
      )}
    </div>
  );
};
