# Invariant Testing with Handler Contracts

Invariant tests are stateful: Foundry calls random functions in random order, then checks that properties ("invariants") still hold. The handler pattern wraps target contracts with bounded inputs and ghost variables, making invariant tests effective and debuggable.

## Handler Contract Pattern

The handler sits between the fuzzer and your target contract. It constrains inputs to valid ranges, selects actors, and tracks ghost variables for assertions.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC4626Vault} from "../src/ERC4626Vault.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

contract VaultHandler is Test {
    ERC4626Vault vault;
    IERC20 asset;
    address[] public actors;

    // Ghost variables: track cumulative state the contract doesn't expose
    uint256 public ghost_totalDeposited;
    uint256 public ghost_totalWithdrawn;
    uint256 public ghost_totalSharesMinted;
    uint256 public ghost_totalSharesBurned;

    mapping(address => uint256) public ghost_userDeposits;

    constructor(ERC4626Vault _vault, IERC20 _asset) {
        vault = _vault;
        asset = _asset;
        for (uint256 i; i < 5; i++) {
            actors.push(makeAddr(string(abi.encodePacked("actor", i))));
        }
    }

    modifier useActor(uint256 seed) {
        address actor = actors[bound(seed, 0, actors.length - 1)];
        vm.startPrank(actor);
        _;
        vm.stopPrank();
    }

    function deposit(uint256 actorSeed, uint256 amount) public useActor(actorSeed) {
        amount = bound(amount, 1e6, 100_000e18);

        deal(address(asset), msg.sender, amount);
        asset.approve(address(vault), amount);

        uint256 shares = vault.deposit(amount, msg.sender);

        ghost_totalDeposited += amount;
        ghost_totalSharesMinted += shares;
        ghost_userDeposits[msg.sender] += amount;
    }

    function withdraw(uint256 actorSeed, uint256 amount) public useActor(actorSeed) {
        uint256 maxAssets = vault.maxWithdraw(msg.sender);
        if (maxAssets == 0) return;
        amount = bound(amount, 1, maxAssets);

        uint256 shares = vault.withdraw(amount, msg.sender, msg.sender);

        ghost_totalWithdrawn += amount;
        ghost_totalSharesBurned += shares;
    }

    function redeem(uint256 actorSeed, uint256 shares) public useActor(actorSeed) {
        uint256 maxShares = vault.maxRedeem(msg.sender);
        if (maxShares == 0) return;
        shares = bound(shares, 1, maxShares);

        uint256 assets = vault.redeem(shares, msg.sender, msg.sender);

        ghost_totalWithdrawn += assets;
        ghost_totalSharesBurned += shares;
    }
}
```

## Ghost Variables for State Tracking

Ghost variables track cumulative values the contract does not expose. They enable invariant assertions about relationships between deposits, withdrawals, shares, and balances.

Key rules:
- Update ghost variables inside handler functions, after the external call succeeds
- If a handler function early-returns (e.g., `if (max == 0) return`), do NOT update ghost variables
- Use `public` visibility so the invariant test contract can read them

## `targetContract` / `targetSelector` Configuration

By default Foundry calls random functions on all deployed contracts. Use `targetContract` and `targetSelector` to focus the fuzzer on your handler.

```solidity
contract VaultInvariantTest is StdInvariant, Test {
    ERC4626Vault vault;
    VaultHandler handler;
    IERC20 asset;

    function setUp() public {
        asset = IERC20(address(new MockERC20("Asset", "AST", 18)));
        vault = new ERC4626Vault(asset);
        handler = new VaultHandler(vault, asset);

        // Only call functions on the handler, not directly on vault/asset
        targetContract(address(handler));

        // Optional: restrict to specific functions
        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = VaultHandler.deposit.selector;
        selectors[1] = VaultHandler.withdraw.selector;
        selectors[2] = VaultHandler.redeem.selector;

        targetSelector(
            FuzzSelector({addr: address(handler), selectors: selectors})
        );
    }
}
```

## `invariant_` Function Naming

Any function starting with `invariant_` is checked after every call sequence. These must be `public` or `external` and should be `view` when possible.

```solidity
function invariant_totalAssetsMatchesBalance() public view {
    assertEq(
        vault.totalAssets(),
        asset.balanceOf(address(vault)),
        "totalAssets must equal actual token balance"
    );
}

function invariant_sharesAccountingIsConsistent() public view {
    assertEq(
        handler.ghost_totalSharesMinted() - handler.ghost_totalSharesBurned(),
        vault.totalSupply(),
        "minted - burned must equal total supply"
    );
}

