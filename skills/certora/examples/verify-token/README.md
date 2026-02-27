# Verify an ERC-20 Token with Certora

Complete CVL specification for an ERC-20 token verifying transfer correctness, total supply conservation, allowance behavior, and zero-address safety.

## Contract Under Verification

Standard OpenZeppelin ERC-20. Create `src/Token.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    constructor(uint256 initialSupply) ERC20("Token", "TKN") {
        _mint(msg.sender, initialSupply);
    }
}
```

## Directory Layout

```
project/
├── src/Token.sol
├── specs/Token.spec
├── certora/Token.conf
└── package.json
```

## Specification (specs/Token.spec)

```cvl
// ============================================================================
// Methods Block
// ============================================================================

methods {
    function totalSupply() external returns (uint256) envfree;
    function balanceOf(address) external returns (uint256) envfree;
    function allowance(address, address) external returns (uint256) envfree;
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
}

// ============================================================================
// Ghost Variables
// ============================================================================

ghost mathint sumOfBalances {
    init_state axiom sumOfBalances == 0;
}

hook Sstore _balances[KEY address user] uint256 newBal (uint256 oldBal) {
    sumOfBalances = sumOfBalances + newBal - oldBal;
}

hook Sload uint256 val _balances[KEY address user] {
    require to_mathint(val) <= sumOfBalances;
}

// ============================================================================
// Invariants
// ============================================================================

/// Total supply always equals sum of all individual balances
invariant totalSupplyEqualsSumOfBalances()
    to_mathint(totalSupply()) == sumOfBalances
    {
        preserved with (env e) {
            requireInvariant totalSupplyEqualsSumOfBalances();
        }
    }

// ============================================================================
// Transfer Rules
// ============================================================================

/// Transfer moves exact amount from sender to recipient
rule transferMovesExactAmount(address to, uint256 amount) {
    env e;
    require e.msg.sender != to;

    mathint balSenderBefore = balanceOf(e.msg.sender);
    mathint balRecipientBefore = balanceOf(to);

    transfer(e, to, amount);

    assert balanceOf(e.msg.sender) == balSenderBefore - amount,
        "sender balance must decrease by exact amount";
    assert balanceOf(to) == balRecipientBefore + amount,
        "recipient balance must increase by exact amount";
}

/// Self-transfer does not change balance
rule selfTransferNoChange(uint256 amount) {
    env e;

    uint256 balBefore = balanceOf(e.msg.sender);

    transfer(e, e.msg.sender, amount);

    assert balanceOf(e.msg.sender) == balBefore,
        "self-transfer must not change balance";
}

/// Transfer preserves total supply
rule transferPreservesTotalSupply(address to, uint256 amount) {
    env e;

    uint256 supplyBefore = totalSupply();

    transfer(e, to, amount);

    assert totalSupply() == supplyBefore,
        "transfer must not change total supply";
}

/// Transfer reverts on insufficient balance
rule transferRevertsOnInsufficientBalance(address to, uint256 amount) {
    env e;

    require balanceOf(e.msg.sender) < amount;
    require to != 0;

    transfer@withrevert(e, to, amount);

    assert lastReverted,
        "must revert when sender has insufficient balance";
}

/// Transfer to zero address reverts
rule transferToZeroReverts(uint256 amount) {
    env e;

    transfer@withrevert(e, 0, amount);

    assert lastReverted,
        "transfer to zero address must revert";
}

// ============================================================================
// TransferFrom Rules
// ============================================================================

/// TransferFrom spends allowance
rule transferFromSpendsAllowance(address from, address to, uint256 amount) {
    env e;
    require from != to;

    mathint allowanceBefore = allowance(from, e.msg.sender);

    transferFrom(e, from, to, amount);

    mathint allowanceAfter = allowance(from, e.msg.sender);

    // max allowance (type(uint256).max) is not decreased per ERC-20 spec
    assert allowanceAfter == allowanceBefore - amount
        || allowanceBefore == max_uint256,
        "transferFrom must decrease allowance by amount (unless max)";
}

/// TransferFrom reverts without sufficient allowance
rule transferFromRevertsWithoutAllowance(address from, address to, uint256 amount) {
    env e;

    require allowance(from, e.msg.sender) < amount;
    require balanceOf(from) >= amount;
    require to != 0;

    transferFrom@withrevert(e, from, to, amount);

    assert lastReverted,
        "transferFrom must revert without sufficient allowance";
}

// ============================================================================
// Approve Rules
// ============================================================================

/// Approve sets exact allowance
rule approveSetsExactAllowance(address spender, uint256 amount) {
    env e;

    approve(e, spender, amount);

    assert allowance(e.msg.sender, spender) == amount,
        "approve must set exact allowance value";
}

/// Approve does not affect other allowances
rule approveDoesNotAffectOthers(
    address spender,
    uint256 amount,
    address otherOwner,
    address otherSpender
) {
    env e;
    require otherOwner != e.msg.sender || otherSpender != spender;

    uint256 otherAllowanceBefore = allowance(otherOwner, otherSpender);

    approve(e, spender, amount);

    assert allowance(otherOwner, otherSpender) == otherAllowanceBefore,
        "approve must not change other allowances";
}

// ============================================================================
// Reachability (Sanity)
// ============================================================================

/// It is possible to transfer tokens
rule canTransfer() {
    env e;
    address to;
    uint256 amount;

    require amount > 0;
    require to != 0;
    require to != e.msg.sender;
    require balanceOf(e.msg.sender) >= amount;

    transfer(e, to, amount);

    satisfy balanceOf(to) >= amount;
}
```

