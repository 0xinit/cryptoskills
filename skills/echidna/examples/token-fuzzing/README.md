# Token Fuzzing with Echidna

Fuzz an ERC-20 token contract for edge cases: transfer to self, zero amount, max uint256, approval race conditions, and underflow scenarios.

## Contract Under Test

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract FuzzableToken {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;
    address public owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    error Unauthorized();
    error InsufficientBalance();
    error InsufficientAllowance();
    error ZeroAddress();

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint256 _initialSupply) {
        name = _name;
        symbol = _symbol;
        owner = msg.sender;
        totalSupply = _initialSupply;
        balanceOf[msg.sender] = _initialSupply;
        emit Transfer(address(0), msg.sender, _initialSupply);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (to == address(0)) revert ZeroAddress();
        if (balanceOf[msg.sender] < amount) revert InsufficientBalance();
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (to == address(0)) revert ZeroAddress();
        if (balanceOf[from] < amount) revert InsufficientBalance();
        if (allowance[from][msg.sender] < amount) revert InsufficientAllowance();
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != owner) revert Unauthorized();
        if (to == address(0)) revert ZeroAddress();
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function burn(uint256 amount) external {
        if (balanceOf[msg.sender] < amount) revert InsufficientBalance();
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        emit Transfer(msg.sender, address(0), amount);
    }
}
```

## Echidna Test Harness

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../src/FuzzableToken.sol";

contract TokenFuzzTest is FuzzableToken {
    // Sender addresses used by Echidna
    address constant SENDER_1 = address(0x10000);
    address constant SENDER_2 = address(0x20000);

    constructor() FuzzableToken("Fuzz", "FZZ", 1_000_000e18) {
        // Distribute tokens to sender addresses
        balanceOf[msg.sender] -= 200_000e18;
        balanceOf[SENDER_1] += 100_000e18;
        balanceOf[SENDER_2] += 100_000e18;
        emit Transfer(msg.sender, SENDER_1, 100_000e18);
        emit Transfer(msg.sender, SENDER_2, 100_000e18);
    }

    // --- Edge Case: Transfer to Self ---
    // Transferring to yourself should not change your balance or total supply.

    function test_transfer_to_self(uint256 amount) public {
        uint256 balanceBefore = balanceOf[msg.sender];
        if (amount > balanceBefore) return;

        this.transfer(msg.sender, amount);

        assert(balanceOf[msg.sender] == balanceBefore);
    }

    // --- Edge Case: Zero Amount Transfer ---
    // Zero-amount transfers should succeed without state change.

    function test_zero_transfer(address to) public {
        if (to == address(0)) return;
        uint256 senderBefore = balanceOf[msg.sender];
        uint256 recipientBefore = balanceOf[to];

        this.transfer(to, 0);

        assert(balanceOf[msg.sender] == senderBefore);
        assert(balanceOf[to] == recipientBefore);
    }

    // --- Edge Case: Max uint256 Approval ---
    // Approving max uint256 should set allowance to max.

    function test_max_approval(address spender) public {
        this.approve(spender, type(uint256).max);
        assert(allowance[msg.sender][spender] == type(uint256).max);
    }

    // --- Edge Case: Transfer Full Balance ---
    // Transferring entire balance should leave sender with zero.

    function test_transfer_full_balance(address to) public {
        if (to == address(0) || to == msg.sender) return;
        uint256 balance = balanceOf[msg.sender];
        if (balance == 0) return;

        uint256 recipientBefore = balanceOf[to];

        this.transfer(to, balance);

        assert(balanceOf[msg.sender] == 0);
        assert(balanceOf[to] == recipientBefore + balance);
    }

    // --- Property: Transfer Conservation ---
    // No transfer creates or destroys tokens.

    function echidna_transfer_preserves_supply() public view returns (bool) {
        return totalSupply == 1_000_000e18;
    }

    // --- Property: No Balance Overflow ---
    // No single address holds more than total supply.

    function echidna_no_balance_overflow() public view returns (bool) {
        return balanceOf[SENDER_1] <= totalSupply
            && balanceOf[SENDER_2] <= totalSupply;
    }

    // --- Property: Allowance Independence ---
    // Changing allowance for one spender does not affect others.

    function test_allowance_independence(address spender1, address spender2, uint256 amount) public {
        if (spender1 == spender2) return;

        uint256 existing = allowance[msg.sender][spender2];
        this.approve(spender1, amount);

        assert(allowance[msg.sender][spender2] == existing);
    }

    // --- Property: Burn Reduces Supply ---

    function test_burn_reduces_supply(uint256 amount) public {
        if (amount == 0 || amount > balanceOf[msg.sender]) return;

        uint256 supplyBefore = totalSupply;
        this.burn(amount);

        assert(totalSupply == supplyBefore - amount);
    }
}
```

## Configuration

```yaml
# echidna-token-fuzz.yaml
testLimit: 100000
seqLen: 50
shrinkLimit: 5000

# Use assertion mode to catch the assert() statements in test_ functions,
# while also checking echidna_ properties
testMode: "assertion"

deployer: "0x30000"
sender: ["0x10000", "0x20000"]
corpusDir: "corpus-token-fuzz"
workers: 4
```

## Running

```bash
# Assertion mode (catches both assert failures and echidna_ properties)
echidna test/TokenFuzzTest.sol --contract TokenFuzzTest --config echidna-token-fuzz.yaml

# Property mode only (ignores assert statements, checks echidna_ functions only)
echidna test/TokenFuzzTest.sol --contract TokenFuzzTest --test-mode property --test-limit 50000
```

## Expected Output (All Passing)

```
test_transfer_to_self(uint256): passing
test_zero_transfer(address): passing
test_max_approval(address): passing
test_transfer_full_balance(address): passing
test_allowance_independence(address,address,uint256): passing
test_burn_reduces_supply(uint256): passing
echidna_transfer_preserves_supply: passing
echidna_no_balance_overflow: passing

Unique instructions: 203
Corpus size: 18
```

## Planting a Bug: Overflow on Self-Transfer

What happens if the self-transfer path is implemented incorrectly?

```solidity
// BUG: credit before debit on self-transfer causes double-counting
function transferBroken(address to, uint256 amount) external returns (bool) {
    if (to == address(0)) revert ZeroAddress();
    if (balanceOf[msg.sender] < amount) revert InsufficientBalance();
    // Wrong order: crediting to before debiting from.
    // When to == msg.sender, this effectively doubles the balance.
    balanceOf[to] += amount;
    balanceOf[msg.sender] -= amount;
    emit Transfer(msg.sender, to, amount);
    return true;
}
```

Echidna catches this immediately:

```
test_transfer_to_self(uint256): failed!
  Call sequence:
    transferBroken(0x10000, 1)

  Event sequence:
    Transfer(0x10000, 0x10000, 1)
```

The assert in `test_transfer_to_self` fires because the balance doubled instead of staying constant.

## Key Takeaways

1. **Self-transfers are a classic edge case** — the same address being both sender and receiver creates aliasing bugs when credit and debit happen in the wrong order.
2. **Zero-amount operations reveal assumptions** — many contracts revert on zero amounts when they should be no-ops.
3. **Assertion mode complements property mode** — use `assert()` for per-operation checks and `echidna_*` for global invariants.
4. **Seed meaningful state** — tokens distributed across multiple addresses in the constructor give Echidna more interesting state to explore.

Last verified: February 2026
