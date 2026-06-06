from pydantic import BaseModel, field_validator
from typing import Literal, Optional


class AlertPayload(BaseModel):
    """
    Schema for TradingView webhook alert JSON.

    Example alert message body (set in TradingView alert dialog):
    {
      "symbol": "NASDAQ:FLEX",
      "action": "buy",
      "quantity": 100,
      "order_type": "market",
      "limit_price": null,
      "extended_hours": false,
      "strategy": "cup-and-handle",
      "comment": "breakout above pivot"
    }
    """

    symbol: str                              # e.g. "NASDAQ:FLEX" or "FLEX"
    action: Literal["buy", "sell", "close"]
    quantity: int
    order_type: Literal["market", "limit"] = "market"
    limit_price: Optional[float] = None
    extended_hours: bool = False
    strategy: Optional[str] = None
    comment: Optional[str] = None

    @field_validator("symbol")
    @classmethod
    def strip_exchange(cls, v: str) -> str:
        # "NASDAQ:FLEX" → "FLEX"
        return v.split(":")[-1].upper()

    @field_validator("quantity")
    @classmethod
    def positive_quantity(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("quantity must be positive")
        return v
