import { EditorBubble, EditorBubbleItem } from 'novel';
import { Bold, Italic, Underline, Strikethrough, Code } from 'lucide-react';

export const NovelBubbleMenu = () => {
  return (
    <EditorBubble className="flex items-center gap-1 rounded-lg border border-[#2d3b55] bg-[#161f32] p-1 shadow-2xl z-[9999]">
      <EditorBubbleItem
        onSelect={(editor) => editor.chain().focus().toggleBold().run()}
        style={{
          padding: '5px',
          borderRadius: '4px',
          cursor: 'pointer',
          color: '#cbd5e1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Bold size={14} />
      </EditorBubbleItem>

      <EditorBubbleItem
        onSelect={(editor) => editor.chain().focus().toggleItalic().run()}
        style={{
          padding: '5px',
          borderRadius: '4px',
          cursor: 'pointer',
          color: '#cbd5e1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Italic size={14} />
      </EditorBubbleItem>

      <EditorBubbleItem
        onSelect={(editor) => editor.chain().focus().toggleUnderline().run()}
        style={{
          padding: '5px',
          borderRadius: '4px',
          cursor: 'pointer',
          color: '#cbd5e1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Underline size={14} />
      </EditorBubbleItem>

      <EditorBubbleItem
        onSelect={(editor) => editor.chain().focus().toggleStrike().run()}
        style={{
          padding: '5px',
          borderRadius: '4px',
          cursor: 'pointer',
          color: '#cbd5e1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Strikethrough size={14} />
      </EditorBubbleItem>

      <EditorBubbleItem
        onSelect={(editor) => editor.chain().focus().toggleCode().run()}
        style={{
          padding: '5px',
          borderRadius: '4px',
          cursor: 'pointer',
          color: '#cbd5e1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Code size={14} />
      </EditorBubbleItem>
    </EditorBubble>
  );
};
