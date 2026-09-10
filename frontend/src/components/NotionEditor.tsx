import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Copy, 
  CornerDownLeft, 
  MoreHorizontal,
  Table as TableIcon,
  Code as CodeIcon,
  Check,
  Trash2
} from 'lucide-react';
import { BlockDragHandle } from './BlockDragHandle';

export type BlockType = 
  | 'p' 
  | 'h1' 
  | 'h2' 
  | 'h3' 
  | 'toggle' 
  | 'bullet' 
  | 'numbered' 
  | 'todo' 
  | 'quote' 
  | 'code' 
  | 'table';

export interface NotionBlock {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
  lang?: string;
  isOpen?: boolean; // for toggle list
  toggleColor?: string; // e.g. yellow, green, gray
  tableData?: string[][]; // for table
}

const SUPPORTED_LANGUAGES = [
  'Bash', 'JavaScript', 'TypeScript', 'Python', 'HTML', 'CSS', 'JSON', 'SQL',
  'Java', 'C', 'C++', 'C#', 'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin',
  'Dart', 'YAML', 'Markdown', 'ABAP', 'Agda', 'Arduino', 'Assembly', 'BASIC',
  'Clojure', 'CoffeeScript', 'Docker', 'Elixir', 'GraphQL', 'Lua', 'R', 'Scala'
];

export const parseTextToBlocks = (text: string): NotionBlock[] => {
  if (!text || !text.trim()) {
    return [{ id: 'b_' + Math.random().toString(36).substr(2, 9), type: 'p', content: '' }];
  }

  const lines = text.split('\n');
  const blocks: NotionBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Code block (```lang ... ```)
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim() || 'Bash';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push({
        id: 'b_' + Math.random().toString(36).substr(2, 9),
        type: 'code',
        content: codeLines.join('\n'),
        lang
      });
      continue;
    }

    // 2. Table (| a | b |)
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
        id: 'b_' + Math.random().toString(36).substr(2, 9),
        type: 'table',
        content: '',
        tableData: cleanRows.length > 0 ? cleanRows : [
          ['', '', '', ''],
          ['', '', '', ''],
          ['', '', '', '']
        ]
      });
      continue;
    }

    // 3. Toggle heading / list (▶ or > [!toggle])
    if (line.startsWith('▶ ') || line.startsWith('> ') && line.includes('toggle')) {
      blocks.push({
        id: 'b_' + Math.random().toString(36).substr(2, 9),
        type: 'toggle',
        content: line.replace('▶ ', '').replace(/^>\s*/, ''),
        isOpen: true,
        toggleColor: '#fef3c7' // light amber background like Notion
      });
    } else if (line.startsWith('# ')) {
      blocks.push({ id: 'b_' + Math.random().toString(36).substr(2, 9), type: 'h1', content: line.slice(2) });
    } else if (line.startsWith('## ')) {
      blocks.push({ id: 'b_' + Math.random().toString(36).substr(2, 9), type: 'h2', content: line.slice(3) });
    } else if (line.startsWith('### ')) {
      blocks.push({ id: 'b_' + Math.random().toString(36).substr(2, 9), type: 'h3', content: line.slice(4) });
    } else if (line.startsWith('- [ ] ')) {
      blocks.push({ id: 'b_' + Math.random().toString(36).substr(2, 9), type: 'todo', content: line.slice(6), checked: false });
    } else if (line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
      blocks.push({ id: 'b_' + Math.random().toString(36).substr(2, 9), type: 'todo', content: line.slice(6), checked: true });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({ id: 'b_' + Math.random().toString(36).substr(2, 9), type: 'bullet', content: line.slice(2) });
    } else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^\d+\.\s(.*)$/);
      blocks.push({ id: 'b_' + Math.random().toString(36).substr(2, 9), type: 'numbered', content: match ? match[1] : line });
    } else if (line.startsWith('> ')) {
      blocks.push({ id: 'b_' + Math.random().toString(36).substr(2, 9), type: 'quote', content: line.slice(2) });
    } else {
      blocks.push({ id: 'b_' + Math.random().toString(36).substr(2, 9), type: 'p', content: line });
    }

    i++;
  }

  return blocks.length > 0 ? blocks : [{ id: 'b_' + Math.random().toString(36).substr(2, 9), type: 'p', content: '' }];
};

