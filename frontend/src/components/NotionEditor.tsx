import React, { useEffect, useRef, useState } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { BlockNoteSchema, createCodeBlockSpec } from '@blocknote/core';
import { codeBlockOptions, syntaxHighlighter } from '@blocknote/code-block';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

export interface NotionEditorProps {
  value: string;
  onChange?: (value: string) => void;
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

// 建立全域或快取用的 BlockNoteSchema (自帶 codeBlock 語言選取器與 options)
const customSchema = BlockNoteSchema.create().extend({
  blockSpecs: {
    codeBlock: createCodeBlockSpec(codeBlockOptions),
  },
});

/**
 * 核心 BlockNote 編輯器 / 檢視器
 * - 整合 @blocknote/code-block + Shiki 語法著色
 * - 配置 createCodeBlockSpec(codeBlockOptions) 提供原生語言選單 (Language Picker)
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
  editable = true,
}) => {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const isInternalChangeRef = useRef(false);
  const debounceTimerRef = useRef<any>(null);

  // 初始化 BlockNote 實例，包含 schema 與 syntaxHighlighter 擴充
  const editor = useCreateBlockNote({
    schema: customSchema,
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
      if (autoFocus && editable) {
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
        if (currentMd.trim() !== (value || '').trim()) {
          const blocks = editor.tryParseMarkdownToBlocks(value || '');
          if (blocks && blocks.length > 0) {
            editor.replaceBlocks(editor.document, blocks);
          }
        }
      } catch (e) {
        console.error('Sync external value to BlockNote error:', e);
      }
    }
  }, [value, editor, autoFocus, editable]);

  // 監聽 editor 變更並回傳 markdown
  useEffect(() => {
    if (!editor || !editable || !onChange) return;

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
  }, [editor, onChange, editable]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0c1222',
        border: editable ? '1px solid #1e293b' : 'none',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: editable ? '0 4px 16px rgba(0,0,0,0.3)' : 'none',
      }}
    >
      {/* 編輯模式頂部狀態標題列 */}
      {editable && (
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
            <span>Type '/' for code, table, lists | 支援程式語言選擇與語法著色</span>
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

      {/* BlockNote 編輯器 / 唯讀檢視容器 */}
      <div
        style={{
          minHeight: editable ? minHeight : 'auto',
          padding: editable ? '8px 4px' : '0',
          color: '#f8fafc',
          cursor: editable ? 'text' : 'inherit',
        }}
      >
        <BlockNoteView
          editor={editor}
          theme="dark"
          editable={editable}
          data-theming-css-variables-demo
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
            Enter 換塊 | '/' 喚出指令 | Code Block 右上角可切換語言
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * 唯讀靜態渲染組件
 */
export const NotionViewer: React.FC<{ content: any }> = ({ content }) => {
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

  return <NotionEditor value={text} editable={false} showActions={false} minHeight="auto" />;
};

/**
 * 向下相容匯出的函式形式
 */
export const renderMarkdownContent = (content: any) => {
  return <NotionViewer content={content} />;
};
