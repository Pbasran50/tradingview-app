"""
Places a single test market order in your IBKR PAPER account via the Broker
wrapper — verifies the full pipeline: AlertPayload -> Broker -> ib_insync -> IBKR.

Run from the ibkr/ folder (with TWS paper trading running and API enabled):
    python test_order.py
"""

import asyncio
from broker import Broker
from models import AlertPayload


async def main():
    alert = AlertPayload(
        symbol="NASDAQ:FLEX",
        action="buy",
        quantity=1,
        order_type="market",
        strategy="manual-test",
        comment="bridge end-to-end test order",
    )

    print(f"Placing test order: BUY {alert.quantity} {alert.symbol} (market)\n")

    async with Broker() as broker:
        trade = await broker.place_order(alert)

        # Wait a few seconds and report status / fill
        for _ in range(10):
            await asyncio.sleep(1)
            print(f"  Status: {trade.orderStatus.status}"
                  f"  Filled: {trade.orderStatus.filled}"
                  f"  Avg fill price: {trade.orderStatus.avgFillPrice}")
            if trade.orderStatus.status in ("Filled", "Cancelled", "Inactive"):
                break

    print("\nDone. Check TWS -> Paper Account -> Trades / Portfolio to confirm.")


if __name__ == "__main__":
    asyncio.run(main())
