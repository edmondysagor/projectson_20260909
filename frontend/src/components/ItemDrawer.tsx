import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  Trash2,
  Plus,
  Link as LinkIcon,
  Bold,
  Italic,
  List,
  Code,
  Smile,
  Image,
  Undo,
  Redo,
  Paperclip,
  Settings,
  Search,
  UserPlus
} from 'lucide-react';
import { api } from '../utils/api';
import type { ProjectItem, Project, Member } from '../utils/api';

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

  // 子項目 inline edit (Follow by search & create popover)
  const [activeFollowByChildUid, setActiveFollowByChildUid] = useState<string | null>(null);
  const [followBySearch, setFollowBySearch] = useState('');
  const [creatingMember, setCreatingMember] = useState(false);

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
      setActiveFollowByChildUid(null);
      setFollowBySearch('');
      await loadItemDetail();
      await onRefresh();
    } catch (err: any) {
      alert('指派失敗: ' + err.message);
    }
  };

  const handleCreateAndAssignMember = async (childUid: string, memberName: string) => {
    if (!memberName.trim()) return;
    setCreatingMember(true);
    try {
      const newMember = await api.provisionMember({ member_name: memberName.trim() });
      if (onRefreshMembers) {
        await onRefreshMembers();
      }
      await api.patchItem(childUid, { item_follow_by: newMember.member_uid });
      setActiveFollowByChildUid(null);
      setFollowBySearch('');
      await loadItemDetail();
      await onRefresh();
    } catch (err: any) {
      alert('新增成員並指派失敗: ' + err.message);
    } finally {
      setCreatingMember(false);
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
                    <textarea
                      rows={5}
                      autoFocus
                      value={descValue}
                      onChange={(e) => setDescValue(e.target.value)}
                      placeholder="Add a description..."
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        backgroundColor: '#0c1222',
                        border: '1px solid #38bdf8',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '0.9rem',
                        fontFamily: 'inherit',
                        lineHeight: 1.6,
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button
                        onClick={handleSaveDesc}
                        style={{
                          padding: '6px 16px',
                          backgroundColor: '#2563eb',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          cursor: 'pointer'
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelDesc}
                        style={{
                          padding: '6px 16px',
                          backgroundColor: '#1e293b',
                          color: '#94a3b8',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setEditingDesc(true)}
                    style={{
                      padding: '12px 14px',
                      backgroundColor: '#0c1222',
                      border: '1px solid #1e293b',
                      borderRadius: '8px',
                      color: descValue ? '#e2e8f0' : '#64748b',
                      fontSize: '0.9rem',
                      fontStyle: descValue ? 'normal' : 'italic',
                      lineHeight: 1.6,
                      minHeight: '60px',
                      cursor: 'pointer',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {descValue || 'Add a description...'}
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
                    item.child_items.map(child => {
                      const isAssigningThis = activeFollowByChildUid === child.item_uid;
                      const matchedMembers = members.filter(m => 
                        !followBySearch.trim() || 
                        m.member_name.toLowerCase().includes(followBySearch.toLowerCase()) ||
                        m.member_email.toLowerCase().includes(followBySearch.toLowerCase())
                      );
                      const exactMatch = members.some(m => m.member_name.toLowerCase() === followBySearch.trim().toLowerCase());

                      return (
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
                          <div>
                            <select
                              value={child.item_priority || 'Middle'}
                              onChange={(e) => handleUpdateChildItem(child.item_uid, { item_priority: e.target.value as any })}
                              style={{
                                width: '90px',
                                padding: '3px 6px',
                                backgroundColor: '#131b2e',
                                border: '1px solid #334155',
                                borderRadius: '4px',
                                color: child.item_priority === 'High' ? '#ef4444' : child.item_priority === 'Middle' ? '#f59e0b' : '#94a3b8',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              <option value="High" style={{ color: '#ef4444', backgroundColor: '#0f172a' }}>High</option>
                              <option value="Middle" style={{ color: '#f59e0b', backgroundColor: '#0f172a' }}>Middle</option>
                              <option value="Low" style={{ color: '#94a3b8', backgroundColor: '#0f172a' }}>Low</option>
                            </select>
                          </div>

                          {/* Follow by Column (Inline Popover with Search & Create) */}
                          <div style={{ position: 'relative' }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (isAssigningThis) {
                                  setActiveFollowByChildUid(null);
                                  setFollowBySearch('');
                                } else {
                                  setActiveFollowByChildUid(child.item_uid);
                                  setFollowBySearch('');
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'transparent',
                                border: '1px solid #334155',
                                borderRadius: '6px',
                                padding: '3px 8px',
                                color: child.follow_by_name ? '#f8fafc' : '#64748b',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                maxWidth: '140px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {child.follow_by_name ? (
                                <>
                                  <span style={{
                                    width: '16px',
                                    height: '16px',
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
                                    {child.follow_by_name.charAt(0).toUpperCase()}
                                  </span>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {child.follow_by_name}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>+ 指派人</span>
                                </>
                              )}
                            </button>

                            {/* Dropdown Popover */}
                            {isAssigningThis && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '100%',
                                  left: 0,
                                  marginTop: '4px',
                                  width: '220px',
                                  backgroundColor: '#0f172a',
                                  border: '1px solid #334155',
                                  borderRadius: '6px',
                                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                                  zIndex: 50,
                                  padding: '8px'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#1e293b', padding: '4px 8px', borderRadius: '4px', marginBottom: '8px' }}>
                                  <Search size={14} color="#64748b" />
                                  <input
                                    autoFocus
                                    type="text"
                                    placeholder="搜尋或建立成員..."
                                    value={followBySearch}
                                    onChange={(e) => setFollowBySearch(e.target.value)}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: '#f8fafc',
                                      fontSize: '0.75rem',
                                      outline: 'none',
                                      width: '100%'
                                    }}
                                  />
                                </div>

                                <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleAssignFollowBy(child.item_uid, null)}
                                    style={{
                                      textAlign: 'left',
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      background: 'transparent',
                                      border: 'none',
                                      color: '#94a3b8',
                                      fontSize: '0.75rem',
                                      cursor: 'pointer'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                  >
                                    未指派 (Unassigned)
                                  </button>

                                  {matchedMembers.map(m => (
                                    <button
                                      key={m.member_uid}
                                      type="button"
                                      onClick={() => handleAssignFollowBy(child.item_uid, m.member_uid)}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        background: child.item_follow_by === m.member_uid ? '#1e293b' : 'transparent',
                                        border: 'none',
                                        color: '#f8fafc',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = child.item_follow_by === m.member_uid ? '#1e293b' : 'transparent'}
                                    >
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
                                        fontWeight: 700
                                      }}>
                                        {m.member_name.charAt(0).toUpperCase()}
                                      </span>
                                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {m.member_name}
                                      </span>
                                    </button>
                                  ))}

                                  {/* 若輸入了搜尋且未完全吻合現有成員，提供 + Create 建立並寫入 member table */}
                                  {followBySearch.trim() && !exactMatch && (
                                    <button
                                      type="button"
                                      disabled={creatingMember}
                                      onClick={() => handleCreateAndAssignMember(child.item_uid, followBySearch.trim())}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 8px',
                                        borderRadius: '4px',
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
                                        {creatingMember ? '建立中...' : `+ 建立 "${followBySearch.trim()}"`}
                                      </span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Status Column (Inline Dropdown) */}
                          <div>
                            <select
                              value={child.item_status || 'Not Start'}
                              onChange={(e) => handleUpdateChildItem(child.item_uid, { item_status: e.target.value })}
                              style={{
                                width: '105px',
                                padding: '3px 6px',
                                backgroundColor: child.item_status === 'Completed' ? '#064e3b' : child.item_status === 'In Progress' ? '#1e3a8a' : child.item_status === 'Blocked' ? '#7f1d1d' : '#1e293b',
                                border: '1px solid #334155',
                                borderRadius: '4px',
                                color: child.item_status === 'Completed' ? '#6ee7b7' : child.item_status === 'In Progress' ? '#93c5fd' : child.item_status === 'Blocked' ? '#fca5a5' : '#94a3b8',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              <option value="Not Start" style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>NOT START</option>
                              <option value="Ready" style={{ backgroundColor: '#0f172a', color: '#93c5fd' }}>READY</option>
                              <option value="In Progress" style={{ backgroundColor: '#0f172a', color: '#60a5fa' }}>IN PROGRESS</option>
                              <option value="Review" style={{ backgroundColor: '#0f172a', color: '#fcd34d' }}>REVIEW</option>
                              <option value="Blocked" style={{ backgroundColor: '#0f172a', color: '#fca5a5' }}>BLOCKED</option>
                              <option value="Completed" style={{ backgroundColor: '#0f172a', color: '#6ee7b7' }}>COMPLETED</option>
                              <option value="Closed" style={{ backgroundColor: '#0f172a', color: '#94a3b8' }}>CLOSED</option>
                              <option value="Backlog" style={{ backgroundColor: '#0f172a', color: '#cbd5e1' }}>BACKLOG</option>
                            </select>
                          </div>
                        </div>
                      );
                    })
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
                      /* 開啟編輯模式：圖3 類 Notion 編輯工具列與輸入框 */
                      <div style={{
                        backgroundColor: '#0c1222',
                        border: '1px solid #1e293b',
                        borderRadius: '8px',
                        overflow: 'hidden'
                      }}>
                        {/* 類 Notion 編輯工具列 */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          borderBottom: '1px solid #1e293b',
                          backgroundColor: '#101626'
                        }}>
                          <button type="button" style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px 4px', fontSize: '0.8rem' }}>T ▾</button>
                          <button type="button" style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px 4px' }}><Bold size={13} /></button>
                          <button type="button" style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px 4px' }}><Italic size={13} /></button>
                          <button type="button" style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px 4px' }}><List size={13} /></button>
                          <button type="button" style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px 4px' }}><Code size={13} /></button>
                          <button type="button" style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px 4px' }}><Smile size={13} /></button>
                          <button type="button" style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px 4px' }}><Image size={13} /></button>
                          <button type="button" style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px 4px' }}><Plus size={13} /></button>
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                            <button type="button" style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}><Undo size={13} /></button>
                            <button type="button" style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}><Redo size={13} /></button>
                          </div>
                        </div>

                        {/* 編輯輸入區 */}
                        <div style={{ padding: '12px' }}>
                          <textarea
                            rows={3}
                            autoFocus
                            placeholder="輸入評論內容..."
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '10px',
                              backgroundColor: '#141c2e',
                              border: '1px solid #1e293b',
                              borderRadius: '6px',
                              color: '#fff',
                              fontSize: '0.85rem',
                              fontFamily: 'inherit',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />

                          {/* 快捷標籤列 (對齊 圖3) */}
                          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                            <button
                              type="button"
                              onClick={() => setCommentText(prev => prev ? `${prev} Suggest a reply...` : 'Suggest a reply...')}
                              style={{ fontSize: '0.72rem', padding: '3px 8px', backgroundColor: '#131b2e', borderRadius: '4px', color: '#94a3b8', border: '1px solid #1e293b', cursor: 'pointer' }}
                            >
                              Suggest a reply...
                            </button>
                            <button
                              type="button"
                              onClick={() => setCommentText(prev => prev ? `${prev} Can I get more info...?` : 'Can I get more info...?')}
                              style={{ fontSize: '0.72rem', padding: '3px 8px', backgroundColor: '#131b2e', borderRadius: '4px', color: '#94a3b8', border: '1px solid #1e293b', cursor: 'pointer' }}
                            >
                              Can I get more info...?
                            </button>
                            <button
                              type="button"
                              onClick={() => setCommentText(prev => prev ? `${prev} Status update...` : 'Status update...')}
                              style={{ fontSize: '0.72rem', padding: '3px 8px', backgroundColor: '#131b2e', borderRadius: '4px', color: '#94a3b8', border: '1px solid #1e293b', cursor: 'pointer' }}
                            >
                              Status update...
                            </button>
                          </div>

                          {/* 儲存與取消按鈕 (對齊 圖3) */}
                          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                            <button
                              type="button"
                              onClick={handleSaveComment}
                              disabled={submittingComment || !commentText.trim()}
                              style={{
                                padding: '6px 16px',
                                backgroundColor: '#4f46e5',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: submittingComment || !commentText.trim() ? 'not-allowed' : 'pointer'
                              }}
                            >
                              {submittingComment ? '儲存中...' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingComment(false);
                                setCommentText('');
                              }}
                              style={{
                                padding: '6px 16px',
                                backgroundColor: '#1e293b',
                                color: '#cbd5e1',
                                border: '1px solid #334155',
                                borderRadius: '6px',
                                fontSize: '0.85rem',
                                cursor: 'pointer'
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
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
                                  /* 評論編輯狀態 (含輸入框與 Save / Cancel) */
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                                    <textarea
                                      rows={3}
                                      autoFocus
                                      value={editCommentText}
                                      onChange={(e) => setEditCommentText(e.target.value)}
                                      style={{
                                        width: '100%',
                                        padding: '8px 10px',
                                        backgroundColor: '#131b2e',
                                        border: '1px solid #334155',
                                        borderRadius: '6px',
                                        color: '#f8fafc',
                                        fontSize: '0.85rem',
                                        fontFamily: 'inherit',
                                        lineHeight: 1.5,
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                      }}
                                    />
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateExistingComment(idx)}
                                        disabled={updatingComment || !editCommentText.trim()}
                                        style={{
                                          padding: '5px 12px',
                                          backgroundColor: '#2563eb',
                                          color: '#fff',
                                          border: 'none',
                                          borderRadius: '4px',
                                          fontSize: '0.78rem',
                                          fontWeight: 600,
                                          cursor: updatingComment || !editCommentText.trim() ? 'not-allowed' : 'pointer'
                                        }}
                                      >
                                        {updatingComment ? '儲存中...' : 'Save'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingCommentIdx(null);
                                          setEditCommentText('');
                                        }}
                                        style={{
                                          padding: '5px 12px',
                                          backgroundColor: '#1e293b',
                                          color: '#94a3b8',
                                          border: '1px solid #334155',
                                          borderRadius: '4px',
                                          fontSize: '0.78rem',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  /* 評論正常檢視狀態 (底部帶 Edit 按鈕) */
                                  <>
                                    <div style={{ fontSize: '0.85rem', color: '#e2e8f0', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                      {cmt.comment_text}
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
                <select
                  value={item.item_status}
                  onChange={async (e) => {
                    await api.patchItem(item.item_uid, { item_status: e.target.value });
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
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {['Not Start', 'Ready', 'In Progress', 'Blocked', 'Review', 'Completed', 'Closed', 'Backlog'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* 工單性質 (Item Type) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>
                  工單性質
                </label>
                <select
                  value={item.item_type}
                  onChange={async (e) => {
                    await api.patchItem(item.item_uid, { item_type: e.target.value });
                    await loadItemDetail();
                    await onRefresh();
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#131b2e',
                    border: '1px solid #334155',
                    color: '#fbbf24',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {['Objective', 'Requirement', 'User story', 'Task', 'UAT', 'Bug'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* 負責人 (Follow By) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>
                  負責人 (Follow By)
                </label>
                <select
                  value={item.item_follow_by || ''}
                  onChange={async (e) => {
                    const val = e.target.value;
                    await api.patchItem(item.item_uid, { item_follow_by: val ? val : undefined });
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
                  <option value="">Select...</option>
                  {members.map(m => (
                    <option key={m.member_uid} value={m.member_uid}>{m.member_name}</option>
                  ))}
                </select>
              </div>

              {/* 指派者 (Assigner) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>
                  指派者 (Assigner)
                </label>
                <select
                  value={item.item_assigned_by || ''}
                  onChange={async (e) => {
                    const val = e.target.value;
                    await api.patchItem(item.item_uid, { item_assigned_by: val ? val : undefined });
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
                  <option value="">Select...</option>
                  {members.map(m => (
                    <option key={m.member_uid} value={m.member_uid}>{m.member_name}</option>
                  ))}
                </select>
              </div>

              {/* 重要性 (Priority) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>
                  重要性
                </label>
                <select
                  value={item.item_priority}
                  onChange={async (e) => {
                    await api.patchItem(item.item_uid, { item_priority: e.target.value as any });
                    await loadItemDetail();
                    await onRefresh();
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#131b2e',
                    border: '1px solid #334155',
                    color: '#f59e0b',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <option value="High">High</option>
                  <option value="Middle">Middle</option>
                  <option value="Low">Low</option>
                </select>
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
