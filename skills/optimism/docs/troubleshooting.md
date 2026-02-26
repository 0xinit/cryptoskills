# Optimism Troubleshooting

## L1→L2 Message Not Relayed

**Symptoms:** L1 transaction succeeded but the L2 target function was never called.

**Diagnosis:**
1. Check the L1 transaction on [Etherscan](https://etherscan.io) — confirm the `SentMessage` event was emitted by `L1CrossDomainMessenger`.
2. Wait at least 3-5 minutes. L1→L2 messages require the L1 block to be finalized and included in the L2 derivation.
3. Check the L2 for the corresponding `RelayedMessage` event on the `L2CrossDomainMessenger` at `0x4200000000000000000000000000000000000007`.

**Common causes:**
- **Insufficient `minGasLimit`** — The L2 execution ran out of gas. The message is marked as failed on L2. You can replay it by calling `relayMessage` on the `L2CrossDomainMessenger` with a higher gas limit.
- **L2 target function reverts** — The message was relayed but the target function reverted. Check the L2 relay transaction for revert reason. Failed messages can be replayed.
- **Sequencer derivation lag** — During high L1 load, there may be delays in L2 including L1 deposit transactions. Wait longer.

**How to replay a failed message:**
```typescript
// On L2, call relayMessage with the original message parameters
// The CrossDomainMessenger tracks which messages have been relayed
// Failed messages can be retried with a higher gas limit
```

## Withdrawal Stuck (Prove Step Missed)

**Symptoms:** Initiated an L2→L1 withdrawal but never proved it on L1.

**Steps:**
1. Confirm the L2 withdrawal transaction succeeded. Look for the `MessagePassed` event from `L2ToL1MessagePasser` at `0x4200000000000000000000000000000000000016`.
2. Wait for the L2 output root containing your withdrawal to be proposed on L1. This takes ~1 hour. Check the `DisputeGameFactory` on L1.
3. Once the output root is proposed, submit the proof transaction: call `proveWithdrawalTransaction` on `OptimismPortal` at `0xbEb5Fc579115071764c7423A4f12eDde41f106Ed`.
4. After proving, wait 7 days for the challenge period.
5. Call `finalizeWithdrawalTransaction` on `OptimismPortal`.

**There is no deadline for proving or finalizing.** Your withdrawal does not expire. You can prove and finalize at any time after the output root is posted.

## Gas Estimation Too Low

**Symptoms:** Transaction cost was significantly higher than `eth_estimateGas` predicted.

**Cause:** `eth_estimateGas` returns only the L2 execution gas. The L1 data fee is a separate charge not included in gas estimation.

**Fix:**
```typescript
import { parseAbi } from "viem";

const GAS_ORACLE = "0x420000000000000000000000000000000000000F" as const;

const oracleAbi = parseAbi([
  "function getL1Fee(bytes memory _data) external view returns (uint256)",
]);

// Always add L1 data fee to your cost estimates
const l2Gas = await client.estimateGas({ to, data, value });
const l2GasPrice = await client.getGasPrice();
const l2Cost = l2Gas * l2GasPrice;

const l1DataFee = await client.readContract({
  address: GAS_ORACLE,
  abi: oracleAbi,
  functionName: "getL1Fee",
  args: [serializedTxData],
});

const totalCost = l2Cost + l1DataFee;
```

**Note:** The L1 data fee often accounts for 50-90% of total transaction cost, especially for calldata-heavy operations.

## Contract Verification Fails

**Symptoms:** `forge verify-contract` or `hardhat verify` fails on Optimistic Etherscan.

**Common causes and fixes:**

1. **Wrong API key** — Optimistic Etherscan requires a separate API key from Ethereum Etherscan. Register at [optimistic.etherscan.io](https://optimistic.etherscan.io).

2. **Compiler mismatch** — Ensure the exact same compiler version, optimization runs, `via-ir` setting, and EVM target.
```bash
# Check deployment compiler settings
forge config --json | jq '{solc_version, optimizer_runs, via_ir, evm_version}'
```

3. **Constructor args encoding** — For contracts with constructor arguments:
```bash
forge verify-contract <ADDRESS> src/MyContract.sol:MyContract \
  --chain-id 10 \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address,uint256)" 0x... 1000)
```

4. **Proxy contracts** — If your contract is behind a proxy, verify the implementation contract, then use Etherscan's "Is this a proxy?" feature.

## Sequencer Downtime Handling

**Symptoms:** Transactions fail or are not being included.

**Check status:** Visit [status.optimism.io](https://status.optimism.io).

**What happens during downtime:**
- No new L2 blocks are produced.
- Pending transactions queue up and will be included when the sequencer recovers.
- L2→L1 withdrawals already proven/finalized are unaffected.
- L1→L2 deposits queue up in the L1 deposit contract and are processed when derivation resumes.

**Forced inclusion via L1:** If the sequencer is censoring or down for an extended period, users can force-include transactions via the `OptimismPortal` contract on L1. This bypasses the sequencer entirely.

## GasPriceOracle Returns Unexpected Values

**Symptoms:** `l1BaseFee()`, `blobBaseFee()`, or scalar values seem wrong.

**Common causes:**
- **Reading deprecated fields** — After the Ecotone upgrade, `overhead()` and `scalar()` (single scalar) return stale values. Use `baseFeeScalar()` and `blobBaseFeeScalar()` instead.
- **L1 data staleness** — The `L1Block` predeploy is updated once per L2 block with the latest L1 data. During L1 reorgs or delays, values may be slightly stale.
- **Pre-Ecotone code** — If your code uses the old gas formula (`(overhead + calldataGas) * l1BaseFee * scalar / 1e6`), it will produce incorrect results post-Ecotone. Update to the new two-component formula.

## Token Bridge — Token Not Recognized

**Symptoms:** Cannot bridge an ERC20 token via the Standard Bridge.

**Cause:** The Standard Bridge only supports tokens with a registered `OptimismMintableERC20` counterpart on L2.

**Options:**
1. **Check the token list** — [Optimism Token List](https://github.com/ethereum-optimism/ethereum-optimism.github.io) for already-registered tokens.
2. **Deploy an OptimismMintableERC20** — Use the `OptimismMintableERC20Factory` predeploy on L2 to create a bridgeable representation:
```solidity
// OptimismMintableERC20Factory is at 0x4200000000000000000000000000000000000012 on L2
interface IOptimismMintableERC20Factory {
    function createOptimismMintableERC20(
        address _remoteToken,
        string memory _name,
        string memory _symbol
    ) external returns (address);
}
```
3. **Use a third-party bridge** — Bridges like Across, Stargate, or Hop support arbitrary tokens and offer faster bridging (minutes vs 7 days for withdrawals).
