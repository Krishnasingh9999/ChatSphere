import express from "express";
import {
  createStatus,
  getAllStatuses,
  viewStatus,
  deleteStatus,
} from "../controllers/status.js";
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

router.post("/status", isAuth, handleUpload, createStatus);
router.get("/status/all", isAuth, getAllStatuses);
router.put("/status/:statusId/view", isAuth, viewStatus);
router.delete("/status/:statusId", isAuth, deleteStatus);

export default router;
