# Deep Multi-Transaction Analysis

Use Mythril's `-t 3` deep analysis to find vulnerabilities that only manifest across three or more transactions. Includes timeout tuning and interpreting complex multi-step attack paths.

## When You Need Deep Analysis

Standard `-t 2` analysis finds bugs triggered by a single setup transaction followed by an exploit transaction. But many real-world exploits require:

- **Reentrancy across different functions** — attacker calls function A, which calls back into function B
- **State setup over multiple transactions** — register, then claim privileges, then exploit
- **Flash loan sequences** — borrow, manipulate price, profit in three calls
- **Time-dependent bugs** — set state in tx 1, wait for block conditions in tx 2, exploit in tx 3

## Target Contract

This contract has a vulnerability that only appears with 3+ transaction analysis:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MultiStepVault {
    mapping(address => uint256) public balances;
    mapping(address => bool) public isWhitelisted;
    mapping(address => uint256) public withdrawalTimestamp;

    uint256 public constant WITHDRAWAL_DELAY = 1 days;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    // Step 1: anyone can whitelist themselves
    function requestWhitelist() external {
        isWhitelisted[msg.sender] = true;
    }

    // Step 2: whitelisted users can request withdrawal
    function requestWithdrawal() external {
        require(isWhitelisted[msg.sender], "Not whitelisted");
        require(balances[msg.sender] > 0, "No balance");
        withdrawalTimestamp[msg.sender] = block.timestamp;
    }

    // Step 3: execute withdrawal after delay
    // BUG: does not check if the requester is still whitelisted
    // BUG: does not clear the whitelist status after withdrawal
    function executeWithdrawal() external {
        require(withdrawalTimestamp[msg.sender] != 0, "No request");
        require(
            block.timestamp >= withdrawalTimestamp[msg.sender] + WITHDRAWAL_DELAY,
            "Too early"
        );

        uint256 amount = balances[msg.sender];
        balances[msg.sender] = 0;
        withdrawalTimestamp[msg.sender] = 0;

        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");
    }

    // Admin can revoke whitelist
    function revokeWhitelist(address user) external {
        // BUG: no access control — anyone can revoke anyone
        isWhitelisted[user] = false;
    }
}
```

## Run Deep Analysis

```bash
myth analyze MultiStepVault.sol \
  --solv 0.8.20 \
  -t 3 \
  --execution-timeout 3600 \
  --solver-timeout 60 \
  --max-depth 128 \
  -o json > deep-report.json
```

With Docker (memory-limited to prevent OOM):

```bash
docker run \
  --memory=8g \
  --cpus=2 \
  -v $(pwd):/src \
  mythril/myth analyze /src/MultiStepVault.sol \
  --solv 0.8.20 \
  -t 3 \
  --execution-timeout 3600 \
  --solver-timeout 60 \
  --max-depth 128 \
  -o json > deep-report.json
```

## Timeout Tuning Guide

Deep analysis is exponentially slower. Choose settings based on available time:

| Context | `-t` | `--execution-timeout` | `--solver-timeout` | `--max-depth` | Expected Time |
|---------|------|----------------------|--------------------|----|--------|
| Dev feedback | 1 | 120 | 10 | 50 | 30s-2min |
| CI pipeline | 2 | 300 | 30 | 64 | 2-10min |
| Pre-audit | 3 | 3600 | 60 | 128 | 15min-1hr |
| Full audit | 3 | 7200 | 120 | 256 | 1-4hr |

Key relationships:
- `--execution-timeout` caps total analysis time — the hard upper bound
- `--solver-timeout` caps each individual Z3 query — prevents single complex constraints from blocking progress
- `--max-depth` limits how deep the symbolic execution tree can grow — affects coverage vs speed
- Higher `-t` multiplies the state space; always increase `--execution-timeout` proportionally

## Interpreting Multi-Step Attack Paths

Deep analysis produces transaction sequences with 3+ steps. Each step includes:

```json
{
  "tx_sequence": {
    "steps": [
      {
        "name": "requestWhitelist()",
        "input": "0x...",
        "origin": "0xattacker...",
        "value": "0x0"
      },
      {
        "name": "deposit()",
        "input": "0xd0e30db0",
        "origin": "0xattacker...",
        "value": "0xde0b6b3a7640000"
      },
      {
        "name": "revokeWhitelist(address)",
        "input": "0x...",
        "origin": "0xdifferent_attacker...",
        "value": "0x0"
      }
    ]
  }
}
```

Read the sequence as a story:
1. Attacker whitelists themselves
2. Attacker deposits ETH
3. A different address revokes the attacker's whitelist (because `revokeWhitelist` has no access control)

The finding reveals that the missing access control on `revokeWhitelist` means anyone can grief any user's withdrawal process.

## Analyzing Results

### Triage by Severity

```bash
# Parse JSON report and filter High severity only
cat deep-report.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
for issue in data.get('issues', []):
    if issue['severity'] == 'High':
        print(f\"[{issue['swc-id']}] {issue['title']}\")
        print(f\"  Function: {issue['function_name']}\")
        print(f\"  Description: {issue['description'][:200]}\")
        print()
"
```

### Common Deep Analysis Findings

| Finding | SWC | Requires `-t` | Description |
|---------|-----|---------------|-------------|
| Cross-function reentrancy | 107 | 2+ | External call in function A, state read in function B |
| Multi-step privilege escalation | 105 | 3+ | Register -> escalate -> exploit |
| Griefing via unprotected functions | 105 | 2+ | Attacker interferes with another user's state |
| Dependent state manipulation | 107 | 3+ | Setup state across transactions, then exploit |

## Partial Results on Timeout

When Mythril times out, it reports whatever findings it discovered before the timeout. This is expected behavior — a timeout does not mean "no bugs found." It means "analysis was incomplete."

```
mythril.laser.smt: Timeout reached. Returning partial results.
```

To improve coverage within the same time budget:
- Focus on specific modules: `myth analyze Contract.sol -m reentrancy -t 3`
- Increase solver timeout: `--solver-timeout 120`
- Use weighted-random strategy: `--strategy weighted-random` (sometimes finds paths BFS misses)

## Comparing `-t 2` vs `-t 3` Results

Run both and diff:

```bash
# Standard analysis
myth analyze Contract.sol -t 2 --execution-timeout 300 -o json > report-t2.json

# Deep analysis
myth analyze Contract.sol -t 3 --execution-timeout 3600 -o json > report-t3.json

# Compare finding counts
echo "t=2 findings: $(cat report-t2.json | python3 -c 'import json,sys; print(len(json.load(sys.stdin).get("issues",[])))')"
echo "t=3 findings: $(cat report-t3.json | python3 -c 'import json,sys; print(len(json.load(sys.stdin).get("issues",[])))')"
```

New findings in the `-t 3` report that are absent from `-t 2` are the multi-transaction vulnerabilities that justify the extra analysis time.

Last verified: February 2026
