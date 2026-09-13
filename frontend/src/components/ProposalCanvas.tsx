import React from 'react';
import { 
  CheckSquare, 
  Square, 
  Trash2, 
  Plus, 
  User, 
  Layers, 
  CheckCircle2, 
  X,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Edit3,
  PlusCircle,
  BookmarkCheck,
  Tag
} from 'lucide-react';
import type { Member, ProjectItem } from '../utils/api';

export const resolveMemberDisplay = (val?: string, members: Member[] = []): string => {
  if (!val || val.trim() === '' || val === 'None' || val === 'null') return '未指派';
  const found = members.find(m => m.member_uid === val || m.member_name === val || m.member_email === val);
  if (found) {
    return `${found.member_name} (${found.member_email})`;
  }
  // If val is a UUID regex format
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
    return '未指派成員';
  }
  return val;
};

export const resolveItemDisplay = (val?: string, existingItems: ProjectItem[] = []): string => {
  if (!val || val.trim() === '' || val === 'None' || val === 'null') return '';
  const found = existingItems.find(it => it.item_uid === val || it.item_display_code?.toLowerCase() === val.toLowerCase());
  if (found) {
    return `[${found.item_display_code}] ${found.item_title}`;
  }
  if (/^[A-Z0-9]+-\d+$/i.test(val)) {
    return `[${val}]`;
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
    return '[指定工單]';
  }
  return val;
};

export interface ProposedItem {
  id: string;
  itemTitle: string;
  itemType: string;
  itemPriority: 'High' | 'Middle' | 'Low' | string;
  itemStatus?: string;
  itemFollowBy?: string;
  parentItemUid?: string;
  description?: string;
  approved: boolean;
}

export interface UpdateDiffPayload {
  targetDisplayCode?: string;
  targetItemUid?: string;
  itemTitle?: string;
  updates: {
    item_follow_by?: string;
    item_status?: string;
    item_title?: string;
    item_priority?: string;
    item_planned_start_date?: string;
    item_planned_end_date?: string;
    parent_item_uid?: string;
  };
  summary?: string;
  currentValues?: {
    item_status?: string;
    item_follow_by?: string;
    follow_by_name?: string;
    item_priority?: string;
    parent_display_code?: string;
  };
}

export interface ConsensusPayload {
  title: string;
  statement: string;
  rationale?: string;
}

interface ProposalCanvasProps {
  actionType: 'batch_proposal' | 'create_item' | 'update_item' | 'consensus_proposal';
  proposalTitle: string;
  items: ProposedItem[];
  updateDiff?: UpdateDiffPayload;
  consensusData?: ConsensusPayload;
  members: Member[];
  existingItems?: ProjectItem[];
  isApplied?: boolean;
  onItemChange: (index: number, updatedItem: ProposedItem) => void;
  onToggleApprove: (index: number) => void;
  onToggleAll: (approved: boolean) => void;
  onAddItem: () => void;
  onDeleteItem: (index: number) => void;
  onClose: () => void;
  onApplyBatch: (selectedItems: ProposedItem[]) => Promise<void>;
  onApplySingleCreate: (item: ProposedItem) => Promise<void>;
  onApplySingleUpdate: (diff: UpdateDiffPayload) => Promise<void>;
  onApplyConsensus: (consensus: ConsensusPayload) => Promise<void>;
  isSubmitting: boolean;
}

