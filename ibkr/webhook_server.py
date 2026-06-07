"""
FastAPI webhook server — receives TradingView alerts and routes them to IBKR.

Connects to IBKR ONCE at startup (inside the lifespan handler, so it shares
uvicorn's event loop) and reuses that single connection for every alert.
Creating a fresh ib_insync connection per-request causes
"attached to a different loop" RuntimeErrors.

Start:
    python webhook_server.py

TradingView alert URL:
    http://<your-server>:8000/alert

Set a secret via WEBHOOK_SECRET env var to validate requests.
"""

import hmac
import hashlib
import os
import sys
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException, Request, status
from ib_insync import IB

from broker import Broker, IBKR_HOST, IBKR_PORT, IBKR_CLIENT_ID
from models import AlertPayload

# ib_insync's socket connection code requires the Selector event loop;
# uvicorn + the default Proactor loop on Windows causes
# "attached to a different loop" RuntimeErrors.
if sys.platform == "win32":
    import asyncio
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "")  # optional shared secret


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Construct IB() here, not at module level — it must be created while
    # uvicorn's event loop is running, or ib_insync binds it to the wrong
    # loop and every call raises "attached to a different loop".
    ib = IB()
    await ib.connectAsync(IBKR_HOST, IBKR_PORT, clientId=IBKR_CLIENT_ID)
    print(f"Connected to IBKR at {IBKR_HOST}:{IBKR_PORT}  (client {IBKR_CLIENT_ID})")
    app.state.ib = ib
    yield
    ib.disconnect()
    print("Disconnected from IBKR.")


app = FastAPI(title="TradingView -> IBKR Bridge", lifespan=lifespan)


def _verify_signature(body: bytes, sig_header: str) -> bool:
    """Validate HMAC-SHA256 signature from TradingView (optional)."""
    if not WEBHOOK_SECRET:
        return True
    expected = hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig_header or "")


@app.get("/health")
async def health(request: Request):
    return {"status": "ok", "ibkr_connected": request.app.state.ib.isConnected()}


@app.post("/alert", status_code=status.HTTP_200_OK)
async def receive_alert(request: Request, payload: AlertPayload):
    body = await request.body()
    sig = request.headers.get("X-Signature", "")

    if not _verify_signature(body, sig):
        raise HTTPException(status_code=401, detail="Invalid signature")

    print(f"\n[ALERT] {payload.action.upper()} {payload.quantity} {payload.symbol}"
          f"  strategy={payload.strategy}  comment={payload.comment}")

    broker = Broker(request.app.state.ib)  # reuse the shared, already-connected IB instance

    if payload.action == "close":
        await broker.close_position(payload.symbol)
    else:
        await broker.place_order(payload)

    return {"status": "accepted", "symbol": payload.symbol, "action": payload.action}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
