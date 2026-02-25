// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {OApp, Origin, MessagingFee, MessagingReceipt} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * LayerZero V2 OApp Starter Template
 *
 * Complete starter template for a cross-chain OApp using LayerZero V2.
 * Includes send, receive, fee quoting, and message options.
 *
 * Usage:
 * 1. Copy this file to your project
 * 2. Set the EndpointV2 address for your deployment chain
 * 3. Deploy on each chain, then call setPeer() bidirectionally
 * 4. Call quote() to get the fee, then send() with msg.value >= fee
 *
 * Dependencies:
 *   npm install @layerzerolabs/oapp-evm @openzeppelin/contracts
 */
contract OAppStarter is OApp {
    using OptionsBuilder for bytes;

    // ========================================================================
    // State
    // ========================================================================

    /// @dev Last received message per source chain
    mapping(uint32 => bytes) public lastMessage;

    /// @dev Default gas limit for lzReceive on destination
    uint128 public defaultGasLimit = 200_000;

    // ========================================================================
    // Events
    // ========================================================================

    event MessageSent(
        uint32 indexed dstEid,
        bytes32 indexed guid,
        bytes payload,
        uint256 nativeFee
    );

    event MessageReceived(
        uint32 indexed srcEid,
        bytes32 indexed sender,
        bytes32 guid,
        bytes payload
    );

    event DefaultGasLimitUpdated(uint128 oldLimit, uint128 newLimit);

    // ========================================================================
    // Errors
    // ========================================================================

    error InsufficientFee(uint256 sent, uint256 required);
    error ZeroPayload();
    error ZeroGasLimit();

    // ========================================================================
    // Constructor
    // ========================================================================

    /// @notice Initializes the OApp with EndpointV2 and delegate
    /// @param _endpoint EndpointV2 address for this chain
    /// @param _delegate Owner and delegate address for admin operations
    constructor(
        address _endpoint,
        address _delegate
    ) OApp(_endpoint, _delegate) Ownable(_delegate) {}

    // ========================================================================
    // External Functions
    // ========================================================================

    /// @notice Sends a cross-chain message to a destination chain
    /// @param _dstEid Destination endpoint ID (NOT chain ID)
    /// @param _payload Arbitrary bytes payload to deliver
    /// @param _options Message execution options (gas, native drop, etc.)
    /// @return receipt The messaging receipt with guid and nonce
    function send(
        uint32 _dstEid,
        bytes calldata _payload,
        bytes calldata _options
    ) external payable returns (MessagingReceipt memory receipt) {
        if (_payload.length == 0) revert ZeroPayload();

        bytes memory options = _options.length > 0
            ? _options
            : _buildDefaultOptions();

        MessagingFee memory fee = _quote(_dstEid, _payload, options, false);
        if (msg.value < fee.nativeFee) revert InsufficientFee(msg.value, fee.nativeFee);

        receipt = _lzSend(_dstEid, _payload, options, fee, payable(msg.sender));

        emit MessageSent(_dstEid, receipt.guid, _payload, fee.nativeFee);
    }

    /// @notice Quotes the messaging fee for a cross-chain send
    /// @param _dstEid Destination endpoint ID
    /// @param _payload Arbitrary bytes payload
    /// @param _options Message execution options (pass empty for defaults)
    /// @return fee The fee breakdown (nativeFee + lzTokenFee)
    function quote(
        uint32 _dstEid,
        bytes calldata _payload,
        bytes calldata _options
    ) external view returns (MessagingFee memory fee) {
        bytes memory options = _options.length > 0
            ? _options
            : _buildDefaultOptions();

        return _quote(_dstEid, _payload, options, false);
    }

    /// @notice Updates the default gas limit for lzReceive
    /// @param _gasLimit New gas limit (must be > 0)
    function setDefaultGasLimit(uint128 _gasLimit) external onlyOwner {
        if (_gasLimit == 0) revert ZeroGasLimit();
        uint128 old = defaultGasLimit;
        defaultGasLimit = _gasLimit;
        emit DefaultGasLimitUpdated(old, _gasLimit);
    }

    // ========================================================================
    // Internal Functions
    // ========================================================================

    /// @dev Called by EndpointV2 when a verified message arrives
    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _payload,
        address /*_executor*/,
        bytes calldata /*_extraData*/
    ) internal override {
        lastMessage[_origin.srcEid] = _payload;

        emit MessageReceived(
            _origin.srcEid,
            _origin.sender,
            _guid,
            _payload
        );
    }

    /// @dev Builds default options with the configured gas limit
    function _buildDefaultOptions() internal view returns (bytes memory) {
        return OptionsBuilder.newOptions().addExecutorLzReceiveOption(
            defaultGasLimit,
            0
        );
    }
}
