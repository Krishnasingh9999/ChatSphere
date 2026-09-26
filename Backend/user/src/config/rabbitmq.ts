import amqp from "amqplib";

let channel: amqp.Channel;

export const connectRabbitMQ = async () => {
  const rabbitUrl = process.env.RABBITMQ_URL;
  const host = process.env.Rabbitmq_Host;

  if (!rabbitUrl && !host) {
    console.log("⚠️ RabbitMQ is not configured. User service queue disabled.");
    return;
  }

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
    console.log("✅ connected to rabbitmq");
  } catch (error) {
    console.log("⚠️ Failed to connect to rabbitmq. Continuing in offline mode.", error);
  }
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