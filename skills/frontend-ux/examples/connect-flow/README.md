# Connect Flow

Complete wallet connection component using RainbowKit with all connection states, network mismatch handling, mobile detection, and EIP-6963 multi-wallet discovery.

## Dependencies

```bash
npm install @rainbow-me/rainbowkit wagmi viem @tanstack/react-query
```

## Config

```typescript
// config.ts
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, arbitrum, base, optimism } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "My dApp",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,
  chains: [mainnet, arbitrum, base, optimism],
  ssr: true,
});
```

## Provider Setup

```tsx
// providers.tsx
"use client";

import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "./config";
import { useState, type ReactNode } from "react";
import "@rainbow-me/rainbowkit/styles.css";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

## Custom Connect Button with All States

```tsx
// connect-button.tsx
"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const connected = mounted && account && chain;

        if (!mounted) {
          return (
            <button disabled aria-hidden style={{ opacity: 0 }}>
              Connect Wallet
            </button>
          );
        }

        if (!connected) {
          return (
            <button onClick={openConnectModal} type="button">
              Connect Wallet
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              onClick={openChainModal}
              type="button"
              aria-label="Switch to a supported network"
            >
              Wrong Network
            </button>
          );
        }

        return (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={openChainModal} type="button" aria-label="Switch network">
              {chain.hasIcon && chain.iconUrl && (
                <img
                  src={chain.iconUrl}
                  alt={chain.name ?? "Chain icon"}
                  width={16}
                  height={16}
                  style={{ marginRight: 4 }}
                />
              )}
              {chain.name}
            </button>
            <button onClick={openAccountModal} type="button">
              {account.displayName}
              {account.displayBalance ? ` (${account.displayBalance})` : ""}
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
```

## Mobile Detection and Deep-Link Handling

```tsx
// use-mobile.ts
function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

function isInAppBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return (
    ua.includes("metamask") ||
    ua.includes("coinbase") ||
    ua.includes("trust") ||
    ua.includes("rainbow")
  );
}

// In-app browsers already have a provider injected.
// Regular mobile browsers need WalletConnect QR or deep links.
// RainbowKit handles both cases automatically.
```

## Connection State Machine

| State | `mounted` | `account` | `chain` | `chain.unsupported` | UI |
|-------|:-:|:-:|:-:|:-:|-----|
| SSR / hydrating | false | -- | -- | -- | Hidden placeholder |
| Disconnected | true | null | null | -- | "Connect Wallet" button |
| Connected, correct chain | true | set | set | false | Address + chain name |
| Connected, wrong chain | true | set | set | true | "Wrong Network" button |

## EIP-6963 Wallet Discovery

RainbowKit automatically detects all EIP-6963-compliant wallets. No extra configuration needed. Each discovered wallet appears in the connect modal with its icon and name.

If you need to access the raw connector list programmatically:

```tsx
import { useConnect } from "wagmi";

function AvailableWallets() {
  const { connectors } = useConnect();

  return (
    <ul>
      {connectors.map((c) => (
        <li key={c.uid}>
          {c.icon && <img src={c.icon} alt="" width={20} height={20} />}
          {c.name}
        </li>
      ))}
    </ul>
  );
}
```
