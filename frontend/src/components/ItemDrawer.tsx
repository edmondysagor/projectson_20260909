import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  ChevronRight, 
  Send,
  Trash2
} from 'lucide-react';
import { api } from '../utils/api';
import type { ProjectItem, Project, Member } from '../utils/api';

interface ItemDrawerProps {
  itemUid: string | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  members: Member[];
  projects?: Project[];
}

export const ItemDrawer: React.FC<ItemDrawerProps> = ({
  itemUid,
  onClose,
  onRefresh,
  members
}) => {
  const [item, setItem] = useState<ProjectItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'relations' | 'comments'>('details');

  const [commentText, setCommentText] = useState('');
  const authorName = members[0]?.member_name || 'Edmond Chan';
  const [submittingComment, setSubmittingComment] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');

  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState('');

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
    loadItemDetail();
  }, [itemUid]);

  if (!itemUid) return null;

  const handleSaveTitle = async () => {
    if (!item) return;
    try {
      await api.patchItem(item.item_uid, { item_title: titleValue });
      setEditingTitle(false);
      await loadItemDetail();
      await onRefresh();
    } catch (err: any) {
      alert('更新標題失敗: ' + err.message);
    }
  };

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

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await api.addComment(item.item_uid, {
        author_name: authorName,
        comment_text: commentText.trim()
      });
      setCommentText('');
      await loadItemDetail();
      await onRefresh();
    } catch (err: any) {
      alert('發表評論失敗: ' + err.message);
    } finally {
      setSubmittingComment(false);
    }
  };

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

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'flex-end',
      zIndex: 100
    }}>
      <div style={{
        width: '850px',
        maxWidth: '90vw',
        height: '100%',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        borderLeft: '1px solid #334155',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-10px 0 30px rgba(0,0,0,0.6)'
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#131b2e'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#94a3b8' }}>
            <span>{item?.prefix_code || 'WS'}</span>
            <ChevronRight size={14} />
            {item?.parent_display_code && (
              <>
                <span style={{ color: '#38bdf8' }}>{item.parent_display_code}</span>
                <ChevronRight size={14} />
              </>
            )}
            <span style={{ color: '#38bdf8', fontWeight: 700 }}>{item?.item_display_code}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleDeleteItem}
              title="刪除此工單"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                cursor: 'pointer',
                padding: '5px 10px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.8rem',
                fontWeight: 600,
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#dc2626';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                e.currentTarget.style.color = '#f87171';
              }}
            >
              <Trash2 size={14} /> 刪除
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {loading || !item ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>載入中...</div>
        ) : (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', borderRight: '1px solid #1e293b' }}>
              <div style={{ marginBottom: '20px' }}>
                {editingTitle ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      autoFocus
                      value={titleValue}
                      onChange={(e) => setTitleValue(e.target.value)}
                      style={{
                        flex: 1,
                        fontSize: '1.2rem',
                        fontWeight: 700,
                        padding: '8px 12px',
                        backgroundColor: '#090d16',
                        border: '1px solid #3b82f6',
                        borderRadius: '6px',
                        color: '#fff'
                      }}
                    />
                    <button
                      onClick={handleSaveTitle}
                      style={{ padding: '8px', background: '#16a34a', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => setEditingTitle(false)}
                      style={{ padding: '8px', background: '#475569', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <h2
                    onClick={() => setEditingTitle(true)}
                    style={{
                      margin: 0,
                      fontSize: '1.3rem',
                      fontWeight: 700,
                      color: '#f8fafc',
                      cursor: 'pointer'
                    }}
                    title="點擊就地編輯標題"
                  >
                    {item.item_title}
                  </h2>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid #1e293b', marginBottom: '16px' }}>
                <button
                  onClick={() => setActiveTab('details')}
                  style={{
                    padding: '8px 12px',
                    border: 'none',
                    background: 'transparent',
                    color: activeTab === 'details' ? '#38bdf8' : '#94a3b8',
                    borderBottom: activeTab === 'details' ? '2px solid #38bdf8' : 'none',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  內容描述 (Content)
                </button>
                <button
                  onClick={() => setActiveTab('relations')}
                  style={{
                    padding: '8px 12px',
                    border: 'none',
                    background: 'transparent',
                    color: activeTab === 'relations' ? '#38bdf8' : '#94a3b8',
                    borderBottom: activeTab === 'relations' ? '2px solid #38bdf8' : 'none',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  關聯與層級 (Relations)
                </button>
                <button
                  onClick={() => setActiveTab('comments')}
                  style={{
                    padding: '8px 12px',
                    border: 'none',
                    background: 'transparent',
                    color: activeTab === 'comments' ? '#38bdf8' : '#94a3b8',
                    borderBottom: activeTab === 'comments' ? '2px solid #38bdf8' : 'none',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  評論 ({item.item_comment?.length || 0})
                </button>
              </div>

              {activeTab === 'details' && (
                <div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Description (Notion Style)</span>
                    {!editingDesc && (
                      <button
                        onClick={() => setEditingDesc(true)}
                        style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '0.8rem', cursor: 'pointer' }}
                      >
                        編輯文案
                      </button>
                    )}
                  </div>

                  {editingDesc ? (
                    <div>
                      <textarea
                        rows={6}
                        value={descValue}
                        onChange={(e) => setDescValue(e.target.value)}
                        placeholder="輸入詳細需求或架構說明..."
                        style={{
                          width: '100%',
                          padding: '12px',
                          backgroundColor: '#090d16',
                          border: '1px solid #3b82f6',
                          borderRadius: '8px',
                          color: '#fff',
                          boxSizing: 'border-box',
                          fontSize: '0.9rem',
                          fontFamily: 'inherit'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button
                          onClick={handleSaveDesc}
                          style={{ padding: '6px 14px', background: '#16a34a', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingDesc(false)}
                          style={{ padding: '6px 14px', background: '#334155', border: 'none', borderRadius: '6px', color: '#cbd5e1', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => setEditingDesc(true)}
                      style={{
                        padding: '14px',
                        backgroundColor: '#131b2e',
                        borderRadius: '8px',
                        border: '1px solid #1e293b',
                        minHeight: '100px',
                        cursor: 'pointer',
                        color: descValue ? '#f8fafc' : '#64748b',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {descValue || '點擊以新增詳細項目描述與規範...'}
                    </div>
                  )}

                  <div style={{ marginTop: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>子工作項目 (Subtasks)</span>
                    </div>
                    {item.child_items && item.child_items.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {item.child_items.map(c => (
                          <div key={c.item_uid} style={{
                            padding: '8px 12px',
                            backgroundColor: '#131b2e',
                            borderRadius: '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.85rem'
                          }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={{ color: '#38bdf8', fontWeight: 700 }}>{c.item_display_code}</span>
                              <span>{c.item_title}</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: '#1e293b', borderRadius: '4px' }}>
                              {c.item_status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: '#64748b', fontSize: '0.85rem' }}>尚無子工作項目</div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'relations' && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#38bdf8' }}>雙向關係拓撲 (Graph Relations)</h4>
                  
                  {item.inverse_relations && item.inverse_relations.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                        被動關係 (Incoming Dependencies):
                      </span>
                      {item.inverse_relations.map((rel, idx) => (
                        <div key={idx} style={{
                          padding: '8px 12px',
                          backgroundColor: '#1e293b',
                          borderRadius: '6px',
                          marginBottom: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.85rem'
                        }}>
                          <div>
                            <strong style={{ color: '#f87171' }}>{rel.relation}</strong>：
                            <span style={{ color: '#38bdf8', margin: '0 6px' }}>{rel.item_display_code}</span>
                            <span>{rel.item_title}</span>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>[{rel.item_type}]</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                      主動關聯 (Outgoing Relations):
                    </span>
                    {item.relation_item_uid && item.relation_item_uid.length > 0 ? (
                      item.relation_item_uid.map((r, i) => (
                        <div key={i} style={{
                          padding: '8px 12px',
                          backgroundColor: '#131b2e',
                          borderRadius: '6px',
                          marginBottom: '6px',
                          fontSize: '0.85rem'
                        }}>
                          <strong style={{ color: '#fbbf24' }}>{r.relation}</strong> ➔ UID: {r.item_uid}
                        </div>
                      ))
                    ) : (
                      <div style={{ color: '#64748b', fontSize: '0.85rem' }}>未設定關聯項目</div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'comments' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                    {(!item.item_comment || item.item_comment.length === 0) ? (
                      <div style={{ color: '#64748b', textAlign: 'center', padding: '30px' }}>目前未有任何評論</div>
                    ) : (
                      item.item_comment.map((cmt: any, idx: number) => (
                        <div key={idx} style={{
                          padding: '12px 14px',
                          backgroundColor: '#131b2e',
                          borderRadius: '8px',
                          border: '1px solid #1e293b'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.8rem' }}>
                            <strong style={{ color: '#38bdf8' }}>{cmt.author_name}</strong>
                            <span style={{ color: '#64748b' }}>{new Date(cmt.created_at).toLocaleString()}</span>
                          </div>
                          <div style={{ fontSize: '0.9rem', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                            {cmt.comment_text}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleAddComment} style={{ borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
                    <textarea
                      rows={3}
                      required
                      placeholder="新增評論 (Add a comment)..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        backgroundColor: '#090d16',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#fff',
                        boxSizing: 'border-box',
                        fontSize: '0.85rem'
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                      <button
                        type="submit"
                        disabled={submittingComment}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#2563eb',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Send size={14} /> {submittingComment ? '儲存中...' : 'Save Comment'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            <div style={{ width: '240px', padding: '20px', backgroundColor: '#131b2e', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Status
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
                    padding: '8px',
                    borderRadius: '6px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {['Not Start', 'Ready', 'In Progress', 'Blocked', 'Review', 'Completed', 'Closed', 'Backlog'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Priority
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
                    padding: '8px',
                    borderRadius: '6px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="High">High</option>
                  <option value="Middle">Middle</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Follow By (負責人)
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
                    padding: '8px',
                    borderRadius: '6px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">-- 未指派 --</option>
                  {members.map(m => (
                    <option key={m.member_uid} value={m.member_uid}>{m.member_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Planned End Date
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
                    padding: '8px',
                    borderRadius: '6px',
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    color: '#fff',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginTop: 'auto', borderTop: '1px solid #1e293b', paddingTop: '16px', fontSize: '0.75rem', color: '#64748b' }}>
                <div>Created: {new Date(item.created_at).toLocaleDateString()}</div>
                <div>Updated: {new Date(item.updated_at).toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
