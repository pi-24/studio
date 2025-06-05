
"use client";

import type { User, UserProfileData, RotaDocument } from '@/types';
import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  login: (email: string) => void;
  signup: (email: string) => void;
  logout: () => void;
  updateUserProfile: (updatedData: Partial<UserProfileData>) => void;
  addRotaDocument: (rotaDocument: RotaDocument) => void;
  updateRotaDocument: (rotaDocument: RotaDocument) => void;
  deleteRotaDocument: (rotaId: string) => void;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const initializeNewUser = (email: string): User => ({
  id: crypto.randomUUID(),
  email,
  grade: undefined,
  region: undefined,
  taxCode: undefined,
  hasStudentLoan: false,
  hasPostgraduateLoan: false,
  nhsPensionOptIn: true,
  isProfileComplete: false,
  rotas: [], // Initialize with an empty array for rotas
});


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('rotaCalcUser');
      if (storedUser) {
        const parsedUser: User = JSON.parse(storedUser);
        if (typeof parsedUser.isProfileComplete === 'undefined') {
            parsedUser.isProfileComplete = false; 
        }
        if (!parsedUser.rotas) { // Ensure rotas array exists
            parsedUser.rotas = [];
        }
        setUser(parsedUser);
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      localStorage.removeItem('rotaCalcUser');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading && user && !user.isProfileComplete && 
        pathname !== '/profile/setup' && 
        pathname !== '/login' && 
        pathname !== '/signup') {
      router.push('/profile/setup');
    }
  }, [user, loading, router, pathname]);

  const login = useCallback((email: string) => {
    let existingUser: User | null = null;
    try {
      const storedUser = localStorage.getItem('rotaCalcUser');
      if (storedUser) {
        const parsed: User = JSON.parse(storedUser);
        if (parsed.email === email) { 
            existingUser = parsed;
            if (typeof existingUser.isProfileComplete === 'undefined') existingUser.isProfileComplete = false;
            if (!existingUser.rotas) existingUser.rotas = [];
        }
      }
    } catch (error) {
        console.error("Error reading user for login", error);
    }

    const currentUser = existingUser || initializeNewUser(email);
    setUser(currentUser);
    try {
      localStorage.setItem('rotaCalcUser', JSON.stringify(currentUser));
    } catch (error) {
      console.error("Failed to set user in localStorage", error);
    }

    if (!currentUser.isProfileComplete) {
      router.push('/profile/setup');
    } else {
      router.push('/');
    }
  }, [router, initializeNewUser]);

  const signup = useCallback((email: string) => {
    const newUser = initializeNewUser(email);
    setUser(newUser);
    try {
      localStorage.setItem('rotaCalcUser', JSON.stringify(newUser));
    } catch (error) {
      console.error("Failed to set user in localStorage during signup", error);
    }
    router.push('/profile/setup'); 
  }, [router, initializeNewUser]);

  const logout = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem('rotaCalcUser');
    } catch (error) {
      console.error("Failed to remove user from localStorage", error);
    }
    router.push('/login');
  }, [router]);

  const updateUserProfile = useCallback((updatedData: Partial<UserProfileData>) => {
    setUser(prevUser => {
      if (!prevUser) return null;
      // Ensure rotas array is preserved if not part of updatedData
      const newRotas = updatedData.rotas || prevUser.rotas;
      const newUser = { ...prevUser, ...updatedData, rotas: newRotas };
      try {
        localStorage.setItem('rotaCalcUser', JSON.stringify(newUser));
      } catch (error) {
        console.error("Failed to update user in localStorage", error);
      }
      return newUser;
    });
  }, []);

  const addRotaDocument = useCallback((rotaDocument: RotaDocument) => {
    setUser(prevUser => {
        if (!prevUser) return null;
        const updatedRotas = [...(prevUser.rotas || []), rotaDocument];
        const newUser = { ...prevUser, rotas: updatedRotas };
        localStorage.setItem('rotaCalcUser', JSON.stringify(newUser));
        return newUser;
    });
  }, []);

  const updateRotaDocument = useCallback((updatedRotaDoc: RotaDocument) => {
    setUser(prevUser => {
        if (!prevUser || !prevUser.rotas) return prevUser;
        const updatedRotas = prevUser.rotas.map(rota => 
            rota.id === updatedRotaDoc.id ? updatedRotaDoc : rota
        );
        const newUser = { ...prevUser, rotas: updatedRotas };
        localStorage.setItem('rotaCalcUser', JSON.stringify(newUser));
        return newUser;
    });
  }, []);

  const deleteRotaDocument = useCallback((rotaId: string) => {
    setUser(prevUser => {
        if (!prevUser || !prevUser.rotas) return prevUser;
        const updatedRotas = prevUser.rotas.filter(rota => rota.id !== rotaId);
        const newUser = { ...prevUser, rotas: updatedRotas };
        localStorage.setItem('rotaCalcUser', JSON.stringify(newUser));
        return newUser;
    });
  }, []);


  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updateUserProfile, addRotaDocument, updateRotaDocument, deleteRotaDocument, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
