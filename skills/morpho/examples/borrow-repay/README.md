# Borrow and Repay on Morpho Blue

Full borrow/repay cycle: supply collateral, borrow loan tokens, repay debt, withdraw collateral.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  encodeAbiParameters,
  keccak256,
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

const MORPHO = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb" as const;
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
```

## ABIs

```typescript
const erc20Abi = [
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
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const morphoAbi = [
  {
    name: "supplyCollateral",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "assets", type: "uint256" },
      { name: "onBehalf", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "borrow",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "assets", type: "uint256" },
      { name: "shares", type: "uint256" },
      { name: "onBehalf", type: "address" },
      { name: "receiver", type: "address" },
    ],
    outputs: [
      { name: "assetsBorrowed", type: "uint256" },
      { name: "sharesBorrowed", type: "uint256" },
    ],
  },
  {
    name: "repay",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "assets", type: "uint256" },
      { name: "shares", type: "uint256" },
      { name: "onBehalf", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [
      { name: "assetsRepaid", type: "uint256" },
      { name: "sharesRepaid", type: "uint256" },
    ],
  },
  {
    name: "withdrawCollateral",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
      { name: "assets", type: "uint256" },
      { name: "onBehalf", type: "address" },
      { name: "receiver", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "accrueInterest",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "marketParams",
        type: "tuple",
        components: [
          { name: "loanToken", type: "address" },
          { name: "collateralToken", type: "address" },
          { name: "oracle", type: "address" },
          { name: "irm", type: "address" },
          { name: "lltv", type: "uint256" },
        ],
      },
    ],
    outputs: [],
  },
  {
    name: "position",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "user", type: "address" },
    ],
    outputs: [
      { name: "supplyShares", type: "uint256" },
      { name: "borrowShares", type: "uint128" },
      { name: "collateral", type: "uint128" },
    ],
  },
  {
    name: "market",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [
      { name: "totalSupplyAssets", type: "uint128" },
      { name: "totalSupplyShares", type: "uint128" },
      { name: "totalBorrowAssets", type: "uint128" },
      { name: "totalBorrowShares", type: "uint128" },
      { name: "lastUpdate", type: "uint128" },
      { name: "fee", type: "uint128" },
    ],
  },
] as const;
```

## Market Parameters

```typescript
// USDC/WETH market with wstETH oracle (example)
const marketParams = {
  loanToken: USDC,
  collateralToken: WETH,
  oracle: "0x48F7E36EB6B826B2dF4B2E630B62Cd25e89E40e2" as Address,
  irm: "0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC" as Address,
  lltv: 860000000000000000n, // 86%
} as const;

function computeMarketId(params: typeof marketParams): `0x${string}` {
  const encoded = encodeAbiParameters(
    [
      { type: "address" },
      { type: "address" },
      { type: "address" },
      { type: "address" },
      { type: "uint256" },
    ],
    [
      params.loanToken,
      params.collateralToken,
      params.oracle,
      params.irm,
      params.lltv,
    ]
  );
  return keccak256(encoded);
}

