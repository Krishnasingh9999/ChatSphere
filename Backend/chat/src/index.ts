import express from 'express';
import dotenv from 'dotenv';
import connectDb from './config/db.js';
import chatRoutes from "./routes/chat.js";
import statusRoutes from "./routes/status.js";
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { Messages } from './models/Messages.js';
import { Chat } from './models/Chat.js';
import mongoose from 'mongoose';

dotenv.config();

connectDb();

const app = express();

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use(
  '/uploads',
  express.static(uploadsDir, {
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

app.use("/api/v1", chatRoutes);
app.use("/api/v1", statusRoutes);

const server = createServer(app);

export const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Map to track active user IDs to socket IDs
const userSocketMap: { [key: string]: string } = {};

export const getReceiverSocketId = (userId: string): string | undefined => {
  return userSocketMap[userId];
};

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("join", async (userId: string) => {
    if (userId) {
      userSocketMap[userId] = socket.id;
      console.log(`User registered: ${userId} -> Socket: ${socket.id}`);
      io.emit("get-online-users", Object.keys(userSocketMap));

      // Mark all pending undelivered messages for this user as delivered in DB
      try {
        if (mongoose.connection.readyState === 1) {
          const chats = await Chat.find({ users: userId });
          const chatIds = chats.map(c => c._id);
          if (chatIds.length > 0) {
            const undeliveredMessages = await Messages.find({
              chatId: { $in: chatIds },
              sender: { $ne: userId },
              delivered: false,
            });

            if (undeliveredMessages.length > 0) {
              await Messages.updateMany(
                {
                  chatId: { $in: chatIds },
                  sender: { $ne: userId },
                  delivered: false,
                },
                {
                  delivered: true,
                  deliveredAt: new Date(),
                }
              );

              // Notify the senders that their messages are now delivered
              const senderChatMap = new Map<string, Set<string>>();
              undeliveredMessages.forEach(msg => {
                const sId = msg.sender.toString();
                const cId = msg.chatId.toString();
                if (!senderChatMap.has(sId)) {
                  senderChatMap.set(sId, new Set());
                }
                senderChatMap.get(sId)!.add(cId);
              });

              for (const [sId, cIds] of senderChatMap.entries()) {
                const sSocket = getReceiverSocketId(sId);
                if (sSocket) {
                  cIds.forEach(cId => {
                    io.to(sSocket).emit("messages-delivered", { chatId: cId });
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Error updating delivered status on user join:", err);
      }
    }
  });

  // Real-time typing indicators
  socket.on("typing", ({ chatId, receiverId, senderId }: { chatId: string; receiverId: string; senderId?: string }) => {
    if (receiverId) {
      const receiverSocketId = getReceiverSocketId(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("typing", { chatId, senderId });
      }
    }
  });

  socket.on("stop-typing", ({ chatId, receiverId, senderId }: { chatId: string; receiverId: string; senderId?: string }) => {
    if (receiverId) {
      const receiverSocketId = getReceiverSocketId(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("stop-typing", { chatId, senderId });
      }
    }
  });

  // Real-time mark-seen event when active in conversation
  socket.on("mark-seen", async ({ chatId, senderId, receiverId }: { chatId: string; senderId: string; receiverId: string }) => {
    if (chatId) {
      try {
        if (mongoose.connection.readyState === 1) {
          await Messages.updateMany(
            { chatId, sender: receiverId, seen: false },
            { seen: true, delivered: true, seenAt: new Date(), deliveredAt: new Date() }
          );
        }
      } catch (err) {
        console.error("Failed to mark messages seen in DB:", err);
      }

      if (receiverId) {
        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("messages-seen", { chatId });
        }
      }
    }
  });

  // Real-time user profile update broadcast (avatar / name change)
  socket.on("update-profile", ({ user }: { user: any }) => {
    if (user?._id) {
      console.log(`User profile updated for ${user._id}, broadcasting to connected users...`);
      socket.broadcast.emit("user-profile-updated", { user });
    }
  });

  // ==========================================
  // WebRTC Free Voice & Video Calling Signaling Events
  // ==========================================
  socket.on("call-user", ({ userToCall, signalData, from, callerName, callerAvatar, callType }: { userToCall: string; signalData: any; from: string; callerName: string; callerAvatar?: any; callType?: 'audio' | 'video' }) => {
    const receiverSocketId = getReceiverSocketId(userToCall);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("incoming-call", {
        signal: signalData,
        from,
        callerName,
        callerAvatar,
        callType: callType || 'audio',
      });
    } else {
      socket.emit("call-user-offline", { userId: userToCall });
    }
  });

  socket.on("answer-call", ({ to, signal }: { to: string; signal: any }) => {
    const callerSocketId = getReceiverSocketId(to);
    if (callerSocketId) {
      io.to(callerSocketId).emit("call-accepted", { signal });
    }
  });

  socket.on("ice-candidate", ({ to, candidate }: { to: string; candidate: any }) => {
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("ice-candidate", { candidate });
    }
  });

  socket.on("end-call", ({ to }: { to: string }) => {
    const targetSocketId = getReceiverSocketId(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-ended");
    }
  });

  socket.on("reject-call", ({ to }: { to: string }) => {
    const callerSocketId = getReceiverSocketId(to);
    if (callerSocketId) {
      io.to(callerSocketId).emit("call-rejected");
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    for (const [userId, socketId] of Object.entries(userSocketMap)) {
      if (socketId === socket.id) {
        delete userSocketMap[userId];
        console.log(`User unregistered: ${userId}`);
        break;
      }
    }
    io.emit("get-online-users", Object.keys(userSocketMap));
  });
});

const port = process.env.PORT || 5002;

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});