export const ProposalCanvas: React.FC<ProposalCanvasProps> = ({
  actionType,
  proposalTitle,
  items,
  updateDiff,
  consensusData,
  members,
  existingItems = [],
  isApplied = false,
  onItemChange,
  onToggleApprove,
  onToggleAll,
  onAddItem,
  onDeleteItem,
  onClose,
  onApplyBatch,
  onApplySingleCreate,
  onApplySingleUpdate,
  onApplyConsensus,
  isSubmitting
}) => {
  const approvedCount = items.filter(i => i.approved).length;
  const allApproved = items.length > 0 && approvedCount === items.length;

  const handleApply = async () => {
    if (actionType === 'batch_proposal') {
      const selected = items.filter(i => i.approved);
      if (selected.length === 0) {
        alert('請至少勾選一項要套用的工單！');
        return;
      }
      await onApplyBatch(selected);
    } else if (actionType === 'create_item') {
      if (items.length === 0) return;
      await onApplySingleCreate(items[0]);
    } else if (actionType === 'update_item' && updateDiff) {
      await onApplySingleUpdate(updateDiff);
    } else if (actionType === 'consensus_proposal' && consensusData) {
      await onApplyConsensus(consensusData);
    }
  };

  const getHeaderIcon = () => {
    switch (actionType) {
      case 'create_item':
        return <PlusCircle size={16} color="#93c5fd" />;
      case 'update_item':
        return <Edit3 size={16} color="#fde047" />;
      case 'consensus_proposal':
        return <BookmarkCheck size={16} color="#fbbf24" />;
      default:
        return <Layers size={16} color="#c084fc" />;
    }
  };

  const getHeaderBadge = () => {
    switch (actionType) {
      case 'create_item':
        return { label: '單項工單建立審查', color: '#38bdf8', bg: '#082f49' };
      case 'update_item':
        return { label: '工單屬性變更 / 作廢審查 (Diff)', color: '#facc15', bg: '#422006' };
      case 'consensus_proposal':
        return { label: 'OKF 雙時態決策共識沉澱', color: '#f59e0b', bg: '#451a03' };
      default:
        return { label: '批量工單拆解審查 (Batch)', color: '#c084fc', bg: '#3b0764' };
    }
  };

  const badgeInfo = getHeaderBadge();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#0a0f1d',
      borderLeft: '1px solid #1e293b'
    }}>
      {/* 頂部 Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid #1e293b',
        backgroundColor: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: '#131b2e',
            border: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {getHeaderIcon()}
          </div>
          <div>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Proposal Canvas</span>
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 600,
                color: badgeInfo.color,
                backgroundColor: badgeInfo.bg,
                padding: '2px 8px',
                borderRadius: '4px',
                border: `1px solid ${badgeInfo.color}33`
              }}>
                {badgeInfo.label}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
              {proposalTitle || 'AI 動作提案審批工作台'}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
          title="收合審批工作台"
        >
          <X size={18} />
        </button>
      </div>

      {/* 若已核准套用，顯示全幅綠色歷史狀態通知列 */}
      {isApplied && (
        <div style={{
          padding: '9px 18px',
          backgroundColor: '#064e3b',
          borderBottom: '1px solid #059669',
          color: '#a7f3d0',
          fontSize: '0.78rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
        }}>
          <CheckCircle2 size={16} color="#34d399" />
          <span>此提案已於先前核准並成功同步寫入資料庫（唯讀歷程查閱模式）</span>
        </div>
      )}

      {/* 1. 批量提案模式 (Batch Proposal) */}
      {actionType === 'batch_proposal' && (
        <>
          {/* 控制工具列 Toolbar */}
          <div style={{
            padding: '8px 16px',
            backgroundColor: '#090d16',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => onToggleAll(!allApproved)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'transparent',
                  border: 'none',
                  color: '#cbd5e1',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {allApproved ? <CheckSquare size={14} color="#38bdf8" /> : <Square size={14} color="#64748b" />}
                <span>{allApproved ? '取消全選' : '全選所有'}</span>
              </button>

              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>•</span>

              <span style={{ fontSize: '0.75rem', color: '#a5b4fc', fontWeight: 600 }}>
                已選取 {approvedCount} / {items.length} 項
              </span>
            </div>

            <button
              type="button"
              onClick={onAddItem}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#1e293b',
                color: '#93c5fd',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Plus size={12} />
              <span>加一項</span>
            </button>
          </div>

          {/* 項目滾動清單 */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: '#64748b', fontSize: '0.85rem' }}>
                <AlertCircle size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                目前暫無任何提案工單項目
              </div>
            ) : (
              items.map((item, idx) => (
                <ItemCard
                  key={item.id || idx}
                  item={item}
                  index={idx}
                  members={members}
                  existingItems={existingItems}
                  onItemChange={onItemChange}
                  onToggleApprove={onToggleApprove}
                  onDeleteItem={onDeleteItem}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* 2. 單項工單建立模式 (Create Item) */}
      {actionType === 'create_item' && items.length > 0 && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{
            backgroundColor: '#0f172a',
            border: '1px solid #38bdf8',
            borderRadius: '10px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PlusCircle size={16} color="#38bdf8" />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
                即將在專案中建立單一工單
              </span>
            </div>

            <ItemCard
              item={items[0]}
              index={0}
              members={members}
              existingItems={existingItems}
              onItemChange={onItemChange}
              onToggleApprove={onToggleApprove}
              onDeleteItem={() => {}}
              hideDelete
            />

            {items[0].parentItemUid && (
              <div style={{ fontSize: '0.75rem', color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#0c1a30', padding: '6px 10px', borderRadius: '6px' }}>
                <Tag size={13} />
                <span>將自動掛載於父工單：<strong>{resolveItemDisplay(items[0].parentItemUid, existingItems)}</strong></span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. 單項更新 / 作廢模式 (Update Diff Studio) */}
      {actionType === 'update_item' && updateDiff && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{
            backgroundColor: '#0f172a',
            border: '1px solid #eab308',
            borderRadius: '10px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={16} color="#facc15" />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>
                  目標工單：[{updateDiff.targetDisplayCode || resolveItemDisplay(updateDiff.targetItemUid, existingItems) || '指定工單'}]
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                {updateDiff.itemTitle || ''}
              </span>
            </div>

            {/* 屬性變更對照表 (Diff View) */}
            <div style={{
              backgroundColor: '#090d16',
              borderRadius: '8px',
              border: '1px solid #1e293b',
              overflow: 'hidden'
            }}>
              <div style={{ padding: '8px 12px', backgroundColor: '#131b2e', fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', borderBottom: '1px solid #1e293b' }}>
                變更前後對照 (Diff Comparison)
              </div>

              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
                {/* 狀態變更 (Status Diff) */}
                {updateDiff.updates.item_status && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed #1e293b' }}>
                    <span style={{ color: '#94a3b8', fontWeight: 500 }}>工單狀態 (Status)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#64748b', textDecoration: 'line-through' }}>
                        {updateDiff.currentValues?.item_status || '目前狀態'}
                      </span>
                      <ArrowRight size={13} color="#facc15" />
                      <span style={{
                        fontWeight: 700,
                        color: updateDiff.updates.item_status === 'Closed' ? '#f87171' : '#4ade80',
                        backgroundColor: updateDiff.updates.item_status === 'Closed' ? '#450a0a' : '#052e16',
                        padding: '2px 8px',
                        borderRadius: '4px'
                      }}>
                        {updateDiff.updates.item_status} {updateDiff.updates.item_status === 'Closed' ? '(已作廢)' : ''}
                      </span>
                    </div>
                  </div>
                )}

                {/* 指派人變更 (Assignee Diff) */}
                {updateDiff.updates.item_follow_by !== undefined && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed #1e293b' }}>
                    <span style={{ color: '#94a3b8', fontWeight: 500 }}>負責人 (Assignee)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#64748b' }}>
                        {resolveMemberDisplay(updateDiff.currentValues?.follow_by_name || updateDiff.currentValues?.item_follow_by, members)}
                      </span>
                      <ArrowRight size={13} color="#facc15" />
                      <span style={{ fontWeight: 700, color: '#38bdf8' }}>
                        {resolveMemberDisplay(updateDiff.updates.item_follow_by, members)}
                      </span>
                    </div>
                  </div>
                )}

                {/* 父工單變更 (Parent Diff) */}
                {updateDiff.updates.parent_item_uid !== undefined && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed #1e293b' }}>
                    <span style={{ color: '#94a3b8', fontWeight: 500 }}>父工單 (Parent)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#64748b' }}>
                        {resolveItemDisplay(updateDiff.currentValues?.parent_display_code, existingItems) || '無父工單'}
                      </span>
                      <ArrowRight size={13} color="#facc15" />
                      <span style={{ fontWeight: 700, color: '#93c5fd' }}>
                        {resolveItemDisplay(updateDiff.updates.parent_item_uid, existingItems) || '無父工單'}
                      </span>
                    </div>
                  </div>
                )}

                {/* 優先級變更 (Priority Diff) */}
                {updateDiff.updates.item_priority && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed #1e293b' }}>
                    <span style={{ color: '#94a3b8', fontWeight: 500 }}>優先級 (Priority)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#64748b' }}>{updateDiff.currentValues?.item_priority || 'Middle'}</span>
                      <ArrowRight size={13} color="#facc15" />
                      <span style={{ fontWeight: 700, color: '#fde047' }}>{updateDiff.updates.item_priority}</span>
                    </div>
                  </div>
                )}

                {/* 標題變更 (Title Diff) */}
                {updateDiff.updates.item_title && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '8px', borderBottom: '1px dashed #1e293b' }}>
                    <span style={{ color: '#94a3b8', fontWeight: 500 }}>標題更新</span>
                    <span style={{ color: '#f8fafc', fontWeight: 600 }}>{updateDiff.updates.item_title}</span>
                  </div>
                )}
              </div>
            </div>

            {updateDiff.summary && (
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.5, backgroundColor: '#131b2e', padding: '8px 10px', borderRadius: '6px' }}>
                💬 <strong>變更理由</strong>：{updateDiff.summary}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. 決策共識沉澱模式 (Consensus & Decision) */}
      {actionType === 'consensus_proposal' && consensusData && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{
            backgroundColor: '#1c1305',
            border: '1px solid #f59e0b',
            borderRadius: '10px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookmarkCheck size={18} color="#fbbf24" />
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fde047' }}>
                {consensusData.title || '架構決策共識定案'}
              </span>
            </div>

            <div style={{ fontSize: '0.82rem', color: '#f8fafc', lineHeight: 1.6, backgroundColor: '#090d16', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>📌 決策陳述 (Statement)：</div>
              {consensusData.statement}
            </div>

            {consensusData.rationale && (
              <div style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.5, backgroundColor: '#090d16', padding: '10px 12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <div style={{ fontWeight: 600, color: '#94a3b8', marginBottom: '2px' }}>💡 權衡考量 (Rationale)：</div>
                {consensusData.rationale}
              </div>
            )}

            <div style={{ fontSize: '0.72rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={13} />
              <span>將自動生成 <strong>💡 Decision (Completed)</strong> 工單並同步寫入 Google OKF 概念圖譜。</span>
            </div>
          </div>
        </div>
      )}

      {/* 底部動作列 */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #1e293b',
        backgroundColor: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px'
      }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '7px 14px',
            backgroundColor: '#1e293b',
            color: '#94a3b8',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          {isApplied ? '關閉工作台' : '放棄提案 / 收合'}
        </button>

        {isApplied ? (
          <button
            type="button"
            disabled={true}
            style={{
              flex: 1,
              padding: '8px 14px',
              backgroundColor: '#064e3b',
              color: '#a7f3d0',
              border: '1px solid #059669',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              opacity: 0.95
            }}
          >
            <CheckCircle2 size={15} color="#34d399" />
            <span>✓ 已完成核准與套用 (歷史記錄)</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleApply}
            disabled={isSubmitting || (actionType === 'batch_proposal' && approvedCount === 0)}
            style={{
              flex: 1,
              padding: '8px 14px',
              backgroundColor: isSubmitting ? '#334155' : (actionType === 'consensus_proposal' ? '#d97706' : '#16a34a'),
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 0 12px rgba(22, 163, 74, 0.3)',
              transition: 'all 0.15s ease'
            }}
          >
            <CheckCircle2 size={15} />
            <span>
              {isSubmitting
                ? '正在原子寫入 Neon DB...'
                : actionType === 'batch_proposal'
                  ? `核准並套用已選工單 (${approvedCount} 項)`
                  : actionType === 'create_item'
                    ? '核准並建立新工單'
                    : actionType === 'update_item'
                      ? '核准並更新工單'
                      : '📌 核准並沉澱入專案知識庫'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

interface ItemCardProps {
  item: ProposedItem;
  index: number;
  members: Member[];
  existingItems?: ProjectItem[];
  onItemChange: (index: number, updatedItem: ProposedItem) => void;
  onToggleApprove: (index: number) => void;
  onDeleteItem: (index: number) => void;
  hideDelete?: boolean;
}

const ItemCard: React.FC<ItemCardProps> = ({
  item,
  index,
  members,
  existingItems = [],
  onItemChange,
  onToggleApprove,
  onDeleteItem,
  hideDelete
}) => {
  return (
    <div
      style={{
        backgroundColor: item.approved ? '#0f172a' : '#090d16',
        border: item.approved ? '1px solid #334155' : '1px dashed #1e293b',
        borderRadius: '8px',
        padding: '10px 12px',
        opacity: item.approved ? 1 : 0.6,
        transition: 'all 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}
    >
      {/* 第一行: 勾選 + 類型 + 標題 + 刪除 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          onClick={() => onToggleApprove(index)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: item.approved ? '#38bdf8' : '#64748b' }}
        >
          {item.approved ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>

        {/* 16 種合法工單類型選擇器 */}
        <select
          value={item.itemType}
          onChange={(e) => onItemChange(index, { ...item, itemType: e.target.value })}
          style={{
            backgroundColor: getTypeBg(item.itemType),
            color: getTypeColor(item.itemType),
            border: 'none',
            borderRadius: '4px',
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '2px 6px',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="Objective">🎯 Objective (目標)</option>
          <option value="Requirement">📋 Requirement (需求)</option>
          <option value="User story">📖 User story (故事)</option>
          <option value="Task">⚡ Task (任務)</option>
          <option value="UAT">🧪 UAT (驗收測試)</option>
          <option value="Bug">🐞 Bug (缺陷)</option>
          <option value="Decision">💡 Decision (決策)</option>
          <option value="Information">ℹ️ Information (資訊)</option>
          <option value="Bottleneck">⚠️ Bottleneck (瓶頸)</option>
          <option value="Charter">📜 Charter (章程)</option>
          <option value="Epic">🏛️ Epic (史詩)</option>
          <option value="Micro Task">🔹 Micro Task (子項)</option>
          <option value="Event">📅 Event (事件)</option>
          <option value="Meeting">👥 Meeting (會議)</option>
          <option value="Deployment">🚀 Deployment (部署)</option>
          <option value="Milestone">🚩 Milestone (里程碑)</option>
        </select>

        {/* 標題輸入框 */}
        <input
          type="text"
          value={item.itemTitle}
          onChange={(e) => onItemChange(index, { ...item, itemTitle: e.target.value })}
          placeholder="工單標題..."
          style={{
            flex: 1,
            backgroundColor: '#131b2e',
            border: '1px solid #334155',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '0.8rem',
            color: '#f8fafc',
            fontWeight: 500,
            outline: 'none'
          }}
        />

        {!hideDelete && (
          <button
            type="button"
            onClick={() => onDeleteItem(index)}
            style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
            title="移除此項"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* 第二行: 優先級 + 指派成員 + 父工單代碼 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '24px' }}>
        {/* 優先級 */}
        <select
          value={item.itemPriority}
          onChange={(e) => onItemChange(index, { ...item, itemPriority: e.target.value })}
          style={{
            backgroundColor: '#131b2e',
            color: item.itemPriority === 'High' ? '#f87171' : (item.itemPriority === 'Middle' ? '#fbbf24' : '#94a3b8'),
            border: '1px solid #334155',
            borderRadius: '4px',
            fontSize: '0.72rem',
            padding: '2px 6px',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="High">🔴 高優先級 (High)</option>
          <option value="Middle">🟡 中優先級 (Middle)</option>
          <option value="Low">🟢 低優先級 (Low)</option>
        </select>

        {/* 指派成員 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
          <User size={12} color="#94a3b8" />
          <select
            value={
              members.find(m => m.member_uid === item.itemFollowBy || m.member_name === item.itemFollowBy)?.member_name ||
              item.itemFollowBy || ''
            }
            onChange={(e) => onItemChange(index, { ...item, itemFollowBy: e.target.value || undefined })}
            style={{
              flex: 1,
              backgroundColor: '#131b2e',
              color: '#cbd5e1',
              border: '1px solid #334155',
              borderRadius: '4px',
              fontSize: '0.72rem',
              padding: '2px 6px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">未指派負責人</option>
            {members.map(m => (
              <option key={m.member_uid} value={m.member_name}>
                {m.member_name} ({m.member_email || '成員'})
              </option>
            ))}
          </select>
        </div>

        {/* 父工單標籤 */}
        {item.parentItemUid && (
          <span style={{ fontSize: '0.7rem', color: '#93c5fd', backgroundColor: '#1e293b', padding: '2px 6px', borderRadius: '4px' }}>
            父級: {resolveItemDisplay(item.parentItemUid, existingItems) || item.parentItemUid}
          </span>
        )}
      </div>

      {/* 可選說明或背景備註 */}
      {item.description && (
        <div style={{
          fontSize: '0.72rem',
          color: '#94a3b8',
          paddingLeft: '24px',
          lineHeight: 1.4,
          fontStyle: 'italic'
        }}>
          💬 {item.description}
        </div>
      )}
    </div>
  );
};

function getTypeBg(type?: string) {
  switch (type) {
    case 'Objective': return '#1e1b4b';
    case 'Requirement': return '#3b0764';
    case 'User story': return '#1e293b';
    case 'UAT': return '#064e3b';
    case 'Bug': return '#4c0519';
    case 'Decision': return '#451a03';
    case 'Bottleneck': return '#451a03';
    case 'Information': return '#082f49';
    default: return '#0f172a';
  }
}

function getTypeColor(type?: string) {
  switch (type) {
    case 'Objective': return '#a5b4fc';
    case 'Requirement': return '#d8b4fe';
    case 'User story': return '#93c5fd';
    case 'UAT': return '#6ee7b7';
    case 'Bug': return '#fda4af';
    case 'Decision': return '#fcd34d';
    case 'Bottleneck': return '#fca5a5';
    case 'Information': return '#38bdf8';
    default: return '#cbd5e1';
  }
}
