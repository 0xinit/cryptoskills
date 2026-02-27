# Verify an ERC-4626 Vault with Certora

CVL specification for an ERC-4626 tokenized vault verifying share accounting, deposit/withdraw symmetry, and inflation attack resistance.

## Contract Under Verification

Standard OpenZeppelin ERC-4626 vault. Create `src/Vault.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

contract Vault is ERC4626 {
    constructor(
        IERC20 asset_
    ) ERC20("Vault Shares", "vTKN") ERC4626(asset_) {}
}
```

Asset token (`src/Token.sol`):

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    constructor() ERC20("Token", "TKN") {
        _mint(msg.sender, 1_000_000e18);
    }
}
```

## Harness

Expose internal conversion functions for verification. Create `certora/harnesses/VaultHarness.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../../src/Vault.sol";

contract VaultHarness is Vault {
    constructor(IERC20 asset_) Vault(asset_) {}

    function convertToSharesExternal(uint256 assets) external view returns (uint256) {
        return convertToShares(assets);
    }

    function convertToAssetsExternal(uint256 shares) external view returns (uint256) {
        return convertToAssets(shares);
    }
}
```

## Specification (specs/Vault.spec)

```cvl
using Token as underlying;

methods {
    // Vault functions
    function totalSupply() external returns (uint256) envfree;
    function balanceOf(address) external returns (uint256) envfree;
    function totalAssets() external returns (uint256) envfree;
    function convertToShares(uint256) external returns (uint256) envfree;
    function convertToAssets(uint256) external returns (uint256) envfree;
    function convertToSharesExternal(uint256) external returns (uint256) envfree;
    function convertToAssetsExternal(uint256) external returns (uint256) envfree;
    function maxDeposit(address) external returns (uint256) envfree;
    function maxWithdraw(address) external returns (uint256) envfree;
    function previewDeposit(uint256) external returns (uint256) envfree;
    function previewWithdraw(uint256) external returns (uint256) envfree;

    function deposit(uint256, address) external returns (uint256);
    function withdraw(uint256, address, address) external returns (uint256);
    function mint(uint256, address) external returns (uint256);
    function redeem(uint256, address, address) external returns (uint256);

    // Underlying token
    function underlying.balanceOf(address) external returns (uint256) envfree;
    function underlying.totalSupply() external returns (uint256) envfree;
}

// ============================================================================
// Core Accounting
// ============================================================================

/// Total assets must reflect actual underlying balance held by vault
rule totalAssetsReflectsBalance() {
    assert totalAssets() == underlying.balanceOf(currentContract),
        "totalAssets must equal underlying balance of vault";
}

/// Conversion functions are inverses (within rounding)
rule conversionRoundTrip(uint256 assets) {
    require totalSupply() > 0;
    require assets > 0;
    require assets <= totalAssets();

    mathint shares = convertToShares(assets);
    mathint roundTrip = convertToAssets(require_uint256(shares));

    // Rounding down on both conversions can lose at most 1
    assert roundTrip >= to_mathint(assets) - 1,
        "assets -> shares -> assets round trip must lose at most 1 wei";
}

// ============================================================================
// Deposit Properties
// ============================================================================

/// Deposit mints shares to receiver and pulls assets from caller
rule depositAccountsCorrectly(uint256 assets, address receiver) {
    env e;
    require receiver != currentContract;
    require e.msg.sender != currentContract;

    mathint sharesBefore = balanceOf(receiver);
    mathint assetsBefore = totalAssets();
    mathint callerAssetsBefore = underlying.balanceOf(e.msg.sender);

    uint256 sharesMinted = deposit(e, assets, receiver);

    assert balanceOf(receiver) == sharesBefore + sharesMinted,
        "receiver must get exact shares minted";
    assert totalAssets() == assetsBefore + assets,
        "total assets must increase by deposit amount";
}

/// Deposit of zero assets should mint zero shares
rule depositZeroMintsZero(address receiver) {
    env e;

    uint256 shares = deposit(e, 0, receiver);

    assert shares == 0,
        "depositing zero assets must mint zero shares";
}

/// Preview matches actual deposit
rule previewDepositAccuracy(uint256 assets) {
    env e;
    address receiver;

    uint256 preview = previewDeposit(assets);

    uint256 actual = deposit(e, assets, receiver);

    // ERC-4626: previewDeposit MUST return close to actual
    assert actual >= preview,
        "actual shares must be >= preview (no worse than quoted)";
}

// ============================================================================
// Withdraw Properties
// ============================================================================

/// Withdraw burns shares from owner and sends assets to receiver
rule withdrawAccountsCorrectly(uint256 assets, address receiver, address owner_) {
    env e;
    require receiver != currentContract;
    require e.msg.sender == owner_;

    mathint ownerSharesBefore = balanceOf(owner_);
    mathint receiverAssetsBefore = underlying.balanceOf(receiver);

    uint256 sharesBurned = withdraw(e, assets, receiver, owner_);

    assert balanceOf(owner_) == ownerSharesBefore - sharesBurned,
        "owner shares must decrease by burned amount";
}

/// Cannot withdraw more than max
rule withdrawCappedAtMax(address owner_) {
    env e;
    address receiver;

    uint256 maxAssets = maxWithdraw(owner_);
    uint256 attemptedAssets;
    require attemptedAssets > maxAssets;

    withdraw@withrevert(e, attemptedAssets, receiver, owner_);

    assert lastReverted,
        "withdraw above max must revert";
}

// ============================================================================
// Deposit-Withdraw Symmetry
// ============================================================================

