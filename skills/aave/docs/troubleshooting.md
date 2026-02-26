# Aave V3 Troubleshooting Guide

Common issues and solutions when integrating with Aave V3.

## Health Factor Below 1 / Liquidation

**Symptoms:**
- Health factor drops below 1.0
- Position gets partially or fully liquidated by third-party bots
- Unexpected loss of collateral

**Causes:**
- Collateral price dropped (oracle price movement)
- Borrow interest accrued faster than expected
- E-Mode was disabled, lowering LTV/threshold

**Solutions:**

1. **Monitor health factor proactively:**
   ```typescript
   const [, , , , , healthFactor] = await publicClient.readContract({
     address: POOL,
     abi: poolAbi,
     functionName: "getUserAccountData",
     args: [userAddress],
   });

   const hf = Number(healthFactor) / 1e18;
   if (hf < 1.5) {
     console.warn(`WARNING: Health factor ${hf.toFixed(4)} approaching liquidation`);
   }
   ```

2. **Set up automated alerts** when HF drops below 2.0
3. **Add collateral or repay debt** before HF reaches 1.0
4. **Diversify collateral** across multiple asset types to reduce single-asset risk

## Supply Cap Reached

**Symptoms:**
- `supply()` reverts with error code 50 (`SUPPLY_CAP_EXCEEDED`)
- Cannot deposit more of a specific asset

**Solutions:**

1. **Check current supply vs cap:**
   ```typescript
   const reserveCapsAbi = [
     {
       name: "getReserveCaps",
       type: "function",
       stateMutability: "view",
       inputs: [{ name: "asset", type: "address" }],
       outputs: [
         { name: "borrowCap", type: "uint256" },
         { name: "supplyCap", type: "uint256" },
       ],
     },
   ] as const;

   const [borrowCap, supplyCap] = await publicClient.readContract({
     address: POOL_DATA_PROVIDER,
     abi: reserveCapsAbi,
     functionName: "getReserveCaps",
     args: [asset],
   });

   console.log(`Supply cap: ${supplyCap}`);
   ```

2. **Wait for other users to withdraw**, freeing capacity
3. **Use a different Aave market** (e.g., Lido market on Ethereum)
4. **Supply on an L2** where caps may be higher relative to utilization

## Borrow Cap Reached

**Symptoms:**
- `borrow()` reverts with error code 51 (`BORROW_CAP_EXCEEDED`)

**Solutions:**
- Same approach as supply cap: check current utilization, wait for repayments, or use a different market/chain
- Monitor governance proposals that increase caps

## Frozen or Paused Reserve

**Symptoms:**
- Error code 56 (`RESERVE_FROZEN`): No new supply or borrow allowed
- Error code 57 (`RESERVE_PAUSED`): No operations allowed at all

**Causes:**
- Aave governance froze/paused the reserve due to risk concerns
- Temporary pause during a security incident

**Solutions:**

1. **Check reserve state:**
   ```typescript
   const configAbi = [
     {
       name: "getReserveConfigurationData",
       type: "function",
       stateMutability: "view",
       inputs: [{ name: "asset", type: "address" }],
       outputs: [
         { name: "decimals", type: "uint256" },
         { name: "ltv", type: "uint256" },
         { name: "liquidationThreshold", type: "uint256" },
         { name: "liquidationBonus", type: "uint256" },
         { name: "reserveFactor", type: "uint256" },
         { name: "usageAsCollateralEnabled", type: "bool" },
         { name: "borrowingEnabled", type: "bool" },
         { name: "stableBorrowRateEnabled", type: "bool" },
         { name: "isActive", type: "bool" },
         { name: "isFrozen", type: "bool" },
       ],
     },
   ] as const;

   const config = await publicClient.readContract({
     address: POOL_DATA_PROVIDER,
     abi: configAbi,
     functionName: "getReserveConfigurationData",
     args: [asset],
   });

   console.log(`Active: ${config[8]}, Frozen: ${config[9]}`);
   ```

2. **Frozen reserves still allow repay and withdraw** -- only new supply/borrow is blocked
3. **Monitor the Aave governance forum** for unfreeze proposals

## Isolation Mode Restrictions

