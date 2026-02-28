# Transaction Flow

Four-state transaction component with `useWriteContract`, `useWaitForTransactionReceipt`, error decoding, user rejection handling, and explorer links.

## Dependencies

```bash
npm install wagmi viem @tanstack/react-query
```

## Transaction State Machine

```
idle -> awaiting-signature -> pending -> confirmed
  ^          |                   |           |
  |          v                   v           v
  +---- (user rejects) ---- (dropped) --- (reverted) -> failed
```

## Complete Four-State Transaction Component

```tsx
// transaction-form.tsx
"use client";

import { useState } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useAccount,
} from "wagmi";
import { parseUnits } from "viem";
import {
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
} from "viem";

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

type TxState = "idle" | "awaiting-signature" | "pending" | "confirmed" | "failed";

const EXPLORER_URLS: Record<number, string> = {
  1: "https://etherscan.io",
  10: "https://optimistic.etherscan.io",
  137: "https://polygonscan.com",
  8453: "https://basescan.org",
  42161: "https://arbiscan.io",
};

function decodeError(error: Error): string {
  if (error instanceof BaseError) {
    const revert = error.walk(
      (e) => e instanceof ContractFunctionRevertedError
    );
    if (revert instanceof ContractFunctionRevertedError) {
      if (revert.data?.errorName) {
        const args = revert.data.args?.map(String).join(", ") ?? "";
        return `${revert.data.errorName}(${args})`;
      }
      return revert.reason ?? "Transaction would revert";
    }
    return error.shortMessage;
  }
  return error.message;
}

function isUserRejection(error: Error): boolean {
  if (error instanceof UserRejectedRequestError) return true;
  const msg = error.message.toLowerCase();
  return msg.includes("user rejected") || msg.includes("user denied");
}

export function TransferForm({
  token,
  decimals,
  tokenSymbol,
}: {
  token: `0x${string}`;
  decimals: number;
  tokenSymbol: string;
}) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");

  const {
    writeContract,
    data: hash,
    isPending: isSigning,
    error: writeError,
    reset,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  function getTxState(): TxState {
    if (isSigning) return "awaiting-signature";
    if (isConfirming && hash) return "pending";
    if (isSuccess && receipt?.status === "success") return "confirmed";
    if (
      receipt?.status === "reverted" ||
      (writeError && !isUserRejection(writeError)) ||
      receiptError
    ) {
      return "failed";
    }
    return "idle";
  }

  const txState = getTxState();

  // User rejection: silent reset
  if (writeError && isUserRejection(writeError)) {
    reset();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!to || !amount) return;

    writeContract({
      address: token,
      abi: erc20Abi,
      functionName: "transfer",
      args: [to as `0x${string}`, parseUnits(amount, decimals)],
    });
  }

  if (!isConnected) {
    return <p>Connect your wallet to transfer tokens.</p>;
  }

  const explorerBase = EXPLORER_URLS[chainId] ?? "https://etherscan.io";

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="recipient">Recipient</label>
        <input
          id="recipient"
          placeholder="0x..."
          value={to}
          onChange={(e) => setTo(e.target.value)}
          disabled={txState !== "idle"}
        />
      </div>
      <div>
        <label htmlFor="amount">Amount ({tokenSymbol})</label>
        <input
          id="amount"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={txState !== "idle"}
          inputMode="decimal"
        />
      </div>

      <button
        type="submit"
        disabled={txState !== "idle" || !to || !amount}
        aria-busy={txState === "awaiting-signature" || txState === "pending"}
      >
        {txState === "idle" && `Transfer ${tokenSymbol}`}
        {txState === "awaiting-signature" && "Confirm in wallet..."}
        {txState === "pending" && "Waiting for confirmation..."}
        {txState === "confirmed" && "Transfer complete"}
        {txState === "failed" && "Transaction failed"}
      </button>

      {txState === "pending" && hash && (
        <p>
          Transaction submitted.{" "}
          <a href={`${explorerBase}/tx/${hash}`} target="_blank" rel="noopener noreferrer">
            View on explorer
          </a>
        </p>
      )}

      {txState === "confirmed" && hash && receipt && (
        <div>
          <p>
            Confirmed in block {receipt.blockNumber.toString()}.{" "}
            <a
              href={`${explorerBase}/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on explorer
            </a>
          </p>
          <p>Gas used: {receipt.gasUsed.toString()}</p>
          <button type="button" onClick={() => reset()}>
            Send another
          </button>
        </div>
      )}

      {txState === "failed" && (
        <div role="alert">
          {receipt?.status === "reverted" && <p>Transaction reverted on-chain.</p>}
          {writeError && !isUserRejection(writeError) && (
            <p>{decodeError(writeError)}</p>
          )}
          {receiptError && <p>{decodeError(receiptError)}</p>}
          <button type="button" onClick={() => reset()}>
            Try again
          </button>
        </div>
      )}
    </form>
  );
}
```

## Error Categories by Phase

| Phase | Hook | Error Type | UX Treatment |
|-------|------|-----------|--------------|
| Simulation | `useSimulateContract` | Contract revert | Inline warning, disable submit |
| Signing | `useWriteContract` | User rejection (4001) | Silent reset, no toast |
| Signing | `useWriteContract` | Other wallet error | Inline error with retry |
| Confirmation | `useWaitForTransactionReceipt` | Timeout/dropped | Toast with explorer link |
| On-chain | Receipt check | `status === "reverted"` | Inline error with decoded reason |

## Optimistic UI Updates

For better perceived performance, update the UI optimistically before the transaction confirms, then reconcile when the receipt arrives.

```tsx
import { useQueryClient } from "@tanstack/react-query";

function useOptimisticUpdate() {
  const queryClient = useQueryClient();

  function optimisticBalanceUpdate(
    token: `0x${string}`,
    account: `0x${string}`,
    delta: bigint
  ) {
    queryClient.setQueryData(
      ["readContract", { address: token, functionName: "balanceOf", args: [account] }],
      (prev: bigint | undefined) => (prev !== undefined ? prev - delta : prev)
    );
  }

  function reconcileOnConfirmation() {
    queryClient.invalidateQueries();
  }

  return { optimisticBalanceUpdate, reconcileOnConfirmation };
}
```
