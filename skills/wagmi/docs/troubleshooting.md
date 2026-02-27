# wagmi Troubleshooting Guide

Common issues and solutions when building with wagmi v2.

## "No QueryClient set" -- Missing QueryClientProvider

**Symptoms:**
- `Error: No QueryClient set, use QueryClientProvider to set one`
- Happens on first render

**Cause:** wagmi v2 requires TanStack Query. The app must be wrapped in both `WagmiProvider` and `QueryClientProvider`.

**Fix:**
```tsx
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "./config";

const queryClient = new QueryClient();

function App({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

## "WagmiConfig is not exported" -- v1 Component Removed

**Symptoms:**
- `Module '"wagmi"' has no exported member 'WagmiConfig'`

**Cause:** wagmi v2 renamed `WagmiConfig` to `WagmiProvider` and removed the old export.

**Fix:**
```tsx
// Wrong (v1)
import { WagmiConfig } from "wagmi";

// Correct (v2)
import { WagmiProvider } from "wagmi";
```

## Hook Returns Undefined Data on First Render

**Symptoms:**
- `data` is `undefined` even though the contract exists
- Works after a moment or on re-render

**Cause:** TanStack Query fetches data asynchronously. On first render, `data` is always `undefined`.

**Fix:** Always check `isLoading` before accessing `data`:
```tsx
const { data, isLoading, error } = useReadContract({ /* ... */ });

if (isLoading) return <span>Loading...</span>;
if (error) return <span>Error: {error.message}</span>;
if (data === undefined) return null;

// Safe to use data here
```

## Hydration Mismatch in Next.js

**Symptoms:**
- `Hydration failed because the initial UI does not match what was rendered on the server`
- `Text content does not match server-rendered HTML`

**Cause:** Wallet state differs between server (disconnected) and client (connected from prior session).

**Fix:** Enable SSR mode with cookie storage:
```typescript
// config.ts
import { createConfig, createStorage, cookieStorage, http } from "wagmi";
import { mainnet } from "wagmi/chains";

export const config = createConfig({
  chains: [mainnet],
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
  transports: { [mainnet.id]: http() },
});
```

Then hydrate from cookies in the layout:
```tsx
// layout.tsx
import { headers } from "next/headers";
import { cookieToInitialState } from "wagmi";
import { config } from "./config";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const initialState = cookieToInitialState(config, headerList.get("cookie"));
  // Pass initialState to WagmiProvider
  return (
    <WagmiProvider config={config} initialState={initialState}>
      {/* ... */}
    </WagmiProvider>
  );
}
```

## ABI Type Inference Not Working

**Symptoms:**
- `args` and return type are `unknown` or `any`
- No autocomplete on function names

**Cause:** ABI is not declared with `as const`.

**Fix:**
```typescript
// Wrong -- loses type information
const abi = [
  { name: "balanceOf", type: "function", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }] },
];

// Correct -- full type inference
const abi = [
  { name: "balanceOf", type: "function", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }] },
] as const;
```

## Transaction Stuck / Never Confirms

**Symptoms:**
- `useWaitForTransactionReceipt` stays in `isLoading` indefinitely
- Transaction hash returned but no receipt

**Cause:** Transaction gas price too low, or RPC node does not have the transaction in its mempool.

**Fix:**
1. Check the transaction on a block explorer using the hash
2. If pending: user can speed up or cancel in their wallet
3. If not found: the transaction may have been dropped; retry
4. Set a timeout on the wait:
```tsx
const { data: receipt } = useWaitForTransactionReceipt({
  hash,
  // Poll more aggressively
  query: {
    refetchInterval: 2_000,
  },
});
```

## "ChainNotConfiguredError" After Chain Switch

**Symptoms:**
- Error thrown after wallet switches to a chain not in config
- Happens when wallet is on a chain your dApp does not support

**Cause:** The wallet's current chain is not in `createConfig({ chains })`.

**Fix:** Either add the chain to config, or prompt the user to switch:
```tsx
function ChainGuard({ children, requiredChainId }: {
  children: React.ReactNode;
  requiredChainId: number;
}) {
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  if (chainId !== requiredChainId) {
    return (
      <div>
        <p>Please switch to the correct network.</p>
        <button onClick={() => switchChain({ chainId: requiredChainId })}>
          Switch Network
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
```

## Connector Disappears from List

**Symptoms:**
- A previously visible connector no longer appears in `useConnect().connectors`

**Cause:** EIP-6963 discovery runs on page load. If the extension loads after wagmi initializes, it may be missed.

**Fix:** This is rare. The `injected()` connector with `shimDisconnect: true` handles most cases. If a specific wallet is critical, use its dedicated connector (e.g., `metaMask()`, `coinbaseWallet()`).

## Multiple Wallet Prompts on Page Load

**Symptoms:**
- Wallet popup appears immediately on page load
- Multiple connection attempts happen automatically

**Cause:** `injected()` connector auto-connects if it detects a previous session. With multiple injected wallets, each may try to reconnect.

**Fix:** Use `useReconnect` explicitly and handle the case where multiple connectors claim a prior session:
```typescript
import { createConfig } from "wagmi";
import { injected } from "wagmi/connectors";

const config = createConfig({
  // Disable auto-discovery if it causes issues
  multiInjectedProviderDiscovery: false,
  connectors: [
    injected({ shimDisconnect: true }),
  ],
  // ... chains and transports
});
```

## References

- wagmi FAQ: https://wagmi.sh/react/guides/faq
- v2 migration: https://wagmi.sh/react/guides/migrate-from-v1-to-v2
- TanStack Query docs: https://tanstack.com/query/latest/docs/react/overview
