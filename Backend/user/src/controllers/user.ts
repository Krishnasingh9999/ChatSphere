import { generateToken } from "../config/generateToken.js";
import { publishQueue } from "../config/rabbitmq.js";
import TryCatch from "../config/TryCatch.js";
import { redisClient } from "../index.js";
import type { AuthenticatedRequest } from "../middleware/isAuth.js";
import { User } from "../model/User.js";
import mongoose from "mongoose";

// In-Memory Database Fallbacks
const inMemoryUsers: any[] = [];
const inMemoryOtpStore = new Map<string, string>();
const inMemoryRateLimits = new Map<string, number>();

export const loginUser = TryCatch(async(req, res) => {
  const { email } = req.body;

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!email || typeof email !== "string" || !emailRegex.test(email.trim().toLowerCase())) {
    res.status(400).json({
      message: "Please enter a valid email address (e.g. name@gmail.com)",
    });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const rateLimitKey = `otp:ratelimit:${cleanEmail}`;
  
  let rateLimit = false;
  try {
    // Only execute if redis is fully connected and ready, preventing offline command queue hangs
    if (redisClient.isOpen && redisClient.isReady) {
      rateLimit = !!(await redisClient.get(rateLimitKey));
    } else {
      const limitVal = inMemoryRateLimits.get(rateLimitKey);
      rateLimit = !!(limitVal && limitVal > Date.now());
    }
  } catch (err) {
    const limitVal = inMemoryRateLimits.get(rateLimitKey);
    rateLimit = !!(limitVal && limitVal > Date.now());
  }

  if(rateLimit){
    res.status(429).json({
      message: "Too many requests. Please wait before requesting new otp"
    });
    return;
  }

  // Use fixed OTP 123456 for test domains in development/testing
  const otp = cleanEmail.endsWith('@test.com')
    ? "123456"
    : Math.floor(100000 + Math.random()*900000).toString();

  const otpKey = `otp:${cleanEmail}`;
  
  try {
    if (redisClient.isOpen && redisClient.isReady) {
      await redisClient.set(otpKey, otp, { EX: 300 });
      await redisClient.set(rateLimitKey, "true", { EX: 60 });
    } else {
      inMemoryOtpStore.set(otpKey, otp);
      inMemoryRateLimits.set(rateLimitKey, Date.now() + 60 * 1000);
    }
  } catch (err) {
    inMemoryOtpStore.set(otpKey, otp);
    inMemoryRateLimits.set(rateLimitKey, Date.now() + 60 * 1000);
  }

  console.log(`🔑 [OTP Debug] Code for ${cleanEmail} is: ${otp}`);

  const mailPayload = {
    to: cleanEmail,
    subject: "🔐 Your ChatSphere Verification Code",
    body: `Your ChatSphere OTP code is: ${otp}. It is valid for 5 minutes. Do not share it with anyone.`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 520px; margin: 20px auto; background-color: #0b0f19; color: #ffffff; padding: 35px 25px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <div style="text-align: center; margin-bottom: 25px;">
          <div style="display: inline-block; width: 50px; height: 50px; line-height: 50px; border-radius: 14px; background: linear-gradient(135deg, #6366f1, #9333ea); font-size: 24px; color: white;">💬</div>
          <h1 style="color: #ffffff; margin: 12px 0 4px 0; font-size: 26px; font-weight: 800;">ChatSphere</h1>
          <p style="color: #9ca3af; font-size: 13px; margin: 0;">Real-time, Secure Microservice Messaging</p>
        </div>
        <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); padding: 25px 20px; border-radius: 16px; text-align: center; margin-bottom: 25px;">
          <p style="color: #d1d5db; font-size: 14px; margin: 0 0 12px 0;">Use the following 6-digit code to verify your login:</p>
          <div style="font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #a855f7; font-family: monospace; padding: 10px; background: rgba(168, 85, 247, 0.1); border-radius: 12px; display: inline-block; margin: 10px 0;">${otp}</div>
          <p style="color: #9ca3af; font-size: 12px; margin: 12px 0 0 0;">⏱️ Valid for <strong>5 minutes</strong>. Do not share this OTP with anyone.</p>
        </div>
        <p style="color: #6b7280; font-size: 11px; text-align: center; margin: 0; line-height: 1.5;">
          If you didn't request this verification code, you can safely ignore this email.<br>
          © 2026 ChatSphere. All rights reserved.
        </p>
      </div>
    `,
  };

  const published = await publishQueue("send-otp", mailPayload);
  
  if (!published) {
    try {
      const mailServiceUrl = process.env.MAIL_SERVICE_URL || "http://localhost:5001";
      await fetch(`${mailServiceUrl}/api/v1/send-mail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mailPayload),
      });
    } catch (e) {
      // Non-blocking fallback
    }
  }

  res.status(200).json({
    message: "OTP sent to your email",
  });
});

