import React, { useState, useRef, useEffect } from 'react';
import { Search, UserPlus, ChevronDown, Check, X } from 'lucide-react';
import { api } from '../utils/api';
import type { Member } from '../utils/api';

interface MemberSelectProps {
  value?: string; // member_uid
  members: Member[];
  onChange: (memberUid: string | null) => Promise<void> | void;
  onRefreshMembers?: () => Promise<void> | void;
  placeholder?: string;
  allowClear?: boolean;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
  buttonStyle?: React.CSSProperties;
}

export const MemberSelect: React.FC<MemberSelectProps> = ({
  value,
  members,
  onChange,
  onRefreshMembers,
  placeholder = '+ 指派成員...',
  allowClear = true,
  size = 'md',
  style,
  buttonStyle
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedMember = members.find(m => m.member_uid === value);

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

  const filteredMembers = members.filter(m => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return m.member_name.toLowerCase().includes(q) || m.member_email.toLowerCase().includes(q);
  });

  const exactMatch = members.some(m => m.member_name.toLowerCase() === searchQuery.trim().toLowerCase());

  const handleSelectMember = async (memberUid: string | null) => {
    await onChange(memberUid);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleCreateAndSelect = async () => {
    const nameToCreate = searchQuery.trim();
    if (!nameToCreate) return;
    setCreating(true);
    try {
      const newMember = await api.provisionMember({ member_name: nameToCreate });
      if (onRefreshMembers) {
        await onRefreshMembers();
      }
      await onChange(newMember.member_uid);
      setIsOpen(false);
      setSearchQuery('');
    } catch (err: any) {
      alert('建立成員失敗: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const isSmall = size === 'sm';

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', width: style?.width || 'auto', ...style }}>
      {/* 觸發按鈕 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: isSmall ? '3px 8px' : '6px 10px',
          backgroundColor: '#1b2438',
          border: '1px solid #2d3b55',
          borderRadius: '6px',
          color: selectedMember ? '#f8fafc' : '#94a3b8',
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
          {selectedMember ? (
            <>
              <span style={{
                width: isSmall ? '16px' : '20px',
                height: isSmall ? '16px' : '20px',
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isSmall ? '0.62rem' : '0.7rem',
                fontWeight: 700,
                flexShrink: 0
              }}>
                {selectedMember.member_name.charAt(0).toUpperCase()}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedMember.member_name}
              </span>
            </>
          ) : (
            <span style={{ color: '#64748b' }}>{placeholder}</span>
          )}
        </div>

        {/* 右側分隔線與下拉箭頭 (對齊 圖1 按鈕風格) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid #334155', paddingLeft: '6px', marginLeft: '4px' }}>
          <ChevronDown size={14} color="#94a3b8" />
        </div>
      </button>

      {/* 搜尋 + 建立 下拉卡片 (對齊 圖1 懸浮卡片質感) */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '230px',
            backgroundColor: '#161f32',
            border: '1px solid #2d3b55',
            borderRadius: '8px',
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            zIndex: 999,
            padding: '8px',
            boxSizing: 'border-box'
          }}
        >
          {/* 搜尋列 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#0c1222',
            border: '1px solid #2d3b55',
            borderRadius: '6px',
            padding: '4px 8px',
            marginBottom: '8px'
          }}>
            <Search size={14} color="#64748b" />
            <input
              autoFocus
              type="text"
              placeholder="搜尋或輸入以新增..."
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

          {/* 成員列表 */}
          <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {allowClear && (
              <button
                type="button"
                onClick={() => handleSelectMember(null)}
                style={{
                  textAlign: 'left',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  background: !value ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                  border: 'none',
                  color: !value ? '#38bdf8' : '#94a3b8',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = !value ? 'rgba(56, 189, 248, 0.12)' : 'transparent'}
              >
                <span>-- 未指定 (Unassigned) --</span>
                {!value && <Check size={12} color="#38bdf8" />}
              </button>
            )}

            {filteredMembers.map(m => {
              const isSelected = m.member_uid === value;
              return (
                <button
                  key={m.member_uid}
                  type="button"
                  onClick={() => handleSelectMember(m.member_uid)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px',
                    padding: '5px 8px',
                    borderRadius: '6px',
                    background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                    border: 'none',
                    color: isSelected ? '#38bdf8' : '#f8fafc',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <span style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: '#3b82f6',
                      color: '#fff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      flexShrink: 0
                    }}>
                      {m.member_name.charAt(0).toUpperCase()}
                    </span>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 500 }}>{m.member_name}</span>
                    </div>
                  </div>
                  {isSelected && <Check size={12} color="#38bdf8" />}
                </button>
              );
            })}

            {filteredMembers.length === 0 && !searchQuery.trim() && (
              <div style={{ padding: '8px', textAlign: 'center', color: '#64748b', fontSize: '0.75rem' }}>
                尚無成員
              </div>
            )}

            {/* 新增並寫入 member table 的快捷按鈕 */}
            {searchQuery.trim() && !exactMatch && (
              <button
                type="button"
                disabled={creating}
                onClick={handleCreateAndSelect}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  backgroundColor: '#1e3a8a',
                  border: '1px solid #3b82f6',
                  color: '#93c5fd',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginTop: '4px'
                }}
              >
                <UserPlus size={14} />
                <span>
                  {creating ? '建立中...' : `+ 建立 "${searchQuery.trim()}"`}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
