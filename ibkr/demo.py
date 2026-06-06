"""
Dry-run demo of the TradingView → IBKR pipeline.

Simulates the full flow:
  1. TradingView fires an alert (JSON payload)
  2. Webhook server parses and validates it
  3. Broker module would connect to IBKR and place the order

No real IBKR connection is needed — broker calls are mocked.

Run:
    python demo.py
"""

import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from models import AlertPayload


# ── Mock objects (stand-ins for ib_insync types) ─────────────────────────────

@dataclass
class MockContract:
    symbol: str
    exchange: str = "SMART"
    currency: str = "USD"
    secType: str = "STK"
    conId: int = 999001

@dataclass
class MockOrder:
    action: str
    totalQuantity: int
    orderType: str
    lmtPrice: Optional[float] = None
    outsideRth: bool = False
    orderId: int = field(default_factory=lambda: MockOrder._next_id())
    _counter: int = 1000

    @staticmethod
    def _next_id():
        MockOrder._counter += 1
        return MockOrder._counter

@dataclass
class MockTrade:
    contract: MockContract
    order: MockOrder
    orderStatus: str = "Submitted"
    fills: list = field(default_factory=list)


# ── Mock Broker ───────────────────────────────────────────────────────────────

class MockBroker:
    """Simulates ib_insync Broker without a real TWS/Gateway connection."""

    def __init__(self, host="127.0.0.1", port=4002):
        self.host = host
        self.port = port
        self._positions = {
            "AAPL": {"qty": 50,  "avg_cost": 178.40, "market_price": 185.20},
            "MSFT": {"qty": 30,  "avg_cost": 415.00, "market_price": 423.50},
        }

    async def __aenter__(self):
        _print_step("CONNECT", f"Connecting to IBKR paper Gateway at {self.host}:{self.port} ...")
        _print_step("CONNECT", "Connected. Account: DU1234567  (paper)")
        return self

    async def __aexit__(self, *_):
        _print_step("DISCONNECT", "Disconnected from IBKR.")

    async def place_order(self, alert: AlertPayload) -> MockTrade:
        contract = MockContract(symbol=alert.symbol)
        action = "BUY" if alert.action == "buy" else "SELL"

        if alert.order_type == "limit" and alert.limit_price:
            order = MockOrder(
                action=action,
                totalQuantity=alert.quantity,
                orderType="LMT",
                lmtPrice=alert.limit_price,
                outsideRth=alert.extended_hours,
            )
            order_desc = f"LIMIT @ ${alert.limit_price:.2f}"
        else:
            order = MockOrder(action=action, totalQuantity=alert.quantity, orderType="MKT")
            order_desc = "MARKET"

        trade = MockTrade(contract=contract, order=order)

        _print_step("ORDER", f"{'':2}{action} {alert.quantity} {alert.symbol}  [{order_desc}]")
        _print_step("ORDER", f"{'':2}Order ID: {order.orderId}  Strategy: {alert.strategy or 'manual'}")
        _print_step("ORDER", f"{'':2}Status: Submitted → Filled (simulated)")

        return trade

    async def get_positions(self) -> list[dict]:
        return [
            {"symbol": sym, **data}
            for sym, data in self._positions.items()
        ]

    async def get_account_summary(self) -> dict:
        return {
            "NetLiquidation": "152_430.00",
            "AvailableFunds":  "89_210.50",
            "UnrealizedPnL":   "2_840.00",
            "RealizedPnL":     "1_150.00",
            "Currency":        "USD",
        }


# ── Helpers ───────────────────────────────────────────────────────────────────

_COL_WIDTH = 60

def _divider(char="─"):
    print(char * _COL_WIDTH)

def _print_step(tag: str, msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"  [{ts}] [{tag:<10}] {msg}")

def _section(title: str):
    print()
    _divider("═")
    print(f"  {title}")
    _divider("═")


# ── Demo scenarios ────────────────────────────────────────────────────────────

