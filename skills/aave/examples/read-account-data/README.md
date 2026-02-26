# Read Account Data Examples

Reading Aave V3 protocol state using viem: user positions, reserve data, aToken balances, interest rates, and oracle prices.

## Setup

```typescript
import { createPublicClient, http, formatUnits, type Address } from "viem";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const POOL: Address = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
const AAVE_ORACLE: Address = "0x54586bE62E3c3580375aE3723C145253060Ca0C2";
const USDC: Address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WETH: Address = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

const poolAbi = [
  {
    name: "getUserAccountData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCollateralBase", type: "uint256" },
      { name: "totalDebtBase", type: "uint256" },
      { name: "availableBorrowsBase", type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "healthFactor", type: "uint256" },
    ],
  },
  {
    name: "getReserveData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "configuration", type: "uint256" },
          { name: "liquidityIndex", type: "uint128" },
          { name: "currentLiquidityRate", type: "uint128" },
          { name: "variableBorrowIndex", type: "uint128" },
          { name: "currentVariableBorrowRate", type: "uint128" },
          { name: "currentStableBorrowRate", type: "uint128" },
          { name: "lastUpdateTimestamp", type: "uint40" },
          { name: "id", type: "uint16" },
          { name: "aTokenAddress", type: "address" },
          { name: "stableDebtTokenAddress", type: "address" },
          { name: "variableDebtTokenAddress", type: "address" },
          { name: "interestRateStrategyAddress", type: "address" },
          { name: "accruedToTreasury", type: "uint128" },
          { name: "unbacked", type: "uint128" },
          { name: "isolationModeTotalDebt", type: "uint128" },
        ],
      },
    ],
  },
] as const;

const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const oracleAbi = [
  {
    name: "getAssetPrice",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getAssetsPrices",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "assets", type: "address[]" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
] as const;
```

## getUserAccountData

Returns the aggregate position across all reserves. All "Base" values use the oracle base currency (USD with 8 decimals on most markets).

```typescript
async function getUserAccountData(user: Address) {
  const [
    totalCollateralBase,
    totalDebtBase,
    availableBorrowsBase,
    currentLiquidationThreshold,
    ltv,
    healthFactor,
  ] = await publicClient.readContract({
    address: POOL,
    abi: poolAbi,
    functionName: "getUserAccountData",
    args: [user],
  });

  // Base currency = USD with 8 decimals on Ethereum mainnet
  const collateralUsd = Number(totalCollateralBase) / 1e8;
  const debtUsd = Number(totalDebtBase) / 1e8;
  const availableBorrowsUsd = Number(availableBorrowsBase) / 1e8;

  // LTV and liquidation threshold are in basis points (e.g. 8000 = 80%)
  const ltvPct = Number(ltv) / 100;
  const liqThresholdPct = Number(currentLiquidationThreshold) / 100;

  // Health factor is 18-decimal fixed point. Below 1e18 = liquidatable.
  const hf = Number(healthFactor) / 1e18;

  return {
    collateralUsd,
    debtUsd,
    availableBorrowsUsd,
    ltvPct,
    liqThresholdPct,
    healthFactor: hf,
    isLiquidatable: hf < 1.0,
  };
}

const position = await getUserAccountData("0xYourAddress...");
console.log(`Collateral: $${position.collateralUsd.toFixed(2)}`);
console.log(`Debt: $${position.debtUsd.toFixed(2)}`);
console.log(`Health Factor: ${position.healthFactor.toFixed(4)}`);
```

## getReserveData

Returns the current state of a specific reserve including interest rates and token addresses.

