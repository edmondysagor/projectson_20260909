import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  CheckSquare, 
  Code as CodeIcon, 
  Quote, 
  Minus, 
  Type, 
  Table as TableIcon,
  Check
} from 'lucide-react';
import { BlockDragHandle } from './BlockDragHandle';
import { FloatingFormatToolbar } from './FloatingFormatToolbar';

export type BlockType = 
  | 'paragraph' 
  | 'heading_1' 
  | 'heading_2' 
  | 'heading_3' 
  | 'bullet' 
  | 'numbered' 
  | 'todo' 
  | 'quote' 
  | 'divider' 
  | 'code'
  | 'table';

export interface DocumentBlock {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean; // for todo
  lang?: string; // for code
  tableData?: string[][]; // for table
}

export interface StructuredDocument {
  document_id?: string;
  title?: string;
  blocks: DocumentBlock[];
}

// 產生標準 block
export const createDefaultBlock = (type: BlockType = 'paragraph', content = ''): DocumentBlock => ({
  id: 'block_' + Math.random().toString(36).substring(2, 9),
  type,
  content
});

// 解析舊字串或結構化 JSON 為 DocumentBlock 陣列
export const parseDocumentBlocks = (data: any): DocumentBlock[] => {
  if (!data) return [createDefaultBlock()];

  // 若本身已是 structured document 物件
  if (typeof data === 'object' && Array.isArray(data.blocks) && data.blocks.length > 0) {
    return data.blocks;
  }

  // 若為字串 (可能是 JSON string 或 Markdown string)
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed.blocks) && parsed.blocks.length > 0) {
          return parsed.blocks;
        }
      } catch {
        // fallback to line parsing
      }
    }

    // Markdown 字符串解析為 blocks
    const lines = data.split('\n');
    const blocks: DocumentBlock[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (line.trim().startsWith('```')) {
        const lang = line.trim().slice(3).trim() || 'javascript';
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) i++;
        blocks.push({
          id: 'block_' + Math.random().toString(36).substring(2, 9),
          type: 'code',
          content: codeLines.join('\n'),
          lang
        });
        continue;
      }

      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        const parseRow = (r: string) => r.split('|').slice(1, -1).map(c => c.trim());
        const allRows = tableLines.map(parseRow);
        const cleanRows = allRows.filter(r => !r.every(c => /^[-:]+$/.test(c)));
        blocks.push({
          id: 'block_' + Math.random().toString(36).substring(2, 9),
          type: 'table',
          content: '',
          tableData: cleanRows.length > 0 ? cleanRows : [
            ['Header 1', 'Header 2'],
            ['Data 1', 'Data 2']
          ]
        });
        continue;
      }

      if (line.startsWith('# ')) {
        blocks.push(createDefaultBlock('heading_1', line.slice(2)));
      } else if (line.startsWith('## ')) {
        blocks.push(createDefaultBlock('heading_2', line.slice(3)));
      } else if (line.startsWith('### ')) {
        blocks.push(createDefaultBlock('heading_3', line.slice(4)));
      } else if (line.startsWith('- [ ] ')) {
        blocks.push({ ...createDefaultBlock('todo', line.slice(6)), checked: false });
      } else if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
        blocks.push({ ...createDefaultBlock('todo', line.slice(6)), checked: true });
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        blocks.push(createDefaultBlock('bullet', line.slice(2)));
      } else if (/^\d+\.\s/.test(line)) {
        const match = line.match(/^\d+\.\s(.*)$/);
        blocks.push(createDefaultBlock('numbered', match ? match[1] : line));
      } else if (line.startsWith('> ')) {
        blocks.push(createDefaultBlock('quote', line.slice(2)));
      } else if (line.trim() === '---' || line.trim() === '***') {
        blocks.push(createDefaultBlock('divider', ''));
      } else {
        blocks.push(createDefaultBlock('paragraph', line));
      }

      i++;
    }

    return blocks.length > 0 ? blocks : [createDefaultBlock()];
  }

  return [createDefaultBlock()];
};

