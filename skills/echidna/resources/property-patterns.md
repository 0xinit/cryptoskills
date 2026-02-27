# Property Patterns for DeFi Protocols

Reusable property patterns organized by protocol type. Each pattern includes the invariant definition, Solidity implementation, and notes on common false positives.

## Token Properties (ERC-20)

### Conservation: Supply Equals Sum of Balances

```solidity
// Track all holders via ghost variable
address[] internal _holders;

function echidna_supply_conservation() public view returns (bool) {
    uint256 sum;
    for (uint256 i = 0; i < _holders.length; i++) {
        sum += balanceOf[_holders[i]];
    }
    return sum <= totalSupply;
}
```

**Note:** Use `<=` not `==` because tokens may be sent to untracked addresses. Strict equality requires tracking ALL recipients.

### No Unauthorized Minting

```solidity
uint256 internal _ownerMintedTotal;
uint256 internal _initialSupply;

function echidna_no_unauthorized_mint() public view returns (bool) {
    return totalSupply <= _initialSupply + _ownerMintedTotal;
}
```

**Note:** Requires overriding `mint()` to track `_ownerMintedTotal`. The property catches any code path that increases supply without going through the tracked mint function.

### Transfer Does Not Create Tokens

```solidity
function echidna_transfer_conservation() public view returns (bool) {
    // If no mint or burn occurred, supply should be unchanged
    return totalSupply == _initialSupply;
}
```

### Zero Address Has No Balance

```solidity
function echidna_zero_address_empty() public view returns (bool) {
    return balanceOf[address(0)] == 0;
}
```

### Approval Independence

```solidity
// In assertion mode — verify that approving spender A does not affect spender B
function test_approval_independence(address a, address b, uint256 amount) public {
    if (a == b) return;
    uint256 existing = allowance[msg.sender][b];
    this.approve(a, amount);
    assert(allowance[msg.sender][b] == existing);
}
```

## Vault Properties (ERC-4626)

### Solvency: Vault Holds Enough Assets

```solidity
function echidna_vault_solvent() public view returns (bool) {
    return asset.balanceOf(address(this)) >= totalAssets();
}
```

**Note:** This can break with fee-on-transfer tokens where the actual balance is less than the tracked amount. Guard with `if (isFeeOnTransfer) return true;` or test with standard tokens only.

### Share Price Monotonicity

```solidity
uint256 internal _lastSharePrice;

function echidna_share_price_non_decreasing() public view returns (bool) {
    if (totalSupply() == 0) return true;
    uint256 currentPrice = totalAssets() * 1e18 / totalSupply();
    // Share price should not decrease (assuming no losses/slashing)
    return currentPrice >= _lastSharePrice;
}
```

**Note:** Only valid for vaults without loss mechanisms. Lending vaults with bad debt will violate this.

### Deposit-Withdraw Roundtrip

```solidity
function test_deposit_withdraw_roundtrip(uint256 amount) public {
    if (amount == 0 || amount > 1e24) return;

    uint256 balanceBefore = asset.balanceOf(msg.sender);
    uint256 shares = deposit(amount, msg.sender);
    uint256 assetsBack = redeem(shares, msg.sender, msg.sender);

    // Rounding: user gets back at most what they deposited
    assert(assetsBack <= amount);
    // Rounding loss is bounded to 1 wei per operation
    assert(assetsBack >= amount - 2);
}
```

### No Shares Without Assets

```solidity
function echidna_no_empty_shares() public view returns (bool) {
    if (totalSupply() > 0) {
        return totalAssets() > 0;
    }
    return true;
}
```

### First Depositor Attack Prevention

```solidity
// The first depositor should not be able to manipulate share price
// to steal from subsequent depositors
function echidna_no_share_inflation() public view returns (bool) {
    if (totalSupply() == 0) return true;
    // Each share should represent at most a bounded amount of assets
    // A ratio above 1e18 indicates potential share inflation
    uint256 assetsPerShare = totalAssets() * 1e18 / totalSupply();
    return assetsPerShare < 1e36;
}
```

## Lending Protocol Properties

### Collateralization Invariant

```solidity
function echidna_all_positions_collateralized() public view returns (bool) {
    address[3] memory users = [address(0x10000), address(0x20000), address(0x30000)];
    for (uint256 i = 0; i < users.length; i++) {
        uint256 debt = getDebt(users[i]);
        if (debt == 0) continue;
        uint256 collateralValue = getCollateralValue(users[i]);
        uint256 required = debt * COLLATERAL_RATIO / RATIO_DENOMINATOR;
        if (collateralValue < required) {
            return false;
        }
    }
    return true;
}
```

**Note:** This property should hold after every user action. If it fails, it means a borrow or withdrawal bypassed the health check.

### Interest Accrual Monotonicity

```solidity
uint256 internal _lastTotalDebt;

function echidna_debt_only_increases_with_time() public view returns (bool) {
    // Without repayments, total debt should only increase (interest accrual)
    // This property must be checked carefully — repayments legitimately reduce debt
    return totalDebt >= _lastTotalDebt || _repaymentOccurred;
}
```

