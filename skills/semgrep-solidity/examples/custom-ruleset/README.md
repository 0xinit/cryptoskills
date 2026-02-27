# Create a Custom Ruleset

Build a complete project-specific Semgrep ruleset with 5 rules, organized in a directory, with tests for each rule.

## Project Context

You're auditing a DeFi vault that accepts deposits, lends to strategies, and allows withdrawals. Common vulnerability surface: access control, share manipulation, oracle dependence, reentrancy, unchecked math.

## Directory Structure

```
.semgrep/
├── vault-rules.yaml           # All 5 rules in one file
├── vault-rules.sol            # Test cases
└── .semgrep.yaml              # Optional local config
```

Alternatively, split into individual files:

```
.semgrep/
├── access-control.yaml
├── access-control.sol
├── share-inflation.yaml
├── share-inflation.sol
├── oracle-staleness.yaml
├── oracle-staleness.sol
├── unchecked-return.yaml
├── unchecked-return.sol
├── donation-attack.yaml
└── donation-attack.sol
```

## The Ruleset

Create `.semgrep/vault-rules.yaml`:

```yaml
rules:
  # ───────────────────────────────────────────────────────────────
  # Rule 1: Missing access control on sensitive operations
  # ───────────────────────────────────────────────────────────────
  - id: vault-unprotected-admin-function
    patterns:
      - pattern-either:
          - pattern: |
              function setStrategy($PARAM) external {
                ...
              }
          - pattern: |
              function setOracle($PARAM) external {
                ...
              }
          - pattern: |
              function pause() external {
                ...
              }
          - pattern: |
              function unpause() external {
                ...
              }
          - pattern: |
              function emergencyWithdraw(...) external {
                ...
              }
      - pattern-not-inside: |
          function $F(...) external onlyOwner { ... }
      - pattern-not-inside: |
          function $F(...) external onlyRole(...) { ... }
      - pattern-not-inside: |
          function $F(...) external {
            ...
            require(msg.sender == $OWNER, ...);
            ...
          }
    message: >-
      Admin function without access control. setStrategy, setOracle,
      pause, unpause, and emergencyWithdraw must be restricted.
    languages: [solidity]
    severity: ERROR
    metadata:
      category: security
      confidence: HIGH

  # ───────────────────────────────────────────────────────────────
  # Rule 2: Vault share inflation — division before multiplication
  # ───────────────────────────────────────────────────────────────
  - id: vault-division-before-multiplication
    patterns:
      - pattern-either:
          - pattern: ($X / $Y) * $Z
          - pattern: $A = $X / $Y; ... $A * $Z
    message: >-
      Division before multiplication causes precision loss. In vault
      share calculations, this can be exploited to inflate/deflate
      share prices. Multiply first, then divide.
    languages: [solidity]
    severity: WARNING
    metadata:
      category: security
      confidence: MEDIUM

  # ───────────────────────────────────────────────────────────────
  # Rule 3: Oracle staleness — using price without timestamp check
  # ───────────────────────────────────────────────────────────────
  - id: vault-oracle-no-staleness-check
    mode: taint
    message: >-
      Oracle price used without staleness validation. The price feed
      may be stale, returning outdated or zero values. Check
      updatedAt against a heartbeat threshold.
    languages: [solidity]
    severity: ERROR
    pattern-sources:
      - patterns:
          - pattern: $FEED.latestRoundData()
    pattern-sinks:
      - pattern-either:
          - pattern: $SHARES = $AMOUNT * $PRICE / $DENOM
          - pattern: $VALUE = $AMOUNT * $PRICE
          - pattern: return $AMOUNT * $PRICE / $DENOM
    pattern-sanitizers:
      - patterns:
          - pattern-either:
              - pattern: require(block.timestamp - $UPDATED < $MAX, ...)
              - pattern: require($UPDATED > 0, ...)
              - pattern: |
                  if (block.timestamp - $UPDATED > $MAX) { revert(...); }
    metadata:
      category: security
      confidence: HIGH

  # ───────────────────────────────────────────────────────────────
  # Rule 4: Unchecked ERC20 transfer return value
  # ───────────────────────────────────────────────────────────────
  - id: vault-unchecked-transfer
    patterns:
      - pattern-either:
          - pattern: $TOKEN.transfer($TO, $AMOUNT)
          - pattern: $TOKEN.transferFrom($FROM, $TO, $AMOUNT)
          - pattern: $TOKEN.approve($SPENDER, $AMOUNT)
      # Exclude if wrapped in require or if-check
      - pattern-not-inside: require($TOKEN.transfer(...), ...)
      - pattern-not-inside: require($TOKEN.transferFrom(...), ...)
      - pattern-not-inside: require($TOKEN.approve(...), ...)
      - pattern-not-inside: |
          bool $OK = $TOKEN.transfer(...);
          ...
          require($OK, ...);
      # Exclude SafeERC20 calls
      - pattern-not: $TOKEN.safeTransfer($TO, $AMOUNT)
      - pattern-not: $TOKEN.safeTransferFrom($FROM, $TO, $AMOUNT)
      - pattern-not: $TOKEN.safeApprove($SPENDER, $AMOUNT)
    message: >-
      ERC20 transfer/approve return value not checked. Some tokens
      (USDT) don't return bool. Use OpenZeppelin SafeERC20.
    languages: [solidity]
    severity: ERROR
    metadata:
      category: security
      confidence: HIGH

  # ───────────────────────────────────────────────────────────────
  # Rule 5: First depositor share inflation (donation attack)
  # ───────────────────────────────────────────────────────────────
  - id: vault-first-deposit-inflation
    patterns:
      - pattern: |
          function $F(...) ... returns (uint256 $SHARES) {
            ...
            $SHARES = $AMOUNT * totalSupply() / totalAssets();
            ...
          }
      - pattern-not-inside: |
          function $F(...) ... {
            ...
            require(totalSupply() > $MIN, ...);
            ...
          }
      - pattern-not-inside: |
          function $F(...) ... {
            ...
            if (totalSupply() == 0) { ... }
            ...
          }
    message: >-
      Share calculation using totalAssets() without first-depositor
      protection. An attacker can donate assets to inflate totalAssets,
      making subsequent deposits round to zero shares. Add a minimum
      deposit check or use virtual shares (ERC-4626 offset pattern).
    languages: [solidity]
    severity: ERROR
    metadata:
      category: security
      confidence: MEDIUM
      references:
        - https://blog.openzeppelin.com/a-]novel-defense-against-erc4626-inflation-attacks
```

