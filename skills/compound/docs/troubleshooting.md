# Compound V3 Troubleshooting Guide

Common issues and solutions when integrating Compound V3 (Comet).

## Supply Reverts with TransferInFailed

**Symptoms:**
- `supply()` reverts with `TransferInFailed`
- Transaction fails silently or with "execution reverted"

**Solutions:**

1. **Approve Comet to spend the token first:**
   ```typescript
   // Approve the Comet proxy (NOT Configurator, NOT CometRewards)
   const approveHash = await walletClient.writeContract({
     address: tokenAddress,
     abi: erc20Abi,
     functionName: "approve",
     args: [COMET_USDC, amount],
   });
   await publicClient.waitForTransactionReceipt({ hash: approveHash });
   ```

2. **Verify sufficient token balance:**
   ```typescript
   const balance = await publicClient.readContract({
     address: tokenAddress,
     abi: erc20Abi,
     functionName: "balanceOf",
     args: [account.address],
   });
   if (balance < amount) throw new Error("Insufficient token balance");
   ```

3. **USDT special case.** USDT requires setting allowance to 0 before setting a new non-zero value:
   ```typescript
   await walletClient.writeContract({
     address: USDT,
     abi: erc20Abi,
     functionName: "approve",
     args: [COMET_USDC, 0n],
   });
   // Then set the actual amount
   ```

4. **Token is paused or blacklisted.** Some tokens (e.g., USDC, USDT) can freeze specific addresses. Verify your address is not blocked.

## Borrow Reverts with NotCollateralized

**Symptoms:**
- `withdraw()` on the base asset reverts with `NotCollateralized`
- Cannot borrow despite having collateral

**Solutions:**

1. **Insufficient collateral value.** Check your borrow capacity:
   ```typescript
   const assetInfo = await publicClient.readContract({
     address: COMET_USDC,
     abi: cometAbi,
     functionName: "getAssetInfoByAddress",
     args: [collateralAddress],
   });

   const collateralBalance = await publicClient.readContract({
     address: COMET_USDC,
     abi: cometAbi,
     functionName: "collateralBalanceOf",
     args: [account.address, collateralAddress],
   });

   const price = await publicClient.readContract({
     address: COMET_USDC,
     abi: cometAbi,
     functionName: "getPrice",
     args: [assetInfo.priceFeed],
   });

   // Maximum borrow = collateralValue * borrowCollateralFactor
   const collateralValueUsd = (BigInt(collateralBalance) * price) / BigInt(assetInfo.scale);
   const maxBorrow = (collateralValueUsd * BigInt(assetInfo.borrowCollateralFactor)) / 10n ** 18n;
   console.log(`Max borrow: ${maxBorrow}`);
   ```

2. **Borrow amount below minimum.** Comet has a `baseBorrowMin` (typically 100 USDC). Borrow amounts below this threshold revert.

3. **Price feed stale.** If the Chainlink feed has not updated within its heartbeat, the price may be rejected. Check `BadPrice` error.

## Withdraw Collateral Fails

**Symptoms:**
- `withdraw()` on collateral asset reverts
- Error: `NotCollateralized`

**Solutions:**

1. **Withdrawal would make position liquidatable.** You cannot withdraw collateral that backs an active borrow if it pushes the position below the borrow collateral factor.

2. **Repay debt first**, then withdraw:
   ```typescript
   // 1. Repay borrow by supplying base asset
   await walletClient.writeContract({
     address: COMET_USDC,
     abi: cometAbi,
     functionName: "supply",
     args: [USDC, repayAmount],
   });

   // 2. Then withdraw collateral
   await walletClient.writeContract({
     address: COMET_USDC,
     abi: cometAbi,
     functionName: "withdraw",
     args: [collateralAddress, withdrawAmount],
   });
   ```

3. **Partial withdrawal.** Withdraw only the excess collateral that is not backing your borrow.

## Confusing Supply vs Borrow Behavior

**Symptoms:**
- Calling `supply()` with USDC did not create a lending position
- Calling `withdraw()` with USDC created debt instead of withdrawing funds

**Solutions:**

This is by design in Compound V3. The functions behave differently based on your account state:

| Action | If you have a positive base balance | If you have zero or negative base balance |
|--------|------------------------------------|-----------------------------------------|
| `supply(USDC, X)` | Increases your lending balance | Repays X of your debt |
| `withdraw(USDC, X)` | Decreases your lending balance | Increases your debt by X |

**Key rule:** `supply()` with the base asset and collateral assets use the same function but have entirely different effects. Supplying the base asset earns interest. Supplying a collateral asset earns zero interest — it only backs borrows.