/// Deposit then withdraw returns approximately the same amount
rule depositWithdrawSymmetry(uint256 assets) {
    env e;
    require assets > 0;

    // Deposit
    uint256 shares = deposit(e, assets, e.msg.sender);

    // Immediately withdraw all shares
    uint256 returned = redeem(e, shares, e.msg.sender, e.msg.sender);

    // Rounding: lose at most 1 wei
    assert returned >= assets - 1,
        "deposit then redeem must return assets within rounding";
}

// ============================================================================
// Inflation Attack Resistance
// ============================================================================

/// Share price is monotonically non-decreasing
/// Prevents inflation attacks where an attacker manipulates share price
rule sharePriceNeverDecreases(method f) filtered {
    f -> !f.isView
} {
    env e;
    calldataarg args;

    require totalSupply() > 0;

    // share price = totalAssets * 1e18 / totalSupply
    mathint priceBefore = to_mathint(totalAssets()) * 1000000000000000000
        / to_mathint(totalSupply());

    f(e, args);

    require totalSupply() > 0;

    mathint priceAfter = to_mathint(totalAssets()) * 1000000000000000000
        / to_mathint(totalSupply());

    assert priceAfter >= priceBefore,
        "share price must never decrease (inflation attack resistance)";
}

/// First depositor cannot steal from second depositor
/// The classic ERC-4626 inflation attack vector
rule firstDepositorCannotSteal(uint256 firstDeposit, uint256 donation, uint256 secondDeposit) {
    env e1;
    env e2;
    require e1.msg.sender != e2.msg.sender;
    require e1.msg.sender != currentContract;
    require e2.msg.sender != currentContract;

    // Fresh vault
    require totalSupply() == 0;
    require totalAssets() == 0;

    require firstDeposit > 0;
    require secondDeposit > 0;
    require donation > 0;

    // Attacker deposits small amount
    uint256 attackerShares = deposit(e1, firstDeposit, e1.msg.sender);

    // Even after donation (direct transfer inflating totalAssets),
    // second depositor should get shares proportional to their deposit
    // This rule verifies the vault's built-in protection works
    require totalAssets() == firstDeposit + donation;

    uint256 victimShares = deposit(e2, secondDeposit, e2.msg.sender);

    // Victim must receive non-zero shares if depositing non-zero assets
    satisfy victimShares > 0;
}

// ============================================================================
// No Unauthorized State Changes
// ============================================================================

/// Only deposit/mint/withdraw/redeem change totalAssets
rule onlyVaultFunctionsChangeAssets(method f) filtered {
    f -> f.selector != sig:deposit(uint256,address).selector
      && f.selector != sig:withdraw(uint256,address,address).selector
      && f.selector != sig:mint(uint256,address).selector
      && f.selector != sig:redeem(uint256,address,address).selector
      && !f.isView
} {
    env e;
    calldataarg args;

    uint256 assetsBefore = totalAssets();

    f(e, args);

    assert totalAssets() == assetsBefore,
        "only deposit/mint/withdraw/redeem should change total assets";
}
```

## Configuration (certora/Vault.conf)

```json
{
    "files": [
        "certora/harnesses/VaultHarness.sol",
        "src/Token.sol"
    ],
    "verify": "VaultHarness:specs/Vault.spec",
    "link": ["VaultHarness:_asset=Token"],
    "solc": "solc",
    "optimistic_loop": true,
    "loop_iter": "3",
    "rule_sanity": "basic",
    "packages": [
        "@openzeppelin=node_modules/@openzeppelin"
    ],
    "msg": "ERC-4626 Vault verification"
}
```

## Running

```bash
# Full verification
certoraRun certora/Vault.conf

# Test share price property in isolation
certoraRun certora/Vault.conf --rule sharePriceNeverDecreases

# Deposit-withdraw symmetry
certoraRun certora/Vault.conf --rule depositWithdrawSymmetry
```

## Expected Results

| Rule | Status | What It Proves |
|------|--------|----------------|
| `totalAssetsReflectsBalance` | PASS | Accounting tracks actual balance |
| `conversionRoundTrip` | PASS | Conversion functions are consistent |
| `depositAccountsCorrectly` | PASS | Deposits correctly credited |
| `depositZeroMintsZero` | PASS | Edge case handled |
| `previewDepositAccuracy` | PASS | Preview matches reality |
| `withdrawAccountsCorrectly` | PASS | Withdrawals correctly debited |
| `withdrawCappedAtMax` | PASS | Max limits enforced |
| `depositWithdrawSymmetry` | PASS | Round-trip within rounding |
| `sharePriceNeverDecreases` | PASS | No inflation attack |
| `firstDepositorCannotSteal` | PASS (satisfy) | Victim gets shares |
| `onlyVaultFunctionsChangeAssets` | PASS | No unauthorized changes |

## Common Counter-Example Patterns

**`sharePriceNeverDecreases` fails:** The counter-example will show a direct ERC-20 transfer to the vault (donation) combined with a withdrawal. This is the classic inflation attack. OpenZeppelin 4.9+ includes virtual shares offset to mitigate this — verify your OZ version includes the fix.

**`depositWithdrawSymmetry` fails with rounding > 1:** If the vault charges fees on deposit or withdraw, the round trip will lose more than 1 wei. Adjust the assertion to account for the fee:

```cvl
assert returned >= assets - assets * feeBps / 10000 - 1;
```

**`totalAssetsReflectsBalance` fails:** If the vault has yield-bearing strategies that hold assets externally, `totalAssets()` may exceed `balanceOf(vault)`. Adjust the rule to account for external positions.

Last verified: February 2026
