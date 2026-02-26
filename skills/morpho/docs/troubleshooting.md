# Morpho Blue Troubleshooting Guide

Common issues and solutions when integrating Morpho Blue and MetaMorpho vaults.

## Transaction Reverts with `InconsistentInput`

**Symptoms:**
- `supply`, `borrow`, `repay`, or `withdraw` reverts immediately
- Error selector matches `InconsistentInput()`

**Solutions:**

1. **Set one of `assets` or `shares` to zero.** Morpho Blue requires exactly one to be nonzero:
   ```typescript
   // Supply 1000 USDC by assets (shares = 0)
   await walletClient.writeContract({
     address: MORPHO,
     abi: morphoAbi,
     functionName: "supply",
     args: [marketParams, parseUnits("1000", 6), 0n, account.address, "0x"],
   });

   // Withdraw all by shares (assets = 0)
   await walletClient.writeContract({
     address: MORPHO,
     abi: morphoAbi,
     functionName: "withdraw",
     args: [marketParams, 0n, supplyShares, account.address, account.address],
   });
   ```

2. **Never pass both as nonzero.** This is the most common Morpho integration mistake.

## Borrow Reverts with `InsufficientCollateral`

**Symptoms:**
- `borrow` reverts after supplying collateral
- Position has collateral but borrow fails

**Solutions:**

1. **Verify you are calling `supplyCollateral`, not `supply`.** These are different functions. `supply` deposits loan tokens (lender side). `supplyCollateral` deposits collateral tokens (borrower side).

2. **Check borrow amount against LLTV.** The borrow amount must satisfy:
   ```
   borrowValue <= collateralValue * LLTV
   ```
   Where values are computed using the oracle price. Borrow well below LLTV to avoid immediate liquidation risk.

3. **Verify oracle is returning a valid price:**
   ```typescript
   const price = await publicClient.readContract({
     address: marketParams.oracle,
     abi: [{ name: "price", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] }] as const,
     functionName: "price",
   });
   console.log(`Oracle price: ${price}`);
   // Should be nonzero
   ```

4. **Accrue interest before borrowing.** Stale interest state can affect share-to-asset conversion:
   ```typescript
   await walletClient.writeContract({
     address: MORPHO,
     abi: morphoAbi,
     functionName: "accrueInterest",
     args: [marketParams],
   });
   ```

## Withdraw Reverts with `InsufficientLiquidity`

**Symptoms:**
- Withdraw or borrow fails despite having shares/collateral
- Works for smaller amounts but fails for full withdrawal

**Solutions:**

1. **Check available liquidity.** Available = total supply - total borrow:
   ```typescript
   const marketData = await publicClient.readContract({
     address: MORPHO,
     abi: morphoAbi,
     functionName: "market",
     args: [marketId],
   });
   const available = marketData[0] - marketData[2]; // totalSupplyAssets - totalBorrowAssets
   console.log(`Available liquidity: ${available}`);
   ```

2. **Withdraw in smaller chunks.** If borrowers repay over time, liquidity becomes available.

3. **For MetaMorpho vaults:** The vault may need to withdraw from multiple underlying markets. If one market has insufficient liquidity, the withdrawal partially fails. The vault's withdraw queue determines the order.

## Market Creation Fails

**Symptoms:**
- `createMarket` reverts
- No clear error message

**Solutions:**

1. **Check LLTV is governance-enabled:**
   ```bash
   cast call 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb \
     "isLltvEnabled(uint256)(bool)" 860000000000000000 \
     --rpc-url $RPC_URL
   ```

2. **Check IRM is governance-enabled:**
   ```bash
   cast call 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb \
     "isIrmEnabled(address)(bool)" 0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC \
     --rpc-url $RPC_URL
   ```

3. **Verify oracle contract exists and returns a price:**
   ```bash
   cast call <oracle_address> "price()(uint256)" --rpc-url $RPC_URL
   ```

4. **Check market does not already exist.** Creating a duplicate is a no-op but wastes gas.

## Oracle Price Looks Wrong

**Symptoms:**
- Position shows incorrect LTV
- Liquidation threshold seems off
- Oracle returns a very large or small number

**Solutions:**

