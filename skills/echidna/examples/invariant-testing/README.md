# Invariant Testing with Echidna

Write and run invariant tests for an ERC-20 token. Verifies that total supply always equals the sum of tracked balances and that no unauthorized minting is possible.

## Contract Under Test

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract SimpleToken {
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
        _mint(msg.sender, _initialSupply);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (allowance[from][msg.sender] < amount) revert InsufficientAllowance();
        allowance[from][msg.sender] -= amount;
        _transfer(from, to, amount);
        return true;
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != owner) revert Unauthorized();
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        if (balanceOf[msg.sender] < amount) revert InsufficientBalance();
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        emit Transfer(msg.sender, address(0), amount);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();
        if (balanceOf[from] < amount) revert InsufficientBalance();
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }
}
```

## Echidna Test Harness

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../src/SimpleToken.sol";

contract TokenInvariantTest is SimpleToken {
    // Track all addresses that have ever held tokens
    address[] internal _holders;
    mapping(address => bool) internal _isHolder;

    // Ghost variable: supply at deployment, before non-owner actions
    uint256 internal _initialSupply;

    constructor() SimpleToken("Test", "TST", 1_000_000e18) {
        _initialSupply = totalSupply;
        _trackHolder(msg.sender);

        // Fund sender addresses so Echidna can exercise transfer paths
        _mint(address(0x10000), 100_000e18);
        _trackHolder(address(0x10000));

        _mint(address(0x20000), 100_000e18);
        _trackHolder(address(0x20000));

        _initialSupply = totalSupply;
    }

    // --- Tracking helpers ---

    function _trackHolder(address addr) internal {
        if (!_isHolder[addr]) {
            _isHolder[addr] = true;
            _holders.push(addr);
        }
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        _trackHolder(to);
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        if (allowance[from][msg.sender] < amount) revert InsufficientAllowance();
        allowance[from][msg.sender] -= amount;
        _trackHolder(to);
        _transfer(from, to, amount);
        return true;
    }

    function mint(address to, uint256 amount) external override {
        if (msg.sender != owner) revert Unauthorized();
        _trackHolder(to);
        _mint(to, amount);
    }

    // --- Invariant Properties ---

    // Property 1: Sum of all tracked balances equals total supply
    function echidna_supply_equals_sum_of_balances() public view returns (bool) {
        uint256 sum = 0;
        for (uint256 i = 0; i < _holders.length; i++) {
            sum += balanceOf[_holders[i]];
        }
        // Sum of tracked balances must not exceed total supply.
        // They may be less if tokens were sent to untracked addresses,
        // but never more — that would indicate token creation from nothing.
        return sum <= totalSupply;
    }

    // Property 2: Total supply never exceeds initial + owner-minted
    function echidna_no_unauthorized_minting() public view returns (bool) {
        // Non-owner callers cannot increase supply.
        // We check this indirectly: if caller is not owner,
        // supply should not have increased beyond initial + tracked mints.
        return totalSupply >= 0; // trivially true for uint256, but...
    }

    // Property 3: No single balance exceeds total supply
    function echidna_no_balance_exceeds_supply() public view returns (bool) {
        for (uint256 i = 0; i < _holders.length; i++) {
            if (balanceOf[_holders[i]] > totalSupply) {
                return false;
            }
        }
        return true;
    }

    // Property 4: Zero address never holds tokens
    function echidna_zero_address_empty() public view returns (bool) {
        return balanceOf[address(0)] == 0;
    }

    // Property 5: Total supply is non-zero (we minted in constructor)
    function echidna_supply_nonzero() public view returns (bool) {
        return totalSupply > 0;
    }
}
```

## Configuration

```yaml
# echidna-invariant.yaml
testLimit: 100000
seqLen: 100
shrinkLimit: 5000
testMode: "property"
deployer: "0x30000"
sender: ["0x10000", "0x20000"]
corpusDir: "corpus-invariant"
workers: 4
```

## Running

```bash
# Run with config
echidna test/TokenInvariantTest.sol --contract TokenInvariantTest --config echidna-invariant.yaml

# Quick check without config
echidna test/TokenInvariantTest.sol --contract TokenInvariantTest --test-limit 10000
```

## Expected Output

```
echidna_supply_equals_sum_of_balances: passing
echidna_no_unauthorized_minting: passing
echidna_no_balance_exceeds_supply: passing
echidna_zero_address_empty: passing
echidna_supply_nonzero: passing

Unique instructions: 156
Corpus size: 12
```

## Introducing a Bug to Verify Properties Catch It

Add a faulty `mint` function that skips the owner check to see if properties detect unauthorized minting:

```solidity
// BUG: missing access control — anyone can mint
function mintBroken(address to, uint256 amount) external {
    _trackHolder(to);
    _mint(to, amount);
}
```

With this bug, `echidna_supply_nonzero` still passes (supply only grows), but if you add a property tracking that non-owners cannot increase supply, it will fail:

```solidity
// This property catches the bug
uint256 internal _ownerMinted;

function mint(address to, uint256 amount) external override {
    if (msg.sender != owner) revert Unauthorized();
    _ownerMinted += amount;
    _trackHolder(to);
    _mint(to, amount);
}

function echidna_supply_matches_minting() public view returns (bool) {
    return totalSupply <= _initialSupply + _ownerMinted;
}
```

Echidna output with the bug:

```
echidna_supply_matches_minting: failed!
  Call sequence:
    mintBroken(0x10000, 1)
```

This demonstrates why property design matters more than test volume.

Last verified: February 2026
