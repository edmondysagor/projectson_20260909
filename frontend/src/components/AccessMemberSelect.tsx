import React, { useState, useRef, useEffect } from 'react';
import { Search, UserPlus, ChevronDown, Check, X, Users } from 'lucide-react';
import { api } from '../utils/api';
import type { Member } from '../utils/api';

interface AccessMemberSelectProps {
  allowAccessMembers?: Array<{ member_uid: string; role_in_this_workspace?: string } | string>;
  members: Member[];
  onChange: (newAccessMembers: Array<{ member_uid: string; role_in_this_workspace: string }>) => Promise<void> | void;
  onRefreshMembers?: () => Promise<void> | void;
  placeholder?: string;
  style?: React.CSSProperties;
}

export const AccessMemberSelect: React.FC<AccessMemberSelectProps> = ({
  allowAccessMembers = [],
  members,
  onChange,
  onRefreshMembers,
  placeholder = '+ 新增存取成員...',
  style
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize allowAccessMembers to list of member UIDs
  const currentUids: string[] = (Array.isArray(allowAccessMembers) ? allowAccessMembers : [])
    .map((item: any) => (typeof item === 'string' ? item : item?.member_uid))
    .filter(Boolean);

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

  const handleToggleMember = async (memberUid: string) => {
    let nextUids: string[];
    if (currentUids.includes(memberUid)) {
      nextUids = currentUids.filter(id => id !== memberUid);
    } else {
      nextUids = [...currentUids, memberUid];
    }
    const formatted = nextUids.map(uid => ({ member_uid: uid, role_in_this_workspace: 'Member' }));
    await onChange(formatted);
  };

  const handleRemoveMember = async (e: React.MouseEvent, memberUid: string) => {
    e.stopPropagation();
    const nextUids = currentUids.filter(id => id !== memberUid);
    const formatted = nextUids.map(uid => ({ member_uid: uid, role_in_this_workspace: 'Member' }));
    await onChange(formatted);
  };

  const handleCreateAndAdd = async () => {
    const nameToCreate = searchQuery.trim();
    if (!nameToCreate) return;
    setCreating(true);
    try {
      const newMember = await api.provisionMember({ member_name: nameToCreate });
      if (onRefreshMembers) {
        await onRefreshMembers();
      }
      const nextUids = [...currentUids, newMember.member_uid];
      const formatted = nextUids.map(uid => ({ member_uid: uid, role_in_this_workspace: 'Member' }));
      await onChange(formatted);
      setSearchQuery('');
    } catch (err: any) {
      alert('建立成員失敗: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      {/* 1. 已選成員標籤清單 (Chips) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: currentUids.length > 0 ? '8px' : '0' }}>
        {currentUids.map(uid => {
          const m = members.find(item => item.member_uid === uid);
          const name = m ? m.member_name : `成員 (${uid.slice(0, 5)})`;
          const initial = name.charAt(0).toUpperCase();

          return (
            <div
              key={uid}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 8px',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                borderRadius: '16px',
                color: '#93c5fd',
                fontSize: '0.78rem',
                fontWeight: 500
              }}
            >
              <span
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.62rem',
                  fontWeight: 700
                }}
              >
                {initial}
              </span>
              <span>{name}</span>
              <button
                type="button"
                onClick={(e) => handleRemoveMember(e, uid)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="移除存取成員"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* 2. 新增存取成員按鈕 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '6px 10px',
          backgroundColor: '#1b2438',
          border: '1px solid #2d3b55',
          borderRadius: '6px',
          color: '#cbd5e1',
          fontSize: '0.82rem',
          fontWeight: 500,
          cursor: 'pointer',
          width: '100%',
          boxSizing: 'border-box',
          outline: 'none',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'border-color 0.15s, background-color 0.15s'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#222d45')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#1b2438')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <Users size={14} color="#38bdf8" />
          <span style={{ color: currentUids.length > 0 ? '#cbd5e1' : '#64748b' }}>
            {currentUids.length > 0 ? `已設定 ${currentUids.length} 位存取成員` : placeholder}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid #334155', paddingLeft: '6px', marginLeft: '4px' }}>
          <ChevronDown size={14} color="#94a3b8" />
        </div>
      </button>

      {/* 3. 搜尋 + 建立 下拉選單 */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '100%',
            minWidth: '240px',
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0c1222',
              border: '1px solid #2d3b55',
              borderRadius: '6px',
              padding: '4px 8px',
              marginBottom: '8px'
            }}
          >
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

          {/* 成員清單 */}
          <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {filteredMembers.map(m => {
              const isSelected = currentUids.includes(m.member_uid);
              return (
                <button
                  key={m.member_uid}
                  type="button"
                  onClick={() => handleToggleMember(m.member_uid)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                    border: 'none',
                    color: isSelected ? '#38bdf8' : '#f8fafc',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isSelected ? 'rgba(56, 189, 248, 0.2)' : '#1e293b')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <span
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: isSelected ? '#38bdf8' : '#3b82f6',
                        color: isSelected ? '#0f172a' : '#fff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        flexShrink: 0
                      }}
                    >
                      {m.member_name.charAt(0).toUpperCase()}
                    </span>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 500 }}>{m.member_name}</span>
                    </div>
                  </div>
                  {isSelected && <Check size={14} color="#38bdf8" />}
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
                onClick={handleCreateAndAdd}
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
                <span>{creating ? '建立中...' : `+ 建立 "${searchQuery.trim()}"`}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
