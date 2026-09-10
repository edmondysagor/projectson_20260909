import React from 'react';
import { Bold, Italic, Underline, Strikethrough, Code, Link as LinkIcon } from 'lucide-react';

export interface FloatingToolbarPosition {
  top: number;
  left: number;
}

export interface FloatingFormatToolbarProps {
  position: FloatingToolbarPosition;
  onFormat: (type: 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'link') => void;
}

export const FloatingFormatToolbar: React.FC<FloatingFormatToolbarProps> = ({
  position,
  onFormat
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translate(-50%, -100%)',
        marginBottom: '8px',
        backgroundColor: '#161f32',
        border: '1px solid #2d3b55',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        padding: '3px 6px',
        gap: '2px',
        zIndex: 200,
        pointerEvents: 'auto'
      }}
      onMouseDown={(e) => {
        // 防止選取範圍丟失
        e.preventDefault();
      }}
    >
      <button
        type="button"
        title="Bold (Cmd+B)"
        onClick={() => onFormat('bold')}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#cbd5e1',
          padding: '4px 6px',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <Bold size={13} />
      </button>

      <button
        type="button"
        title="Italic (Cmd+I)"
        onClick={() => onFormat('italic')}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#cbd5e1',
          padding: '4px 6px',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <Italic size={13} />
      </button>

      <button
        type="button"
        title="Underline (Cmd+U)"
        onClick={() => onFormat('underline')}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#cbd5e1',
          padding: '4px 6px',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <Underline size={13} />
      </button>

      <button
        type="button"
        title="Strikethrough"
        onClick={() => onFormat('strike')}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#cbd5e1',
          padding: '4px 6px',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <Strikethrough size={13} />
      </button>

      <span style={{ width: '1px', height: '14px', backgroundColor: '#2d3b55', margin: '0 2px' }} />

      <button
        type="button"
        title="Inline Code"
        onClick={() => onFormat('code')}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#cbd5e1',
          padding: '4px 6px',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <Code size={13} />
      </button>

      <button
        type="button"
        title="Link"
        onClick={() => onFormat('link')}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#cbd5e1',
          padding: '4px 6px',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <LinkIcon size={13} />
      </button>
    </div>
  );
};
