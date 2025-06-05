
"use client";

import type { User, UserProfileData, RotaGridInput } from '@/types';
import React, { createContext, useState, useEffect, ReactNode } from 'react';
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

const defaultScheduleMeta = {
  wtrOptOut: false,
  scheduleTotalWeeks: 4,
  scheduleStartDate: new Date().toISOString().split('T')[0],
  annualLeaveEntitlement: 27,
  hoursInNormalDay: 8,
};

const defaultShiftDefinitions = [{ id: crypto.randomUUID(), dutyCode: 'S1', name: 'Standard Day', type: 'normal' as 'normal' | 'on-call', startTime: '09:00', finishTime: '17:00', durationStr: '8h 0m' }];

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
        const parsedUser = JSON.parse(storedUser);
        // Ensure essential defaults if profile is incomplete from an older version
        if (!parsedUser.scheduleMeta) {
          parsedUser.scheduleMeta = defaultScheduleMeta;
        }
        if (!parsedUser.shiftDefinitions) {
          parsedUser.shiftDefinitions = defaultShiftDefinitions;
        }
        if (!parsedUser.rotaGrid) { // Add default for rotaGrid
            parsedUser.rotaGrid = defaultRotaGrid;
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
    if (!loading && user && !user.isProfileComplete && pathname !== '/profile/setup') {
      router.push('/profile/setup');
    }
  }, [user, loading, router, pathname]);

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
    scheduleMeta: defaultScheduleMeta,
    shiftDefinitions: defaultShiftDefinitions,
    rotaGrid: defaultRotaGrid, // Initialize rotaGrid
  });

  const login = (email: string) => {
    let existingUser: User | null = null;
    try {
      const storedUser = localStorage.getItem('rotaCalcUser');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed.email === email) { 
            existingUser = parsed;
            if (!existingUser.scheduleMeta) {
              existingUser.scheduleMeta = defaultScheduleMeta;
            }
            if (!existingUser.shiftDefinitions) {
              existingUser.shiftDefinitions = defaultShiftDefinitions;
            }
            if (!existingUser.rotaGrid) { // Ensure rotaGrid exists
                existingUser.rotaGrid = defaultRotaGrid;
            }
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
  };

  const signup = (email: string) => {
    const newUser = initializeNewUser(email);
    setUser(newUser);
    try {
      localStorage.setItem('rotaCalcUser', JSON.stringify(newUser));
    } catch (error) {
      console.error("Failed to set user in localStorage during signup", error);
    }
    router.push('/profile/setup'); 
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

  const updateUserProfile = (updatedData: Partial<UserProfileData>) => {
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
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updateUserProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
