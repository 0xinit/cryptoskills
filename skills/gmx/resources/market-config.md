# GMX V2 Market Configuration

Available markets, pool composition, and parameter reference for GMX V2 on Arbitrum.

Last verified: February 2026. Markets are added/removed via governance. Use `Reader.getMarkets()` for the canonical list.

## Arbitrum Markets

### Fully Backed Markets

The index token matches the long collateral token. These markets have direct price exposure.

| Market | Index | Long Token | Short Token | Max Leverage |
|--------|-------|------------|-------------|--------------|
| ETH/USD | WETH | WETH | USDC | 100x |
| BTC/USD | WBTC | WBTC | USDC | 100x |
| ARB/USD | ARB | ARB | USDC | 100x |
| LINK/USD | LINK | LINK | USDC | 100x |
| UNI/USD | UNI | UNI | USDC | 100x |
| SOL/USD | SOL | SOL | USDC | 100x |

### Synthetic Markets

The index token differs from the collateral tokens. Price exposure is achieved synthetically.

| Market | Index | Long Token | Short Token | Max Leverage |
|--------|-------|------------|-------------|--------------|
| DOGE/USD | - | WETH | USDC | 50x |
| XRP/USD | - | WETH | USDC | 50x |
| LTC/USD | - | WETH | USDC | 50x |
| NEAR/USD | - | WETH | USDC | 50x |
| ATOM/USD | - | WETH | USDC | 50x |
| AAVE/USD | - | WETH | USDC | 50x |
| AVAX/USD | - | WETH | USDC | 50x |
| OP/USD | - | WETH | USDC | 50x |
| GMX/USD | - | WETH | USDC | 50x |
| PEPE/USD | - | WETH | USDC | 50x |
| WIF/USD | - | WETH | USDC | 50x |
| STX/USD | - | WETH | USDC | 50x |
| ORDI/USD | - | WETH | USDC | 50x |

> Synthetic markets use WETH + USDC as collateral regardless of the index token. The index token's price is tracked via Chainlink Data Streams.

## Market Parameters

### Fees

| Fee Type | Typical Value | Description |
|----------|---------------|-------------|
| Open/Close Fee | 0.05% - 0.07% | Applied to position size on open and close |
| Swap Fee | 0.05% - 0.07% | Applied to swap amount |
| Borrowing Fee | Variable | Per-second fee for using pool liquidity |
| Funding Fee | Variable | Paid between longs/shorts to balance OI |
| Price Impact | Variable | Based on pool imbalance — can be positive (rebate) or negative |

### Position Limits

| Parameter | Value | Notes |
|-----------|-------|-------|
| Min Leverage | 1.1x | Below this, position is rejected |
| Max Leverage (major) | 100x | ETH, BTC, SOL, ARB, LINK |
| Max Leverage (synthetic) | 50x | DOGE, XRP, LTC, and others |
| Min Collateral USD | ~$2 | Varies by market |
| Max Open Interest | Market-specific | Limited by pool size and reserve factor |

### Execution Fees

| Action | Estimated Execution Fee (Arbitrum) |
|--------|-----------------------------------|
| Market Order (swap) | ~0.0003-0.001 ETH |
| Limit/TP/SL Order | ~0.0003-0.001 ETH |
| Deposit (buy GM) | ~0.0003-0.001 ETH |
| Withdrawal (sell GM) | ~0.0003-0.001 ETH |

> Execution fees depend on Arbitrum gas prices, which fluctuate. The protocol adjusts the minimum fee dynamically. Always query the current minimum from DataStore or use the SDK's fee estimation.

## Pool Composition

Each GM pool has a target ratio of long token to short token value. Depositing or withdrawing in a way that moves the pool closer to this ratio incurs lower (or negative) price impact.

### Price Impact

| Scenario | Effect |
|----------|--------|
| Deposit long token when pool is long-heavy | Negative price impact (fewer GM tokens) |
| Deposit short token when pool is long-heavy | Positive price impact (more GM tokens) |
| Deposit that rebalances pool | Minimal or positive price impact |

### Reading Market Config On-Chain

```typescript
import { keccak256, encodePacked } from "viem";

const DATA_STORE = "0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8" as const;
const ETH_USD_MARKET = "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336" as const;

const dataStoreAbi = [
  {
    name: "getUint",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "key", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Build key for max leverage — uses keccak256 of the key name + market address
// Key format follows gmx-synthetics Keys.sol
const maxLeverage = await publicClient.readContract({
  address: DATA_STORE,
  abi: dataStoreAbi,
  functionName: "getUint",
  args: [
    keccak256(
      encodePacked(
        ["bytes32", "address"],
        [
          keccak256(encodePacked(["string"], ["MAX_LEVERAGE"])),
          ETH_USD_MARKET,
        ]
      )
    ),
  ],
});

console.log("Max leverage factor:", maxLeverage);
```

## Avalanche Markets

Avalanche has fewer markets than Arbitrum.

| Market | Index | Long Token | Short Token | Max Leverage |
|--------|-------|------------|-------------|--------------|
| ETH/USD | WETH.e | WETH.e | USDC | 100x |
| BTC/USD | WBTC.e | WBTC.e | USDC | 100x |
| AVAX/USD | WAVAX | WAVAX | USDC | 100x |

## Dynamic Market Discovery

Do not hardcode market addresses. Use the Reader contract to discover available markets:

```typescript
const READER = "0x22199a49A999c351eF7927602CFB187ec3cae489" as const;

const markets = await publicClient.readContract({
  address: READER,
  abi: [
    {
      name: "getMarkets",
      type: "function",
      stateMutability: "view",
      inputs: [
        { name: "dataStore", type: "address" },
        { name: "start", type: "uint256" },
        { name: "end", type: "uint256" },
      ],
      outputs: [
        {
          name: "",
          type: "tuple[]",
          components: [
            { name: "marketToken", type: "address" },
            { name: "indexToken", type: "address" },
            { name: "longToken", type: "address" },
            { name: "shortToken", type: "address" },
          ],
        },
      ],
    },
  ],
  functionName: "getMarkets",
  args: [DATA_STORE, 0n, 200n],
});
```

## References

- [GMX V2 Trading Docs](https://docs.gmx.io/docs/trading/v2/)
- [GMX V2 Liquidity Docs](https://docs.gmx.io/docs/providing-liquidity/v2/)
- [gmx-synthetics Keys.sol](https://github.com/gmx-io/gmx-synthetics/blob/main/contracts/data/Keys.sol)
