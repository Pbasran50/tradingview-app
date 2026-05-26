/**
 * Minimal Chrome DevTools Protocol helper.
 * Auto-discovers the TradingView page target from /json/list.
 */

const DEBUG_PORT = 9222;

export async function getTradingViewTarget() {
  const res = await fetch(`http://localhost:${DEBUG_PORT}/json/list`);
  const targets = await res.json();
  const tv = targets.find(t => t.type === 'page' && t.url.includes('tradingview.com'));
  if (!tv) throw new Error(`No TradingView target found. Available: ${targets.map(t => t.url).join(', ')}`);
  return tv;
}

export function createCDPSession(targetId) {
  const wsUrl = `ws://localhost:${DEBUG_PORT}/devtools/page/${targetId}`;
  let msgId = 1;
  const pending = new Map();
  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  };

  const ready = new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = (e) => rej(new Error(e.message || 'WebSocket error'));
  });

  async function send(method, params = {}) {
    await ready;
    const id = msgId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (pending.has(id)) { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }
      }, 15000);
    });
  }

  async function evaluate(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r?.result?.type === 'undefined') return undefined;
    if (r?.result?.subtype === 'error') throw new Error(r.result.description);
    return r?.result?.value;
  }

  function close() { ws.close(); }

  return { send, evaluate, close };
}
