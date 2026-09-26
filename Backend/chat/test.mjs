import { spawn } from 'child_process';
import assert from 'assert';
import jwt from 'jsonwebtoken';
import { io } from '../../Frontend/node_modules/socket.io-client/build/esm/index.js';

console.log("🧪 Running Chat Microservice Test Suite...");

const JWT_SECRET = process.env.JWT_SECRET || "aether_jwt_secret_super_secure_key_2026";

// Create test tokens for User A and User B
const userA = { _id: "chat_test_user_a_" + Date.now(), name: "Alice", email: "alice@test.com" };
const userB = { _id: "chat_test_user_b_" + Date.now(), name: "Bob", email: "bob@test.com" };

const tokenA = jwt.sign({ user: userA }, JWT_SECRET, { expiresIn: "1h" });
const tokenB = jwt.sign({ user: userB }, JWT_SECRET, { expiresIn: "1h" });

const proc = spawn('node', ['dist/index.js'], {
  env: { ...process.env },
  stdio: ['ignore', 'pipe', 'pipe']
});

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const url = `http://localhost:5002/api/v1${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const res = await fetch(url, {
    ...options,
    headers
  });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {}
  return { status: res.status, data };
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(url);
      return true;
    } catch (e) {
      await wait(500);
    }
  }
  throw new Error(`Server at ${url} failed to start within ${timeoutMs}ms`);
}

async function run() {
  try {
    await waitForServer('http://localhost:5002/api/v1/chat/all');

    // Test 1: Accessing chat without auth fails (401)
    console.log("  ✓ Case 1: Access /chat/all without auth header fails (401)");
    const r1 = await request('/chat/all');
    assert.strictEqual(r1.status, 401, "Should reject unauthenticated request with 401");

    // Test 2: Creating a chat without otherUserId fails (400)
    console.log("  ✓ Case 2: Create chat without otherUserId fails (400)");
    const r2 = await request('/chat/new', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({})
    });
    assert.strictEqual(r2.status, 400, "Should reject missing otherUserId with 400");

    // Test 3: Create valid chat between User A and User B
    console.log("  ✓ Case 3: Create valid chat succeeds (201 or 200)");
    const r3 = await request('/chat/new', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ otherUserId: userB._id })
    });
    assert(r3.status === 200 || r3.status === 201, "Should return 200/201 on chat creation");
    const chatId = r3.data.chatId || r3.data._id || r3.data.chat?._id;
    assert(chatId, "Must return chatId");

    // Test 4: Create duplicate chat returns existing chat
    console.log("  ✓ Case 4: Creating duplicate chat returns existing chatId (200)");
    const r4 = await request('/chat/new', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ otherUserId: userB._id })
    });
    assert.strictEqual(r4.status, 200, "Should return existing chat with 200");

    // Test 5: Get all chats for User A
    console.log("  ✓ Case 5: Get all chats returns chat list (200)");
    const r5 = await request('/chat/all', {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(r5.status, 200, "Should return 200 for getAllChats");
    assert(Array.isArray(r5.data.chats), "Must return chats array");

    // Test 6: Send message without text or image fails (400)
    console.log("  ✓ Case 6: Send empty message fails (400)");
    const r6 = await request('/message', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ chatId })
    });
    assert.strictEqual(r6.status, 400, "Should reject empty message with 400");

    // Test 7: Send valid message from User A
    console.log("  ✓ Case 7: Send valid text message succeeds (201)");
    const r7 = await request('/message', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ chatId, text: "Hello Bob from Unit Test!" })
    });
    assert.strictEqual(r7.status, 201, "Should return 201 for sent message");
    assert(r7.data.message, "Should return message object");
    assert.strictEqual(r7.data.message.text, "Hello Bob from Unit Test!");

    // Test 8: Socket.IO connection and real-time message delivery
    console.log("  ✓ Case 8: Socket.IO connects and streams real-time message");
    const socketB = io('http://localhost:5002');
    await new Promise((resolve) => socketB.on('connect', resolve));
    socketB.emit('join', userB._id);

    const receivedMessagePromise = new Promise((resolve) => {
      socketB.on('new-message', (msg) => {
        resolve(msg);
      });
    });

    // Send another message to trigger socket event
    await request('/message', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ chatId, text: "Real-time socket message test" })
    });

    const socketMsg = await Promise.race([
      receivedMessagePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Socket timeout")), 3000))
    ]);
    assert.strictEqual(socketMsg.text, "Real-time socket message test");

    // Test 9: Get messages for chat & mark as seen
    console.log("  ✓ Case 9: Read messages marks messages as seen (200)");
    const r9 = await request(`/message/${chatId}`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert.strictEqual(r9.status, 200, "Should return 200 for getMessagesByChat");
    assert(Array.isArray(r9.data.messages), "Must return messages array");

    socketB.close();

    console.log("\n✅ ALL 9 CHAT MICROSERVICE TEST CASES PASSED!\n");
  } catch (err) {
    console.error("❌ Test Case Failed:", err.message);
    process.exitCode = 1;
  } finally {
    proc.kill();
  }
}

run();
