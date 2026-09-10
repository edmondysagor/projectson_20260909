import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X, Code2 } from 'lucide-react';
import { codeBlockOptions } from '@blocknote/code-block';

export interface CodeBlockLanguagePickerProps {
  language: string;
  onSelectLanguage: (lang: string) => void;
  disabled?: boolean;
}

// 格式化語言列表供搜尋
export const SUPPORTED_LANGUAGES_LIST = Object.entries(codeBlockOptions.supportedLanguages).map(([id, info]) => ({
  id,
  name: info.name,
  aliases: (info as any).aliases || []
}));

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
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        userSelect: 'none',
        zIndex: 50
      }}
      contentEditable={false}
    >
      {/* 觸發按鈕：高質感、高對比的深藍色 Badge Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsOpen(!isOpen);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          backgroundColor: '#1b2438',
          border: '1px solid #3b82f6',
          borderRadius: '6px',
          color: '#60a5fa',
          fontSize: '0.78rem',
          fontWeight: 600,
          cursor: disabled ? 'default' : 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          outline: 'none',
          transition: 'all 0.15s ease'
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.backgroundColor = '#24324f';
            e.currentTarget.style.borderColor = '#60a5fa';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled) {
            e.currentTarget.style.backgroundColor = '#1b2438';
            e.currentTarget.style.borderColor = '#3b82f6';
          }
        }}
      >
        <Code2 size={13} color="#38bdf8" />
        <span>{currentDisplayName}</span>
        {!disabled && (
          <ChevronDown size={13} color="#93c5fd" style={{ marginLeft: '2px' }} />
        )}
      </button>

      {/* 搜尋 + 下拉選單卡片 (Input Search + Dropdown Box Selection) */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            width: '230px',
            backgroundColor: '#161f32',
            border: '1px solid #2d3b55',
            borderRadius: '8px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            padding: '8px',
            boxSizing: 'border-box',
            zIndex: 9999
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Input Search 搜尋列 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0c1222',
              border: '1px solid #2d3b55',
              borderRadius: '6px',
              padding: '4px 8px',
              marginBottom: '6px'
            }}
          >
            <Search size={13} color="#64748b" />
            <input
              autoFocus
              type="text"
              placeholder="搜尋語言 (例: sql, js, ts, py)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f8fafc',
                fontSize: '0.75rem',
                outline: 'none',
                width: '100%'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Dropdown Box Selection 語言清單 */}
          <div
            style={{
              maxHeight: '180px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}
          >
            {filteredLanguages.map(item => {
              const isSelected = item.id.toLowerCase() === (language || 'text').toLowerCase();
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectLanguage(item.id);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 8px',
                    borderRadius: '5px',
                    background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    border: 'none',
                    color: isSelected ? '#38bdf8' : '#cbd5e1',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color 0.12s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isSelected ? 'rgba(56, 189, 248, 0.25)' : '#1e293b';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isSelected ? 'rgba(56, 189, 248, 0.15)' : 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: isSelected ? 600 : 500 }}>{item.name}</span>
                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>({item.id})</span>
                  </div>
                  {isSelected && <Check size={13} color="#38bdf8" />}
                </button>
              );
            })}

            {filteredLanguages.length === 0 && (
              <div style={{ padding: '8px', textAlign: 'center', color: '#64748b', fontSize: '0.75rem' }}>
                找不到符合的程式語言
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
