# Curve Gauge Voting

Working TypeScript example for locking CRV to veCRV and voting on gauge weights using viem.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const CRV = "0xD533a949740bb3306d119CC777fa900bA034cd52" as const;
const VECRV = "0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2" as const;
const GAUGE_CONTROLLER = "0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB" as const;
```

## ABIs

```typescript
const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);

const veCrvAbi = parseAbi([
  "function create_lock(uint256 _value, uint256 _unlock_time)",
  "function increase_amount(uint256 _value)",
  "function increase_unlock_time(uint256 _unlock_time)",
  "function withdraw()",
  "function balanceOf(address addr) view returns (uint256)",
  "function locked(address addr) view returns (int128 amount, uint256 end)",
]);

const gaugeControllerAbi = parseAbi([
  "function vote_for_gauge_weights(address _gauge_addr, uint256 _user_weight)",
  "function gauge_relative_weight(address addr) view returns (uint256)",
  "function vote_user_power(address user) view returns (uint256)",
  "function last_user_vote(address user, address gauge) view returns (uint256)",
  "function n_gauges() view returns (int128)",
  "function gauges(uint256 i) view returns (address)",
]);
```

## Lock CRV for veCRV

Lock duration: 1 week to 4 years. Longer lock = more voting power. Voting power decays linearly toward unlock.

```typescript
// Unlock time must be rounded down to the nearest Thursday 00:00 UTC (week boundary)
const WEEK = 7n * 24n * 60n * 60n;

function roundToWeek(timestamp: bigint): bigint {
  return (timestamp / WEEK) * WEEK;
}

