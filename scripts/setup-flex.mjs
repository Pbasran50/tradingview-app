/**
 * Full FLEX chart setup via TradingView + Yahoo Finance
 *
 * Auto-adds to chart:
 *   - Daily candlestick chart
 *   - EMA 8 (blue), 21 (orange), 50 (red), 200 (purple)
 *   - MACD (12/26/9)
 *   - RSI (14)
 *   - Volume
 *   - Pivot Points Standard (support & resistance levels)
 *   - Candlestick Pattern recognition
 *
 * Prints to terminal:
 *   - Live price, open, high, low, change, today's range, 52-week high/low
 *   - Top 5 news headlines
 *   - Reminder to load Pine Script patterns (Cup & Handle etc.)
 *
 * Usage:
 *   npm run setup-flex
 *
 * Requires: npm run launch (keep running in another terminal)
 */

import { getTradingViewTarget, createCDPSession } from './cdp.mjs';

const SYMBOL = 'FLEX';

// ── 1. Connect ───────────────────────────────────────────────────────────────
const target = await getTradingViewTarget();
console.log(`Connected to: ${target.url.slice(0, 80)}\n`);
const cdp = createCDPSession(target.id);
await new Promise(r => setTimeout(r, 500));

// ── 2. Set symbol, daily timeframe, candlestick chart type ───────────────────
console.log(`Setting up ${SYMBOL} — daily candlestick chart...`);

await cdp.evaluate(`TradingViewApi.activeChart().setSymbol('${SYMBOL}', () => {})`);
await new Promise(r => setTimeout(r, 1500));

await cdp.evaluate(`TradingViewApi.activeChart().setResolution('D', () => {})`);
await new Promise(r => setTimeout(r, 500));

// Chart type 1 = Candlesticks
await cdp.evaluate(`TradingViewApi.activeChart().setChartType(1)`);
await new Promise(r => setTimeout(r, 500));

console.log('  Symbol:    FLEX');
console.log('  Timeframe: Daily');
console.log('  Type:      Candlesticks');

// ── 3. Remove existing studies (clean slate) ─────────────────────────────────
const removed = await cdp.evaluate(`(function() {
  try {
    const ac = TradingViewApi.activeChart();
    const studies = ac.getAllStudies();
    studies.forEach(s => ac.removeStudy(s.id));
    return studies.length;
  } catch(e) { return 0; }
})()`);
console.log(`\nCleared ${removed} existing studies.`);
await new Promise(r => setTimeout(r, 500));

// ── 4. Add studies ───────────────────────────────────────────────────────────
async function addStudy(label, name, inputs, overrides, overlay = false) {
  const result = await cdp.evaluate(`
    (async function() {
      try {
        const ac = TradingViewApi.activeChart();
        const id = await ac.createStudy(
          '${name}', ${overlay}, false,
          ${JSON.stringify(inputs)},
          ${JSON.stringify(overrides)}
        );
        return JSON.stringify({ ok: true, id: String(id) });
      } catch(e) { return JSON.stringify({ ok: false, error: e.message }); }
    })()
  `);
  let r;
  try { r = JSON.parse(result); } catch { r = { raw: result }; }
  console.log(`  ${r.ok ? '✓' : '✗'} ${label}${r.ok ? '' : '  ← ' + (r.error ?? r.raw ?? '')}`);
  await new Promise(r => setTimeout(r, 700));
  return r;
}

console.log('\nAdding indicators...');

// ── EMAs (price pane overlay) ────────────────────────────────────────────────
await addStudy('EMA 8   (blue)',   'Moving Average Exponential', { length: 8   }, { 'Plot.color': '#2196F3', 'Plot.linewidth': 2 }, true);
await addStudy('EMA 21  (orange)', 'Moving Average Exponential', { length: 21  }, { 'Plot.color': '#FF9800', 'Plot.linewidth': 2 }, true);
await addStudy('EMA 50  (red)',    'Moving Average Exponential', { length: 50  }, { 'Plot.color': '#F44336', 'Plot.linewidth': 3 }, true);
await addStudy('EMA 200 (purple)', 'Moving Average Exponential', { length: 200 }, { 'Plot.color': '#9C27B0', 'Plot.linewidth': 3 }, true);

// ── Pivot Points — auto support & resistance levels ──────────────────────────
await addStudy('Pivot Points (S&R)', 'Pivot Points Standard', {}, {}, true);

// ── Candlestick Pattern Recognition ─────────────────────────────────────────
await addStudy('Candlestick Patterns', 'Candlestick Patterns', {}, {}, true);

// ── MACD (separate pane) ─────────────────────────────────────────────────────
await addStudy('MACD (12/26/9)', 'MACD', { fast_length: 12, slow_length: 26, signal_smoothing: 9 }, {});

// ── RSI (separate pane) ──────────────────────────────────────────────────────
await addStudy('RSI (14)', 'Relative Strength Index', { length: 14 }, {});

