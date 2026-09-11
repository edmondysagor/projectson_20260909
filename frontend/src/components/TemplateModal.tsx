import React, { useState } from 'react';
import { GripVertical, Plus, FileText, X } from 'lucide-react';
import type { Template, TemplateNode } from '../utils/api';
import { NovelEditor } from './NovelEditor';

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (templateName: string, schema: TemplateNode[]) => Promise<void>;
  initialTemplate?: Template | null;
}

const ITEM_TYPES = [
  { value: 'Milestone', label: 'Milestone', icon: '🏆', color: '#10b981' },
  { value: 'Task', label: 'Task', icon: '📝', color: '#3b82f6' },
  { value: 'Objective', label: 'Objective', icon: '🎯', color: '#ec4899' },
  { value: 'Requirement', label: 'Requirement', icon: '📋', color: '#f59e0b' },
  { value: 'User story', label: 'User story', icon: '👤', color: '#8b5cf6' },
  { value: 'UAT', label: 'UAT', icon: '🧪', color: '#06b6d4' },
  { value: 'Deployment', label: 'Deployment', icon: '🚀', color: '#ef4444' },
  { value: 'Charter', label: 'Charter', icon: '📌', color: '#6366f1' },
  { value: 'Meeting', label: 'Meeting', icon: '📅', color: '#14b8a6' },
  { value: 'Bottleneck', label: 'Bottleneck', icon: '⚠️', color: '#f97316' },
  { value: 'Decision', label: 'Decision', icon: '💡', color: '#eab308' },
  { value: 'Information', label: 'Information', icon: 'ℹ️', color: '#0284c7' },
];

