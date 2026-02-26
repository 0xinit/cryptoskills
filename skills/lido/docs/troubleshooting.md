# Lido Troubleshooting Guide

Common issues and solutions when integrating with Lido.

## stETH Balance "Decreasing"

**Symptoms:**
- User's stETH balance appears lower than expected
- Balance drops by 1-2 wei after a transfer

**Cause:**
This is the share-to-balance rounding effect, not an actual loss. stETH balances are derived from shares via integer division. Each conversion can lose up to 1 wei. A transfer involves two conversions (amount-to-shares, then shares-to-balance), resulting in up to 2 wei difference.

**Solutions:**
1. Never assert exact stETH balance equality after transfers:
   ```typescript
   // BAD
   const received = balanceAfter - balanceBefore;
   if (received !== amount) throw new Error("Wrong amount");

   // GOOD — allow 2 wei tolerance
   const received = balanceAfter - balanceBefore;
   if (received < amount - 2n) throw new Error("Wrong amount");
   ```
2. Use `transferShares()` for exact share-denominated transfers.
3. Track shares (`sharesOf`) instead of balances (`balanceOf`) in smart contracts.

## Withdrawal Takes Too Long

**Symptoms:**
- Withdrawal request pending for days
- `isFinalized` stays `false`

**Cause:**
Withdrawal finalization depends on:
- Queue position (first-come, first-served)
- Validator exit queue on the beacon chain
- Oracle report cycle (typically once per day)
- Protocol liquidity (buffered ETH, new deposits)

**Solutions:**
1. Check your position in the queue:
   ```typescript
   const lastFinalized = await publicClient.readContract({
     address: WITHDRAWAL_QUEUE,
     abi: WITHDRAWAL_ABI,
     functionName: "getLastFinalizedRequestId",
   });
   console.log(`Your request #${requestId}, last finalized #${lastFinalized}`);
   ```
2. Typical wait is 1-5 days. During high withdrawal demand (e.g., market stress), this can extend to weeks.
3. If you need immediate liquidity, swap stETH/wstETH on secondary markets (Curve, Uniswap) instead of using the withdrawal queue. This trades at market rate, which may be slightly below 1:1.

## stETH/wstETH Confusion in DeFi

**Symptoms:**
- Unexpected behavior when depositing stETH into protocols
- Balance accounting errors in vaults
- stETH balance in contract doesn't match what was deposited

**Cause:**
stETH is a rebasing token. Most DeFi protocols (Aave, Maker, etc.) use wstETH because rebasing breaks standard ERC-20 vault accounting.

**Solutions:**
1. Always use wstETH for DeFi integrations (lending, collateral, vaults).
2. If a protocol requires stETH specifically, verify it handles rebasing correctly.
3. When building contracts that hold stETH, track shares internally:
   ```solidity
   // Store shares, not balances
   mapping(address => uint256) public userShares;

   function deposit(uint256 stEthAmount) external {
       STETH.transferFrom(msg.sender, address(this), stEthAmount);
       // Track shares received, not stETH amount
       uint256 shares = STETH.getSharesByPooledEth(stEthAmount);
       userShares[msg.sender] += shares;
   }
   ```

## Transaction Reverts on Stake

**Symptoms:**
- `submit()` reverts with `STAKE_LIMIT`
- Transaction fails when staking large amounts

**Cause:**
Lido has a daily staking rate limit that replenishes over time. Very large deposits or deposits during high-traffic periods may hit this limit.

**Solutions:**
1. Check the current limit before submitting:
   ```typescript
   const limit = await publicClient.readContract({
     address: LIDO,
     abi: parseAbi(["function getCurrentStakeLimit() external view returns (uint256)"]),
     functionName: "getCurrentStakeLimit",
   });
   console.log(`Current stake limit: ${formatEther(limit)} ETH`);
   ```
2. Split large deposits across multiple transactions or wait for the limit to replenish.
3. The limit replenishes gradually. Check back after a few hours.

## Share Rounding Errors in Integrations

**Symptoms:**
- Small discrepancies (1-2 wei) in token accounting
- `transferFrom` of full `balanceOf` leaves dust behind
- Smart contract invariant checks fail on exact amounts

**Cause:**
stETH balance = `shares * totalPooledEther / totalShares`. Integer division truncates. When converting back and forth, precision loss accumulates.

**Solutions:**
1. Use `transferShares()` instead of `transfer()` when exact amounts matter.
2. Accept 2 wei tolerance in balance comparisons.
3. When wrapping full balance to wstETH, use the actual balance after transfer:
   ```solidity
   STETH.transferFrom(msg.sender, address(this), amount);
   uint256 actualReceived = STETH.balanceOf(address(this));
   STETH.approve(address(WSTETH), actualReceived);
   WSTETH.wrap(actualReceived);
   ```

## Oracle Report Lag

**Symptoms:**
- Share rate seems stale or unchanged
- stETH balance doesn't update after expected time
- APR calculation returns zero

**Cause:**
The Accounting Oracle reports beacon chain rewards typically once per day. Between reports, the share rate remains constant. If an oracle report is delayed, balances won't update until the next successful report.

**Solutions:**
1. Do not poll for balance changes more than once per day.
2. For real-time stETH pricing, use the Chainlink stETH/ETH feed (`0x86392dC19c0b719886221c78AB11eb8Cf5c52812`) which updates independently.
3. For APR, use the Lido API (`https://eth-api.lido.fi/v1/protocol/steth/apr/sma`) which smooths over multiple reports.

## wstETH Not Rebasing

**Symptoms:**
- wstETH balance stays the same between oracle reports
- User expects wstETH to increase like stETH

**Cause:**
This is expected behavior, not a bug. wstETH is intentionally non-rebasing. Its balance represents a fixed number of stETH shares. The ETH value of wstETH increases over time, but this is reflected in the exchange rate (`stEthPerToken()`), not the balance.

**Solutions:**
1. To show the user their actual ETH value, convert wstETH to stETH equivalent:
   ```typescript
   const stEthValue = await publicClient.readContract({
     address: WSTETH,
     abi: parseAbi(["function getStETHByWstETH(uint256) external view returns (uint256)"]),
     functionName: "getStETHByWstETH",
     args: [wstEthBalance],
   });
   console.log(`${formatEther(wstEthBalance)} wstETH = ${formatEther(stEthValue)} stETH`);
   ```
2. Show the exchange rate trend over time to demonstrate yield accrual.

## Debug Checklist

- [ ] Using correct contract addresses for the target network
- [ ] stETH approved before calling `wrap()` or `requestWithdrawals()`
- [ ] Withdrawal amounts within bounds (100 wei to 1000 stETH per request)
- [ ] Not asserting exact stETH balance equality (allow 2 wei tolerance)
- [ ] Using wstETH (not stETH) for DeFi vault integrations
- [ ] Checking `receipt.status` after every transaction
- [ ] Using `bigint` for all token amounts (not `number`)
- [ ] Checking Chainlink feed staleness before using price data
