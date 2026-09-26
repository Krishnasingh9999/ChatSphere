import express from "express";
import dotenv from "dotenv";
import { startSendOtpConsumer } from "./consumer.js";
import { sendEmail } from "./mailer.js";

dotenv.config();

startSendOtpConsumer();

const app = express();
app.use(express.json());

// Direct HTTP Email Endpoint as fallback for RabbitMQ
app.post("/api/v1/send-mail", async (req, res) => {
  const { to, subject, body, html } = req.body;
  if (!to || (!body && !html)) {
    res.status(400).json({ message: "Recipient 'to' and message body required" });
    return;
  }

  try {
    const sent = await sendEmail({ to, subject: subject || "OTP Code", body, html });
    res.status(200).json({
      success: true,
      message: sent ? "Email sent successfully" : "Email logged (configure credentials for SMTP delivery)",
    });
  } catch (error: any) {
    console.error("❌ Direct email delivery error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

const port = process.env.PORT || 5001;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});