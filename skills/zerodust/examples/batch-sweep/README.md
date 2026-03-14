# Batch Sweep Multiple Chains

Sweep dust from multiple chains and consolidate to a single destination.

## Prerequisites

```bash
npm install @zerodust/sdk viem
```

## Sweep Specific Chains

```typescript
import { ZeroDustAgent } from '@zerodust/sdk';
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';

const agent = new ZeroDustAgent({
  account: privateKeyToAccount(process.env.PRIVATE_KEY as Hex),
  environment: 'mainnet',
});

const results = await agent.batchSweep({
  sweeps: [
    { fromChainId: 42161 },  // Arbitrum
    { fromChainId: 10 },     // Optimism
    { fromChainId: 137 },    // Polygon
    { fromChainId: 56 },     // BSC
  ],
  consolidateToChainId: 8453,  // All to Base
  continueOnError: true,       // Don't stop if one chain fails
});

console.log(`Results: ${results.successful}/${results.total} succeeded`);

for (const r of results.results) {
  const status = r.success ? `OK (${r.txHash})` : `FAILED: ${r.error}`;
  console.log(`  Chain ${r.fromChainId} -> ${r.toChainId}: ${status}`);
}
```

## Sweep All Sweepable Chains

```typescript
// Automatically discovers all chains with sweepable dust
const results = await agent.sweepAll({
  toChainId: 8453,          // Everything to Base
  continueOnError: true,
});

console.log(`Swept ${results.successful} chains, ${results.failed} failed`);
```

## Error Handling

With `continueOnError: true`, failed chains don't stop the batch. Check individual results:

```typescript
const failed = results.results.filter(r => !r.success);
for (const f of failed) {
  if (f.error?.includes('BALANCE_TOO_LOW')) {
    console.log(`Chain ${f.fromChainId}: balance too small, skipping`);
  } else if (f.error?.includes('SOURCE_CHAIN_DISABLED')) {
    console.log(`Chain ${f.fromChainId}: bridge temporarily down`);
  } else {
    console.log(`Chain ${f.fromChainId}: unexpected error: ${f.error}`);
  }
}
```
