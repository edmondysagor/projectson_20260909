import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface CardStatusSelectProps {
  value: string;
  onChange: (newStatus: string) => void;
  disabled?: boolean;
}

export const STATUS_OPTIONS = [
  { value: 'Not Start', label: 'Not Start', bg: '#1e293b', text: '#94a3b8', border: '#334155' },
  { value: 'Ready', label: 'Ready', bg: '#1e3a8a', text: '#93c5fd', border: '#1d4ed8' },
  { value: 'In Progress', label: 'In Progress', bg: '#1e3a8a', text: '#60a5fa', border: '#2563eb' },
  { value: 'Blocked', label: 'Blocked', bg: '#450a0a', text: '#fca5a5', border: '#991b1b' },
  { value: 'Review', label: 'Review', bg: '#3b0764', text: '#d8b4fe', border: '#6b21a8' },
  { value: 'Completed', label: 'Completed', bg: '#064e3b', text: '#6ee7b7', border: '#047857' },
  { value: 'Closed', label: 'Closed', bg: '#1e293b', text: '#64748b', border: '#334155' },
  { value: 'Backlog', label: 'Backlog', bg: '#334155', text: '#cbd5e1', border: '#475569' },
];

export const CardStatusSelect: React.FC<CardStatusSelectProps> = ({ value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = STATUS_OPTIONS.find(s => s.value === value) || {
    value,
    label: value || 'Not Start',
    bg: '#1e293b',
    text: '#94a3b8',
    border: '#334155'
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

  return (
    <div
      ref={containerRef}
      onClick={(e) => e.stopPropagation()}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '0.68rem',
          fontWeight: 600,
          backgroundColor: current.bg,
          color: current.text,
          border: `1px solid ${current.border}`,
          cursor: 'pointer',
          outline: 'none',
          lineHeight: 1.2,
          transition: 'all 0.15s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.filter = 'brightness(1.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = 'none';
        }}
        title="點擊切換狀態 (直接寫入資料庫)"
      >
        <span>{current.label}</span>
        <ChevronDown size={10} style={{ opacity: 0.7 }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 100,
            backgroundColor: '#131b2e',
            border: '1px solid #23304a',
            borderRadius: '6px',
            padding: '4px',
            minWidth: '120px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}
        >
          {STATUS_OPTIONS.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 8px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: isSelected ? 700 : 500,
                  backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                  color: isSelected ? '#38bdf8' : '#cbd5e1',
                  cursor: 'pointer',
                  transition: 'background-color 0.12s'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: opt.text
                    }}
                  />
                  <span>{opt.label}</span>
                </div>
                {isSelected && <Check size={12} color="#38bdf8" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
