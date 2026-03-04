# Send ETH from Embedded Wallet

Working TypeScript/React example for sending an ETH transaction from a Privy embedded wallet using viem.

## Dependencies

```bash
npm install @privy-io/react-auth viem
```

## Transaction Component

```tsx
// components/SendTransaction.tsx
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

type TxState =
  | "idle"
  | "switching-chain"
  | "awaiting-signature"
  | "pending"
  | "confirmed"
  | "failed";

export function SendTransaction() {
  const { authenticated } = usePrivy();
  const { ready, wallets } = useWallets();
  const [txState, setTxState] = useState<TxState>("idle");
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");

  const embeddedWallet = wallets.find(
    (w) => w.walletClientType === "privy"
  );

  if (!authenticated || !ready) {
    return <p>Please log in first.</p>;
  }

  if (!embeddedWallet) {
    return <p>No embedded wallet found. Wait for wallet creation.</p>;
  }

  async function handleSend() {
    if (!embeddedWallet) return;
    if (!recipient || !amount) return;

    setTxState("switching-chain");
    setError(null);
    setTxHash(null);

    try {
      await embeddedWallet.switchChain(base.id);

      setTxState("awaiting-signature");

      const provider = await embeddedWallet.getEthereumProvider();
      const walletClient = createWalletClient({
        chain: base,
        transport: custom(provider),
      });

      const publicClient = createPublicClient({
        chain: base,
        transport: http(),
      });

      const [account] = await walletClient.getAddresses();

      const hash = await walletClient.sendTransaction({
        account,
        to: recipient as `0x${string}`,
        value: parseEther(amount),
      });

      setTxHash(hash);
      setTxState("pending");

      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
      });

      if (receipt.status === "success") {
        setTxState("confirmed");
      } else {
        setTxState("failed");
        setError("Transaction reverted on-chain.");
      }
    } catch (err) {
      setTxState("failed");
      const message = err instanceof Error ? err.message : "Unknown error";

      // User rejection -- silently reset
      if (
        message.includes("User rejected") ||
        message.includes("user denied")
      ) {
        setTxState("idle");
        return;
      }

      setError(message);
    }
  }

  function reset() {
    setTxState("idle");
    setTxHash(null);
    setError(null);
  }

  const explorerUrl = txHash
    ? `https://basescan.org/tx/${txHash}`
    : null;

  const buttonLabels: Record<TxState, string> = {
    idle: "Send ETH",
    "switching-chain": "Switching to Base...",
    "awaiting-signature": "Confirm in wallet...",
    pending: "Waiting for confirmation...",
    confirmed: "Transaction confirmed",
    failed: "Transaction failed",
  };

  return (
    <div>
      <h2>Send ETH on Base</h2>
      <p>From: <code>{embeddedWallet.address}</code></p>

      <div>
        <label htmlFor="recipient">Recipient</label>
        <input
          id="recipient"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x..."
          disabled={txState !== "idle"}
        />
      </div>

      <div>
        <label htmlFor="amount">Amount (ETH)</label>
        <input
          id="amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.001"
          type="text"
          inputMode="decimal"
          disabled={txState !== "idle"}
        />
      </div>

      <button
        onClick={handleSend}
        disabled={txState !== "idle" && txState !== "failed"}
        aria-busy={
          txState === "switching-chain" ||
          txState === "awaiting-signature" ||
          txState === "pending"
        }
      >
        {buttonLabels[txState]}
      </button>

      {txState === "pending" && explorerUrl && (
        <p>
          Submitted.{" "}
          <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
            View on BaseScan
          </a>
        </p>
      )}

      {txState === "confirmed" && explorerUrl && (
        <div>
          <p>
            Confirmed.{" "}
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
              View on BaseScan
            </a>
          </p>
          <button onClick={reset}>Send another</button>
        </div>
      )}

      {txState === "failed" && error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={reset}>Try again</button>
        </div>
      )}
    </div>
  );
}
```

## Usage

```tsx
// app/send/page.tsx
"use client";

import { SendTransaction } from "@/components/SendTransaction";

export default function SendPage() {
  return (
    <main>
      <h1>Embedded Wallet Transaction</h1>
      <SendTransaction />
    </main>
  );
}
```

## Notes

- The component follows the four-state transaction lifecycle: idle, awaiting-signature, pending, confirmed/failed. See the `frontend-ux` skill for the full pattern.
- Chain switching is done before the transaction. The embedded wallet supports any EVM chain configured in `PrivyProvider.supportedChains`.
- User rejection (closing the signing popup) silently resets to idle -- no error toast.
- viem's `createWalletClient` with `custom(provider)` wraps Privy's EIP-1193 provider. This gives you full viem API (contract writes, typed data signing, etc.).
- Always use `parseEther` for ETH amounts and `bigint` for token amounts. Never use JavaScript `number`.
- The `publicClient` is used separately for `waitForTransactionReceipt` because the wallet client does not include read methods.
