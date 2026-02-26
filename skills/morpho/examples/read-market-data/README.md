# Read Morpho Blue Market Data

Read market state, user positions, oracle prices, and utilization from Morpho Blue. All read-only -- no transactions needed.

## Setup

```typescript
import {
  createPublicClient,
  http,
  encodeAbiParameters,
  keccak256,
  formatUnits,
  type Address,
} from "viem";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const MORPHO = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb" as const;
```

## ABIs

```typescript
const morphoAbi = [
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
    name: "idToMarketParams",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [
      {
        name: "",
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
  },
] as const;

const oracleAbi = [
  {
    name: "price",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const erc20Abi = [
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;
```

## Market ID Derivation

```typescript
type MarketParams = {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
};

function computeMarketId(params: MarketParams): `0x${string}` {
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
```

## Read Market State

```typescript
async function getMarketState(marketId: `0x${string}`) {
  const [marketData, params] = await Promise.all([
    publicClient.readContract({
      address: MORPHO,
      abi: morphoAbi,
      functionName: "market",
      args: [marketId],
    }),
    publicClient.readContract({
      address: MORPHO,
      abi: morphoAbi,
      functionName: "idToMarketParams",
      args: [marketId],
    }),
  ]);

  const [
    totalSupplyAssets,
    totalSupplyShares,
    totalBorrowAssets,
    totalBorrowShares,
    lastUpdate,
    fee,
  ] = marketData;

  // Get token decimals for formatting
  const loanDecimals = await publicClient.readContract({
    address: params.loanToken,
    abi: erc20Abi,
    functionName: "decimals",
  });

  // Utilization rate
  const utilization = totalSupplyAssets > 0n
    ? Number((totalBorrowAssets * 10000n) / totalSupplyAssets) / 100
    : 0;

  return {
    loanToken: params.loanToken,
    collateralToken: params.collateralToken,
    oracle: params.oracle,
    irm: params.irm,
    lltv: `${Number(params.lltv) / 1e18 * 100}%`,
    totalSupply: formatUnits(totalSupplyAssets, loanDecimals),
    totalBorrow: formatUnits(totalBorrowAssets, loanDecimals),
    utilization: `${utilization}%`,
    fee: `${Number(fee) / 1e18 * 100}%`,
    lastUpdate: new Date(Number(lastUpdate) * 1000).toISOString(),
  };
}
```

## Read User Position

```typescript
async function getUserPosition(
  marketId: `0x${string}`,
  userAddress: Address
) {
  const [position, marketData, params] = await Promise.all([
    publicClient.readContract({
      address: MORPHO,
      abi: morphoAbi,
      functionName: "position",
      args: [marketId, userAddress],
    }),
    publicClient.readContract({
      address: MORPHO,
      abi: morphoAbi,
      functionName: "market",
      args: [marketId],
    }),
    publicClient.readContract({
      address: MORPHO,
      abi: morphoAbi,
      functionName: "idToMarketParams",
      args: [marketId],
    }),
  ]);

  const [supplyShares, borrowShares, collateral] = position;
  const [
    totalSupplyAssets,
    totalSupplyShares,
    totalBorrowAssets,
    totalBorrowShares,
  ] = marketData;

  const [loanDecimals, collateralDecimals] = await Promise.all([
    publicClient.readContract({
      address: params.loanToken,
      abi: erc20Abi,
      functionName: "decimals",
    }),
    publicClient.readContract({
      address: params.collateralToken,
      abi: erc20Abi,
      functionName: "decimals",
    }),
  ]);

  // Convert shares to assets
  const supplyAssets = totalSupplyShares > 0n
    ? (supplyShares * totalSupplyAssets) / totalSupplyShares
    : 0n;

  const borrowAssets = totalBorrowShares > 0n
    ? (BigInt(borrowShares) * totalBorrowAssets) / totalBorrowShares
    : 0n;

  return {
    supplyAssets: formatUnits(supplyAssets, loanDecimals),
    supplyShares: supplyShares.toString(),
    borrowAssets: formatUnits(borrowAssets, loanDecimals),
    borrowShares: borrowShares.toString(),
    collateral: formatUnits(BigInt(collateral), collateralDecimals),
  };
}
```

