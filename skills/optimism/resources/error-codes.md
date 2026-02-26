# Optimism Common Errors

## Cross-Chain Messaging

### "Withdrawal not proven"
**Cause:** Calling `finalizeWithdrawalTransaction` before `proveWithdrawalTransaction`.
**Fix:** Prove the withdrawal first. Wait for the L2 output root to be proposed on L1 (~1 hour after L2 tx), then call `proveWithdrawalTransaction` on `OptimismPortal`.

### "Challenge period has not yet passed"
**Cause:** Calling `finalizeWithdrawalTransaction` before the 7-day challenge period expires.
**Fix:** Wait the full 7 days after proving. On OP Sepolia testnet, this period is ~12 seconds.

### "Output proposal not yet published"
**Cause:** Trying to prove a withdrawal before the L2 output root containing your transaction is proposed on L1.
**Fix:** Wait ~1 hour for the output root to be published. Check `L2OutputOracle` or `DisputeGameFactory` on L1.

### "Message already relayed"
**Cause:** Attempting to relay an L1→L2 message that has already been executed on L2.
**Fix:** No action needed. The message was already delivered. Check the L2 transaction for the relay receipt.

### "xDomainMessageSender is not set"
**Cause:** Calling `xDomainMessageSender()` outside the context of a cross-chain message relay.
**Fix:** Only call `xDomainMessageSender()` inside a function that was invoked by the `CrossDomainMessenger`. It reverts when called directly.

## Gas Estimation

### Gas estimation significantly lower than actual cost
**Cause:** `eth_estimateGas` only returns L2 execution gas. The L1 data fee is charged separately.
**Fix:** Add the L1 data fee from `GasPriceOracle.getL1Fee()` to the L2 execution cost for the true total.

### "getL1Fee" returning unexpected values
**Cause:** Passing uncompressed or unsigned data to `getL1Fee`. Post-Fjord, the oracle uses FastLZ compression estimation.
**Fix:** Pass the full RLP-encoded signed transaction bytes to `getL1Fee` for accurate results.

## Bridge

### "ERC20 bridge deposit reverted"
**Cause:** Insufficient ERC20 allowance for the `L1StandardBridge` contract.
**Fix:** Call `approve(L1StandardBridge, amount)` on the L1 token before calling `depositERC20`.

### "Token not supported"
**Cause:** The ERC20 token does not have a registered L2 representation on the Standard Bridge.
**Fix:** Check the [Optimism Token List](https://github.com/ethereum-optimism/ethereum-optimism.github.io). Custom tokens need a corresponding `OptimismMintableERC20` deployed on L2.

### "Withdrawal already finalized"
**Cause:** Attempting to finalize a withdrawal that has already been completed.
**Fix:** No action needed. Check the L1 transaction history for the finalization receipt.

## Contract Verification

### "Etherscan API key rejected"
**Cause:** Using an Ethereum Etherscan API key instead of an Optimistic Etherscan key.
**Fix:** Register a separate API key at [optimistic.etherscan.io](https://optimistic.etherscan.io). OP Mainnet uses its own Etherscan instance.

### "Contract source code not verified"
**Cause:** Compiler version or optimization settings mismatch.
**Fix:** Ensure exact same `solc` version, optimization runs, and EVM target used during deployment. Use `--via-ir` flag consistently.

## Sequencer

### "Transaction rejected: sequencer unavailable"
**Cause:** The centralized sequencer is down or overloaded.
**Fix:** Wait and retry. Check [status.optimism.io](https://status.optimism.io). Transactions are not lost — they can be submitted when the sequencer recovers. For critical operations, use the L1 deposit mechanism for forced inclusion.
