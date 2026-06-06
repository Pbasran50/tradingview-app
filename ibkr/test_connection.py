"""
Quick connection test for IBKR TWS / Gateway.

Run from the repo root or ibkr/ folder:
    python ibkr/test_connection.py
"""

import asyncio
import os
from ib_insync import IB

HOST = os.getenv("IBKR_HOST", "127.0.0.1")
PORT = int(os.getenv("IBKR_PORT", "7497"))   # 7497 = paper TWS
CLIENT_ID = int(os.getenv("IBKR_CLIENT_ID", "1"))


async def main():
    ib = IB()
    print(f"Connecting to {HOST}:{PORT} (clientId={CLIENT_ID}) ...")
    await ib.connectAsync(HOST, PORT, clientId=CLIENT_ID, timeout=10)

    print("\nConnected!")
    print("Managed accounts:", ib.managedAccounts())

    values = ib.accountValues()
    if values:
        print("\nSample account values:")
        for v in values[:5]:
            print(f"  {v.tag:<20} {v.value} {v.currency}")

    ib.disconnect()
    print("\nDisconnected. Connection test passed.")


if __name__ == "__main__":
    asyncio.run(main())
