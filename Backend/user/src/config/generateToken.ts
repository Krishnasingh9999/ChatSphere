import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "aether_jwt_secret_dev_key_123456";

export const generateToken = (user: any) => {
  return jwt.sign({ user }, JWT_SECRET, { expiresIn: "15d" });
};