## SupplyCapExceeded

**Symptoms:**
- `supply()` reverts with `SupplyCapExceeded` for collateral
- Cannot add more of a specific collateral type

**Solutions:**

1. **Check current cap usage:**
   ```bash
   # Get asset info including supply cap
   cast call 0xc3d688B66703497DAA19211EEdff47f25384cdc3 \
     "getAssetInfoByAddress(address)((uint8,address,address,uint64,uint64,uint64,uint64,uint128))" \
     0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 \
     --rpc-url $RPC_URL
   ```

2. **Use a different collateral asset.** Each asset has independent caps.

3. **Wait for other users to withdraw.** Supply caps are global, not per-user.

4. **Check governance proposals.** Cap increases are proposed and voted on through Compound governance.

## CometRewards claim() Returns Zero

**Symptoms:**
- `getRewardOwed()` returns zero
- `claim()` succeeds but no COMP received

**Solutions:**

1. **Rewards not configured for this market.** Not all Comet deployments have COMP rewards. Check with governance.

2. **Too little time elapsed.** Rewards accrue per-second based on `baseTrackingSupplySpeed` or `baseTrackingBorrowSpeed`. Small positions accumulate slowly.

3. **Already claimed recently.** `claim()` sends accrued rewards since last claim. If you just claimed, owed amount is near zero.

4. **Using wrong CometRewards address.** Each chain has its own CometRewards contract. See `resources/contract-addresses.md`.

## Bulker Reverts

**Symptoms:**
- `invoke()` on Bulker reverts
- Batched operations partially fail

**Solutions:**

1. **Grant Bulker permission on Comet first:**
   ```typescript
   // The Bulker needs allow() permission to act on your behalf
   const allowHash = await walletClient.writeContract({
     address: COMET_USDC,
     abi: cometAbi,
     functionName: "allow",
     args: [BULKER, true],
   });
   await publicClient.waitForTransactionReceipt({ hash: allowHash });
   ```

2. **Encode action data correctly.** Each action code has a specific data format. Mismatched encoding causes reverts.

3. **Send ETH with native token actions.** If using `ACTION_SUPPLY_NATIVE_TOKEN`, include the ETH amount as `msg.value`.

## absorb() Reverts

**Symptoms:**
- `absorb()` reverts when trying to liquidate an account
- Account appears to have debt but absorb fails

**Solutions:**

1. **Account is not actually liquidatable.** Check `isLiquidatable()` first:
   ```typescript
   const canLiquidate = await publicClient.readContract({
     address: COMET_USDC,
     abi: cometAbi,
     functionName: "isLiquidatable",
     args: [borrowerAddress],
   });
   ```

2. **Account was already absorbed.** Another liquidator may have absorbed the position first. Check the account's borrow balance.

3. **Market is paused.** Governance can pause absorb operations independently.

## buyCollateral() Reverts with NotForSale

**Symptoms:**
- `buyCollateral()` reverts with `NotForSale`
- Trying to buy collateral that was never absorbed

**Solutions:**

1. **No absorbed collateral exists.** `buyCollateral()` only works on collateral that has been absorbed via `absorb()`. The protocol must hold reserves of that collateral type.

2. **All absorbed collateral already sold.** Another buyer purchased the available collateral.

3. **Wrong asset address.** Verify the collateral asset address matches one that was absorbed.

## Gas Estimation Failures

**Symptoms:**
- `estimateGas` fails or returns unreasonably high value
- "Gas estimation failed" in wallet

**Solutions:**

1. **The underlying operation would revert.** Fix the root cause (insufficient collateral, cap exceeded, etc.) first.

2. **Simulate the call to get the actual error:**
   ```typescript
   try {
     await publicClient.simulateContract({
       address: COMET_USDC,
       abi: cometAbi,
       functionName: "supply",
       args: [asset, amount],
       account: account.address,
     });
   } catch (error) {
     console.error("Simulation error:", error);
   }
   ```

3. **Chainlink price feed is stale.** If a price feed has not updated within its heartbeat, Comet operations may revert with `BadPrice`.

## Debug Checklist

- [ ] Correct Comet market address for the chain and base asset
- [ ] Token approved to the Comet proxy (not Configurator or Rewards)
- [ ] Sufficient token balance for the operation
- [ ] Collateral asset is configured in this Comet market
- [ ] Borrow amount exceeds `baseBorrowMin`
- [ ] Withdrawal does not make position liquidatable
- [ ] Bulker has `allow()` permission if using batched operations
- [ ] CometRewards address matches the chain
- [ ] Transaction simulated successfully before broadcast
- [ ] `receipt.status` checked after every transaction
