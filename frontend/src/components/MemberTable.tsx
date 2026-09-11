import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Check, 
  X, 
  Trash2,
  Shield
} from 'lucide-react';
import { api } from '../utils/api';
import type { Member, Workspace, Project } from '../utils/api';
import { CustomSelect } from './CustomSelect';
import { MultiSelect } from './MultiSelect';
import { MemberAccessDrawer } from './MemberAccessDrawer';
import { useColumnResize, Resizer } from '../hooks/useColumnResize';

interface MemberTableProps {
  members: Member[];
  workspace?: Workspace | null;
  products?: Project[];
  projects?: Project[];
  onRefresh: () => Promise<void>;
}

export const MemberTable: React.FC<MemberTableProps> = ({
  members,
  workspace = null,
  products = [],
  projects = [],
  onRefresh,
}) => {
  const { columnWidths, onResizeStart } = useColumnResize({
    name: 220,
    email: 220,
    ad_group: 160,
    access: 170,
    status: 130,
    action: 110
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatuses, setFilterStatuses] = useState<string[]>(['ALL']);
  const [selectedMemberForAccess, setSelectedMemberForAccess] = useState<Member | null>(null);

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
    const matchStatus = filterStatuses.includes('ALL') || filterStatuses.includes(m.member_status);
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
            <MultiSelect
              values={filterStatuses}
              allLabel="全部狀態 (All Statuses)"
              options={[
                { value: 'Active', label: 'Active (啟用)', badgeBg: '#064e3b', badgeColor: '#6ee7b7' },
                { value: 'Inactive', label: 'Inactive (停用)', badgeBg: '#1e293b', badgeColor: '#94a3b8' },
                { value: 'Pending', label: 'Pending (待核)', badgeBg: '#78350f', badgeColor: '#fde68a' }
              ]}
              onChange={(vals) => setFilterStatuses(vals)}
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
            borderCollapse: 'separate',
            borderSpacing: 0,
            textAlign: 'left',
            fontSize: '0.85rem'
          }}>
            <thead>
              <tr style={{
                color: '#94a3b8',
                textTransform: 'uppercase',
                fontSize: '0.75rem',
                letterSpacing: '0.5px'
              }}>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: `${columnWidths.name}px`, minWidth: `${columnWidths.name}px` }}>
                  <span>姓名 (點擊就地編輯)</span>
                  <Resizer onMouseDown={(e) => onResizeStart('name', columnWidths.name, e)} />
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: `${columnWidths.email}px`, minWidth: `${columnWidths.email}px` }}>
                  <span>電子郵件 (點擊就地編輯)</span>
                  <Resizer onMouseDown={(e) => onResizeStart('email', columnWidths.email, e)} />
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: `${columnWidths.ad_group}px`, minWidth: `${columnWidths.ad_group}px` }}>
                  <span>AD 群組 (點擊就地編輯)</span>
                  <Resizer onMouseDown={(e) => onResizeStart('ad_group', columnWidths.ad_group, e)} />
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: `${columnWidths.access}px`, minWidth: `${columnWidths.access}px` }}>
                  <span>權限範圍 (Access)</span>
                  <Resizer onMouseDown={(e) => onResizeStart('access', columnWidths.access, e)} />
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: `${columnWidths.status}px`, minWidth: `${columnWidths.status}px` }}>
                  <span>狀態 (下拉即改)</span>
                  <Resizer onMouseDown={(e) => onResizeStart('status', columnWidths.status, e)} />
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: `${columnWidths.action}px`, minWidth: `${columnWidths.action}px`, textAlign: 'center' }}>
                  <span>操作</span>
                  <Resizer onMouseDown={(e) => onResizeStart('action', columnWidths.action, e)} />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
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

                      {/* 權限範圍 (Access Scope - 點擊開啟管理抽屜) */}
                      <td style={{ padding: '10px 16px' }}>
                        {(() => {
                          const isGlobal = (workspace?.allow_access_member || []).some((item: any) =>
                            (typeof item === 'string' ? item : item?.member_uid) === m.member_uid
                          );
                          const prodCount = products.filter(p =>
                            (p.allow_access_member || []).some((item: any) => (typeof item === 'string' ? item : item?.member_uid) === m.member_uid)
                          ).length;
                          const projCount = projects.filter(p =>
                            (p.allow_access_member || []).some((item: any) => (typeof item === 'string' ? item : item?.member_uid) === m.member_uid)
                          ).length;

                          return (
                            <div
                              onClick={() => setSelectedMemberForAccess(m)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                backgroundColor: isGlobal ? 'rgba(59, 130, 246, 0.15)' : (prodCount > 0 || projCount > 0) ? 'rgba(168, 85, 247, 0.15)' : 'rgba(100, 116, 139, 0.12)',
                                border: isGlobal ? '1px solid rgba(59, 130, 246, 0.35)' : (prodCount > 0 || projCount > 0) ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid rgba(100, 116, 139, 0.25)',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.2)')}
                              onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
                              title="點擊管理成員權限"
                            >
                              {isGlobal ? (
                                <span style={{ fontSize: '0.75rem', color: '#93c5fd', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Shield size={12} /> 🏢 全域成員
                                </span>
                              ) : (prodCount > 0 || projCount > 0) ? (
                                <span style={{ fontSize: '0.75rem', color: '#d8b4fe', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {prodCount > 0 ? `📦 ${prodCount} 產品` : ''} {projCount > 0 ? `📁 ${projCount} 專案` : ''}
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>+ 設定權限</span>
                              )}
                            </div>
                          );
                        })()}
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

                      {/* 操作 (權限管理 + 刪除) */}
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <button
                            onClick={() => setSelectedMemberForAccess(m)}
                            style={{
                              background: 'rgba(59, 130, 246, 0.15)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              color: '#93c5fd',
                              cursor: 'pointer',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                            title="管理存取權限"
                          >
                            <Shield size={12} /> 權限
                          </button>
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
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
                            title="刪除成員"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
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

      {/* 成員權限管理抽屜 (Member Access Drawer) */}
      <MemberAccessDrawer
        member={selectedMemberForAccess}
        workspace={workspace}
        products={products}
        projects={projects}
        isOpen={!!selectedMemberForAccess}
        onClose={() => setSelectedMemberForAccess(null)}
        onRefresh={onRefresh}
      />
    </div>
  );
};
