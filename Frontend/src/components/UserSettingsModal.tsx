import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme, CHAT_THEME_PRESETS, type ChatColorTheme } from '../context/ThemeContext';
import { useChatLock } from '../context/ChatLockContext';
import { ChatLockModal } from './ChatLockModal';
import type { User } from '../context/AuthContext';
import { getAvatarUrl } from '../utils/api';
import { X, Settings, User as UserIcon, Save, Check, Camera, Trash2, Sun, Moon, Palette, Lock, KeyRound } from 'lucide-react';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  isOpen,
  onClose,
  user,
}) => {
  const { updateProfile } = useAuth();
  const { socket } = useSocket();
  const { theme, setTheme, chatTheme, setChatTheme, chatThemeConfig } = useTheme();
  const [name, setName] = useState(user.name);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user.avatar?.url ? getAvatarUrl(user.avatar.url) : null
  );
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { hasPasscode, fetchLockStatus } = useChatLock();
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [passcodeModalMode, setPasscodeModalMode] = useState<'set_passcode' | 'remove_passcode'>('set_passcode');

  React.useEffect(() => {
    if (isOpen) {
      setName(user.name);
      setAvatarPreview(user.avatar?.url ? getAvatarUrl(user.avatar.url) : null);
      setAvatarFile(null);
      setRemoveAvatar(false);
      setError('');
      setSuccess(false);
      setShowPasscodeModal(false);
      setPasscodeModalMode('set_passcode');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file (PNG, JPG, WEBP).');
        return;
      }
      setAvatarFile(file);
      setRemoveAvatar(false);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name cannot be empty.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    const formData = new FormData();
    formData.append('name', name.trim());
    if (avatarFile) {
      formData.append('avatar', avatarFile);
    }
    if (removeAvatar) {
      formData.append('removeAvatar', 'true');
    }

    const res = await updateProfile(formData);
    setLoading(false);

    if (res.success) {
      if (res.user && socket) {
        socket.emit('update-profile', { user: res.user });
      }
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
      <div className={`w-[94vw] sm:w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] animate-scale-up ${
        theme === 'light'
          ? 'bg-white border-gray-200 text-gray-900'
          : 'bg-[#111827] border-white/10 text-white'
      }`}>
        {/* Header */}
        <div className={`p-4 sm:p-5 border-b flex justify-between items-center ${
          theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-[#111827]/40 border-white/10'
        }`}>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-500" />
            <h3 className={`text-base sm:text-lg font-semibold font-display ${
              theme === 'light' ? 'text-gray-900' : 'text-white'
            }`}>
              Profile & Chat Settings
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-all ${
              theme === 'light' ? 'text-gray-400 hover:text-gray-700 hover:bg-gray-100' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content / Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto max-h-[calc(92dvh-120px)]">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs">
              {error}
            </div>
          )}

          {/* Profile Picture / Avatar Section */}
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-indigo-500/40 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 shadow-xl flex items-center justify-center">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Profile Avatar"
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
                  <span className="text-2xl font-bold uppercase text-indigo-400 font-display">
                    {name ? name.slice(0, 2) : user.name.slice(0, 2)}
                  </span>
                )}
              </div>

              {/* Camera Upload Overlay */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Change Profile Photo"
                className="absolute bottom-0 right-0 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg border-2 border-white dark:border-[#111827] active:scale-95 transition-all"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-indigo-500 hover:text-indigo-600 font-semibold transition-colors"
              >
                Upload Photo
              </button>
              {((!removeAvatar && user.avatar?.url) || avatarPreview) && (
                <>
                  <span className="text-gray-400">•</span>
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Remove Photo
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {/* Theme Selector Section */}
            <div>
              <span className={`block text-xs font-semibold uppercase tracking-wider mb-2 ${
                theme === 'light' ? 'text-gray-500' : 'text-gray-400'
              }`}>
                App Theme
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                    theme === 'light'
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-600 font-semibold shadow-xs'
                      : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <Sun className="w-4 h-4 text-amber-500" />
                  Light Mode
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                    theme === 'dark'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold'
                      : 'bg-transparent border-gray-300 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  <Moon className="w-4 h-4 text-indigo-400" />
                  Dark Mode
                </button>
              </div>
            </div>

            {/* Chat Color Theme Palette Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
                  theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  <Palette className="w-3.5 h-3.5 text-indigo-500" />
                  Chat Theme Color
                </span>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
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
                      onClick={() => setChatTheme(key)}
                      title={preset.name}
                      className={`group p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
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

            {/* Read-only email display */}
            <div>
              <span className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                theme === 'light' ? 'text-gray-500' : 'text-gray-400'
              }`}>
                Email Address
              </span>
              <div className={`px-4 py-2.5 rounded-xl text-sm select-none border ${
                theme === 'light'
                  ? 'bg-gray-100 border-gray-200 text-gray-600'
                  : 'bg-white/5 border-white/5 text-gray-400'
              }`}>
                {user.email}
              </div>
            </div>

            {/* Editable name */}
            <div>
              <label htmlFor="name-input" className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                theme === 'light' ? 'text-gray-700' : 'text-gray-300'
              }`}>
                Display Name
              </label>
              <div className="relative">
                <div className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none ${
                  theme === 'light' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  <UserIcon className="w-4.5 h-4.5" />
                </div>
                <input
                  id="name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={40}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                    theme === 'light'
                      ? 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 focus:bg-white'
                      : 'bg-[#0b0f19]/80 border border-white/10 text-white placeholder-gray-500'
                  }`}
                  required
                />
              </div>
            </div>

            {/* Chat Lock & Security Section */}
            <div className={`p-4 rounded-2xl border transition-all ${
              theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-white/5 border-white/5'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center flex-shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className={`text-xs font-semibold font-display ${
                      theme === 'light' ? 'text-gray-900' : 'text-white'
                    }`}>
                      Chat Lock & Passcode
                    </h4>
                    <p className={`text-[10px] ${
                      theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      {hasPasscode ? 'Secret passcode is active' : 'No passcode set yet'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {hasPasscode && (
                    <button
                      type="button"
                      onClick={() => {
                        setPasscodeModalMode('remove_passcode');
                        setShowPasscodeModal(true);
                      }}
                      className="px-2.5 py-1.5 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-semibold active:scale-95 transition-all"
                    >
                      Turn Off Lock
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPasscodeModalMode('set_passcode');
                      setShowPasscodeModal(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>{hasPasscode ? 'Change PIN' : 'Set PIN'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2.5 text-sm font-medium rounded-xl border transition-all ${
                theme === 'light'
                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                  : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/5'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className={`px-5 py-2.5 ${
                success
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white'
              } text-sm font-medium rounded-xl flex items-center gap-2 active:scale-95 transition-all shadow-md shadow-indigo-500/20`}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : success ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Chat Lock / Passcode Modal */}
      <ChatLockModal
        isOpen={showPasscodeModal}
        onClose={() => setShowPasscodeModal(false)}
        mode={passcodeModalMode}
        onSuccess={() => {
          fetchLockStatus();
        }}
      />
    </div>
  );
};

