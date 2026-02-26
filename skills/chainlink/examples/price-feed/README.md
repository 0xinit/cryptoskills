# Price Feed Examples

Reading Chainlink price feeds on-chain and off-chain.

## Solidity: Basic Price Consumer

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract PriceFeedReader {
    AggregatorV3Interface internal immutable ethUsdFeed;
    AggregatorV3Interface internal immutable btcUsdFeed;

    // ETH/USD heartbeat on mainnet: 3600s
    uint256 private constant ETH_STALENESS = 3600;
    // BTC/USD heartbeat on mainnet: 3600s
    uint256 private constant BTC_STALENESS = 3600;

    error InvalidPrice();
    error StalePrice(uint256 updatedAt, uint256 threshold);
    error StaleRound();

    constructor(address _ethUsdFeed, address _btcUsdFeed) {
        ethUsdFeed = AggregatorV3Interface(_ethUsdFeed);
        btcUsdFeed = AggregatorV3Interface(_btcUsdFeed);
    }

    function getEthUsdPrice() external view returns (uint256) {
        return _getPrice(ethUsdFeed, ETH_STALENESS);
    }

    function getBtcUsdPrice() external view returns (uint256) {
        return _getPrice(btcUsdFeed, BTC_STALENESS);
    }

    function _getPrice(
        AggregatorV3Interface feed,
        uint256 stalenessThreshold
    ) internal view returns (uint256) {
        (
            uint80 roundId,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = feed.latestRoundData();

        if (answer <= 0) revert InvalidPrice();
        if (block.timestamp - updatedAt > stalenessThreshold) {
            revert StalePrice(updatedAt, stalenessThreshold);
        }
        if (answeredInRound < roundId) revert StaleRound();

        return uint256(answer);
    }
}
```

## Decimal Normalization

USD pairs return 8 decimals. ETH-denominated pairs return 18. When combining feeds or comparing with token amounts, normalize to a common base.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract DecimalNormalizer {
    /// @notice Normalize any feed answer to 18 decimals (WAD)
    function toWad(int256 answer, uint8 feedDecimals) internal pure returns (uint256) {
        if (answer <= 0) revert("Invalid price");
        if (feedDecimals <= 18) {
            return uint256(answer) * 10 ** (18 - feedDecimals);
        }
        return uint256(answer) / 10 ** (feedDecimals - 18);
    }

    /// @notice Get token value in USD with 18-decimal precision
    /// @dev tokenAmount is in token's native decimals
    function getValueUsd(
        uint256 tokenAmount,
        uint8 tokenDecimals,
        AggregatorV3Interface feed
    ) external view returns (uint256) {
        (, int256 answer, , , ) = feed.latestRoundData();
        uint8 feedDecimals = feed.decimals();

        uint256 priceWad = toWad(answer, feedDecimals);
        uint256 amountWad = tokenAmount * 10 ** (18 - tokenDecimals);

        // Both in 18 decimals, result is 36 decimals, scale back to 18
        return (amountWad * priceWad) / 1e18;
    }
}
```

## Reading Feeds with viem (TypeScript)

```typescript
import { createPublicClient, http, parseAbi } from "viem";
import { mainnet, arbitrum } from "viem/chains";

const AGGREGATOR_V3_ABI = parseAbi([
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() external view returns (uint8)",
  "function description() external view returns (string)",
]);

const FEEDS = {
  "ETH/USD": "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  "BTC/USD": "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
  "LINK/USD": "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
  "USDC/USD": "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
} as const;

const STALENESS_THRESHOLD = 3600n;

const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

async function readFeed(feedAddress: `0x${string}`) {
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
    throw new Error(`Stale price: ${now - updatedAt}s since update`);
  }
  if (answeredInRound < roundId) {
    throw new Error("Stale round");
  }

  return {
    description,
    price: answer,
    decimals: feedDecimals,
    updatedAt,
    formatted: `$${(Number(answer) / 10 ** feedDecimals).toFixed(2)}`,
  };
}

// Read a single feed
const ethPrice = await readFeed(FEEDS["ETH/USD"]);
console.log(`${ethPrice.description}: ${ethPrice.formatted}`);
```

## Multi-Price Aggregation

Fetch multiple feeds in a single multicall for gas efficiency off-chain.

```typescript
async function getMultiplePrices(
  feeds: Record<string, `0x${string}`>
): Promise<Record<string, { price: bigint; decimals: number; formatted: string }>> {
  const entries = Object.entries(feeds);

  const calls = entries.flatMap(([, addr]) => [
    {
      address: addr,
      abi: AGGREGATOR_V3_ABI,
      functionName: "latestRoundData" as const,
    },
    {
      address: addr,
      abi: AGGREGATOR_V3_ABI,
      functionName: "decimals" as const,
    },
  ]);

  const results = await client.multicall({ contracts: calls });
  const prices: Record<string, { price: bigint; decimals: number; formatted: string }> = {};

  for (let i = 0; i < entries.length; i++) {
    const [name] = entries[i];
    const roundData = results[i * 2];
    const decimalsResult = results[i * 2 + 1];

    if (roundData.status !== "success" || decimalsResult.status !== "success") {
      throw new Error(`Failed to read feed: ${name}`);
    }

    const [, answer] = roundData.result as [bigint, bigint, bigint, bigint, bigint];
    const decimals = decimalsResult.result as number;

    prices[name] = {
      price: answer,
      decimals,
      formatted: `$${(Number(answer) / 10 ** decimals).toFixed(2)}`,
    };
  }

  return prices;
}

const allPrices = await getMultiplePrices(FEEDS);
for (const [pair, data] of Object.entries(allPrices)) {
  console.log(`${pair}: ${data.formatted}`);
}
```
