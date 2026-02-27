# Config Tuning for Complex DeFi Protocols

Tuning Echidna's configuration for a lending protocol that requires long transaction sequences, multiple interacting users, and careful state setup. Demonstrates how config choices affect bug-finding effectiveness.

## The Protocol Under Test

A simplified lending vault where users deposit collateral, borrow against it, and face liquidation if undercollateralized.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract LendingVault {
    // 150% collateralization ratio in basis points
    uint256 public constant COLLATERAL_RATIO_BPS = 15000;
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;

    address public oracle;
    address public collateralToken;
    address public debtToken;

    struct Position {
        uint256 collateral;
        uint256 debt;
    }

    mapping(address => Position) public positions;
    uint256 public totalCollateral;
    uint256 public totalDebt;
    uint256 public price; // collateral price in debt token units, 18 decimals

    error InsufficientCollateral();
    error PositionHealthy();
    error ZeroAmount();
    error Unauthorized();

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Borrow(address indexed user, uint256 amount);
    event Repay(address indexed user, uint256 amount);
    event Liquidation(address indexed user, address indexed liquidator, uint256 debtRepaid);

    constructor(uint256 _initialPrice) {
        price = _initialPrice;
        oracle = msg.sender;
    }

    function setPrice(uint256 _price) external {
        if (msg.sender != oracle) revert Unauthorized();
        price = _price;
    }

    function deposit(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        positions[msg.sender].collateral += amount;
        totalCollateral += amount;
        emit Deposit(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        Position storage pos = positions[msg.sender];
        pos.collateral -= amount;
        totalCollateral -= amount;
        if (!_isHealthy(pos)) revert InsufficientCollateral();
        emit Withdraw(msg.sender, amount);
    }

    function borrow(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        Position storage pos = positions[msg.sender];
        pos.debt += amount;
        totalDebt += amount;
        if (!_isHealthy(pos)) revert InsufficientCollateral();
        emit Borrow(msg.sender, amount);
    }

    function repay(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        Position storage pos = positions[msg.sender];
        if (amount > pos.debt) amount = pos.debt;
        pos.debt -= amount;
        totalDebt -= amount;
        emit Repay(msg.sender, amount);
    }

    function liquidate(address user) external {
        Position storage pos = positions[user];
        if (_isHealthy(pos)) revert PositionHealthy();

        uint256 debtToRepay = pos.debt;
        uint256 collateralSeized = (debtToRepay * (BPS_DENOMINATOR + LIQUIDATION_BONUS_BPS)) / price;

        if (collateralSeized > pos.collateral) {
            collateralSeized = pos.collateral;
        }

        pos.debt = 0;
        pos.collateral -= collateralSeized;
        totalDebt -= debtToRepay;
        totalCollateral -= collateralSeized;

        positions[msg.sender].collateral += collateralSeized;
        totalCollateral += collateralSeized;

        emit Liquidation(user, msg.sender, debtToRepay);
    }

    function _isHealthy(Position storage pos) internal view returns (bool) {
        if (pos.debt == 0) return true;
        uint256 collateralValue = pos.collateral * price / 1e18;
        uint256 requiredCollateral = pos.debt * COLLATERAL_RATIO_BPS / BPS_DENOMINATOR;
        return collateralValue >= requiredCollateral;
    }
}
```

## Test Harness

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../src/LendingVault.sol";

contract LendingVaultTest is LendingVault {
    // Ghost variables for tracking
    uint256 internal _totalDeposited;
    uint256 internal _totalWithdrawn;

    constructor() LendingVault(1e18) {
        // Initial price: 1 collateral = 1 debt token
    }

    // --- Bounded helper functions ---

    function bounded_deposit(uint256 amount) public {
        if (amount == 0 || amount > 1e24) return;
        _totalDeposited += amount;
        deposit(amount);
    }

    function bounded_withdraw(uint256 amount) public {
        Position storage pos = positions[msg.sender];
        if (amount == 0 || amount > pos.collateral) return;
        try this.withdraw(amount) {
            _totalWithdrawn += amount;
        } catch {
            // Withdrawal failed due to health check — expected behavior
        }
    }

    function bounded_borrow(uint256 amount) public {
        if (amount == 0 || amount > 1e24) return;
        try this.borrow(amount) {} catch {}
    }

    function bounded_repay(uint256 amount) public {
        Position storage pos = positions[msg.sender];
        if (amount == 0 || amount > pos.debt) return;
        repay(amount);
    }

    function bounded_set_price(uint256 _price) public {
        // Simulate oracle price changes within realistic bounds
        // Price between 0.01 and 100 (in 18-decimal units)
        if (_price < 1e16 || _price > 1e20) return;
        price = _price;
    }

    function try_liquidate(address user) public {
        if (user == msg.sender) return;
        try this.liquidate(user) {} catch {}
    }

    // --- Solvency Properties ---

    // Total collateral tracked by vault matches sum of positions
    function echidna_total_collateral_correct() public view returns (bool) {
        uint256 sum = positions[address(0x10000)].collateral
            + positions[address(0x20000)].collateral
            + positions[address(0x30000)].collateral;
        return totalCollateral == sum;
    }

    // Total debt tracked by vault matches sum of positions
    function echidna_total_debt_correct() public view returns (bool) {
        uint256 sum = positions[address(0x10000)].debt
            + positions[address(0x20000)].debt
            + positions[address(0x30000)].debt;
        return totalDebt == sum;
    }

    // No position can have debt without collateral (after health check)
    function echidna_no_naked_debt() public view returns (bool) {
        address[3] memory users = [address(0x10000), address(0x20000), address(0x30000)];
        for (uint256 i = 0; i < users.length; i++) {
            Position storage pos = positions[users[i]];
            if (pos.debt > 0 && pos.collateral == 0) {
                return false;
            }
        }
        return true;
    }

    // Protocol is globally solvent: total collateral value >= total debt
    function echidna_protocol_solvent() public view returns (bool) {
        if (totalDebt == 0) return true;
        uint256 totalCollateralValue = totalCollateral * price / 1e18;
        return totalCollateralValue >= totalDebt;
    }
}
```

## Configuration Progressions

### Level 1: Quick Check (CI pipeline, < 2 minutes)

```yaml
# echidna-quick.yaml
testLimit: 10000
seqLen: 20
shrinkLimit: 1000
testMode: "property"
deployer: "0x30000"
sender: ["0x10000", "0x20000"]
workers: 2
```

Good for: Catching obvious bugs on every PR. Fast feedback loop.

```bash
echidna test/LendingVaultTest.sol --contract LendingVaultTest --config echidna-quick.yaml
```

### Level 2: Standard Campaign (Development, 10-30 minutes)

```yaml
# echidna-standard.yaml
testLimit: 100000
seqLen: 100
shrinkLimit: 5000
testMode: "property"
deployer: "0x30000"
sender: ["0x10000", "0x20000", "0x30000"]
corpusDir: "corpus-lending"
workers: 4

# Give senders enough balance to interact
balanceAddr: 0xffffffffffffffffffffffff
balanceContract: 0xffffffffffffffffffffffff
```

Good for: Daily runs during active development. Corpus accumulates over time.

```bash
echidna test/LendingVaultTest.sol --contract LendingVaultTest --config echidna-standard.yaml
```

### Level 3: Deep Campaign (Pre-audit, hours to overnight)

```yaml
# echidna-deep.yaml
testLimit: 5000000
seqLen: 300
shrinkLimit: 10000
testMode: "property"
deployer: "0x30000"
sender: ["0x10000", "0x20000", "0x30000"]
corpusDir: "corpus-lending-deep"
workers: 8

# Long sequences need more time per test
testTimeout: 600

balanceAddr: 0xffffffffffffffffffffffff
balanceContract: 0xffffffffffffffffffffffff

# Save coverage data for analysis
coverage: true
```

Good for: Pre-audit campaigns. Run overnight or over a weekend.

```bash
echidna test/LendingVaultTest.sol --contract LendingVaultTest --config echidna-deep.yaml
```

### Level 4: Targeted Property Hunt

When you suspect a specific bug class (e.g., liquidation edge cases), narrow the search:

```yaml
# echidna-liquidation.yaml
testLimit: 500000
seqLen: 50
shrinkLimit: 10000
testMode: "property"

# Three senders: depositor, borrower, liquidator
deployer: "0x40000"
sender: ["0x10000", "0x20000", "0x30000"]

corpusDir: "corpus-liquidation"
workers: 4

# Provide a dictionary with interesting price values
dictionary: "dict-prices.txt"
```

Dictionary for price edge cases:

```
# dict-prices.txt
0x0000000000000000000000000000000000000000000000000DE0B6B3A7640000
0x0000000000000000000000000000000000000000000000000000000000000001
0x00000000000000000000000000000000000000000000003635C9ADC5DEA00000
0x000000000000000000000000000000000000000000000000002386F26FC10000
```

## Running and Interpreting Results

```bash
# Run the standard campaign
echidna test/LendingVaultTest.sol --contract LendingVaultTest --config echidna-standard.yaml
```

### Passing Output

```
echidna_total_collateral_correct: passing
echidna_total_debt_correct: passing
echidna_no_naked_debt: passing
echidna_protocol_solvent: passing

Unique instructions: 312
Corpus size: 47
Seed: 1234567890
```

### Failing Output

```
echidna_protocol_solvent: failed!
  Call sequence:
    bounded_deposit(1000000000000000000)
    bounded_borrow(600000000000000000)
    bounded_set_price(10000000000000000)
    try_liquidate(0x10000)

  Shrunk 23/50 times
```

This sequence shows: deposit 1e18 collateral, borrow 0.6e18, price drops to 0.01, liquidation occurs but protocol becomes insolvent due to the liquidation bonus exceeding remaining collateral.

## When to Increase Each Parameter

| Symptom | Parameter | Change |
|---------|-----------|--------|
| Properties pass too easily | `seqLen` | Increase to 200+ for complex protocols |
| Missing multi-step bugs | `testLimit` | Increase to 500k+ |
| Failing sequences are too long | `shrinkLimit` | Increase to 10,000+ |
| Slow convergence | `workers` | Match CPU core count |
| Fuzzer stuck on same paths | `dictionary` | Add protocol-specific values |
| Tests timeout | `testTimeout` | Increase to 600+ seconds |

## Key Takeaways

1. **Start fast, go deep** — use quick configs for CI, deep configs for pre-audit. The corpus from quick runs seeds deeper campaigns.
2. **Bound inputs in the harness, not the config** — Echidna cannot be told "only generate amounts < 1e24." Use wrapper functions that skip invalid inputs.
3. **Three senders for lending protocols** — depositor, borrower, and liquidator need to be separate addresses to test multi-user interactions.
4. **Dictionary files accelerate convergence** — provide protocol-specific constants (price bounds, ratio thresholds, common amounts) to guide the fuzzer toward interesting state.
5. **Corpus is cumulative** — save `corpusDir` between runs. Each campaign builds on the last.

Last verified: February 2026