SAMPLE_ALERTS = [
    {
        "symbol": "NASDAQ:FLEX",
        "action": "buy",
        "quantity": 200,
        "order_type": "market",
        "strategy": "cup-and-handle",
        "comment": "breakout above weekly pivot",
    },
    {
        "symbol": "NYSE:AAPL",
        "action": "buy",
        "quantity": 50,
        "order_type": "limit",
        "limit_price": 183.50,
        "strategy": "high-tight-flag",
        "comment": "flag breakout, limit at HOD",
    },
    {
        "symbol": "NASDAQ:MSFT",
        "action": "sell",
        "quantity": 30,
        "order_type": "market",
        "strategy": "trendline-break",
        "comment": "broke below 21 EMA",
    },
]


async def run_demo():
    print()
    _divider("═")
    print("  TradingView → IBKR Bridge  ·  DRY-RUN DEMO")
    print("  (no real connection — all orders are simulated)")
    _divider("═")

    # ── Step 1: Show the alert pipeline ──────────────────────────────────────
    _section("STEP 1 — TradingView fires alerts (3 scenarios)")

    for i, raw in enumerate(SAMPLE_ALERTS, 1):
        print(f"\n  Alert #{i} (raw JSON from TradingView):")
        print("  " + json.dumps(raw, indent=4).replace("\n", "\n  "))

        alert = AlertPayload(**raw)
        print(f"\n  → Parsed & validated:")
        _print_step("VALIDATE", f"symbol={alert.symbol}  action={alert.action}  qty={alert.quantity}")
        _print_step("VALIDATE", f"order_type={alert.order_type}  limit={alert.limit_price}  ext_hrs={alert.extended_hours}")

        async with MockBroker() as broker:
            await broker.place_order(alert)

        _divider()

    # ── Step 2: Show current portfolio ───────────────────────────────────────
    _section("STEP 2 — Portfolio snapshot (before new orders settle)")

    async with MockBroker() as broker:
        positions = await broker.get_positions()
        account = await broker.get_account_summary()

    print()
    print(f"  {'SYMBOL':<8} {'QTY':>6} {'AVG COST':>10} {'MKT PRICE':>10} {'UNREAL P&L':>12}")
    _divider()
    for pos in positions:
        pnl = (pos["market_price"] - pos["avg_cost"]) * pos["qty"]
        print(f"  {pos['symbol']:<8} {pos['qty']:>6} "
              f"  ${pos['avg_cost']:>8.2f}   ${pos['market_price']:>8.2f}  "
              f"  ${pnl:>+9.2f}")

    _divider()
    print(f"\n  {'Net Liquidation:':<22} ${float(account['NetLiquidation'].replace('_','')):.2f}")
    print(f"  {'Available Funds:':<22} ${float(account['AvailableFunds'].replace('_','')):.2f}")
    print(f"  {'Unrealized P&L:':<22} ${float(account['UnrealizedPnL'].replace('_','')):.2f}")

    # ── Step 3: Show how Pine Script fires the alert ──────────────────────────
    _section("STEP 3 — How Pine Script → Alert → Webhook works")

    pine_snippet = '''
  // In your Pine Script, after pattern detection:
  if cup_and_handle_breakout
      alert(
          '{"symbol":"' + syminfo.ticker + '",'
          + '"action":"buy",'
          + '"quantity":200,'
          + '"order_type":"market",'
          + '"strategy":"cup-and-handle"}',
          alert.freq_once_per_bar_close
      )
'''
    print(pine_snippet)
    _print_step("INFO", "TradingView alert fires → POST https://yourserver:8000/alert")
    _print_step("INFO", "Webhook server validates payload → Broker.place_order()")
    _print_step("INFO", "ib_insync sends order to IBKR Gateway → confirmation logged")

    # ── Done ─────────────────────────────────────────────────────────────────
    _section("DEMO COMPLETE")
    print("""
  To use for real:
    1. Install deps:  pip install ib_insync fastapi uvicorn
    2. Start IBKR paper Gateway (port 4002) and enable API access
    3. Run:           python ibkr/webhook_server.py
    4. In TradingView: set alert webhook URL → http://yourserver:8000/alert
    5. Pine Script pattern fires → order placed automatically

  Key files:
    ibkr/models.py          — alert payload schema
    ibkr/broker.py          — ib_insync wrapper
    ibkr/webhook_server.py  — FastAPI server
    CLAUDE.md               — full architecture reference
""")
    _divider("═")


if __name__ == "__main__":
    import asyncio
    asyncio.run(run_demo())
