# Arbitrum Troubleshooting

## Transaction Stuck: L1→L2 Retryable Not Auto-Redeemed

**Symptoms**: L1 transaction confirmed, but L2 state never changes. Retryable ticket was created but not executed.

**Root Cause**: The retryable ticket auto-redeem failed because the L2 gas limit or max fee per gas was too low, or the L2 execution reverted.

**Fix**:
1. Find the retryable ticket ID from the L1 transaction receipt (emitted as an event)
2. Check the ticket status on L2 via `ArbRetryableTx`:

```typescript
const ARB_RETRYABLE_TX = "0x000000000000000000000000000000000000006E" as const;

const timeout = await l2PublicClient.readContract({
  address: ARB_RETRYABLE_TX,
  abi: [{ name: "getTimeout", type: "function", stateMutability: "view", inputs: [{ name: "ticketId", type: "bytes32" }], outputs: [{ name: "", type: "uint256" }] }],
  functionName: "getTimeout",
  args: [ticketId],
});

if (timeout > BigInt(Math.floor(Date.now() / 1000))) {
  // Still alive — redeem manually
  await l2WalletClient.writeContract({
    address: ARB_RETRYABLE_TX,
    abi: [{ name: "redeem", type: "function", inputs: [{ name: "ticketId", type: "bytes32" }], outputs: [] }],
    functionName: "redeem",
    args: [ticketId],
  });
}
```

3. If the ticket expired (timeout in the past), the message is lost. You must resend from L1.
4. Prevention: overestimate `gasLimit` and `maxFeePerGas` — excess is refunded.

## Gas Estimation Too Low

**Symptoms**: Transaction reverts with out-of-gas, even though `eth_estimateGas` said it would succeed.

**Root Cause**: Standard `eth_estimateGas` may not fully account for the L1 data posting cost component. The L1 base fee can also fluctuate between estimation and execution.

**Fix**: Use `NodeInterface.gasEstimateComponents()` for accurate L1+L2 gas breakdown:

```typescript
const { result } = await publicClient.simulateContract({
  address: "0x00000000000000000000000000000000000000C8",
  abi: nodeInterfaceAbi,
  functionName: "gasEstimateComponents",
  args: [to, false, data],
});
const [totalGas, l1Gas, baseFee, l1BaseFee] = result;
```

Add a 20-30% buffer to the total gas estimate to absorb L1 base fee fluctuations:

```typescript
const bufferedGas = (totalGas * 130n) / 100n;
```

## Contract Verification Fails on Arbiscan

**Symptoms**: `forge verify-contract` returns an error or "unable to verify."

**Common Causes**:
1. **Wrong compiler version**: Must match exactly what was used to compile
2. **Missing constructor args**: If the contract has constructor parameters, they must be encoded correctly
3. **Optimizer settings mismatch**: The optimization runs must match `foundry.toml` or `hardhat.config.ts`

**Fix**:
```bash
# Check your compiler version
forge --version

# Verify with explicit compiler and optimizer
forge verify-contract \
  --chain-id 42161 \
  --etherscan-api-key $ARBISCAN_API_KEY \
  --compiler-version v0.8.24+commit.e11b9ed9 \
  --num-of-optimizations 200 \
  $CONTRACT_ADDRESS \
  src/MyContract.sol:MyContract

# If constructor args are needed
forge verify-contract \
  --chain-id 42161 \
  --etherscan-api-key $ARBISCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(address)" 0xSomeAddress) \
  $CONTRACT_ADDRESS \
  src/MyContract.sol:MyContract
```

Alternative: use Sourcify verification (no API key needed):
```bash
forge verify-contract --chain-id 42161 --verifier sourcify $CONTRACT_ADDRESS src/MyContract.sol:MyContract
```

## block.number Returns Unexpected Value

**Symptoms**: `block.number` in Solidity returns a value that looks like an Ethereum L1 block number, not an Arbitrum L2 block number.

**Root Cause**: On Arbitrum, `block.number` returns the L1 block number at the time the sequencer processed the transaction. This is by design for compatibility with L1 contracts that use `block.number` for timing.

