import { createReactBlockSpec } from '@blocknote/react';
import { defaultProps } from '@blocknote/core';
import { CodeBlockLanguagePicker } from './CodeBlockLanguagePicker';

/**
 * 客製化 React Code Block Spec
 * - 具備 Input Search + Dropdown Box Selection 的明顯程式語言切換鈕
 * - 完整相容 Shiki 語法高亮 (透過 props.language)
 * - 採用標準 contentRef 綁定 ProseMirror 編輯器核心，Enter 正常換行
 */
export const CustomCodeBlockSpec = createReactBlockSpec(
  {
    type: 'codeBlock',
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      textColor: defaultProps.textColor,
      language: {
        default: 'javascript',
      },
    },
    content: 'plain',
  },
  {
    render: (props) => {
      const { block, editor, contentRef } = props;
      const currentLanguage = (block.props as any).language || 'javascript';

      const handleSelectLanguage = (newLang: string) => {
        if (!editor.isEditable) return;
        editor.updateBlock(block.id, {
          props: {
            ...block.props,
            language: newLang,
          },
        } as any);
      };

      return (
        <div
          style={{
            position: 'relative',
            backgroundColor: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: '8px',
            overflow: 'visible',
            width: '100%',
            margin: '4px 0',
          }}
        >
          {/* 頂部標題列：語言顯示與 Input Search + Dropdown 切換按鈕 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 12px',
              backgroundColor: '#161b22',
              borderBottom: '1px solid #21262d',
              borderRadius: '8px 8px 0 0',
              userSelect: 'none',
            }}
            contentEditable={false}
          >
            <span style={{ fontSize: '0.72rem', color: '#8b949e', fontWeight: 600, letterSpacing: '0.5px' }}>
              CODE BLOCK
            </span>

            {/* 明顯的 Input Search + Dropdown 語言選擇組件 */}
            <CodeBlockLanguagePicker
              language={currentLanguage}
              onSelectLanguage={handleSelectLanguage}
              disabled={!editor.isEditable}
            />
          </div>

          {/* 代碼編輯/檢視區 */}
          <pre
            style={{
              margin: 0,
              padding: '12px 16px 16px 16px',
              background: 'transparent',
              overflowX: 'auto',
            }}
          >
            <code
              ref={contentRef}
              style={{
                display: 'block',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '0.88rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                background: 'transparent',
                padding: 0,
                color: '#e6edf3',
                outline: 'none',
              }}
            />
          </pre>
        </div>
      );
    },
  }
);
