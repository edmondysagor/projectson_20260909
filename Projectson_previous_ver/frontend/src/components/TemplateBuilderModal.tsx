import React, { useState, useEffect } from 'react';
import { ThemedSelect } from './CanvasPane';
import * as api from '../utils/api';
import { uploadFile } from '../utils/api';

import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteSchema, createCodeBlockSpec, defaultBlockSpecs } from "@blocknote/core";
import { codeBlockOptions } from "@blocknote/code-block";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { EditorToolbar } from "./EditorToolbar";

interface TemplateNode {
  id: string; // temporary id for UI mapping
  item_title: string;
  item_type: string;
  item_status: string;
  item_priority: string;
  item_content?: any;
  children: TemplateNode[];
}

const customSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    codeBlock: createCodeBlockSpec(codeBlockOptions),
  },
});

const TemplateNodeItem: React.FC<{
  node: TemplateNode;
  level: number;
  onUpdate: (id: string, updates: Partial<TemplateNode>) => void;
  onAddChild: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (draggedId: string, targetId: string) => void;
}> = ({ node, level, onUpdate, onAddChild, onRemove, onMove }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const editor = useCreateBlockNote({
    uploadFile: uploadFile,
    schema: customSchema,
    initialContent: (() => {
      let content = node.item_content;
      if (typeof content === 'string') {
        try { content = JSON.parse(content); } catch (e) {}
      }
      if (content && typeof content === 'object' && !Array.isArray(content) && content.description) {
        content = content.description;
      }
      return Array.isArray(content) && content.length > 0 ? (content as any) : undefined;
    })()
  });

  // If node.item_content was a string (e.g. from previous version), load it
  useEffect(() => {
    if (typeof node.item_content === 'string' && node.item_content.trim() !== '') {
      const run = async () => {
        const blocks = await editor.tryParseMarkdownToBlocks(node.item_content);
        editor.replaceBlocks(editor.document, blocks);
      };
      run();
    }
  }, []);

  return (
    <div style={{ marginLeft: `${level * 20}px`, marginBottom: '10px', borderLeft: level > 0 ? '2px solid var(--border-color)' : 'none', paddingLeft: level > 0 ? '10px' : '0' }}>
      <div 
        style={{ 
          display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '4px',
          borderTop: isDragOver ? '2px solid var(--accent-primary)' : '1px solid transparent',
          marginTop: isDragOver ? '-1px' : '0',
          opacity: isDragging ? 0.4 : 1,
          transition: 'all 0.2s ease'
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
          const draggedId = e.dataTransfer.getData('text/plain');
          if (draggedId && draggedId !== node.id) {
             onMove(draggedId, node.id);
          }
        }}
      >
        <div 
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', node.id);
            e.stopPropagation();
            setTimeout(() => setIsDragging(true), 0);
          }}
          onDragEnd={() => setIsDragging(false)}
          style={{ cursor: 'grab', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
          title="Drag to move"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5 4a1 1 0 110-2 1 1 0 010 2zm0 5a1 1 0 110-2 1 1 0 010 2zm0 5a1 1 0 110-2 1 1 0 010 2zm6-10a1 1 0 110-2 1 1 0 010 2zm0 5a1 1 0 110-2 1 1 0 010 2zm0 5a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </div>
        <ThemedSelect 
          value={node.item_type} 
          onChange={(e: any) => onUpdate(node.id, { item_type: e.target.value })}
          style={{ padding: '4px', background: '#1E293B', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px' }}
        >
          {['Charter', 'Epic', 'Task', 'Event', 'Micro Task', 'Meeting', 'Bottleneck', 'Knowledge', 'Casual Note', 'Bug', 'UAT', 'Deployment', 'Milestone', 'Business Objective', 'Business Requirement', 'User Story'].map(t => <option key={t} value={t}>{t}</option>)}
        </ThemedSelect>
        <input 
          value={node.item_title} 
          onChange={(e: any) => onUpdate(node.id, { item_title: e.target.value })}
          placeholder="項目標題"
          style={{ flex: 1, padding: '4px', background: '#1E293B', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px' }}
        />
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ background: isExpanded ? 'var(--accent-secondary)' : 'transparent', color: isExpanded ? 'white' : 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
        >📝 內容</button>
        <button 
          onClick={() => onAddChild(node.id)}
          style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
        >+ 子項目</button>
        <button 
          onClick={() => onRemove(node.id)}
          style={{ background: '#EF4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
        >刪除</button>
      </div>
      {isExpanded && (
        <div style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', borderBottomLeftRadius: '4px', borderBottomRightRadius: '4px', marginTop: '-4px' }}>
          <div style={{ background: '#1E293B', borderRadius: '4px', border: '1px solid var(--border-color)', minHeight: '150px' }}>
            <EditorToolbar editor={editor} />
            <BlockNoteView 
              editor={editor} 
              theme="dark" 
              onChange={() => {
                let content = node.item_content || {};
                if (typeof content === 'string') {
                  try { content = JSON.parse(content); } catch (e) { content = {}; }
                }
                if (Array.isArray(content)) {
                  content = {}; // If it was an array, reset it to an object
                }
                onUpdate(node.id, { item_content: { ...content, description: editor.document } });
              }}
            />
          </div>
        </div>
      )}
      <div style={{ marginTop: '5px' }}>
        {node.children.map(child => (
          <TemplateNodeItem 
            key={child.id} 
            node={child} 
            level={level + 1} 
            onUpdate={onUpdate} 
            onAddChild={onAddChild} 
            onRemove={onRemove} 
            onMove={onMove}
          />
        ))}
      </div>
    </div>
  );
};

interface TemplateBuilderModalProps {
  workspaceId: number;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  initialTemplate?: any;
}

export const TemplateBuilderModal: React.FC<TemplateBuilderModalProps> = ({ workspaceId, isOpen, onClose, onSave, initialTemplate }) => {
  const [templateName, setTemplateName] = useState('');
  const [rootNodes, setRootNodes] = useState<TemplateNode[]>([{
    id: Date.now().toString(),
    item_title: 'New Epic',
    item_type: 'Epic',
    item_status: 'Not Start',
    item_priority: 'Middle',
    item_content: [],
    children: []
  }]);

  useEffect(() => {
    if (isOpen) {
      if (initialTemplate) {
        setTemplateName(initialTemplate.template_name || '');
        const schema = initialTemplate.template_schema;
        setRootNodes(Array.isArray(schema) ? schema : [schema]);
      } else {
        setTemplateName('');
        setRootNodes([{
          id: Date.now().toString(),
          item_title: 'New Epic',
          item_type: 'Epic',
          item_status: 'Not Start',
          item_priority: 'Middle',
          item_content: [],
          children: []
        }]);
      }
    }
  }, [isOpen, initialTemplate]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!templateName.trim()) {
      alert('請輸入範本名稱');
      return;
    }

    try {
      const templateData = {
        workspace_id: workspaceId,
        template_name: templateName,
        target_type: 'ProjectItem',
        template_schema: rootNodes
      };
      
      if (initialTemplate) {
        await api.updateTemplate(initialTemplate.id, templateData);
      } else {
        await api.createTemplate(templateData);
      }
      onSave();
      onClose();
    } catch (err) {
      alert('儲存失敗');
    }
  };

  const updateNode = (node: TemplateNode, targetId: string, updates: Partial<TemplateNode>): TemplateNode => {
    if (node.id === targetId) {
      return { ...node, ...updates };
    }
    return {
      ...node,
      children: node.children.map(child => updateNode(child, targetId, updates))
    };
  };

  const addChildNode = (node: TemplateNode, targetId: string): TemplateNode => {
    if (node.id === targetId) {
      return {
        ...node,
        children: [...node.children, {
          id: Date.now().toString() + Math.random().toString(),
          item_title: 'New Task',
          item_type: 'Task',
          item_status: 'Not Start',
          item_priority: 'Middle',
          item_content: [],
          children: []
        }]
      };
    }
    return {
      ...node,
      children: node.children.map(child => addChildNode(child, targetId))
    };
  };

  const removeNode = (node: TemplateNode, targetId: string): TemplateNode | null => {
    if (node.id === targetId) return null;
    return {
      ...node,
      children: node.children.map(c => removeNode(c, targetId)).filter((c): c is TemplateNode => c !== null)
    };
  };

  const handleUpdate = (targetId: string, updates: Partial<TemplateNode>) => {
    setRootNodes(nodes => nodes.map(n => updateNode(n, targetId, updates)));
  };

  const handleAddChild = (targetId: string) => {
    setRootNodes(nodes => nodes.map(n => addChildNode(n, targetId)));
  };

  const handleRemove = (targetId: string) => {
    setRootNodes(nodes => nodes.map(n => removeNode(n, targetId)).filter((n): n is TemplateNode => n !== null));
  };

  const handleMove = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const newNodes = JSON.parse(JSON.stringify(rootNodes));
    let draggedNode: TemplateNode | null = null;

    const removeNode = (nodes: TemplateNode[]): boolean => {
      const idx = nodes.findIndex(n => n.id === draggedId);
      if (idx !== -1) {
        draggedNode = nodes.splice(idx, 1)[0];
        return true;
      }
      for (const node of nodes) {
        if (removeNode(node.children)) return true;
      }
      return false;
    };
    removeNode(newNodes);

    if (!draggedNode) return;

    const insertNode = (nodes: TemplateNode[]): boolean => {
      const idx = nodes.findIndex(n => n.id === targetId);
      if (idx !== -1) {
        nodes.splice(idx, 0, draggedNode!);
        return true;
      }
      for (const node of nodes) {
        if (insertNode(node.children)) return true;
      }
      return false;
    };
    if (!insertNode(newNodes)) {
        newNodes.push(draggedNode);
    }
    setRootNodes(newNodes);
  };

  const handleAddRoot = () => {
    setRootNodes(nodes => [...nodes, {
      id: Date.now().toString() + Math.random().toString(),
      item_title: 'New Epic',
      item_type: 'Epic',
      item_status: 'Not Start',
      item_priority: 'Middle',
      item_content: [],
      children: []
    }]);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#0F172A', padding: '20px', borderRadius: '8px', width: '800px', maxHeight: '80vh', overflowY: 'auto', border: '1px solid var(--border-color)' }}>
        <h2 style={{ color: 'white', margin: '0 0 20px 0' }}>新增項目範本</h2>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>範本名稱</label>
          <input 
            value={templateName}
            onChange={(e: any) => setTemplateName(e.target.value)}
            placeholder="例如：新功能開發 (包含前後端任務)"
            style={{ width: '100%', padding: '8px', background: '#1E293B', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <label style={{ color: 'var(--text-secondary)' }}>範本結構</label>
            <button 
              onClick={handleAddRoot}
              style={{ background: 'transparent', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
            >+ 同層項目 (Root)</button>
          </div>
          {rootNodes.map(node => (
            <TemplateNodeItem 
              key={node.id} 
              node={node} 
              level={0} 
              onUpdate={handleUpdate} 
              onAddChild={handleAddChild} 
              onRemove={handleRemove} 
              onMove={handleMove}
            />
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button 
            onClick={onClose}
            style={{ background: 'transparent', color: 'white', border: '1px solid var(--border-color)', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
          >取消</button>
          <button 
            onClick={handleSave}
            style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
          >儲存範本</button>
        </div>
      </div>
    </div>
  );
};
