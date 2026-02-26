# Delegate Restaked Assets to an Operator

Working TypeScript example for delegating your restaked assets to an EigenLayer operator using viem.

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

const DELEGATION_MANAGER = "0x39053D51B77DC0d36036Fc1fCc8Cb819df8Ef37A" as const;
const STRATEGY_MANAGER = "0x858646372CC42E1A627fcE94aa7A7033e7CF075A" as const;
```

## ABIs

```typescript
const delegationManagerAbi = parseAbi([
  "function delegateTo(address operator, (bytes signature, uint256 expiry) approverSignatureAndExpiry, bytes32 approverSalt) external",
  "function undelegate(address staker) external returns (bytes32[] withdrawalRoots)",
  "function delegatedTo(address staker) external view returns (address)",
  "function isDelegated(address staker) external view returns (bool)",
  "function isOperator(address operator) external view returns (bool)",
  "function operatorShares(address operator, address strategy) external view returns (uint256)",
]);

const strategyManagerAbi = parseAbi([
  "function stakerStrategyShares(address staker, address strategy) external view returns (uint256)",
  "function stakerStrategyList(address staker) external view returns (address[])",
]);
```

## Pre-Delegation Checks

Before delegating, verify the operator is registered and you have restaked assets.

```typescript
async function preDelegationChecks(
  operatorAddress: Address
): Promise<{
  isValidOperator: boolean;
  isAlreadyDelegated: boolean;
  currentOperator: Address;
  hasRestakedAssets: boolean;
}> {
  const [isOperator, isDelegated, currentOperator] = await Promise.all([
    publicClient.readContract({
      address: DELEGATION_MANAGER,
      abi: delegationManagerAbi,
      functionName: "isOperator",
      args: [operatorAddress],
    }),
    publicClient.readContract({
      address: DELEGATION_MANAGER,
      abi: delegationManagerAbi,
      functionName: "isDelegated",
      args: [account.address],
    }),
    publicClient.readContract({
      address: DELEGATION_MANAGER,
      abi: delegationManagerAbi,
      functionName: "delegatedTo",
      args: [account.address],
    }),
  ]);

  const strategies = await publicClient.readContract({
    address: STRATEGY_MANAGER,
    abi: strategyManagerAbi,
    functionName: "stakerStrategyList",
    args: [account.address],
  });

  return {
    isValidOperator: isOperator,
    isAlreadyDelegated: isDelegated,
    currentOperator: currentOperator,
    hasRestakedAssets: strategies.length > 0,
  };
}
```

## Delegate to Operator

```typescript
async function delegateToOperator(
  operatorAddress: Address
): Promise<`0x${string}`> {
  const checks = await preDelegationChecks(operatorAddress);

  if (!checks.isValidOperator) {
    throw new Error(`${operatorAddress} is not a registered operator`);
  }
  if (checks.isAlreadyDelegated) {
    throw new Error(
      `Already delegated to ${checks.currentOperator}. Undelegate first.`
    );
  }
  if (!checks.hasRestakedAssets) {
    throw new Error("No restaked assets found. Deposit into a strategy first.");
  }

  // Empty signature and salt for operators without a delegationApprover
  const emptySignature: `0x${string}` = "0x";
  const noExpiry = 0n;
  const emptySalt =
    "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

  const { request } = await publicClient.simulateContract({
    address: DELEGATION_MANAGER,
    abi: delegationManagerAbi,
    functionName: "delegateTo",
    args: [
      operatorAddress,
      { signature: emptySignature, expiry: noExpiry },
      emptySalt,
    ],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Delegation reverted");

  return hash;
}
```

## Undelegate

Undelegating queues withdrawals for all restaked assets. You must complete these withdrawals after the escrow period to reclaim your tokens.

```typescript
async function undelegate(): Promise<{
  hash: `0x${string}`;
  withdrawalRoots: readonly `0x${string}`[];
}> {
  const isDelegated = await publicClient.readContract({
    address: DELEGATION_MANAGER,
    abi: delegationManagerAbi,
    functionName: "isDelegated",
    args: [account.address],
  });

  if (!isDelegated) throw new Error("Not currently delegated");

  const { request, result } = await publicClient.simulateContract({
    address: DELEGATION_MANAGER,
    abi: delegationManagerAbi,
    functionName: "undelegate",
    args: [account.address],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Undelegate reverted");

  return { hash, withdrawalRoots: result };
}
```

## Check Operator's Total Delegated Shares

```typescript
async function getOperatorShares(
  operatorAddress: Address,
  strategyAddress: Address
): Promise<bigint> {
  return publicClient.readContract({
    address: DELEGATION_MANAGER,
    abi: delegationManagerAbi,
    functionName: "operatorShares",
    args: [operatorAddress, strategyAddress],
  });
}
```

## Complete Usage

```typescript
async function main() {
  // Replace with the operator you want to delegate to
  const operatorAddress = "0x..." as Address;

  // Check delegation status
  const checks = await preDelegationChecks(operatorAddress);
  console.log("Pre-delegation checks:");
  console.log(`  Valid operator: ${checks.isValidOperator}`);
  console.log(`  Already delegated: ${checks.isAlreadyDelegated}`);
  console.log(`  Has restaked assets: ${checks.hasRestakedAssets}`);

  if (checks.isAlreadyDelegated) {
    console.log(`\nCurrently delegated to: ${checks.currentOperator}`);
    console.log("Undelegating...");
    const { hash, withdrawalRoots } = await undelegate();
    console.log(`Undelegate tx: ${hash}`);
    console.log(`Withdrawal roots: ${withdrawalRoots.length}`);
    console.log("Wait for escrow period before completing withdrawals.");
    return;
  }

  // Delegate
  console.log(`\nDelegating to ${operatorAddress}...`);
  const hash = await delegateToOperator(operatorAddress);
  console.log(`Delegation tx: ${hash}`);

  // Verify
  const delegatedTo = await publicClient.readContract({
    address: DELEGATION_MANAGER,
    abi: delegationManagerAbi,
    functionName: "delegatedTo",
    args: [account.address],
  });
  console.log(`Now delegated to: ${delegatedTo}`);
}

main().catch(console.error);
```

## Notes

- Delegation is **all-or-nothing**: all your restaked shares across all strategies are delegated to one operator. You cannot split delegation across multiple operators from the same address.
- If the operator has a `delegationApprover` set (non-zero address), you need a valid approval signature from that address. The empty signature (`0x`) only works when `delegationApprover` is the zero address.
- Undelegating automatically queues withdrawals. You must call `completeQueuedWithdrawals()` after the escrow period to reclaim your tokens.
- To redelegate to a different operator: undelegate, wait for escrow, complete withdrawals, re-deposit, then delegate to the new operator.
- Operators are automatically self-delegated when they register. They cannot delegate to another operator.
