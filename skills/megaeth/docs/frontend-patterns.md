# Frontend Patterns (React / Next.js)

## Architecture Principle

Never open per-user WebSocket connections. Use one connection, broadcast to users.

```
Wrong: Each user -> WebSocket -> MegaETH
Right: Server -> WebSocket -> MegaETH, Server -> broadcast -> Users
```

## Real-time Data Flow

### Server-Side WebSocket Manager

```typescript
import WebSocket from 'ws';

class MegaETHStream {
  private ws: WebSocket | null = null;
  private subscribers = new Set<(data: any) => void>();
  private keepaliveInterval: NodeJS.Timeout | null = null;

  connect() {
    this.ws = new WebSocket('wss://mainnet.megaeth.com/ws');

    this.ws.on('open', () => {
      this.ws!.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_subscribe',
        params: ['miniBlocks'],
        id: 1
      }));

      this.keepaliveInterval = setInterval(() => {
        this.ws!.send(JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_chainId',
          params: [],
          id: Date.now()
        }));
      }, 30000);
    });

    this.ws.on('message', (data) => {
      const parsed = JSON.parse(data.toString());
      if (parsed.method === 'eth_subscription') {
        this.subscribers.forEach(fn => fn(parsed.params.result));
      }
    });

    this.ws.on('close', () => {
      if (this.keepaliveInterval) clearInterval(this.keepaliveInterval);
      setTimeout(() => this.connect(), 1000);
    });
  }

  subscribe(callback: (data: any) => void) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
}

export const megaStream = new MegaETHStream();
```

### Client-Side Hook

```typescript
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

interface MiniBlock {
  block_number: number;
  transactions: unknown[];
}

export function useMiniBlocks() {
  const [latestBlock, setLatestBlock] = useState<MiniBlock | null>(null);
  const [tps, setTps] = useState(0);

  useEffect(() => {
    const socket = io('/api/stream');

    socket.on('miniBlock', (block: MiniBlock) => {
      setLatestBlock(block);
      setTps(block.transactions.length * 100); // ~100 mini-blocks/sec
    });

    return () => { socket.disconnect(); };
  }, []);

  return { latestBlock, tps };
}
```

## Connection Warmup

First HTTP request to an RPC endpoint incurs connection overhead (DNS + TCP + TLS handshake). For latency-sensitive apps, warm up the connection on startup:

```typescript
async function warmupRpcConnection(client: PublicClient) {
  await client.getChainId();
}
```

MegaETH has <10ms block times. A cold connection can add 50-200ms of overhead on the first request. Warming up ensures the connection pool is ready when users transact.

Best practice: call `eth_chainId` or `eth_blockNumber` on app initialization, wallet connection, and network switch.

## Transaction Submission

### Optimized Flow

```typescript
import { createWalletClient, http } from 'viem';
import { megaeth } from './chains';

export async function submitTransaction(signedTx: `0x${string}`) {
  const client = createWalletClient({
    chain: megaeth,
    transport: http('https://mainnet.megaeth.com/rpc')
  });

  const receipt = await client.request({
    method: 'eth_sendRawTransactionSync',
    params: [signedTx]
  });

  return receipt;
}
```

### Chain Configuration (viem)

```typescript
import { defineChain } from 'viem';

export const megaeth = defineChain({
  id: 4326,
  name: 'MegaETH',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.megaeth.com/rpc'] }
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://mega.etherscan.io' }
  }
});

export const megaethTestnet = defineChain({
  id: 6343,
  name: 'MegaETH Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://carrot.megaeth.com/rpc'] }
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://megaeth-testnet-v2.blockscout.com' }
  }
});
```

## Gas Configuration

```typescript
// Use base fee directly, no buffer
const gasPrice = 1000000n; // 0.001 gwei

const tx = await walletClient.sendTransaction({
  to: recipient,
  value: amount,
  gas: 60000n,                // MegaETH intrinsic gas (not 21000)
  maxFeePerGas: 1000000n,
  maxPriorityFeePerGas: 0n
});
```

## RPC Request Batching (v2.0.14+)

Multicall is preferred for batching `eth_call` requests:

```typescript
import { multicall } from 'viem/actions';

const results = await multicall(client, {
  contracts: [
    { address: token1, abi: erc20Abi, functionName: 'balanceOf', args: [user] },
    { address: token2, abi: erc20Abi, functionName: 'balanceOf', args: [user] },
    { address: pool, abi: poolAbi, functionName: 'getReserves' },
  ]
});
```

Do not batch `eth_getLogs` with `eth_call` -- logs are always slower.

## Historical Data

Never block UX waiting for historical queries:

```typescript
useEffect(() => {
  fetchHistoricalTrades().then(setTrades);
}, []);

// Use indexers for heavy queries
// Recommended: Envio HyperSync
// https://docs.envio.dev/docs/HyperSync/overview
```

## Error Handling

```typescript
const TX_ERRORS: Record<string, string> = {
  'nonce too low': 'Transaction already executed',
  'already known': 'Transaction pending',
  'intrinsic gas too low': 'Increase gas limit',
  'insufficient funds': 'Not enough ETH for gas'
};

function handleTxError(error: Error): string {
  for (const [pattern, message] of Object.entries(TX_ERRORS)) {
    if (error.message.includes(pattern)) {
      return message;
    }
  }
  return 'Transaction failed';
}
```
