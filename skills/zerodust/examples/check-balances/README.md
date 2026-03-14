# Check Balances Across Chains

Check native token dust balances across all 25 supported chains.

## Prerequisites

```bash
npm install @zerodust/sdk viem
```

## SDK Example

```typescript
import { ZeroDust } from '@zerodust/sdk';

const zerodust = new ZeroDust({ environment: 'mainnet' });

const address = '0x1234567890abcdef1234567890abcdef12345678';
const { chains } = await zerodust.getBalances(address);

// Filter to sweepable chains
const sweepable = chains.filter(c => c.canSweep);

console.log(`Found ${sweepable.length} sweepable chains:`);
for (const chain of sweepable) {
  console.log(`  ${chain.name} (${chain.chainId}): ${chain.balanceFormatted} ${chain.nativeToken}`);
}
```

## REST API Example

```bash
# All chains (mainnet)
curl "https://api.zerodust.xyz/balances/0x1234...?testnet=false"

# Specific chain
curl "https://api.zerodust.xyz/balances/0x1234.../42161"
```

## Response

```json
{
  "address": "0x...",
  "chains": [
    {
      "chainId": 42161,
      "name": "Arbitrum",
      "nativeToken": "ETH",
      "balance": "800000000000000",
      "balanceFormatted": "0.0008",
      "canSweep": true,
      "minBalance": "10000000000000"
    }
  ]
}
```

`canSweep` is `true` when the balance exceeds the chain's minimum (covers gas fees). Only request quotes for chains where `canSweep` is `true`.
