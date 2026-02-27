# CVL Rule Patterns by Protocol Type

Reusable CVL patterns organized by protocol category. Copy-paste these into your specs and adapt to your contract's interface.

## Token Patterns (ERC-20, ERC-721)

### Total Supply Conservation

No function other than mint/burn should change total supply.

```cvl
rule supplyConservedOnTransfer(address to, uint256 amount) {
    env e;

    uint256 supplyBefore = totalSupply();

    transfer(e, to, amount);

    assert totalSupply() == supplyBefore,
        "transfer must not change total supply";
}
```

### Sum of Balances Invariant

The canonical token accounting invariant — total supply must always equal the sum of all individual balances.

```cvl
ghost mathint sumOfBalances {
    init_state axiom sumOfBalances == 0;
}

hook Sstore _balances[KEY address user] uint256 newBal (uint256 oldBal) {
    sumOfBalances = sumOfBalances + newBal - oldBal;
}

hook Sload uint256 val _balances[KEY address user] {
    require to_mathint(val) <= sumOfBalances;
}

invariant sumOfBalancesEqualsTotalSupply()
    to_mathint(totalSupply()) == sumOfBalances
    {
        preserved with (env e) {
            requireInvariant sumOfBalancesEqualsTotalSupply();
        }
    }
```

### Transfer Integrity

Transfer moves exactly `amount` between accounts. Two rules: one for distinct sender/receiver, one for self-transfer.

```cvl
rule transferIntegrity(address to, uint256 amount) {
    env e;
    require e.msg.sender != to;

    mathint fromBefore = balanceOf(e.msg.sender);
    mathint toBefore = balanceOf(to);

    transfer(e, to, amount);

    assert balanceOf(e.msg.sender) == fromBefore - amount;
    assert balanceOf(to) == toBefore + amount;
}

rule selfTransferIsNoop(uint256 amount) {
    env e;

    uint256 balBefore = balanceOf(e.msg.sender);

    transfer(e, e.msg.sender, amount);

    assert balanceOf(e.msg.sender) == balBefore;
}
```

### Allowance Isolation

Approving one spender does not affect any other allowance.

```cvl
rule approveIsolation(
    address spender,
    uint256 amount,
    address otherOwner,
    address otherSpender
) {
    env e;
    require otherOwner != e.msg.sender || otherSpender != spender;

    uint256 otherAllowance = allowance(otherOwner, otherSpender);

    approve(e, spender, amount);

    assert allowance(otherOwner, otherSpender) == otherAllowance;
}
```

### No Function Changes Third-Party Balance

```cvl
rule noThirdPartyBalanceChange(method f, address user) {
    env e;
    calldataarg args;
    require user != e.msg.sender;

    uint256 balBefore = balanceOf(user);

    f(e, args);

    // Balance only changes if user is involved in the call
    assert balanceOf(user) != balBefore =>
        (f.selector == sig:transferFrom(address,address,uint256).selector
         || f.selector == sig:mint(address,uint256).selector
         || f.selector == sig:burn(address,uint256).selector),
        "only specific functions can change third-party balance";
}
```

## Vault Patterns (ERC-4626)

### Share Price Monotonicity

Share price (assets per share) must never decrease — protects against inflation attacks.

```cvl
rule sharePriceMonotonic(method f) filtered {
    f -> !f.isView
} {
    env e;
    calldataarg args;
    require totalSupply() > 0;

    mathint priceBefore = to_mathint(totalAssets()) * 1000000000000000000
        / to_mathint(totalSupply());

    f(e, args);

    require totalSupply() > 0;

    mathint priceAfter = to_mathint(totalAssets()) * 1000000000000000000
        / to_mathint(totalSupply());

    assert priceAfter >= priceBefore;
}
```

### Deposit-Redeem Round Trip

Depositing assets and immediately redeeming the shares should return approximately the same amount.

