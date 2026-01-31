import React, { createContext, useContext, useState, useCallback } from 'react';
import type { User, SignupData } from '../types';
import { defaultSignupData } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isNewUser: boolean;
  signupData: SignupData;
  updateSignupData: (data: Partial<SignupData>) => void;
  signUp: () => void;
  signIn: (email: string, password: string) => boolean;
  signOut: () => void;
  completeTutorial: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [signupData, setSignupData] = useState<SignupData>(defaultSignupData);

  const updateSignupData = useCallback((data: Partial<SignupData>) => {
    setSignupData(prev => ({ ...prev, ...data }));
  }, []);

  const signUp = useCallback(() => {
    // Create user from signup data
    const newUser: User = {
      id: Date.now().toString(),
      firstName: signupData.firstName,
      lastName: signupData.lastName,
      email: signupData.email,
      phone: signupData.phone || undefined,
      avatar: signupData.avatar || undefined,
      bio: signupData.bio || undefined,
      dateOfBirth: signupData.dateOfBirth || undefined,
      gender: signupData.gender || undefined,
      location: signupData.city ? {
        city: signupData.city,
        state: signupData.state || undefined,
        country: signupData.country,
      } : undefined,
      isVerified: false,
      isBackgroundChecked: false,
      isPremium: false,
      subscriptionTier: 'free',
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    };

    setUser(newUser);
    setIsNewUser(true);
  }, [signupData]);

  const signIn = useCallback((email: string, password: string) => {
    // Mock sign in - in a real app, this would validate against a backend
    // For demo purposes, accept any non-empty credentials
    if (email && password) {
      const mockUser: User = {
        id: Date.now().toString(),
        firstName: 'Returning',
        lastName: 'User',
        email: email,
        isVerified: true,
        isBackgroundChecked: false,
        isPremium: false,
        subscriptionTier: 'free',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      };
      setUser(mockUser);
      setIsNewUser(false);
      return true;
    }
    return false;
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    setIsNewUser(false);
    setSignupData(defaultSignupData);
  }, []);

  const completeTutorial = useCallback(() => {
    setIsNewUser(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isNewUser,
        signupData,
        updateSignupData,
        signUp,
        signIn,
        signOut,
        completeTutorial,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
