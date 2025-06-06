
"use client";

import type { User, UserProfileData, RotaDocument, RotaSpecificScheduleMetadata } from '@/types';
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
  rotas: [], 
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

        if (!parsedUser.rotas || !Array.isArray(parsedUser.rotas)) {
            parsedUser.rotas = [];
        } else {
            parsedUser.rotas = parsedUser.rotas.map(rota => {
                // Define a robust default for scheduleMeta
                const defaultMeta: RotaSpecificScheduleMetadata = {
                    site: 'N/A', 
                    specialty: 'N/A',
                    scheduleStartDate: '1970-01-01', 
                    endDate: '1970-01-01',
                    scheduleTotalWeeks: 1, 
                    wtrOptOut: false,
                    annualLeaveEntitlement: 0, 
                    hoursInNormalDay: 8,
                };

                // Ensure scheduleMeta exists and is an object, otherwise use default
                const metaIsValid = rota.scheduleMeta && typeof rota.scheduleMeta === 'object';
                const currentMeta = metaIsValid ? rota.scheduleMeta : defaultMeta;

                return {
                    id: rota.id || crypto.randomUUID(),
                    name: rota.name || 'Unnamed Rota',
                    scheduleMeta: { // Ensure all fields within scheduleMeta are present
                        site: currentMeta.site || defaultMeta.site,
                        specialty: currentMeta.specialty || defaultMeta.specialty,
                        scheduleStartDate: currentMeta.scheduleStartDate || defaultMeta.scheduleStartDate,
                        endDate: currentMeta.endDate || defaultMeta.endDate,
                        scheduleTotalWeeks: typeof currentMeta.scheduleTotalWeeks === 'number' ? currentMeta.scheduleTotalWeeks : defaultMeta.scheduleTotalWeeks,
                        wtrOptOut: typeof currentMeta.wtrOptOut === 'boolean' ? currentMeta.wtrOptOut : defaultMeta.wtrOptOut,
                        annualLeaveEntitlement: typeof currentMeta.annualLeaveEntitlement === 'number' ? currentMeta.annualLeaveEntitlement : defaultMeta.annualLeaveEntitlement,
                        hoursInNormalDay: typeof currentMeta.hoursInNormalDay === 'number' ? currentMeta.hoursInNormalDay : defaultMeta.hoursInNormalDay,
                    },
                    shiftDefinitions: Array.isArray(rota.shiftDefinitions) ? rota.shiftDefinitions : [],
                    rotaGrid: typeof rota.rotaGrid === 'object' && rota.rotaGrid !== null ? rota.rotaGrid : {},
                    createdAt: rota.createdAt || new Date().toISOString(),
                    complianceSummary: rota.complianceSummary // Stays undefined if not present, which is fine
                };
            });
        }
        setUser(parsedUser);
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage or migrate rota structure:", error);
      // localStorage.removeItem('rotaCalcUser'); // Optionally clear corrupted data
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (loading) return;

    const allowedPublicPaths = ['/login', '/signup', '/about'];

    if (user) {
      if (!user.isProfileComplete && pathname !== '/profile/setup' && !allowedPublicPaths.includes(pathname)) {
        router.push('/profile/setup');
      } else if (user.isProfileComplete && (pathname === '/login' || pathname === '/signup')) {
        router.push('/');
      }
    } else { // No user
      if (!allowedPublicPaths.includes(pathname) && pathname !== '/profile/setup') { // also protect profile/setup if no user
        router.push('/about'); // Default to about page if not logged in and not on an allowed public path
      }
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
            // Ensure backward compatibility for isProfileComplete and rotas
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
  }, [router]);

  const signup = useCallback((email: string) => {
    const newUser = initializeNewUser(email);
    setUser(newUser);
    try {
      localStorage.setItem('rotaCalcUser', JSON.stringify(newUser));
    } catch (error) {
      console.error("Failed to set user in localStorage during signup", error);
    }
    router.push('/profile/setup'); 
  }, [router]);

  const logout = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem('rotaCalcUser');
    } catch (error) {
      console.error("Failed to remove user from localStorage", error);
    }
    router.push('/about'); // Changed from '/login' to '/about'
  }, [router]);

  const updateUserProfile = useCallback((updatedData: Partial<UserProfileData>) => {
    setUser(prevUser => {
      if (!prevUser) return null;
      const newRotas = updatedData.rotas || prevUser.rotas; // Preserve rotas if not in updatedData
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
