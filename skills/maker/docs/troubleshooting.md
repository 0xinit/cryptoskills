# Maker Protocol Troubleshooting Guide

Common issues and solutions when integrating MakerDAO / Sky vaults, DSR, liquidations, and token migration.

## Vault Operations Revert with `Vat/not-safe`

**Symptoms:**
- Drawing DAI reverts after depositing collateral
- Attempting to withdraw collateral fails

**Solutions:**

1. **Check collateralization before drawing.** The vault must satisfy `ink * spot >= art * rate` after the operation:
   ```typescript
   const RAY = 10n ** 27n;

   const [ilkData, urnData] = await Promise.all([
     publicClient.readContract({
       address: MCD_VAT,
       abi: vatAbi,
       functionName: "ilks",
       args: [ilk],
     }),
     publicClient.readContract({
       address: MCD_VAT,
       abi: vatAbi,
       functionName: "urns",
       args: [ilk, urn],
     }),
   ]);

   const ink = urnData[0];
   const art = urnData[1];
   const rate = ilkData[1];
   const spot = ilkData[2];

   // Maximum additional debt (wad) this vault can support
   const maxNewDebt = (ink * spot) / rate - art;
   console.log(`Can draw up to: ${maxNewDebt} more normalized debt units`);
   ```

2. **Call `jug.drip(ilk)` first.** The rate accumulator may be stale, making `spot` seem higher relative to `rate` than it actually is. DssProxyActions calls drip automatically, but raw Vat calls do not.

3. **Account for the stability fee when drawing.** If you deposit 10 ETH at $3,000 in an ETH-A vault (145% liquidation ratio), the maximum DAI is roughly `10 * 3000 / 1.45 = ~20,689 DAI`. Draw significantly less to avoid immediate liquidation risk.

## Repay Reverts or Leaves Dust Debt

**Symptoms:**
- `wipe()` reverts after providing enough DAI
- Small residual debt remains after `wipe()`
- `Vat/dust` error when trying to repay partially

**Solutions:**

1. **Use `wipeAll()` instead of `wipe()`.** Interest accrues between the block where you read your debt and the block where the transaction executes. `wipeAll()` repays the exact debt at execution time:
   ```typescript
   const calldata = encodeFunctionData({
     abi: proxyActionsAbi,
     functionName: "wipeAllAndFreeETH",
     args: [CDP_MANAGER, MCD_JOIN_ETH_A, MCD_JOIN_DAI, cdpId, ethToWithdraw],
   });
   ```

2. **Over-approve DAI.** When using `wipeAll()` through DSProxy, approve 1-2% more DAI than the estimated debt to cover interest accrual:
   ```typescript
   const estimatedDebt = art * rate / RAY;
   const approvalBuffer = (estimatedDebt * 102n) / 100n;
   ```

3. **Watch for the dust limit.** If you partially repay and the remaining debt falls below `dust`, the transaction reverts with `Vat/dust`. Either repay all (zero remaining) or repay only enough to stay above dust.

## DSProxy `execute` Reverts with No Clear Error

**Symptoms:**
- `ds-proxy-failed` error
- Transaction reverts but the error is opaque

**Solutions:**

1. **Simulate the inner call directly.** The DSProxy wraps the revert. Simulate the DssProxyActions call directly (not through the proxy) to see the real error:
   ```typescript
   try {
     await publicClient.simulateContract({
       address: PROXY_ACTIONS,
       abi: proxyActionsAbi,
       functionName: "openLockETHAndDraw",
       args: [CDP_MANAGER, MCD_JUG, MCD_JOIN_ETH_A, MCD_JOIN_DAI, ETH_A_ILK, daiAmount],
       value: ethAmount,
       account: dsProxyAddress, // simulate as if the DSProxy is calling
     });
   } catch (err) {
     console.error("Inner error:", err);
   }
   ```

2. **Check that you are calling through YOUR DSProxy.** Each address has one DSProxy. Calling someone else's DSProxy will revert with `ds-auth-unauthorized`.

3. **Verify the target contract address.** If you pass the wrong DssProxyActions address to `execute()`, the delegatecall will fail silently.

## Cannot Create DSProxy

**Symptoms:**
- `ProxyRegistry.build()` reverts
- Already have a proxy but `proxies(address)` returns zero

**Solutions:**

1. **Check for existing proxy.** The registry only allows one proxy per address:
   ```bash
   cast call 0x4678f0a6958e4D2Bc4F1BAF7Bc52E8F3564f3fE4 \
     "proxies(address)(address)" <your_address> --rpc-url $RPC_URL
   ```

2. **If you previously had a proxy that was self-destructed**, the registry still records the old address. You may need to use a different EOA.

## DAI to USDS Conversion Fails

