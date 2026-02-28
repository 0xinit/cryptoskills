// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {RedstoneConsumerNumericBase} from "@redstone-finance/evm-connector/contracts/data-services/RedstoneConsumerNumericBase.sol";

/// @title RedStone Pull Consumer Template
/// @notice Starter contract for integrating RedStone Pull model oracle
/// @dev Inherits RedstoneConsumerNumericBase which validates calldata-attached price data.
///      Frontend MUST wrap every price-reading transaction with WrapperBuilder from
///      @redstone-finance/evm-connector. Without wrapping, calls revert with
///      CalldataMustHaveValidPayload.
contract RedStoneConsumerTemplate is RedstoneConsumerNumericBase {
    address public owner;

    // Cached price state -- populate via updatePrice() which requires wrapped calldata
    uint256 public lastPrice;
    uint256 public lastUpdateTimestamp;
    bytes32 public immutable dataFeedId;

    event PriceUpdated(bytes32 indexed feedId, uint256 value, uint256 timestamp);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error Unauthorized();
    error InvalidPrice();
    error PriceTooOld(uint256 age, uint256 maxAge);

    /// @param _dataFeedId The RedStone feed ID (e.g., bytes32("ETH"))
    constructor(bytes32 _dataFeedId) {
        owner = msg.sender;
        dataFeedId = _dataFeedId;
    }

    /// @notice Minimum unique signers required to validate price data
    /// @dev Set to 3 for production. Adjust based on your data service's signer count.
    ///      Byzantine fault tolerance: n >= 3f + 1 where f is faulty signers.
    function getUniqueSignersThreshold() public pure override returns (uint8) {
        return 3;
    }

    /// @notice Fetch price from calldata and cache it
    /// @dev Frontend must wrap this call:
    ///      const wrapped = WrapperBuilder.wrap(contract).usingDataService({
    ///        dataServiceId: "redstone-primary-prod",
    ///        uniqueSignersCount: 3,
    ///        dataPackagesIds: ["ETH"],
    ///      });
    ///      await wrapped.updatePrice();
    function updatePrice() external {
        if (msg.sender != owner) revert Unauthorized();

        uint256 price = getOracleNumericValueFromTxMsg(dataFeedId);
        if (price == 0) revert InvalidPrice();

        lastPrice = price;
        lastUpdateTimestamp = block.timestamp;

        emit PriceUpdated(dataFeedId, price, block.timestamp);
    }

    /// @notice Read cached price with staleness check
    /// @param maxAge Maximum acceptable age in seconds
    /// @return price Cached price with 8 decimals
    function getCachedPrice(uint256 maxAge) external view returns (uint256 price) {
        uint256 age = block.timestamp - lastUpdateTimestamp;
        if (age > maxAge) revert PriceTooOld(age, maxAge);
        return lastPrice;
    }

    /// @notice Transfer ownership using two-step pattern
    /// @param newOwner Address of the new owner
    function transferOwnership(address newOwner) external {
        if (msg.sender != owner) revert Unauthorized();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }
}
