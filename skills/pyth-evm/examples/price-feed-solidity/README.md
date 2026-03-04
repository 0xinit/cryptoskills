# Pyth Price Feed Consumer (Solidity)

Complete Solidity contract that consumes Pyth price data with the anti-sandwich pattern: update and read in a single atomic function call. Includes confidence interval validation and dynamic fee computation.

## Dependencies

```bash
forge install pyth-network/pyth-crosschain
```

Add to `remappings.txt`:
```
@pythnetwork/pyth-sdk-solidity/=lib/pyth-crosschain/target_chains/ethereum/sdk/solidity/
```

## Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

/// @notice Consumes Pyth price feeds with atomic update+read pattern
/// @dev NEVER expose updatePriceFeeds as a standalone public function
contract PythPriceConsumer {
    IPyth public immutable pyth;

    /// @dev 1% max confidence-to-price ratio (100 basis points)
    uint256 private constant MAX_CONF_RATIO_BPS = 100;
    uint256 private constant MAX_PRICE_AGE = 60;

    error NegativePrice();
    error ConfidenceTooWide();
    error InsufficientPayment();

    event PriceUpdated(bytes32 indexed feedId, int64 price, uint64 conf, int32 expo);

    constructor(address _pyth) {
        pyth = IPyth(_pyth);
    }

    /// @notice Atomically update price feed and return validated price
    /// @param feedId The Pyth price feed ID (bytes32, same across all chains)
    /// @param pythUpdateData Price update bytes fetched from Hermes API
    /// @return price Raw price value (apply expo to get human-readable)
    /// @return conf Confidence interval (1 standard deviation)
    /// @return expo Price exponent (typically -8)
    /// @return publishTime Unix timestamp of price publication
    function updateAndGetPrice(
        bytes32 feedId,
        bytes[] calldata pythUpdateData
    )
        external
        payable
        returns (int64 price, uint64 conf, int32 expo, uint256 publishTime)
    {
        // Compute required fee -- never hardcode
        uint256 updateFee = pyth.getUpdateFee(pythUpdateData);
        if (msg.value < updateFee) revert InsufficientPayment();

        // Update price feed on-chain
        pyth.updatePriceFeeds{value: updateFee}(pythUpdateData);

        // Read price immediately (same tx = safe from front-running)
        PythStructs.Price memory pythPrice = pyth.getPriceNoOlderThan(
            feedId,
            MAX_PRICE_AGE
        );

        // Validate price is positive
        if (pythPrice.price <= 0) revert NegativePrice();

        // Validate confidence interval is tight enough
        _validateConfidence(pythPrice);

        emit PriceUpdated(feedId, pythPrice.price, pythPrice.conf, pythPrice.expo);

        // Refund excess ETH
        uint256 excess = msg.value - updateFee;
        if (excess > 0) {
            (bool ok, ) = msg.sender.call{value: excess}("");
            require(ok);
        }

        return (pythPrice.price, pythPrice.conf, pythPrice.expo, pythPrice.publishTime);
    }

    /// @notice Read price without update (only safe on sponsored-feed chains)
    /// @dev Reverts with StalePrice if no recent update exists
    function getExistingPrice(bytes32 feedId)
        external
        view
        returns (int64 price, int32 expo)
    {
        PythStructs.Price memory pythPrice = pyth.getPriceNoOlderThan(
            feedId,
            MAX_PRICE_AGE
        );
        if (pythPrice.price <= 0) revert NegativePrice();
        _validateConfidence(pythPrice);
        return (pythPrice.price, pythPrice.expo);
    }

    function _validateConfidence(PythStructs.Price memory pythPrice) internal pure {
        uint256 absPrice = uint256(uint64(pythPrice.price));
        if ((uint256(pythPrice.conf) * 10_000) / absPrice > MAX_CONF_RATIO_BPS) {
            revert ConfidenceTooWide();
        }
    }
}
```

## Deployment

```bash
# Arbitrum deployment
forge create src/PythPriceConsumer.sol:PythPriceConsumer \
  --rpc-url $ARBITRUM_RPC \
  --private-key $PRIVATE_KEY \
  --constructor-args 0xff1a0f4744e8582DF1aE09D5611b887B6a12925C \
  --verify
```

## Usage (TypeScript)

```typescript
import { HermesClient } from "@pythnetwork/hermes-client";
import { createPublicClient, createWalletClient, http, parseAbi, type Address } from "viem";
import { arbitrum } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const CONSUMER_ABI = parseAbi([
  "function updateAndGetPrice(bytes32 feedId, bytes[] calldata pythUpdateData) external payable returns (int64, uint64, int32, uint256)",
]);

const ETH_USD = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" as `0x${string}`;
const CONSUMER_ADDRESS = "0xYourDeployedConsumer" as Address;
const PYTH_ADDRESS = "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C" as Address;

const hermes = new HermesClient("https://hermes.pyth.network");

async function getPrice() {
  const updates = await hermes.getLatestPriceUpdates([ETH_USD]);
  const updateData = updates.binary.data.map(
    (hex: string) => `0x${hex}` as `0x${string}`
  );

  // Compute fee via Pyth contract
  const fee = await publicClient.readContract({
    address: PYTH_ADDRESS,
    abi: parseAbi(["function getUpdateFee(bytes[] calldata) view returns (uint256)"]),
    functionName: "getUpdateFee",
    args: [updateData],
  });

  const hash = await walletClient.writeContract({
    address: CONSUMER_ADDRESS,
    abi: CONSUMER_ABI,
    functionName: "updateAndGetPrice",
    args: [ETH_USD, updateData],
    value: fee,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") {
    throw new Error("Transaction reverted");
  }
}
```

## Notes

- The `updateAndGetPrice` function is the ONLY safe pattern. Separating `updatePriceFeeds` from price reading exposes your protocol to sandwich attacks.
- Confidence validation at 1% (100 BPS) is appropriate for lending protocols. For perpetual DEXes, tighten to 0.5% (50 BPS).
- The `getExistingPrice` function is a view-only convenience for chains with sponsored feeds (Arbitrum, Base, Ethereum). It reverts if no fresh price exists.
- Gas cost: ~120K for update + ~3K for read = ~123K total per call.
