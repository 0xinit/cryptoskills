// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

/// @title OracleConsumer
/// @notice Starter template combining Chainlink Price Feeds, VRF v2.5, and Automation
/// @dev Extend this with your application logic. Each section is independently usable.
contract OracleConsumer is VRFConsumerBaseV2Plus, AutomationCompatibleInterface {
    // =========================================================================
    // Price Feed
    // =========================================================================

    AggregatorV3Interface public immutable priceFeed;
    uint256 public immutable stalenessThreshold;

    /// @notice Get the latest validated price from the feed
    /// @return price The price in feed decimals (call priceFeed.decimals() for scale)
    function getLatestPrice() public view returns (uint256 price) {
        (
            uint80 roundId,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();

        if (answer <= 0) revert InvalidPrice();
        if (block.timestamp - updatedAt > stalenessThreshold) revert StalePrice();
        if (answeredInRound < roundId) revert StaleRound();

        price = uint256(answer);
    }

    /// @notice Normalize a feed answer to 18 decimals
    function normalizeToWad(uint256 price, uint8 feedDecimals) public pure returns (uint256) {
        if (feedDecimals <= 18) {
            return price * 10 ** (18 - feedDecimals);
        }
        return price / 10 ** (feedDecimals - 18);
    }

    // =========================================================================
    // VRF v2.5
    // =========================================================================

    uint256 public immutable vrfSubscriptionId;
    bytes32 public immutable vrfKeyHash;
    uint32 public constant VRF_CALLBACK_GAS_LIMIT = 200_000;
    uint16 public constant VRF_REQUEST_CONFIRMATIONS = 3;
    uint32 public constant VRF_NUM_WORDS = 1;

    mapping(uint256 => address) public vrfRequestToSender;
    mapping(uint256 => uint256) public vrfResults;

    event RandomnessRequested(uint256 indexed requestId, address indexed requester);
    event RandomnessFulfilled(uint256 indexed requestId, uint256 randomWord);

    /// @notice Request a random number from VRF v2.5
    function requestRandomness() external returns (uint256 requestId) {
        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: vrfKeyHash,
                subId: vrfSubscriptionId,
                requestConfirmations: VRF_REQUEST_CONFIRMATIONS,
                callbackGasLimit: VRF_CALLBACK_GAS_LIMIT,
                numWords: VRF_NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                )
            })
        );

        vrfRequestToSender[requestId] = msg.sender;
        emit RandomnessRequested(requestId, msg.sender);
    }

    /// @notice VRF callback — override with your application logic
    /// @dev This function must not revert. If it does, the randomness is lost.
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        vrfResults[requestId] = randomWords[0];
        emit RandomnessFulfilled(requestId, randomWords[0]);
    }

    // =========================================================================
    // Automation
    // =========================================================================

    uint256 public automationCounter;
    uint256 public automationLastTimestamp;
    uint256 public immutable automationInterval;

    event AutomationPerformed(uint256 indexed counter, uint256 timestamp);

    /// @notice Called off-chain by Automation nodes
    /// @dev Must not modify state. Return false to skip execution.
    function checkUpkeep(bytes calldata)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        upkeepNeeded = (block.timestamp - automationLastTimestamp) >= automationInterval;
        performData = "";
    }

    /// @notice Called on-chain when checkUpkeep returns true
    /// @dev Re-validate the condition — state may have changed since checkUpkeep
    function performUpkeep(bytes calldata) external override {
        if ((block.timestamp - automationLastTimestamp) < automationInterval) {
            revert UpkeepNotNeeded();
        }

        automationLastTimestamp = block.timestamp;
        automationCounter += 1;
        emit AutomationPerformed(automationCounter, block.timestamp);
    }

    // =========================================================================
    // Constructor
    // =========================================================================

    /// @param _priceFeed Chainlink price feed address (e.g., ETH/USD)
    /// @param _stalenessThreshold Max seconds since last feed update before considered stale
    /// @param _vrfCoordinator VRF Coordinator address for your chain
    /// @param _vrfSubscriptionId Your VRF subscription ID
    /// @param _vrfKeyHash Gas lane keyHash for your chain
    /// @param _automationInterval Seconds between automation executions
    constructor(
        address _priceFeed,
        uint256 _stalenessThreshold,
        address _vrfCoordinator,
        uint256 _vrfSubscriptionId,
        bytes32 _vrfKeyHash,
        uint256 _automationInterval
    ) VRFConsumerBaseV2Plus(_vrfCoordinator) {
        priceFeed = AggregatorV3Interface(_priceFeed);
        stalenessThreshold = _stalenessThreshold;
        vrfSubscriptionId = _vrfSubscriptionId;
        vrfKeyHash = _vrfKeyHash;
        automationInterval = _automationInterval;
        automationLastTimestamp = block.timestamp;
    }

    // =========================================================================
    // Errors
    // =========================================================================

    error InvalidPrice();
    error StalePrice();
    error StaleRound();
    error UpkeepNotNeeded();
}
