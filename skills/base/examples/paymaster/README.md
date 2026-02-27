# Paymaster (Gasless Transactions) Examples

A paymaster is an ERC-4337 contract that sponsors gas fees on behalf of users. Coinbase Developer Platform provides a managed paymaster for Base. Users pay zero gas — the paymaster covers it.

## How It Works

1. User submits a UserOperation (via Smart Wallet or ERC-4337 wallet)
2. Bundler calls the paymaster's `validatePaymasterUserOp` to check if the tx is sponsored
3. If approved, paymaster pays gas; user pays nothing
4. Paymaster policy (configured in CDP dashboard) determines which transactions are sponsored

## Setup

### 1. Create a CDP Project

1. Go to [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com)
2. Create a new project
3. Enable the Paymaster & Bundler service
4. Copy your API key

### 2. Configure Paymaster Policy

In the CDP dashboard, define your sponsorship rules:

- **Contract allowlist** — Only sponsor calls to your contract addresses
- **Function allowlist** — Only sponsor specific function selectors (e.g., `mint(uint256)`)
- **Per-user limits** — Max sponsored gas per wallet per day/week/month
- **Global limits** — Total sponsored gas budget across all users

### 3. Environment Variables

```bash
# .env
NEXT_PUBLIC_CDP_API_KEY=your_cdp_api_key
```

The paymaster URL format:
```
https://api.developer.coinbase.com/rpc/v1/base/<CDP_API_KEY>
```

## wagmi + Smart Wallet (Recommended)

The simplest integration: Smart Wallet + paymaster via EIP-5792 `wallet_sendCalls`.

```tsx
import { useWriteContracts } from 'wagmi/experimental';

const PAYMASTER_URL = `https://api.developer.coinbase.com/rpc/v1/base/${process.env.NEXT_PUBLIC_CDP_API_KEY}`;

const mintAbi = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [],
  },
] as const;

function GaslessMint({ contractAddress }: { contractAddress: `0x${string}` }) {
  const { writeContracts, isPending, isSuccess, error } = useWriteContracts();

  const handleMint = () => {
    writeContracts({
      contracts: [
        {
          address: contractAddress,
          abi: mintAbi,
          functionName: 'mint',
          args: ['0xRecipientAddress' as `0x${string}`],
        },
      ],
      capabilities: {
        paymasterService: {
          url: PAYMASTER_URL,
        },
      },
    });
  };

  return (
    <div>
      <button onClick={handleMint} disabled={isPending}>
        {isPending ? 'Minting...' : 'Mint (Gasless)'}
      </button>
      {isSuccess && <p>Minted successfully!</p>}
      {error && <p>Error: {error.message}</p>}
    </div>
  );
}
```

## OnchainKit Transaction with Sponsorship

OnchainKit's `TransactionSponsor` component handles paymaster integration automatically when CDP API key is configured in the `OnchainKitProvider`.

```tsx
import {
  Transaction,
  TransactionButton,
  TransactionSponsor,
  TransactionStatus,
  TransactionStatusLabel,
} from '@coinbase/onchainkit/transaction';
import { base } from 'viem/chains';

function SponsoredTransaction() {
  const contracts = [
    {
      address: '0xYourContract' as `0x${string}`,
      abi: [{ name: 'claim', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] }] as const,
      functionName: 'claim',
    },
  ];

  return (
    <Transaction chainId={base.id} contracts={contracts}>
      <TransactionSponsor />
      <TransactionButton text="Claim (Free)" />
      <TransactionStatus>
        <TransactionStatusLabel />
      </TransactionStatus>
    </Transaction>
  );
}
```

## Direct Paymaster RPC Calls (viem)

For lower-level control, call the paymaster RPC methods directly.

### pm_getPaymasterStubData

Returns gas estimates and stub paymaster data for a UserOperation:

```typescript
const PAYMASTER_URL = `https://api.developer.coinbase.com/rpc/v1/base/${process.env.CDP_API_KEY}`;

