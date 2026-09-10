import React, { useEffect, useRef, useState } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { BlockNoteSchema, defaultBlockSpecs, createCodeBlockSpec } from '@blocknote/core';
import { syntaxHighlighter, codeBlockOptions } from '@blocknote/code-block';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

export interface NovelEditorProps {
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

  // 初始化 BlockNote 編輯器實例，注入 syntaxHighlighter 語法高亮擴充
  const editor = useCreateBlockNote({
    schema,
    animations: true,
    extensions: [syntaxHighlighter],
  });

  // 初始內容載入：僅在尚未初始化時從外部 value 載入一次，避免編輯過程中因失焦觸發 tryParseMarkdownToBlocks 破壞 Toggle 與自定義區塊
  useEffect(() => {
    if (!editor) return;

    if (!initializedRef.current) {
      const loadInitialContent = async () => {
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
          console.error('Failed to parse initial markdown to BlockNote blocks:', err);
        }
      };

      loadInitialContent();
    }
  }, [editor]);

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
        }, 1200);
      } catch (err) {
        console.error('Failed to serialize BlockNote document to markdown:', err);
        setSaveStatus('idle');
        isInternalChangeRef.current = false;
      }
    }, 600);
  };

  const handleSaveClick = async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    await flushCurrentContent();
    if (onSave) {
      onSave();
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
            Enter 換行 | '/' 喚出指令 | 選取文字彈出格式工具列
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

export const NotionEditor = NovelEditor;
export const renderMarkdownContent = (content: any) => {
  return <NovelViewer content={content} />;
};
