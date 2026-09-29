import axios from "axios";
import crypto from "crypto";
import TryCatch from "../config/TryCatch.js";
import type { AuthenticatedRequest } from "../middleware/isAuth.js";
import { Chat } from "../models/Chat.js";
import { Messages } from "../models/Messages.js";
import { ChatSecurity } from "../models/ChatSecurity.js";
import { io, getReceiverSocketId } from "../index.js";
import mongoose from "mongoose";
import path from "path";

// In-Memory Database Fallbacks
const inMemoryChats: any[] = [];
const inMemoryMessages: any[] = [];
const inMemorySecurity: any[] = [];

// Helper functions for Chat Lock Passcode
const hashPasscode = (passcode: string, salt: string): string => {
  return crypto.pbkdf2Sync(passcode, salt, 10000, 64, "sha512").toString("hex");
};

export const createNewChat = TryCatch(async(req: AuthenticatedRequest, res)=> {
  const userId = req.user?._id;
  const {otherUserId} = req.body;

  if(!otherUserId){
    res.status(400).json({
      message: "Other userid is required",
    });
    return;
  }

  const userIdStr = userId?.toString();
  const otherUserIdStr = otherUserId?.toString();

  let existingChat;
  if (mongoose.connection.readyState === 1) {
    existingChat = await Chat.findOne({
      users: { $all: [userIdStr, otherUserIdStr], $size: 2},
    });
  } else {
    existingChat = inMemoryChats.find(c => 
      c.users.map(String).includes(userIdStr) && c.users.map(String).includes(otherUserIdStr)
    );
  }

  if(existingChat){
    if (existingChat.deletedFor && existingChat.deletedFor.map(String).includes(userIdStr)) {
      if (mongoose.connection.readyState === 1) {
        await Chat.updateOne(
          { _id: existingChat._id },
          { $pull: { deletedFor: userIdStr } }
        );
      } else {
        existingChat.deletedFor = (existingChat.deletedFor || []).filter((id: string) => String(id) !== userIdStr);
      }
    }
    res.json({
      message: "Chat already exist",
      chatId: String(existingChat._id),
    });
    return;
  }

  let newChat;
  if (mongoose.connection.readyState === 1) {
    newChat = await Chat.create({
      users: [userIdStr, otherUserIdStr],
      deletedFor: [],
    });
  } else {
    newChat = {
      _id: "mock_chat_" + Math.random().toString(36).substr(2, 9),
      users: [userIdStr, otherUserIdStr],
      latestMessage: null,
      deletedFor: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    inMemoryChats.push(newChat);
  }

  res.status(201).json({
    message: "New Chat created",
    chatId: String(newChat._id || newChat.id)
  });
});

export const getAllChats = TryCatch(async(req: AuthenticatedRequest, res)=> {
  const userId = req.user?._id;

  if(!userId){
    res.status(400).json({
      message: "UserId missing",
    });
    return;
  }

  const userIdStr = userId.toString();
  const userServiceUrl = process.env.USER_SERVICE || "http://localhost:5000";

  let userSecurity: any = null;
  if (mongoose.connection.readyState === 1) {
    userSecurity = await ChatSecurity.findOne({ user: userIdStr });
  } else {
    userSecurity = inMemorySecurity.find(s => s.user === userIdStr);
  }
  const userLockedChatIds: string[] = userSecurity?.lockedChatIds || [];

  let chatsList;
  if (mongoose.connection.readyState === 1) {
    chatsList = await Chat.find({
      users: userIdStr,
      deletedFor: { $ne: userIdStr },
    }).sort({updatedAt: -1});
  } else {
    chatsList = inMemoryChats.filter(c => 
      c.users.map(String).includes(userIdStr) &&
      !(c.deletedFor || []).map(String).includes(userIdStr)
    ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  const chatWithUserData = await Promise.all(
    chatsList.map(async(chat) => {
      const otherUserId = chat.users.find((id: any) => id.toString() !== userIdStr);
      const isLocked = userLockedChatIds.includes(chat._id?.toString());

      let unseenCount = 0;
      let userLatestMessage: any = null;

      if (mongoose.connection.readyState === 1) {
        unseenCount = await Messages.countDocuments({
          chatId: chat._id,
          sender: {$ne: userIdStr},
          seen: false,
          deletedFor: { $ne: userIdStr },
        });

        const lastMsg = await Messages.findOne({
          chatId: chat._id,
          deletedFor: { $ne: userIdStr },
        }).sort({ createdAt: -1 });

        if (lastMsg) {
          let previewText = "";
          if (lastMsg.isDeletedForEveryone) {
            previewText = "🚫 This message was deleted";
          } else if (lastMsg.messageType === "image") {
            previewText = "📷 Image";
          } else if (lastMsg.messageType === "pdf") {
            previewText = "📄 " + (lastMsg.file?.originalName || "PDF Document");
          } else if (lastMsg.messageType === "docx") {
            previewText = "📝 " + (lastMsg.file?.originalName || "Word Document");
          } else if (lastMsg.messageType === "audio") {
            previewText = "🎵 Audio";
          } else if (lastMsg.messageType === "file") {
            previewText = "📎 " + (lastMsg.file?.originalName || "File");
          } else {
            previewText = lastMsg.text || "";
          }

          userLatestMessage = {
            text: previewText,
            sender: lastMsg.sender,
          };
        }
      } else {
        const userChatMessages = inMemoryMessages.filter(m => 
          m.chatId === chat._id && 
          !(m.deletedFor || []).includes(userIdStr)
        );

        unseenCount = userChatMessages.filter(m => 
          m.sender !== userIdStr && 
          !m.seen
        ).length;

        if (userChatMessages.length > 0) {
          const lastMsg = userChatMessages[userChatMessages.length - 1];
          let previewText = "";
          if (lastMsg.isDeletedForEveryone) {
            previewText = "🚫 This message was deleted";
          } else if (lastMsg.messageType === "image") {
            previewText = "📷 Image";
          } else if (lastMsg.messageType === "pdf") {
            previewText = "📄 " + (lastMsg.file?.originalName || "PDF Document");
          } else if (lastMsg.messageType === "docx") {
            previewText = "📝 " + (lastMsg.file?.originalName || "Word Document");
          } else if (lastMsg.messageType === "audio") {
            previewText = "🎵 Audio";
          } else if (lastMsg.messageType === "file") {
            previewText = "📎 " + (lastMsg.file?.originalName || "File");
          } else {
            previewText = lastMsg.text || "";
          }

          userLatestMessage = {
            text: previewText,
            sender: lastMsg.sender,
          };
        }
      }

      if (isLocked) {
        userLatestMessage = {
          text: "🔒 Locked chat",
          sender: userLatestMessage?.sender || "",
        };
        unseenCount = 0;
      }

      if (!otherUserId) {
        return {
          user: { _id: "unknown", name: "Unknown User", email: "" },
          chat: {
            ...(chat.toObject ? chat.toObject() : chat),
            latestMessage: userLatestMessage,
            unseenCount,
            isLocked,
          },
        };
      }

      try {
        const { data } = await axios.get(
          `${userServiceUrl}/api/v1/user/${otherUserId}`
        );

        return {
          user: data || { _id: otherUserId, name: "Unknown User", email: "" },
          chat: {
            ...(chat.toObject ? chat.toObject() : chat),
            latestMessage: userLatestMessage,
            unseenCount,
            isLocked,
          },
        };
      } catch (error) {
        return {
          user: { _id: otherUserId, name: "Unknown User", email: "" },
          chat: {
            ...(chat.toObject ? chat.toObject() : chat),
            latestMessage: userLatestMessage,
            unseenCount,
            isLocked,
          },
        };
      }
    })
  );

  res.json({
    chats: chatWithUserData,
    lockedChatIds: userLockedChatIds,
    hasPasscode: !!userSecurity?.passcodeHash,
  });
});

export const getChatLockStatus = TryCatch(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?._id;
  if (!userId) {
    res.status(400).json({ message: "UserId missing" });
    return;
  }
  const userIdStr = userId.toString();
  let security: any = null;
  if (mongoose.connection.readyState === 1) {
    security = await ChatSecurity.findOne({ user: userIdStr });
  } else {
    security = inMemorySecurity.find(s => s.user === userIdStr);
  }

  res.json({
    hasPasscode: !!security?.passcodeHash,
    lockedChatIds: security?.lockedChatIds || [],
  });
});

export const setChatPasscode = TryCatch(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?._id;
  const { passcode, currentPasscode } = req.body;

  if (!userId) {
    res.status(400).json({ message: "UserId missing" });
    return;
  }
  if (!passcode || typeof passcode !== "string" || passcode.length < 4) {
    res.status(400).json({ message: "Passcode must be at least 4 characters/digits" });
    return;
  }

  const userIdStr = userId.toString();
  let security: any = null;
  if (mongoose.connection.readyState === 1) {
    security = await ChatSecurity.findOne({ user: userIdStr });
  } else {
    security = inMemorySecurity.find(s => s.user === userIdStr);
  }

  // If already set, verify currentPasscode
  if (security && security.passcodeHash) {
    if (!currentPasscode) {
      res.status(400).json({ message: "Current passcode is required to change passcode" });
      return;
    }
    const currentHash = hashPasscode(currentPasscode, security.salt);
    if (currentHash !== security.passcodeHash) {
      res.status(400).json({ message: "Incorrect current passcode" });
      return;
    }
  }

  const newSalt = crypto.randomBytes(16).toString("hex");
  const newHash = hashPasscode(passcode, newSalt);

  if (mongoose.connection.readyState === 1) {
    if (security) {
      security.salt = newSalt;
      security.passcodeHash = newHash;
      await security.save();
    } else {
      security = await ChatSecurity.create({
        user: userIdStr,
        salt: newSalt,
        passcodeHash: newHash,
        lockedChatIds: [],
      });
    }
  } else {
    if (security) {
      security.salt = newSalt;
      security.passcodeHash = newHash;
      security.updatedAt = new Date().toISOString();
    } else {
      security = {
        _id: "sec_" + Math.random().toString(36).substr(2, 9),
        user: userIdStr,
        salt: newSalt,
        passcodeHash: newHash,
        lockedChatIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      inMemorySecurity.push(security);
    }
  }

  res.json({
    message: "Chat passcode set successfully",
    hasPasscode: true,
    lockedChatIds: security.lockedChatIds || [],
  });
});

export const verifyChatPasscode = TryCatch(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?._id;
  const { passcode } = req.body;

  if (!userId) {
    res.status(400).json({ message: "UserId missing" });
    return;
  }
  if (!passcode) {
    res.status(400).json({ message: "Passcode is required" });
    return;
  }

  const userIdStr = userId.toString();
  let security: any = null;
  if (mongoose.connection.readyState === 1) {
    security = await ChatSecurity.findOne({ user: userIdStr });
  } else {
    security = inMemorySecurity.find(s => s.user === userIdStr);
  }

  if (!security || !security.passcodeHash) {
    res.status(400).json({ message: "No passcode has been set yet" });
    return;
  }

  const checkHash = hashPasscode(passcode, security.salt);
  if (checkHash !== security.passcodeHash) {
    res.status(400).json({ message: "Incorrect secret passcode" });
    return;
  }

  res.json({
    message: "Passcode verified successfully",
    success: true,
    lockedChatIds: security.lockedChatIds || [],
  });
});

export const toggleChatLock = TryCatch(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?._id;
  const { chatId, passcode } = req.body;

  if (!userId) {
    res.status(400).json({ message: "UserId missing" });
    return;
  }
  if (!chatId) {
    res.status(400).json({ message: "ChatId is required" });
    return;
  }

  const userIdStr = userId.toString();
  const chatIdStr = chatId.toString();
  let security: any = null;
  if (mongoose.connection.readyState === 1) {
    security = await ChatSecurity.findOne({ user: userIdStr });
  } else {
    security = inMemorySecurity.find(s => s.user === userIdStr);
  }

  if (!security || !security.passcodeHash) {
    res.status(400).json({ message: "Please set a secret chat passcode first" });
    return;
  }

  if (!passcode) {
    res.status(400).json({ message: "Secret passcode is required" });
    return;
  }

  const checkHash = hashPasscode(passcode, security.salt);
  if (checkHash !== security.passcodeHash) {
    res.status(400).json({ message: "Incorrect secret passcode" });
    return;
  }

  let lockedChatIds: string[] = security.lockedChatIds || [];
  let isLocked = false;

  if (lockedChatIds.includes(chatIdStr)) {
    // Unlock this chat
    lockedChatIds = lockedChatIds.filter((id: string) => id !== chatIdStr);
    isLocked = false;
  } else {
    // Lock this chat
    lockedChatIds = [...lockedChatIds, chatIdStr];
    isLocked = true;
  }

  security.lockedChatIds = lockedChatIds;
  if (mongoose.connection.readyState === 1) {
    await security.save();
  } else {
    security.updatedAt = new Date().toISOString();
  }

  res.json({
    message: isLocked ? "Chat locked successfully" : "Chat unlocked successfully",
    isLocked,
    lockedChatIds,
  });
});

