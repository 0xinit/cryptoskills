// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// ============================================================================
// Errors
// ============================================================================

error CallerNotNttManager(address caller, address expected);
error ZeroAddress();
error ZeroAmount();
error TransferPaused();
error InvalidChainId(uint16 chainId);
error PeerNotRegistered(uint16 chainId);
error RateLimitExceeded(uint256 limit, uint256 requested);
error InsufficientFee(uint256 required, uint256 provided);

// ============================================================================
// Events
// ============================================================================

event NttManagerUpdated(address indexed oldManager, address indexed newManager);
event CrossChainTransferInitiated(
    uint16 indexed destinationChain,
    bytes32 indexed recipient,
    uint256 amount,
    uint64 sequence
);
event TransferPauseToggled(bool paused);

// ============================================================================
// NTT-Compatible Token
// ============================================================================

/// @title NTT-Compatible ERC-20 Token
/// @notice Token with mint/burn controlled by NttManager for cross-chain transfers.
///         Deploy this contract on each chain, then configure NttManager as the minter.
contract NttToken is ERC20, ERC20Burnable, Ownable {
    address public nttManager;

    modifier onlyNttManager() {
        if (msg.sender != nttManager) {
            revert CallerNotNttManager(msg.sender, nttManager);
        }
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        address initialOwner,
        uint256 initialSupply
    ) ERC20(name, symbol) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        if (initialSupply > 0) {
            _mint(initialOwner, initialSupply);
        }
    }

    /// @notice Set the NttManager address authorized to mint/burn
    /// @param newManager The NttManager contract address on this chain
    function setNttManager(address newManager) external onlyOwner {
        if (newManager == address(0)) revert ZeroAddress();
        address old = nttManager;
        nttManager = newManager;
        emit NttManagerUpdated(old, newManager);
    }

    /// @notice Mint tokens -- only callable by the NttManager
    /// @param to Recipient address
    /// @param amount Amount to mint
    function mint(address to, uint256 amount) external onlyNttManager {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        _mint(to, amount);
    }
}

// ============================================================================
// NTT Integration Contract
// ============================================================================

/// @dev Interface for the Wormhole Core Bridge
interface IWormhole {
    function messageFee() external view returns (uint256);
    function publishMessage(
        uint32 nonce,
        bytes memory payload,
        uint8 consistencyLevel
    ) external payable returns (uint64 sequence);
}

/// @dev Interface for the NttManager
interface INttManager {
    function transfer(
        uint256 amount,
        uint16 recipientChain,
        bytes32 recipient
    ) external payable returns (uint64 messageSequence);

    function transfer(
        uint256 amount,
        uint16 recipientChain,
        bytes32 recipient,
        bytes32 refundAddress,
        bool shouldQueue,
        bytes memory encodedInstructions
    ) external payable returns (uint64 messageSequence);
}