export const serializeBlocksToText = (blocks: NotionBlock[]): string => {
  return blocks.map(b => {
    switch (b.type) {
      case 'toggle': return `▶ ${b.content}`;
      case 'h1': return `# ${b.content}`;
      case 'h2': return `## ${b.content}`;
      case 'h3': return `### ${b.content}`;
      case 'bullet': return `- ${b.content}`;
      case 'numbered': return `1. ${b.content}`;
      case 'todo': return `- [${b.checked ? 'x' : ' '}] ${b.content}`;
      case 'quote': return `> ${b.content}`;
      case 'code': return `\`\`\`${b.lang || 'Bash'}\n${b.content}\n\`\`\``;
      case 'table': {
        const rows = b.tableData || [['', ''], ['', '']];
        if (rows.length === 0) return '';
        const header = `| ${rows[0].map(c => c || ' ').join(' | ')} |`;
        const sep = `| ${rows[0].map(() => '---').join(' | ')} |`;
        const body = rows.slice(1).map(r => `| ${r.map(c => c || ' ').join(' | ')} |`).join('\n');
        return `${header}\n${sep}\n${body}`;
      }
      default: return b.content;
    }
  }).join('\n');
};

// 唯讀模式渲染 (卡片未編輯狀態)
export const renderMarkdownContent = (content: string) => {
  const blocks = parseTextToBlocks(content);
  if (!content || !content.trim()) {
    return <span style={{ color: '#64748b', fontStyle: 'italic' }}>尚無內容 (點擊編輯)</span>;
  }

  return (
    <div style={{ lineHeight: 1.6, color: '#e2e8f0', fontSize: '0.88rem' }}>
      {blocks.map((b, idx) => {
        if (b.type === 'toggle') {
          return (
            <div key={idx} style={{
              margin: '6px 0',
              padding: '6px 10px',
              backgroundColor: b.toggleColor || 'rgba(254, 243, 199, 0.12)',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '1.05rem',
              color: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>▶</span>
              <span>{b.content}</span>
            </div>
          );
        }
        if (b.type === 'h1') return <h1 key={idx} style={{ fontSize: '1.35rem', fontWeight: 700, margin: '12px 0 6px 0', color: '#f8fafc' }}>{b.content}</h1>;
        if (b.type === 'h2') return <h2 key={idx} style={{ fontSize: '1.18rem', fontWeight: 600, margin: '10px 0 4px 0', color: '#f8fafc' }}>{b.content}</h2>;
        if (b.type === 'h3') return <h3 key={idx} style={{ fontSize: '1.02rem', fontWeight: 600, margin: '8px 0 3px 0', color: '#38bdf8' }}>{b.content}</h3>;
        if (b.type === 'bullet') {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', margin: '3px 0' }}>
              <span style={{ color: '#94a3b8', marginTop: '2px' }}>•</span>
              <span>{b.content}</span>
            </div>
          );
        }
        if (b.type === 'todo') {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0', color: b.checked ? '#64748b' : '#e2e8f0', textDecoration: b.checked ? 'line-through' : 'none' }}>
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
        if (b.type === 'table') {
          const rows = b.tableData || [];
          if (rows.length === 0) return null;
          return (
            <div key={idx} style={{ margin: '12px 0', overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', border: '1px solid #2d3b55', fontSize: '0.84rem' }}>
                <tbody>
                  {rows.map((row, rIdx) => (
                    <tr key={rIdx} style={{ borderBottom: '1px solid #2d3b55' }}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} style={{ borderRight: '1px solid #2d3b55', padding: '8px 14px', color: '#f8fafc', minWidth: '80px' }}>
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
        if (b.type === 'code') {
          return (
            <div key={idx} style={{ margin: '12px 0', backgroundColor: '#070b14', border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 12px', borderBottom: '1px solid #1e293b', fontSize: '0.72rem', color: '#94a3b8' }}>
                {b.lang || 'Bash'}
              </div>
              <pre style={{ margin: 0, padding: '12px 14px', color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.84rem' }}>
                <code>{b.content || ''}</code>
              </pre>
            </div>
          );
        }
        return <div key={idx} style={{ margin: '3px 0' }}>{b.content}</div>;
      })}
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

/**
 * 像素級還原 Notion 原生體驗的 Block 編輯器 (對齊使用者截圖)
 * 1. Toggle Header 帶圓角高亮底色背景 (如 Cloudflare pages (Frontend))
 * 2. 精確還原 Notion 原生 Table: 淺灰色純網格 (Simple Table Grid)
 * 3. 精確還原 Notion 原生 Code Block: 右下角/右上角浮動 [Bash ▾] [Copy] [↩] [•••] 控制列
 * 4. 點擊語言按鈕彈出 Notion 式語言搜尋列表 (如截圖的搜尋語言清單)
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
  showActions = true
}) => {
  const [blocks, setBlocks] = useState<NotionBlock[]>(() => parseTextToBlocks(value));
  const [slashMenuBlockId, setSlashMenuBlockId] = useState<string | null>(null);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);

  // 程式碼語言選擇浮層狀態
  const [langMenuBlockId, setLangMenuBlockId] = useState<string | null>(null);
  const [langSearchQuery, setLangSearchQuery] = useState('');

  const langSearchInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentSerialized = serializeBlocksToText(blocks);
    if (value !== currentSerialized) {
      setBlocks(parseTextToBlocks(value));
    }
  }, [value]);

  const updateBlocks = (newBlocks: NotionBlock[]) => {
    setBlocks(newBlocks);
    onChange(serializeBlocksToText(newBlocks));
  };

  const commandItems = [
    {
      id: 'table',
      title: 'Table',
      description: 'Notion 網格式簡單表格',
      icon: <TableIcon size={14} />,
      create: () => ({
        type: 'table' as BlockType,
        content: '',
        tableData: [
          ['', '', '', ''],
          ['', '', '', ''],
          ['', '', '', ''],
          ['', '', '', '']
        ]
      })
    },
    {
      id: 'code',
      title: 'Code block',
      description: '代碼區塊 (含語言選擇)',
      icon: <CodeIcon size={14} />,
      create: () => ({
        type: 'code' as BlockType,
        content: '',
        lang: 'Bash'
      })
    },
    {
      id: 'toggle',
      title: 'Toggle list / heading',
      description: '可折疊高亮標題 (如截圖)',
      icon: <ChevronRight size={14} />,
      create: () => ({
        type: 'toggle' as BlockType,
        content: '',
        isOpen: true,
        toggleColor: '#fef3c7'
      })
    },
    {
      id: 'h1',
      title: 'Heading 1',
      description: '大標題',
      icon: <span style={{ fontWeight: 800, fontSize: '11px' }}>H1</span>,
      create: () => ({ type: 'h1' as BlockType, content: '' })
    },
    {
      id: 'h2',
      title: 'Heading 2',
      description: '中標題',
      icon: <span style={{ fontWeight: 800, fontSize: '11px' }}>H2</span>,
      create: () => ({ type: 'h2' as BlockType, content: '' })
    },
    {
      id: 'todo',
      title: 'To-do list',
      description: '勾選方塊',
      icon: <span style={{ fontSize: '12px' }}>☑</span>,
      create: () => ({ type: 'todo' as BlockType, content: '', checked: false })
    },
    {
      id: 'bullet',
      title: 'Bulleted list',
      description: '圓點項目清單',
      icon: <span style={{ fontSize: '14px' }}>•</span>,
      create: () => ({ type: 'bullet' as BlockType, content: '' })
    }
  ];

  const filteredCommands = commandItems.filter(c => 
    c.title.toLowerCase().includes(slashQuery.toLowerCase()) || 
    c.id.toLowerCase().includes(slashQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(slashQuery.toLowerCase())
  );

  const applyCommand = (blockId: string, cmd: typeof commandItems[0]) => {
    const newBlocks = blocks.map(b => {
      if (b.id === blockId) {
        return {
          ...b,
          ...cmd.create()
        };
      }
      return b;
    });
    updateBlocks(newBlocks);
    setSlashMenuBlockId(null);
    setSlashQuery('');
  };

  const handleKeyDownOnText = (e: React.KeyboardEvent<HTMLInputElement>, block: NotionBlock, index: number) => {
    if (slashMenuBlockId === block.id) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex(prev => (prev + 1) % (filteredCommands.length || 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex(prev => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[slashIndex]) {
          applyCommand(block.id, filteredCommands[slashIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        setSlashMenuBlockId(null);
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const newBlock: NotionBlock = {
        id: 'b_' + Math.random().toString(36).substr(2, 9),
        type: 'p',
        content: ''
      };
      const updated = [...blocks.slice(0, index + 1), newBlock, ...blocks.slice(index + 1)];
      updateBlocks(updated);
      setTimeout(() => {
        const el = document.getElementById(`input-${newBlock.id}`);
        if (el) el.focus();
      }, 50);
      return;
    }

    if (e.key === 'Backspace' && block.content === '' && blocks.length > 1) {
      e.preventDefault();
      const updated = blocks.filter(b => b.id !== block.id);
      updateBlocks(updated);
      const prevBlock = blocks[index - 1];
      if (prevBlock) {
        setTimeout(() => {
          const el = document.getElementById(`input-${prevBlock.id}`);
          if (el) el.focus();
        }, 50);
      }
    }
  };

  const handleInputChange = (blockId: string, value: string) => {
    const updated = blocks.map(b => b.id === blockId ? { ...b, content: value } : b);
    updateBlocks(updated);

    if (value.startsWith('/')) {
      setSlashMenuBlockId(blockId);
      setSlashQuery(value.slice(1));
      setSlashIndex(0);
    } else {
      setSlashMenuBlockId(null);
    }
  };

  // 表格處理
  const updateTableCell = (blockId: string, rIdx: number, cIdx: number, val: string) => {
    const updated = blocks.map(b => {
      if (b.id === blockId && b.tableData) {
        const newTable = b.tableData.map((row, ri) => 
          ri === rIdx ? row.map((cell, ci) => ci === cIdx ? val : cell) : row
        );
        return { ...b, tableData: newTable };
      }
      return b;
    });
    updateBlocks(updated);
  };

  const addTableRow = (blockId: string) => {
    const updated = blocks.map(b => {
      if (b.id === blockId && b.tableData) {
        const colCount = b.tableData[0]?.length || 4;
        const newRow = Array(colCount).fill('');
        return { ...b, tableData: [...b.tableData, newRow] };
      }
      return b;
    });
    updateBlocks(updated);
  };

  const addTableCol = (blockId: string) => {
    const updated = blocks.map(b => {
      if (b.id === blockId && b.tableData) {
        const newTable = b.tableData.map(row => [...row, '']);
        return { ...b, tableData: newTable };
      }
      return b;
    });
    updateBlocks(updated);
  };

  const removeBlock = (blockId: string) => {
    const updated = blocks.filter(b => b.id !== blockId);
    updateBlocks(updated.length > 0 ? updated : [{ id: 'b_' + Math.random().toString(36).substr(2, 9), type: 'p', content: '' }]);
  };

  // 拖曳重排 (Reorder Blocks via 6-dots handle)
  const handleReorder = (sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex || sourceIndex < 0 || targetIndex < 0) return;
    const updated = [...blocks];
    const [movedBlock] = updated.splice(sourceIndex, 1);
    updated.splice(targetIndex, 0, movedBlock);
    updateBlocks(updated);
  };

  // 複製 Block (Duplicate)
  const handleDuplicate = (blockId: string) => {
    const idx = blocks.findIndex(b => b.id === blockId);
    if (idx === -1) return;
    const target = blocks[idx];
    const duplicated: NotionBlock = {
      ...target,
      id: 'b_' + Math.random().toString(36).substr(2, 9),
      content: target.content,
      tableData: target.tableData ? JSON.parse(JSON.stringify(target.tableData)) : undefined
    };
    const updated = [...blocks.slice(0, idx + 1), duplicated, ...blocks.slice(idx + 1)];
    updateBlocks(updated);
  };

  // 轉換類型 (Turn into)
  const handleTurnInto = (blockId: string, newType: BlockType) => {
    const updated = blocks.map(b => {
      if (b.id === blockId) {
        if (newType === 'table') {
          return {
            ...b,
            type: newType,
            tableData: [
              ['Header 1', 'Header 2'],
              ['Data 1', 'Data 2']
            ]
          };
        }
        return {
          ...b,
          type: newType
        };
      }
      return b;
    });
    updateBlocks(updated);
  };

  const filteredLanguages = SUPPORTED_LANGUAGES.filter(lang => 
    lang.toLowerCase().includes(langSearchQuery.toLowerCase())
  );

  return (
    <div style={{
      backgroundColor: '#0c1222',
      border: '1px solid #1e293b',
      borderRadius: '8px',
      overflow: 'visible',
      position: 'relative',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
    }}>
      {/* 頂部快捷 Notion 工具列 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        backgroundColor: '#101626',
        borderBottom: '1px solid #1e293b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={() => {
              const newBlock: NotionBlock = {
                id: 'b_' + Math.random().toString(36).substr(2, 9),
                type: 'toggle',
                content: '新折疊標題 (Toggle)',
                isOpen: true,
                toggleColor: '#fef3c7'
              };
              updateBlocks([...blocks, newBlock]);
            }}
            style={{ padding: '3px 8px', background: '#1e293b', border: '1px solid #334155', color: '#fef3c7', borderRadius: '4px', cursor: 'pointer', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
          >
            ▶ + Toggle (折疊區)
          </button>
          <button
            type="button"
            onClick={() => {
              const newBlock: NotionBlock = {
                id: 'b_' + Math.random().toString(36).substr(2, 9),
                type: 'table',
                content: '',
                tableData: [
                  ['', '', '', ''],
                  ['', '', '', ''],
                  ['', '', '', ''],
                  ['', '', '', '']
                ]
              };
              updateBlocks([...blocks, newBlock]);
            }}
            style={{ padding: '3px 8px', background: '#1e293b', border: '1px solid #334155', color: '#38bdf8', borderRadius: '4px', cursor: 'pointer', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
          >
            <TableIcon size={12} /> + Table (網格表格)
          </button>
          <button
            type="button"
            onClick={() => {
              const newBlock: NotionBlock = {
                id: 'b_' + Math.random().toString(36).substr(2, 9),
                type: 'code',
                content: '',
                lang: 'Bash'
              };
              updateBlocks([...blocks, newBlock]);
            }}
            style={{ padding: '3px 8px', background: '#1e293b', border: '1px solid #334155', color: '#93c5fd', borderRadius: '4px', cursor: 'pointer', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
          >
            <CodeIcon size={12} /> + Code (代碼框)
          </button>
        </div>
        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
          支援鍵入 <strong style={{ color: '#38bdf8' }}>/table</strong>, <strong style={{ color: '#38bdf8' }}>/code</strong>, <strong style={{ color: '#38bdf8' }}>/toggle</strong>
        </div>
      </div>

      {/* Notion Block Canvas (畫布含左側 6 點拖曳手柄槽 Gutter) */}
      <div 
        ref={canvasContainerRef} 
        style={{ 
          padding: '16px 20px 16px 36px', 
          minHeight, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '10px',
          position: 'relative' 
        }}
      >
        {/* 全域單一 6 點浮動拖曳手柄 (Global Floating Drag Handle) */}
        <BlockDragHandle
          containerRef={canvasContainerRef}
          onReorder={handleReorder}
          onDelete={removeBlock}
          onDuplicate={handleDuplicate}
          onTurnInto={handleTurnInto}
          blocks={blocks}
        />

        {blocks.map((block, index) => {
          const isSlashActive = slashMenuBlockId === block.id;

          // 1. Toggle Heading (像素級還原截圖黃色/綠色背景與小黑箭頭)
          if (block.type === 'toggle') {
            return (
              <div key={block.id} data-block-id={block.id} style={{ margin: '4px 0' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: block.toggleColor || '#fef3c7',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = blocks.map(b => b.id === block.id ? { ...b, isOpen: !b.isOpen } : b);
                      updateBlocks(updated);
                    }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#1e293b' }}
                  >
                    {block.isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <input
                    type="text"
                    value={block.content}
                    onChange={(e) => {
                      const updated = blocks.map(b => b.id === block.id ? { ...b, content: e.target.value } : b);
                      updateBlocks(updated);
                    }}
                    placeholder="Toggle heading..."
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      color: '#0f172a',
                      fontWeight: 800,
                      fontSize: '1.1rem',
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      title="黃色背景"
                      onClick={() => updateBlocks(blocks.map(b => b.id === block.id ? { ...b, toggleColor: '#fef3c7' } : b))}
                      style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#fef3c7', border: '1px solid #d97706', cursor: 'pointer' }}
                    />
                    <button
                      type="button"
                      title="綠色背景"
                      onClick={() => updateBlocks(blocks.map(b => b.id === block.id ? { ...b, toggleColor: '#dcfce7' } : b))}
                      style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#dcfce7', border: '1px solid #16a34a', cursor: 'pointer' }}
                    />
                    <button
                      type="button"
                      title="刪除"
                      onClick={() => removeBlock(block.id)}
                      style={{ background: 'transparent', border: 'none', color: '#991b1b', cursor: 'pointer', padding: '0 2px' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // 2. Notion Simple Table (像素級還原截圖的乾淨無色網格)
          if (block.type === 'table') {
            const rows = block.tableData || [];
            return (
              <div key={block.id} data-block-id={block.id} style={{ margin: '8px 0', position: 'relative' }}>
                <div style={{ overflowX: 'auto', borderRadius: '4px' }}>
                  <table style={{ borderCollapse: 'collapse', border: '1px solid #2d3b55', width: 'auto', minWidth: '320px' }}>
                    <tbody>
                      {rows.map((row, rIdx) => (
                        <tr key={rIdx} style={{ borderBottom: '1px solid #2d3b55' }}>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} style={{ borderRight: '1px solid #2d3b55', padding: 0, minWidth: '90px', width: '120px' }}>
                              <input
                                type="text"
                                value={cell}
                                onChange={(e) => updateTableCell(block.id, rIdx, cIdx, e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '7px 10px',
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#f8fafc',
                                  fontSize: '0.86rem',
                                  outline: 'none',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button type="button" onClick={() => addTableRow(block.id)} style={{ padding: '2px 8px', fontSize: '0.72rem', backgroundColor: '#131b2e', border: '1px solid #2d3b55', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer' }}>+ 行</button>
                  <button type="button" onClick={() => addTableCol(block.id)} style={{ padding: '2px 8px', fontSize: '0.72rem', backgroundColor: '#131b2e', border: '1px solid #2d3b55', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer' }}>+ 列</button>
                  <button type="button" onClick={() => removeBlock(block.id)} style={{ padding: '2px 6px', fontSize: '0.72rem', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>刪除表格</button>
                </div>
              </div>
            );
          }

          // 3. Notion Code Block (像素級還原截圖右下角控制列 [Bash ▾] [Copy] [↩] [•••] 及語言選單)
          if (block.type === 'code') {
            const isLangMenuOpen = langMenuBlockId === block.id;

            return (
              <div key={block.id} data-block-id={block.id} style={{
                margin: '10px 0',
                backgroundColor: '#131b2e',
                border: '1px solid #243049',
                borderRadius: '6px',
                position: 'relative',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}>
                <textarea
                  rows={4}
                  value={block.content}
                  onChange={(e) => {
                    const updated = blocks.map(b => b.id === block.id ? { ...b, content: e.target.value } : b);
                    updateBlocks(updated);
                  }}
                  placeholder="// 輸入代碼..."
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#f8fafc',
                    fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, monospace',
                    fontSize: '0.86rem',
                    lineHeight: 1.5,
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />

                {/* Notion 原生控制列 (截圖右下角) */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  padding: '4px 10px',
                  borderTop: '1px solid #1e293b'
                }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    backgroundColor: '#1c263d',
                    border: '1px solid #2d3b55',
                    borderRadius: '5px',
                    padding: '2px 4px',
                    gap: '4px',
                    position: 'relative'
                  }}>
                    {/* 語言選擇按鈕 (如截圖之 Bash ▾) */}
                    <button
                      type="button"
                      onClick={() => {
                        setLangMenuBlockId(isLangMenuOpen ? null : block.id);
                        setLangSearchQuery('');
                        setTimeout(() => {
                          if (langSearchInputRef.current) langSearchInputRef.current.focus();
                        }, 50);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        fontSize: '0.74rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                        padding: '2px 6px'
                      }}
                    >
                      {block.lang || 'Bash'} <ChevronDown size={11} />
                    </button>

                    <span style={{ width: '1px', height: '12px', backgroundColor: '#334155' }} />

                    {/* 複製按鈕 */}
                    <button
                      type="button"
                      title="複製代碼"
                      onClick={() => {
                        navigator.clipboard.writeText(block.content);
                        alert('已複製到剪貼簿');
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px 4px' }}
                    >
                      <Copy size={12} />
                    </button>

                    {/* 自動換行按鈕 */}
                    <button
                      type="button"
                      title="換行"
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px 4px' }}
                    >
                      <CornerDownLeft size={12} />
                    </button>

                    {/* 更多選項 (刪除) */}
                    <button
                      type="button"
                      onClick={() => removeBlock(block.id)}
                      title="刪除代碼塊"
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px 4px' }}
                    >
                      <MoreHorizontal size={12} />
                    </button>

                    {/* 像素級還原截圖的 Notion 語言搜尋選單 (White/Dark theme popover with checkmark) */}
                    {isLangMenuOpen && (
                      <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        right: 0,
                        width: '240px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                        marginBottom: '6px',
                        zIndex: 150,
                        overflow: 'hidden',
                        color: '#0f172a'
                      }}>
                        <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                          <input
                            ref={langSearchInputRef}
                            type="text"
                            placeholder="搜尋語言..."
                            value={langSearchQuery}
                            onChange={(e) => setLangSearchQuery(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '5px 8px',
                              backgroundColor: '#ffffff',
                              border: '2px solid #2563eb',
                              borderRadius: '5px',
                              fontSize: '0.8rem',
                              outline: 'none',
                              boxSizing: 'border-box',
                              color: '#0f172a'
                            }}
                          />
                        </div>
                        <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '4px 0' }}>
                          {filteredLanguages.map(lang => {
                            const isSelected = (block.lang || 'Bash').toLowerCase() === lang.toLowerCase();
                            return (
                              <div
                                key={lang}
                                onClick={() => {
                                  updateBlocks(blocks.map(b => b.id === block.id ? { ...b, lang } : b));
                                  setLangMenuBlockId(null);
                                }}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '6px 12px',
                                  cursor: 'pointer',
                                  fontSize: '0.82rem',
                                  backgroundColor: isSelected ? '#f1f5f9' : 'transparent',
                                  color: '#1e293b'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isSelected ? '#f1f5f9' : 'transparent'}
                              >
                                <span>{lang}</span>
                                {isSelected && <Check size={14} color="#2563eb" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          // 4. 普通文字段落 / 標題 / 清單
          return (
            <div key={block.id} data-block-id={block.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
              {block.type === 'bullet' && (
                <span style={{ color: '#94a3b8', fontSize: '1.1rem', lineHeight: 1 }}>•</span>
              )}
              {block.type === 'todo' && (
                <input
                  type="checkbox"
                  checked={!!block.checked}
                  onChange={(e) => {
                    const updated = blocks.map(b => b.id === block.id ? { ...b, checked: e.target.checked } : b);
                    updateBlocks(updated);
                  }}
                  style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#38bdf8' }}
                />
              )}
              <input
                id={`input-${block.id}`}
                type="text"
                autoFocus={autoFocus && index === 0}
                value={block.content}
                onChange={(e) => handleInputChange(block.id, e.target.value)}
                onKeyDown={(e) => handleKeyDownOnText(e, block, index)}
                placeholder={index === 0 ? "輸入文字，或輸入 '/' 呼叫指令..." : ""}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: block.checked ? '#64748b' : '#f8fafc',
                  textDecoration: block.checked ? 'line-through' : 'none',
                  fontSize: block.type === 'h1' ? '1.3rem' : block.type === 'h2' ? '1.15rem' : '0.9rem',
                  fontWeight: block.type === 'h1' || block.type === 'h2' ? 700 : 400,
                  outline: 'none',
                  padding: '3px 0'
                }}
              />

              {/* Slash Command 下拉浮層 */}
              {isSlashActive && filteredCommands.length > 0 && (
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
                    NOTION BLOCKS
                  </div>
                  <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '4px' }}>
                    {filteredCommands.map((cmd, cIdx) => (
                      <div
                        key={cmd.id}
                        onClick={() => applyCommand(block.id, cmd)}
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

      {/* 底部 Save / Cancel */}
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
            Enter 換行 / 塊 | Backspace 刪除
          </span>
        </div>
      )}
    </div>
  );
};
