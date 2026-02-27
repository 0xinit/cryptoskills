# Setup Alerts and Webhooks Example

Create onchain monitoring alerts that trigger webhooks when specific contract events, function calls, or balance changes occur. Includes webhook server setup and signature verification.

## Setup

```typescript
const TENDERLY_ACCESS_KEY = process.env.TENDERLY_ACCESS_KEY;
const TENDERLY_ACCOUNT_SLUG = process.env.TENDERLY_ACCOUNT_SLUG;
const TENDERLY_PROJECT_SLUG = process.env.TENDERLY_PROJECT_SLUG;

if (!TENDERLY_ACCESS_KEY) throw new Error("TENDERLY_ACCESS_KEY is required");
if (!TENDERLY_ACCOUNT_SLUG) throw new Error("TENDERLY_ACCOUNT_SLUG is required");
if (!TENDERLY_PROJECT_SLUG) throw new Error("TENDERLY_PROJECT_SLUG is required");

const BASE_URL = `https://api.tenderly.co/api/v2/project/${TENDERLY_ACCOUNT_SLUG}/${TENDERLY_PROJECT_SLUG}`;

const headers = {
  "X-Access-Key": TENDERLY_ACCESS_KEY,
  "Content-Type": "application/json",
};
```

## Create an Event-Emission Alert

Monitor a contract for specific events. This example watches for USDC Transfer events above a threshold.

```typescript
interface AlertConfig {
  name: string;
  description?: string;
  network: string;
  type: string;
  enabled: boolean;
  alert_targets: Array<{
    type: string;
    webhook?: { url: string; secret?: string };
    email?: { address: string };
  }>;
  alert_parameters: {
    contracts?: string[];
    events?: Array<{ name: string; signature: string }>;
    functions?: Array<{ name: string; signature: string }>;
    threshold?: { amount: string; direction: string };
  };
}

async function createAlert(config: AlertConfig): Promise<{ id: string }> {
  const response = await fetch(`${BASE_URL}/alerts`, {
    method: "POST",
    headers,
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Alert creation failed (${response.status}): ${error}`);
  }

  return response.json() as Promise<{ id: string }>;
}

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

if (!WEBHOOK_URL) throw new Error("WEBHOOK_URL is required");

const transferAlert = await createAlert({
  name: "USDC Large Transfer",
  description: "Fires when USDC Transfer event is emitted",
  network: "1",
  type: "event_emitted",
  enabled: true,
  alert_targets: [
    {
      type: "webhook",
      webhook: {
        url: WEBHOOK_URL,
        secret: WEBHOOK_SECRET,
      },
    },
  ],
  alert_parameters: {
    contracts: [USDC],
    events: [
      {
        name: "Transfer",
        signature: "Transfer(address,address,uint256)",
      },
    ],
  },
});

console.log(`Alert created: ${transferAlert.id}`);
```

## Create a Function-Call Alert

Monitor when a specific function is called on a contract.

```typescript
const UNISWAP_ROUTER = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";

const swapAlert = await createAlert({
  name: "Uniswap Swap Monitor",
  description: "Fires when exactInputSingle is called on Uniswap Router",
  network: "1",
  type: "function_call",
  enabled: true,
  alert_targets: [
    {
      type: "webhook",
      webhook: {
        url: WEBHOOK_URL,
        secret: WEBHOOK_SECRET,
      },
    },
  ],
  alert_parameters: {
    contracts: [UNISWAP_ROUTER],
    functions: [
      {
        name: "exactInputSingle",
        signature: "exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))",
      },
    ],
  },
});

console.log(`Swap alert created: ${swapAlert.id}`);
```

## Create a Balance-Change Alert

Monitor when an address's ETH balance changes significantly.

```typescript
const TREASURY = "0x1234567890abcdef1234567890abcdef12345678";

const balanceAlert = await createAlert({
  name: "Treasury Balance Drop",
  description: "Fires when treasury ETH balance drops below threshold",
  network: "1",
  type: "balance_change",
  enabled: true,
  alert_targets: [
    {
      type: "webhook",
      webhook: {
        url: WEBHOOK_URL,
        secret: WEBHOOK_SECRET,
      },
    },
    {
      type: "email",
      email: {
        address: "alerts@yourproject.com",
      },
    },
  ],
  alert_parameters: {
    contracts: [TREASURY],
    threshold: {
      amount: "10000000000000000000", // 10 ETH in wei
      direction: "below",
    },
  },
});

console.log(`Balance alert created: ${balanceAlert.id}`);
```

## List and Manage Alerts

```typescript
async function listAlerts(): Promise<Array<{ id: string; name: string; enabled: boolean }>> {
  const response = await fetch(`${BASE_URL}/alerts`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`List alerts failed (${response.status}): ${error}`);
  }

  return response.json() as Promise<Array<{ id: string; name: string; enabled: boolean }>>;
}

async function deleteAlert(alertId: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/alerts/${alertId}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Delete alert failed (${response.status}): ${error}`);
  }
}

