import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './Sidebar';
import type { ChatItem } from './Sidebar';
import { ChatArea } from './ChatArea';

import { chatApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { MessageSquare } from 'lucide-react';
import { useChatLock } from '../context/ChatLockContext';
import { NotificationToast, type ToastMessage } from './NotificationToast';
import { playMessageNotificationSound } from '../utils/sound';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { socket } = useSocket();
  const { lockedChatIds } = useChatLock();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [activeChat, setActiveChat] = useState<ChatItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<ToastMessage[]>([]);

  // Pinned Chats State (WhatsApp-style, Max 3 pinned chats per user)
  const [pinnedChatIds, setPinnedChatIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined' && user?._id) {
      try {
        const saved = localStorage.getItem(`chatsphere_pinned_${user._id}`);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    if (user?._id) {
      try {
        const saved = localStorage.getItem(`chatsphere_pinned_${user._id}`);
        setPinnedChatIds(saved ? JSON.parse(saved) : []);
      } catch {
        setPinnedChatIds([]);
      }
    }
  }, [user?._id]);

  const togglePinChat = (chatId: string) => {
    if (!chatId) return;
    setPinnedChatIds((prev) => {
      let updated: string[];
      if (prev.includes(chatId)) {
        updated = prev.filter((id) => id !== chatId);
      } else {
        if (prev.length >= 3) {
          alert("📌 You can only pin up to 3 conversations.");
          return prev;
        }
        updated = [chatId, ...prev];
      }
      if (user?._id) {
        try {
          localStorage.setItem(`chatsphere_pinned_${user._id}`, JSON.stringify(updated));
        } catch (e) {}
      }
      return updated;
    });
  };

  const [typingChats, setTypingChats] = useState<{ [chatId: string]: boolean }>({});
  const typingTimeoutsRef = useRef<{ [chatId: string]: any }>({});

  const activeChatRef = useRef<ChatItem | null>(null);
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  const chatsRef = useRef<ChatItem[]>([]);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  const lockedChatIdsRef = useRef<string[]>([]);
  useEffect(() => {
    lockedChatIdsRef.current = lockedChatIds;
  }, [lockedChatIds]);

  // Request browser notification permission once on user interaction
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      const handleUserInteraction = () => {
        Notification.requestPermission().catch(() => {});
      };
      window.addEventListener('click', handleUserInteraction, { once: true });
      return () => {
        window.removeEventListener('click', handleUserInteraction);
      };
    }
  }, []);

  const fetchChats = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await chatApi.get('/chat/all');
      const fetchedChats: ChatItem[] = res.data.chats || [];
      setChats(fetchedChats);

      // Keep current active chat object details synced without triggering unnecessary re-renders
      if (activeChatRef.current) {
        const updatedActive = fetchedChats.find(c => String(c.chat._id) === String(activeChatRef.current?.chat._id));
        if (updatedActive) {
          setActiveChat(prev => {
            if (!prev) return updatedActive;
            if (
              prev.chat._id === updatedActive.chat._id &&
              prev.user.name === updatedActive.user.name &&
              prev.user.avatar?.url === updatedActive.user.avatar?.url
            ) {
              return prev;
            }
            return updatedActive;
          });
        }
      }
    } catch (err) {
      console.error("Failed to load active chats list:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchChats(true);
  }, []);

  // Listen for real-time socket events
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (newMsg: any) => {
      // Check if message belongs to currently active conversation
      const isCurrentChat = activeChatRef.current?.chat._id === newMsg.chatId;

      // Clear typing indicator for this chat when a message arrives
      setTypingChats((prev) => ({ ...prev, [newMsg.chatId]: false }));
      if (typingTimeoutsRef.current[newMsg.chatId]) {
        clearTimeout(typingTimeoutsRef.current[newMsg.chatId]);
      }

      // Check if message is sent by another user
      const isFromOther = user && newMsg.sender !== user._id;

      if (isFromOther) {
        const currentChatsList = chatsRef.current;
        const matchingChat = currentChatsList.find(c => c.chat._id === newMsg.chatId);
        const senderUser = matchingChat?.user;
        const isLocked = lockedChatIdsRef.current.includes(newMsg.chatId);
        const senderName = senderUser?.name || 'Someone';
        const isTabHidden = typeof document !== 'undefined' && document.hidden;

        // 1. In-App Toaster & Sound: Show ONLY if the user is NOT currently inside this chat
        if (!isCurrentChat) {
          playMessageNotificationSound();

          const toastId = `${newMsg._id || Date.now()}_${Math.random()}`;

          const newToast: ToastMessage = {
            id: toastId,
            chatId: newMsg.chatId,
            senderId: newMsg.sender,
            senderName,
            senderAvatar: senderUser?.avatar || null,
            text: newMsg.text || '',
            messageType: newMsg.messageType || (newMsg.image ? 'image' : 'text'),
            fileOriginalName: newMsg.file?.originalName,
            isLocked,
            createdAt: newMsg.createdAt || new Date().toISOString(),
          };

          setNotifications((prev) => [newToast, ...prev.filter(n => n.chatId !== newMsg.chatId).slice(0, 2)]);
        }

        // 2. Desktop OS / Browser Notification: Show when tab is in background / minimized
        if (isTabHidden && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(isLocked ? 'ChatSphere' : senderName, {
              body: isLocked
                ? '🔒 You received a private message'
                : (newMsg.text || (newMsg.image ? '📷 Photo' : 'Sent an attachment')),
              icon: senderUser?.avatar?.url || '/favicon.svg',
            });
          } catch (e) {
            // Notification errors ignored safely
          }
        }
      }

      // If this conversation is brand new, re-fetch all chats
      const chatExists = chatsRef.current.some(c => c.chat._id === newMsg.chatId);
      if (!chatExists) {
        fetchChats(false);
      } else {
        setChats((prev) => {
          const updated = prev.map((c) => {
            if (c.chat._id === newMsg.chatId) {
              return {
                ...c,
                chat: {
                  ...c.chat,
                  latestMessage: {
                    text: newMsg.text || (newMsg.image ? '📷 Image' : ''),
                    sender: newMsg.sender,
                  },
                  updatedAt: new Date().toISOString(),
                  // If user is currently looking at this active chat, do NOT increment unseen count (keep 0)
                  unseenCount: isCurrentChat ? 0 : (c.chat.unseenCount || 0) + 1,
                },
              };
            }
            return c;
          });

          // Reorder list: most recent conversation moves to the top
          return updated.sort(
            (a, b) => new Date(b.chat.updatedAt).getTime() - new Date(a.chat.updatedAt).getTime()
          );
        });
      }
    };

    const handleMessagesSeen = ({ chatId: seenChatId }: { chatId: string }) => {
      setChats((prev) =>
        prev.map((c) =>
          c.chat._id === seenChatId
            ? { ...c, chat: { ...c.chat, unseenCount: 0 } }
            : c
        )
      );
    };

    const handleGlobalTyping = ({ chatId: tChatId }: { chatId: string }) => {
      if (!tChatId) return;
      setTypingChats((prev) => ({ ...prev, [tChatId]: true }));

      if (typingTimeoutsRef.current[tChatId]) {
        clearTimeout(typingTimeoutsRef.current[tChatId]);
      }

      // Auto clear typing state after 3 seconds of silence
      typingTimeoutsRef.current[tChatId] = setTimeout(() => {
        setTypingChats((prev) => ({ ...prev, [tChatId]: false }));
      }, 3000);
    };

    const handleGlobalStopTyping = ({ chatId: tChatId }: { chatId: string }) => {
      if (!tChatId) return;
      if (typingTimeoutsRef.current[tChatId]) {
        clearTimeout(typingTimeoutsRef.current[tChatId]);
      }
      setTypingChats((prev) => ({ ...prev, [tChatId]: false }));
    };

    const handleUserProfileUpdated = ({ user: updatedUser }: { user: any }) => {
      if (!updatedUser?._id) return;

      // 1. Instantly update user details across all chats in the sidebar
      setChats((prev) =>
        prev.map((c) =>
          c.user._id === updatedUser._id
            ? { ...c, user: { ...c.user, ...updatedUser } }
            : c
        )
      );

      // 2. If the updated user is currently open in activeChat, update activeChat as well
      setActiveChat((prev) => {
        if (prev && prev.user._id === updatedUser._id) {
          return {
            ...prev,
            user: { ...prev.user, ...updatedUser },
          };
        }
        return prev;
      });
    };

    const handleMessageDeletedEveryone = (data: { chatId: string; isLatest?: boolean; latestMessage?: any }) => {
      if (data.isLatest && data.latestMessage) {
        setChats((prev) =>
          prev.map((c) => {
            if (c.chat._id === data.chatId) {
              return {
                ...c,
                chat: {
                  ...c.chat,
                  latestMessage: data.latestMessage,
                },
              };
            }
            return c;
          })
        );
      }
    };

    socket.on('new-message', handleNewMessage);
    socket.on('messages-seen', handleMessagesSeen);
    socket.on('typing', handleGlobalTyping);
    socket.on('stop-typing', handleGlobalStopTyping);
    socket.on('user-profile-updated', handleUserProfileUpdated);
    socket.on('message-deleted-everyone', handleMessageDeletedEveryone);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('messages-seen', handleMessagesSeen);
      socket.off('typing', handleGlobalTyping);
      socket.off('stop-typing', handleGlobalStopTyping);
      socket.off('user-profile-updated', handleUserProfileUpdated);
      socket.off('message-deleted-everyone', handleMessageDeletedEveryone);
    };
  }, [socket, user]);

  // Handle starting a new conversation
  const handleChatCreated = async (newChatId: string, targetUser?: any) => {
    if (targetUser) {
      const initialChat: ChatItem = {
        chat: {
          _id: newChatId,
          users: [user?._id || '', targetUser._id],
          latestMessage: null,
          unseenCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        user: targetUser
      };
      setChats(prev => {
        const exists = prev.some(c => String(c.chat._id) === String(newChatId));
        return exists ? prev : [initialChat, ...prev];
      });
      setActiveChat(initialChat);
    }

    await fetchChats(false);
    
    try {
      const res = await chatApi.get('/chat/all');
      const latestChats: ChatItem[] = res.data.chats || [];
      const found = latestChats.find((item: ChatItem) => String(item.chat._id) === String(newChatId));
      if (found) {
        setActiveChat(found);
      }
    } catch (err) {
      console.error("Failed to select newly created chat:", err);
    }
  };

  const handleSelectChat = (selected: ChatItem) => {
    setActiveChat(selected);
    // Mark seen locally
    setChats(prev => prev.map(c => 
      c.chat._id === selected.chat._id 
        ? { ...c, chat: { ...c.chat, unseenCount: 0 } }
        : c
    ));
  };

  const handleDeleteChat = async (deletedChatId: string) => {
    try {
      await chatApi.delete(`/chat/${deletedChatId}`);
      if (activeChat?.chat._id === deletedChatId) {
        setActiveChat(null);
      }
      setChats(prev => prev.filter(c => c.chat._id !== deletedChatId));
    } catch (err) {
      console.error("Failed to delete chat:", err);
      alert("Failed to delete conversation. Please try again.");
    }
  };

  const handleDismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleOpenChatById = async (targetChatId: string) => {
    const found = chatsRef.current.find((c) => c.chat._id === targetChatId);
    if (found) {
      handleSelectChat(found);
    } else {
      try {
        const res = await chatApi.get('/chat/all');
        const latestChats: ChatItem[] = res.data.chats || [];
        setChats(latestChats);
        const freshlyFound = latestChats.find((c) => c.chat._id === targetChatId);
        if (freshlyFound) {
          handleSelectChat(freshlyFound);
        }
      } catch (e) {
        console.error("Failed to open chat from notification:", e);
      }
    }
  };

  if (!user) return null;

  return (
    <div className={`h-[100dvh] w-screen flex overflow-hidden relative font-sans transition-colors duration-300 ${
      theme === 'light' ? 'bg-[#f0f2f5] text-gray-900' : 'bg-[#0b0f19] text-gray-100'
    }`}>
      {/* WhatsApp Real-Time Incoming Notification Toast Banner */}
      <NotificationToast
        notifications={notifications}
        onDismiss={handleDismissNotification}
        onOpenChat={handleOpenChatById}
      />

      {/* Decorative background grid and blurs */}
      <div className={`absolute inset-0 bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none ${
        theme === 'light'
          ? 'bg-[linear-gradient(to_right,rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.03)_1px,transparent_1px)]'
          : 'bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)]'
      }`}></div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 animate-pulse">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span className={`text-sm font-medium ${
            theme === 'light' ? 'text-gray-600' : 'text-gray-400'
          }`}>Opening secure workspace...</span>
        </div>
      ) : (
        <div className="flex-1 flex h-full overflow-hidden z-10 relative">
          {/* Sidebar Panel: On mobile, visible when no active chat; on desktop, always visible */}
          <div className={`${activeChat ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-shrink-0 h-full flex-col`}>
            <Sidebar
              chats={chats}
              activeChatId={activeChat?.chat._id || null}
              typingChats={typingChats}
              pinnedChatIds={pinnedChatIds}
              onSelectChat={handleSelectChat}
              onChatCreated={handleChatCreated}
              onDeleteChat={handleDeleteChat}
              onTogglePin={togglePinChat}
              onChatLockChanged={() => fetchChats(false)}
            />
          </div>

          {/* Chat Panel: On mobile, visible when active chat selected; on desktop, always visible */}
          <div className={`${activeChat ? 'flex' : 'hidden md:flex'} flex-1 h-full overflow-hidden flex-col`}>
            <ChatArea
              chatId={activeChat?.chat._id || null}
              otherUser={activeChat?.user || null}
              isPinned={activeChat ? pinnedChatIds.includes(activeChat.chat._id) : false}
              onMessageSent={() => fetchChats(false)}
              onDeleteChat={handleDeleteChat}
              onTogglePin={togglePinChat}
              onBack={() => setActiveChat(null)}
              onChatLockChanged={() => fetchChats(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
