# Invariant (Stateful Fuzz) Testing

Invariant testing is stateful: Foundry calls random functions in random order over many sequences, then checks that invariants hold after every call. This finds bugs that single-input fuzz tests cannot.

## Handler Contract Pattern

Never target the protocol contract directly. Write a handler that wraps calls with proper setup (bounding, pranking, tracking).

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Vault} from "../src/Vault.sol";

contract VaultHandler is Test {
    Vault public vault;

    // Ghost variables — track expected state outside the contract
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;
    uint256 public depositCount;

    address[] public actors;

    constructor(Vault _vault) {
        vault = _vault;
        actors.push(makeAddr("actor0"));
        actors.push(makeAddr("actor1"));
        actors.push(makeAddr("actor2"));
    }

    function deposit(uint256 actorSeed, uint256 amount) public {
        address actor = actors[bound(actorSeed, 0, actors.length - 1)];
        amount = bound(amount, 0.01 ether, 10 ether);

        vm.deal(actor, amount);
        vm.prank(actor);
        vault.deposit{value: amount}();

        totalDeposited += amount;
        depositCount++;
    }

    function withdraw(uint256 actorSeed, uint256 amount) public {
        address actor = actors[bound(actorSeed, 0, actors.length - 1)];
        uint256 balance = vault.balanceOf(actor);

        if (balance == 0) return; // skip if nothing to withdraw

        amount = bound(amount, 1, balance);

        vm.prank(actor);
        vault.withdraw(amount);

        totalWithdrawn += amount;
    }
}
```

## Invariant Test Contract

```solidity
contract VaultInvariantTest is Test {
    Vault vault;
    VaultHandler handler;

    function setUp() public {
        vault = new Vault();
        handler = new VaultHandler(vault);

        // CRITICAL: only call functions on the handler, not the vault directly
        targetContract(address(handler));
    }

    // Invariant: ETH in contract == total deposited - total withdrawn
    function invariant_solvency() public view {
        assertEq(
            address(vault).balance,
            handler.totalDeposited() - handler.totalWithdrawn()
        );
    }

    // Invariant: contract should never hold negative balance (trivially true, but demonstrates the pattern)
    function invariant_nonNegativeBalance() public view {
        assertGe(address(vault).balance, 0);
    }

    // Call summary — printed after invariant run completes
    function invariant_callSummary() public view {
        console.log("Total deposits:", handler.depositCount());
        console.log("Total deposited:", handler.totalDeposited());
        console.log("Total withdrawn:", handler.totalWithdrawn());
    }
}
```

Run:

```bash
forge test --match-contract VaultInvariantTest -vv
```

## targetContract / targetSelector

Control which contracts and functions Foundry calls:

```solidity
function setUp() public {
    vault = new Vault();
    handler = new VaultHandler(vault);

    // Only call the handler
    targetContract(address(handler));

    // Optionally restrict to specific functions
    bytes4[] memory selectors = new bytes4[](2);
    selectors[0] = VaultHandler.deposit.selector;
    selectors[1] = VaultHandler.withdraw.selector;

    targetSelector(FuzzSelector({
        addr: address(handler),
        selectors: selectors
    }));
}
```

Exclude specific senders:

```solidity
function setUp() public {
    // ...
    // Exclude addresses that would break tests (e.g., precompiles)
    excludeSender(address(0));
    excludeSender(address(vault));
}
```

## Ghost Variables for State Tracking

Ghost variables track what the protocol state SHOULD be, separate from the actual contract state. The invariant asserts they match.

```solidity
contract ERC20Handler is Test {
    ERC20Token token;

    // Ghost variables
    mapping(address => uint256) public ghost_balances;
    uint256 public ghost_totalSupply;
    uint256 public ghost_totalTransfers;

    function mint(uint256 toSeed, uint256 amount) public {
        address to = _getActor(toSeed);
        amount = bound(amount, 1, 1_000_000e18);

        token.mint(to, amount);

        ghost_balances[to] += amount;
        ghost_totalSupply += amount;
    }

    function transfer(uint256 fromSeed, uint256 toSeed, uint256 amount) public {
        address from = _getActor(fromSeed);
        address to = _getActor(toSeed);

        uint256 balance = token.balanceOf(from);
        if (balance == 0) return;

        amount = bound(amount, 1, balance);

        vm.prank(from);
        token.transfer(to, amount);

        ghost_balances[from] -= amount;
        ghost_balances[to] += amount;
        ghost_totalTransfers++;
    }

    function _getActor(uint256 seed) internal view returns (address) {
        // ...
    }
}
```

## Invariant Assertions

```solidity
// Supply invariant: actual matches ghost
function invariant_totalSupply() public view {
    assertEq(token.totalSupply(), handler.ghost_totalSupply());
}

// Balance invariant: each actor's balance matches ghost
function invariant_balancesMatch() public view {
    address[] memory actors = handler.getActors();
    for (uint256 i = 0; i < actors.length; i++) {
        assertEq(
            token.balanceOf(actors[i]),
            handler.ghost_balances(actors[i])
        );
    }
}

// Conservation invariant: sum of all balances == totalSupply
function invariant_balanceSumEqualsTotalSupply() public view {
    uint256 sum;
    address[] memory actors = handler.getActors();
    for (uint256 i = 0; i < actors.length; i++) {
        sum += token.balanceOf(actors[i]);
    }
    assertEq(sum, token.totalSupply());
}
```

## Configuring Depth and Runs

In `foundry.toml`:

```toml
[invariant]
runs = 256             # Number of random call sequences
depth = 15             # Calls per sequence
fail_on_revert = false # true = treat handler reverts as failures
call_override = false  # true = allow overriding msg.sender per call
```

```bash
# Override from CLI for longer CI runs
forge test --match-contract VaultInvariantTest \
  -vv \
  --invariant-runs 1000 \
  --invariant-depth 50
```

## Common Invariant Patterns

### Solvency (DeFi vaults, lending)

```solidity
// Total assets >= total liabilities
function invariant_solvent() public view {
    assertGe(vault.totalAssets(), vault.totalDebt());
}
```

### Monotonic counters (IDs, nonces)

```solidity
// Nonce only goes up
function invariant_nonceMonotonic() public view {
    assertGe(contract.nonce(), handler.lastSeenNonce());
}
```

### Conservation (token transfers)

```solidity
// No tokens created or destroyed during transfers
function invariant_conservation() public view {
    assertEq(token.totalSupply(), INITIAL_SUPPLY);
}
```

### Access control

```solidity
// Owner never changes unless through authorized path
function invariant_ownerUnchanged() public view {
    if (!handler.ownershipTransferred()) {
        assertEq(vault.owner(), ORIGINAL_OWNER);
    }
}
```

### Ordering (queues, sorted lists)

```solidity
// Queue head is always the oldest entry
function invariant_fifoOrder() public view {
    if (queue.size() > 1) {
        assertLe(queue.peekTimestamp(0), queue.peekTimestamp(1));
    }
}
```

## References

- [Foundry Book — Invariant Testing](https://book.getfoundry.sh/forge/invariant-testing)
- [Foundry Book — Invariant Configuration](https://book.getfoundry.sh/reference/config/testing#invariant)
- [a]symmetry Labs — Foundry Invariant Testing Tutorial](https://mirror.xyz/horsefacts.eth/Jex2YVaO65dda6zEyfM_-DXlXhOWCAoSpOx5PLocYgw)
