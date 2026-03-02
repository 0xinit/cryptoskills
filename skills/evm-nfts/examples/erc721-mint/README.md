# ERC-721 Collection with Allowlist Mint

Complete ERC-721 collection with Merkle proof allowlist, per-wallet limit, supply cap, royalties, and ReentrancyGuard. Uses OpenZeppelin v5.6.1.

## Dependencies

```bash
forge install OpenZeppelin/openzeppelin-contracts@v5.6.1
```

## Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @notice ERC-721 collection with Merkle allowlist, per-wallet cap, and ERC-2981 royalties
contract AllowlistCollection is ERC721, ERC721URIStorage, ERC2981, Ownable, ReentrancyGuard {
    using Strings for uint256;

    uint256 private _nextTokenId;
    uint256 public constant MAX_SUPPLY = 10_000;
    uint256 public constant MAX_PER_WALLET = 3;
    uint256 public constant ALLOWLIST_PRICE = 0.05 ether;
    uint256 public constant PUBLIC_PRICE = 0.08 ether;

    bytes32 public merkleRoot;
    string private _baseTokenURI;
    bool public allowlistActive;
    bool public publicMintActive;

    mapping(address minter => uint256 count) public mintCount;

    error MaxSupplyReached();
    error ExceedsWalletLimit();
    error InsufficientPayment();
    error MintNotActive();
    error InvalidProof();

    constructor(
        address initialOwner,
        address royaltyReceiver,
        bytes32 _merkleRoot,
        string memory baseURI
    )
        ERC721("AllowlistCollection", "ALC")
        Ownable(initialOwner)
    {
        merkleRoot = _merkleRoot;
        _baseTokenURI = baseURI;
        _setDefaultRoyalty(royaltyReceiver, 500);
    }

    function allowlistMint(uint256 quantity, bytes32[] calldata proof)
        external
        payable
        nonReentrant
    {
        if (!allowlistActive) revert MintNotActive();
        if (msg.value < ALLOWLIST_PRICE * quantity) revert InsufficientPayment();
        if (mintCount[msg.sender] + quantity > MAX_PER_WALLET) revert ExceedsWalletLimit();

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        if (!MerkleProof.verify(proof, merkleRoot, leaf)) revert InvalidProof();

        mintCount[msg.sender] += quantity;

        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _nextTokenId++;
            if (tokenId >= MAX_SUPPLY) revert MaxSupplyReached();
            _safeMint(msg.sender, tokenId);
        }
    }

    function publicMint(uint256 quantity) external payable nonReentrant {
        if (!publicMintActive) revert MintNotActive();
        if (msg.value < PUBLIC_PRICE * quantity) revert InsufficientPayment();
        if (mintCount[msg.sender] + quantity > MAX_PER_WALLET) revert ExceedsWalletLimit();

        mintCount[msg.sender] += quantity;

        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _nextTokenId++;
            if (tokenId >= MAX_SUPPLY) revert MaxSupplyReached();
            _safeMint(msg.sender, tokenId);
        }
    }

    function setAllowlistActive(bool active) external onlyOwner {
        allowlistActive = active;
    }

    function setPublicMintActive(bool active) external onlyOwner {
        publicMintActive = active;
    }

    function setMerkleRoot(bytes32 _merkleRoot) external onlyOwner {
        merkleRoot = _merkleRoot;
    }

    function setBaseURI(string calldata baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    function withdraw() external onlyOwner {
        (bool sent, ) = payable(owner()).call{value: address(this).balance}("");
        require(sent);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
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

## Generate Merkle Root (TypeScript)

```bash
npm install @openzeppelin/merkle-tree
```

```typescript
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { keccak256, encodePacked } from "viem";

const allowlist: `0x${string}`[] = [
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
];

const leaves = allowlist.map((addr) => [addr]);
const tree = StandardMerkleTree.of(leaves, ["address"]);

console.log("Merkle Root:", tree.root);

function getProof(address: `0x${string}`): string[] {
  for (const [i, v] of tree.entries()) {
    if (v[0].toLowerCase() === address.toLowerCase()) {
      return tree.getProof(i);
    }
  }
  throw new Error("Address not in allowlist");
}

const proof = getProof("0x1111111111111111111111111111111111111111");
console.log("Proof:", proof);
```

## Foundry Test

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AllowlistCollection} from "../src/AllowlistCollection.sol";
import {Merkle} from "murky/Merkle.sol";

contract AllowlistCollectionTest is Test {
    AllowlistCollection nft;
    Merkle merkle;
    address owner = makeAddr("owner");
    address royaltyReceiver = makeAddr("royalty");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    bytes32[] leaves;
    bytes32 root;

    function setUp() public {
        merkle = new Merkle();
        leaves = new bytes32[](2);
        leaves[0] = keccak256(abi.encodePacked(alice));
        leaves[1] = keccak256(abi.encodePacked(bob));
        root = merkle.getRoot(leaves);

        nft = new AllowlistCollection(owner, royaltyReceiver, root, "ipfs://base/");
        vm.prank(owner);
        nft.setAllowlistActive(true);
    }

    function test_allowlistMint() public {
        bytes32[] memory proof = merkle.getProof(leaves, 0);
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        nft.allowlistMint{value: 0.05 ether}(1, proof);

        assertEq(nft.ownerOf(0), alice);
        assertEq(nft.totalSupply(), 1);
    }

    function test_revert_invalidProof() public {
        bytes32[] memory proof = merkle.getProof(leaves, 1);
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(AllowlistCollection.InvalidProof.selector);
        nft.allowlistMint{value: 0.05 ether}(1, proof);
    }

    function test_revert_exceedsWalletLimit() public {
        bytes32[] memory proof = merkle.getProof(leaves, 0);
        vm.deal(alice, 1 ether);
        vm.startPrank(alice);
        nft.allowlistMint{value: 0.15 ether}(3, proof);
        vm.expectRevert(AllowlistCollection.ExceedsWalletLimit.selector);
        nft.allowlistMint{value: 0.05 ether}(1, proof);
        vm.stopPrank();
    }

    function test_royaltyInfo() public {
        (address receiver, uint256 amount) = nft.royaltyInfo(0, 1 ether);
        assertEq(receiver, royaltyReceiver);
        assertEq(amount, 0.05 ether);
    }
}
```

## Notes

- The Merkle tree uses `keccak256(abi.encodePacked(address))` as the leaf hash. Match this exactly in your off-chain generation.
- `ReentrancyGuard` is on both `allowlistMint` and `publicMint` because `_safeMint` makes an external call to the receiver.
- Per-wallet limit uses `mintCount` mapping. This tracks across both allowlist and public phases.
- `ERC721URIStorage` auto-returns the concatenation of `_baseURI() + tokenId` in `tokenURI()`.
- Install Murky for Merkle tree testing in Foundry: `forge install dmfxyz/murky`.
