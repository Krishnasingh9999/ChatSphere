import amqp from "amqplib";
import dotenv from "dotenv";
import { sendEmail } from "./mailer.js";
dotenv.config();

export const startSendOtpConsumer = async () => {
  try {
    const rabbitUrl = process.env.RABBITMQ_URL;
    const host = process.env.Rabbitmq_Host;

    if (!rabbitUrl && !host) {
      console.log("⚠️ RabbitMQ is not configured. Mail Service consumer in standby mode.");
      return;
    }

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
          // Acknowledge to prevent poison message loop
          channel.ack(msg);
        }
      }
    });
  } catch (error) {
    console.log("⚠️ RabbitMQ connection offline for Mail Service consumer. Standby mode active.");
  }
};