// ── Volume (price pane overlay) ──────────────────────────────────────────────
await addStudy('Volume', 'Volume', {}, {}, true);

// ── 5. Fetch price data from Yahoo Finance (runs inside browser) ─────────────
console.log('\nFetching price data...');

const priceData = await cdp.evaluate(`
  (async function() {
    try {
      const r1 = await fetch(
        'https://query1.finance.yahoo.com/v8/finance/chart/FLEX?interval=1d&range=1d',
        { headers: { 'Accept': 'application/json' } }
      );
      const d1 = await r1.json();
      const meta = d1?.chart?.result?.[0]?.meta ?? d1.result?.[0]?.meta ?? {};

      const r2 = await fetch(
        'https://query1.finance.yahoo.com/v8/finance/chart/FLEX?interval=1d&range=1y',
        { headers: { 'Accept': 'application/json' } }
      );
      const d2 = await r2.json();
      const quotes = d2.chart?.result?.[0]?.indicators?.quote?.[0] ?? {};
      const highs = (quotes.high ?? []).filter(Boolean);
      const lows  = (quotes.low  ?? []).filter(Boolean);

      return JSON.stringify({
        price:      meta.regularMarketPrice,
        open:       meta.regularMarketOpen,
        high:       meta.regularMarketDayHigh,
        low:        meta.regularMarketDayLow,
        prevClose:  meta.previousClose ?? meta.chartPreviousClose,
        week52High: highs.length ? Math.max(...highs) : null,
        week52Low:  lows.length  ? Math.min(...lows)  : null,
        currency:   meta.currency,
        symbol:     meta.symbol,
      });
    } catch(e) {
      return JSON.stringify({ error: e.message });
    }
  })()
`);

// ── 6. Fetch news (runs inside browser) ──────────────────────────────────────
const newsData = await cdp.evaluate(`
  (async function() {
    try {
      const r = await fetch(
        'https://query2.finance.yahoo.com/v1/finance/search?q=FLEX&newsCount=5&quotesCount=0',
        { headers: { 'Accept': 'application/json' } }
      );
      const d = await r.json();
      return JSON.stringify(
        (d.news ?? []).slice(0, 5).map(n => ({
          title:     n.title,
          publisher: n.publisher,
          time:      new Date(n.providerPublishTime * 1000).toLocaleDateString(),
          link:      n.link,
        }))
      );
    } catch(e) {
      return JSON.stringify({ error: e.message });
    }
  })()
`);

// ── 7. Print price summary ───────────────────────────────────────────────────
console.log('\n' + '═'.repeat(54));

let price;
try { price = JSON.parse(priceData); } catch { price = {}; }

if (price.error) {
  console.log(`  Price data unavailable: ${price.error}`);
} else {
  const chg    = (price.price - price.prevClose).toFixed(2);
  const chgPct = (((price.price - price.prevClose) / price.prevClose) * 100).toFixed(2);
  const arrow  = chg >= 0 ? '▲' : '▼';
  console.log(`  ${price.symbol ?? SYMBOL}                         ${price.currency ?? 'USD'}`);
  console.log(`  Price:          $${price.price?.toFixed(2)}  ${arrow} ${chg >= 0 ? '+' : ''}${chg} (${chgPct >= 0 ? '+' : ''}${chgPct}%)`);
  console.log(`  Open:           $${price.open?.toFixed(2)}`);
  console.log(`  Today's Range:  $${price.low?.toFixed(2)} – $${price.high?.toFixed(2)}`);
  console.log(`  52-Week Range:  $${price.week52Low?.toFixed(2)} – $${price.week52High?.toFixed(2)}`);
}

// ── 8. Print news ────────────────────────────────────────────────────────────
console.log('═'.repeat(54));

let news;
try { news = JSON.parse(newsData); } catch { news = []; }

if (Array.isArray(news) && news.length > 0) {
  console.log('\n  TOP NEWS — FLEX\n');
  news.forEach((n, i) => {
    console.log(`  ${i + 1}. ${n.title}`);
    console.log(`     ${n.publisher} · ${n.time}`);
    console.log(`     ${n.link}\n`);
  });
}

// ── 9. Pattern reminder ──────────────────────────────────────────────────────
console.log('═'.repeat(54));
console.log(`
  PATTERN SCRIPTS (paste into TradingView Pine Editor):
  pinescripts/
    cup-and-handle.pine      — Cup & Handle breakout detector
    high-tight-flag.pine     — High Tight Flag detector
    mini-coil.pine           — Mini Coil / tight consolidation
    trendline-touches.pine   — 3-Touch Trendline highlighter

  How to load: TradingView → Pine Editor (bottom) → Open file
  → paste contents → Add to chart
`);
console.log('═'.repeat(54));
console.log('\nChart setup complete.\n');

cdp.close();
