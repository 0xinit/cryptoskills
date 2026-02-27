# Writing a CVL Spec from Scratch

Step-by-step guide: start with an empty `.spec` file, add a methods block, write your first rule, add an invariant, and debug the counter-example when it fails.

## Target Contract

A simple staking contract that accepts deposits and tracks rewards.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Staking {
    using SafeERC20 for IERC20;

    IERC20 public immutable stakingToken;
    address public owner;

    mapping(address => uint256) public staked;
    uint256 public totalStaked;
    uint256 public rewardRate;

    error Unauthorized();
    error ZeroAmount();
    error InsufficientStake();

    constructor(IERC20 _stakingToken) {
        stakingToken = _stakingToken;
        owner = msg.sender;
    }

    function stake(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        staked[msg.sender] += amount;
        totalStaked += amount;
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    function unstake(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (staked[msg.sender] < amount) revert InsufficientStake();
        staked[msg.sender] -= amount;
        totalStaked -= amount;
        stakingToken.safeTransfer(msg.sender, amount);
    }

    function setRewardRate(uint256 rate) external {
        if (msg.sender != owner) revert Unauthorized();
        rewardRate = rate;
    }
}
```

## Step 1: Create the Methods Block

Start every spec by declaring the functions you want to verify. This tells Certora what the contract interface looks like.

Create `specs/Staking.spec`:

```cvl
methods {
    // View functions — envfree means they don't depend on msg.sender/msg.value
    function staked(address) external returns (uint256) envfree;
    function totalStaked() external returns (uint256) envfree;
    function rewardRate() external returns (uint256) envfree;
    function owner() external returns (address) envfree;

    // State-changing functions — need env for transaction context
    function stake(uint256) external;
    function unstake(uint256) external;
    function setRewardRate(uint256) external;

    // External token calls — use NONDET to abstract away token internals
    function _.transferFrom(address, address, uint256) external => NONDET;
    function _.transfer(address, uint256) external => NONDET;
}
```

**Key decisions:**
- `envfree` for pure/view functions that don't need caller context
- `NONDET` for external token calls — we are verifying the staking contract, not the token. NONDET means "assume any return value," which is safe because SafeERC20 reverts on failure.

## Step 2: Write Your First Rule

Start with the simplest property: staking increases the staker's balance.

```cvl
/// Staking increases staker balance by exact amount
rule stakeIncreasesBalance(uint256 amount) {
    env e;

    mathint stakedBefore = staked(e.msg.sender);

    stake(e, amount);

    assert staked(e.msg.sender) == stakedBefore + amount,
        "stake must increase balance by exact amount";
}
```

Create the config file `certora/Staking.conf`:

```json
{
    "files": ["src/Staking.sol"],
    "verify": "Staking:specs/Staking.spec",
    "solc": "solc",
    "optimistic_loop": true,
    "loop_iter": "3",
    "rule_sanity": "basic",
    "packages": [
        "@openzeppelin=node_modules/@openzeppelin"
    ],
    "msg": "Staking - first rule"
}
```

Run it:

```bash
certoraRun certora/Staking.conf --rule stakeIncreasesBalance
```

This should pass. You now have a working spec.

## Step 3: Add More Rules

Build out coverage one rule at a time. Run after each addition.

```cvl
/// Unstaking decreases staker balance by exact amount
rule unstakeDecreasesBalance(uint256 amount) {
    env e;

    mathint stakedBefore = staked(e.msg.sender);

    unstake(e, amount);

    assert staked(e.msg.sender) == stakedBefore - amount,
        "unstake must decrease balance by exact amount";
}

/// Cannot unstake more than staked
rule cannotUnstakeMoreThanStaked(uint256 amount) {
    env e;

    require staked(e.msg.sender) < amount;
    require amount > 0;

    unstake@withrevert(e, amount);

    assert lastReverted,
        "unstaking more than balance must revert";
}

/// Cannot stake zero
rule cannotStakeZero() {
    env e;

    stake@withrevert(e, 0);

    assert lastReverted,
        "staking zero must revert";
}

/// Only owner can set reward rate
rule onlyOwnerSetsRewardRate(uint256 rate) {
    env e;

    require e.msg.sender != owner();

    setRewardRate@withrevert(e, rate);

    assert lastReverted,
        "non-owner setting reward rate must revert";
}
```

## Step 4: Write Your First Invariant

Invariants are more powerful than rules — they hold across ALL reachable states, not just after one function call.

```cvl
/// Total staked equals sum of all individual stakes
/// This requires a ghost variable to track the sum

ghost mathint sumOfStakes {
    init_state axiom sumOfStakes == 0;
}

hook Sstore staked[KEY address user] uint256 newVal (uint256 oldVal) {
    sumOfStakes = sumOfStakes + newVal - oldVal;
}

hook Sload uint256 val staked[KEY address user] {
    require to_mathint(val) <= sumOfStakes;
}

invariant totalStakedEqualsSumOfStakes()
    to_mathint(totalStaked()) == sumOfStakes
    {
        preserved with (env e) {
            requireInvariant totalStakedEqualsSumOfStakes();
        }
    }
```

Run the invariant:

```bash
certoraRun certora/Staking.conf --rule totalStakedEqualsSumOfStakes
```

## Step 5: Add a Parametric Rule

Parametric rules verify a property across ALL functions in the contract.

```cvl
/// No function changes the owner
rule ownerNeverChanges(method f) {
    env e;
    calldataarg args;

    address ownerBefore = owner();

    f(e, args);

    assert owner() == ownerBefore,
        "owner must never change (immutable after construction)";
}

/// Staking for one user does not affect another user's stake
rule stakeIsolation(method f, address user1, address user2) {
    env e;
    calldataarg args;
    require user1 != user2;
    require e.msg.sender == user1;

    uint256 user2StakeBefore = staked(user2);

    f(e, args);

    assert staked(user2) == user2StakeBefore,
        "user1's actions must not change user2's stake";
}
```

## Step 6: Debug a Counter-Example

Suppose `stakeIsolation` fails. The counter-example might show:

```
Method: unstake(uint256)
e.msg.sender = user1 = 0x1111...
user2 = 0x1111...
```

The Prover found that when `user1 == user2`, the property fails because the `require user1 != user2` constraint was somehow not strong enough — or the method called affects both users.

**Fix:** Check if the counter-example violates your `require` statements. If the Prover found a valid path, your contract has a real issue. If the path seems impossible, add more `require` constraints — but carefully, over-constraining causes vacuity.

### Checking for Vacuity

A vacuous rule passes because no valid execution exists. Run with sanity checking:

```bash
certoraRun certora/Staking.conf --rule_sanity advanced
```

The report will flag rules where the `assert` is trivially true because the `require` statements exclude all executions. Look for "rule is vacuous" in the output.

## Step 7: Add Reachability Checks

Use `satisfy` to confirm that your rules are not vacuously true — that the states they reason about are actually reachable.

```cvl
/// Sanity: someone can actually stake
rule stakingIsReachable() {
    env e;
    uint256 amount;

    require amount > 0;

    stake(e, amount);

    satisfy staked(e.msg.sender) > 0;
}

/// Sanity: someone can stake and then unstake everything
rule fullUnstakeIsReachable() {
    env e;
    uint256 amount;

    require amount > 0;

    stake(e, amount);
    unstake(e, amount);

    satisfy staked(e.msg.sender) == 0;
}
```

## Complete Spec

The final `specs/Staking.spec` contains all pieces:

1. Methods block (Step 1)
2. Ghost variables and hooks (Step 4)
3. Invariants (Step 4)
4. Single-function rules (Steps 2-3)
5. Parametric rules (Step 5)
6. Reachability checks (Step 7)

Run the complete spec:

```bash
certoraRun certora/Staking.conf
```

## Iteration Workflow

1. Write one rule
2. Run it: `certoraRun config.conf --rule ruleName`
3. If it fails, read the counter-example in the dashboard
4. Decide: is this a real bug or a spec issue?
   - Real bug: fix the contract
   - Spec issue: add/remove `require` constraints
5. Re-run until green
6. Check sanity: `--rule_sanity advanced`
7. Repeat for next rule

Never write the entire spec before running it. Each rule should be verified independently before moving to the next.

Last verified: February 2026
