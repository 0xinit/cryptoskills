# wagmi v2 Connector Reference

Connectors handle communication between wagmi and wallet providers. All connectors are imported from `wagmi/connectors`.

## Import

```typescript
import {
  injected,
  walletConnect,
  coinbaseWallet,
  safe,
  metaMask,
} from "wagmi/connectors";
```

## Built-in Connectors

### injected

Connects to any browser extension wallet that injects an EIP-1193 provider (MetaMask, Rabby, Phantom EVM, Brave Wallet, etc.).

```typescript
import { injected } from "wagmi/connectors";

injected({
  // Emit disconnect event when switching to an unrecognized chain
  shimDisconnect: true,
  // Target a specific injected provider by its rdns (EIP-6963) or window property
  target: "io.metamask",
})
```

When `multiInjectedProviderDiscovery` is enabled in config (default: true), wagmi auto-discovers all EIP-6963 wallets and creates separate connector entries. You typically do not need to configure `target` unless you want to restrict to a single wallet.

### walletConnect

Connects via WalletConnect v2 protocol. Supports mobile wallets via QR code and desktop wallets via deep link.

```typescript
import { walletConnect } from "wagmi/connectors";

walletConnect({
  // Required: get from cloud.walletconnect.com
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,

  // Show the WalletConnect QR modal
  showQrModal: true,

  // dApp metadata displayed in wallet
  metadata: {
    name: "My dApp",
    description: "A decentralized application",
    url: "https://mydapp.com",
    icons: ["https://mydapp.com/icon.png"],
  },
})
```

**Requirements:**
- A WalletConnect Cloud project ID from https://cloud.walletconnect.com
- The project ID must be allowlisted for your dApp's domain

### coinbaseWallet

Connects to Coinbase Wallet (mobile app, browser extension, or Coinbase Smart Wallet).

```typescript
import { coinbaseWallet } from "wagmi/connectors";

coinbaseWallet({
  appName: "My dApp",
  appLogoUrl: "https://mydapp.com/logo.png",

  // "all" | "smartWalletOnly" | "eoaOnly"
  // "all" supports both Smart Wallet and traditional EOA
  preference: "all",
})
```

### metaMask

Dedicated MetaMask connector with MetaMask SDK integration. Provides additional features like MetaMask Mobile deep linking.

```typescript
import { metaMask } from "wagmi/connectors";

metaMask({
  // dApp metadata
  dappMetadata: {
    name: "My dApp",
    url: "https://mydapp.com",
  },
})
```

Use this over `injected()` when you need MetaMask-specific features like SDK-based mobile connection. For generic browser extension detection, `injected()` is sufficient.

### safe

Connects when the dApp is running inside a Safe (Gnosis Safe) App context.

```typescript
import { safe } from "wagmi/connectors";

safe({
  // Allow the connector in non-Safe contexts (for testing)
  allowedDomains: [/app\.safe\.global$/],
  debug: false,
})
```

This connector only activates when the page is loaded inside a Safe App iframe. It is safe to include in all configs -- it does nothing outside of Safe context.

## EIP-6963: Multi-Injected Provider Discovery

wagmi v2 supports EIP-6963 by default, which standardizes how browser wallets announce themselves. When enabled:

1. Each installed wallet appears as a separate connector in `useConnect().connectors`
2. Each connector includes `name`, `icon`, and a unique `uid`
3. No more conflicts between multiple injected wallets

```typescript
import { createConfig } from "wagmi";

const config = createConfig({
  // Default: true. Set to false to disable auto-discovery.
  multiInjectedProviderDiscovery: true,
  // ... rest of config
});
```

```tsx
function WalletList() {
  const { connectors } = useConnect();

  // connectors includes:
  // - Configured connectors (walletConnect, coinbaseWallet, etc.)
  // - Auto-discovered EIP-6963 injected wallets (MetaMask, Rabby, etc.)
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

## Connector Comparison

| Connector | Use Case | QR Code | Mobile | Extension | Smart Wallet |
|-----------|----------|:-------:|:------:|:---------:|:------------:|
| `injected` | Any browser wallet | No | No | Yes | No |
| `walletConnect` | Mobile and desktop wallets | Yes | Yes | No | No |
| `coinbaseWallet` | Coinbase ecosystem | Yes | Yes | Yes | Yes |
| `metaMask` | MetaMask-specific features | No | Yes | Yes | No |
| `safe` | Safe (Gnosis) multisig | No | No | No | No |

## Recommended Config

A typical production config includes `injected` for browser wallets, `walletConnect` for mobile, and `coinbaseWallet` for the Coinbase ecosystem.

```typescript
import { http, createConfig } from "wagmi";
import { mainnet } from "wagmi/chains";
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors";

export const config = createConfig({
  chains: [mainnet],
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,
    }),
    coinbaseWallet({ appName: "My dApp" }),
  ],
  transports: {
    [mainnet.id]: http(),
  },
});
```

## References

- Connectors API: https://wagmi.sh/react/api/connectors
- WalletConnect Cloud: https://cloud.walletconnect.com
- EIP-6963 spec: https://eips.ethereum.org/EIPS/eip-6963
- Coinbase Smart Wallet: https://www.smartwallet.dev
