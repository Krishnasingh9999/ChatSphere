import React, { useState, useEffect } from 'react';
import { userApi, chatApi, getAvatarUrl } from '../utils/api';
import type { User } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { X, Search, UserPlus, MessageSquare } from 'lucide-react';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChatCreated: (chatId: string, targetUser?: User) => void;
  currentUserId: string;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  isOpen,
  onClose,
  onChatCreated,
  currentUserId,
}) => {
  const { theme } = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const fetchUsers = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await userApi.get('/user/all');
        // Exclude current user from the list
        const filtered = res.data.filter((u: User) => u._id !== currentUserId);
        setUsers(filtered);
      } catch (err: any) {
        console.error("Failed to load users:", err);
        setError("Could not load users. Please check server connections.");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [isOpen, currentUserId]);

  const handleCreateChat = async (targetUser: User) => {
    try {
      setLoading(true);
      const res = await chatApi.post('/chat/new', { otherUserId: targetUser._id });
      // The backend returns { message, chatId }
      onChatCreated(String(res.data.chatId), targetUser);
      onClose();
    } catch (err: any) {
      console.error("Failed to start chat:", err);
      setError(err.response?.data?.message || "Failed to start conversation");
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
      <div className={`w-[94vw] sm:w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85dvh] fade-in border ${
        theme === 'dark' 
          ? 'glass-panel glow-indigo border-white/10 text-white' 
          : 'bg-white border-gray-200 text-gray-900 shadow-xl'
      }`}>
        {/* Header */}
        <div className={`p-4 sm:p-5 border-b flex justify-between items-center ${
          theme === 'dark' 
            ? 'border-white/10 bg-[#111827]/40 text-white' 
            : 'border-gray-200 bg-gray-50 text-gray-900'
        }`}>
          <div className="flex items-center gap-2">
            <UserPlus className={`w-5 h-5 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`} />
            <h3 className="text-lg font-semibold font-display">New Conversation</h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-all ${
              theme === 'dark' 
                ? 'text-gray-400 hover:text-white hover:bg-white/5' 
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className={`p-4 border-b ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
          <div className="relative">
            <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            }`} />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border rounded-xl pl-10 pr-4 py-2.5 text-[15px] sm:text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                theme === 'dark'
                  ? 'bg-[#0b0f19]/80 border-white/10 text-white placeholder-gray-500'
                  : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
              }`}
            />
          </div>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {error && (
            <div className={`p-3.5 m-2 rounded-xl text-xs ${
              theme === 'dark' 
                ? 'bg-red-500/10 border border-red-500/20 text-red-400' 
                : 'bg-red-50 border border-red-200 text-red-600'
            }`}>
              {error}
            </div>
          )}

          {loading && users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-500 text-sm gap-2">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Searching directory...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className={`text-center py-10 text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
              No matching users found
            </div>
          ) : (
            filteredUsers.map((userItem) => (
              <button
                key={userItem._id}
                onClick={() => handleCreateChat(userItem)}
                className={`w-full flex items-center justify-between p-3 rounded-xl group border transition-all duration-200 ${
                  theme === 'dark'
                    ? 'hover:bg-white/5 border-transparent hover:border-white/5'
                    : 'hover:bg-indigo-50/70 border-transparent hover:border-indigo-100'
                }`}
              >
                <div className="flex items-center gap-3.5 text-left">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center text-sm font-semibold uppercase font-display select-none flex-shrink-0 border ${
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-indigo-500/20 to-purple-600/20 text-indigo-300 border-indigo-500/30'
                      : 'bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600 border-indigo-200'
                  }`}>
                    {userItem.avatar?.url ? (
                      <img
                        src={getAvatarUrl(userItem.avatar.url)}
                        alt={userItem.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          if (userItem.avatar?.url && target.src !== userItem.avatar.url) {
                            target.src = userItem.avatar.url;
                          }
                        }}
                      />
                    ) : (
                      userItem.name.slice(0, 2)
                    )}
                  </div>
                  <div>
                    <h4 className={`text-sm font-medium transition-colors ${
                      theme === 'dark'
                        ? 'text-white group-hover:text-indigo-300'
                        : 'text-gray-900 group-hover:text-indigo-600'
                    }`}>
                      {userItem.name}
                    </h4>
                    <p className={`text-xs truncate max-w-[200px] ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {userItem.email}
                    </p>
                  </div>
                </div>
                <div className={`p-2 rounded-lg opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all ${
                  theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-100 text-indigo-600'
                }`}>
                  <MessageSquare className="w-4 h-4" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
