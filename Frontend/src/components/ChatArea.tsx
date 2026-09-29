import React, { useState, useEffect, useRef } from 'react';
import EmojiPicker, { Theme, EmojiStyle, type EmojiClickData } from 'emoji-picker-react';
import { chatApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme, CHAT_THEME_PRESETS, type ChatColorTheme } from '../context/ThemeContext';
import { 
  Send, 
  Image as ImageIcon, 
  X, 
  Check, 
  CheckCheck, 
  Paperclip, 
  Trash2, 
  Ban, 
  FileText, 
  Music, 
  Download, 
  File as FileIcon,
  Smile,
  Palette,
  Eraser,
  ArrowLeft,
  Lock,
  Unlock,
  MoreVertical,
  Pin,
  PinOff
} from 'lucide-react';
import { useChatLock } from '../context/ChatLockContext';
import { ChatLockModal, type ChatLockModalMode } from './ChatLockModal';

import { getAvatarUrl, getMediaUrl } from '../utils/api';

interface Message {
  _id: string;
  chatId: string;
  sender: string;
  text?: string;
  image?: {
    url: string;
    publicId: string;
  } | null;
  file?: {
    url: string;
    publicId?: string;
    originalName?: string;
    fileType?: string;
    size?: number;
  } | null;
  messageType: 'text' | 'image' | 'pdf' | 'docx' | 'audio' | 'file';
  delivered?: boolean;
  deliveredAt?: string | null;
  seen: boolean;
  seenAt?: string | null;
  deletedFor?: string[];
  isDeletedForEveryone?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ChatAreaProps {
  chatId: string | null;
  otherUser: {
    _id: string;
    name: string;
    email: string;
    avatar?: {
      url: string;
      publicId: string;
    } | null;
  } | null;
  isPinned?: boolean;
  onMessageSent: () => void;
  onDeleteChat?: (chatId: string) => void;
  onTogglePin?: (chatId: string) => void;
  onBack?: () => void;
  onChatLockChanged?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ 
  chatId, 
  otherUser, 
  isPinned = false,
  onMessageSent, 
  onDeleteChat, 
  onTogglePin,
  onBack,
  onChatLockChanged 
}) => {
  const { user } = useAuth();
  const { theme, chatTheme, setChatTheme, chatThemeConfig } = useTheme();
  const { socket, onlineUsers } = useSocket();
  const { lockedChatIds, isChatLocked, fetchLockStatus } = useChatLock();

  const isCurrentChatLocked = chatId ? isChatLocked(chatId) : false;
  const isChatInLockedList = chatId ? lockedChatIds.includes(chatId) : false;

  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [lockModalMode, setLockModalMode] = useState<ChatLockModalMode>('toggle_chat');

  const isOnline = otherUser ? onlineUsers.includes(otherUser._id) : false;
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<{ url: string; name: string; size: string; type: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [deleteTargetMessage, setDeleteTargetMessage] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showClearChatModal, setShowClearChatModal] = useState(false);
  const themePickerRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Track downloaded media IDs in localStorage like WhatsApp
  const [downloadedMedia, setDownloadedMedia] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('chat_downloaded_media');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to format file sizes
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Helper to resolve Cloudinary or local upload URLs securely
  const getFileUrl = (url?: string) => {
    return getMediaUrl(url);
  };

  // On-demand media download handler
  const handleDownloadMedia = (msgId: string, url?: string, filename?: string) => {
    if (!url) return;

    setDownloadedMedia((prev) => {
      const next = new Set(prev);
      next.add(msgId);
      try {
        localStorage.setItem('chat_downloaded_media', JSON.stringify(Array.from(next)));
      } catch (e) {
        console.error('Failed to save downloaded media state:', e);
      }
      return next;
    });

    const downloadUrl = getFileUrl(url);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename || 'download';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Handle emoji selection
  const handleEmojiClick = (emojiData: EmojiClickData | string) => {
    const emojiChar = typeof emojiData === 'string' ? emojiData : emojiData?.emoji;
    if (!emojiChar) return;

    setText((prev) => {
      const updated = prev + emojiChar;

      if (socket && chatId && otherUser) {
        socket.emit('typing', {
          chatId,
          receiverId: otherUser._id,
          senderId: user?._id,
        });

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
          socket.emit('stop-typing', {
            chatId,
            receiverId: otherUser._id,
            senderId: user?._id,
          });
        }, 2000);
      }

      return updated;
    });

    textInputRef.current?.focus();
  };

  // Close emoji, theme picker, & mobile menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(target) &&
        !target?.closest('.emoji-toggle-btn') &&
        !target?.closest('.EmojiPickerReact') &&
        !target?.closest('.epr-main')
      ) {
        setShowEmojiPicker(false);
      }

      if (
        themePickerRef.current &&
        !themePickerRef.current.contains(target) &&
        !target?.closest('.theme-toggle-btn')
      ) {
        setShowThemePicker(false);
      }

      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(target) &&
        !target?.closest('.mobile-menu-btn')
      ) {
        setShowMobileMenu(false);
      }
    };

    if (showEmojiPicker || showThemePicker || showMobileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker, showThemePicker, showMobileMenu]);

  // Fetch messages function
  const fetchMessages = async (showLoading = false) => {
    if (!chatId) return;
    if (showLoading) setLoading(true);
    try {
      const res = await chatApi.get(`/message/${chatId}`);
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Trigger scroll to bottom
  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Load messages on chat swap
  const prevChatIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (chatId) {
      const isNewChat = prevChatIdRef.current !== chatId;
      prevChatIdRef.current = chatId;
      if (isNewChat) {
        fetchMessages(true);
        setText('');
        setSelectedFile(null);
        setFilePreview(null);
        setIsOtherUserTyping(false);
        setDeleteTargetMessage(null);
        setShowEmojiPicker(false);
      }
    } else {
      prevChatIdRef.current = null;
      setMessages([]);
      setShowEmojiPicker(false);
    }
  }, [chatId]);

  // Scroll on new messages loaded or typing state change
  useEffect(() => {
    scrollToBottom('auto');
  }, [messages.length, isOtherUserTyping]);

  // Listen for real-time socket events
  useEffect(() => {
    if (!socket || !chatId || !otherUser) return;

    const handleNewMessage = (message: Message) => {
      if (message.chatId === chatId) {
        setIsOtherUserTyping(false);
        setMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev;
          return [...prev, message];
        });

        // If message is from the other user, instantly mark as seen and broadcast seen event
        if (message.sender === otherUser._id) {
          socket.emit('mark-seen', {
            chatId,
            senderId: user?._id,
            receiverId: otherUser._id,
          });
        }
      }
    };

    const handleMessagesDelivered = ({ chatId: delivChatId }: { chatId: string }) => {
      if (delivChatId === chatId) {
        setMessages((prev) =>
          prev.map((msg) => (msg.sender === user?._id ? { ...msg, delivered: true } : msg))
        );
      }
    };

    const handleMessagesSeen = ({ chatId: seenChatId }: { chatId: string }) => {
      if (seenChatId === chatId) {
        setMessages((prev) =>
          prev.map((msg) => (msg.sender === user?._id ? { ...msg, seen: true, delivered: true } : msg))
        );
      }
    };

    const handleTyping = ({ chatId: tChatId }: { chatId: string }) => {
      if (tChatId === chatId) {
        setIsOtherUserTyping(true);
      }
    };

    const handleStopTyping = ({ chatId: tChatId }: { chatId: string }) => {
      if (tChatId === chatId) {
        setIsOtherUserTyping(false);
      }
    };

    const handleMessageDeletedEveryone = (data: { messageId: string; chatId: string; text?: string }) => {
      if (data.chatId === chatId) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === data.messageId
              ? {
                  ...m,
                  isDeletedForEveryone: true,
                  text: data.text || "This message was deleted",
                  image: null,
                  file: null,
                }
              : m
          )
        );
      }
    };

    socket.on('new-message', handleNewMessage);
    socket.on('messages-delivered', handleMessagesDelivered);
    socket.on('messages-seen', handleMessagesSeen);
    socket.on('typing', handleTyping);
    socket.on('stop-typing', handleStopTyping);
    socket.on('message-deleted-everyone', handleMessageDeletedEveryone);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('messages-delivered', handleMessagesDelivered);
      socket.off('messages-seen', handleMessagesSeen);
      socket.off('typing', handleTyping);
      socket.off('stop-typing', handleStopTyping);
      socket.off('message-deleted-everyone', handleMessageDeletedEveryone);
    };
  }, [socket, chatId, otherUser, user]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);

    if (!socket || !chatId || !otherUser) return;

    socket.emit('typing', {
      chatId,
      receiverId: otherUser._id,
      senderId: user?._id,
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop-typing', {
        chatId,
        receiverId: otherUser._id,
        senderId: user?._id,
      });
    }, 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert('File size exceeds 25MB limit.');
      return;
    }

    setSelectedFile(file);

    const mime = file.type.toLowerCase();
    const name = file.name.toLowerCase();

    let detectedType = 'file';
    if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name)) {
      detectedType = 'image';
    } else if (mime === 'application/pdf' || name.endsWith('.pdf')) {
      detectedType = 'pdf';
    } else if (mime.includes('word') || /\.(doc|docx)$/i.test(name)) {
      detectedType = 'docx';
    } else if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(name)) {
      detectedType = 'audio';
    }

    if (detectedType === 'image') {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview({
          url: reader.result as string,
          name: file.name,
          size: formatFileSize(file.size),
          type: 'image',
        });
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview({
        url: URL.createObjectURL(file),
        name: file.name,
        size: formatFileSize(file.size),
        type: detectedType,
      });
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatId || (!text.trim() && !selectedFile) || sending) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (socket && otherUser) {
      socket.emit('stop-typing', {
        chatId,
        receiverId: otherUser._id,
        senderId: user?._id,
      });
    }

    setSending(true);
    try {
      const formData = new FormData();
      formData.append('chatId', chatId);
      if (text.trim()) {
        formData.append('text', text.trim());
      }
      if (selectedFile) {
        if (selectedFile.type.startsWith('image/')) {
          formData.append('image', selectedFile);
        } else {
          formData.append('file', selectedFile);
        }
      }

      await chatApi.post('/message', formData);

      // Clear input fields
      setText('');
      removeSelectedFile();
      setShowEmojiPicker(false);
      // Instantly refresh messages & trigger sidebar refresh
      await fetchMessages(false);
      onMessageSent();
    } catch (err) {
      console.error("Failed to send message:", err);
      alert("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteForEveryone = async () => {
    if (!deleteTargetMessage) return;
    try {
      await chatApi.delete(`/message/${deleteTargetMessage._id}/everyone`);
      setMessages((prev) =>
        prev.map((m) =>
          m._id === deleteTargetMessage._id
            ? { ...m, isDeletedForEveryone: true, text: "This message was deleted", image: null, file: null }
            : m
        )
      );
      setDeleteTargetMessage(null);
      onMessageSent();
    } catch (err: any) {
      console.error("Failed to delete for everyone:", err);
      alert(err.response?.data?.message || "Failed to delete message for everyone.");
    }
  };

  const handleDeleteForMe = async () => {
    if (!deleteTargetMessage) return;
    try {
      await chatApi.delete(`/message/${deleteTargetMessage._id}`);
      setMessages((prev) => prev.filter((m) => m._id !== deleteTargetMessage._id));
      setDeleteTargetMessage(null);
      onMessageSent();
    } catch (err) {
      console.error("Failed to delete message:", err);
      alert("Failed to delete message. Please try again.");
    }
  };

  const handleClearChat = async () => {
    if (!chatId) return;
    try {
      await chatApi.put(`/chat/${chatId}/clear`);
      setMessages([]);
      setShowClearChatModal(false);
      onMessageSent();
    } catch (err: any) {
      console.error("Failed to clear chat history:", err);
      alert(err.response?.data?.message || "Failed to clear chat history. Please try again.");
    }
  };

  const handleDeleteChat = () => {
    if (!chatId) return;
    if (!window.confirm(`Are you sure you want to delete this chat with ${otherUser?.name || 'this user'}?`)) return;
    if (onDeleteChat) {
      onDeleteChat(chatId);
    }
  };

  // Helper to format message timestamps nicely
  const formatMsgTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  if (!chatId || !otherUser) {
    return (
      <div className={`flex-1 h-full flex flex-col items-center justify-center text-center px-6 transition-colors duration-300 ${
        theme === 'light' ? 'bg-[#f0f2f5]/80' : 'bg-[#0b0f19]/40'
      }`}>
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border mb-4 animate-pulse ${
          theme === 'light'
            ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
            : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
        }`}>
          <Paperclip className="w-8 h-8" />
        </div>
        <h2 className={`text-xl font-bold font-display mb-1.5 ${
          theme === 'light' ? 'text-gray-900' : 'text-white'
        }`}>
          No Active Conversation
        </h2>
        <p className={`text-sm max-w-sm ${
          theme === 'light' ? 'text-gray-500' : 'text-gray-400'
        }`}>
          Select an active chat from the sidebar or click the '+' button to search the directory and start a new secure conversation.
        </p>
      </div>
    );
  }

  return (
    <div className={`flex-1 h-full flex flex-col relative transition-colors duration-300 ${
      theme === 'light' ? 'bg-[#efeae2]/50' : 'bg-[#0b0f19]/25'
    }`}>
      {/* Visual background ambient lights */}
      <div className={`absolute top-10 right-10 w-80 h-80 ${
        theme === 'dark' ? chatThemeConfig.ambientDark : chatThemeConfig.ambientLight
      } rounded-full blur-[100px] pointer-events-none transition-colors duration-500`}></div>
      
      {/* Active Chat Header */}
      <div className={`px-3 py-2.5 sm:px-4 sm:py-3.5 border-b flex items-center justify-between backdrop-blur-md z-20 relative ${
        theme === 'light'
          ? 'bg-white/95 border-gray-200 shadow-xs'
          : 'bg-[#111827]/60 border-white/10'
      }`}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              title="Back to conversation list"
              className={`p-2 -ml-1 rounded-xl md:hidden active:scale-95 transition-all flex-shrink-0 ${
                theme === 'light'
                  ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden bg-gradient-to-br ${chatThemeConfig.sentBubble} text-white border ${chatThemeConfig.accentBorder}/40 flex items-center justify-center font-semibold uppercase font-display select-none flex-shrink-0 shadow-sm relative`}>
            <span className="text-xs sm:text-sm font-semibold uppercase select-none">{otherUser.name.slice(0, 2)}</span>
            {otherUser.avatar?.url && (
              <img
                src={getAvatarUrl(otherUser.avatar.url)}
                alt={otherUser.name}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
          </div>
          <div className="flex flex-col text-left min-w-0 flex-1">
            <h3 className={`text-sm sm:text-base font-semibold font-display flex items-center gap-1.5 min-w-0 ${
              theme === 'light' ? 'text-gray-900' : 'text-white'
            }`}>
              <span className="truncate max-w-full font-bold">{otherUser.name}</span>
              {isOnline ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0"></span>
              )}
            </h3>
            {isOtherUserTyping ? (
              <span className={`text-[11px] ${chatThemeConfig.accentText} font-semibold flex items-center gap-1.5 animate-pulse truncate`}>
                <span className={`w-1.5 h-1.5 rounded-full ${chatThemeConfig.accentBg} animate-ping flex-shrink-0`}></span>
                typing...
              </span>
            ) : (
              <span className={`text-[10px] sm:text-xs truncate ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
                {isOnline ? 'Active now' : 'Offline'}
              </span>
            )}
          </div>
        </div>

        {/* Chat Header Actions */}
        <div className="flex items-center gap-1 flex-shrink-0 relative">
          {/* Chat Theme Palette Picker */}
          <button
            type="button"
            onClick={() => setShowThemePicker((prev) => !prev)}
            title="Change Chat Theme Color"
            className={`theme-toggle-btn p-2 rounded-xl active:scale-95 transition-all relative ${
              showThemePicker
                ? `${chatThemeConfig.accentBg} text-white shadow-sm`
                : theme === 'light'
                ? 'text-gray-600 hover:text-indigo-600 hover:bg-gray-100'
                : 'text-gray-300 hover:text-indigo-400 hover:bg-white/5'
            }`}
          >
            <Palette className="w-4.5 h-4.5" />
            <span
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#111827]"
              style={{ backgroundColor: chatThemeConfig.dotColor }}
            />
          </button>

          {/* Theme Palette Popup Dropdown */}
          {showThemePicker && (
            <div
              ref={themePickerRef}
              className={`absolute top-full right-0 mt-2 w-64 p-3 rounded-2xl shadow-2xl border z-50 animate-scale-up ${
                theme === 'light'
                  ? 'bg-white border-gray-200 text-gray-900 shadow-xl'
                  : 'bg-[#111827] border-white/10 text-white shadow-2xl'
              }`}
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200 dark:border-white/10">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Chat Theme Color
                </span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: `${chatThemeConfig.dotColor}25`,
                    color: chatThemeConfig.dotColor,
                  }}
                >
                  {chatThemeConfig.name}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(CHAT_THEME_PRESETS) as ChatColorTheme[]).map((key) => {
                  const preset = CHAT_THEME_PRESETS[key];
                  const isSelected = chatTheme === key;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setChatTheme(key);
                        setShowThemePicker(false);
                      }}
                      title={preset.name}
                      className={`group relative p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/20 shadow-xs'
                          : 'border-transparent hover:border-gray-200 dark:hover:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full bg-gradient-to-tr ${preset.sentBubble} flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 ${
                          isSelected ? 'ring-2 ring-offset-2 ring-indigo-500 ring-offset-white dark:ring-offset-[#111827]' : ''
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <span className={`text-[9px] truncate max-w-full text-center ${
                        isSelected ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {preset.name.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Desktop Direct Action Icons */}
          <div className="hidden md:flex items-center gap-1">
            {/* Pin / Unpin Chat Button (Max 3) */}
            <button
              type="button"
              onClick={() => chatId && onTogglePin?.(chatId)}
              title={isPinned ? "Unpin Conversation" : "Pin Conversation (Max 3)"}
              className={`p-2 rounded-xl active:scale-95 transition-all ${
                isPinned
                  ? 'text-indigo-500 bg-indigo-500/10 hover:bg-indigo-500/20'
                  : theme === 'light'
                  ? 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                  : 'text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10'
              }`}
            >
              {isPinned ? <PinOff className="w-4.5 h-4.5 text-indigo-500" /> : <Pin className="w-4.5 h-4.5" />}
            </button>

            {/* Lock / Unlock Chat Button */}
            <button
              type="button"
              onClick={() => {
                setLockModalMode('toggle_chat');
                setIsLockModalOpen(true);
              }}
              title={isChatInLockedList ? (isCurrentChatLocked ? "Unlock chat" : "Remove Chat Lock") : "Lock Chat (Secret Passcode)"}
              className={`p-2 rounded-xl active:scale-95 transition-all ${
                isChatInLockedList
                  ? 'text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20'
                  : theme === 'light'
                  ? 'text-gray-500 hover:text-emerald-600 hover:bg-emerald-50'
                  : 'text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              {isChatInLockedList ? <Lock className="w-4.5 h-4.5 text-emerald-500" /> : <Lock className="w-4.5 h-4.5" />}
            </button>

            {/* Clear Chat Button */}
            <button
              type="button"
              onClick={() => setShowClearChatModal(true)}
              title="Clear Chat History"
              className={`p-2 rounded-xl active:scale-95 transition-all ${
                theme === 'light'
                  ? 'text-gray-500 hover:text-amber-600 hover:bg-amber-50'
                  : 'text-gray-400 hover:text-amber-400 hover:bg-amber-500/10'
              }`}
            >
              <Eraser className="w-4.5 h-4.5" />
            </button>

            {/* Delete Conversation Button */}
            <button
              onClick={handleDeleteChat}
              title="Delete conversation for me"
              className={`p-2 rounded-xl active:scale-95 transition-all ${
                theme === 'light'
                  ? 'text-gray-500 hover:text-red-500 hover:bg-red-50'
                  : 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
              }`}
            >
              <Trash2 className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Mobile 3-Dots More Options Dropdown */}
          <div className="relative md:hidden">
            <button
              type="button"
              onClick={() => setShowMobileMenu((prev) => !prev)}
              title="More Options"
              className={`mobile-menu-btn p-2 rounded-xl active:scale-95 transition-all ${
                showMobileMenu
                  ? 'bg-indigo-500/20 text-indigo-500'
                  : theme === 'light'
                  ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMobileMenu && (
              <div
                ref={mobileMenuRef}
                className={`absolute top-full right-0 mt-2 w-52 p-2 rounded-2xl shadow-2xl border z-50 animate-scale-up ${
                  theme === 'light'
                    ? 'bg-white border-gray-200 text-gray-900 shadow-xl'
                    : 'bg-[#111827] border-white/10 text-white shadow-2xl'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMenu(false);
                    if (chatId) onTogglePin?.(chatId);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                    isPinned
                      ? 'text-indigo-500 hover:bg-indigo-500/10'
                      : theme === 'light'
                      ? 'text-gray-700 hover:bg-gray-100'
                      : 'text-gray-200 hover:bg-white/5'
                  }`}
                >
                  {isPinned ? <PinOff className="w-4 h-4 text-indigo-500" /> : <Pin className="w-4 h-4 text-indigo-500" />}
                  <span>{isPinned ? "Unpin Conversation" : "Pin Conversation (Max 3)"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMenu(false);
                    setLockModalMode('toggle_chat');
                    setIsLockModalOpen(true);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                    isChatInLockedList
                      ? 'text-emerald-500 hover:bg-emerald-500/10'
                      : theme === 'light'
                      ? 'text-gray-700 hover:bg-gray-100'
                      : 'text-gray-200 hover:bg-white/5'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  <span>{isChatInLockedList ? (isCurrentChatLocked ? "Unlock chat" : "Remove Chat Lock") : "Lock Chat"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMenu(false);
                    setShowClearChatModal(true);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                    theme === 'light'
                      ? 'text-gray-700 hover:bg-amber-50 hover:text-amber-600'
                      : 'text-gray-200 hover:bg-amber-500/10 hover:text-amber-400'
                  }`}
                >
                  <Eraser className="w-4 h-4 text-amber-500" />
                  <span>Clear Chat History</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMenu(false);
                    handleDeleteChat();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Conversation</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Body: Locked Screen vs Messages */}
      {isCurrentChatLocked ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 text-emerald-500 border border-emerald-500/30 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/10">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className={`text-base sm:text-lg font-bold font-display tracking-tight mb-1.5 ${
            theme === 'light' ? 'text-gray-900' : 'text-white'
          }`}>
            This chat is locked
          </h3>
          <p className={`text-xs max-w-xs leading-relaxed mb-6 ${
            theme === 'light' ? 'text-gray-500' : 'text-gray-400'
          }`}>
            Messages and media in this conversation are shielded by your Secret Passcode.
          </p>
          <button
            type="button"
            onClick={() => {
              setLockModalMode('unlock_folder');
              setIsLockModalOpen(true);
            }}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/25 active:scale-95 transition-all flex items-center gap-2"
          >
            <Unlock className="w-4 h-4" />
            <span>Unlock Chat</span>
          </button>
        </div>
      ) : (
        <>
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 z-10">
        {loading ? (
          <div className={`h-full flex items-center justify-center text-sm gap-2 ${
            theme === 'light' ? 'text-gray-500' : 'text-gray-400'
          }`}>
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading message logs...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <span className={`text-xs italic ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
              No messages in this chat yet. Start the conversation!
            </span>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === user?._id;
            const isDeleted = msg.isDeletedForEveryone;
            
            return (
              <div
                key={msg._id}
                className={`flex w-full group ${isMe ? 'justify-end' : 'justify-start'} items-center gap-1.5`}
              >
                {/* Delete button on left for sent messages */}
                {isMe && (
                  <button
                    onClick={() => setDeleteTargetMessage(msg)}
                    title="Delete message"
                    className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all ${
                      theme === 'light'
                        ? 'text-gray-400 hover:text-red-500 hover:bg-gray-200/60'
                        : 'text-gray-500 hover:text-red-400 hover:bg-white/5'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[75%] md:max-w-[70%] rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 relative flex flex-col ${
                    isDeleted
                      ? theme === 'light'
                        ? 'bg-gray-200/70 border border-gray-300 text-gray-500 italic rounded-tl-sm'
                        : 'bg-white/5 border border-white/5 text-gray-400 italic rounded-tl-sm'
                      : isMe
                      ? `bg-gradient-to-tr ${chatThemeConfig.sentBubble} text-white rounded-tr-sm shadow-md ${chatThemeConfig.shadowGlow}`
                      : theme === 'light'
                      ? 'bg-white border border-gray-200/90 text-gray-900 shadow-sm rounded-tl-sm'
                      : 'bg-white/5 border border-white/5 text-gray-200 rounded-tl-sm'
                  }`}
                >
                  {isDeleted ? (
                    <div className={`flex items-center gap-2 py-0.5 select-none text-xs ${
                      isMe ? 'text-white/70' : theme === 'light' ? 'text-gray-500' : 'text-white/50'
                    }`}>
                      <Ban className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                      <span>{isMe ? "You deleted this message" : "This message was deleted"}</span>
                    </div>
                  ) : (
                    <>
                      {/* Image attachment rendering */}
                      {(msg.messageType === 'image' || msg.image || msg.file?.fileType === 'image') && (msg.file?.url || msg.image?.url) && (
                        <div className="mb-2 rounded-xl overflow-hidden max-w-full border border-black/10 bg-black/5 relative group/img min-h-[140px] flex items-center justify-center">
                          <a href={getFileUrl(msg.file?.url || msg.image?.url)} target="_blank" rel="noopener noreferrer" className="block w-full">
                            <img
                              src={getFileUrl(msg.file?.url || msg.image?.url)}
                              alt="Attachment"
                              className="max-h-64 w-full object-cover rounded-xl hover:opacity-95 transition-all duration-200"
                              loading="lazy"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.closest('.group\\/img');
                                if (parent) {
                                  const fallbackDiv = parent.querySelector('.img-error-fallback') as HTMLElement;
                                  if (fallbackDiv) fallbackDiv.style.display = 'flex';
                                }
                              }}
                            />
                          </a>
                          <div className="img-error-fallback hidden flex-col items-center justify-center p-4 text-center w-full min-h-[120px]">
                            <ImageIcon className="w-8 h-8 opacity-40 mb-1.5" />
                            <span className="text-[11px] font-medium opacity-80 mb-2">Photo attachment</span>
                            <a
                              href={getFileUrl(msg.file?.url || msg.image?.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={msg.file?.originalName || 'image.jpg'}
                              className="px-3 py-1 bg-black/30 hover:bg-black/50 rounded-lg text-xs flex items-center gap-1"
                            >
                              <Download className="w-3.5 h-3.5" /> Download
                            </a>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDownloadMedia(msg._id, msg.file?.url || msg.image?.url, msg.file?.originalName || 'image.jpg')}
                            title="Download image"
                            className="absolute bottom-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg opacity-0 group-hover/img:opacity-100 transition-opacity shadow-md"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* PDF Document card rendering */}
                      {(msg.messageType === 'pdf' || msg.file?.fileType === 'pdf') && (msg.file?.url || msg.image?.url) && (
                        <div className={`mb-2 p-3 border rounded-xl flex items-center justify-between gap-3 transition-all ${
                          theme === 'light' && !isMe
                            ? 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                            : 'bg-black/20 hover:bg-black/30 border-white/10'
                        }`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0 text-red-500">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 text-left">
                              <span className={`text-xs font-semibold truncate block max-w-[170px] ${
                                isMe ? 'text-white' : theme === 'light' ? 'text-gray-900' : 'text-white'
                              }`}>
                                {msg.file?.originalName || 'Document.pdf'}
                              </span>
                              <span className={`text-[10px] block ${
                                isMe ? 'text-white/70' : theme === 'light' ? 'text-gray-500' : 'text-white/60'
                              }`}>
                                {msg.file?.size ? formatFileSize(msg.file.size) : 'PDF Document'}
                              </span>
                            </div>
                          </div>
                          {isMe || downloadedMedia.has(msg._id) ? (
                            <a
                              href={getFileUrl(msg.file?.url || msg.image?.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={msg.file?.originalName || 'Document.pdf'}
                              className={`p-2 rounded-lg transition-all flex-shrink-0 ${
                                isMe ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-gray-200/70 hover:bg-gray-300 text-gray-800'
                              }`}
                              title="Open / Download PDF"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDownloadMedia(msg._id, msg.file?.url || msg.image?.url, msg.file?.originalName || 'Document.pdf')}
                              className={`p-2 ${chatThemeConfig.accentBg} hover:opacity-90 text-white rounded-lg transition-all flex-shrink-0 flex items-center gap-1.5 shadow-md active:scale-95`}
                              title="Download PDF"
                            >
                              <Download className="w-4 h-4" />
                              <span className="text-[10px] font-medium hidden sm:inline">
                                {msg.file?.size ? formatFileSize(msg.file.size) : 'Download'}
                              </span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Word DOCX document card rendering */}
                      {(msg.messageType === 'docx' || msg.file?.fileType === 'docx') && (msg.file?.url || msg.image?.url) && (
                        <div className={`mb-2 p-3 border rounded-xl flex items-center justify-between gap-3 transition-all ${
                          theme === 'light' && !isMe
                            ? 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                            : 'bg-black/20 hover:bg-black/30 border-white/10'
                        }`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 text-blue-500">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 text-left">
                              <span className={`text-xs font-semibold truncate block max-w-[170px] ${
                                isMe ? 'text-white' : theme === 'light' ? 'text-gray-900' : 'text-white'
                              }`}>
                                {msg.file?.originalName || 'Document.docx'}
                              </span>
                              <span className={`text-[10px] block ${
                                isMe ? 'text-white/70' : theme === 'light' ? 'text-gray-500' : 'text-white/60'
                              }`}>
                                {msg.file?.size ? formatFileSize(msg.file.size) : 'Word Document'}
                              </span>
                            </div>
                          </div>
                          {isMe || downloadedMedia.has(msg._id) ? (
                            <a
                              href={getFileUrl(msg.file?.url || msg.image?.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={msg.file?.originalName || 'Document.docx'}
                              className={`p-2 rounded-lg transition-all flex-shrink-0 ${
                                isMe ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-gray-200/70 hover:bg-gray-300 text-gray-800'
                              }`}
                              title="Open / Download Document"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDownloadMedia(msg._id, msg.file?.url || msg.image?.url, msg.file?.originalName || 'Document.docx')}
                              className={`p-2 ${chatThemeConfig.accentBg} hover:opacity-90 text-white rounded-lg transition-all flex-shrink-0 flex items-center gap-1.5 shadow-md active:scale-95`}
                              title="Download Document"
                            >
                              <Download className="w-4 h-4" />
                              <span className="text-[10px] font-medium hidden sm:inline">
                                {msg.file?.size ? formatFileSize(msg.file.size) : 'Download'}
                              </span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Audio message card rendering */}
                      {(msg.messageType === 'audio' || msg.file?.fileType === 'audio') && (msg.file?.url || msg.image?.url) && (
                        isMe || downloadedMedia.has(msg._id) ? (
                          <div className={`mb-2 p-3 border rounded-xl flex flex-col gap-2 min-w-[220px] ${
                            theme === 'light' && !isMe
                              ? 'bg-gray-50 border-gray-200'
                              : 'bg-black/20 border-white/10'
                          }`}>
                            <div className="flex items-center justify-between gap-2 text-left">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-500 flex-shrink-0">
                                  <Music className="w-3.5 h-3.5" />
                                </div>
                                <span className={`text-xs font-medium truncate max-w-[150px] ${
                                  isMe ? 'text-white' : theme === 'light' ? 'text-gray-900' : 'text-white'
                                }`}>
                                  {msg.file?.originalName || 'Audio track'}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDownloadMedia(msg._id, msg.file?.url || msg.image?.url, msg.file?.originalName || 'audio.mp3')}
                                className={`p-1 transition-colors ${
                                  isMe ? 'text-white/70 hover:text-white' : theme === 'light' ? 'text-gray-500 hover:text-gray-900' : 'text-gray-400 hover:text-white'
                                }`}
                                title="Download audio file"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <audio
                              controls
                              src={getFileUrl(msg.file?.url || msg.image?.url)}
                              className="w-full h-8 rounded-lg"
                            />
                          </div>
                        ) : (
                          <div className={`mb-2 p-3 border rounded-xl flex items-center justify-between gap-3 min-w-[220px] ${
                            theme === 'light' && !isMe
                              ? 'bg-gray-50 border-gray-200'
                              : 'bg-black/30 border-white/10'
                          }`}>
                            <div className="flex items-center gap-2.5 text-left min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-500 flex-shrink-0">
                                <Music className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <span className={`text-xs font-semibold truncate block max-w-[130px] ${
                                  isMe ? 'text-white' : theme === 'light' ? 'text-gray-900' : 'text-white'
                                }`}>
                                  {msg.file?.originalName || 'Audio track'}
                                </span>
                                <span className={`text-[10px] block ${
                                  isMe ? 'text-white/70' : theme === 'light' ? 'text-gray-500' : 'text-white/60'
                                }`}>
                                  {msg.file?.size ? formatFileSize(msg.file.size) : 'Audio file'}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDownloadMedia(msg._id, msg.file?.url || msg.image?.url, msg.file?.originalName || 'audio.mp3')}
                              className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all flex-shrink-0 flex items-center gap-1 shadow-md active:scale-95"
                              title="Download Audio"
                            >
                              <Download className="w-4 h-4" />
                              <span className="text-[10px] font-medium hidden sm:inline">
                                {msg.file?.size ? formatFileSize(msg.file.size) : 'Download'}
                              </span>
                            </button>
                          </div>
                        )
                      )}

                      {/* Generic File attachment rendering */}
                      {msg.messageType === 'file' && (msg.file?.url || msg.image?.url) && (
                        <div className={`mb-2 p-3 border rounded-xl flex items-center justify-between gap-3 transition-all ${
                          theme === 'light' && !isMe
                            ? 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                            : 'bg-black/20 hover:bg-black/30 border-white/10'
                        }`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-gray-500/20 border border-gray-500/30 flex items-center justify-center flex-shrink-0 text-gray-500">
                              <FileIcon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 text-left">
                              <span className={`text-xs font-semibold truncate block max-w-[170px] ${
                                isMe ? 'text-white' : theme === 'light' ? 'text-gray-900' : 'text-white'
                              }`}>
                                {msg.file?.originalName || 'Attachment'}
                              </span>
                              <span className={`text-[10px] block ${
                                isMe ? 'text-white/70' : theme === 'light' ? 'text-gray-500' : 'text-white/60'
                              }`}>
                                {msg.file?.size ? formatFileSize(msg.file.size) : 'File'}
                              </span>
                            </div>
                          </div>
                          {isMe || downloadedMedia.has(msg._id) ? (
                            <a
                              href={getFileUrl(msg.file?.url || msg.image?.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={msg.file?.originalName || 'file'}
                              className={`p-2 rounded-lg transition-all flex-shrink-0 ${
                                isMe ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-gray-200/70 hover:bg-gray-300 text-gray-800'
                              }`}
                              title="Download File"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDownloadMedia(msg._id, msg.file?.url || msg.image?.url, msg.file?.originalName || 'file')}
                              className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all flex-shrink-0 flex items-center gap-1.5 shadow-md active:scale-95"
                              title="Download File"
                            >
                              <Download className="w-4 h-4" />
                              <span className="text-[10px] font-medium hidden sm:inline">
                                {msg.file?.size ? formatFileSize(msg.file.size) : 'Download'}
                              </span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Text body */}
                      {msg.text && (
                        <p className={`text-sm leading-relaxed text-left break-words ${
                          isMe ? 'text-white' : theme === 'light' ? 'text-gray-900' : 'text-gray-200'
                        }`}>
                          {msg.text}
                        </p>
                      )}
                    </>
                  )}

                  {/* Message Metadata Footer */}
                  <div className={`flex items-center justify-end gap-1 mt-1 text-[9px] select-none ${
                    isMe ? 'text-white/70' : theme === 'light' ? 'text-gray-400' : 'text-white/50'
                  }`}>
                    <span>{formatMsgTime(msg.createdAt)}</span>
                    {isMe && !isDeleted && (
                      <span
                        className="ml-1 text-xs select-none flex items-center"
                        title={msg.seen ? "Read" : msg.delivered ? "Delivered" : "Sent"}
                      >
                        {msg.seen ? (
                          <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />
                        ) : msg.delivered ? (
                          <CheckCheck className="w-3.5 h-3.5 text-white/80" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-white/60" />
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete button on right for received messages */}
                {!isMe && (
                  <button
                    onClick={() => setDeleteTargetMessage(msg)}
                    title="Delete for me"
                    className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all ${
                      theme === 'light'
                        ? 'text-gray-400 hover:text-red-500 hover:bg-gray-200/60'
                        : 'text-gray-500 hover:text-red-400 hover:bg-white/5'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message input area */}
      <div className={`px-2.5 py-2 sm:px-4 sm:py-3 border-t backdrop-blur-md z-30 relative transition-colors duration-300 w-full max-w-full overflow-visible ${
        theme === 'light'
          ? 'bg-white/95 border-gray-200 shadow-sm'
          : 'bg-[#111827]/60 border-white/10'
      }`}>
        <form onSubmit={handleSend} className="relative flex flex-col gap-1.5 sm:gap-2 w-full max-w-full overflow-visible">
          {/* File preview slider */}
          {filePreview && (
            <div className={`flex items-center gap-3 p-2.5 border rounded-xl max-w-sm animate-slide-up ${
              theme === 'light'
                ? 'bg-white border-gray-300 shadow-md'
                : 'bg-[#0b0f19]/95 border-white/15'
            }`}>
              {filePreview.type === 'image' ? (
                <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-black/10 bg-black/5 flex-shrink-0">
                  <img src={filePreview.url} alt="Preview" className="w-full h-full object-cover" />
                </div>
              ) : filePreview.type === 'pdf' ? (
                <div className="w-12 h-12 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-500 flex-shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
              ) : filePreview.type === 'docx' ? (
                <div className="w-12 h-12 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-500 flex-shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
              ) : filePreview.type === 'audio' ? (
                <div className="w-12 h-12 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-500 flex-shrink-0">
                  <Music className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-500/20 border border-gray-500/30 flex items-center justify-center text-gray-500 flex-shrink-0">
                  <FileIcon className="w-6 h-6" />
                </div>
              )}

              <div className="text-left min-w-0 flex-1">
                <span className={`text-xs font-semibold block truncate ${
                  theme === 'light' ? 'text-gray-900' : 'text-white'
                }`}>
                  {filePreview.name}
                </span>
                <span className={`text-[10px] block mt-0.5 ${
                  theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  {filePreview.size} • <span className="uppercase text-indigo-500 font-medium">{filePreview.type}</span>
                </span>
              </div>

              <button
                type="button"
                onClick={removeSelectedFile}
                className={`p-1 rounded-full transition-all ${
                  theme === 'light'
                    ? 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
                title="Remove attachment"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Form input bar */}
          <div className="flex items-center gap-1.5 sm:gap-2 relative w-full max-w-full min-w-0 overflow-visible">
            {/* WhatsApp-Style Fully Responsive Emoji Picker Popup */}
            {showEmojiPicker && (
              <div
                ref={emojiPickerRef}
                className={`absolute bottom-full mb-2.5 left-0 sm:left-1 z-[100] shadow-2xl rounded-2xl overflow-hidden border animate-fade-in w-[calc(100vw-20px)] sm:w-[340px] max-w-[340px] ${
                  theme === 'light' ? 'bg-white border-gray-200 shadow-gray-400/30' : 'bg-[#111827] border-white/10 shadow-black/60'
                }`}
              >
                {/* WhatsApp Quick Emojis Header Bar (Touch-scrollable on mobile) */}
                <div className={`p-2 border-b flex items-center justify-between gap-1 overflow-x-auto touch-pan-x select-none ${
                  theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-white/5 border-white/10'
                }`}>
                  <div className="flex items-center gap-1.5 min-w-max">
                    {['😀', '😂', '😍', '❤️', '🔥', '👍', '🙏', '🎉', '👏', '🥳', '😎', '😢', '💯', '✨'].map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleEmojiClick(em);
                        }}
                        className="w-7 h-7 flex items-center justify-center text-lg hover:scale-125 active:scale-95 transition-transform rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                        title={em}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>

                <EmojiPicker
                  theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT}
                  emojiStyle={EmojiStyle.NATIVE}
                  onEmojiClick={(emojiData, e) => {
                    e?.stopPropagation?.();
                    handleEmojiClick(emojiData);
                  }}
                  autoFocusSearch={false}
                  lazyLoadEmojis={false}
                  width="100%"
                  height={320}
                  searchPlaceHolder="Search emojis..."
                />
              </div>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowEmojiPicker((prev) => !prev);
              }}
              title="Add Emoji"
              className={`emoji-toggle-btn p-2 sm:p-2.5 rounded-xl border active:scale-95 transition-all flex items-center justify-center flex-shrink-0 ${
                showEmojiPicker
                  ? 'bg-indigo-500/20 text-indigo-500 border-indigo-500/30'
                  : theme === 'light'
                  ? 'bg-gray-100 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 border-gray-200'
                  : 'bg-white/5 hover:bg-indigo-500/20 text-gray-400 hover:text-indigo-400 border-white/5'
              }`}
            >
              <Smile className="w-5 h-5" />
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,application/pdf,.doc,.docx,audio/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach File (Image, PDF, DOCX, Audio)"
              className={`p-2 sm:p-2.5 rounded-xl border active:scale-95 transition-all flex items-center justify-center flex-shrink-0 ${
                theme === 'light'
                  ? 'bg-gray-100 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 border-gray-200'
                  : 'bg-white/5 hover:bg-indigo-500/20 text-gray-400 hover:text-indigo-400 border-white/5'
              }`}
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <input
              ref={textInputRef}
              type="text"
              placeholder={selectedFile ? "Add caption..." : "Write a message..."}
              value={text}
              onChange={handleTextChange}
              disabled={sending}
              className={`flex-1 min-w-0 w-0 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-[15px] sm:text-sm focus:outline-none focus:ring-2 ${chatThemeConfig.focusRing} focus:border-transparent transition-all ${
                theme === 'light'
                  ? 'bg-gray-100 border border-gray-300 text-gray-900 placeholder-gray-400 focus:bg-white'
                  : 'bg-[#0b0f19]/80 border border-white/10 text-white placeholder-gray-500'
              }`}
            />

            <button
              type="submit"
              disabled={sending || (!text.trim() && !selectedFile)}
              className={`p-2 sm:p-2.5 bg-gradient-to-r ${chatThemeConfig.sendButton} disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 text-white rounded-xl shadow-lg ${chatThemeConfig.shadowGlow} active:scale-95 transition-all flex items-center justify-center flex-shrink-0`}
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Send className="w-4.5 h-4.5" />
              )}
            </button>
          </div>
        </form>
      </div>
      </>
      )}

      {/* WhatsApp-Style Delete Message Modal */}
      {deleteTargetMessage && (() => {
        const isMyMsg = deleteTargetMessage.sender === user?._id;
        const msgAge = Date.now() - new Date(deleteTargetMessage.createdAt).getTime();
        const canDeleteForEveryone = isMyMsg && !deleteTargetMessage.isDeletedForEveryone && msgAge <= 15 * 60 * 1000;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
            <div className={`border rounded-2xl p-4 sm:p-5 w-[92vw] sm:w-full max-w-sm shadow-2xl animate-scale-up text-left space-y-4 ${
              theme === 'light'
                ? 'bg-white border-gray-200 text-gray-900'
                : 'bg-[#111827] border-white/10 text-white'
            }`}>
              <div>
                <h3 className={`text-base font-semibold font-display ${
                  theme === 'light' ? 'text-gray-900' : 'text-white'
                }`}>
                  Delete message?
                </h3>
                <p className={`text-xs mt-1 leading-relaxed ${
                  theme === 'light' ? 'text-gray-600' : 'text-gray-400'
                }`}>
                  {canDeleteForEveryone
                    ? "You can delete this message for everyone in this conversation, or delete it only for yourself."
                    : "This message will be deleted for you. Other participants will still be able to see it."}
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                {canDeleteForEveryone && (
                  <button
                    type="button"
                    onClick={handleDeleteForEveryone}
                    className="w-full py-2.5 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-300 font-medium text-xs rounded-xl border border-red-500/20 transition-all text-center flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                    Delete for everyone
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDeleteForMe}
                  className={`w-full py-2.5 px-4 font-medium text-xs rounded-xl border transition-all text-center flex items-center justify-center gap-2 ${
                    theme === 'light'
                      ? 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-200'
                      : 'bg-white/5 hover:bg-white/10 text-gray-200 border-white/10'
                  }`}
                >
                  <Trash2 className="w-4 h-4 opacity-70" />
                  Delete for me
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteTargetMessage(null)}
                  className={`w-full py-2 px-4 font-medium text-xs rounded-xl transition-all text-center ${
                    theme === 'light'
                      ? 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* WhatsApp-Style Clear Chat Confirmation Modal */}
      {showClearChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
          <div className={`border rounded-2xl p-4 sm:p-5 w-[92vw] sm:w-full max-w-sm shadow-2xl animate-scale-up text-left space-y-4 ${
            theme === 'light'
              ? 'bg-white border-gray-200 text-gray-900'
              : 'bg-[#111827] border-white/10 text-white'
          }`}>
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mb-3">
                <Eraser className="w-5 h-5" />
              </div>
              <h3 className={`text-base font-semibold font-display ${
                theme === 'light' ? 'text-gray-900' : 'text-white'
              }`}>
                Clear this chat?
              </h3>
              <p className={`text-xs mt-1.5 leading-relaxed ${
                theme === 'light' ? 'text-gray-600' : 'text-gray-400'
              }`}>
                Are you sure you want to clear all messages in this conversation with <strong className={theme === 'light' ? 'text-gray-900' : 'text-white'}>{otherUser.name}</strong>? This will remove all message logs from your side.
              </p>
            </div>

            <div className="flex gap-2.5 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowClearChatModal(false)}
                className={`px-4 py-2 text-xs font-medium rounded-xl border transition-all ${
                  theme === 'light'
                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                    : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/5'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearChat}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-red-500/20 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Eraser className="w-3.5 h-3.5" />
                Clear Messages
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp-Style Chat Lock Modal */}
      <ChatLockModal
        isOpen={isLockModalOpen}
        onClose={() => setIsLockModalOpen(false)}
        mode={lockModalMode}
        targetChat={otherUser ? { _id: chatId || '', userName: otherUser.name, isLocked: isChatInLockedList } : null}
        onSuccess={() => {
          fetchLockStatus();
          onChatLockChanged?.();
        }}
      />
    </div>
  );
};

