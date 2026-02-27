# Multi-Chain Config

Configuring wagmi v2 for multiple EVM chains with per-chain transports, chain switching, and chain-aware contract reads.

## Dependencies

```bash
npm install wagmi viem @tanstack/react-query
```

## Multi-Chain Config

Each chain requires its own transport entry. Omitting a chain from `transports` causes a runtime error when that chain is active.

```typescript
// config.ts
import { http, createConfig } from "wagmi";
import {
  mainnet,
  arbitrum,
  optimism,
  base,
  polygon,
  sepolia,
} from "wagmi/chains";
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors";

export const config = createConfig({
  chains: [mainnet, arbitrum, optimism, base, polygon, sepolia],
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,
    }),
    coinbaseWallet({ appName: "Multi-Chain dApp" }),
  ],
  transports: {
    [mainnet.id]: http(process.env.NEXT_PUBLIC_RPC_MAINNET),
    [arbitrum.id]: http(process.env.NEXT_PUBLIC_RPC_ARBITRUM),
    [optimism.id]: http(process.env.NEXT_PUBLIC_RPC_OPTIMISM),
    [base.id]: http(process.env.NEXT_PUBLIC_RPC_BASE),
    [polygon.id]: http(process.env.NEXT_PUBLIC_RPC_POLYGON),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_RPC_SEPOLIA),
  },
});
```

## Chain Switcher Component

```tsx
// chain-switcher.tsx
"use client";

import { useChainId, useSwitchChain, useAccount } from "wagmi";

export function ChainSwitcher() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { chains, switchChain, isPending, error } = useSwitchChain();

  if (!isConnected) return null;

  return (
    <div>
      <h3>Switch Chain</h3>
      <div>
        {chains.map((chain) => (
          <button
            key={chain.id}
            onClick={() => switchChain({ chainId: chain.id })}
            disabled={isPending || chain.id === chainId}
            aria-pressed={chain.id === chainId}
          >
            {chain.name}
            {chain.id === chainId ? " (active)" : ""}
          </button>
        ))}
      </div>
      {isPending && <p>Switching chain...</p>}
      {error && <p>Switch failed: {error.message}</p>}
    </div>
  );
}
```

## Cross-Chain Contract Reads

Read from a specific chain regardless of the wallet's current chain using the `chainId` parameter.

```tsx
// cross-chain-balance.tsx
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { mainnet, arbitrum, base } from "wagmi/chains";

const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// USDC addresses per chain
const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  [mainnet.id]: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  [arbitrum.id]: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  [base.id]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};

interface ChainBalance {
  chainName: string;
  chainId: number;
}

const CHAINS_TO_CHECK: ChainBalance[] = [
  { chainName: "Ethereum", chainId: mainnet.id },
  { chainName: "Arbitrum", chainId: arbitrum.id },
  { chainName: "Base", chainId: base.id },
];

function CrossChainUsdcBalance({ account }: { account: `0x${string}` }) {
  return (
    <div>
      <h3>USDC Balances Across Chains</h3>
      {CHAINS_TO_CHECK.map((chain) => (
        <SingleChainBalance
          key={chain.chainId}
          account={account}
          chainId={chain.chainId}
          chainName={chain.chainName}
          tokenAddress={USDC_ADDRESSES[chain.chainId]}
        />
      ))}
    </div>
  );
}

function SingleChainBalance({
  account,
  chainId,
  chainName,
  tokenAddress,
}: {
  account: `0x${string}`;
  chainId: number;
  chainName: string;
  tokenAddress: `0x${string}`;
}) {
  const { data: balance, isLoading, error } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account],
    chainId,
  });

  const formatted = balance !== undefined ? formatUnits(balance, 6) : null;

  return (
    <div>
      <span>{chainName}: </span>
      {isLoading && <span>Loading...</span>}
      {error && <span>Error</span>}
      {formatted && <span>{formatted} USDC</span>}
    </div>
  );
}
```

## Custom Chain Definition

For chains not included in wagmi/viem's built-in list, define a custom chain object.

```typescript
import { defineChain } from "viem";
import { http, createConfig } from "wagmi";
import { mainnet } from "wagmi/chains";

const myCustomChain = defineChain({
  id: 99999,
  name: "My Custom Chain",
  nativeCurrency: {
    decimals: 18,
    name: "Custom Token",
    symbol: "CTK",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.mycustomchain.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "CustomScan",
      url: "https://scan.mycustomchain.com",
    },
  },
  testnet: false,
});

export const config = createConfig({
  chains: [mainnet, myCustomChain],
  transports: {
    [mainnet.id]: http(),
    [myCustomChain.id]: http("https://rpc.mycustomchain.com"),
  },
});
```

## Fallback Transports

Use fallback transports for reliability. wagmi tries each transport in order, falling back to the next on failure.

```typescript
import { http, fallback, createConfig } from "wagmi";
import { mainnet } from "wagmi/chains";

export const config = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: fallback([
      http(process.env.NEXT_PUBLIC_ALCHEMY_URL),
      http(process.env.NEXT_PUBLIC_INFURA_URL),
      http("https://eth.llamarpc.com"),
    ]),
  },
});
```

## SSR with Multi-Chain

For Next.js apps, combine multi-chain config with SSR support.

```typescript
import { http, createConfig, createStorage, cookieStorage } from "wagmi";
import { mainnet, arbitrum, base } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const config = createConfig({
  chains: [mainnet, arbitrum, base],
  connectors: [injected()],
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
  transports: {
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
  },
});
```

## Chain ID Reference

| Chain | Import Name | Chain ID | Native Currency |
|-------|-------------|----------|----------------|
| Ethereum | `mainnet` | 1 | ETH |
| Sepolia | `sepolia` | 11155111 | ETH |
| Arbitrum One | `arbitrum` | 42161 | ETH |
| Optimism | `optimism` | 10 | ETH |
| Base | `base` | 8453 | ETH |
| Polygon | `polygon` | 137 | POL |
| zkSync Era | `zkSync` | 324 | ETH |

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Missing transport for a chain | `ChainNotConfiguredError` | Add transport entry for every chain in `chains` array |
| Using `useNetwork()` | Import error | Use `useChainId()` + `useSwitchChain()` instead |
| Hardcoding chain ID as number | No type safety | Use `mainnet.id`, `arbitrum.id`, etc. |
| Not handling chain switch rejection | Stuck UI | Check `useSwitchChain().error` |
