import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { userApi } from '../utils/api';

export interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: {
    url: string;
    publicId: string;
  } | null;
  contacts?: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  requestOtp: (email: string) => Promise<{ success: boolean; message: string }>;
  verifyOtp: (email: string, otp: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  updateProfile: (data: FormData | { name: string }) => Promise<{ success: boolean; message: string; user?: User }>;
  updateProfileName: (name: string) => Promise<{ success: boolean; message: string; user?: User }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('aether_chat_token'));
  const [loading, setLoading] = useState(true);

  // Validate session on mount
  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const res = await userApi.get('/me');
          setUser(res.data);
        } catch (error) {
          console.error("Invalid token on load:", error);
          // Clear invalid session
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [token]);

  const requestOtp = async (email: string) => {
    try {
      const res = await userApi.post('/login', { email });
      return { success: true, message: res.data.message || "OTP sent successfully" };
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message || "Failed to request OTP"
        : "Failed to request OTP";
      return { success: false, message };
    }
  };

  const verifyOtp = async (email: string, otp: string) => {
    try {
      const res = await userApi.post('/verify', { email, otp });
      const { token: receivedToken, user: receivedUser } = res.data;
      
      localStorage.setItem('aether_chat_token', receivedToken);
      setToken(receivedToken);
      setUser(receivedUser);
      
      return { success: true, message: "Logged in successfully" };
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message || "Invalid or expired OTP"
        : "Invalid or expired OTP";
      return { success: false, message };
    }
  };

  const updateProfile = async (data: FormData | { name: string }) => {
    try {
      const res = await userApi.post('/update/user', data);
      const { token: updatedToken, user: updatedUser } = res.data;
      
      if (updatedToken) {
        localStorage.setItem('aether_chat_token', updatedToken);
        setToken(updatedToken);
      }
      if (updatedUser) {
        setUser(updatedUser);
      }
      
      return { success: true, message: "Profile updated successfully", user: updatedUser };
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message || "Failed to update profile"
        : "Failed to update profile";
      return { success: false, message };
    }
  };

  const updateProfileName = async (name: string) => {
    return updateProfile({ name });
  };

  const refreshProfile = async () => {
    if (token) {
      try {
        const res = await userApi.get('/me');
        setUser(res.data);
      } catch (error) {
        console.error("Failed to refresh profile:", error);
      }
    }
  };

  const logout = () => {
    localStorage.removeItem('aether_chat_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        requestOtp,
        verifyOtp,
        logout,
        updateProfile,
        updateProfileName,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
