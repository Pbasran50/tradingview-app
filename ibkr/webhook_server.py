"""
FastAPI webhook server — receives TradingView alerts and routes them to IBKR.

Start:
    python webhook_server.py

TradingView alert URL:
    http://<your-server>:8000/alert

Set a secret via WEBHOOK_SECRET env var to validate requests.
"""

import asyncio
import hmac
import hashlib
import os
import sys

# ib_insync's socket connection code requires the Selector event loop;
# uvicorn + the default Proactor loop on Windows causes
# "attached to a different loop" RuntimeErrors.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException, Request, status
from broker import Broker
from models import AlertPayload


WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "")  # optional shared secret


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="TradingView → IBKR Bridge", lifespan=lifespan)


def _verify_signature(body: bytes, sig_header: str) -> bool:
    """Validate HMAC-SHA256 signature from TradingView (optional)."""
    if not WEBHOOK_SECRET:
        return True
    expected = hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig_header or "")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/alert", status_code=status.HTTP_200_OK)
async def receive_alert(request: Request, payload: AlertPayload):
    body = await request.body()
    sig = request.headers.get("X-Signature", "")

    if not _verify_signature(body, sig):
        raise HTTPException(status_code=401, detail="Invalid signature")

    print(f"\n[ALERT] {payload.action.upper()} {payload.quantity} {payload.symbol}"
          f"  strategy={payload.strategy}  comment={payload.comment}")

    if payload.action == "close":
        async with Broker() as broker:
            trade = await broker.close_position(payload.symbol)
    else:
        async with Broker() as broker:
            trade = await broker.place_order(payload)

    return {"status": "accepted", "symbol": payload.symbol, "action": payload.action}


if __name__ == "__main__":
    uvicorn.run("webhook_server:app", host="0.0.0.0", port=8000, reload=False)
