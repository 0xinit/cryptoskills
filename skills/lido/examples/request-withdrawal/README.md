# Lido Withdrawal Queue

Request withdrawals of stETH/wstETH for ETH. The withdrawal queue mints an NFT (unstETH) for each request. Once finalized by the oracle, claim ETH in a separate transaction.

## Setup

```typescript
import { createPublicClient, createWalletClient, http, parseAbi, parseEther, formatEther } from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const LIDO = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84" as const;
const WSTETH = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0" as const;
const WITHDRAWAL_QUEUE = "0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1" as const;

const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
]);

const WITHDRAWAL_ABI = parseAbi([
  "function requestWithdrawals(uint256[] _amounts, address _owner) external returns (uint256[])",
  "function requestWithdrawalsWstETH(uint256[] _amounts, address _owner) external returns (uint256[])",
  "function claimWithdrawals(uint256[] _requestIds, uint256[] _hints) external",
  "function getWithdrawalStatus(uint256[] _requestIds) external view returns ((uint256 amountOfStETH, uint256 amountOfShares, address owner, uint256 timestamp, bool isFinalized, bool isClaimed)[])",
  "function findCheckpointHints(uint256[] _requestIds, uint256 _firstIndex, uint256 _lastIndex) external view returns (uint256[])",
  "function getLastCheckpointIndex() external view returns (uint256)",
  "function getLastFinalizedRequestId() external view returns (uint256)",
  "function getLastRequestId() external view returns (uint256)",
  "function MAX_STETH_WITHDRAWAL_AMOUNT() external view returns (uint256)",
  "function MIN_STETH_WITHDRAWAL_AMOUNT() external view returns (uint256)",
]);

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});
```

## Request Withdrawal with stETH

Each request must be between 100 wei and 1000 stETH. Approve the WithdrawalQueue contract first.

```typescript
async function requestWithdrawal(stEthAmounts: bigint[]) {
  const totalAmount = stEthAmounts.reduce((a, b) => a + b, 0n);

  // Approve WithdrawalQueue to spend stETH
  const approveHash = await walletClient.writeContract({
    address: LIDO,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [WITHDRAWAL_QUEUE, totalAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  const { request } = await publicClient.simulateContract({
    address: WITHDRAWAL_QUEUE,
    abi: WITHDRAWAL_ABI,
    functionName: "requestWithdrawals",
    args: [stEthAmounts, account.address],
    account,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Withdrawal request reverted");

  return hash;
}
```

## Request Withdrawal with wstETH

Alternatively, withdraw directly from wstETH without unwrapping first.

```typescript
async function requestWithdrawalWstETH(wstEthAmounts: bigint[]) {
  const totalAmount = wstEthAmounts.reduce((a, b) => a + b, 0n);

  const approveHash = await walletClient.writeContract({
    address: WSTETH,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [WITHDRAWAL_QUEUE, totalAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  const { request } = await publicClient.simulateContract({
    address: WITHDRAWAL_QUEUE,
    abi: WITHDRAWAL_ABI,
    functionName: "requestWithdrawalsWstETH",
    args: [wstEthAmounts, account.address],
    account,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Withdrawal request reverted");

  return hash;
}
```

## Batch Withdrawal Requests

Large amounts must be split into requests of <= 1000 stETH each.

```typescript
async function requestLargeWithdrawal(totalStEth: bigint) {
  // Max 1000 stETH per request
  const MAX_PER_REQUEST = parseEther("1000");
  const amounts: bigint[] = [];
  let remaining = totalStEth;

  while (remaining > 0n) {
    const chunk = remaining > MAX_PER_REQUEST ? MAX_PER_REQUEST : remaining;
    amounts.push(chunk);
    remaining -= chunk;
  }

  console.log(`Splitting ${formatEther(totalStEth)} stETH into ${amounts.length} requests`);
  return requestWithdrawal(amounts);
}
```

## Check Withdrawal Status

```typescript
async function getWithdrawalStatus(requestIds: bigint[]) {
  const statuses = await publicClient.readContract({
    address: WITHDRAWAL_QUEUE,
    abi: WITHDRAWAL_ABI,
    functionName: "getWithdrawalStatus",
    args: [requestIds],
  });

  return statuses.map((s, i) => ({
    requestId: requestIds[i],
    amountOfStETH: s.amountOfStETH,
    amountOfShares: s.amountOfShares,
    owner: s.owner,
    timestamp: s.timestamp,
    isFinalized: s.isFinalized,
    isClaimed: s.isClaimed,
  }));
}
```

## Claim Finalized Withdrawals

After the oracle finalizes your request, claim ETH. Requires checkpoint hints.

```typescript
async function claimWithdrawals(requestIds: bigint[]) {
  const lastCheckpointIndex = await publicClient.readContract({
    address: WITHDRAWAL_QUEUE,
    abi: WITHDRAWAL_ABI,
    functionName: "getLastCheckpointIndex",
  });

  const hints = await publicClient.readContract({
    address: WITHDRAWAL_QUEUE,
    abi: WITHDRAWAL_ABI,
    functionName: "findCheckpointHints",
    args: [requestIds, 1n, lastCheckpointIndex],
  });

  const { request } = await publicClient.simulateContract({
    address: WITHDRAWAL_QUEUE,
    abi: WITHDRAWAL_ABI,
    functionName: "claimWithdrawals",
    args: [requestIds, hints],
    account,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Claim tx reverted");

  return hash;
}
```

## Withdrawal NFT (unstETH)

Each withdrawal request mints an ERC-721 NFT to the owner address. The NFT ID equals the request ID. The NFT is burned when claimed. You can transfer the NFT to let another address claim the ETH.

## Estimating Withdrawal Time

Withdrawal finalization depends on:
1. Position in the queue (requests are processed in order)
2. Validator exit queue length on the beacon chain
3. Oracle report frequency (typically daily)

```typescript
async function estimateWaitPosition(requestIds: bigint[]) {
  const [lastFinalized, lastRequest] = await Promise.all([
    publicClient.readContract({
      address: WITHDRAWAL_QUEUE,
      abi: WITHDRAWAL_ABI,
      functionName: "getLastFinalizedRequestId",
    }),
    publicClient.readContract({
      address: WITHDRAWAL_QUEUE,
      abi: WITHDRAWAL_ABI,
      functionName: "getLastRequestId",
    }),
  ]);

  const pendingCount = lastRequest - lastFinalized;
  console.log(`Queue: ${pendingCount} pending requests`);
  console.log(`Last finalized: #${lastFinalized}`);
  console.log(`Last request:   #${lastRequest}`);

  for (const id of requestIds) {
    if (id <= lastFinalized) {
      console.log(`Request #${id}: FINALIZED (ready to claim)`);
    } else {
      const positionInQueue = id - lastFinalized;
      console.log(`Request #${id}: ${positionInQueue} positions from finalization`);
    }
  }
}
```

## Key Points

- Each request must be between 100 wei and 1000 stETH.
- `requestWithdrawalsWstETH` lets you skip the unwrap step.
- Withdrawal requests are not instant. Typical wait: 1-5 days, can be longer during high demand.
- The claim transaction sends ETH to `msg.sender`, not the NFT owner. The owner must call `claimWithdrawals`.
- Checkpoint hints are required for claiming. Use `findCheckpointHints` with range `[1, getLastCheckpointIndex()]`.
- Withdrawal NFTs are transferable. The new owner can claim the ETH.
