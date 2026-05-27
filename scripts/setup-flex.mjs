/**
 * Full FLEX chart setup via TradingView + Yahoo Finance
 *
 * Sets up:
 *   - Daily candlestick chart
 *   - EMA 8 (blue), 21 (orange), 50 (red), 200 (purple)
 *   - RSI (Relative Strength Index)
 *   - Volume
 *   - Prints: price, open, high, low, change, today's range, 52-week high/low
 *   - Prints: top 5 news headlines
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

console.log('  Symbol: FLEX');
console.log('  Timeframe: Daily');
console.log('  Type: Candlesticks');

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
async function addStudy(name, inputs, overrides, overlay = false) {
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
  return r;
}

console.log('\nAdding indicators...');

// EMAs (overlaid on price)
const emas = [
  { len: 8,   color: '#2196F3', label: 'EMA 8   (blue)'   },
  { len: 21,  color: '#FF9800', label: 'EMA 21  (orange)' },
  { len: 50,  color: '#F44336', label: 'EMA 50  (red)'    },
  { len: 200, color: '#9C27B0', label: 'EMA 200 (purple)' },
];

for (const { len, color, label } of emas) {
  const r = await addStudy(
    'Moving Average Exponential',
    { length: len },
    { 'Plot.color': color, 'Plot.linewidth': len >= 50 ? 3 : 2 },
    true  // overlay on price pane
  );
  console.log(`  ${r.ok ? '✓' : '✗'} ${label}`);
  await new Promise(r => setTimeout(r, 600));
}

// RSI
const rsi = await addStudy('Relative Strength Index', { length: 14 }, {});
console.log(`  ${rsi.ok ? '✓' : '✗'} RSI (14)`);
await new Promise(r => setTimeout(r, 600));

// Volume
const vol = await addStudy('Volume', {}, {}, true);
console.log(`  ${vol.ok ? '✓' : '✗'} Volume`);

// ── 5. Fetch price data from Yahoo Finance (in browser to avoid CORS) ────────
console.log('\nFetching price data...');

const priceData = await cdp.evaluate(`
  (async function() {
    try {
      // 1-day data for current price info
      const r1 = await fetch(
        'https://query1.finance.yahoo.com/v8/finance/chart/FLEX?interval=1d&range=1d',
        { headers: { 'Accept': 'application/json' } }
      );
      const d1 = await r1.json();
      const meta = d1.result?.[0]?.meta ?? d1?.chart?.result?.[0]?.meta ?? {};

      // 1-year data for 52-week high/low
      const r2 = await fetch(
        'https://query1.finance.yahoo.com/v8/finance/chart/FLEX?interval=1d&range=1y',
        { headers: { 'Accept': 'application/json' } }
      );
      const d2 = await r2.json();
      const quotes = d2.chart?.result?.[0]?.indicators?.quote?.[0] ?? {};
      const highs = (quotes.high ?? []).filter(Boolean);
      const lows  = (quotes.low  ?? []).filter(Boolean);

      return JSON.stringify({
        price:     meta.regularMarketPrice,
        open:      meta.regularMarketOpen,
        high:      meta.regularMarketDayHigh,
        low:       meta.regularMarketDayLow,
        prevClose: meta.previousClose ?? meta.chartPreviousClose,
        week52High: Math.max(...highs),
        week52Low:  Math.min(...lows),
        currency:  meta.currency,
        symbol:    meta.symbol,
      });
    } catch(e) {
      return JSON.stringify({ error: e.message });
    }
  })()
`);

// ── 6. Fetch news (in browser) ───────────────────────────────────────────────
const newsData = await cdp.evaluate(`
  (async function() {
    try {
      const r = await fetch(
        'https://query2.finance.yahoo.com/v1/finance/search?q=FLEX&newsCount=5&quotesCount=0',
        { headers: { 'Accept': 'application/json' } }
      );
      const d = await r.json();
      const items = (d.news ?? []).slice(0, 5).map(n => ({
        title:     n.title,
        publisher: n.publisher,
        time:      new Date(n.providerPublishTime * 1000).toLocaleDateString(),
        link:      n.link,
      }));
      return JSON.stringify(items);
    } catch(e) {
      return JSON.stringify({ error: e.message });
    }
  })()
`);

// ── 7. Print summary ─────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(52));

let price;
try { price = JSON.parse(priceData); } catch { price = {}; }

if (price.error) {
  console.log(`  Price data unavailable: ${price.error}`);
} else {
  const change     = (price.price - price.prevClose).toFixed(2);
  const changePct  = (((price.price - price.prevClose) / price.prevClose) * 100).toFixed(2);
  const changeStr  = `${change >= 0 ? '+' : ''}${change} (${changePct >= 0 ? '+' : ''}${changePct}%)`;

  console.log(`  ${price.symbol ?? SYMBOL} — ${price.currency ?? 'USD'}`);
  console.log(`  Price:        $${price.price?.toFixed(2)}`);
  console.log(`  Change:       ${changeStr}`);
  console.log(`  Open:         $${price.open?.toFixed(2)}`);
  console.log(`  Today's Range: $${price.low?.toFixed(2)} – $${price.high?.toFixed(2)}`);
  console.log(`  52-Week Range: $${price.week52Low?.toFixed(2)} – $${price.week52High?.toFixed(2)}`);
}

console.log('═'.repeat(52));

let news;
try { news = JSON.parse(newsData); } catch { news = []; }

if (!Array.isArray(news) || news.length === 0) {
  console.log('\n  No news available.');
} else {
  console.log('\n  TOP NEWS — FLEX\n');
  news.forEach((n, i) => {
    console.log(`  ${i + 1}. ${n.title}`);
    console.log(`     ${n.publisher} · ${n.time}`);
    console.log(`     ${n.link}\n`);
  });
}

console.log('═'.repeat(52));
console.log('\nChart setup complete.');

cdp.close();
