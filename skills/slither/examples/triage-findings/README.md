# Triage Slither Findings

Take raw Slither output from a real project, separate true positives from false positives, and produce a clean triage report. This is the workflow security engineers follow before handing findings to developers.

## Sample Project

A DeFi staking contract with OpenZeppelin dependencies:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Staking is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public stakingToken;
    IERC20 public rewardToken;

    uint256 public rewardRate;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
    mapping(address => uint256) public balances;
    uint256 public totalSupply;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardRateUpdated(uint256 oldRate, uint256 newRate);

    constructor(
        address _stakingToken,
        address _rewardToken
    ) Ownable(msg.sender) {
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
    }

    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot stake 0");
        _updateReward(msg.sender);
        totalSupply += amount;
        balances[msg.sender] += amount;
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot withdraw 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        _updateReward(msg.sender);
        totalSupply -= amount;
        balances[msg.sender] -= amount;
        stakingToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function getReward() external nonReentrant {
        _updateReward(msg.sender);
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function setRewardRate(uint256 _rate) external onlyOwner {
        emit RewardRateUpdated(rewardRate, _rate);
        rewardRate = _rate;
        lastUpdateTime = block.timestamp;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalSupply == 0) return rewardPerTokenStored;
        return rewardPerTokenStored +
            ((block.timestamp - lastUpdateTime) * rewardRate * 1e18) / totalSupply;
    }

    function earned(address account) public view returns (uint256) {
        return (balances[account] * (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18
            + rewards[account];
    }

    function _updateReward(address account) internal {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        rewards[account] = earned(account);
        userRewardPerTokenPaid[account] = rewardPerTokenStored;
    }
}
```

## Step 1: Raw Scan

```bash
slither . --json raw-report.json 2>&1 | tee raw-output.txt
```

### Typical Raw Output (40+ findings)

```
INFO:Detectors:
Staking.rewardPerToken() uses timestamp for comparisons (src/Staking.sol#75-78)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#block-timestamp

Staking.earned(address) uses a dangerous strict equality (src/Staking.sol#80-83)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#dangerous-strict-equalities

Staking._updateReward(address) uses timestamp (src/Staking.sol#85-90)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#block-timestamp

Reentrancy in Staking.stake(uint256) (src/Staking.sol#40-48):
  External calls:
  - stakingToken.safeTransferFrom(msg.sender,address(this),amount)
  State variables written after the call:
  - None
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#reentrancy-vulnerabilities-2

... (20+ findings from OpenZeppelin contracts)
... (10+ naming convention findings)
... (5+ pragma findings)
```

## Step 2: Filter Dependency Noise

```bash
slither . \
  --filter-paths "lib/forge-std|lib/openzeppelin-contracts|node_modules" \
  --json filtered-report.json
```

This removes all findings from third-party code. Down to ~10 findings.

## Step 3: Exclude Noise Detectors

```bash
slither . \
  --filter-paths "lib/forge-std|lib/openzeppelin-contracts|node_modules" \
  --exclude naming-convention,solc-version,pragma,dead-code,assembly \
  --exclude-optimization \
  --json triage-report.json
```

Down to ~5 findings.

## Step 4: Analyze Each Finding

### Finding 1: timestamp

```
Staking.rewardPerToken() uses timestamp for comparisons
Detector: timestamp | Severity: Low | Confidence: Medium
```

**Verdict: False Positive**

Reason: `block.timestamp` is used for reward accumulation math, not for security-critical branching. Miners can manipulate timestamps by ~15 seconds, which has negligible impact on reward calculations over hours/days. This is standard practice in staking contracts (Synthetix, Aura, Convex all use this pattern).

### Finding 2: incorrect-equality (potential)

```
Staking.rewardPerToken() uses dangerous strict equality: totalSupply == 0
Detector: incorrect-equality | Severity: Medium | Confidence: High
```

**Verdict: False Positive**

Reason: `totalSupply == 0` is a guard against division by zero, not a balance comparison vulnerable to manipulation. An attacker cannot force `totalSupply` to be non-zero without actually staking tokens.

### Finding 3: reentrancy-benign

```
Reentrancy in Staking.stake(uint256)
Detector: reentrancy-benign | Severity: Low | Confidence: Medium
```

**Verdict: False Positive**

Reason: The contract uses `nonReentrant` modifier from OpenZeppelin's ReentrancyGuard. Slither sometimes flags reentrancy on functions that have the guard because it analyzes the function body independently. The modifier prevents actual reentrancy.

### Finding 4: events-maths (if setRewardRate had no event)

If `setRewardRate` lacked the event, this would be a **True Positive**. In this contract it is already fixed.

## Step 5: Interactive Triage

For ongoing projects, use triage mode to persist decisions:

```bash
slither . \
  --filter-paths "lib/forge-std|lib/openzeppelin-contracts" \
  --triage-mode
```

Slither prompts for each finding:

```
Staking.rewardPerToken() uses timestamp (src/Staking.sol#75-78)
Hide this result? (y/n): y

Staking.earned(address) uses dangerous strict equality (src/Staking.sol#80-83)
Hide this result? (y/n): y
```

Decisions are saved to `slither.db.json`. Commit this file so CI runs skip already-triaged findings.

## Step 6: Generate Triage Report

Create a structured report from the JSON output:

```bash
slither . \
  --filter-paths "lib/forge-std|lib/openzeppelin-contracts" \
  --exclude naming-convention,solc-version,pragma \
  --exclude-optimization \
  --json final-report.json
```

### Report Template

```markdown
# Slither Triage Report — Staking.sol

**Date**: 2026-02-27
**Slither version**: 0.10.x
**Commit**: abc1234
**Scope**: src/Staking.sol

## Summary

| Severity | Total | True Positive | False Positive |
|----------|-------|---------------|----------------|
| High     | 0     | 0             | 0              |
| Medium   | 1     | 0             | 1              |
| Low      | 3     | 0             | 3              |

## Findings

### [FP] Medium: incorrect-equality in rewardPerToken()
- **Detector**: incorrect-equality
- **Location**: src/Staking.sol:75
- **Reason for FP**: Division-by-zero guard, not a balance comparison.
  totalSupply can only be zero when no tokens are staked.

### [FP] Low: timestamp in rewardPerToken()
- **Detector**: timestamp
- **Location**: src/Staking.sol:75-78
- **Reason for FP**: Reward accumulation uses timestamp for elapsed-time
  calculation. ~15s miner manipulation is negligible for reward math.

### [FP] Low: reentrancy-benign in stake()
- **Detector**: reentrancy-benign
- **Location**: src/Staking.sol:40-48
- **Reason for FP**: nonReentrant modifier prevents reentrancy.
  Slither flags the pattern but the guard is in place.

### [FP] Low: timestamp in _updateReward()
- **Detector**: timestamp
- **Location**: src/Staking.sol:85-90
- **Reason for FP**: Same as rewardPerToken() — elapsed time calculation.
```

## Configuration for Ongoing Triage

After initial triage, lock in filters via `.slither.conf.json`:

```json
{
  "filter_paths": "lib/forge-std|lib/openzeppelin-contracts|node_modules",
  "detectors_to_exclude": "naming-convention,solc-version,pragma,dead-code",
  "exclude_optimization": true,
  "exclude_informational": false,
  "exclude_low": false
}
```

Keep `exclude_low: false` — low-severity findings sometimes reveal real issues (like `missing-zero-check` on critical address parameters). Review them; just don't let them block CI.

## Triage Decision Framework

| Pattern | Typical Verdict | Reasoning |
|---------|----------------|-----------|
| `timestamp` on reward math | FP | Standard pattern, miner manipulation irrelevant |
| `timestamp` on auction deadlines | TP | ~15s manipulation can snipe auctions |
| `incorrect-equality` on `totalSupply == 0` | FP | Divide-by-zero guard |
| `incorrect-equality` on `balance == x` | TP | Balance manipulable via direct transfer |
| `reentrancy-*` with `nonReentrant` | FP | Guard present |
| `reentrancy-eth` without guard | TP | Real CEI violation |
| `unchecked-transfer` with SafeERC20 | FP | SafeERC20 reverts on failure |
| `unchecked-transfer` with raw transfer | TP | Return value silently ignored |
| `calls-loop` on admin function | FP | Admin controls input array |
| `calls-loop` on user-facing function | TP | DoS vector |

Last verified: February 2026
