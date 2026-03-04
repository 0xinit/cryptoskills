# NFT Interface Reference

Complete interface signatures for ERC-721, ERC-1155, and ERC-2981. Use these for ABI encoding, type checking, and interface detection.

## IERC721

```solidity
interface IERC721 {
    // Events
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    // View functions
    function balanceOf(address owner) external view returns (uint256 balance);
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function getApproved(uint256 tokenId) external view returns (address operator);
    function isApprovedForAll(address owner, address operator) external view returns (bool);

    // Transfer functions
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function transferFrom(address from, address to, uint256 tokenId) external;

    // Approval functions
    function approve(address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool approved) external;
}

// ERC-165 interface ID: 0x80ac58cd
```

## IERC721Metadata

```solidity
interface IERC721Metadata {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}

// ERC-165 interface ID: 0x5b5e139f
```

## IERC721Enumerable

```solidity
interface IERC721Enumerable {
    function totalSupply() external view returns (uint256);
    function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256);
    function tokenByIndex(uint256 index) external view returns (uint256);
}

// ERC-165 interface ID: 0x780e9d63
```

## IERC721Receiver

```solidity
interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);

    // Must return: 0x150b7a02
}
```

## IERC1155

```solidity
interface IERC1155 {
    // Events
    event TransferSingle(
        address indexed operator, address indexed from, address indexed to,
        uint256 id, uint256 value
    );
    event TransferBatch(
        address indexed operator, address indexed from, address indexed to,
        uint256[] ids, uint256[] values
    );
    event ApprovalForAll(address indexed account, address indexed operator, bool approved);
    event URI(string value, uint256 indexed id);

    // View functions
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function balanceOfBatch(
        address[] calldata accounts, uint256[] calldata ids
    ) external view returns (uint256[] memory);
    function isApprovedForAll(address account, address operator) external view returns (bool);

    // Transfer functions
    function safeTransferFrom(
        address from, address to, uint256 id, uint256 amount, bytes calldata data
    ) external;
    function safeBatchTransferFrom(
        address from, address to, uint256[] calldata ids,
        uint256[] calldata amounts, bytes calldata data
    ) external;

    // Approval
    function setApprovalForAll(address operator, bool approved) external;
}

// ERC-165 interface ID: 0xd9b67a26
```

## IERC1155MetadataURI

```solidity
interface IERC1155MetadataURI {
    function uri(uint256 id) external view returns (string memory);
}

// ERC-165 interface ID: 0x0e89341c
```

## IERC1155Receiver

```solidity
interface IERC1155Receiver {
    function onERC1155Received(
        address operator, address from, uint256 id,
        uint256 value, bytes calldata data
    ) external returns (bytes4);

    function onERC1155BatchReceived(
        address operator, address from, uint256[] calldata ids,
        uint256[] calldata values, bytes calldata data
    ) external returns (bytes4);

    // onERC1155Received must return: 0xf23a6e61
    // onERC1155BatchReceived must return: 0xbc197c81
}
```

## IERC2981

```solidity
interface IERC2981 {
    /// @notice Returns royalty info for a given token and sale price
    /// @param tokenId The NFT asset queried for royalty information
    /// @param salePrice The sale price of the NFT (in the payment token's base units)
    /// @return receiver Address to receive royalty payment
    /// @return royaltyAmount Amount of royalty payment in same units as salePrice
    function royaltyInfo(uint256 tokenId, uint256 salePrice)
        external
        view
        returns (address receiver, uint256 royaltyAmount);
}

// ERC-165 interface ID: 0x2a55205a
```

## IERC4906

```solidity
interface IERC4906 {
    event MetadataUpdate(uint256 _tokenId);
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);
}

// ERC-165 interface ID: 0x49064906
```

## Interface ID Quick Reference

| Standard | Interface ID | Function |
|----------|-------------|----------|
| ERC-721 | `0x80ac58cd` | Core NFT |
| ERC-721 Metadata | `0x5b5e139f` | `name`, `symbol`, `tokenURI` |
| ERC-721 Enumerable | `0x780e9d63` | `totalSupply`, `tokenByIndex` |
| ERC-1155 | `0xd9b67a26` | Multi-token |
| ERC-1155 Metadata URI | `0x0e89341c` | `uri` |
| ERC-2981 | `0x2a55205a` | Royalties |
| ERC-4906 | `0x49064906` | Metadata updates |
| ERC-165 | `0x01ffc9a7` | Interface detection |

## Verification

```bash
# Check if a contract supports ERC-721
cast call $CONTRACT "supportsInterface(bytes4)(bool)" 0x80ac58cd --rpc-url $RPC_URL

# Check ERC-2981 support
cast call $CONTRACT "supportsInterface(bytes4)(bool)" 0x2a55205a --rpc-url $RPC_URL

# Query royalty info (tokenId=0, salePrice=1 ETH)
cast call $CONTRACT "royaltyInfo(uint256,uint256)(address,uint256)" 0 1000000000000000000 --rpc-url $RPC_URL
```
