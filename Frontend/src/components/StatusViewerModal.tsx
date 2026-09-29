import React, { useState, useEffect, useRef } from 'react';
import { chatApi, getAvatarUrl, getMediaUrl } from '../utils/api';
import { X, ChevronLeft, ChevronRight, Eye, Trash2, Lock, Clock, Globe } from 'lucide-react';

export interface StatusItem {
  _id: string;
  user: {
    _id: string;
    name: string;
    avatar?: {
      url: string;
    } | null;
  };
  type: 'text' | 'image';
  content?: string;
  media?: {
    url: string;
    publicId?: string;
  } | null;
  bgColor?: string;
  privacy: 'everyone' | 'selected';
  allowedUsers?: string[];
  viewers?: Array<{
    user: {
      _id: string;
      name: string;
      avatar?: { url: string } | null;
    };
    viewedAt: string;
  }>;
  viewersCount?: number;
  isViewed?: boolean;
  createdAt: string;
  expiresAt: string;
}

interface StatusViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  statusGroup: {
    user: {
      _id: string;
      name: string;
      avatar?: { url: string } | null;
    };
    statuses: StatusItem[];
  } | null;
  initialIndex?: number;
  currentUserId: string;
  onDeleteStatus: (statusId: string) => void;
  onStatusViewed: (statusId: string) => void;
}

const STORY_DURATION = 5000; // 5 seconds per story

