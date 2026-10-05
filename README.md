# ChatSphere

ChatSphere is a real-time messaging web application built with the MERN stack and an event-driven microservices architecture. It supports instant text messaging, free voice and video calling, passwordless OTP login, status stories, and private chat vaults.

Live Demo: https://chatsphere-live.duckdns.org

---

## Features

- **Real-Time Chat**: Instant messaging powered by Socket.IO with typing indicators and read receipts (sent, delivered, seen).
- **Voice & Video Calling**: Free peer-to-peer audio and video calls using WebRTC and Google public STUN servers.
- **Passwordless Authentication**: 6-digit email OTP verification using RabbitMQ and Redis.
- **Saved Contacts**: Save and manage frequent contacts to quickly start conversations.
- **Secret Chat Lock**: Passcode-protected vaults to hide sensitive chats.
- **24-Hour Stories**: Share photos or text updates that automatically expire after 24 hours.
- **Media & File Sharing**: Send images, audio messages, PDFs, and documents.
- **Theme Support**: Dark mode and light mode with customizable chat bubble colors.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Socket.io-client
- **Backend Services**: Node.js, Express.js, TypeScript, Socket.IO, WebRTC
- **Database & Cache**: MongoDB, Redis
- **Message Broker**: RabbitMQ
- **Media & Email**: Cloudinary, Nodemailer (SMTP)
- **Deployment**: Docker, Docker Compose, Nginx, AWS EC2

---

## Project Structure

```text
ChatSphere/
├── Backend/
│   ├── user/          # User auth, profile, and contacts service (Port 5000)
│   ├── mail/          # Asynchronous email OTP consumer (Port 5001)
│   └── chat/          # Messaging, calling signaling, status, and lock service (Port 5002)
├── Frontend/          # React web client (Port 5173 / 80)
├── docker-compose.yml # Container orchestration configuration
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js (v20 or higher)
- Docker and Docker Compose
- Git

---

### Option 1: Running with Docker (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/Krishnasingh9999/ChatSphere.git
   cd ChatSphere
   ```

2. Start all services using Docker Compose:
   ```bash
   docker compose up -d --build
   ```

3. Open the application:
   - Frontend: `http://localhost:5173`
   - User Service API: `http://localhost:5000`
   - Mail Service API: `http://localhost:5001`
   - Chat Service API: `http://localhost:5002`
   - RabbitMQ Dashboard: `http://localhost:15672` (Username: `guest`, Password: `guest`)

---

### Option 2: Running Locally (Manual Setup)

1. Start databases and message queue:
   ```bash
   docker compose up -d mongo redis rabbitmq
   ```

2. Start the User Service:
   ```bash
   cd Backend/user
   npm install
   npm run dev
   ```

3. Start the Mail Service:
   ```bash
   cd Backend/mail
   npm install
   npm run dev
   ```

4. Start the Chat Service:
   ```bash
   cd Backend/chat
   npm install
   npm run dev
   ```

5. Start the Frontend Client:
   ```bash
   cd Frontend
   npm install
   npm run dev
   ```

---

## Environment Variables

Create `.env` files in each service directory as needed:

### User & Chat Services (`Backend/user/.env` and `Backend/chat/.env`):
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/chatsphere
JWT_SECRET=your_jwt_secret_key
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost:5672
```

### Mail Service (`Backend/mail/.env`):
```env
PORT=5001
RABBITMQ_URL=amqp://localhost:5672
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

---

## License

This project is licensed under the MIT License.
