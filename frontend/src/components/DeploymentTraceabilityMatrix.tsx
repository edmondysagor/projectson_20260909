import React, { useState } from 'react';
import { Plus, Search, X, Link2, Trash2 } from 'lucide-react';
import { api } from '../utils/api';
import type { ProjectItem, Member } from '../utils/api';
import { CardStatusSelect } from './CardStatusSelect';
import { MemberSelect } from './MemberSelect';

interface DeploymentTraceabilityMatrixProps {
  items: ProjectItem[];
  members?: Member[];
  onRefresh: () => Promise<void>;
  onItemClick: (item: ProjectItem) => void;
  projectId: string;
  hideTopAddButton?: boolean;
  projectColor?: string;
}

/**
 * 專案 Update & Deployment 三欄式工程溯源矩陣 (Deployment > User Story > Task)
 * - 對齊 圖2 (3欄式佈局: Deployment, User Story, Task)
 * - 功能鍵全面繼承 圖3 (TraceabilityMatrix 規格):
 *   1. 頂部表頭 Deployment 欄位附帶「+」號快速新增頂層 Deployment
 *   2. 卡片右上角附帶「+」號（新增/關聯下層項目）與「垃圾桶」刪除按鈕
 *   3. 下層無子項目時，呈現 "+ 新增 User Story" / "+ 新增 Task" 虛線插槽按鈕
 *   4. 支援點擊「+」展開彈窗，可「➕ 直接建立新工單」或「🔍 搜尋並關聯既有工單」
 *   5. 支援卡片拖曳（Drag & Drop）變更父子層級綁定
 */
