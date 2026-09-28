import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  onlineUsers: string[];
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      setSocket((prev) => {
        if (prev) prev.close();
        return null;
      });
      return;
    }

    const isProduction = typeof window !== 'undefined' && (window.location.protocol === 'https:' || !window.location.hostname.includes('localhost'));
    const defaultSocketUrl = isProduction ? window.location.origin : 'http://localhost:5002';
    const socketUrl = import.meta.env.VITE_CHAT_SOCKET_URL || defaultSocketUrl;
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Socket.io connected:', newSocket.id);
      newSocket.emit('join', user._id);
    });

    newSocket.on('get-online-users', (users: string[]) => {
      setOnlineUsers(users);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
