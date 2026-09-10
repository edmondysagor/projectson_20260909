import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  Trash2,
  Link as LinkIcon,
  Paperclip,
  Settings
} from 'lucide-react';
import { api } from '../utils/api';
import type { ProjectItem, Project, Member } from '../utils/api';
import { CustomSelect } from './CustomSelect';
import { MemberSelect } from './MemberSelect';
import { NovelEditor as NotionEditor, renderMarkdownContent } from './NovelEditor';

interface ItemDrawerProps {
  itemUid: string | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onRefreshMembers?: () => Promise<void>;
  members: Member[];
  projects?: Project[];
  onSelectAnotherItem?: (uid: string) => void;
}

export const ItemDrawer: React.FC<ItemDrawerProps> = ({
  itemUid,
  onClose,
  onRefresh,
  onRefreshMembers,
  members,
  projects = [],
  onSelectAnotherItem
}) => {
  const [item, setItem] = useState<ProjectItem | null>(null);
  const [loading, setLoading] = useState(false);

  // 標題 inline edit
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');

  // 描述 Description inline edit (含 Save, Cancel)
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState('');

  // Child work items 新增 bar
  const [newChildType, setNewChildType] = useState('Task');
  const [newChildTitle, setNewChildTitle] = useState('');
  const [addingChild, setAddingChild] = useState(false);

  // Relation (關聯工單) 區塊
  const [showRelationForm, setShowRelationForm] = useState(false);
  const [relType, setRelType] = useState('Blocks (阻礙)');
  const [relItemType, setRelItemType] = useState('Task');
  const [relSearchQuery, setRelSearchQuery] = useState('');
  const [linkingRel, setLinkingRel] = useState(false);
  const [workspaceItems, setWorkspaceItems] = useState<ProjectItem[]>([]);

  // Comment 區塊 (Notion-style 編輯模式)
  const [editingComment, setEditingComment] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const authorName = members[0]?.member_name || 'Edmond Chan';

  // 編輯個別既有評論的狀態
  const [editingCommentIdx, setEditingCommentIdx] = useState<number | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [updatingComment, setUpdatingComment] = useState(false);

  const handleUpdateChildItem = async (childUid: string, updates: Partial<ProjectItem>) => {
    try {
      await api.patchItem(childUid, updates);
      await loadItemDetail();
      await onRefresh();
    } catch (err: any) {
      alert('更新子工單失敗: ' + err.message);
    }
  };

  const handleAssignFollowBy = async (childUid: string, memberUid: string | null) => {
    try {
      await api.patchItem(childUid, { item_follow_by: memberUid || undefined });
      await loadItemDetail();
      await onRefresh();
    } catch (err: any) {
      alert('指派失敗: ' + err.message);
    }
  };

  const loadItemDetail = async () => {
    if (!itemUid) return;
    setLoading(true);
    try {
      const data = await api.getItem(itemUid);
      setItem(data);
      setTitleValue(data.item_title);
      setDescValue(data.item_content?.text || '');
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (itemUid) {
      loadItemDetail();
      // 載入當前工作區所有候選工單以供關聯搜尋
      api.getItems().then(res => setWorkspaceItems(res)).catch(() => {});
    }
  }, [itemUid]);

  if (!itemUid) return null;

  // 1. 儲存標題
  const handleSaveTitle = async () => {
    if (!item || !titleValue.trim()) return;
    try {
      await api.patchItem(item.item_uid, { item_title: titleValue.trim() });
      setEditingTitle(false);
      await loadItemDetail();
      await onRefresh();
    } catch (err: any) {
      alert('更新標題失敗: ' + err.message);
    }
  };

  // 2. 儲存描述
  const handleSaveDesc = async () => {
    if (!item) return;
    try {
      await api.patchItem(item.item_uid, { 
        item_content: { ...item.item_content, text: descValue } 
      });
      setEditingDesc(false);
      await loadItemDetail();
      await onRefresh();
    } catch (err: any) {
      alert('更新內容失敗: ' + err.message);
    }
  };

  const handleCancelDesc = () => {
    setDescValue(item?.item_content?.text || '');
    setEditingDesc(false);
  };

  // 3. 建立子工單 (Child Task)
  const handleAddChildItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !newChildTitle.trim()) return;
    setAddingChild(true);
    try {
      await api.createItem({
        item_title: newChildTitle.trim(),
        item_type: newChildType,
        related_project_uid: item.related_project_uid,
        parent_item_uid: item.item_uid,
        item_status: 'Not Start',
        item_priority: 'Middle'
      });
      setNewChildTitle('');
      await loadItemDetail();
      await onRefresh();
    } catch (err: any) {
      alert('建立子工單失敗: ' + err.message);
    } finally {
      setAddingChild(false);
    }
  };

  // 4. 關聯/建立工單 (Relation)
  const handleCreateOrLinkRelation = async (targetUid?: string) => {
    if (!item) return;
    setLinkingRel(true);
    try {
      let finalTargetUid = targetUid;
      // 若沒有選現成項目但有輸入搜尋文字，就直接建立新工單並關聯
      if (!finalTargetUid && relSearchQuery.trim()) {
        const created = await api.createItem({
          item_title: relSearchQuery.trim(),
          item_type: relItemType,
          related_project_uid: item.related_project_uid,
          item_status: 'Not Start',
          item_priority: 'Middle'
        });
        finalTargetUid = created.item_uid;
      }

      if (!finalTargetUid) {
        alert('請輸入欲建立之工單名稱，或於搜尋清單中選擇既有工單');
        setLinkingRel(false);
        return;
      }

      const existingRelations = item.relation_item_uid || [];
      const updatedRelations = [...existingRelations, { item_uid: finalTargetUid, relation: relType }];
      await api.patchItem(item.item_uid, { relation_item_uid: updatedRelations });

      setShowRelationForm(false);
      setRelSearchQuery('');
      await loadItemDetail();
      await onRefresh();
    } catch (err: any) {
      alert('關聯工單失敗: ' + err.message);
    } finally {
      setLinkingRel(false);
    }
  };

  // 刪除已建立的主動關聯
  const handleDeleteRelation = async (targetUid: string) => {
    if (!item) return;
    if (confirm('確定要移除此關聯嗎？')) {
      try {
        const updated = (item.relation_item_uid || []).filter(r => r.item_uid !== targetUid);
        await api.patchItem(item.item_uid, { relation_item_uid: updated });
        await loadItemDetail();
        await onRefresh();
      } catch (err: any) {
        alert('移除關聯失敗: ' + err.message);
      }
    }
  };

  // 5. 儲存評論 (Comment)
  const handleSaveComment = async () => {
    if (!item || !commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await api.addComment(item.item_uid, {
        author_name: authorName,
        comment_text: commentText.trim()
      });
      setCommentText('');
      setEditingComment(false);
      await loadItemDetail();
      await onRefresh();
    } catch (err: any) {
      alert('發表評論失敗: ' + err.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  // 儲存修改後的既有評論
  const handleUpdateExistingComment = async (idxToUpdate: number) => {
    if (!item || !editCommentText.trim()) return;
    setUpdatingComment(true);
    try {
      const currentComments = [...(item.item_comment || [])];
      if (currentComments[idxToUpdate]) {
        currentComments[idxToUpdate] = {
          ...currentComments[idxToUpdate],
          comment_text: editCommentText.trim(),
          updated_at: new Date().toISOString()
        };
        await api.patchItem(item.item_uid, { item_comment: currentComments });
        setEditingCommentIdx(null);
        setEditCommentText('');
        await loadItemDetail();
        await onRefresh();
      }
    } catch (err: any) {
      alert('更新評論失敗: ' + err.message);
    } finally {
      setUpdatingComment(false);
    }
  };

  // 6. 刪除整個工單
  const handleDeleteItem = async () => {
    if (!item) return;
    if (confirm(`確定要刪除工單 [${item.item_display_code}] ${item.item_title} 嗎？此操作不可逆。`)) {
      try {
        await api.deleteItem(item.item_uid);
        onClose();
        await onRefresh();
      } catch (err: any) {
        alert('刪除失敗: ' + err.message);
      }
    }
  };

  // 計算子工單完成率進度條
  const childCount = item?.child_items?.length || 0;
  const completedChildCount = item?.child_items?.filter(c => c.item_status === 'Completed' || c.item_status === 'Closed').length || 0;
  const childPercent = childCount > 0 ? Math.round((completedChildCount / childCount) * 100) : 0;

  // 篩選搜尋關聯候選
  const filteredCandidates = workspaceItems.filter(i => {
    if (i.item_uid === item?.item_uid) return false;
    const matchType = !relItemType || i.item_type === relItemType;
    const matchQuery = !relSearchQuery.trim() || 
      i.item_title.toLowerCase().includes(relSearchQuery.toLowerCase()) ||
      i.item_display_code.toLowerCase().includes(relSearchQuery.toLowerCase());
    return matchType && matchQuery;
  });

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100,
      padding: '24px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '1280px',
        height: '92vh',
        backgroundColor: '#0b101c',
        color: '#f8fafc',
        borderRadius: '12px',
        border: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
        overflow: 'hidden'
      }}>
        {/* 1. 最頂導航 Breadcrumb (對齊 圖1: 📁 Workspace / 🎯 Parent item AAP-071 x / 📋 Current item AAP-072) */}
        <div style={{
          padding: '14px 24px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0c1222',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#94a3b8' }}>
            <span style={{ color: '#cbd5e1', fontWeight: 500 }}>
              📁 {item?.project_name || 'Project'}
            </span>
            <span>/</span>

            {/* Parent Item: display code 具備可點擊跳轉 link */}
            {item?.parent_item_uid && item?.parent_display_code && (
              <>
                <button
                  onClick={() => {
                    if (onSelectAnotherItem) {
                      onSelectAnotherItem(item.parent_item_uid!);
                    } else {
                      api.getItem(item.parent_item_uid!).then(data => {
                        setItem(data);
                        setTitleValue(data.item_title);
                        setDescValue(data.item_content?.text || '');
                      });
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#38bdf8',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="點擊跳轉至父層工單"
                >
                  🎯 {item.parent_display_code}
                </button>
                <span style={{ color: '#64748b' }}>×</span>
                <span>/</span>
              </>
            )}

            {/* Current Item */}
            <span style={{ color: '#f8fafc', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              📋 {item?.item_display_code}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* 刪除工單 */}
            <button
              onClick={handleDeleteItem}
              title="刪除此工單"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Trash2 size={17} />
            </button>

            {/* 關閉 Modal */}
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {loading || !item ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>載入中...</div>
        ) : (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* 左側主要頁面內容 (同一頁向下排版：標題 ➔ 描述 ➔ Child items ➔ Relations ➔ Comments) */}
            <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
              
              {/* 2. Item Title (支援 Inline Edit) */}
              <div>
                {editingTitle ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      autoFocus
                      value={titleValue}
                      onChange={(e) => setTitleValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle();
                        if (e.key === 'Escape') setEditingTitle(false);
                      }}
                      style={{
                        flex: 1,
                        fontSize: '1.4rem',
                        fontWeight: 700,
                        padding: '8px 12px',
                        backgroundColor: '#131b2e',
                        border: '1px solid #38bdf8',
                        borderRadius: '6px',
                        color: '#fff',
                        outline: 'none'
                      }}
                    />
                    <button
                      onClick={handleSaveTitle}
                      style={{ padding: '8px 14px', background: '#16a34a', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => setEditingTitle(false)}
                      style={{ padding: '8px 14px', background: '#334155', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      backgroundColor: '#f59e0b',
                      borderRadius: '6px',
                      fontSize: '0.9rem'
                    }}>
                      📋
                    </span>
                    <h1
                      onClick={() => setEditingTitle(true)}
                      style={{
                        margin: 0,
                        fontSize: '1.4rem',
                        fontWeight: 700,
                        color: '#f8fafc',
                        cursor: 'pointer'
                      }}
                      title="點擊就地編輯標題"
                    >
                      {item.item_title}
                    </h1>
                  </div>
                )}

                {/* 輔助操作鈕 */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                  <button style={{ background: '#131b2e', border: '1px solid #243049', borderRadius: '4px', padding: '4px 8px', color: '#94a3b8', cursor: 'pointer' }}>
                    <Paperclip size={13} />
                  </button>
                  <button style={{ background: '#131b2e', border: '1px solid #243049', borderRadius: '4px', padding: '4px 8px', color: '#94a3b8', cursor: 'pointer' }}>
                    <Settings size={13} />
                  </button>
                </div>
              </div>

              {/* 3. Description (點擊框直接 edit, 框底下有 'Save', 'Cancel') */}
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
                  Description
                </div>
                {editingDesc ? (
                  <div>
                    <NotionEditor
                      value={descValue}
                      onChange={setDescValue}
                      placeholder="Add a description... Type '/' for commands"
                      autoFocus
                      minHeight="140px"
                      onSave={handleSaveDesc}
                      onCancel={handleCancelDesc}
                    />
                  </div>
                ) : (
                  <div
                    onClick={() => setEditingDesc(true)}
                    style={{
                      padding: '12px 14px',
                      backgroundColor: '#0c1222',
                      border: '1px solid #1e293b',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      lineHeight: 1.6,
                      minHeight: '60px',
                      cursor: 'pointer'
                    }}
                  >
                    {renderMarkdownContent(descValue)}
                  </div>
                )}
              </div>

              {/* 4. Child work items (對齊 圖1 設計的新增 bar 與列表) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>▾</span> Child work items
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}>•••</button>
                    <button style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}>+</button>
                  </div>
                </div>

                {/* 進度條 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ flex: 1, height: '4px', backgroundColor: '#1e293b', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${childPercent}%`, height: '100%', backgroundColor: '#22c55e', transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', width: '55px', textAlign: 'right' }}>
                    {childPercent}% Done
                  </span>
                </div>

                {/* 子項目表格 */}
                <div style={{ border: '1px solid #1e293b', borderRadius: '8px', overflow: 'visible', backgroundColor: '#0c1222' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(240px, 1fr) 110px 150px 120px',
                    padding: '8px 14px',
                    backgroundColor: '#131b2e',
                    borderBottom: '1px solid #1e293b',
                    fontSize: '0.75rem',
                    color: '#64748b',
                    fontWeight: 600
                  }}>
                    <div>Work</div>
                    <div>Priority</div>
                    <div>Follow by</div>
                    <div>Status</div>
                  </div>

                  {/* 既有子工單列表 */}
                  {item.child_items && item.child_items.length > 0 ? (
                    item.child_items.map(child => (
                      <div
                        key={child.item_uid}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(240px, 1fr) 110px 150px 120px',
                          padding: '8px 14px',
                          borderBottom: '1px solid #1e293b',
                          alignItems: 'center',
                          fontSize: '0.82rem',
                          position: 'relative'
                        }}
                      >
                          {/* Work Column (Link & Title) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#22c55e', flexShrink: 0 }} />
                            <button
                              onClick={() => {
                                if (onSelectAnotherItem) {
                                  onSelectAnotherItem(child.item_uid);
                                } else {
                                  api.getItem(child.item_uid).then(data => {
                                    setItem(data);
                                    setTitleValue(data.item_title);
                                    setDescValue(data.item_content?.text || '');
                                  });
                                }
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#38bdf8',
                                fontWeight: 700,
                                cursor: 'pointer',
                                padding: 0,
                                flexShrink: 0
                              }}
                            >
                              {child.item_display_code}
                            </button>
                            <span style={{ color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {child.item_title}
                            </span>
                          </div>

                          {/* Priority Column (Inline Dropdown) */}
                          {/* Priority Column (Inline Dropdown) */}
                          <div>
                            <CustomSelect
                              size="sm"
                              value={child.item_priority || 'Middle'}
                              options={[
                                { value: 'High', label: 'High', color: '#ef4444' },
                                { value: 'Middle', label: 'Middle', color: '#f59e0b' },
                                { value: 'Low', label: 'Low', color: '#94a3b8' }
                              ]}
                              onChange={(val) => handleUpdateChildItem(child.item_uid, { item_priority: val as any })}
                            />
                          </div>

                          {/* Follow by Column (Inline Popover with Search & Create) */}
                          <div>
                            <MemberSelect
                              size="sm"
                              value={child.item_follow_by || ''}
                              members={members}
                              onChange={(memberUid) => handleAssignFollowBy(child.item_uid, memberUid)}
                              onRefreshMembers={onRefreshMembers}
                              placeholder="+ 指派人"
                            />
                          </div>

                          {/* Status Column (Inline Dropdown) */}
                          <div>
                            <CustomSelect
                              size="sm"
                              value={child.item_status || 'Not Start'}
                              options={[
                                { value: 'Not Start', label: 'NOT START', badgeBg: '#1e293b', badgeColor: '#94a3b8' },
                                { value: 'Ready', label: 'READY', badgeBg: '#1e293b', badgeColor: '#93c5fd' },
                                { value: 'In Progress', label: 'IN PROGRESS', badgeBg: '#1e3a8a', badgeColor: '#93c5fd' },
                                { value: 'Review', label: 'REVIEW', badgeBg: '#3b0764', badgeColor: '#d8b4fe' },
                                { value: 'Blocked', label: 'BLOCKED', badgeBg: '#7f1d1d', badgeColor: '#fca5a5' },
                                { value: 'Completed', label: 'COMPLETED', badgeBg: '#064e3b', badgeColor: '#6ee7b7' },
                                { value: 'Closed', label: 'CLOSED', badgeBg: '#334155', badgeColor: '#cbd5e1' },
                                { value: 'Backlog', label: 'BACKLOG', badgeBg: '#1e293b', badgeColor: '#cbd5e1' }
                              ]}
                              onChange={(val) => handleUpdateChildItem(child.item_uid, { item_status: val })}
                            />
                          </div>
                        </div>
                      ))
                    ) : null}

                  {/* 圖1 設計之新增 Bar (Drop down box + Input bar + 新增按鈕) */}
                  <form onSubmit={handleAddChildItem} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    backgroundColor: '#0c1222'
                  }}>
                    {/* Drop down: Child item type */}
                    <select
                      value={newChildType}
                      onChange={(e) => setNewChildType(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: '#131b2e',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#93c5fd',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="Requirement">📋 Requirement</option>
                      <option value="User story">👤 User story</option>
                      <option value="Task">📝 Task</option>
                      <option value="UAT">🧪 UAT</option>
                      <option value="Bug">🐛 Bug</option>
                    </select>

                    {/* Input bar */}
                    <input
                      type="text"
                      placeholder="+ 新增子工單標題..."
                      value={newChildTitle}
                      onChange={(e) => setNewChildTitle(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '6px 12px',
                        backgroundColor: '#131b2e',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#f8fafc',
                        fontSize: '0.85rem',
                        outline: 'none'
                      }}
                    />

                    {/* 新增按鈕 */}
                    <button
                      type="submit"
                      disabled={addingChild || !newChildTitle.trim()}
                      style={{
                        padding: '6px 14px',
                        backgroundColor: '#4f46e5',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: addingChild || !newChildTitle.trim() ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {addingChild ? '新增中...' : '新增'}
                    </button>
                  </form>
                </div>
              </div>

              {/* 5. Related items (關聯工單，參照 圖2 設計) */}
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <LinkIcon size={14} /> Related items (關聯工單)
                </div>

                {/* 關聯清單表格 */}
                {((item.relation_item_uid && item.relation_item_uid.length > 0) || (item.inverse_relations && item.inverse_relations.length > 0)) && (
                  <div style={{ border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px', backgroundColor: '#0c1222' }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(240px, 1.5fr) 140px 100px 90px 70px',
                      padding: '8px 14px',
                      backgroundColor: '#131b2e',
                      borderBottom: '1px solid #1e293b',
                      fontSize: '0.75rem',
                      color: '#64748b',
                      fontWeight: 600
                    }}>
                      <div>Work</div>
                      <div>Relation Type</div>
                      <div>Direction</div>
                      <div>Status</div>
                      <div>Action</div>
                    </div>

                    {/* 主動關聯 (Outgoing) */}
                    {item.relation_item_uid?.map((r, i) => {
                      const matchedTarget = workspaceItems.find(wi => wi.item_uid === r.item_uid);
                      return (
                        <div key={i} style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(240px, 1.5fr) 140px 100px 90px 70px',
                          padding: '10px 14px',
                          borderBottom: '1px solid #1e293b',
                          alignItems: 'center',
                          fontSize: '0.82rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>📦</span>
                            <button
                              onClick={() => {
                                if (onSelectAnotherItem) {
                                  onSelectAnotherItem(r.item_uid);
                                } else {
                                  api.getItem(r.item_uid).then(data => {
                                    setItem(data);
                                    setTitleValue(data.item_title);
                                    setDescValue(data.item_content?.text || '');
                                  });
                                }
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#38bdf8',
                                fontWeight: 700,
                                cursor: 'pointer',
                                padding: 0
                              }}
                            >
                              {matchedTarget?.item_display_code || r.item_uid.slice(0, 8)}
                            </button>
                            <span style={{ color: '#f8fafc' }}>{matchedTarget?.item_title || ''}</span>
                          </div>
                          <div style={{ color: '#cbd5e1' }}>{r.relation}</div>
                          <div style={{ color: '#64748b' }}>Outgoing</div>
                          <div>
                            <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#1e293b', borderRadius: '4px', color: '#94a3b8' }}>
                              {matchedTarget?.item_status || 'Active'}
                            </span>
                          </div>
                          <div>
                            <button
                              onClick={() => handleDeleteRelation(r.item_uid)}
                              style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem' }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* 被動關聯 (Incoming) */}
                    {item.inverse_relations?.map((inv, idx) => (
                      <div key={idx} style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(240px, 1.5fr) 140px 100px 90px 70px',
                        padding: '10px 14px',
                        borderBottom: '1px solid #1e293b',
                        alignItems: 'center',
                        fontSize: '0.82rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>🔗</span>
                          <button
                            onClick={() => {
                              if (onSelectAnotherItem) {
                                onSelectAnotherItem(inv.item_uid);
                              } else {
                                api.getItem(inv.item_uid).then(data => {
                                  setItem(data);
                                  setTitleValue(data.item_title);
                                  setDescValue(data.item_content?.text || '');
                                });
                              }
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#38bdf8',
                              fontWeight: 700,
                              cursor: 'pointer',
                              padding: 0
                            }}
                          >
                            {inv.item_display_code}
                          </button>
                          <span style={{ color: '#f8fafc' }}>{inv.item_title}</span>
                        </div>
                        <div style={{ color: '#cbd5e1' }}>{inv.relation}</div>
                        <div style={{ color: '#64748b' }}>Incoming</div>
                        <div>
                          <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#064e3b', borderRadius: '4px', color: '#6ee7b7' }}>
                            {inv.item_status}
                          </span>
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem' }}>—</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 點擊 + Create linked work item 開啟功能組 (對齊 圖2) */}
                {!showRelationForm ? (
                  <button
                    onClick={() => setShowRelationForm(true)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 0'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#38bdf8'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                  >
                    + Create linked work item
                  </button>
                ) : (
                  /* 功能組: Drop down 1 (relation) + Drop down 2 (Item type) + Input search & create + Link/Create + Cancel */
                  <div style={{
                    padding: '12px',
                    backgroundColor: '#101626',
                    borderRadius: '8px',
                    border: '1px solid #1e293b',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {/* Drop down box 1: relation */}
                      <select
                        value={relType}
                        onChange={(e) => setRelType(e.target.value)}
                        style={{
                          padding: '7px 10px',
                          backgroundColor: '#131b2e',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          color: '#f8fafc',
                          fontSize: '0.82rem'
                        }}
                      >
                        <option value="Blocks (阻礙)">Blocks (阻礙)</option>
                        <option value="Is blocked by (被阻礙)">Is blocked by (被阻礙)</option>
                        <option value="Relates to (關聯)">Relates to (關聯)</option>
                        <option value="Covers (涵蓋)">Covers (涵蓋)</option>
                        <option value="Is deployed by (被部署)">Is deployed by (被部署)</option>
                        <option value="Causes (造成)">Causes (造成)</option>
                      </select>

                      {/* Drop down box 2: Item type */}
                      <select
                        value={relItemType}
                        onChange={(e) => setRelItemType(e.target.value)}
                        style={{
                          padding: '7px 10px',
                          backgroundColor: '#131b2e',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          color: '#93c5fd',
                          fontSize: '0.82rem'
                        }}
                      >
                        <option value="Task">🔹 Task</option>
                        <option value="Requirement">📋 Requirement</option>
                        <option value="User story">👤 User story</option>
                        <option value="Objective">🎯 Objective</option>
                        <option value="UAT">🧪 UAT</option>
                        <option value="Bug">🐛 Bug</option>
                      </select>

                      {/* Input search & create bar */}
                      <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
                        <input
                          type="text"
                          placeholder="Type to search or create new item..."
                          value={relSearchQuery}
                          onChange={(e) => setRelSearchQuery(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '7px 10px',
                            backgroundColor: '#090d16',
                            border: '1px solid #334155',
                            borderRadius: '6px',
                            color: '#f8fafc',
                            fontSize: '0.82rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />

                        {/* 既有項目搜尋下拉提示選單 */}
                        {relSearchQuery.trim() && filteredCandidates.length > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            maxHeight: '180px',
                            overflowY: 'auto',
                            backgroundColor: '#131b2e',
                            border: '1px solid #334155',
                            borderRadius: '6px',
                            marginTop: '4px',
                            zIndex: 30,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                          }}>
                            {filteredCandidates.map(cand => (
                              <div
                                key={cand.item_uid}
                                onClick={() => handleCreateOrLinkRelation(cand.item_uid)}
                                style={{
                                  padding: '8px 12px',
                                  borderBottom: '1px solid #1e293b',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  fontSize: '0.8rem'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                <span style={{ color: '#38bdf8', fontWeight: 600 }}>{cand.item_display_code} {cand.item_title}</span>
                                <span style={{ color: '#64748b', fontSize: '0.72rem' }}>點擊直接關聯</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Button 1: Link / Create */}
                      <button
                        onClick={() => handleCreateOrLinkRelation()}
                        disabled={linkingRel || !relSearchQuery.trim()}
                        style={{
                          padding: '7px 14px',
                          backgroundColor: '#4f46e5',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: linkingRel || !relSearchQuery.trim() ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {linkingRel ? '處理中...' : 'Link / Create'}
                      </button>

                      {/* Button 2: Cancel */}
                      <button
                        onClick={() => {
                          setShowRelationForm(false);
                          setRelSearchQuery('');
                        }}
                        style={{
                          padding: '7px 12px',
                          backgroundColor: 'transparent',
                          color: '#94a3b8',
                          border: 'none',
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Comments (參照 圖3 設計: 點擊 add a comment 出現類 Notion 編輯器與 Save / Cancel) */}
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
                  Comments
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  {/* 使用者頭像 */}
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#6366f1',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    flexShrink: 0
                  }}>
                    {authorName.charAt(0).toUpperCase()}
                  </div>

                  {/* 評論編輯器核心 (對齊 圖3) */}
                  <div style={{ flex: 1 }}>
                    {!editingComment ? (
                      /* 未開啟時的點擊提示匡 */
                      <div
                        onClick={() => setEditingComment(true)}
                        style={{
                          padding: '12px 16px',
                          backgroundColor: '#0c1222',
                          border: '1px solid #1e293b',
                          borderRadius: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '8px' }}>
                          Add a comment...
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <span style={{ fontSize: '0.72rem', padding: '3px 8px', backgroundColor: '#131b2e', borderRadius: '4px', color: '#94a3b8', border: '1px solid #1e293b' }}>
                            Suggest a reply...
                          </span>
                          <span style={{ fontSize: '0.72rem', padding: '3px 8px', backgroundColor: '#131b2e', borderRadius: '4px', color: '#94a3b8', border: '1px solid #1e293b' }}>
                            Status update...
                          </span>
                          <span style={{ fontSize: '0.72rem', padding: '3px 8px', backgroundColor: '#131b2e', borderRadius: '4px', color: '#94a3b8', border: '1px solid #1e293b' }}>
                            Thanks...
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* 開啟編輯模式：使用 NotionEditor 類 Notion 編輯器 */
                      <NotionEditor
                        value={commentText}
                        onChange={setCommentText}
                        placeholder="輸入評論內容... Type '/' for commands"
                        autoFocus
                        minHeight="100px"
                        onSave={handleSaveComment}
                        onCancel={() => {
                          setEditingComment(false);
                          setCommentText('');
                        }}
                        saveLabel="Save"
                        saving={submittingComment}
                      />
                    )}

                    <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '6px' }}>
                      Pro tip: press M to comment
                    </div>

                      {/* 既有評論列表 */}
                      <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {(!item.item_comment || item.item_comment.length === 0) ? (
                          <div style={{ color: '#64748b', fontSize: '0.82rem' }}>尚無評論記錄</div>
                        ) : (
                          item.item_comment.map((cmt: any, idx: number) => {
                            const isEditingThisComment = editingCommentIdx === idx;

                            return (
                              <div key={idx} style={{
                                padding: '12px 14px',
                                backgroundColor: '#0c1222',
                                borderRadius: '8px',
                                border: isEditingThisComment ? '1px solid #38bdf8' : '1px solid #1e293b'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.78rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <strong style={{ color: '#38bdf8' }}>{cmt.author_name}</strong>
                                    {cmt.updated_at && (
                                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>(已編輯)</span>
                                    )}
                                  </div>
                                  <span style={{ color: '#64748b' }}>{new Date(cmt.created_at).toLocaleString()}</span>
                                </div>

                                {isEditingThisComment ? (
                                  /* 評論編輯狀態：使用 NotionEditor */
                                  <div style={{ marginTop: '6px' }}>
                                    <NotionEditor
                                      value={editCommentText}
                                      onChange={setEditCommentText}
                                      placeholder="編輯評論... Type '/' for commands"
                                      autoFocus
                                      minHeight="90px"
                                      onSave={() => handleUpdateExistingComment(idx)}
                                      onCancel={() => {
                                        setEditingCommentIdx(null);
                                        setEditCommentText('');
                                      }}
                                      saveLabel="Save"
                                      saving={updatingComment}
                                    />
                                  </div>
                                ) : (
                                  /* 評論正常檢視狀態 (支援 Markdown 渲染 + 底部帶 Edit 按鈕) */
                                  <>
                                    <div style={{ marginTop: '4px' }}>
                                      {renderMarkdownContent(cmt.comment_text)}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '8px', borderTop: '1px solid #141d30', paddingTop: '6px' }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingCommentIdx(idx);
                                          setEditCommentText(cmt.comment_text);
                                        }}
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: '#64748b',
                                          fontSize: '0.75rem',
                                          cursor: 'pointer',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontWeight: 500,
                                          transition: 'color 0.15s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.color = '#38bdf8'}
                                        onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                                      >
                                        Edit
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                  </div>
                </div>
              </div>

              {/* 歷史接龍 Remarks */}
              <div style={{ borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                  Remarks 歷史接龍
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  由系統追蹤與自動記錄工單狀態變更與關聯異動
                </div>
              </div>
            </div>

            {/* 右側屬性設定側欄 (對齊 圖1 / 圖2: 任務狀態, 工單性質, 負責人, 指派者, 重要性, 緊急程度, 關聯專案, 排期...) */}
            <div style={{
              width: '300px',
              padding: '24px',
              backgroundColor: '#0c1222',
              borderLeft: '1px solid #1e293b',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              overflowY: 'auto',
              flexShrink: 0
            }}>
              {/* 任務狀態 */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>
                  任務狀態
                </label>
                <CustomSelect
                  value={item.item_status}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'Not Start', label: 'Not Start', badgeBg: '#1e293b', badgeColor: '#94a3b8' },
                    { value: 'Ready', label: 'Ready', badgeBg: '#1e293b', badgeColor: '#93c5fd' },
                    { value: 'In Progress', label: 'In Progress', badgeBg: '#1e3a8a', badgeColor: '#93c5fd' },
                    { value: 'Blocked', label: 'Blocked', badgeBg: '#7f1d1d', badgeColor: '#fca5a5' },
                    { value: 'Review', label: 'Review', badgeBg: '#3b0764', badgeColor: '#d8b4fe' },
                    { value: 'Completed', label: 'Completed', badgeBg: '#064e3b', badgeColor: '#6ee7b7' },
                    { value: 'Closed', label: 'Closed', badgeBg: '#334155', badgeColor: '#cbd5e1' },
                    { value: 'Backlog', label: 'Backlog', badgeBg: '#1e293b', badgeColor: '#cbd5e1' }
                  ]}
                  onChange={async (newStatus) => {
                    await api.patchItem(item.item_uid, { item_status: newStatus });
                    await loadItemDetail();
                    await onRefresh();
                  }}
                />
              </div>

              {/* 工單性質 (Item Type) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>
                  工單性質
                </label>
                <CustomSelect
                  value={item.item_type}
                  style={{ width: '100%' }}
                  options={['Objective', 'Requirement', 'User story', 'Task', 'UAT', 'Bug'].map(t => ({
                    value: t,
                    label: t
                  }))}
                  onChange={async (newType) => {
                    await api.patchItem(item.item_uid, { item_type: newType });
                    await loadItemDetail();
                    await onRefresh();
                  }}
                />
              </div>

              {/* 負責人 (Follow By) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>
                  負責人 (Follow By)
                </label>
                <MemberSelect
                  value={item.item_follow_by || ''}
                  members={members}
                  style={{ width: '100%' }}
                  onChange={async (uid) => {
                    await api.patchItem(item.item_uid, { item_follow_by: uid ? uid : undefined });
                    await loadItemDetail();
                    await onRefresh();
                  }}
                  onRefreshMembers={onRefreshMembers}
                  placeholder="Select..."
                />
              </div>

              {/* 指派者 (Assigner) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>
                  指派者 (Assigner)
                </label>
                <MemberSelect
                  value={item.item_assigned_by || ''}
                  members={members}
                  style={{ width: '100%' }}
                  onChange={async (uid) => {
                    await api.patchItem(item.item_uid, { item_assigned_by: uid ? uid : undefined });
                    await loadItemDetail();
                    await onRefresh();
                  }}
                  onRefreshMembers={onRefreshMembers}
                  placeholder="Select..."
                />
              </div>

              {/* 重要性 (Priority) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>
                  重要性
                </label>
                <CustomSelect
                  value={item.item_priority}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'High', label: 'High', color: '#ef4444' },
                    { value: 'Middle', label: 'Middle', color: '#f59e0b' },
                    { value: 'Low', label: 'Low', color: '#94a3b8' }
                  ]}
                  onChange={async (newPri) => {
                    await api.patchItem(item.item_uid, { item_priority: newPri as any });
                    await loadItemDetail();
                    await onRefresh();
                  }}
                />
              </div>

              {/* 關聯專案 */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>
                  關聯專案
                </label>
                <select
                  value={item.related_project_uid}
                  onChange={async (e) => {
                    await api.patchItem(item.item_uid, { related_project_uid: e.target.value });
                    await loadItemDetail();
                    await onRefresh();
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#131b2e',
                    border: '1px solid #334155',
                    color: '#f8fafc',
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  {projects.map(p => (
                    <option key={p.project_uid} value={p.project_uid}>{p.project_name}</option>
                  ))}
                </select>
              </div>

              {/* 計劃開始 */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                  計劃開始
                </label>
                <input
                  type="date"
                  value={item.item_planned_start_date ? item.item_planned_start_date.split('T')[0] : ''}
                  onChange={async (e) => {
                    await api.patchItem(item.item_uid, { item_planned_start_date: e.target.value ? e.target.value : undefined });
                    await loadItemDetail();
                    await onRefresh();
                  }}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#131b2e',
                    border: '1px solid #334155',
                    color: '#cbd5e1',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* 計劃結束 */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                  計劃結束
                </label>
                <input
                  type="date"
                  value={item.item_planned_end_date ? item.item_planned_end_date.split('T')[0] : ''}
                  onChange={async (e) => {
                    await api.patchItem(item.item_uid, { item_planned_end_date: e.target.value ? e.target.value : undefined });
                    await loadItemDetail();
                    await onRefresh();
                  }}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#131b2e',
                    border: '1px solid #334155',
                    color: '#cbd5e1',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* 底部中繼時間資訊 */}
              <div style={{ marginTop: 'auto', borderTop: '1px solid #1e293b', paddingTop: '16px', fontSize: '0.72rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>建立時間: {new Date(item.created_at).toLocaleString()}</div>
                <div>更新時間: {new Date(item.updated_at).toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