export const TemplateModal: React.FC<TemplateModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTemplate
}) => {
  const [templateName, setTemplateName] = useState('');
  const [nodes, setNodes] = useState<TemplateNode[]>([]);
  const [expandedContentIds, setExpandedContentIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // 初始化資料
  React.useEffect(() => {
    if (isOpen) {
      if (initialTemplate) {
        setTemplateName(initialTemplate.template_name || '');
        let schema = initialTemplate.template_schema || [];
        if (typeof schema === 'string') {
          try {
            schema = JSON.parse(schema);
          } catch (e) {
            schema = [];
          }
        }
        setNodes(JSON.parse(JSON.stringify(schema)));
      } else {
        setTemplateName('');
        setNodes([
          {
            id: `temp-${Date.now()}-1`,
            item_type: 'Milestone',
            item_title: 'M1',
            item_content: { description: '' },
            children: [
              {
                id: `temp-${Date.now()}-2`,
                item_type: 'Task',
                item_title: 'New Task',
                item_content: { description: '' },
                children: []
              }
            ]
          }
        ]);
      }
      setExpandedContentIds(new Set());
    }
  }, [isOpen, initialTemplate]);

  if (!isOpen) return null;

  const generateId = () => `node-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

  // 遞迴輔助：在樹中更新節點
  const updateTreeNodes = (
    tree: TemplateNode[],
    targetId: string,
    updater: (node: TemplateNode) => TemplateNode | null
  ): TemplateNode[] => {
    const result: TemplateNode[] = [];
    for (const node of tree) {
      if (node.id === targetId) {
        const updated = updater(node);
        if (updated !== null) {
          result.push(updated);
        }
      } else {
        const updatedChildren = node.children ? updateTreeNodes(node.children, targetId, updater) : [];
        result.push({
          ...node,
          children: updatedChildren
        });
      }
    }
    return result;
  };

  // 遞迴輔助：為指定節點新增子節點
  const addChildToNode = (tree: TemplateNode[], parentId: string, newChild: TemplateNode): TemplateNode[] => {
    return tree.map(node => {
      if (node.id === parentId) {
        return {
          ...node,
          children: [...(node.children || []), newChild]
        };
      }
      if (node.children && node.children.length > 0) {
        return {
          ...node,
          children: addChildToNode(node.children, parentId, newChild)
        };
      }
      return node;
    });
  };

  // 新增 Root 節點
  const handleAddRootNode = () => {
    const newNode: TemplateNode = {
      id: generateId(),
      item_type: 'Milestone',
      item_title: `New Item`,
      item_content: { description: '' },
      children: []
    };
    setNodes([...nodes, newNode]);
  };

  // 新增子節點
  const handleAddChild = (parentId: string) => {
    const newChild: TemplateNode = {
      id: generateId(),
      item_type: 'Task',
      item_title: `New Subtask`,
      item_content: { description: '' },
      children: []
    };
    setNodes(addChildToNode(nodes, parentId, newChild));
  };

  // 更新節點標題
  const handleUpdateTitle = (id: string, newTitle: string) => {
    setNodes(updateTreeNodes(nodes, id, node => ({ ...node, item_title: newTitle })));
  };

  // 更新節點類型
  const handleUpdateType = (id: string, newType: string) => {
    setNodes(updateTreeNodes(nodes, id, node => ({ ...node, item_type: newType })));
  };

  // 更新節點內容
  const handleUpdateContent = (id: string, description: string) => {
    setNodes(updateTreeNodes(nodes, id, node => ({
      ...node,
      item_content: { ...node.item_content, description, text: description }
    })));
  };

  // 刪除節點
  const handleDeleteNode = (id: string) => {
    setNodes(updateTreeNodes(nodes, id, () => null));
    const nextSet = new Set(expandedContentIds);
    nextSet.delete(id);
    setExpandedContentIds(nextSet);
  };

  // 切換內容編輯器展開/收合
  const toggleContent = (id: string) => {
    const nextSet = new Set(expandedContentIds);
    if (nextSet.has(id)) {
      nextSet.delete(id);
    } else {
      nextSet.add(id);
    }
    setExpandedContentIds(nextSet);
  };

  // 儲存範本
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) {
      alert('請輸入範本名稱');
      return;
    }
    if (nodes.length === 0) {
      alert('請至少建立一個項目');
      return;
    }

    setSaving(true);
    // 等待 150ms 確保所有防抖輸入皆已完成寫入 state
    await new Promise(resolve => setTimeout(resolve, 150));

    try {
      await onSave(templateName.trim(), nodes);
      onClose();
    } catch (err: any) {
      alert('儲存範本失敗: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // 遞迴渲染節點樹
  const renderNode = (node: TemplateNode, depth: number = 0) => {
    const isExpanded = expandedContentIds.has(node.id);

    return (
      <div
        key={node.id}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginLeft: depth > 0 ? '24px' : '0px',
          borderLeft: depth > 0 ? '2px solid #2a3854' : 'none',
          paddingLeft: depth > 0 ? '14px' : '0px',
          marginTop: '10px'
        }}
      >
        {/* 單行項目控制條 (對齊 圖2) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: '#131b2e',
          border: '1px solid #1e293b',
          borderRadius: '8px',
          padding: '8px 12px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
        }}>
          {/* 拖曳握柄圖示 */}
          <GripVertical size={16} color="#64748b" style={{ cursor: 'grab', flexShrink: 0 }} />

          {/* 項目類型下拉選單 */}
          <div style={{ position: 'relative', minWidth: '150px' }}>
            <select
              value={node.item_type}
              onChange={(e) => handleUpdateType(node.id, e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#090d16',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '0.85rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {ITEM_TYPES.map(t => (
                <option key={t.value} value={t.value} style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                  {t.icon} {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* 項目標題輸入框 */}
          <input
            type="text"
            value={node.item_title}
            onChange={(e) => handleUpdateTitle(node.id, e.target.value)}
            placeholder="項目名稱..."
            style={{
              flex: 1,
              backgroundColor: '#090d16',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '0.9rem',
              outline: 'none'
            }}
          />

          {/* 🖼️ 內容按鈕 (展開 BlockNote 編輯器) */}
          <button
            type="button"
            onClick={() => toggleContent(node.id)}
            style={{
              padding: '6px 12px',
              backgroundColor: isExpanded ? '#0891b2' : '#0e7490',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(6, 182, 212, 0.3)'
            }}
          >
            <FileText size={14} />
            內容
          </button>

          {/* + 子項目按鈕 */}
          <button
            type="button"
            onClick={() => handleAddChild(node.id)}
            style={{
              padding: '6px 12px',
              backgroundColor: '#4338ca',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 4px rgba(67, 56, 202, 0.3)'
            }}
          >
            + 子項目
          </button>

          {/* 刪除按鈕 */}
          <button
            type="button"
            onClick={() => handleDeleteNode(node.id)}
            style={{
              padding: '6px 12px',
              backgroundColor: '#b91c1c',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(185, 28, 28, 0.3)'
            }}
          >
            刪除
          </button>
        </div>

        {/* 展開之 內容編輯器 (對齊 圖2 BlockNote 編輯器) */}
        {isExpanded && (
          <div style={{
            backgroundColor: '#090d16',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            padding: '12px',
            marginTop: '4px',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
          }}>
            <NovelEditor
              value={node.item_content?.text || node.item_content?.description || (typeof node.item_content === 'string' ? node.item_content : '')}
              onChange={(val) => handleUpdateContent(node.id, val)}
              placeholder="輸入此項目的詳細說明、表格、清單或代碼區塊..."
              minHeight="140px"
              showActions={false}
            />
          </div>
        )}

        {/* 遞迴渲染子節點 */}
        {node.children && node.children.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(3, 7, 18, 0.8)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '24px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '850px',
        maxHeight: '90vh',
        backgroundColor: '#0b1120',
        border: '1px solid #1e293b',
        borderRadius: '14px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden'
      }}>
        {/* Modal 頂部標題列 (對齊 圖2: 新增項目範本 / 編輯項目範本) */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#0f172a'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
            {initialTemplate ? '編輯項目範本' : '新增項目範本'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal 中間滾動表單 */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            {/* 欄位 1: 範本名稱 (對齊 圖2) */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#94a3b8',
                marginBottom: '8px'
              }}>
                範本名稱
              </label>
              <input
                type="text"
                required
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="例如: Trial template / 標準敏捷開發流程"
                style={{
                  width: '100%',
                  backgroundColor: '#090d16',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* 欄位 2: 範本結構 (對齊 圖2) */}
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px'
              }}>
                <label style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#94a3b8'
                }}>
                  範本結構
                </label>

                <button
                  type="button"
                  onClick={handleAddRootNode}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: '#1e293b',
                    color: '#60a5fa',
                    border: '1px solid #2563eb',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Plus size={14} />
                  + 同層項目 (Root)
                </button>
              </div>

              {/* 樹狀結構節點清單 */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                minHeight: '120px'
              }}>
                {nodes.length === 0 ? (
                  <div style={{
                    padding: '30px',
                    textAlign: 'center',
                    color: '#64748b',
                    backgroundColor: '#090d16',
                    borderRadius: '8px',
                    border: '1px dashed #1e293b'
                  }}>
                    尚未建立項目，請點擊上方「+ 同層項目 (Root)」新增
                  </div>
                ) : (
                  nodes.map(node => renderNode(node, 0))
                )}
              </div>
            </div>
          </div>

          {/* 底部操作按鈕列 (對齊 圖2: 取消 | 儲存範本) */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid #1e293b',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            backgroundColor: '#0f172a'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 20px',
                backgroundColor: '#1e293b',
                color: '#cbd5e1',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              取消
            </button>

            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '8px 24px',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 10px rgba(59, 130, 246, 0.4)',
                opacity: saving ? 0.7 : 1
              }}
            >
              {saving ? '儲存中...' : '儲存範本'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
