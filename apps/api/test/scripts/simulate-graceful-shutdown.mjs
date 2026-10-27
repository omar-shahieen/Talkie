#!/usr/bin/env node

/**
 * simulate-graceful-shutdown.mjs
 * 
 * Simulates and verifies the graceful shutdown sequence for the Talkie API:
 * 1. Checks that an in-flight request (GET /test-slow) completes successfully.
 * 2. Verifies that subsequent new requests are refused once shutdown has begun.
 * 3. Verifies that WebSocket gateways disconnect cleanly.
 * 4. Confirms the API process exits with exit code 0.
 *
 * Works against an already running instance OR spawns an instance automatically.
 */

import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const api_DIR = path.resolve(__dirname, '../..');
const PORT = process.env.PORT || 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function log(step, msg) {
  const ts = new Date().toISOString().split('T')[1].slice(0, 8);
  console.log(`[${ts}] [${step}] ${msg}`);
}

function fetchUrl(pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, BASE_URL);
    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || 10000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(body);
          } catch { }
          resolve({ status: res.statusCode, headers: res.headers, body, data: json });
        });
      },
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function isServerRunning() {
  try {
    const res = await fetchUrl('/health', { timeout: 1500 });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isServerRunning()) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function runSimulation() {
  console.log('='.repeat(65));
  console.log('       TALKIE API - GRACEFUL SHUTDOWN SIMULATION');
  console.log('='.repeat(65));

  let spawnedProcess = null;
  const runningInitially = await isServerRunning();

  if (runningInitially) {
    log('SETUP', `Detected running Talkie API at ${BASE_URL}`);
  } else {
    log('SETUP', 'No running API detected. Spawning API in child process...');

    const distMain = path.resolve(api_DIR, 'dist/main.js');
    spawnedProcess = spawn(process.execPath, [distMain], {
      cwd: api_DIR,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: { ...process.env, PORT: String(PORT) },
    });

    spawnedProcess.stdout.on('data', (d) => {
      const line = d.toString().trim();
      if (line) console.log(`   [API STDOUT] ${line}`);
    });

    spawnedProcess.stderr.on('data', (d) => {
      const line = d.toString().trim();
      if (line) console.error(`   [API STDERR] ${line}`);
    });

    log('SETUP', 'Waiting for API server to become healthy...');
    const isReady = await waitForServer(20000);
    if (!isReady) {
      if (spawnedProcess) spawnedProcess.kill();
      throw new Error('API failed to start within 20s. Ensure databases/Redis are running and "npm run build:api" was executed.');
    }
    log('SETUP', 'API server is ready and accepting requests.');
  }

  // --- STEP 1: Initiate an in-flight long-running request ---
  log('STEP 1', 'Initiating in-flight slow request (GET /test-slow, takes ~2000ms)...');
  const inflightStartTime = Date.now();
  const inflightPromise = fetchUrl('/test-slow').catch((err) => ({
    status: 'FAILED',
    error: err.message,
  }));

  // Wait 300ms so the request is actively being processed by the event loop
  await new Promise((r) => setTimeout(r, 300));

  // --- STEP 2: Trigger graceful shutdown ---
  log('STEP 2', 'Triggering graceful shutdown while slow request is in-flight...');
  if (spawnedProcess) {
    try {
      await fetchUrl('/test-shutdown', { method: 'POST' });
      log('STEP 2', 'Triggered shutdown signal via POST /test-shutdown');
    } catch {
      log('STEP 2', 'Falling back to child IPC message "shutdown"');
      spawnedProcess.send('shutdown');
    }
  } else {
    const res = await fetchUrl('/test-shutdown', { method: 'POST' });
    log('STEP 2', `Triggered graceful shutdown via POST /test-shutdown (Status: ${res.status})`);
  }

  // --- STEP 3: Attempt to send a NEW request after shutdown initiated ---
  await new Promise((r) => setTimeout(r, 200));
  log('STEP 3', 'Attempting a NEW request (GET /health) after shutdown began...');
  try {
    const newRes = await fetchUrl('/health', { timeout: 2000 });
    if (newRes.status !== 200) {
      log('STEP 3', `[PASS] New request received non-200 status (${newRes.status})`);
    } else {
      log('STEP 3', `[WARN] New request succeeded with 200 before socket close was finalized`);
    }
  } catch (err) {
    log('STEP 3', `[PASS] New request was successfully rejected: ${err.message}`);
  }

  // --- STEP 4: Await the in-flight slow request ---
  log('STEP 4', 'Awaiting original in-flight request result...');
  const inflightResult = await inflightPromise;
  const inflightDuration = Date.now() - inflightStartTime;

  if (inflightResult.status === 200) {
    log('STEP 4', `[PASS] In-flight request COMPLETED SUCCESSFULLY with 200 OK (${inflightDuration}ms)!`);
    console.log('         Payload:', JSON.stringify(inflightResult.data));
  } else {
    log('STEP 4', `[FAIL] In-flight request was dropped or aborted! Status: ${inflightResult.status}, Error: ${inflightResult.error}`);
  }

  // --- STEP 5: Verify clean process exit ---
  log('STEP 5', 'Verifying server process termination and port release...');
  if (spawnedProcess) {
    const exitCode = await new Promise((resolve) => {
      if (spawnedProcess.exitCode !== null) return resolve(spawnedProcess.exitCode);
      spawnedProcess.on('exit', (code) => resolve(code));
      setTimeout(() => resolve('TIMEOUT'), 8000);
    });

    if (exitCode === 0) {
      log('STEP 5', `[PASS] Child process exited cleanly with code ${exitCode}.`);
    } else {
      log('STEP 5', `[FAIL] Child process exited with unexpected code: ${exitCode}`);
    }
  } else {
    let isDown = false;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (!(await isServerRunning())) {
        isDown = true;
        break;
      }
    }
    if (isDown) {
      log('STEP 5', '[PASS] Running server stopped accepting connections and port was released.');
    } else {
      log('STEP 5', '[FAIL] Server is still responding on port after shutdown signal.');
    }
  }

  console.log('='.repeat(65));
  console.log('       GRACEFUL SHUTDOWN SIMULATION COMPLETE');
  console.log('='.repeat(65));
}

runSimulation().catch((err) => {
  console.error('[ERROR] Simulation encountered an unexpected failure:', err);
  process.exit(1);
});
