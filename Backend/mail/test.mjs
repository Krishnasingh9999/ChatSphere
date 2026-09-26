import { spawn } from 'child_process';
import assert from 'assert';

console.log("🧪 Running Mail Microservice Test Suite...");

const proc = spawn('node', ['dist/index.js'], {
  env: { ...process.env },
  stdio: ['ignore', 'pipe', 'pipe']
});

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    await waitForServer('http://localhost:5001/');

    // Test 1: Health check / status check on Mail Service port 5001
    console.log("  ✓ Case 1: Mail Microservice starts on port 5001 (200 or 404)");
    const res = await fetch('http://localhost:5001/', {
      headers: { 'Content-Type': 'application/json' }
    });
    // Server is alive if it responds (Express responds 404 to root when no root route is defined)
    assert(res.status === 200 || res.status === 404, "Mail service must be actively listening on port 5001");

    console.log("\n✅ ALL MAIL MICROSERVICE TEST CASES PASSED!\n");
  } catch (err) {
    console.error("❌ Test Case Failed:", err.message);
    process.exitCode = 1;
  } finally {
    proc.kill();
  }
}

run();
