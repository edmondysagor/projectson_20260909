import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { CodeBlockLanguagePicker } from './CodeBlockLanguagePicker';

export const NovelCodeBlockView = ({ node, updateAttributes, extension }: any) => {
  const currentLang = node.attrs.language || 'javascript';

  return (
    <NodeViewWrapper className="relative my-3 overflow-visible rounded-lg border border-[#30363d] bg-[#0d1117] text-white">
      {/* 頂部標題列與語言選擇器 */}
      <div
        contentEditable={false}
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
      >
        <span style={{ fontSize: '0.72rem', color: '#8b949e', fontWeight: 600, letterSpacing: '0.5px' }}>
          CODE BLOCK
        </span>
        <CodeBlockLanguagePicker
          language={currentLang}
          onSelectLanguage={(newLang) => updateAttributes({ language: newLang })}
          disabled={!extension.options.editor?.isEditable && extension.editor?.isEditable === false}
        />
      </div>

      {/* 代碼內容輸入區 */}
      <pre style={{ margin: 0, padding: '12px 16px', background: 'transparent', overflowX: 'auto' }}>
        <NodeViewContent
          as={'code' as any}
          className={`language-${currentLang}`}
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
    </NodeViewWrapper>
  );
};
