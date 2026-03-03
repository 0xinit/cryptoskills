// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

/// @title Pyth Price Consumer Template
/// @notice Starter contract for consuming Pyth price feeds on EVM chains.
///         Implements the atomic update+read pattern to prevent sandwich attacks.
/// @dev CRITICAL: updatePriceFeeds is NOT exposed as a standalone function.
///      All price reads are preceded by an update in the same transaction.
///
/// Setup:
///   1. Copy this file to your project
///   2. Install SDK: forge install pyth-network/pyth-crosschain
///   3. Add remapping: @pythnetwork/pyth-sdk-solidity/=lib/pyth-crosschain/target_chains/ethereum/sdk/solidity/
///   4. Deploy with the Pyth contract address for your target chain
///
/// Pyth addresses (vary by chain):
///   Ethereum/Avalanche: 0x4305FB66699C3B2702D4d05CF36551390A4c69C6
///   Arbitrum/Optimism/Base/Polygon: 0xff1a0f4744e8582DF1aE09D5611b887B6a12925C
///   BNB Chain: 0x4D7E825f80bDf85e913E0DD2A2D54927e9dE1594
contract PythConsumer {
    IPyth public immutable pyth;
    bytes32 public immutable priceFeedId;

    uint256 private constant MAX_PRICE_AGE = 60;
    /// @dev 1% max confidence ratio -- tighten to 50 BPS for perpetual DEXes
    uint256 private constant MAX_CONF_RATIO_BPS = 100;

    error NegativePrice();
    error ConfidenceTooWide();
    error InsufficientPayment();

    event PriceConsumed(
        int64 price,
        uint64 conf,
        int32 expo,
        uint256 publishTime
    );

    constructor(address _pyth, bytes32 _priceFeedId) {
        pyth = IPyth(_pyth);
        priceFeedId = _priceFeedId;
    }

    /// @notice Atomically update and read a validated price
    /// @param pythUpdateData Price update bytes from Hermes API
    /// @return price Raw price (multiply by 10^expo for human-readable)
    /// @return expo Price exponent (typically -8)
    function updateAndGetPrice(bytes[] calldata pythUpdateData)
        external
        payable
        returns (int64 price, int32 expo)
    {
        uint256 updateFee = pyth.getUpdateFee(pythUpdateData);
        if (msg.value < updateFee) revert InsufficientPayment();

        pyth.updatePriceFeeds{value: updateFee}(pythUpdateData);

        PythStructs.Price memory pythPrice = pyth.getPriceNoOlderThan(
            priceFeedId,
            MAX_PRICE_AGE
        );

        if (pythPrice.price <= 0) revert NegativePrice();
        _validateConfidence(pythPrice);

        emit PriceConsumed(
            pythPrice.price,
            pythPrice.conf,
            pythPrice.expo,
            pythPrice.publishTime
        );

        _refundExcess(updateFee);

        return (pythPrice.price, pythPrice.expo);
    }

    function _validateConfidence(PythStructs.Price memory pythPrice) internal pure {
        uint256 absPrice = uint256(uint64(pythPrice.price));
        if ((uint256(pythPrice.conf) * 10_000) / absPrice > MAX_CONF_RATIO_BPS) {
            revert ConfidenceTooWide();
        }
    }

    function _refundExcess(uint256 fee) internal {
        uint256 excess = msg.value - fee;
        if (excess > 0) {
            (bool ok, ) = msg.sender.call{value: excess}("");
            require(ok);
        }
    }
}
