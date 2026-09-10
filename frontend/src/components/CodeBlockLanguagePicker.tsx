import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X, Code2 } from 'lucide-react';

export interface CodeBlockLanguagePickerProps {
  language: string;
  onSelectLanguage: (lang: string) => void;
  disabled?: boolean;
}

// 支援搜尋與切換的主流語言完整清單 (40+ 種語言，自帶別名與顯示名稱)
export const SUPPORTED_LANGUAGES_LIST: { id: string; name: string; aliases: string[] }[] = [
  { id: 'javascript', name: 'JavaScript', aliases: ['js'] },
  { id: 'typescript', name: 'TypeScript', aliases: ['ts'] },
  { id: 'python', name: 'Python', aliases: ['py'] },
  { id: 'sql', name: 'SQL', aliases: ['pgsql', 'mysql', 'sqlite'] },
  { id: 'html', name: 'HTML', aliases: ['htm', 'xhtml'] },
  { id: 'css', name: 'CSS', aliases: [] },
  { id: 'json', name: 'JSON', aliases: ['jsonc'] },
  { id: 'bash', name: 'Bash / Shell', aliases: ['sh', 'zsh'] },
  { id: 'markdown', name: 'Markdown', aliases: ['md'] },
  { id: 'yaml', name: 'YAML', aliases: ['yml'] },
  { id: 'rust', name: 'Rust', aliases: ['rs'] },
  { id: 'go', name: 'Go (Golang)', aliases: ['golang'] },
  { id: 'java', name: 'Java', aliases: [] },
  { id: 'c', name: 'C', aliases: ['h'] },
  { id: 'cpp', name: 'C++', aliases: ['cc', 'cxx', 'hpp'] },
  { id: 'csharp', name: 'C#', aliases: ['cs', 'dotnet'] },
  { id: 'php', name: 'PHP', aliases: [] },
  { id: 'ruby', name: 'Ruby', aliases: ['rb'] },
  { id: 'swift', name: 'Swift', aliases: [] },
  { id: 'kotlin', name: 'Kotlin', aliases: ['kt'] },
  { id: 'dart', name: 'Dart', aliases: [] },
  { id: 'dockerfile', name: 'Dockerfile', aliases: ['docker'] },
  { id: 'graphql', name: 'GraphQL', aliases: ['gql'] },
  { id: 'scss', name: 'SCSS', aliases: [] },
  { id: 'less', name: 'Less', aliases: [] },
  { id: 'xml', name: 'XML', aliases: ['svg'] },
  { id: 'r', name: 'R', aliases: [] },
  { id: 'lua', name: 'Lua', aliases: [] },
  { id: 'scala', name: 'Scala', aliases: [] },
  { id: 'perl', name: 'Perl', aliases: ['pl'] },
  { id: 'haskell', name: 'Haskell', aliases: ['hs'] },
  { id: 'elixir', name: 'Elixir', aliases: ['ex'] },
  { id: 'clojure', name: 'Clojure', aliases: ['clj'] },
  { id: 'plaintext', name: 'Plain Text', aliases: ['text', 'txt'] },
];

export const CodeBlockLanguagePicker: React.FC<CodeBlockLanguagePickerProps> = ({
  language,
  onSelectLanguage,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // 取得目前語言的顯示名稱
  const currentLangObj = SUPPORTED_LANGUAGES_LIST.find(
    l => l.id.toLowerCase() === (language || 'text').toLowerCase()
  );
  const currentDisplayName = currentLangObj?.name || language || 'Plain Text';

  // 點擊外部自動關閉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 搜尋過濾
  const filteredLanguages = SUPPORTED_LANGUAGES_LIST.filter(l => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      l.id.toLowerCase().includes(q) ||
      l.name.toLowerCase().includes(q) ||
      l.aliases.some((a: string) => a.toLowerCase().includes(q))
    );
  });

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* 觸發按鈕 Badge */}
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsOpen(!isOpen);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          backgroundColor: '#1f293d',
          border: '1px solid #38bdf8',
          borderRadius: '6px',
          color: '#38bdf8',
          fontSize: '0.75rem',
          fontWeight: 600,
          cursor: disabled ? 'default' : 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          transition: 'all 0.15s ease',
          outline: 'none',
          userSelect: 'none',
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.backgroundColor = '#253554';
            e.currentTarget.style.borderColor = '#60a5fa';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled) {
            e.currentTarget.style.backgroundColor = '#1f293d';
            e.currentTarget.style.borderColor = '#38bdf8';
          }
        }}
      >
        <Code2 size={13} strokeWidth={2.2} />
        <span>{currentDisplayName}</span>
        <ChevronDown size={12} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {/* 下拉搜尋彈出層 */}
      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: '240px',
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '8px',
            boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
            zIndex: 99999,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* 頂部搜尋框 */}
          <div style={{ padding: '8px', borderBottom: '1px solid #1e293b', position: 'relative' }}>
            <Search
              size={13}
              style={{ position: 'absolute', left: '16px', top: '16px', color: '#64748b' }}
            />
            <input
              type="text"
              placeholder="搜尋程式語言..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                padding: '6px 26px 6px 28px',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '5px',
                color: '#f8fafc',
                fontSize: '0.78rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '14px',
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* 語言清單滾動區 */}
          <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '4px' }}>
            {filteredLanguages.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '0.75rem' }}>
                找不到符合的語言
              </div>
            ) : (
              filteredLanguages.map((lang) => {
                const isSelected = (language || 'text').toLowerCase() === lang.id.toLowerCase();
                return (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => {
                      onSelectLanguage(lang.id);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: '5px',
                      backgroundColor: isSelected ? '#1e3a8a' : 'transparent',
                      color: isSelected ? '#93c5fd' : '#cbd5e1',
                      border: 'none',
                      fontSize: '0.78rem',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = '#1e293b';
                        e.currentTarget.style.color = '#fff';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#cbd5e1';
                      }
                    }}
                  >
                    <span>{lang.name}</span>
                    {isSelected && <Check size={13} style={{ color: '#38bdf8' }} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
