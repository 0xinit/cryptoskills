# Maker Protocol Error Codes

Maker uses a mix of `require` strings (older contracts) and custom error patterns. The Vat uses short byte-string error messages. Most reverts come from the Vat's safety checks during `frob()`.

## Vat Errors

The Vat encodes error messages as bytes32 strings. When a transaction reverts from the Vat, decode the revert data to find these messages.

| Error | Function | Cause | Fix |
|-------|----------|-------|-----|
| `Vat/not-safe` | `frob` | Vault would be undercollateralized after this operation (ink * spot < art * rate) | Supply more collateral or draw less DAI |
| `Vat/not-allowed` | `frob`, `flux`, `move` | Caller not authorized (not owner and not approved via `hope`) | Call `vat.hope(callerAddress)` from the vault owner, or use DSProxy |
| `Vat/dust` | `frob` | Vault debt would be below the dust limit (minimum debt per vault) and nonzero | Either draw enough DAI to exceed dust, or repay all debt to zero |
| `Vat/ceiling-exceeded` | `frob` | Total ilk debt would exceed the debt ceiling (`line`) | Choose an ilk with available ceiling, or wait for governance to raise it |
| `Vat/not-live` | any | System has been shut down via Emergency Shutdown | Use `DssProxyActionsEnd` to claim collateral |
| `Vat/ilk-not-init` | `frob` | Ilk has not been initialized (rate = 0) | Use a valid, initialized ilk |

## Join Adapter Errors

| Error | Contract | Cause | Fix |
|-------|----------|-------|-----|
| `DaiJoin/not-live` | DaiJoin | System is in Emergency Shutdown | Use End module to process claims |
| `GemJoin/not-live` | GemJoin | System is in Emergency Shutdown | Cannot join new collateral during shutdown |
| `GemJoin/overflow` | GemJoin | Token amount overflows int256 | Reduce amount -- must fit in int256 |

## Jug Errors

| Error | Contract | Cause | Fix |
|-------|----------|-------|-----|
| `Jug/not-authorized` | Jug | Caller not authorized to modify parameters | Only governance can modify jug parameters |
| `Jug/rho-not-updated` | Jug | Internal timestamp error | Call `drip(ilk)` to update the timestamp |

## Dog / Clipper Errors (Liquidation 2.0)

| Error | Contract | Cause | Fix |
|-------|----------|-------|-----|
| `Dog/not-unsafe` | Dog | Vault is not undercollateralized | Cannot bark a safe vault -- check collateralization |
| `Dog/no-clip` | Dog | No Clipper configured for this ilk | This ilk does not support Liquidation 2.0 |
| `Dog/limit-hit` | Dog | Global or per-ilk liquidation limit reached | Wait for existing auctions to clear |
| `Clipper/not-running` | Clipper | Auction was stopped by governance | The auction circuit breaker was triggered |
| `Clipper/too-expensive` | Clipper | Your `max` price is below the current auction price | Increase your max price or wait for the price to decrease |
| `Clipper/no-partial-purchase` | Clipper | Take amount would leave dust collateral in the auction | Take the full remaining lot or reduce your amount |
| `Clipper/needs-reset` | Clipper | Auction price has gone stale (beyond the tail/cusp parameters) | Call `clipper.redo(id, keeperAddress)` to reset the auction |

## Pot (DSR) Errors

| Error | Contract | Cause | Fix |
|-------|----------|-------|-----|
| `Pot/not-live` | Pot | System is in Emergency Shutdown | Withdraw via DsrManager.exitAll, then claim via End |
| `Pot/invalid-now` | Pot | Block timestamp has not advanced since last drip | Wait for the next block |

## DSProxy Errors

| Error | Contract | Cause | Fix |
|-------|----------|-------|-----|
| `ds-proxy-target-address-required` | DSProxy | Target address is zero | Pass a valid DssProxyActions address |
| `ds-proxy-failed` | DSProxy | The delegatecall to DssProxyActions reverted | Decode the inner revert -- usually a Vat error |
| `ds-auth-unauthorized` | DSProxy | Caller is not the proxy owner | Only the proxy owner can call execute() |

## CdpManager Errors

| Error | Contract | Cause | Fix |
|-------|----------|-------|-----|
| `cdp-not-allowed` | CdpManager | Caller does not own or have permission for this CDP | Call `cdpAllow(cdpId, callerAddress, 1)` from the CDP owner |

## DSChief (Governance) Errors

| Error | Contract | Cause | Fix |
|-------|----------|-------|-----|
| `ds-chief-insufficient-locked` | DSChief | Trying to free more MKR than locked | Check `deposits(address)` for your locked balance |

## Interpreting Reverts in TypeScript

```typescript
import { BaseError, ContractFunctionRevertedError, decodeErrorResult } from "viem";

try {
  await publicClient.simulateContract({
    address: vatAddress,
    abi: vatAbi,
    functionName: "frob",
    args: [ilk, urn, urn, urn, dink, dart],
    account: account.address,
  });
} catch (err) {
  if (err instanceof BaseError) {
    const revertError = err.walk(
      (e) => e instanceof ContractFunctionRevertedError
    );
    if (revertError instanceof ContractFunctionRevertedError) {
      const reason = revertError.data?.errorName ?? revertError.reason;

      switch (reason) {
        case "Vat/not-safe":
          console.error("Vault would be undercollateralized. Add more collateral or draw less DAI.");
          break;
        case "Vat/dust":
          console.error("Debt below minimum. Draw more DAI or repay all.");
          break;
        case "Vat/ceiling-exceeded":
          console.error("Ilk debt ceiling reached. Try a different collateral type.");
          break;
        case "Vat/not-allowed":
          console.error("Not authorized. Ensure DSProxy has been set up correctly.");
          break;
        default:
          console.error(`Maker revert: ${reason}`);
      }
    }
  }
}
```

## Interpreting Reverts in Foundry

```bash
# Trace a failed transaction to find the revert reason
cast run <tx_hash> --rpc-url $RPC_URL

# Decode error data manually
# Maker Vat errors are often plain strings encoded as bytes32
cast --to-ascii <bytes32_error_data>

# Check if a vault is safe before attempting frob
cast call 0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B \
  "urns(bytes32,address)(uint256,uint256)" \
  0x4554482d41000000000000000000000000000000000000000000000000000000 \
  <urn_address> \
  --rpc-url $RPC_URL
```

## Common Mistakes That Cause Reverts

| Mistake | Error | Fix |
|---------|-------|-----|
| Calling Vat.frob directly (not through DSProxy) | `Vat/not-allowed` | Use DSProxy + DssProxyActions |
| Drawing DAI below dust limit | `Vat/dust` | Check `vat.ilks(ilk).dust` and draw more |
| Not calling `jug.drip(ilk)` before calculating debt | Stale rate, wrong repay amount | DssProxyActions handles this automatically |
| Confusing wad/ray/rad units | Various overflow/underflow | Use DssProxyActions which handles conversion |
| Trying to liquidate a safe vault | `Dog/not-unsafe` | Check ink * spot vs art * rate first |
| Partial auction take leaving dust | `Clipper/no-partial-purchase` | Take full remaining lot |
| Repaying exact debt amount (not accounting for interest between blocks) | Short on DAI | Over-approve by 1-2% for stability fee accrual |
