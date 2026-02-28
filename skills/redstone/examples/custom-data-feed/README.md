# Custom RedStone Data Feed

Create and consume a custom data feed with your own authorized signers. Useful for proprietary data (private indices, off-chain metrics, custom asset prices) or when using a self-hosted RedStone data service.

## Custom Consumer Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {RedstoneConsumerNumericBase} from "@redstone-finance/evm-connector/contracts/data-services/RedstoneConsumerNumericBase.sol";

/// @title Custom Data Feed Consumer
/// @notice Consumes data from a custom RedStone data service with whitelisted signers
contract CustomFeedConsumer is RedstoneConsumerNumericBase {
    address public immutable owner;

    // Authorized signers for this custom data service
    // In production, these are the addresses of your data provider nodes
    address public constant SIGNER_0 = 0xf786a909D559F5Dee2dc6706d8e5A81728a39aE9;
    address public constant SIGNER_1 = 0x12470f7aBA85c8b81D63137DD5925D6EE114952b;
    address public constant SIGNER_2 = 0x109B4a318A4F5ddcbCA6349B45f881B4137deaFB;

    mapping(bytes32 => uint256) public latestValues;
    mapping(bytes32 => uint256) public lastUpdateTimestamps;

    event CustomFeedUpdated(bytes32 indexed feedId, uint256 value, uint256 timestamp);

    error Unauthorized();
    error InvalidValue();
    error SignerNotAuthorised(address signer);

    constructor() {
        owner = msg.sender;
    }

    /// @notice Require 2-of-3 signers for Byzantine fault tolerance
    function getUniqueSignersThreshold() public pure override returns (uint8) {
        return 2;
    }

    /// @notice Map authorized signer addresses to unique indices
    /// @dev Reverts for any address not in the authorized set
    /// @param signerAddress Address to validate
    /// @return index Unique index (0-255) for this signer
    function getAuthorisedSignerIndex(address signerAddress)
        public
        pure
        override
        returns (uint8)
    {
        if (signerAddress == SIGNER_0) return 0;
        if (signerAddress == SIGNER_1) return 1;
        if (signerAddress == SIGNER_2) return 2;
        revert SignerNotAuthorised(signerAddress);
    }

    /// @notice Update a custom feed value from calldata
    /// @dev Frontend must wrap with WrapperBuilder using your custom data service ID
    /// @param feedId bytes32-encoded identifier for the custom feed
    function updateFeed(bytes32 feedId) external {
        if (msg.sender != owner) revert Unauthorized();

        uint256 value = getOracleNumericValueFromTxMsg(feedId);
        if (value == 0) revert InvalidValue();

        latestValues[feedId] = value;
        lastUpdateTimestamps[feedId] = block.timestamp;

        emit CustomFeedUpdated(feedId, value, block.timestamp);
    }

    /// @notice Batch update multiple custom feeds
    /// @param feedIds Array of feed identifiers
    function updateMultipleFeeds(bytes32[] calldata feedIds) external {
        if (msg.sender != owner) revert Unauthorized();

        uint256[] memory values = getOracleNumericValuesFromTxMsg(feedIds);

        for (uint256 i; i < feedIds.length; ++i) {
            if (values[i] == 0) revert InvalidValue();

            latestValues[feedIds[i]] = values[i];
            lastUpdateTimestamps[feedIds[i]] = block.timestamp;

            emit CustomFeedUpdated(feedIds[i], values[i], block.timestamp);
        }
    }
}
```

## Custom Timestamp Validation

Override timestamp validation when your custom feed has different freshness requirements.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {RedstoneConsumerNumericBase} from "@redstone-finance/evm-connector/contracts/data-services/RedstoneConsumerNumericBase.sol";

/// @notice Consumer with narrow timestamp window for time-sensitive custom data
contract StrictCustomConsumer is RedstoneConsumerNumericBase {
    // Custom data must be at most 30 seconds old
    uint256 public constant MAX_DATA_AGE_SECONDS = 30;
    // Allow 5 seconds of future timestamp for clock drift
    uint256 public constant MAX_FUTURE_SECONDS = 5;

    function getUniqueSignersThreshold() public pure override returns (uint8) {
        return 2;
    }

    /// @notice Strict timestamp validation for high-frequency data
    /// @param receivedTimestampMilliseconds Data package timestamp in milliseconds
    /// @return isValid True if within acceptable range
    function isTimestampValid(uint256 receivedTimestampMilliseconds)
        public
        view
        override
        returns (bool isValid)
    {
        uint256 receivedSeconds = receivedTimestampMilliseconds / 1000;

        if (receivedSeconds > block.timestamp + MAX_FUTURE_SECONDS) return false;
        if (block.timestamp > receivedSeconds + MAX_DATA_AGE_SECONDS) return false;

        return true;
    }

    function readCustomFeed(bytes32 feedId) external view returns (uint256) {
        return getOracleNumericValueFromTxMsg(feedId);
    }
}
```