async function toggleAlert(alertId: string, enabled: boolean): Promise<void> {
  const response = await fetch(`${BASE_URL}/alerts/${alertId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ enabled }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Toggle alert failed (${response.status}): ${error}`);
  }
}

const alerts = await listAlerts();
for (const alert of alerts) {
  console.log(`${alert.id}: ${alert.name} (${alert.enabled ? "enabled" : "disabled"})`);
}
```

## Webhook Receiver Server

Minimal Express server that receives and verifies Tenderly webhook payloads.

```typescript
import express from "express";
import { createHmac, timingSafeEqual } from "node:crypto";

const app = express();

// Raw body is needed for signature verification
app.use(express.json({
  verify: (req, _res, buf) => {
    (req as express.Request & { rawBody: Buffer }).rawBody = buf;
  },
}));

function verifySignature(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

interface TenderlyWebhookPayload {
  id: string;
  type: string;
  created_at: string;
  network: string;
  alert: { id: string; name: string; type: string };
  transaction: {
    hash: string;
    from: string;
    to: string;
    value: string;
    gas_used: number;
    block_number: number;
    status: boolean;
  };
  logs?: Array<{ address: string; topics: string[]; data: string }>;
}

app.post("/webhook/tenderly", (req, res) => {
  const signature = req.headers["x-tenderly-signature"] as string | undefined;
  const secret = process.env.WEBHOOK_SECRET;

  if (secret && signature) {
    const rawBody = (req as express.Request & { rawBody: Buffer }).rawBody;
    if (!verifySignature(rawBody, signature, secret)) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }
  }

  const payload = req.body as TenderlyWebhookPayload;

  console.log(`Alert: ${payload.alert.name}`);
  console.log(`Tx: ${payload.transaction.hash}`);
  console.log(`From: ${payload.transaction.from}`);
  console.log(`Block: ${payload.transaction.block_number}`);

  // Process the alert (send to Slack, update DB, trigger action, etc.)

  res.status(200).json({ received: true });
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
```

## Common Pitfalls

- Event signatures use the canonical Solidity form: `Transfer(address,address,uint256)` not `Transfer(address indexed from, address indexed to, uint256 value)` — parameter names and `indexed` keywords are stripped
- Alert `network` field is a string (`"1"`), not a number
- Webhook secrets are optional but strongly recommended for production — without them, anyone who discovers your endpoint can send fake alerts
- Free tier limits you to 5 alerts — delete old ones before creating new
- Alerts have a propagation delay after creation (typically seconds, occasionally up to 1 minute)
- The `x-tenderly-signature` header may not be present if no secret was configured on the webhook target
- Balance change alerts track ETH balance by default — for ERC-20 balance monitoring, use `event_emitted` with the Transfer event and filter by the monitored address
