# Lido Share Mathematics

Reference for stETH rebasing math, share conversions, and precision considerations.

## Core Formulas

### stETH Balance from Shares

```
stETH = shares * totalPooledEther / totalShares
```

On-chain: `Lido.getPooledEthByShares(sharesAmount)`

### Shares from stETH Amount

```
shares = stETH * totalShares / totalPooledEther
```

On-chain: `Lido.getSharesByPooledEth(ethAmount)`

### Share Rate

```
shareRate = totalPooledEther / totalShares
```

At protocol launch, shareRate = 1.0. It increases over time as staking rewards are reported.

## Why stETH Balance Changes Daily

stETH uses a rebasing mechanism:

1. The Accounting Oracle reports new beacon chain rewards (or penalties).
2. `totalPooledEther` increases (or decreases).
3. `totalShares` stays the same (no new shares minted during rebase).
4. Every holder's `balanceOf` recalculates: `shares * newTotalPooledEther / totalShares`.
5. Result: balances appear to grow without any transfer event.

The share count for each holder does NOT change on rebase. Only `totalPooledEther` changes.

## wstETH = Shares

wstETH is a 1:1 representation of stETH shares:

```
wstETH.balanceOf(account) == Lido.sharesOf(account)  // after wrapping
```

When you wrap stETH to wstETH:
1. Your stETH is transferred to the wstETH contract.
2. You receive wstETH equal to the number of shares transferred.
3. `wstETH.balanceOf` does not change on rebase.
4. The ETH value of your wstETH still grows — reflected in `stEthPerToken()`.

Conversion:

```
stETH amount = wstETH amount * stEthPerToken() / 1e18
wstETH amount = stETH amount * tokensPerStEth() / 1e18
```

## Precision and Rounding

Integer division in Solidity truncates (rounds toward zero). This causes systematic rounding effects:

### Transfer Rounding (1-2 Wei Error)

When transferring stETH:

1. `amount` is converted to shares: `shares = amount * totalShares / totalPooledEther` (rounds down)
2. Sender's shares decrease by `shares`
3. Recipient's balance recalculates from received shares (rounds down again)

Result: recipient may receive `amount - 1` or `amount - 2` wei of stETH.

### Practical Impact

```
transfer(to, 1000000000000000000)  // 1 stETH
// Sender loses exactly 1e18 wei of balance
// Recipient gains 999999999999999998 or 999999999999999999 wei
```

### Safe Patterns

```solidity
// BAD: exact equality check on stETH
require(stETH.balanceOf(to) - balanceBefore == amount);

// GOOD: allow 2 wei tolerance
require(stETH.balanceOf(to) - balanceBefore >= amount - 2);

// BEST: use transferShares for exact share transfers
stETH.transferShares(to, sharesAmount);
```

## Worked Example

Given:
- `totalPooledEther` = 9,800,000 ETH
- `totalShares` = 9,500,000 shares (in 18-decimal units)
- Alice holds 1,000 shares

Alice's stETH balance:

```
balance = 1000 * 9,800,000 / 9,500,000 = 1031.578... stETH
```

Oracle reports +500 ETH in rewards. New `totalPooledEther` = 9,800,500 ETH.

Alice's new balance (same 1,000 shares):

```
balance = 1000 * 9,800,500 / 9,500,000 = 1031.631... stETH
```

Alice's balance increased by ~0.053 stETH without any transaction.

## References

- [stETH Shares Mechanics](https://docs.lido.fi/guides/steth-integration-guide#steth-internals-share-mechanics)
- [wstETH Technical Reference](https://docs.lido.fi/contracts/wsteth)
