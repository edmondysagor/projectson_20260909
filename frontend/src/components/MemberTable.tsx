import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Check, 
  X, 
  Trash2 
} from 'lucide-react';
import { api } from '../utils/api';
import type { Member } from '../utils/api';
import { CustomSelect } from './CustomSelect';

interface MemberTableProps {
  members: Member[];
  onRefresh: () => Promise<void>;
}

export const MemberTable: React.FC<MemberTableProps> = ({
  members,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // 框底快速新增狀態
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberAdGroup, setNewMemberAdGroup] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // Inline edit 儲存格狀態: { uid, field }
  const [editingCell, setEditingCell] = useState<{ uid: string; field: 'member_name' | 'member_email' | 'member_ad_group' } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const handleStartEdit = (uid: string, field: 'member_name' | 'member_email' | 'member_ad_group', initialVal: string) => {
    setEditingCell({ uid, field });
    setEditValue(initialVal || '');
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleSaveEdit = async (uid: string, field: 'member_name' | 'member_email' | 'member_ad_group') => {
    if (field === 'member_name' && !editValue.trim()) {
      alert('姓名不可為空');
      return;
    }
    if (field === 'member_email' && !editValue.trim()) {
      alert('電子郵件不可為空');
      return;
    }
    try {
      await api.patchMember(uid, { [field]: editValue.trim() });
      setEditingCell(null);
      await onRefresh();
    } catch (err: any) {
      alert('更新失敗: ' + err.message);
    }
  };

  const handleUpdateStatus = async (uid: string, newStatus: string) => {
    try {
      await api.patchMember(uid, { member_status: newStatus });
      await onRefresh();
    } catch (err: any) {
      alert('更新狀態失敗: ' + err.message);
    }
  };

  const handleDeleteMember = async (e: React.MouseEvent, m: Member) => {
    e.stopPropagation();
    if (confirm(`確定要刪除成員 [${m.member_name}] 嗎？此操作不可逆。`)) {
      try {
        await api.deleteMember(m.member_uid);
        await onRefresh();
      } catch (err: any) {
        alert('刪除失敗: ' + err.message);
      }
    }
  };

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberEmail.trim()) return;
    setAddLoading(true);
    try {
      await api.provisionMember({
        member_name: newMemberName.trim(),
        member_email: newMemberEmail.trim(),
        member_ad_group: newMemberAdGroup.trim() || undefined
      });
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberAdGroup('');
      setShowQuickAdd(false);
      await onRefresh();
    } catch (err: any) {
      alert('新增成員失敗: ' + err.message);
    } finally {
      setAddLoading(false);
    }
  };

  // 篩選
  const filteredMembers = members.filter(m => {
    const query = searchQuery.trim().toLowerCase();
    const matchSearch = !query || 
      m.member_name.toLowerCase().includes(query) ||
      m.member_email.toLowerCase().includes(query) ||
      (m.member_ad_group && m.member_ad_group.toLowerCase().includes(query));
    const matchStatus = filterStatus === 'ALL' || m.member_status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#090d16',
      color: '#f8fafc',
      overflow: 'hidden'
    }}>
      {/* 頂部大標題與工具欄 (對齊 All Items 總表規格) */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.3px' }}>
            工作區成員總表 (Workspace Member Table View)
          </h1>

          <button
            onClick={() => setShowQuickAdd(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)'
            }}
          >
            <Plus size={16} /> 新增成員
          </button>
        </div>

        {/* 搜尋欄與篩選器 (Input search bar, filter) */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="搜尋姓名、電子郵件、AD 群組..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px 8px 34px',
                backgroundColor: '#131b2e',
                border: '1px solid #23304a',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '0.85rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <CustomSelect
              value={filterStatus}
              options={[
                { value: 'ALL', label: '全部狀態 (All Statuses)' },
                { value: 'Active', label: 'Active (啟用)', badgeBg: '#064e3b', badgeColor: '#6ee7b7' },
                { value: 'Inactive', label: 'Inactive (停用)', badgeBg: '#1e293b', badgeColor: '#94a3b8' },
                { value: 'Pending', label: 'Pending (待核)', badgeBg: '#78350f', badgeColor: '#fde68a' }
              ]}
              onChange={(val) => setFilterStatus(val)}
            />
          </div>
        </div>
      </div>

      {/* 表格主體 (Table view 支援 inline edit) */}
      <div style={{
        flex: 1,
        margin: '16px 24px',
        backgroundColor: '#0f172a',
        borderRadius: '12px',
        border: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{
            width: '100%',
            minWidth: '750px',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '0.85rem'
          }}>
            <thead>
              <tr style={{
                backgroundColor: '#131b2e',
                borderBottom: '2px solid #1e293b',
                color: '#94a3b8',
                textTransform: 'uppercase',
                fontSize: '0.75rem',
                letterSpacing: '0.5px'
              }}>
                <th style={{ padding: '12px 16px', width: '220px' }}>姓名 (點擊就地編輯)</th>
                <th style={{ padding: '12px 16px', minWidth: '240px' }}>電子郵件 (點擊就地編輯)</th>
                <th style={{ padding: '12px 16px', width: '180px' }}>AD 群組 (點擊就地編輯)</th>
                <th style={{ padding: '12px 16px', width: '140px' }}>狀態 (下拉即改)</th>
                <th style={{ padding: '12px 16px', width: '80px', textAlign: 'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    尚無符合條件的成員
                  </td>
                </tr>
              ) : (
                filteredMembers.map(m => {
                  const isEditingName = editingCell?.uid === m.member_uid && editingCell?.field === 'member_name';
                  const isEditingEmail = editingCell?.uid === m.member_uid && editingCell?.field === 'member_email';
                  const isEditingAd = editingCell?.uid === m.member_uid && editingCell?.field === 'member_ad_group';

                  return (
                    <tr 
                      key={m.member_uid}
                      style={{
                        borderBottom: '1px solid #1e293b',
                        transition: 'background-color 0.15s',
                        cursor: 'default'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {/* 姓名 (Inline edit) */}
                      <td style={{ padding: '10px 16px' }}>
                        {isEditingName ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="text"
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(m.member_uid, 'member_name');
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                              style={{
                                flex: 1,
                                padding: '4px 8px',
                                backgroundColor: '#131b2e',
                                border: '1px solid #3b82f6',
                                borderRadius: '4px',
                                color: '#fff',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            />
                            <button
                              onClick={() => handleSaveEdit(m.member_uid, 'member_name')}
                              style={{ background: 'transparent', border: 'none', color: '#22c55e', cursor: 'pointer', padding: '2px' }}
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div 
                            onClick={() => handleStartEdit(m.member_uid, 'member_name', m.member_name)}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px', 
                              cursor: 'pointer',
                              padding: '2px 4px',
                              borderRadius: '4px'
                            }}
                            title="點擊修改姓名"
                          >
                            <span style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: '#3b82f6',
                              color: '#fff',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              flexShrink: 0
                            }}>
                              {m.member_name.charAt(0).toUpperCase()}
                            </span>
                            <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                              {m.member_name}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 電子郵件 (Inline edit) */}
                      <td style={{ padding: '10px 16px' }}>
                        {isEditingEmail ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="email"
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(m.member_uid, 'member_email');
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                              style={{
                                flex: 1,
                                padding: '4px 8px',
                                backgroundColor: '#131b2e',
                                border: '1px solid #3b82f6',
                                borderRadius: '4px',
                                color: '#fff',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            />
                            <button
                              onClick={() => handleSaveEdit(m.member_uid, 'member_email')}
                              style={{ background: 'transparent', border: 'none', color: '#22c55e', cursor: 'pointer', padding: '2px' }}
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => handleStartEdit(m.member_uid, 'member_email', m.member_email)}
                            style={{ 
                              color: '#38bdf8', 
                              cursor: 'pointer',
                              padding: '2px 4px',
                              borderRadius: '4px'
                            }}
                            title="點擊修改郵件"
                          >
                            {m.member_email}
                          </div>
                        )}
                      </td>

                      {/* AD 群組 (Inline edit) */}
                      <td style={{ padding: '10px 16px' }}>
                        {isEditingAd ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="text"
                              autoFocus
                              placeholder="例: IT-Support, Developers"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(m.member_uid, 'member_ad_group');
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                              style={{
                                flex: 1,
                                padding: '4px 8px',
                                backgroundColor: '#131b2e',
                                border: '1px solid #3b82f6',
                                borderRadius: '4px',
                                color: '#fff',
                                fontSize: '0.85rem',
                                outline: 'none'
                              }}
                            />
                            <button
                              onClick={() => handleSaveEdit(m.member_uid, 'member_ad_group')}
                              style={{ background: 'transparent', border: 'none', color: '#22c55e', cursor: 'pointer', padding: '2px' }}
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => handleStartEdit(m.member_uid, 'member_ad_group', m.member_ad_group || '')}
                            style={{ 
                              color: m.member_ad_group ? '#94a3b8' : '#64748b', 
                              cursor: 'pointer',
                              padding: '2px 4px',
                              borderRadius: '4px'
                            }}
                            title="點擊修改 AD 群組"
                          >
                            {m.member_ad_group || '-'}
                          </div>
                        )}
                      </td>

                      {/* 狀態 (下拉即改) */}
                      <td style={{ padding: '10px 16px' }}>
                        <CustomSelect
                          size="sm"
                          value={m.member_status || 'Active'}
                          options={[
                            { value: 'Active', label: 'Active', badgeBg: '#064e3b', badgeColor: '#6ee7b7' },
                            { value: 'Inactive', label: 'Inactive', badgeBg: '#1e293b', badgeColor: '#94a3b8' },
                            { value: 'Pending', label: 'Pending', badgeBg: '#78350f', badgeColor: '#fde68a' }
                          ]}
                          onChange={(newStatus) => handleUpdateStatus(m.member_uid, newStatus)}
                        />
                      </td>

                      {/* 刪除操作 */}
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <button
                          onClick={(e) => handleDeleteMember(e, m)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#64748b',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            transition: 'color 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                          title="刪除成員"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 框底新增功能 Input Bar */}
        <div style={{
          borderTop: '1px solid #1e293b',
          backgroundColor: '#0c1222',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0
        }}>
          {showQuickAdd ? (
            <form onSubmit={handleQuickCreate} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              flexWrap: 'wrap'
            }}>
              <input
                type="text"
                required
                autoFocus
                placeholder="成員姓名 (Member Name)..."
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: '160px',
                  padding: '7px 12px',
                  backgroundColor: '#090d16',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              <input
                type="email"
                required
                placeholder="電子郵件 (Member Email)..."
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: '200px',
                  padding: '7px 12px',
                  backgroundColor: '#090d16',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              <input
                type="text"
                placeholder="AD 群組 (可選)..."
                value={newMemberAdGroup}
                onChange={(e) => setNewMemberAdGroup(e.target.value)}
                style={{
                  width: '150px',
                  padding: '7px 12px',
                  backgroundColor: '#090d16',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                disabled={addLoading}
                style={{
                  padding: '7px 14px',
                  backgroundColor: '#16a34a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                <Check size={15} /> {addLoading ? '建立中...' : '儲存'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowQuickAdd(false);
                  setNewMemberName('');
                  setNewMemberEmail('');
                  setNewMemberAdGroup('');
                }}
                style={{
                  padding: '7px 12px',
                  backgroundColor: '#334155',
                  color: '#cbd5e1',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                <X size={15} /> 取消
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowQuickAdd(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                fontSize: '0.85rem',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px',
                transition: 'color 0.15s, background-color 0.15s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#38bdf8';
                e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#64748b';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Plus size={16} /> + 新增成員 (Workspace Member)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