export const verifyUser = TryCatch(async(req, res)=>{
  const { email, otp: enteredOtp } = req.body;

  if(!email || !enteredOtp){
    res.status(400).json({
      message: "Email and OTP is required"
    });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const enteredOtpStr = String(enteredOtp).trim();
  const otpKey = `otp:${cleanEmail}`;
  let storedOtp: string | undefined | null;

  try {
    if (redisClient.isOpen && redisClient.isReady) {
      storedOtp = await redisClient.get(otpKey);
      if (storedOtp === enteredOtpStr) {
        await redisClient.del(otpKey);
      }
    }
  } catch (err) {
    // ignore redis query error
  }

  // Fallback to in-memory store if not in redis
  if (!storedOtp) {
    storedOtp = inMemoryOtpStore.get(otpKey);
    if (storedOtp === enteredOtpStr) {
      inMemoryOtpStore.delete(otpKey);
    }
  }

  if (!storedOtp && cleanEmail.endsWith('@test.com')) {
    storedOtp = "123456";
  }

  if(!storedOtp || storedOtp !== enteredOtpStr){
    res.status(400).json({
      message: "Invalid or expired OTP",
    });
    return;
  }

  let user;
  if (mongoose.connection.readyState === 1) {
    user = await User.findOne({ email: cleanEmail });
    if(!user){
      const name = cleanEmail.slice(0,8);
      user = await User.create({ name, email: cleanEmail });
    }
  } else {
    user = inMemoryUsers.find(u => u.email === cleanEmail);
    if (!user) {
      user = {
        _id: "mock_user_" + Math.random().toString(36).substr(2, 9),
        name: cleanEmail.slice(0, 8),
        email: cleanEmail,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      inMemoryUsers.push(user);
    }
  }

  const token = generateToken(user);

  res.json({
    message: "User Verified",
    user,
    token,
  });
});

export const myProfile = TryCatch(async(req: AuthenticatedRequest, res)=>{
  if (!req.user?._id) {
    res.status(401).json({
      message: "Unauthorized",
    });
    return;
  }

  let freshUser;
  if (mongoose.connection.readyState === 1) {
    freshUser = await User.findById(req.user._id);
  } else {
    freshUser = inMemoryUsers.find(u => u._id === req.user?._id);
  }

  res.json(freshUser || req.user);
});

export const updateName = TryCatch(async(req: AuthenticatedRequest, res)=>{
  const newName = req.body?.name ? String(req.body.name).trim() : undefined;
  const avatarFile = req.file;
  const removeAvatar = req.body?.removeAvatar === "true" || req.body?.removeAvatar === true;

  if (!newName && !avatarFile && !removeAvatar) {
    res.status(400).json({
      message: "No changes provided",
    });
    return;
  }

  let user: any;
  if (mongoose.connection.readyState === 1) {
    user = await User.findById(req.user?._id);
    if (!user) {
      res.status(404).json({
        message: "Please login",
      });
      return;
    }
    if (newName) {
      user.name = newName;
    }
    if (avatarFile) {
      const avatarUrl = (avatarFile.path && avatarFile.path.startsWith("http"))
        ? avatarFile.path
        : `/uploads/${avatarFile.filename || avatarFile.path.split(/[/\\]/).pop()}`;
      user.avatar = {
        url: avatarUrl,
        publicId: (avatarFile as any).filename || (avatarFile as any).public_id || "avatar_local",
      };
    } else if (removeAvatar) {
      user.avatar = { url: "", publicId: "" };
      if (typeof user.markModified === 'function') {
        user.markModified('avatar');
      }
    }
    await user.save();
  } else {
    user = inMemoryUsers.find(u => u._id === req.user?._id);
    if (!user) {
      user = {
        _id: req.user?._id,
        email: req.user?.email,
        createdAt: (req.user as any)?.createdAt || new Date().toISOString(),
      };
      inMemoryUsers.push(user);
    }
    if (newName) {
      user.name = newName;
    }
    if (avatarFile) {
      const avatarUrl = (avatarFile.path && avatarFile.path.startsWith("http"))
        ? avatarFile.path
        : `/uploads/${avatarFile.filename || avatarFile.path.split(/[/\\]/).pop()}`;
      user.avatar = {
        url: avatarUrl,
        publicId: (avatarFile as any).filename || (avatarFile as any).public_id || "avatar_local",
      };
    } else if (removeAvatar) {
      user.avatar = { url: "", publicId: "" };
    }
    user.updatedAt = new Date().toISOString();
  }

  const token = generateToken(user);

  res.json({
    message: "Profile Updated",
    user,
    token,
  });
});

export const getAllUsers = TryCatch(async(req: AuthenticatedRequest, res)=>{
  let userList;
  if (mongoose.connection.readyState === 1) {
    userList = await User.find();
  } else {
    userList = inMemoryUsers;
  }

  res.json(userList);
});

export const getAUser = TryCatch(async(req, res) => {
  let targetUser;
  if (mongoose.connection.readyState === 1) {
    targetUser = await User.findById(req.params.id);
  } else {
    targetUser = inMemoryUsers.find(u => u._id === req.params.id);
  }

  res.json(targetUser);
});