# Wallet Operations on MegaETH

## Chain Configuration

| Parameter | Mainnet | Testnet |
|-----------|---------|---------|
| Chain ID | 4326 | 6343 |
| RPC | `https://mainnet.megaeth.com/rpc` | `https://carrot.megaeth.com/rpc` |
| Native Token | ETH | ETH |
| Explorer | `https://mega.etherscan.io` | `https://megaeth-testnet-v2.blockscout.com` |

## Wallet Setup

### Using viem

```typescript
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { megaeth } from './chains';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const client = createWalletClient({
  account,
  chain: megaeth,
  transport: http('https://mainnet.megaeth.com/rpc')
});
```

### Using ethers.js

```typescript
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://mainnet.megaeth.com/rpc');
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
```

## Check Balance

### Native ETH

```typescript
// viem
const balance = await publicClient.getBalance({ address: '0x...' });

// ethers
const balance = await provider.getBalance('0x...');
```

```bash
cast balance <address> --rpc-url https://mainnet.megaeth.com/rpc
```

### ERC20 Tokens

```typescript
const balance = await publicClient.readContract({
  address: tokenAddress,
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [walletAddress]
});
```

## Send Transactions

### Instant Receipts

Two equivalent methods (both supported, functionally identical):
- `realtime_sendRawTransaction` -- MegaETH original
- `eth_sendRawTransactionSync` -- EIP-7966 standard (recommended)

```typescript
const signedTx = await wallet.signTransaction({
  to: recipient,
  value: parseEther('0.1'),
  gas: 60000n,
  maxFeePerGas: 1000000n,
  maxPriorityFeePerGas: 0n
});

const receipt = await client.request({
  method: 'eth_sendRawTransactionSync',
  params: [signedTx]
});

console.log('Confirmed in block:', receipt.blockNumber);
```

### Standard Send (polling)

```typescript
// viem
const hash = await walletClient.sendTransaction({
  to: recipient,
  value: parseEther('0.1')
});
const receipt = await publicClient.waitForTransactionReceipt({ hash });

// ethers
const tx = await wallet.sendTransaction({
  to: recipient,
  value: parseEther('0.1')
});
const receipt = await tx.wait();
```

## Gas Configuration

MegaETH has stable, low gas costs but different intrinsic gas than standard EVM:

```typescript
const tx = {
  to: recipient,
  value: parseEther('0.1'),
  gas: 60000n,                    // MegaETH intrinsic gas (not 21000)
  maxFeePerGas: 1000000n,         // 0.001 gwei (base fee)
  maxPriorityFeePerGas: 0n        // Not needed unless congested
};
```

Tips:
- Base fee is stable at 0.001 gwei
- Simple ETH transfers need 60,000 gas on MegaETH (not 21,000)
- Do not add buffers (viem adds 20% by default -- override it)
- When in doubt, use `eth_estimateGas` -- MegaEVM costs differ from standard EVM

## Token Operations

### Token Addresses

Official token list: https://github.com/megaeth-labs/mega-tokenlist

| Token | Address |
|-------|---------|
| WETH | `0x4200000000000000000000000000000000000006` |
| MEGA | `0x28B7E77f82B25B95953825F1E3eA0E36c1c29861` |
| USDM | `0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7` |

### Transfer ERC20

```typescript
const hash = await walletClient.writeContract({
  address: tokenAddress,
  abi: erc20Abi,
  functionName: 'transfer',
  args: [recipient, amount]
});
```

### Approve Spending

```typescript
const hash = await walletClient.writeContract({
  address: tokenAddress,
  abi: erc20Abi,
  functionName: 'approve',
  args: [spenderAddress, maxUint256]
});
```

## Token Swaps (Kyber Network)

MegaETH uses Kyber Network as the DEX aggregator.

```typescript
const KYBER_API = 'https://aggregator-api.kyberswap.com/megaeth/api/v1';

// Get quote
const quoteRes = await fetch(
  `${KYBER_API}/routes?` + new URLSearchParams({
    tokenIn: '0x...',
    tokenOut: '0x...',
    amountIn: amount.toString(),
    gasInclude: 'true'
  })
);
const quote = await quoteRes.json();

// Build transaction
const buildRes = await fetch(`${KYBER_API}/route/build`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    routeSummary: quote.data.routeSummary,
    sender: walletAddress,
    recipient: walletAddress,
    slippageTolerance: 50 // 0.5% = 50 bips
  })
});
const { data } = await buildRes.json();

// Execute swap
const hash = await walletClient.sendTransaction({
  to: data.routerAddress,
  data: data.data,
  value: data.value,
  gas: BigInt(data.gas)
});
```

## Bridging ETH to MegaETH

### Canonical Bridge (from Ethereum)

Send ETH directly to the bridge contract on Ethereum mainnet:

```typescript
const bridgeAddress = '0x0CA3A2FBC3D770b578223FBB6b062fa875a2eE75';

const tx = await wallet.sendTransaction({
  to: bridgeAddress,
  value: parseEther('0.1')
});
```

For programmatic bridging with gas control:

```typescript
const iface = new ethers.Interface([
  'function depositETH(uint32 _minGasLimit, bytes _extraData) payable'
]);

const data = iface.encodeFunctionData('depositETH', [
  61000,
  '0x'
]);

const tx = await wallet.sendTransaction({
  to: bridgeAddress,
  value: parseEther('0.1'),
  data
});
```

## Nonce Management

For single transactions, the RPC handles nonces automatically. For rapid/batch transactions, manage nonces locally:

### Frontend Pattern

```typescript
import { useRef } from 'react';

const lastNonceRef = useRef<Record<number, number>>({});

async function getNextNonce(
  client: PublicClient,
  address: `0x${string}`,
  chainId: number
): Promise<number> {
  let nonce = await client.getTransactionCount({
    address,
    blockTag: 'pending'
  });

  const lastUsed = lastNonceRef.current[chainId] ?? -1;
  if (lastUsed >= nonce) {
    nonce = lastUsed + 1;
  }

  lastNonceRef.current[chainId] = nonce;
  return nonce;
}
```

### Backend/Bot Pattern

```typescript
class NonceManager {
  private nonces: Map<string, number> = new Map();
  private locks: Map<string, Promise<void>> = new Map();

  async getNextNonce(client: PublicClient, address: string): Promise<number> {
    const existing = this.locks.get(address);
    if (existing) await existing;

    let resolve: () => void;
    this.locks.set(address, new Promise(r => resolve = r));

    try {
      const networkNonce = await client.getTransactionCount({
        address: address as `0x${string}`,
        blockTag: 'pending'
      });

      const lastUsed = this.nonces.get(address) ?? -1;
      const nonce = Math.max(networkNonce, lastUsed + 1);

      this.nonces.set(address, nonce);
      return nonce;
    } finally {
      resolve!();
      this.locks.delete(address);
    }
  }

  reset(address: string) {
    this.nonces.delete(address);
  }
}
```

MegaETH's ~10ms blocks mean transactions confirm quickly, but rapid-fire sends may hit the RPC before the first confirms. Without local tracking, both get the same nonce resulting in "already known" errors.

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "nonce too low" | Tx already executed | Check receipt, do not retry |
| "already known" | Tx pending or duplicate nonce | Use nonce manager, increment locally |
| "insufficient funds" | Not enough ETH | Check balance, fund wallet |
| "intrinsic gas too low" | Gas limit too low | Increase gas or use remote estimation |

## Security Notes

1. Never expose private keys -- use environment variables
2. Confirm before sending -- show recipient, amount, gas before execution
3. Use hardware wallets for large amounts
4. Verify contract addresses on explorer before interacting