// 序列化為純 Markdown 字串（相容既有 backend API 儲存）
export const serializeBlocksToString = (blocks: DocumentBlock[]): string => {
  return blocks.map(b => {
    switch (b.type) {
      case 'heading_1': return `# ${b.content}`;
      case 'heading_2': return `## ${b.content}`;
      case 'heading_3': return `### ${b.content}`;
      case 'bullet': return `- ${b.content}`;
      case 'numbered': return `1. ${b.content}`;
      case 'todo': return `- [${b.checked ? 'x' : ' '}] ${b.content}`;
      case 'quote': return `> ${b.content}`;
      case 'divider': return `---`;
      case 'code': return `\`\`\`${b.lang || 'javascript'}\n${b.content}\n\`\`\``;
      case 'table': {
        const rows = b.tableData || [['Header 1', 'Header 2'], ['Data 1', 'Data 2']];
        if (rows.length === 0) return '';
        const header = `| ${rows[0].join(' | ')} |`;
        const sep = `| ${rows[0].map(() => '---').join(' | ')} |`;
        const body = rows.slice(1).map(r => `| ${r.join(' | ')} |`).join('\n');
        return `${header}\n${sep}\n${body}`;
      }
      default: return b.content;
    }
  }).join('\n');
};

// 唯讀靜態渲染器
export const renderMarkdownContent = (content: any) => {
  const blocks = parseDocumentBlocks(content);
  if (!blocks || blocks.length === 0 || (blocks.length === 1 && !blocks[0].content && blocks[0].type === 'paragraph')) {
    return <span style={{ color: '#64748b', fontStyle: 'italic' }}>尚無內容 (點擊此處進行編輯...)</span>;
  }

  return (
    <div style={{ lineHeight: 1.65, color: '#e2e8f0', fontSize: '0.9rem' }}>
      {blocks.map((b, idx) => {
        if (b.type === 'heading_1') return <h1 key={b.id || idx} style={{ fontSize: '1.4rem', fontWeight: 800, margin: '14px 0 6px', color: '#f8fafc' }}>{b.content}</h1>;
        if (b.type === 'heading_2') return <h2 key={b.id || idx} style={{ fontSize: '1.2rem', fontWeight: 700, margin: '12px 0 5px', color: '#f8fafc' }}>{b.content}</h2>;
        if (b.type === 'heading_3') return <h3 key={b.id || idx} style={{ fontSize: '1.05rem', fontWeight: 600, margin: '10px 0 4px', color: '#38bdf8' }}>{b.content}</h3>;
        if (b.type === 'bullet') {
          return (
            <div key={b.id || idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', margin: '3px 0' }}>
              <span style={{ color: '#94a3b8', marginTop: '2px' }}>•</span>
              <span>{b.content}</span>
            </div>
          );
        }
        if (b.type === 'numbered') {
          return (
            <div key={b.id || idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', margin: '3px 0' }}>
              <span style={{ color: '#38bdf8', fontWeight: 600, minWidth: '18px' }}>{idx + 1}.</span>
              <span>{b.content}</span>
            </div>
          );
        }
        if (b.type === 'todo') {
          return (
            <div key={b.id || idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0', color: b.checked ? '#64748b' : '#e2e8f0', textDecoration: b.checked ? 'line-through' : 'none' }}>
              <span style={{
                width: '14px',
                height: '14px',
                borderRadius: '3px',
                border: b.checked ? 'none' : '1.5px solid #64748b',
                backgroundColor: b.checked ? '#38bdf8' : 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0c1222',
                fontSize: '10px',
                fontWeight: 800
              }}>
                {b.checked ? '✓' : ''}
              </span>
              <span>{b.content}</span>
            </div>
          );
        }
        if (b.type === 'quote') {
          return (
            <blockquote key={b.id || idx} style={{ margin: '8px 0', padding: '6px 14px', borderLeft: '3px solid #38bdf8', color: '#94a3b8', fontStyle: 'italic', backgroundColor: 'rgba(56, 189, 248, 0.05)', borderRadius: '0 6px 6px 0' }}>
              {b.content}
            </blockquote>
          );
        }
        if (b.type === 'divider') {
          return <hr key={b.id || idx} style={{ border: 'none', borderTop: '1px solid #1e293b', margin: '14px 0' }} />;
        }
        if (b.type === 'code') {
          return (
            <div key={b.id || idx} style={{ margin: '12px 0', backgroundColor: '#070b14', border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 12px', backgroundColor: '#0e1526', borderBottom: '1px solid #1e293b', fontSize: '0.72rem', color: '#64748b' }}>
                {b.lang || 'Code'}
              </div>
              <pre style={{ margin: 0, padding: '12px 14px', color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                <code>{b.content}</code>
              </pre>
            </div>
          );
        }
        if (b.type === 'table') {
          const rows = b.tableData || [];
          if (rows.length === 0) return null;
          return (
            <div key={b.id || idx} style={{ margin: '12px 0', overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', border: '1px solid #2d3b55', fontSize: '0.84rem' }}>
                <tbody>
                  {rows.map((row, rIdx) => (
                    <tr key={rIdx} style={{ borderBottom: '1px solid #2d3b55' }}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} style={{ borderRight: '1px solid #2d3b55', padding: '8px 14px', color: '#f8fafc' }}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return <div key={b.id || idx} style={{ margin: '3px 0' }}>{b.content}</div>;
      })}
    </div>
  );
};

interface NotionEditorProps {
  value: any;
  onChange: (val: string, structuredDoc?: StructuredDocument) => void;
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
  autoFocus = false,
  minHeight = '160px',
  onSave,
  onCancel,
  saveLabel = 'Save',
  saving = false,
  showActions = true
}) => {
  const [blocks, setBlocks] = useState<DocumentBlock[]>(() => parseDocumentBlocks(value));

  // 歷史記錄供 Undo / Redo
  const [history, setHistory] = useState<DocumentBlock[][]>([parseDocumentBlocks(value)]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Autosave 狀態提示
  const [saveStatus, setSaveStatus] = useState<'Saved' | 'Saving...'>('Saved');

  // Slash Menu
  const [slashMenuBlockId, setSlashMenuBlockId] = useState<string | null>(null);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);

  // Floating Format Toolbar
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ blockId: string; start: number; end: number } | null>(null);

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const autosaveTimerRef = useRef<any>(null);
  const lastEmittedValueRef = useRef<string>('');

  // 同步外部傳入的初始值
  useEffect(() => {
    const currentStr = serializeBlocksToString(blocks);
    const incomingStr = typeof value === 'string' ? value : serializeBlocksToString(parseDocumentBlocks(value));
    if (incomingStr !== currentStr && incomingStr !== lastEmittedValueRef.current) {
      const parsed = parseDocumentBlocks(value);
      setBlocks(parsed);
      setHistory([parsed]);
      setHistoryIndex(0);
    }
  }, [value]);

  // 更新 blocks 並記錄 Undo/Redo 及觸發 Autosave
  const commitBlocks = useCallback((newBlocks: DocumentBlock[], recordHistory = true) => {
    setBlocks(newBlocks);
    const serializedStr = serializeBlocksToString(newBlocks);
    lastEmittedValueRef.current = serializedStr;

    // 觸發外部回調
    onChange(serializedStr, { blocks: newBlocks });

    // 記錄歷史 (Undo / Redo)
    if (recordHistory) {
      setHistory(prev => {
        const next = prev.slice(0, historyIndex + 1);
        return [...next, newBlocks];
      });
      setHistoryIndex(prev => prev + 1);
    }

    // Autosave Debounce (500-1000ms)
    setSaveStatus('Saving...');
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      setSaveStatus('Saved');
    }, 800);
  }, [historyIndex, onChange]);

  // Undo (Ctrl+Z) / Redo (Ctrl+Shift+Z / Cmd+Y)
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const target = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setBlocks(target);
      const str = serializeBlocksToString(target);
      lastEmittedValueRef.current = str;
      onChange(str, { blocks: target });
    }
  }, [historyIndex, history, onChange]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const target = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setBlocks(target);
      const str = serializeBlocksToString(target);
      lastEmittedValueRef.current = str;
      onChange(str, { blocks: target });
    }
  }, [historyIndex, history, onChange]);

  // 全域快速鍵 (Undo/Redo, Formatting)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleUndo, handleRedo]);

  // Slash commands 項目清單
  const slashCommands = [
    {
      id: 'paragraph',
      title: 'Text',
      description: '純文本段落',
      icon: <Type size={14} />,
      create: () => ({ type: 'paragraph' as BlockType, content: '' })
    },
    {
      id: 'heading_1',
      title: 'Heading 1',
      description: '大標題',
      icon: <Heading1 size={14} />,
      create: () => ({ type: 'heading_1' as BlockType, content: '' })
    },
    {
      id: 'heading_2',
      title: 'Heading 2',
      description: '中標題',
      icon: <Heading2 size={14} />,
      create: () => ({ type: 'heading_2' as BlockType, content: '' })
    },
    {
      id: 'heading_3',
      title: 'Heading 3',
      description: '小標題',
      icon: <Heading3 size={14} />,
      create: () => ({ type: 'heading_3' as BlockType, content: '' })
    },
    {
      id: 'bullet',
      title: 'Bulleted list',
      description: '無序清單項目',
      icon: <List size={14} />,
      create: () => ({ type: 'bullet' as BlockType, content: '' })
    },
    {
      id: 'numbered',
      title: 'Numbered list',
      description: '有序編號清單',
      icon: <ListOrdered size={14} />,
      create: () => ({ type: 'numbered' as BlockType, content: '' })
    },
    {
      id: 'todo',
      title: 'To-do',
      description: '待辦勾選框',
      icon: <CheckSquare size={14} />,
      create: () => ({ type: 'todo' as BlockType, content: '', checked: false })
    },
    {
      id: 'quote',
      title: 'Quote',
      description: '引述區塊',
      icon: <Quote size={14} />,
      create: () => ({ type: 'quote' as BlockType, content: '' })
    },
    {
      id: 'divider',
      title: 'Divider',
      description: '分隔線',
      icon: <Minus size={14} />,
      create: () => ({ type: 'divider' as BlockType, content: '' })
    },
    {
      id: 'code',
      title: 'Code',
      description: '程式碼編輯區塊',
      icon: <CodeIcon size={14} />,
      create: () => ({ type: 'code' as BlockType, content: '', lang: 'javascript' })
    },
    {
      id: 'table',
      title: 'Table',
      description: '簡單網格資料表',
      icon: <TableIcon size={14} />,
      create: () => ({
        type: 'table' as BlockType,
        content: '',
        tableData: [
          ['Header 1', 'Header 2'],
          ['Data 1', 'Data 2']
        ]
      })
    }
  ];

  const filteredSlashCommands = slashCommands.filter(c => 
    c.title.toLowerCase().includes(slashQuery.toLowerCase()) || 
    c.id.toLowerCase().includes(slashQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(slashQuery.toLowerCase())
  );

  const applySlashCommand = (blockId: string, cmd: typeof slashCommands[0]) => {
    const updated = blocks.map(b => b.id === blockId ? { ...b, ...cmd.create() } : b);
    commitBlocks(updated);
    setSlashMenuBlockId(null);
    setSlashQuery('');
  };

  // Block 重排、刪除、複製、轉型
  const handleReorder = (sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex || sourceIndex < 0 || targetIndex < 0) return;
    const updated = [...blocks];
    const [moved] = updated.splice(sourceIndex, 1);
    updated.splice(targetIndex, 0, moved);
    commitBlocks(updated);
  };

  const handleDeleteBlock = (blockId: string) => {
    const updated = blocks.filter(b => b.id !== blockId);
    commitBlocks(updated.length > 0 ? updated : [createDefaultBlock()]);
  };

  const handleDuplicateBlock = (blockId: string) => {
    const idx = blocks.findIndex(b => b.id === blockId);
    if (idx === -1) return;
    const orig = blocks[idx];
    const clone: DocumentBlock = {
      ...orig,
      id: 'block_' + Math.random().toString(36).substring(2, 9),
      tableData: orig.tableData ? JSON.parse(JSON.stringify(orig.tableData)) : undefined
    };
    const updated = [...blocks.slice(0, idx + 1), clone, ...blocks.slice(idx + 1)];
    commitBlocks(updated);
  };

  const handleTurnInto = (blockId: string, newType: BlockType) => {
    const updated = blocks.map(b => {
      if (b.id === blockId) {
        if (newType === 'table') {
          return {
            ...b,
            type: newType,
            tableData: [['Col 1', 'Col 2'], ['', '']]
          };
        }
        return {
          ...b,
          type: newType
        };
      }
      return b;
    });
    commitBlocks(updated);
  };

  // 鍵盤輸入事件
  const handleBlockKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, block: DocumentBlock, index: number) => {
    if (slashMenuBlockId === block.id) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex(prev => (prev + 1) % (filteredSlashCommands.length || 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex(prev => (prev - 1 + filteredSlashCommands.length) % (filteredSlashCommands.length || 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredSlashCommands[slashIndex]) {
          applySlashCommand(block.id, filteredSlashCommands[slashIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        setSlashMenuBlockId(null);
        return;
      }
    }

    // 快捷鍵 Bold / Italic / Underline
    if (e.metaKey || e.ctrlKey) {
      if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        applyInlineFormatting('bold', block.id);
        return;
      }
      if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        applyInlineFormatting('italic', block.id);
        return;
      }
      if (e.key.toLowerCase() === 'u') {
        e.preventDefault();
        applyInlineFormatting('underline', block.id);
        return;
      }
    }

    // Enter: 建立下一個 Block
    if (e.key === 'Enter' && !e.shiftKey && block.type !== 'code') {
      e.preventDefault();
      const nextType = block.type === 'bullet' ? 'bullet' : block.type === 'numbered' ? 'numbered' : block.type === 'todo' ? 'todo' : 'paragraph';
      const newBlock = createDefaultBlock(nextType);
      const updated = [...blocks.slice(0, index + 1), newBlock, ...blocks.slice(index + 1)];
      commitBlocks(updated);
      setTimeout(() => {
        const el = document.getElementById(`input-${newBlock.id}`);
        if (el) el.focus();
      }, 50);
      return;
    }

    // Backspace: 當當前行內容為空時刪除或轉回純文本
    if (e.key === 'Backspace' && block.content === '' && blocks.length > 1) {
      e.preventDefault();
      if (block.type !== 'paragraph') {
        commitBlocks(blocks.map(b => b.id === block.id ? { ...b, type: 'paragraph' } : b));
      } else {
        const updated = blocks.filter(b => b.id !== block.id);
        commitBlocks(updated);
        const prev = blocks[index - 1];
        if (prev) {
          setTimeout(() => {
            const el = document.getElementById(`input-${prev.id}`);
            if (el) el.focus();
          }, 50);
        }
      }
    }
  };

  const handleContentChange = (blockId: string, val: string) => {
    const updated = blocks.map(b => b.id === blockId ? { ...b, content: val } : b);
    commitBlocks(updated);

    if (val.startsWith('/')) {
      setSlashMenuBlockId(blockId);
      setSlashQuery(val.slice(1).trim());
      setSlashIndex(0);
    } else {
      setSlashMenuBlockId(null);
    }
  };

  // 選取文字顯示浮動工具列 (Floating Formatting Toolbar)
  const handleSelectText = (e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>, blockId: string) => {
    const target = e.currentTarget;
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;

    if (start !== end) {
      const containerRect = canvasContainerRef.current?.getBoundingClientRect();
      const inputRect = target.getBoundingClientRect();
      if (containerRect) {
        setSelectedRange({ blockId, start, end });
        setToolbarPos({
          top: inputRect.top - containerRect.top - 8,
          left: inputRect.left - containerRect.left + (inputRect.width / 3)
        });
      }
    } else {
      setToolbarPos(null);
      setSelectedRange(null);
    }
  };

  const applyInlineFormatting = (type: 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'link', targetBlockId?: string) => {
    const bId = targetBlockId || selectedRange?.blockId;
    if (!bId) return;

    const block = blocks.find(b => b.id === bId);
    if (!block) return;

    const input = document.getElementById(`input-${bId}`) as HTMLInputElement;
    const start = selectedRange?.start ?? input?.selectionStart ?? 0;
    const end = selectedRange?.end ?? input?.selectionEnd ?? block.content.length;
    const text = block.content;
    const selected = text.substring(start, end);

    let prefix = '';
    let suffix = '';

    if (type === 'bold') { prefix = '**'; suffix = '**'; }
    else if (type === 'italic') { prefix = '*'; suffix = '*'; }
    else if (type === 'underline') { prefix = '<u>'; suffix = '</u>'; }
    else if (type === 'strike') { prefix = '~~'; suffix = '~~'; }
    else if (type === 'code') { prefix = '`'; suffix = '`'; }
    else if (type === 'link') { prefix = '['; suffix = '](https://)'; }

    const formatted = prefix + (selected || 'text') + suffix;
    const newContent = text.substring(0, start) + formatted + text.substring(end);

    const updated = blocks.map(b => b.id === bId ? { ...b, content: newContent } : b);
    commitBlocks(updated);
    setToolbarPos(null);
  };

  return (
    <div style={{
      backgroundColor: '#0c1222',
      border: '1px solid #1e293b',
      borderRadius: '8px',
      overflow: 'visible',
      position: 'relative',
      boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
    }}>
      {/* 頂部狀態列：Notion Clean Header + Autosave 狀態 + Undo/Redo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 14px',
        backgroundColor: '#101626',
        borderBottom: '1px solid #1e293b',
        fontSize: '0.74rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#64748b' }}>
            輸入 <strong style={{ color: '#38bdf8' }}>/</strong> 呼叫指令 | 選取文字彈出工具列
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Autosave 提示 (Saving... / Saved) */}
          <span style={{ color: saveStatus === 'Saving...' ? '#f59e0b' : '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {saveStatus === 'Saved' && <Check size={12} />}
            {saveStatus}
          </span>
        </div>
      </div>

      {/* 畫布核心區 (Notion Block Workspace Canvas) */}
      <div
        ref={canvasContainerRef}
        style={{
          padding: '20px 24px 20px 38px',
          minHeight,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          position: 'relative'
        }}
      >
        {/* 全域單一 6 點拖曳手柄 (Global Floating Drag Handle) */}
        <BlockDragHandle
          containerRef={canvasContainerRef}
          onReorder={handleReorder}
          onDelete={handleDeleteBlock}
          onDuplicate={handleDuplicateBlock}
          onTurnInto={handleTurnInto}
          blocks={blocks}
        />

        {/* 浮動格式化工具列 (Floating Format Toolbar on Text Selection) */}
        {toolbarPos && (
          <FloatingFormatToolbar
            position={toolbarPos}
            onFormat={applyInlineFormatting}
          />
        )}

        {/* 渲染所有 Blocks */}
        {blocks.map((block, index) => {
          const isSlashActive = slashMenuBlockId === block.id;

          // 1. Divider
          if (block.type === 'divider') {
            return (
              <div key={block.id} data-block-id={block.id} style={{ padding: '6px 0' }}>
                <hr style={{ border: 'none', borderTop: '1px solid #1e293b', margin: 0 }} />
              </div>
            );
          }

          // 2. Code Block
          if (block.type === 'code') {
            return (
              <div key={block.id} data-block-id={block.id} style={{
                margin: '8px 0',
                backgroundColor: '#070b14',
                border: '1px solid #1e293b',
                borderRadius: '6px',
                overflow: 'hidden'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 12px', backgroundColor: '#0e1526', borderBottom: '1px solid #1e293b', fontSize: '0.72rem', color: '#64748b' }}>
                  <span>{block.lang || 'javascript'}</span>
                  <button type="button" onClick={() => handleDeleteBlock(block.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.7rem' }}>刪除</button>
                </div>
                <textarea
                  id={`input-${block.id}`}
                  rows={4}
                  value={block.content}
                  onChange={(e) => handleContentChange(block.id, e.target.value)}
                  onKeyDown={(e) => handleBlockKeyDown(e, block, index)}
                  onSelect={(e) => handleSelectText(e, block.id)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'transparent',
                    border: 'none',
                    color: '#38bdf8',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            );
          }

          // 3. Simple Table
          if (block.type === 'table') {
            const rows = block.tableData || [['', ''], ['', '']];
            return (
              <div key={block.id} data-block-id={block.id} style={{ margin: '8px 0' }}>
                <table style={{ borderCollapse: 'collapse', border: '1px solid #2d3b55' }}>
                  <tbody>
                    {rows.map((row, rIdx) => (
                      <tr key={rIdx} style={{ borderBottom: '1px solid #2d3b55' }}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} style={{ borderRight: '1px solid #2d3b55', padding: 0 }}>
                            <input
                              type="text"
                              value={cell}
                              onChange={(e) => {
                                const newTable = rows.map((rw, ri) => 
                                  ri === rIdx ? rw.map((cl, ci) => ci === cIdx ? e.target.value : cl) : rw
                                );
                                commitBlocks(blocks.map(b => b.id === block.id ? { ...b, tableData: newTable } : b));
                              }}
                              style={{
                                width: '100px',
                                padding: '6px 10px',
                                background: 'transparent',
                                border: 'none',
                                color: '#f8fafc',
                                outline: 'none'
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          // 4. 文字段落 / 標題 / 清單 / 引述 / 待辦
          return (
            <div key={block.id} data-block-id={block.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
              {block.type === 'bullet' && <span style={{ color: '#94a3b8', fontSize: '1.1rem', lineHeight: 1 }}>•</span>}
              {block.type === 'numbered' && <span style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 600, minWidth: '16px' }}>{index + 1}.</span>}
              {block.type === 'todo' && (
                <input
                  type="checkbox"
                  checked={!!block.checked}
                  onChange={(e) => {
                    commitBlocks(blocks.map(b => b.id === block.id ? { ...b, checked: e.target.checked } : b));
                  }}
                  style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#38bdf8' }}
                />
              )}
              {block.type === 'quote' && (
                <span style={{ width: '3px', height: '24px', backgroundColor: '#38bdf8', borderRadius: '2px', display: 'inline-block', flexShrink: 0 }} />
              )}

              <input
                id={`input-${block.id}`}
                type="text"
                autoFocus={autoFocus && index === 0}
                value={block.content}
                onChange={(e) => handleContentChange(block.id, e.target.value)}
                onKeyDown={(e) => handleBlockKeyDown(e, block, index)}
                onSelect={(e) => handleSelectText(e, block.id)}
                placeholder={index === 0 ? "輸入文字，或輸入 '/' 呼叫指令..." : ""}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: block.checked ? '#64748b' : '#f8fafc',
                  textDecoration: block.checked ? 'line-through' : 'none',
                  fontSize: block.type === 'heading_1' ? '1.35rem' : block.type === 'heading_2' ? '1.18rem' : block.type === 'heading_3' ? '1.02rem' : '0.9rem',
                  fontWeight: block.type === 'heading_1' ? 800 : block.type === 'heading_2' ? 700 : block.type === 'heading_3' ? 600 : 400,
                  outline: 'none',
                  padding: '3px 0'
                }}
              />

              {/* Slash Command 下拉浮層 */}
              {isSlashActive && filteredSlashCommands.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '20px',
                  width: '260px',
                  backgroundColor: '#161f32',
                  border: '1px solid #2d3b55',
                  borderRadius: '8px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
                  zIndex: 100,
                  overflow: 'hidden'
                }}>
                  <div style={{ padding: '6px 10px', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #1e293b' }}>
                    BASIC BLOCKS
                  </div>
                  <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '4px' }}>
                    {filteredSlashCommands.map((cmd, cIdx) => (
                      <div
                        key={cmd.id}
                        onClick={() => applySlashCommand(block.id, cmd)}
                        onMouseEnter={() => setSlashIndex(cIdx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          backgroundColor: cIdx === slashIndex ? '#1e293b' : 'transparent',
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
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f8fafc' }}>{cmd.title}</div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{cmd.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 底部操作按鈕 */}
      {showActions && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
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
            Cmd+Z 復原 | Cmd+Shift+Z 重做 | Enter 換塊
          </span>
        </div>
      )}
    </div>
  );
};
