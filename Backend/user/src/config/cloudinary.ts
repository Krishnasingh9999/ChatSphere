import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const cloudName = process.env.Cloud_Name || "dzssijacq";
const apiKey = process.env.API_KEY || "123456789012345";
const apiSecret = process.env.API_SECRET || "mock_api_secret_key";

if (!process.env.Cloud_Name || !process.env.API_KEY || !process.env.API_SECRET) {
  console.log("⚠️ Cloudinary environment variables missing or incomplete in user service. Using fallback configuration.");
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
});

export default cloudinary;
