# Troubleshooting

## eth_sendRawTransactionSync Not Working

**Symptom**: Method returns an error or behaves like standard `eth_sendRawTransaction`.

**Causes and fixes**:
- **Method name typo**: Ensure exact spelling `eth_sendRawTransactionSync` (capital S). The legacy `realtime_sendRawTransaction` also works.
- **RPC provider does not support it**: Only MegaETH native endpoints support this method. Third-party providers (Alchemy, QuickNode) may proxy it or return "method not found". Verify with the provider.
- **Transaction invalid**: The method still validates the transaction before execution. Check that nonce, gas limit, and signature are correct.
- **"already known" error**: Transaction is already in the mempool from a previous submission. Wait for it to execute or increment the nonce.
- **"nonce too low" error**: Transaction was already executed. Query the receipt with `eth_getTransactionReceipt` using the tx hash.

```bash
# Verify the method works
curl -X POST https://mainnet.megaeth.com/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_sendRawTransactionSync","params":["0x...signedTx"],"id":1}'
```

## Instant Receipt Timing Issues

**Symptom**: Receipt takes longer than expected (>100ms instead of <10ms).

**Causes**:
- **HTTP cold start**: First request incurs DNS + TCP + TLS overhead (50-200ms). Warm up connections on app init by calling `eth_chainId`.
- **Geographic distance**: Cross-continent RTT adds 150-300ms. Use Alchemy/QuickNode geo-distributed endpoints or WebSocket for 5-6x faster responses.
- **Network congestion**: During high load, receipts may take slightly longer.

```typescript
// Warm up on app init
await publicClient.getChainId();
```

## Gas Estimation Failures

**Symptom**: `eth_estimateGas` returns errors or wildly incorrect values.

**Causes and fixes**:
- **Local simulation mismatch**: Foundry/Hardhat use standard EVM costs. MegaEVM intrinsic gas is 60,000, not 21,000. Use `--skip-simulation` with Foundry.
- **10M gas cap**: Public endpoints cap `eth_estimateGas` at 10M gas. For complex contracts, use a VIP endpoint.
- **Volatile data access**: If your contract accesses `block.timestamp` before heavy computation, the 20M gas limit kicks in. Restructure to access metadata late.
- **`via_ir=true` in foundry.toml**: This silently breaks return values. Remove it and use `optimizer=true` with `optimizer_runs=200`.

```bash
# Skip local simulation
forge script Deploy.s.sol --gas-limit 5000000 --skip-simulation --broadcast
```

## MegaNames Registration Fails

**Symptom**: `register()` or `registerWithPermit()` reverts.

**Causes and fixes**:
- **Insufficient USDM approval**: Ensure USDM is approved for the MegaNames contract (`0x5B424C6CCba77b32b9625a6fd5A30D409d20d997`) with enough allowance.
- **Invalid label**: Labels must match `[a-z0-9-]`, no leading/trailing hyphens, max 255 chars. Uppercase, spaces, dots, emoji, and special characters are rejected.
- **Registration gated**: The `registrationOpen` flag may be false. Check with the contract owner.
- **Name already taken**: Query `ownerOf(tokenId)` to check if the name is registered. Use the token ID computation from the MegaNames docs.
- **Permit expired**: For `registerWithPermit()`, ensure the `deadline` has not passed.

```solidity
// Check if name is available
uint256 tokenId = uint256(keccak256(abi.encodePacked(MEGA_NODE, keccak256(bytes("yourname")))));
try megaNames.ownerOf(tokenId) returns (address owner) {
    // Name is taken
} catch {
    // Name is available
}
```

## Bridge Deposit Not Credited

**Symptom**: ETH sent to the L1 bridge contract but not appearing on MegaETH.

**Causes and fixes**:
- **Finalization delay**: Bridge deposits require Ethereum L1 finalization (~15 minutes). Check the bridge status on the MegaETH explorer.
- **Wrong bridge address**: Ensure you sent to `0x0CA3A2FBC3D770b578223FBB6b062fa875a2eE75` (L1StandardBridgeProxy on Ethereum mainnet).
- **Gas limit too low on L2**: If using `depositETH()`, the `_minGasLimit` parameter must be at least 61,000 (MegaETH intrinsic gas).
- **Transaction reverted on L1**: Check the L1 transaction receipt for revert reasons.

```bash
# Check balance on MegaETH
cast balance <your-address> --rpc-url https://mainnet.megaeth.com/rpc
```

## WebSocket Subscription Drops

**Symptom**: WebSocket connection closes unexpectedly or stops receiving events.

**Causes and fixes**:
- **No keepalive**: Connections drop after idle period. Send `eth_chainId` every 30 seconds.
- **Connection limit**: VIP endpoints allow 50 connections, 10 subscriptions per connection. Check if you are exceeding limits.
- **Network interruption**: Implement automatic reconnection with exponential backoff.
- **Per-user connections**: Never open a WebSocket per user. Use one server-side connection and broadcast to clients.

```typescript
const ws = new WebSocket('wss://mainnet.megaeth.com/ws');

ws.on('close', () => {
  setTimeout(() => reconnect(), 1000);
});

const keepalive = setInterval(() => {
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'eth_chainId',
    params: [],
    id: Date.now()
  }));
}, 30000);
```

## Storage Optimization Misconfigurations

**Symptom**: Unexpectedly high gas costs for state-modifying transactions.

**Causes and fixes**:
- **New slot allocation**: SSTORE 0-to-nonzero costs 2M+ gas with bucket multiplier. Use RedBlackTreeLib or circular buffers for slot reuse.
- **Dynamic mappings**: Each new key in a `mapping` allocates a new slot. Replace with fixed-size arrays or tree structures.
- **Large event data**: LOG opcodes have quadratic cost above 4KB. Emit hashes instead of full data.
- **Transient storage not used**: For reentrancy guards and temporary state, use EIP-1153 `TSTORE`/`TLOAD` to avoid storage gas entirely.

```bash
# Profile gas by opcode
mega-evme replay <txhash> --trace --trace.output trace.json
python trace_opcode_gas.py trace.json
```

Look for high SSTORE counts with 0-to-non-zero transitions.

## "Intrinsic Gas Too Low" on Deployment

**Symptom**: Contract deployment fails with "intrinsic gas too low".

**Fix**: MegaETH intrinsic gas is 60,000, not 21,000. For large contracts (25KB+ bytecode), use `--gas-limit 500000000` (500M).

```bash
forge script Deploy.s.sol \
  --rpc-url https://mainnet.megaeth.com/rpc \
  --gas-limit 500000000 \
  --skip-simulation \
  --broadcast
```

## "Block Pruned" on Historical eth_call

**Symptom**: `eth_call` with a past block number returns "block pruned" or similar error.

**Fix**: Public endpoint only keeps ~15 days of state. Use Alchemy/QuickNode for historical queries, run an archive node, or use Envio HyperSync for indexed data.
