// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import {AxelarExecutable} from "@axelar-network/axelar-gmp-sdk-solidity/contracts/executable/AxelarExecutable.sol";
import {IAxelarGateway} from "@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGateway.sol";
import {IAxelarGasService} from "@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGasService.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * Axelar GMP Executable Starter Template
 *
 * Complete starter for a cross-chain application using Axelar General Message Passing.
 * Supports both plain messages (callContract) and token messages (callContractWithToken).
 *
 * Usage:
 * 1. Copy this file to your project's src/ directory
 * 2. Set Gateway and GasService addresses for your deployment chain
 * 3. Deploy on each chain
 * 4. Call setTrustedRemote() for every chain pair (bidirectional)
 * 5. Estimate gas, then call sendMessage() or sendWithToken()
 *
 * Dependencies:
 *   npm install @axelar-network/axelar-gmp-sdk-solidity @openzeppelin/contracts
 *   OR: forge install axelarnetwork/axelar-gmp-sdk-solidity OpenZeppelin/openzeppelin-contracts
 */
contract AxelarStarter is AxelarExecutable, Ownable2Step {
    using SafeERC20 for IERC20;

    IAxelarGasService public immutable GAS_SERVICE;

    /// @dev chain name => lowercase hex address of trusted remote
    mapping(string => string) public trustedRemotes;

    /// @dev chain name => last received payload
    mapping(string => bytes) public lastPayload;

    event MessageSent(string destinationChain, string destinationAddress, bytes payload);
    event MessageReceived(string sourceChain, string sourceAddress, bytes payload);
    event TokenReceived(string sourceChain, string symbol, uint256 amount, address recipient);
    event TrustedRemoteSet(string chain, string remoteAddress);

    error UntrustedRemote(string sourceChain, string sourceAddress);
    error InsufficientGasPayment();
    error EmptyPayload();
    error EmptyChainName();

    /// @notice Deploy with the Gateway and GasService for this chain
    /// @param gateway_ Axelar Gateway address
    /// @param gasService_ Axelar GasService address
    /// @param owner_ Contract owner (for admin functions)
    constructor(
        address gateway_,
        address gasService_,
        address owner_
    ) AxelarExecutable(gateway_) Ownable(owner_) {
        GAS_SERVICE = IAxelarGasService(gasService_);
    }

    /// @notice Send a GMP message (no tokens)
    /// @param destinationChain Axelar chain name (e.g., "arbitrum")
    /// @param destinationAddress Remote contract address as lowercase hex string
    /// @param payload ABI-encoded message data
    function sendMessage(
        string calldata destinationChain,
        string calldata destinationAddress,
        bytes calldata payload
    ) external payable {
        if (payload.length == 0) revert EmptyPayload();
        if (msg.value == 0) revert InsufficientGasPayment();

        GAS_SERVICE.payNativeGasForContractCall{value: msg.value}(
            address(this),
            destinationChain,
            destinationAddress,
            payload,
            msg.sender
        );

        gateway().callContract(destinationChain, destinationAddress, payload);

        emit MessageSent(destinationChain, destinationAddress, payload);
    }

    /// @notice Send a GMP message with an Axelar-wrapped token
    /// @param destinationChain Axelar chain name
    /// @param destinationAddress Remote contract address
    /// @param payload ABI-encoded message data
    /// @param symbol Axelar token symbol (e.g., "axlUSDC")
    /// @param amount Token amount to transfer
    function sendWithToken(
        string calldata destinationChain,
        string calldata destinationAddress,
        bytes calldata payload,
        string calldata symbol,
        uint256 amount
    ) external payable {
        if (payload.length == 0) revert EmptyPayload();
        if (msg.value == 0) revert InsufficientGasPayment();

        address tokenAddress = gateway().tokenAddresses(symbol);
        IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(tokenAddress).forceApprove(address(gateway()), amount);

        GAS_SERVICE.payNativeGasForContractCallWithToken{value: msg.value}(
            address(this),
            destinationChain,
            destinationAddress,
            payload,
            symbol,
            amount,
            msg.sender
        );

        gateway().callContractWithToken(
            destinationChain,
            destinationAddress,
            payload,
            symbol,
            amount
        );

        emit MessageSent(destinationChain, destinationAddress, payload);
    }

    /// @notice Register a trusted remote contract for a given chain
    /// @param chain Axelar chain name
    /// @param remoteAddress Lowercase hex string of the remote contract address
    function setTrustedRemote(
        string calldata chain,
        string calldata remoteAddress
    ) external onlyOwner {
        if (bytes(chain).length == 0) revert EmptyChainName();
        trustedRemotes[chain] = remoteAddress;
        emit TrustedRemoteSet(chain, remoteAddress);
    }

    /// @dev Called by Gateway for plain GMP messages
    function _execute(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal override {
        _validateRemote(sourceChain, sourceAddress);
        lastPayload[sourceChain] = payload;
        emit MessageReceived(sourceChain, sourceAddress, payload);
    }

    /// @dev Called by Gateway for GMP messages with tokens
    function _executeWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) internal override {
        _validateRemote(sourceChain, sourceAddress);

        address recipient = abi.decode(payload, (address));
        address tokenAddress = gateway().tokenAddresses(tokenSymbol);

        lastPayload[sourceChain] = payload;
        emit TokenReceived(sourceChain, tokenSymbol, amount, recipient);

        IERC20(tokenAddress).safeTransfer(recipient, amount);
    }

    /// @dev Validates the message sender is the trusted remote for this chain
    function _validateRemote(
        string calldata sourceChain,
        string calldata sourceAddress
    ) internal view {
        string memory trusted = trustedRemotes[sourceChain];
        if (bytes(trusted).length == 0) {
            revert UntrustedRemote(sourceChain, sourceAddress);
        }
        if (keccak256(bytes(trusted)) != keccak256(bytes(sourceAddress))) {
            revert UntrustedRemote(sourceChain, sourceAddress);
        }
    }
}
