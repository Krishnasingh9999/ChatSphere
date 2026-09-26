import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

export interface EmailOptions {
  to: string;
  subject: string;
  body?: string;
  html?: string;
}

export const sendEmail = async ({ to, subject, body, html }: EmailOptions): Promise<boolean> => {
  const user = process.env.USER;
  const pass = process.env.PASSWORD;

  if (!user || !pass || user.includes("your_email") || pass.includes("your_app_password")) {
    console.log(`⚠️ [Mail Service] Real Gmail credentials not configured in Backend/mail/.env. Skipping SMTP send to ${to}.`);
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: user.trim(),
      pass: pass.trim().replace(/\s+/g, ""), // strip spaces from Google App Passwords
    },
  });

  const mailOptions = {
    from: `"AetherChat" <${user.trim()}>`,
    to,
    subject,
    text: body || "",
    html: html || (body ? `<p>${body}</p>` : ""),
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`📧 [Mail Service] Real OTP email successfully sent to ${to} (Message ID: ${info.messageId})`);
  return true;
};
