import multer from "multer";
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from "../config/cloudinary.js";
import path from "path";
import fs from "fs";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const isCloudinaryConfigured = !!(
  process.env.Cloud_Name &&
  process.env.API_KEY &&
  process.env.API_SECRET &&
  process.env.API_SECRET !== "mock_api_secret_key" &&
  process.env.API_KEY !== "123456789012345"
);

const storage = isCloudinaryConfigured
  ? new CloudinaryStorage({
      cloudinary,
      params: async (req, file) => {
        let folder = "chat-files";
        let resource_type = "auto";
        if (file.mimetype.startsWith("image/")) {
          folder = "chat-images";
          resource_type = "image";
        } else if (file.mimetype.startsWith("audio/")) {
          folder = "chat-audio";
          resource_type = "video";
        } else {
          folder = "chat-docs";
          resource_type = "raw";
        }
        return {
          folder,
          resource_type,
          public_id: `file-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
        };
      },
    })
  : multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, uploadsDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname) || "";
        cb(null, `file-${uniqueSuffix}${ext}`);
      },
    });

export const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/svg+xml",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/ogg",
      "audio/webm",
      "audio/m4a",
      "audio/x-m4a",
      "audio/aac",
      "text/plain",
    ];

    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("audio/") ||
      allowedMimes.includes(file.mimetype) ||
      /\.(jpg|jpeg|png|gif|webp|svg|pdf|doc|docx|mp3|wav|ogg|m4a|aac|webm|txt)$/i.test(file.originalname)
    ) {
      cb(null, true);
    } else {
      cb(new Error("File type not supported. Allowed formats: Images, PDF, DOCX, Audio"));
    }
  },
});