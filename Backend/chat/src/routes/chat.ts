import express from "express";
import {
  createNewChat,
  getAllChats,
  getMessagesByChat,
  sendMessage,
  deleteMessageForMe,
  deleteMessageForEveryone,
  clearChatForMe,
  deleteChatForMe,
  getChatLockStatus,
  setChatPasscode,
  verifyChatPasscode,
  toggleChatLock,
  removeChatPasscode
} from "../controllers/chat.js";
import isAuth from "../middleware/isAuth.js";
import { upload } from "../middleware/multer.js";

const router = express.Router();

const handleUpload = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  upload.fields([{ name: 'file', maxCount: 1 }, { name: 'image', maxCount: 1 }])(req, res, (err: any) => {
    if (err) {
      res.status(400).json({ message: err.message || "File upload failed" });
      return;
    }
    if (req.files) {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      if (files.file && files.file[0]) {
        req.file = files.file[0];
      } else if (files.image && files.image[0]) {
        req.file = files.image[0];
      }
    }
    next();
  });
};

router.post("/chat/new", isAuth, createNewChat);
router.get("/chat/all", isAuth, getAllChats);
router.post("/message", isAuth, handleUpload, sendMessage);
router.get("/message/:chatId", isAuth, getMessagesByChat);
router.delete("/message/:messageId/everyone", isAuth, deleteMessageForEveryone);
router.delete("/message/:messageId", isAuth, deleteMessageForMe);
router.put("/chat/:chatId/clear", isAuth, clearChatForMe);
router.delete("/chat/:chatId/clear", isAuth, clearChatForMe);
router.delete("/chat/:chatId", isAuth, deleteChatForMe);

// Chat Lock Routes
router.get("/lock/status", isAuth, getChatLockStatus);
router.post("/lock/set-passcode", isAuth, setChatPasscode);
router.post("/lock/verify-passcode", isAuth, verifyChatPasscode);
router.post("/lock/toggle", isAuth, toggleChatLock);
router.post("/lock/remove-passcode", isAuth, removeChatPasscode);

export default router;