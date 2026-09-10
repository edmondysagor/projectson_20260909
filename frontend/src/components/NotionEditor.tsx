import React, { useState, useEffect } from 'react';
import { 
  List, 
  CheckSquare, 
  Code, 
  Quote, 
  Heading1, 
  Heading2, 
  Heading3, 
  Table as TableIcon
} from 'lucide-react';

export type BlockType = 
  | 'p' 
  | 'h1' 
  | 'h2' 
  | 'h3' 
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
  checked?: boolean; // for todo
  lang?: string; // for code
  tableData?: string[][]; // for table: 2D array [row][col]
}

// 將字串/Markdown 序列化解析為 Block 陣列
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
      const lang = line.trim().slice(3).trim() || 'javascript';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing ```
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
      // 過濾分隔行 |---|---|
      const cleanRows = allRows.filter(r => !r.every(c => /^[-:]+$/.test(c)));
      blocks.push({
        id: 'b_' + Math.random().toString(36).substr(2, 9),
        type: 'table',
        content: '',
        tableData: cleanRows.length > 0 ? cleanRows : [
          ['Header 1', 'Header 2', 'Header 3'],
          ['Data 1', 'Data 2', 'Data 3']
        ]
      });
      continue;
    }

    // 3. Headings
    if (line.startsWith('# ')) {
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

// 將 Block 陣列序列化回標準 Markdown
export const serializeBlocksToText = (blocks: NotionBlock[]): string => {
  return blocks.map(b => {
    switch (b.type) {
      case 'h1': return `# ${b.content}`;
      case 'h2': return `## ${b.content}`;
      case 'h3': return `### ${b.content}`;
      case 'bullet': return `- ${b.content}`;
      case 'numbered': return `1. ${b.content}`;
      case 'todo': return `- [${b.checked ? 'x' : ' '}] ${b.content}`;
      case 'quote': return `> ${b.content}`;
      case 'code': return `\`\`\`${b.lang || 'javascript'}\n${b.content}\n\`\`\``;
      case 'table': {
        const rows = b.tableData || [['Col 1', 'Col 2'], ['Val 1', 'Val 2']];
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

// 唯讀渲染組件 (用於卡片非編輯狀態)
export const renderMarkdownContent = (content: string) => {
  const blocks = parseTextToBlocks(content);
  if (!content || !content.trim()) {
    return <span style={{ color: '#64748b', fontStyle: 'italic' }}>尚無內容 (點擊編輯)</span>;
  }

  return (
    <div style={{ lineHeight: 1.6, color: '#e2e8f0', fontSize: '0.88rem' }}>
      {blocks.map((b, idx) => {
        if (b.type === 'h1') return <h1 key={idx} style={{ fontSize: '1.3rem', fontWeight: 700, margin: '10px 0 6px 0', color: '#f8fafc' }}>{b.content}</h1>;
        if (b.type === 'h2') return <h2 key={idx} style={{ fontSize: '1.15rem', fontWeight: 600, margin: '8px 0 4px 0', color: '#f8fafc' }}>{b.content}</h2>;
        if (b.type === 'h3') return <h3 key={idx} style={{ fontSize: '1.02rem', fontWeight: 600, margin: '6px 0 3px 0', color: '#38bdf8' }}>{b.content}</h3>;
        if (b.type === 'bullet') {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', margin: '3px 0' }}>
              <span style={{ color: '#38bdf8', marginTop: '2px' }}>•</span>
              <span>{b.content}</span>
            </div>
          );
        }
        if (b.type === 'numbered') {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', margin: '3px 0' }}>
              <span style={{ color: '#38bdf8', fontWeight: 600, minWidth: '18px' }}>{idx + 1}.</span>
              <span>{b.content}</span>
            </div>
          );
        }
        if (b.type === 'todo') {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0', color: b.checked ? '#94a3b8' : '#e2e8f0', textDecoration: b.checked ? 'line-through' : 'none' }}>
              <span style={{
                width: '13px',
                height: '13px',
                borderRadius: '3px',
                border: b.checked ? 'none' : '1.5px solid #64748b',
                backgroundColor: b.checked ? '#38bdf8' : 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0c1222',
                fontSize: '9px',
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
            <blockquote key={idx} style={{ margin: '6px 0', padding: '6px 12px', borderLeft: '3px solid #38bdf8', color: '#94a3b8', fontStyle: 'italic', backgroundColor: 'rgba(56, 189, 248, 0.05)', borderRadius: '0 6px 6px 0' }}>
              {b.content}
            </blockquote>
          );
        }
        if (b.type === 'code') {
          return (
            <div key={idx} style={{ margin: '10px 0', backgroundColor: '#070b14', border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 12px', backgroundColor: '#0e1526', borderBottom: '1px solid #1e293b', fontSize: '0.72rem', color: '#64748b' }}>
                <span>{b.lang || 'Code'}</span>
                <span>Notion Block</span>
              </div>
              <pre style={{ margin: 0, padding: '12px 14px', color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.84rem', lineHeight: 1.5, overflowX: 'auto' }}>
                <code>{b.content || '// Empty code'}</code>
              </pre>
            </div>
          );
        }
        if (b.type === 'table') {
          const rows = b.tableData || [];
          if (rows.length === 0) return null;
          return (
            <div key={idx} style={{ margin: '12px 0', overflowX: 'auto', borderRadius: '8px', border: '1px solid #1e293b', backgroundColor: '#0c1222' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', color: '#e2e8f0' }}>
                <thead>
                  <tr style={{ backgroundColor: '#131b2e', borderBottom: '1px solid #1e293b' }}>
                    {rows[0].map((cell, cIdx) => (
                      <th key={cIdx} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#38bdf8' }}>{cell}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(1).map((row, rIdx) => (
                    <tr key={rIdx} style={{ borderBottom: '1px solid #182235' }}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} style={{ padding: '8px 12px', color: '#cbd5e1' }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return <div key={idx} style={{ margin: '2px 0' }}>{b.content}</div>;
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
 * 真正的 Notion 塊狀即時互動編輯器 (WYSIWYG Block Editor)
 * 當輸入 /table 即在畫面內直接生成即時互動表格 (可直接在單元格打字、加行、加列)
 * 當輸入 /code 即在畫面內直接生成帶有語法深色背景的 Code Block 輸入框
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

  // 當外部 value 改變且非由本地驅動時同步
  useEffect(() => {
    const currentSerialized = serializeBlocksToText(blocks);
    if (value !== currentSerialized) {
      setBlocks(parseTextToBlocks(value));
    }
  }, [value]);

  // 同步通知外部變更
  const updateBlocks = (newBlocks: NotionBlock[]) => {
    setBlocks(newBlocks);
    onChange(serializeBlocksToText(newBlocks));
  };

  const commandItems = [
    {
      id: 'table',
      title: 'Table',
      description: '互動式資料表格',
      icon: <TableIcon size={14} />,
      create: () => ({
        type: 'table' as BlockType,
        content: '',
        tableData: [
          ['Header 1', 'Header 2', 'Header 3'],
          ['Data 1', 'Data 2', 'Data 3'],
          ['Data 4', 'Data 5', 'Data 6']
        ]
      })
    },
    {
      id: 'code',
      title: 'Code block',
      description: '程式碼編輯區塊',
      icon: <Code size={14} />,
      create: () => ({
        type: 'code' as BlockType,
        content: 'console.log("Hello Notion");',
        lang: 'javascript'
      })
    },
    {
      id: 'h1',
      title: 'Heading 1',
      description: '大標題',
      icon: <Heading1 size={14} />,
      create: () => ({ type: 'h1' as BlockType, content: '' })
    },
    {
      id: 'h2',
      title: 'Heading 2',
      description: '中標題',
      icon: <Heading2 size={14} />,
      create: () => ({ type: 'h2' as BlockType, content: '' })
    },
    {
      id: 'h3',
      title: 'Heading 3',
      description: '小標題',
      icon: <Heading3 size={14} />,
      create: () => ({ type: 'h3' as BlockType, content: '' })
    },
    {
      id: 'bullet',
      title: 'Bulleted list',
      description: '無序清單',
      icon: <List size={14} />,
      create: () => ({ type: 'bullet' as BlockType, content: '' })
    },
    {
      id: 'todo',
      title: 'To-do list',
      description: '勾選待辦',
      icon: <CheckSquare size={14} />,
      create: () => ({ type: 'todo' as BlockType, content: '', checked: false })
    },
    {
      id: 'quote',
      title: 'Quote',
      description: '引用語句',
      icon: <Quote size={14} />,
      create: () => ({ type: 'quote' as BlockType, content: '' })
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
        const payload = cmd.create();
        return {
          ...b,
          ...payload
        };
      }
      return b;
    });
    updateBlocks(newBlocks);
    setSlashMenuBlockId(null);
    setSlashQuery('');
  };

  const handleKeyDownOnText = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, block: NotionBlock, index: number) => {
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

    // 按 Enter 建立下一個 Block
    if (e.key === 'Enter' && !e.shiftKey && block.type !== 'code') {
      e.preventDefault();
      const newBlock: NotionBlock = {
        id: 'b_' + Math.random().toString(36).substr(2, 9),
        type: block.type === 'bullet' ? 'bullet' : block.type === 'todo' ? 'todo' : 'p',
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

    // 按 Backspace 且內容為空時刪除或退回普通行
    if (e.key === 'Backspace' && block.content === '' && blocks.length > 1) {
      e.preventDefault();
      if (block.type !== 'p') {
        const updated = blocks.map(b => b.id === block.id ? { ...b, type: 'p' as BlockType } : b);
        updateBlocks(updated);
      } else {
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

  // 表格專用處理
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
        const colCount = b.tableData[0]?.length || 2;
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
        const newTable = b.tableData.map((row, idx) => [...row, idx === 0 ? `Header ${row.length + 1}` : '']);
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

  return (
    <div style={{
      backgroundColor: '#0c1222',
      border: '1px solid #1e293b',
      borderRadius: '8px',
      overflow: 'hidden',
      position: 'relative',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
    }}>
      {/* 頂部快捷 Notion 工具列 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        backgroundColor: '#101626',
        borderBottom: '1px solid #1e293b',
        gap: '4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            title="Heading 1"
            onClick={() => {
              const newBlock: NotionBlock = { id: 'b_' + Math.random().toString(36).substr(2, 9), type: 'h1', content: '' };
              updateBlocks([...blocks, newBlock]);
            }}
            style={{ padding: '4px 6px', background: 'transparent', border: 'none', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}
          >
            H1
          </button>
          <button
            type="button"
            title="Heading 2"
            onClick={() => {
              const newBlock: NotionBlock = { id: 'b_' + Math.random().toString(36).substr(2, 9), type: 'h2', content: '' };
              updateBlocks([...blocks, newBlock]);
            }}
            style={{ padding: '4px 6px', background: 'transparent', border: 'none', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}
          >
            H2
          </button>
          <span style={{ width: '1px', height: '14px', backgroundColor: '#2d3b55', margin: '0 2px' }} />
          <button
            type="button"
            title="Insert Interactive Table"
            onClick={() => {
              const newBlock: NotionBlock = {
                id: 'b_' + Math.random().toString(36).substr(2, 9),
                type: 'table',
                content: '',
                tableData: [
                  ['Header 1', 'Header 2', 'Header 3'],
                  ['Data 1', 'Data 2', 'Data 3'],
                  ['Data 4', 'Data 5', 'Data 6']
                ]
              };
              updateBlocks([...blocks, newBlock]);
            }}
            style={{ padding: '4px 8px', background: '#131b2e', border: '1px solid #2d3b55', color: '#38bdf8', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600 }}
          >
            <TableIcon size={13} /> + 表格
          </button>
          <button
            type="button"
            title="Insert Code Block"
            onClick={() => {
              const newBlock: NotionBlock = {
                id: 'b_' + Math.random().toString(36).substr(2, 9),
                type: 'code',
                content: 'console.log("Hello Notion");',
                lang: 'javascript'
              };
              updateBlocks([...blocks, newBlock]);
            }}
            style={{ padding: '4px 8px', background: '#131b2e', border: '1px solid #2d3b55', color: '#38bdf8', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600 }}
          >
            <Code size={13} /> + 代碼
          </button>
          <button
            type="button"
            title="Insert To-do"
            onClick={() => {
              const newBlock: NotionBlock = { id: 'b_' + Math.random().toString(36).substr(2, 9), type: 'todo', content: '', checked: false };
              updateBlocks([...blocks, newBlock]);
            }}
            style={{ padding: '4px', background: 'transparent', border: 'none', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer' }}
          >
            <CheckSquare size={13} />
          </button>
          <button
            type="button"
            title="Insert Bullet"
            onClick={() => {
              const newBlock: NotionBlock = { id: 'b_' + Math.random().toString(36).substr(2, 9), type: 'bullet', content: '' };
              updateBlocks([...blocks, newBlock]);
            }}
            style={{ padding: '4px', background: 'transparent', border: 'none', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer' }}
          >
            <List size={13} />
          </button>
        </div>
        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
          輸入 <strong style={{ color: '#38bdf8' }}>/</strong> 呼叫 Notion 模組清單
        </div>
      </div>

      {/* Notion 畫布核心區塊 (Block List) */}
      <div style={{ padding: '14px 18px', minHeight, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {blocks.map((block, index) => {
          const isSlashActive = slashMenuBlockId === block.id;

          // 1. Table Block 即時互動表格
          if (block.type === 'table') {
            const rows = block.tableData || [];
            return (
              <div key={block.id} style={{ margin: '8px 0', padding: '10px', backgroundColor: '#070b14', border: '1px solid #1e293b', borderRadius: '8px', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <TableIcon size={14} /> Notion Table (直接在單元格內編輯)
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" onClick={() => addTableRow(block.id)} style={{ padding: '2px 8px', fontSize: '0.72rem', backgroundColor: '#131b2e', border: '1px solid #2d3b55', color: '#38bdf8', borderRadius: '4px', cursor: 'pointer' }}>+ 列 (Row)</button>
                    <button type="button" onClick={() => addTableCol(block.id)} style={{ padding: '2px 8px', fontSize: '0.72rem', backgroundColor: '#131b2e', border: '1px solid #2d3b55', color: '#38bdf8', borderRadius: '4px', cursor: 'pointer' }}>+ 欄 (Col)</button>
                    <button type="button" onClick={() => removeBlock(block.id)} style={{ padding: '2px 6px', fontSize: '0.72rem', backgroundColor: '#7f1d1d', border: 'none', color: '#fca5a5', borderRadius: '4px', cursor: 'pointer' }}>刪除表格</button>
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <tbody>
                      {rows.map((row, rIdx) => (
                        <tr key={rIdx} style={{ backgroundColor: rIdx === 0 ? '#101626' : '#090e1a', borderBottom: '1px solid #1e293b' }}>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} style={{ border: '1px solid #1e293b', padding: 0 }}>
                              <input
                                type="text"
                                value={cell}
                                onChange={(e) => updateTableCell(block.id, rIdx, cIdx, e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '8px 10px',
                                  background: 'transparent',
                                  border: 'none',
                                  color: rIdx === 0 ? '#38bdf8' : '#f8fafc',
                                  fontWeight: rIdx === 0 ? 600 : 400,
                                  fontSize: '0.84rem',
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
              </div>
            );
          }

          // 2. Code Block 即時互動代碼框
          if (block.type === 'code') {
            return (
              <div key={block.id} style={{ margin: '8px 0', backgroundColor: '#070b14', border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', backgroundColor: '#0e1526', borderBottom: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Code size={13} color="#38bdf8" />
                    <input
                      type="text"
                      value={block.lang || 'javascript'}
                      onChange={(e) => {
                        const updated = blocks.map(b => b.id === block.id ? { ...b, lang: e.target.value } : b);
                        updateBlocks(updated);
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.74rem', width: '80px', outline: 'none' }}
                      placeholder="language"
                    />
                  </div>
                  <button type="button" onClick={() => removeBlock(block.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.72rem', cursor: 'pointer' }}>刪除區塊</button>
                </div>
                <textarea
                  rows={4}
                  value={block.content}
                  onChange={(e) => {
                    const updated = blocks.map(b => b.id === block.id ? { ...b, content: e.target.value } : b);
                    updateBlocks(updated);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    backgroundColor: '#070b14',
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

          // 3. 一般文字 Block (h1, h2, h3, todo, bullet, quote, p)
          return (
            <div
              key={block.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                position: 'relative'
              }}
            >
              {/* Block 樣式指示圖標 */}
              {block.type === 'bullet' && (
                <span style={{ color: '#38bdf8', fontSize: '1.2rem', lineHeight: 1 }}>•</span>
              )}
              {block.type === 'numbered' && (
                <span style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 600, minWidth: '18px' }}>{index + 1}.</span>
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
              {block.type === 'quote' && (
                <span style={{ width: '3px', height: '24px', backgroundColor: '#38bdf8', borderRadius: '2px', display: 'inline-block', flexShrink: 0 }} />
              )}

              {/* 輸入框 */}
              <input
                id={`input-${block.id}`}
                type="text"
                autoFocus={autoFocus && index === 0}
                value={block.content}
                onChange={(e) => handleInputChange(block.id, e.target.value)}
                onKeyDown={(e) => handleKeyDownOnText(e, block, index)}
                placeholder={index === 0 ? "輸入文字，或輸入 '/' 呼叫指令..." : "輸入文字..."}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: block.checked ? '#64748b' : '#f8fafc',
                  textDecoration: block.checked ? 'line-through' : 'none',
                  fontSize: block.type === 'h1' ? '1.3rem' : block.type === 'h2' ? '1.15rem' : block.type === 'h3' ? '1.02rem' : '0.88rem',
                  fontWeight: block.type === 'h1' || block.type === 'h2' || block.type === 'h3' ? 700 : 400,
                  outline: 'none',
                  padding: '4px 0'
                }}
              />

              {/* Slash Command 下拉浮動選單 */}
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

      {/* 底部操作列 */}
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