function invariant_solvency() public view {
    uint256 netDeposits = handler.ghost_totalDeposited() - handler.ghost_totalWithdrawn();
    assertGe(
        asset.balanceOf(address(vault)),
        netDeposits,
        "vault must hold at least net deposits"
    );
}
```

## Multi-Handler Setup

For protocols with multiple entry points (e.g., a lending pool with separate deposit/borrow paths), use multiple handlers. Each handler wraps a different interaction surface.

```solidity
contract LendingInvariantTest is StdInvariant, Test {
    LendingPool pool;
    DepositHandler depositHandler;
    BorrowHandler borrowHandler;
    LiquidationHandler liquidationHandler;

    function setUp() public {
        pool = new LendingPool();

        depositHandler = new DepositHandler(pool);
        borrowHandler = new BorrowHandler(pool);
        liquidationHandler = new LiquidationHandler(pool);

        targetContract(address(depositHandler));
        targetContract(address(borrowHandler));
        targetContract(address(liquidationHandler));
    }

    function invariant_totalBorrowsNeverExceedDeposits() public view {
        uint256 totalDeposited = depositHandler.ghost_totalDeposited()
            - depositHandler.ghost_totalWithdrawn();
        uint256 totalBorrowed = borrowHandler.ghost_totalBorrowed()
            - borrowHandler.ghost_totalRepaid()
            - liquidationHandler.ghost_totalLiquidated();

        assertGe(totalDeposited, totalBorrowed);
    }
}
```

## Common Invariant Patterns

### Sum of Balances == Total Supply

The most fundamental ERC20 invariant. Individual balances must sum to `totalSupply()`.

```solidity
function invariant_balancesSumToTotalSupply() public view {
    uint256 sum;
    address[] memory knownHolders = handler.getActors();
    for (uint256 i; i < knownHolders.length; i++) {
        sum += token.balanceOf(knownHolders[i]);
    }
    // Add any known non-actor holders (treasury, pool, etc.)
    sum += token.balanceOf(address(vault));

    assertEq(sum, token.totalSupply());
}
```

### Monotonic Counters

Values that should only increase (nonces, cumulative fees, epoch numbers).

```solidity
uint256 lastNonce;

function invariant_nonceOnlyIncreases() public {
    uint256 currentNonce = protocol.globalNonce();
    assertGe(currentNonce, lastNonce, "nonce must never decrease");
    lastNonce = currentNonce;
}
```

### State Machine Transitions

Valid state transitions: e.g., a loan can go Pending -> Active -> Repaid, but never Repaid -> Active.

```solidity
function invariant_noInvalidStateTransitions() public view {
    for (uint256 i; i < handler.getLoanCount(); i++) {
        uint8 state = uint8(protocol.loanState(i));
        uint8 prevState = uint8(handler.ghost_previousState(i));

        if (prevState == uint8(LoanState.Repaid)) {
            assertEq(state, uint8(LoanState.Repaid), "repaid loan cannot change state");
        }
        if (prevState == uint8(LoanState.Liquidated)) {
            assertEq(state, uint8(LoanState.Liquidated), "liquidated loan cannot change state");
        }
    }
}
```

### No Unreachable States

The protocol should never be in a state where all actions revert. At least one handler function should succeed.

```solidity
function invariant_notStuck() public view {
    // If there are deposits, withdrawals should be possible
    if (vault.totalAssets() > 0) {
        bool someoneCanWithdraw;
        address[] memory actors_ = handler.getActors();
        for (uint256 i; i < actors_.length; i++) {
            if (vault.maxWithdraw(actors_[i]) > 0) {
                someoneCanWithdraw = true;
                break;
            }
        }
        assertTrue(someoneCanWithdraw, "assets locked -- nobody can withdraw");
    }
}
```

## Invariant Configuration

```toml
# foundry.toml

[invariant]
runs = 256              # number of call sequences
depth = 50              # calls per sequence
fail_on_revert = false  # false = skip reverting calls, true = fail on any revert
shrink_run_limit = 5000 # attempts to minimize failing sequence
```

## References

- [Foundry Book - Invariant Testing](https://book.getfoundry.sh/forge/invariant-testing)
- [Trail of Bits - Building Secure Contracts](https://secure-contracts.com/)
- [a]16z - Invariant Testing Guide](https://a16zcrypto.com/posts/article/how-to-create-invariant-tests-for-defi-protocols/)
