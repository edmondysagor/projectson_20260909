import React, { useState, useRef } from 'react';
import {
  EditorRoot,
  EditorContent,
  StarterKit,
  Placeholder,
  TiptapLink,
  TaskList,
  TaskItem,
  HorizontalRule,
  TiptapUnderline,
  Command,
  renderItems,
  GlobalDragHandle
} from 'novel';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { Markdown } from 'tiptap-markdown';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { NovelCodeBlockView } from './NovelCodeBlockView';
import { NovelSlashMenu } from './NovelSlashMenu';
import { NovelBubbleMenu } from './NovelBubbleMenu';
import 'highlight.js/styles/github-dark.css';

const lowlight = createLowlight(common);

// 定義 Novel 擴充集合
const getNovelExtensions = () => [
  StarterKit.configure({
    codeBlock: false,
    horizontalRule: false,
  }),
  CodeBlockLowlight.extend({
    addNodeView() {
      return ReactNodeViewRenderer(NovelCodeBlockView);
    },
  }).configure({
    lowlight,
    defaultLanguage: 'javascript',
  }),
  Table.configure({
    resizable: true,
  }),
  TableRow,
  TableHeader,
  TableCell,
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  HorizontalRule,
  TiptapUnderline,
  TiptapLink.configure({
    openOnClick: false,
  }),
  Placeholder.configure({
    placeholder: "輸入 '/' 喚出指令選單...",
  }),
  Command.configure({
    suggestion: {
      render: renderItems(),
    },
  }),
  GlobalDragHandle.configure({
    dragHandleWidth: 20,
    scrollTreshold: 100,
  }),
  Markdown.configure({
    html: true,
    transformPastedText: true,
  }),
];

export interface NovelEditorProps {
  value: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  minHeight?: string;
  onSave?: () => void;
  onCancel?: () => void;
  saveLabel?: string;
  saving?: boolean;
  showActions?: boolean;
  editable?: boolean;
}

/**
 * 官方 steven-tey/novel 規格編輯器
 * - 具備 Novel 原生 Slash Command (`/`)、Bubble Menu (選取文字格式浮動列)
 * - 具備 Global 6-dots Drag Handle 拖曳手柄
 * - Code Block 整合 lowlight / highlight.js 語法高亮 + 自訂 Input Search & Dropdown 語言切換選單
 * - 透過 tiptap-markdown 雙向存取 Markdown，與後端 Neon DB 100% 相容
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
  const debounceTimerRef = useRef<any>(null);
  const extensions = useRef(getNovelExtensions()).current;

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
      {/* 頂部工具與狀態列 */}
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
            <span style={{ fontWeight: 600, color: '#38bdf8' }}>Novel Editor (steven-tey/novel)</span>
            <span>•</span>
            <span>輸入 '/' 喚出指令選單 | Code Block 支援搜尋切換語言</span>
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

      {/* Novel 編輯器容器 */}
      <div
        style={{
          minHeight: editable ? minHeight : 'auto',
          padding: editable ? '12px 14px' : '4px 0',
          color: '#f8fafc',
          cursor: editable ? 'text' : 'inherit',
          position: 'relative',
        }}
      >
        <EditorRoot>
          <EditorContent
            extensions={extensions as any}
            editable={editable}
            autofocus={autoFocus}
            immediatelyRender={false}
            initialContent={undefined}
            editorProps={{
              attributes: {
                class: 'prose prose-invert max-w-none focus:outline-none novel-prose',
                style: `min-height: ${editable ? minHeight : 'auto'}; outline: none;`,
              },
            }}
            onUpdate={({ editor }) => {
              if (!editable || !onChange) return;
              setSaveStatus('saving');

              if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
              }

              debounceTimerRef.current = setTimeout(() => {
                try {
                  const md = (editor.storage as any).markdown?.getMarkdown() || editor.getText();
                  onChange(md);
                  setSaveStatus('saved');
                  setTimeout(() => setSaveStatus('idle'), 1200);
                } catch (e) {
                  console.error('Error getting markdown from Novel:', e);
                  setSaveStatus('idle');
                }
              }, 500);
            }}
            onCreate={({ editor }) => {
              if (value && value.trim()) {
                try {
                  (editor.commands as any).setContent(value, false, {
                    preserveWhitespace: 'full',
                  });
                } catch (e) {
                  console.error('Error setting initial content in Novel:', e);
                }
              }
            }}
          >
            {editable && <NovelSlashMenu />}
            {editable && <NovelBubbleMenu />}
          </EditorContent>
        </EditorRoot>
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
            Enter 換行 | '/' 喚出指令 | 選取文字彈出格式列 | Code Block 支援語言搜尋
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * 唯讀靜態渲染組件
 */
export const NovelViewer: React.FC<{ content: any }> = ({ content }) => {
  let text = '';
  if (typeof content === 'string') {
    text = content;
  } else if (typeof content === 'object' && content && content.text) {
    text = content.text;
  } else {
    text = content ? String(content) : '';
  }

  if (!text || !text.trim()) {
    return <span style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.88rem' }}>尚無內容 (點擊此處進行編輯...)</span>;
  }

  return <NovelEditor value={text} editable={false} showActions={false} minHeight="auto" />;
};

/**
 * 向下相容匯出的函式與組件名稱
 */
export const NotionEditor = NovelEditor;
export const renderMarkdownContent = (content: any) => {
  return <NovelViewer content={content} />;
};
