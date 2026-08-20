/**
 * Prints the current price and the value of every moving average on the
 * active chart (EMA 8/21/50/200, SMA 50/200, etc.), with the % distance
 * from the current price — so you can quickly see which level a stock is
 * approaching and set an alert there.
 *
 * Usage:
 *   npm run levels             # flags levels within 2% of price
 *   node scripts/levels.mjs 3  # flags levels within 3% of price
 *
 * Requires: npm run launch (chart open) and studies already on the chart
 * (e.g. via `npm run setup-flex` or `npm run insert-emas`).
 */

import { getTradingViewTarget, createCDPSession } from './cdp.mjs';

const NEAR_PCT = Number(process.argv[2]) || 2;

const target = await getTradingViewTarget();
console.log(`Connected to: ${target.url.slice(0, 80)}`);

const cdp = createCDPSession(target.id);
await new Promise(r => setTimeout(r, 300));

// exportData() is the TradingView charting-library API for pulling bar +
// study values out of the chart (same data the "Export chart data" button
// uses). It resolves study columns via `schema`; we match those back to
// study names from getAllStudies() by id so the printed labels are readable.
const raw = await cdp.evaluate(`
  (async function() {
    try {
      const ac = TradingViewApi.activeChart();
      if (typeof ac.exportData !== 'function') {
        return JSON.stringify({ ok: false, error: 'exportData() is not available on this chart API.' });
      }
      const studies = ac.getAllStudies();
      const exported = await ac.exportData({ includeSeries: true, includeTime: true });
      return JSON.stringify({ ok: true, symbol: ac.symbol(), studies, exported });
    } catch (e) {
      return JSON.stringify({ ok: false, error: e.message });
    }
  })()
`);

let result;
try { result = JSON.parse(raw); } catch { result = { ok: false, error: 'Could not parse chart response.' }; }

if (!result.ok) {
  console.error(`\nCould not read study values: ${result.error}`);
  console.error('Fallback: open the "Data Window" on tradingview.com (right-click chart → Data Window, or Alt+D) to see live indicator values.');
  cdp.close();
  process.exit(1);
}

const { symbol, studies = [], exported } = result;
const { data, schema } = exported ?? {};

if (!Array.isArray(data) || data.length === 0) {
  console.error('\nNo bar data returned. Make sure the chart has finished loading and has indicators added (npm run setup-flex).');
  cdp.close();
  process.exit(1);
}

const lastRow = data[data.length - 1];

// Best-effort column labeling from the exportData schema. TradingView's
// exact schema shape isn't guaranteed across versions, so if we can't
// confidently label a column we fall back to dumping the raw row below
// rather than printing a wrong number.
const columns = [];
try {
  const seriesKeys = schema?.series?.keys ?? ['time', 'open', 'high', 'low', 'close', 'volume'];
  seriesKeys.forEach((key, i) => { columns[i] = key; });

  if (schema?.studies) {
    Object.entries(schema.studies).forEach(([studyId, meta]) => {
      const study = studies.find(s => String(s.id) === String(studyId));
      const label = study?.name ?? meta?.title ?? studyId;
      (meta?.keys ?? []).forEach((k) => {
        if (typeof k.offset === 'number') {
          columns[k.offset] = (meta.keys.length > 1 && k.title) ? `${label} (${k.title})` : label;
        }
      });
    });
  }
} catch { /* best effort only — falls through to raw dump if columns stay empty */ }

console.log(`\n${symbol ?? ''} — current levels`);
console.log('─'.repeat(54));

const closeIdx = columns.indexOf('close');
const price = closeIdx >= 0 ? Number(lastRow[closeIdx]) : undefined;

if (typeof price === 'number' && !Number.isNaN(price)) {
  console.log(`  Price:  $${price.toFixed(2)}\n`);
}

const skip = new Set(['time', 'open', 'high', 'low', 'close', 'volume']);
let printedAny = false;

lastRow.forEach((value, i) => {
  const label = columns[i];
  if (!label || skip.has(label) || typeof value !== 'number' || Number.isNaN(value)) return;
  printedAny = true;

  if (typeof price === 'number' && price > 0) {
    const pct = ((price - value) / price) * 100;
    const near = Math.abs(pct) <= NEAR_PCT;
    const flag = near
      ? `  🎯 within ${NEAR_PCT}% (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`
      : `  (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% away)`;
    console.log(`  ${label.padEnd(24)} $${value.toFixed(2)}${flag}`);
  } else {
    console.log(`  ${label.padEnd(24)} $${value.toFixed(2)}`);
  }
});

if (!printedAny) {
  console.log('Could not auto-label the study columns. Raw data for reference:');
  console.log(JSON.stringify({ schema, lastRow }, null, 2));
}

console.log('\n' + '─'.repeat(54));
console.log(`Tip: right-click any 🎯 level on the chart → "Add Alert" to get notified when price reaches it.`);

cdp.close();
