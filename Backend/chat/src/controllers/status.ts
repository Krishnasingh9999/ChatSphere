import axios from "axios";
import TryCatch from "../config/TryCatch.js";
import type { AuthenticatedRequest } from "../middleware/isAuth.js";
import { Status, type IStatus } from "../models/Status.js";
import { io, getReceiverSocketId } from "../index.js";
import mongoose from "mongoose";

// In-Memory Status fallback list
const inMemoryStatuses: any[] = [];

export const createStatus = TryCatch(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?._id;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const userIdStr = userId.toString();
  const { content, bgColor, privacy, allowedUsers } = req.body;
  const file = req.file;

  let parsedAllowedUsers: string[] = [];
  if (allowedUsers) {
    if (Array.isArray(allowedUsers)) {
      parsedAllowedUsers = allowedUsers.map((u: any) => (u?._id || u)?.toString());
    } else {
      try {
        const decoded = JSON.parse(allowedUsers);
        parsedAllowedUsers = Array.isArray(decoded)
          ? decoded.map((u: any) => (u?._id || u)?.toString())
          : [allowedUsers.toString()];
      } catch {
        parsedAllowedUsers = [allowedUsers.toString()];
      }
    }
  }

  const type = file ? 'image' : 'text';
  let media: { url: string; publicId?: string } | null = null;

  if (file) {
    const fileUrl = (file.path && file.path.startsWith("http"))
      ? file.path
      : `/uploads/${file.filename || file.path.split(/[/\\]/).pop()}`;

    media = {
      url: fileUrl,
      publicId: (file as any).filename || (file as any).public_id || "status_file",
    };
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiry

  let newStatus: any;

  if (mongoose.connection.readyState === 1) {
    newStatus = await Status.create({
      user: userIdStr,
      type,
      content: content || '',
      ...(media ? { media } : {}),
      bgColor: bgColor || '#6366f1',
      privacy: privacy === 'selected' ? 'selected' : 'everyone',
      allowedUsers: parsedAllowedUsers,
      viewers: [],
      createdAt: new Date(),
      expiresAt,
    } as any);
  } else {
    newStatus = {
      _id: "mock_status_" + Math.random().toString(36).substr(2, 9),
      user: userIdStr,
      type,
      content: content || '',
      media,
      bgColor: bgColor || '#6366f1',
      privacy: privacy === 'selected' ? 'selected' : 'everyone',
      allowedUsers: parsedAllowedUsers,
      viewers: [],
      createdAt: new Date(),
      expiresAt,
    };
    inMemoryStatuses.push(newStatus);
  }

  // Real-time broadcast
  io.emit("new-status", {
    statusId: newStatus._id,
    userId: userIdStr,
    privacy: newStatus.privacy,
    allowedUsers: parsedAllowedUsers,
  });

  res.status(201).json({
    message: "Status posted successfully",
    status: newStatus,
  });
});

export const getAllStatuses = TryCatch(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?._id;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const userIdStr = userId.toString();
  const now = new Date();
  const userServiceUrl = process.env.USER_SERVICE || "http://localhost:5000";

  let activeStatuses: any[] = [];

  if (mongoose.connection.readyState === 1) {
    activeStatuses = await Status.find({
      expiresAt: { $gt: now },
    }).sort({ createdAt: 1 });
  } else {
    activeStatuses = inMemoryStatuses
      .filter((s) => new Date(s.expiresAt).getTime() > now.getTime())
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  // Filter based on privacy permissions
  const visibleStatuses = activeStatuses.filter((s) => {
    const creatorId = ((s.user as any)?._id || s.user)?.toString();
    if (creatorId === userIdStr) return true; // My own status is always visible to me
    if (s.privacy === 'everyone') return true;
    if (s.privacy === 'selected' && s.allowedUsers && s.allowedUsers.some((u: any) => (u?._id || u)?.toString() === userIdStr)) {
      return true;
    }
    return false;
  });

  // Collect unique user IDs to fetch user info in batch
  const userIdsSet = new Set<string>();
  visibleStatuses.forEach((s) => {
    const cId = ((s.user as any)?._id || s.user)?.toString();
    if (cId) userIdsSet.add(cId);
    (s.viewers || []).forEach((v: any) => {
      const vId = ((v.user as any)?._id || v.user)?.toString();
      if (vId) userIdsSet.add(vId);
    });
  });

  const userMap: { [id: string]: any } = {};
  await Promise.all(
    Array.from(userIdsSet).map(async (id) => {
      try {
        const { data } = await axios.get(`${userServiceUrl}/api/v1/user/${id}`);
        if (data) userMap[id] = data;
      } catch {
        userMap[id] = { _id: id, name: "User" };
      }
    })
  );

  // Group statuses by creator
  const myStatusList: any[] = [];
  const otherUsersMap: { [userId: string]: { user: any; statuses: any[]; allViewed: boolean; latestCreatedAt: string } } = {};

  visibleStatuses.forEach((st) => {
    const creatorId = ((st.user as any)?._id || st.user)?.toString();
    const isMe = creatorId === userIdStr;
    const isViewed = (st.viewers || []).some((v: any) => ((v.user as any)?._id || v.user)?.toString() === userIdStr);

    const populatedViewers = (st.viewers || []).map((v: any) => {
      const vId = ((v.user as any)?._id || v.user)?.toString();
      return {
        user: userMap[vId] || { _id: vId, name: "User" },
        viewedAt: v.viewedAt,
      };
    });

    const statusObj = {
      _id: st._id,
      user: userMap[creatorId] || { _id: creatorId, name: isMe ? "You" : "User" },
      type: st.type,
      content: st.content,
      media: st.media,
      bgColor: st.bgColor,
      privacy: st.privacy,
      allowedUsers: st.allowedUsers,
      viewers: isMe ? populatedViewers : undefined,
      viewersCount: (st.viewers || []).length,
      isViewed,
      createdAt: st.createdAt,
      expiresAt: st.expiresAt,
    };

    if (isMe) {
      myStatusList.push(statusObj);
    } else {
      if (!otherUsersMap[creatorId]) {
        otherUsersMap[creatorId] = {
          user: userMap[creatorId] || { _id: creatorId, name: "User" },
          statuses: [],
          allViewed: true,
          latestCreatedAt: st.createdAt,
        };
      }
      otherUsersMap[creatorId].statuses.push(statusObj);
      if (!isViewed) {
        otherUsersMap[creatorId].allViewed = false;
      }
      otherUsersMap[creatorId].latestCreatedAt = st.createdAt;
    }
  });

  const recentStatuses = Object.values(otherUsersMap).sort((a, b) => {
    // Unviewed statuses first, then sort by latest update time
    if (a.allViewed !== b.allViewed) {
      return a.allViewed ? 1 : -1;
    }
    return new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime();
  });

  res.json({
    myStatus: myStatusList,
    recentStatuses,
  });
});

