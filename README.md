# ChatSphere — Real-Time Microservices Messaging Platform

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Available-brightgreen)](https://chatsphere-live.duckdns.org)
[![Docker](https://img.shields.io/badge/Docker-Compose%20Ready-blue)](docker-compose.yml)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-green)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

ChatSphere is a full-stack, distributed real-time messaging application designed with an event-driven microservices architecture. It provides secure instant communication, WebRTC voice and video calling, passwordless OTP authentication, multimedia status stories, and encrypted chat vaults.

**Live Application**: [https://chatsphere-live.duckdns.org](https://chatsphere-live.duckdns.org)

---

## Key Features

### 💬 Real-Time Messaging & Presence
- **Instant Messaging**: Low-latency bi-directional messaging powered by Socket.IO.
- **Message Status Indicators**: Real-time delivery and read receipts (Sent, Delivered, Seen).
- **Interactive Typing Indicators**: Live typing state broadcast with auto-timeout.
- **Message Controls**: Delete for Me, Delete for Everyone, and Clear Chat History.

### 📞 Voice & Video Calling (WebRTC)
- **Peer-to-Peer Calls**: Free, low-latency audio and video calls powered by WebRTC and Google public STUN servers.
- **Video Controls**: Fullscreen remote stream, floating Picture-in-Picture (PIP) local preview, camera flip (front/back), and video/mic toggle.

### 🔐 Security & Authentication
- **Passwordless OTP Login**: 6-digit email OTP verification processed asynchronously via RabbitMQ.
- **Secret Chat Lock**: Passcode-protected hidden vault with PBKDF2 SHA-512 cryptographic hashing.
- **Rate-Limiting**: Redis-backed cooldowns and TTL protection against spam requests.

### ⭐ Contact Management & Social
- **Saved Contacts**: Phonebook directory allowing users to bookmark frequent contacts for instant access.
- **24-Hour Stories**: Share photo and text status updates with view receipts and automatic 24-hour expiration.
- **Multimedia Sharing**: Upload and preview images, audio voice notes, PDFs, and documents.
- **Adaptive UI**: Dark and light theme modes with customizable chat color presets.

---

## System Architecture

```text
                               ┌────────────────────────────────┐
                               │  Frontend Client (React 19)    │
                               └───────────────┬────────────────┘
                                               │ (HTTPS / WSS)
                               ┌───────────────▼────────────────┐
                               │      Nginx Reverse Proxy       │
                               └───────┬────────┬────────┬──────┘
                                       │        │        │
                   ┌───────────────────┘        │        └───────────────────┐
                   ▼                            ▼                            ▼
        ┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
        │    User Service     │      │    Chat Service     │      │    Mail Service     │
        │     (Port 5000)     │      │     (Port 5002)     │      │     (Port 5001)     │
        │  Auth, Profile &    │      │  Socket.IO, WebRTC  │      │  RabbitMQ Consumer  │
        │   Saved Contacts    │      │  Status & Vault     │      │  Nodemailer Worker  │
        └──────────┬──────────┘      └──────────┬──────────┘      └──────────▲──────────┘
                   │                            │                            │
                   │    ┌───────────────────┐   │   ┌────────────────────┐   │
                   ├───►│   MongoDB Cloud   │◄──┤   │  RabbitMQ Broker   ├───┘
                   │    └───────────────────┘   │   │   (AMQP Queue)     │
                   │    ┌───────────────────┐   │   └────────────────────┘
                   └───►│   Redis Caching   │◄──┘
                        └───────────────────┘
```

---

## Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Socket.io-Client |
| **Microservices** | Node.js (v20), Express.js, TypeScript, Socket.IO, WebRTC |
| **Database & Cache** | MongoDB (Mongoose ODM), Redis (v7) |
| **Message Queue** | RabbitMQ (AMQP 5672) |
| **Media & Delivery** | Cloudinary CDN, Nodemailer SMTP |
| **DevOps & Infrastructure** | Docker, Docker Compose, Nginx, Let's Encrypt SSL, AWS EC2 |

---

## Project Structure

```text
ChatSphere/
├── Backend/
│   ├── user/          # User authentication, profile & contact service (Port 5000)
│   ├── mail/          # Asynchronous email OTP worker (Port 5001)
│   └── chat/          # Real-time messaging, calling & status service (Port 5002)
├── Frontend/          # React Single Page Application (Port 5173 / 80)
├── docker-compose.yml # Unified multi-service orchestration
└── README.md
```

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v20 or higher)
- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)
- [Git](https://git-scm.com/)

---

### Quick Start with Docker (Recommended)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Krishnasingh9999/ChatSphere.git
   cd ChatSphere
   ```

2. **Launch all services**:
   ```bash
   docker compose up -d --build
   ```

3. **Access endpoints**:
   - **Frontend App**: `http://localhost:5173`
   - **User Service API**: `http://localhost:5000`
   - **Mail Service API**: `http://localhost:5001`
   - **Chat Service API & Socket**: `http://localhost:5002`
   - **RabbitMQ Management**: `http://localhost:15672` *(Default: guest / guest)*

---

### Local Development Setup (Without Docker)

1. **Start database dependencies**:
   ```bash
   docker compose up -d mongo redis rabbitmq
   ```

2. **Install & start each service**:

   ```bash
   # Terminal 1: User Service
   cd Backend/user && npm install && npm run dev

   # Terminal 2: Mail Service
   cd Backend/mail && npm install && npm run dev

   # Terminal 3: Chat Service
   cd Backend/chat && npm install && npm run dev

   # Terminal 4: Frontend Client
   cd Frontend && npm install && npm run dev
   ```

---

## Environment Configuration

Each service supports configuration via environment variables:

### User Service (`Backend/user/.env`) & Chat Service (`Backend/chat/.env`)
```env
PORT=5000 # 5002 for chat service
MONGO_URI=mongodb://localhost:27017/chatsphere
JWT_SECRET=your_secure_jwt_secret
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

## Author

Created and maintained by **Krishna Singh** ([@Krishnasingh9999](https://github.com/Krishnasingh9999)).

---

## License

This project is licensed under the [MIT License](LICENSE).
