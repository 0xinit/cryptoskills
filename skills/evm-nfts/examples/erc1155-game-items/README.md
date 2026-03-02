# ERC-1155 Game Items with Batch Mint

Complete ERC-1155 game items contract with per-item supply caps, batch minting, and role-based access. Uses OpenZeppelin v5.6.1.

## Dependencies

```bash
forge install OpenZeppelin/openzeppelin-contracts@v5.6.1
```

## Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Game items with per-ID supply caps, batch mint, and role-based minting
contract GameItems is ERC1155, ERC1155Supply, AccessControl, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 public constant SWORD = 0;
    uint256 public constant SHIELD = 1;
    uint256 public constant POTION = 2;
    uint256 public constant ARMOR = 3;
    uint256 public constant RING = 4;

    mapping(uint256 id => uint256 cap) public maxSupply;
    string public name;
    string public symbol;

    error ExceedsMaxSupply(uint256 id, uint256 requested, uint256 available);
    error ArrayLengthMismatch();

    constructor(address admin, string memory baseURI)
        ERC1155(baseURI)
    {
        name = "GameItems";
        symbol = "GITM";

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);

        maxSupply[SWORD] = 1_000;
        maxSupply[SHIELD] = 5_000;
        maxSupply[POTION] = 100_000;
        maxSupply[ARMOR] = 2_000;
        maxSupply[RING] = 500;
    }

    function mint(address to, uint256 id, uint256 amount)
        external
        onlyRole(MINTER_ROLE)
        nonReentrant
    {
        uint256 available = maxSupply[id] - totalSupply(id);
        if (amount > available) revert ExceedsMaxSupply(id, amount, available);
        _mint(to, id, amount, "");
    }

    function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts)
        external
        onlyRole(MINTER_ROLE)
        nonReentrant
    {
        if (ids.length != amounts.length) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < ids.length; i++) {
            uint256 available = maxSupply[ids[i]] - totalSupply(ids[i]);
            if (amounts[i] > available) revert ExceedsMaxSupply(ids[i], amounts[i], available);
        }

        _mintBatch(to, ids, amounts, "");
    }

    function setURI(string calldata newURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(newURI);
    }

    function setMaxSupply(uint256 id, uint256 cap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxSupply[id] = cap;
    }

    /// @notice contractURI for marketplace collection metadata
    function contractURI() external pure returns (string memory) {
        return "https://api.example.com/contract-metadata.json";
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override(ERC1155, ERC1155Supply)
    {
        super._update(from, to, ids, values);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
```

## Foundry Test

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GameItems} from "../src/GameItems.sol";

contract GameItemsTest is Test {
    GameItems items;
    address admin = makeAddr("admin");
    address player = makeAddr("player");

    function setUp() public {
        items = new GameItems(admin, "https://api.example.com/items/{id}.json");
    }

    function test_mint() public {
        vm.prank(admin);
        items.mint(player, items.SWORD(), 1);
        assertEq(items.balanceOf(player, items.SWORD()), 1);
        assertEq(items.totalSupply(items.SWORD()), 1);
    }

    function test_batchMint() public {
        uint256[] memory ids = new uint256[](3);
        ids[0] = items.SWORD();
        ids[1] = items.SHIELD();
        ids[2] = items.POTION();

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 1;
        amounts[1] = 2;
        amounts[2] = 10;

        vm.prank(admin);
        items.mintBatch(player, ids, amounts);

        assertEq(items.balanceOf(player, items.SWORD()), 1);
        assertEq(items.balanceOf(player, items.SHIELD()), 2);
        assertEq(items.balanceOf(player, items.POTION()), 10);
    }

    function test_revert_exceedsMaxSupply() public {
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(GameItems.ExceedsMaxSupply.selector, items.RING(), 501, 500)
        );
        items.mint(player, items.RING(), 501);
    }

    function test_revert_unauthorized() public {
        vm.prank(player);
        vm.expectRevert();
        items.mint(player, items.SWORD(), 1);
    }

    function test_balanceOfBatch() public {
        vm.prank(admin);
        items.mint(player, items.SWORD(), 3);

        address[] memory accounts = new address[](2);
        accounts[0] = player;
        accounts[1] = admin;

        uint256[] memory ids = new uint256[](2);
        ids[0] = items.SWORD();
        ids[1] = items.SWORD();

        uint256[] memory balances = items.balanceOfBatch(accounts, ids);
        assertEq(balances[0], 3);
        assertEq(balances[1], 0);
    }
}
```

## TypeScript Integration

```typescript
import { createPublicClient, http, getContract, type Address } from "viem";
import { mainnet } from "viem/chains";

const GAME_ITEMS_ADDRESS: Address = "0x...";

const gameItemsAbi = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOfBatch",
    inputs: [
      { name: "accounts", type: "address[]" },
      { name: "ids", type: "uint256[]" },
    ],
    outputs: [{ type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "uri",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
] as const;

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const contract = getContract({
  address: GAME_ITEMS_ADDRESS,
  abi: gameItemsAbi,
  client: publicClient,
});

async function getPlayerInventory(player: Address) {
  const ids = [0n, 1n, 2n, 3n, 4n];
  const accounts = ids.map(() => player);

  const balances = await contract.read.balanceOfBatch([accounts, ids]);

  const ITEM_NAMES = ["Sword", "Shield", "Potion", "Armor", "Ring"];
  return ids.map((id, i) => ({
    id,
    name: ITEM_NAMES[Number(id)],
    balance: balances[i],
  }));
}
```

## Notes

- `ERC1155Supply` tracks total supply per token ID. Override `_update` to combine ERC1155 and ERC1155Supply.
- `{id}` in the URI template is replaced client-side with hex token ID (64 chars, zero-padded, no 0x prefix).
- `name` and `symbol` are not part of the ERC-1155 standard but are exposed here for marketplace compatibility.
- `AccessControl` is used instead of `Ownable` for granular role management. The `MINTER_ROLE` can be granted to backend services or game servers.
- `ReentrancyGuard` is on both `mint` and `mintBatch` because ERC-1155 mint calls `onERC1155Received`/`onERC1155BatchReceived` on the receiver.
