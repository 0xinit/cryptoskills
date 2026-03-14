# Sweep Single Chain

Sweep all native tokens from Arbitrum to Base using the ZeroDustAgent SDK.

## Prerequisites

```bash
npm install @zerodust/sdk viem
```

## Complete Example

```typescript
import { ZeroDustAgent } from '@zerodust/sdk';
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';

async function sweepArbitrumToBase() {
  // Initialize agent
  const agent = new ZeroDustAgent({
    account: privateKeyToAccount(process.env.PRIVATE_KEY as Hex),
    environment: 'mainnet',
  });

  console.log(`Agent address: ${agent.address}`);

  // Check balance on Arbitrum
  const balance = await agent.getBalance(42161);
  console.log(`Arbitrum balance: ${balance.balanceFormatted} ETH`);

  if (!balance.canSweep) {
    console.log('Balance too low to sweep');
    return;
  }

  // Sweep Arbitrum -> Base
  const result = await agent.sweep(
    {
      fromChainId: 42161,  // Arbitrum
      toChainId: 8453,     // Base
    },
    {
      waitForCompletion: true,
      timeoutMs: 120_000,
      onStatusChange: (status) => {
        console.log(`Status: ${status.status}`);
      },
    }
  );

  if (result.success) {
    console.log(`Sweep completed!`);
    console.log(`  TX: ${result.txHash}`);
    console.log(`  Amount: ${result.status?.amountSent}`);
  } else {
    console.log(`Sweep failed: ${result.error}`);
  }
}

sweepArbitrumToBase();
```

## What Happens Under the Hood

The `agent.sweep()` method handles 6 steps automatically:

1. `GET /quote` - Fetches quote with fee breakdown
2. `POST /authorization` - Gets EIP-712 typed data
3. Signs EIP-712 SweepIntent (using agent's private key)
4. Signs EIP-7702 delegation + revoke authorizations
5. `POST /sweep` - Submits all signatures
6. Polls `GET /sweep/:id` until completed or failed
