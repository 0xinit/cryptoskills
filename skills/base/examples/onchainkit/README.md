# OnchainKit Examples

OnchainKit is Coinbase's React component library for building onchain apps on Base. It provides composable components for identity, transactions, swaps, wallets, and Farcaster frames.

## Installation

```bash
npm install @coinbase/onchainkit viem wagmi @tanstack/react-query
```

## Project Setup

### Provider Configuration

```tsx
// providers.tsx
'use client';

import { OnchainKitProvider } from '@coinbase/onchainkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { base } from 'viem/chains';
import { config } from './wagmi';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={process.env.NEXT_PUBLIC_CDP_API_KEY}
          chain={base}
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

### Wagmi Config with Coinbase Wallet

```typescript
// wagmi.ts
import { http, createConfig } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { coinbaseWallet } from 'wagmi/connectors';

export const config = createConfig({
  chains: [base, baseSepolia],
  connectors: [
    coinbaseWallet({
      appName: 'My OnchainKit App',
      preference: 'smartWalletOnly',
    }),
  ],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
});
```

### CSS Import

```tsx
// layout.tsx or global import
import '@coinbase/onchainkit/styles.css';
```

## Identity Components

Resolve and display onchain identity (ENS names, Basenames, Farcaster profiles, avatars).

### Full Identity Card

```tsx
import {
  Identity,
  Name,
  Avatar,
  Badge,
  Address,
} from '@coinbase/onchainkit/identity';

function UserProfile({ address }: { address: `0x${string}` }) {
  return (
    <Identity
      address={address}
      schemaId="0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9"
    >
      <Avatar />
      <Name>
        <Badge />
      </Name>
      <Address />
    </Identity>
  );
}
```

### Name Resolution Only

```tsx
import { Name } from '@coinbase/onchainkit/identity';

// Resolves ENS, Basenames, and Farcaster
<Name address="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" />
// Renders: "vitalik.eth"
```

### Avatar with Fallback

```tsx
import { Avatar } from '@coinbase/onchainkit/identity';

<Avatar
  address="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
  loadingComponent={<div className="h-8 w-8 bg-gray-200 rounded-full" />}
  defaultComponent={<div className="h-8 w-8 bg-blue-500 rounded-full" />}
/>
```

## Transaction Component

Submit contract calls with built-in status tracking, error handling, and receipt confirmation.

### Basic Contract Call

```tsx
import {
  Transaction,
  TransactionButton,
  TransactionStatus,
  TransactionStatusAction,
  TransactionStatusLabel,
} from '@coinbase/onchainkit/transaction';
import { base } from 'viem/chains';

const mintAbi = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'quantity', type: 'uint256' }],
    outputs: [],
  },
] as const;

function MintButton() {
  const contracts = [
    {
      address: '0xYourContractAddress' as `0x${string}`,
      abi: mintAbi,
      functionName: 'mint',
      args: [1n],
      value: 0n,
    },
  ];

  return (
    <Transaction
      chainId={base.id}
      contracts={contracts}
      onStatus={(status) => {
        if (status.statusName === 'success') {
          console.log('Minted!', status.statusData.transactionReceipts);
        }
      }}
    >
      <TransactionButton text="Mint NFT" />
      <TransactionStatus>
        <TransactionStatusLabel />
        <TransactionStatusAction />
      </TransactionStatus>
    </Transaction>
  );
}
```

### Sponsored Transaction (Paymaster)

```tsx
import {
  Transaction,
  TransactionButton,
  TransactionSponsor,
} from '@coinbase/onchainkit/transaction';

function SponsoredMint() {
  const contracts = [
    {
      address: '0xYourContract' as `0x${string}`,
      abi: mintAbi,
      functionName: 'mint',
      args: [1n],
    },
  ];

  return (
    <Transaction chainId={base.id} contracts={contracts}>
      <TransactionSponsor />
      <TransactionButton text="Mint (Free)" />
    </Transaction>
  );
}
```

## Swap Component

Token swap widget powered by DEX aggregation.

```tsx
import {
  Swap,
  SwapAmountInput,
  SwapButton,
  SwapMessage,
  SwapToggle,
} from '@coinbase/onchainkit/swap';
import type { Token } from '@coinbase/onchainkit/token';

const ETH_TOKEN: Token = {
  name: 'Ethereum',
  address: '' as `0x${string}`,
  symbol: 'ETH',
  decimals: 18,
  image: 'https://dynamic-assets.coinbase.com/dbb4b4983bde81309ddab83eb598358eb44375b930b94687ebe38bc22e52c3b2125258ffb8477a5ef22e33d6bd72e32a506c391caa13571fc9f385d9e4c32c242/asset_icons/f57c59f0f5e5f0e9a25e38c7e47ebe7b25c0e0421ce01aa06bdf000e0e3a3910.png',
  chainId: 8453,
};

const USDC_TOKEN: Token = {
  name: 'USD Coin',
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  symbol: 'USDC',
  decimals: 6,
  image: 'https://dynamic-assets.coinbase.com/3c15df5e2ac7d4abbe9499ed9335041f00c620f28e8de2f93474a9f432058742cdf4674bd43f309e69778a26969372310135be97eb183d91c492154176d455b18/asset_icons/9d67b728b6c8f457717154b3a35f9ddc702eae7e76c4684ee39302c4d7fd0bb8.png',
  chainId: 8453,
};

function SwapWidget() {
  return (
    <Swap>
      <SwapAmountInput label="Sell" token={ETH_TOKEN} type="from" />
      <SwapToggle />
      <SwapAmountInput label="Buy" token={USDC_TOKEN} type="to" />
      <SwapMessage />
      <SwapButton />
    </Swap>
  );
}
```

## Wallet Components

### Connect Wallet with Identity

```tsx
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
  WalletDropdownLink,
} from '@coinbase/onchainkit/wallet';
import { Avatar, Name, Identity } from '@coinbase/onchainkit/identity';

function WalletConnect() {
  return (
    <Wallet>
      <ConnectWallet>
        <Avatar className="h-6 w-6" />
        <Name />
      </ConnectWallet>
      <WalletDropdown>
        <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
          <Avatar />
          <Name />
        </Identity>
        <WalletDropdownLink icon="wallet" href="https://wallet.coinbase.com">
          Go to Wallet Dashboard
        </WalletDropdownLink>
        <WalletDropdownDisconnect />
      </WalletDropdown>
    </Wallet>
  );
}
```

## Frame Components (Farcaster)

Build Farcaster Frames that render in Warpcast and other Farcaster clients.

```tsx
import { FrameMetadata } from '@coinbase/onchainkit/frame';
import type { Metadata } from 'next';

// In your Next.js page metadata
export const metadata: Metadata = {
  other: {
    ...FrameMetadata({
      buttons: [
        { label: 'Mint', action: 'tx', target: '/api/frame/mint' },
        { label: 'View', action: 'link', target: 'https://basescan.org' },
      ],
      image: {
        src: 'https://your-app.com/frame-image.png',
        aspectRatio: '1.91:1',
      },
      postUrl: 'https://your-app.com/api/frame',
    }),
  },
};
```

## Theming

OnchainKit supports custom themes:

```tsx
<OnchainKitProvider
  apiKey={process.env.NEXT_PUBLIC_CDP_API_KEY}
  chain={base}
  config={{
    appearance: {
      mode: 'dark',
      theme: 'cyberpunk',
    },
  }}
>
  {children}
</OnchainKitProvider>
```

Available built-in themes: `default`, `base`, `cyberpunk`, `hacker`.

Custom CSS variables are also supported — see https://onchainkit.xyz/guides/themes.
