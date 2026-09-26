import React, { useEffect, useState } from 'react';
import { X, MessageSquare, Image as ImageIcon, FileText, Music, Paperclip, Lock, ArrowRight } from 'lucide-react';
import { getAvatarUrl } from '../utils/api';
import { useTheme } from '../context/ThemeContext';

export interface ToastMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: {
    url: string;
    publicId: string;
  } | null;
  text?: string;
  messageType?: 'text' | 'image' | 'pdf' | 'docx' | 'audio' | 'file';
  fileOriginalName?: string;
  isLocked?: boolean;
  createdAt: string | Date;
}

interface NotificationToastProps {
  notifications: ToastMessage[];
  onDismiss: (id: string) => void;
  onOpenChat: (chatId: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notifications,
  onDismiss,
  onOpenChat,
}) => {
  const { theme } = useTheme();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-[99999] flex flex-col gap-2.5 pointer-events-none select-none">
      {notifications.map((notif) => (
        <SingleToastItem
          key={notif.id}
          notification={notif}
          theme={theme}
          onDismiss={() => onDismiss(notif.id)}
          onOpenChat={() => {
            onOpenChat(notif.chatId);
            onDismiss(notif.id);
          }}
        />
      ))}
    </div>
  );
};

interface SingleToastItemProps {
  notification: ToastMessage;
  theme: 'light' | 'dark';
  onDismiss: () => void;
  onOpenChat: () => void;
}

const SingleToastItem: React.FC<SingleToastItemProps> = ({
  notification,
  theme,
  onDismiss,
  onOpenChat,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (isPaused) return;

    const interval = 50; // Update every 50ms
    const totalDuration = 5000; // 5 seconds
    const decrement = (interval / totalDuration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= decrement) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - decrement;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isPaused, onDismiss]);

  const renderContent = () => {
    if (notification.isLocked) {
      return (
        <span className="flex items-center gap-1.5 text-xs text-amber-500 font-medium">
          <Lock className="w-3.5 h-3.5" />
          New message (Locked chat)
        </span>
      );
    }

    if (notification.messageType === 'image') {
      return (
        <span className="flex items-center gap-1.5 text-xs text-indigo-400 font-medium truncate">
          <ImageIcon className="w-3.5 h-3.5 flex-shrink-0" />
          {notification.text ? notification.text : 'Photo'}
        </span>
      );
    }

    if (notification.messageType === 'pdf') {
      return (
        <span className="flex items-center gap-1.5 text-xs text-red-400 font-medium truncate">
          <FileText className="w-3.5 h-3.5 flex-shrink-0" />
          {notification.fileOriginalName || 'PDF Document'}
        </span>
      );
    }

    if (notification.messageType === 'docx') {
      return (
        <span className="flex items-center gap-1.5 text-xs text-blue-400 font-medium truncate">
          <FileText className="w-3.5 h-3.5 flex-shrink-0" />
          {notification.fileOriginalName || 'Word Document'}
        </span>
      );
    }

    if (notification.messageType === 'audio') {
      return (
        <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium truncate">
          <Music className="w-3.5 h-3.5 flex-shrink-0" />
          Voice Message / Audio
        </span>
      );
    }

    if (notification.messageType === 'file') {
      return (
        <span className="flex items-center gap-1.5 text-xs text-gray-400 font-medium truncate">
          <Paperclip className="w-3.5 h-3.5 flex-shrink-0" />
          {notification.fileOriginalName || 'Attachment'}
        </span>
      );
    }

    return (
      <p className={`text-xs truncate font-normal leading-relaxed ${
        theme === 'light' ? 'text-gray-600' : 'text-gray-300'
      }`}>
        {notification.text || 'Sent a message'}
      </p>
    );
  };

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onClick={onOpenChat}
      className={`pointer-events-auto w-full cursor-pointer rounded-2xl p-3.5 shadow-2xl transition-all duration-300 transform animate-slide-down relative overflow-hidden group border backdrop-blur-xl ${
        theme === 'light'
          ? 'bg-white/95 text-gray-900 border-gray-200/80 shadow-indigo-500/10 hover:shadow-indigo-500/20 hover:border-indigo-300'
          : 'bg-[#131b2e]/95 text-white border-white/10 shadow-black/60 hover:border-indigo-500/40 hover:bg-[#162038]'
      }`}
    >
      {/* Top Banner Header: App Name & Action */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-md bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm">
            <MessageSquare className="w-2.5 h-2.5" />
          </div>
          <span className="text-[11px] font-bold tracking-wide uppercase text-emerald-500 font-display">
            ChatSphere
          </span>
          <span className="text-[10px] text-gray-400">• Just now</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className={`p-1 rounded-full transition-colors ${
              theme === 'light'
                ? 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Toast Content: Avatar + Sender + Message Preview */}
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md border-2 border-indigo-400/20">
            {notification.senderAvatar?.url ? (
              <img
                src={getAvatarUrl(notification.senderAvatar.url)}
                alt={notification.senderName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  if (notification.senderAvatar?.url && target.src !== notification.senderAvatar.url) {
                    target.src = notification.senderAvatar.url;
                  }
                }}
              />
            ) : (
              notification.senderName.slice(0, 2).toUpperCase()
            )}
          </div>
          {/* Active indicator dot */}
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#131b2e] rounded-full shadow-sm"></span>
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <h4 className={`text-sm font-semibold truncate font-display ${
              theme === 'light' ? 'text-gray-900' : 'text-white'
            }`}>
              {notification.senderName}
            </h4>
            <span className="text-[10px] text-indigo-400 font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              Reply <ArrowRight className="w-2.5 h-2.5" />
            </span>
          </div>
          {renderContent()}
        </div>
      </div>

      {/* Bottom Progress Bar Timer */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/5">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 via-indigo-500 to-purple-500 transition-all duration-75 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
