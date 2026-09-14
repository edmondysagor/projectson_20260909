import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export const AuthCallback: React.FC = () => {
  const { syncGoogleProfile } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const handleOAuthCallback = async () => {
      try {
        // 1. 解析 URL Hash (Implicit Flow) 或 Query Params 中的 Access Token
        let token = '';
        const hash = window.location.hash.substring(1);
        if (hash) {
          const hashParams = new URLSearchParams(hash);
          token = hashParams.get('access_token') || '';
        }

        if (!token) {
          const queryParams = new URLSearchParams(window.location.search);
          token = queryParams.get('access_token') || queryParams.get('token') || '';
          
          const errorParam = queryParams.get('error');
          if (errorParam) {
            throw new Error(`Google OAuth 授權失敗：${errorParam}`);
          }
        }

        if (!token) {
          throw new Error('未能在回調 URL 中找到有效的 Google Access Token');
        }

        // 2. 向 Google UserInfo API 獲取真實用戶資料 (Verified User Profile)
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!userInfoRes.ok) {
          const errText = await userInfoRes.text();
          throw new Error(`獲取 Google 帳戶檔案失敗 (${userInfoRes.status}): ${errText}`);
        }

        const profile = await userInfoRes.json();
        
        if (!profile.email) {
          throw new Error('未能由 Google 帳戶獲取有效的 Email');
        }

        // 3. 呼叫後端 API 同步至 PostgreSQL 資料庫並持久化 Session
        await syncGoogleProfile(
          {
            id: profile.sub || `google_${Date.now()}`,
            email: profile.email,
            name: profile.name || profile.given_name || profile.email.split('@')[0],
            avatar_url: profile.picture
          },
          token
        );

        setStatus('success');

        // 4. 清理 URL Hash 並順暢跳轉至主頁
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 600);

      } catch (err: any) {
        console.error('Google Auth Callback Error:', err);
        setStatus('error');
        setErrorMessage(err.message || '認證處理過程中發生未預期的錯誤');
      }
    };

    handleOAuthCallback();
  }, [syncGoogleProfile, navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#020617',
      backgroundImage: `
        radial-gradient(at 50% 50%, rgba(99, 102, 241, 0.15) 0px, transparent 60%)
      `,
      padding: '24px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        maxWidth: '400px',
        width: '100%',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '20px',
        padding: '36px 28px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center'
      }}>
        {status === 'loading' && (
          <>
            <Loader2 size={40} className="animate-spin" color="#6366f1" style={{ marginBottom: '16px' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 8px 0' }}>
              正在驗證 Google 登入...
            </h2>
            <p style={{ fontSize: '0.84rem', color: '#94a3b8', margin: 0 }}>
              正在讀取您的帳戶檔案並同步至 PostgreSQL 資料庫，請稍候。
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 size={44} color="#10b981" style={{ marginBottom: '16px' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 8px 0' }}>
              登入成功！
            </h2>
            <p style={{ fontSize: '0.84rem', color: '#94a3b8', margin: 0 }}>
              認證完成，正在為您載入 Projectson 專案總表...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle size={44} color="#ef4444" style={{ marginBottom: '16px' }} />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 8px 0' }}>
              認證失敗
            </h2>
            <p style={{ fontSize: '0.84rem', color: '#fca5a5', margin: '0 0 20px 0', lineHeight: '1.4' }}>
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => navigate('/auth/sign-in', { replace: true })}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6366f1',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '0.86rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
              }}
            >
              返回登入頁面
            </button>
          </>
        )}
      </div>
    </div>
  );
};