export const StatusViewerModal: React.FC<StatusViewerModalProps> = ({
  isOpen,
  onClose,
  statusGroup,
  initialIndex = 0,
  currentUserId,
  onDeleteStatus,
  onStatusViewed,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showViewersSheet, setShowViewersSheet] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const timerRef = useRef<any>(null);
  const lastOpenedGroupUserRef = useRef<string | null>(null);

  const statuses = statusGroup?.statuses || [];
  const currentStatus = statuses[currentIndex] || statuses[0];
  const isOwner = currentStatus?.user?._id === currentUserId || statusGroup?.user?._id === currentUserId;

  // Initialize/Reset index when opening modal or changing user
  useEffect(() => {
    if (isOpen && statusGroup && statuses.length > 0) {
      const currentGroupId = statusGroup.user._id;
      if (lastOpenedGroupUserRef.current !== currentGroupId) {
        const startIdx = Math.min(Math.max(0, initialIndex), statuses.length - 1);
        setCurrentIndex(startIdx);
        setProgress(0);
        setShowViewersSheet(false);
        lastOpenedGroupUserRef.current = currentGroupId;
      }
    } else if (!isOpen) {
      lastOpenedGroupUserRef.current = null;
      setProgress(0);
    }
  }, [isOpen, statusGroup?.user?._id, initialIndex, statuses.length]);

  // Mark current status as viewed when displayed
  useEffect(() => {
    if (!isOpen || !currentStatus) return;

    if (!isOwner && !currentStatus.isViewed) {
      chatApi.put(`/status/${currentStatus._id}/view`).catch((err) => {
        console.error("Failed to record status view:", err);
      });
      onStatusViewed(currentStatus._id);
    }
  }, [isOpen, currentIndex, currentStatus?._id, isOwner]);

  // Story Progress Timer
  useEffect(() => {
    if (!isOpen || !currentStatus || isPaused || showViewersSheet) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const interval = 50; // update every 50ms
    const step = (interval / STORY_DURATION) * 100;

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev + step >= 100) {
          // Advance to next story or close if last
          if (currentIndex < statuses.length - 1) {
            setCurrentIndex((idx) => idx + 1);
            return 0;
          } else {
            clearInterval(timerRef.current);
            onClose();
            return 100;
          }
        }
        return prev + step;
      });
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, currentIndex, isPaused, showViewersSheet, statuses.length, currentStatus?._id]);

  // Keyboard Navigation: ArrowLeft, ArrowRight, Escape, Space
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (showViewersSheet) {
        if (e.key === 'Escape') setShowViewersSheet(false);
        return;
      }

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((p) => !p);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, statuses.length, showViewersSheet]);

  if (!isOpen || !statusGroup || statuses.length === 0 || !currentStatus) return null;

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setProgress(0);
    }
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this status?")) return;
    setIsDeleting(true);
    try {
      await chatApi.delete(`/status/${currentStatus._id}`);
      onDeleteStatus(currentStatus._id);
      if (statuses.length <= 1) {
        onClose();
      } else if (currentIndex >= statuses.length - 1) {
        setCurrentIndex((prev) => Math.max(0, prev - 1));
        setProgress(0);
      } else {
        setProgress(0);
      }
    } catch (err) {
      console.error("Failed to delete status:", err);
      alert("Failed to delete status. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md select-none animate-fade-in">
      {/* Mobile/Desktop responsive story frame */}
      <div
        className="relative w-full max-w-md h-[100dvh] sm:h-[88vh] sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col justify-between"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Story Segmented Progress Bars (WhatsApp-style) */}
        <div className={`absolute top-0 inset-x-0 z-30 p-3 pt-3 flex gap-1.5 bg-gradient-to-b from-black/80 via-black/40 to-transparent transition-opacity duration-200 ${
          isPaused && !showViewersSheet ? 'opacity-0' : 'opacity-100'
        }`}>
          {statuses.map((st, idx) => {
            let fillPercent = 0;
            if (idx < currentIndex) fillPercent = 100;
            else if (idx === currentIndex) fillPercent = progress;
            else fillPercent = 0;

            return (
              <div
                key={st._id || idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                  setProgress(0);
                }}
                className="flex-1 h-1.5 bg-white/30 rounded-full overflow-hidden cursor-pointer"
              >
                <div
                  className="h-full bg-white transition-all duration-75 ease-linear rounded-full"
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Top Header with Author Info and Actions */}
        <div className={`absolute top-7 inset-x-0 z-30 px-4 py-2 flex items-center justify-between text-white transition-opacity duration-200 ${
          isPaused && !showViewersSheet ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-tr from-indigo-500 to-purple-600 border-2 border-white flex items-center justify-center text-sm font-bold uppercase shadow-md flex-shrink-0">
              {statusGroup.user.avatar?.url ? (
                <img
                  src={getAvatarUrl(statusGroup.user.avatar.url)}
                  alt={statusGroup.user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                statusGroup.user.name.slice(0, 2)
              )}
            </div>
            <div>
              <h4 className="text-sm font-bold tracking-wide flex items-center gap-1.5">
                {isOwner ? "My Status" : statusGroup.user.name}
                {currentStatus.privacy === 'selected' ? (
                  <span title="Only shared with selected contacts" className="p-0.5 rounded bg-white/20 text-white text-[10px] flex items-center gap-0.5 px-1">
                    <Lock className="w-3 h-3 inline" /> Only selected
                  </span>
                ) : (
                  <span title="Shared with everyone" className="p-0.5 rounded bg-white/20 text-white text-[10px] flex items-center gap-0.5 px-1">
                    <Globe className="w-3 h-3 inline" /> Everyone
                  </span>
                )}
                {statuses.length > 1 && (
                  <span className="text-[11px] text-white/80 font-semibold ml-1 bg-white/20 px-1.5 py-0.5 rounded-full">
                    {currentIndex + 1} / {statuses.length}
                  </span>
                )}
              </h4>
              <p className="text-[11px] text-white/80 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" /> {formatTime(currentStatus.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOwner && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                title="Delete this status"
                className="p-2 rounded-full bg-black/40 hover:bg-red-500/80 text-white transition-all active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-black/40 hover:bg-white/20 text-white transition-all active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Story Content Area */}
        <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
          {currentStatus.type === 'text' ? (
            <div
              style={{ backgroundColor: currentStatus.bgColor || '#6366f1' }}
              className="w-full h-full flex items-center justify-center p-8 text-center"
            >
              <p className="text-white text-2xl font-bold tracking-wide leading-relaxed select-text max-w-sm break-words whitespace-pre-wrap">
                {currentStatus.content}
              </p>
            </div>
          ) : (
            <div className="w-full h-full bg-black flex flex-col items-center justify-center relative">
              <img
                src={getMediaUrl(currentStatus.media?.url)}
                alt="Status Media"
                className="w-full h-full object-contain"
              />
              {currentStatus.content && (
                <div className="absolute bottom-16 inset-x-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-center">
                  <p className="text-white text-sm font-medium drop-shadow-md">
                    {currentStatus.content}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Left/Right Tap Zones for Story Navigation */}
          <div
            onClick={handlePrev}
            className="absolute left-0 top-16 bottom-16 w-1/2 z-20 cursor-pointer"
            title="Previous Story"
          />
          <div
            onClick={handleNext}
            className="absolute right-0 top-16 bottom-16 w-1/2 z-20 cursor-pointer"
            title="Next Story"
          />

          {/* On-screen navigation arrows for clarity */}
          {currentIndex > 0 && (
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/70 text-white z-30 transition-all active:scale-90"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {currentIndex < statuses.length - 1 && (
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/70 text-white z-30 transition-all active:scale-90"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Bottom Bar / Seen Sheet for Owner */}
        {isOwner && (
          <div className="absolute bottom-0 inset-x-0 z-30 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col items-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowViewersSheet(true);
              }}
              className="px-4 py-1.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-lg"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{currentStatus.viewers?.length || currentStatus.viewersCount || 0} viewed</span>
            </button>
          </div>
        )}

        {/* Viewers Bottom Sheet Modal */}
        {isOwner && showViewersSheet && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-fade-in"
          >
            <div className="bg-[#1e293b] rounded-t-3xl border-t border-white/10 p-4 max-h-[60vh] flex flex-col shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2 text-white font-semibold text-sm">
                  <Eye className="w-4 h-4 text-indigo-400" />
                  <span>Viewed by ({currentStatus.viewers?.length || 0})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowViewersSheet(false)}
                  className="p-1 text-gray-400 hover:text-white rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-2 space-y-2 divide-y divide-white/5">
                {(!currentStatus.viewers || currentStatus.viewers.length === 0) ? (
                  <div className="py-8 text-center text-xs text-gray-400">
                    No views yet
                  </div>
                ) : (
                  currentStatus.viewers.map((v, i) => (
                    <div key={v.user._id || i} className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {v.user.avatar?.url ? (
                            <img
                              src={getAvatarUrl(v.user.avatar.url)}
                              alt={v.user.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            v.user.name.slice(0, 2)
                          )}
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-xs font-semibold text-white truncate">
                            {v.user.name}
                          </h5>
                          <p className="text-[10px] text-gray-400">
                            {formatTime(v.viewedAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Desktop Side External Arrows */}
        {currentIndex > 0 && (
          <button
            type="button"
            onClick={handlePrev}
            className="hidden sm:flex absolute -left-12 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all z-40"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        {currentIndex < statuses.length - 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="hidden sm:flex absolute -right-12 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all z-40"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>
    </div>
  );
};
