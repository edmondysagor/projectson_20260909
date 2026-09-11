import React, { useState, useCallback, useRef } from 'react';

export function useColumnResize(defaultWidths: Record<string, number>, minWidth: number = 50) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(defaultWidths);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const activeColKey = useRef<string>('');

  const onResizeStart = useCallback((key: string, initialWidth: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = columnWidths[key] || initialWidth;
    activeColKey.current = key;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      const deltaX = moveEvent.clientX - startX.current;
      const newWidth = Math.max(minWidth, startWidth.current + deltaX);
      setColumnWidths((prev) => ({
        ...prev,
        [activeColKey.current]: newWidth,
      }));
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [columnWidths, minWidth]);

  return { columnWidths, onResizeStart };
}

export const Resizer: React.FC<{
  onMouseDown: (e: React.MouseEvent) => void;
}> = ({ onMouseDown }) => {
  return (
    <div
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: '10px',
        cursor: 'col-resize',
        userSelect: 'none',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '2px',
          height: '50%',
          backgroundColor: 'rgba(148, 163, 184, 0.35)',
          borderRadius: '1px',
          transition: 'background-color 0.15s, width 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#38bdf8';
          e.currentTarget.style.width = '3px';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(148, 163, 184, 0.35)';
          e.currentTarget.style.width = '2px';
        }}
      />
    </div>
  );
};
