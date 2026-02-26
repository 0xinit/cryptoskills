# Read Pendle Market Data

Working TypeScript examples for reading implied rate, PT price, exchange rates, market reserves, and oracle TWAP data from Pendle markets using viem.

## Setup

```typescript
import {
  createPublicClient,
  http,
  parseAbi,
  type Address,
} from "viem";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const PENDLE_ROUTER = "0x888888888889758F76e7103c6CbF23ABbF58F946" as const;
const PENDLE_ROUTER_STATIC = "0x263833d47eA3fA4a30d59B2E6C1A0e682eF1C078" as const;
const PENDLE_PT_ORACLE = "0x66a1096C6366b2529274dF4f5D8f56DA60a2CacD" as const;
const PENDLE_MARKET = "0xD0354D4e7bCf345fB117cabe41aCaDb724009CE5" as const;
```

## Read Market State (Reserves, Implied Rate, Expiry)

```typescript
const marketAbi = parseAbi([
  "function readState(address router) view returns (int256 totalPt, int256 totalSy, int256 totalLp, address treasury, int256 scalarRoot, int256 expiry, int256 lnFeeRateRoot, uint256 reserveFeePercent, int256 lastLnImpliedRate)",
  "function expiry() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
]);

async function getMarketState(market: Address) {
  const [state, expiry, totalLpSupply] = await Promise.all([
    publicClient.readContract({
      address: market,
      abi: marketAbi,
      functionName: "readState",
      args: [PENDLE_ROUTER],
    }),
    publicClient.readContract({
      address: market,
      abi: marketAbi,
      functionName: "expiry",
    }),
    publicClient.readContract({
      address: market,
      abi: marketAbi,
      functionName: "totalSupply",
    }),
  ]);

  const totalPt = state[0];
  const totalSy = state[1];
  const lastLnImpliedRate = state[8];

  // Convert ln(1 + impliedRate) to APY percentage
  const lnRate = Number(lastLnImpliedRate) / 1e18;
  const impliedApy = Math.exp(lnRate) - 1;

  const expiryDate = new Date(Number(expiry) * 1000);
  const isExpired = Date.now() > Number(expiry) * 1000;
  const daysToExpiry = isExpired
    ? 0
    : (Number(expiry) * 1000 - Date.now()) / (1000 * 60 * 60 * 24);

  return {
    totalPt,
    totalSy,
    totalLpSupply,
    impliedApy,
    expiryDate,
    isExpired,
    daysToExpiry,
  };
}
```

## Read PT/Asset Exchange Rate via Oracle (TWAP)

The TWAP oracle is the safe way to price PT for lending protocols. Instantaneous rates are manipulable.

```typescript
const oracleAbi = parseAbi([
  "function getPtToAssetRate(address market, uint32 duration) view returns (uint256)",
  "function getYtToAssetRate(address market, uint32 duration) view returns (uint256)",
  "function getPtToSyRate(address market, uint32 duration) view returns (uint256)",
  "function getOracleState(address market, uint32 duration) view returns (bool increaseCardinalityRequired, uint16 cardinalityRequired, bool oldestObservationSatisfied)",
]);

async function getOracleRates(
  market: Address,
  twapDuration: number
) {
  // Check if oracle is ready
  const oracleState = await publicClient.readContract({
    address: PENDLE_PT_ORACLE,
    abi: oracleAbi,
    functionName: "getOracleState",
    args: [market, twapDuration],
  });

  const [increaseCardinalityRequired, cardinalityRequired, oldestObservationSatisfied] = oracleState;

  if (increaseCardinalityRequired) {
    console.warn(`Oracle needs cardinality increase to ${cardinalityRequired}`);
  }
  if (!oldestObservationSatisfied) {
    console.warn("Oracle observation window not yet filled. TWAP may be unreliable.");
  }

  const [ptToAssetRate, ptToSyRate] = await Promise.all([
    publicClient.readContract({
      address: PENDLE_PT_ORACLE,
      abi: oracleAbi,
      functionName: "getPtToAssetRate",
      args: [market, twapDuration],
    }),
    publicClient.readContract({
      address: PENDLE_PT_ORACLE,
      abi: oracleAbi,
      functionName: "getPtToSyRate",
      args: [market, twapDuration],
    }),
  ]);

  return {
    ptToAssetRate: Number(ptToAssetRate) / 1e18,
    ptToSyRate: Number(ptToSyRate) / 1e18,
    oracleReady: !increaseCardinalityRequired && oldestObservationSatisfied,
  };
}
```

## Read SY Exchange Rate

SY's exchange rate to the underlying increases over time as yield accrues.

```typescript
const syAbi = parseAbi([
  "function exchangeRate() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function yieldToken() view returns (address)",
  "function getTokensIn() view returns (address[])",
  "function getTokensOut() view returns (address[])",
]);

async function getSyInfo(sy: Address) {
  const [exchangeRate, totalSupply, yieldToken, tokensIn, tokensOut] = await Promise.all([
    publicClient.readContract({ address: sy, abi: syAbi, functionName: "exchangeRate" }),
    publicClient.readContract({ address: sy, abi: syAbi, functionName: "totalSupply" }),
    publicClient.readContract({ address: sy, abi: syAbi, functionName: "yieldToken" }),
    publicClient.readContract({ address: sy, abi: syAbi, functionName: "getTokensIn" }),
    publicClient.readContract({ address: sy, abi: syAbi, functionName: "getTokensOut" }),
  ]);

  return {
    exchangeRate: Number(exchangeRate) / 1e18,
    totalSupply,
    yieldToken,
    tokensIn,
    tokensOut,
  };
}
```