async function createVeCrvLock(
  crvAmount: bigint,
  lockYears: number
): Promise<`0x${string}`> {
  if (lockYears < 0.02 || lockYears > 4) {
    throw new Error("Lock duration must be between ~1 week and 4 years");
  }

  const lockDuration = BigInt(Math.floor(lockYears * 365.25 * 24 * 60 * 60));
  const now = BigInt(Math.floor(Date.now() / 1000));
  const unlockTime = roundToWeek(now + lockDuration);

  // Approve CRV to veCRV contract
  const { request: approveReq } = await publicClient.simulateContract({
    address: CRV,
    abi: erc20Abi,
    functionName: "approve",
    args: [VECRV, crvAmount],
    account: account.address,
  });
  const approveHash = await walletClient.writeContract(approveReq);
  const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
  if (approveReceipt.status !== "success") throw new Error("CRV approval failed");

  // Create lock
  const { request } = await publicClient.simulateContract({
    address: VECRV,
    abi: veCrvAbi,
    functionName: "create_lock",
    args: [crvAmount, unlockTime],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("veCRV lock creation failed");

  return hash;
}
```

## Increase Lock Amount

Add more CRV to an existing lock (does not change unlock time).

```typescript
async function increaseLockAmount(
  additionalCrv: bigint
): Promise<`0x${string}`> {
  const { request: approveReq } = await publicClient.simulateContract({
    address: CRV,
    abi: erc20Abi,
    functionName: "approve",
    args: [VECRV, additionalCrv],
    account: account.address,
  });
  await walletClient.writeContract(approveReq);

  const { request } = await publicClient.simulateContract({
    address: VECRV,
    abi: veCrvAbi,
    functionName: "increase_amount",
    args: [additionalCrv],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Increase amount failed");

  return hash;
}
```

## Extend Lock Duration

Push the unlock time further into the future (does not add more CRV).

```typescript
async function extendLockDuration(
  newLockYears: number
): Promise<`0x${string}`> {
  const lockDuration = BigInt(Math.floor(newLockYears * 365.25 * 24 * 60 * 60));
  const now = BigInt(Math.floor(Date.now() / 1000));
  const newUnlockTime = roundToWeek(now + lockDuration);

  const { request } = await publicClient.simulateContract({
    address: VECRV,
    abi: veCrvAbi,
    functionName: "increase_unlock_time",
    args: [newUnlockTime],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Extend lock failed");

  return hash;
}
```

## Vote on Gauge Weights

Allocate voting power to direct CRV emissions to specific gauges. Total allocation = 10,000 (100%). Votes persist until changed. There is a 10-day cooldown between vote changes for the same gauge.

```typescript
async function voteForGauge(
  gaugeAddress: Address,
  weightBps: bigint
): Promise<`0x${string}`> {
  if (weightBps > 10000n) {
    throw new Error("Weight cannot exceed 10000 (100%)");
  }

  // Check if cooldown has passed (10 days between votes on same gauge)
  const lastVote = await publicClient.readContract({
    address: GAUGE_CONTROLLER,
    abi: gaugeControllerAbi,
    functionName: "last_user_vote",
    args: [account.address, gaugeAddress],
  });

  const TEN_DAYS = 10n * 24n * 60n * 60n;
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (lastVote > 0n && now - lastVote < TEN_DAYS) {
    const remaining = Number(TEN_DAYS - (now - lastVote)) / 86400;
    throw new Error(`Vote cooldown: ${remaining.toFixed(1)} days remaining`);
  }

  const { request } = await publicClient.simulateContract({
    address: GAUGE_CONTROLLER,
    abi: gaugeControllerAbi,
    functionName: "vote_for_gauge_weights",
    args: [gaugeAddress, weightBps],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Gauge vote failed");

  return hash;
}
```

## Read Voting State

```typescript
async function getVotingState(): Promise<{
  veCrvBalance: bigint;
  lockedAmount: bigint;
  unlockTime: bigint;
  usedPowerBps: bigint;
  remainingPowerBps: bigint;
}> {
  const [veCrvBalance, locked, usedPower] = await Promise.all([
    publicClient.readContract({
      address: VECRV,
      abi: veCrvAbi,
      functionName: "balanceOf",
      args: [account.address],
    }),
    publicClient.readContract({
      address: VECRV,
      abi: veCrvAbi,
      functionName: "locked",
      args: [account.address],
    }),
    publicClient.readContract({
      address: GAUGE_CONTROLLER,
      abi: gaugeControllerAbi,
      functionName: "vote_user_power",
      args: [account.address],
    }),
  ]);

  const [lockedAmount, unlockTime] = locked;

  return {
    veCrvBalance,
    lockedAmount: BigInt(lockedAmount),
    unlockTime,
    usedPowerBps: usedPower,
    remainingPowerBps: 10000n - usedPower,
  };
}

async function getGaugeWeight(gaugeAddress: Address): Promise<bigint> {
  return publicClient.readContract({
    address: GAUGE_CONTROLLER,
    abi: gaugeControllerAbi,
    functionName: "gauge_relative_weight",
    args: [gaugeAddress],
  });
}
```

## Complete Usage

```typescript
const THREE_POOL_GAUGE = "0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A" as const;
const STETH_GAUGE = "0x182B723a58739a9c974cFDB385ceaDb237453c28" as const;

async function main() {
  // Lock 10,000 CRV for 4 years (maximum voting power)
  const lockHash = await createVeCrvLock(
    10_000_000000000000000000n, // 10,000 CRV (18 decimals)
    4                            // 4 years
  );
  console.log(`Locked CRV for veCRV: ${lockHash}`);

  // Check voting state
  const state = await getVotingState();
  console.log(`veCRV balance: ${Number(state.veCrvBalance) / 1e18}`);
  console.log(`Locked CRV: ${Number(state.lockedAmount) / 1e18}`);
  console.log(`Unlock: ${new Date(Number(state.unlockTime) * 1000).toISOString()}`);
  console.log(`Available voting power: ${Number(state.remainingPowerBps) / 100}%`);

  // Vote: 60% to 3pool, 40% to stETH gauge
  const vote1Hash = await voteForGauge(THREE_POOL_GAUGE, 6000n);
  console.log(`Voted 60% for 3pool gauge: ${vote1Hash}`);

  const vote2Hash = await voteForGauge(STETH_GAUGE, 4000n);
  console.log(`Voted 40% for stETH gauge: ${vote2Hash}`);

  // Check gauge weights
  const threePoolWeight = await getGaugeWeight(THREE_POOL_GAUGE);
  const stethWeight = await getGaugeWeight(STETH_GAUGE);
  console.log(`3pool gauge weight: ${(Number(threePoolWeight) / 1e18 * 100).toFixed(2)}%`);
  console.log(`stETH gauge weight: ${(Number(stethWeight) / 1e18 * 100).toFixed(2)}%`);
}

main().catch(console.error);
```
