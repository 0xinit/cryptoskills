# ERC-721 Complete Interface Reference

Full interface specification for ERC-721 non-fungible tokens, including metadata, enumerable, and royalty extensions.

## IERC721 — Core Interface

```solidity
interface IERC721 is IERC165 {
    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function approve(address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool approved) external;
    function getApproved(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
}
```

## IERC721Metadata

```solidity
interface IERC721Metadata is IERC721 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}
```

`tokenURI` returns a URI pointing to a JSON metadata file conforming to the ERC-721 metadata schema:
```json
{
    "name": "Token Name",
    "description": "Description",
    "image": "https://... or ipfs://..."
}
```

## IERC721Enumerable

```solidity
interface IERC721Enumerable is IERC721 {
    function totalSupply() external view returns (uint256);
    function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256);
    function tokenByIndex(uint256 index) external view returns (uint256);
}
```

Enumerable adds significant gas overhead to transfers (extra storage writes for index tracking). Most modern collections skip this and rely on off-chain indexing instead.

## IERC721Receiver — Safe Transfer Callback

```solidity
interface IERC721Receiver {
    function onERC721Received(
        address operator, address from, uint256 tokenId, bytes calldata data
    ) external returns (bytes4);
}
```

Must return `IERC721Receiver.onERC721Received.selector` (`0x150b7a02`). If the receiving contract does not implement this or returns the wrong value, `safeTransferFrom` reverts.

## ERC-2981 — Royalty Standard

```solidity
interface IERC2981 is IERC165 {
    function royaltyInfo(uint256 tokenId, uint256 salePrice)
        external view returns (address receiver, uint256 royaltyAmount);
}
```

Returns the royalty recipient and amount for a given sale price. Marketplaces query this on-chain but enforcement is voluntary — the standard does not enforce royalty payment at the protocol level.

## Function Selectors

| Function | Selector |
|----------|----------|
| `balanceOf(address)` | `0x70a08231` |
| `ownerOf(uint256)` | `0x6352211e` |
| `safeTransferFrom(address,address,uint256,bytes)` | `0xb88d4fde` |
| `safeTransferFrom(address,address,uint256)` | `0x42842e0e` |
| `transferFrom(address,address,uint256)` | `0x23b872dd` |
| `approve(address,uint256)` | `0x095ea7b3` |
| `setApprovalForAll(address,bool)` | `0xa22cb465` |
| `getApproved(uint256)` | `0x081812fc` |
| `isApprovedForAll(address,address)` | `0xe985e9c5` |
| `tokenURI(uint256)` | `0xc87b56dd` |
| `totalSupply()` | `0x18160ddd` |
| `tokenOfOwnerByIndex(address,uint256)` | `0x2f745c59` |
| `tokenByIndex(uint256)` | `0x4f6ccce7` |
| `royaltyInfo(uint256,uint256)` | `0x2a55205a` |

## ERC-165 Interface IDs

Computed as XOR of all function selectors in the interface.

| Interface | Interface ID |
|-----------|-------------|
| IERC165 | `0x01ffc9a7` |
| IERC721 | `0x80ac58cd` |
| IERC721Metadata | `0x5b5e139f` |
| IERC721Enumerable | `0x780e9d63` |
| IERC2981 | `0x2a55205a` |

Use `supportsInterface` to check before calling extension methods:

```solidity
if (IERC165(nftContract).supportsInterface(0x2a55205a)) {
    (address receiver, uint256 amount) = IERC2981(nftContract).royaltyInfo(tokenId, salePrice);
}
```

## Implementation Notes

- **Approval clears on transfer**: The approved address for a token is reset to `address(0)` when the token is transferred. `setApprovalForAll` (operator approval) persists.
- **Nonexistent tokenId**: `ownerOf` MUST revert for tokens that do not exist. Do not return `address(0)`.
- **Minting**: Emits `Transfer(address(0), to, tokenId)`. There is no `mint` function in the spec — implementations vary.
- **Burning**: Emits `Transfer(from, address(0), tokenId)`. After burning, `ownerOf(tokenId)` must revert.

## References

- [EIP-721](https://eips.ethereum.org/EIPS/eip-721) — Non-Fungible Token Standard
- [EIP-2981](https://eips.ethereum.org/EIPS/eip-2981) — NFT Royalty Standard
- [EIP-165](https://eips.ethereum.org/EIPS/eip-165) — Interface Detection
- [OpenZeppelin ERC721](https://docs.openzeppelin.com/contracts/5.x/api/token/erc721) — Reference implementation
