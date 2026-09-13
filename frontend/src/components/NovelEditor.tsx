import React, { useEffect, useRef, useState } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { BlockNoteSchema, defaultBlockSpecs, createCodeBlockSpec } from '@blocknote/core';
import { syntaxHighlighter, codeBlockOptions } from '@blocknote/code-block';
import { Trash2 } from 'lucide-react';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

export interface NovelEditorProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  minHeight?: string;
  onSave?: (savedMarkdown?: string) => void;
  onCancel?: () => void;
  saveLabel?: string;
  saving?: boolean;
  showActions?: boolean;
  editable?: boolean;
}

// 建立正統官方 BlockNoteSchema：注入帶有 codeBlockOptions 的 codeBlock 規格
const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    codeBlock: createCodeBlockSpec(codeBlockOptions),
  },
});

/**
 * 官方 TypeCellOS/BlockNote 核心編輯器與渲染器
 * - 具備完整的 Notion-style 區塊體驗（Slash menu '/', Floating Formatting Toolbar, Drag Handle）
 * - 支援 Code Block 程式碼區塊（帶語言切換選單與 Shiki 語法高亮）
 * - 支援表格多行/多列批量選取並一鍵刪除（快捷鍵 Backspace/Delete + 浮動刪除按鈕）
 * - 支援輸入時穩定維持狀態，避免 autosave 重新解析覆蓋正在輸入的 Slash 選單
 * - 透過 Markdown 雙向轉換，與 Neon DB 無縫相容
 * - 唯讀模式與編輯模式 100% 同構渲染
 */
