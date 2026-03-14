# Agent API (REST)

Use the Agent API for server-side integrations or when not using the TypeScript SDK.

## Register for an API Key

```bash
curl -X POST https://api.zerodust.xyz/agent/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Sweep Agent",
    "agentId": "agent-001",
    "contactEmail": "dev@example.com"
  }'
```

Response:
```json
{
  "apiKey": "zd_abc123...",
  "keyPrefix": "zd_abc",
  "keyId": "uuid",
  "keyType": "agent",
  "rateLimits": { "perMinute": 300, "daily": 1000 },
  "message": "IMPORTANT: Save your API key now - it will not be shown again!"
}
```

## Single Sweep (Combined Quote + Auth)

```bash
curl -X POST https://api.zerodust.xyz/agent/sweep \
  -H "Authorization: Bearer zd_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "fromChainId": 42161,
    "toChainId": 8453,
    "userAddress": "0x1234...",
    "destination": "0x1234..."
  }'
```

Returns quote, typed data, and EIP-7702 parameters in a single response. The agent still needs to sign and submit via `POST /sweep`.

## Batch Sweep

```bash
curl -X POST https://api.zerodust.xyz/agent/batch-sweep \
  -H "Authorization: Bearer zd_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "sweeps": [
      { "fromChainId": 42161 },
      { "fromChainId": 10 },
      { "fromChainId": 137 }
    ],
    "destination": "0x1234...",
    "consolidateToChainId": 8453
  }'
```

## Check Usage Stats

```bash
curl https://api.zerodust.xyz/agent/me \
  -H "Authorization: Bearer zd_abc123..."
```

Response:
```json
{
  "keyId": "uuid",
  "keyType": "agent",
  "rateLimits": {
    "perMinute": 300,
    "daily": 1000,
    "dailyUsed": 42,
    "dailyRemaining": 958
  }
}
```

## TypeScript Client

```typescript
const API_KEY = process.env.ZERODUST_API_KEY;
const BASE_URL = 'https://api.zerodust.xyz';

async function agentSweep(fromChainId: number, toChainId: number, userAddress: string) {
  const res = await fetch(`${BASE_URL}/agent/sweep`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fromChainId, toChainId, userAddress }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Agent sweep failed: ${err.error} (${err.code})`);
  }

  return res.json();
}
```
