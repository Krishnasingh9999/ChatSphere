import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSocket } from '../context/SocketContext';
import {
  LogOut,
  Settings,
  Plus,
  Search,
  MessageSquare,
  Shield,
  Trash2,
  Sun,
  Moon,
  CircleDashed,
  PlusCircle,
  Eye,
  Lock,
  Unlock,
  KeyRound,
  Globe,
  Image as ImageIcon,
  Type,
  ChevronRight,
} from 'lucide-react';
import { useChatLock } from '../context/ChatLockContext';
import { ChatLockModal, type ChatLockModalMode } from './ChatLockModal';
import { UserSettingsModal } from './UserSettingsModal';
import { NewChatModal } from './NewChatModal';
import { CreateStatusModal } from './CreateStatusModal';
import { StatusViewerModal, type StatusItem } from './StatusViewerModal';
import { chatApi, getAvatarUrl, getMediaUrl } from '../utils/api';

export interface ChatItem {
  user: {
    _id: string;
    name: string;
    email: string;
    avatar?: {
      url: string;
      publicId: string;
    } | null;
  };
  chat: {
    _id: string;
    users: string[];
    latestMessage: {
      text: string;
      sender: string;
    } | null;
    unseenCount: number;
    createdAt: string;
    updatedAt: string;
  };
}

interface StatusGroup {
  user: {
    _id: string;
    name: string;
    avatar?: { url: string } | null;
  };
  statuses: StatusItem[];
  allViewed: boolean;
  latestCreatedAt: string;
}

