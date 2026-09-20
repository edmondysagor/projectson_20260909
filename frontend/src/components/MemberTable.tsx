import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Check, 
  X, 
  UserMinus,
  UserPlus,
  Shield,
  Lock,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { api } from '../utils/api';
import type { Member, Workspace, Project } from '../utils/api';
import { useAuth } from '../context/AuthContext';
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
  const { user } = useAuth();

  const { columnWidths, onResizeStart } = useColumnResize({
    name: 200,
    email: 280,
    ad_group: 140,
    access: 220,
    status: 120,
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
  const [newMemberRole, setNewMemberRole] = useState<'Admin' | 'Member'>('Member');
  const [addLoading, setAddLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  // Inline edit 儲存格狀態: { uid, field }
  const [editingCell, setEditingCell] = useState<{ uid: string; field: 'member_name' | 'member_email' | 'member_ad_group' } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // 1. 計算當前登入者在此工作空間的角色 (Owner | Admin | Member)
  const isCurrentUserOwner = Boolean(
    user?.email && workspace?.owner_email &&
    workspace.owner_email.toLowerCase() === user.email.toLowerCase()
  );

  const currentMemberObj = members.find(m => 
    user?.email && m.member_email && m.member_email.toLowerCase() === user.email.toLowerCase()
  );

  const isCurrentUserAdmin = !isCurrentUserOwner && Boolean(
    workspace && (
      (workspace.allow_access_member || []).some((item: any) => {
        const uid = typeof item === 'string' ? item : item?.member_uid;
        const role = typeof item === 'object' ? item?.role_in_this_workspace : undefined;
        return (uid === currentMemberObj?.member_uid || uid === user?.id) && (role === 'Admin' || role === 'admin');
      }) ||
      (Array.isArray(currentMemberObj?.shared_workspace_uid) && currentMemberObj.shared_workspace_uid.some((item: any) => 
        typeof item === 'object' && item?.workspace_uid === workspace.workspace_uid && item?.role === 'Admin'
      ))
    )
  );

  const currentUserRole: 'Owner' | 'Admin' | 'Member' = isCurrentUserOwner ? 'Owner' : isCurrentUserAdmin ? 'Admin' : 'Member';

  // 2. 計算任意成員在此工作空間的角色 (Owner | Admin | Member)
  const getMemberRoleInWorkspace = (m: Member): 'Owner' | 'Admin' | 'Member' => {
    if (!workspace) return 'Member';
    const isOwner = (workspace.owner_email && m.member_email && workspace.owner_email.toLowerCase() === m.member_email.toLowerCase()) ||
                    (workspace.owner_member_uid && workspace.owner_member_uid === m.member_uid) ||
                    (Array.isArray(m.own_workspace_uid) && m.own_workspace_uid.includes(workspace.workspace_uid));
    if (isOwner) return 'Owner';

    const wsItem = (workspace.allow_access_member || []).find((item: any) => 
      (typeof item === 'string' ? item : item?.member_uid) === m.member_uid
    );
    const roleInWs = typeof wsItem === 'object' ? wsItem?.role_in_this_workspace : undefined;
    if (roleInWs === 'Admin') return 'Admin';

    if (Array.isArray(m.shared_workspace_uid)) {
      const sharedItem = m.shared_workspace_uid.find((item: any) => 
        typeof item === 'object' && item?.workspace_uid === workspace.workspace_uid
      );
      if (typeof sharedItem === 'object' && (sharedItem as any)?.role === 'Admin') return 'Admin';
    }

    return 'Member';
  };

  // 3. 權限邊界判斷 (Delegation Matrix)
  // Owner 可以編輯 Admin / Member
  // Admin 只能編輯 Member
  // Member 不能編輯任何人
  const canEditMember = (targetMember: Member): boolean => {
    const targetRole = getMemberRoleInWorkspace(targetMember);
    const isSelf = (user?.email && targetMember.member_email && user.email.toLowerCase() === targetMember.member_email.toLowerCase()) ||
                   (currentMemberObj && currentMemberObj.member_uid === targetMember.member_uid);
    
    if (currentUserRole === 'Owner') {
      return !isSelf && targetRole !== 'Owner';
    }
    if (currentUserRole === 'Admin') {
      return !isSelf && targetRole === 'Member';
    }
    return false;
  };

  // 移除權限判斷：
  // Owner 不能被移除
  // Admin 只能被 Owner 移除
  // Member 可被 Owner 或 Admin 移除
  const canRemoveMember = (targetMember: Member): boolean => {
    const targetRole = getMemberRoleInWorkspace(targetMember);
    if (targetRole === 'Owner') return false; // 擁有者絕對不可移除

    const isSelf = (user?.email && targetMember.member_email && user.email.toLowerCase() === targetMember.member_email.toLowerCase()) ||
                   (currentMemberObj && currentMemberObj.member_uid === targetMember.member_uid);

    if (currentUserRole === 'Owner') {
      return !isSelf;
    }
    if (currentUserRole === 'Admin') {
      return !isSelf && targetRole === 'Member';
    }
    return false;
  };

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

  // 點擊外面關閉 Auto-complete 建議選單
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 從本工作空間除名 (不刪除系統成員帳號，只清除該工作空間與專案權限)
  const handleRemoveMemberFromWorkspace = async (e: React.MouseEvent, m: Member) => {
    e.stopPropagation();
    if (!workspace) return;
    
    if (!canRemoveMember(m)) {
      alert('權限限制：您無法移除此成員。');
      return;
    }

    const targetRole = getMemberRoleInWorkspace(m);
    if (confirm(`確定要將 ${targetRole}「${m.member_name}」(${m.member_email}) 從本工作空間【${workspace.workspace_name}】除名嗎？\n\n📌 此操作只會清除該成員在此工作空間與相關專案的存取權限，不會刪除該成員的系統帳戶。`)) {
      try {
        await api.removeWorkspaceMember(workspace.workspace_uid, m.member_uid);
        await onRefresh();
      } catch (err: any) {
        alert('除名失敗: ' + err.message);
      }
    }
  };

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmail.trim()) return;
    setAddLoading(true);
    try {
      // 1. 查找或 provision 成員
      const member = await api.provisionMember({
        member_name: newMemberName.trim() || newMemberEmail.split('@')[0],
        member_email: newMemberEmail.trim(),
        member_ad_group: newMemberAdGroup.trim() || undefined
      });

      // 2. 自動將該成員加入當前工作空間 (帶入指定角色)
      if (workspace) {
        const assignedRole = currentUserRole === 'Owner' ? newMemberRole : 'Member';
        await api.addWorkspaceMember(workspace.workspace_uid, {
          member_uid: member.member_uid,
          role_in_this_workspace: assignedRole
        });
      }

      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberAdGroup('');
      setNewMemberRole('Member');
      setShowQuickAdd(false);
      setShowSuggestions(false);
      await onRefresh();
    } catch (err: any) {
      alert('加入成員失敗: ' + err.message);
    } finally {
      setAddLoading(false);
    }
  };

  // 篩選：只顯示此工作空間所屬成員（Owner 或已被加入工作區/專案權限的成員）
  const workspaceMembers = members.filter(m => {
    if (!workspace) return true;
    
    // 是否為工作區 Owner
    const isOwner = (workspace.owner_email && m.member_email && workspace.owner_email.toLowerCase() === m.member_email.toLowerCase()) ||
                    (workspace.owner_member_uid && workspace.owner_member_uid === m.member_uid) ||
                    (Array.isArray(m.own_workspace_uid) && m.own_workspace_uid.includes(workspace.workspace_uid));
    
    // 是否在工作空間 allow_access_member 或 shared_workspace_uid
    const inWsAccess = (workspace.allow_access_member || []).some((item: any) =>
      (typeof item === 'string' ? item : item?.member_uid) === m.member_uid
    ) || (Array.isArray(m.shared_workspace_uid) && m.shared_workspace_uid.includes(workspace.workspace_uid));

    // 是否在此工作空間下的任何產品/專案中
    const inProjAccess = products.some(p => (p.allow_access_member || []).some((item: any) => (typeof item === 'string' ? item : item?.member_uid) === m.member_uid)) ||
                         projects.some(p => (p.allow_access_member || []).some((item: any) => (typeof item === 'string' ? item : item?.member_uid) === m.member_uid));

    return isOwner || inWsAccess || inProjAccess;
  });

  // 搜尋過濾
  const filteredMembers = workspaceMembers.filter(m => {
    const query = searchQuery.trim().toLowerCase();
    const matchSearch = !query || 
      m.member_name.toLowerCase().includes(query) ||
      m.member_email.toLowerCase().includes(query) ||
      (m.member_ad_group && m.member_ad_group.toLowerCase().includes(query));
    const matchStatus = filterStatuses.includes('ALL') || filterStatuses.includes(m.member_status);
    return matchSearch && matchStatus;
  });

  // 已認證會員候選清單（用以自動建議搜尋）
  const verifiedSuggestions = members.filter(m => {
    if (!newMemberEmail.trim()) return m.is_oauth_verified;
    const q = newMemberEmail.trim().toLowerCase();
    return (m.member_email.toLowerCase().includes(q) || m.member_name.toLowerCase().includes(q));
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.3px' }}>
              工作區成員總表 (Workspace Member Table View)
            </h1>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '12px',
              backgroundColor: currentUserRole === 'Owner' ? 'rgba(251, 191, 36, 0.15)' : currentUserRole === 'Admin' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(56, 189, 248, 0.15)',
              color: currentUserRole === 'Owner' ? '#fbbf24' : currentUserRole === 'Admin' ? '#a5b4fc' : '#38bdf8',
              border: currentUserRole === 'Owner' ? '1px solid rgba(251, 191, 36, 0.35)' : currentUserRole === 'Admin' ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid rgba(56, 189, 248, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              {currentUserRole === 'Owner' ? '👑 您的身份: 工作區擁有者 (Owner)' : currentUserRole === 'Admin' ? '🛡️ 您的身份: 管理員 (Admin)' : '👤 您的身份: 一般成員 (Member)'}
            </span>
          </div>

          {currentUserRole !== 'Member' && (
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
          )}
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
                  <span>角色與權限範圍 (Role & Access)</span>
                  <Resizer onMouseDown={(e) => onResizeStart('access', columnWidths.access, e)} />
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: `${columnWidths.status}px`, minWidth: `${columnWidths.status}px` }}>
                  <span>狀態 (OAuth 認證)</span>
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
                  
                  const targetRole = getMemberRoleInWorkspace(m);
                  const canEdit = canEditMember(m);
                  const canRemove = canRemoveMember(m);

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
                              backgroundColor: targetRole === 'Owner' ? '#d97706' : targetRole === 'Admin' ? '#4f46e5' : '#2563eb',
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
                        ) : m.is_oauth_verified ? (
                          <div
                            style={{ 
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '2px 4px',
                              borderRadius: '4px',
                              cursor: 'not-allowed'
                            }}
                            title="🔒 該成員已通過 Google OAuth 官方認證綁定，Email 已安全鎖定無法修改"
                          >
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '3px',
                              width: '68px',
                              minWidth: '68px',
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              color: '#34d399',
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              padding: '2px 4px',
                              borderRadius: '6px',
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}>
                              <Lock size={10} /> 已鎖定
                            </span>
                            <span style={{ color: '#38bdf8' }}>{m.member_email}</span>
                          </div>
                        ) : (
                          <div
                            onClick={() => handleStartEdit(m.member_uid, 'member_email', m.member_email)}
                            style={{ 
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              color: '#38bdf8', 
                              cursor: 'pointer',
                              padding: '2px 4px',
                              borderRadius: '4px'
                            }}
                            title="點擊修改郵件（未認證，可修改）"
                          >
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '3px',
                              width: '68px',
                              minWidth: '68px',
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              color: '#fde047',
                              backgroundColor: 'rgba(234, 179, 8, 0.15)',
                              padding: '2px 4px',
                              borderRadius: '6px',
                              border: '1px solid rgba(234, 179, 8, 0.35)',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}>
                              待認證
                            </span>
                            <span>{m.member_email}</span>
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

                      {/* 角色與權限範圍 (Role & Access Scope) */}
                      <td style={{ padding: '10px 16px' }}>
                        {(() => {
                          const isGlobal = targetRole === 'Owner' || (workspace?.allow_access_member || []).some((item: any) =>
                            (typeof item === 'string' ? item : item?.member_uid) === m.member_uid
                          );
                          const prodCount = products.filter(p =>
                            (p.allow_access_member || []).some((item: any) => (typeof item === 'string' ? item : item?.member_uid) === m.member_uid)
                          ).length;
                          const projCount = projects.filter(p =>
                            (p.allow_access_member || []).some((item: any) => (typeof item === 'string' ? item : item?.member_uid) === m.member_uid)
                          ).length;

                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              {/* 角色標籤 (Role Badge) */}
                              {targetRole === 'Owner' && (
                                <span style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  color: '#fbbf24',
                                  backgroundColor: 'rgba(251, 191, 36, 0.15)',
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  border: '1px solid rgba(251, 191, 36, 0.35)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}>
                                  👑 Owner
                                </span>
                              )}
                              {targetRole === 'Admin' && (
                                <span style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  color: '#c7d2fe',
                                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  border: '1px solid rgba(99, 102, 241, 0.35)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}>
                                  🛡️ Admin
                                </span>
                              )}
                              {targetRole === 'Member' && (
                                <span style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 500,
                                  color: '#94a3b8',
                                  backgroundColor: 'rgba(148, 163, 184, 0.12)',
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  border: '1px solid rgba(148, 163, 184, 0.25)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}>
                                  👤 Member
                                </span>
                              )}

                              {/* 範圍標籤 (點擊可開啟抽屜管理) */}
                              <div
                                onClick={() => {
                                  if (canEdit || targetRole === 'Owner') setSelectedMemberForAccess(m);
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  cursor: canEdit ? 'pointer' : 'default',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: isGlobal ? 'rgba(59, 130, 246, 0.12)' : (prodCount > 0 || projCount > 0) ? 'rgba(168, 85, 247, 0.12)' : 'transparent',
                                  border: isGlobal ? '1px solid rgba(59, 130, 246, 0.25)' : (prodCount > 0 || projCount > 0) ? '1px solid rgba(168, 85, 247, 0.25)' : 'none',
                                  transition: 'all 0.15s'
                                }}
                                title={canEdit ? '點擊管理成員權限' : targetRole === 'Owner' ? '擁有者具備全部權限' : '您無權限修改此成員'}
                              >
                                {isGlobal ? (
                                  <span style={{ fontSize: '0.73rem', color: '#93c5fd', fontWeight: 500 }}>
                                    🏢 全域成員
                                  </span>
                                ) : (prodCount > 0 || projCount > 0) ? (
                                  <span style={{ fontSize: '0.73rem', color: '#d8b4fe', fontWeight: 500 }}>
                                    {prodCount > 0 ? `📦 ${prodCount} 產品` : ''} {projCount > 0 ? `📁 ${projCount} 專案` : ''}
                                  </span>
                                ) : canEdit ? (
                                  <span style={{ fontSize: '0.73rem', color: '#64748b' }}>+ 設定權限</span>
                                ) : null}
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* 狀態 (唯讀：OAuth 已認證為 Active，未認證為 Inactive) */}
                      <td style={{ padding: '10px 16px' }}>
                        {m.is_oauth_verified ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              color: '#34d399',
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                              boxShadow: '0 0 8px rgba(16, 185, 129, 0.1)',
                              userSelect: 'none'
                            }}
                            title="OAuth 官方已認證，帳號處於啟用中 (Active)"
                          >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#34d399' }} />
                            Active
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor: 'rgba(148, 163, 184, 0.12)',
                              color: '#94a3b8',
                              border: '1px solid rgba(148, 163, 184, 0.25)',
                              userSelect: 'none'
                            }}
                            title="尚未完成 OAuth 認證，帳號處於停用/待啟用 (Inactive)"
                          >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#94a3b8' }} />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* 操作 (權限管理 + 從工作區除名) */}
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          {canEdit ? (
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
                          ) : targetRole === 'Owner' ? (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                color: '#fbbf24',
                                padding: '3px 6px',
                                opacity: 0.8
                              }}
                              title="工作空間擁有者擁有全域最高權限，無須手動配置"
                            >
                              👑 擁有者
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                color: '#475569',
                                padding: '3px 6px'
                              }}
                              title="您無權限修改此成員之存取設定"
                            >
                              -
                            </span>
                          )}

                          {canRemove ? (
                            <button
                              onClick={(e) => handleRemoveMemberFromWorkspace(e, m)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.12)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#ef4444',
                                cursor: 'pointer',
                                padding: '4px 6px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.15s, background-color 0.15s, border-color 0.15s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#ffffff';
                                e.currentTarget.style.backgroundColor = '#ef4444';
                                e.currentTarget.style.borderColor = '#ef4444';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#ef4444';
                                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                              }}
                              title={`從本工作區除名 ${targetRole}「${m.member_name}」`}
                            >
                              <UserMinus size={15} />
                            </button>
                          ) : (
                            <span style={{ width: '24px' }} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 框底新增功能 Input Bar (支援已認證會員 Auto-complete + 角色選擇) */}
        <div style={{
          borderTop: '1px solid #1e293b',
          backgroundColor: '#0c1222',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0
        }}>
          {currentUserRole === 'Member' ? (
            <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={14} /> 您的身份為一般成員 (Member)，僅工作空間擁有者 (Owner) 與管理員 (Admin) 具備邀請/除名成員之權限。
            </div>
          ) : showQuickAdd ? (
            <form onSubmit={handleQuickCreate} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              flexWrap: 'wrap',
              position: 'relative'
            }}>
              {/* 電子郵件輸入框 + 已認證會員下拉推薦選單 */}
              <div ref={suggestionRef} style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="輸入 Email (自動搜尋已認證會員)..."
                  value={newMemberEmail}
                  onFocus={() => setShowSuggestions(true)}
                  onChange={(e) => {
                    setNewMemberEmail(e.target.value);
                    setShowSuggestions(true);
                  }}
                  style={{
                    width: '100%',
                    padding: '7px 12px',
                    backgroundColor: '#090d16',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />

                {/* 浮動 Auto-complete 推薦選單 */}
                {showSuggestions && verifiedSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    bottom: '42px',
                    left: 0,
                    width: '100%',
                    minWidth: '320px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #3b82f6',
                    borderRadius: '8px',
                    boxShadow: '0 -10px 25px rgba(0,0,0,0.6)',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    zIndex: 100,
                    padding: '4px'
                  }}>
                    <div style={{
                      padding: '4px 8px 6px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#94a3b8',
                      borderBottom: '1px solid #334155',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Sparkles size={12} color="#38bdf8" /> 系統已認證會員推薦 (點擊自動填入)：
                    </div>
                    {verifiedSuggestions.map(s => (
                      <div
                        key={s.member_uid}
                        onClick={() => {
                          setNewMemberName(s.member_name);
                          setNewMemberEmail(s.member_email);
                          setNewMemberAdGroup(s.member_ad_group || '');
                          setShowSuggestions(false);
                        }}
                        style={{
                          padding: '8px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#334155')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                          <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: '#6366f1',
                            color: '#fff',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {s.member_name?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <div style={{ overflow: 'hidden', lineHeight: 1.2 }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc' }}>
                              {s.member_name}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                              {s.member_email}
                            </div>
                          </div>
                        </div>

                        {s.is_oauth_verified && (
                          <span style={{
                            fontSize: '0.65rem',
                            color: '#34d399',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            padding: '1px 6px',
                            borderRadius: '10px',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}>
                            <CheckCircle2 size={10} /> 已認證
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <input
                type="text"
                placeholder="成員姓名 (Member Name)..."
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: '140px',
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
                  width: '130px',
                  padding: '7px 12px',
                  backgroundColor: '#090d16',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />

              {/* 角色選擇 (僅 Owner 可指派 Admin，Admin 預設為 Member) */}
              {currentUserRole === 'Owner' ? (
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as any)}
                  style={{
                    padding: '7px 10px',
                    backgroundColor: '#090d16',
                    border: '1px solid #3b82f6',
                    borderRadius: '6px',
                    color: '#93c5fd',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="Member">👤 角色: Member</option>
                  <option value="Admin">🛡️ 角色: Admin</option>
                </select>
              ) : (
                <span style={{
                  padding: '6px 10px',
                  backgroundColor: '#1e293b',
                  borderRadius: '6px',
                  color: '#94a3b8',
                  fontSize: '0.78rem',
                  fontWeight: 500
                }}>
                  👤 角色: Member
                </span>
              )}

              <button
                type="submit"
                disabled={addLoading}
                style={{
                  padding: '7px 14px',
                  backgroundColor: '#2563eb',
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
                <UserPlus size={15} /> {addLoading ? '加入中...' : '加入工作區'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowQuickAdd(false);
                  setShowSuggestions(false);
                  setNewMemberName('');
                  setNewMemberEmail('');
                  setNewMemberAdGroup('');
                  setNewMemberRole('Member');
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
              <UserPlus size={16} /> + 新增/邀請成員加入此工作區 (Add to Workspace)
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
        currentUserRole={currentUserRole}
        onClose={() => setSelectedMemberForAccess(null)}
        onRefresh={onRefresh}
      />
    </div>
  );
};
