import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  ChevronDown, 
  Check, 
  X, 
  Trash2, 
  ArrowUpDown,
  UserPlus
} from 'lucide-react';
import { api } from '../utils/api';
import type { ProjectItem, Project, Member } from '../utils/api';
import { CustomSelect } from './CustomSelect';
import { useColumnResize, Resizer } from '../hooks/useColumnResize';

interface MilestoneRaciTableProps {
  items: ProjectItem[];
  project: Project;
  members: Member[];
  onRefresh: () => Promise<void>;
  onItemClick: (item: ProjectItem) => void;
  hideTopAddButton?: boolean;
}

type RaciRole = 'R' | 'A' | 'C' | 'I';

const RACI_OPTIONS: Array<{ value: RaciRole; label: string; bg: string; color: string; border: string }> = [
  { value: 'R', label: 'R (Responsible)', bg: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '#2563eb' },
  { value: 'A', label: 'A (Accountable)', bg: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '#dc2626' },
  { value: 'C', label: 'C (Consulted)', bg: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '#059669' },
  { value: 'I', label: 'I (Informed)', bg: 'rgba(217, 119, 6, 0.2)', color: '#fbbf24', border: '#d97706' },
];

export const MilestoneRaciTable: React.FC<MilestoneRaciTableProps> = ({
  items,
  project,
  members,
  onRefresh,
  onItemClick,
  hideTopAddButton = false
}) => {
  const { columnWidths, onResizeStart } = useColumnResize({
    id: 130,
    title: 240,
    content: 180,
    type: 120,
    status: 130,
    action: 60
  });

  // 篩選屬於當前專案且類型為 Milestone 的工單
  const milestoneItems = items.filter(
    i => i.related_project_uid === project.project_uid && i.item_type === 'Milestone'
  );

  // 1. 蒐集目前已存在於 Milestone 中的 RACI 成員 (從 item_attribute.raci 解析出 member_uids)
  const [activeRaciMemberUids, setActiveRaciMemberUids] = useState<string[]>(() => {
    const memberSet = new Set<string>();
    milestoneItems.forEach(item => {
      const raciObj = item.item_attribute?.raci;
      if (raciObj && typeof raciObj === 'object') {
        Object.keys(raciObj).forEach(mUid => {
          if (mUid) memberSet.add(mUid);
        });
      }
    });
    return Array.from(memberSet);
  });

  // 同步外部 items 變動可能帶入的新成員
  useEffect(() => {
    setActiveRaciMemberUids(prev => {
      const memberSet = new Set<string>(prev);
      milestoneItems.forEach(item => {
        const raciObj = item.item_attribute?.raci;
        if (raciObj && typeof raciObj === 'object') {
          Object.keys(raciObj).forEach(mUid => {
            if (mUid) memberSet.add(mUid);
          });
        }
      });
      return Array.from(memberSet);
    });
  }, [items]);

  // UI 互動狀態
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [creatingMember, setCreatingMember] = useState(false);
  const memberDropdownRef = useRef<HTMLDivElement>(null);

  // Quick Create Milestone 彈出列狀態
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // RACI 懸浮選單狀態 (點擊單個 cell 切換 R/A/C/I)
  const [activeCellMenu, setActiveCellMenu] = useState<{ itemUid: string; memberUid: string } | null>(null);
  const cellMenuRef = useRef<HTMLDivElement>(null);

  // 搜尋與篩選
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // 點擊外部關閉下拉選單
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(e.target as Node)) {
        setIsMemberDropdownOpen(false);
        setMemberSearchQuery('');
      }
      if (cellMenuRef.current && !cellMenuRef.current.contains(e.target as Node)) {
        setActiveCellMenu(null);
      }
    };
    document.addEventListener('mousedown', handleGlobalClick);
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, []);

  // 新增/選取 RACI 成員欄位
  const handleAddRaciMember = (memberUid: string) => {
    if (!activeRaciMemberUids.includes(memberUid)) {
      setActiveRaciMemberUids([...activeRaciMemberUids, memberUid]);
    }
    setIsMemberDropdownOpen(false);
    setMemberSearchQuery('');
  };

  // 即時建立新成員並加為 RACI 欄位
  const handleCreateAndAddMember = async () => {
    const nameToCreate = memberSearchQuery.trim();
    if (!nameToCreate) return;
    setCreatingMember(true);
    try {
      const created = await api.provisionMember({ member_name: nameToCreate });
      await onRefresh();
      handleAddRaciMember(created.member_uid);
    } catch (err: any) {
      alert('建立成員失敗: ' + err.message);
    } finally {
      setCreatingMember(false);
    }
  };

  // 移除某個 RACI 成員欄位 (並清理該專案內 Milestone 工單的該成員 raci 屬性)
  const handleRemoveRaciMember = async (memberUidToRemove: string) => {
    const targetMember = members.find(m => m.member_uid === memberUidToRemove);
    const memberName = targetMember?.member_name || '此成員';
    if (!confirm(`確定要從里程碑表格移除 [${memberName}] 的 RACI 欄位嗎？`)) return;

    setActiveRaciMemberUids(activeRaciMemberUids.filter(id => id !== memberUidToRemove));

    // 非同步清理資料庫中的 raci 鍵
    try {
      for (const item of milestoneItems) {
        if (item.item_attribute?.raci?.[memberUidToRemove]) {
          const updatedRaci = { ...item.item_attribute.raci };
          delete updatedRaci[memberUidToRemove];
          await api.patchItem(item.item_uid, {
            item_attribute: {
              ...item.item_attribute,
              raci: updatedRaci
            }
          });
        }
      }
      await onRefresh();
    } catch (err: any) {
      console.error('清理 RACI 資料失敗:', err);
    }
  };

  // 一鍵整欄設定 (Bulk set all rows for a member: R / A / C / I / Clear)
  const handleBulkSetMemberRaci = async (memberUid: string, role: RaciRole | null) => {
    try {
      for (const item of milestoneItems) {
        const currentRaci = item.item_attribute?.raci || {};
        const updatedRaci = { ...currentRaci };
        if (role) {
          updatedRaci[memberUid] = role;
        } else {
          delete updatedRaci[memberUid];
        }
        await api.patchItem(item.item_uid, {
          item_attribute: {
            ...item.item_attribute,
            raci: updatedRaci
          }
        });
      }
      await onRefresh();
    } catch (err: any) {
      alert('批次設定 RACI 失敗: ' + err.message);
    }
  };

  // 更新單一 Milestone 的單一成員 RACI 角色
  const handleSetItemRaciRole = async (item: ProjectItem, memberUid: string, role: RaciRole | null) => {
    const currentRaci = item.item_attribute?.raci || {};
    const updatedRaci = { ...currentRaci };
    if (role) {
      updatedRaci[memberUid] = role;
    } else {
      delete updatedRaci[memberUid];
    }

    try {
      await api.patchItem(item.item_uid, {
        item_attribute: {
          ...item.item_attribute,
          raci: updatedRaci
        }
      });
      setActiveCellMenu(null);
      await onRefresh();
    } catch (err: any) {
      alert('更新 RACI 失敗: ' + err.message);
    }
  };

  // 建立新 Milestone
  const handleQuickCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAddLoading(true);
    try {
      await api.createItem({
        item_title: newTitle.trim(),
        item_type: 'Milestone',
        related_project_uid: project.project_uid,
        item_status: 'Not Start',
        item_priority: 'Middle',
        item_content: { description: '' }
      });
      setNewTitle('');
      setShowQuickAdd(false);
      await onRefresh();
    } catch (err: any) {
      alert('建立里程碑失敗: ' + err.message);
    } finally {
      setAddLoading(false);
    }
  };

  // 刪除 Milestone
  const handleDeleteMilestone = async (e: React.MouseEvent, item: ProjectItem) => {
    e.stopPropagation();
    if (confirm(`確定要刪除里程碑 [${item.item_display_code}] ${item.item_title} 嗎？此操作不可逆。`)) {
      try {
        await api.deleteItem(item.item_uid);
        await onRefresh();
      } catch (err: any) {
        alert('刪除失敗: ' + err.message);
      }
    }
  };

  // 篩選工單清單
  const filteredMilestones = milestoneItems
    .filter(item => {
      const matchSearch = !searchQuery.trim() || 
        item.item_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.item_display_code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = filterStatus === 'ALL' || item.item_status === filterStatus;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      if (a.item_number !== b.item_number) {
        return (a.item_number ?? 0) - (b.item_number ?? 0);
      }
      return new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime();
    });

  // 篩選下拉成員清單
  const candidateMembers = members.filter(m => {
    const q = memberSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return m.member_name.toLowerCase().includes(q) || m.member_email?.toLowerCase().includes(q);
  });
  const exactMatchMember = members.some(
    m => m.member_name.toLowerCase() === memberSearchQuery.trim().toLowerCase()
  );

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#090d16',
      color: '#f8fafc',
      overflow: 'hidden'
    }}>
      {/* 頂部操作工具列 (對齊 圖1、圖2) */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* 左側：新增 RACI 成員按鈕 (對齊 圖1、圖2、圖3 紫藍色按鈕) */}
          <div ref={memberDropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setIsMemberDropdownOpen(!isMemberDropdownOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '8px 16px',
                backgroundColor: '#5b5bf0',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(91, 91, 240, 0.4)',
                transition: 'background-color 0.15s'
              }}
            >
              <span>+ 新增 RACI 成員</span>
              <div style={{ display: 'flex', alignItems: 'center', borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: '8px' }}>
                <ChevronDown size={14} />
              </div>
            </button>

            {/* 成員選擇 / 搜尋 / 建立 下拉選單 (對齊 圖2) */}
            {isMemberDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                width: '240px',
                backgroundColor: '#161f32',
                border: '1px solid #2d3b55',
                borderRadius: '8px',
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                zIndex: 1000,
                padding: '8px',
                boxSizing: 'border-box'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#0c1222',
                  border: '1px solid #2d3b55',
                  borderRadius: '6px',
                  padding: '5px 8px',
                  marginBottom: '8px'
                }}>
                  <Search size={14} color="#64748b" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="搜尋或輸入成員姓名..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#f8fafc',
                      fontSize: '0.78rem',
                      outline: 'none',
                      width: '100%'
                    }}
                  />
                  {memberSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setMemberSearchQuery('')}
                      style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {candidateMembers.map(m => {
                    const isAdded = activeRaciMemberUids.includes(m.member_uid);
                    return (
                      <button
                        key={m.member_uid}
                        onClick={() => handleAddRaciMember(m.member_uid)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '6px',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          background: isAdded ? 'rgba(91, 91, 240, 0.15)' : 'transparent',
                          border: 'none',
                          color: isAdded ? '#818cf8' : '#f8fafc',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isAdded ? 'rgba(91, 91, 240, 0.15)' : 'transparent'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                          <span style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: '#3b82f6',
                            color: '#fff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            flexShrink: 0
                          }}>
                            {m.member_name.charAt(0).toUpperCase()}
                          </span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.member_name}
                          </span>
                        </div>
                        {isAdded && <Check size={13} color="#818cf8" />}
                      </button>
                    );
                  })}

                  {memberSearchQuery.trim() && !exactMatchMember && (
                    <button
                      onClick={handleCreateAndAddMember}
                      disabled={creatingMember}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(59, 130, 246, 0.15)',
                        border: '1px dashed #3b82f6',
                        color: '#60a5fa',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginTop: '4px'
                      }}
                    >
                      <UserPlus size={13} />
                      <span>{creatingMember ? '建立中...' : `建立新成員 "${memberSearchQuery.trim()}"`}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 右側：新增 Milestone 工單按鈕 */}
          {!hideTopAddButton && (
            <button
              onClick={() => setShowQuickAdd(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#5b5bf0',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(91, 91, 240, 0.4)'
              }}
            >
              <Plus size={16} /> 新建 Milestone
            </button>
          )}
        </div>

        {/* 搜尋與狀態過濾條 */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="搜尋識別碼、標題..."
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

          <CustomSelect
            value={filterStatus}
            options={[
              { value: 'ALL', label: '全部狀態 (All Statuses)' },
              ...['Not Start', 'Ready', 'In Progress', 'Blocked', 'Review', 'Completed', 'Closed'].map(s => ({
                value: s,
                label: s
              }))
            ]}
            onChange={(val) => setFilterStatus(val)}
          />
        </div>
      </div>

      {/* 快速建立 Milestone Bar */}
      {showQuickAdd && (
        <form
          onSubmit={handleQuickCreateMilestone}
          style={{
            padding: '12px 24px',
            backgroundColor: '#111827',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>🚩 新增里程碑:</span>
          <input
            autoFocus
            type="text"
            required
            placeholder="請輸入里程碑標題..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            style={{
              flex: 1,
              padding: '7px 12px',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              color: '#f9fafb',
              fontSize: '0.85rem'
            }}
          />
          <button
            type="submit"
            disabled={addLoading || !newTitle.trim()}
            style={{
              padding: '7px 14px',
              backgroundColor: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {addLoading ? '建立中...' : '確認'}
          </button>
          <button
            type="button"
            onClick={() => setShowQuickAdd(false)}
            style={{
              padding: '7px 12px',
              backgroundColor: 'transparent',
              color: '#94a3b8',
              border: '1px solid #374151',
              borderRadius: '6px',
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            取消
          </button>
        </form>
      )}

      {/* 表格主體 (對齊 圖1、圖2、圖3) */}
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
            minWidth: '950px',
            borderCollapse: 'separate',
            borderSpacing: 0,
            textAlign: 'left',
            fontSize: '0.85rem'
          }}>
            <thead>
              <tr style={{
                color: '#94a3b8',
                fontSize: '0.75rem',
                letterSpacing: '0.5px'
              }}>
                {/* 勾選方塊 */}
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 14px', width: '38px', textAlign: 'center' }}>
                  <input type="checkbox" style={{ accentColor: '#38bdf8', cursor: 'pointer' }} />
                </th>

                {/* 動態 RACI 成員直向標頭欄位 (對齊 圖3: 直立文字、換位箭頭、紅色X移除按鈕、整欄批次設定) */}
                {activeRaciMemberUids.map(memberUid => {
                  const member = members.find(m => m.member_uid === memberUid);
                  const displayName = member?.member_name || memberUid;

                  return (
                    <th
                      key={memberUid}
                      style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 10,
                        padding: '12px 8px',
                        width: '56px',
                        minWidth: '56px',
                        maxWidth: '60px',
                        textAlign: 'center',
                        verticalAlign: 'bottom',
                        borderRight: '1px solid #1e293b',
                        borderBottom: '2px solid #1e293b',
                        backgroundColor: '#101726'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '6px',
                        height: '110px'
                      }}>
                        {/* 直立成員姓名 (對齊 圖3) */}
                        <div style={{
                          writingMode: 'vertical-rl',
                          transform: 'rotate(180deg)',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: '#cbd5e1',
                          whiteSpace: 'nowrap',
                          letterSpacing: '1px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxHeight: '70px'
                        }}>
                          {displayName}
                        </div>

                        {/* 直欄功能操作 (對齊 圖3: 排序/換位、刪除欄位、批次全選 R/A/C/I) */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                          {/* 批次設定 RACI 按鈕 */}
                          <button
                            type="button"
                            onClick={() => {
                              const choice = prompt(`為 [${displayName}] 批次全選所有里程碑的 RACI (輸入 R, A, C, I 或留空清除):`, 'R');
                              if (choice !== null) {
                                const val = choice.trim().toUpperCase();
                                if (['R', 'A', 'C', 'I'].includes(val)) {
                                  handleBulkSetMemberRaci(memberUid, val as any);
                                } else if (val === '') {
                                  handleBulkSetMemberRaci(memberUid, null);
                                } else {
                                  alert('請輸入有效的角色: R, A, C, I');
                                }
                              }
                            }}
                            title="一鍵全選 RACI"
                            style={{
                              background: 'transparent',
                              border: '1px solid #334155',
                              borderRadius: '4px',
                              padding: '2px',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <ArrowUpDown size={11} />
                          </button>

                          {/* 移除此成員 RACI 欄位 (紅色 X 按鈕，對齊 圖3) */}
                          <button
                            type="button"
                            onClick={() => handleRemoveRaciMember(memberUid)}
                            title="移除此成員 RACI 欄位"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <X size={12} strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>
                    </th>
                  );
                })}

                {/* 標準資料欄位 (對齊 圖1、圖2) */}
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: `${columnWidths.id}px`, minWidth: `${columnWidths.id}px` }}>
                  <span>識別碼 (ID) ⇕</span>
                  <Resizer onMouseDown={(e) => onResizeStart('id', columnWidths.id, e)} />
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: `${columnWidths.title}px`, minWidth: `${columnWidths.title}px` }}>
                  <span>標題 ⇕</span>
                  <Resizer onMouseDown={(e) => onResizeStart('title', columnWidths.title, e)} />
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: `${columnWidths.content}px`, minWidth: `${columnWidths.content}px` }}>
                  <span>內容 (Content JSON)</span>
                  <Resizer onMouseDown={(e) => onResizeStart('content', columnWidths.content, e)} />
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: `${columnWidths.type}px`, minWidth: `${columnWidths.type}px` }}>
                  <span>類型 ⇕</span>
                  <Resizer onMouseDown={(e) => onResizeStart('type', columnWidths.type, e)} />
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: `${columnWidths.status}px`, minWidth: `${columnWidths.status}px` }}>
                  <span>狀態 ⇕</span>
                  <Resizer onMouseDown={(e) => onResizeStart('status', columnWidths.status, e)} />
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#131b2e', borderBottom: '2px solid #1e293b', padding: '12px 16px', width: `${columnWidths.action}px`, minWidth: `${columnWidths.action}px`, textAlign: 'center' }}>
                  <span>操作</span>
                  <Resizer onMouseDown={(e) => onResizeStart('action', columnWidths.action, e)} />
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredMilestones.length === 0 ? (
                <tr>
                  <td
                    colSpan={6 + activeRaciMemberUids.length}
                    style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}
                  >
                    目前專案中尚未有任何 Milestone 里程碑項目
                  </td>
                </tr>
              ) : (
                filteredMilestones.map((item) => {
                  const raciMap = item.item_attribute?.raci || {};

                  return (
                    <tr
                      key={item.item_uid}
                      style={{
                        borderBottom: '1px solid #1e293b',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#131b2e')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Checkbox */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <input type="checkbox" style={{ accentColor: '#38bdf8', cursor: 'pointer' }} />
                      </td>

                      {/* RACI 標籤 Cell (對齊 圖3: R=藍色, A=暗紅色, C=綠色, I=棕色 Pill) */}
                      {activeRaciMemberUids.map(memberUid => {
                        const currentRole = raciMap[memberUid] as RaciRole | undefined;
                        const roleMeta = RACI_OPTIONS.find(o => o.value === currentRole);
                        const isMenuOpen = activeCellMenu?.itemUid === item.item_uid && activeCellMenu?.memberUid === memberUid;

                        return (
                          <td
                            key={memberUid}
                            style={{
                              padding: '8px 4px',
                              textAlign: 'center',
                              position: 'relative',
                              borderRight: '1px solid #1e293b'
                            }}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveCellMenu(isMenuOpen ? null : { itemUid: item.item_uid, memberUid });
                              }}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                border: roleMeta ? `1px solid ${roleMeta.border}` : '1px dashed #334155',
                                backgroundColor: roleMeta ? roleMeta.bg : 'rgba(30, 41, 59, 0.3)',
                                color: roleMeta ? roleMeta.color : '#475569',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s'
                              }}
                              title={currentRole ? `RACI: ${roleMeta?.label}` : '點擊指派 RACI (R/A/C/I)'}
                            >
                              {currentRole || '+'}
                            </button>

                            {/* RACI 選擇 Popup (R / A / C / I / 清除) */}
                            {isMenuOpen && (
                              <div
                                ref={cellMenuRef}
                                style={{
                                  position: 'absolute',
                                  top: 'calc(100% + 4px)',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  backgroundColor: '#161f32',
                                  border: '1px solid #2d3b55',
                                  borderRadius: '8px',
                                  padding: '6px',
                                  zIndex: 1000,
                                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '4px',
                                  minWidth: '150px'
                                }}
                              >
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', padding: '2px 6px', fontWeight: 600 }}>
                                  選擇 RACI 角色:
                                </div>
                                {RACI_OPTIONS.map(opt => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleSetItemRaciRole(item, memberUid, opt.value)}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      padding: '5px 8px',
                                      borderRadius: '4px',
                                      border: 'none',
                                      backgroundColor: currentRole === opt.value ? opt.bg : 'transparent',
                                      color: opt.color,
                                      fontWeight: 600,
                                      fontSize: '0.78rem',
                                      cursor: 'pointer',
                                      textAlign: 'left'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = opt.bg}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = currentRole === opt.value ? opt.bg : 'transparent'}
                                  >
                                    <span style={{
                                      width: '18px',
                                      height: '18px',
                                      borderRadius: '4px',
                                      backgroundColor: opt.border,
                                      color: '#fff',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '0.7rem'
                                    }}>
                                      {opt.value}
                                    </span>
                                    <span>{opt.label}</span>
                                  </button>
                                ))}

                                {currentRole && (
                                  <button
                                    type="button"
                                    onClick={() => handleSetItemRaciRole(item, memberUid, null)}
                                    style={{
                                      padding: '4px 8px',
                                      border: 'none',
                                      borderRadius: '4px',
                                      backgroundColor: 'transparent',
                                      color: '#94a3b8',
                                      fontSize: '0.72rem',
                                      cursor: 'pointer',
                                      textAlign: 'center',
                                      borderTop: '1px solid #1e293b',
                                      marginTop: '2px'
                                    }}
                                  >
                                    清除 RACI 設定
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* 識別碼 (ID) (對齊 圖1、圖2: 🏆 AAP-036 點擊開啟 Drawer) */}
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          onClick={() => onItemClick(item)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#38bdf8',
                            fontWeight: 700,
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            textDecoration: 'underline'
                          }}
                        >
                          <span>🏆</span>
                          <span>{item.item_display_code}</span>
                        </button>
                      </td>

                      {/* 標題 (對齊 圖1、圖2: 📄 標題名稱) */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#94a3b8' }}>📄</span>
                          <span style={{ color: '#f8fafc', fontWeight: 500 }}>{item.item_title}</span>
                        </div>
                      </td>

                      {/* 內容 (Content JSON Preview，對齊 圖1、圖2) */}
                      <td style={{ padding: '12px 16px', color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.75rem', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.item_content ? JSON.stringify(item.item_content) : '{"description":""}'}
                      </td>

                      {/* 類型 (Milestone Badge，對齊 圖1、圖2) */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: 'rgba(20, 83, 45, 0.3)',
                          color: '#86efac',
                          border: '1px solid rgba(20, 83, 45, 0.6)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span>🏆</span>
                          <span>Milestone</span>
                        </span>
                      </td>

                      {/* 狀態 (Status) */}
                      <td style={{ padding: '12px 16px' }}>
                        <CustomSelect
                          value={item.item_status}
                          options={[
                            { value: 'Not Start', label: 'Not Start', badgeBg: '#1e293b', badgeColor: '#cbd5e1' },
                            { value: 'Ready', label: 'Ready', badgeBg: 'rgba(59, 130, 246, 0.15)', badgeColor: '#60a5fa' },
                            { value: 'In Progress', label: 'In Progress', badgeBg: 'rgba(59, 130, 246, 0.2)', badgeColor: '#3b82f6' },
                            { value: 'Blocked', label: 'Blocked', badgeBg: 'rgba(239, 68, 68, 0.15)', badgeColor: '#f87171' },
                            { value: 'Review', label: 'Review', badgeBg: 'rgba(168, 85, 247, 0.15)', badgeColor: '#c084fc' },
                            { value: 'Completed', label: 'Completed', badgeBg: 'rgba(16, 185, 129, 0.15)', badgeColor: '#34d399' },
                            { value: 'Closed', label: 'Closed', badgeBg: 'rgba(100, 116, 139, 0.2)', badgeColor: '#94a3b8' }
                          ]}
                          onChange={async (newStat) => {
                            try {
                              await api.patchItem(item.item_uid, { item_status: newStat });
                              await onRefresh();
                            } catch (err: any) {
                              alert('更新狀態失敗: ' + err.message);
                            }
                          }}
                        />
                      </td>

                      {/* 操作 */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          onClick={(e) => handleDeleteMilestone(e, item)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#64748b',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                          title="刪除里程碑"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
