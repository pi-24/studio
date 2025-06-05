"use client";

import type { User } from '@/types';
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  login: (email: string) => void;
  signup: (email: string) => void;
  logout: () => void;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Try to load user from localStorage on initial load
    try {
      const storedUser = localStorage.getItem('rotaCalcUser');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      localStorage.removeItem('rotaCalcUser');
    }
    setLoading(false);
  }, []);

  const login = (email: string) => {
    const mockUser = { id: 'mock-user-id', email };
    setUser(mockUser);
    try {
      localStorage.setItem('rotaCalcUser', JSON.stringify(mockUser));
    } catch (error) {
      console.error("Failed to set user in localStorage", error);
    }
    router.push('/');
  };

  const signup = (email: string) => {
    // In a real app, this would involve an API call
    // For mock, it's the same as login
    login(email);
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem('rotaCalcUser');
    } catch (error) {
      console.error("Failed to remove user from localStorage", error);
    }
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