export const removeChatPasscode = TryCatch(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?._id;
  const { passcode } = req.body;

  if (!userId) {
    res.status(400).json({ message: "UserId missing" });
    return;
  }
  if (!passcode) {
    res.status(400).json({ message: "Current passcode is required to remove lock" });
    return;
  }

  const userIdStr = userId.toString();
  let security: any = null;
  if (mongoose.connection.readyState === 1) {
    security = await ChatSecurity.findOne({ user: userIdStr });
  } else {
    security = inMemorySecurity.find(s => s.user === userIdStr);
  }

  if (!security || !security.passcodeHash) {
    res.status(400).json({ message: "No secret passcode is set" });
    return;
  }

  const checkHash = hashPasscode(passcode, security.salt);
  if (checkHash !== security.passcodeHash) {
    res.status(400).json({ message: "Incorrect secret passcode" });
    return;
  }

  if (mongoose.connection.readyState === 1) {
    await ChatSecurity.deleteOne({ user: userIdStr });
  } else {
    const idx = inMemorySecurity.findIndex(s => s.user === userIdStr);
    if (idx !== -1) inMemorySecurity.splice(idx, 1);
  }

  res.json({
    message: "Chat lock and secret passcode removed completely. All chats unlocked.",
    hasPasscode: false,
    lockedChatIds: [],
  });
});