## Preview Swap Outputs (Gas-Free via RouterStatic)

```typescript
const routerStaticAbi = parseAbi([
  "function swapExactTokenForPtStatic(address market, address tokenIn, uint256 netTokenIn) view returns (uint256 netPtOut, uint256 netSyFee, uint256 priceImpact)",
  "function swapExactPtForTokenStatic(address market, address tokenOut, uint256 exactPtIn) view returns (uint256 netTokenOut, uint256 netSyFee, uint256 priceImpact)",
]);

async function previewSwaps(market: Address, tokenAddress: Address) {
  const oneEth = 1_000_000_000_000_000_000n;

  const [buyPtPreview, sellPtPreview] = await Promise.all([
    publicClient.readContract({
      address: PENDLE_ROUTER_STATIC,
      abi: routerStaticAbi,
      functionName: "swapExactTokenForPtStatic",
      args: [market, tokenAddress, oneEth],
    }),
    publicClient.readContract({
      address: PENDLE_ROUTER_STATIC,
      abi: routerStaticAbi,
      functionName: "swapExactPtForTokenStatic",
      args: [market, tokenAddress, oneEth],
    }),
  ]);

  return {
    buyPt: {
      ptOut: Number(buyPtPreview[0]) / 1e18,
      syFee: Number(buyPtPreview[1]) / 1e18,
      priceImpact: Number(buyPtPreview[2]) / 1e18,
    },
    sellPt: {
      tokenOut: Number(sellPtPreview[0]) / 1e18,
      syFee: Number(sellPtPreview[1]) / 1e18,
      priceImpact: Number(sellPtPreview[2]) / 1e18,
    },
  };
}
```

## Read YT Accrued Interest

```typescript
const ytAbi = parseAbi([
  "function userInterest(address user) view returns (uint128 lastPYIndex, uint128 accruedInterest)",
  "function pyIndexCurrent() returns (uint256)",
  "function pyIndexStored() view returns (uint256)",
  "function dueInterest(address user) view returns (uint256)",
  "function expiry() view returns (uint256)",
]);

async function getYtAccruedYield(yt: Address, user: Address) {
  const [userInterest, pyIndex, expiry] = await Promise.all([
    publicClient.readContract({
      address: yt,
      abi: ytAbi,
      functionName: "userInterest",
      args: [user],
    }),
    publicClient.readContract({
      address: yt,
      abi: ytAbi,
      functionName: "pyIndexStored",
    }),
    publicClient.readContract({
      address: yt,
      abi: ytAbi,
      functionName: "expiry",
    }),
  ]);

  return {
    accruedInterest: Number(userInterest[1]) / 1e18,
    currentPyIndex: Number(pyIndex) / 1e18,
    expiry: new Date(Number(expiry) * 1000),
  };
}
```

## Complete Usage

```typescript
async function main() {
  const SY_WSTETH = "0xcbC72d92b2dc8187414F6734718563898740C0BC" as const;
  const YT_WSTETH = "0x7B6C3e5486D9e6959441ab554A889099ead23c1F" as const;
  const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;

  // Market state
  const state = await getMarketState(PENDLE_MARKET);
  console.log(`Implied APY: ${(state.impliedApy * 100).toFixed(2)}%`);
  console.log(`Expiry: ${state.expiryDate.toISOString()}`);
  console.log(`Days to expiry: ${state.daysToExpiry.toFixed(1)}`);
  console.log(`Total PT in pool: ${Number(state.totalPt) / 1e18}`);
  console.log(`Total SY in pool: ${Number(state.totalSy) / 1e18}`);

  // Oracle rates (15-minute TWAP)
  const rates = await getOracleRates(PENDLE_MARKET, 900);
  console.log(`PT/Asset TWAP rate: ${rates.ptToAssetRate.toFixed(6)}`);
  console.log(`Oracle ready: ${rates.oracleReady}`);

  // SY exchange rate
  const syInfo = await getSyInfo(SY_WSTETH);
  console.log(`SY exchange rate: ${syInfo.exchangeRate.toFixed(6)}`);
  console.log(`Valid input tokens: ${syInfo.tokensIn.join(", ")}`);

  // Swap previews
  const previews = await previewSwaps(PENDLE_MARKET, WETH);
  console.log(`Buy 1 ETH worth of PT -> ${previews.buyPt.ptOut.toFixed(4)} PT`);
  console.log(`Sell 1 PT -> ${previews.sellPt.tokenOut.toFixed(4)} WETH`);
  console.log(`Buy price impact: ${(previews.buyPt.priceImpact * 100).toFixed(4)}%`);

  // YT accrued yield
  const ytInfo = await getYtAccruedYield(YT_WSTETH, account.address);
  console.log(`Accrued interest: ${ytInfo.accruedInterest.toFixed(6)} SY`);
}

main().catch(console.error);
```
