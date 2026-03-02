# Pyth Price Feed IDs

> **Last verified:** March 2026

Feed IDs are `bytes32` identifiers that are consistent across ALL EVM chains. The same feed ID works on Ethereum, Arbitrum, Base, and every other Pyth-supported chain.

## Major Pairs

| Pair | Feed ID |
|------|---------|
| BTC/USD | `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43` |
| ETH/USD | `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace` |
| SOL/USD | `0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d` |
| BNB/USD | `0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f` |
| AVAX/USD | `0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1571f8a528a65` |
| ARB/USD | `0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5` |
| OP/USD | `0x385f64d993f7b77d8182ed5003d97c60aa3361f3cecfe711544d2d59165e9bdf` |
| MATIC/USD | `0x5de33440f6c868ee8c5fc9463ee6f6deca96e7bf3bd3e8c3e6b3b6e73e8b3b6e` |
| DOGE/USD | `0xdcef50dd0a4cd2dcc17e45df1676dcb8a4f6de84bd23d3f9ab82ec3311b3b351` |
| LINK/USD | `0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221` |

## Stablecoins

| Pair | Feed ID |
|------|---------|
| USDC/USD | `0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a` |
| USDT/USD | `0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b` |
| DAI/USD | `0xb0948a5e5313200c632b51bb5ca32f6de0d36e9950a942d19751e6f20977b50f` |

## DeFi Tokens

| Pair | Feed ID |
|------|---------|
| UNI/USD | `0x78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501` |
| AAVE/USD | `0x2b9ab1e972a281585084148ba1389800799bd4be63b957507db1349314e47445` |
| MKR/USD | `0x9375299e31c0deb9c6bc378e6329aab44cb4ec3f5b43a4b3293a26f9d3b8e6db` |
| CRV/USD | `0xa19d04ac696c7a6616d291c7e5d1c0c74ad4c7e8d1a17f8053c50a9b8a5a0e12` |

## L2 Native Tokens

| Pair | Feed ID |
|------|---------|
| SEI/USD | `0x53614f1cb0c031d4af66c04cb9c756234adad0e1cee85303795091499a4084eb` |
| SUI/USD | `0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744` |
| APT/USD | `0x03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5` |

## Looking Up Feed IDs

Full searchable list: https://pyth.network/developers/price-feed-ids

### Programmatic Lookup

```typescript
import { HermesClient } from "@pythnetwork/hermes-client";

const hermes = new HermesClient("https://hermes.pyth.network");

async function findFeedId(symbol: string) {
  const feeds = await hermes.getPriceFeeds({ query: symbol });
  for (const feed of feeds) {
    console.log(`${feed.attributes.symbol}: 0x${feed.id}`);
  }
}

// Usage
await findFeedId("ETH/USD");
```

## Reference

- [Pyth Price Feed IDs (official)](https://pyth.network/developers/price-feed-ids)
- [Hermes API -- List Price Feeds](https://hermes.pyth.network/docs/#/rest/latest_price_feeds)