**Symptoms:**
- Error code 38 (`ASSET_NOT_BORROWABLE_IN_ISOLATION`)
- Error code 40 (`USER_IN_ISOLATION_MODE`)
- Error code 54 (`DEBT_CEILING_EXCEEDED`)

**Causes:**
- User supplied an isolation-mode asset (e.g., newer or riskier tokens)
- Isolation mode limits which assets can be borrowed and imposes a debt ceiling

**Solutions:**

1. **Identify isolation mode collateral:** Only one isolation-mode asset can be active as collateral at a time
2. **Borrow only stablecoins:** Isolation mode typically only allows stablecoin borrows
3. **Exit isolation mode:** Withdraw the isolation collateral, then supply a non-isolation asset
4. **Check debt ceiling:** The isolation debt ceiling caps total borrowing against that collateral type across all users

## Oracle Price Stale

**Symptoms:**
- Price data appears outdated
- Health factor calculations seem incorrect
- Liquidations occur at unexpected prices

**Causes:**
- Chainlink feed update frequency varies by asset and chain
- On L2s, the sequencer uptime oracle may report downtime

**Solutions:**

1. **Check oracle freshness:**
   ```typescript
   const oracleAbi = [
     {
       name: "getAssetPrice",
       type: "function",
       stateMutability: "view",
       inputs: [{ name: "asset", type: "address" }],
       outputs: [{ name: "", type: "uint256" }],
     },
   ] as const;

   const AAVE_ORACLE = "0x54586bE62E3c3580375aE3723C145253060Ca0C2";

   const price = await publicClient.readContract({
     address: AAVE_ORACLE,
     abi: oracleAbi,
     functionName: "getAssetPrice",
     args: [asset],
   });

   console.log(`Price: $${Number(price) / 1e8}`);
   ```

2. **Compare with external price sources** (CoinGecko, DEX spot prices) to detect staleness
3. **On L2s, check sequencer status:** Error code 37 means the oracle sentinel detected sequencer downtime; borrows and liquidations are paused until recovery

## Flash Loan Callback Fails

**Symptoms:**
- Flash loan transaction reverts
- `executeOperation` callback not completing successfully

**Causes:**
- Not enough balance to repay `amount + premium` at end of callback
- `msg.sender` validation failing (caller is not the Pool)
- Missing `IERC20.approve(POOL, amountOwed)` before returning
- Insufficient gas for complex callback logic

**Solutions:**

1. **Verify the callback approves repayment:**
   ```solidity
   uint256 amountOwed = amount + premium;
   IERC20(asset).approve(address(POOL), amountOwed);
   return true;
   ```

2. **Always validate `msg.sender == POOL` and `initiator`** in `executeOperation`

3. **Ensure the contract has enough of the borrowed token** to repay. If your logic swaps tokens, verify the return amount covers `amount + premium`

4. **Test with `simulateContract` first:**
   ```typescript
   await publicClient.simulateContract({
     address: flashLoanContract,
     abi: flashLoanAbi,
     functionName: "requestFlashLoan",
     args: [asset, amount],
     account: account.address,
   });
   ```

## V2 vs V3 Confusion

**Symptoms:**
- Function signature mismatch errors
- Calling `deposit()` instead of `supply()`
- Using `LendingPool` interface instead of `Pool`

**V2 -> V3 Migration Checklist:**

| V2 | V3 |
|----|----|
| `LendingPool` | `Pool` |
| `deposit()` | `supply()` |
| `ILendingPool` | `IPool` |
| Flash loan fee 0.09% | Flash loan fee 0.05% |
| No supply/borrow caps | Per-asset supply/borrow caps |
| No E-Mode | E-Mode for correlated assets |
| No isolation mode | Isolation mode for new assets |

## Debug Checklist

- [ ] Using V3 Pool address (not V2 LendingPool)
- [ ] `interestRateMode = 2` (variable, not deprecated stable rate)
- [ ] Health factor above 1.0 before borrowing
- [ ] Token approved for Pool before supply/repay
- [ ] Correct token decimals in `parseUnits` (USDC = 6, WETH = 18)
- [ ] Checking `receipt.status === "success"` after every transaction
- [ ] Supply and borrow caps not exceeded
- [ ] Reserve is active and not frozen/paused
- [ ] E-Mode category matches the asset being borrowed
