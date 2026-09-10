import React, { useState } from 'react';
import { Plus, Search, Check, X, Link2 } from 'lucide-react';
import { api } from '../utils/api';
import type { ProjectItem } from '../utils/api';

interface TraceabilityMatrixProps {
  items: ProjectItem[];
  onRefresh: () => Promise<void>;
  onItemClick: (item: ProjectItem) => void;
  projectId: string;
}

export const TraceabilityMatrix: React.FC<TraceabilityMatrixProps> = ({
  items,
  onRefresh,
  onItemClick,
  projectId
}) => {
  const [draggedUid, setDraggedUid] = useState<string | null>(null);

  // 控制點擊卡片右上角或 Column Header + 號開啟的彈出層
  const [activePopup, setActivePopup] = useState<{
    parentUid: string | null; // null 代表新增頂層 Objective
    childType: string;
    parentTitle?: string;
  } | null>(null);

  // 彈出層模式: 'create' | 'search'
  const [popupTab, setPopupTab] = useState<'create' | 'search'>('create');
  const [createTitle, setCreateTitle] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // 搜尋已存在工單綁定
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);

  // Hover 卡片顯示右上角加號 tooltip 提示
  const [hoveredCardUid, setHoveredCardUid] = useState<string | null>(null);

  const objectives = items.filter(i => i.item_type === 'Objective');

  const getRequirements = (objUid: string) => 
    items.filter(i => i.item_type === 'Requirement' && (i.parent_item_uid === objUid || i.relation_item_uid?.some((r: any) => r.item_uid === objUid)));

  const getUserStories = (reqUid: string) => 
    items.filter(i => i.item_type === 'User story' && (i.parent_item_uid === reqUid || i.relation_item_uid?.some((r: any) => r.item_uid === reqUid)));

  const getTasks = (usUid: string) => 
    items.filter(i => i.item_type === 'Task' && (i.parent_item_uid === usUid || i.relation_item_uid?.some((r: any) => r.item_uid === usUid)));

  const getUats = (taskUid: string) => 
    items.filter(i => i.item_type === 'UAT' && (i.parent_item_uid === taskUid || i.relation_item_uid?.some((r: any) => r.item_uid === taskUid)));

  const handleDragStart = (e: React.DragEvent, uid: string) => {
    setDraggedUid(uid);
    e.dataTransfer.setData('text/plain', uid);
  };

  const handleDropOnParent = async (e: React.DragEvent, newParentUid: string) => {
    e.preventDefault();
    if (!draggedUid || draggedUid === newParentUid) return;

    try {
      await api.patchItem(draggedUid, { parent_item_uid: newParentUid });
      await onRefresh();
    } catch (err: any) {
      alert('變更關聯失敗: ' + err.message);
    } finally {
      setDraggedUid(null);
    }
  };

  // 執行就地建立新工單
  const handleExecuteCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim() || !activePopup) return;
    setCreateLoading(true);
    try {
      await api.createItem({
        item_title: createTitle.trim(),
        item_type: activePopup.childType,
        related_project_uid: projectId,
        parent_item_uid: activePopup.parentUid || undefined,
        item_status: 'Not Start',
        item_priority: 'Middle'
      });
      setCreateTitle('');
      setActivePopup(null);
      await onRefresh();
    } catch (err: any) {
      alert('新增失敗: ' + err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  // 執行搜尋並綁定現有工單
  const handleLinkExistingItem = async (existingItemUid: string) => {
    if (!activePopup?.parentUid) return;
    setLinkLoading(true);
    try {
      await api.patchItem(existingItemUid, { parent_item_uid: activePopup.parentUid });
      setActivePopup(null);
      setItemSearchQuery('');
      await onRefresh();
    } catch (err: any) {
      alert('綁定工單失敗: ' + err.message);
    } finally {
      setLinkLoading(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    const isDone = status === 'Completed' || status === 'Closed';
    const isBlocked = status === 'Blocked';
    const isInProgress = status === 'In Progress' || status === 'Ready';

    return (
      <span style={{
        fontSize: '0.7rem',
        padding: '2px 8px',
        borderRadius: '4px',
        fontWeight: 600,
        backgroundColor: isDone ? '#064e3b' : isBlocked ? '#7f1d1d' : isInProgress ? '#1e293b' : '#1e293b',
        color: isDone ? '#6ee7b7' : isBlocked ? '#fca5a5' : isInProgress ? '#cbd5e1' : '#94a3b8',
        border: '1px solid #334155'
      }}>
        {status}
      </span>
    );
  };

  // 渲染單張 Info Card (對齊 圖2: 右上角圓形加號按鈕 + Hover Tooltip 提示「新增 [下一級別名稱]」)
  const renderCard = (item: ProjectItem, childTypeNext?: string) => {
    const isHovered = hoveredCardUid === item.item_uid;

    return (
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, item.item_uid)}
        onMouseEnter={() => setHoveredCardUid(item.item_uid)}
        onMouseLeave={() => setHoveredCardUid(null)}
        style={{
          position: 'relative',
          backgroundColor: '#131b2e',
          borderRadius: '8px',
          border: isHovered ? '1px solid #38bdf8' : '1px solid #23304a',
          padding: '12px 14px',
          marginBottom: '12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          cursor: 'grab',
          transition: 'border-color 0.15s, box-shadow 0.15s'
        }}
      >
        {/* 卡片頂部：Display Code 與 右上角新增功能圓形按鈕 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.85rem' }}>
              {item.item_type === 'Objective' ? '🎯' :
               item.item_type === 'Requirement' ? '📋' :
               item.item_type === 'User story' ? '👤' :
               item.item_type === 'Task' ? '📝' : '🧪'}
            </span>
            <button
              onClick={() => onItemClick(item)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                padding: 0
              }}
            >
              {item.item_display_code}
            </button>
          </div>

          {/* 右上角 + 號 (對齊 圖2: 圓形紫灰小按鈕與浮動提示) */}
          {childTypeNext && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopup({
                    parentUid: item.item_uid,
                    childType: childTypeNext,
                    parentTitle: item.item_title
                  });
                  setPopupTab('create');
                  setCreateTitle('');
                  setItemSearchQuery('');
                }}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: '#2e384d',
                  border: '1px solid #475569',
                  color: '#93c5fd',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'background-color 0.15s, transform 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.transform = 'scale(1.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#2e384d';
                  e.currentTarget.style.color = '#93c5fd';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                title={`新增 ${childTypeNext}`}
              >
                <Plus size={12} strokeWidth={2.5} />
              </button>

              {/* Hover Tooltip (對齊 圖2: 新增 Business Requirement 標籤) */}
              {isHovered && !activePopup && (
                <div style={{
                  position: 'absolute',
                  top: '24px',
                  right: '-10px',
                  zIndex: 20,
                  backgroundColor: '#e2e8f0',
                  color: '#0f172a',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '4px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  pointerEvents: 'none'
                }}>
                  新增 {childTypeNext}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 狀態標籤 (Not Start / Completed 等) */}
        <div style={{ marginBottom: '8px' }}>
          {renderStatusBadge(item.item_status)}
        </div>

        {/* 卡片標題名稱 */}
        <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 500, lineHeight: 1.4, marginBottom: '6px' }}>
          {item.item_title}
        </div>

        {/* 底部指派人小字 */}
        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
          {item.follow_by_name || '未指派負責人'}
        </div>
      </div>
    );
  };

  // 篩選搜尋可用於綁定的候選工單清單
  const searchCandidates = items.filter(i => {
    if (!activePopup) return false;
    const matchType = i.item_type === activePopup.childType;
    const matchSearch = !itemSearchQuery.trim() || 
      i.item_title.toLowerCase().includes(itemSearchQuery.toLowerCase()) ||
      i.item_display_code.toLowerCase().includes(itemSearchQuery.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#090d16',
      color: '#f8fafc',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* 頂部標題說明 */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
            專案溯源鏈矩陣 (Multi-level Row Span Traceability)
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
            5 層完整工程鏈條：Objective ➔ Requirement ➔ User Story ➔ Task ➔ UAT (卡片右上角可直接新增或關聯右側附屬工單)
          </p>
        </div>

        {/* 快速新增頂層 Objective 按鈕 */}
        <button
          onClick={() => {
            setActivePopup({ parentUid: null, childType: 'Objective' });
            setPopupTab('create');
            setCreateTitle('');
          }}
          style={{
            padding: '7px 14px',
            backgroundColor: '#16a34a',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.82rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)'
          }}
        >
          <Plus size={15} /> 新增 Objective
        </button>
      </div>

      {/* 5 欄固定凍結表頭 + 內容聯動滾動容器 (Header Freeze) */}
      <div style={{
        flex: 1,
        margin: '16px 24px',
        backgroundColor: '#0f172a',
        borderRadius: '12px',
        border: '1px solid #1e293b',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}>
        {/* 1. 凍結表頭 (Sticky Header: scroll 幾落都見到個 header) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(240px, 1fr))',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backgroundColor: '#131b2e',
          borderBottom: '2px solid #1e293b'
        }}>
          {/* 欄 1: Business Objective */}
          <div style={{
            padding: '12px 16px',
            fontWeight: 700,
            fontSize: '0.85rem',
            color: '#86efac',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRight: '1px solid #1e293b'
          }}>
            <span>🎯 Business Objective ({objectives.length})</span>
            {/* Objective 表頭右上角 + 號 (對齊用戶需求: Objective果欄既head可以有個+號都係用來create Objective item) */}
            <button
              onClick={() => {
                setActivePopup({ parentUid: null, childType: 'Objective' });
                setPopupTab('create');
                setCreateTitle('');
              }}
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                backgroundColor: 'rgba(134, 239, 172, 0.15)',
                border: '1px solid #86efac',
                color: '#86efac',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0
              }}
              title="新增 Business Objective"
            >
              <Plus size={13} strokeWidth={2.5} />
            </button>
          </div>

          {/* 欄 2: Business Requirement */}
          <div style={{
            padding: '12px 16px',
            fontWeight: 700,
            fontSize: '0.85rem',
            color: '#93c5fd',
            borderRight: '1px solid #1e293b'
          }}>
            📋 Business Requirement
          </div>

          {/* 欄 3: User Story */}
          <div style={{
            padding: '12px 16px',
            fontWeight: 700,
            fontSize: '0.85rem',
            color: '#c084fc',
            borderRight: '1px solid #1e293b'
          }}>
            📖 User Story
          </div>

          {/* 欄 4: Task */}
          <div style={{
            padding: '12px 16px',
            fontWeight: 700,
            fontSize: '0.85rem',
            color: '#fde047',
            borderRight: '1px solid #1e293b'
          }}>
            🔨 Task
          </div>

          {/* 欄 5: UAT */}
          <div style={{
            padding: '12px 16px',
            fontWeight: 700,
            fontSize: '0.85rem',
            color: '#fca5a5'
          }}>
            🧪 UAT
          </div>
        </div>

        {/* 2. 欄位內容主體 (支援縱向與橫向平滑滾動，表頭始終凍結在頂部) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(240px, 1fr))',
          flex: 1,
          backgroundColor: '#090d16'
        }}>
          {/* 欄 1 卡片列表 */}
          <div style={{ padding: '16px', borderRight: '1px solid #1e293b', backgroundColor: '#0b1120' }}>
            {objectives.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 8px', color: '#64748b', fontSize: '0.8rem' }}>
                尚無 Objective，可點擊表頭 + 號建立
              </div>
            ) : (
              objectives.map(obj => (
                <div key={obj.item_uid}>
                  {renderCard(obj, 'Requirement')}
                </div>
              ))
            )}
          </div>

          {/* 欄 2 卡片列表 */}
          <div style={{ padding: '16px', borderRight: '1px solid #1e293b', backgroundColor: '#090d16' }}>
            {objectives.flatMap(obj => getRequirements(obj.item_uid)).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 8px', color: '#64748b', fontSize: '0.8rem' }}>
                點擊左側 Objective 卡片右上角 + 號新增 Requirement
              </div>
            ) : (
              objectives.flatMap(obj => getRequirements(obj.item_uid)).map(req => (
                <div
                  key={req.item_uid}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropOnParent(e, req.item_uid)}
                >
                  {renderCard(req, 'User story')}
                </div>
              ))
            )}
          </div>

          {/* 欄 3 卡片列表 */}
          <div style={{ padding: '16px', borderRight: '1px solid #1e293b', backgroundColor: '#0b1120' }}>
            {objectives.flatMap(obj => getRequirements(obj.item_uid)).flatMap(req => getUserStories(req.item_uid)).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 8px', color: '#64748b', fontSize: '0.8rem' }}>
                點擊 Requirement 卡片右上角 + 號新增 User Story
              </div>
            ) : (
              objectives.flatMap(obj => getRequirements(obj.item_uid)).flatMap(req => getUserStories(req.item_uid)).map(us => (
                <div
                  key={us.item_uid}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropOnParent(e, us.item_uid)}
                >
                  {renderCard(us, 'Task')}
                </div>
              ))
            )}
          </div>

          {/* 欄 4 卡片列表 */}
          <div style={{ padding: '16px', borderRight: '1px solid #1e293b', backgroundColor: '#090d16' }}>
            {objectives.flatMap(obj => getRequirements(obj.item_uid)).flatMap(req => getUserStories(req.item_uid)).flatMap(us => getTasks(us.item_uid)).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 8px', color: '#64748b', fontSize: '0.8rem' }}>
                點擊 User Story 卡片右上角 + 號新增 Task
              </div>
            ) : (
              objectives.flatMap(obj => getRequirements(obj.item_uid)).flatMap(req => getUserStories(req.item_uid)).flatMap(us => getTasks(us.item_uid)).map(task => (
                <div
                  key={task.item_uid}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropOnParent(e, task.item_uid)}
                >
                  {renderCard(task, 'UAT')}
                </div>
              ))
            )}
          </div>

          {/* 欄 5 卡片列表 */}
          <div style={{ padding: '16px', backgroundColor: '#0b1120' }}>
            {objectives.flatMap(obj => getRequirements(obj.item_uid)).flatMap(req => getUserStories(req.item_uid)).flatMap(us => getTasks(us.item_uid)).flatMap(task => getUats(task.item_uid)).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 8px', color: '#64748b', fontSize: '0.8rem' }}>
                點擊 Task 卡片右上角 + 號新增 UAT
              </div>
            ) : (
              objectives.flatMap(obj => getRequirements(obj.item_uid)).flatMap(req => getUserStories(req.item_uid)).flatMap(us => getTasks(us.item_uid)).flatMap(task => getUats(task.item_uid)).map(uat => (
                <div key={uat.item_uid}>
                  {renderCard(uat)}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 3. 新增 / 搜尋功能組 Modal (對齊需求: 點擊 info card 右上角 + 號出現 input create 或 search 功能組) */}
      {activePopup && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50
        }}>
          <div style={{
            backgroundColor: '#0f172a',
            borderRadius: '12px',
            border: '1px solid #334155',
            width: '90%',
            maxWidth: '480px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid #1e293b',
              backgroundColor: '#131b2e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>
                  新增或關聯 {activePopup.childType}
                </div>
                {activePopup.parentTitle && (
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                    父級目標: {activePopup.parentTitle}
                  </div>
                )}
              </div>
              <button
                onClick={() => setActivePopup(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Tabs: 新增項目 (Create) vs 搜尋既有 (Search & Link) */}
            {activePopup.parentUid && (
              <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', backgroundColor: '#090d16' }}>
                <button
                  onClick={() => setPopupTab('create')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: 'none',
                    background: popupTab === 'create' ? '#0f172a' : 'transparent',
                    color: popupTab === 'create' ? '#38bdf8' : '#64748b',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    borderBottom: popupTab === 'create' ? '2px solid #38bdf8' : 'none',
                    cursor: 'pointer'
                  }}
                >
                  ➕ 直接建立新工單
                </button>
                <button
                  onClick={() => setPopupTab('search')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: 'none',
                    background: popupTab === 'search' ? '#0f172a' : 'transparent',
                    color: popupTab === 'search' ? '#38bdf8' : '#64748b',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    borderBottom: popupTab === 'search' ? '2px solid #38bdf8' : 'none',
                    cursor: 'pointer'
                  }}
                >
                  🔍 搜尋並關聯既有工單
                </button>
              </div>
            )}

            {/* Modal 內容 */}
            <div style={{ padding: '18px' }}>
              {popupTab === 'create' ? (
                /* Tab 1: Input Create */
                <form onSubmit={handleExecuteCreate}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '8px' }}>
                    {activePopup.childType} 名稱 (Title)
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder={`輸入 ${activePopup.childType} 名稱...`}
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: '#090d16',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box',
                      outline: 'none',
                      marginBottom: '16px'
                    }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setActivePopup(null)}
                      style={{
                        padding: '8px 14px',
                        backgroundColor: '#334155',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#cbd5e1',
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={createLoading}
                      style={{
                        padding: '8px 18px',
                        backgroundColor: '#2563eb',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <Check size={16} /> {createLoading ? '建立中...' : '確認新增'}
                    </button>
                  </div>
                </form>
              ) : (
                /* Tab 2: Input Search & Link */
                <div>
                  <div style={{ position: 'relative', marginBottom: '14px' }}>
                    <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                    <input
                      type="text"
                      autoFocus
                      placeholder={`搜尋既有 ${activePopup.childType} 代號或名稱...`}
                      value={itemSearchQuery}
                      onChange={(e) => setItemSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px 8px 34px',
                        backgroundColor: '#090d16',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {searchCandidates.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '0.85rem' }}>
                        找不到符合條件的 {activePopup.childType}
                      </div>
                    ) : (
                      searchCandidates.map(c => (
                        <div
                          key={c.item_uid}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: '#131b2e',
                            borderRadius: '6px',
                            border: '1px solid #1e293b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div>
                            <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.8rem', marginRight: '8px' }}>
                              {c.item_display_code}
                            </span>
                            <span style={{ color: '#f8fafc', fontSize: '0.85rem' }}>
                              {c.item_title}
                            </span>
                          </div>

                          <button
                            onClick={() => handleLinkExistingItem(c.item_uid)}
                            disabled={linkLoading}
                            style={{
                              padding: '4px 10px',
                              backgroundColor: '#1e3a8a',
                              border: 'none',
                              borderRadius: '4px',
                              color: '#93c5fd',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            <Link2 size={13} /> 關聯
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
