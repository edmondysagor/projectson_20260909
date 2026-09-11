import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
  badgeBg?: string;
  badgeColor?: string;
}

interface MultiSelectProps {
  values: string[]; // ['ALL'] or selected values
  options: (string | MultiSelectOption)[];
  onChange: (newValues: string[]) => void;
  allLabel?: string;
  style?: React.CSSProperties;
  buttonStyle?: React.CSSProperties;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  values,
  options,
  onChange,
  allLabel = '全部 (All)',
  style,
  buttonStyle
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const normalizedOptions: MultiSelectOption[] = options.map(opt => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  const allSelected = values.length === 0 || values.includes('ALL');

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

  const handleToggleOption = (val: string) => {
    if (val === 'ALL') {
      onChange(['ALL']);
      return;
    }

    if (allSelected) {
      onChange([val]);
      return;
    }

    if (values.includes(val)) {
      const remaining = values.filter(v => v !== val);
      if (remaining.length === 0) {
        onChange(['ALL']);
      } else {
        onChange(remaining);
      }
    } else {
      const next = [...values, val];
      if (next.length === normalizedOptions.length) {
        onChange(['ALL']);
      } else {
        onChange(next);
      }
    }
  };

  let labelDisplay = allLabel;
  if (!allSelected && values.length > 0) {
    if (values.length === 1) {
      const found = normalizedOptions.find(o => o.value === values[0]);
      labelDisplay = found ? found.label : values[0];
    } else {
      labelDisplay = `已選 (${values.length})`;
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        ...style
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '6px 12px',
          backgroundColor: '#131b2e',
          border: isOpen ? '1px solid #38bdf8' : '1px solid #23304a',
          borderRadius: '8px',
          color: allSelected ? '#94a3b8' : '#38bdf8',
          fontSize: '0.82rem',
          fontWeight: 500,
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap',
          minHeight: '36px',
          boxSizing: 'border-box',
          ...buttonStyle
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
          {labelDisplay}
        </span>
        <ChevronDown size={14} style={{ color: '#94a3b8', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 100,
            minWidth: '200px',
            maxHeight: '280px',
            overflowY: 'auto',
            backgroundColor: '#0c1222',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
            padding: '4px'
          }}
        >
          {/* ALL option */}
          <div
            onClick={() => handleToggleOption('ALL')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: allSelected ? 600 : 400,
              color: allSelected ? '#38bdf8' : '#cbd5e1',
              backgroundColor: allSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
              cursor: 'pointer',
              marginBottom: '2px'
            }}
            onMouseEnter={(e) => {
              if (!allSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            }}
            onMouseLeave={(e) => {
              if (!allSelected) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span>{allLabel}</span>
            {allSelected && <Check size={14} color="#38bdf8" />}
          </div>

          <div style={{ height: '1px', backgroundColor: '#1e293b', margin: '4px 0' }} />

          {/* Individual options */}
          {normalizedOptions.map(opt => {
            const isSelected = !allSelected && values.includes(opt.value);
            return (
              <div
                key={opt.value}
                onClick={() => handleToggleOption(opt.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: isSelected ? 600 : 400,
                  color: isSelected ? '#38bdf8' : '#cbd5e1',
                  backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                  cursor: 'pointer',
                  marginBottom: '2px'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    style={{ cursor: 'pointer', accentColor: '#38bdf8' }}
                  />
                  <span>{opt.label}</span>
                </div>
                {opt.badgeBg && (
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: opt.badgeBg,
                    color: opt.badgeColor || '#fff',
                    fontWeight: 600
                  }}>
                    {opt.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
