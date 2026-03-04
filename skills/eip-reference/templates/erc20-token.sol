// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MyToken
/// @author Your Name
/// @notice ERC-20 token with Permit (ERC-2612), burn, and capped supply.
/// @dev Built on OpenZeppelin v5. Permit enables gasless approvals via EIP-712 signatures.
///      The EIP712 domain separator is auto-managed with fork protection.
contract MyToken is ERC20, ERC20Permit, ERC20Burnable, Ownable {
    /// @notice Maximum token supply in base units (18 decimals).
    uint256 public constant MAX_SUPPLY = 1_000_000_000e18; // 1 billion

    /// @notice Thrown when a mint would exceed MAX_SUPPLY.
    /// @param requested Amount requested to mint.
    /// @param available Remaining mintable supply.
    error ExceedsMaxSupply(uint256 requested, uint256 available);

    /// @param initialOwner Address receiving ownership and initial mint.
    constructor(address initialOwner)
        ERC20("MyToken", "MTK")
        ERC20Permit("MyToken")
        Ownable(initialOwner)
    {
        // Mint 10% of max supply to the initial owner
        _mint(initialOwner, 100_000_000e18);
    }

    /// @notice Mint new tokens. Restricted to contract owner.
    /// @param to Recipient of the minted tokens.
    /// @param amount Amount to mint in base units (18 decimals).
    function mint(address to, uint256 amount) external onlyOwner {
        if (totalSupply() + amount > MAX_SUPPLY) {
            revert ExceedsMaxSupply(amount, MAX_SUPPLY - totalSupply());
        }
        _mint(to, amount);
    }
}

// Deployment (Foundry):
//   forge create src/MyToken.sol:MyToken \
//     --constructor-args 0xYourAddress \
//     --rpc-url $RPC_URL \
//     --private-key $PRIVATE_KEY \
//     --verify --etherscan-api-key $ETHERSCAN_KEY

// Deployment (Hardhat):
//   const token = await ethers.deployContract("MyToken", [owner.address]);
//   await token.waitForDeployment();

// Installation:
//   forge install OpenZeppelin/openzeppelin-contracts
//   # or
//   npm install @openzeppelin/contracts@^5.0.0

// Last verified: March 2026
// OpenZeppelin Contracts v5.x
