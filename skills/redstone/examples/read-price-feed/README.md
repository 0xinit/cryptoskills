# Read RedStone Push Price Feed

Reading RedStone push model feeds using the Chainlink-compatible `AggregatorV3Interface`. These feeds store prices on-chain and are drop-in replacements for Chainlink oracles.

## Solidity: Basic Push Feed Reader

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/// @title RedStone Push Feed Reader
/// @notice Reads RedStone push feeds using standard Chainlink interface
/// @dev RedStone push feeds implement AggregatorV3Interface identically to Chainlink
contract RedStonePushFeedReader {
    AggregatorV3Interface public immutable ethUsdFeed;
    AggregatorV3Interface public immutable btcUsdFeed;

    // RedStone push feed heartbeat varies per chain
    // Ethereum: typically 3600s, Arbitrum: up to 86400s
    uint256 private constant STALENESS_THRESHOLD = 3600;

    error InvalidPrice();
    error StalePrice(uint256 updatedAt, uint256 threshold);
    error StaleRound();

    constructor(address _ethUsdFeed, address _btcUsdFeed) {
        ethUsdFeed = AggregatorV3Interface(_ethUsdFeed);
        btcUsdFeed = AggregatorV3Interface(_btcUsdFeed);
    }

    /// @notice Get validated ETH/USD price
    /// @return price Price in 8 decimals
    function getEthUsdPrice() external view returns (uint256) {
        return _getValidatedPrice(ethUsdFeed);
    }

    /// @notice Get validated BTC/USD price
    /// @return price Price in 8 decimals
    function getBtcUsdPrice() external view returns (uint256) {
        return _getValidatedPrice(btcUsdFeed);
    }

    function _getValidatedPrice(AggregatorV3Interface feed)
        internal
        view
        returns (uint256)
    {
        (
            uint80 roundId,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = feed.latestRoundData();

        if (answer <= 0) revert InvalidPrice();
        if (block.timestamp - updatedAt > STALENESS_THRESHOLD) {
            revert StalePrice(updatedAt, STALENESS_THRESHOLD);
        }
        if (answeredInRound < roundId) revert StaleRound();

        return uint256(answer);
    }
}
```

## Solidity: Dual Oracle Pattern

Use RedStone push as primary and Chainlink as fallback, or vice versa.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/// @title Dual Oracle Reader
/// @notice Uses RedStone push as primary with Chainlink fallback
contract DualOracleReader {
    AggregatorV3Interface public immutable primaryFeed;
    AggregatorV3Interface public immutable fallbackFeed;

    uint256 public immutable stalenessThreshold;

    // Maximum allowed deviation between primary and fallback (5%)
    uint256 public constant MAX_DEVIATION_BPS = 500;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    event FallbackUsed(int256 primaryAnswer, int256 fallbackAnswer);

    error BothOraclesFailed();
    error PriceDeviationTooHigh(uint256 primary, uint256 fallback_);

    constructor(
        address _primaryFeed,
        address _fallbackFeed,
        uint256 _stalenessThreshold
    ) {
        primaryFeed = AggregatorV3Interface(_primaryFeed);
        fallbackFeed = AggregatorV3Interface(_fallbackFeed);
        stalenessThreshold = _stalenessThreshold;
    }

    /// @notice Get price from primary oracle with fallback
    /// @return price Validated price in feed decimals
    function getPrice() external returns (uint256 price) {
        (bool primaryOk, uint256 primaryPrice) = _tryGetPrice(primaryFeed);
        (bool fallbackOk, uint256 fallbackPrice) = _tryGetPrice(fallbackFeed);

        if (!primaryOk && !fallbackOk) revert BothOraclesFailed();

        if (primaryOk && fallbackOk) {
            _checkDeviation(primaryPrice, fallbackPrice);
            return primaryPrice;
        }

        if (primaryOk) return primaryPrice;

        emit FallbackUsed(0, int256(fallbackPrice));
        return fallbackPrice;
    }

    function _tryGetPrice(AggregatorV3Interface feed)
        internal
        view
        returns (bool success, uint256 price)
    {
        try feed.latestRoundData() returns (
            uint80 roundId,
            int256 answer,
            uint256,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            if (answer <= 0) return (false, 0);
            if (block.timestamp - updatedAt > stalenessThreshold) return (false, 0);
            if (answeredInRound < roundId) return (false, 0);
            return (true, uint256(answer));
        } catch {
            return (false, 0);
        }
    }

    function _checkDeviation(uint256 primary, uint256 fallback_) internal pure {
        uint256 diff = primary > fallback_
            ? primary - fallback_
            : fallback_ - primary;

        uint256 deviationBps = (diff * BPS_DENOMINATOR) / primary;
        if (deviationBps > MAX_DEVIATION_BPS) {
            revert PriceDeviationTooHigh(primary, fallback_);
        }
    }
}
```

## TypeScript: Read Push Feed with viem

```typescript
import { createPublicClient, http, parseAbi } from "viem";
import { mainnet, arbitrum } from "viem/chains";

const AGGREGATOR_V3_ABI = parseAbi([
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() external view returns (uint8)",
  "function description() external view returns (string)",
]);

// RedStone push feed addresses (Ethereum mainnet)
const REDSTONE_FEEDS = {
  "ETH/USD": "0xdDb6F90fFb6E27934e0281Db5bCC4083E4f1030a",
  "BTC/USD": "0xe440a6cD2e13B94cF717e0bDAa4C67EFc1C4f5F8",
} as const;

const STALENESS_THRESHOLD = 3600n;

const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

async function readRedStonePushFeed(feedAddress: `0x${string}`) {
  const [roundData, feedDecimals, description] = await Promise.all([
    client.readContract({
      address: feedAddress,
      abi: AGGREGATOR_V3_ABI,
      functionName: "latestRoundData",
    }),
    client.readContract({
      address: feedAddress,
      abi: AGGREGATOR_V3_ABI,
      functionName: "decimals",
    }),
    client.readContract({
      address: feedAddress,
      abi: AGGREGATOR_V3_ABI,
      functionName: "description",
    }),
  ]);

  const [roundId, answer, , updatedAt, answeredInRound] = roundData;

  if (answer <= 0n) throw new Error("Invalid price: non-positive");
  if (updatedAt === 0n) throw new Error("Round not complete");

  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now - updatedAt > STALENESS_THRESHOLD) {
    throw new Error(`Stale price: ${now - updatedAt}s since last update`);
  }
  if (answeredInRound < roundId) {
    throw new Error("Stale round: answeredInRound < roundId");
  }

  return {
    description,
    price: answer,
    decimals: feedDecimals,
    updatedAt,
    formatted: `$${(Number(answer) / 10 ** feedDecimals).toFixed(2)}`,
  };
}

// Read ETH/USD from RedStone push feed
const ethPrice = await readRedStonePushFeed(
  REDSTONE_FEEDS["ETH/USD"] as `0x${string}`
);
console.log(`${ethPrice.description}: ${ethPrice.formatted}`);
```

## Key Points

- RedStone push feeds use the exact same `AggregatorV3Interface` as Chainlink
- All staleness and sanity checks that apply to Chainlink also apply here
- Push feeds are ideal when integrating with existing Chainlink-consuming protocols
- The dual oracle pattern provides resilience against single oracle failure
- RedStone push feed proxy addresses are stable across upgrades
- Heartbeat intervals vary per chain and per feed -- always verify from RedStone docs
