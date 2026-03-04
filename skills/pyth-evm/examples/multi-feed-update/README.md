# Multi-Feed Price Update

Update and read multiple Pyth price feeds in a single transaction. Useful for protocols that need correlated prices (e.g., collateral/debt pairs in lending, multi-asset portfolio valuations).

## Dependencies

```bash
forge install pyth-network/pyth-crosschain
```

## Solidity Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

/// @notice Read multiple Pyth prices atomically in a single transaction
contract MultiPriceReader {
    IPyth public immutable pyth;

    uint256 private constant MAX_PRICE_AGE = 60;
    uint256 private constant MAX_CONF_RATIO_BPS = 100;

    struct PriceResult {
        bytes32 feedId;
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }

    error NegativePrice(bytes32 feedId);
    error ConfidenceTooWide(bytes32 feedId);
    error InsufficientPayment();

    constructor(address _pyth) {
        pyth = IPyth(_pyth);
    }

    /// @notice Update all feeds and return validated prices atomically
    /// @param feedIds Array of Pyth feed IDs to read
    /// @param pythUpdateData Price update bytes from Hermes (may contain multiple feeds)
    function updateAndGetPrices(
        bytes32[] calldata feedIds,
        bytes[] calldata pythUpdateData
    ) external payable returns (PriceResult[] memory results) {
        uint256 updateFee = pyth.getUpdateFee(pythUpdateData);
        if (msg.value < updateFee) revert InsufficientPayment();

        pyth.updatePriceFeeds{value: updateFee}(pythUpdateData);

        results = new PriceResult[](feedIds.length);

        for (uint256 i = 0; i < feedIds.length; i++) {
            PythStructs.Price memory pythPrice = pyth.getPriceNoOlderThan(
                feedIds[i],
                MAX_PRICE_AGE
            );

            if (pythPrice.price <= 0) revert NegativePrice(feedIds[i]);
            _validateConfidence(pythPrice, feedIds[i]);

            results[i] = PriceResult({
                feedId: feedIds[i],
                price: pythPrice.price,
                conf: pythPrice.conf,
                expo: pythPrice.expo,
                publishTime: pythPrice.publishTime
            });
        }

        // Refund excess
        uint256 excess = msg.value - updateFee;
        if (excess > 0) {
            (bool ok, ) = msg.sender.call{value: excess}("");
            require(ok);
        }
    }

    /// @notice Compute a price ratio (e.g., ETH/BTC from ETH/USD and BTC/USD)
    /// @dev Both feeds must have the same exponent for this to work correctly
    function updateAndGetRatio(
        bytes32 numeratorFeedId,
        bytes32 denominatorFeedId,
        bytes[] calldata pythUpdateData
    ) external payable returns (uint256 ratioBps) {
        uint256 updateFee = pyth.getUpdateFee(pythUpdateData);
        if (msg.value < updateFee) revert InsufficientPayment();

        pyth.updatePriceFeeds{value: updateFee}(pythUpdateData);

        PythStructs.Price memory numPrice = pyth.getPriceNoOlderThan(
            numeratorFeedId, MAX_PRICE_AGE
        );
        PythStructs.Price memory denomPrice = pyth.getPriceNoOlderThan(
            denominatorFeedId, MAX_PRICE_AGE
        );

        if (numPrice.price <= 0) revert NegativePrice(numeratorFeedId);
        if (denomPrice.price <= 0) revert NegativePrice(denominatorFeedId);
        _validateConfidence(numPrice, numeratorFeedId);
        _validateConfidence(denomPrice, denominatorFeedId);

        // Ratio in basis points (both prices share expo, so it cancels)
        ratioBps = (uint256(uint64(numPrice.price)) * 10_000) /
            uint256(uint64(denomPrice.price));

        uint256 excess = msg.value - updateFee;
        if (excess > 0) {
            (bool ok, ) = msg.sender.call{value: excess}("");
            require(ok);
        }
    }

    function _validateConfidence(
        PythStructs.Price memory pythPrice,
        bytes32 feedId
    ) internal pure {
        uint256 absPrice = uint256(uint64(pythPrice.price));
        if ((uint256(pythPrice.conf) * 10_000) / absPrice > MAX_CONF_RATIO_BPS) {
            revert ConfidenceTooWide(feedId);
        }
    }
}
```

## TypeScript Usage

```typescript
import { HermesClient } from "@pythnetwork/hermes-client";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Address,
} from "viem";
import { arbitrum } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const BTC_USD = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
const ETH_USD = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
const SOL_USD = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

const PYTH_ADDRESS = "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C" as Address;
const READER_ADDRESS = "0xYourMultiPriceReader" as Address;

const READER_ABI = parseAbi([
  "function updateAndGetPrices(bytes32[] calldata feedIds, bytes[] calldata pythUpdateData) external payable returns (tuple(bytes32 feedId, int64 price, uint64 conf, int32 expo, uint256 publishTime)[])",
]);

const hermes = new HermesClient("https://hermes.pyth.network");

const publicClient = createPublicClient({
  chain: arbitrum,
  transport: http(process.env.RPC_URL),
});

const walletClient = createWalletClient({
  account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
  chain: arbitrum,
  transport: http(process.env.RPC_URL),
});

async function getMultiplePrices() {
  const feedIds = [BTC_USD, ETH_USD, SOL_USD] as `0x${string}`[];

  // Fetch all feeds in a single Hermes request
  const updates = await hermes.getLatestPriceUpdates(feedIds);
  const updateData = updates.binary.data.map(
    (hex: string) => `0x${hex}` as `0x${string}`
  );

  // Compute update fee
  const updateFee = await publicClient.readContract({
    address: PYTH_ADDRESS,
    abi: parseAbi(["function getUpdateFee(bytes[] calldata) view returns (uint256)"]),
    functionName: "getUpdateFee",
    args: [updateData],
  });

  const hash = await walletClient.writeContract({
    address: READER_ADDRESS,
    abi: READER_ABI,
    functionName: "updateAndGetPrices",
    args: [feedIds, updateData],
    value: updateFee,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") {
    throw new Error("Multi-feed update reverted");
  }

  console.log(`Updated ${feedIds.length} feeds in tx: ${hash}`);
}
```

## Notes

- Hermes accepts multiple feed IDs in a single request. The response bundles all updates into one `binary.data` array that gets passed to `updatePriceFeeds`.
- Gas cost scales sub-linearly: 1 feed = ~120K gas, 2 feeds = ~150K, 5 feeds = ~240K. Batching is significantly cheaper than individual updates.
- When computing ratios between feeds, both prices must use the same exponent for the ratio to be valid. Standard USD pairs all use `expo = -8`.
- The `updateAndGetRatio` function is useful for computing cross-rates (e.g., ETH/BTC) without needing a dedicated oracle feed for that pair.
