import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile, SavedPortfolio, TradeRecord, PortfolioSummary } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  isPortalOpen: boolean;
  openAuthModal: (initialMode?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  openPortal: () => void;
  closePortal: () => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  saveCurrentPortfolio: (name: string, trades: TradeRecord[], summary?: Partial<PortfolioSummary>) => Promise<{ success: boolean; error?: string; portfolio?: SavedPortfolio }>;
  deleteSavedPortfolio: (id: string) => Promise<{ success: boolean; error?: string }>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  syncWallexApi: () => Promise<{ success: boolean; message?: string; error?: string; lastSyncAt?: string }>;
  authModalMode: 'login' | 'register';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'wallex_auth_token';
const USER_KEY = 'wallex_user_profile';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const cached = localStorage.getItem(USER_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isPortalOpen, setIsPortalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const openAuthModal = useCallback((mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const openPortal = useCallback(() => {
    setIsPortalOpen(true);
  }, []);

  const closePortal = useCallback(() => {
    setIsPortalOpen(false);
  }, []);

  // Validate session on mount
  useEffect(() => {
    const verifySession = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            setUser(data.user);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
          } else {
            // Invalid session
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            setUser(null);
            setToken(null);
          }
        } else {
          // Token expired or invalid
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setUser(null);
          setToken(null);
        }
      } catch (err) {
        console.warn('Network error checking auth session, falling back to cached user:', err);
      } finally {
        setIsLoading(false);
      }
    };

    verifySession();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'خطا در ورود به حساب کاربری.' };
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setIsAuthModalOpen(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطای اتصال به سرور.' };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, name?: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'خطا در ثبت‌نام.' };
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setIsAuthModalOpen(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطای اتصال به سرور.' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (err) {
      console.warn('Logout network error:', err);
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setIsPortalOpen(false);
    }
  };

  const saveCurrentPortfolio = async (
    name: string,
    trades: TradeRecord[],
    summary?: Partial<PortfolioSummary>
  ): Promise<{ success: boolean; error?: string; portfolio?: SavedPortfolio }> => {
    if (!token || !user) {
      openAuthModal('login');
      return { success: false, error: 'برای ذخیره باید ابتدا وارد حساب کاربری خود شوید.' };
    }

    try {
      const res = await fetch('/api/user/saved-portfolios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, trades, summary }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'خطا در ذخیره پورتفو.' };
      }

      setUser(prev => prev ? { ...prev, savedPortfolios: data.savedPortfolios } : null);
      if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify({ ...user, savedPortfolios: data.savedPortfolios }));
      }
      return { success: true, portfolio: data.portfolio };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطا در برقراری ارتباط با سرور.' };
    }
  };

  const deleteSavedPortfolio = async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: 'عدم دسترسی.' };

    try {
      const res = await fetch(`/api/user/saved-portfolios/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'خطا در حذف پورتفو.' };
      }

      setUser(prev => prev ? { ...prev, savedPortfolios: data.savedPortfolios } : null);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطا در حذف.' };
    }
  };

  const updateUserProfile = async (data: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: 'عدم دسترسی.' };

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        return { success: false, error: resData.error || 'خطا در بروزرسانی پروفایل.' };
      }

      setUser(resData.user);
      localStorage.setItem(USER_KEY, JSON.stringify(resData.user));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطا در بروزرسانی.' };
    }
  };

  const syncWallexApi = async (): Promise<{ success: boolean; message?: string; error?: string; lastSyncAt?: string }> => {
    if (!token) return { success: false, error: 'عدم دسترسی.' };

    try {
      const res = await fetch('/api/user/wallex-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'خطا در همگام‌سازی.' };
      }

      setUser(prev => {
        if (!prev) return null;
        const updatedWallex = {
          ...(prev.wallexApi || { isConnected: true }),
          lastSyncAt: data.lastSyncAt,
        };
        const updated = { ...prev, wallexApi: updatedWallex };
        localStorage.setItem(USER_KEY, JSON.stringify(updated));
        return updated;
      });

      return { success: true, message: data.message, lastSyncAt: data.lastSyncAt };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطا در اتصال به سرور همگام‌سازی.' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthModalOpen,
        isPortalOpen,
        openAuthModal,
        closeAuthModal,
        openPortal,
        closePortal,
        login,
        register,
        logout,
        saveCurrentPortfolio,
        deleteSavedPortfolio,
        updateUserProfile,
        syncWallexApi,
        authModalMode,
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