const marketId = computeMarketId(marketParams);
```

## Supply Collateral and Borrow

```typescript
async function supplyCollateralAndBorrow(
  collateralAmount: bigint,
  borrowAmount: bigint
): Promise<{ collateralHash: `0x${string}`; borrowHash: `0x${string}` }> {
  // 1. Approve WETH as collateral
  const approveHash = await walletClient.writeContract({
    address: WETH,
    abi: erc20Abi,
    functionName: "approve",
    args: [MORPHO, collateralAmount],
  });
  const approveReceipt = await publicClient.waitForTransactionReceipt({
    hash: approveHash,
  });
  if (approveReceipt.status !== "success") throw new Error("Approval reverted");

  // 2. Supply collateral
  const { request: collateralRequest } = await publicClient.simulateContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: "supplyCollateral",
    args: [marketParams, collateralAmount, account.address, "0x"],
    account: account.address,
  });

  const collateralHash = await walletClient.writeContract(collateralRequest);
  const collateralReceipt = await publicClient.waitForTransactionReceipt({
    hash: collateralHash,
  });
  if (collateralReceipt.status !== "success") {
    throw new Error("Supply collateral reverted");
  }

  // 3. Borrow USDC -- assets = borrow amount, shares = 0
  const { request: borrowRequest } = await publicClient.simulateContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: "borrow",
    args: [marketParams, borrowAmount, 0n, account.address, account.address],
    account: account.address,
  });

  const borrowHash = await walletClient.writeContract(borrowRequest);
  const borrowReceipt = await publicClient.waitForTransactionReceipt({
    hash: borrowHash,
  });
  if (borrowReceipt.status !== "success") {
    throw new Error("Borrow reverted");
  }

  return { collateralHash, borrowHash };
}
```

## Repay Debt and Withdraw Collateral

```typescript
async function repayAndWithdraw(): Promise<{
  repayHash: `0x${string}`;
  withdrawHash: `0x${string}`;
}> {
  // 1. Accrue interest for accurate share-to-asset conversion
  const accrueHash = await walletClient.writeContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: "accrueInterest",
    args: [marketParams],
  });
  await publicClient.waitForTransactionReceipt({ hash: accrueHash });

  // 2. Read current position
  const position = await publicClient.readContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: "position",
    args: [marketId, account.address],
  });
  const borrowShares = position[1];
  const collateral = position[2];

  if (borrowShares === 0n) {
    throw new Error("No debt to repay");
  }

  // 3. Compute assets owed from shares
  const marketData = await publicClient.readContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: "market",
    args: [marketId],
  });
  const totalBorrowAssets = marketData[2];
  const totalBorrowShares = marketData[3];

  // Over-approve by 1% to cover interest accrued between blocks
  const estimatedDebt = (BigInt(borrowShares) * totalBorrowAssets) / totalBorrowShares;
  const approveAmount = (estimatedDebt * 101n) / 100n;

  const approveHash = await walletClient.writeContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "approve",
    args: [MORPHO, approveAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  // 4. Repay all debt by shares -- assets = 0, shares = borrowShares
  const { request: repayRequest } = await publicClient.simulateContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: "repay",
    args: [marketParams, 0n, borrowShares, account.address, "0x"],
    account: account.address,
  });

  const repayHash = await walletClient.writeContract(repayRequest);
  const repayReceipt = await publicClient.waitForTransactionReceipt({
    hash: repayHash,
  });
  if (repayReceipt.status !== "success") {
    throw new Error("Repay reverted");
  }

  // 5. Withdraw all collateral
  const { request: withdrawRequest } = await publicClient.simulateContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: "withdrawCollateral",
    args: [marketParams, collateral, account.address, account.address],
    account: account.address,
  });

  const withdrawHash = await walletClient.writeContract(withdrawRequest);
  const withdrawReceipt = await publicClient.waitForTransactionReceipt({
    hash: withdrawHash,
  });
  if (withdrawReceipt.status !== "success") {
    throw new Error("Withdraw collateral reverted");
  }

  return { repayHash, withdrawHash };
}
```

## Check Position

```typescript
async function getPosition() {
  const position = await publicClient.readContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: "position",
    args: [marketId, account.address],
  });

  const [supplyShares, borrowShares, collateral] = position;

  const marketData = await publicClient.readContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: "market",
    args: [marketId],
  });

  const totalBorrowAssets = marketData[2];
  const totalBorrowShares = marketData[3];

  const borrowAssets = totalBorrowShares > 0n
    ? (BigInt(borrowShares) * totalBorrowAssets) / totalBorrowShares
    : 0n;

  return {
    collateral: formatUnits(BigInt(collateral), 18),
    borrowAssets: formatUnits(borrowAssets, 6),
    borrowShares: borrowShares.toString(),
  };
}
```

## Complete Usage

```typescript
async function main() {
  const collateralAmount = parseUnits("2", 18); // 2 WETH
  const borrowAmount = parseUnits("3000", 6);   // 3000 USDC

  // Open position
  console.log("Supplying collateral and borrowing...");
  const { collateralHash, borrowHash } = await supplyCollateralAndBorrow(
    collateralAmount,
    borrowAmount
  );
  console.log(`Collateral supplied: ${collateralHash}`);
  console.log(`Borrowed: ${borrowHash}`);

  // Check position
  const position = await getPosition();
  console.log(`Position: ${position.collateral} WETH collateral, ${position.borrowAssets} USDC debt`);

  // Close position
  console.log("Repaying and withdrawing...");
  const { repayHash, withdrawHash } = await repayAndWithdraw();
  console.log(`Repaid: ${repayHash}`);
  console.log(`Collateral withdrawn: ${withdrawHash}`);
}

main().catch(console.error);
```
