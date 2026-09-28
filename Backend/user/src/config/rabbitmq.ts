import amqp from "amqplib";

let channel: amqp.Channel;

let isConnecting = false;

export const connectRabbitMQ = async () => {
  const rabbitUrl = process.env.RABBITMQ_URL;
  const host = process.env.Rabbitmq_Host;

  if (!rabbitUrl && !host) {
    console.log("⚠️ RabbitMQ is not configured. User service queue disabled.");
    return;
  }

  if (isConnecting || channel) return;
  isConnecting = true;

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

      channel = await connection.createChannel();
      isConnecting = false;
      console.log("✅ connected to rabbitmq");

      connection.on("error", () => {
        channel = null as any;
        setTimeout(attemptConnect, 5000);
      });

      connection.on("close", () => {
        channel = null as any;
        setTimeout(attemptConnect, 5000);
      });
    } catch (error) {
      if (retries > 0) {
        console.log(`⚠️ RabbitMQ not ready yet. Retrying in ${delay / 1000}s... (${retries} attempts left)`);
        setTimeout(() => attemptConnect(retries - 1, delay), delay);
      } else {
        isConnecting = false;
        console.log("⚠️ RabbitMQ connection unavailable. Continuing in offline mode.");
      }
    }
  };

  attemptConnect();
};

export const publishQueue = async (queueName: string, message: any): Promise<boolean> => {
  if (!channel) {
    console.log("RabbitMq channel is not initialized. Using direct Mail Service fallback.");
    return false;
  }

  try {
    await channel.assertQueue(queueName, { durable: true });
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });
    return true;
  } catch (err) {
    console.error("Failed to publish to RabbitMQ queue:", err);
    return false;
  }
};