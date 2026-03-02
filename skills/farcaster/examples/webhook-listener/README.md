# Neynar Webhook Listener

Working TypeScript example for an Express server that receives Neynar webhook events with complete HMAC-SHA512 signature verification.

## Dependencies

```bash
npm install express @neynar/nodejs-sdk
npm install -D @types/express typescript
```

## Webhook Signature Verification

Neynar signs every webhook delivery with HMAC-SHA512 using your webhook secret. The signature is sent in the `X-Neynar-Signature` header as a hex string.

Verification MUST happen before JSON parsing. Use the raw request body bytes for HMAC computation.

```typescript
import crypto from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";

function verifyNeynarWebhook(
  rawBody: Buffer,
  headers: IncomingHttpHeaders,
  webhookSecret: string
): boolean {
  const signature = headers["x-neynar-signature"];
  if (typeof signature !== "string") return false;

  const hmac = crypto.createHmac("sha512", webhookSecret);
  hmac.update(rawBody);
  const computedSignature = hmac.digest("hex");

  // Both must be the same length for timingSafeEqual
  const sigBuffer = Buffer.from(signature, "hex");
  const computedBuffer = Buffer.from(computedSignature, "hex");
  if (sigBuffer.length !== computedBuffer.length) return false;

  return crypto.timingSafeEqual(sigBuffer, computedBuffer);
}
```

## Webhook Event Types

| Event Type | Description |
|-----------|-------------|
| `cast.created` | New cast published |
| `cast.deleted` | Cast removed by author |
| `reaction.created` | Like or recast added |
| `reaction.deleted` | Like or recast removed |
| `follow.created` | User followed another user |
| `follow.deleted` | User unfollowed another user |
| `user.created` | New FID registered |
| `user.updated` | User profile updated |

## Express Server

```typescript
import express from "express";
import crypto from "node:crypto";

const app = express();
const WEBHOOK_SECRET = process.env.NEYNAR_WEBHOOK_SECRET;

if (!WEBHOOK_SECRET) {
  throw new Error("NEYNAR_WEBHOOK_SECRET environment variable is required");
}

// Raw body middleware -- ONLY on the webhook route
// Global express.json() would parse the body and break signature verification
app.use("/api/webhook", express.raw({ type: "application/json" }));

// Use express.json() for all other routes
app.use(express.json());

interface WebhookEvent {
  created_at: number;
  type: string;
  data: Record<string, unknown>;
}

app.post("/api/webhook", (req, res) => {
  const rawBody = req.body as Buffer;
  const signature = req.headers["x-neynar-signature"] as string | undefined;

  if (!signature) {
    res.status(401).json({ error: "Missing X-Neynar-Signature header" });
    return;
  }

  // Compute HMAC-SHA512 over raw bytes
  const hmac = crypto.createHmac("sha512", WEBHOOK_SECRET);
  hmac.update(rawBody);
  const computed = hmac.digest("hex");

  // Timing-safe comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature, "hex");
  const computedBuffer = Buffer.from(computed, "hex");

  if (
    sigBuffer.length !== computedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, computedBuffer)
  ) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  // Only parse JSON after successful signature verification
  const event: WebhookEvent = JSON.parse(rawBody.toString("utf-8"));

  handleEvent(event);

  res.status(200).json({ status: "ok" });
});

function handleEvent(event: WebhookEvent): void {
  switch (event.type) {
    case "cast.created": {
      const cast = event.data as {
        hash: string;
        text: string;
        author: { fid: number; username: string };
      };
      console.log(`New cast by @${cast.author.username}: ${cast.text}`);
      break;
    }
    case "reaction.created": {
      const reaction = event.data as {
        reaction_type: string;
        cast: { hash: string };
        user: { fid: number };
      };
      console.log(`Reaction ${reaction.reaction_type} on ${reaction.cast.hash}`);
      break;
    }
    case "follow.created": {
      const follow = event.data as {
        user: { fid: number; username: string };
        target_user: { fid: number; username: string };
      };
      console.log(`@${follow.user.username} followed @${follow.target_user.username}`);
      break;
    }
    default:
      console.log(`Unhandled event: ${event.type}`);
  }
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Webhook listener running on port ${PORT}`);
});
```

## Register a Webhook via Neynar API

```typescript
import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";

const config = new Configuration({
  apiKey: process.env.NEYNAR_API_KEY,
});
const neynar = new NeynarAPIClient(config);

async function registerWebhook() {
  const webhook = await neynar.publishWebhook({
    name: "my-app-webhook",
    url: "https://myapp.example.com/api/webhook",
    subscription: {
      "cast.created": {},
      "reaction.created": {},
      "follow.created": {},
    },
  });

  console.log(`Webhook registered: ${webhook.webhook_id}`);
  console.log(`Secret: ${webhook.secret}`);
  // Store this secret as NEYNAR_WEBHOOK_SECRET
}

registerWebhook().catch(console.error);
```

## Notes

- The webhook secret is returned only once when creating the webhook -- store it securely
- Always use `express.raw()` on the webhook route, not `express.json()`, to preserve the raw bytes for HMAC verification
- Neynar retries failed webhook deliveries (non-2xx responses) with exponential backoff
- Webhook events may arrive out of order -- use the `created_at` timestamp for ordering if needed
- Rate limits on webhook subscriptions depend on your Neynar plan (Free: 1, Starter: 5, Growth: 25)
- For local development, use a tunneling service (ngrok, cloudflared) to expose your local server
