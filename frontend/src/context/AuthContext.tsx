import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { api } from '../utils/api';
import type { User } from '../utils/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginWithGoogle: () => void;
  loginAsDemoUser: (customEmail?: string, customName?: string) => Promise<void>;
  syncGoogleProfile: (profile: {
    id: string;
    email: string;
    name: string;
    avatar_url?: string;
  }, accessToken: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_USER = 'projectson_auth_user';
const STORAGE_KEY_TOKEN = 'projectson_auth_token';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 初始化讀取 LocalStorage 中的使用者 Session
  useEffect(() => {
    try {
      const savedUserStr = localStorage.getItem(STORAGE_KEY_USER);
      const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
      if (savedUserStr) {
        const parsed = JSON.parse(savedUserStr);
        setUser(parsed);
      }
      if (savedToken) {
        setToken(savedToken);
      }
    } catch (e) {
      console.error('Failed to load auth session:', e);
      localStorage.removeItem(STORAGE_KEY_USER);
      localStorage.removeItem(STORAGE_KEY_TOKEN);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 觸發 Google OAuth 2.0 官方登入跳轉
  const loginWithGoogle = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    
    // 若尚未配置 Google Client ID，提示並提供友善導引
    if (!clientId || clientId.trim() === '' || clientId.includes('YOUR_GOOGLE_CLIENT_ID')) {
      const proceed = confirm(
        '未偵測到 VITE_GOOGLE_CLIENT_ID 設定。\n\n是否使用「一鍵快速開發者/演示登入」即刻體驗系統功能？\n(點擊「確定」進入演示登入，點擊「取消」自行配置 .env)'
      );
      if (proceed) {
        loginAsDemoUser('edmond.chan@projectson.local', 'Edmond Chan (Admin)');
      }
      return;
    }

    const redirectUri = `${window.location.origin}/auth/callback`;
    const scope = 'openid email profile';
    const responseType = 'token';
    const prompt = 'select_account';

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=${responseType}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&prompt=${prompt}`;

    window.location.href = googleAuthUrl;
  };

  // Google OAuth 回調後同步至後端資料庫並持久化 Session
  const syncGoogleProfile = async (
    profile: {
      id: string;
      email: string;
      name: string;
      avatar_url?: string;
    },
    accessToken: string
  ) => {
    setIsLoading(true);
    try {
      // 1. 同步寫入 / 更新 PostgreSQL users 資料表
      const syncResult = await api.syncUser({
        id: profile.id,
        email: profile.email,
        name: profile.name,
        avatar_url: profile.avatar_url,
        oauth_provider: 'google',
        oauth_provider_id: profile.id,
        role: 'admin'
      });

      const syncedUser = syncResult.user || {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        avatar_url: profile.avatar_url,
        role: 'admin',
        status: 'active',
        oauth_provider: 'google'
      };

      // 2. 本地儲存與狀態更新
      setUser(syncedUser);
      setToken(accessToken);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(syncedUser));
      localStorage.setItem(STORAGE_KEY_TOKEN, accessToken);
    } catch (err) {
      console.error('Failed to sync Google user to database:', err);
      // 降級存檔
      const fallbackUser: User = {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        avatar_url: profile.avatar_url,
        role: 'admin',
        status: 'active',
        oauth_provider: 'google'
      };
      setUser(fallbackUser);
      setToken(accessToken);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(fallbackUser));
      localStorage.setItem(STORAGE_KEY_TOKEN, accessToken);
    } finally {
      setIsLoading(false);
    }
  };

  // 演示/開發者快速登入（直接同步至 DB 並登入）
  const loginAsDemoUser = async (customEmail = 'edmond.chan@projectson.local', customName = 'Edmond Chan') => {
    setIsLoading(true);
    try {
      const demoId = `google_demo_${Date.now()}`;
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(customName)}`;
      
      const res = await api.syncUser({
        id: demoId,
        email: customEmail,
        name: customName,
        avatar_url: avatar,
        oauth_provider: 'google',
        oauth_provider_id: demoId,
        role: 'admin'
      });

      const activeUser = res.user;
      setUser(activeUser);
      setToken(`demo_token_${Date.now()}`);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(activeUser));
      localStorage.setItem(STORAGE_KEY_TOKEN, `demo_token_${Date.now()}`);
    } catch (err) {
      console.error('Demo login sync failed:', err);
      const fallbackUser: User = {
        id: `demo_${Date.now()}`,
        email: customEmail,
        name: customName,
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(customName)}`,
        role: 'admin',
        status: 'active',
        oauth_provider: 'google'
      };
      setUser(fallbackUser);
      setToken('demo_token');
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(fallbackUser));
      localStorage.setItem(STORAGE_KEY_TOKEN, 'demo_token');
    } finally {
      setIsLoading(false);
    }
  };

  // 全域登出
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        loginWithGoogle,
        loginAsDemoUser,
        syncGoogleProfile,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
