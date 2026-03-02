# Approval Flow

Token approval component with infinite vs exact approval toggle, Permit2 integration, allowance checking, and approval revocation.

## Dependencies

```bash
npm install wagmi viem @tanstack/react-query
```

## Check Current Allowance

```tsx
// use-allowance.ts
import { useReadContract } from "wagmi";

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

function useAllowance({
  token,
  owner,
  spender,
}: {
  token: `0x${string}`;
  owner: `0x${string}` | undefined;
  spender: `0x${string}`;
}) {
  const { data, isLoading, refetch } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: owner ? [owner, spender] : undefined,
    query: { enabled: !!owner },
  });

  return { allowance: data, isLoading, refetch };
}
```

## Approval Component with Infinite vs Exact Toggle

```tsx
// approval-manager.tsx
"use client";

import { useState } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useReadContract,
} from "wagmi";
import { formatUnits } from "viem";

const MAX_UINT256 = 2n ** 256n - 1n;

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

export function ApprovalManager({
  token,
  spender,
  requiredAmount,
  decimals,
  tokenSymbol,
  onApprovalComplete,
}: {
  token: `0x${string}`;
  spender: `0x${string}`;
  requiredAmount: bigint;
  decimals: number;
  tokenSymbol: string;
  onApprovalComplete: () => void;
}) {
  const { address } = useAccount();
  const [useInfinite, setUseInfinite] = useState(false);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, spender] : undefined,
    query: { enabled: !!address },
  });

  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  if (isSuccess) {
    refetchAllowance();
    onApprovalComplete();
  }

  const needsApproval = allowance !== undefined && allowance < requiredAmount;

  if (!needsApproval) return null;

  const approvalAmount = useInfinite ? MAX_UINT256 : requiredAmount;

  return (
    <div>
      <p>
        Current allowance: {formatUnits(allowance, decimals)} {tokenSymbol}
      </p>
      <p>
        Required: {formatUnits(requiredAmount, decimals)} {tokenSymbol}
      </p>

      <label>
        <input
          type="checkbox"
          checked={useInfinite}
          onChange={(e) => setUseInfinite(e.target.checked)}
        />
        Unlimited approval (saves gas on future transactions, but increases
        risk if the spender contract is compromised)
      </label>

      <button
        onClick={() =>
          writeContract({
            address: token,
            abi: erc20Abi,
            functionName: "approve",
            args: [spender, approvalAmount],
          })
        }
        disabled={isPending || isConfirming}
        aria-busy={isPending || isConfirming}
      >
        {isPending
          ? "Confirm in wallet..."
          : isConfirming
            ? "Confirming approval..."
            : `Approve ${useInfinite ? "unlimited" : formatUnits(requiredAmount, decimals)} ${tokenSymbol}`}
      </button>
    </div>
  );
}
```

## Permit2 Flow

Permit2 replaces per-spender approvals with a single approval to the Permit2 contract, then off-chain EIP-712 signatures for each interaction.

```tsx
// permit2-flow.tsx
"use client";

import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useSignTypedData,
  useAccount,
  useChainId,
} from "wagmi";

// Same on all EVM chains -- Last verified: February 2026
const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;

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

const MAX_UINT256 = 2n ** 256n - 1n;

export function Permit2ApproveAndSign({
  token,
  spender,
  amount,
  nonce,
  deadline,
  onSignatureReady,
}: {
  token: `0x${string}`;
  spender: `0x${string}`;
  amount: bigint;
  nonce: bigint;
  deadline: bigint;
  onSignatureReady: (signature: `0x${string}`) => void;
}) {
  const { address } = useAccount();
  const chainId = useChainId();

  // Step 1: Check if token is approved to Permit2
  const { data: permit2Allowance } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, PERMIT2_ADDRESS] : undefined,
    query: { enabled: !!address },
  });

  const { writeContract, data: approveHash, isPending: isApproving } =
    useWriteContract();
  const { isLoading: isApproveConfirming, isSuccess: approveConfirmed } =
    useWaitForTransactionReceipt({ hash: approveHash });

  // Step 2: Sign the permit
  const { signTypedData, data: signature, isPending: isSigning } =
    useSignTypedData();

  if (signature) {
    onSignatureReady(signature);
  }

  const needsPermit2Approval =
    permit2Allowance !== undefined && permit2Allowance < amount;

  if (needsPermit2Approval) {
    return (
      <button
        onClick={() =>
          writeContract({
            address: token,
            abi: erc20Abi,
            functionName: "approve",
            args: [PERMIT2_ADDRESS, MAX_UINT256],
          })
        }
        disabled={isApproving || isApproveConfirming}
      >
        {isApproving
          ? "Confirm in wallet..."
          : isApproveConfirming
            ? "Confirming..."
            : "Approve token for Permit2"}
      </button>
    );
  }

  return (
    <button
      onClick={() =>
        signTypedData({
          domain: {
            name: "Permit2",
            chainId,
            verifyingContract: PERMIT2_ADDRESS,
          },
          types: {
            PermitTransferFrom: [
              { name: "permitted", type: "TokenPermissions" },
              { name: "spender", type: "address" },
              { name: "nonce", type: "uint256" },
              { name: "deadline", type: "uint256" },
            ],
            TokenPermissions: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" },
            ],
          },
          primaryType: "PermitTransferFrom",
          message: {
            permitted: { token, amount },
            spender,
            nonce,
            deadline,
          },
        })
      }
      disabled={isSigning}
    >
      {isSigning ? "Sign permit in wallet..." : "Sign permit"}
    </button>
  );
}
```

## Approval Revocation

```tsx
// revoke-approval.tsx
"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";

const approveAbi = [
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

export function RevokeApproval({
  token,
  spender,
  tokenSymbol,
  onRevoked,
}: {
  token: `0x${string}`;
  spender: `0x${string}`;
  tokenSymbol: string;
  onRevoked: () => void;
}) {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash });

  if (isSuccess) {
    onRevoked();
  }

  return (
    <button
      onClick={() =>
        writeContract({
          address: token,
          abi: approveAbi,
          functionName: "approve",
          args: [spender, 0n],
        })
      }
      disabled={isPending || isConfirming}
    >
      {isPending
        ? "Confirm in wallet..."
        : isConfirming
          ? "Revoking..."
          : `Revoke ${tokenSymbol} approval`}
    </button>
  );
}
```