## Read Oracle Price

```typescript
async function getOraclePrice(
  oracleAddress: Address,
  loanDecimals: number,
  collateralDecimals: number
): Promise<{ rawPrice: bigint; humanPrice: number }> {
  const rawPrice = await publicClient.readContract({
    address: oracleAddress,
    abi: oracleAbi,
    functionName: "price",
  });

  // Price decimals = 36 + loanDecimals - collateralDecimals
  const priceDecimals = 36 + loanDecimals - collateralDecimals;
  const humanPrice = Number(rawPrice) / 10 ** priceDecimals;

  return { rawPrice, humanPrice };
}
```

## Check Liquidation Risk

```typescript
async function checkLiquidationRisk(
  marketId: `0x${string}`,
  userAddress: Address
): Promise<{
  currentLtv: number;
  lltv: number;
  safetyMargin: number;
  liquidatable: boolean;
}> {
  const params = await publicClient.readContract({
    address: MORPHO,
    abi: morphoAbi,
    functionName: "idToMarketParams",
    args: [marketId],
  });

  const [position, marketData] = await Promise.all([
    publicClient.readContract({
      address: MORPHO,
      abi: morphoAbi,
      functionName: "position",
      args: [marketId, userAddress],
    }),
    publicClient.readContract({
      address: MORPHO,
      abi: morphoAbi,
      functionName: "market",
      args: [marketId],
    }),
  ]);

  const [, borrowShares, collateral] = position;
  const [, , totalBorrowAssets, totalBorrowShares] = marketData;

  if (borrowShares === 0n) {
    return { currentLtv: 0, lltv: Number(params.lltv) / 1e18, safetyMargin: 1, liquidatable: false };
  }

  const borrowAssets = (BigInt(borrowShares) * totalBorrowAssets) / totalBorrowShares;

  const oraclePrice = await publicClient.readContract({
    address: params.oracle,
    abi: oracleAbi,
    functionName: "price",
  });

  // collateralValue in loan token = collateral * oraclePrice / ORACLE_PRICE_SCALE
  const ORACLE_PRICE_SCALE = 10n ** 36n;
  const collateralValueInLoanToken = (BigInt(collateral) * oraclePrice) / ORACLE_PRICE_SCALE;

  const currentLtv = collateralValueInLoanToken > 0n
    ? Number(borrowAssets * 10000n / collateralValueInLoanToken) / 10000
    : Infinity;

  const lltv = Number(params.lltv) / 1e18;
  const safetyMargin = currentLtv > 0 ? (lltv - currentLtv) / lltv : 1;

  return {
    currentLtv,
    lltv,
    safetyMargin,
    liquidatable: currentLtv >= lltv,
  };
}
```

## Complete Usage

```typescript
async function main() {
  // Use a known market ID or compute from params
  const marketParams: MarketParams = {
    loanToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address, // USDC
    collateralToken: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0" as Address, // wstETH
    oracle: "0x48F7E36EB6B826B2dF4B2E630B62Cd25e89E40e2" as Address,
    irm: "0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC" as Address,
    lltv: 860000000000000000n,
  };

  const marketId = computeMarketId(marketParams);

  // Market overview
  const state = await getMarketState(marketId);
  console.log("Market State:", state);

  // User position
  const userAddress = "0x..." as Address;
  const position = await getUserPosition(marketId, userAddress);
  console.log("User Position:", position);

  // Oracle price
  const price = await getOraclePrice(marketParams.oracle, 6, 18);
  console.log(`Oracle price: ${price.humanPrice}`);

  // Liquidation risk
  const risk = await checkLiquidationRisk(marketId, userAddress);
  console.log(`Current LTV: ${(risk.currentLtv * 100).toFixed(2)}%`);
  console.log(`LLTV: ${(risk.lltv * 100).toFixed(2)}%`);
  console.log(`Safety margin: ${(risk.safetyMargin * 100).toFixed(2)}%`);
  console.log(`Liquidatable: ${risk.liquidatable}`);
}

main().catch(console.error);
```
