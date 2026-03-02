# Agent-to-Agent Autonomous Payment

AI agents that discover, negotiate, and pay for other agents' services over x402. Demonstrates a multi-step workflow where Agent A orchestrates calls to multiple paid agent services.

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

## Step 1: Service Discovery

Agents expose their capabilities and pricing at a well-known endpoint.

```typescript
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { config } from "dotenv";

config();

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as Hex);

const agentFetch = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    { network: "eip155:8453", client: new ExactEvmScheme(account) },
  ],
});

interface ServiceEndpoint {
  path: string;
  method: string;
  price: string;
  network: string;
  description: string;
}

interface ServiceManifest {
  name: string;
  endpoints: ServiceEndpoint[];
}

async function discoverServices(baseUrl: string): Promise<ServiceManifest> {
  const response = await fetch(`${baseUrl}/.well-known/x402`);
  if (!response.ok) {
    throw new Error(`Discovery failed for ${baseUrl}: ${response.status}`);
  }
  return response.json() as Promise<ServiceManifest>;
}
```

## Step 2: Price-Aware Service Selection

Agent selects the cheapest provider for a given capability.

```typescript
interface ServiceProvider {
  baseUrl: string;
  manifest: ServiceManifest;
}

async function findCheapestProvider(
  providers: ServiceProvider[],
  capability: string
): Promise<{ provider: ServiceProvider; endpoint: ServiceEndpoint } | null> {
  let best: { provider: ServiceProvider; endpoint: ServiceEndpoint; price: number } | null = null;

  for (const provider of providers) {
    const endpoint = provider.manifest.endpoints.find(
      (ep) => ep.description.toLowerCase().includes(capability.toLowerCase())
    );

    if (endpoint) {
      const price = parseFloat(endpoint.price.replace("$", ""));
      if (!best || price < best.price) {
        best = { provider, endpoint, price };
      }
    }
  }

  return best ? { provider: best.provider, endpoint: best.endpoint } : null;
}
```

## Step 3: Multi-Step Agent Workflow

Agent A orchestrates a pipeline across multiple paid services.

```typescript
interface TextResult {
  text: string;
}

interface AnalysisResult {
  sentiment: string;
  confidence: number;
  topics: string[];
}

interface TranslationResult {
  translated: string;
  sourceLanguage: string;
  targetLanguage: string;
}

async function callService<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await agentFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Service error (${response.status}): ${await response.text()}`);
  }

  return response.json() as Promise<T>;
}

async function orchestrateWorkflow(inputText: string): Promise<void> {
  // Step 1: Pay for text analysis ($0.02)
  console.log("Analyzing text...");
  const analysis = await callService<AnalysisResult>(
    "https://analyzer.agent/api/analyze",
    { text: inputText }
  );
  console.log(`Sentiment: ${analysis.sentiment} (${analysis.confidence})`);

  // Step 2: Pay for translation ($0.01)
  console.log("Translating...");
  const translation = await callService<TranslationResult>(
    "https://translator.agent/api/translate",
    { text: inputText, targetLanguage: "es" }
  );
  console.log(`Translated: ${translation.translated}`);

  // Step 3: Pay for summary generation ($0.05)
  console.log("Generating summary...");
  const summary = await callService<TextResult>(
    "https://summarizer.agent/api/summarize",
    {
      text: inputText,
      metadata: {
        sentiment: analysis.sentiment,
        topics: analysis.topics,
      },
    }
  );
  console.log(`Summary: ${summary.text}`);
}

orchestrateWorkflow("Long document content that needs processing...")
  .catch((err) => {
    console.error("Workflow failed:", err);
    process.exit(1);
  });
```

## Step 4: Budget Enforcement

Prevent runaway spending with a per-workflow budget cap.

```typescript
class BudgetTracker {
  private spent = 0;

  constructor(private readonly maxBudgetUsd: number) {}

  canSpend(amountUsd: number): boolean {
    return this.spent + amountUsd <= this.maxBudgetUsd;
  }

  record(amountUsd: number): void {
    this.spent += amountUsd;
    console.log(`Budget: $${this.spent.toFixed(4)} / $${this.maxBudgetUsd.toFixed(2)}`);
  }

  get remaining(): number {
    return this.maxBudgetUsd - this.spent;
  }
}

// Cap total spend at $1.00 per workflow run
const budget = new BudgetTracker(1.0);

async function callServiceWithBudget<T>(
  url: string,
  costUsd: number,
  body: Record<string, unknown>
): Promise<T> {
  if (!budget.canSpend(costUsd)) {
    throw new Error(`Budget exceeded. Remaining: $${budget.remaining.toFixed(4)}`);
  }

  const result = await callService<T>(url, body);
  budget.record(costUsd);
  return result;
}
```

## How It Works

1. Agent discovers available services via `/.well-known/x402` manifests
2. Agent selects the cheapest provider for each capability needed
3. `agentFetch` handles 402 responses transparently — the agent's code looks like normal HTTP calls
4. Each service call triggers USDC settlement on Base via the facilitator
5. Budget tracking prevents unbounded spending across multi-step workflows

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Discovery failed` | Service manifest endpoint unreachable | Verify the agent service URL and that it exposes `/.well-known/x402` |
| `Budget exceeded` | Workflow cost exceeds cap | Increase budget or reduce workflow steps |
| `Service error (402)` | Payment wrapper failed to auto-pay | Check that the scheme network matches the service's requirements |
| `Service error (500)` | Downstream agent service error | Retry with exponential backoff, or try alternate provider |
