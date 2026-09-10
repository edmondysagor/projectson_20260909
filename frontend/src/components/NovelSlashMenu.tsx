import {
  EditorCommand,
  EditorCommandList,
  EditorCommandItem,
  EditorCommandEmpty
} from 'novel';
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Quote,
  Table as TableIcon,
  Minus
} from 'lucide-react';

export const NovelSlashMenu = () => {
  return (
    <EditorCommand
      style={{
        zIndex: 9999,
        maxHeight: '320px',
        width: '280px',
        overflowY: 'auto',
        borderRadius: '8px',
        border: '1px solid #2d3b55',
        backgroundColor: '#161f32',
        padding: '6px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.7)',
        outline: 'none',
      }}
    >
      <EditorCommandEmpty style={{ padding: '8px 12px', fontSize: '0.8rem', color: '#64748b' }}>
        無符合指令
      </EditorCommandEmpty>
      <EditorCommandList style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {/* H1 */}
        <EditorCommandItem
          value="Heading 1"
          onCommand={({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            color: '#f8fafc',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', backgroundColor: '#1e293b', color: '#38bdf8' }}>
            <Heading1 size={15} />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>Heading 1</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>大標題</div>
          </div>
        </EditorCommandItem>

        {/* H2 */}
        <EditorCommandItem
          value="Heading 2"
          onCommand={({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            color: '#f8fafc',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', backgroundColor: '#1e293b', color: '#38bdf8' }}>
            <Heading2 size={15} />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>Heading 2</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>中標題</div>
          </div>
        </EditorCommandItem>

        {/* H3 */}
        <EditorCommandItem
          value="Heading 3"
          onCommand={({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            color: '#f8fafc',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', backgroundColor: '#1e293b', color: '#38bdf8' }}>
            <Heading3 size={15} />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>Heading 3</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>小標題</div>
          </div>
        </EditorCommandItem>

        {/* Bullet List */}
        <EditorCommandItem
          value="Bullet List"
          onCommand={({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleBulletList().run();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            color: '#f8fafc',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', backgroundColor: '#1e293b', color: '#38bdf8' }}>
            <List size={15} />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>Bullet List</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>無序清單</div>
          </div>
        </EditorCommandItem>

        {/* Numbered List */}
        <EditorCommandItem
          value="Numbered List"
          onCommand={({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleOrderedList().run();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            color: '#f8fafc',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', backgroundColor: '#1e293b', color: '#38bdf8' }}>
            <ListOrdered size={15} />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>Numbered List</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>編號數字清單</div>
          </div>
        </EditorCommandItem>

        {/* To-do List */}
        <EditorCommandItem
          value="To-do List"
          onCommand={({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleTaskList().run();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            color: '#f8fafc',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', backgroundColor: '#1e293b', color: '#38bdf8' }}>
            <CheckSquare size={15} />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>To-do List</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>任務核取清單</div>
          </div>
        </EditorCommandItem>

        {/* Code Block */}
        <EditorCommandItem
          value="Code Block"
          onCommand={({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            color: '#f8fafc',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', backgroundColor: '#1e293b', color: '#38bdf8' }}>
            <Code size={15} />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>Code Block</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>代碼塊（支援語言搜尋與高亮）</div>
          </div>
        </EditorCommandItem>

        {/* Table */}
        <EditorCommandItem
          value="Table"
          onCommand={({ editor, range }) => {
            (editor.chain().focus().deleteRange(range) as any).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            color: '#f8fafc',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', backgroundColor: '#1e293b', color: '#38bdf8' }}>
            <TableIcon size={15} />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>Table</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>互動表格</div>
          </div>
        </EditorCommandItem>

        {/* Quote */}
        <EditorCommandItem
          value="Quote"
          onCommand={({ editor, range }) => {
            editor.chain().focus().deleteRange(range).toggleBlockquote().run();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            color: '#f8fafc',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', backgroundColor: '#1e293b', color: '#38bdf8' }}>
            <Quote size={15} />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>Quote</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>引用段落</div>
          </div>
        </EditorCommandItem>

        {/* Divider */}
        <EditorCommandItem
          value="Divider"
          onCommand={({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setHorizontalRule().run();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            color: '#f8fafc',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', backgroundColor: '#1e293b', color: '#38bdf8' }}>
            <Minus size={15} />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>Divider</div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>分隔線</div>
          </div>
        </EditorCommandItem>
      </EditorCommandList>
    </EditorCommand>
  );
};