/// @title NTT Cross-Chain Transfer Helper
/// @notice Convenience contract for initiating NTT transfers with safety checks.
///         Wraps the NttManager with input validation, pause control, and event logging.
contract NttTransferHelper is Ownable {
    INttManager public immutable nttManager;
    NttToken public immutable token;

    bool public paused;

    /// @dev Registered peer chains (Wormhole chain ID => registered)
    mapping(uint16 => bool) public supportedChains;

    modifier whenNotPaused() {
        if (paused) revert TransferPaused();
        _;
    }

    constructor(
        address _nttManager,
        address _token,
        address _owner
    ) Ownable(_owner) {
        if (_nttManager == address(0)) revert ZeroAddress();
        if (_token == address(0)) revert ZeroAddress();
        nttManager = INttManager(_nttManager);
        token = NttToken(_token);
    }

    // ========================================================================
    // Admin
    // ========================================================================

    /// @notice Register a supported destination chain
    /// @param chainId Wormhole chain ID (NOT EVM chain ID)
    function addSupportedChain(uint16 chainId) external onlyOwner {
        if (chainId == 0) revert InvalidChainId(chainId);
        supportedChains[chainId] = true;
    }

    /// @notice Remove a supported destination chain
    /// @param chainId Wormhole chain ID to remove
    function removeSupportedChain(uint16 chainId) external onlyOwner {
        supportedChains[chainId] = false;
    }

    /// @notice Toggle transfer pause state
    function togglePause() external onlyOwner {
        paused = !paused;
        emit TransferPauseToggled(paused);
    }

    // ========================================================================
    // Transfers
    // ========================================================================

    /// @notice Transfer tokens to a recipient on another chain via NTT
    /// @param destinationChain Wormhole chain ID of the destination
    /// @param recipient Recipient address as bytes32 (left-padded for EVM)
    /// @param amount Amount of tokens to transfer (full precision)
    /// @return sequence The Wormhole message sequence number for tracking
    function transferCrossChain(
        uint16 destinationChain,
        bytes32 recipient,
        uint256 amount
    ) external payable whenNotPaused returns (uint64 sequence) {
        if (!supportedChains[destinationChain]) {
            revert PeerNotRegistered(destinationChain);
        }
        if (amount == 0) revert ZeroAmount();
        if (recipient == bytes32(0)) revert ZeroAddress();

        // Transfer tokens from sender to this contract
        // CEI: check above, effect (state change via transferFrom), interaction (nttManager.transfer)
        token.transferFrom(msg.sender, address(this), amount);

        // Approve NttManager to spend tokens
        token.approve(address(nttManager), amount);

        // Initiate cross-chain transfer
        sequence = nttManager.transfer{value: msg.value}(
            amount,
            destinationChain,
            recipient
        );

        emit CrossChainTransferInitiated(
            destinationChain,
            recipient,
            amount,
            sequence
        );
    }

    /// @notice Transfer with queue option for rate-limited scenarios
    /// @param destinationChain Wormhole chain ID of the destination
    /// @param recipient Recipient address as bytes32
    /// @param amount Amount of tokens to transfer
    /// @param shouldQueue If true, queue the transfer when rate limited instead of reverting
    /// @return sequence The Wormhole message sequence number
    function transferCrossChainWithQueue(
        uint16 destinationChain,
        bytes32 recipient,
        uint256 amount,
        bool shouldQueue
    ) external payable whenNotPaused returns (uint64 sequence) {
        if (!supportedChains[destinationChain]) {
            revert PeerNotRegistered(destinationChain);
        }
        if (amount == 0) revert ZeroAmount();
        if (recipient == bytes32(0)) revert ZeroAddress();

        token.transferFrom(msg.sender, address(this), amount);
        token.approve(address(nttManager), amount);

        // Refund address = msg.sender left-padded to bytes32
        bytes32 refundAddress = bytes32(uint256(uint160(msg.sender)));

        sequence = nttManager.transfer{value: msg.value}(
            amount,
            destinationChain,
            recipient,
            refundAddress,
            shouldQueue,
            "" // no additional transceiver instructions
        );

        emit CrossChainTransferInitiated(
            destinationChain,
            recipient,
            amount,
            sequence
        );
    }

    // ========================================================================
    // Helpers
    // ========================================================================

    /// @notice Convert an EVM address to bytes32 (left-padded)
    /// @param addr The EVM address to convert
    /// @return The bytes32 representation
    function addressToBytes32(address addr) external pure returns (bytes32) {
        return bytes32(uint256(uint160(addr)));
    }

    /// @notice Rescue tokens accidentally sent to this contract
    /// @param tokenAddress Token to rescue
    /// @param to Destination address
    /// @param amount Amount to rescue
    function rescueTokens(
        address tokenAddress,
        address to,
        uint256 amount
    ) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        NttToken(tokenAddress).transfer(to, amount);
    }

    /// @notice Allow contract to receive native gas for relay fees
    receive() external payable {}
}