**Symptoms:**
- `DaiUsds.daiToUsds()` reverts
- Approval was granted but conversion still fails

**Solutions:**

1. **Approve the DaiUsds contract, not the USDS token.** The converter contract pulls DAI from you:
   ```typescript
   // Approve DaiUsds converter (NOT the USDS token)
   await walletClient.writeContract({
     address: DAI,
     abi: erc20Abi,
     functionName: "approve",
     args: ["0x3225737a9Bbb6473CB4a45b7244ACa2BeFdB276A", amount],
   });
   ```

2. **Verify DAI balance.** The converter burns DAI and mints USDS 1:1. You must have sufficient DAI balance.

3. **Conversion is always 1:1.** There is no fee, no slippage, no rate. If you convert 1000 DAI you get exactly 1000 USDS.

## MKR to SKY Conversion Rate

**Symptoms:**
- Unexpected SKY amount after conversion
- Confusion about the conversion ratio

**Solutions:**

1. **The ratio is 1 MKR = 24,000 SKY.** This is fixed and hardcoded:
   ```typescript
   const rate = await publicClient.readContract({
     address: MKR_SKY,
     abi: mkrSkyAbi,
     functionName: "rate",
   });
   // rate = 24000000000000000000000 (24000 * 10^18)
   ```

2. **Approve MkrSky contract to spend MKR before calling mkrToSky.**

3. **Reverse conversion works too.** `skyToMkr` converts SKY back to MKR at the same rate.

## sUSDS Deposit Returns Fewer Shares Than Expected

**Symptoms:**
- Depositing USDS returns fewer shares than the deposit amount
- Share value is not 1:1 with USDS

**Solutions:**

1. **sUSDS is an ERC-4626 vault.** Share price increases over time as yield accrues. 1 sUSDS share is worth more than 1 USDS. This is expected behavior, not a bug.

2. **Use `convertToShares` to preview:**
   ```typescript
   const shares = await publicClient.readContract({
     address: SUSDS,
     abi: susdsAbi,
     functionName: "convertToShares",
     args: [usdsAmount],
   });
   ```

## Liquidation `bark` Reverts

**Symptoms:**
- Calling `Dog.bark()` reverts even though the vault appears undercollateralized

**Solutions:**

1. **The vault may have been liquidated already.** Check current collateral and debt.

2. **The liquidation hole may be full.** Each ilk has a maximum amount of DAI that can be in active auctions. Check:
   ```typescript
   const dogIlk = await publicClient.readContract({
     address: MCD_DOG,
     abi: dogAbi,
     functionName: "ilks",
     args: [ilk],
   });
   const hole = dogIlk[2]; // max auction DAI (rad)
   const dirt = dogIlk[3]; // current auction DAI (rad)
   // If dirt >= hole, no new liquidations allowed until existing auctions settle
   ```

3. **OSM price delay.** The Maker oracle (OSM) delays prices by 1 hour. A vault that looks underwater using a live price feed may still be safe according to the OSM price. The Dog uses the Vat's `spot`, which is set by the Spotter using OSM prices.

## Auction `take` Fails

**Symptoms:**
- `Clipper.take()` reverts
- Internal DAI balance is sufficient

**Solutions:**

1. **You must have internal Vat DAI, not ERC-20 DAI.** Convert via DaiJoin:
   ```typescript
   // 1. Approve DaiJoin
   // 2. Call DaiJoin.join(yourAddress, amount)
   // 3. Call Vat.hope(clipperAddress) to authorize the Clipper
   ```

2. **Check `Vat.hope`.** The Clipper needs permission to debit your internal DAI balance. Call `vat.hope(clipperAddress)` once per Clipper.

3. **Check for `Clipper/needs-reset`.** If the auction price has decayed past the `cusp` threshold, it needs a `redo()` call before anyone can take.

4. **Check for `Clipper/no-partial-purchase`.** If your take amount would leave a tiny amount of collateral below the minimum, you must take the full remaining lot.

## Debug Checklist

- [ ] DSProxy exists and is owned by your EOA
- [ ] DssProxyActions address is correct (not an old version)
- [ ] Token approvals granted to the correct contract (DSProxy for vault ops, DsrManager for DSR, DaiUsds for migration)
- [ ] `jug.drip(ilk)` called (or using DssProxyActions which does this automatically)
- [ ] Collateralization ratio well above liquidation ratio
- [ ] Debt above dust limit (or exactly zero)
- [ ] Correct ilk bytes32 encoding (right-padded ASCII)
- [ ] `receipt.status` checked after every transaction
- [ ] Using `bigint` for all amounts (not `number`)
- [ ] Correct unit system: wad (10^18) for tokens, ray (10^27) for rates, rad (10^45) for internal DAI
