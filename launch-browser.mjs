/**
 * Launches Chrome with remote debugging on port 9222 and opens TradingView.
 * Works on Windows, Mac, and Linux.
 *
 * Usage:
 *   npm run launch                        # opens default chart
 *   node launch-browser.mjs [chart-url]   # opens a specific TradingView chart URL
 *
 * Keep this running in one terminal. Run other scripts in a second terminal.
 */

import { spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DEBUG_PORT = 9222;
const PROFILE_DIR = join(import.meta.dirname, '.chrome-profile');
const TV_URL = process.argv[2] || 'https://www.tradingview.com/chart/';

if (!existsSync(PROFILE_DIR)) mkdirSync(PROFILE_DIR, { recursive: true });

// ── Find Chrome binary (Windows / Mac / Linux) ───────────────────────────────
function findChrome() {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }
  const candidates = {
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `C:\\Users\\${process.env.USERNAME}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    linux: [
      '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ],
  };
  for (const path of candidates[process.platform] ?? []) {
    if (existsSync(path)) return path;
  }
  throw new Error(
    'Chrome not found. Install Google Chrome or set the CHROME_BIN environment variable.'
  );
}

const CHROME_BIN = findChrome();
console.log(`Using Chrome: ${CHROME_BIN}`);

// ── On Linux without a display, start Xvfb ──────────────────────────────────
let xvfb = null;
let env = { ...process.env };

if (process.platform === 'linux' && !process.env.DISPLAY) {
  const DISPLAY = ':99';
  console.log(`Starting Xvfb on display ${DISPLAY} ...`);
  xvfb = spawn('Xvfb', [DISPLAY, '-screen', '0', '1920x1080x24'], { stdio: 'ignore' });
  xvfb.on('error', (e) => { console.error('Xvfb error:', e.message); process.exit(1); });
  env.DISPLAY = DISPLAY;
  await new Promise(r => setTimeout(r, 800));
}

// ── Launch Chrome ────────────────────────────────────────────────────────────
const chromeArgs = [
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${PROFILE_DIR}`,
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--window-size=1920,1080',
  TV_URL,
];

console.log(`Launching Chrome → ${TV_URL}`);
const chrome = spawn(CHROME_BIN, chromeArgs, { env, stdio: 'ignore', detached: false });
chrome.on('error', (e) => { console.error('Chrome error:', e.message); process.exit(1); });
chrome.on('exit', (code) => { console.log(`Chrome exited (${code})`); if (xvfb) xvfb.kill(); process.exit(0); });

process.on('SIGINT',  () => { chrome.kill(); if (xvfb) xvfb.kill(); process.exit(0); });
process.on('SIGTERM', () => { chrome.kill(); if (xvfb) xvfb.kill(); process.exit(0); });

// ── Wait for DevTools ────────────────────────────────────────────────────────
async function waitForDevTools(retries = 30, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`http://localhost:${DEBUG_PORT}/json/list`);
      const targets = await res.json();
      if (targets.length > 0) return targets;
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, delayMs));
    process.stdout.write('.');
  }
  throw new Error('DevTools never became available');
}

process.stdout.write('Waiting for DevTools');
await waitForDevTools();
console.log('\nDevTools ready.');

// ── Find TradingView target ──────────────────────────────────────────────────
let tvTarget = null;
for (let i = 0; i < 30; i++) {
  const fresh = await (await fetch(`http://localhost:${DEBUG_PORT}/json/list`)).json();
  tvTarget = fresh.find(t => t.type === 'page' && t.url.includes('tradingview.com'));
  if (tvTarget) break;
  await new Promise(r => setTimeout(r, 1000));
  process.stdout.write(',');
}

if (!tvTarget) {
  console.error('\nNo TradingView page found.');
} else {
  console.log(`\nTradingView page found: ${tvTarget.id}`);

  // Poll for TradingViewApi
  async function evalOnTarget(id, expression) {
    const ws = new WebSocket(`ws://localhost:${DEBUG_PORT}/devtools/page/${id}`);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = (e) => rej(new Error(e.message)); });
    const value = await new Promise((res, rej) => {
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id === 1) { if (msg.error) rej(new Error(JSON.stringify(msg.error))); else res(msg.result?.result?.value); }
      };
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
    });
    ws.close();
    return value;
  }

  process.stdout.write('Waiting for TradingViewApi');
  let apiReady = false;
  for (let i = 0; i < 60; i++) {
    try {
      if (await evalOnTarget(tvTarget.id, 'typeof TradingViewApi !== "undefined"') === true) {
        apiReady = true; break;
      }
    } catch { /* still loading */ }
    await new Promise(r => setTimeout(r, 2000));
    process.stdout.write('.');
  }

  console.log(apiReady
    ? '\n\nReady! TradingViewApi is available.'
    : '\n\nTradingViewApi not detected — log into TradingView and open a chart, then run your scripts.'
  );
  console.log('\n' + '─'.repeat(50));
  console.log(`  Target: ${tvTarget.id}`);
  console.log('─'.repeat(50));
  console.log('\nKeep this running. Press Ctrl+C to exit.\n');
}

await new Promise(() => {});
