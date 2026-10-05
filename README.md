# ChatSphere

ChatSphere is a real-time messaging and communication platform built using an event-driven microservices architecture. It supports instant chat, peer-to-peer voice and video calls, passwordless authentication, multimedia sharing, and 24-hour status updates.

**Live Application:** https://chatsphere-live.duckdns.org

---

## Overview

ChatSphere is designed as a distributed system where services operate independently and communicate asynchronously through RabbitMQ and real-time WebSockets (Socket.IO). The user interface is built with React 19, offering a responsive experience with dark and light mode support.

---

## Features

### Messaging
- Real-time text messaging with low latency.
- Delivery status tracking: Sent, Delivered, and Seen receipts.
- Live typing indicators with automatic timeouts.
- Message management: Delete for Me, Delete for Everyone, and Clear Chat.

### Calling
- Free peer-to-peer voice and video calling via WebRTC.
- Powered by Google public STUN servers (zero third-party calling costs).
- Fullscreen remote video, Picture-in-Picture (PIP) local preview, camera flipping, and audio/video toggles.

### Security and Authentication
- Passwordless login using 6-digit email OTPs.
- Asynchronous OTP dispatch using RabbitMQ message queues.
- Redis-backed rate limiting and OTP expiration.
- Passcode-protected secret chat vaults encrypted with PBKDF2 SHA-512.

### Contacts and Social
- Saved Contacts directory to bookmark frequent contacts for instant access.
- 24-hour status stories with image, text, and view tracking support.
- Attachment support for images, audio voice notes, PDFs, and documents.
- Customizable chat theme presets and dark/light mode toggle.

---

## Technology Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Socket.io-Client
- **Backend Services:** Node.js (v20), Express.js, TypeScript, Socket.IO, WebRTC
- **Database & Cache:** MongoDB, Redis
- **Message Broker:** RabbitMQ
- **Media & Email:** Cloudinary, Nodemailer (SMTP)
- **Deployment:** Docker, Docker Compose, Nginx Reverse Proxy, AWS EC2

---

## System Architecture

```text
               +----------------------------------------+
               |        React 19 Frontend Client        |
               +-------------------+--------------------+
                                   | (HTTPS / WSS)
               +-------------------v--------------------+
               |          Nginx Reverse Proxy           |
               +---------+------------------+-----------+
                         |                  |
         +---------------v----+   +---------v----------+   +--------------------+
         |    User Service    |   |    Chat Service    |   |    Mail Service    |
         |    (Port 5000)     |   |    (Port 5002)     |   |    (Port 5001)     |
         | Auth, Profile,     |   | Messaging, Calls,  |   | RabbitMQ Consumer, |
         | Contacts           |   | Status, Vault      |   | SMTP Delivery      |
         +--------+-----------+   +---------+----------+   +---------^----------+
                  |                         |                        |
                  |     +--------------+    |    +---------------+   |
                  +---->|   MongoDB    |<---+    |   RabbitMQ    +---+
                  |     +--------------+    |    +---------------+
                  |     +--------------+    |
                  +---->|    Redis     |<---+
                        +--------------+
```

---

## Project Structure

```text
ChatSphere/
├── Backend/
│   ├── user/          # Authentication, profile, and contact management (Port 5000)
│   ├── mail/          # Asynchronous email OTP worker (Port 5001)
│   └── chat/          # Messaging, WebRTC signaling, status, and vault (Port 5002)
├── Frontend/          # React single-page application (Port 5173 / 80)
├── docker-compose.yml # Multi-container configuration
└── README.md          # Documentation
```

---

## Getting Started

### Prerequisites

- Node.js (v20 or higher)
- Docker and Docker Compose
- Git

---

### Running with Docker (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/Krishnasingh9999/ChatSphere.git
   cd ChatSphere
   ```

2. Start all containers:
   ```bash
   docker compose up -d --build
   ```

3. Access the services:
   - Frontend Application: `http://localhost:5173`
   - User Service API: `http://localhost:5000`
   - Mail Service API: `http://localhost:5001`
   - Chat Service API & WebSockets: `http://localhost:5002`
   - RabbitMQ Management: `http://localhost:15672` (Credentials: `guest` / `guest`)

---

### Running Locally (Manual Setup)

1. Start database services:
   ```bash
   docker compose up -d mongo redis rabbitmq
   ```

2. Start each microservice in separate terminal windows:

   **User Service:**
   ```bash
   cd Backend/user
   npm install
   npm run dev
   ```

   **Mail Service:**
   ```bash
   cd Backend/mail
   npm install
   npm run dev
   ```

   **Chat Service:**
   ```bash
   cd Backend/chat
   npm install
   npm run dev
   ```

   **Frontend Client:**
   ```bash
   cd Frontend
   npm install
   npm run dev
   ```

---

## Environment Variables

Configure `.env` files in each service directory as needed:

### User & Chat Services (`Backend/user/.env`, `Backend/chat/.env`)
```env
PORT=5000 # Use 5002 for chat service
MONGO_URI=mongodb://localhost:27017/chatsphere
JWT_SECRET=your_jwt_secret_key
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost:5672
```

### Mail Service (`Backend/mail/.env`)
```env
PORT=5001
RABBITMQ_URL=amqp://localhost:5672
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_email_app_password
```

---

## License

This project is open source and available under the [MIT License](LICENSE).