## Configuration (certora/Token.conf)

```json
{
    "files": ["src/Token.sol"],
    "verify": "Token:specs/Token.spec",
    "solc": "solc",
    "optimistic_loop": true,
    "loop_iter": "3",
    "rule_sanity": "basic",
    "packages": [
        "@openzeppelin=node_modules/@openzeppelin"
    ],
    "msg": "ERC-20 Token full verification"
}
```

## Running the Verification

```bash
# Full spec
certoraRun certora/Token.conf

# Single rule for faster iteration
certoraRun certora/Token.conf --rule transferMovesExactAmount

# With advanced sanity checks
certoraRun certora/Token.conf --rule_sanity advanced
```

## Expected Results

All rules should pass (green) for a standard OpenZeppelin ERC-20:

| Rule | Status | What It Proves |
|------|--------|----------------|
| `totalSupplyEqualsSumOfBalances` | PASS | No token creation or destruction outside mint/burn |
| `transferMovesExactAmount` | PASS | Exact accounting on transfer |
| `selfTransferNoChange` | PASS | Self-transfer is a no-op |
| `transferPreservesTotalSupply` | PASS | Transfer conserves supply |
| `transferRevertsOnInsufficientBalance` | PASS | Cannot spend more than balance |
| `transferToZeroReverts` | PASS | Zero address check present |
| `transferFromSpendsAllowance` | PASS | Allowance correctly decremented |
| `transferFromRevertsWithoutAllowance` | PASS | Cannot spend without approval |
| `approveSetsExactAllowance` | PASS | Approval sets exact value |
| `approveDoesNotAffectOthers` | PASS | No cross-contamination |
| `canTransfer` | PASS (satisfy) | Transfer is reachable |

## Debugging Failures

If `transferMovesExactAmount` fails, the counter-example will show specific values for `e.msg.sender`, `to`, and `amount` that violate the assertion. Common causes:

1. **Missing `require e.msg.sender != to`** — self-transfers have different accounting
2. **Fee-on-transfer tokens** — the received amount differs from the sent amount
3. **Rebasing tokens** — balances change between reads

Inspect the counter-example's "Variables" section in the Certora dashboard to see the concrete state that triggered the violation.

Last verified: February 2026