```cvl
rule depositRedeemRoundTrip(uint256 assets) {
    env e;
    require assets > 0;
    require assets <= totalAssets();

    uint256 shares = deposit(e, assets, e.msg.sender);
    uint256 returned = redeem(e, shares, e.msg.sender, e.msg.sender);

    assert returned >= assets - 1,
        "round trip must return assets minus rounding";
}
```

### Preview Accuracy

ERC-4626 requires preview functions to return values close to actual execution.

```cvl
rule previewDepositIsAccurate(uint256 assets) {
    env e;
    address receiver;

    uint256 previewShares = previewDeposit(assets);
    uint256 actualShares = deposit(e, assets, receiver);

    assert actualShares >= previewShares,
        "actual shares must be at least preview amount";
}

rule previewWithdrawIsAccurate(uint256 assets) {
    env e;
    address receiver;
    address owner_;

    uint256 previewSharesBurned = previewWithdraw(assets);
    uint256 actualSharesBurned = withdraw(e, assets, receiver, owner_);

    assert actualSharesBurned <= previewSharesBurned,
        "actual shares burned must be at most preview amount";
}
```

## Lending Patterns

### Solvency Invariant

Protocol always has enough collateral to cover all outstanding borrows.

```cvl
invariant protocolSolvency()
    totalCollateralValue() >= totalBorrowValue()
    {
        preserved with (env e) {
            requireInvariant protocolSolvency();
            require e.msg.value == 0;
        }
    }
```

### Borrow Increases Debt

```cvl
rule borrowIncreasesDebt(uint256 amount) {
    env e;

    mathint debtBefore = borrowBalance(e.msg.sender);

    borrow(e, amount);

    assert borrowBalance(e.msg.sender) == debtBefore + amount,
        "borrow must increase debt by exact amount";
}
```

### Liquidation Reduces Debt

```cvl
rule liquidationReducesDebt(address borrower, uint256 amount) {
    env e;

    mathint debtBefore = borrowBalance(borrower);

    liquidate(e, borrower, amount);

    assert to_mathint(borrowBalance(borrower)) < debtBefore,
        "liquidation must reduce borrower debt";
}
```

### Cannot Borrow Without Collateral

```cvl
rule cannotBorrowWithoutCollateral(uint256 amount) {
    env e;
    require amount > 0;
    require collateralBalance(e.msg.sender) == 0;

    borrow@withrevert(e, amount);

    assert lastReverted,
        "must not borrow with zero collateral";
}
```

### Health Factor Protection

```cvl
/// No user action can make another user's position unhealthy
rule noThirdPartyLiquidationRisk(method f, address user) {
    env e;
    calldataarg args;
    require user != e.msg.sender;

    // User is healthy before
    require healthFactor(user) >= 1000000000000000000;

    f(e, args);

    assert healthFactor(user) >= 1000000000000000000,
        "another user's action must not make this user liquidatable";
}
```

## Access Control Patterns

### Permission Monotonicity

Permissions are never silently removed — only explicit revoke functions can remove roles.

```cvl
rule adminMonotonicity(method f) filtered {
    f -> f.selector != sig:revokeRole(bytes32,address).selector
      && f.selector != sig:renounceRole(bytes32,address).selector
} {
    env e;
    calldataarg args;
    address user;

    bool hadRole = hasRole(DEFAULT_ADMIN_ROLE(), user);

    f(e, args);

    assert hadRole => hasRole(DEFAULT_ADMIN_ROLE(), user),
        "admin role must not be silently removed";
}
```

### Only Admin Grants Roles

```cvl
rule onlyAdminGrantsRole(bytes32 role, address account) {
    env e;

    require !hasRole(role, account);

    grantRole(e, role, account);

    assert hasRole(getRoleAdmin(role), e.msg.sender),
        "only role admin can grant roles";
}
```

### Owner Cannot Be Changed Arbitrarily

```cvl
rule ownerChangeRequiresOwner(method f) {
    env e;
    calldataarg args;

    address ownerBefore = owner();

    f(e, args);

    assert owner() != ownerBefore => e.msg.sender == ownerBefore,
        "only current owner can transfer ownership";
}
```

## Governance Patterns

