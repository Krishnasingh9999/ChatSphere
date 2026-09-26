import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { userApi, chatApi, getAvatarUrl } from '../utils/api';
import { X, Image as ImageIcon, Type, Palette, Shield, Check, Lock, Users, Sparkles, Loader2, Upload, Search, CheckSquare, Square } from 'lucide-react';

interface UserContact {
  _id: string;
  name: string;
  email: string;
  avatar?: {
    url: string;
  } | null;
}

interface CreateStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusCreated: () => void;
  currentUserId: string;
}

const BG_COLORS = [
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Slate', value: '#334155' },
  { name: 'Dark', value: '#0f172a' },
];

export const CreateStatusModal: React.FC<CreateStatusModalProps> = ({
  isOpen,
  onClose,
  onStatusCreated,
  currentUserId,
}) => {
  const { theme } = useTheme();
  const [statusType, setStatusType] = useState<'text' | 'image'>('text');
  const [textContent, setTextContent] = useState('');
  const [selectedColor, setSelectedColor] = useState(BG_COLORS[0].value);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  
  // Privacy
  const [privacy, setPrivacy] = useState<'everyone' | 'selected'>('everyone');
  const [allowedUsers, setAllowedUsers] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserContact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLoadingUsers(true);
      setErrorMsg('');
      userApi
        .get('/user/all')
        .then((res) => {
          const rawList = Array.isArray(res.data) ? res.data : (res.data?.users || []);
          const list = rawList.filter((u: any) => u._id && u._id !== currentUserId);
          setAvailableUsers(list);
        })
        .catch((err) => {
          console.error("Failed to load contacts for status privacy:", err);
          setErrorMsg("Could not load contacts list. Please check connection.");
        })
        .finally(() => {
          setLoadingUsers(false);
        });
    } else {
      setTextContent('');
      setImageFile(null);
      setImagePreview(null);
      setCaption('');
      setErrorMsg('');
      setContactSearch('');
      setIsSubmitting(false);
    }
  }, [isOpen, currentUserId]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrorMsg('Please select an image file (JPG, PNG, WebP, etc.)');
        return;
      }
      setErrorMsg('');
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setAllowedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const selectAllUsers = () => {
    setAllowedUsers(availableUsers.map((u) => u._id));
  };

  const deselectAllUsers = () => {
    setAllowedUsers([]);
  };

  const filteredContacts = availableUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (statusType === 'text' && !textContent.trim()) {
      setErrorMsg('Please enter status text');
      return;
    }

    if (statusType === 'image' && !imageFile) {
      setErrorMsg('Please select an image for your status');
      return;
    }

    if (privacy === 'selected' && allowedUsers.length === 0) {
      setErrorMsg('Please select at least one contact who can view this status');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      if (statusType === 'text') {
        formData.append('content', textContent.trim());
        formData.append('bgColor', selectedColor);
      } else {
        if (imageFile) formData.append('file', imageFile);
        if (caption.trim()) formData.append('content', caption.trim());
      }

      formData.append('privacy', privacy);
      formData.append('allowedUsers', JSON.stringify(allowedUsers));

      await chatApi.post('/status', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      onStatusCreated();
      onClose();
    } catch (err: any) {
      console.error('Failed to post status:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to post status. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className={`relative w-full max-w-lg rounded-2xl shadow-2xl border flex flex-col max-h-[92vh] overflow-hidden transition-colors ${
          theme === 'light'
            ? 'bg-white border-gray-200 text-gray-900'
            : 'bg-[#111827] border-white/10 text-white'
        }`}
      >
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-white/5 border-white/10'
        }`}>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base font-display">Add New Status</h3>
              <p className="text-xs text-gray-400">Active for 24 hours</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-all ${
              theme === 'light' ? 'text-gray-400 hover:bg-gray-200 text-gray-600' : 'text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Status Type Selector */}
          <div className="flex rounded-xl p-1 bg-gray-100 dark:bg-white/5 border border-black/5 dark:border-white/5">
            <button
              type="button"
              onClick={() => {
                setStatusType('text');
                setErrorMsg('');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                statusType === 'text'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              <Type className="w-4 h-4" /> Text Status
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusType('image');
                setErrorMsg('');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                statusType === 'image'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              <ImageIcon className="w-4 h-4" /> Photo Status
            </button>
          </div>

          {/* Type: TEXT */}
          {statusType === 'text' && (
            <div className="space-y-3">
              {/* Preview Box */}
              <div
                style={{ backgroundColor: selectedColor }}
                className="w-full h-44 rounded-2xl flex items-center justify-center p-5 text-center shadow-inner relative transition-colors duration-300"
              >
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Type your status here..."
                  maxLength={500}
                  className="w-full h-full bg-transparent text-white font-medium text-lg placeholder-white/60 border-0 resize-none text-center outline-none flex items-center justify-center"
                />
                <span className="absolute bottom-2 right-3 text-[10px] text-white/70">
                  {textContent.length}/500
                </span>
              </div>

              {/* Color Swatches */}
              <div>
                <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5 mb-2">
                  <Palette className="w-3.5 h-3.5" /> Background Color
                </label>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {BG_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setSelectedColor(c.value)}
                      style={{ backgroundColor: c.value }}
                      className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center transition-transform ${
                        selectedColor === c.value
                          ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110'
                          : 'hover:scale-105 opacity-80 hover:opacity-100'
                      }`}
                    >
                      {selectedColor === c.value && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Type: IMAGE */}
          {statusType === 'image' && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {imagePreview ? (
                <div className="relative w-full h-52 rounded-2xl overflow-hidden bg-black flex items-center justify-center group">
                  <img
                    src={imagePreview}
                    alt="Status Preview"
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full h-44 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-4 cursor-pointer transition-all ${
                    theme === 'light'
                      ? 'border-gray-300 hover:border-indigo-500 bg-gray-50/50 hover:bg-indigo-50/30'
                      : 'border-white/20 hover:border-indigo-500 bg-white/5 hover:bg-indigo-500/10'
                  }`}
                >
                  <div className="p-3 rounded-full bg-indigo-500/10 text-indigo-500 mb-2">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-semibold">Click to upload photo</p>
                  <p className="text-[10px] text-gray-400 mt-1">Supports PNG, JPG, GIF, WebP</p>
                </div>
              )}

              <div>
                <input
                  type="text"
                  placeholder="Add a caption..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={200}
                  className={`w-full px-3.5 py-2 text-xs rounded-xl border focus:outline-none focus:ring-1.5 focus:ring-indigo-500 transition-all ${
                    theme === 'light'
                      ? 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                      : 'bg-white/5 border-white/10 text-white placeholder-gray-500'
                  }`}
                />
              </div>
            </div>
          )}

          {/* Privacy Controls */}
          <div className="pt-2 border-t border-black/5 dark:border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-500" /> Status Privacy
              </label>
              <span className="text-[10px] text-gray-400">Who can see this update?</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPrivacy('everyone')}
                className={`p-2.5 rounded-xl border flex items-center gap-2 text-left transition-all ${
                  privacy === 'everyone'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500 font-semibold'
                    : theme === 'light'
                    ? 'border-gray-200 hover:bg-gray-100 text-gray-600'
                    : 'border-white/10 hover:bg-white/5 text-gray-400'
                }`}
              >
                <Users className="w-4 h-4 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs truncate">Everyone</div>
                  <div className="text-[9px] opacity-75 truncate">All your contacts</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPrivacy('selected')}
                className={`p-2.5 rounded-xl border flex items-center gap-2 text-left transition-all ${
                  privacy === 'selected'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500 font-semibold'
                    : theme === 'light'
                    ? 'border-gray-200 hover:bg-gray-100 text-gray-600'
                    : 'border-white/10 hover:bg-white/5 text-gray-400'
                }`}
              >
                <Lock className="w-4 h-4 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs truncate">Only Share With...</div>
                  <div className="text-[9px] opacity-75 truncate">
                    {allowedUsers.length} selected
                  </div>
                </div>
              </button>
            </div>

            {/* If 'selected' privacy is chosen, show contact list with search & select all */}
            {privacy === 'selected' && (
              <div className={`rounded-xl border p-3 space-y-2.5 ${
                theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-black/20 border-white/5'
              }`}>
                <div className="flex items-center justify-between text-[11px] pb-1 border-b border-black/5 dark:border-white/5">
                  <span className="font-semibold text-gray-500">
                    Selected: <strong className="text-indigo-500">{allowedUsers.length}</strong> of {availableUsers.length}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllUsers}
                      className="text-indigo-500 hover:underline font-medium"
                    >
                      Select All
                    </button>
                    <span className="text-gray-400">|</span>
                    <button
                      type="button"
                      onClick={deselectAllUsers}
                      className="text-gray-400 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Contact Search input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border outline-none transition-all ${
                      theme === 'light'
                        ? 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
                        : 'bg-white/5 border-white/10 text-white focus:border-indigo-500'
                    }`}
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 divide-y divide-black/5 dark:divide-white/5">
                  {loadingUsers ? (
                    <div className="py-6 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Loading contacts...
                    </div>
                  ) : filteredContacts.length === 0 ? (
                    <div className="py-4 text-center text-xs text-gray-400">
                      {availableUsers.length === 0 ? "No contacts found" : "No matching contacts found"}
                    </div>
                  ) : (
                    filteredContacts.map((u) => {
                      const isSelected = allowedUsers.includes(u._id);
                      return (
                        <div
                          key={u._id}
                          onClick={() => toggleUserSelection(u._id)}
                          className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all select-none ${
                            isSelected
                              ? 'bg-indigo-500/10 text-indigo-500'
                              : theme === 'light' ? 'hover:bg-gray-200/60' : 'hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full overflow-hidden bg-indigo-500/20 text-indigo-500 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                              {u.avatar?.url ? (
                                <img
                                  src={getAvatarUrl(u.avatar.url)}
                                  alt={u.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                u.name.slice(0, 2)
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{u.name}</p>
                              <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                            </div>
                          </div>

                          <div className="flex-shrink-0 ml-2">
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-indigo-600" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all ${
                theme === 'light'
                  ? 'border-gray-300 hover:bg-gray-100 text-gray-700'
                  : 'border-white/10 hover:bg-white/5 text-gray-300'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sharing...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" /> Share Status
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
