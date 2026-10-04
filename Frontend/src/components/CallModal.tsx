import React, { useEffect, useRef } from 'react';
import { useCall } from '../context/CallContext';
import { getAvatarUrl } from '../utils/api';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  SwitchCamera, 
  ShieldCheck,
  User
} from 'lucide-react';

export const CallModal: React.FC = () => {
  const {
    callStatus,
    callType,
    otherUser,
    isCaller,
    isMuted,
    isVideoOff,
    callDuration,
    localStream,
    remoteStream,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    flipCamera,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Attach local media stream to local video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch((err) => console.warn('Local video play warning:', err));
    }
  }, [localStream, callStatus]);

  // Attach remote media stream to remote video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch((err) => console.warn('Remote video play warning:', err));
    }
  }, [remoteStream, callStatus]);

  if (callStatus === 'idle' || !otherUser) return null;

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const avatarUrl = otherUser.avatar && typeof otherUser.avatar === 'object' ? otherUser.avatar.url : otherUser.avatar;

  // =========================================================================
  // VIDEO CALL INTERFACE (Fullscreen + Picture-in-Picture Floating Preview)
  // =========================================================================
  if (callType === 'video') {
    return (
      <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/95 select-none animate-fade-in overflow-hidden">
        
        {/* Remote Video (Fullscreen Background) */}
        {callStatus === 'connected' && (
          <div className="absolute inset-0 w-full h-full bg-neutral-950 flex items-center justify-center overflow-hidden">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {/* Fallback if remote video track is empty/delayed */}
            {!remoteStream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-900 text-gray-400">
                <div className="w-24 h-24 rounded-full bg-neutral-800 flex items-center justify-center animate-pulse">
                  <User className="w-12 h-12 text-gray-500" />
                </div>
                <p className="text-sm font-medium">Connecting video stream...</p>
              </div>
            )}
          </div>
        )}

        {/* Incoming / Calling Fullscreen Backdrop when not yet connected */}
        {callStatus !== 'connected' && (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-[#111b21] via-[#0b141a] to-[#05090b] flex flex-col items-center justify-center">
            {/* If caller, show local video preview behind subtle blur */}
            {isCaller && localStream && !isVideoOff && (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover opacity-30 blur-xs -scale-x-100"
              />
            )}
          </div>
        )}

        {/* Floating Top Header Bar */}
        <div className="absolute top-0 inset-x-0 p-4 sm:p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-30 flex flex-col items-center text-center text-white pointer-events-auto">
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-emerald-400 font-medium tracking-wide bg-emerald-500/15 backdrop-blur-md px-3 py-1 rounded-full border border-emerald-500/25 mb-2 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>End-to-End Encrypted Video</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-white drop-shadow-md">
            {otherUser.name}
          </h2>

          <p className="text-xs sm:text-sm font-medium text-gray-300 drop-shadow mt-0.5">
            {callStatus === 'incoming' && 'Incoming Video Call...'}
            {callStatus === 'calling' && (isCaller ? 'Ringing video call...' : 'Calling video...')}
            {callStatus === 'connected' && (
              <span className="text-emerald-400 font-mono tracking-wider font-semibold">
                {formatDuration(callDuration)}
              </span>
            )}
            {callStatus === 'ended' && <span className="text-red-400 font-semibold">Call Ended</span>}
          </p>
        </div>

        {/* Center: Large Avatar when incoming or calling */}
        {callStatus !== 'connected' && (
          <div className="relative z-20 flex flex-col items-center justify-center">
            <div className="relative mb-4 flex items-center justify-center">
              {callStatus === 'incoming' && (
                <>
                  <div className="absolute w-36 h-36 rounded-full bg-emerald-500/25 animate-ping"></div>
                  <div className="absolute w-44 h-44 rounded-full border-2 border-emerald-500/40 animate-pulse"></div>
                </>
              )}
              {callStatus === 'calling' && (
                <div className="absolute w-36 h-36 rounded-full bg-indigo-500/20 animate-pulse"></div>
              )}
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 border-4 border-white/20 shadow-2xl flex items-center justify-center relative">
                <span className="text-3xl font-bold uppercase select-none text-white font-display">
                  {otherUser.name.slice(0, 2)}
                </span>
                {avatarUrl && (
                  <img
                    src={getAvatarUrl(avatarUrl)}
                    alt={otherUser.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Picture-in-Picture (PIP) Floating Local Video Preview when connected */}
        {callStatus === 'connected' && (
          <div className="absolute top-20 right-4 sm:top-24 sm:right-6 w-28 h-40 sm:w-36 sm:h-52 bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/25 z-40 transition-all">
            {!isVideoOff ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 text-gray-400 p-2 text-center">
                <VideoOff className="w-6 h-6 sm:w-8 sm:h-8 text-gray-500 mb-1" />
                <span className="text-[10px] font-medium">Camera Off</span>
              </div>
            )}
          </div>
        )}

        {/* Bottom Floating Control Dock */}
        <div className="absolute bottom-0 inset-x-0 p-6 sm:p-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-40 flex flex-col items-center">
          
          {/* Incoming Call: Accept / Decline */}
          {callStatus === 'incoming' && (
            <div className="w-full max-w-xs flex items-center justify-around">
              <button
                type="button"
                onClick={rejectCall}
                className="flex flex-col items-center gap-1.5 group active:scale-95 transition-all"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-xl shadow-red-600/40 group-hover:scale-105 transition-transform">
                  <PhoneOff className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <span className="text-xs font-medium text-gray-300">Decline</span>
              </button>

              <button
                type="button"
                onClick={acceptCall}
                className="flex flex-col items-center gap-1.5 group active:scale-95 transition-all"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-600/40 animate-bounce group-hover:scale-105 transition-transform">
                  <Video className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <span className="text-xs font-medium text-emerald-400 font-semibold">Join Video</span>
              </button>
            </div>
          )}

          {/* Active / Calling Video Controls Bar */}
          {(callStatus === 'calling' || callStatus === 'connected') && (
            <div className="flex items-center gap-4 sm:gap-6 bg-black/50 backdrop-blur-xl px-5 py-3 sm:px-6 sm:py-3.5 rounded-full border border-white/15 shadow-2xl">
              
              {/* Flip Camera */}
              <button
                type="button"
                onClick={flipCamera}
                disabled={isVideoOff}
                className={`p-3.5 sm:p-4 rounded-full border transition-all active:scale-95 ${
                  isVideoOff
                    ? 'opacity-40 cursor-not-allowed bg-white/5 border-white/10 text-gray-400'
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
                }`}
                title="Flip Camera (Front / Back)"
              >
                <SwitchCamera className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>

              {/* Camera Video Toggle */}
              <button
                type="button"
                onClick={toggleVideo}
                className={`p-3.5 sm:p-4 rounded-full border transition-all active:scale-95 ${
                  isVideoOff
                    ? 'bg-red-500/25 text-red-400 border-red-500/40'
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
                }`}
                title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
              >
                {isVideoOff ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>

              {/* Mic Mute Toggle */}
              <button
                type="button"
                onClick={toggleMute}
                className={`p-3.5 sm:p-4 rounded-full border transition-all active:scale-95 ${
                  isMuted
                    ? 'bg-red-500/25 text-red-400 border-red-500/40'
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
                }`}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>

              {/* End Call Button */}
              <button
                type="button"
                onClick={endCall}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-600/50 active:scale-95 hover:scale-105 transition-all"
                title="End Video Call"
              >
                <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          )}

          {callStatus === 'ended' && (
            <div className="text-xs text-gray-400 italic py-2">
              Ending video session...
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VOICE CALL INTERFACE (WhatsApp Voice Call Style)
  // =========================================================================
  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="w-full max-w-sm sm:max-w-md bg-gradient-to-b from-[#111b21] to-[#0c1317] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col items-center justify-between p-6 sm:p-8 min-h-[480px] sm:min-h-[520px] relative text-white animate-scale-up">
        
        {/* Ambient Top Glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/15 rounded-full blur-[70px] pointer-events-none"></div>

        {/* Header Status */}
        <div className="flex flex-col items-center gap-1.5 z-10 text-center">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium tracking-wide bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>End-to-End Encrypted Voice Call</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold font-display tracking-tight mt-2 max-w-[280px] truncate">
            {otherUser.name}
          </h2>

          <p className="text-xs sm:text-sm font-medium text-gray-400">
            {callStatus === 'incoming' && 'Incoming voice call...'}
            {callStatus === 'calling' && (isCaller ? 'Ringing...' : 'Calling...')}
            {callStatus === 'connected' && (
              <span className="text-emerald-400 font-mono tracking-wider font-semibold">
                {formatDuration(callDuration)}
              </span>
            )}
            {callStatus === 'ended' && <span className="text-red-400">Call Ended</span>}
          </p>
        </div>

        {/* Center: Pulsing Avatar with Sound Waves */}
        <div className="relative my-6 flex items-center justify-center z-10">
          {callStatus === 'connected' && (
            <>
              <div className="absolute w-36 h-36 rounded-full bg-emerald-500/15 animate-ping duration-1000"></div>
              <div className="absolute w-44 h-44 rounded-full border border-emerald-500/20 animate-pulse"></div>
            </>
          )}

          {callStatus === 'incoming' && (
            <>
              <div className="absolute w-36 h-36 rounded-full bg-emerald-500/20 animate-ping"></div>
              <div className="absolute w-44 h-44 rounded-full border-2 border-emerald-500/30 animate-pulse"></div>
            </>
          )}

          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 border-4 border-white/10 shadow-2xl flex items-center justify-center relative">
            <span className="text-3xl font-bold uppercase select-none font-display">
              {otherUser.name.slice(0, 2)}
            </span>
            {avatarUrl && (
              <img
                src={getAvatarUrl(avatarUrl)}
                alt={otherUser.name}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="w-full z-10 flex flex-col items-center gap-4">
          {/* Incoming Call: Dual Accept/Decline Buttons */}
          {callStatus === 'incoming' && (
            <div className="w-full flex items-center justify-around px-4">
              {/* Decline Button */}
              <button
                type="button"
                onClick={rejectCall}
                className="flex flex-col items-center gap-1.5 group active:scale-95 transition-all"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-600/40 group-hover:scale-105 transition-transform">
                  <PhoneOff className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <span className="text-xs font-medium text-gray-300">Decline</span>
              </button>

              {/* Accept Button */}
              <button
                type="button"
                onClick={acceptCall}
                className="flex flex-col items-center gap-1.5 group active:scale-95 transition-all"
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 animate-bounce group-hover:scale-105 transition-transform">
                  <Phone className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <span className="text-xs font-medium text-emerald-400 font-semibold">Accept</span>
              </button>
            </div>
          )}

          {/* Active / Outgoing Call Controls */}
          {(callStatus === 'calling' || callStatus === 'connected') && (
            <div className="w-full flex items-center justify-center gap-6 sm:gap-8 px-4">
              {/* Mute Mic Button */}
              <button
                type="button"
                onClick={toggleMute}
                disabled={callStatus !== 'connected'}
                className={`p-3.5 sm:p-4 rounded-full border transition-all active:scale-95 ${
                  isMuted
                    ? 'bg-red-500/20 text-red-400 border-red-500/40'
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
                }`}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>

              {/* End Call Button */}
              <button
                type="button"
                onClick={endCall}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-600/40 active:scale-95 hover:scale-105 transition-all"
                title="End Call"
              >
                <PhoneOff className="w-6 h-6 sm:w-7 sm:h-7" />
              </button>
            </div>
          )}

          {/* Ended Call */}
          {callStatus === 'ended' && (
            <div className="text-xs text-gray-500 italic py-2">
              Disconnecting voice session...
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

