# Read Pool State Examples

Reading Uniswap V3 pool state on-chain using viem. Covers pool discovery, slot0, liquidity, price conversion, and tick data.

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

const FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984" as const;
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const;
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
```

## Getting Pool Address from Factory

Each V3 pool is uniquely identified by (token0, token1, fee). The factory's `getPool` returns the deployed pool address.

```typescript
const factoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
]);

async function getPoolAddress(
  tokenA: Address,
  tokenB: Address,
  fee: number
): Promise<Address> {
  const pool = await publicClient.readContract({
    address: FACTORY,
    abi: factoryAbi,
    functionName: "getPool",
    args: [tokenA, tokenB, fee],
  });

  if (pool === "0x0000000000000000000000000000000000000000") {
    throw new Error(`Pool does not exist for fee tier ${fee}`);
  }

  return pool as Address;
}

// WETH/USDC 0.05% pool
const poolAddress = await getPoolAddress(WETH, USDC, 500);
// Returns: 0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640
```

## Reading slot0

`slot0` holds the most frequently accessed pool state packed into a single storage slot for gas efficiency.

```typescript
const poolAbi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function liquidity() view returns (uint128)",
  "function fee() view returns (uint24)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function tickSpacing() view returns (int24)",
  "function ticks(int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityOutsideX128, uint32 secondsOutside, bool initialized)",
]);

async function getPoolState(pool: Address) {
  const [slot0, liquidity, fee, token0, token1, tickSpacing] =
    await Promise.all([
      publicClient.readContract({ address: pool, abi: poolAbi, functionName: "slot0" }),
      publicClient.readContract({ address: pool, abi: poolAbi, functionName: "liquidity" }),
      publicClient.readContract({ address: pool, abi: poolAbi, functionName: "fee" }),
      publicClient.readContract({ address: pool, abi: poolAbi, functionName: "token0" }),
      publicClient.readContract({ address: pool, abi: poolAbi, functionName: "token1" }),
      publicClient.readContract({ address: pool, abi: poolAbi, functionName: "tickSpacing" }),
    ]);

  return {
    sqrtPriceX96: slot0[0],
    tick: slot0[1],
    observationIndex: slot0[2],
    observationCardinality: slot0[3],
    feeProtocol: slot0[5],
    unlocked: slot0[6],
    liquidity,
    fee,
    token0,
    token1,
    tickSpacing,
  };
}
```

## Price Calculation from sqrtPriceX96

V3 stores price as `sqrt(price) * 2^96` in Q64.96 fixed-point format. Converting to a human-readable price requires squaring and adjusting for token decimals.

```typescript
function sqrtPriceX96ToPrice(
  sqrtPriceX96: bigint,
  decimals0: number,
  decimals1: number
): number {
  // price = (sqrtPriceX96 / 2^96)^2
  // This gives price in terms of token1 per token0
  // Adjust by decimal difference: multiply by 10^(decimals0 - decimals1)

  const numerator = sqrtPriceX96 * sqrtPriceX96;
  const denominator = 2n ** 192n; // (2^96)^2

  // Convert to float for display -- precision loss acceptable for UI
  const rawPrice = Number(numerator) / Number(denominator);

  // Decimal adjustment: token0 has decimals0, token1 has decimals1
  const decimalAdjustment = 10 ** (decimals0 - decimals1);

  return rawPrice * decimalAdjustment;
}

// WETH/USDC pool: WETH is token0 (18 dec), USDC is token1 (6 dec)
// NOTE: In this specific pool USDC is token0 and WETH is token1
// because 0xA0b8... < 0xC02a... is TRUE -- USDC address is numerically smaller
// Always verify token ordering by reading pool.token0()
const state = await getPoolState(poolAddress);
const priceToken1PerToken0 = sqrtPriceX96ToPrice(state.sqrtPriceX96, 6, 18);
// This gives WETH per USDC; invert for USDC per WETH
const ethPriceInUsdc = 1 / priceToken1PerToken0;
console.log(`ETH price: $${ethPriceInUsdc.toFixed(2)}`);
```

## High-Precision Price with BigInt

For applications that need more precision (e.g. arbitrage bots), avoid floating-point entirely.

```typescript
function sqrtPriceX96ToPriceBigInt(
  sqrtPriceX96: bigint,
  decimals0: number,
  decimals1: number
): { numerator: bigint; denominator: bigint } {
  // price = sqrtPriceX96^2 * 10^decimals0 / (2^192 * 10^decimals1)
  const numerator = sqrtPriceX96 * sqrtPriceX96 * 10n ** BigInt(decimals0);
  const denominator = 2n ** 192n * 10n ** BigInt(decimals1);

  return { numerator, denominator };
}
```

## Reading Tick Data

Each initialized tick stores liquidity transitions and fee growth accumulators.

```typescript
async function getTickData(pool: Address, tick: number) {
  const data = await publicClient.readContract({
    address: pool,
    abi: poolAbi,
    functionName: "ticks",
    args: [tick],
  });

  return {
    liquidityGross: data[0], // Total liquidity referencing this tick
    liquidityNet: data[1],   // Net liquidity change when tick is crossed
    feeGrowthOutside0X128: data[2],
    feeGrowthOutside1X128: data[3],
    initialized: data[7],
  };
}

// Read the current tick and surrounding ticks
const { tick, tickSpacing } = await getPoolState(poolAddress);
const nearestTick = Math.floor(tick / Number(tickSpacing)) * Number(tickSpacing);

const [tickBelow, tickAbove] = await Promise.all([
  getTickData(poolAddress, nearestTick),
  getTickData(poolAddress, nearestTick + Number(tickSpacing)),
]);

console.log(`Current tick: ${tick}`);
console.log(`Nearest initialized tick below: ${nearestTick}`);
console.log(`Liquidity net at lower: ${tickBelow.liquidityNet}`);
console.log(`Liquidity net at upper: ${tickAbove.liquidityNet}`);
```

## Tick to Price Conversion

```typescript
// Each tick represents a 1 basis point (0.01%) price change
// price = 1.0001^tick
function tickToPrice(tick: number, decimals0: number, decimals1: number): number {
  const price = 1.0001 ** tick;
  return price * 10 ** (decimals0 - decimals1);
}

// Inverse: price to nearest valid tick
function priceToTick(price: number, decimals0: number, decimals1: number): number {
  const adjustedPrice = price / 10 ** (decimals0 - decimals1);
  return Math.floor(Math.log(adjustedPrice) / Math.log(1.0001));
}
```
