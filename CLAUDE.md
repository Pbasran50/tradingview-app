# tradingview-app — Claude Code Context

## What this project does

Automates TradingView charts via Chrome DevTools Protocol (CDP), and routes
TradingView alerts through a Python webhook server to execute orders at
Interactive Brokers (IBKR).

## Architecture

```
TradingView Alert
      │
      ▼  (HTTPS webhook)
  FastAPI server  ──────────────────────────────  ibkr/webhook_server.py
      │
      ▼
  Order logic                                     ibkr/broker.py
      │
      ▼  (ib_insync over TCP)
  IBKR TWS / Gateway
```

The TradingView side (Node.js / CDP) and the IBKR side (Python / ib_insync)
are independent — they don't share a process. TradingView fires an alert with
a JSON payload; the webhook server receives it and places the order.

## IBKR connection settings

| Environment | App        | Port |
|-------------|------------|------|
| Paper       | TWS        | 7497 |
| Paper       | Gateway    | 4002 |
| Live        | TWS        | 7496 |
| Live        | Gateway    | 4001 |

Default: **paper trading via Gateway on port 4002**.
Set `IBKR_PORT` env var to override. Set `IBKR_LIVE=1` to switch to live.

## Preferred libraries

- **ib_insync** — primary IBKR API wrapper (async, clean). Always prefer over
  raw `ibapi`.
- **FastAPI + uvicorn** — webhook server
- **pydantic** — alert payload validation

Install: `pip install ib_insync fastapi uvicorn`

## Symbol mapping

TradingView uses `EXCHANGE:TICKER` (e.g. `NASDAQ:FLEX`).
IBKR uses just `TICKER` with `exchange` and `currency` fields on the contract.
The broker module strips the exchange prefix automatically.

## Order conventions

- Default order type: **market order** on open (MOO) for swing trades.
- Use **limit orders** when the alert payload specifies a `limit_price`.
- Always set `outsideRth=False` unless alert specifies `extended_hours: true`.
- Position sizing: size comes from alert payload. Never hard-code share count.

## Pine Script patterns

Located in `pinescripts/`. These are loaded manually via the TradingView
Pine Editor. They detect chart patterns (cup & handle, high tight flag, etc.)
and can fire alerts that the webhook server processes.

## Node.js scripts (TradingView / CDP)

Located in `scripts/`. Run with `npm run <name>`. They connect to Chrome on
`localhost:9222` via CDP. Keep `npm run launch` running first.

## Running the IBKR bridge

```bash
# Paper trading (default)
cd ibkr
python webhook_server.py

# Demo / dry-run (no IBKR connection needed)
python demo.py
```

## Key files

| File | Purpose |
|------|---------|
| `launch-browser.mjs` | Opens Chrome, waits for TradingView API |
| `scripts/setup-flex.mjs` | Full FLEX chart setup via CDP |
| `scripts/add-emas.mjs` | Adds EMA overlays |
| `pinescripts/*.pine` | Pattern detection scripts |
| `ibkr/broker.py` | ib_insync wrapper — connect, place orders, fetch positions |
| `ibkr/webhook_server.py` | FastAPI server receiving TradingView alerts |
| `ibkr/models.py` | Pydantic models for alert payloads |
| `ibkr/demo.py` | Dry-run demo — simulates the full pipeline |
