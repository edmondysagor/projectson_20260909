import React, { useState, useRef, useEffect } from 'react';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  CheckSquare, 
  Code, 
  Quote, 
  Heading1, 
  Heading2, 
  Heading3, 
  Table as TableIcon,
  Eye, 
  Edit3 
} from 'lucide-react';

/**
 * 完整解析 Markdown 文本為 Notion 視覺卡片元素
 * 支援: 程式碼區塊 (```...```)、Markdown 表格 (| ... |)、標題、待辦、無序/有序清單、引用等
 */
export const renderMarkdownContent = (content: string) => {
  if (!content || !content.trim()) {
    return <span style={{ color: '#64748b', fontStyle: 'italic' }}>尚無內容 (點擊編輯)</span>;
  }

  const rawLines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];

    // 1. 處理 Code Block (```lang ... ```)
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < rawLines.length && !rawLines[i].trim().startsWith('```')) {
        codeLines.push(rawLines[i]);
        i++;
      }
      if (i < rawLines.length) i++; // 跳過結尾的 ```

      elements.push(
        <div key={`code-${i}`} style={{
          margin: '10px 0',
          backgroundColor: '#070b14',
          border: '1px solid #1e293b',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 12px',
            backgroundColor: '#0e1526',
            borderBottom: '1px solid #1e293b',
            fontSize: '0.72rem',
            color: '#64748b'
          }}>
            <span>{lang || 'Code'}</span>
            <span style={{ fontSize: '0.7rem' }}>Notion Block</span>
          </div>
          <pre style={{
            margin: 0,
            padding: '12px 14px',
            color: '#38bdf8',
            fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, monospace',
            fontSize: '0.84rem',
            lineHeight: 1.5,
            overflowX: 'auto'
          }}>
            <code>{codeLines.join('\n') || '// 空代碼塊'}</code>
          </pre>
        </div>
      );
      continue;
    }

    // 2. 處理 Markdown 表格 (| 列1 | 列2 |)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith('|') && rawLines[i].trim().endsWith('|')) {
        tableLines.push(rawLines[i]);
        i++;
      }

      if (tableLines.length >= 2) {
        // 拆解表格
        const parseRow = (rowStr: string) => 
          rowStr.split('|')
            .slice(1, -1)
            .map(c => c.trim());

        const headers = parseRow(tableLines[0]);
        // 檢查第二行是否為分隔線 (如 |---|---|)
        const isSeparator = /^(\|\s*[-:]+\s*)+\|$/.test(tableLines[1].trim());
        const dataRows = isSeparator ? tableLines.slice(2) : tableLines.slice(1);

        elements.push(
          <div key={`table-${i}`} style={{
            margin: '12px 0',
            overflowX: 'auto',
            borderRadius: '8px',
            border: '1px solid #1e293b',
            backgroundColor: '#0c1222'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.84rem',
              color: '#e2e8f0'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#131b2e', borderBottom: '1px solid #1e293b' }}>
                  {headers.map((h, hIdx) => (
                    <th key={hIdx} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#38bdf8' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, rIdx) => {
                  const cells = parseRow(row);
                  return (
                    <tr key={rIdx} style={{ borderBottom: '1px solid #182235' }}>
                      {cells.map((c, cIdx) => (
                        <td key={cIdx} style={{ padding: '8px 12px', color: '#cbd5e1' }}>
                          {c}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 3. 處理常規行 (標題、清單、待辦、引用等)
    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} style={{ fontSize: '1.3rem', fontWeight: 700, margin: '10px 0 6px 0', color: '#f8fafc' }}>{line.slice(2)}</h1>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} style={{ fontSize: '1.15rem', fontWeight: 600, margin: '8px 0 4px 0', color: '#f8fafc' }}>{line.slice(3)}</h2>);
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} style={{ fontSize: '1.02rem', fontWeight: 600, margin: '6px 0 3px 0', color: '#38bdf8' }}>{line.slice(4)}</h3>);
    } else if (line.startsWith('- [ ] ')) {
      elements.push(
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
          <span style={{ width: '13px', height: '13px', border: '1.5px solid #64748b', borderRadius: '3px', display: 'inline-block' }} />
          <span>{line.slice(6)}</span>
        </div>
      );
    } else if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
      elements.push(
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0', color: '#94a3b8', textDecoration: 'line-through' }}>
          <span style={{ width: '13px', height: '13px', backgroundColor: '#38bdf8', borderRadius: '3px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#0c1222', fontSize: '9px', fontWeight: 800 }}>✓</span>
          <span>{line.slice(6)}</span>
        </div>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', margin: '3px 0' }}>
          <span style={{ color: '#38bdf8', marginTop: '2px' }}>•</span>
          <span>{line.slice(2)}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        elements.push(
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', margin: '3px 0' }}>
            <span style={{ color: '#38bdf8', fontWeight: 600, minWidth: '18px' }}>{match[1]}.</span>
            <span>{match[2]}</span>
          </div>
        );
      }
    } else if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={i} style={{ margin: '6px 0', padding: '6px 12px', borderLeft: '3px solid #38bdf8', color: '#94a3b8', fontStyle: 'italic', backgroundColor: 'rgba(56, 189, 248, 0.05)', borderRadius: '0 6px 6px 0' }}>
          {line.slice(2)}
        </blockquote>
      );
    } else if (!line.trim()) {
      elements.push(<div key={i} style={{ height: '8px' }} />);
    } else {
      // 支援行內代碼與粗體簡易解析
      elements.push(
        <div key={i} style={{ margin: '2px 0' }}>
          {line}
        </div>
      );
    }

    i++;
  }

  return (
    <div style={{ lineHeight: 1.6, color: '#e2e8f0', fontSize: '0.88rem' }}>
      {elements}
    </div>
  );
};

