# Oracle Security Testing

Foundry tests for oracle security: stale price detection, manipulation resistance, multi-oracle fallback, L2 sequencer checks, deviation thresholds, and mocking oracle failures.

## Stale Price Feed Detection

Chainlink feeds can go stale if the network is congested or a feed is deprecated. Reading stale data means pricing assets at hours- or days-old values.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

error StalePrice(uint256 updatedAt, uint256 threshold);
error NegativePrice(int256 price);
error StaleRound(uint80 answeredInRound, uint80 roundId);

contract SecureOracle {
    AggregatorV3Interface public feed;
    uint256 public maxStaleness;

    constructor(address _feed, uint256 _maxStaleness) {
        feed = AggregatorV3Interface(_feed);
        maxStaleness = _maxStaleness;
    }

    function getPrice() external view returns (uint256) {
        (
            uint80 roundId,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = feed.latestRoundData();

        if (answer <= 0) revert NegativePrice(answer);
        if (updatedAt < block.timestamp - maxStaleness) {
            revert StalePrice(updatedAt, maxStaleness);
        }
        if (answeredInRound < roundId) revert StaleRound(answeredInRound, roundId);

        return uint256(answer);
    }
}
```

## Testing Staleness with vm.mockCall

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {SecureOracle} from "../src/SecureOracle.sol";

contract OracleSecurityTest is Test {
    SecureOracle oracle;
    address mockFeed = makeAddr("chainlinkFeed");

    function setUp() public {
        oracle = new SecureOracle(mockFeed, 3600); // 1 hour staleness
    }

    function _mockLatestRoundData(
        uint80 roundId,
        int256 answer,
        uint256 updatedAt,
        uint80 answeredInRound
    ) internal {
        vm.mockCall(
            mockFeed,
            abi.encodeWithSignature("latestRoundData()"),
            abi.encode(roundId, answer, uint256(0), updatedAt, answeredInRound)
        );
    }

    function test_revertsOnStalePrice() public {
        _mockLatestRoundData(1, 2000e8, block.timestamp - 7200, 1);
        vm.expectRevert();
        oracle.getPrice();
    }

    function test_revertsOnNegativePrice() public {
        _mockLatestRoundData(1, -1, block.timestamp, 1);
        vm.expectRevert();
        oracle.getPrice();
    }

    function test_revertsOnStaleRound() public {
        _mockLatestRoundData(5, 2000e8, block.timestamp, 4);
        vm.expectRevert();
        oracle.getPrice();
    }

    function test_acceptsFreshPrice() public {
        _mockLatestRoundData(1, 2000e8, block.timestamp - 1800, 1);
        uint256 price = oracle.getPrice();
        assertEq(price, 2000e8);
    }
}
```

## Price Manipulation Resistance

Test that your oracle cannot be moved by a single large trade.

```solidity
function test_spotPriceManipulable() public {
    // Fork mainnet
    vm.createSelectFork(vm.envString("ETH_RPC_URL"), 19_000_000);

    IUniswapV3Pool pool = IUniswapV3Pool(UNI_POOL);
    (uint160 sqrtPriceBefore,,,,,,) = pool.slot0();

    // Whale swap moves spot price
    _executeWhaleSwap(pool, 50_000_000e6);

    (uint160 sqrtPriceAfter,,,,,,) = pool.slot0();

    // Spot price moved -- this is why slot0() is dangerous for pricing
    assertTrue(sqrtPriceBefore != sqrtPriceAfter);
}
```

## Multi-Oracle Fallback Pattern

Primary oracle fails, fall back to secondary. If both fail, revert -- never return a stale or made-up price.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

error AllOraclesFailed();

contract MultiOracle {
    AggregatorV3Interface public primaryFeed;
    AggregatorV3Interface public fallbackFeed;
    uint256 public maxStaleness;

    constructor(address _primary, address _fallback, uint256 _maxStaleness) {
        primaryFeed = AggregatorV3Interface(_primary);
        fallbackFeed = AggregatorV3Interface(_fallback);
        maxStaleness = _maxStaleness;
    }

    function getPrice() external view returns (uint256) {
        (bool primaryOk, uint256 primaryPrice) = _tryGetPrice(primaryFeed);
        if (primaryOk) return primaryPrice;

        (bool fallbackOk, uint256 fallbackPrice) = _tryGetPrice(fallbackFeed);
        if (fallbackOk) return fallbackPrice;

        revert AllOraclesFailed();
    }

    function _tryGetPrice(AggregatorV3Interface feed)
        internal
        view
        returns (bool, uint256)
    {
        try feed.latestRoundData() returns (
            uint80 roundId,
            int256 answer,
            uint256,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            if (answer <= 0) return (false, 0);
            if (updatedAt < block.timestamp - maxStaleness) return (false, 0);
            if (answeredInRound < roundId) return (false, 0);
            return (true, uint256(answer));
        } catch {
            return (false, 0);
        }
    }
}
```

## Sequencer Uptime Check (L2s)

On Arbitrum and Optimism, the L2 sequencer can go down. Chainlink provides a sequencer uptime feed. If the sequencer just came back, prices may be stale, and liquidations could be unfair.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

error SequencerDown();
error GracePeriodNotOver(uint256 timeSinceUp, uint256 gracePeriod);

contract L2SecureOracle {
    AggregatorV3Interface public priceFeed;
    AggregatorV3Interface public sequencerFeed;
    uint256 public constant GRACE_PERIOD = 3600; // 1 hour after sequencer restarts

    constructor(address _priceFeed, address _sequencerFeed) {
        priceFeed = AggregatorV3Interface(_priceFeed);
        sequencerFeed = AggregatorV3Interface(_sequencerFeed);
    }

    function getPrice() external view returns (uint256) {
        (, int256 answer, , uint256 startedAt, ) = sequencerFeed.latestRoundData();

        // answer == 0 means sequencer is up, answer == 1 means down
        if (answer != 0) revert SequencerDown();

        uint256 timeSinceUp = block.timestamp - startedAt;
        if (timeSinceUp < GRACE_PERIOD) {
            revert GracePeriodNotOver(timeSinceUp, GRACE_PERIOD);
        }

        (, int256 price, , uint256 updatedAt, ) = priceFeed.latestRoundData();
        require(price > 0, "Negative price");
        require(updatedAt > block.timestamp - 3600, "Stale price");

        return uint256(price);
    }
}
```

## Deviation Threshold Check

Detect sudden price jumps that may indicate manipulation or feed errors.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

error PriceDeviationTooHigh(uint256 currentPrice, uint256 lastPrice, uint256 deviationBps);

contract DeviationCheckedOracle {
    uint256 public lastPrice;
    // 10% max deviation between consecutive reads
    uint256 public constant MAX_DEVIATION_BPS = 1000;

    function _checkDeviation(uint256 newPrice) internal {
        if (lastPrice == 0) {
            lastPrice = newPrice;
            return;
        }

        uint256 deviation = newPrice > lastPrice
            ? (newPrice - lastPrice) * 10_000 / lastPrice
            : (lastPrice - newPrice) * 10_000 / lastPrice;

        if (deviation > MAX_DEVIATION_BPS) {
            revert PriceDeviationTooHigh(newPrice, lastPrice, deviation);
        }

        lastPrice = newPrice;
    }
}
```

## Testing Oracle Failures with vm.mockCall

```solidity
function test_fallbackOracleUsedWhenPrimaryReverts() public {
    // Primary reverts
    vm.mockCallRevert(
        address(primaryFeed),
        abi.encodeWithSignature("latestRoundData()"),
        "Feed offline"
    );

    // Fallback returns valid price
    _mockFeedData(address(fallbackFeed), 1, 2000e8, block.timestamp, 1);

    uint256 price = multiOracle.getPrice();
    assertEq(price, 2000e8);
}

function test_revertsWhenAllOraclesFail() public {
    vm.mockCallRevert(
        address(primaryFeed),
        abi.encodeWithSignature("latestRoundData()"),
        "Feed offline"
    );
    vm.mockCallRevert(
        address(fallbackFeed),
        abi.encodeWithSignature("latestRoundData()"),
        "Feed offline"
    );

    vm.expectRevert(AllOraclesFailed.selector);
    multiOracle.getPrice();
}
```

## Key Takeaways

- Always check `updatedAt`, `answer > 0`, and `answeredInRound >= roundId`
- On L2s (Arbitrum, Optimism), check the sequencer uptime feed and enforce a grace period
- Implement fallback oracles -- never let a single feed failure freeze your protocol
- Add deviation checks to catch feed errors or manipulation
- Use `vm.mockCall` and `vm.mockCallRevert` to simulate every oracle failure mode
- Never use DEX spot prices (`slot0`, reserves) as oracles