export const sendMessage = TryCatch(async(req: AuthenticatedRequest, res) => {
  const senderId = req.user?._id;
  const {chatId, text} = req.body;
  const uploadedFile = req.file;

  if(!senderId){
    res.status(401).json({
      message: "unauthorized",
    });
    return;
  }

  const senderIdStr = senderId.toString();

  if(!chatId){
    res.status(400).json({
      message: "ChatId Required",
    });
    return;
  }

  if(!text && !uploadedFile){
    res.status(400).json({
      message: "Either text or file attachment is required",
    });
    return;
  }

  let chat;
  if (mongoose.connection.readyState === 1) {
    chat = await Chat.findById(chatId);
  } else {
    chat = inMemoryChats.find(c => c._id === chatId);
  }

  if(!chat){
    res.status(404).json({
      message: "Chat not found", 
    });
    return;
  }

  const isUserInChat = chat.users.some(
    (userId: any) => userId.toString() === senderIdStr
  );

  if(!isUserInChat){
    res.status(403).json({
      message: "You are not a participant of this chat",
    });
    return;
  }

  const otherUserId = chat.users.find(
    (userId: any) => userId.toString() !== senderIdStr
  );

  if(!otherUserId){
    res.status(400).json({
      message: "No other user",
    });
    return;
  }

  const receiverSocketId = otherUserId ? getReceiverSocketId(otherUserId.toString()) : undefined;
  const isReceiverOnline = Boolean(receiverSocketId);

  let messageData: any = {
    chatId: chatId,
    sender: senderIdStr,
    delivered: isReceiverOnline,
    deliveredAt: isReceiverOnline ? new Date() : null,
    seen: false,
    seenAt: null,
    deletedFor: [],
  };

  let latestMessageText = text || "";

  if(uploadedFile){
    const fileUrl = (uploadedFile.path && uploadedFile.path.startsWith("http"))
      ? uploadedFile.path
      : `/uploads/${uploadedFile.filename || uploadedFile.path.split(/[/\\]/).pop()}`;

    const mime = (uploadedFile.mimetype || "").toLowerCase();
    const originalName = uploadedFile.originalname || "attachment";
    const ext = path.extname(originalName).toLowerCase();

    let detectedType = "file";
    if (mime.startsWith("image/") || [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(ext)) {
      detectedType = "image";
      latestMessageText = "📷 " + (text ? text : "Image");
    } else if (mime === "application/pdf" || ext === ".pdf") {
      detectedType = "pdf";
      latestMessageText = "📄 " + (text ? text : originalName);
    } else if (
      mime === "application/msword" ||
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      [".doc", ".docx"].includes(ext)
    ) {
      detectedType = "docx";
      latestMessageText = "📝 " + (text ? text : originalName);
    } else if (mime.startsWith("audio/") || [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".webm"].includes(ext)) {
      detectedType = "audio";
      latestMessageText = "🎵 " + (text ? text : "Audio");
    } else {
      detectedType = "file";
      latestMessageText = "📎 " + (text ? text : originalName);
    }

    const filePayload = {
      url: fileUrl,
      publicId: (uploadedFile as any).filename || (uploadedFile as any).public_id || "local_file",
      originalName,
      fileType: detectedType,
      size: uploadedFile.size,
    };

    messageData.file = filePayload;
    if (detectedType === "image") {
      messageData.image = {
        url: fileUrl,
        publicId: filePayload.publicId,
      };
    }
    messageData.messageType = detectedType;
    messageData.text = text || "";
  } else {
    messageData.text = text;
    messageData.messageType = "text";
  }

  let savedMessage;

  if (mongoose.connection.readyState === 1) {
    const message = new Messages(messageData);
    savedMessage = await message.save();
    
    await Chat.findByIdAndUpdate(chatId, {
      latestMessage: {
        text: latestMessageText,
        sender: senderIdStr,
      },
      $pull: { deletedFor: { $in: [senderIdStr, otherUserId.toString()] } },
      updatedAt: new Date(),
    },
    { returnDocument: 'after' }
    );
  } else {
    savedMessage = {
      _id: "mock_msg_" + Math.random().toString(36).substr(2, 9),
      ...messageData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    inMemoryMessages.push(savedMessage);
    
    chat.latestMessage = {
      text: latestMessageText,
      sender: senderIdStr
    };
    chat.deletedFor = [];
    chat.updatedAt = new Date().toISOString();
  }

  //emit to receiver socket if online
  if (receiverSocketId) {
    io.to(receiverSocketId).emit("new-message", savedMessage);
  }

  res.status(201).json({
    message: savedMessage,
    sender: senderIdStr,
  });
});

export const getMessagesByChat = TryCatch(
  async(req: AuthenticatedRequest, res) => {
    const userId = req.user?._id;
    const { chatId } = req.params;

    if(!userId){
      res.status(401).json({
        message: "Unauthorized",
      });
      return;
    }

    const userIdStr = userId.toString();

    if(!chatId){
      res.status(400).json({
        message: "ChatId Required",
      });
      return;
    }

    let chat;
    if (mongoose.connection.readyState === 1) {
      chat = await Chat.findById(chatId);
    } else {
      chat = inMemoryChats.find(c => c._id === chatId);
    }

    if(!chat){
      res.status(404).json({
        message: "Chat not found",
      });
      return;
    }

    const isUserInChat = chat.users.some(
      (userIdVal: any) => userIdVal.toString() === userIdStr
    );

    if(!isUserInChat){
      res.status(403).json({
        message: "You are not a participant of this chat",
      });
      return;
    }

    let updatedCount = 0;
    if (mongoose.connection.readyState === 1) {
      const updateResult = await Messages.updateMany({
        chatId: chatId,
        sender: { $ne: userIdStr },
        seen: false,
      },{
        seen: true,
        delivered: true,
        seenAt: new Date(),
        deliveredAt: new Date(),
      });
      updatedCount = updateResult.modifiedCount || 0;
    } else {
      inMemoryMessages.forEach(m => {
        if (m.chatId === chatId && m.sender !== userIdStr && !m.seen) {
          m.seen = true;
          m.delivered = true;
          m.seenAt = new Date().toISOString();
          m.deliveredAt = new Date().toISOString();
          updatedCount++;
        }
      });
    }

    let messagesList;
    if (mongoose.connection.readyState === 1) {
      messagesList = await Messages.find({
        chatId,
        deletedFor: { $ne: userIdStr },
      }).sort({
        createdAt: 1 
      });
    } else {
      messagesList = inMemoryMessages.filter(m => 
        m.chatId === chatId && !(m.deletedFor || []).includes(userIdStr)
      ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }

    const otherUserId = chat.users.find((id: any) => id.toString() !== userIdStr);

    if(!otherUserId){
      res.status(400).json({
        message: "No other user in chat",
      });
      return;
    }

    // socket notification for seen receipts (only if messages were actually marked seen)
    if (updatedCount > 0) {
      const receiverSocketId = getReceiverSocketId(otherUserId.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("messages-seen", { chatId });
      }
    }

    const userServiceUrl = process.env.USER_SERVICE || "http://localhost:5000";

    try {
      const { data } = await axios.get(
        `${userServiceUrl}/api/v1/user/${otherUserId}`
      );

      res.json({
        messages: messagesList,
        user: data || { _id: otherUserId, name: "Unknown User" },
      });
    } catch(error) {
      res.json({
        messages: messagesList,
        user: { _id: otherUserId, name: "Unknown User" },
      });
    }
  }
);

export const deleteMessageForMe = TryCatch(async(req: AuthenticatedRequest, res) => {
  const userId = req.user?._id;
  const { messageId } = req.params;

  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const userIdStr = userId.toString();

  if (mongoose.connection.readyState === 1) {
    const msg = await Messages.findById(messageId);
    if (!msg) {
      res.status(404).json({ message: "Message not found" });
      return;
    }
    await Messages.findByIdAndUpdate(messageId, {
      $addToSet: { deletedFor: userIdStr },
    });
  } else {
    const msg = inMemoryMessages.find(m => m._id === messageId);
    if (msg) {
      if (!msg.deletedFor) msg.deletedFor = [];
      if (!msg.deletedFor.includes(userIdStr)) {
        msg.deletedFor.push(userIdStr);
      }
    }
  }

  res.json({
    message: "Message deleted for you",
    messageId,
  });
});

export const clearChatForMe = TryCatch(async(req: AuthenticatedRequest, res) => {
  const userId = req.user?._id;
  const { chatId } = req.params;

  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  if (!chatId) {
    res.status(400).json({ message: "Chat ID is required" });
    return;
  }

  const userIdStr = userId.toString();
  const chatIdStr = Array.isArray(chatId) ? chatId[0] : chatId;

  if (mongoose.connection.readyState === 1) {
    const chat = await Chat.findById(chatIdStr);
    if (!chat) {
      res.status(404).json({ message: "Chat not found" });
      return;
    }

    // Mark all existing messages in this chat as deleted for this user
    await Messages.updateMany(
      { chatId: new mongoose.Types.ObjectId(chatIdStr) },
      { $addToSet: { deletedFor: userIdStr } }
    );
  } else {
    inMemoryMessages.forEach(m => {
      if (m.chatId === chatIdStr) {
        if (!m.deletedFor) m.deletedFor = [];
        if (!m.deletedFor.includes(userIdStr)) {
          m.deletedFor.push(userIdStr);
        }
      }
    });
  }

  res.json({
    message: "Chat history cleared successfully",
    chatId: chatIdStr,
  });
});

export const deleteChatForMe = TryCatch(async(req: AuthenticatedRequest, res) => {
  const userId = req.user?._id;
  const { chatId } = req.params;

  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  if (!chatId) {
    res.status(400).json({ message: "Chat ID is required" });
    return;
  }

  const userIdStr = userId.toString();
  const chatIdStr = Array.isArray(chatId) ? chatId[0] : chatId;

  if (mongoose.connection.readyState === 1) {
    const chat = await Chat.findById(chatIdStr);
    if (!chat) {
      res.status(404).json({ message: "Chat not found" });
      return;
    }

    // 1. Mark chat as deleted for this user
    await Chat.findByIdAndUpdate(chatIdStr, {
      $addToSet: { deletedFor: userIdStr },
    });

    // 2. Mark all existing messages in this chat as deleted for this user
    await Messages.updateMany(
      { chatId: new mongoose.Types.ObjectId(chatIdStr) },
      { $addToSet: { deletedFor: userIdStr } }
    );
  } else {
    const chat = inMemoryChats.find(c => c._id === chatIdStr);
    if (chat) {
      if (!chat.deletedFor) chat.deletedFor = [];
      if (!chat.deletedFor.includes(userIdStr)) {
        chat.deletedFor.push(userIdStr);
      }
    }
    inMemoryMessages.forEach(m => {
      if (m.chatId === chatIdStr) {
        if (!m.deletedFor) m.deletedFor = [];
        if (!m.deletedFor.includes(userIdStr)) {
          m.deletedFor.push(userIdStr);
        }
      }
    });
  }

  res.json({
    message: "Chat deleted for you",
    chatId: chatIdStr,
  });
});

export const deleteMessageForEveryone = TryCatch(async(req: AuthenticatedRequest, res) => {
  const userId = req.user?._id;
  const { messageId } = req.params;

  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  if (!messageId) {
    res.status(400).json({ message: "Message ID is required" });
    return;
  }

  const userIdStr = userId.toString();
  const MAX_DELETE_TIME = 15 * 60 * 1000; // 15 minutes limit

  let updatedMessage: any = null;
  let targetChatId: string = "";
  let otherUserId: string = "";

  if (mongoose.connection.readyState === 1) {
    const msg = await Messages.findById(messageId);
    if (!msg) {
      res.status(404).json({ message: "Message not found" });
      return;
    }

    if (msg.sender.toString() !== userIdStr) {
      res.status(403).json({ message: "You can only delete your own messages for everyone" });
      return;
    }

    const messageAge = Date.now() - new Date(msg.createdAt).getTime();
    if (messageAge > MAX_DELETE_TIME) {
      res.status(400).json({ message: "Messages older than 15 minutes cannot be deleted for everyone" });
      return;
    }

    msg.isDeletedForEveryone = true;
    msg.text = "This message was deleted";
    msg.image = null;
    await msg.save();
    updatedMessage = msg;
    targetChatId = msg.chatId.toString();

    // Check if the message being deleted is the newest message in this chat
    const newestMsg = await Messages.findOne({ chatId: targetChatId }).sort({ createdAt: -1 });
    const isLatest = newestMsg ? newestMsg._id.toString() === messageId : false;

    const chat = await Chat.findById(targetChatId);
    if (chat) {
      const other = chat.users.find((u: any) => u.toString() !== userIdStr);
      if (other) otherUserId = other.toString();

      if (isLatest) {
        chat.latestMessage = {
          text: "🚫 This message was deleted",
          sender: userIdStr,
        };
        await chat.save();
      }
    }

    // Real-time socket broadcast
    if (targetChatId) {
      const payload = {
        messageId,
        chatId: targetChatId,
        sender: userIdStr,
        isDeletedForEveryone: true,
        text: "This message was deleted",
        isLatest,
        latestMessage: isLatest ? { text: "🚫 This message was deleted", sender: userIdStr } : undefined,
      };

      if (otherUserId) {
        const receiverSocketId = getReceiverSocketId(otherUserId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("message-deleted-everyone", payload);
        }
      }
      const senderSocketId = getReceiverSocketId(userIdStr);
      if (senderSocketId) {
        io.to(senderSocketId).emit("message-deleted-everyone", payload);
      }
    }
  } else {
    const msg = inMemoryMessages.find(m => m._id === messageId);
    if (!msg) {
      res.status(404).json({ message: "Message not found" });
      return;
    }

    if (msg.sender !== userIdStr) {
      res.status(403).json({ message: "You can only delete your own messages for everyone" });
      return;
    }

    const messageAge = Date.now() - new Date(msg.createdAt).getTime();
    if (messageAge > MAX_DELETE_TIME) {
      res.status(400).json({ message: "Messages older than 15 minutes cannot be deleted for everyone" });
      return;
    }

    msg.isDeletedForEveryone = true;
    msg.text = "This message was deleted";
    msg.image = undefined;
    updatedMessage = msg;
    targetChatId = msg.chatId;

    const chatMessages = inMemoryMessages.filter(m => m.chatId === targetChatId);
    const newestMsg = chatMessages[chatMessages.length - 1];
    const isLatest = newestMsg ? newestMsg._id === messageId : false;

    const chat = inMemoryChats.find(c => c._id === targetChatId);
    if (chat) {
      const other = chat.users.find((u: any) => u !== userIdStr);
      if (other) otherUserId = other;
      if (isLatest) {
        chat.latestMessage = {
          text: "🚫 This message was deleted",
          sender: userIdStr,
        };
      }
    }

    // Real-time socket broadcast
    if (targetChatId) {
      const payload = {
        messageId,
        chatId: targetChatId,
        sender: userIdStr,
        isDeletedForEveryone: true,
        text: "This message was deleted",
        isLatest,
        latestMessage: isLatest ? { text: "🚫 This message was deleted", sender: userIdStr } : undefined,
      };

      if (otherUserId) {
        const receiverSocketId = getReceiverSocketId(otherUserId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("message-deleted-everyone", payload);
        }
      }
      const senderSocketId = getReceiverSocketId(userIdStr);
      if (senderSocketId) {
        io.to(senderSocketId).emit("message-deleted-everyone", payload);
      }
    }
  }

  res.json({
    message: "Message deleted for everyone",
    updatedMessage,
  });
});