export const NovelEditor: React.FC<NovelEditorProps> = ({
  value,
  onChange,
  autoFocus = false,
  minHeight = '140px',
  onSave,
  onCancel,
  saveLabel = 'Save',
  saving = false,
  showActions = true,
  editable = true,
}) => {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const isInternalChangeRef = useRef(false);
  const debounceTimerRef = useRef<any>(null);
  const initializedRef = useRef(false);

  // 表格多行/多列批量選取狀態
  const [tableSelection, setTableSelection] = useState<{
    blockId: string;
    selectedRowIndices: number[];
    selectedColIndices: number[];
    rect: { top: number; left: number };
  } | null>(null);

  // 初始化 BlockNote 編輯器實例，注入 syntaxHighlighter 語法高亮擴充
  const editor = useCreateBlockNote({
    schema,
    animations: true,
    extensions: [syntaxHighlighter],
  });

  // 初始內容載入與唯讀模式動態更新
  useEffect(() => {
    if (!editor) return;

    const loadContent = async () => {
      try {
        if (value && value.trim()) {
          const blocks = await editor.tryParseMarkdownToBlocks(value);
          editor.replaceBlocks(editor.document, blocks);
        } else {
          editor.replaceBlocks(editor.document, [
            {
              type: 'paragraph',
              content: '',
            } as any,
          ]);
        }
        initializedRef.current = true;
      } catch (err) {
        console.error('Failed to parse markdown to BlockNote blocks:', err);
      }
    };

    if (!initializedRef.current || !editable) {
      loadContent();
    }
  }, [editor, value, editable]);

  // 聚焦
  useEffect(() => {
    if (editor && autoFocus && editable) {
      setTimeout(() => {
        try {
          editor.focus();
        } catch (_) {}
      }, 50);
    }
  }, [editor, autoFocus, editable]);

  // 立即將當前編輯器內容序列化並回傳
  const flushCurrentContent = async () => {
    if (!editor || !onChange) return;
    try {
      const md = await editor.blocksToMarkdownLossy(editor.document);
      onChange(md);
      return md;
    } catch (err) {
      console.error('Failed to flush BlockNote document to markdown:', err);
    }
  };

  // 監聽文件變更並序列化為 Markdown
  const handleEditorChange = () => {
    if (!editor || !editable || !onChange) return;

    setSaveStatus('saving');
    isInternalChangeRef.current = true;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const md = await editor.blocksToMarkdownLossy(editor.document);
        onChange(md);
        setSaveStatus('saved');
        setTimeout(() => {
          setSaveStatus('idle');
          isInternalChangeRef.current = false;
        }, 800);
      } catch (err) {
        console.error('Failed to serialize BlockNote document to markdown:', err);
        setSaveStatus('idle');
        isInternalChangeRef.current = false;
      }
    }, 100);
  };

  // 檢測當前選取範圍是否跨越表格多行或多列
  const checkTableSelection = () => {
    if (!editable || !editor) {
      setTableSelection(null);
      return;
    }

    // 1. 先檢測 ProseMirror 的 .selectedCell
    const selectedCells = Array.from(document.querySelectorAll('.bn-editor .selectedCell, table .selectedCell, td.selectedCell, th.selectedCell'));
    if (selectedCells.length > 0) {
      const tableEl = selectedCells[0].closest('table');
      if (tableEl) {
        const allTrs = Array.from(tableEl.querySelectorAll('tbody tr, tr'));
        const rowIndices = new Set<number>();
        const colIndices = new Set<number>();

        selectedCells.forEach(cell => {
          const tr = cell.closest('tr');
          if (tr) {
            const rIdx = allTrs.indexOf(tr);
            if (rIdx >= 0) rowIndices.add(rIdx);

            const allCellsInRow = Array.from(tr.children);
            const cIdx = allCellsInRow.indexOf(cell);
            if (cIdx >= 0) colIndices.add(cIdx);
          }
        });

        if (rowIndices.size > 1 || colIndices.size > 1) {
          const blockEl = tableEl.closest('[data-id]') || tableEl.closest('[data-node-type="blockContainer"]');
          const blockId = blockEl?.getAttribute('data-id') || '';
          const firstRect = selectedCells[0].getBoundingClientRect();
          const lastRect = selectedCells[selectedCells.length - 1].getBoundingClientRect();

          setTableSelection({
            blockId,
            selectedRowIndices: Array.from(rowIndices).sort((a, b) => a - b),
            selectedColIndices: Array.from(colIndices).sort((a, b) => a - b),
            rect: {
              top: Math.min(firstRect.top, lastRect.top),
              left: Math.max(20, (firstRect.left + lastRect.right) / 2 - 120)
            }
          });
          return;
        }
      }
    }

    // 2. 檢測標準 DOM window.getSelection()
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      setTableSelection(null);
      return;
    }

    const range = sel.getRangeAt(0);
    let container: Node | null = range.commonAncestorContainer;
    if (container.nodeType === Node.TEXT_NODE) {
      container = container.parentElement;
    }
    if (!container || !(container instanceof HTMLElement)) {
      setTableSelection(null);
      return;
    }

    const tableEl = container.closest('table');
    if (!tableEl) {
      setTableSelection(null);
      return;
    }

    // 尋找 blockId
    const blockEl = tableEl.closest('[data-id]') || tableEl.closest('[data-node-type="blockContainer"]');
    const blockId = blockEl?.getAttribute('data-id') || '';

    // 尋找當前 table 內所有 <tr>
    const allTrs = Array.from(tableEl.querySelectorAll('tbody tr, tr'));
    const selectedRowIndices: number[] = [];
    const selectedColIndices = new Set<number>();

    allTrs.forEach((tr, rIdx) => {
      if (sel.containsNode(tr, true)) {
        selectedRowIndices.push(rIdx);
        Array.from(tr.children).forEach((cell, cIdx) => {
          if (sel.containsNode(cell, true)) {
            selectedColIndices.add(cIdx);
          }
        });
      }
    });

    if (selectedRowIndices.length > 1 || selectedColIndices.size > 1) {
      const rect = range.getBoundingClientRect();
      setTableSelection({
        blockId,
        selectedRowIndices,
        selectedColIndices: Array.from(selectedColIndices).sort((a, b) => a - b),
        rect: {
          top: rect.top,
          left: Math.max(20, rect.left + rect.width / 2 - 120)
        }
      });
    } else {
      setTableSelection(null);
    }
  };

  // 監聽全域與編輯器選取變化及滑鼠動作
  useEffect(() => {
    if (!editable) return;
    const onSelChange = () => {
      setTimeout(checkTableSelection, 20);
    };
    document.addEventListener('selectionchange', onSelChange);
    document.addEventListener('mouseup', onSelChange);
    document.addEventListener('keyup', onSelChange);
    return () => {
      document.removeEventListener('selectionchange', onSelChange);
      document.removeEventListener('mouseup', onSelChange);
      document.removeEventListener('keyup', onSelChange);
    };
  }, [editable, editor]);

  // 執行批量刪除已選取的表格行 (Delete Rows)
  const handleDeleteSelectedRows = () => {
    if (!editor) return;

    let blockId = tableSelection?.blockId;
    let selectedRowIndices = tableSelection?.selectedRowIndices || [];

    if (selectedRowIndices.length === 0) {
      const selectedCells = Array.from(document.querySelectorAll('.bn-editor .selectedCell, table .selectedCell, td.selectedCell, th.selectedCell'));
      if (selectedCells.length > 0) {
        const tableEl = selectedCells[0].closest('table');
        if (tableEl) {
          const allTrs = Array.from(tableEl.querySelectorAll('tbody tr, tr'));
          const rowIndices = new Set<number>();
          selectedCells.forEach(cell => {
            const tr = cell.closest('tr');
            if (tr) {
              const idx = allTrs.indexOf(tr);
              if (idx >= 0) rowIndices.add(idx);
            }
          });
          selectedRowIndices = Array.from(rowIndices).sort((a, b) => a - b);
          const blockEl = tableEl.closest('[data-id]') || tableEl.closest('[data-node-type="blockContainer"]');
          blockId = blockEl?.getAttribute('data-id') || '';
        }
      }
    }

    if (selectedRowIndices.length === 0) return;

    let targetBlock = blockId ? editor.getBlock(blockId) : null;
    if (!targetBlock) {
      targetBlock = editor.document.find((b: any) => b.type === 'table');
    }
    if (!targetBlock || targetBlock.type !== 'table') return;

    const rows = (targetBlock.content as any)?.rows;
    if (!Array.isArray(rows)) return;

    if (selectedRowIndices.length >= rows.length) {
      editor.removeBlocks([targetBlock]);
    } else {
      const newRows = rows.filter((_: any, idx: number) => !selectedRowIndices.includes(idx));
      editor.updateBlock(targetBlock, {
        content: {
          type: 'tableContent',
          rows: newRows
        }
      });
    }

    document.querySelectorAll('.selectedCell').forEach(el => el.classList.remove('selectedCell'));
    setTableSelection(null);
    window.getSelection()?.removeAllRanges();
    handleEditorChange();
  };

  // 執行批量刪除已選取的表格列 (Delete Columns)
  const handleDeleteSelectedCols = () => {
    if (!editor) return;

    let blockId = tableSelection?.blockId;
    let selectedColIndices = tableSelection?.selectedColIndices || [];

    if (selectedColIndices.length === 0) {
      const selectedCells = Array.from(document.querySelectorAll('.bn-editor .selectedCell, table .selectedCell, td.selectedCell, th.selectedCell'));
      if (selectedCells.length > 0) {
        const tableEl = selectedCells[0].closest('table');
        if (tableEl) {
          const colIndices = new Set<number>();
          selectedCells.forEach(cell => {
            const tr = cell.closest('tr');
            if (tr) {
              const allCellsInRow = Array.from(tr.children);
              const cIdx = allCellsInRow.indexOf(cell);
              if (cIdx >= 0) colIndices.add(cIdx);
            }
          });
          selectedColIndices = Array.from(colIndices).sort((a, b) => a - b);
          const blockEl = tableEl.closest('[data-id]') || tableEl.closest('[data-node-type="blockContainer"]');
          blockId = blockEl?.getAttribute('data-id') || '';
        }
      }
    }

    if (selectedColIndices.length === 0) return;

    let targetBlock = blockId ? editor.getBlock(blockId) : null;
    if (!targetBlock) {
      targetBlock = editor.document.find((b: any) => b.type === 'table');
    }
    if (!targetBlock || targetBlock.type !== 'table') return;

    const rows = (targetBlock.content as any)?.rows;
    if (!Array.isArray(rows) || rows.length === 0) return;

    const totalCols = rows[0]?.cells?.length || 0;
    if (selectedColIndices.length >= totalCols) {
      editor.removeBlocks([targetBlock]);
    } else {
      const newRows = rows.map((row: any) => {
        const cells = Array.isArray(row.cells) ? row.cells : [];
        return {
          ...row,
          cells: cells.filter((_: any, colIdx: number) => !selectedColIndices.includes(colIdx))
        };
      });
      editor.updateBlock(targetBlock, {
        content: {
          type: 'tableContent',
          rows: newRows
        }
      });
    }

    document.querySelectorAll('.selectedCell').forEach(el => el.classList.remove('selectedCell'));
    setTableSelection(null);
    window.getSelection()?.removeAllRanges();
    handleEditorChange();
  };

  // 全域捕獲鍵盤快捷鍵：若多行/多列被選取，按 Backspace 或 Delete 自動優先刪除選取的行或列
  useEffect(() => {
    if (!editable || !editor) return;

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        const selectedCells = document.querySelectorAll('.bn-editor .selectedCell, table .selectedCell, td.selectedCell, th.selectedCell');
        if (selectedCells.length > 1 || (tableSelection && (tableSelection.selectedRowIndices.length > 1 || tableSelection.selectedColIndices.length > 1))) {
          e.preventDefault();
          e.stopPropagation();
          // 若同時選取多行則刪除多行；若僅選取多列則刪除多列
          if (tableSelection?.selectedRowIndices && tableSelection.selectedRowIndices.length > 1) {
            handleDeleteSelectedRows();
          } else if (tableSelection?.selectedColIndices && tableSelection.selectedColIndices.length > 1) {
            handleDeleteSelectedCols();
          } else {
            handleDeleteSelectedRows();
          }
        }
      }
    };

    window.addEventListener('keydown', handleWindowKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown, true);
    };
  }, [editable, editor, tableSelection]);

  // 註冊 BlockNote 官方 editor.onChange 監聽器，確保所有按鍵與區塊操作均即時捕獲
  useEffect(() => {
    if (!editor || !editable || !onChange) return;
    return editor.onChange(() => {
      handleEditorChange();
    });
  }, [editor, editable, onChange]);

  const handleSaveClick = async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    const md = await flushCurrentContent();
    if (onSave) {
      onSave(md);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0c1222',
        border: editable ? '1px solid #1e293b' : 'none',
        borderRadius: '8px',
        overflow: 'visible',
        boxShadow: editable ? '0 4px 16px rgba(0,0,0,0.3)' : 'none',
      }}
    >
      {/* 頂部狀態列 */}
      {editable && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 14px',
            backgroundColor: '#090d16',
            borderBottom: '1px solid #1e293b',
            borderRadius: '8px 8px 0 0',
            fontSize: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
            <span style={{ fontWeight: 600, color: '#38bdf8' }}>BlockNote Editor</span>
            <span>•</span>
            <span>輸入 '/' 喚出指令 (代碼塊、表格、Toggle、清單等)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {saveStatus === 'saving' && (
              <span style={{ color: '#fbbf24', fontSize: '0.72rem' }}>Saving...</span>
            )}
            {saveStatus === 'saved' && (
              <span style={{ color: '#34d399', fontSize: '0.72rem' }}>✓ Saved</span>
            )}
          </div>
        </div>
      )}

      {/* 浮動批量操作工具列 (當框選表格多行或多列時自動彈出) */}
      {editable && tableSelection && (tableSelection.selectedRowIndices.length > 1 || tableSelection.selectedColIndices.length > 1) && (
        <div
          style={{
            position: 'fixed',
            top: `${Math.max(10, tableSelection.rect.top - 42)}px`,
            left: `${Math.max(10, tableSelection.rect.left)}px`,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {tableSelection.selectedRowIndices.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDeleteSelectedRows();
              }}
              style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: '1px solid #ef4444',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                boxShadow: '0 6px 20px rgba(220, 38, 38, 0.6), 0 2px 8px rgba(0,0,0,0.5)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'transform 0.15s ease, background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#b91c1c')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#dc2626')}
              title="一鍵批量刪除選取的表格行 (亦可直接按 Backspace / Delete 鍵)"
            >
              <Trash2 size={14} color="#fff" />
              <span>批量刪除選中的 {tableSelection.selectedRowIndices.length} 行 (Delete Rows)</span>
            </button>
          )}

          {tableSelection.selectedColIndices.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDeleteSelectedCols();
              }}
              style={{
                backgroundColor: '#b91c1c',
                color: '#ffffff',
                border: '1px solid #f87171',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '0.78rem',
                fontWeight: 700,
                boxShadow: '0 6px 20px rgba(185, 28, 28, 0.6), 0 2px 8px rgba(0,0,0,0.5)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'transform 0.15s ease, background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#991b1b')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#b91c1c')}
              title="一鍵批量刪除選取的表格列 (亦可直接按 Backspace / Delete 鍵)"
            >
              <Trash2 size={14} color="#fff" />
              <span>批量刪除選中的 {tableSelection.selectedColIndices.length} 列 (Delete Columns)</span>
            </button>
          )}
        </div>
      )}

      {/* BlockNote 編輯器核心容器 */}
      <div
        style={{
          minHeight: editable ? minHeight : 'auto',
          padding: editable ? '6px 0' : '2px 0',
          color: '#f8fafc',
          cursor: editable ? 'text' : 'inherit',
          position: 'relative',
        }}
        onClick={() => {
          if (editable && editor && !editor.isFocused) {
            editor.focus();
          }
        }}
      >
        <BlockNoteView
          editor={editor}
          editable={editable}
          theme="dark"
          onChange={handleEditorChange}
        />
      </div>

      {/* 底部操作按鈕 */}
      {editable && showActions && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 14px',
            backgroundColor: '#090d16',
            borderTop: '1px solid #1e293b',
            borderRadius: '0 0 8px 8px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            {onSave && (
              <button
                type="button"
                onClick={handleSaveClick}
                disabled={saving}
                style={{
                  padding: '6px 16px',
                  backgroundColor: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : saveLabel}
              </button>
            )}
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                style={{
                  padding: '6px 16px',
                  backgroundColor: '#1e293b',
                  color: '#94a3b8',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            )}
          </div>

          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
            Enter 換行 | '/' 指令 | 框選多個 Table Rows 按 Backspace / Delete 可一鍵批量刪除
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * 唯讀靜態渲染組件 (與 BlockNote 編輯器同構渲染)
 */
export const NovelViewer: React.FC<{ content: any }> = ({ content }) => {
  let text = '';
  if (typeof content === 'string') {
    text = content;
  } else if (Array.isArray(content)) {
    if (content.length > 0 && typeof content[0] === 'object' && (content[0].text || content[0].description)) {
      text = content[0].text || content[0].description || '';
    } else {
      text = '';
    }
  } else if (typeof content === 'object' && content) {
    text = content.text || content.description || '';
  } else {
    text = content ? String(content) : '';
  }

  if (!text || !text.trim()) {
    return <span style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.88rem' }}>尚無內容 (點擊此處進行編輯...)</span>;
  }

  return <NovelEditor value={text} editable={false} showActions={false} minHeight="auto" />;
};

export const NotionEditor = NovelEditor;
export const renderMarkdownContent = (content: any) => {
  return <NovelViewer content={content} />;
};