export const viewStatus = TryCatch(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?._id;
  const { statusId } = req.params;

  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const userIdStr = userId.toString();
  let targetStatus: any;

  if (mongoose.connection.readyState === 1) {
    targetStatus = await Status.findById(statusId);
    if (!targetStatus) {
      res.status(404).json({ message: "Status not found or expired" });
      return;
    }

    const alreadyViewed = targetStatus.viewers.some(
      (v: any) => ((v.user as any)?._id || v.user)?.toString() === userIdStr
    );

    if (!alreadyViewed) {
      targetStatus.viewers.push({
        user: userIdStr,
        viewedAt: new Date(),
      });
      await targetStatus.save();

      // Notify creator if connected
      const creatorSocketId = getReceiverSocketId(((targetStatus.user as any)?._id || targetStatus.user)?.toString());
      if (creatorSocketId) {
        io.to(creatorSocketId).emit("status-viewed", {
          statusId,
          viewerId: userIdStr,
          viewedAt: new Date(),
        });
      }
    }
  } else {
    targetStatus = inMemoryStatuses.find((s) => s._id === statusId);
    if (targetStatus) {
      if (!targetStatus.viewers) targetStatus.viewers = [];
      const alreadyViewed = targetStatus.viewers.some(
        (v: any) => ((v.user as any)?._id || v.user)?.toString() === userIdStr
      );
      if (!alreadyViewed) {
        targetStatus.viewers.push({
          user: userIdStr,
          viewedAt: new Date(),
        });

        const creatorSocketId = getReceiverSocketId(((targetStatus.user as any)?._id || targetStatus.user)?.toString());
        if (creatorSocketId) {
          io.to(creatorSocketId).emit("status-viewed", {
            statusId,
            viewerId: userIdStr,
            viewedAt: new Date(),
          });
        }
      }
    }
  }

  res.json({
    message: "Status viewed recorded",
    statusId,
  });
});

export const deleteStatus = TryCatch(async (req: AuthenticatedRequest, res) => {
  const userId = req.user?._id;
  const { statusId } = req.params;

  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const userIdStr = userId.toString();

  if (mongoose.connection.readyState === 1) {
    const status = await Status.findById(statusId);
    if (!status) {
      res.status(404).json({ message: "Status not found" });
      return;
    }

    if (((status.user as any)?._id || status.user)?.toString() !== userIdStr) {
      res.status(403).json({ message: "You can only delete your own status" });
      return;
    }

    await Status.findByIdAndDelete(statusId);
  } else {
    const index = inMemoryStatuses.findIndex(
      (s) => s._id === statusId && ((s.user as any)?._id || s.user)?.toString() === userIdStr
    );
    if (index !== -1) {
      inMemoryStatuses.splice(index, 1);
    }
  }

  // Real-time broadcast status deleted to everyone so it disappears instantly
  io.emit("status-deleted", {
    statusId,
    userId: userIdStr,
  });

  res.json({
    message: "Status deleted successfully",
    statusId,
  });
});
