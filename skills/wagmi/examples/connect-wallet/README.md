# Connect Wallet

Complete wallet connection flow using wagmi v2 with multiple connector support, connection state handling, and auto-reconnection.

## Dependencies

```bash
npm install wagmi viem @tanstack/react-query
```

## Config

```typescript
// config.ts
import { http, createConfig } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors";

export const config = createConfig({
  chains: [mainnet, sepolia],
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,
    }),
    coinbaseWallet({ appName: "My dApp" }),
  ],
  transports: {
    [mainnet.id]: http(process.env.NEXT_PUBLIC_RPC_MAINNET),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_RPC_SEPOLIA),
  },
});
```

## Provider Wrapper

```tsx
// providers.tsx
"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "./config";
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

## Connect Button Component

```tsx
// connect-button.tsx
"use client";

import { useAccount, useConnect, useDisconnect, useEnsName } from "wagmi";

export function ConnectButton() {
  const { address, isConnected, isConnecting, isReconnecting, connector } =
    useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: ensName } = useEnsName({
    address,
    query: { enabled: !!address },
  });

  if (isConnecting || isReconnecting) {
    return <button disabled>Connecting...</button>;
  }

  if (isConnected && address) {
    const displayName =
      ensName ?? `${address.slice(0, 6)}...${address.slice(-4)}`;

    return (
      <div>
        <p>Connected as {displayName}</p>
        <p>via {connector?.name}</p>
        <button onClick={() => disconnect()}>Disconnect</button>
      </div>
    );
  }

  return (
    <div>
      <h3>Connect Wallet</h3>
      {connectors.map((c) => (
        <button
          key={c.uid}
          onClick={() => connect({ connector: c })}
          disabled={isPending}
        >
          {c.name}
        </button>
      ))}
      {error && <p>Connection failed: {error.message}</p>}
    </div>
  );
}
```

## Account Details Component

```tsx
// account-details.tsx
"use client";

import { useAccount, useBalance, useChainId } from "wagmi";

export function AccountDetails() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: balance, isLoading } = useBalance({
    address,
    query: { enabled: !!address },
  });

  if (!isConnected || !address) {
    return <p>Connect your wallet to view account details.</p>;
  }

  return (
    <div>
      <h3>Account</h3>
      <dl>
        <dt>Address</dt>
        <dd>{address}</dd>
        <dt>Chain ID</dt>
        <dd>{chainId}</dd>
        <dt>Balance</dt>
        <dd>
          {isLoading
            ? "Loading..."
            : balance
              ? `${balance.formatted} ${balance.symbol}`
              : "Unknown"}
        </dd>
      </dl>
    </div>
  );
}
```

## Connection State Machine

wagmi's `useAccount` exposes the connection lifecycle:

| State | `isConnecting` | `isReconnecting` | `isConnected` | `isDisconnected` |
|-------|:-:|:-:|:-:|:-:|
| Initial (no prior session) | false | false | false | true |
| User clicks connect | true | false | false | false |
| Page load with prior session | false | true | false | false |
| Connected | false | false | true | false |
| After disconnect | false | false | false | true |

## Handling Multiple Injected Wallets (EIP-6963)

wagmi v2 supports EIP-6963 multi-injected provider discovery by default. When `multiInjectedProviderDiscovery` is `true` (the default), `useConnect().connectors` automatically includes all detected browser wallets (MetaMask, Rabby, Phantom EVM, etc.) as separate entries.

```tsx
function WalletList() {
  const { connectors, connect } = useConnect();

  // connectors includes both configured connectors AND
  // auto-discovered EIP-6963 injected wallets
  return (
    <ul>
      {connectors.map((c) => (
        <li key={c.uid}>
          <button onClick={() => connect({ connector: c })}>
            {c.icon && <img src={c.icon} alt="" width={24} height={24} />}
            {c.name}
          </button>
        </li>
      ))}
    </ul>
  );
}
```

## Error Handling

Common connection errors and their causes:

| Error Message | Cause | Fix |
|---------------|-------|-----|
| "Connector not found" | Extension not installed | Show install link for that wallet |
| "User rejected the request" | User cancelled in wallet | Reset `isPending` state, let user retry |
| "Already processing" | Duplicate connect call | Disable button while `isPending` is true |
| "Chain not configured" | Wallet on unsupported chain | Prompt chain switch with `useSwitchChain` |
