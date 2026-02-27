# Write Transaction

Sending on-chain transactions with wagmi v2's `useWriteContract`, `useSimulateContract`, and `useWaitForTransactionReceipt`. Covers ERC-20 transfers, approve-then-execute flows, native ETH sends, and error handling.

## Dependencies

```bash
npm install wagmi viem @tanstack/react-query
```

## ERC-20 Transfer

```tsx
// transfer.tsx
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { parseUnits } from "viem";
import { useState } from "react";

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

function Transfer({ token, decimals }: { token: `0x${string}`; decimals: number }) {
  const { isConnected } = useAccount();
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
    isSuccess: isConfirmed,
    data: receipt,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!to || !amount) return;

    const parsedAmount = parseUnits(amount, decimals);

    writeContract({
      address: token,
      abi: erc20Abi,
      functionName: "transfer",
      args: [to as `0x${string}`, parsedAmount],
    });
  }

  if (!isConnected) return <p>Connect wallet first</p>;

  return (
    <form onSubmit={handleSubmit}>
      <input
        placeholder="Recipient (0x...)"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        disabled={isSigning || isConfirming}
      />
      <input
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        disabled={isSigning || isConfirming}
      />
      <button type="submit" disabled={isSigning || isConfirming || !to || !amount}>
        {isSigning
          ? "Confirm in wallet..."
          : isConfirming
            ? "Waiting for confirmation..."
            : "Transfer"}
      </button>

      {isConfirmed && receipt && (
        <div>
          <p>Confirmed in block {receipt.blockNumber.toString()}</p>
          <p>Gas used: {receipt.gasUsed.toString()}</p>
          <button type="button" onClick={() => reset()}>
            Send another
          </button>
        </div>
      )}

      {receipt?.status === "reverted" && (
        <p>Transaction reverted on-chain</p>
      )}

      {writeError && <p>Write error: {writeError.message}</p>}
      {receiptError && <p>Receipt error: {receiptError.message}</p>}
    </form>
  );
}
```

## Simulate Before Write

Use `useSimulateContract` for pre-flight validation. The simulation runs against the latest block and catches reverts before prompting the wallet.

```tsx
import {
  useSimulateContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther } from "viem";

const wethAbi = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
] as const;

const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;

function WrapEth() {
  const depositAmount = parseEther("0.1");

  const {
    data: simulation,
    error: simulateError,
    isLoading: isSimulating,
  } = useSimulateContract({
    address: WETH,
    abi: wethAbi,
    functionName: "deposit",
    value: depositAmount,
  });

  const { writeContract, data: hash, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  return (
    <div>
      <button
        onClick={() => {
          if (simulation) {
            writeContract(simulation.request);
          }
        }}
        disabled={isPending || isConfirming || isSimulating || !simulation}
      >
        {isSimulating
          ? "Simulating..."
          : isPending
            ? "Confirm in wallet..."
            : isConfirming
              ? "Confirming..."
              : "Wrap 0.1 ETH"}
      </button>
      {simulateError && <p>Simulation failed: {simulateError.message}</p>}
      {isSuccess && <p>Wrapped successfully! Tx: {hash}</p>}
    </div>
  );
}
```

## Approve-Then-Execute Flow

Most DeFi protocols require an ERC-20 approval before interacting. This pattern checks allowance, approves if needed, then executes the main transaction.

```tsx
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { parseUnits } from "viem";

const erc20Abi = [
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

function ApproveAndDeposit({
  token,
  spender,
  amount,
  decimals,
}: {
  token: `0x${string}`;
  spender: `0x${string}`;
  amount: string;
  decimals: number;
}) {
  const { address } = useAccount();
  const parsedAmount = parseUnits(amount, decimals);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, spender] : undefined,
    query: { enabled: !!address },
  });

  const {
    writeContract: approve,
    data: approveHash,
    isPending: isApproving,
  } = useWriteContract();

  const { isLoading: isApprovalConfirming, isSuccess: approvalDone } =
    useWaitForTransactionReceipt({ hash: approveHash });

  // Refetch allowance after approval confirms
  if (approvalDone) {
    refetchAllowance();
  }

  const needsApproval = allowance !== undefined && allowance < parsedAmount;

  if (needsApproval) {
    return (
      <button
        onClick={() =>
          approve({
            address: token,
            abi: erc20Abi,
            functionName: "approve",
            args: [spender, parsedAmount],
          })
        }
        disabled={isApproving || isApprovalConfirming}
      >
        {isApproving
          ? "Approving..."
          : isApprovalConfirming
            ? "Confirming approval..."
            : `Approve ${amount}`}
      </button>
    );
  }

  return <button>Deposit {amount}</button>;
}
```

## Send Native ETH

```tsx
import { useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";

function SendEth() {
  const {
    sendTransaction,
    data: hash,
    isPending,
    error,
  } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  return (
    <button
      onClick={() =>
        sendTransaction({
          to: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
          value: parseEther("0.01"),
        })
      }
      disabled={isPending || isConfirming}
    >
      {isPending
        ? "Confirm in wallet..."
        : isConfirming
          ? "Confirming..."
          : "Send 0.01 ETH"}
    </button>
  );
}
```

## Transaction Lifecycle

```
User clicks "Send"
    |
    v
writeContract() called
    |
    v
isPending = true (wallet prompt shown)
    |
    +--- User rejects ---> error set, isPending = false
    |
    v
User confirms in wallet
    |
    v
hash returned, isPending = false
    |
    v
useWaitForTransactionReceipt starts polling
    |
    v
isLoading = true (waiting for block inclusion)
    |
    +--- receipt.status === "reverted" ---> on-chain revert
    |
    v
isSuccess = true, receipt available
```

## Error Categories

| Phase | Error Source | How to Detect |
|-------|-------------|---------------|
| Simulation | Contract revert before wallet prompt | `useSimulateContract` error |
| Signing | User rejected or wallet error | `useWriteContract` error |
| Confirmation | Dropped tx or RPC timeout | `useWaitForTransactionReceipt` error |
| On-chain | Transaction mined but reverted | `receipt.status === "reverted"` |

## Parsing Revert Reasons

```tsx
import { BaseError, ContractFunctionRevertedError } from "viem";

function parseWriteError(error: Error): string {
  if (error instanceof BaseError) {
    const revert = error.walk(
      (e) => e instanceof ContractFunctionRevertedError
    );
    if (revert instanceof ContractFunctionRevertedError) {
      if (revert.data?.errorName) {
        return `${revert.data.errorName}(${revert.data.args?.join(", ") ?? ""})`;
      }
      return revert.reason ?? "Unknown revert";
    }
    return error.shortMessage;
  }
  return error.message;
}
```
