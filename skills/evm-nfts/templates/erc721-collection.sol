// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * ERC-721 Collection Starter Template
 *
 * Production-ready ERC-721 with:
 * - Paid mint with per-wallet limit and supply cap
 * - ERC-2981 royalties (5%)
 * - ReentrancyGuard on mint
 * - ERC-4906 metadata update events
 * - Owner-only withdrawal
 *
 * Usage:
 * 1. Copy this file to your project's src/ directory
 * 2. Install OpenZeppelin: forge install OpenZeppelin/openzeppelin-contracts@v5.6.1
 * 3. Update name, symbol, supply, price, and royalty settings
 * 4. Add metadata URI logic (IPFS, Arweave, or onchain)
 *
 * Dependencies: @openzeppelin/contracts v5.6.1
 */

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";

contract MyCollection is ERC721, ERC2981, IERC4906, Ownable, ReentrancyGuard {
    using Strings for uint256;

    uint256 private _nextTokenId;

    // -- Configure these values --
    uint256 public constant MAX_SUPPLY = 10_000;
    uint256 public constant MAX_PER_WALLET = 5;
    uint256 public constant MINT_PRICE = 0.05 ether;

    string private _baseTokenURI;
    bool public mintActive;

    mapping(address minter => uint256 count) public mintCount;

    error MaxSupplyReached();
    error ExceedsWalletLimit();
    error InsufficientPayment();
    error MintNotActive();
    error WithdrawFailed();

    constructor(
        address initialOwner,
        address royaltyReceiver,
        string memory baseURI
    )
        ERC721("MyCollection", "MYC")
        Ownable(initialOwner)
    {
        _baseTokenURI = baseURI;
        // 5% royalty (500 basis points)
        _setDefaultRoyalty(royaltyReceiver, 500);
    }

    function mint(uint256 quantity) external payable nonReentrant {
        if (!mintActive) revert MintNotActive();
        if (msg.value < MINT_PRICE * quantity) revert InsufficientPayment();
        if (mintCount[msg.sender] + quantity > MAX_PER_WALLET) revert ExceedsWalletLimit();

        mintCount[msg.sender] += quantity;

        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _nextTokenId++;
            if (tokenId >= MAX_SUPPLY) revert MaxSupplyReached();
            _safeMint(msg.sender, tokenId);
        }
    }

    // -- Owner functions --

    function setMintActive(bool active) external onlyOwner {
        mintActive = active;
    }

    function setBaseURI(string calldata baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
        emit BatchMetadataUpdate(0, _nextTokenId > 0 ? _nextTokenId - 1 : 0);
    }

    function withdraw() external onlyOwner {
        (bool sent, ) = payable(owner()).call{value: address(this).balance}("");
        if (!sent) revert WithdrawFailed();
    }

    // -- View functions --

    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    function contractURI() external pure returns (string memory) {
        // Replace with your collection metadata URI
        return "";
    }

    // -- Overrides --

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return string.concat(_baseTokenURI, tokenId.toString());
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC2981)
        returns (bool)
    {
        return
            interfaceId == bytes4(0x49064906) || // ERC-4906
            super.supportsInterface(interfaceId);
    }
}
