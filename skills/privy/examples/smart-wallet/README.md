# Privy + Safe Smart Wallet

Working TypeScript/React example for using Privy's built-in smart wallet integration (powered by Safe) with gas sponsorship.

## Dependencies

```bash
npm install @privy-io/react-auth viem
```

## Provider Setup with Smart Wallets

```tsx
// app/providers.tsx
"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { base } from "viem/chains";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ["email", "google", "passkey"],
        embeddedWallets: {
          createOnLogin: "all-users",
        },
        // Enables Safe-based smart wallet for every embedded wallet
        smartWallets: {
          enabled: true,
        },
        defaultChain: base,
        supportedChains: [base],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
```

## Smart Wallet Component

```tsx
// components/SmartWallet.tsx
"use client";

import { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  parseEther,
  formatEther,
  type Hash,
} from "viem";
import { base } from "viem/chains";

export function SmartWallet() {
  const { authenticated } = usePrivy();
  const { ready, wallets } = useWallets();
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Smart wallet has walletClientType === "privy_smart_wallet"
  const smartWallet = wallets.find(
    (w) => w.walletClientType === "privy_smart_wallet"
  );
  // The embedded EOA wallet is the owner/signer
  const embeddedWallet = wallets.find(
    (w) => w.walletClientType === "privy"
  );

  if (!authenticated || !ready) {
    return <p>Please log in first.</p>;
  }

  if (!smartWallet) {
    return (
      <div>
        <p>Smart wallet not available.</p>
        {embeddedWallet && (
          <p>EOA signer ready: <code>{embeddedWallet.address}</code></p>
        )}
        <p>
          Ensure <code>smartWallets.enabled: true</code> is set in
          PrivyProvider config.
        </p>
      </div>
    );
  }

  async function handleSendSponsored() {
    if (!smartWallet) return;

    setSending(true);
    setError(null);
    setTxHash(null);

    try {
      const provider = await smartWallet.getEthereumProvider();
      const walletClient = createWalletClient({
        chain: base,
        transport: custom(provider),
      });

      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      const [account] = await walletClient.getAddresses();

      // Gas is sponsored through Privy's paymaster infrastructure
      // The user pays zero gas for this transaction
      const hash = await walletClient.sendTransaction({
        account,
        to: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as `0x${string}`,
        value: parseEther("0.0001"),
      });

      setTxHash(hash);

      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
      });

      if (receipt.status !== "success") {
        setError("Transaction reverted on-chain.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (
        message.includes("User rejected") ||
        message.includes("user denied")
      ) {
        setSending(false);
        return;
      }
      setError(message);
    } finally {
      setSending(false);
    }
  }

  const explorerUrl = txHash
    ? `https://basescan.org/tx/${txHash}`
    : null;

  return (
    <div>
      <h2>Smart Wallet (Safe)</h2>

      <dl>
        <dt>Smart Wallet Address</dt>
        <dd><code>{smartWallet.address}</code></dd>

        {embeddedWallet && (
          <>
            <dt>Signer (EOA)</dt>
            <dd><code>{embeddedWallet.address}</code></dd>
          </>
        )}
      </dl>

      <p>
        The smart wallet address is a Safe contract owned by your embedded
        wallet. Transactions are sponsored -- you pay zero gas.
      </p>

      <button
        onClick={handleSendSponsored}
        disabled={sending}
        aria-busy={sending}
      >
        {sending ? "Sending..." : "Send 0.0001 ETH (Sponsored)"}
      </button>

      {txHash && explorerUrl && (
        <p>
          Transaction: {" "}
          <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
            View on BaseScan
          </a>
        </p>
      )}

      {error && (
        <div role="alert">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
```

## Batch Transactions with Smart Wallet

Smart wallets support batched calls in a single transaction via the Safe's `multiSend` capability.

```typescript
import { encodeFunctionData } from "viem";

const erc20Abi = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

async function batchTransfer(smartWallet: ConnectedWallet) {
  const provider = await smartWallet.getEthereumProvider();

  // Privy smart wallets support eth_sendTransaction with batch encoding
  // through the Safe's built-in multiSend
  const walletClient = createWalletClient({
    chain: base,
    transport: custom(provider),
  });

  const [account] = await walletClient.getAddresses();
  const TOKEN = "0xTokenAddress..." as `0x${string}`;

  const hash = await walletClient.sendTransaction({
    account,
    to: TOKEN,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [
        "0xRecipient1..." as `0x${string}`,
        1000000n, // 1 USDC (6 decimals)
      ],
    }),
  });

  return hash;
}
```

## Notes

- **Smart wallet address differs from embedded wallet address.** The embedded wallet (EOA) is the owner/signer of the Safe smart wallet. Send funds to the smart wallet address, not the EOA.
- **Gas sponsorship** is configured in the Privy dashboard under your app's gas policy. On testnets, Privy sponsors gas by default. On mainnet, you configure sponsorship rules (per-user limits, allowlisted contracts, etc.).
- **Smart wallets are deployed lazily.** The Safe contract is deployed on the user's first transaction, not at wallet creation time. The address is deterministic (CREATE2) so it can receive funds before deployment.
- **The Safe smart wallet is a 1-of-1 multisig** with the Privy embedded wallet as the sole owner. For multi-owner Safe setups, use the Safe SDK directly with the Privy embedded wallet as one of the signers (see the `safe` skill).
- **Chain support:** Smart wallets work on any EVM chain in your `supportedChains` config. The same smart wallet address is valid across all chains (counterfactual deployment).
