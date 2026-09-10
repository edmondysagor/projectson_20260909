import React, { useState, useEffect, useRef } from 'react';
import { 
  GripVertical, 
  Trash2, 
  Copy, 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered,
  CheckSquare, 
  Type,
  Quote,
  Minus,
  Code
} from 'lucide-react';
import type { BlockType, DocumentBlock } from './NotionEditor';

export interface BlockDragHandleProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onReorder: (sourceIndex: number, targetIndex: number) => void;
  onDelete: (blockId: string) => void;
  onDuplicate: (blockId: string) => void;
  onTurnInto: (blockId: string, newType: BlockType) => void;
  blocks: DocumentBlock[];
}

export const BlockDragHandle: React.FC<BlockDragHandleProps> = ({
  containerRef,
  onReorder,
  onDelete,
  onDuplicate,
  onTurnInto,
  blocks
}) => {
  const [handlePos, setHandlePos] = useState<{ top: number; left: number; blockId: string; index: number } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dropIndicatorY, setDropIndicatorY] = useState<number | null>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);

  const draggedBlockIndexRef = useRef<number | null>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 1. 全域單一浮動手柄定位 (Global Floating Drag Handle via Mouse Movement)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) return;

      if (isMenuOpen && handlePos) {
        const menuEl = menuRef.current;
        const handleEl = handleRef.current;
        if (menuEl && (menuEl.contains(e.target as Node) || (handleEl && handleEl.contains(e.target as Node)))) {
          return;
        }
      }

      const containerRect = container.getBoundingClientRect();
      if (
        e.clientX < containerRect.left - 40 ||
        e.clientX > containerRect.right ||
        e.clientY < containerRect.top ||
        e.clientY > containerRect.bottom
      ) {
        if (!isMenuOpen) {
          setHandlePos(null);
        }
        return;
      }

      const blockNodes = container.querySelectorAll<HTMLElement>('[data-block-id]');
      let foundBlock: HTMLElement | null = null;
      let foundIndex = -1;

      blockNodes.forEach((node, idx) => {
        const rect = node.getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          foundBlock = node;
          foundIndex = idx;
        }
      });

      if (foundBlock && foundIndex !== -1) {
        const blockId = (foundBlock as HTMLElement).getAttribute('data-block-id') || '';
        const blockRect = (foundBlock as HTMLElement).getBoundingClientRect();
        const top = blockRect.top - containerRect.top + (blockRect.height > 36 ? 6 : (blockRect.height - 24) / 2);
        const left = 6;

        setHandlePos({
          top,
          left,
          blockId,
          index: foundIndex
        });
      } else {
        if (!isMenuOpen) {
          setHandlePos(null);
        }
      }
    };

    const handleMouseLeave = (e: MouseEvent) => {
      if (!isDragging && !isMenuOpen) {
        if (handleRef.current && handleRef.current.contains(e.relatedTarget as Node)) {
          return;
        }
        setHandlePos(null);
      }
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [containerRef, isDragging, isMenuOpen, handlePos]);

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (
        isMenuOpen &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        handleRef.current &&
        !handleRef.current.contains(e.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [isMenuOpen]);

  // 2. 拖曳重排事件處理
  const handleDragStart = (e: React.DragEvent) => {
    if (!handlePos) return;
    setIsDragging(true);
    setIsMenuOpen(false);
    draggedBlockIndexRef.current = handlePos.index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', handlePos.blockId);

    const container = containerRef.current;
    if (container) {
      const blockEl = container.querySelector(`[data-block-id="${handlePos.blockId}"]`);
      if (blockEl) {
        e.dataTransfer.setDragImage(blockEl, 20, 20);
      }
    }
  };

  useEffect(() => {
    if (!isDragging) return;
    const container = containerRef.current;
    if (!container) return;

    const handleContainerDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

      const containerRect = container.getBoundingClientRect();
      const blockNodes = container.querySelectorAll<HTMLElement>('[data-block-id]');

      let closestIndex = 0;
      let closestDistance = Number.MAX_VALUE;
      let indicatorY = 0;

      blockNodes.forEach((node, idx) => {
        const rect = node.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const dist = Math.abs(e.clientY - midY);

        if (dist < closestDistance) {
          closestDistance = dist;
          if (e.clientY < midY) {
            closestIndex = idx;
            indicatorY = rect.top - containerRect.top;
          } else {
            closestIndex = idx + 1;
            indicatorY = rect.bottom - containerRect.top;
          }
        }
      });

      setTargetIndex(closestIndex);
      setDropIndicatorY(indicatorY);
    };

    const handleContainerDrop = (e: DragEvent) => {
      e.preventDefault();
      const sourceIndex = draggedBlockIndexRef.current;
      if (sourceIndex !== null && targetIndex !== null && sourceIndex !== targetIndex) {
        const finalTarget = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex;
        onReorder(sourceIndex, finalTarget);
      }
      setIsDragging(false);
      setDropIndicatorY(null);
      setTargetIndex(null);
      draggedBlockIndexRef.current = null;
      setHandlePos(null);
    };

    const handleDragEnd = () => {
      setIsDragging(false);
      setDropIndicatorY(null);
      setTargetIndex(null);
      draggedBlockIndexRef.current = null;
      setHandlePos(null);
    };

    container.addEventListener('dragover', handleContainerDragOver);
    container.addEventListener('drop', handleContainerDrop);
    window.addEventListener('dragend', handleDragEnd);

    return () => {
      container.removeEventListener('dragover', handleContainerDragOver);
      container.removeEventListener('drop', handleContainerDrop);
      window.removeEventListener('dragend', handleDragEnd);
    };
  }, [isDragging, containerRef, targetIndex, onReorder]);

  if (!handlePos && !isMenuOpen) return null;

  const currentBlock = handlePos ? blocks.find(b => b.id === handlePos.blockId) : null;

  return (
    <>
      {/* 1. 全域單一 6 點浮動拖曳手柄 (6-dots Global Floating Drag Handle) */}
      {handlePos && (
        <div
          ref={handleRef}
          draggable
          onDragStart={handleDragStart}
          onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen(!isMenuOpen);
          }}
          title="拖曳以移動，點擊開啟選單"
          style={{
            position: 'absolute',
            top: `${handlePos.top}px`,
            left: `${handlePos.left}px`,
            width: '22px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            cursor: isDragging ? 'grabbing' : 'grab',
            color: '#64748b',
            backgroundColor: isMenuOpen ? '#1e293b' : 'transparent',
            zIndex: 40,
            transition: 'color 0.15s, background-color 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#38bdf8';
            e.currentTarget.style.backgroundColor = '#1e293b';
          }}
          onMouseLeave={(e) => {
            if (!isMenuOpen) {
              e.currentTarget.style.color = '#64748b';
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <GripVertical size={16} />
        </div>
      )}

      {/* 2. 拖曳放置藍色指示線 (Drop Indicator Blue Line) */}
      {isDragging && dropIndicatorY !== null && (
        <div
          style={{
            position: 'absolute',
            top: `${dropIndicatorY}px`,
            left: '30px',
            right: '16px',
            height: '2px',
            backgroundColor: '#38bdf8',
            boxShadow: '0 0 6px rgba(56, 189, 248, 0.8)',
            zIndex: 60,
            pointerEvents: 'none',
            borderRadius: '1px'
          }}
        />
      )}

      {/* 3. 點擊選單 (Block Action Popover Menu: Delete, Duplicate, Turn into) */}
      {isMenuOpen && handlePos && currentBlock && (
        <div
          ref={menuRef}
          style={{
            position: 'absolute',
            top: `${handlePos.top + 28}px`,
            left: `${handlePos.left + 24}px`,
            width: '220px',
            backgroundColor: '#161f32',
            border: '1px solid #2d3b55',
            borderRadius: '8px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
            zIndex: 150,
            padding: '4px',
            overflow: 'hidden'
          }}
        >
          {/* 操作選項 */}
          <div
            onClick={() => {
              onDelete(handlePos.blockId);
              setIsMenuOpen(false);
              setHandlePos(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 10px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              color: '#f87171',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Trash2 size={13} />
            <span>Delete Block (刪除)</span>
          </div>

          <div
            onClick={() => {
              onDuplicate(handlePos.blockId);
              setIsMenuOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 10px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              color: '#f8fafc',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Copy size={13} color="#94a3b8" />
            <span>Duplicate (複製區塊)</span>
          </div>

          <div style={{ height: '1px', backgroundColor: '#1e293b', margin: '4px 0' }} />

          {/* Turn into 子選單 */}
          <div style={{ padding: '4px 10px', fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
            TURN INTO (轉換為)
          </div>

          <div
            onClick={() => {
              onTurnInto(handlePos.blockId, 'paragraph');
              setIsMenuOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              color: '#cbd5e1',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Type size={13} color="#94a3b8" />
            <span>Paragraph (純文本)</span>
          </div>

          <div
            onClick={() => {
              onTurnInto(handlePos.blockId, 'heading_1');
              setIsMenuOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              color: '#cbd5e1',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Heading1 size={13} color="#38bdf8" />
            <span>Heading 1 (大標題)</span>
          </div>

          <div
            onClick={() => {
              onTurnInto(handlePos.blockId, 'heading_2');
              setIsMenuOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              color: '#cbd5e1',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Heading2 size={13} color="#38bdf8" />
            <span>Heading 2 (中標題)</span>
          </div>

          <div
            onClick={() => {
              onTurnInto(handlePos.blockId, 'heading_3');
              setIsMenuOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              color: '#cbd5e1',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Heading3 size={13} color="#38bdf8" />
            <span>Heading 3 (小標題)</span>
          </div>

          <div
            onClick={() => {
              onTurnInto(handlePos.blockId, 'todo');
              setIsMenuOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              color: '#cbd5e1',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <CheckSquare size={13} color="#38bdf8" />
            <span>To-do (待辦清單)</span>
          </div>

          <div
            onClick={() => {
              onTurnInto(handlePos.blockId, 'bullet');
              setIsMenuOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              color: '#cbd5e1',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <List size={13} color="#38bdf8" />
            <span>Bulleted list (項目清單)</span>
          </div>

          <div
            onClick={() => {
              onTurnInto(handlePos.blockId, 'numbered');
              setIsMenuOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              color: '#cbd5e1',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <ListOrdered size={13} color="#38bdf8" />
            <span>Numbered list (編號清單)</span>
          </div>

          <div
            onClick={() => {
              onTurnInto(handlePos.blockId, 'quote');
              setIsMenuOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              color: '#cbd5e1',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Quote size={13} color="#38bdf8" />
            <span>Quote (引述區塊)</span>
          </div>

          <div
            onClick={() => {
              onTurnInto(handlePos.blockId, 'code');
              setIsMenuOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              color: '#cbd5e1',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Code size={13} color="#38bdf8" />
            <span>Code (程式代碼)</span>
          </div>

          <div
            onClick={() => {
              onTurnInto(handlePos.blockId, 'divider');
              setIsMenuOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              color: '#cbd5e1',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Minus size={13} color="#94a3b8" />
            <span>Divider (分隔線)</span>
          </div>
        </div>
      )}
    </>
  );
};
