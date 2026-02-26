// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ============================================================================
// Production ERC20: Ownable + Permit + Votes
// ============================================================================

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ProductionERC20
/// @notice ERC20 with burn, pause, gasless approvals (EIP-2612), and governance votes (EIP-5805).
/// @dev Suitable for governance tokens, protocol reward tokens, or any mintable ERC20.
///
/// Includes:
///   - Ownable: single admin for mint/pause
///   - ERC20Burnable: holders can burn their own tokens
///   - ERC20Pausable: emergency pause on all transfers
///   - ERC20Permit: off-chain approval signatures
///   - ERC20Votes: checkpoint-based voting power for Governor
contract ProductionERC20 is ERC20, ERC20Burnable, ERC20Pausable, ERC20Permit, ERC20Votes, Ownable {
    constructor(address initialOwner)
        ERC20("ProductionToken", "PROD")
        ERC20Permit("ProductionToken")
        Ownable(initialOwner)
    {
        _mint(initialOwner, 10_000_000 * 10 ** decimals());
    }

    /// @notice Mint new tokens. Only callable by the owner.
    /// @param to Recipient address.
    /// @param amount Amount in base units (include decimals).
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Pause all token transfers. Emergency use only.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause token transfers.
    function unpause() external onlyOwner {
        _unpause();
    }

    // --- Required overrides for diamond resolution ---

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}

// ============================================================================
// Production ERC721: URIStorage + Enumerable + Royalties
// ============================================================================

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
// Ownable already imported above

/// @title ProductionERC721
/// @notice ERC721 with per-token metadata, on-chain enumeration, and EIP-2981 royalties.
/// @dev Suitable for NFT collections, membership passes, or any unique token.
///
/// Includes:
///   - Ownable: single admin for minting
///   - ERC721URIStorage: per-token metadata URI
///   - ERC721Enumerable: totalSupply, tokenByIndex, tokenOfOwnerByIndex
///   - ERC2981: on-chain royalty info (marketplace-compatible)
contract ProductionERC721 is ERC721, ERC721Enumerable, ERC721URIStorage, ERC2981, Ownable {
    uint256 private _nextTokenId;
    uint256 public constant MAX_SUPPLY = 10_000;

    error MaxSupplyReached();

    constructor(address initialOwner, address royaltyReceiver)
        ERC721("ProductionNFT", "PNFT")
        Ownable(initialOwner)
    {
        // 5% default royalty (500 basis points out of 10_000)
        _setDefaultRoyalty(royaltyReceiver, 500);
    }

    /// @notice Mint a new NFT with metadata URI.
    /// @param to Recipient address.
    /// @param uri Metadata JSON URI for this token.
    /// @return tokenId The newly minted token ID.
    function safeMint(address to, string calldata uri) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        if (tokenId >= MAX_SUPPLY) revert MaxSupplyReached();
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        return tokenId;
    }

    /// @notice Override royalty for a specific token.
    /// @param tokenId Token to set custom royalty for.
    /// @param receiver Address that receives royalties.
    /// @param feeNumerator Royalty in basis points (e.g., 750 = 7.5%).
    function setTokenRoyalty(uint256 tokenId, address receiver, uint96 feeNumerator)
        external
        onlyOwner
    {
        _setTokenRoyalty(tokenId, receiver, feeNumerator);
    }

    // --- Required overrides for diamond resolution ---

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
