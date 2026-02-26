# Deposit LST into EigenLayer Strategy

Working TypeScript example for depositing an LST (stETH) into its EigenLayer strategy using viem.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseEther,
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

const STRATEGY_MANAGER = "0x858646372CC42E1A627fcE94aa7A7033e7CF075A" as const;
const STETH_STRATEGY = "0x93c4b944D05dfe6df7645A86cd2206016c51564D" as const;
const STETH = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84" as const;
```

## ABIs

```typescript
const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
]);

const strategyManagerAbi = parseAbi([
  "function depositIntoStrategy(address strategy, address token, uint256 amount) external returns (uint256 shares)",
  "function stakerStrategyShares(address staker, address strategy) external view returns (uint256)",
]);

const strategyAbi = parseAbi([
  "function sharesToUnderlyingView(uint256 amountShares) external view returns (uint256)",
  "function underlyingToSharesView(uint256 amountUnderlying) external view returns (uint256)",
  "function totalShares() external view returns (uint256)",
]);
```

## Token Approval

Before depositing, the StrategyManager must be approved to spend your LST. Check existing allowance first to avoid unnecessary approvals.

```typescript
async function ensureApproval(
  token: Address,
  spender: Address,
  amount: bigint
): Promise<void> {
  const allowance = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, spender],
  });

  if (allowance >= amount) return;

  const { request } = await publicClient.simulateContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Approval reverted");
}
```

## Deposit stETH into EigenLayer

```typescript
async function depositSteth(amount: bigint): Promise<{
  hash: `0x${string}`;
  shares: bigint;
}> {
  // Check balance before depositing
  const balance = await publicClient.readContract({
    address: STETH,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (balance < amount) {
    throw new Error(`Insufficient stETH: have ${balance}, need ${amount}`);
  }

  // Approve StrategyManager
  await ensureApproval(STETH, STRATEGY_MANAGER, amount);

  // Simulate and execute deposit
  const { request, result } = await publicClient.simulateContract({
    address: STRATEGY_MANAGER,
    abi: strategyManagerAbi,
    functionName: "depositIntoStrategy",
    args: [STETH_STRATEGY, STETH, amount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Deposit reverted");

  return { hash, shares: result };
}
```

## Check Restaked Balance

```typescript
async function getRestakedBalance(): Promise<{
  shares: bigint;
  underlyingTokens: bigint;
}> {
  const shares = await publicClient.readContract({
    address: STRATEGY_MANAGER,
    abi: strategyManagerAbi,
    functionName: "stakerStrategyShares",
    args: [account.address, STETH_STRATEGY],
  });

  const underlyingTokens = await publicClient.readContract({
    address: STETH_STRATEGY,
    abi: strategyAbi,
    functionName: "sharesToUnderlyingView",
    args: [shares],
  });

  return { shares, underlyingTokens };
}
```

## Complete Usage

```typescript
async function main() {
  const depositAmount = parseEther("1"); // 1 stETH

  console.log("Depositing stETH into EigenLayer...");
  const { hash, shares } = await depositSteth(depositAmount);
  console.log(`Deposit tx: ${hash}`);
  console.log(`Shares received: ${shares}`);

  console.log("\nChecking restaked balance...");
  const { shares: totalShares, underlyingTokens } = await getRestakedBalance();
  console.log(`Total shares: ${totalShares}`);
  console.log(`Underlying stETH: ${underlyingTokens}`);
}

main().catch(console.error);
```

## Notes

- The StrategyManager approval is for the **StrategyManager proxy** (`0x858646372CC42E1A627fcE94aa7A7033e7CF075A`), not the individual strategy contract.
- stETH is a rebasing token. Due to share-to-balance rounding, the actual deposited amount may differ by 1-2 wei from what you approved. The strategy handles this internally.
- Each strategy may have deposit caps. If the strategy is at capacity, the deposit will revert. Check the strategy's `getTVLLimits()` before depositing large amounts.
- Shares received from the deposit are tracked in StrategyManager, not as a separate token. There is no receipt token.
