import amqp from "amqplib";
import dotenv from "dotenv";
import { sendEmail } from "./mailer.js";
dotenv.config();

export const startSendOtpConsumer = async () => {
  const rabbitUrl = process.env.RABBITMQ_URL;
  const host = process.env.Rabbitmq_Host;

  if (!rabbitUrl && !host) {
    console.log("⚠️ RabbitMQ is not configured. Mail Service consumer in standby mode.");
    return;
  }

  const attemptConnect = async (retries = 10, delay = 5000) => {
    try {
      const connection = rabbitUrl
        ? await amqp.connect(rabbitUrl)
        : await amqp.connect({
            protocol: "amqp",
            hostname: host,
            port: Number(process.env.Rabbitmq_Port) || 5672,
            username: process.env.Rabbitmq_Username || "guest",
            password: process.env.Rabbitmq_password || "guest",
          });

      const channel = await connection.createChannel();
      const queueName = "send-otp";

      await channel.assertQueue(queueName, { durable: true });

      console.log("✅ Mail Service consumer started, listening for otp emails on queue: send-otp");

      channel.consume(queueName, async (msg) => {
        if (msg) {
          try {
            const { to, subject, body, html } = JSON.parse(msg.content.toString());
            await sendEmail({ to, subject, body, html });
            channel.ack(msg);
          } catch (error) {
            console.error("❌ Failed to process OTP message:", error);
            channel.ack(msg);
          }
        }
      });

      connection.on("error", () => {
        console.log("⚠️ RabbitMQ connection error in Mail Consumer. Reconnecting...");
        setTimeout(attemptConnect, 5000);
      });

      connection.on("close", () => {
        console.log("⚠️ RabbitMQ connection closed in Mail Consumer. Reconnecting...");
        setTimeout(attemptConnect, 5000);
      });
    } catch (error) {
      if (retries > 0) {
        console.log(`⚠️ RabbitMQ not ready yet for Mail Consumer. Retrying in ${delay / 1000}s... (${retries} attempts left)`);
        setTimeout(() => attemptConnect(retries - 1, delay), delay);
      } else {
        console.log("⚠️ RabbitMQ connection offline for Mail Service consumer. Standby mode active.");
      }
    }
  };

  attemptConnect();
};