## Frontend: Custom Data Service

```typescript
import { WrapperBuilder } from "@redstone-finance/evm-connector";
import { ethers } from "ethers";

const CUSTOM_CONSUMER_ABI = [
  "function updateFeed(bytes32 feedId) external",
  "function updateMultipleFeeds(bytes32[] calldata feedIds) external",
  "function latestValues(bytes32) view returns (uint256)",
  "function lastUpdateTimestamps(bytes32) view returns (uint256)",
];

const CONSUMER_ADDRESS = "0xYourCustomConsumerAddress";

async function updateCustomFeed(feedId: string) {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  const consumer = new ethers.Contract(
    CONSUMER_ADDRESS,
    CUSTOM_CONSUMER_ABI,
    signer
  );

  // Use your custom data service ID instead of "redstone-primary-prod"
  const wrappedConsumer = WrapperBuilder.wrap(consumer).usingDataService({
    dataServiceId: "your-custom-data-service-id",
    uniqueSignersCount: 2,
    dataPackagesIds: [feedId],
  });

  const feedIdBytes32 = ethers.encodeBytes32String(feedId);
  const tx = await wrappedConsumer.updateFeed(feedIdBytes32);
  const receipt = await tx.wait();

  if (receipt.status !== 1) {
    throw new Error(`Feed update reverted: ${tx.hash}`);
  }

  console.log(`Custom feed ${feedId} updated, tx: ${tx.hash}`);
}

async function updateMultipleCustomFeeds(feedIds: string[]) {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  const consumer = new ethers.Contract(
    CONSUMER_ADDRESS,
    CUSTOM_CONSUMER_ABI,
    signer
  );

  const wrappedConsumer = WrapperBuilder.wrap(consumer).usingDataService({
    dataServiceId: "your-custom-data-service-id",
    uniqueSignersCount: 2,
    dataPackagesIds: feedIds,
  });

  const feedIdBytes = feedIds.map((id) => ethers.encodeBytes32String(id));
  const tx = await wrappedConsumer.updateMultipleFeeds(feedIdBytes);
  const receipt = await tx.wait();

  if (receipt.status !== 1) {
    throw new Error(`Batch feed update reverted: ${tx.hash}`);
  }

  console.log(`Updated ${feedIds.length} custom feeds, tx: ${tx.hash}`);
}
```

## Setting Up a Custom Data Service

To create your own data service with RedStone:

1. **Register as a data provider** on the [RedStone Data Services portal](https://docs.redstone.finance/docs/smart-contract-devs/data-services)
2. **Configure your data sources** -- API endpoints, computation logic, or off-chain data
3. **Deploy data provider nodes** -- at least 3 for Byzantine fault tolerance
4. **Record signer addresses** -- the Ethereum addresses of your data provider nodes
5. **Hardcode signers in your contract** via `getAuthorisedSignerIndex`
6. **Use your custom `dataServiceId`** in the frontend `WrapperBuilder` config

## Key Points

- Custom data services allow any arbitrary numeric data to be delivered through RedStone
- `getAuthorisedSignerIndex` is the trust boundary -- only whitelisted signers are accepted
- Override `isTimestampValid` when your data has different freshness requirements than the default 3 minutes
- The `bytes32` feed ID encoding must match between contract and SDK (`ethers.encodeBytes32String`)
- For testing, create a harness that overrides `getOracleNumericValueFromTxMsg`
- Production custom services should use at least 2-of-3 signer threshold
