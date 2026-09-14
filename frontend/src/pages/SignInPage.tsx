import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, ShieldCheck, AlertCircle, Loader2, Bot, ArrowRight, UserCheck } from 'lucide-react';

export const SignInPage: React.FC = () => {
  const { loginWithGoogle, loginAsDemoUser, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 若已登入，自動導回首頁 Dashboard
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  // 檢查 URL 是否帶有錯誤訊息
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    if (errorParam) {
      if (errorParam === 'access_denied') {
        setErrorMessage('您已取消 Google 授權，請重新嘗試登入。');
      } else {
        setErrorMessage(`登入失敗：${errorParam}`);
      }
    }
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      loginWithGoogle();
    } catch (err: any) {
      setErrorMessage(err.message || '無法連接 Google 認證伺服器');
      setIsSubmitting(false);
    }
  };

  const handleDemoSignIn = async (email: string, name: string) => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await loginAsDemoUser(email, name);
      navigate('/', { replace: true });
    } catch (err: any) {
      setErrorMessage(err.message || '演示登入失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#020617',
      backgroundImage: `
        radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.18) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(168, 85, 247, 0.18) 0px, transparent 50%),
        radial-gradient(at 50% 50%, rgba(14, 165, 233, 0.1) 0px, transparent 60%)
      `,
      padding: '24px',
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* 背景裝飾光暈 */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '15%',
        width: '320px',
        height: '320px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
        filter: 'blur(40px)',
        pointerEvents: 'none'
      }} />

      {/* 核心玻璃感認證卡片 (Glassmorphism Card) */}
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        padding: '40px 32px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 30px rgba(99, 102, 241, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 10,
        position: 'relative'
      }}>
        {/* 品牌 Logo 與徽章 */}
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)',
          marginBottom: '20px'
        }}>
          <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ffffff' }}>P</span>
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: '20px',
          fontSize: '0.75rem',
          fontWeight: 700,
          color: '#a5b4fc',
          marginBottom: '12px'
        }}>
          <Sparkles size={13} color="#a5b4fc" />
          <span>Actionable AI PM Engine</span>
        </div>

        <h1 style={{
          fontSize: '1.65rem',
          fontWeight: 800,
          color: '#f8fafc',
          margin: '0 0 8px 0',
          textAlign: 'center',
          letterSpacing: '-0.02em'
        }}>
          歡迎登入 Projectson
        </h1>

        <p style={{
          fontSize: '0.86rem',
          color: '#94a3b8',
          margin: '0 0 28px 0',
          textAlign: 'center',
          lineHeight: '1.5'
        }}>
          Google OKF 知識圖譜驅動．5 層溯源矩陣與自動化專案協同平台
        </p>

        {/* 錯誤警告 Banner */}
        {errorMessage && (
          <div style={{
            width: '100%',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            boxSizing: 'border-box'
          }}>
            <AlertCircle size={17} color="#f87171" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.8rem', color: '#fca5a5', lineHeight: '1.4' }}>
              {errorMessage}
            </div>
          </div>
        )}

        {/* 官方 Google OAuth 2.0 登入按鈕 */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isSubmitting || isLoading}
          style={{
            width: '100%',
            height: '48px',
            backgroundColor: '#ffffff',
            color: '#1e293b',
            border: 'none',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            fontSize: '0.92rem',
            fontWeight: 600,
            cursor: isSubmitting || isLoading ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
          onMouseEnter={(e) => {
            if (!isSubmitting) e.currentTarget.style.backgroundColor = '#f1f5f9';
          }}
          onMouseLeave={(e) => {
            if (!isSubmitting) e.currentTarget.style.backgroundColor = '#ffffff';
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="animate-spin" color="#6366f1" />
              <span>正在連線 Google 授權伺服器...</span>
            </>
          ) : (
            <>
              {/* 官方 Google "G" 向量彩色圖標 */}
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>使用 Google 帳號登入 (Sign in with Google)</span>
            </>
          )}
        </button>

        {/* 分隔線 */}
        <div style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '24px 0',
          color: '#475569',
          fontSize: '0.74rem'
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#334155' }} />
          <span>或快速體驗</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#334155' }} />
        </div>

        {/* 一鍵演示/開發者登入按鈕組 */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            onClick={() => handleDemoSignIn('edmond.chan@projectson.local', 'Edmond Chan (Project Lead)')}
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '10px 14px',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '10px',
              color: '#c7d2fe',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.1)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserCheck size={16} color="#818cf8" />
              <span>以 Edmond Chan 身份登入 (Admin)</span>
            </div>
            <ArrowRight size={14} color="#818cf8" />
          </button>

          <button
            type="button"
            onClick={() => handleDemoSignIn('sarah.wong@projectson.local', 'Sarah Wong (Dev Team)')}
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '10px 14px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              color: '#94a3b8',
              fontSize: '0.82rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={16} color="#94a3b8" />
              <span>以 Sarah Wong 身份登入 (Dev Member)</span>
            </div>
            <ArrowRight size={14} color="#94a3b8" />
          </button>
        </div>

        {/* 底部安全與隱私徽章 */}
        <div style={{
          marginTop: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.72rem',
          color: '#64748b'
        }}>
          <ShieldCheck size={14} color="#10b981" />
          <span>OAuth 2.0 端到端安全認證 ． 企業級 PostgreSQL 資料同步</span>
        </div>
      </div>
    </div>
  );
};
