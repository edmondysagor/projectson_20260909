import React, { useEffect, useRef, useState } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { syntaxHighlighter } from '@blocknote/code-block';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

export interface NotionEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  minHeight?: string;
  onSave?: () => void;
  onCancel?: () => void;
  saveLabel?: string;
  saving?: boolean;
  showActions?: boolean;
}

/**
 * 核心 BlockNote 編輯器組件
 * 採用 TypeCellOS/BlockNote 原生套件：
 * - 自帶 6 點拖曳手柄、Slash Commands、Inline 浮動格式工具列、Table
 * - 整合 @blocknote/code-block 與 Shiki 引擎：支援數十種程式語言選單 (JS/TS/Python/SQL/HTML/CSS/Rust/Go/JSON 等) 及語法高亮著色
 */
export const NotionEditor: React.FC<NotionEditorProps> = ({
  value,
  onChange,
  autoFocus = false,
  minHeight = '140px',
  onSave,
  onCancel,
  saveLabel = 'Save',
  saving = false,
  showActions = true,
}) => {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const isInternalChangeRef = useRef(false);
  const debounceTimerRef = useRef<any>(null);

  // 初始化 BlockNote 實例，啟用 syntaxHighlighter (Shiki 語法高亮引擎)
  const editor = useCreateBlockNote({
    animations: true,
    extensions: [syntaxHighlighter],
  });

  // 初始內容載入
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!editor) return;

    if (!initializedRef.current) {
      initializedRef.current = true;
      if (value && value.trim()) {
        try {
          const blocks = editor.tryParseMarkdownToBlocks(value);
          if (blocks && blocks.length > 0) {
            editor.replaceBlocks(editor.document, blocks);
          }
        } catch (e) {
          console.error('Failed to parse initial markdown into BlockNote:', e);
        }
      }
      if (autoFocus) {
        setTimeout(() => {
          try {
            editor.focus();
          } catch {}
        }, 100);
      }
      return;
    }

    // 若外部 value 改變且非本組件內部觸發，則同步進 editor
    if (!isInternalChangeRef.current) {
      try {
        const currentMd = editor.blocksToMarkdownLossy(editor.document);
        if (currentMd.trim() !== value.trim()) {
          const blocks = editor.tryParseMarkdownToBlocks(value || '');
          if (blocks && blocks.length > 0) {
            editor.replaceBlocks(editor.document, blocks);
          }
        }
      } catch (e) {
        console.error('Sync external value to BlockNote error:', e);
      }
    }
  }, [value, editor, autoFocus]);

  // 監聽 editor 變更並回傳 markdown
  useEffect(() => {
    if (!editor) return;

    const unsubscribe = editor.onChange(async () => {
      setSaveStatus('saving');
      isInternalChangeRef.current = true;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        try {
          const md = editor.blocksToMarkdownLossy(editor.document);
          onChange(md);
          setSaveStatus('saved');
          setTimeout(() => {
            setSaveStatus('idle');
            isInternalChangeRef.current = false;
          }, 1200);
        } catch (e) {
          console.error('Error serializing BlockNote to markdown:', e);
          setSaveStatus('idle');
          isInternalChangeRef.current = false;
        }
      }, 500);
    });

    return () => {
      unsubscribe();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [editor, onChange]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0c1222',
        border: '1px solid #1e293b',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}
    >
      {/* 頂部狀態標題列 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 14px',
          backgroundColor: '#090d16',
          borderBottom: '1px solid #1e293b',
          fontSize: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
          <span style={{ fontWeight: 600, color: '#38bdf8' }}>BlockNote Editor</span>
          <span>•</span>
          <span>Type '/' for code, table, lists | Drag 6-dots handle</span>
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

      {/* BlockNote 編輯器容器 */}
      <div
        style={{
          minHeight,
          padding: '8px 4px',
          color: '#f8fafc',
        }}
      >
        <BlockNoteView
          editor={editor}
          theme="dark"
          data-theming-css-variables-demo
        />
      </div>

      {/* 底部操作按鈕 */}
      {showActions && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 14px',
            backgroundColor: '#090d16',
            borderTop: '1px solid #1e293b',
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            {onSave && (
              <button
                type="button"
                onClick={onSave}
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
          <span style={{ fontSize: '0.72rem', color: '#475569' }}>
            Enter 換塊 | '/' 喚出代碼/表格指令 | Code Block 支援多語言高亮
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * 唯讀靜態渲染器
 * 將 Markdown 內容以美觀格式呈現在 Drawer 列表中
 */
export const renderMarkdownContent = (content: any) => {
  if (!content) {
    return <span style={{ color: '#64748b', fontStyle: 'italic' }}>尚無內容 (點擊此處進行編輯...)</span>;
  }

  let text = '';
  if (typeof content === 'string') {
    text = content;
  } else if (typeof content === 'object' && content.text) {
    text = content.text;
  } else {
    text = String(content);
  }

  if (!text.trim()) {
    return <span style={{ color: '#64748b', fontStyle: 'italic' }}>尚無內容 (點擊此處進行編輯...)</span>;
  }

  const lines = text.split('\n');
  let inCodeBlock = false;
  let codeLang = '';
  let codeLines: string[] = [];
  const renderedElements: React.ReactNode[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim();
        codeLines = [];
        continue;
      } else {
        inCodeBlock = false;
        renderedElements.push(
          <div key={`code-${idx}`} style={{ margin: '10px 0', backgroundColor: '#070b14', border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 12px', backgroundColor: '#0e1526', borderBottom: '1px solid #1e293b', fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600 }}>
              <span>{codeLang || 'Code'}</span>
              <span style={{ color: '#64748b', fontWeight: 400 }}>Syntax Highlighted</span>
            </div>
            <pre style={{ margin: 0, padding: '12px 14px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '0.84rem', overflowX: 'auto', lineHeight: 1.5 }}>
              <code>{codeLines.join('\n')}</code>
            </pre>
          </div>
        );
        continue;
      }
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (trimmed.startsWith('# ')) {
      renderedElements.push(<h1 key={idx} style={{ fontSize: '1.35rem', fontWeight: 800, margin: '12px 0 6px', color: '#f8fafc' }}>{trimmed.slice(2)}</h1>);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      renderedElements.push(<h2 key={idx} style={{ fontSize: '1.15rem', fontWeight: 700, margin: '10px 0 5px', color: '#f8fafc' }}>{trimmed.slice(3)}</h2>);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      renderedElements.push(<h3 key={idx} style={{ fontSize: '1.02rem', fontWeight: 600, margin: '8px 0 4px', color: '#38bdf8' }}>{trimmed.slice(4)}</h3>);
      continue;
    }
    if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('- [x] ')) {
      const checked = trimmed.startsWith('- [x] ');
      renderedElements.push(
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0', color: checked ? '#64748b' : '#e2e8f0', textDecoration: checked ? 'line-through' : 'none' }}>
          <span style={{
            width: '14px',
            height: '14px',
            borderRadius: '3px',
            border: checked ? 'none' : '1.5px solid #64748b',
            backgroundColor: checked ? '#38bdf8' : 'transparent',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0c1222',
            fontSize: '10px',
            fontWeight: 800
          }}>
            {checked ? '✓' : ''}
          </span>
          <span>{trimmed.slice(6)}</span>
        </div>
      );
      continue;
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      renderedElements.push(
        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', margin: '3px 0' }}>
          <span style={{ color: '#94a3b8', marginTop: '2px' }}>•</span>
          <span>{trimmed.slice(2)}</span>
        </div>
      );
      continue;
    }
    if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s(.*)$/);
      renderedElements.push(
        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', margin: '3px 0' }}>
          <span style={{ color: '#38bdf8', fontWeight: 600, minWidth: '18px' }}>{match ? match[1] : '1'}.</span>
          <span>{match ? match[2] : trimmed}</span>
        </div>
      );
      continue;
    }
    if (trimmed.startsWith('> ')) {
      renderedElements.push(
        <blockquote key={idx} style={{ margin: '8px 0', padding: '6px 14px', borderLeft: '3px solid #38bdf8', color: '#94a3b8', fontStyle: 'italic', backgroundColor: 'rgba(56, 189, 248, 0.05)', borderRadius: '0 6px 6px 0' }}>
          {trimmed.slice(2)}
        </blockquote>
      );
      continue;
    }
    if (trimmed.startsWith('---')) {
      renderedElements.push(<hr key={idx} style={{ border: 'none', borderTop: '1px solid #1e293b', margin: '14px 0' }} />);
      continue;
    }
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      renderedElements.push(
        <div key={idx} style={{ fontFamily: 'monospace', fontSize: '0.82rem', padding: '2px 6px', backgroundColor: '#131b2e', borderRadius: '4px', margin: '2px 0', color: '#93c5fd' }}>
          {trimmed}
        </div>
      );
      continue;
    }
    if (!trimmed) {
      renderedElements.push(<div key={idx} style={{ height: '6px' }} />);
      continue;
    }
    renderedElements.push(<p key={idx} style={{ margin: '3px 0' }}>{line}</p>);
  }

  return (
    <div style={{ lineHeight: 1.65, color: '#e2e8f0', fontSize: '0.9rem' }}>
      {renderedElements}
    </div>
  );
};
