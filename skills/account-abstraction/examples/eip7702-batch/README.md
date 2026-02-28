# EIP-7702 Batch Transactions

Working TypeScript example for batching multiple calls in a single transaction using EIP-7702 EOA delegation with viem's experimental API.

## Dependencies

```bash
npm install viem
```

## Batch Executor Contract

The EOA delegates to a batch executor contract that implements a multi-call interface. This contract lives at a deterministic address and is called by the EOA after delegation.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

struct Call {
    address target;
    uint256 value;
    bytes data;
}

/// @notice Batch executor for EIP-7702 delegated EOAs
/// @dev The EOA delegates to this contract, then calls execute() on itself
contract BatchExecutor {
    error CallFailed(uint256 index);

    function execute(Call[] calldata calls) external payable {
        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, ) = calls[i].target.call{value: calls[i].value}(
                calls[i].data
            );
            if (!success) revert CallFailed(i);
        }
    }
}
```

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  parseAbi,
  encodeFunctionData,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { eip7702Actions } from "viem/experimental";

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http(process.env.RPC_URL),
}).extend(eip7702Actions());

const BATCH_EXECUTOR = process.env.BATCH_EXECUTOR_ADDRESS as Address;
```

## Sign Authorization

The authorization grants the EOA's code slot to point to the BatchExecutor implementation. The EOA can clear this delegation at any time.

```typescript
async function signDelegation() {
  const authorization = await walletClient.signAuthorization({
    contractAddress: BATCH_EXECUTOR,
  });

  return authorization;
}
```

## Batch Multiple Calls

```typescript
const batchExecutorAbi = parseAbi([
  "function execute((address target, uint256 value, bytes data)[] calls) external payable",
]);

const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function approve(address spender, uint256 amount) external returns (bool)",
]);

async function batchTransfers(
  token: Address,
  recipients: { to: Address; amount: bigint }[]
): Promise<`0x${string}`> {
  const authorization = await signDelegation();

  const calls = recipients.map(({ to, amount }) => ({
    target: token,
    value: 0n,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [to, amount],
    }),
  }));

  const hash = await walletClient.sendTransaction({
    authorizationList: [authorization],
    to: account.address,
    data: encodeFunctionData({
      abi: batchExecutorAbi,
      functionName: "execute",
      args: [calls],
    }),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Batch transaction reverted");

  return hash;
}
```

## Approve + Swap in One Transaction

A common DeFi pattern: approve a router and swap in a single atomic transaction.

```typescript
async function approveAndSwap(
  token: Address,
  router: Address,
  swapCalldata: `0x${string}`,
  approveAmount: bigint
): Promise<`0x${string}`> {
  const authorization = await signDelegation();

  const calls = [
    {
      target: token,
      value: 0n,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [router, approveAmount],
      }),
    },
    {
      target: router,
      value: 0n,
      data: swapCalldata,
    },
  ];

  const hash = await walletClient.sendTransaction({
    authorizationList: [authorization],
    to: account.address,
    data: encodeFunctionData({
      abi: batchExecutorAbi,
      functionName: "execute",
      args: [calls],
    }),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Approve+swap reverted");

  return hash;
}
```

## Notes

- EIP-7702 requires Pectra-compatible chains. Check chain support before deploying.
- The `authorizationList` can contain multiple authorizations, but typically you only need one per EOA.
- Setting `chainId: 0` in the authorization makes it valid on any chain. Use a specific chain ID for chain-locked delegation.
- The EOA retains full control. Sending another Type 0x04 transaction with `address(0)` clears the delegation.
- The `to` field in `sendTransaction` is the EOA's own address because the delegation makes the EOA execute the batch executor's code.