```typescript
async function getReserveInfo(asset: Address) {
  const data = await publicClient.readContract({
    address: POOL,
    abi: poolAbi,
    functionName: "getReserveData",
    args: [asset],
  });

  // Rates are stored as rays (27 decimals). Convert to percentage.
  const RAY = 1e27;
  const supplyAPR = Number(data.currentLiquidityRate) / RAY;
  const borrowAPR = Number(data.currentVariableBorrowRate) / RAY;

  // Convert APR to APY: APY = (1 + APR/n)^n - 1, where n = seconds per year
  const SECONDS_PER_YEAR = 31536000;
  const supplyAPY = (1 + supplyAPR / SECONDS_PER_YEAR) ** SECONDS_PER_YEAR - 1;
  const borrowAPY = (1 + borrowAPR / SECONDS_PER_YEAR) ** SECONDS_PER_YEAR - 1;

  return {
    supplyAPY: supplyAPY * 100,
    borrowAPY: borrowAPY * 100,
    aTokenAddress: data.aTokenAddress as Address,
    variableDebtTokenAddress: data.variableDebtTokenAddress as Address,
    liquidityIndex: data.liquidityIndex,
    variableBorrowIndex: data.variableBorrowIndex,
    lastUpdateTimestamp: data.lastUpdateTimestamp,
  };
}

const usdcReserve = await getReserveInfo(USDC);
console.log(`USDC Supply APY: ${usdcReserve.supplyAPY.toFixed(2)}%`);
console.log(`USDC Borrow APY: ${usdcReserve.borrowAPY.toFixed(2)}%`);
console.log(`aUSDC address: ${usdcReserve.aTokenAddress}`);
```

## Reading aToken Balances

aToken balances rebase every block to reflect accrued interest. `balanceOf` returns the current value including interest.

```typescript
async function getATokenBalance(aTokenAddress: Address, user: Address, decimals: number) {
  const balance = await publicClient.readContract({
    address: aTokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [user],
  });

  return {
    raw: balance,
    formatted: Number(formatUnits(balance, decimals)),
  };
}

const { aTokenAddress } = await getReserveInfo(USDC);
const balance = await getATokenBalance(aTokenAddress, "0xYourAddress...", 6);
console.log(`aUSDC balance: ${balance.formatted.toFixed(6)}`);
```

## Calculating Real-Time Interest Accrual

`balanceOf` on aTokens already includes accrued interest at the current block. For projecting forward, use the `liquidityIndex` and `scaledBalanceOf`.

```typescript
const scaledBalanceAbi = [
  {
    name: "scaledBalanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

async function projectBalance(
  aTokenAddress: Address,
  user: Address,
  currentLiquidityIndex: bigint,
  supplyAPR: number,
  secondsForward: number,
  decimals: number,
) {
  const scaledBalance = await publicClient.readContract({
    address: aTokenAddress,
    abi: scaledBalanceAbi,
    functionName: "scaledBalanceOf",
    args: [user],
  });

  // currentBalance = scaledBalance * liquidityIndex / 1e27
  const RAY = 10n ** 27n;
  const currentBalance = (scaledBalance * currentLiquidityIndex) / RAY;

  // Project forward: balance * (1 + rate * time / SECONDS_PER_YEAR)
  const SECONDS_PER_YEAR = 31536000;
  const growthFactor = 1 + (supplyAPR * secondsForward) / SECONDS_PER_YEAR;
  const projectedBalance = Number(formatUnits(currentBalance, decimals)) * growthFactor;

  return {
    current: Number(formatUnits(currentBalance, decimals)),
    projected: projectedBalance,
  };
}
```

## Price Oracle Integration

Aave uses Chainlink-based oracles. The `AaveOracle` contract returns asset prices in the base currency (USD with 8 decimals on Ethereum).

```typescript
async function getAssetPrice(asset: Address): Promise<number> {
  const price = await publicClient.readContract({
    address: AAVE_ORACLE,
    abi: oracleAbi,
    functionName: "getAssetPrice",
    args: [asset],
  });

  // Price in USD with 8 decimals
  return Number(price) / 1e8;
}

async function getMultipleAssetPrices(assets: Address[]): Promise<Record<string, number>> {
  const prices = await publicClient.readContract({
    address: AAVE_ORACLE,
    abi: oracleAbi,
    functionName: "getAssetsPrices",
    args: [assets],
  });

  const result: Record<string, number> = {};
  assets.forEach((asset, i) => {
    result[asset] = Number(prices[i]) / 1e8;
  });

  return result;
}

const ethPrice = await getAssetPrice(WETH);
console.log(`ETH price: $${ethPrice.toFixed(2)}`);

const prices = await getMultipleAssetPrices([WETH, USDC]);
console.log(prices);
```
