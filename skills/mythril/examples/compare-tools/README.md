# Compare Slither and Mythril

Run both Slither (static analysis) and Mythril (symbolic execution) on the same contract, compare findings, and demonstrate the complementary value of each tool.

## Test Contract

This contract has both pattern-based issues (Slither finds) and state-dependent issues (Mythril finds):

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ComparisonTarget {
    address public owner;
    mapping(address => uint256) public balances;
    bool private locked;
    uint256 public totalDeposits;

    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    function deposit() external payable {
        balances[msg.sender] += msg.value;
        totalDeposits += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    // Issue 1: Reentrancy — state update after external call
    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient");

        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");

        balances[msg.sender] -= amount;
        totalDeposits -= amount;
        emit Withdrawal(msg.sender, amount);
    }

    // Issue 2: tx.origin used for authentication
    function changeOwner(address newOwner) external {
        require(tx.origin == owner, "Not owner");
        owner = newOwner;
    }

    // Issue 3: Missing zero-address check (style issue)
    function setOwnerDirect(address newOwner) external {
        require(msg.sender == owner, "Not owner");
        owner = newOwner;
    }

    // Issue 4: Unused return value from low-level call
    function sendReward(address to, uint256 amount) external {
        require(msg.sender == owner, "Not owner");
        to.call{value: amount}("");
    }

    // Issue 5: locked variable is set but never read (dead code)
    function lock() external {
        require(msg.sender == owner, "Not owner");
        locked = true;
    }
}
```

Save as `ComparisonTarget.sol`.

## Step 1: Run Slither

```bash
slither ComparisonTarget.sol --json slither-report.json
```

### What Slither Finds (seconds)

| # | Detector | Severity | Description |
|---|----------|----------|-------------|
| 1 | `reentrancy-eth` | High | `withdraw()` — state change after ETH transfer |
| 2 | `tx-origin` | Medium | `changeOwner()` uses `tx.origin` for auth |
| 3 | `unchecked-lowlevel` | Medium | `sendReward()` ignores return value of `.call()` |
| 4 | `missing-zero-check` | Low | `setOwnerDirect()` does not validate `newOwner != address(0)` |
| 5 | `dead-code` or `unused-state` | Informational | `locked` is set but never used in any conditional |

Slither runs in under 5 seconds and catches all five issues through pattern matching.

## Step 2: Run Mythril

```bash
myth analyze ComparisonTarget.sol \
  --solv 0.8.20 \
  -t 2 \
  --execution-timeout 300 \
  --solver-timeout 30 \
  -o json > mythril-report.json
```

### What Mythril Finds (minutes)

| # | SWC | Severity | Description |
|---|-----|----------|-------------|
| 1 | SWC-107 | Medium | `withdraw()` — proven exploitable reentrancy with concrete tx sequence |
| 2 | SWC-115 | Medium | `changeOwner()` — tx.origin auth bypass |
| 3 | SWC-104 | Medium | `sendReward()` — unchecked call return |

Mythril takes 2-10 minutes but proves each finding is actually exploitable by providing concrete transaction sequences.

## Step 3: Compare Results

### What Only Slither Found

| Finding | Why Mythril Missed It |
|---------|----------------------|
| Missing zero-address check | Style/best-practice issue, not an exploitable vulnerability at the bytecode level |
| Unused `locked` variable | Code quality issue, not security-relevant — Mythril only analyzes security properties |

### What Both Found (with different value)

| Finding | Slither | Mythril |
|---------|---------|---------|
| Reentrancy in `withdraw()` | Pattern match: "state change after external call" | Proof: concrete deposit + withdraw sequence that drains funds |
| `tx.origin` in `changeOwner()` | Pattern match: "tx.origin used for authorization" | Proof: transaction sequence showing unauthorized ownership change |
| Unchecked return value | Pattern match: "low-level call return not checked" | Proof: call with concrete parameters that fails silently |

### What Only Mythril Could Find (in other contracts)

Mythril excels at multi-transaction state-dependent bugs that pattern matching cannot detect:

- Reentrancy across different functions (function A makes external call, function B has vulnerable state read)
- Oracle price manipulation where the exploit requires a specific state setup
- Privilege escalation requiring 2+ transactions to achieve the vulnerable state
- Flash loan attack paths

## Side-by-Side Run Script

```bash
#!/usr/bin/env bash
set -euo pipefail

CONTRACT="${1:?Usage: ./compare.sh <contract.sol>}"
SOLC_VERSION="${2:-0.8.20}"

mkdir -p reports

echo "=== Running Slither ==="
START=$(date +%s)
slither "$CONTRACT" --json "reports/slither.json" 2>/dev/null || true
SLITHER_TIME=$(( $(date +%s) - START ))
echo "Slither completed in ${SLITHER_TIME}s"

echo ""
echo "=== Running Mythril ==="
START=$(date +%s)
myth analyze "$CONTRACT" \
  --solv "$SOLC_VERSION" \
  -t 2 \
  --execution-timeout 300 \
  --solver-timeout 30 \
  -o json > "reports/mythril.json" 2>/dev/null || true
MYTHRIL_TIME=$(( $(date +%s) - START ))
echo "Mythril completed in ${MYTHRIL_TIME}s"

echo ""
echo "=== Summary ==="

SLITHER_COUNT=$(python3 -c "
import json
data = json.load(open('reports/slither.json'))
detectors = data.get('results', {}).get('detectors', [])
high = sum(1 for d in detectors if d.get('impact') == 'High')
med = sum(1 for d in detectors if d.get('impact') == 'Medium')
low = sum(1 for d in detectors if d.get('impact') == 'Low')
info = sum(1 for d in detectors if d.get('impact') == 'Informational')
print(f'{len(detectors)} total ({high} High, {med} Medium, {low} Low, {info} Info)')
")

MYTHRIL_COUNT=$(python3 -c "
import json
data = json.load(open('reports/mythril.json'))
issues = data.get('issues', [])
high = sum(1 for i in issues if i.get('severity') == 'High')
med = sum(1 for i in issues if i.get('severity') == 'Medium')
low = sum(1 for i in issues if i.get('severity') == 'Low')
print(f'{len(issues)} total ({high} High, {med} Medium, {low} Low)')
")

echo "Slither: $SLITHER_COUNT in ${SLITHER_TIME}s"
echo "Mythril: $MYTHRIL_COUNT in ${MYTHRIL_TIME}s"
```

## When to Use Which

| Scenario | Tool | Reason |
|----------|------|--------|
| Every PR / CI | Slither | Fast feedback, catches regressions |
| Pre-audit | Slither + Mythril | Complementary coverage |
| Complex DeFi protocol | Mythril with `-t 3` | Multi-transaction exploits |
| Code quality review | Slither only | Style, naming, best practices |
| Investigating a specific bug class | Mythril with `-m` flag | Targeted symbolic execution |
| Large codebase (50+ contracts) | Slither | Mythril is too slow per-contract for large codebases |

## Key Takeaway

Neither tool is sufficient alone. Slither provides breadth (90+ detectors, instant results) while Mythril provides depth (proves exploitability, finds multi-step attacks). A production security pipeline uses both.

Last verified: February 2026
