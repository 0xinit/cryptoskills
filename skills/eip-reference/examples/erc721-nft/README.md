# ERC-721 NFT — Mint, Transfer, and Query

ERC-721 NFT contract with OpenZeppelin v5, on-chain metadata, royalties, and viem interaction.

## Solidity — NFT Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title ExampleNFT
/// @notice ERC-721 with sequential minting, royalties (ERC-2981), and configurable base URI.
contract ExampleNFT is ERC721, ERC2981, Ownable {
    using Strings for uint256;

    uint256 private _nextTokenId;
    uint256 public constant MAX_SUPPLY = 10_000;
    uint256 public constant MINT_PRICE = 0.01 ether;
    string private _baseTokenURI;

    error MaxSupplyReached();
    error InsufficientPayment(uint256 sent, uint256 required);
    error WithdrawFailed();

    constructor(address initialOwner, string memory baseURI, address royaltyReceiver)
        ERC721("ExampleNFT", "ENFT")
        Ownable(initialOwner)
    {
        _baseTokenURI = baseURI;
        // 5% royalty (500 basis points)
        _setDefaultRoyalty(royaltyReceiver, 500);
    }

    /// @notice Public mint. One token per call.
    function mint() external payable returns (uint256) {
        if (_nextTokenId >= MAX_SUPPLY) revert MaxSupplyReached();
        if (msg.value < MINT_PRICE) revert InsufficientPayment(msg.value, MINT_PRICE);

        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        return tokenId;
    }

    /// @notice Owner-only batch mint for airdrops.
    function mintBatch(address to, uint256 count) external onlyOwner {
        for (uint256 i; i < count; ++i) {
            if (_nextTokenId >= MAX_SUPPLY) revert MaxSupplyReached();
            uint256 tokenId = _nextTokenId++;
            _safeMint(to, tokenId);
        }
    }

    function withdraw() external onlyOwner {
        (bool ok,) = msg.sender.call{value: address(this).balance}("");
        if (!ok) revert WithdrawFailed();
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
    }

    // ERC-165: declare support for ERC-721 + ERC-2981
    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC2981) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
```

## TypeScript — Mint and Query with viem

```typescript
import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const NFT_ADDRESS = '0xDeployedNFTAddress...' as const;

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain: sepolia, transport: http(process.env.RPC_URL) });
const walletClient = createWalletClient({ account, chain: sepolia, transport: http(process.env.RPC_URL) });

// Mint an NFT
const mintHash = await walletClient.writeContract({
  address: NFT_ADDRESS,
  abi: exampleNftAbi,
  functionName: 'mint',
  value: parseEther('0.01'),
});

const receipt = await publicClient.waitForTransactionReceipt({ hash: mintHash });
if (receipt.status !== 'success') throw new Error('Mint failed');

// Parse Transfer event to get tokenId
const transferLog = receipt.logs.find(
  (log) => log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
);
const tokenId = BigInt(transferLog!.topics[3]!);
console.log('Minted tokenId:', tokenId);
```

## TypeScript — Safe Transfer and Approval

```typescript
// Check ownership
const owner = await publicClient.readContract({
  address: NFT_ADDRESS,
  abi: exampleNftAbi,
  functionName: 'ownerOf',
  args: [tokenId],
});

// Approve a specific address for one token
await walletClient.writeContract({
  address: NFT_ADDRESS,
  abi: exampleNftAbi,
  functionName: 'approve',
  args: ['0xApproved...', tokenId],
});

// Safe transfer (calls onERC721Received on contract recipients)
await walletClient.writeContract({
  address: NFT_ADDRESS,
  abi: exampleNftAbi,
  functionName: 'safeTransferFrom',
  args: [account.address, '0xRecipient...', tokenId],
});
```

## TypeScript — Query Royalty Info

```typescript
const [receiver, royaltyAmount] = await publicClient.readContract({
  address: NFT_ADDRESS,
  abi: exampleNftAbi,
  functionName: 'royaltyInfo',
  args: [tokenId, parseEther('1')], // For a 1 ETH sale
});
// receiver = royalty recipient address
// royaltyAmount = 0.05 ETH (5% of 1 ETH)
```

## Receiving Contract — IERC721Receiver

If your contract needs to receive ERC-721 tokens via `safeTransferFrom`:

```solidity
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract NFTVault is IERC721Receiver {
    function onERC721Received(
        address, address, uint256, bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
```

## Key Points

- Use `_safeMint` (not `_mint`) to trigger receiver checks on contract recipients.
- `supportsInterface` must be overridden when inheriting multiple ERC-165 contracts.
- `ownerOf` reverts for nonexistent tokens — wrap in try/catch when querying.
- Approval clears on transfer. `setApprovalForAll` (operator) persists.
- ERC-2981 royalties are advisory — enforcement depends on marketplace implementation.

Last verified: March 2026
