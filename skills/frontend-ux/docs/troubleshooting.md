# frontend-ux Troubleshooting Guide

Common frontend issues when building dApps with wagmi, viem, and RainbowKit.

## Wallet Not Connecting on Mobile

**Symptoms:**
- Connect button does nothing in MetaMask Mobile or Coinbase Wallet app
- WalletConnect QR code does not appear in regular mobile browser

**Cause:** Mobile wallets use their own in-app browser. The injected provider is available but may initialize after your app. In regular mobile browsers, WalletConnect is the only connection method.

**Fix:**
1. Ensure WalletConnect connector is configured with a valid `projectId` from cloud.walletconnect.com
2. The `projectId` must be allowlisted for your domain
3. RainbowKit handles mobile detection automatically. If using raw wagmi connectors, include both `injected()` and `walletConnect()` in your config

```typescript
import { injected, walletConnect } from "wagmi/connectors";

const config = createConfig({
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,
      showQrModal: true,
    }),
  ],
  // ...
});
```

## Transaction Stuck at "Pending" Indefinitely

**Symptoms:**
- `useWaitForTransactionReceipt` stays in `isLoading` forever
- Transaction hash was returned but no receipt arrives

**Cause:** The transaction may have been dropped from the mempool (gas too low) or your RPC node does not have it.

**Fix:**
1. Check the transaction hash on a block explorer
2. If the tx is not found, it was dropped -- inform the user and offer retry
3. If pending with low gas, suggest the user speed up in their wallet
4. Set a reasonable polling interval:

```tsx
const { data: receipt } = useWaitForTransactionReceipt({
  hash,
  query: {
    refetchInterval: 2_000,
  },
});
```

5. Consider adding a manual timeout in your UI:

```tsx
const [timedOut, setTimedOut] = useState(false);

useEffect(() => {
  if (!hash) return;
  const timer = setTimeout(() => setTimedOut(true), 120_000);
  return () => clearTimeout(timer);
}, [hash]);
```

## Wrong Network Error After Connection

**Symptoms:**
- User connects successfully but transactions fail
- "Chain not configured" error appears

**Cause:** The user's wallet is on a chain not included in your wagmi `chains` config. wagmi does not switch chains automatically on connection.

**Fix:** Wrap your app content in a chain guard that prompts switching:

```tsx
import { useAccount, useChainId, useSwitchChain } from "wagmi";

function ChainGuard({ requiredChainId, children }: {
  requiredChainId: number;
  children: React.ReactNode;
}) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  if (isConnected && chainId !== requiredChainId) {
    return (
      <div>
        <p>Please switch to the correct network.</p>
        <button
          onClick={() => switchChain({ chainId: requiredChainId })}
          disabled={isPending}
        >
          Switch Network
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
```

## Hydration Mismatch with SSR (Next.js)

**Symptoms:**
- `Hydration failed because the initial UI does not match what was rendered on the server`
- Flash of "Connect Wallet" even though user is already connected

**Cause:** Server renders the disconnected state. Client reconnects from localStorage/cookies, causing a mismatch.

**Fix:** Enable SSR mode with cookie storage in wagmi config:

```typescript
import { createConfig, createStorage, cookieStorage } from "wagmi";

export const config = createConfig({
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
  // ...
});
```

Then hydrate from cookies in your layout:

```tsx
import { cookieToInitialState } from "wagmi";
import { headers } from "next/headers";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const initialState = cookieToInitialState(config, headerList.get("cookie"));

  return (
    <WagmiProvider config={config} initialState={initialState}>
      {children}
    </WagmiProvider>
  );
}
```

## wagmi Hook Called Outside Provider

**Symptoms:**
- `Error: useAccount must be used within WagmiProvider`
- `Error: No QueryClient set`

**Cause:** Component using wagmi hooks is rendered outside the provider tree. Common in Next.js when a page component uses hooks directly without being wrapped.

**Fix:** Ensure your provider hierarchy is:
1. `WagmiProvider` (outermost)
2. `QueryClientProvider` (inside WagmiProvider)
3. `RainbowKitProvider` (inside QueryClientProvider, if using RainbowKit)
4. Your components (innermost)

In Next.js App Router, providers must be in a client component:

```tsx
// providers.tsx
"use client";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

// layout.tsx (server component)
import { Providers } from "./providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

## RainbowKit Modal Not Styled

**Symptoms:**
- Wallet connect modal appears unstyled or broken
- CSS not loading

**Cause:** RainbowKit CSS import is missing.

**Fix:** Import the styles in your provider or layout file:

```tsx
import "@rainbow-me/rainbowkit/styles.css";
```

This import must be in a file that loads before any RainbowKit components render.

## References

- wagmi SSR guide: https://wagmi.sh/react/guides/ssr
- RainbowKit migration guide: https://rainbowkit.com/docs/migration-guide
- WalletConnect troubleshooting: https://docs.walletconnect.com/2.0/advanced/faq