export const DeploymentTraceabilityMatrix: React.FC<DeploymentTraceabilityMatrixProps> = ({
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
    parentUid: string | null; // null 代表新增頂層 Deployment
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

  // Hover 卡片顯示右上角按鈕
  const [hoveredCardUid, setHoveredCardUid] = useState<string | null>(null);

  // 排序函式：遞增排序，新建立的工單排在緊接最下方
  const sortAsc = (itemList: ProjectItem[]) => {
    return [...itemList].sort((a, b) => {
      if (a.item_number && b.item_number) {
        return a.item_number - b.item_number;
      }
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });
  };

  // 取得部署工單集合 (Deployment)
  const deployments = sortAsc(items.filter(i => i.item_type === 'Deployment'));

  // 取得 Deployment 的下層 User Stories (支援 parent_item_uid 或 Deployment 的 relation_item_uid 'Deploys' 關聯)
  const getUserStories = (depUid: string) => {
    const dep = items.find(i => i.item_uid === depUid);
    const deploysUids = dep?.relation_item_uid
      ?.filter((r: any) => !r.relation || r.relation === 'Deploys')
      .map((r: any) => r.item_uid) || [];

    return sortAsc(items.filter(i =>
      i.item_type === 'User story' && (
        i.parent_item_uid === depUid ||
        deploysUids.includes(i.item_uid) ||
        i.relation_item_uid?.some((r: any) => r.item_uid === depUid)
      )
    ));
  };

  // 取得 User Story 的下層 Tasks
  const getTasks = (usUid: string) =>
    sortAsc(items.filter(i => i.item_type === 'Task' && (i.parent_item_uid === usUid || i.relation_item_uid?.some((r: any) => r.item_uid === usUid))));

  // 拖曳重定父工單或建立部署關聯
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
      const sourceItem = items.find(i => i.item_uid === sourceUid);
      const targetItem = items.find(i => i.item_uid === newParentUid);

      // 若拖曳目標為 Deployment 且來源為 User story，特別處理：建立 Deploys 關聯，不改動 User story 的 parent_item_uid
      if (targetItem?.item_type === 'Deployment' && sourceItem?.item_type === 'User story') {
        const currentRelations = targetItem.relation_item_uid || [];
        if (!currentRelations.some((r: any) => r.item_uid === sourceUid)) {
          await api.patchItem(targetItem.item_uid, {
            relation_item_uid: [...currentRelations, { item_uid: sourceUid, relation: 'Deploys' }]
          });
        }
      } else {
        await api.patchItem(sourceUid, { parent_item_uid: newParentUid });
      }
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
      const parentItem = activePopup.parentUid ? items.find(i => i.item_uid === activePopup.parentUid) : null;
      const isDeploymentForStory = parentItem?.item_type === 'Deployment' && activePopup.childType === 'User story';

      // 若是在 Deployment 下新增 User story：
      // 不將 Deployment 設為 parent_item_uid，而是在建立後自動將 Deployment 的 relation 設為 Deploys 目標 User story
      const created = await api.createItem({
        item_title: createTitle.trim(),
        item_type: activePopup.childType,
        related_project_uid: projectId,
        parent_item_uid: isDeploymentForStory ? undefined : (activePopup.parentUid || undefined),
        item_status: 'Not Start',
        item_priority: 'Middle'
      });

      if (isDeploymentForStory && parentItem && created?.item_uid) {
        const currentRelations = parentItem.relation_item_uid || [];
        if (!currentRelations.some((r: any) => r.item_uid === created.item_uid)) {
          await api.patchItem(parentItem.item_uid, {
            relation_item_uid: [...currentRelations, { item_uid: created.item_uid, relation: 'Deploys' }]
          });
        }
      }

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
      const parentItem = items.find(i => i.item_uid === activePopup.parentUid);
      const isDeploymentForStory = parentItem?.item_type === 'Deployment' && activePopup.childType === 'User story';

      if (isDeploymentForStory && parentItem) {
        // 特別處理：更新 Deployment 與目標 User story 的 Relation 為 Deploys，而不更改 parent_item_uid
        const currentRelations = parentItem.relation_item_uid || [];
        if (!currentRelations.some((r: any) => r.item_uid === existingItemUid)) {
          await api.patchItem(parentItem.item_uid, {
            relation_item_uid: [...currentRelations, { item_uid: existingItemUid, relation: 'Deploys' }]
          });
        }
      } else {
        await api.patchItem(existingItemUid, { parent_item_uid: activePopup.parentUid });
      }

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


  // 渲染單張 Info Card (對齊 圖3: 代碼、右上角小圓按鈕、狀態、標題、負責人，並且可作為拖曳放置目標)
  const renderCard = (
    item: ProjectItem,
    childTypeNext?: string,
    options?: {
      canDropAsChild?: boolean;
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
              {item.item_type === 'Deployment' ? '📦' :
               item.item_type === 'User story' ? '👤' : '📝'}
            </span>
            <button
              onClick={() => onItemClick(item)}
              style={{
                background: 'transparent',
                border: 'none',
                color: item.item_type === 'Deployment' ? '#fb923c' : '#38bdf8',
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
      {/* 頂部說明與快速操作 */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            🚀 發布與部署溯源矩陣 (Deployments & Updates)
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
            3 級部署工程關聯鏈：Deployment ➔ User Story ➔ Task (支援直接拖曳至父層卡片或右側空白區變更歸類)
          </p>
        </div>

        {/* 快速新增頂層 Deployment 按鈕 */}
        {!hideTopAddButton && (
          <button
            onClick={() => {
              setActivePopup({ parentUid: null, childType: 'Deployment' });
              setPopupTab('create');
              setCreateTitle('');
            }}
            style={{
              padding: '7px 14px',
              backgroundColor: '#ea580c',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(234, 88, 12, 0.3)'
            }}
          >
            <Plus size={15} /> 新增 Deployment
          </button>
        )}
      </div>

      {/* 矩陣內容主滾動區 */}
      <div style={{
        flex: 1,
        overflowX: 'auto',
        overflowY: 'auto',
        position: 'relative'
      }}>
        {/* 1. 表頭列 (3 欄式設計：Deployment | User Story | Task，對齊圖2) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '33.333% 33.333% 33.334%',
          backgroundColor: '#0c1222',
          borderBottom: '1px solid #1e293b',
          position: 'sticky',
          top: 0,
          zIndex: 20,
          minWidth: '900px'
        }}>
          {/* 欄 1: Deployment */}
          <div style={{
            padding: '12px 16px',
            fontWeight: 700,
            fontSize: '0.85rem',
            color: '#fb923c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRight: '1px solid #1e293b'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📦 Deployment</span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                ({deployments.length})
              </span>
            </div>
            <button
              onClick={() => {
                setActivePopup({ parentUid: null, childType: 'Deployment' });
                setPopupTab('create');
                setCreateTitle('');
              }}
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                backgroundColor: 'rgba(251, 146, 60, 0.2)',
                border: '1px solid rgba(251, 146, 60, 0.4)',
                color: '#fdba74',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0
              }}
              title="新增 Deployment"
            >
              <Plus size={13} strokeWidth={2.5} />
            </button>
          </div>

          {/* 欄 2: User Story */}
          <div style={{
            padding: '12px 16px',
            fontWeight: 700,
            fontSize: '0.85rem',
            color: '#c084fc',
            borderRight: '1px solid #1e293b'
          }}>
            📖 User Story
          </div>

          {/* 欄 3: Task */}
          <div style={{
            padding: '12px 16px',
            fontWeight: 700,
            fontSize: '0.85rem',
            color: '#fde047'
          }}>
            🔨 Task
          </div>
        </div>

        {/* 2. 跨行階層主體 (對齊 圖2 與 圖3) */}
        <div style={{ minWidth: '900px' }}>
          {deployments.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '80px 16px',
              color: '#64748b',
              fontSize: '0.9rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div>目前尚無部署卡片紀錄 (可至右上角點擊「+ 新增 Deployment」建立工單)</div>
              <button
                onClick={() => {
                  setActivePopup({ parentUid: null, childType: 'Deployment' });
                  setPopupTab('create');
                  setCreateTitle('');
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ea580c',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                + 立即建立第一個 Deployment
              </button>
            </div>
          ) : (
            deployments.map((dep, depIdx) => {
              const stories = getUserStories(dep.item_uid);

              return (
                <div
                  key={dep.item_uid}
                  style={{
                    display: 'flex',
                    borderBottom: depIdx < deployments.length - 1 ? '2px solid #23304a' : 'none',
                    backgroundColor: depIdx % 2 === 0 ? '#0b101c' : '#080d17'
                  }}
                >
                  {/* 第一欄：Deployment 卡片 (支援作為 drop 目標接收 User Story 卡片) */}
                  <div
                    onDragOver={(e) => {
                      if (draggedUid && draggedUid !== dep.item_uid) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                    }}
                    onDrop={(e) => handleDropOnParent(e, dep.item_uid)}
                    style={{
                      flex: '0 0 33.333%',
                      width: '33.333%',
                      padding: '16px',
                      borderRight: '1px solid #1e293b',
                      boxSizing: 'border-box'
                    }}
                  >
                    {renderCard(dep, 'User story', { canDropAsChild: true })}
                  </div>

                  {/* 右側 2 欄複合容器 (User Story ➔ Task) */}
                  <div style={{
                    flex: '0 0 66.667%',
                    width: '66.667%',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    {stories.length === 0 ? (
                      /* 當該 Deployment 尚未有 User Story (支援 drop 放置 User Story，並提供功能鍵按鈕) */
                      <div
                        onDragOver={(e) => {
                          if (draggedUid && draggedUid !== dep.item_uid) {
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        }}
                        onDrop={(e) => handleDropOnParent(e, dep.item_uid)}
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
                              setActivePopup({ parentUid: dep.item_uid, childType: 'User story', parentTitle: dep.item_title });
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
                        <div style={{ flex: '0 0 50%', width: '50%', color: '#475569', fontSize: '0.75rem', padding: '16px' }}>
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
                            {/* 第二欄：User Story 卡片 (支援接收 Task 拖曳放置，亦支援拖曳至其他 Deployment) */}
                            <div
                              onDragOver={(e) => {
                                if (draggedUid && draggedUid !== us.item_uid) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }
                              }}
                              onDrop={(e) => handleDropOnParent(e, us.item_uid)}
                              style={{
                                flex: '0 0 50%',
                                width: '50%',
                                padding: '16px',
                                borderRight: '1px solid #1e293b',
                                boxSizing: 'border-box'
                              }}
                            >
                              {renderCard(us, 'Task', { canDropAsChild: true })}
                            </div>

                            {/* 第三欄：Task 複合容器 */}
                            <div style={{
                              flex: '0 0 50%',
                              width: '50%',
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
                                    alignItems: 'center',
                                    padding: '16px',
                                    boxSizing: 'border-box'
                                  }}
                                >
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
                              ) : (
                                /* 逐個 Task 渲染 */
                                tasks.map((task, taskIdx) => (
                                  <div
                                    key={task.item_uid}
                                    style={{
                                      padding: '16px',
                                      borderBottom: taskIdx < tasks.length - 1 ? '1px solid #1e293b' : 'none',
                                      boxSizing: 'border-box'
                                    }}
                                  >
                                    {renderCard(task)}
                                  </div>
                                ))
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

      {/* 3. 點擊 + 號跳出的新增 / 關聯工單彈出層 (對齊 圖3) */}
      {activePopup && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setActivePopup(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '460px',
              backgroundColor: '#131b2e',
              border: '1px solid #2d3b55',
              borderRadius: '10px',
              overflow: 'hidden',
              boxShadow: '0 16px 36px rgba(0,0,0,0.6)'
            }}
          >
            {/* 彈窗 Header */}
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid #1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#161f32'
            }}>
              <div>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                  {activePopup.parentUid ? `新增 / 關聯 ${activePopup.childType}` : `新增頂層 ${activePopup.childType}`}
                </span>
                {activePopup.parentTitle && (
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                    父工單：{activePopup.parentTitle}
                  </div>
                )}
              </div>
              <button
                onClick={() => setActivePopup(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* 若有父工單，提供 Tab 切換：「直接建立」 vs 「關聯現有工單」 */}
            {activePopup.parentUid && (
              <div style={{
                display: 'flex',
                borderBottom: '1px solid #1e293b',
                backgroundColor: '#0c1222'
              }}>
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
                      backgroundColor: '#2563eb',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: createLoading || !createTitle.trim() ? 0.6 : 1
                    }}
                  >
                    {createLoading ? '建立中...' : '確認建立'}
                  </button>
                </div>
              </form>
            )}

            {/* Tab 2: 搜尋並關聯既有工單 */}
            {popupTab === 'search' && activePopup.parentUid && (
              <div style={{ padding: '20px' }}>
                <div style={{ position: 'relative', marginBottom: '14px' }}>
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '11px', color: '#64748b' }} />
                  <input
                    type="text"
                    placeholder={`搜尋專案內 ${activePopup.childType} 代碼或標題...`}
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

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
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
