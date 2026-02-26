# ERC721 NFT Examples

Production-ready ERC721 implementations using OpenZeppelin v5.

## Basic ERC721 with Auto-Increment IDs

Minimal NFT with sequential token IDs. No `Counters` library needed in v5 -- use a plain `uint256`.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract BasicNFT is ERC721, Ownable {
    uint256 private _nextTokenId;

    constructor(address initialOwner)
        ERC721("BasicNFT", "BNFT")
        Ownable(initialOwner)
    {}

    function mint(address to) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        return tokenId;
    }
}
```

## ERC721URIStorage for Metadata

Per-token metadata URIs. Use when each NFT has a unique metadata JSON.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MetadataNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    constructor(address initialOwner)
        ERC721("MetadataNFT", "META")
        Ownable(initialOwner)
    {}

    function safeMint(address to, string calldata uri) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        return tokenId;
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
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
```

## ERC721Enumerable for On-Chain Enumeration

Adds `totalSupply()`, `tokenByIndex()`, and `tokenOfOwnerByIndex()`. Higher gas cost on transfers.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract EnumerableNFT is ERC721, ERC721Enumerable, Ownable {
    uint256 private _nextTokenId;

    constructor(address initialOwner)
        ERC721("EnumerableNFT", "ENFT")
        Ownable(initialOwner)
    {}

    function mint(address to) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        return tokenId;
    }

    // v5: MUST override both _update and _increaseBalance for Enumerable
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

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
```

## Mint with Payment (Price Check Pattern)

Public mint with ETH payment, max supply, and per-wallet limits.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract PaidNFT is ERC721, Ownable {
    uint256 public constant PRICE = 0.08 ether;
    uint256 public constant MAX_SUPPLY = 10_000;
    uint256 public constant MAX_PER_WALLET = 5;

    uint256 private _nextTokenId;

    error InsufficientPayment();
    error MaxSupplyReached();
    error WalletLimitExceeded();

    constructor(address initialOwner)
        ERC721("PaidNFT", "PAID")
        Ownable(initialOwner)
    {}

    function mint(uint256 quantity) external payable {
        if (msg.value < PRICE * quantity) revert InsufficientPayment();
        if (_nextTokenId + quantity > MAX_SUPPLY) revert MaxSupplyReached();
        if (balanceOf(msg.sender) + quantity > MAX_PER_WALLET) revert WalletLimitExceeded();

        for (uint256 i; i < quantity; ++i) {
            _safeMint(msg.sender, _nextTokenId++);
        }
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }
}
```

## Royalties with ERC2981

On-chain royalty info (EIP-2981). Marketplaces that respect this standard will pay royalties automatically.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract RoyaltyNFT is ERC721, ERC721URIStorage, ERC2981, Ownable {
    uint256 private _nextTokenId;

    constructor(address initialOwner, address royaltyReceiver)
        ERC721("RoyaltyNFT", "RNFT")
        Ownable(initialOwner)
    {
        // 5% default royalty (500 basis points, denominator is 10_000)
        _setDefaultRoyalty(royaltyReceiver, 500);
    }

    function safeMint(address to, string calldata uri) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        return tokenId;
    }

    /// @notice Override royalty for a specific token (e.g., 1/1 pieces with different rates)
    function setTokenRoyalty(uint256 tokenId, address receiver, uint96 feeNumerator)
        external
        onlyOwner
    {
        _setTokenRoyalty(tokenId, receiver, feeNumerator);
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
        override(ERC721, ERC721URIStorage, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
```

## Max Supply Enforcement Pattern

When combining Enumerable with a max supply cap:

```solidity
function mint(address to) external onlyOwner returns (uint256) {
    uint256 tokenId = _nextTokenId++;
    if (tokenId >= MAX_SUPPLY) revert MaxSupplyReached();
    _safeMint(to, tokenId);
    return tokenId;
}
```

Without Enumerable, track supply manually:

```solidity
uint256 private _nextTokenId;
uint256 public constant MAX_SUPPLY = 10_000;

function totalSupply() external view returns (uint256) {
    return _nextTokenId;
}
```

## Import Path Reference

| Contract | Import Path |
|----------|-------------|
| ERC721 | `@openzeppelin/contracts/token/ERC721/ERC721.sol` |
| ERC721Enumerable | `@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol` |
| ERC721URIStorage | `@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol` |
| ERC721Pausable | `@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol` |
| ERC721Burnable | `@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol` |
| ERC721Royalty | `@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol` |
| ERC2981 | `@openzeppelin/contracts/token/common/ERC2981.sol` |
| IERC721 | `@openzeppelin/contracts/token/ERC721/IERC721.sol` |
