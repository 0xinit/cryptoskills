# Advanced NFT Patterns

## ERC-6551: Token Bound Accounts

ERC-6551 turns any ERC-721 NFT into a smart contract account. Each NFT gets its own address that can hold assets (ETH, ERC-20 tokens, other NFTs), interact with protocols, and build an on-chain identity tied to the token.

### How It Works

A singleton registry contract deployed at a deterministic address creates account instances for any ERC-721 token. The account address is deterministic based on the implementation, chain ID, token contract, token ID, and salt.

```
NFT (ERC-721)
  |
  v
Registry.createAccount(implementation, chainId, tokenContract, tokenId, salt)
  |
  v
Token Bound Account (TBA) -- a smart contract at a deterministic address
  |
  v
Can hold ETH, ERC-20s, ERC-721s, ERC-1155s, sign messages, call contracts
```

### Registry Interface

> **Last verified:** March 2026

| Contract | Address | Chains |
|----------|---------|--------|
| ERC-6551 Registry | `0x000000006551c19487814612e58FE06813775758` | All EVM chains |

```solidity
interface IERC6551Registry {
    event ERC6551AccountCreated(
        address account,
        address indexed implementation,
        bytes32 salt,
        uint256 chainId,
        address indexed tokenContract,
        uint256 indexed tokenId
    );

    function createAccount(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external returns (address account);

    function account(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external view returns (address account);
}
```

### Account Interface

```solidity
interface IERC6551Account {
    receive() external payable;

    function token()
        external
        view
        returns (uint256 chainId, address tokenContract, uint256 tokenId);

    function state() external view returns (uint256);

    function isValidSigner(address signer, bytes calldata context)
        external
        view
        returns (bytes4 magicValue);
}

interface IERC6551Executable {
    function execute(address to, uint256 value, bytes calldata data, uint8 operation)
        external
        payable
        returns (bytes memory);
}
```

### Use Cases

| Use Case | Description |
|----------|-------------|
| NFT inventory | Game character NFT holds its equipment (other NFTs) and in-game currency |
| On-chain identity | PFP NFT accumulates reputation, credentials, and transaction history |
| Bundle trading | Sell an NFT along with all assets it holds in a single transfer |
| Loyalty programs | Membership NFT accumulates rewards directly |
| Composable DeFi | NFT representing a position holds the actual LP tokens |

### Key Considerations

- **Ownership follows the NFT.** When an ERC-721 token is transferred, the new owner controls the token bound account and all its assets. This is the core value proposition but also a risk: anyone with approval to transfer the NFT can steal the TBA's contents.
- **Circular ownership is invalid.** A TBA cannot own the NFT that controls it (directly or through a chain). Implementations must guard against this.
- **Account address is deterministic.** You can compute the TBA address before it is deployed, using `registry.account(...)`. This lets you send assets to the TBA before creating it.

## ERC-721C: Creator Token Standards (Royalty Enforcement)

ERC-721C, created by Limit Break, provides practical on-chain royalty enforcement by hooking into transfer functions. Unlike ERC-2981 (which is advisory), ERC-721C can block transfers that do not route through royalty-paying channels.

### How It Works

ERC-721C uses a transfer validator contract that is called on every transfer. The validator maintains a whitelist of allowed operators (marketplaces that honor royalties) and can block transfers initiated by non-compliant operators.

```
Transfer attempt
  |
  v
_update() override calls TransferValidator.validateTransfer()
  |
  v
Validator checks: Is the operator (marketplace) on the whitelist?
  |
  +--> Yes: Transfer proceeds, royalties will be paid by the marketplace
  |
  +--> No: Transfer reverts
```

### Transfer Validator Interface

```solidity
interface ITransferValidator {
    function validateTransfer(
        address caller,
        address from,
        address to,
        uint256 tokenId
    ) external view;
}
```

### Integration Pattern

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface ITransferValidator {
    function validateTransfer(
        address caller, address from, address to, uint256 tokenId
    ) external view;
}

/// @notice ERC-721 with enforced royalties via transfer validation
contract EnforcedRoyaltyNFT is ERC721, ERC2981, Ownable {
    ITransferValidator public transferValidator;

    error TransferValidatorNotSet();

    constructor(address initialOwner, address _transferValidator, address royaltyReceiver)
        ERC721("EnforcedRoyaltyNFT", "ERNFT")
        Ownable(initialOwner)
    {
        transferValidator = ITransferValidator(_transferValidator);
        _setDefaultRoyalty(royaltyReceiver, 500);
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address from)
    {
        from = super._update(to, tokenId, auth);

        // Skip validation for mints (from == address(0)) and burns (to == address(0))
        if (from != address(0) && to != address(0)) {
            if (address(transferValidator) == address(0)) revert TransferValidatorNotSet();
            transferValidator.validateTransfer(msg.sender, from, to, tokenId);
        }
    }

    function setTransferValidator(address _transferValidator) external onlyOwner {
        transferValidator = ITransferValidator(_transferValidator);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC2981) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
```

### Tradeoffs

| Aspect | ERC-2981 (Advisory) | ERC-721C (Enforced) |
|--------|--------------------|--------------------|
| Marketplace compliance | Optional | Required (or transfer blocked) |
| User friction | None | Cannot use non-compliant marketplaces |
| Creator revenue certainty | Low | High |
| Decentralization | Permissionless transfers | Operator whitelist required |
| Gas overhead | None | ~5k gas per transfer (validator call) |
| Adoption | Universal standard | Growing but not universal |

### Key Considerations

- **Whitelist maintenance.** The transfer validator whitelist must be actively maintained. New marketplaces need to be added, and compromised/non-compliant ones removed. This is an ongoing operational burden.
- **P2P transfers.** Direct wallet-to-wallet transfers (where `msg.sender == from`) are typically allowed without validator checks. Only operator-initiated transfers (marketplace sales) are validated.
- **Ecosystem fragmentation.** Some users and marketplaces reject enforced royalties as a violation of token ownership rights. Consider your audience and ecosystem norms.

## References

- [ERC-6551: Non-fungible Token Bound Accounts](https://eips.ethereum.org/EIPS/eip-6551)
- [ERC-6551 Reference Implementation](https://github.com/erc6551/reference)
- [Limit Break Creator Token Standards](https://github.com/limitbreakinc/creator-token-standards)
- [Tokenbound SDK](https://docs.tokenbound.org)
