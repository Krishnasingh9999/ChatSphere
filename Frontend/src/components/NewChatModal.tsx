import React, { useState, useEffect } from 'react';
import { userApi, chatApi, getAvatarUrl } from '../utils/api';
import type { User } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  X, 
  Search, 
  UserPlus, 
  MessageSquare, 
  Star, 
  Users, 
  Sparkles
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'saved' | 'all'>('saved');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [savedContacts, setSavedContacts] = useState<User[]>([]);
  const [savedContactIds, setSavedContactIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingContactId, setSavingContactId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch all users and saved contacts in parallel
        const [allRes, savedRes] = await Promise.all([
          userApi.get('/user/all'),
          userApi.get('/user/contacts').catch(() => ({ data: [] })),
        ]);

        const filteredAll = (allRes.data || []).filter((u: User) => u._id !== currentUserId);
        const savedList: User[] = (savedRes.data || []).filter((u: User) => u._id !== currentUserId);
        
        setAllUsers(filteredAll);
        setSavedContacts(savedList);

        const ids = new Set<string>(savedList.map((u) => u._id));
        setSavedContactIds(ids);

        // If no saved contacts, default to 'all' tab for new users
        if (savedList.length === 0) {
          setActiveTab('all');
        } else {
          setActiveTab('saved');
        }
      } catch (err: any) {
        console.error("Failed to load users/contacts:", err);
        setError("Could not load users. Please check your network connection.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, currentUserId]);

  // Start or open conversation
  const handleCreateChat = async (targetUser: User) => {
    try {
      setLoading(true);
      const res = await chatApi.post('/chat/new', { otherUserId: targetUser._id });
      onChatCreated(String(res.data.chatId), targetUser);
      onClose();
    } catch (err: any) {
      console.error("Failed to start chat:", err);
      setError(err.response?.data?.message || "Failed to start conversation");
      setLoading(false);
    }
  };

  // Toggle Save / Unsave contact
  const handleToggleSaveContact = async (e: React.MouseEvent, targetUser: User) => {
    e.stopPropagation();
    const isSaved = savedContactIds.has(targetUser._id);
    setSavingContactId(targetUser._id);

    try {
      if (isSaved) {
        // Remove from contacts
        await userApi.delete(`/user/contact/${targetUser._id}`);
        setSavedContactIds((prev) => {
          const next = new Set(prev);
          next.delete(targetUser._id);
          return next;
        });
        setSavedContacts((prev) => prev.filter((u) => u._id !== targetUser._id));
      } else {
        // Add to contacts
        await userApi.post(`/user/contact/${targetUser._id}`);
        setSavedContactIds((prev) => new Set(prev).add(targetUser._id));
        setSavedContacts((prev) => {
          if (prev.some((u) => u._id === targetUser._id)) return prev;
          return [targetUser, ...prev];
        });
      }
    } catch (err) {
      console.error("Error toggling saved contact:", err);
    } finally {
      setSavingContactId(null);
    }
  };

  if (!isOpen) return null;

  const currentList = activeTab === 'saved' ? savedContacts : allUsers;
  const filteredUsers = currentList.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-3 sm:p-4 animate-fade-in">
      <div className={`w-[94vw] sm:w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85dvh] border animate-scale-up ${
        theme === 'dark' 
          ? 'glass-panel glow-indigo border-white/10 text-white bg-[#0f172a]/90' 
          : 'bg-white border-gray-200 text-gray-900 shadow-xl'
      }`}>
        {/* Header */}
        <div className={`p-4 sm:p-5 border-b flex justify-between items-center ${
          theme === 'dark' 
            ? 'border-white/10 bg-[#111827]/60 text-white' 
            : 'border-gray-200 bg-gray-50/80 text-gray-900'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${theme === 'dark' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold font-display">New Conversation</h3>
              <p className={`text-[11px] ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                {activeTab === 'saved' ? 'Your saved frequent contacts' : 'Explore ChatSphere directory'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-all ${
              theme === 'dark' 
                ? 'text-gray-400 hover:text-white hover:bg-white/10' 
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation (WhatsApp Style Saved vs Discover) */}
        <div className={`p-2 border-b flex gap-1.5 ${
          theme === 'dark' ? 'border-white/10 bg-[#0b0f19]/40' : 'border-gray-100 bg-gray-50/50'
        }`}>
          <button
            type="button"
            onClick={() => {
              setActiveTab('saved');
              setSearchQuery('');
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'saved'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20'
                : theme === 'dark'
                ? 'text-gray-400 hover:text-white hover:bg-white/5'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${activeTab === 'saved' ? 'fill-current text-white' : 'text-amber-500'}`} />
            <span>Saved Contacts</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === 'saved' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}>
              {savedContacts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('all');
              setSearchQuery('');
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'all'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                : theme === 'dark'
                ? 'text-gray-400 hover:text-white hover:bg-white/5'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>All Users</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}>
              {allUsers.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className={`p-3.5 border-b ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
          <div className="relative">
            <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            }`} />
            <input
              type="text"
              placeholder={activeTab === 'saved' ? 'Search saved contacts...' : 'Search by name or email...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border rounded-xl pl-10 pr-4 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                theme === 'dark'
                  ? 'bg-[#0b0f19]/80 border-white/10 text-white placeholder-gray-500'
                  : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
              }`}
            />
          </div>
        </div>

        {/* User / Contact List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 min-h-[220px]">
          {error && (
            <div className={`p-3.5 m-2 rounded-xl text-xs ${
              theme === 'dark' 
                ? 'bg-red-500/10 border border-red-500/20 text-red-400' 
                : 'bg-red-50 border border-red-200 text-red-600'
            }`}>
              {error}
            </div>
          )}

          {loading && currentList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 text-sm gap-2">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Loading contacts...</span>
            </div>
          ) : activeTab === 'saved' && savedContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${
                theme === 'dark' ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-500'
              }`}>
                <Star className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-semibold mb-1">No Saved Contacts Yet</h4>
              <p className={`text-xs max-w-xs mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Save your friends and frequent contacts so you can message them anytime, even if you delete your chat histories!
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 active:scale-95 transition-transform flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Explore Directory to Save</span>
              </button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className={`text-center py-12 text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
              No matching users found
            </div>
          ) : (
            filteredUsers.map((userItem) => {
              const isSaved = savedContactIds.has(userItem._id);
              const isSaving = savingContactId === userItem._id;

              return (
                <div
                  key={userItem._id}
                  onClick={() => handleCreateChat(userItem)}
                  className={`w-full flex items-center justify-between p-2.5 sm:p-3 rounded-2xl group border transition-all duration-200 cursor-pointer ${
                    theme === 'dark'
                      ? 'hover:bg-white/5 border-transparent hover:border-white/10'
                      : 'hover:bg-indigo-50/70 border-transparent hover:border-indigo-100'
                  }`}
                >
                  <div className="flex items-center gap-3 text-left min-w-0 flex-1 mr-2">
                    <div className={`w-10 h-10 rounded-2xl overflow-hidden flex items-center justify-center text-sm font-semibold uppercase font-display select-none flex-shrink-0 border relative shadow-xs ${
                      theme === 'dark'
                        ? 'bg-gradient-to-br from-indigo-500/20 to-purple-600/20 text-indigo-300 border-indigo-500/30'
                        : 'bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600 border-indigo-200'
                    }`}>
                      <span className="text-xs font-bold uppercase select-none">{userItem.name.slice(0, 2)}</span>
                      {userItem.avatar?.url && (
                        <img
                          src={getAvatarUrl(userItem.avatar.url)}
                          alt={userItem.name}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className={`text-sm font-semibold truncate transition-colors ${
                          theme === 'dark'
                            ? 'text-white group-hover:text-indigo-300'
                            : 'text-gray-900 group-hover:text-indigo-600'
                        }`}>
                          {userItem.name}
                        </h4>
                        {isSaved && (
                          <span className="text-amber-500 flex-shrink-0" title="Saved Contact">
                            <Star className="w-3 h-3 fill-current" />
                          </span>
                        )}
                      </div>
                      <p className={`text-xs truncate ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        {userItem.email}
                      </p>
                    </div>
                  </div>

                  {/* Actions: Save/Unsave Star + Direct Chat */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Save / Bookmark Button */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleSaveContact(e, userItem)}
                      disabled={isSaving}
                      title={isSaved ? "Remove from Saved Contacts" : "Save to Contacts"}
                      className={`p-2 rounded-xl transition-all active:scale-90 ${
                        isSaved
                          ? 'text-amber-500 hover:bg-amber-500/15 bg-amber-500/10'
                          : theme === 'dark'
                          ? 'text-gray-400 hover:text-amber-400 hover:bg-white/10'
                          : 'text-gray-400 hover:text-amber-500 hover:bg-gray-100'
                      }`}
                    >
                      {isSaving ? (
                        <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Star className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                      )}
                    </button>

                    {/* Chat Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateChat(userItem);
                      }}
                      title="Start Conversation"
                      className={`p-2 rounded-xl transition-all active:scale-90 ${
                        theme === 'dark'
                          ? 'bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500 hover:text-white'
                          : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

