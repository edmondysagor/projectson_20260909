import React, { useState, useRef, useEffect } from 'react';

export interface Column<T> {
  id: string;
  header: string | React.ReactNode;
  accessor?: keyof T;
  cell?: (item: T) => React.ReactNode;
  minWidth?: number;
  width?: number;
}

interface AdvancedTableProps<T> {
  tableId: string;
  data: T[];
  columns: Column<T>[];
  sortConfig?: { key: string; direction: 'asc' | 'desc' } | null;
  onSort?: (key: string) => void;
  onRowClick?: (item: T) => void;
  rowStyle?: (item: T) => React.CSSProperties;
  emptyState?: React.ReactNode;
  footerContent?: React.ReactNode;
  selectable?: boolean;
  selectedRowIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  rowIdAccessor?: keyof T | ((item: T) => string);
}

export function AdvancedTable<T>({
  tableId,
  data,
  columns: initialColumns,
  sortConfig,
  onSort,
  onRowClick,
  rowStyle,
  emptyState,
  footerContent,
  selectable,
  selectedRowIds = [],
  onSelectionChange,
  rowIdAccessor
}: AdvancedTableProps<T>) {
  // Load saved column order and widths from localStorage
  const savedState = localStorage.getItem(`tableState_${tableId}`);
  let defaultCols = initialColumns;
  if (savedState) {
    try {
      const parsed = JSON.parse(savedState);
      const orderedCols: Column<T>[] = [];
      parsed.forEach((savedCol: any) => {
        const found = initialColumns.find(c => c.id === savedCol.id);
        if (found) {
          orderedCols.push({ ...found, width: savedCol.width || found.width || 150 });
        }
      });
      initialColumns.forEach(c => {
        if (!orderedCols.find(oc => oc.id === c.id)) {
          orderedCols.push({ ...c, width: c.width || 150 });
        }
      });
      defaultCols = orderedCols;
    } catch (e) {}
  } else {
    defaultCols = defaultCols.map(c => ({ ...c, width: c.width || 150 }));
  }

  const [columns, setColumns] = useState<Column<T>[]>(defaultCols);
  const [prevTableId, setPrevTableId] = useState(tableId);
  const [localSortConfig, setLocalSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(sortConfig || null);

  if (tableId !== prevTableId) {
    setPrevTableId(tableId);
    let defaultCols = initialColumns;
    const savedState = localStorage.getItem(`tableState_${tableId}`);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        const orderedCols: Column<T>[] = [];
        parsed.forEach((savedCol: any) => {
          const found = initialColumns.find(c => c.id === savedCol.id);
          if (found) {
            orderedCols.push({ ...found, width: savedCol.width || found.width || 150 });
          }
        });
        initialColumns.forEach(c => {
          if (!orderedCols.find(oc => oc.id === c.id)) {
            orderedCols.push({ ...c, width: c.width || 150 });
          }
        });
        defaultCols = orderedCols;
      } catch (e) {}
    } else {
      defaultCols = defaultCols.map(c => ({ ...c, width: c.width || 150 }));
    }
    setColumns(defaultCols);
    setLocalSortConfig(null);
  }
  
  useEffect(() => {
    const stateToSave = columns.map(c => ({ id: c.id, width: c.width }));
    localStorage.setItem(`tableState_${tableId}`, JSON.stringify(stateToSave));
  }, [columns, tableId]);

  useEffect(() => {
    setColumns(prev => {
      const initialIds = new Set(initialColumns.map(c => c.id));
      const currentIds = new Set(prev.map(c => c.id));
      
      let hasChanges = false;
      if (initialIds.size !== currentIds.size) hasChanges = true;
      else {
        for (const id of initialIds) {
          if (!currentIds.has(id)) {
            hasChanges = true;
            break;
          }
        }
      }
      
      if (!hasChanges) return prev;
      
      let newCols = [...prev];
      newCols = newCols.filter(c => initialIds.has(c.id));
      
      initialColumns.forEach((ic, idx) => {
        if (!currentIds.has(ic.id)) {
          newCols.splice(idx, 0, { ...ic, width: ic.width || 150 });
        }
      });
      
      return newCols;
    });
  }, [initialColumns]);

  useEffect(() => {
    if (sortConfig !== undefined) {
      setLocalSortConfig(sortConfig);
    }
  }, [sortConfig]);

  const handleHeaderClick = (colId: string, accessor?: keyof T) => {
    const key = accessor ? String(accessor) : colId;
    if (onSort) {
      onSort(key);
      return;
    }
    let direction: 'asc' | 'desc' = 'asc';
    if (localSortConfig && localSortConfig.key === key) {
      direction = localSortConfig.direction === 'asc' ? 'desc' : 'asc';
    }
    setLocalSortConfig({ key, direction });
  };

  const sortedData = React.useMemo(() => {
    if (!localSortConfig) return data;
    const { key, direction } = localSortConfig;
    return [...data].sort((a: any, b: any) => {
      let aVal = a[key];
      let bVal = b[key];
      const col = columns.find(c => c.id === key || String(c.accessor) === key);
      if (aVal === undefined && col?.accessor) aVal = a[col.accessor];
      if (bVal === undefined && col?.accessor) bVal = b[col.accessor];

      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      if (strA < strB) return direction === 'asc' ? -1 : 1;
      if (strA > strB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, localSortConfig, columns]);

  const [draggedColId, setDraggedColId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedColId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (!draggedColId || draggedColId === id) return;
    
    const draggedIdx = columns.findIndex(c => c.id === draggedColId);
    const targetIdx = columns.findIndex(c => c.id === id);
    if (draggedIdx < 0 || targetIdx < 0) return;

    const newCols = [...columns];
    const [removed] = newCols.splice(draggedIdx, 1);
    newCols.splice(targetIdx, 0, removed);
    setColumns(newCols);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedColId(null);
  };

  const [resizingColId, setResizingColId] = useState<string | null>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  const handleResizeStart = (e: React.MouseEvent, id: string, startWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColId(id);
    startXRef.current = e.clientX;
    startWidthRef.current = startWidth;
  };

  useEffect(() => {
    if (!resizingColId) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startXRef.current;
      const newWidth = Math.max(50, startWidthRef.current + diff);
      setColumns(prev => prev.map(c => c.id === resizingColId ? { ...c, width: newWidth } : c));
    };

    const handleMouseUp = () => {
      setResizingColId(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColId]);

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    const activeKey = localSortConfig?.key;
    const activeDir = localSortConfig?.direction;
    if (activeKey !== columnKey) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕</span>;
    return <span style={{ color: 'var(--accent-primary)', marginLeft: '4px' }}>{activeDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const renderColumns = React.useMemo(() => {
    const rendered: Column<T>[] = [];
    columns.forEach(c => {
      const updated = initialColumns.find(ic => ic.id === c.id);
      if (updated) {
        rendered.push({ ...updated, width: c.width });
      }
    });
    initialColumns.forEach((ic, idx) => {
      if (!columns.find(c => c.id === ic.id)) {
        rendered.splice(idx, 0, { ...ic, width: ic.width || 150 });
      }
    });
    return rendered;
  }, [columns, initialColumns]);

  // Selection Logic
  const getRowId = (item: T): string => {
    if (rowIdAccessor) {
      return typeof rowIdAccessor === 'function' ? rowIdAccessor(item) : String(item[rowIdAccessor]);
    }
    return String((item as any).id);
  };

  const allSelectableIds = React.useMemo(() => data.map(getRowId), [data, rowIdAccessor]);
  const isAllSelected = selectedRowIds.length > 0 && selectedRowIds.length === allSelectableIds.length;
  const isSomeSelected = selectedRowIds.length > 0 && selectedRowIds.length < allSelectableIds.length;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      onSelectionChange?.(allSelectableIds);
    } else {
      onSelectionChange?.([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange?.([...selectedRowIds, id]);
    } else {
      onSelectionChange?.(selectedRowIds.filter(i => i !== id));
    }
  };

  return (
    <div style={{ width: '100%', overflowX: 'auto', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
      <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
        <thead>
          <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-color)' }}>
            {selectable && (
              <th style={{ padding: '12px 16px', width: '40px', minWidth: '40px', maxWidth: '40px', boxSizing: 'border-box' }}>
                <input 
                  type="checkbox" 
                  checked={isAllSelected}
                  ref={input => {
                    if (input) {
                      input.indeterminate = isSomeSelected;
                    }
                  }}
                  onChange={handleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
            )}
            {renderColumns.map(col => (
              <th
                key={col.id}
                draggable={!resizingColId}
                onDragStart={(e) => handleDragStart(e, col.id)}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDrop={handleDrop}
                onDragEnd={() => setDraggedColId(null)}
                style={{
                  position: 'relative',
                  padding: '12px 16px',
                  color: 'var(--text-secondary)',
                  fontWeight: '600',
                  userSelect: 'none',
                  cursor: 'pointer',
                  width: col.width,
                  minWidth: col.width,
                  maxWidth: col.width,
                  boxSizing: 'border-box'
                }}
                onClick={() => handleHeaderClick(col.id, col.accessor)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {col.header} <SortIcon columnKey={col.accessor ? String(col.accessor) : col.id} />
                  </div>
                </div>
                <div
                  onMouseDown={(e) => handleResizeStart(e, col.id, col.width || 150)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: '6px',
                    cursor: 'col-resize',
                    zIndex: 1,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={renderColumns.length + (selectable ? 1 : 0)} style={{ padding: 0 }}>
                {emptyState || <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>暫無資料</div>}
              </td>
            </tr>
          ) : (
            sortedData.map((item, idx) => {
              const rowId = getRowId(item);
              const isSelected = selectedRowIds.includes(rowId);

              return (
                <tr
                  key={idx}
                  onClick={() => onRowClick && onRowClick(item)}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    cursor: onRowClick ? 'pointer' : 'default',
                    background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                    ...(rowStyle ? rowStyle(item) : {})
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent'}
                >
                  {selectable && (
                    <td style={{ padding: '12px 16px', width: '40px', minWidth: '40px', maxWidth: '40px', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={(e) => handleSelectRow(rowId, e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                  )}
                  {renderColumns.map(col => (
                    <td
                      key={col.id}
                      style={{
                        padding: '12px 16px',
                        width: col.width,
                        minWidth: col.width,
                        maxWidth: col.width,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        boxSizing: 'border-box'
                      }}
                    >
                      {col.cell ? col.cell(item) : col.accessor ? String(item[col.accessor] || '') : null}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
          {footerContent}
        </tbody>
      </table>
    </div>
  );
}
