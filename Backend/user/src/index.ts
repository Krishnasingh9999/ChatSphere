import express from "express";
import connectDb from "./config/db.js";
import {createClient} from "redis";
import dotenv from "dotenv";
import userRoute from "./routes/user.js";
import { connectRabbitMQ } from "./config/rabbitmq.js";
import cors from "cors";
import path from "path";
import fs from "fs";

dotenv.config();
connectDb();

connectRabbitMQ();

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redisClient = createClient({
  url: redisUrl,
  socket: {
    connectTimeout: 1500,
    reconnectStrategy: false,
  },
});

redisClient.on("error", (err) => {
  // Prevent unhandled error event crash when Redis is offline
});

redisClient
  .connect()
  .then(() => {
    console.log("✅ connected to redis");
  })
  .catch(() => {
    console.log("⚠️ Redis offline. Using In-Memory fallback.");
  });

const app = express();

app.use(express.json());
app.use(cors());
app.use("/uploads", express.static(uploadsDir));

app.use("/api/v1", userRoute);

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`Server is running on ${port}`);
});