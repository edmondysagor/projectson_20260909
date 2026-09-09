import { useState, useEffect, useRef } from "react";
import { BlockNoteEditor } from "@blocknote/core";

export function CodeBlockToolbar({ editor }: { editor: BlockNoteEditor }) {
  const [activeBlock, setActiveBlock] = useState<any>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, show: false });
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

    const languageMap: Record<string, string> = {
    "text": "Plain Text",
    "c": "C",
    "cpp": "C++",
    "csharp": "C#",
    "css": "CSS",
    "go": "Go",
    "html": "HTML",
    "java": "Java",
    "javascript": "JavaScript",
    "json": "JSON",
    "jsx": "JSX",
    "kotlin": "Kotlin",
    "markdown": "Markdown",
    "php": "PHP",
    "python": "Python",
    "ruby": "Ruby",
    "rust": "Rust",
    "sql": "SQL",
    "swift": "Swift",
    "tsx": "TSX",
    "typescript": "TypeScript",
    "xml": "XML",
    "yaml": "YAML",
    "bash": "Bash",
    "shell": "Shell"
  };
  const languages = Object.keys(languageMap);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowLangPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!editor) return;
    let timer: any;
    
    const update = () => {
      if (timer) clearTimeout(timer);
      
      const pos = editor.getTextCursorPosition();
      if (pos && pos.block && pos.block.type === "codeBlock") {
        setActiveBlock(pos.block);
        
        // Use a short timeout to let DOM render
        timer = setTimeout(() => {
          if (!editor.domElement) return;
          // Verify if cursor is STILL in codeBlock
          const currentPos = editor.getTextCursorPosition();
          if (!currentPos || !currentPos.block || currentPos.block.type !== "codeBlock") {
            setPosition(p => ({ ...p, show: false }));
            return;
          }
          
          const doms = editor.domElement.querySelectorAll(`[data-id="${pos.block.id}"]`);
          if (doms.length > 0) {
            const dom = doms[0] as HTMLElement;
            setPosition({
              top: dom.offsetTop + dom.offsetHeight + 4,
              left: dom.offsetLeft + dom.offsetWidth - 170,
              show: true
            });
          } else {
             // If DOM not found (e.g. block deleted), hide
             setPosition(p => ({ ...p, show: false }));
          }
        }, 50);
      } else {
        setPosition(p => ({ ...p, show: false }));
        setShowLangPicker(false);
      }
    };
    
    update();
    const unsubSelection = editor.onSelectionChange(update);
    // Also listen to document changes in case block is deleted or updated
    // In BlockNote 0.14+ it's onChange, in some it's onDocumentChange
    let unsubChange = () => {};
    if ((editor as any).onChange) {
       unsubChange = (editor as any).onChange(update);
    } else if ((editor as any).onEditorContentChange) {
       unsubChange = (editor as any).onEditorContentChange(update);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
      unsubSelection();
      unsubChange();
    };
  }, [editor]);

  if (!position.show || !activeBlock) return null;

  const currentLangId = activeBlock.props.language || "text";
  const currentLang = languageMap[currentLangId] || currentLangId;
  const filteredLangs = languages.filter(l => languageMap[l].toLowerCase().includes(searchTerm.toLowerCase()) || l.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div style={{
      position: 'absolute',
      top: position.top,
      left: position.left,
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      background: 'rgba(31, 41, 55, 0.95)',
      padding: '4px',
      borderRadius: '6px',
      border: '1px solid rgba(255,255,255,0.1)',
      boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
      zIndex: 50
    }}>
      <div ref={pickerRef} style={{ position: 'relative' }}>
        <button 
          onClick={() => setShowLangPicker(!showLangPicker)}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: 'none',
            color: '#fff',
            padding: '4px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {currentLang}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        {showLangPicker && (
          <div style={{
            position: 'absolute',
            top: '100%',
            bottom: 'auto',
            right: 0,
            marginTop: '4px',
            background: '#1F2937',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            width: '200px',
            maxHeight: '300px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '8px' }}>
              <input 
                type="text" 
                placeholder="搜尋語言..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid #3B82F6',
                  color: '#fff',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredLangs.map(langId => (
                <div 
                  key={langId}
                  onClick={() => {
                    editor.updateBlock(activeBlock, { type: "codeBlock", props: { language: langId } });
                    setShowLangPicker(false);
                    setSearchTerm("");
                    editor.focus();
                  }}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: currentLangId === langId ? 'rgba(255,255,255,0.1)' : 'transparent'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = currentLangId === langId ? 'rgba(255,255,255,0.1)' : 'transparent'}
                >
                  {languageMap[langId] || langId}
                  {currentLangId === langId && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
      
      <button 
        onClick={() => {
          navigator.clipboard.writeText(activeBlock.content.map((c:any) => c.text).join(""));
          // Optional: show a toast or change icon briefly
        }}
        title="Copy"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          padding: '4px',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
      </button>

      <button 
        title="More options"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          padding: '4px',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
      </button>

    </div>
  );
}
