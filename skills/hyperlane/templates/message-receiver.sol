// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title HyperlaneMessageReceiver
 * @notice Template for a Hyperlane message receiver contract.
 *         Receives cross-chain messages via the Hyperlane Mailbox and
 *         validates origin, sender, and ISM security.
 *
 * Usage:
 * 1. Deploy this contract with the Mailbox address and your ISM address
 * 2. Register authorized senders for each origin domain
 * 3. Point your origin chain dispatcher at this contract's address (as bytes32)
 *
 * Dependencies: @hyperlane-xyz/core
 */

import {IInterchainSecurityModule} from "@hyperlane-xyz/core/contracts/interfaces/IInterchainSecurityModule.sol";
import {IMessageRecipient} from "@hyperlane-xyz/core/contracts/interfaces/IMessageRecipient.sol";

contract HyperlaneMessageReceiver is IMessageRecipient {
    // ========================================================================
    // Errors
    // ========================================================================

    /// @notice Caller is not the Mailbox contract
    error OnlyMailbox(address caller);

    /// @notice Caller is not the contract owner
    error OnlyOwner(address caller);

    /// @notice The origin domain or sender is not authorized
    error UnauthorizedSender(uint32 origin, bytes32 sender);

    /// @notice ISM address cannot be zero
    error InvalidISM();

    // ========================================================================
    // Events
    // ========================================================================

    /// @notice Emitted when a cross-chain message is received and processed
    event MessageReceived(
        uint32 indexed origin,
        bytes32 indexed sender,
        bytes body
    );

    /// @notice Emitted when an authorized sender is set or removed
    event AuthorizedSenderUpdated(
        uint32 indexed domain,
        bytes32 indexed sender,
        bool authorized
    );

    /// @notice Emitted when the ISM is updated
    event ISMUpdated(address indexed oldIsm, address indexed newIsm);

    /// @notice Emitted when ownership is transferred
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    // ========================================================================
    // State
    // ========================================================================

    /// @notice The Hyperlane Mailbox contract on this chain
    address public immutable mailbox;

    /// @notice The ISM used to verify inbound messages.
    ///         The Mailbox queries this via interchainSecurityModule().
    IInterchainSecurityModule public interchainSecurityModule;

    /// @notice Contract owner — can update ISM and authorized senders
    address public owner;

    /// @notice Mapping of origin domain -> authorized sender (bytes32)
    mapping(uint32 => bytes32) public authorizedSenders;

    // ========================================================================
    // Modifiers
    // ========================================================================

    modifier onlyMailbox() {
        if (msg.sender != mailbox) revert OnlyMailbox(msg.sender);
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner(msg.sender);
        _;
    }

    // ========================================================================
    // Constructor
    // ========================================================================

    /// @param _mailbox The Hyperlane Mailbox address on this chain
    /// @param _ism The ISM address for verifying inbound messages
    constructor(address _mailbox, address _ism) {
        if (_ism == address(0)) revert InvalidISM();
        mailbox = _mailbox;
        interchainSecurityModule = IInterchainSecurityModule(_ism);
        owner = msg.sender;
    }

    // ========================================================================
    // IMessageRecipient
    // ========================================================================

    /// @notice Handle an inbound Hyperlane message
    /// @dev Only callable by the Mailbox after ISM verification passes
    /// @param _origin Domain ID of the source chain
    /// @param _sender Sender address on the origin chain (bytes32, left-padded for EVM)
    /// @param _body Arbitrary message payload
    function handle(
        uint32 _origin,
        bytes32 _sender,
        bytes calldata _body
    ) external payable override onlyMailbox {
        // Verify the sender is authorized for this origin domain
        bytes32 authorized = authorizedSenders[_origin];
        if (authorized != _sender) {
            revert UnauthorizedSender(_origin, _sender);
        }

        // Process the message
        _handleMessage(_origin, _sender, _body);

        emit MessageReceived(_origin, _sender, _body);
    }

    // ========================================================================
    // Message Processing (override this)
    // ========================================================================

    /// @notice Internal handler for message processing. Override this in derived contracts.
    /// @param _origin Domain ID of the source chain
    /// @param _sender Sender address (bytes32)
    /// @param _body Message payload
    function _handleMessage(
        uint32 _origin,
        bytes32 _sender,
        bytes calldata _body
    ) internal virtual {
        // Default: decode and process the message body
        // Override this function with your application logic
        //
        // Example:
        // (uint8 action, uint256 amount, address recipient) = abi.decode(
        //     _body,
        //     (uint8, uint256, address)
        // );
    }

    // ========================================================================
    // Admin
    // ========================================================================

    /// @notice Register an authorized sender for a specific origin domain
    /// @param _domain Origin domain ID
    /// @param _sender Authorized sender address (bytes32)
    function setAuthorizedSender(
        uint32 _domain,
        bytes32 _sender
    ) external onlyOwner {
        authorizedSenders[_domain] = _sender;
        emit AuthorizedSenderUpdated(_domain, _sender, _sender != bytes32(0));
    }

    /// @notice Update the ISM used for message verification
    /// @param _ism New ISM contract address
    function setInterchainSecurityModule(address _ism) external onlyOwner {
        if (_ism == address(0)) revert InvalidISM();
        address oldIsm = address(interchainSecurityModule);
        interchainSecurityModule = IInterchainSecurityModule(_ism);
        emit ISMUpdated(oldIsm, _ism);
    }

    /// @notice Transfer contract ownership
    /// @param _newOwner New owner address
    function transferOwnership(address _newOwner) external onlyOwner {
        address oldOwner = owner;
        owner = _newOwner;
        emit OwnershipTransferred(oldOwner, _newOwner);
    }

    // ========================================================================
    // Utilities
    // ========================================================================

    /// @notice Convert an EVM address to bytes32 (left-pad with zeros)
    /// @param _addr The EVM address to convert
    /// @return The address as bytes32
    function addressToBytes32(address _addr) public pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    /// @notice Convert bytes32 back to an EVM address
    /// @param _buf The bytes32 value to convert
    /// @return The extracted EVM address
    function bytes32ToAddress(bytes32 _buf) public pure returns (address) {
        return address(uint160(uint256(_buf)));
    }
}