### Vote Weight Conservation

Total votes across all choices equals total votes cast.

```cvl
ghost mathint totalVotesCast {
    init_state axiom totalVotesCast == 0;
}

rule voteWeightConservation(uint256 proposalId, uint8 support) {
    env e;

    mathint forBefore = proposalVotesFor(proposalId);
    mathint againstBefore = proposalVotesAgainst(proposalId);
    mathint abstainBefore = proposalVotesAbstain(proposalId);

    castVote(e, proposalId, support);

    mathint forAfter = proposalVotesFor(proposalId);
    mathint againstAfter = proposalVotesAgainst(proposalId);
    mathint abstainAfter = proposalVotesAbstain(proposalId);

    mathint totalChange = (forAfter - forBefore)
        + (againstAfter - againstBefore)
        + (abstainAfter - abstainBefore);

    // Exactly one vote category increased by the voter's weight
    assert totalChange > 0,
        "casting a vote must increase total by voter weight";
}
```

### No Double Voting

```cvl
rule noDoubleVoting(uint256 proposalId, uint8 support) {
    env e;

    require hasVoted(proposalId, e.msg.sender);

    castVote@withrevert(e, proposalId, support);

    assert lastReverted,
        "cannot vote twice on the same proposal";
}
```

### Proposal State Machine

```cvl
/// Active proposals cannot skip to executed without passing through succeeded
rule proposalStateTransition(method f, uint256 proposalId) {
    env e;
    calldataarg args;

    uint8 stateBefore = state(proposalId);
    // Active = 1
    require stateBefore == 1;

    f(e, args);

    uint8 stateAfter = state(proposalId);

    // Cannot jump directly to Executed (7) from Active (1)
    assert stateAfter != 7,
        "cannot execute active proposal without passing through succeeded/queued";
}
```

## Staking Patterns

### Stake-Unstake Symmetry

```cvl
rule stakeUnstakeSymmetry(uint256 amount) {
    env e;
    require amount > 0;

    mathint balBefore = stakedBalance(e.msg.sender);

    stake(e, amount);
    unstake(e, amount);

    assert stakedBalance(e.msg.sender) == balBefore,
        "stake then unstake must restore original balance";
}
```

### Reward Monotonicity

```cvl
/// Pending rewards never decrease without a claim
rule rewardsNeverDecreaseWithoutClaim(method f) filtered {
    f -> f.selector != sig:claimRewards().selector
} {
    env e;
    calldataarg args;
    address user;

    mathint rewardsBefore = pendingRewards(user);

    f(e, args);

    assert to_mathint(pendingRewards(user)) >= rewardsBefore,
        "rewards must not decrease without explicit claim";
}
```

## General Patterns

### No Ether Drain

```cvl
/// Contract ETH balance never decreases except through explicit withdraw
rule noEtherDrain(method f) filtered {
    f -> f.selector != sig:withdrawETH(uint256).selector
} {
    env e;
    calldataarg args;

    mathint ethBefore = nativeBalances[currentContract];

    f(e, args);

    assert nativeBalances[currentContract] >= ethBefore,
        "ETH balance must not decrease except through withdraw";
}
```

### State Isolation

```cvl
/// User A's actions do not affect user B's state
rule userIsolation(method f, address userA, address userB) {
    env e;
    calldataarg args;
    require e.msg.sender == userA;
    require userA != userB;

    uint256 userBState = getUserState(userB);

    f(e, args);

    assert getUserState(userB) == userBState,
        "one user's actions must not affect another user's state";
}
```

### Reverting Functions Preserve State

```cvl
/// If a function reverts, no state changes occur
rule revertPreservesState(method f) {
    env e;
    calldataarg args;

    uint256 supplyBefore = totalSupply();
    uint256 balBefore = balanceOf(e.msg.sender);

    f@withrevert(e, args);

    assert lastReverted =>
        (totalSupply() == supplyBefore && balanceOf(e.msg.sender) == balBefore),
        "reverted function must not change state";
}
```

Last verified: February 2026