1. **Understand 36-decimal scaling.** The oracle returns price with `36 + loanDecimals - collateralDecimals` decimals:
   ```typescript
   // USDC (6 decimals) / WETH (18 decimals) market
   // Oracle returns price with 36 + 6 - 18 = 24 decimals
   const rawPrice = await publicClient.readContract({
     address: oracleAddress,
     abi: oracleAbi,
     functionName: "price",
   });
   const humanPrice = Number(rawPrice) / 1e24;
   ```

2. **Do not assume 18 decimals.** This is the most common oracle-related mistake.

3. **Verify the oracle adapter.** MorphoChainlinkOracleV2 wraps Chainlink feeds into the correct format. If building a custom oracle, the scaling must match exactly.

## Repay Leaves Dust Debt

**Symptoms:**
- After repaying what you think is the full amount, a tiny borrow balance remains
- `borrowShares` is nonzero despite repaying the full asset amount

**Solutions:**

1. **Repay by shares, not assets.** Interest accrues between the time you read the debt and execute the repay:
   ```typescript
   // Read exact borrow shares
   const position = await publicClient.readContract({
     address: MORPHO,
     abi: morphoAbi,
     functionName: "position",
     args: [marketId, account.address],
   });
   const borrowShares = position[1];

   // Repay all by shares (assets = 0)
   // This guarantees zero remaining debt
   await walletClient.writeContract({
     address: MORPHO,
     abi: morphoAbi,
     functionName: "repay",
     args: [marketParams, 0n, borrowShares, account.address, "0x"],
   });
   ```

2. **Over-approve the loan token.** When repaying by shares, the actual asset amount is calculated at execution time. Approve slightly more than estimated.

## MetaMorpho Vault Deposit Reverts

**Symptoms:**
- ERC-4626 `deposit` reverts
- Works for small amounts but not large

**Solutions:**

1. **Check deposit cap:**
   ```typescript
   const maxDeposit = await publicClient.readContract({
     address: vaultAddress,
     abi: vaultAbi,
     functionName: "maxDeposit",
     args: [account.address],
   });
   if (amount > maxDeposit) {
     console.error(`Exceeds cap. Max: ${maxDeposit}`);
   }
   ```

2. **Verify approval is to the vault, not to Morpho.** MetaMorpho vaults are separate contracts. Approve the vault address directly.

3. **Check the vault is accepting deposits.** Some vaults have a guardian that can pause deposits.

## MetaMorpho Vault Withdraw Partially Fails

**Symptoms:**
- Withdraw returns fewer assets than requested
- Withdraw reverts entirely

**Solutions:**

1. **The vault's withdraw queue may not have enough liquidity.** The vault withdraws from underlying Morpho Blue markets in order of its withdraw queue. If early markets in the queue lack liquidity, the withdrawal may be incomplete or fail.

2. **Try `redeem` instead of `withdraw`.** Redeeming by shares guarantees you get whatever assets are available for those shares, rather than reverting if the exact asset amount is unavailable.

3. **Check the vault's underlying market allocation.** Use the vault's `supplyQueue` view to see which markets it supplies to.

## Authorization Not Working

**Symptoms:**
- Operations on behalf of another user revert with `NotAuthorized`
- `setAuthorization` was called but operations still fail

**Solutions:**

1. **Authorization is from the position owner, not the operator.** The position owner must call `setAuthorization(operatorAddress, true)`.

2. **Authorization is all-or-nothing.** You cannot authorize per-market. `setAuthorization` grants access across ALL markets.

3. **Check current authorization status:**
   ```bash
   cast call 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb \
     "isAuthorized(address,address)(bool)" <owner> <operator> \
     --rpc-url $RPC_URL
   ```

## Debug Checklist

- [ ] Market ID computed correctly from MarketParams
- [ ] Correct function called (`supply` vs `supplyCollateral`)
- [ ] Exactly one of `assets` / `shares` is nonzero
- [ ] Token approval granted to Morpho Blue (not to a vault or other contract)
- [ ] Oracle returning valid, nonzero price
- [ ] IRM and LLTV are governance-enabled (for `createMarket`)
- [ ] Interest accrued before reading state (`accrueInterest`)
- [ ] `receipt.status` checked after every transaction
- [ ] Transaction simulated with `simulateContract` before broadcasting