interface NotionEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  minHeight?: string;
  onSave?: () => void;
  onCancel?: () => void;
  saveLabel?: string;
  saving?: boolean;
  showActions?: boolean;
}

export const NotionEditor: React.FC<NotionEditorProps> = ({
  value,
  onChange,
  placeholder = "輸入 '/' 呼叫指令 (例如 /table, /code, /h1, /todo)...",
  autoFocus = false,
  minHeight = '140px',
  onSave,
  onCancel,
  saveLabel = 'Save',
  saving = false,
  showActions = true
}) => {
  const [isPreview, setIsPreview] = useState(false);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashMenuPos, setSlashMenuPos] = useState({ top: 40, left: 20 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Notion-style slash commands
  const commands = [
    {
      id: 'table',
      title: 'Table',
      description: '插入 Markdown 格式資料表格',
      icon: <TableIcon size={14} />,
      syntax: '| Header 1 | Header 2 | Header 3 |\n| --- | --- | --- |\n| Data 1 | Data 2 | Data 3 |\n',
      cursorOffset: 0
    },
    {
      id: 'code',
      title: 'Code block',
      description: '程式代碼塊 (```...```)',
      icon: <Code size={14} />,
      syntax: '```javascript\n// 在此輸入代碼\nconsole.log("Hello World");\n```\n',
      cursorOffset: 0
    },
    {
      id: 'h1',
      title: 'Heading 1',
      description: '大標題',
      icon: <Heading1 size={14} />,
      syntax: '# '
    },
    {
      id: 'h2',
      title: 'Heading 2',
      description: '中標題',
      icon: <Heading2 size={14} />,
      syntax: '## '
    },
    {
      id: 'h3',
      title: 'Heading 3',
      description: '小標題',
      icon: <Heading3 size={14} />,
      syntax: '### '
    },
    {
      id: 'bullet',
      title: 'Bulleted list',
      description: '無序項目清單',
      icon: <List size={14} />,
      syntax: '- '
    },
    {
      id: 'numbered',
      title: 'Numbered list',
      description: '編號項目清單',
      icon: <ListOrdered size={14} />,
      syntax: '1. '
    },
    {
      id: 'todo',
      title: 'To-do list',
      description: '勾選待辦項目',
      icon: <CheckSquare size={14} />,
      syntax: '- [ ] '
    },
    {
      id: 'quote',
      title: 'Quote',
      description: '引用區塊',
      icon: <Quote size={14} />,
      syntax: '> '
    },
    {
      id: 'bold',
      title: 'Bold text',
      description: '粗體重點',
      icon: <Bold size={14} />,
      syntax: '**粗體文字**',
      selectRange: [2, 6]
    }
  ];

  const filteredCommands = commands.filter(c => 
    c.title.toLowerCase().includes(slashQuery.toLowerCase()) || 
    c.description.toLowerCase().includes(slashQuery.toLowerCase()) ||
    c.id.toLowerCase().includes(slashQuery.toLowerCase())
  );

  const insertSyntax = (syntax: string, cursorOffset: number = 0, selectRange?: [number, number]) => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = value;

    let before = text.substring(0, start);
    const after = text.substring(end);

    if (slashMenuOpen) {
      const lastSlashIndex = before.lastIndexOf('/');
      if (lastSlashIndex !== -1) {
        before = before.substring(0, lastSlashIndex);
      }
      setSlashMenuOpen(false);
    }

    const newText = before + syntax + after;
    onChange(newText);

    setTimeout(() => {
      el.focus();
      if (selectRange) {
        el.setSelectionRange(before.length + selectRange[0], before.length + selectRange[1]);
      } else {
        const newPos = before.length + syntax.length + cursorOffset;
        el.setSelectionRange(newPos, newPos);
      }
    }, 10);
  };

  const handleApplyCommand = (cmd: typeof commands[0]) => {
    insertSyntax(cmd.syntax, cmd.cursorOffset || 0, cmd.selectRange as any);
  };

  const handleFormat = (type: 'bold' | 'italic' | 'code' | 'bullet' | 'quote' | 'todo' | 'table') => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.substring(start, end);

    if (type === 'table') {
      insertSyntax('\n| Header 1 | Header 2 | Header 3 |\n| --- | --- | --- |\n| Data 1 | Data 2 | Data 3 |\n');
      return;
    }

    let prefix = '';
    let suffix = '';

    if (type === 'bold') {
      prefix = '**';
      suffix = '**';
    } else if (type === 'italic') {
      prefix = '*';
      suffix = '*';
    } else if (type === 'code') {
      prefix = '```\n';
      suffix = '\n```';
    } else if (type === 'bullet') {
      prefix = '\n- ';
    } else if (type === 'quote') {
      prefix = '\n> ';
    } else if (type === 'todo') {
      prefix = '\n- [ ] ';
    }

    const replacement = prefix + (selected || (type === 'bold' ? '重點文字' : type === 'code' ? '// 代碼內容' : '')) + suffix;
    const newText = value.substring(0, start) + replacement + value.substring(end);
    onChange(newText);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + replacement.length - suffix.length);
    }, 10);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    onChange(newVal);

    const cursorPos = e.target.selectionStart;
    const textBefore = newVal.substring(0, cursorPos);

    const lines = textBefore.split('\n');
    const currentLine = lines[lines.length - 1];

    if (currentLine.includes('/')) {
      const slashIndex = currentLine.lastIndexOf('/');
      const query = currentLine.substring(slashIndex + 1).trim();
      const charBeforeSlash = slashIndex > 0 ? currentLine[slashIndex - 1] : ' ';
      if (charBeforeSlash === ' ' || slashIndex === 0) {
        setSlashQuery(query);
        setSlashMenuOpen(true);
        setSlashMenuIndex(0);
        const lineCount = lines.length;
        setSlashMenuPos({
          top: Math.min(lineCount * 22 + 45, 180),
          left: Math.min(slashIndex * 8 + 14, 250)
        });
        return;
      }
    }

    setSlashMenuOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashMenuOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashMenuIndex(prev => (prev + 1) % (filteredCommands.length || 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashMenuIndex(prev => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[slashMenuIndex]) {
          handleApplyCommand(filteredCommands[slashMenuIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        setSlashMenuOpen(false);
        return;
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (onSave) onSave();
    }
  };

  return (
    <div 
      ref={editorContainerRef}
      style={{
        backgroundColor: '#0c1222',
        border: '1px solid #1e293b',
        borderRadius: '8px',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
      }}
    >
      {/* Notion 工具列 (Toolbar) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        backgroundColor: '#101626',
        borderBottom: '1px solid #1e293b',
        flexWrap: 'wrap',
        gap: '4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          {/* 標題選擇快捷 */}
          <button
            type="button"
            title="Heading 1 (/h1)"
            onClick={() => insertSyntax('# ')}
            style={{ padding: '4px 6px', background: 'transparent', border: 'none', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            H1
          </button>
          <button
            type="button"
            title="Heading 2 (/h2)"
            onClick={() => insertSyntax('## ')}
            style={{ padding: '4px 6px', background: 'transparent', border: 'none', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            H2
          </button>

          <span style={{ width: '1px', height: '14px', backgroundColor: '#2d3b55', margin: '0 2px' }} />

          {/* 常用樣式 */}
          <button
            type="button"
            title="Bold (**text**)"
            onClick={() => handleFormat('bold')}
            style={{ padding: '4px', background: 'transparent', border: 'none', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Bold size={13} />
          </button>
          <button
            type="button"
            title="Italic (*text*)"
            onClick={() => handleFormat('italic')}
            style={{ padding: '4px', background: 'transparent', border: 'none', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Italic size={13} />
          </button>
          <button
            type="button"
            title="Bullet list (- )"
            onClick={() => handleFormat('bullet')}
            style={{ padding: '4px', background: 'transparent', border: 'none', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <List size={13} />
          </button>
          <button
            type="button"
            title="To-do check list (- [ ])"
            onClick={() => handleFormat('todo')}
            style={{ padding: '4px', background: 'transparent', border: 'none', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <CheckSquare size={13} />
          </button>
          <button
            type="button"
            title="Code block (```...```)"
            onClick={() => handleFormat('code')}
            style={{ padding: '4px', background: 'transparent', border: 'none', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Code size={13} />
          </button>
          <button
            type="button"
            title="Table (/table)"
            onClick={() => handleFormat('table')}
            style={{ padding: '4px', background: 'transparent', border: 'none', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <TableIcon size={13} />
          </button>
          <button
            type="button"
            title="Quote (> )"
            onClick={() => handleFormat('quote')}
            style={{ padding: '4px', background: 'transparent', border: 'none', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Quote size={13} />
          </button>
        </div>

        {/* 右側：預覽切換按鈕與快捷提示 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
            輸入 <strong style={{ color: '#38bdf8' }}>/</strong> 呼叫指令 (支援 /table, /code)
          </span>
          <button
            type="button"
            onClick={() => setIsPreview(!isPreview)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              backgroundColor: isPreview ? '#1e293b' : 'transparent',
              color: isPreview ? '#38bdf8' : '#94a3b8',
              border: '1px solid #2d3b55',
              borderRadius: '4px',
              fontSize: '0.74rem',
              cursor: 'pointer'
            }}
          >
            {isPreview ? <Edit3 size={12} /> : <Eye size={12} />}
            {isPreview ? '編輯' : '預覽'}
          </button>
        </div>
      </div>

      {/* 編輯核心區 / 預覽區 */}
      <div style={{ padding: '12px 14px', minHeight }}>
        {isPreview ? (
          renderMarkdownContent(value)
        ) : (
          <textarea
            ref={textareaRef}
            rows={6}
            value={value}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            style={{
              width: '100%',
              minHeight: '110px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#f8fafc',
              fontSize: '0.88rem',
              fontFamily: 'inherit',
              lineHeight: 1.6,
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box'
            }}
          />
        )}
      </div>

      {/* Notion Slash Command Popover 菜單 */}
      {slashMenuOpen && filteredCommands.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: `${slashMenuPos.top}px`,
            left: `${slashMenuPos.left}px`,
            width: '260px',
            backgroundColor: '#161f32',
            border: '1px solid #2d3b55',
            borderRadius: '8px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
            zIndex: 50,
            overflow: 'hidden'
          }}
        >
          <div style={{ padding: '6px 10px', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #1e293b' }}>
            BASIC BLOCKS
          </div>
          <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '4px' }}>
            {filteredCommands.map((cmd, idx) => {
              const isSelected = idx === slashMenuIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => handleApplyCommand(cmd)}
                  onMouseEnter={() => setSlashMenuIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    backgroundColor: isSelected ? '#1e293b' : 'transparent',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    backgroundColor: '#131b2e',
                    border: '1px solid #2d3b55',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#38bdf8'
                  }}>
                    {cmd.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f8fafc' }}>
                      {cmd.title}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      {cmd.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 底部 Save / Cancel 操作按鈕列 */}
      {showActions && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          backgroundColor: '#090d16',
          borderTop: '1px solid #1e293b'
        }}>
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
                  cursor: saving ? 'not-allowed' : 'pointer'
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
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            )}
          </div>
          <span style={{ fontSize: '0.72rem', color: '#475569' }}>
            Ctrl + Enter 儲存
          </span>
        </div>
      )}
    </div>
  );
};
