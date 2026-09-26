import React, { createContext, useContext, useState, useEffect } from 'react';
import { chatApi } from '../utils/api';
import { useAuth } from './AuthContext';

interface ChatLockContextType {
  hasPasscode: boolean;
  lockedChatIds: string[];
  unlockedChatIds: Set<string>;
  isLockedFolderOpen: boolean;
  loading: boolean;
  fetchLockStatus: () => Promise<void>;
  setPasscode: (passcode: string, currentPasscode?: string) => Promise<{ success: boolean; message?: string }>;
  verifyPasscode: (passcode: string) => Promise<{ success: boolean; message?: string }>;
  toggleChatLock: (chatId: string, passcode: string) => Promise<{ success: boolean; isLocked?: boolean; message?: string }>;
  removePasscode: (passcode: string) => Promise<{ success: boolean; message?: string }>;
  unlockFolder: (passcode: string) => Promise<{ success: boolean; message?: string }>;
  lockFolder: () => void;
  isChatLocked: (chatId: string) => boolean;
}

const ChatLockContext = createContext<ChatLockContextType | undefined>(undefined);

export const ChatLockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [hasPasscode, setHasPasscode] = useState(false);
  const [lockedChatIds, setLockedChatIds] = useState<string[]>([]);
  const [unlockedChatIds, setUnlockedChatIds] = useState<Set<string>>(new Set());
  const [isLockedFolderOpen, setIsLockedFolderOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchLockStatus = async () => {
    if (!user) {
      setHasPasscode(false);
      setLockedChatIds([]);
      setUnlockedChatIds(new Set());
      setIsLockedFolderOpen(false);
      return;
    }
    try {
      setLoading(true);
      const res = await chatApi.get('/lock/status');
      setHasPasscode(Boolean(res.data.hasPasscode));
      setLockedChatIds(res.data.lockedChatIds || []);
    } catch (err) {
      console.error('Failed to fetch chat lock status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLockStatus();
  }, [user]);

  const setPasscode = async (passcode: string, currentPasscode?: string) => {
    try {
      const res = await chatApi.post('/lock/set-passcode', { passcode, currentPasscode });
      setHasPasscode(true);
      if (res.data.lockedChatIds) {
        setLockedChatIds(res.data.lockedChatIds);
      }
      return { success: true, message: res.data.message };
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to set passcode';
      return { success: false, message: msg };
    }
  };

  const verifyPasscode = async (passcode: string) => {
    try {
      const res = await chatApi.post('/lock/verify-passcode', { passcode });
      return { success: true, message: res.data.message };
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Incorrect passcode';
      return { success: false, message: msg };
    }
  };

  const toggleChatLock = async (chatId: string, passcode: string) => {
    try {
      const res = await chatApi.post('/lock/toggle', { chatId, passcode });
      const updatedLockedChatIds: string[] = res.data.lockedChatIds || [];
      const isLocked = res.data.isLocked;
      setLockedChatIds(updatedLockedChatIds);

      // If locking it, remove from unlocked session set
      if (isLocked) {
        setUnlockedChatIds((prev) => {
          const next = new Set(prev);
          next.delete(chatId);
          return next;
        });
      } else {
        // If unlocking it, add to unlocked session set
        setUnlockedChatIds((prev) => {
          const next = new Set(prev);
          next.add(chatId);
          return next;
        });
      }

      return { success: true, isLocked, message: res.data.message };
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to toggle chat lock';
      return { success: false, message: msg };
    }
  };

  const removePasscode = async (passcode: string) => {
    try {
      const res = await chatApi.post('/lock/remove-passcode', { passcode });
      setHasPasscode(false);
      setLockedChatIds([]);
      setUnlockedChatIds(new Set());
      setIsLockedFolderOpen(false);
      return { success: true, message: res.data.message };
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to remove passcode';
      return { success: false, message: msg };
    }
  };

  const unlockFolder = async (passcode: string) => {
    const res = await verifyPasscode(passcode);
    if (res.success) {
      setIsLockedFolderOpen(true);
      // Unlock all currently locked chats for this session
      setUnlockedChatIds(new Set(lockedChatIds));
      return { success: true };
    }
    return { success: false, message: res.message };
  };

  const lockFolder = () => {
    setIsLockedFolderOpen(false);
    setUnlockedChatIds(new Set());
  };

  const isChatLocked = (chatId: string) => {
    if (!lockedChatIds.includes(chatId)) return false;
    return !unlockedChatIds.has(chatId);
  };

  return (
    <ChatLockContext.Provider
      value={{
        hasPasscode,
        lockedChatIds,
        unlockedChatIds,
        isLockedFolderOpen,
        loading,
        fetchLockStatus,
        setPasscode,
        verifyPasscode,
        toggleChatLock,
        removePasscode,
        unlockFolder,
        lockFolder,
        isChatLocked,
      }}
    >
      {children}
    </ChatLockContext.Provider>
  );
};

export const useChatLock = () => {
  const context = useContext(ChatLockContext);
  if (!context) {
    throw new Error('useChatLock must be used within a ChatLockProvider');
  }
  return context;
};
