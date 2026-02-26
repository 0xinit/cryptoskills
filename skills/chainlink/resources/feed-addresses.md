# Chainlink Feed Addresses

> **Last verified:** 2025-05-01

## Ethereum Mainnet

| Pair | Address | Decimals | Heartbeat |
|------|---------|----------|-----------|
| ETH/USD | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` | 8 | 3600s |
| BTC/USD | `0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c` | 8 | 3600s |
| LINK/USD | `0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c` | 8 | 3600s |
| USDC/USD | `0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6` | 8 | 86400s |
| DAI/USD | `0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9` | 8 | 3600s |
| USDT/USD | `0x3E7d1eAB13ad0104d2750B8863b489D65364e32D` | 8 | 86400s |
| AAVE/USD | `0x547a514d5e3769680Ce22B2361c10Ea13619e8a9` | 8 | 3600s |
| UNI/USD | `0x553303d460EE0afB37EdFf9bE42922D8FF63220e` | 8 | 3600s |
| SOL/USD | `0x4ffC43a60e009B551865A93d232E33Fce9f01507` | 8 | 3600s |
| MATIC/USD | `0x7bAC85A8a13A4BcD8abb3eB7d6b4d632c5a57676` | 8 | 3600s |

## Arbitrum One

| Pair | Address | Decimals | Heartbeat |
|------|---------|----------|-----------|
| ETH/USD | `0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612` | 8 | 86400s |
| BTC/USD | `0x6ce185860a4963106506C203335A2910413708e9` | 8 | 86400s |
| LINK/USD | `0x86E53CF1B870786351Da77A57575e79CB55812CB` | 8 | 86400s |
| USDC/USD | `0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3` | 8 | 86400s |
| DAI/USD | `0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB` | 8 | 86400s |
| ARB/USD | `0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6` | 8 | 86400s |

## Optimism

| Pair | Address | Decimals | Heartbeat |
|------|---------|----------|-----------|
| ETH/USD | `0x13e3Ee699D1909E989722E753853AE30b17e08c5` | 8 | 1200s |
| BTC/USD | `0xD702DD976Fb76Fffc2D3963D037dfDae5b04E593` | 8 | 1200s |
| LINK/USD | `0xCc232dcFAAE6354cE191Bd574108c1aD03f86229` | 8 | 1200s |
| USDC/USD | `0x16a9FA2FDa030272Ce99B29CF780dFA30361E0f3` | 8 | 86400s |
| OP/USD | `0x0D276FC14719f9292D5C1eA2198673d1f4269246` | 8 | 1200s |

## Base

| Pair | Address | Decimals | Heartbeat |
|------|---------|----------|-----------|
| ETH/USD | `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70` | 8 | 1200s |
| BTC/USD | `0x64c911996D3c6aC71f9b455B1E8E7M1BbDC942BAe` | 8 | 1200s |
| LINK/USD | `0x17CAb8FE31cA45e4684E33E3D258F20E88B8fD8B` | 8 | 1200s |
| USDC/USD | `0x7e860098F58bBFC8648a4311b374B1D669a2bc6B` | 8 | 86400s |
| cbETH/USD | `0xd7818272B9e248357d13057AAb0B417aF31E817d` | 8 | 86400s |

## Polygon

| Pair | Address | Decimals | Heartbeat |
|------|---------|----------|-----------|
| ETH/USD | `0xF9680D99D6C9589e2a93a78A04A279e509205945` | 8 | 27s |
| BTC/USD | `0xc907E116054Ad103354f2D350FD2514433D57F6f` | 8 | 27s |
| LINK/USD | `0xd9FFdb71EbE7496cC440152d43986Aae0AB76665` | 8 | 27s |
| MATIC/USD | `0xAB594600376Ec9fD91F8e8dC9E0950EfEf8a9E0` | 8 | 27s |
| USDC/USD | `0xfE4A8cc5b5B2366C1B58Bea3858e81843583ee2e` | 8 | 86400s |

## Sequencer Uptime Feeds

Required on L2s before trusting price data. See SKILL.md for usage.

| Chain | Address |
|-------|---------|
| Arbitrum | `0xFdB631F5EE196F0ed6FAa767959853A9F217697D` |
| Optimism | `0x371EAD81c9102C9BF4874A9075FFFf170F2Ee389` |
| Base | `0xBCF85224fc0756B9Fa45aAb7d2257eC1673570EF` |

## Feed Registry (Ethereum Mainnet Only)

The Feed Registry allows querying any feed by base/quote token addresses instead of individual feed addresses.

| Contract | Address |
|----------|---------|
| Feed Registry | `0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf` |

```solidity
import {FeedRegistryInterface} from "@chainlink/contracts/src/v0.8/interfaces/FeedRegistryInterface.sol";

// Denominations library provides base/quote constants
import {Denominations} from "@chainlink/contracts/src/v0.8/Denominations.sol";

FeedRegistryInterface registry = FeedRegistryInterface(0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf);

// Get ETH/USD price using token addresses
(, int256 price, , , ) = registry.latestRoundData(
    Denominations.ETH,
    Denominations.USD
);
```

## Verification

Always verify feed addresses on-chain before using in production:

```bash
# Verify the feed contract exists and returns data
cast call 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 \
  "description()(string)" --rpc-url $ETH_RPC_URL
# Expected: "ETH / USD"

cast call 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 \
  "decimals()(uint8)" --rpc-url $ETH_RPC_URL
# Expected: 8
```

Source: [Chainlink Price Feed Addresses](https://docs.chain.link/data-feeds/price-feeds/addresses)
