
"use client";

import type { User, UserProfileData, RotaGridInput, ScheduleMetadata, ShiftDefinition } from '@/types';
import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  login: (email: string) => void;
  signup: (email: string) => void;
  logout: () => void;
  updateUserProfile: (updatedData: Partial<UserProfileData>) => void;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const defaultScheduleMeta: ScheduleMetadata = {
  wtrOptOut: false,
  scheduleTotalWeeks: 4,
  scheduleStartDate: new Date().toISOString().split('T')[0],
  annualLeaveEntitlement: 27,
  hoursInNormalDay: 8,
};

const defaultShiftDefinitions: ShiftDefinition[] = [{ id: crypto.randomUUID(), dutyCode: 'S1', name: 'Standard Day', type: 'normal' as 'normal' | 'on-call', startTime: '09:00', finishTime: '17:00', durationStr: '8h 0m' }];

const defaultRotaGrid: RotaGridInput = {};

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
        // Ensure essential defaults if profile is incomplete from an older version
        if (!parsedUser.scheduleMeta) {
          parsedUser.scheduleMeta = { ...defaultScheduleMeta };
        }
        if (!parsedUser.shiftDefinitions || parsedUser.shiftDefinitions.length === 0) {
          parsedUser.shiftDefinitions = [...defaultShiftDefinitions.map(def => ({...def, id: crypto.randomUUID()}))];
        }
        if (!parsedUser.rotaGrid) {
            parsedUser.rotaGrid = { ...defaultRotaGrid };
        }
        if (typeof parsedUser.isProfileComplete === 'undefined') {
            parsedUser.isProfileComplete = false; // Default for older users
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
    if (!loading && user && !user.isProfileComplete && pathname !== '/profile/setup' && pathname !== '/login' && pathname !== '/signup') {
      router.push('/profile/setup');
    }
  }, [user, loading, router, pathname]);

  const initializeNewUser = useCallback((email: string): User => ({
    id: crypto.randomUUID(), 
    email,
    grade: undefined,
    region: undefined,
    taxCode: undefined,
    hasStudentLoan: false,
    hasPostgraduateLoan: false,
    nhsPensionOptIn: true,
    isProfileComplete: false,
    scheduleMeta: { ...defaultScheduleMeta },
    shiftDefinitions: [...defaultShiftDefinitions.map(def => ({...def, id: crypto.randomUUID()}))],
    rotaGrid: { ...defaultRotaGrid },
  }), []);

  const login = useCallback((email: string) => {
    let existingUser: User | null = null;
    try {
      const storedUser = localStorage.getItem('rotaCalcUser');
      if (storedUser) {
        const parsed: User = JSON.parse(storedUser);
        if (parsed.email === email) { 
            existingUser = parsed;
            if (!existingUser.scheduleMeta) existingUser.scheduleMeta = { ...defaultScheduleMeta };
            if (!existingUser.shiftDefinitions || existingUser.shiftDefinitions.length === 0) existingUser.shiftDefinitions = [...defaultShiftDefinitions.map(def => ({...def, id: crypto.randomUUID()}))];
            if (!existingUser.rotaGrid) existingUser.rotaGrid = { ...defaultRotaGrid };
            if (typeof existingUser.isProfileComplete === 'undefined') existingUser.isProfileComplete = false;
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
      const newUser = { ...prevUser, ...updatedData };
      try {
        localStorage.setItem('rotaCalcUser', JSON.stringify(newUser));
      } catch (error) {
        console.error("Failed to update user in localStorage", error);
      }
      return newUser;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updateUserProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
