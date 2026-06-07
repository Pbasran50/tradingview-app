"""
IBKR broker wrapper built on ib_insync.

Usage:
    from broker import Broker
    async with Broker() as b:
        trade = await b.place_order(alert)
        positions = await b.get_positions()
"""

import asyncio
import os
from typing import Optional

from ib_insync import IB, Stock, MarketOrder, LimitOrder, Trade, Position
from models import AlertPayload


IBKR_HOST = os.getenv("IBKR_HOST", "127.0.0.1")
IBKR_PORT = int(os.getenv("IBKR_PORT", "4002"))  # 4002 = paper Gateway
IBKR_CLIENT_ID = int(os.getenv("IBKR_CLIENT_ID", "1"))


class Broker:
    def __init__(self):
        self.ib = IB()

    async def __aenter__(self):
        await self.connect()
        return self

    async def __aexit__(self, *_):
        self.disconnect()

    async def connect(self):
        await self.ib.connectAsync(IBKR_HOST, IBKR_PORT, clientId=IBKR_CLIENT_ID)
        print(f"Connected to IBKR at {IBKR_HOST}:{IBKR_PORT}  (client {IBKR_CLIENT_ID})")

    def disconnect(self):
        self.ib.disconnect()
        print("Disconnected from IBKR.")

    def _make_contract(self, symbol: str, exchange: str = "SMART", currency: str = "USD"):
        return Stock(symbol, exchange, currency)

    async def place_order(self, alert: AlertPayload) -> Trade:
        contract = self._make_contract(alert.symbol)
        await self.ib.qualifyContractsAsync(contract)

        action = "BUY" if alert.action == "buy" else "SELL"
        qty = alert.quantity

        if alert.order_type == "limit" and alert.limit_price:
            order = LimitOrder(action, qty, alert.limit_price, outsideRth=alert.extended_hours)
        else:
            order = MarketOrder(action, qty, outsideRth=alert.extended_hours)

        trade = self.ib.placeOrder(contract, order)
        print(f"Order placed -> {action} {qty} {alert.symbol}  [{alert.order_type}]  strategy={alert.strategy}")
        return trade

    async def close_position(self, symbol: str) -> Optional[Trade]:
        positions = self.ib.positions()
        for pos in positions:
            if pos.contract.symbol == symbol:
                action = "SELL" if pos.position > 0 else "BUY"
                qty = abs(int(pos.position))
                order = MarketOrder(action, qty)
                trade = self.ib.placeOrder(pos.contract, order)
                print(f"Closing position -> {action} {qty} {symbol}")
                return trade
        print(f"No open position found for {symbol}")
        return None

    async def get_positions(self) -> list[Position]:
        return self.ib.positions()

    async def get_account_summary(self) -> dict:
        vals = await self.ib.accountSummaryAsync()
        return {v.tag: v.value for v in vals}
