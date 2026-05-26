// Auto-discover the TradingView target instead of using a hardcoded ID
const targets = await (await fetch('http://localhost:9222/json/list')).json();
const tv = targets.find(t => t.type === 'page' && t.url.includes('tradingview.com'));
if (!tv) { console.error('No TradingView page found. Run: npm run launch'); process.exit(1); }

const CHART_TARGET = tv.id;
const WS_URL = `ws://localhost:9222/devtools/page/${CHART_TARGET}`;
console.log(`Connecting to target: ${CHART_TARGET}`);

let msgId = 1;
const pending = new Map();
const ws = new WebSocket(WS_URL);

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
};

function sendCmd(method, params = {}) {
  const id = msgId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(`timeout: ${method}`)); } }, 20000);
  });
}

async function evalJS(expression) {
  const result = await sendCmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return result?.result;
}

await new Promise((res, rej) => { ws.onopen = res; ws.onerror = (e) => rej(new Error(e.message || 'ws error')); });
console.log('Connected — adding EMAs to chart');

// Check current symbol
const sym = await evalJS(`(function() {
  const ac = TradingViewApi.activeChart();
  return ac ? (ac.symbol() || 'unknown') : 'no-ac';
})()`);
console.log('Current symbol:', JSON.stringify(sym));

// Add EMA 8 (blue)
const ema8 = await evalJS(`(function() {
  try {
    const ac = TradingViewApi.activeChart();
    const id = ac.createStudy('Moving Average Exponential', false, false, { length: 8 }, { 'Plot.color': '#2196F3', 'Plot.linewidth': 2 });
    return JSON.stringify({ success: true, id: String(id) });
  } catch(e) { return JSON.stringify({ error: e.message }); }
})()`);
console.log('EMA 8:', ema8.value || JSON.stringify(ema8));

await new Promise(r => setTimeout(r, 1000));

// Add EMA 21 (orange)
const ema21 = await evalJS(`(function() {
  try {
    const ac = TradingViewApi.activeChart();
    const id = ac.createStudy('Moving Average Exponential', false, false, { length: 21 }, { 'Plot.color': '#FF9800', 'Plot.linewidth': 2 });
    return JSON.stringify({ success: true, id: String(id) });
  } catch(e) { return JSON.stringify({ error: e.message }); }
})()`);
console.log('EMA 21:', ema21.value || JSON.stringify(ema21));

await new Promise(r => setTimeout(r, 1000));

// Add EMA 50 (red)
const ema50 = await evalJS(`(function() {
  try {
    const ac = TradingViewApi.activeChart();
    const id = ac.createStudy('Moving Average Exponential', false, false, { length: 50 }, { 'Plot.color': '#F44336', 'Plot.linewidth': 2 });
    return JSON.stringify({ success: true, id: String(id) });
  } catch(e) { return JSON.stringify({ error: e.message }); }
})()`);
console.log('EMA 50:', ema50.value || JSON.stringify(ema50));

// Set symbol to FLEX
const setFlex = await evalJS(`(function() {
  try {
    const ac = TradingViewApi.activeChart();
    ac.setSymbol('FLEX', function() { console.log('Symbol set to FLEX'); });
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ error: e.message }); }
})()`);
console.log('Set FLEX:', setFlex.value || JSON.stringify(setFlex));

ws.close();
console.log('Done.');
