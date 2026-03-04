# Express Relay Integration (MEV-Protected Liquidations)

Basic Express Relay integration for a lending protocol. Express Relay routes liquidation opportunities through sealed-bid auctions instead of the public mempool, capturing MEV value for the protocol instead of losing it to searchers.

## Dependencies

```bash
forge install pyth-network/pyth-crosschain
npm install @pythnetwork/express-relay-js@^0.10.0
```

## Solidity Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

/// @notice Lending protocol with Express Relay MEV protection
/// @dev Express Relay calls liquidate() via sealed auction -- proceeds go to protocol
contract ExpressRelayLending {
    IPyth public immutable pyth;
    address public immutable expressRelay;

    bytes32 public immutable collateralFeedId;
    bytes32 public immutable debtFeedId;

    /// @dev 120% collateral ratio threshold for liquidation
    uint256 private constant LIQUIDATION_THRESHOLD_BPS = 12_000;
    uint256 private constant MAX_PRICE_AGE = 60;
    uint256 private constant MAX_CONF_RATIO_BPS = 100;

    struct Position {
        uint256 collateralAmount;
        uint256 debtAmount;
    }

    mapping(address => Position) public positions;

    error NotLiquidatable();
    error NegativePrice();
    error ConfidenceTooWide();
    error CallerNotExpressRelay();

    event PositionLiquidated(address indexed borrower, address indexed liquidator);
    event AuctionProceedsReceived(uint256 amount);

    constructor(
        address _pyth,
        address _expressRelay,
        bytes32 _collateralFeedId,
        bytes32 _debtFeedId
    ) {
        pyth = IPyth(_pyth);
        expressRelay = _expressRelay;
        collateralFeedId = _collateralFeedId;
        debtFeedId = _debtFeedId;
    }

    /// @notice Called by Express Relay to deliver auction proceeds
    receive() external payable {
        if (msg.sender != expressRelay) revert CallerNotExpressRelay();
        emit AuctionProceedsReceived(msg.value);
    }

    /// @notice Liquidate an undercollateralized position
    /// @dev Express Relay routes this via sealed-bid auction for MEV protection
    /// @param borrower Address of the position to liquidate
    /// @param pythUpdateData Fresh price data from Hermes
    function liquidate(
        address borrower,
        bytes[] calldata pythUpdateData
    ) external payable {
        // Atomic price update -- never separate from liquidation logic
        uint256 fee = pyth.getUpdateFee(pythUpdateData);
        pyth.updatePriceFeeds{value: fee}(pythUpdateData);

        PythStructs.Price memory collateralPrice = pyth.getPriceNoOlderThan(
            collateralFeedId, MAX_PRICE_AGE
        );
        PythStructs.Price memory debtPrice = pyth.getPriceNoOlderThan(
            debtFeedId, MAX_PRICE_AGE
        );

        if (collateralPrice.price <= 0 || debtPrice.price <= 0) revert NegativePrice();
        _validateConfidence(collateralPrice);
        _validateConfidence(debtPrice);

        Position storage pos = positions[borrower];

        // Collateral value in debt terms (both prices share same expo = -8)
        uint256 collateralValue = pos.collateralAmount * uint256(uint64(collateralPrice.price));
        uint256 debtValue = pos.debtAmount * uint256(uint64(debtPrice.price));

        // Position must be below liquidation threshold
        if (collateralValue * 10_000 >= debtValue * LIQUIDATION_THRESHOLD_BPS) {
            revert NotLiquidatable();
        }

        // Execute liquidation -- transfer collateral to liquidator, clear debt
        delete positions[borrower];
        emit PositionLiquidated(borrower, msg.sender);

        // Refund excess ETH
        uint256 excess = msg.value - fee;
        if (excess > 0) {
            (bool ok, ) = msg.sender.call{value: excess}("");
            require(ok);
        }
    }

    function _validateConfidence(PythStructs.Price memory pythPrice) internal pure {
        uint256 absPrice = uint256(uint64(pythPrice.price));
        if ((uint256(pythPrice.conf) * 10_000) / absPrice > MAX_CONF_RATIO_BPS) {
            revert ConfidenceTooWide();
        }
    }
}
```

## Searcher Integration (TypeScript)

Searchers submit bids to Express Relay for the right to execute liquidations.

```typescript
import { Client as ExpressRelayClient } from "@pythnetwork/express-relay-js";
import { HermesClient } from "@pythnetwork/hermes-client";
import {
  createPublicClient,
  http,
  encodeFunctionData,
  parseAbi,
  type Address,
} from "viem";
import { arbitrum } from "viem/chains";

const LENDING_ABI = parseAbi([
  "function liquidate(address borrower, bytes[] calldata pythUpdateData) external payable",
]);

const LENDING_ADDRESS = "0xYourLendingContract" as Address;
const PYTH_ADDRESS = "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C" as Address;
const ETH_USD = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

const hermes = new HermesClient("https://hermes.pyth.network");

async function submitLiquidationBid(borrower: Address) {
  const client = new ExpressRelayClient({
    baseUrl: "https://per-arbitrum.dourolabs.app",
  });

  const updates = await hermes.getLatestPriceUpdates([ETH_USD]);
  const updateData = updates.binary.data.map(
    (hex: string) => `0x${hex}` as `0x${string}`
  );

  const calldata = encodeFunctionData({
    abi: LENDING_ABI,
    functionName: "liquidate",
    args: [borrower, updateData],
  });

  const bid = await client.submitBid({
    chainId: "42161",
    targetContract: LENDING_ADDRESS,
    targetCalldata: calldata,
    targetCallValue: 1n,
    permissionKey: borrower,
    amount: 100000000000000n, // Bid amount in wei (0.0001 ETH)
  });

  console.log(`Bid submitted: ${bid.id}`);
  return bid;
}
```

## Notes

- Express Relay runs sealed-bid auctions -- searchers compete on bid amount, not gas priority. The winning bid amount goes to the protocol, not to block builders.
- The `receive()` function is how the protocol receives auction proceeds. Only the Express Relay contract should be allowed to call it.
- Supported on 11+ chains: Ethereum, Arbitrum, Optimism, Base, Polygon, Avalanche, BNB Chain, Monad (testnet), Sei, Blast, Mode.
- Price updates are still atomic with the liquidation check -- the anti-sandwich pattern applies even within Express Relay flows.
- For production, implement proper position tracking, collateral transfer logic, and access controls beyond what this minimal example shows.
