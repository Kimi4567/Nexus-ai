"use client";

import { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  user: any;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('nexus_user');
    if (stored) setUser(JSON.parse(stored));
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const mockUser = { id: '1', email, name: 'User', plan: 'free' };
    setUser(mockUser);
    localStorage.setItem('nexus_user', JSON.stringify(mockUser));
  };

  const register = async (email: string, password: string, name: string) => {
    const mockUser = { id: '1', email, name, plan: 'free' };
    setUser(mockUser);
    localStorage.setItem('nexus_user', JSON.stringify(mockUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('nexus_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
