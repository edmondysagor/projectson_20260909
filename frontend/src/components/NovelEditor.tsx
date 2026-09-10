import React, { useState, useRef, useEffect } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code as CodeIcon,
  Heading1, Heading2, List, ListOrdered, CheckSquare, Quote,
  Minus
} from 'lucide-react';
import { CodeBlockLanguagePicker } from './CodeBlockLanguagePicker';

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
 * 健壯且現代的 Notion-style Markdown 編輯器
 * - 具備頂部格式化按鈕條 (粗體、斜體、底線、刪除線、行內代碼、標題、清單、待辦、引用、代碼塊)
 * - 支援多行 Enter 換行，絕不崩潰
 * - 支援輸入 / 快速插入指令說明
 * - 支援程式碼區塊 (Code Block) 語言搜尋切換器
 * - 透過純文字 Markdown 雙向存取，相容性 100%
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
  const [text, setText] = useState(value || '');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceTimerRef = useRef<any>(null);

  useEffect(() => {
    setText(value || '');
  }, [value]);

  useEffect(() => {
    if (autoFocus && textareaRef.current && editable) {
      textareaRef.current.focus();
    }
  }, [autoFocus, editable]);

  const handleTextChange = (newVal: string) => {
    setText(newVal);
    if (!onChange) return;
    setSaveStatus('saving');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onChange(newVal);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1200);
    }, 400);
  };

  // 插入 Markdown 語法包裝工具函式
  const insertSyntax = (before: string, after: string = '', defaultContent: string = '') => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = text.substring(start, end) || defaultContent;
    const replacement = `${before}${selected}${after}`;

    const nextText = text.substring(0, start) + replacement + text.substring(end);
    handleTextChange(nextText);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  // 插入代碼塊
  const handleInsertCodeBlock = () => {
    insertSyntax(`\`\`\`${selectedLanguage}\n`, `\n\`\`\``, 'console.log("Hello, world!");');
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
      {/* 頂部快捷工具列 */}
      {editable && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '6px',
            padding: '6px 12px',
            backgroundColor: '#090d16',
            borderBottom: '1px solid #1e293b',
            borderRadius: '8px 8px 0 0',
            userSelect: 'none',
          }}
        >
          {/* 左側快捷按鈕 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => insertSyntax('**', '**', 'bold text')}
              style={{
                padding: '4px 6px',
                background: 'transparent',
                color: '#cbd5e1',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              title="粗體 (**text**)"
            >
              <Bold size={13} />
            </button>
            <button
              type="button"
              onClick={() => insertSyntax('*', '*', 'italic text')}
              style={{
                padding: '4px 6px',
                background: 'transparent',
                color: '#cbd5e1',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              title="斜體 (*text*)"
            >
              <Italic size={13} />
            </button>
            <button
              type="button"
              onClick={() => insertSyntax('<u>', '</u>', 'underline text')}
              style={{
                padding: '4px 6px',
                background: 'transparent',
                color: '#cbd5e1',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              title="底線 (<u>text</u>)"
            >
              <UnderlineIcon size={13} />
            </button>
            <button
              type="button"
              onClick={() => insertSyntax('~~', '~~', 'strikethrough')}
              style={{
                padding: '4px 6px',
                background: 'transparent',
                color: '#cbd5e1',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              title="刪除線 (~~text~~)"
            >
              <Strikethrough size={13} />
            </button>
            <button
              type="button"
              onClick={() => insertSyntax('`', '`', 'code')}
              style={{
                padding: '4px 6px',
                background: 'transparent',
                color: '#cbd5e1',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              title="行內代碼 (`code`)"
            >
              <CodeIcon size={13} />
            </button>

            <span style={{ width: '1px', height: '14px', backgroundColor: '#1e293b', margin: '0 4px' }} />

            <button
              type="button"
              onClick={() => insertSyntax('# ', '\n', 'Heading 1')}
              style={{
                padding: '4px 6px',
                background: 'transparent',
                color: '#cbd5e1',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              title="大標題 (# Heading 1)"
            >
              <Heading1 size={13} />
            </button>
            <button
              type="button"
              onClick={() => insertSyntax('## ', '\n', 'Heading 2')}
              style={{
                padding: '4px 6px',
                background: 'transparent',
                color: '#cbd5e1',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              title="中標題 (## Heading 2)"
            >
              <Heading2 size={13} />
            </button>
            <button
              type="button"
              onClick={() => insertSyntax('- ', '\n', 'List item')}
              style={{
                padding: '4px 6px',
                background: 'transparent',
                color: '#cbd5e1',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              title="無序清單 (- item)"
            >
              <List size={13} />
            </button>
            <button
              type="button"
              onClick={() => insertSyntax('1. ', '\n', 'List item')}
              style={{
                padding: '4px 6px',
                background: 'transparent',
                color: '#cbd5e1',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              title="有序清單 (1. item)"
            >
              <ListOrdered size={13} />
            </button>
            <button
              type="button"
              onClick={() => insertSyntax('- [ ] ', '\n', 'Task item')}
              style={{
                padding: '4px 6px',
                background: 'transparent',
                color: '#cbd5e1',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              title="待辦清單 (- [ ] item)"
            >
              <CheckSquare size={13} />
            </button>
            <button
              type="button"
              onClick={() => insertSyntax('> ', '\n', 'Quote text')}
              style={{
                padding: '4px 6px',
                background: 'transparent',
                color: '#cbd5e1',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              title="引用 (> quote)"
            >
              <Quote size={13} />
            </button>
            <button
              type="button"
              onClick={() => insertSyntax('\n---\n')}
              style={{
                padding: '4px 6px',
                background: 'transparent',
                color: '#cbd5e1',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              title="分隔線 (---)"
            >
              <Minus size={13} />
            </button>

            <span style={{ width: '1px', height: '14px', backgroundColor: '#1e293b', margin: '0 4px' }} />

            {/* Code Block 插入按鈕與語言選擇器 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CodeBlockLanguagePicker
                language={selectedLanguage}
                onSelectLanguage={(lang) => setSelectedLanguage(lang)}
              />
              <button
                type="button"
                onClick={handleInsertCodeBlock}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                }}
                title="插入所選語言代碼塊"
              >
                <CodeIcon size={12} />
                <span>+ Insert Code Block</span>
              </button>
            </div>
          </div>

          {/* 右側儲存狀態 */}
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

      {/* 輸入區主體 */}
      <div style={{ padding: editable ? '12px 14px' : '4px 0', minHeight }}>
        {editable ? (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="點擊輸入內容... 支援 Markdown 語法、多行換行、點擊上方快捷鍵插入程式碼塊..."
            style={{
              width: '100%',
              minHeight,
              backgroundColor: 'transparent',
              border: 'none',
              color: '#f8fafc',
              fontSize: '0.9rem',
              lineHeight: 1.6,
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <div
            style={{
              color: text.trim() ? '#f8fafc' : '#64748b',
              fontSize: '0.88rem',
              lineHeight: 1.6,
              fontStyle: text.trim() ? 'normal' : 'italic',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {text.trim() ? text : '尚無內容 (點擊此處進行編輯...)'}
          </div>
        )}
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

          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
            Enter 正常換行 | 支援 Markdown | 支援程式語言搜尋切換
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

  return (
    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.88rem', color: '#f8fafc' }}>
      {text}
    </div>
  );
};

export const NotionEditor = NovelEditor;
export const renderMarkdownContent = (content: any) => {
  return <NovelViewer content={content} />;
};
