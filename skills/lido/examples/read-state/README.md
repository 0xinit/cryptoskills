# Reading Lido Protocol State

Query on-chain Lido protocol metrics: total pooled ether, share rates, APR estimates, and withdrawal queue status.

## Setup

```typescript
import { createPublicClient, http, parseAbi, formatEther } from "viem";
import { mainnet } from "viem/chains";

const LIDO = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84" as const;
const WSTETH = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0" as const;
const WITHDRAWAL_QUEUE = "0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1" as const;
const ACCOUNTING_ORACLE = "0x852deD011285fe67063a08005c71a85690503Cee" as const;

const LIDO_ABI = parseAbi([
  "function getTotalPooledEther() external view returns (uint256)",
  "function getTotalShares() external view returns (uint256)",
  "function getPooledEthByShares(uint256 _sharesAmount) external view returns (uint256)",
  "function getSharesByPooledEth(uint256 _ethAmount) external view returns (uint256)",
  "function getBeaconStat() external view returns (uint256 depositedValidators, uint256 beaconValidators, uint256 beaconBalance)",
  "function getBufferedEther() external view returns (uint256)",
  "function getCurrentStakeLimit() external view returns (uint256)",
]);

const WSTETH_ABI = parseAbi([
  "function stEthPerToken() external view returns (uint256)",
  "function tokensPerStEth() external view returns (uint256)",
]);

const WITHDRAWAL_ABI = parseAbi([
  "function getLastFinalizedRequestId() external view returns (uint256)",
  "function getLastRequestId() external view returns (uint256)",
  "function unfinalizedStETH() external view returns (uint256)",
  "function getLastCheckpointIndex() external view returns (uint256)",
]);

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});
```

## Total Pooled Ether and Total Shares

These two values define the share rate and all stETH balances.

```typescript
async function getProtocolTotals() {
  const [totalPooledEther, totalShares] = await Promise.all([
    publicClient.readContract({
      address: LIDO,
      abi: LIDO_ABI,
      functionName: "getTotalPooledEther",
    }),
    publicClient.readContract({
      address: LIDO,
      abi: LIDO_ABI,
      functionName: "getTotalShares",
    }),
  ]);

  const shareRate = (totalPooledEther * 10n ** 18n) / totalShares;

  console.log(`Total pooled ETH: ${formatEther(totalPooledEther)}`);
  console.log(`Total shares:     ${formatEther(totalShares)}`);
  console.log(`Share rate:       ${formatEther(shareRate)} ETH/share`);

  return { totalPooledEther, totalShares, shareRate };
}
```

## stETH/ETH Exchange Rate

The protocol rate (used for mint/burn) vs the wstETH wrapper rate.

```typescript
async function getExchangeRates() {
  const [ethPerShare, stEthPerWstEth, wstEthPerStEth] = await Promise.all([
    publicClient.readContract({
      address: LIDO,
      abi: LIDO_ABI,
      functionName: "getPooledEthByShares",
      args: [10n ** 18n],
    }),
    publicClient.readContract({
      address: WSTETH,
      abi: WSTETH_ABI,
      functionName: "stEthPerToken",
    }),
    publicClient.readContract({
      address: WSTETH,
      abi: WSTETH_ABI,
      functionName: "tokensPerStEth",
    }),
  ]);

  console.log(`1 share  = ${formatEther(ethPerShare)} stETH`);
  console.log(`1 wstETH = ${formatEther(stEthPerWstEth)} stETH`);
  console.log(`1 stETH  = ${formatEther(wstEthPerStEth)} wstETH`);

  return { ethPerShare, stEthPerWstEth, wstEthPerStEth };
}
```

## APR Estimation from Oracle Reports

Lido does not expose APR on-chain directly. Estimate it by comparing share rates across two oracle report timestamps. The Lido API (`https://eth-api.lido.fi/v1/protocol/steth/apr/sma`) provides a smoothed APR.

```typescript
async function estimateAprFromShareRates(
  previousShareRate: bigint,
  currentShareRate: bigint,
  daysBetween: number,
) {
  // APR = ((currentRate - previousRate) / previousRate) * (365 / daysBetween) * 100
  const rateDiff = currentShareRate - previousShareRate;
  const aprBps = (rateDiff * 365n * 10000n) / (previousShareRate * BigInt(daysBetween));
  const aprPercent = Number(aprBps) / 100;

  console.log(`Estimated APR: ${aprPercent.toFixed(2)}%`);
  return aprPercent;
}
```

## Withdrawal Queue Status

```typescript
async function getWithdrawalQueueStatus() {
  const [lastFinalized, lastRequest, unfinalizedAmount] = await Promise.all([
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
    publicClient.readContract({
      address: WITHDRAWAL_QUEUE,
      abi: WITHDRAWAL_ABI,
      functionName: "unfinalizedStETH",
    }),
  ]);

  const pendingRequests = lastRequest - lastFinalized;

  console.log(`Last finalized request: #${lastFinalized}`);
  console.log(`Last request:           #${lastRequest}`);
  console.log(`Pending requests:       ${pendingRequests}`);
  console.log(`Unfinalized stETH:      ${formatEther(unfinalizedAmount)}`);

  return { lastFinalized, lastRequest, pendingRequests, unfinalizedAmount };
}
```

## Buffer and Deposit Capacity

The buffer holds ETH waiting to be deposited to validators. The stake limit controls how much new ETH can be deposited per day.

```typescript
async function getBufferAndCapacity() {
  const [bufferedEther, stakeLimit, beaconStat] = await Promise.all([
    publicClient.readContract({
      address: LIDO,
      abi: LIDO_ABI,
      functionName: "getBufferedEther",
    }),
    publicClient.readContract({
      address: LIDO,
      abi: LIDO_ABI,
      functionName: "getCurrentStakeLimit",
    }),
    publicClient.readContract({
      address: LIDO,
      abi: LIDO_ABI,
      functionName: "getBeaconStat",
    }),
  ]);

  const [depositedValidators, beaconValidators, beaconBalance] = beaconStat;

  console.log(`Buffered ETH:         ${formatEther(bufferedEther)}`);
  console.log(`Current stake limit:  ${formatEther(stakeLimit)}`);
  console.log(`Deposited validators: ${depositedValidators}`);
  console.log(`Beacon validators:    ${beaconValidators}`);
  console.log(`Beacon balance:       ${formatEther(beaconBalance)}`);

  return { bufferedEther, stakeLimit, depositedValidators, beaconValidators, beaconBalance };
}
```

## Key Points

- `getTotalPooledEther()` and `getTotalShares()` are the two fundamental protocol values. All balances and rates derive from them.
- Share rate only changes when the Accounting Oracle submits a report (typically daily).
- `getBufferedEther()` shows ETH in the contract not yet deposited to validators.
- `getCurrentStakeLimit()` reflects the remaining daily deposit capacity (replenishes over time).
- Withdrawal queue `unfinalizedStETH()` shows total stETH pending withdrawal.
- For production APR tracking, use the Lido API rather than raw on-chain calculation.