**Fix**: Use the `ArbSys` precompile for L2 block number:

```solidity
IArbSys constant ARBSYS = IArbSys(0x0000000000000000000000000000000000000064);
uint256 l2Block = ARBSYS.arbBlockNumber();
```

```typescript
const l2Block = await publicClient.readContract({
  address: "0x0000000000000000000000000000000000000064",
  abi: [{ name: "arbBlockNumber", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] }],
  functionName: "arbBlockNumber",
});
```

## Cross-Chain Message Never Arrives (L2→L1)

**Symptoms**: Called `ArbSys.sendTxToL1()` on L2, but the L1 state never changes.

**Root Cause**: L2→L1 messages require manual execution on L1 after the 7-day challenge period. They do NOT auto-execute.

**Fix**:
1. Wait for the full 7-day challenge period after the L2 transaction
2. Use the Arbitrum SDK or manually construct the Outbox proof
3. Call `Outbox.executeTransaction()` on L1 with the proof

You can check if a message is ready to execute:
```typescript
// Use Arbitrum SDK for convenience
import { getL2ToL1MessageStatus, L2ToL1MessageStatus } from "@arbitrum/sdk";

// Status: UNCONFIRMED → CONFIRMED → EXECUTED
```

## Withdrawal Challenge Period (7 Days)

**Symptoms**: User expects instant withdrawal from L2 to L1.

**Root Cause**: Arbitrum is an optimistic rollup. All L2→L1 messages (including ETH and token withdrawals) must wait for the ~7-day challenge period to ensure no fraud proof is submitted.

**Workarounds**:
- Use a third-party fast bridge (Across, Stargate, Hop) for near-instant bridging at a small fee
- Native bridge withdrawals are always 7 days — no way to speed up

## Deployment with --legacy Flag Required

**Symptoms**: `forge create` or `forge script` fails with a cryptic RPC error like "invalid transaction type" or JSON-RPC error.

**Root Cause**: Arbitrum's sequencer does not accept EIP-1559 type-2 transaction envelopes from `forge`. The `--legacy` flag forces type-0 (legacy) transactions.

**Fix**:
```bash
forge create src/Contract.sol:Contract --rpc-url $ARBITRUM_RPC_URL --private-key $PRIVATE_KEY --legacy
forge script script/Deploy.s.sol --rpc-url $ARBITRUM_RPC_URL --private-key $PRIVATE_KEY --broadcast --legacy
```

This applies to Foundry specifically. Hardhat and viem handle transaction typing automatically.

## msg.sender Is Wrong in L1→L2 Contract Calls

**Symptoms**: An L1 contract sends a retryable ticket to an L2 contract, but `msg.sender` on L2 does not match the L1 contract address.

**Root Cause**: Address aliasing. When an L1 **contract** (not EOA) sends a retryable ticket, the `msg.sender` on L2 is offset by `0x1111000000000000000000000000000000001111` to prevent address collision attacks.

**Fix**: Reverse the alias in your L2 contract:

```solidity
function undoL1ToL2Alias(address l2Address) internal pure returns (address l1Address) {
    uint160 offset = uint160(0x1111000000000000000000000000000000001111);
    unchecked {
        l1Address = address(uint160(l2Address) - offset);
    }
}

modifier onlyL1Contract(address expectedL1Sender) {
    require(undoL1ToL2Alias(msg.sender) == expectedL1Sender, "NOT_FROM_L1");
    _;
}
```

Note: EOA-originated retryable tickets are NOT aliased. Only contract-originated ones.

## High Transaction Cost Despite "Cheap L2"

**Symptoms**: Transaction costs more than expected on Arbitrum.

**Root Cause**: The L1 data posting component dominates for transactions with large calldata. The L2 execution gas is cheap, but posting data to Ethereum L1 is not.

**Fix**:
- Minimize calldata size (use packed encoding, shorter function signatures)
- Use events instead of calldata for data that does not need to be in the transaction
- Check `ArbGasInfo.getPricesInWei()` for current L1 data costs
- After EIP-4844, Arbitrum uses blobs for data posting which reduced L1 costs significantly
