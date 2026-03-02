# Paid API Server with x402

Express server with x402 payment middleware. Protects endpoints behind USDC micropayments on Base. No API keys — payment is authentication.

## Prerequisites

```bash
npm init -y
npm install express @x402/core @x402/evm @x402/express dotenv
npm install -D typescript @types/express @types/node tsx
```

## Environment

```bash
# .env
PAYMENT_ADDRESS=0xYOUR_RECEIVING_ADDRESS
PORT=3000
```

## Step 1: Define Protected Routes

Each route specifies what it costs and which network to accept payment on.

```typescript
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { config } from "dotenv";
import type { Address } from "viem";

config();

const app = express();
app.use(express.json());

const paymentAddress = process.env.PAYMENT_ADDRESS as Address;

const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://api.cdp.coinbase.com/platform/v2/x402",
});

const resourceServer = new x402ResourceServer(facilitatorClient)
  .register("eip155:8453", new ExactEvmScheme());
```

## Step 2: Apply Payment Middleware

```typescript
app.use(
  paymentMiddleware(
    {
      "GET /api/weather": {
        accepts: {
          scheme: "exact",
          network: "eip155:8453",
          price: "$0.01",
          payTo: paymentAddress,
        },
        description: "Current weather data",
      },
      "POST /api/summarize": {
        accepts: {
          scheme: "exact",
          network: "eip155:8453",
          price: "$0.05",
          payTo: paymentAddress,
        },
        description: "AI text summarization",
      },
      "GET /api/health": {
        accepts: null,
        description: "Free health check — no payment required",
      },
    },
    resourceServer,
  ),
);
```

## Step 3: Implement Endpoints

```typescript
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.get("/api/weather", (_req, res) => {
  res.json({
    temperature: 68,
    unit: "F",
    location: "San Francisco",
    conditions: "Partly cloudy",
    humidity: 72,
  });
});

app.post("/api/summarize", (req, res) => {
  const { text } = req.body as { text: string };
  if (!text) {
    res.status(400).json({ error: "text field is required" });
    return;
  }
  res.json({
    summary: `Summary of ${text.length} character input...`,
    wordCount: text.split(/\s+/).length,
  });
});

const PORT = parseInt(process.env.PORT ?? "3000", 10);
app.listen(PORT, () => {
  console.log(`x402 server running on port ${PORT}`);
});
```

## Step 4: Test with curl

```bash
# Free endpoint — no payment needed
curl http://localhost:3000/api/health

# Paid endpoint without payment — returns 402
curl -v http://localhost:3000/api/weather
# HTTP/1.1 402 Payment Required
# Body contains: { "x402Version": 2, "accepts": [...], "error": "..." }

# Paid endpoint with valid X-PAYMENT header — returns 200
# (Use @x402/fetch client to generate the header automatically)
```

## How It Works

1. `GET /api/health` is unprotected — serves normally
2. `GET /api/weather` and `POST /api/summarize` require payment
3. Requests without `X-PAYMENT` header get HTTP 402 with pricing info
4. Requests with a valid payment header are verified via the facilitator, served, then settled on-chain
5. USDC arrives in your `PAYMENT_ADDRESS` after on-chain settlement

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `X-PAYMENT header is required` | No payment header sent | Use `@x402/fetch` or manually construct the header |
| `Payment verification failed` | Invalid signature or insufficient USDC balance | Check signer address and USDC balance on Base |
| `Payment expired` | `validBefore` timestamp has passed | Increase `maxTimeoutSeconds` or reduce server latency |
| `ECONNREFUSED` on facilitator | Facilitator endpoint unreachable | Verify network connectivity to CDP endpoint |
