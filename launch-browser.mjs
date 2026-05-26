/**
 * Launches Chromium with remote debugging on port 9222 and opens TradingView.
 * Waits until TradingViewApi is available on the page, then prints the target ID.
 *
 * Usage:
 *   npm run launch                        # opens default chart
 *   node launch-browser.mjs [chart-url]   # opens a specific TradingView chart URL
 *
 * The process stays alive (keeping the browser open) until you Ctrl+C it.
 * Other scripts (e.g. scripts/add-emas.mjs) connect to the same port while
 * this process is running.
 */

import { spawn, execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DEBUG_PORT = 9222;
const CHROME_BIN = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PROFILE_DIR = join(import.meta.dirname, '.chrome-profile');
const TV_URL = process.argv[2] || 'https://www.tradingview.com/chart/';

if (!existsSync(PROFILE_DIR)) mkdirSync(PROFILE_DIR, { recursive: true });

// ── 1. Start Xvfb on a free display ─────────────────────────────────────────
const DISPLAY = ':99';
console.log(`Starting Xvfb on display ${DISPLAY} ...`);
const xvfb = spawn('Xvfb', [DISPLAY, '-screen', '0', '1920x1080x24'], {
  stdio: 'ignore',
  detached: false,
});
xvfb.on('error', (e) => { console.error('Xvfb error:', e.message); process.exit(1); });
await new Promise(r => setTimeout(r, 800)); // give Xvfb a moment to start

// ── 2. Launch Chromium ───────────────────────────────────────────────────────
const chromeArgs = [
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${PROFILE_DIR}`,
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--ignore-certificate-errors',
  '--ignore-certificate-errors-spki-list',
  '--allow-running-insecure-content',
  '--disable-web-security',
  '--window-size=1920,1080',
  TV_URL,
];

console.log(`Launching Chromium → ${TV_URL}`);
const chrome = spawn(CHROME_BIN, chromeArgs, {
  env: { ...process.env, DISPLAY },
  stdio: 'ignore',
  detached: false,
});
chrome.on('error', (e) => { console.error('Chrome error:', e.message); process.exit(1); });
chrome.on('exit', (code) => { console.log(`Chrome exited (${code})`); xvfb.kill(); process.exit(0); });

process.on('SIGINT', () => { chrome.kill(); xvfb.kill(); process.exit(0); });
process.on('SIGTERM', () => { chrome.kill(); xvfb.kill(); process.exit(0); });

// ── 3. Wait for DevTools to be ready ────────────────────────────────────────
async function fetchJSON(url) {
  const res = await fetch(url);
  return res.json();
}

async function waitForDevTools(retries = 30, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const targets = await fetchJSON(`http://localhost:${DEBUG_PORT}/json/list`);
      if (targets.length > 0) return targets;
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, delayMs));
    process.stdout.write('.');
  }
  throw new Error('DevTools never became available');
}

process.stdout.write('Waiting for DevTools');
const targets = await waitForDevTools();
console.log('\nDevTools ready.');

// ── 4. Find the TradingView page target ─────────────────────────────────────
function getTVTarget(targets) {
  return targets.find(t => t.type === 'page' && t.url.includes('tradingview.com'));
}

// ── 5. Poll until TradingViewApi is present ──────────────────────────────────
async function evalOnTarget(targetId, expression) {
  const wsUrl = `ws://localhost:${DEBUG_PORT}/devtools/page/${targetId}`;
  // Use Node's native WebSocket (Node 22+)
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = (e) => rej(new Error(e.message || 'ws error'));
  });

  let id = 1;
  const result = await new Promise((res, rej) => {
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === 1) {
        if (msg.error) rej(new Error(JSON.stringify(msg.error)));
        else res(msg.result?.result?.value);
      }
    };
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
  });
  ws.close();
  return result;
}

async function waitForTradingViewApi(targetId, retries = 60, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const ready = await evalOnTarget(targetId, 'typeof TradingViewApi !== "undefined"');
      if (ready === true) return true;
    } catch {
      // page still loading
    }
    await new Promise(r => setTimeout(r, delayMs));
    process.stdout.write('.');
  }
  return false;
}

// Poll targets — the TradingView page may not appear immediately
let tvTarget = null;
for (let i = 0; i < 30; i++) {
  const fresh = await fetchJSON(`http://localhost:${DEBUG_PORT}/json/list`);
  tvTarget = getTVTarget(fresh);
  if (tvTarget) break;
  await new Promise(r => setTimeout(r, 1000));
  process.stdout.write(',');
}
if (!tvTarget) {
  console.error('\nNo TradingView page found in targets. Open tradingview.com manually in the browser.');
  console.log('Available targets:', (await fetchJSON(`http://localhost:${DEBUG_PORT}/json/list`)).map(t => t.url));
} else {
  console.log(`\nTradingView page found: ${tvTarget.id}`);
  console.log(`  URL: ${tvTarget.url}`);
  process.stdout.write('Waiting for TradingViewApi');
  const apiReady = await waitForTradingViewApi(tvTarget.id);
  if (apiReady) {
    console.log('\n\nReady! TradingViewApi is available.');
  } else {
    console.log('\n\nTradingViewApi not detected yet — the chart may need a login or more time to load.');
  }
  console.log('\n─────────────────────────────────────────────────');
  console.log(`  CHART_TARGET = '${tvTarget.id}'`);
  console.log(`  WS_URL       = ws://localhost:${DEBUG_PORT}/devtools/page/${tvTarget.id}`);
  console.log('─────────────────────────────────────────────────');
  console.log('\nBrowser is running. Press Ctrl+C to exit.\n');
}

// Keep process alive
await new Promise(() => {});