interface SidebarProps {
  chats: ChatItem[];
  activeChatId: string | null;
  typingChats?: { [chatId: string]: boolean };
  onSelectChat: (chat: ChatItem) => void;
  onChatCreated: (chatId: string) => void;
  onDeleteChat?: (chatId: string) => void;
  onChatLockChanged?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  chats,
  activeChatId,
  typingChats = {},
  onSelectChat,
  onChatCreated,
  onDeleteChat,
  onChatLockChanged,
}) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { socket } = useSocket();

  const [activeTab, setActiveTab] = useState<'chats' | 'status'>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  // Status state
  const [myStatuses, setMyStatuses] = useState<StatusItem[]>([]);
  const [recentStatuses, setRecentStatuses] = useState<StatusGroup[]>([]);
  const [isCreateStatusOpen, setIsCreateStatusOpen] = useState(false);
  const [viewerGroup, setViewerGroup] = useState<{
    user: { _id: string; name: string; avatar?: { url: string } | null };
    statuses: StatusItem[];
  } | null>(null);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

  const fetchStatuses = async () => {
    try {
      const res = await chatApi.get('/status/all');
      setMyStatuses(res.data.myStatus || []);
      setRecentStatuses(res.data.recentStatuses || []);
    } catch (err) {
      console.error("Failed to load statuses:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchStatuses();
    }
  }, [user]);

  // Real-time socket listeners for status updates
  useEffect(() => {
    if (!socket) return;

    const handleNewStatus = () => {
      fetchStatuses();
    };

    const handleStatusDeleted = () => {
      fetchStatuses();
    };

    const handleStatusViewed = () => {
      fetchStatuses();
    };

    socket.on('new-status', handleNewStatus);
    socket.on('status-deleted', handleStatusDeleted);
    socket.on('status-viewed', handleStatusViewed);

    return () => {
      socket.off('new-status', handleNewStatus);
      socket.off('status-deleted', handleStatusDeleted);
      socket.off('status-viewed', handleStatusViewed);
    };
  }, [socket]);

  // Chat Lock Context
  const { 
    hasPasscode, 
    lockedChatIds, 
    isLockedFolderOpen, 
    lockFolder, 
    fetchLockStatus 
  } = useChatLock();

  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [lockModalMode, setLockModalMode] = useState<ChatLockModalMode>('unlock_folder');
  const [lockModalTargetChat, setLockModalTargetChat] = useState<{
    _id: string;
    userName: string;
    isLocked: boolean;
  } | null>(null);

  if (!user) return null;

  // Split chats into regular and locked
  const regularChats = chats.filter((item) => !lockedChatIds.includes(item.chat._id));
  const lockedChats = chats.filter((item) => lockedChatIds.includes(item.chat._id));

  const filteredRegularChats = regularChats.filter((item) =>
    item.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLockedChats = lockedChats.filter((item) =>
    item.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const unviewedStatusesCount = recentStatuses.filter((s) => !s.allViewed).length;
  const totalUnreadChats = regularChats.reduce((acc, c) => acc + (c.chat.unseenCount || 0), 0);

  // Helper to format timestamp
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const formatStatusTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const handleDeleteIndividualStatus = async (statusId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this status?")) return;
    try {
      await chatApi.delete(`/status/${statusId}`);
      setMyStatuses((prev) => prev.filter((s) => s._id !== statusId));
      fetchStatuses();
    } catch (err) {
      console.error("Failed to delete status:", err);
      alert("Failed to delete status. Please try again.");
    }
  };

  const openViewerForMyStatus = (index: number) => {
    setViewerInitialIndex(index);
    setViewerGroup({
      user: { _id: user._id, name: user.name, avatar: user.avatar },
      statuses: myStatuses,
    });
  };

  const openViewerForContact = (group: StatusGroup) => {
    setViewerInitialIndex(0);
    setViewerGroup({
      user: group.user,
      statuses: group.statuses,
    });
  };

  return (
    <div className={`w-full h-full border-r flex flex-col backdrop-blur-md transition-colors duration-300 ${
      theme === 'light'
        ? 'bg-white border-gray-200'
        : 'bg-[#111827]/40 border-white/10'
    }`}>
      {/* Profile Header */}
      <div className={`p-4 border-b flex items-center justify-between ${
        theme === 'light'
          ? 'bg-gray-50/80 border-gray-200'
          : 'bg-[#111827]/20 border-white/10'
      }`}>
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 mr-2">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold uppercase font-display border border-indigo-400/20 shadow-md flex-shrink-0">
            {user.avatar?.url ? (
              <img
                src={getAvatarUrl(user.avatar.url)}
                alt={user.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  if (user.avatar?.url && target.src !== user.avatar.url) {
                    target.src = user.avatar.url;
                  }
                }}
              />
            ) : (
              user.name.slice(0, 2)
            )}
          </div>
          <div className="flex flex-col text-left min-w-0 flex-1">
            <h3 className={`text-sm sm:text-base font-semibold tracking-wide truncate max-w-full font-display ${
              theme === 'light' ? 'text-gray-900' : 'text-white'
            }`}>
              {user.name}
            </h3>
            <span className="text-[10px] text-indigo-500 font-medium flex items-center gap-1">
              <Shield className="w-3 h-3" /> Online
            </span>
          </div>
        </div>
        
        {/* Profile Action Buttons */}
        <div className="flex items-center gap-1">
          {/* Secret Passcode Security Button */}
          <button
            onClick={() => {
              setLockModalMode('set_passcode');
              setLockModalTargetChat(null);
              setIsLockModalOpen(true);
            }}
            title={hasPasscode ? "Change Secret Passcode" : "Set Secret Passcode"}
            className={`p-2 rounded-lg active:scale-95 transition-all ${
              theme === 'light'
                ? 'text-gray-600 hover:text-emerald-600 hover:bg-emerald-50'
                : 'text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10'
            }`}
          >
            <KeyRound className="w-4.5 h-4.5" />
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className={`p-2 rounded-lg active:scale-95 transition-all ${
              theme === 'light'
                ? 'text-gray-600 hover:text-amber-600 hover:bg-gray-200/70'
                : 'text-gray-400 hover:text-amber-300 hover:bg-white/5'
            }`}
          >
            {theme === 'dark' ? (
              <Sun className="w-4.5 h-4.5 text-amber-300" />
            ) : (
              <Moon className="w-4.5 h-4.5 text-indigo-600" />
            )}
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Profile Settings"
            className={`p-2 rounded-lg active:scale-95 transition-all ${
              theme === 'light'
                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/70'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Settings className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={logout}
            title="Log Out"
            className={`p-2 rounded-lg active:scale-95 transition-all ${
              theme === 'light'
                ? 'text-gray-600 hover:text-red-600 hover:bg-red-50'
                : 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
            }`}
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* WhatsApp-Style Top Navigation Tabs: Chats vs Status */}
      <div className={`grid grid-cols-2 border-b ${
        theme === 'light' ? 'bg-gray-50/60 border-gray-200' : 'bg-white/5 border-white/10'
      }`}>
        <button
          type="button"
          onClick={() => setActiveTab('chats')}
          className={`py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === 'chats'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Chats</span>
          {totalUnreadChats > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
              {totalUnreadChats}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('status')}
          className={`py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === 'status'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <CircleDashed className="w-4 h-4" />
          <span>Status</span>
          {unviewedStatusesCount > 0 && (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" />
          )}
        </button>
      </div>

      {/* TAB 1: CHATS VIEW */}
      {activeTab === 'chats' && (
        <>
          {/* Action Bar (Search & Create Chat) */}
          <div className={`p-3.5 flex items-center gap-2 border-b ${
            theme === 'light'
              ? 'bg-gray-50/50 border-gray-200'
              : 'bg-[#0b0f19]/20 border-white/5'
          }`}>
            <div className="relative flex-1">
              <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                theme === 'light' ? 'text-gray-400' : 'text-gray-500'
              }`} />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1.5 focus:ring-indigo-500 transition-all ${
                  theme === 'light'
                    ? 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-indigo-500 shadow-sm'
                    : 'bg-[#0b0f19]/60 border border-white/5 text-white placeholder-gray-500 focus:border-transparent'
                }`}
              />
            </div>
            <button
              onClick={() => setIsNewChatOpen(true)}
              title="New Conversation"
              className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {/* WhatsApp-Style Locked Chats Header Folder */}
            {lockedChats.length > 0 && (
              <div className="mb-2">
                <div
                  onClick={() => {
                    if (isLockedFolderOpen) {
                      lockFolder();
                    } else {
                      setLockModalMode('unlock_folder');
                      setLockModalTargetChat(null);
                      setIsLockModalOpen(true);
                    }
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                    isLockedFolderOpen
                      ? theme === 'light'
                        ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-xs'
                        : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                      : theme === 'light'
                      ? 'bg-gray-50/80 hover:bg-gray-100/90 border-gray-200/80 text-gray-800'
                      : 'bg-white/5 hover:bg-white/10 border-white/5 text-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform ${
                      isLockedFolderOpen
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                        : 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-500'
                    }`}>
                      {isLockedFolderOpen ? <Unlock className="w-4.5 h-4.5" /> : <Lock className="w-4.5 h-4.5" />}
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold font-display">
                          Locked chats
                        </span>
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-500 text-[10px] font-bold">
                          {lockedChats.length}
                        </span>
                      </div>
                      <p className={`text-[10px] truncate ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
                        {isLockedFolderOpen ? 'Unlocked in this session' : 'Secret passcode protected'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isLockedFolderOpen ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          lockFolder();
                        }}
                        title="Lock chats"
                        className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-1"
                      >
                        <Lock className="w-3 h-3" />
                        <span>Lock</span>
                      </button>
                    ) : (
                      <ChevronRight className={`w-4 h-4 ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`} />
                    )}
                  </div>
                </div>

                {/* Sub-list of unlocked chats when folder is open */}
                {isLockedFolderOpen && (
                  <div className="mt-1.5 pl-2 border-l-2 border-emerald-500/40 space-y-1 animate-fade-in">
                    {filteredLockedChats.map((item) => {
                      const isActive = activeChatId === item.chat._id;
                      const isTyping = Boolean(typingChats[item.chat._id]) && !isActive;
                      const hasUnread = item.chat.unseenCount > 0;
                      const latestMsg = item.chat.latestMessage;

                      return (
                        <div
                          key={item.chat._id}
                          onClick={() => onSelectChat(item)}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all duration-200 text-left cursor-pointer group ${
                            isActive
                              ? theme === 'light'
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs'
                                : 'bg-emerald-500/20 border-emerald-500/40 text-white'
                              : theme === 'light'
                              ? 'border-transparent hover:bg-emerald-50/50 text-gray-700'
                              : 'border-transparent hover:bg-emerald-500/10 text-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-9 h-9 rounded-xl overflow-hidden bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-500 border border-emerald-500/30 flex items-center justify-center text-xs font-semibold uppercase font-display select-none flex-shrink-0">
                              {item.user.avatar?.url ? (
                                <img
                                  src={getAvatarUrl(item.user.avatar.url)}
                                  alt={item.user.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.onerror = null;
                                    if (item.user.avatar?.url && target.src !== item.user.avatar.url) {
                                      target.src = item.user.avatar.url;
                                    }
                                  }}
                                />
                              ) : (
                                item.user.name.slice(0, 2)
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex justify-between items-baseline mb-0.5">
                                <h4 className={`text-xs font-semibold truncate font-display ${
                                  isActive 
                                    ? theme === 'light' ? 'text-emerald-700 font-bold' : 'text-emerald-300'
                                    : theme === 'light' ? 'text-gray-900' : 'text-white'
                                }`}>
                                  {item.user.name}
                                </h4>
                                <span className={`text-[9px] flex-shrink-0 ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {formatTime(item.chat.updatedAt)}
                                </span>
                              </div>
                              <p className={`text-[11px] truncate pr-2 ${
                                hasUnread 
                                  ? theme === 'light' ? 'text-gray-900 font-semibold' : 'text-gray-200 font-medium' 
                                  : theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                              }`}>
                                {isTyping ? (
                                  <span className="text-emerald-500 font-semibold flex items-center gap-1 animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block"></span>
                                    typing...
                                  </span>
                                ) : latestMsg ? (
                                  <>
                                    <span className={`text-[10px] uppercase mr-0.5 ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`}>
                                      {latestMsg.sender === user._id ? 'You: ' : ''}
                                    </span>
                                    {latestMsg.text}
                                  </>
                                ) : (
                                  <span className={`italic ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`}>No messages yet</span>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Unlock / remove lock button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLockModalMode('toggle_chat');
                                setLockModalTargetChat({
                                  _id: item.chat._id,
                                  userName: item.user.name,
                                  isLocked: true,
                                });
                                setIsLockModalOpen(true);
                              }}
                              title="Unlock this chat"
                              className={`p-1.5 rounded-lg transition-all ${
                                theme === 'light'
                                  ? 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                                  : 'text-gray-500 hover:text-emerald-400 hover:bg-white/10'
                              }`}
                            >
                              <Unlock className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Delete chat with ${item.user.name}?`)) {
                                  onDeleteChat?.(item.chat._id);
                                }
                              }}
                              title="Delete chat"
                              className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all ${
                                theme === 'light'
                                  ? 'text-gray-400 hover:text-red-500 hover:bg-gray-200'
                                  : 'text-gray-500 hover:text-red-400 hover:bg-white/10'
                              }`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Regular Chats List */}
            {filteredRegularChats.length === 0 && lockedChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <MessageSquare className={`w-8 h-8 mb-2 ${
                  theme === 'light' ? 'text-gray-300' : 'text-gray-600'
                }`} />
                <p className={`text-xs ${
                  theme === 'light' ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  {searchQuery ? "No conversations found" : "No active chats. Click '+' to start a new chat!"}
                </p>
              </div>
            ) : (
              filteredRegularChats.map((item) => {
                const isActive = activeChatId === item.chat._id;
                const isTyping = Boolean(typingChats[item.chat._id]) && !isActive;
                const hasUnread = item.chat.unseenCount > 0;
                const latestMsg = item.chat.latestMessage;
                
                return (
                  <div
                    key={item.chat._id}
                    onClick={() => onSelectChat(item)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all duration-200 text-left cursor-pointer group ${
                      isActive
                        ? theme === 'light'
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-950 shadow-sm'
                          : 'bg-indigo-500/10 border-indigo-500/30 text-white'
                        : theme === 'light'
                        ? 'border-transparent hover:bg-gray-100/80 text-gray-700'
                        : 'border-transparent hover:bg-white/5 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {/* Participant Avatar */}
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-500/10 to-purple-600/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-sm font-semibold uppercase font-display select-none flex-shrink-0">
                        {item.user.avatar?.url ? (
                          <img
                            src={getAvatarUrl(item.user.avatar.url)}
                            alt={item.user.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              if (item.user.avatar?.url && target.src !== item.user.avatar.url) {
                                target.src = item.user.avatar.url;
                              }
                            }}
                          />
                        ) : (
                          item.user.name.slice(0, 2)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h4 className={`text-xs font-semibold truncate font-display ${
                            isActive 
                              ? theme === 'light' ? 'text-indigo-700 font-bold' : 'text-indigo-300'
                              : theme === 'light' ? 'text-gray-900' : 'text-white'
                          }`}>
                            {item.user.name}
                          </h4>
                          <span className={`text-[9px] flex-shrink-0 ${
                            theme === 'light' ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {formatTime(item.chat.updatedAt)}
                          </span>
                        </div>
                        <p className={`text-[11px] truncate pr-2 ${
                          hasUnread 
                            ? theme === 'light' ? 'text-gray-900 font-semibold' : 'text-gray-200 font-medium' 
                            : theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                        }`}>
                          {isTyping ? (
                            <span className="text-emerald-500 font-semibold flex items-center gap-1 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block"></span>
                              typing...
                            </span>
                          ) : latestMsg ? (
                            <>
                              <span className={`text-[10px] uppercase mr-0.5 ${
                                theme === 'light' ? 'text-gray-400' : 'text-gray-500'
                              }`}>
                                {latestMsg.sender === user._id ? 'You: ' : ''}
                              </span>
                              {latestMsg.text}
                            </>
                          ) : (
                            <span className={`italic ${theme === 'light' ? 'text-gray-400' : 'text-gray-500'}`}>No messages yet</span>
                          )}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {/* Lock chat button (visible on hover) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLockModalMode('toggle_chat');
                          setLockModalTargetChat({
                            _id: item.chat._id,
                            userName: item.user.name,
                            isLocked: false,
                          });
                          setIsLockModalOpen(true);
                        }}
                        title="Lock chat (protect with passcode)"
                        className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all ${
                          theme === 'light'
                            ? 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                            : 'text-gray-500 hover:text-emerald-400 hover:bg-white/10'
                        }`}
                      >
                        <Lock className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete chat button (visible on hover) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete chat with ${item.user.name}?`)) {
                            onDeleteChat?.(item.chat._id);
                          }
                        }}
                        title="Delete chat"
                        className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all ${
                          theme === 'light'
                            ? 'text-gray-400 hover:text-red-500 hover:bg-gray-200'
                            : 'text-gray-500 hover:text-red-400 hover:bg-white/10'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Unread Message Badge */}
                      {hasUnread && (
                        <span className="ml-1 w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-[10px] font-bold text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 select-none animate-bounce">
                          {item.chat.unseenCount}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* TAB 2: STATUS / STORIES VIEW */}
      {activeTab === 'status' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* My Status Main Action Card */}
          <div
            className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
              theme === 'light'
                ? 'bg-gray-50/80 border-gray-200'
                : 'bg-white/5 border-white/10'
            }`}
          >
            <div
              onClick={() => {
                if (myStatuses.length > 0) {
                  openViewerForMyStatus(0);
                } else {
                  setIsCreateStatusOpen(true);
                }
              }}
              className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer"
            >
              {/* My Status Avatar */}
              <div className="relative flex-shrink-0">
                <div
                  className={`w-12 h-12 rounded-full p-0.5 ${
                    myStatuses.length > 0
                      ? 'bg-gradient-to-tr from-indigo-500 to-purple-600'
                      : 'border-2 border-dashed border-gray-400/50'
                  }`}
                >
                  <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-sm font-bold uppercase">
                    {user.avatar?.url ? (
                      <img
                        src={getAvatarUrl(user.avatar.url)}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      user.name.slice(0, 2)
                    )}
                  </div>
                </div>

                {/* Plus Icon Badge */}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
                  <Plus className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-semibold font-display truncate">
                  My Status
                </h4>
                <p className="text-[11px] text-gray-500 truncate">
                  {myStatuses.length > 0 ? (
                    <span className="text-indigo-500 font-medium">
                      {myStatuses.length} active update{myStatuses.length > 1 ? 's' : ''} • Tap to view all
                    </span>
                  ) : (
                    'Tap to add status update'
                  )}
                </p>
              </div>
            </div>

            {/* Quick Add Status Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCreateStatusOpen(true);
              }}
              title="Add New Status"
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all active:scale-95 flex-shrink-0 flex items-center gap-1 text-xs font-medium"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>

          {/* If user has posted statuses, list each individual status with views count and delete option */}
          {myStatuses.length > 0 && (
            <div className="space-y-1.5 pl-1">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-1">
                <span>My Active Updates ({myStatuses.length})</span>
                <span className="text-[10px] lowercase text-indigo-500">24h auto-expiry</span>
              </div>

              <div className="space-y-1">
                {myStatuses.map((st, idx) => (
                  <div
                    key={st._id}
                    onClick={() => openViewerForMyStatus(idx)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer group ${
                      theme === 'light'
                        ? 'bg-white border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40 shadow-xs'
                        : 'bg-white/5 border-white/5 hover:border-indigo-500/30 hover:bg-white/10'
                    }`}
                  >
                    {/* Status Preview Thumbnail */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        style={{ backgroundColor: st.type === 'text' ? (st.bgColor || '#6366f1') : '#000000' }}
                        className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm border border-black/10 relative"
                      >
                        {st.type === 'image' && st.media?.url ? (
                          <img
                            src={getMediaUrl(st.media.url)}
                            alt="thumb"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-white text-[10px] font-bold px-1 line-clamp-2 text-center leading-tight">
                            {st.content?.slice(0, 15) || 'Text'}
                          </span>
                        )}
                        <div className="absolute bottom-0.5 right-0.5 p-0.5 rounded bg-black/60 text-white text-[8px]">
                          {st.type === 'image' ? <ImageIcon className="w-2.5 h-2.5" /> : <Type className="w-2.5 h-2.5" />}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold truncate">
                            {st.type === 'text' ? st.content || 'Text status' : st.content || 'Photo status'}
                          </p>
                          {st.privacy === 'selected' ? (
                            <span title="Only selected contacts" className="text-[10px] text-amber-500 flex items-center gap-0.5">
                              <Lock className="w-3 h-3" />
                            </span>
                          ) : (
                            <span title="Everyone" className="text-[10px] text-gray-400 flex items-center gap-0.5">
                              <Globe className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-2">
                          <span>{formatStatusTime(st.createdAt)}</span>
                          <span>•</span>
                          <span className="text-indigo-500 font-medium flex items-center gap-0.5">
                            <Eye className="w-3 h-3" /> {st.viewers?.length || st.viewersCount || 0} viewed
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Delete Individual Status */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteIndividualStatus(st._id, e)}
                        title="Delete this status update"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 1: Recent Updates (Unviewed Contact Stories) */}
          {recentStatuses.filter((g) => !g.allViewed).length > 0 && (
            <div className="pt-2">
              <h5 className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500 px-1 mb-2 flex items-center gap-1.5">
                <span>Recent updates</span>
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">
                  {recentStatuses.filter((g) => !g.allViewed).length}
                </span>
              </h5>

              <div className="space-y-1">
                {recentStatuses.filter((g) => !g.allViewed).map((group) => {
                  const hasMultiple = group.statuses.length > 1;
                  return (
                    <div
                      key={group.user._id}
                      onClick={() => openViewerForContact(group)}
                      className={`w-full flex items-center gap-3.5 p-2.5 rounded-xl border transition-all cursor-pointer group ${
                        theme === 'light'
                          ? 'border-transparent hover:bg-gray-100/80'
                          : 'border-transparent hover:bg-white/5'
                      }`}
                    >
                      {/* Colorful Unviewed Story Ring */}
                      <div className="w-12 h-12 rounded-full p-0.5 flex-shrink-0 relative bg-gradient-to-tr from-indigo-500 via-purple-500 to-emerald-400 shadow-sm shadow-indigo-500/20">
                        <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-indigo-500/20 to-purple-600/20 text-indigo-500 flex items-center justify-center text-xs font-bold uppercase">
                          {group.user.avatar?.url ? (
                            <img
                              src={getAvatarUrl(group.user.avatar.url)}
                              alt={group.user.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            group.user.name.slice(0, 2)
                          )}
                        </div>

                        {/* Story count badge for unviewed */}
                        {hasMultiple && (
                          <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[9px] font-bold shadow-sm border border-white dark:border-[#111827]">
                            {group.statuses.length}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold font-display truncate group-hover:text-indigo-500 transition-colors">
                            {group.user.name}
                          </h4>
                          <span className="text-[10px] text-gray-400">
                            {formatStatusTime(group.latestCreatedAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium truncate mt-0.5">
                          {group.statuses.length} new update{group.statuses.length > 1 ? 's' : ''}
                        </p>
                      </div>

                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: Viewed Updates (Already Seen Stories) */}
          {recentStatuses.filter((g) => g.allViewed).length > 0 && (
            <div className="pt-2">
              <h5 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-1 mb-2 flex items-center gap-1">
                <span>Viewed updates</span>
                <span className="text-[10px] text-gray-500">({recentStatuses.filter((g) => g.allViewed).length})</span>
              </h5>

              <div className="space-y-1 opacity-80 hover:opacity-100 transition-opacity">
                {recentStatuses.filter((g) => g.allViewed).map((group) => {
                  return (
                    <div
                      key={group.user._id}
                      onClick={() => openViewerForContact(group)}
                      className={`w-full flex items-center gap-3.5 p-2.5 rounded-xl border transition-all cursor-pointer group ${
                        theme === 'light'
                          ? 'border-transparent hover:bg-gray-100/80'
                          : 'border-transparent hover:bg-white/5'
                      }`}
                    >
                      {/* Subtle Gray Viewed Ring */}
                      <div className="w-12 h-12 rounded-full p-0.5 flex-shrink-0 relative border-2 border-gray-400/40">
                        <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-indigo-500/20 to-purple-600/20 text-indigo-500 flex items-center justify-center text-xs font-bold uppercase">
                          {group.user.avatar?.url ? (
                            <img
                              src={getAvatarUrl(group.user.avatar.url)}
                              alt={group.user.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            group.user.name.slice(0, 2)
                          )}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-medium font-display truncate text-gray-400 group-hover:text-gray-200 transition-colors">
                            {group.user.name}
                          </h4>
                          <span className="text-[10px] text-gray-500">
                            {formatStatusTime(group.latestCreatedAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 truncate mt-0.5">
                          Viewed • {group.statuses.length} update{group.statuses.length > 1 ? 's' : ''}
                        </p>
                      </div>

                      <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state if no updates from anyone */}
          {recentStatuses.length === 0 && (
            <div className="py-8 text-center text-xs text-gray-500 px-4 border border-dashed rounded-2xl border-black/10 dark:border-white/10">
              <CircleDashed className="w-8 h-8 mx-auto mb-2 opacity-40 text-indigo-500 animate-spin-slow" />
              No status updates from contacts yet.
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <UserSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={user}
      />
      
      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onChatCreated={onChatCreated}
        currentUserId={user._id}
      />

      <CreateStatusModal
        isOpen={isCreateStatusOpen}
        onClose={() => setIsCreateStatusOpen(false)}
        onStatusCreated={() => fetchStatuses()}
        currentUserId={user._id}
      />

      <StatusViewerModal
        isOpen={Boolean(viewerGroup)}
        onClose={() => setViewerGroup(null)}
        statusGroup={viewerGroup}
        initialIndex={viewerInitialIndex}
        currentUserId={user._id}
        onDeleteStatus={(statusId) => {
          setMyStatuses((prev) => prev.filter((s) => s._id !== statusId));
          fetchStatuses();
        }}
        onStatusViewed={(statusId) => {
          setRecentStatuses((prev) =>
            prev.map((grp) => {
              const updatedStatuses = grp.statuses.map((s) =>
                s._id === statusId ? { ...s, isViewed: true } : s
              );
              const allViewed = updatedStatuses.every((s) => s.isViewed);
              return {
                ...grp,
                statuses: updatedStatuses,
                allViewed,
              };
            })
          );
        }}
      />

      <ChatLockModal
        isOpen={isLockModalOpen}
        onClose={() => setIsLockModalOpen(false)}
        mode={lockModalMode}
        targetChat={lockModalTargetChat}
        onSuccess={() => {
          fetchLockStatus();
          onChatLockChanged?.();
        }}
      />
    </div>
  );
};