## Test Cases

Create `.semgrep/vault-rules.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function safeTransfer(address to, uint256 amount) external;
}

interface AggregatorV3Interface {
    function latestRoundData() external view returns (
        uint80, int256, uint256, uint256, uint80
    );
}

// ── Rule 1: Access Control ──────────────────────────────────────

contract AccessControlTests {
    address public strategy;
    address public oracle;
    address public owner;

    // ruleid: vault-unprotected-admin-function
    function setStrategy(address _strategy) external {
        strategy = _strategy;
    }

    // ok: vault-unprotected-admin-function
    function setOracle(address _oracle) external onlyOwner {
        oracle = _oracle;
    }

    // ok: vault-unprotected-admin-function
    function emergencyWithdraw(address token) external {
        require(msg.sender == owner, "Not owner");
        IERC20(token).transfer(owner, 0);
    }

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }
}

// ── Rule 2: Division before multiplication ──────────────────────

contract MathTests {
    // ruleid: vault-division-before-multiplication
    function calculateShares(uint256 amount, uint256 price, uint256 decimals)
        external pure returns (uint256)
    {
        return (amount / price) * decimals;
    }

    // ok: vault-division-before-multiplication
    function calculateSharesFixed(uint256 amount, uint256 price, uint256 decimals)
        external pure returns (uint256)
    {
        return amount * decimals / price;
    }
}

// ── Rule 4: Unchecked transfer ──────────────────────────────────

contract TransferTests {
    IERC20 token;

    // ruleid: vault-unchecked-transfer
    function withdrawBad(address to, uint256 amount) external {
        token.transfer(to, amount);
    }

    // ok: vault-unchecked-transfer
    function withdrawGood(address to, uint256 amount) external {
        require(token.transfer(to, amount), "Transfer failed");
    }

    // ok: vault-unchecked-transfer
    function withdrawSafe(address to, uint256 amount) external {
        token.safeTransfer(to, amount);
    }
}
```

## Running the Ruleset

```bash
# Test all rules
semgrep --test .semgrep/vault-rules.yaml

# Run against contracts
semgrep --config .semgrep/ ./contracts/

# Run with severity filter (errors only)
semgrep --config .semgrep/ --severity ERROR ./contracts/

# JSON output for processing
semgrep --config .semgrep/ --json ./contracts/ | jq '.results | length'

# SARIF for GitHub code scanning
semgrep --config .semgrep/ --sarif ./contracts/ > results.sarif
```

## Combining with Community Rules

```bash
# Run both custom and community rules
semgrep \
  --config .semgrep/ \
  --config /path/to/semgrep-smart-contracts/solidity/ \
  ./contracts/
```

## Suppressing False Positives

When a rule fires on safe code, use inline comments:

```solidity
// nosemgrep: vault-unchecked-transfer
token.transfer(to, amount);
```

Or suppress at the rule level in config:

```yaml
# .semgrep.yaml at project root
rules: []  # Custom rules go in .semgrep/ directory

# Exclude specific paths globally
paths:
  exclude:
    - "test/"
    - "lib/"
    - "node_modules/"
```

## Key Takeaways

1. Group related rules in a single YAML file or split by category — both work
2. Test files must have the same base name as the rule file with a `.sol` extension
3. Taint mode (Rule 3) catches data flow issues that pattern matching misses
4. Use `pattern-not-inside` to exclude safe patterns (modifiers, require checks)
5. Combine your custom ruleset with decurity/semgrep-smart-contracts for broad coverage
6. Use `nosemgrep:` comments to suppress known false positives

Last verified: February 2026
