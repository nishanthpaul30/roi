'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (u: string, p: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  loading: true,
  login: () => false,
  logout: () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const savedUser = localStorage.getItem('git_kpi_user');
    if (savedUser === 'admin') {
      setUser('admin');
    }
    setLoading(false);
  }, []);

  const login = (username: string, password: string): boolean => {
    if (username.trim().toLowerCase() === 'admin' && password === 'admin123') {
      localStorage.setItem('git_kpi_user', 'admin');
      sessionStorage.setItem('just_logged_in', 'true');
      sessionStorage.removeItem('onboarding_seen');
      setUser('admin');
      router.push('/');
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('git_kpi_user');
    sessionStorage.removeItem('just_logged_in');
    sessionStorage.removeItem('onboarding_seen');
    setUser(null);
    router.push('/login');
  };

  useEffect(() => {
    if (!loading) {
      if (!user && pathname !== '/login') {
        router.push('/login');
      } else if (user && pathname === '/login') {
        router.push('/');
      }
    }
  }, [user, loading, pathname, router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
