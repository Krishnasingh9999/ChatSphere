import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

export type CallType = 'audio' | 'video';
export type CallStatus = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended';

interface CallParticipant {
  _id: string;
  name: string;
  avatar?: { url: string } | string | null;
}

interface CallContextType {
  callStatus: CallStatus;
  callType: CallType;
  otherUser: CallParticipant | null;
  isCaller: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isFrontCamera: boolean;
  callDuration: number;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  startCall: (targetUser: CallParticipant, type?: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  flipCamera: () => Promise<void>;
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
  const [callType, setCallType] = useState<CallType>('audio');
  const [otherUser, setOtherUser] = useState<CallParticipant | null>(null);
  const [isCaller, setIsCaller] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
  const [isFrontCamera, setIsFrontCamera] = useState<boolean>(true);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

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
    setLocalStream(null);
    setRemoteStream(null);

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
    setIsVideoOff(false);
    setIsFrontCamera(true);
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
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        setRemoteStream(stream);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch((err) => console.warn('Audio autoplay prevented:', err));
        }
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // Start outgoing call
  const startCall = async (targetUser: CallParticipant, type: CallType = 'audio') => {
    if (!socket || !user) return;
    try {
      cleanupCall();
      setIsCaller(true);
      setOtherUser(targetUser);
      setCallType(type);
      setCallStatus('calling');
      startRingtone('outgoing');

      // Request media stream based on call type
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);

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
        callType: type,
      });
    } catch (err) {
      console.error('Failed to start call / permission denied:', err);
      alert(type === 'video' ? 'Could not access camera/microphone. Please check permissions.' : 'Could not access microphone. Please check permissions.');
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

      // Request media stream based on incoming callType
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: callType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);

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

  // Toggle camera video state (on/off)
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // Flip camera between front and back
  const flipCamera = async () => {
    if (callType !== 'video' || !localStreamRef.current || !peerConnectionRef.current) return;
    try {
      const newFacingMode = isFrontCamera ? 'environment' : 'user';
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: newFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (newVideoTrack) {
        const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldVideoTrack) {
          oldVideoTrack.stop();
          localStreamRef.current.removeTrack(oldVideoTrack);
        }

        localStreamRef.current.addTrack(newVideoTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

        const sender = peerConnectionRef.current.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideoTrack);
        }

        setIsFrontCamera(!isFrontCamera);
      }
    } catch (err) {
      console.warn('Flip camera not supported or failed:', err);
    }
  };

  // Socket listener for incoming call events
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data: { signal: any; from: string; callerName: string; callerAvatar?: any; callType?: CallType }) => {
      if (callStatus !== 'idle') {
        socket.emit('reject-call', { to: data.from });
        return;
      }

      incomingSignalRef.current = data.signal;
      setIsCaller(false);
      setCallType(data.callType || 'audio');
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
        callType,
        otherUser,
        isCaller,
        isMuted,
        isVideoOff,
        isFrontCamera,
        callDuration,
        localStream,
        remoteStream,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
        flipCamera,
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

