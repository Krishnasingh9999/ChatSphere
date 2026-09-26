import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useChatLock } from '../context/ChatLockContext';
import { 
  Lock, 
  Unlock, 
  KeyRound, 
  Eye, 
  EyeOff, 
  X, 
  AlertCircle,
  CheckCircle2,
  ShieldOff
} from 'lucide-react';

export type ChatLockModalMode = 'unlock_folder' | 'toggle_chat' | 'set_passcode' | 'remove_passcode';

interface ChatLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: ChatLockModalMode;
  targetChat?: {
    _id: string;
    userName: string;
    isLocked: boolean;
  } | null;
  onSuccess?: () => void;
}

export const ChatLockModal: React.FC<ChatLockModalProps> = ({
  isOpen,
  onClose,
  mode,
  targetChat,
  onSuccess,
}) => {
  const { theme } = useTheme();
  const { 
    hasPasscode, 
    setPasscode, 
    removePasscode,
    unlockFolder, 
    toggleChatLock 
  } = useChatLock();

  const [currentMode, setCurrentMode] = useState<ChatLockModalMode>(mode);
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [enterPasscode, setEnterPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'toggle_chat' && !hasPasscode) {
        setCurrentMode('set_passcode');
      } else {
        setCurrentMode(mode);
      }
      setCurrentPasscode('');
      setNewPasscode('');
      setConfirmPasscode('');
      setEnterPasscode('');
      setError('');
      setSuccessMsg('');
      setShowPasscode(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, mode, hasPasscode]);

  if (!isOpen) return null;

  const handleSetPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (newPasscode.length < 4) {
      setError('Passcode must be at least 4 digits or characters');
      return;
    }
    if (newPasscode !== confirmPasscode) {
      setError('Passcodes do not match. Please re-enter');
      return;
    }

    setSubmitting(true);
    try {
      const res = await setPasscode(newPasscode, hasPasscode ? currentPasscode : undefined);
      if (res.success) {
        setSuccessMsg('Secret Passcode saved successfully!');
        setTimeout(() => {
          if (mode === 'toggle_chat' && targetChat) {
            toggleChatLock(targetChat._id, newPasscode).then(() => {
              onSuccess?.();
              onClose();
            });
          } else {
            onSuccess?.();
            onClose();
          }
        }, 800);
      } else {
        setError(res.message || 'Failed to save passcode');
      }
    } catch {
      setError('An error occurred. Please try again');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlockFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!enterPasscode) {
      setError('Please enter your Secret Passcode');
      return;
    }

    setSubmitting(true);
    try {
      const res = await unlockFolder(enterPasscode);
      if (res.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(res.message || 'Incorrect passcode');
      }
    } catch {
      setError('Failed to verify passcode');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!targetChat) return;
    if (!enterPasscode) {
      setError('Please enter your Secret Passcode');
      return;
    }

    setSubmitting(true);
    try {
      const res = await toggleChatLock(targetChat._id, enterPasscode);
      if (res.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(res.message || 'Incorrect passcode');
      }
    } catch {
      setError('Failed to update chat lock');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemovePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!enterPasscode) {
      setError('Please enter your Secret Passcode to turn off Chat Lock');
      return;
    }

    setSubmitting(true);
    try {
      const res = await removePasscode(enterPasscode);
      if (res.success) {
        setSuccessMsg('Chat Lock removed! All chats are now standard.');
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 800);
      } else {
        setError(res.message || 'Incorrect passcode');
      }
    } catch {
      setError('Failed to remove chat lock');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className={`relative w-full max-w-md rounded-2xl p-6 shadow-2xl transition-all border ${
          theme === 'light'
            ? 'bg-white border-gray-200 text-gray-900'
            : 'bg-[#121b28] border-white/10 text-white shadow-emerald-500/5'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-full transition-colors ${
            theme === 'light' ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-white/10 text-gray-400'
          }`}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header Icon */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 text-emerald-500 border border-emerald-500/30 flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/10">
            {currentMode === 'unlock_folder' ? (
              <Unlock className="w-7 h-7" />
            ) : currentMode === 'set_passcode' ? (
              <KeyRound className="w-7 h-7" />
            ) : currentMode === 'remove_passcode' ? (
              <ShieldOff className="w-7 h-7 text-red-500" />
            ) : targetChat?.isLocked ? (
              <Unlock className="w-7 h-7" />
            ) : (
              <Lock className="w-7 h-7" />
            )}
          </div>

          <h3 className="text-lg font-bold font-display tracking-tight">
            {currentMode === 'unlock_folder' && 'Locked Chats'}
            {currentMode === 'toggle_chat' && (targetChat?.isLocked ? `Unlock ${targetChat.userName}` : `Lock ${targetChat?.userName || 'Chat'}`)}
            {currentMode === 'set_passcode' && (hasPasscode ? 'Change Secret Passcode' : 'Set Secret Passcode')}
            {currentMode === 'remove_passcode' && 'Turn Off Chat Lock'}
          </h3>

          <p className={`text-xs mt-1 max-w-xs leading-relaxed ${
            theme === 'light' ? 'text-gray-500' : 'text-gray-400'
          }`}>
            {currentMode === 'unlock_folder' && 'Enter your secret passcode to unlock and read your private conversations.'}
            {currentMode === 'toggle_chat' && (targetChat?.isLocked 
              ? 'Enter your secret passcode to remove lock from this conversation and make it a normal chat.'
              : 'Keep this chat locked and hidden with your secret passcode.')}
            {currentMode === 'set_passcode' && (hasPasscode 
              ? 'Enter your current passcode followed by your new passcode.'
              : 'Create a secret PIN or password (min 4 characters) to protect your private chats.')}
            {currentMode === 'remove_passcode' && 'Enter your current secret passcode to remove lock and restore all chats to normal.'}
          </p>
        </div>

        {/* Error / Success Feedback */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* FORM 1: UNLOCK FOLDER */}
        {currentMode === 'unlock_folder' && (
          <form onSubmit={handleUnlockFolder} className="space-y-4">
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${
                theme === 'light' ? 'text-gray-700' : 'text-gray-300'
              }`}>
                Secret Passcode
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPasscode ? 'text' : 'password'}
                  value={enterPasscode}
                  onChange={(e) => setEnterPasscode(e.target.value)}
                  placeholder="Enter secret PIN or password"
                  className={`w-full rounded-xl px-3.5 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${
                    theme === 'light'
                      ? 'bg-gray-50 border border-gray-300 text-gray-900 focus:bg-white'
                      : 'bg-white/5 border border-white/10 text-white focus:bg-white/10'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode(!showPasscode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                >
                  {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setCurrentMode('set_passcode')}
                className="text-xs text-emerald-500 hover:underline"
              >
                Change passcode?
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
                    theme === 'light' ? 'hover:bg-gray-100 text-gray-600' : 'hover:bg-white/10 text-gray-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  {submitting ? 'Unlocking...' : 'Unlock Chats'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* FORM 2: TOGGLE SPECIFIC CHAT LOCK */}
        {currentMode === 'toggle_chat' && (
          <form onSubmit={handleToggleChat} className="space-y-4">
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${
                theme === 'light' ? 'text-gray-700' : 'text-gray-300'
              }`}>
                Secret Passcode
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPasscode ? 'text' : 'password'}
                  value={enterPasscode}
                  onChange={(e) => setEnterPasscode(e.target.value)}
                  placeholder="Enter secret passcode"
                  className={`w-full rounded-xl px-3.5 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${
                    theme === 'light'
                      ? 'bg-gray-50 border border-gray-300 text-gray-900 focus:bg-white'
                      : 'bg-white/5 border border-white/10 text-white focus:bg-white/10'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode(!showPasscode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                >
                  {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setCurrentMode('set_passcode')}
                className="text-xs text-emerald-500 hover:underline"
              >
                Change passcode?
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
                    theme === 'light' ? 'hover:bg-gray-100 text-gray-600' : 'hover:bg-white/10 text-gray-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  {submitting ? 'Confirming...' : targetChat?.isLocked ? 'Unlock Chat' : 'Lock Chat'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* FORM 3: SET / CHANGE PASSCODE */}
        {currentMode === 'set_passcode' && (
          <form onSubmit={handleSetPasscode} className="space-y-3.5">
            {hasPasscode && (
              <div>
                <label className={`block text-xs font-semibold mb-1 ${
                  theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                }`}>
                  Current Passcode
                </label>
                <input
                  type={showPasscode ? 'text' : 'password'}
                  value={currentPasscode}
                  onChange={(e) => setCurrentPasscode(e.target.value)}
                  placeholder="Enter current passcode"
                  className={`w-full rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${
                    theme === 'light'
                      ? 'bg-gray-50 border border-gray-300 text-gray-900 focus:bg-white'
                      : 'bg-white/5 border border-white/10 text-white focus:bg-white/10'
                  }`}
                />
              </div>
            )}

            <div>
              <label className={`block text-xs font-semibold mb-1 ${
                theme === 'light' ? 'text-gray-700' : 'text-gray-300'
              }`}>
                {hasPasscode ? 'New Secret Passcode' : 'Create Secret Passcode'}
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPasscode ? 'text' : 'password'}
                  value={newPasscode}
                  onChange={(e) => setNewPasscode(e.target.value)}
                  placeholder="Min. 4 digits or characters"
                  className={`w-full rounded-xl px-3.5 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${
                    theme === 'light'
                      ? 'bg-gray-50 border border-gray-300 text-gray-900 focus:bg-white'
                      : 'bg-white/5 border border-white/10 text-white focus:bg-white/10'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode(!showPasscode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                >
                  {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${
                theme === 'light' ? 'text-gray-700' : 'text-gray-300'
              }`}>
                Confirm Secret Passcode
              </label>
              <input
                type={showPasscode ? 'text' : 'password'}
                value={confirmPasscode}
                onChange={(e) => setConfirmPasscode(e.target.value)}
                placeholder="Re-enter new secret passcode"
                className={`w-full rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${
                  theme === 'light'
                    ? 'bg-gray-50 border border-gray-300 text-gray-900 focus:bg-white'
                    : 'bg-white/5 border border-white/10 text-white focus:bg-white/10'
                }`}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              {hasPasscode ? (
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setSuccessMsg('');
                    setEnterPasscode('');
                    setCurrentMode('remove_passcode');
                  }}
                  className="text-xs text-red-500 hover:text-red-600 font-medium hover:underline"
                >
                  Turn off Chat Lock?
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
                    theme === 'light' ? 'hover:bg-gray-100 text-gray-600' : 'hover:bg-white/10 text-gray-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  {submitting ? 'Saving...' : 'Save Passcode'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* FORM 4: REMOVE PASSCODE & UNLOCK ALL */}
        {currentMode === 'remove_passcode' && (
          <form onSubmit={handleRemovePasscode} className="space-y-4">
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${
                theme === 'light' ? 'text-gray-700' : 'text-gray-300'
              }`}>
                Current Secret Passcode
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPasscode ? 'text' : 'password'}
                  value={enterPasscode}
                  onChange={(e) => setEnterPasscode(e.target.value)}
                  placeholder="Enter current passcode to confirm"
                  className={`w-full rounded-xl px-3.5 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all ${
                    theme === 'light'
                      ? 'bg-gray-50 border border-gray-300 text-gray-900 focus:bg-white'
                      : 'bg-white/5 border border-white/10 text-white focus:bg-white/10'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode(!showPasscode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                >
                  {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setSuccessMsg('');
                  setCurrentMode('set_passcode');
                }}
                className="text-xs text-emerald-500 hover:underline"
              >
                Back to settings
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
                    theme === 'light' ? 'hover:bg-gray-100 text-gray-600' : 'hover:bg-white/10 text-gray-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-lg shadow-red-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  {submitting ? 'Removing...' : 'Turn Off Lock'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
