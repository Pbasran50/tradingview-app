/**
 * Takes a screenshot of the active TradingView chart and saves it to the desktop.
 *
 * Usage:
 *   npm run screenshot
 *   node scripts/screenshot.mjs [output-filename]
 *
 * Requires: npm run launch (keep running in another terminal)
 */

import { writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { getTradingViewTarget, createCDPSession } from './cdp.mjs';

// Default save location: Desktop (works on Windows, Mac, Linux)
const filename = process.argv[2] || `tradingview-${Date.now()}.png`;
const outPath = join(homedir(), 'Desktop', filename);

const target = await getTradingViewTarget();
console.log(`Connected to: ${target.url.slice(0, 80)}`);

const cdp = createCDPSession(target.id);
await new Promise(r => setTimeout(r, 500));

// Get current symbol for context
const sym = await cdp.evaluate(`TradingViewApi.activeChart().symbol()`);
console.log(`Symbol: ${sym}`);

// Take screenshot via CDP
const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', quality: 100 });

writeFileSync(outPath, Buffer.from(data, 'base64'));
console.log(`Screenshot saved: ${outPath}`);

cdp.close();
