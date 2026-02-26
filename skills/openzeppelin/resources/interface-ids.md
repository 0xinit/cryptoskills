# ERC165 Interface IDs

Standard interface IDs for `supportsInterface` checks. Use these to verify contract capabilities before interacting.

## Common Interface IDs

| Interface | ID | Standard |
|-----------|------|----------|
| IERC165 | `0x01ffc9a7` | EIP-165 |
| IERC721 | `0x80ac58cd` | EIP-721 |
| IERC721Metadata | `0x5b5e139f` | EIP-721 |
| IERC721Enumerable | `0x780e9d63` | EIP-721 |
| IERC1155 | `0xd9b67a26` | EIP-1155 |
| IERC1155MetadataURI | `0x0e89341c` | EIP-1155 |
| IERC2981 | `0x2a55205a` | EIP-2981 (Royalties) |
| IAccessControl | `0x7965db0b` | OZ AccessControl |
| IGovernor | `0xbf26d897` | EIP-6372 / OZ Governor |

## How Interface IDs Are Calculated

An interface ID is the XOR of all function selectors in that interface.

```solidity
// Single function: interface ID = function selector
bytes4 id = bytes4(keccak256("supportsInterface(bytes4)"));
// = 0x01ffc9a7

// Multiple functions: XOR all selectors
bytes4 erc721Id = bytes4(keccak256("balanceOf(address)"))
    ^ bytes4(keccak256("ownerOf(uint256)"))
    ^ bytes4(keccak256("safeTransferFrom(address,address,uint256,bytes)"))
    ^ bytes4(keccak256("safeTransferFrom(address,address,uint256)"))
    ^ bytes4(keccak256("transferFrom(address,address,uint256)"))
    ^ bytes4(keccak256("approve(address,uint256)"))
    ^ bytes4(keccak256("setApprovalForAll(address,bool)"))
    ^ bytes4(keccak256("getApproved(uint256)"))
    ^ bytes4(keccak256("isApprovedForAll(address,address)"));
// = 0x80ac58cd
```

Using `type(...).interfaceId` in Solidity (compiler calculates it):

```solidity
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";

bytes4 erc721Id = type(IERC721).interfaceId;   // 0x80ac58cd
bytes4 royaltyId = type(IERC2981).interfaceId;  // 0x2a55205a
```

## supportsInterface Implementation

OpenZeppelin contracts implement `supportsInterface` automatically. When combining extensions, override and merge:

```solidity
function supportsInterface(bytes4 interfaceId)
    public
    view
    override(ERC721, ERC721Enumerable, ERC2981)
    returns (bool)
{
    return super.supportsInterface(interfaceId);
}
```

## Checking Interface Support

Before interacting with an unknown contract, verify it supports the expected interface:

```solidity
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";

function hasRoyalties(address contractAddr) external view returns (bool) {
    return IERC165(contractAddr).supportsInterface(type(IERC2981).interfaceId);
}
```

With viem:

```typescript
const supportsRoyalties = await publicClient.readContract({
  address: nftAddress,
  abi: [
    {
      name: "supportsInterface",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "interfaceId", type: "bytes4" }],
      outputs: [{ name: "", type: "bool" }],
    },
  ],
  functionName: "supportsInterface",
  args: ["0x2a55205a"],
});
```

## Checking with cast

```bash
# Check if a contract supports ERC721
cast call <CONTRACT> "supportsInterface(bytes4)(bool)" 0x80ac58cd --rpc-url $RPC_URL

# Check if a contract supports ERC2981 royalties
cast call <CONTRACT> "supportsInterface(bytes4)(bool)" 0x2a55205a --rpc-url $RPC_URL
```

## References

- [EIP-165: Standard Interface Detection](https://eips.ethereum.org/EIPS/eip-165)
- [EIP-2981: NFT Royalty Standard](https://eips.ethereum.org/EIPS/eip-2981)
- [OpenZeppelin ERC165 Docs](https://docs.openzeppelin.com/contracts/5.x/api/utils#ERC165)