// EntryPoint v0.7 address
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

async function getPaymasterStubData(userOp: {
  sender: `0x${string}`;
  nonce: `0x${string}`;
  callData: `0x${string}`;
  callGasLimit: `0x${string}`;
  verificationGasLimit: `0x${string}`;
  preVerificationGas: `0x${string}`;
  maxFeePerGas: `0x${string}`;
  maxPriorityFeePerGas: `0x${string}`;
}) {
  const response = await fetch(PAYMASTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'pm_getPaymasterStubData',
      params: [userOp, ENTRY_POINT_V07, `0x${(8453).toString(16)}`],
    }),
  });

  const { result, error } = await response.json();
  if (error) throw new Error(`Paymaster error: ${error.message}`);
  return result;
}
```

### pm_getPaymasterData

Returns the final paymaster signature for a UserOperation (called after gas estimation):

```typescript
async function getPaymasterData(userOp: {
  sender: `0x${string}`;
  nonce: `0x${string}`;
  callData: `0x${string}`;
  callGasLimit: `0x${string}`;
  verificationGasLimit: `0x${string}`;
  preVerificationGas: `0x${string}`;
  maxFeePerGas: `0x${string}`;
  maxPriorityFeePerGas: `0x${string}`;
  paymasterAndData: `0x${string}`;
}) {
  const response = await fetch(PAYMASTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'pm_getPaymasterData',
      params: [userOp, ENTRY_POINT_V07, `0x${(8453).toString(16)}`],
    }),
  });

  const { result, error } = await response.json();
  if (error) throw new Error(`Paymaster error: ${error.message}`);
  return result;
}
```

## Error Handling

Paymaster requests can fail. Always handle errors gracefully with a fallback to user-paid gas.

```tsx
import { useWriteContracts } from 'wagmi/experimental';
import { useWriteContract } from 'wagmi';

function MintWithFallback({ contractAddress }: { contractAddress: `0x${string}` }) {
  const { writeContracts } = useWriteContracts();
  const { writeContract } = useWriteContract();

  const handleMint = async () => {
    try {
      writeContracts({
        contracts: [
          {
            address: contractAddress,
            abi: mintAbi,
            functionName: 'mint',
            args: ['0xRecipient' as `0x${string}`],
          },
        ],
        capabilities: {
          paymasterService: {
            url: PAYMASTER_URL,
          },
        },
      });
    } catch {
      // Paymaster rejected — fall back to user-paid gas
      writeContract({
        address: contractAddress,
        abi: mintAbi,
        functionName: 'mint',
        args: ['0xRecipient' as `0x${string}`],
      });
    }
  };

  return <button onClick={handleMint}>Mint</button>;
}
```

## Common Paymaster Errors

| Error Code | Meaning | Fix |
|------------|---------|-----|
| AA31 | Paymaster deposit too low | Top up paymaster deposit on EntryPoint |
| AA32 | Paymaster `validatePaymasterUserOp` reverted | Check paymaster policy — contract or method not allowlisted |
| AA33 | Paymaster `postOp` reverted | Check paymaster balance or postOp logic |
| AA34 | Paymaster signature expired | Retry — the paymaster stub data may have timed out |
| `POLICY_VIOLATION` | Transaction violates policy rules | Check allowlisted contracts, spend limits, rate limits |
| `INSUFFICIENT_BUDGET` | Sponsorship budget exhausted | Increase budget in CDP dashboard |

## Testing with Base Sepolia

The CDP paymaster works on Base Sepolia. Use testnet for development:

```typescript
// Testnet paymaster URL
const TESTNET_PAYMASTER_URL = `https://api.developer.coinbase.com/rpc/v1/base-sepolia/${process.env.NEXT_PUBLIC_CDP_API_KEY}`;
```

Testnet sponsorship is free and does not count against your budget.
