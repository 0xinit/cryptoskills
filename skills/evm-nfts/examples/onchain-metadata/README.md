# Fully Onchain SVG NFT

Complete onchain SVG NFT with Base64-encoded metadata. No external storage dependencies -- all metadata and artwork live in the smart contract.

## Dependencies

```bash
forge install OpenZeppelin/openzeppelin-contracts@v5.6.1
```

## Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @notice Fully onchain SVG NFT -- metadata and image stored in contract bytecode
contract OnchainSVG is ERC721, Ownable, ReentrancyGuard {
    using Strings for uint256;
    using Strings for uint160;

    uint256 private _nextTokenId;
    uint256 public constant MAX_SUPPLY = 1_000;

    error MaxSupplyReached();

    constructor(address initialOwner)
        ERC721("OnchainShapes", "SHAPE")
        Ownable(initialOwner)
    {}

    function mint() external nonReentrant {
        uint256 tokenId = _nextTokenId++;
        if (tokenId >= MAX_SUPPLY) revert MaxSupplyReached();
        _safeMint(msg.sender, tokenId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        address owner = _ownerOf(tokenId);
        require(owner != address(0), "Token does not exist");

        string memory svg = _generateSVG(tokenId);
        string memory attributes = _generateAttributes(tokenId);

        string memory json = string.concat(
            '{"name":"Shape #',
            tokenId.toString(),
            '","description":"Fully onchain generative shape","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '","attributes":',
            attributes,
            "}"
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _generateSVG(uint256 tokenId) internal pure returns (string memory) {
        // Deterministic pseudorandom seed from tokenId
        uint256 seed = uint256(keccak256(abi.encodePacked(tokenId)));

        string memory bgColor = _pickColor(seed, 0);
        string memory shapeColor = _pickColor(seed, 1);
        uint256 cx = 50 + (seed % 200);
        uint256 cy = 50 + ((seed >> 8) % 200);
        uint256 r = 30 + ((seed >> 16) % 70);

        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">',
            '<rect width="300" height="300" fill="',
            bgColor,
            '"/>',
            '<circle cx="',
            cx.toString(),
            '" cy="',
            cy.toString(),
            '" r="',
            r.toString(),
            '" fill="',
            shapeColor,
            '"/>',
            "</svg>"
        );
    }

    function _generateAttributes(uint256 tokenId) internal pure returns (string memory) {
        uint256 seed = uint256(keccak256(abi.encodePacked(tokenId)));
        uint256 r = 30 + ((seed >> 16) % 70);

        string memory size;
        if (r < 50) size = "Small";
        else if (r < 75) size = "Medium";
        else size = "Large";

        return string.concat(
            '[{"trait_type":"Size","value":"',
            size,
            '"},{"trait_type":"Radius","value":',
            r.toString(),
            ',"display_type":"number"}]'
        );
    }

    function _pickColor(uint256 seed, uint256 offset) internal pure returns (string memory) {
        string[8] memory palette = [
            "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
            "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F"
        ];
        return palette[(seed >> (offset * 32)) % 8];
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }
}
```

## Foundry Test

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {OnchainSVG} from "../src/OnchainSVG.sol";

contract OnchainSVGTest is Test {
    OnchainSVG nft;
    address owner = makeAddr("owner");
    address alice = makeAddr("alice");

    function setUp() public {
        nft = new OnchainSVG(owner);
    }

    function test_mint() public {
        vm.prank(alice);
        nft.mint();
        assertEq(nft.ownerOf(0), alice);
        assertEq(nft.totalSupply(), 1);
    }

    function test_tokenURI_returnsBase64Json() public {
        vm.prank(alice);
        nft.mint();

        string memory uri = nft.tokenURI(0);
        // URI must start with data:application/json;base64,
        assertTrue(bytes(uri).length > 35);

        bytes memory prefix = bytes("data:application/json;base64,");
        for (uint256 i = 0; i < prefix.length; i++) {
            assertEq(bytes(uri)[i], prefix[i]);
        }
    }

    function test_differentTokens_differentSVG() public {
        vm.startPrank(alice);
        nft.mint();
        nft.mint();
        vm.stopPrank();

        string memory uri0 = nft.tokenURI(0);
        string memory uri1 = nft.tokenURI(1);

        assertTrue(
            keccak256(bytes(uri0)) != keccak256(bytes(uri1)),
            "Different tokens should produce different URIs"
        );
    }

    function test_revert_nonexistentToken() public {
        vm.expectRevert("Token does not exist");
        nft.tokenURI(999);
    }
}
```

## How It Works

1. **`tokenURI` returns a data URI.** Instead of pointing to IPFS or a server, the function returns `data:application/json;base64,<encoded-json>`. Marketplaces and wallets decode this inline.

2. **JSON contains an inline SVG.** The `image` field is `data:image/svg+xml;base64,<encoded-svg>`. The SVG is generated deterministically from the token ID.

3. **Deterministic randomness.** Each token's visual properties (colors, position, size) are derived from `keccak256(tokenId)`. The same token ID always produces the same image.

4. **No external dependencies.** The metadata and artwork are fully onchain. The NFT survives IPFS unpinning, server shutdowns, and API deprecations.

## Gas Considerations

| Operation | Approximate Gas |
|-----------|----------------|
| Mint | ~85k gas |
| `tokenURI` read | ~50k gas (view, no cost) |
| Deployment | ~1.5M gas |

Onchain SVG is gas-intensive for deployment and complex generation. Keep SVG simple (under 2KB) to avoid hitting block gas limits on `tokenURI` calls in other contracts.

## Notes

- `Base64.encode` from OpenZeppelin v5.6.1 handles the encoding. Do not use a custom Base64 library.
- `string.concat` (Solidity 0.8.12+) is cleaner and cheaper than `abi.encodePacked` for string concatenation.
- Attributes follow the OpenSea metadata standard: `trait_type` + `value`, with optional `display_type` for numeric traits.
- For more complex generative art, consider storing SVG fragments as contract constants and composing them based on seed bits.
