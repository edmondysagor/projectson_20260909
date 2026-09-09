import { useState, useEffect, useRef } from "react";
import { BlockNoteEditor } from "@blocknote/core";

export function EditorToolbar({ editor }: { editor: BlockNoteEditor }) {
  const [activeStyles, setActiveStyles] = useState<any>({});
  const [activeBlockType, setActiveBlockType] = useState<string>("paragraph");
  
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!editor) return;
    const updateState = () => {
      setActiveStyles(editor.getActiveStyles());
      const block = editor.getTextCursorPosition().block;
      setActiveBlockType(block ? block.type : "paragraph");
    };
    updateState();
    return editor.onSelectionChange(updateState);
  }, [editor]);

  const toggleStyle = (style: string) => {
    editor.toggleStyles({ [style]: true });
    editor.focus();
    setActiveDropdown(null);
  };

  const setBlockType = (type: any, props?: any) => {
    const block = editor.getTextCursorPosition().block;
    if (block) {
      editor.updateBlock(block, { type, props });
    }
    editor.focus();
    setActiveDropdown(null);
  };

  const btnStyle = (isActive: boolean) => ({
    background: isActive ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
    color: isActive ? '#fff' : 'var(--text-secondary)',
    border: 'none',
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    minWidth: '28px',
    height: '28px',
    transition: 'background 0.2s',
  });

  const dropdownContainerStyle = { position: 'relative' as const };
  
  const dropdownMenuStyle = { 
    position: 'absolute' as const, 
    top: '100%', 
    left: 0, 
    marginTop: '4px', 
    background: '#1F2937', 
    border: '1px solid var(--border-color)', 
    borderRadius: '6px', 
    zIndex: 20, 
    minWidth: '160px', 
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '4px 0'
  };

  const menuItemStyle = (isActive: boolean) => ({
    padding: '8px 16px', 
    cursor: 'pointer', 
    fontSize: '13px', 
    background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent', 
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px'
  });

  const iconStyle = { width: '16px', height: '16px' };
  const chevronIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>;

  const colors = ["default", "gray", "brown", "red", "orange", "yellow", "green", "blue", "purple", "pink"];

  const toggleDropdown = (name: string) => {
    setActiveDropdown(prev => prev === name ? null : name);
  };

  return (
    <div ref={toolbarRef} style={{
      display: 'flex',
      alignItems: 'center',
      gap: '2px',
      padding: '4px 8px',
      background: 'rgba(255,255,255,0.03)',
      borderBottom: '1px solid var(--border-color)',
      borderTopLeftRadius: '8px',
      borderTopRightRadius: '8px',
      flexWrap: 'wrap'
    }}>
      
      {/* 1. Text Style Dropdown */}
      <div style={dropdownContainerStyle}>
        <button onClick={() => toggleDropdown('textStyle')} style={btnStyle(activeDropdown === 'textStyle')}>
          <span style={{ fontWeight: 'bold' }}>T</span> {chevronIcon}
        </button>
        {activeDropdown === 'textStyle' && (
          <div style={dropdownMenuStyle}>
            <div onClick={() => setBlockType("paragraph")} style={menuItemStyle(activeBlockType === "paragraph")}>
              <span style={{ fontWeight: 'normal' }}>Normal text</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>⌘0</span>
            </div>
            <div onClick={() => setBlockType("heading", { level: 1 })} style={menuItemStyle(activeBlockType === "heading")}>
              <span style={{ fontWeight: 'bold', fontSize: '18px' }}>Heading 1</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>⌘1</span>
            </div>
            <div onClick={() => setBlockType("heading", { level: 2 })} style={menuItemStyle(activeBlockType === "heading")}>
              <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Heading 2</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>⌘2</span>
            </div>
            <div onClick={() => setBlockType("heading", { level: 3 })} style={menuItemStyle(activeBlockType === "heading")}>
              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Heading 3</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>⌘3</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

      {/* 2. Format Dropdown */}
      <div style={dropdownContainerStyle}>
        <button onClick={() => toggleDropdown('format')} style={btnStyle(activeDropdown === 'format')}>
          <strong style={{ fontFamily: 'serif' }}>B</strong> {chevronIcon}
        </button>
        {activeDropdown === 'format' && (
          <div style={dropdownMenuStyle}>
            <div onClick={() => toggleStyle('bold')} style={menuItemStyle(activeStyles.bold)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><strong style={{ width: '16px' }}>B</strong> Bold</div>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>⌘B</span>
            </div>
            <div onClick={() => toggleStyle('italic')} style={menuItemStyle(activeStyles.italic)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><em style={{ width: '16px' }}>I</em> Italic</div>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>⌘I</span>
            </div>
            <div onClick={() => toggleStyle('underline')} style={menuItemStyle(activeStyles.underline)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><u style={{ width: '16px' }}>U</u> Underline</div>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>⌘U</span>
            </div>
            <div onClick={() => toggleStyle('strike')} style={menuItemStyle(activeStyles.strike)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><s style={{ width: '16px' }}>S</s> Strikethrough</div>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>⌘⇧S</span>
            </div>
            <div onClick={() => toggleStyle('code')} style={menuItemStyle(activeStyles.code)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ fontFamily: 'monospace', width: '16px' }}>&lt;/&gt;</span> Code</div>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>⌘⇧M</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

      {/* 3. Lists Dropdown */}
      <div style={dropdownContainerStyle}>
        <button onClick={() => toggleDropdown('lists')} style={btnStyle(activeDropdown === 'lists')}>
          <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
          {chevronIcon}
        </button>
        {activeDropdown === 'lists' && (
          <div style={dropdownMenuStyle}>
            <div onClick={() => setBlockType(activeBlockType === "bulletListItem" ? "paragraph" : "bulletListItem")} style={menuItemStyle(activeBlockType === "bulletListItem")}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                Bulleted list
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>⌘⇧8</span>
            </div>
            <div onClick={() => setBlockType(activeBlockType === "numberedListItem" ? "paragraph" : "numberedListItem")} style={menuItemStyle(activeBlockType === "numberedListItem")}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"></line><line x1="10" y1="12" x2="21" y2="12"></line><line x1="10" y1="18" x2="21" y2="18"></line><path d="M4 6h1v4"></path><path d="M4 10h2"></path><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path></svg>
                Numbered list
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>⌘⇧7</span>
            </div>
            <div onClick={() => setBlockType(activeBlockType === "checkListItem" ? "paragraph" : "checkListItem")} style={menuItemStyle(activeBlockType === "checkListItem")}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                Task list
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>⌘⇧6</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

      {/* 4. Text Color */}
      <div style={dropdownContainerStyle}>
        <button onClick={() => toggleDropdown('color')} style={btnStyle(activeDropdown === 'color')}>
          <span style={{ fontWeight: 'bold', color: activeStyles.textColor && activeStyles.textColor !== 'default' ? activeStyles.textColor : 'inherit' }}>A</span>
        </button>
        {activeDropdown === 'color' && (
          <div style={{ ...dropdownMenuStyle, padding: '12px', minWidth: '180px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Text color</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
              {colors.map(color => (
                <div 
                  key={color} 
                  onClick={() => { editor.toggleStyles({ textColor: color }); setActiveDropdown(null); editor.focus(); }}
                  style={{ 
                    width: '24px', height: '24px', borderRadius: '4px', cursor: 'pointer', 
                    background: color === 'default' ? '#fff' : color, 
                    border: activeStyles.textColor === color || (!activeStyles.textColor && color === 'default') ? '2px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.2)' 
                  }}
                  title={color}
                />
              ))}
            </div>
            <button 
              onClick={() => { editor.toggleStyles({ textColor: "default" }); setActiveDropdown(null); editor.focus(); }}
              style={{ marginTop: '12px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '6px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
            >
              Remove color
            </button>
          </div>
        )}
      </div>

      {/* Image (Placeholder) */}
      <button style={btnStyle(false)} title="Image">
        <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
      </button>

      {/* Code Snippet */}
      <button onClick={() => setBlockType(activeBlockType === "codeBlock" ? "paragraph" : "codeBlock")} style={btnStyle(activeBlockType === "codeBlock")} title="Code snippet">
        <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
      </button>

      {/* Emoji */}
      <button onClick={() => { editor.insertInlineContent([{ type: "text", text: "😀", styles: {} }]); editor.focus(); }} style={btnStyle(false)} title="Emoji">
        <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
      </button>

      {/* 5. Insert Dropdown */}
      <div style={dropdownContainerStyle}>
        <button onClick={() => toggleDropdown('insert')} style={{ ...btnStyle(activeDropdown === 'insert'), color: '#60A5FA', background: 'rgba(59, 130, 246, 0.1)' }}>
          <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        {activeDropdown === 'insert' && (
          <div style={{ ...dropdownMenuStyle, minWidth: '240px', padding: '8px' }}>
            <div style={{ padding: '4px 8px', marginBottom: '8px' }}>
              <input type="text" placeholder="Search" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 12px', borderRadius: '4px', fontSize: '13px', outline: 'none' }} />
            </div>
            
            <div onClick={() => setBlockType("checkListItem")} style={{ ...menuItemStyle(false), justifyContent: 'flex-start' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width: '24px', height: '24px', background: 'rgba(59, 130, 246, 0.2)', color: '#60A5FA', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"></polyline></svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 'bold' }}>Action item</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Create and assign action items</span>
              </div>
            </div>

            <div onClick={() => { editor.insertInlineContent([{ type: "text", text: "@", styles: {} }]); editor.focus(); setActiveDropdown(null); }} style={{ ...menuItemStyle(false), justifyContent: 'flex-start' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width: '24px', height: '24px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>@</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 'bold' }}>Mention</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Mention someone to send notification</span>
              </div>
            </div>

            <div onClick={() => setBlockType("table")} style={{ ...menuItemStyle(false), justifyContent: 'flex-start' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width: '24px', height: '24px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 'bold' }}>Table</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Insert a table</span>
              </div>
            </div>

            <div onClick={() => setBlockType("quote")} style={{ ...menuItemStyle(false), justifyContent: 'flex-start' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width: '24px', height: '24px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>"</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 'bold' }}>Quote</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Insert a quote or citation</span>
              </div>
            </div>

            <div onClick={() => setBlockType("divider")} style={{ ...menuItemStyle(false), justifyContent: 'flex-start' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width: '24px', height: '24px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>—</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 'bold' }}>Divider</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Insert a horizontal divider</span>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Link Placeholder */}
      <button style={btnStyle(false)} title="Link">
        <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
      </button>

      <div style={{ flex: 1 }} />

      {/* Undo / Redo */}
      <button onClick={() => { editor.undo(); editor.focus(); }} style={btnStyle(false)} title="Undo">
        <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>
      </button>
      <button onClick={() => { editor.redo(); editor.focus(); }} style={btnStyle(false)} title="Redo">
        <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6"></path><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"></path></svg>
      </button>
    </div>
  );
}
