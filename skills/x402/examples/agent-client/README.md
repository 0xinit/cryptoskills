# AI Agent Client for x402 APIs

TypeScript AI agent that autonomously pays for API access using x402. The wrapped fetch function handles the 402 payment flow automatically — detect, sign, retry.

## Prerequisites

```bash
npm init -y
npm install @x402/core @x402/evm @x402/fetch viem dotenv
npm install -D typescript @types/node tsx
```

## Environment

```bash
# .env
AGENT_PRIVATE_KEY=0xYOUR_AGENT_WALLET_PRIVATE_KEY
```

The agent wallet must hold USDC on Base (chain ID 8453). No native ETH needed — the facilitator pays gas.

## Step 1: Initialize the Payment-Aware Fetch

```typescript
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http, formatUnits, type Hex, type Address } from "viem";
import { base } from "viem/chains";
import { config } from "dotenv";

config();

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as Hex);

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    {
      network: "eip155:8453",
      client: new ExactEvmScheme(account),
    },
  ],
});

console.log(`Agent wallet: ${account.address}`);
```

## Step 2: Check USDC Balance Before Spending

```typescript
const USDC_BASE: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

async function getUsdcBalance(): Promise<bigint> {
  const balance = await publicClient.readContract({
    address: USDC_BASE,
    abi: [
      {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
      },
    ] as const,
    functionName: "balanceOf",
    args: [account.address],
  });

  console.log(`USDC balance: ${formatUnits(balance, 6)}`);
  return balance;
}
```

## Step 3: Make Paid Requests

```typescript
async function callPaidApi<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetchWithPayment(url, options);

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API call failed (${response.status}): ${errorBody}`);
  }

  return response.json() as Promise<T>;
}

interface WeatherData {
  temperature: number;
  unit: string;
  location: string;
}

interface SummaryResult {
  summary: string;
  wordCount: number;
}
```

## Step 4: Agent Workflow

```typescript
async function runAgent(): Promise<void> {
  const balance = await getUsdcBalance();

  // 10000 = $0.01 in USDC (6 decimals). Require at least $0.10 to operate.
  const MIN_BALANCE = 100000n;
  if (balance < MIN_BALANCE) {
    throw new Error(
      `Insufficient USDC balance: ${formatUnits(balance, 6)}. Need at least $0.10.`
    );
  }

  const weather = await callPaidApi<WeatherData>(
    "https://api.example.com/api/weather"
  );
  console.log(`Weather: ${weather.temperature}${weather.unit} in ${weather.location}`);

  const summary = await callPaidApi<SummaryResult>(
    "https://api.example.com/api/summarize",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `Current weather in ${weather.location}: ${weather.temperature} degrees ${weather.unit}`,
      }),
    }
  );
  console.log(`Summary: ${summary.summary}`);
}

runAgent().catch((err) => {
  console.error("Agent failed:", err);
  process.exit(1);
});
```

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `Insufficient USDC balance` | Wallet does not have enough USDC on Base | Fund the agent wallet with USDC |
| `Payment verification failed` | Signature issue or wrong network | Ensure `AGENT_PRIVATE_KEY` matches the funded wallet |
| `Request failed: 402` | Payment wrapper did not auto-retry | Check that the scheme network matches the server's `accepts` |
| `Request failed: 412` | Permit2 allowance required (non-USDC token) | Approve Permit2 contract first (requires native gas) |

## How It Works

1. `fetchWithPayment` sends the request normally
2. If the server returns 402, the wrapper reads the payment requirements from the response body
3. It constructs an EIP-3009 `TransferWithAuthorization`, signs it with the agent's private key, and base64-encodes the payload
4. It retries the request with the `X-PAYMENT` header
5. The server verifies via the facilitator, serves the resource, and settles on-chain
6. The agent receives the response as if it were a normal 200
