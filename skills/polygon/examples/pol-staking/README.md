# POL Token and Staking

Interact with the POL token, migrate from MATIC, and stake via Polygon's ValidatorShare contracts.

## MATIC to POL Migration

Migration is 1:1 via the migration contract on Ethereum. POL replaces MATIC as the native staking and gas token.

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Address,
} from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const MATIC_TOKEN = "0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0" as const;
const POL_TOKEN = "0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6" as const;
const MIGRATION_CONTRACT = "0x29e7DF7b6c1264C3F63e2E7bB27143EeB8A05fe3" as const;

const migrationAbi = parseAbi([
  "function migrate(uint256 amount) external",
  "function unmigrate(uint256 amount) external",
]);

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
]);

const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY!}`);

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL),
});

async function migrateMaticToPol(amount: bigint): Promise<void> {
  // Step 1: Approve migration contract to spend MATIC
  const approveTx = await walletClient.writeContract({
    address: MATIC_TOKEN,
    abi: erc20Abi,
    functionName: "approve",
    args: [MIGRATION_CONTRACT, amount],
  });
  const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTx });
  if (approveReceipt.status === "reverted") {
    throw new Error("MATIC approval reverted");
  }

  // Step 2: Call migrate -- burns MATIC, mints POL
  const migrateTx = await walletClient.writeContract({
    address: MIGRATION_CONTRACT,
    abi: migrationAbi,
    functionName: "migrate",
    args: [amount],
  });
  const migrateReceipt = await publicClient.waitForTransactionReceipt({ hash: migrateTx });
  if (migrateReceipt.status === "reverted") {
    throw new Error("Migration reverted");
  }

  console.log(`Migrated ${amount} MATIC to POL: ${migrateTx}`);
}
```

## Staking via ValidatorShare

POL staking on Polygon PoS is done through ValidatorShare contracts on Ethereum. Each validator has a unique ValidatorShare address.

```typescript
const STAKE_MANAGER = "0x5e3Ef299fDDf15eAa0432E6e66473ace8c13D908" as const;

const stakeManagerAbi = parseAbi([
  "function getValidatorContract(uint256 validatorId) external view returns (address)",
  "function validators(uint256 validatorId) external view returns (uint256 amount, uint256 reward, uint256 activationEpoch, uint256 deactivationEpoch, uint256 jailTime, address signer, address contractAddress, uint8 status, uint256 commissionRate, uint256 lastCommissionUpdate, uint256 delegatorsReward, uint256 delegatedAmount, uint256 initialRewardPerStake)",
]);

const validatorShareAbi = parseAbi([
  "function buyVoucher(uint256 _amount, uint256 _minSharesToMint) external returns (uint256 amountToDeposit)",
  "function sellVoucher_new(uint256 claimAmount, uint256 maximumSharesToBurn) external",
  "function unstakeClaimTokens_new(uint256 unbondNonce) external",
  "function restake() external returns (uint256 amountRestaked, uint256 liquidReward)",
  "function withdrawRewards() external",
  "function getLiquidRewards(address user) external view returns (uint256)",
  "function getTotalStake(address user) external view returns (uint256 totalStaked, uint256 shares)",
]);

async function delegateStake(
  validatorShareAddress: Address,
  amount: bigint
): Promise<void> {
  // Step 1: Approve POL to ValidatorShare
  const approveTx = await walletClient.writeContract({
    address: POL_TOKEN,
    abi: erc20Abi,
    functionName: "approve",
    args: [validatorShareAddress, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });

  // Step 2: Buy voucher (delegate)
  // _minSharesToMint = 0 means accept any share amount
  const stakeTx = await walletClient.writeContract({
    address: validatorShareAddress,
    abi: validatorShareAbi,
    functionName: "buyVoucher",
    args: [amount, 0n],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: stakeTx });
  if (receipt.status === "reverted") {
    throw new Error("Staking transaction reverted");
  }
  console.log(`Delegated ${amount} POL: ${stakeTx}`);
}
```

## Claiming Rewards

```typescript
async function claimRewards(validatorShareAddress: Address): Promise<void> {
  const rewards = await publicClient.readContract({
    address: validatorShareAddress,
    abi: validatorShareAbi,
    functionName: "getLiquidRewards",
    args: [account.address],
  });

  if (rewards === 0n) {
    console.log("No rewards to claim");
    return;
  }

  const claimTx = await walletClient.writeContract({
    address: validatorShareAddress,
    abi: validatorShareAbi,
    functionName: "withdrawRewards",
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: claimTx });
  if (receipt.status === "reverted") {
    throw new Error("Claim rewards reverted");
  }
  console.log(`Claimed ${rewards} POL in rewards: ${claimTx}`);
}

async function restakeRewards(validatorShareAddress: Address): Promise<void> {
  const restakeTx = await walletClient.writeContract({
    address: validatorShareAddress,
    abi: validatorShareAbi,
    functionName: "restake",
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: restakeTx });
  if (receipt.status === "reverted") {
    throw new Error("Restake reverted");
  }
  console.log(`Restaked rewards: ${restakeTx}`);
}
```

## Reading Staking State

```typescript
async function getStakingInfo(
  validatorShareAddress: Address,
  delegator: Address
): Promise<{
  totalStaked: bigint;
  shares: bigint;
  pendingRewards: bigint;
}> {
  const [stakeResult, pendingRewards] = await Promise.all([
    publicClient.readContract({
      address: validatorShareAddress,
      abi: validatorShareAbi,
      functionName: "getTotalStake",
      args: [delegator],
    }),
    publicClient.readContract({
      address: validatorShareAddress,
      abi: validatorShareAbi,
      functionName: "getLiquidRewards",
      args: [delegator],
    }),
  ]);

  const [totalStaked, shares] = stakeResult;

  return { totalStaked, shares, pendingRewards };
}

// Usage
const info = await getStakingInfo(
  "0xValidatorShareAddress" as Address,
  account.address
);
console.log(`Staked: ${info.totalStaked}`);
console.log(`Shares: ${info.shares}`);
console.log(`Pending rewards: ${info.pendingRewards}`);
```