### Liquidation Reduces Risk

```solidity
function test_liquidation_improves_health(address user) public {
    if (isHealthy(user)) return;

    uint256 totalDebtBefore = totalDebt;
    uint256 totalCollateralBefore = totalCollateral;

    try this.liquidate(user) {
        // After liquidation, bad debt should be reduced
        assert(totalDebt <= totalDebtBefore);
        // And the liquidated position should be healthier or closed
        assert(getDebt(user) < getDebt(user) || getDebt(user) == 0);
    } catch {
        // Liquidation reverting on an unhealthy position is a bug
        assert(false);
    }
}
```

### Protocol Solvency

```solidity
function echidna_protocol_solvent() public view returns (bool) {
    // Total value of collateral must exceed total debt
    return totalCollateralValue() >= totalDebt;
}
```

## AMM / DEX Properties

### Constant Product (x * y = k)

```solidity
uint256 internal _lastK;

function echidna_constant_product() public view returns (bool) {
    uint256 reserveA = tokenA.balanceOf(address(pool));
    uint256 reserveB = tokenB.balanceOf(address(pool));
    uint256 k = reserveA * reserveB;
    // k can only increase (from fees) or stay equal
    return k >= _lastK;
}
```

**Note:** `k` increases due to swap fees. It should never decrease unless liquidity is removed.

### No Arbitrage-Free Profit

```solidity
function test_no_free_profit(uint256 amountIn) public {
    if (amountIn == 0 || amountIn > 1e24) return;

    uint256 balanceBefore = tokenA.balanceOf(msg.sender);

    // Swap A -> B
    uint256 amountB = swap(address(tokenA), address(tokenB), amountIn);
    // Swap B -> A
    uint256 amountABack = swap(address(tokenB), address(tokenA), amountB);

    // Round-trip should not be profitable (fees make it lossy)
    assert(amountABack <= amountIn);
}
```

### Reserve Solvency

```solidity
function echidna_reserves_match_balances() public view returns (bool) {
    (uint256 reserveA, uint256 reserveB) = pool.getReserves();
    return tokenA.balanceOf(address(pool)) >= reserveA
        && tokenB.balanceOf(address(pool)) >= reserveB;
}
```

## Governance Properties

### Voting Power Conservation

```solidity
function echidna_voting_power_conservation() public view returns (bool) {
    uint256 totalPower;
    address[3] memory voters = [address(0x10000), address(0x20000), address(0x30000)];
    for (uint256 i = 0; i < voters.length; i++) {
        totalPower += getVotingPower(voters[i]);
    }
    return totalPower <= totalSupply();
}
```

### Proposal State Machine

```solidity
function echidna_proposal_state_valid() public view returns (bool) {
    for (uint256 i = 0; i < proposalCount; i++) {
        ProposalState state = getState(i);
        // Executed proposals cannot be cancelled
        if (state == ProposalState.Executed) {
            return !isCancelled(i);
        }
        // Cancelled proposals cannot be executed
        if (state == ProposalState.Cancelled) {
            return !isExecuted(i);
        }
    }
    return true;
}
```

## Staking Properties

### Reward Rate Fairness

```solidity
// Two users staking the same amount for the same duration
// should earn the same rewards (within rounding)
function test_equal_stake_equal_reward(uint256 amount, uint256 duration) public {
    if (amount == 0 || amount > 1e24 || duration == 0 || duration > 365 days) return;

    stake(address(0x10000), amount);
    stake(address(0x20000), amount);

    // Advance time
    // (Note: Echidna handles block.timestamp advancement automatically
    //  based on maxTimeDelay config)

    uint256 reward1 = earned(address(0x10000));
    uint256 reward2 = earned(address(0x20000));

    // Rewards should be equal within 1 wei rounding
    assert(reward1 >= reward2 - 1 && reward1 <= reward2 + 1);
}
```

### No Reward Without Stake

```solidity
function echidna_no_free_rewards() public view returns (bool) {
    address[3] memory users = [address(0x10000), address(0x20000), address(0x30000)];
    for (uint256 i = 0; i < users.length; i++) {
        if (stakedBalance(users[i]) == 0) {
            // User with no stake should have no pending rewards
            if (earned(users[i]) > 0) return false;
        }
    }
    return true;
}
```

## Writing Effective Properties: Checklist

1. **Does the property constrain meaningful behavior?** A property that always returns `true` catches nothing.
2. **Is the property falsifiable?** Can you construct a scenario (even hypothetically) where it would fail?
3. **Does the property cover the attack surface?** Match properties to the protocol's critical invariants.
4. **Are ghost variables correctly updated?** Every state-changing function must update ghost tracking variables.
5. **Does the constructor establish non-trivial state?** Empty-state properties are often trivially true.
6. **Are all sender addresses covered?** Check properties for every address in the `sender` list.

Last verified: February 2026
