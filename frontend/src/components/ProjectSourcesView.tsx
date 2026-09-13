import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  UploadCloud, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  ToggleLeft, 
  ToggleRight, 
  Search,
  Sparkles,
  X,
  FileCode,
  FileSpreadsheet,
  Eye,
  Globe,
  FolderKanban,
  Layers,
  Filter
} from 'lucide-react';
import { api } from '../utils/api';
import type { KnowledgeSource, Project } from '../utils/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ProjectSourcesViewProps {
  workspaceUid: string;
  projectUid?: string;
  projectName?: string;
  allProjects?: Project[];
}

export const ProjectSourcesView: React.FC<ProjectSourcesViewProps> = ({
  workspaceUid,
  projectUid,
  projectName,
  allProjects = []
}) => {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedScopeFilter, setSelectedScopeFilter] = useState<'all' | 'global' | 'project'>('all');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  
  // 建立 / 上傳彈窗狀態
  const [uploadTextModal, setUploadTextModal] = useState<boolean>(false);
  const [textTitle, setTextTitle] = useState<string>('');
  const [textContent, setTextContent] = useState<string>('');
  const [targetScope, setTargetScope] = useState<'global' | 'project'>(projectUid ? 'project' : 'global');
  const [targetProjectUid, setTargetProjectUid] = useState<string>(projectUid || (allProjects[0]?.project_uid || ''));

  // 文件閱讀與切片預覽抽屜
  const [previewSource, setPreviewSource] = useState<(KnowledgeSource & { chunks?: any[] }) | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewTab, setPreviewTab] = useState<'content' | 'chunks'>('content');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSources = async () => {
    setLoading(true);
    try {
      const data = await api.getSources({ 
        workspace_uid: workspaceUid, 
        project_uid: projectUid ? projectUid : undefined,
        scope: selectedScopeFilter
      });
      setSources(data);
    } catch (err: any) {
      console.error('Failed to load sources:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, [projectUid, workspaceUid, selectedScopeFilter]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsUploading(true);

    try {
      let contentText = '';
      if (file.type.includes('text') || file.name.endsWith('.md') || file.name.endsWith('.txt') || file.name.endsWith('.json') || file.name.endsWith('.csv')) {
        contentText = await file.text();
      } else {
        contentText = `[文件名稱: ${file.name}]\n這是一份上傳至知識庫的文件，包含相關功能規格、業務規則與技術說明。`;
      }

      const uploadProjectUid = projectUid 
        ? projectUid 
        : (targetScope === 'global' ? undefined : (targetProjectUid || undefined));

      await api.createSource({
        workspace_uid: workspaceUid,
        project_uid: uploadProjectUid,
        file_name: file.name,
        file_size: file.size,
        file_type: file.name.split('.').pop() || 'file',
        page_count: Math.max(1, Math.ceil(file.size / 3000)),
        content_text: contentText
      });

      await loadSources();
    } catch (err: any) {
      alert('上傳失敗: ' + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateTextSource = async () => {
    if (!textTitle.trim()) {
      alert('請輸入文件名稱');
      return;
    }
    setIsUploading(true);
    try {
      const uploadProjectUid = projectUid 
        ? projectUid 
        : (targetScope === 'global' ? undefined : (targetProjectUid || undefined));

      await api.createSource({
        workspace_uid: workspaceUid,
        project_uid: uploadProjectUid,
        file_name: textTitle.endsWith('.md') ? textTitle : `${textTitle}.md`,
        file_size: new Blob([textContent]).size,
        file_type: 'md',
        page_count: Math.max(1, Math.ceil(textContent.length / 800)),
        content_text: textContent
      });

      setTextTitle('');
      setTextContent('');
      setUploadTextModal(false);
      await loadSources();
    } catch (err: any) {
      alert('建立失敗: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleActive = async (source: KnowledgeSource) => {
    try {
      const updated = await api.toggleSourceActive(source.source_uid, !source.is_active);
      setSources(sources.map(s => s.source_uid === source.source_uid ? { ...s, is_active: updated.is_active } : s));
    } catch (err: any) {
      alert('切換狀態失敗: ' + err.message);
    }
  };

  const handleDelete = async (source: KnowledgeSource) => {
    if (!confirm(`確定要刪除知識文件 [${source.file_name}] 嗎？\n這將會自動清空該文件建立的所有向量切片與圖譜索引 (ON DELETE CASCADE)。`)) {
      return;
    }
    try {
      await api.deleteSource(source.source_uid);
      setSources(sources.filter(s => s.source_uid !== source.source_uid));
      if (previewSource?.source_uid === source.source_uid) {
        setPreviewSource(null);
      }
    } catch (err: any) {
      alert('刪除失敗: ' + err.message);
    }
  };

  const handleOpenPreview = async (source: KnowledgeSource) => {
    setPreviewLoading(true);
    try {
      const detail = await api.getSourceDetail(source.source_uid);
      setPreviewSource(detail);
      setPreviewTab('content');
    } catch (err: any) {
      console.error('Failed to load source detail:', err);
      setPreviewSource(source);
    } finally {
      setPreviewLoading(false);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return <FileText size={28} color="#ef4444" />;
      case 'md':
      case 'txt':
        return <FileCode size={28} color="#38bdf8" />;
      case 'docx':
      case 'doc':
        return <FileText size={28} color="#3b82f6" />;
      default:
        return <FileSpreadsheet size={28} color="#10b981" />;
    }
  };

  const filteredSources = sources.filter(s => {
    const matchesSearch = s.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.project_name && s.project_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.project_code && s.project_code.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (!projectUid && selectedProjectFilter !== 'all') {
      if (selectedProjectFilter === 'global') return !s.project_uid;
      return s.project_uid === selectedProjectFilter;
    }

    return true;
  });

  const globalCount = sources.filter(s => !s.project_uid).length;
  const projectCount = sources.filter(s => Boolean(s.project_uid)).length;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px 24px', backgroundColor: '#090d16' }}>
      {/* 頂部標題與說明 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Sparkles size={20} color="#a855f7" />
            {projectUid ? (
              <span>專案知識文件庫 (Project Docs & Knowledge Sources) · <span style={{ color: '#38bdf8' }}>{projectName}</span></span>
            ) : (
              <span>🏢 公司全域知識庫與文件資產 (Global Knowledge Hub)</span>
            )}
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
            {projectUid 
              ? '管理本專案專屬規格書，並自動繼承公司全域通用指引。文件將自動切片與索引，供 AI Copilot 智能引用。'
              : '管理公司層級通用規範、架構白皮書與各專案文件資產，全體專案均可自動共享與繼承。'}
          </p>
        </div>

        {/* 建立/上傳按鈕群 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
            accept=".pdf,.docx,.txt,.md,.json,.csv"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#581c87',
              color: '#f3e8ff',
              border: '1px solid #7e22ce',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: isUploading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(88, 28, 135, 0.4)'
            }}
          >
            <UploadCloud size={16} />
            {isUploading ? '處理中...' : '上傳檔案 (PDF / MD / TXT)'}
          </button>

          <button
            onClick={() => {
              setTargetScope(projectUid ? 'project' : 'global');
              setUploadTextModal(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0f172a',
              color: '#cbd5e1',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <FileCode size={16} />
            撰寫 Markdown 規格
          </button>
        </div>
      </div>

      {/* 篩選與搜尋工具列 */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: '16px', 
        gap: '12px',
        flexWrap: 'wrap',
        backgroundColor: '#0f172a',
        padding: '10px 14px',
        borderRadius: '10px',
        border: '1px solid #1e293b'
      }}>
        {/* 左側：搜尋輸入框 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#090d16', border: '1px solid #334155', borderRadius: '8px', padding: '6px 12px', minWidth: '280px' }}>
          <Search size={15} color="#64748b" />
          <input
            type="text"
            placeholder="搜尋文件名稱或專案代碼..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f8fafc',
              fontSize: '0.85rem',
              width: '100%'
            }}
          />
        </div>

        {/* 中間：Scope 篩選膠囊按鈕 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setSelectedScopeFilter('all')}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: selectedScopeFilter === 'all' ? '1px solid #3b82f6' : '1px solid #334155',
              backgroundColor: selectedScopeFilter === 'all' ? '#1e3a8a' : '#1e293b',
              color: selectedScopeFilter === 'all' ? '#93c5fd' : '#94a3b8',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            全部文件 ({sources.length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedScopeFilter('global')}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: selectedScopeFilter === 'global' ? '1px solid #10b981' : '1px solid #334155',
              backgroundColor: selectedScopeFilter === 'global' ? '#064e3b' : '#1e293b',
              color: selectedScopeFilter === 'global' ? '#6ee7b7' : '#94a3b8',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Globe size={13} />
            公司全域 ({globalCount})
          </button>

          <button
            type="button"
            onClick={() => setSelectedScopeFilter('project')}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: selectedScopeFilter === 'project' ? '1px solid #8b5cf6' : '1px solid #334155',
              backgroundColor: selectedScopeFilter === 'project' ? '#3b0764' : '#1e293b',
              color: selectedScopeFilter === 'project' ? '#c084fc' : '#94a3b8',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <FolderKanban size={13} />
            專案專屬 ({projectCount})
          </button>
        </div>

        {/* 右側：在 Level 0 時顯示專案下拉過濾 */}
        {!projectUid && allProjects.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} color="#64748b" />
            <select
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              style={{
                backgroundColor: '#090d16',
                border: '1px solid #334155',
                color: '#e2e8f0',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '0.78rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">📁 所有專案/產品</option>
              <option value="global">🌐 僅公司全域 (無指定專案)</option>
              {allProjects.map(p => (
                <option key={p.project_uid} value={p.project_uid}>
                  📦 [{p.project_display_code}] {p.project_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 拖放上傳引導區 (Drop Area) */}
      <div 
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: '2px dashed #334155',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          cursor: 'pointer',
          marginBottom: '16px',
          transition: 'border-color 0.2s ease, background 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#7e22ce';
          e.currentTarget.style.backgroundColor = 'rgba(88, 28, 135, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#334155';
          e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.4)';
        }}
      >
        <UploadCloud size={32} color="#c084fc" style={{ marginBottom: '6px' }} />
        <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.9rem' }}>
          拖放 PRD 規格書、技術架構文件至此，或點擊瀏覽上傳
        </div>
        <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '2px' }}>
          支援 PDF, DOCX, Markdown, TXT, JSON, CSV · 自動段落切片並提取 768 維語意向量
        </div>
      </div>

      {/* 知識文件卡片清單網格 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
            <Clock size={24} style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ marginTop: '8px' }}>載入知識庫文件中...</div>
          </div>
        ) : filteredSources.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', border: '1px solid #1e293b', borderRadius: '12px', backgroundColor: '#090d16' }}>
            <FileText size={36} color="#334155" style={{ marginBottom: '12px' }} />
            <div style={{ color: '#cbd5e1', fontWeight: 600 }}>目前尚未找到任何知識文件</div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
              點擊上方「上傳檔案」或「撰寫 Markdown 規格」即可新增知識來源。
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px', paddingBottom: '24px' }}>
            {filteredSources.map((src) => {
              const isGlobal = !src.project_uid;
              return (
                <div
                  key={src.source_uid}
                  style={{
                    backgroundColor: '#090d16',
                    border: `1px solid ${src.is_active ? (isGlobal ? 'rgba(16, 185, 129, 0.4)' : 'rgba(168, 85, 247, 0.4)') : '#1e293b'}`,
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: src.is_active ? (isGlobal ? '0 4px 16px rgba(6, 78, 59, 0.2)' : '0 4px 16px rgba(88, 28, 135, 0.2)') : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* 卡片頭部：Icon + 名稱 + Scope */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ padding: '4px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b' }}>
                      {getFileIcon(src.file_type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div 
                        onClick={() => handleOpenPreview(src)}
                        title="點擊預覽與閱讀內文"
                        style={{
                          color: '#f8fafc',
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#38bdf8')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#f8fafc')}
                      >
                        {src.file_name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: isGlobal ? '#064e3b' : '#31104b',
                          color: isGlobal ? '#6ee7b7' : '#d8b4fe',
                          border: isGlobal ? '1px solid #059669' : '1px solid #7e22ce',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {isGlobal ? <Globe size={11} /> : <FolderKanban size={11} />}
                          {isGlobal ? '公司全域通用' : (src.project_name ? `[${src.project_code || 'PRJ'}] ${src.project_name}` : '專案專屬')}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {(src.file_size / 1024).toFixed(1)} KB · {src.page_count} 頁
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 卡片狀態與分塊數 */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    backgroundColor: '#0f172a',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    border: '1px solid #1e293b'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <CheckCircle2 size={13} color="#10b981" />
                      <span style={{ color: '#10b981', fontWeight: 500 }}>已完成向量切片</span>
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                      {src.chunk_count || 1} 個向量節點
                    </span>
                  </div>

                  {/* 底部功能欄：閱讀預覽 + 檢索開關 + 刪除 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid #1e293b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenPreview(src)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          color: '#93c5fd',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <Eye size={13} />
                        閱讀預覽
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleActive(src)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'transparent',
                          border: 'none',
                          color: src.is_active ? '#a855f7' : '#64748b',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {src.is_active ? <ToggleRight size={18} color="#a855f7" /> : <ToggleLeft size={18} />}
                        <span>{src.is_active ? '已啟用' : '停用'}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      title="刪除文件"
                      onClick={() => handleDelete(src)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 📖 文件內文閱讀與切片預覽抽屜 / Modal */}
      {previewSource && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(5px)',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '12px',
            width: '800px',
            maxWidth: '95%',
            height: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
            overflow: 'hidden'
          }}>
            {/* 預覽 Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#090d16'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {getFileIcon(previewSource.file_type)}
                <div>
                  <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.05rem', fontWeight: 600 }}>
                    {previewSource.file_name}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: !previewSource.project_uid ? '#064e3b' : '#31104b',
                      color: !previewSource.project_uid ? '#6ee7b7' : '#d8b4fe',
                      fontWeight: 600
                    }}>
                      {!previewSource.project_uid ? '🌐 公司全域通用' : `📦 專案: ${previewSource.project_name || '專案專屬'}`}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {(previewSource.file_size / 1024).toFixed(1)} KB · {previewSource.page_count} 頁
                    </span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setPreviewSource(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* 預覽 Tab 切換 (內文 vs 向量切片) */}
            <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', padding: '0 20px', backgroundColor: '#090d16', gap: '16px' }}>
              <button
                type="button"
                onClick={() => setPreviewTab('content')}
                style={{
                  padding: '10px 4px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: previewTab === 'content' ? '2px solid #38bdf8' : '2px solid transparent',
                  color: previewTab === 'content' ? '#38bdf8' : '#94a3b8',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FileText size={15} />
                <span>文件全文內容</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewTab('chunks')}
                style={{
                  padding: '10px 4px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: previewTab === 'chunks' ? '2px solid #a855f7' : '2px solid transparent',
                  color: previewTab === 'chunks' ? '#c084fc' : '#94a3b8',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Layers size={15} />
                <span>語意向量切片 (Chunks: {previewSource.chunks?.length || 0})</span>
              </button>
            </div>

            {/* 預覽內容主體區 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: '#0f172a' }}>
              {previewLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  <Clock size={20} style={{ animation: 'spin 1s linear infinite' }} />
                  <div style={{ marginTop: '8px' }}>載入文件細節中...</div>
                </div>
              ) : previewTab === 'content' ? (
                previewSource.content_text ? (
                  <div style={{ color: '#e2e8f0', fontSize: '0.9rem', lineHeight: 1.6 }}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p style={{ margin: '0 0 10px 0' }}>{children}</p>,
                        h1: ({ children }) => <h1 style={{ color: '#38bdf8', fontSize: '1.3rem', borderBottom: '1px solid #334155', paddingBottom: '6px' }}>{children}</h1>,
                        h2: ({ children }) => <h2 style={{ color: '#93c5fd', fontSize: '1.15rem', marginTop: '16px' }}>{children}</h2>,
                        h3: ({ children }) => <h3 style={{ color: '#cbd5e1', fontSize: '1rem', marginTop: '12px' }}>{children}</h3>,
                        ul: ({ children }) => <ul style={{ paddingLeft: '20px', margin: '6px 0 12px 0' }}>{children}</ul>,
                        code: ({ children }: any) => <code style={{ backgroundColor: '#1e293b', padding: '2px 6px', borderRadius: '4px', color: '#f472b6', fontFamily: 'monospace' }}>{children}</code>,
                        pre: ({ children }) => <pre style={{ backgroundColor: '#090d16', padding: '12px', borderRadius: '8px', overflowX: 'auto', border: '1px solid #1e293b' }}>{children}</pre>
                      }}
                    >
                      {previewSource.content_text}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>
                    <FileText size={32} style={{ marginBottom: '8px' }} />
                    <div>此文件尚未提取純文字內容</div>
                  </div>
                )
              ) : (
                /* 向量切片檢視 */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(previewSource.chunks || []).map((chunk, idx) => (
                    <div 
                      key={chunk.chunk_uid || idx}
                      style={{
                        backgroundColor: '#090d16',
                        border: '1px solid #1e293b',
                        borderRadius: '8px',
                        padding: '12px 14px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.75rem', color: '#64748b' }}>
                        <span style={{ color: '#a855f7', fontWeight: 600 }}>Chunk #{chunk.chunk_index + 1}</span>
                        <span>第 {chunk.page_number} 頁</span>
                      </div>
                      <div style={{ color: '#cbd5e1', fontSize: '0.82rem', whiteSpace: 'pre-wrap', lineHeight: 1.5, fontFamily: 'monospace' }}>
                        {chunk.chunk_content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 新增 / 撰寫 Markdown 彈窗 */}
      {uploadTextModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(5px)',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '12px',
            width: '640px',
            maxWidth: '95%',
            padding: '24px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileCode size={18} color="#38bdf8" />
                新增 Markdown 規格文件
              </h3>
              <button onClick={() => setUploadTextModal(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>文件名稱</label>
              <input
                type="text"
                placeholder="例如：2026_Q3_PRD.md 或 API_Specification.md"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#090d16',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#fff',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* 作用域選擇 (Scope: 全域 vs 專案) */}
            <div style={{ marginBottom: '14px', backgroundColor: '#090d16', padding: '10px 12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>
                選擇知識庫作用域 (Scope)
              </label>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e2e8f0', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="scope"
                    checked={targetScope === 'global'}
                    onChange={() => setTargetScope('global')}
                  />
                  <span>🏢 公司全域通用 (所有專案皆可繼承)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e2e8f0', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="scope"
                    checked={targetScope === 'project'}
                    onChange={() => setTargetScope('project')}
                  />
                  <span>📦 指定專案專屬</span>
                </label>
              </div>

              {targetScope === 'project' && !projectUid && allProjects.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <select
                    value={targetProjectUid}
                    onChange={(e) => setTargetProjectUid(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  >
                    {allProjects.map(p => (
                      <option key={p.project_uid} value={p.project_uid}>
                        [{p.project_display_code}] {p.project_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>文件內容 (Markdown 格式)</label>
              <textarea
                rows={10}
                placeholder="# 產品需求規格書\n\n## 1. 業務目標\n- 支援 Apple Pay 與八達通支付\n\n## 2. User Stories\n- 作為買家，我可以一鍵結帳..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: '#090d16',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#fff',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setUploadTextModal(false)}
                style={{ padding: '8px 16px', background: '#1e293b', border: 'none', borderRadius: '6px', color: '#cbd5e1', cursor: 'pointer' }}
              >
                取消
              </button>
              <button
                onClick={handleCreateTextSource}
                disabled={isUploading}
                style={{ padding: '8px 16px', background: '#7e22ce', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
              >
                {isUploading ? '建立中...' : '儲存並索引'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
