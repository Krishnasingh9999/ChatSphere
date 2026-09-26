import { spawn } from 'child_process';
import assert from 'assert';

console.log("🧪 Running User Microservice Test Suite...");

const proc = spawn('node', ['dist/index.js'], {
  env: { ...process.env },
  stdio: ['ignore', 'pipe', 'pipe']
});

proc.stdout?.on('data', (d) => console.log(`[USER LOG] ${d.toString().trim()}`));
proc.stderr?.on('data', (d) => console.error(`[USER ERR] ${d.toString().trim()}`));

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const url = `http://localhost:5000/api/v1${path}`;
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
    await waitForServer('http://localhost:5000/api/v1/user/123');

    const runId = Date.now().toString().slice(-4);
    const testEmail = `testuser_${runId}@test.com`;

    // Test 1: Invalid email format
    console.log("  ✓ Case 1: Login with invalid email fails (400)");
    const r1 = await request('/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'invalid-email' })
    });
    assert.strictEqual(r1.status, 400, "Should reject invalid email with 400");

    // Test 2: Valid email request
    console.log("  ✓ Case 2: Login with valid email succeeds (200)");
    const r2 = await request('/login', {
      method: 'POST',
      body: JSON.stringify({ email: testEmail })
    });
    assert.strictEqual(r2.status, 200, "Should return 200 on OTP request");

    // Test 3: Rate limiting on immediate consecutive request
    console.log("  ✓ Case 3: Rate limiting blocks consecutive OTP request (429)");
    const r3 = await request('/login', {
      method: 'POST',
      body: JSON.stringify({ email: testEmail })
    });
    assert.strictEqual(r3.status, 429, "Should return 429 on rate limit");

    // Test 4: Verify with wrong OTP
    console.log("  ✓ Case 4: Verification with wrong OTP fails (400)");
    const r4 = await request('/verify', {
      method: 'POST',
      body: JSON.stringify({ email: testEmail, otp: '000000' })
    });
    assert.strictEqual(r4.status, 400, "Should reject wrong OTP with 400");

    // Test 5: Verify with valid OTP
    console.log("  ✓ Case 5: Verification with valid OTP succeeds (200)");
    const r5 = await request('/verify', {
      method: 'POST',
      body: JSON.stringify({ email: testEmail, otp: '123456' })
    });
    assert.strictEqual(r5.status, 200, "Should verify user with 200");
    assert(r5.data.token, "Should return JWT token");
    assert(r5.data.user, "Should return user object");
    const token = r5.data.token;
    const userId = r5.data.user._id;

    // Test 6: Access /me without auth header fails
    console.log("  ✓ Case 6: Unauthorized access to /me fails (401)");
    const r6 = await request('/me');
    assert.strictEqual(r6.status, 401, "Should return 401 without auth");

    // Test 7: Access /me with valid auth header
    console.log("  ✓ Case 7: Authorized access to /me returns profile (200)");
    const r7 = await request('/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(r7.status, 200, "Should return 200 with auth");
    assert.strictEqual(r7.data.email, testEmail);

    // Test 8: Update name with empty string fails
    console.log("  ✓ Case 8: Update name with empty string fails (400)");
    const r8 = await request('/update/user', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: '   ' })
    });
    if (r8.status !== 400) {
      console.log("Case 8 response was:", r8.status, r8.data);
    }
    assert.strictEqual(r8.status, 400, "Should reject empty name with 400");

    // Test 9: Update name with valid string
    console.log("  ✓ Case 9: Update name with valid string succeeds (200)");
    const r9 = await request('/update/user', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Super User' })
    });
    assert.strictEqual(r9.status, 200, "Should update name with 200");
    assert.strictEqual(r9.data.user.name, 'Super User');

    // Test 10: Fetch user by ID
    console.log("  ✓ Case 10: Get a user by ID succeeds (200)");
    const r10 = await request(`/user/${userId}`);
    assert.strictEqual(r10.status, 200, "Should return user by ID");

    // Test 11: Get all users directory
    console.log("  ✓ Case 11: Get all directory users succeeds (200)");
    const r11 = await request('/user/all', {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(r11.status, 200, "Should return user directory");
    assert(Array.isArray(r11.data), "Directory must be an array");

    console.log("\n✅ ALL 11 USER MICROSERVICE TEST CASES PASSED!\n");
  } catch (err) {
    console.error("❌ Test Case Failed:", err.message);
    process.exitCode = 1;
  } finally {
    proc.kill();
  }
}

run();
