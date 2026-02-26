# crvUSD Borrowing with WETH Collateral

Working TypeScript example for creating a crvUSD loan, monitoring health, and repaying using viem.

## How LLAMMA Works

crvUSD uses LLAMMA (Lending-Liquidating AMM Algorithm) instead of traditional liquidation. When collateral price drops, the position is gradually converted from collateral to crvUSD across liquidation bands. If price recovers, it converts back. There is no instant liquidation threshold — the process is continuous.

- **N (bands)**: Number of liquidation bands (4-50). More bands = wider price range = safer but lower borrowing power.
- **Health**: Measures distance from full liquidation. Health > 0 is safe. Health approaching 0 means bands are fully converted. Health < 0 can be hard-liquidated.
- **Soft liquidation**: Ongoing conversion between collateral and crvUSD as price moves through bands. This is normal and expected behavior.

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

const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
const CRVUSD = "0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E" as const;
const CRVUSD_WETH_CONTROLLER = "0xA920De414eA4Ab66b97dA1bFE9e6EcA7d4219635" as const;
```

## ABIs

```typescript
const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);

const controllerAbi = parseAbi([
  "function create_loan(uint256 collateral, uint256 debt, uint256 N)",
  "function repay(uint256 _d_debt)",
  "function add_collateral(uint256 collateral)",
  "function remove_collateral(uint256 collateral)",
  "function borrow_more(uint256 collateral, uint256 debt)",
  "function health(address user) view returns (int256)",
  "function user_state(address user) view returns (uint256[4])",
  "function max_borrowable(uint256 collateral, uint256 N) view returns (uint256)",
  "function min_collateral(uint256 debt, uint256 N) view returns (uint256)",
  "function loan_exists(address user) view returns (bool)",
  "function debt(address user) view returns (uint256)",
]);
```

## Check Borrowing Capacity

```typescript
async function checkBorrowingCapacity(
  collateralAmount: bigint,
  numBands: bigint
): Promise<{ maxDebt: bigint; minCollateral: bigint }> {
  if (numBands < 4n || numBands > 50n) {
    throw new Error("N must be between 4 and 50");
  }

  const maxDebt = await publicClient.readContract({
    address: CRVUSD_WETH_CONTROLLER,
    abi: controllerAbi,
    functionName: "max_borrowable",
    args: [collateralAmount, numBands],
  });

  // For reference: minimum collateral needed for a given debt
  const targetDebt = (maxDebt * 80n) / 100n;
  const minCollateral = await publicClient.readContract({
    address: CRVUSD_WETH_CONTROLLER,
    abi: controllerAbi,
    functionName: "min_collateral",
    args: [targetDebt, numBands],
  });

  return { maxDebt, minCollateral };
}
```

## Create a crvUSD Loan

```typescript
async function createLoan(
  collateralAmount: bigint,
  numBands: bigint,
  borrowPercent: bigint
): Promise<{ hash: `0x${string}`; debtAmount: bigint }> {
  // Check if loan already exists
  const hasLoan = await publicClient.readContract({
    address: CRVUSD_WETH_CONTROLLER,
    abi: controllerAbi,
    functionName: "loan_exists",
    args: [account.address],
  });
  if (hasLoan) throw new Error("Loan already exists — use borrow_more or repay");

  // Determine borrow amount
  const maxDebt = await publicClient.readContract({
    address: CRVUSD_WETH_CONTROLLER,
    abi: controllerAbi,
    functionName: "max_borrowable",
    args: [collateralAmount, numBands],
  });

  // borrowPercent: 80 = borrow 80% of max (safer), 95 = aggressive
  const debtAmount = (maxDebt * borrowPercent) / 100n;

  // Approve WETH to controller
  const { request: approveReq } = await publicClient.simulateContract({
    address: WETH,
    abi: erc20Abi,
    functionName: "approve",
    args: [CRVUSD_WETH_CONTROLLER, collateralAmount],
    account: account.address,
  });
  const approveHash = await walletClient.writeContract(approveReq);
  const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
  if (approveReceipt.status !== "success") throw new Error("WETH approval failed");

  // Create loan
  const { request } = await publicClient.simulateContract({
    address: CRVUSD_WETH_CONTROLLER,
    abi: controllerAbi,
    functionName: "create_loan",
    args: [collateralAmount, debtAmount, numBands],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Loan creation failed");

  return { hash, debtAmount };
}
```

## Monitor Loan Health

```typescript
interface LoanState {
  collateral: bigint;
  stablecoin: bigint;
  debt: bigint;
  bands: bigint;
  healthPercent: number;
  inSoftLiquidation: boolean;
}

async function getLoanState(): Promise<LoanState> {
  const hasLoan = await publicClient.readContract({
    address: CRVUSD_WETH_CONTROLLER,
    abi: controllerAbi,
    functionName: "loan_exists",
    args: [account.address],
  });
  if (!hasLoan) throw new Error("No active loan");

  const [userState, health] = await Promise.all([
    publicClient.readContract({
      address: CRVUSD_WETH_CONTROLLER,
      abi: controllerAbi,
      functionName: "user_state",
      args: [account.address],
    }),
    publicClient.readContract({
      address: CRVUSD_WETH_CONTROLLER,
      abi: controllerAbi,
      functionName: "health",
      args: [account.address],
    }),
  ]);

  // user_state returns [collateral, stablecoin, debt, N]
  const [collateral, stablecoin, debt, bands] = userState;
  const healthPercent = Number(health) / 1e18;

  // If stablecoin > 0, collateral is being converted (soft liquidation in progress)
  const inSoftLiquidation = stablecoin > 0n;

  return {
    collateral,
    stablecoin,
    debt,
    bands,
    healthPercent,
    inSoftLiquidation,
  };
}

async function monitorHealth(): Promise<void> {
  const state = await getLoanState();

  console.log(`Collateral: ${Number(state.collateral) / 1e18} WETH`);
  console.log(`Stablecoin in bands: ${Number(state.stablecoin) / 1e18} crvUSD`);
  console.log(`Debt: ${Number(state.debt) / 1e18} crvUSD`);
  console.log(`Bands: ${state.bands}`);
  console.log(`Health: ${state.healthPercent.toFixed(2)}%`);

  if (state.inSoftLiquidation) {
    console.warn("Position is in soft liquidation — collateral being converted to crvUSD");
  }

  if (state.healthPercent < 5) {
    console.warn("CRITICAL: Health below 5% — add collateral or repay immediately");
  } else if (state.healthPercent < 15) {
    console.warn("WARNING: Health below 15% — consider adding collateral");
  }
}
```

## Repay Debt

```typescript
async function repayDebt(
  repayAmount: bigint
): Promise<`0x${string}`> {
  // Approve crvUSD to controller
  const { request: approveReq } = await publicClient.simulateContract({
    address: CRVUSD,
    abi: erc20Abi,
    functionName: "approve",
    args: [CRVUSD_WETH_CONTROLLER, repayAmount],
    account: account.address,
  });
  const approveHash = await walletClient.writeContract(approveReq);
  const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
  if (approveReceipt.status !== "success") throw new Error("crvUSD approval failed");

  const { request } = await publicClient.simulateContract({
    address: CRVUSD_WETH_CONTROLLER,
    abi: controllerAbi,
    functionName: "repay",
    args: [repayAmount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Repay failed");

  return hash;
}
```

## Add Collateral to Existing Loan

```typescript
async function addCollateral(
  additionalWeth: bigint
): Promise<`0x${string}`> {
  const { request: approveReq } = await publicClient.simulateContract({
    address: WETH,
    abi: erc20Abi,
    functionName: "approve",
    args: [CRVUSD_WETH_CONTROLLER, additionalWeth],
    account: account.address,
  });
  await walletClient.writeContract(approveReq);

  const { request } = await publicClient.simulateContract({
    address: CRVUSD_WETH_CONTROLLER,
    abi: controllerAbi,
    functionName: "add_collateral",
    args: [additionalWeth],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Add collateral failed");

  return hash;
}
```

## Full Repay (Close Loan)

```typescript
async function closeLoan(): Promise<`0x${string}`> {
  const totalDebt = await publicClient.readContract({
    address: CRVUSD_WETH_CONTROLLER,
    abi: controllerAbi,
    functionName: "debt",
    args: [account.address],
  });

  // Check crvUSD balance
  const crvusdBalance = await publicClient.readContract({
    address: CRVUSD,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });

  if (crvusdBalance < totalDebt) {
    throw new Error(
      `Insufficient crvUSD: have ${Number(crvusdBalance) / 1e18}, need ${Number(totalDebt) / 1e18}`
    );
  }

  return repayDebt(totalDebt);
}
```

## Complete Usage

```typescript
async function main() {
  // Check WETH balance
  const wethBalance = await publicClient.readContract({
    address: WETH,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  console.log(`WETH balance: ${Number(wethBalance) / 1e18}`);

  const collateral = 10_000000000000000000n; // 10 WETH

  // Check borrowing capacity
  const { maxDebt } = await checkBorrowingCapacity(collateral, 10n);
  console.log(`Max borrowable with 10 WETH, 10 bands: ${Number(maxDebt) / 1e18} crvUSD`);

  // Create loan at 75% of max (conservative)
  const { hash, debtAmount } = await createLoan(collateral, 10n, 75n);
  console.log(`Created loan: ${Number(debtAmount) / 1e18} crvUSD`);
  console.log(`Transaction: ${hash}`);

  // Monitor health
  await monitorHealth();

  // Later: repay half the debt
  const halfDebt = debtAmount / 2n;
  const repayHash = await repayDebt(halfDebt);
  console.log(`Repaid ${Number(halfDebt) / 1e18} crvUSD: ${repayHash}`);

  // Check health after repay
  await monitorHealth();
}

main().catch(console.error);
```
