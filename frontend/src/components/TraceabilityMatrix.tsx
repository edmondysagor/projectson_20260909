import React, { useState } from 'react';
import { Plus, Search, X, Link2, Trash2 } from 'lucide-react';
import { api } from '../utils/api';
import type { ProjectItem, Member } from '../utils/api';
import { CardStatusSelect } from './CardStatusSelect';
import { MemberSelect } from './MemberSelect';

interface TraceabilityMatrixProps {
  items: ProjectItem[];
  members?: Member[];
  onRefresh: () => Promise<void>;
  onItemClick: (item: ProjectItem) => void;
  projectId: string;
  hideTopAddButton?: boolean;
  projectColor?: string;
}

export const TraceabilityMatrix: React.FC<TraceabilityMatrixProps> = ({
  items,
  members = [],
  onRefresh,
  onItemClick,
  projectId,
  hideTopAddButton = false,
  projectColor
}) => {
  const [draggedUid, setDraggedUid] = useState<string | null>(null);
  const [dragOverUid, setDragOverUid] = useState<string | null>(null);

  // 卡片標題 inline edit
  const [editingTitleUid, setEditingTitleUid] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState('');

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

  // 排序函式：遞增排序，新建立的工單排在緊接最下方 (Created ascending / item_number ASC)
  const sortAsc = (itemList: ProjectItem[]) => {
    return [...itemList].sort((a, b) => {
      if (a.item_number && b.item_number) {
        return a.item_number - b.item_number;
      }
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });
  };

  // 取得各層子項目 (遞增排序：新增的排在最下方)
  const getRequirements = (objUid: string) => 
    sortAsc(items.filter(i => i.item_type === 'Requirement' && (i.parent_item_uid === objUid || i.relation_item_uid?.some((r: any) => r.item_uid === objUid))));

  const getUserStories = (reqUid: string) => 
    sortAsc(items.filter(i => i.item_type === 'User story' && (i.parent_item_uid === reqUid || i.relation_item_uid?.some((r: any) => r.item_uid === reqUid))));

  const getTasks = (usUid: string) => 
    sortAsc(items.filter(i => i.item_type === 'Task' && (i.parent_item_uid === usUid || i.relation_item_uid?.some((r: any) => r.item_uid === usUid))));

  const getUats = (taskUid: string) => 
    sortAsc(items.filter(i => i.item_type === 'UAT' && (i.parent_item_uid === taskUid || i.relation_item_uid?.some((r: any) => r.item_uid === taskUid))));

  const objectives = sortAsc(items.filter(i => i.item_type === 'Objective'));

  // 拖曳重定父工單
  const handleDragStart = (e: React.DragEvent, uid: string) => {
    setDraggedUid(uid);
    e.dataTransfer.setData('text/plain', uid);
  };

  const handleDropOnParent = async (e: React.DragEvent, newParentUid: string) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceUid = draggedUid || e.dataTransfer.getData('text/plain');
    setDragOverUid(null);
    if (!sourceUid || sourceUid === newParentUid) return;

    try {
      await api.patchItem(sourceUid, { parent_item_uid: newParentUid });
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

  // 刪除工單處理
  const handleDeleteItem = async (e: React.MouseEvent, itemToDelete: ProjectItem) => {
    e.stopPropagation();
    if (confirm(`確定要刪除工單 [${itemToDelete.item_display_code}] ${itemToDelete.item_title} 嗎？此操作不可逆。`)) {
      try {
        await api.deleteItem(itemToDelete.item_uid);
        await onRefresh();
      } catch (err: any) {
        alert('刪除失敗: ' + err.message);
      }
    }
  };


  // 渲染單張 Info Card (對齊 圖2: 圓形小按鈕、代碼、狀態、標題、負責人，並且可作為拖曳放置目標)
  const renderCard = (
    item: ProjectItem,
    childTypeNext?: string,
    options?: {
      canDropAsChild?: boolean; // 若為 true，代表可以作為父層接收子卡片拖入
    }
  ) => {
    const isHovered = hoveredCardUid === item.item_uid;
    const isTargetDrop = dragOverUid === item.item_uid;

    return (
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, item.item_uid)}
        onDragEnd={() => {
          setDraggedUid(null);
          setDragOverUid(null);
        }}
        onMouseEnter={() => setHoveredCardUid(item.item_uid)}
        onMouseLeave={() => setHoveredCardUid(null)}
        onDragOver={(e) => {
          if (options?.canDropAsChild && draggedUid && draggedUid !== item.item_uid) {
            e.preventDefault();
            e.stopPropagation();
            if (dragOverUid !== item.item_uid) {
              setDragOverUid(item.item_uid);
            }
          }
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          if (dragOverUid === item.item_uid) {
            setDragOverUid(null);
          }
        }}
        onDrop={(e) => {
          if (options?.canDropAsChild) {
            handleDropOnParent(e, item.item_uid);
          }
        }}
        style={{
          position: 'relative',
          backgroundColor: isTargetDrop ? '#1e293b' : '#131b2e',
          borderRadius: '8px',
          border: isTargetDrop ? '2px dashed #38bdf8' : isHovered ? '1px solid #38bdf8' : '1px solid #243049',
          borderLeft: isTargetDrop ? '2px dashed #38bdf8' : projectColor ? `4px solid ${projectColor}` : (isHovered ? '1px solid #38bdf8' : '1px solid #243049'),
          padding: '12px 14px',
          boxShadow: isTargetDrop ? '0 0 12px rgba(56, 189, 248, 0.4)' : '0 2px 8px rgba(0,0,0,0.3)',
          cursor: 'grab',
          transition: 'border-color 0.15s, box-shadow 0.15s, background-color 0.15s',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '84px',
          boxSizing: 'border-box'
        }}
      >
        {/* 卡片頂部：Display Code + 狀態下拉選單 (綠框位置) */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', paddingRight: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexWrap: 'nowrap' }}>
            <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>
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
                padding: 0,
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              {item.item_display_code}
            </button>

            {/* 綠框位置：狀態下拉選單 (一點擊選項直接寫入 database，不換行) */}
            <div style={{ flexShrink: 0 }}>
              <CardStatusSelect
                value={item.item_status || 'Not Start'}
                onChange={async (newStatus) => {
                  try {
                    await api.patchItem(item.item_uid, { item_status: newStatus });
                    await onRefresh();
                  } catch (err: any) {
                    alert('更新狀態失敗: ' + err.message);
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* 右上角垂直功能按鈕群 (+ 號在上，刪除垃圾桶在 + 號下方，絕不壓縮頂部文字) */}
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          zIndex: 5
        }}>
          {/* 右上角 + 號 (點擊可新增或關聯右側附屬工單) */}
          {childTypeNext && (
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
                backgroundColor: '#233049',
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
                e.currentTarget.style.backgroundColor = '#233049';
                e.currentTarget.style.color = '#93c5fd';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title={`新增 ${childTypeNext}`}
            >
              <Plus size={12} strokeWidth={2.5} />
            </button>
          )}

          {/* 刪除按鈕 (移至 + 號下方，Hover 時亮起) */}
          {isHovered && (
            <button
              onClick={(e) => handleDeleteItem(e, item)}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                transition: 'background-color 0.15s, transform 0.15s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#dc2626';
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.transform = 'scale(1.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                e.currentTarget.style.color = '#f87171';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title="刪除此工單"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>

        {/* 卡片標題名稱 (支援 Inline Edit 就地編輯) */}
        {editingTitleUid === item.item_uid ? (
          <div onClick={(e) => e.stopPropagation()} style={{ marginBottom: '6px' }}>
            <input
              autoFocus
              type="text"
              value={editTitleText}
              onChange={(e) => setEditTitleText(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  if (editTitleText.trim() && editTitleText !== item.item_title) {
                    try {
                      await api.patchItem(item.item_uid, { item_title: editTitleText.trim() });
                      await onRefresh();
                    } catch (err: any) {
                      alert('更新標題失敗: ' + err.message);
                    }
                  }
                  setEditingTitleUid(null);
                } else if (e.key === 'Escape') {
                  setEditingTitleUid(null);
                }
              }}
              onBlur={async () => {
                if (editTitleText.trim() && editTitleText !== item.item_title) {
                  try {
                    await api.patchItem(item.item_uid, { item_title: editTitleText.trim() });
                    await onRefresh();
                  } catch (err: any) {
                    alert('更新標題失敗: ' + err.message);
                  }
                }
                setEditingTitleUid(null);
              }}
              style={{
                width: '100%',
                backgroundColor: '#0c1222',
                border: '1px solid #38bdf8',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '0.85rem',
                padding: '4px 6px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        ) : (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setEditingTitleUid(item.item_uid);
              setEditTitleText(item.item_title);
            }}
            style={{
              fontSize: '0.85rem',
              color: '#f8fafc',
              fontWeight: 500,
              lineHeight: 1.4,
              marginBottom: '6px',
              cursor: 'text',
              borderRadius: '4px',
              padding: '2px 4px',
              marginLeft: '-4px',
              transition: 'background-color 0.15s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            title="點擊就地編輯標題 (Enter 儲存)"
          >
            {item.item_title}
          </div>
        )}

        {/* 底部 Follow by 負責人下拉選單 (支援 search & create + 直接寫入 database) */}
        <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 'auto', paddingTop: '4px' }}>
          <MemberSelect
            value={item.item_follow_by || undefined}
            members={members}
            placeholder="未指派負責人"
            size="sm"
            onChange={async (newUid) => {
              const selected = members.find(m => m.member_uid === newUid);
              try {
                await api.patchItem(item.item_uid, {
                  item_follow_by: newUid || '',
                  follow_by_name: selected ? selected.member_name : ''
                });
                await onRefresh();
              } catch (err: any) {
                alert('更新負責人失敗: ' + err.message);
              }
            }}
            buttonStyle={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: '2px 4px',
              color: item.follow_by_name ? '#94a3b8' : '#64748b',
              fontSize: '0.74rem',
              boxShadow: 'none',
              fontWeight: 500,
              borderRadius: '4px'
            }}
          />
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
            5 層完整工程分組結構：Objective ➔ Requirement ➔ User Story ➔ Task ➔ UAT (支援直接拖曳至父層卡片或右側空白區變更從屬歸類)
          </p>
        </div>

        {/* 快速新增頂層 Objective 按鈕 */}
        {!hideTopAddButton && (
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
        )}
      </div>

      {/* 5 欄固定凍結表頭 + Multi-level Row Span 分組表格容器 */}
      <div style={{
        flex: 1,
        margin: '16px 24px',
        backgroundColor: '#0c111e',
        borderRadius: '12px',
        border: '1px solid #1e293b',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}>
        {/* 1. 凍結表頭 (Sticky Header: 固定置頂，不管橫向或縱向滾動都見到) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(240px, 1fr) minmax(240px, 1fr) minmax(240px, 1fr) minmax(240px, 1fr) minmax(240px, 1fr)',
          position: 'sticky',
          top: 0,
          zIndex: 20,
          backgroundColor: '#131b2e',
          borderBottom: '2px solid #1e293b',
          minWidth: '1200px'
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

        {/* 2. 多層級階層跨行分組主體 (Multi-level Row Span 分組線條) */}
        <div style={{ minWidth: '1200px' }}>
          {objectives.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 16px', color: '#64748b', fontSize: '0.85rem' }}>
              尚無 Objective，請點擊上方或表頭「+」號建立第一個 Business Objective
            </div>
          ) : (
            objectives.map((obj, objIdx) => {
              const reqs = getRequirements(obj.item_uid);

              return (
                <div
                  key={obj.item_uid}
                  style={{
                    display: 'flex',
                    borderBottom: objIdx < objectives.length - 1 ? '2px solid #23304a' : 'none',
                    backgroundColor: objIdx % 2 === 0 ? '#0b101c' : '#080d17'
                  }}
                >
                  {/* 第一欄：Objective 卡片 (支援作為 drop 目標接收 Requirement 卡片) */}
                  <div
                    onDragOver={(e) => {
                      if (draggedUid && draggedUid !== obj.item_uid) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                    }}
                    onDrop={(e) => handleDropOnParent(e, obj.item_uid)}
                    style={{
                      flex: '0 0 20%',
                      width: '20%',
                      padding: '16px',
                      borderRight: '1px solid #1e293b',
                      boxSizing: 'border-box'
                    }}
                  >
                    {renderCard(obj, 'Requirement', { canDropAsChild: true })}
                  </div>

                  {/* 右側 4 欄複合容器 (Requirement ➔ User Story ➔ Task ➔ UAT) */}
                  <div style={{
                    flex: '0 0 80%',
                    width: '80%',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    {reqs.length === 0 ? (
                      /* 當該 Objective 尚未有 Requirement 時，此區塊亦可直接作為 Drop 放置目標！ */
                      <div
                        onDragOver={(e) => {
                          if (draggedUid && draggedUid !== obj.item_uid) {
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        }}
                        onDrop={(e) => handleDropOnParent(e, obj.item_uid)}
                        style={{
                          display: 'flex',
                          height: '100%',
                          minHeight: '100px',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{
                          flex: '0 0 25%',
                          width: '25%',
                          padding: '16px',
                          borderRight: '1px solid #1e293b',
                          boxSizing: 'border-box'
                        }}>
                          <button
                            onClick={() => {
                              setActivePopup({ parentUid: obj.item_uid, childType: 'Requirement', parentTitle: obj.item_title });
                              setPopupTab('create');
                              setCreateTitle('');
                            }}
                            style={{
                              width: '100%',
                              padding: '14px',
                              borderRadius: '8px',
                              border: '1px dashed #334155',
                              backgroundColor: 'rgba(30, 41, 59, 0.2)',
                              color: '#64748b',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                          >
                            <Plus size={14} /> 新增 Requirement
                          </button>
                        </div>
                        <div style={{ flex: '0 0 75%', width: '75%', color: '#475569', fontSize: '0.75rem', padding: '16px' }}>
                          —
                        </div>
                      </div>
                    ) : (
                      /* 逐個 Requirement 分組渲染 */
                      reqs.map((req, reqIdx) => {
                        const stories = getUserStories(req.item_uid);

                        return (
                          <div
                            key={req.item_uid}
                            style={{
                              display: 'flex',
                              borderBottom: reqIdx < reqs.length - 1 ? '1px solid #1e293b' : 'none'
                            }}
                          >
                            {/* 第二欄：Requirement 卡片 (支援接收 User Story 拖曳放置，亦支援拖曳至其他 Objective) */}
                            <div
                              onDragOver={(e) => {
                                if (draggedUid && draggedUid !== req.item_uid) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }
                              }}
                              onDrop={(e) => handleDropOnParent(e, req.item_uid)}
                              style={{
                                flex: '0 0 25%',
                                width: '25%',
                                padding: '16px',
                                borderRight: '1px solid #1e293b',
                                boxSizing: 'border-box'
                              }}
                            >
                              {renderCard(req, 'User story', { canDropAsChild: true })}
                            </div>

                            {/* 右側 3 欄複合容器 (User Story ➔ Task ➔ UAT) */}
                            <div style={{
                              flex: '0 0 75%',
                              width: '75%',
                              display: 'flex',
                              flexDirection: 'column'
                            }}>
                              {stories.length === 0 ? (
                                /* 當該 Requirement 尚未有 User Story (支援 drop 放置 User Story) */
                                <div
                                  onDragOver={(e) => {
                                    if (draggedUid && draggedUid !== req.item_uid) {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }
                                  }}
                                  onDrop={(e) => handleDropOnParent(e, req.item_uid)}
                                  style={{
                                    display: 'flex',
                                    height: '100%',
                                    minHeight: '100px',
                                    alignItems: 'center'
                                  }}
                                >
                                  <div style={{
                                    flex: '0 0 33.333%',
                                    width: '33.333%',
                                    padding: '16px',
                                    borderRight: '1px solid #1e293b',
                                    boxSizing: 'border-box'
                                  }}>
                                    <button
                                      onClick={() => {
                                        setActivePopup({ parentUid: req.item_uid, childType: 'User story', parentTitle: req.item_title });
                                        setPopupTab('create');
                                        setCreateTitle('');
                                      }}
                                      style={{
                                        width: '100%',
                                        padding: '14px',
                                        borderRadius: '8px',
                                        border: '1px dashed #334155',
                                        backgroundColor: 'rgba(30, 41, 59, 0.2)',
                                        color: '#64748b',
                                        fontSize: '0.78rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px'
                                      }}
                                    >
                                      <Plus size={14} /> 新增 User Story
                                    </button>
                                  </div>
                                  <div style={{ flex: '0 0 66.666%', width: '66.666%', color: '#475569', fontSize: '0.75rem', padding: '16px' }}>
                                    —
                                  </div>
                                </div>
                              ) : (
                                /* 逐個 User Story 分組渲染 */
                                stories.map((us, usIdx) => {
                                  const tasks = getTasks(us.item_uid);

                                  return (
                                    <div
                                      key={us.item_uid}
                                      style={{
                                        display: 'flex',
                                        borderBottom: usIdx < stories.length - 1 ? '1px solid #1e293b' : 'none'
                                      }}
                                    >
                                      {/* 第三欄：User Story 卡片 (支援接收 Task 拖曳放置，亦支援拖曳至其他 Requirement) */}
                                      <div
                                        onDragOver={(e) => {
                                          if (draggedUid && draggedUid !== us.item_uid) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                          }
                                        }}
                                        onDrop={(e) => handleDropOnParent(e, us.item_uid)}
                                        style={{
                                          flex: '0 0 33.333%',
                                          width: '33.333%',
                                          padding: '16px',
                                          borderRight: '1px solid #1e293b',
                                          boxSizing: 'border-box'
                                        }}
                                      >
                                        {renderCard(us, 'Task', { canDropAsChild: true })}
                                      </div>

                                      {/* 右側 2 欄複合容器 (Task ➔ UAT) */}
                                      <div style={{
                                        flex: '0 0 66.667%',
                                        width: '66.667%',
                                        display: 'flex',
                                        flexDirection: 'column'
                                      }}>
                                        {tasks.length === 0 ? (
                                          /* 當該 User Story 尚未有 Task (支援 drop 放置 Task) */
                                          <div
                                            onDragOver={(e) => {
                                              if (draggedUid && draggedUid !== us.item_uid) {
                                                e.preventDefault();
                                                e.stopPropagation();
                                              }
                                            }}
                                            onDrop={(e) => handleDropOnParent(e, us.item_uid)}
                                            style={{
                                              display: 'flex',
                                              height: '100%',
                                              minHeight: '100px',
                                              alignItems: 'center'
                                            }}
                                          >
                                            <div style={{
                                              flex: '0 0 50%',
                                              width: '50%',
                                              padding: '16px',
                                              borderRight: '1px solid #1e293b',
                                              boxSizing: 'border-box'
                                            }}>
                                              <button
                                                onClick={() => {
                                                  setActivePopup({ parentUid: us.item_uid, childType: 'Task', parentTitle: us.item_title });
                                                  setPopupTab('create');
                                                  setCreateTitle('');
                                                }}
                                                style={{
                                                  width: '100%',
                                                  padding: '14px',
                                                  borderRadius: '8px',
                                                  border: '1px dashed #334155',
                                                  backgroundColor: 'rgba(30, 41, 59, 0.2)',
                                                  color: '#64748b',
                                                  fontSize: '0.78rem',
                                                  cursor: 'pointer',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  gap: '6px'
                                                }}
                                              >
                                                <Plus size={14} /> 新增 Task
                                              </button>
                                            </div>
                                            <div style={{ flex: '0 0 50%', width: '50%', color: '#475569', fontSize: '0.75rem', padding: '16px' }}>
                                              —
                                            </div>
                                          </div>
                                        ) : (
                                          /* 逐個 Task 分組渲染 */
                                          tasks.map((task, taskIdx) => {
                                            const uats = getUats(task.item_uid);

                                            return (
                                              <div
                                                key={task.item_uid}
                                                style={{
                                                  display: 'flex',
                                                  borderBottom: taskIdx < tasks.length - 1 ? '1px solid #1e293b' : 'none'
                                                }}
                                              >
                                                {/* 第四欄：Task 卡片 (支援接收 UAT 拖曳放置，亦支援拖曳至其他 User Story) */}
                                                <div
                                                  onDragOver={(e) => {
                                                    if (draggedUid && draggedUid !== task.item_uid) {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                    }
                                                  }}
                                                  onDrop={(e) => handleDropOnParent(e, task.item_uid)}
                                                  style={{
                                                    flex: '0 0 50%',
                                                    width: '50%',
                                                    padding: '16px',
                                                    borderRight: '1px solid #1e293b',
                                                    boxSizing: 'border-box'
                                                  }}
                                                >
                                                  {renderCard(task, 'UAT', { canDropAsChild: true })}
                                                </div>

                                                {/* 第五欄：UAT 卡片清單 (支援 drop 放置 UAT) */}
                                                <div
                                                  onDragOver={(e) => {
                                                    if (draggedUid && draggedUid !== task.item_uid) {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                    }
                                                  }}
                                                  onDrop={(e) => handleDropOnParent(e, task.item_uid)}
                                                  style={{
                                                    flex: '0 0 50%',
                                                    width: '50%',
                                                    padding: '16px',
                                                    boxSizing: 'border-box'
                                                  }}
                                                >
                                                  {uats.length === 0 ? (
                                                    <button
                                                      onClick={() => {
                                                        setActivePopup({ parentUid: task.item_uid, childType: 'UAT', parentTitle: task.item_title });
                                                        setPopupTab('create');
                                                        setCreateTitle('');
                                                      }}
                                                      style={{
                                                        width: '100%',
                                                        padding: '14px',
                                                        borderRadius: '8px',
                                                        border: '1px dashed #334155',
                                                        backgroundColor: 'rgba(30, 41, 59, 0.2)',
                                                        color: '#64748b',
                                                        fontSize: '0.78rem',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '6px'
                                                      }}
                                                    >
                                                      <Plus size={14} /> 新增 UAT
                                                    </button>
                                                  ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                      {uats.map(uat => (
                                                        <div key={uat.item_uid}>
                                                          {renderCard(uat)}
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. 新增 / 搜尋功能組 Modal */}
      {activePopup && (
        <div style={{
          position: 'fixed',
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

            {/* Tab 1: 直接建立新工單 */}
            {popupTab === 'create' && (
              <form onSubmit={handleExecuteCreate} style={{ padding: '20px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                    {activePopup.childType} 名稱 / 標題 <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={`請輸入 ${activePopup.childType} 標題...`}
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#f8fafc',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setActivePopup(null)}
                    style={{
                      padding: '8px 14px',
                      backgroundColor: 'transparent',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#94a3b8',
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading || !createTitle.trim()}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: createLoading || !createTitle.trim() ? '#475569' : '#2563eb',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: createLoading || !createTitle.trim() ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {createLoading ? '建立中...' : '確認新增'}
                  </button>
                </div>
              </form>
            )}

            {/* Tab 2: 搜尋並關聯既有工單 */}
            {popupTab === 'search' && (
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* 關鍵字搜尋欄位 */}
                <div style={{ position: 'relative' }}>
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '11px', color: '#64748b' }} />
                  <input
                    type="text"
                    placeholder={`搜尋 ${activePopup.childType} 代碼或標題...`}
                    value={itemSearchQuery}
                    onChange={(e) => setItemSearchQuery(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '8px 10px 8px 32px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* 候選工單清單 */}
                <div style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  borderRadius: '6px',
                  border: '1px solid #1e293b',
                  backgroundColor: '#090d16'
                }}>
                  {searchCandidates.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 8px', color: '#64748b', fontSize: '0.82rem' }}>
                      未找到符合的既有 {activePopup.childType} 工單
                    </div>
                  ) : (
                    searchCandidates.map(cand => (
                      <div
                        key={cand.item_uid}
                        style={{
                          padding: '10px 12px',
                          borderBottom: '1px solid #1e293b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}
                      >
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 700 }}>
                            {cand.item_display_code}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: '#f8fafc', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {cand.item_title}
                          </div>
                        </div>

                        <button
                          disabled={linkLoading}
                          onClick={() => handleLinkExistingItem(cand.item_uid)}
                          style={{
                            padding: '5px 10px',
                            backgroundColor: '#1d4ed8',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            flexShrink: 0
                          }}
                        >
                          <Link2 size={12} /> 關聯
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setActivePopup(null)}
                    style={{
                      padding: '7px 14px',
                      backgroundColor: 'transparent',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#94a3b8',
                      fontSize: '0.82rem',
                      cursor: 'pointer'
                    }}
                  >
                    關閉
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
