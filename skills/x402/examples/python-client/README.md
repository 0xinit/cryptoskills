# Python Client for x402 APIs

Python client that pays for x402-protected API endpoints using USDC on Base. Uses the `x402` Python package for automatic payment handling, with a manual fallback example using `eth_account`.

## Prerequisites

```bash
pip install "x402[evm,requests]" python-dotenv
```

## Environment

```bash
# .env
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
```

## Step 1: Automatic Payment with x402 Client

The `x402` Python package handles the full 402 flow — detect payment requirements, sign authorization, retry with `X-PAYMENT` header.

```python
import os
from dotenv import load_dotenv
from eth_account import Account
from x402 import x402ClientSync
from x402.evm import ExactEvmScheme
import requests

load_dotenv()

wallet = Account.from_key(os.environ["PRIVATE_KEY"])
print(f"Wallet: {wallet.address}")

client = x402ClientSync()
client.register("eip155:*", ExactEvmScheme(signer=wallet))

url = "https://api.example.com/api/weather"

response = requests.get(url)
if response.status_code == 402:
    payment_required = response.json()
    payload = client.create_payment_payload(payment_required)
    response = requests.get(url, headers={"X-PAYMENT": payload.to_header()})

if response.ok:
    print(response.json())
else:
    print(f"Failed: {response.status_code} — {response.text}")
```

## Step 2: Manual Signing (No x402 Package)

For full control over the payment flow using only `eth_account` and `requests`.

```python
import os
import json
import time
import base64
from dotenv import load_dotenv
from eth_account import Account
from eth_account.messages import encode_structured_data
import requests

load_dotenv()

wallet = Account.from_key(os.environ["PRIVATE_KEY"])
url = "https://api.example.com/api/weather"

response = requests.get(url)
if response.status_code != 402:
    print(response.json())
    exit()

payment_info = response.json()
accepted = payment_info["accepts"][0]
chain_id = int(accepted["network"].split(":")[1])
now = int(time.time())
nonce = "0x" + os.urandom(32).hex()

structured_data = {
    "types": {
        "EIP712Domain": [
            {"name": "name", "type": "string"},
            {"name": "version", "type": "string"},
            {"name": "chainId", "type": "uint256"},
            {"name": "verifyingContract", "type": "address"},
        ],
        "TransferWithAuthorization": [
            {"name": "from", "type": "address"},
            {"name": "to", "type": "address"},
            {"name": "value", "type": "uint256"},
            {"name": "validAfter", "type": "uint256"},
            {"name": "validBefore", "type": "uint256"},
            {"name": "nonce", "type": "bytes32"},
        ],
    },
    "primaryType": "TransferWithAuthorization",
    "domain": {
        "name": accepted["extra"]["name"],
        "version": accepted["extra"]["version"],
        "chainId": chain_id,
        "verifyingContract": accepted["asset"],
    },
    "message": {
        "from": wallet.address,
        "to": accepted["payTo"],
        "value": int(accepted["amount"]),
        "validAfter": 0,
        "validBefore": now + accepted["maxTimeoutSeconds"],
        "nonce": nonce,
    },
}

signable = encode_structured_data(structured_data)
signed = wallet.sign_message(signable)

payload = {
    "x402Version": 2,
    "accepted": accepted,
    "payload": {
        "signature": signed.signature.hex(),
        "authorization": {
            "from": wallet.address,
            "to": accepted["payTo"],
            "value": str(accepted["amount"]),
            "validAfter": "0",
            "validBefore": str(now + accepted["maxTimeoutSeconds"]),
            "nonce": nonce,
        },
    },
}

x_payment = base64.b64encode(json.dumps(payload).encode()).decode()
paid_response = requests.get(url, headers={"X-PAYMENT": x_payment})
print(paid_response.json())
```

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `ModuleNotFoundError: x402` | Package not installed | Run `pip install "x402[evm,requests]"` |
| `Payment verification failed` | Wrong private key or insufficient USDC | Verify wallet has USDC on the correct chain |
| `authorization is used or canceled` | Nonce was already settled | Generate a new random nonce per request |
| `validBefore has passed` | Authorization expired before settlement | Increase the time window or reduce latency |
