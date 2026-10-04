import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

export type CallStatus = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended';

interface CallParticipant {
  _id: string;
  name: string;
  avatar?: { url: string } | string | null;
}

interface CallContextType {
  callStatus: CallStatus;
  otherUser: CallParticipant | null;
  isCaller: boolean;
  isMuted: boolean;
  callDuration: number;
  startCall: (targetUser: CallParticipant) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();

  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [otherUser, setOtherUser] = useState<CallParticipant | null>(null);
  const [isCaller, setIsCaller] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [callDuration, setCallDuration] = useState<number>(0);

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const incomingSignalRef = useRef<any>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize hidden remote audio element
  useEffect(() => {
    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    audioEl.setAttribute('playsinline', 'true');
    remoteAudioRef.current = audioEl;
    document.body.appendChild(audioEl);

    return () => {
      if (remoteAudioRef.current && remoteAudioRef.current.parentNode) {
        remoteAudioRef.current.parentNode.removeChild(remoteAudioRef.current);
      }
    };
  }, []);

  // Web Audio API Ringtone generator (Zero external MP3 dependencies!)
  const startRingtone = (type: 'outgoing' | 'incoming') => {
    stopRingtone();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const playTone = () => {
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        // WhatsApp / European standard dual tone
        osc1.frequency.value = type === 'incoming' ? 440 : 425;
        osc2.frequency.value = type === 'incoming' ? 480 : 425;

        gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (type === 'incoming' ? 1.4 : 1.2));

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + (type === 'incoming' ? 1.4 : 1.2));
        osc2.stop(ctx.currentTime + (type === 'incoming' ? 1.4 : 1.2));
      };

      playTone();
      ringtoneIntervalRef.current = setInterval(playTone, type === 'incoming' ? 3000 : 3500);
    } catch (e) {
      console.warn('Ringtone AudioContext error:', e);
    }
  };

  const stopRingtone = () => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
  };

  // Clean all local media streams & connections
  const cleanupCall = () => {
    stopRingtone();
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    incomingSignalRef.current = null;
    setIsMuted(false);
    setCallDuration(0);
  };

  // Setup PeerConnection with handlers
  const createPeerConnection = (targetUserId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', {
          to: targetUserId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteAudioRef.current && event.streams && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch((err) => console.warn('Audio autoplay prevented:', err));
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // Start outgoing call
  const startCall = async (targetUser: CallParticipant) => {
    if (!socket || !user) return;
    try {
      cleanupCall();
      setIsCaller(true);
      setOtherUser(targetUser);
      setCallStatus('calling');
      startRingtone('outgoing');

      // Request microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      const pc = createPeerConnection(targetUser._id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('call-user', {
        userToCall: targetUser._id,
        signalData: offer,
        from: user._id,
        callerName: user.name,
        callerAvatar: user.avatar,
      });
    } catch (err) {
      console.error('Failed to start call / mic permission denied:', err);
      alert('Could not access microphone. Please allow microphone permissions.');
      setCallStatus('idle');
      cleanupCall();
    }
  };

  // Accept incoming call
  const acceptCall = async () => {
    if (!socket || !otherUser || !incomingSignalRef.current) return;
    try {
      stopRingtone();
      setCallStatus('connected');

      // Request microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      const pc = createPeerConnection(otherUser._id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(incomingSignalRef.current));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('answer-call', {
        to: otherUser._id,
        signal: answer,
      });

      // Start call duration timer
      setCallDuration(0);
      durationTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accepting call:', err);
      rejectCall();
    }
  };

  // Reject incoming call
  const rejectCall = () => {
    if (socket && otherUser) {
      socket.emit('reject-call', { to: otherUser._id });
    }
    setCallStatus('idle');
    cleanupCall();
  };

  // End active or outgoing call
  const endCall = () => {
    if (socket && otherUser) {
      socket.emit('end-call', { to: otherUser._id });
    }
    setCallStatus('ended');
    setTimeout(() => {
      setCallStatus('idle');
      setOtherUser(null);
      cleanupCall();
    }, 1200);
  };

  // Toggle microphone mute state
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Socket listener for incoming call events
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data: { signal: any; from: string; callerName: string; callerAvatar?: any }) => {
      if (callStatus !== 'idle') {
        socket.emit('reject-call', { to: data.from });
        return;
      }

      incomingSignalRef.current = data.signal;
      setIsCaller(false);
      setOtherUser({
        _id: data.from,
        name: data.callerName || 'Incoming Caller',
        avatar: data.callerAvatar,
      });
      setCallStatus('incoming');
      startRingtone('incoming');
    };

    const handleCallAccepted = async (data: { signal: any }) => {
      stopRingtone();
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.signal));
          setCallStatus('connected');
          setCallDuration(0);
          durationTimerRef.current = setInterval(() => {
            setCallDuration((prev) => prev + 1);
          }, 1000);
        } catch (e) {
          console.error('Failed to set remote description on call accepted:', e);
        }
      }
    };

    const handleIceCandidate = async (data: { candidate: any }) => {
      if (peerConnectionRef.current && data.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.warn('Error adding received ICE candidate:', e);
        }
      }
    };

    const handleCallRejected = () => {
      setCallStatus('ended');
      setTimeout(() => {
        setCallStatus('idle');
        setOtherUser(null);
        cleanupCall();
      }, 1500);
    };

    const handleCallEnded = () => {
      setCallStatus('ended');
      setTimeout(() => {
        setCallStatus('idle');
        setOtherUser(null);
        cleanupCall();
      }, 1500);
    };

    const handleCallUserOffline = () => {
      alert('User is currently offline.');
      setCallStatus('idle');
      cleanupCall();
    };

    socket.on('incoming-call', handleIncomingCall);
    socket.on('call-accepted', handleCallAccepted);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('call-rejected', handleCallRejected);
    socket.on('call-ended', handleCallEnded);
    socket.on('call-user-offline', handleCallUserOffline);

    return () => {
      socket.off('incoming-call', handleIncomingCall);
      socket.off('call-accepted', handleCallAccepted);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('call-rejected', handleCallRejected);
      socket.off('call-ended', handleCallEnded);
      socket.off('call-user-offline', handleCallUserOffline);
    };
  }, [socket, callStatus]);

  return (
    <CallContext.Provider
      value={{
        callStatus,
        otherUser,
        isCaller,
        isMuted,
        callDuration,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
