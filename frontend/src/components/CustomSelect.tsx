import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  color?: string;
  bg?: string;
  badgeBg?: string;
  badgeColor?: string;
}

interface CustomSelectProps {
  value: string;
  options: (string | CustomSelectOption)[];
  onChange: (val: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  buttonStyle?: React.CSSProperties;
  dropdownStyle?: React.CSSProperties;
  size?: 'sm' | 'md';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  style,
  buttonStyle,
  dropdownStyle,
  size = 'md'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 規範化 options
  const normalizedOptions: CustomSelectOption[] = options.map(opt => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  const selectedOption = normalizedOptions.find(o => o.value === value) || {
    value,
    label: value || placeholder
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const isSmall = size === 'sm';

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', width: style?.width || 'auto', ...style }}>
      {/* 觸發按鈕 (對齊 圖1 頂部按鈕樣式) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: isSmall ? '3px 8px' : '6px 12px',
          backgroundColor: '#1b2438',
          border: '1px solid #2d3b55',
          borderRadius: '6px',
          color: '#f8fafc',
          fontSize: isSmall ? '0.75rem' : '0.82rem',
          fontWeight: 500,
          cursor: 'pointer',
          width: '100%',
          boxSizing: 'border-box',
          outline: 'none',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'border-color 0.15s, background-color 0.15s',
          ...buttonStyle
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#222d45';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = (buttonStyle?.backgroundColor as string) || '#1b2438';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption.badgeBg ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: selectedOption.badgeBg,
              color: selectedOption.badgeColor || '#fff',
              fontSize: '0.75rem',
              fontWeight: 600
            }}>
              {selectedOption.icon}
              <span>{selectedOption.label}</span>
            </span>
          ) : (
            <>
              {selectedOption.icon}
              <span style={{ color: selectedOption.color || '#f8fafc' }}>
                {selectedOption.label}
              </span>
            </>
          )}
        </div>

        {/* 右側分隔線與下拉箭頭 (對齊 圖1 按鈕內部 | ▾ 設計) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid #334155', paddingLeft: '6px', marginLeft: '4px' }}>
          <ChevronDown size={14} color="#94a3b8" />
        </div>
      </button>

      {/* 展開面板 (對齊 圖1 懸浮下拉卡片：深色背景、圓角卡片式選項徽章、精緻陰影) */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: '150px',
            width: 'max-content',
            maxWidth: '260px',
            backgroundColor: '#161f32',
            border: '1px solid #2d3b55',
            borderRadius: '8px',
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            zIndex: 999,
            padding: '6px',
            maxHeight: '260px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            ...dropdownStyle
          }}
        >
          {normalizedOptions.map(opt => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                  color: isSelected ? '#38bdf8' : '#cbd5e1',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '0.8rem',
                  fontWeight: isSelected ? 600 : 500,
                  transition: 'background-color 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isSelected ? 'rgba(56, 189, 248, 0.2)' : '#1e293b';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {opt.badgeBg ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: opt.badgeBg,
                      color: opt.badgeColor || '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}>
                      {opt.icon}
                      <span>{opt.label}</span>
                    </span>
                  ) : (
                    <>
                      {opt.icon}
                      <span style={{ color: opt.color || (isSelected ? '#38bdf8' : '#cbd5e1') }}>
                        {opt.label}
                      </span>
                    </>
                  )}
                </div>

                {isSelected && <Check size={14} color="#38bdf8" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
