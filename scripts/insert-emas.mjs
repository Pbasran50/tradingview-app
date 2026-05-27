/**
 * Adds EMA 8 (blue), 21 (orange), 50 (red) to the active TradingView chart
 * and switches the symbol to FLEX.
 *
 * Usage:
 *   npm run insert-emas
 *
 * Requires: npm run launch (keep running in another terminal)
 */

import { getTradingViewTarget, createCDPSession } from './cdp.mjs';

const target = await getTradingViewTarget();
console.log(`Connected to: ${target.url.slice(0, 80)}`);

const cdp = createCDPSession(target.id);
await new Promise(r => setTimeout(r, 500));

// Check current symbol
const sym = await cdp.evaluate(`TradingViewApi.activeChart().symbol()`);
console.log('Current symbol:', sym);

// createStudy returns a Promise — use awaitPromise via async IIFE
async function addEMA(length, color) {
  const result = await cdp.evaluate(`
    (async function() {
      try {
        const ac = TradingViewApi.activeChart();
        const id = await ac.createStudy(
          'Moving Average Exponential', false, false,
          { length: ${length} },
          { 'Plot.color': '${color}', 'Plot.linewidth': 2 }
        );
        return JSON.stringify({ success: true, id: String(id) });
      } catch(e) { return JSON.stringify({ error: e.message }); }
    })()
  `);
  let r;
  try { r = JSON.parse(result); } catch { r = { raw: result }; }
  if (r.success) console.log(`  EMA(${length}) added — id: ${r.id}`);
  else console.error(`  EMA(${length}) failed:`, r.error || r);
  return r;
}

console.log('\nAdding EMAs...');
await addEMA(8,  '#2196F3');  // blue
await new Promise(r => setTimeout(r, 800));
await addEMA(21, '#FF9800');  // orange
await new Promise(r => setTimeout(r, 800));
await addEMA(50, '#F44336');  // red

// Switch symbol to FLEX
const setFlex = await cdp.evaluate(`
  (function() {
    try {
      TradingViewApi.activeChart().setSymbol('FLEX', () => {});
      return JSON.stringify({ success: true });
    } catch(e) { return JSON.stringify({ error: e.message }); }
  })()
`);
const flex = JSON.parse(setFlex);
if (flex.success) console.log('\nSymbol set to FLEX');
else console.error('\nsetSymbol failed:', flex.error);

cdp.close();
console.log('Done.');
