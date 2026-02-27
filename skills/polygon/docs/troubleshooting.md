# Polygon Troubleshooting

Common issues and solutions when building on Polygon PoS and zkEVM.

## PoS Bridge: Deposit Not Arriving on Polygon

**Symptoms:** Deposit transaction confirmed on Ethereum but tokens not appearing on Polygon PoS.

**Cause:** State sync from Ethereum to Polygon takes ~7-8 minutes. During congestion, it can take up to 20 minutes.

**Solutions:**
1. Wait 20 minutes before investigating further
2. Verify deposit tx was successful on Etherscan
3. Check state sync status:
   ```bash
   # Check the state sync event ID from your tx
   curl "https://proof-generator.polygon.technology/api/v1/matic/state-sync-status?fromBlock=<L1_BLOCK>&toBlock=<L1_BLOCK>&networkType=mainnet"
   ```
4. If stuck beyond 30 minutes, the Heimdall state sync may be delayed -- check [Polygon Status](https://status.polygon.technology)

## PoS Bridge: Withdrawal Pending for Hours

**Symptoms:** Burned tokens on Polygon but cannot exit on Ethereum.

**Cause:** Withdrawals require a checkpoint that includes the burn block. Checkpoints are submitted every ~30 minutes, but can be delayed.

**Solutions:**
1. Check if your block is checkpointed:
   ```typescript
   const response = await fetch(
     `https://proof-generator.polygon.technology/api/v1/matic/block-included/${blockNumber}?networkType=mainnet`
   );
   const data = await response.json();
   console.log(data.message); // "success" if checkpointed
   ```
2. If not checkpointed after 1 hour, check [Polygon Status](https://status.polygon.technology) for checkpoint delays
3. Once checkpointed, fetch exit proof and submit on Ethereum:
   ```bash
   curl "https://proof-generator.polygon.technology/api/v1/matic/exit-payload/<BURN_TX_HASH>?eventSignature=0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036"
   ```

## zkEVM: Transaction Stuck as "Trusted"

**Symptoms:** Transaction appears confirmed but never reaches "consolidated" (proven on L1).

**Cause:** ZK proof generation takes time. The aggregator batches transactions and generates proofs periodically (~30 min to several hours).

**Solutions:**
1. Check finality state:
   ```typescript
   // Get latest consolidated block
   const consolidated = await client.request({
     method: "zkevm_consolidatedBlockNumber" as "eth_blockNumber",
     params: [],
   });
   ```
2. If your transaction block > consolidated block, the proof hasn't been generated yet
3. For most applications, "trusted" state is safe for <$10k transactions since the sequencer has economic incentives to include valid transactions
4. For high-value operations, wait for "consolidated" state before proceeding

## Gas Estimation Failing on PoS

**Symptoms:** `estimateGas` returns unexpected values or reverts.

**Cause:** Polygon PoS gas prices change rapidly. Between estimation and submission, gas prices can shift significantly.

**Solutions:**
1. Add a gas buffer:
   ```typescript
   const gasEstimate = await publicClient.estimateGas({ ... });
   // Add 20% buffer for PoS gas volatility
   const gasWithBuffer = (gasEstimate * 120n) / 100n;
   ```
2. Use `maxFeePerGas` with headroom:
   ```typescript
   const block = await publicClient.getBlock();
   const baseFee = block.baseFeePerGas ?? 0n;
   // Double the base fee for safety margin
   const maxFeePerGas = baseFee * 2n;
   ```
3. Monitor gas oracle endpoints for current pricing

## MATIC vs POL Confusion

**Symptoms:** Transactions fail or wrong token sent/received.

**Clarification:**
- **Polygon PoS native gas token**: Now called POL (was MATIC). The wrapped version (`0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270`) is WPOL (same address as old WMATIC).
- **MATIC on Ethereum**: Still exists at `0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0`. Should be migrated to POL via the migration contract.
- **POL on Ethereum**: `0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6`. This is the new canonical token.
- **zkEVM gas token**: ETH, not POL or MATIC.

**If you see "MATIC" in code or docs:**
- On Polygon PoS chain: it's now POL (same addresses, rebranded)
- On Ethereum: migrate to POL via `0x29e7DF7b6c1264C3F63e2E7bB27143EeB8A05fe3`

## Contract Verification Failing on Polygonscan

**Symptoms:** `forge verify-contract` or Hardhat verify returns errors.

**Solutions:**

1. **Wrong compiler version**: Ensure the Solidity version matches exactly:
   ```bash
   forge verify-contract <ADDRESS> src/Contract.sol:Contract \
     --compiler-version v0.8.24+commit.e11b9ed9 \
     --chain-id 137 \
     --verifier-url https://api.polygonscan.com/api \
     --etherscan-api-key $POLYGONSCAN_API_KEY
   ```

2. **Constructor args mismatch**: Encode constructor args properly:
   ```bash
   forge verify-contract <ADDRESS> src/Token.sol:Token \
     --chain-id 137 \
     --verifier-url https://api.polygonscan.com/api \
     --etherscan-api-key $POLYGONSCAN_API_KEY \
     --constructor-args $(cast abi-encode "constructor(string,string,uint8)" "MyToken" "MTK" 18)
   ```

3. **Optimizer settings mismatch**: Make sure `foundry.toml` optimizer settings match what was used during deployment:
   ```toml
   [profile.default]
   optimizer = true
   optimizer_runs = 200
   ```

4. **Polygonscan API key issues**: Get a separate API key from https://polygonscan.com (free). Note: the same key works for mainnet, Amoy, and zkEVM explorers.

## zkEVM: Contract Reverts Due to Opcode Differences

**Symptoms:** Contract works on Ethereum/PoS but reverts on zkEVM.

**Common Causes:**
1. **Using `block.prevrandao`**: Returns `0` on zkEVM. Replace with Chainlink VRF.
2. **Using `SELFDESTRUCT`**: Disabled on zkEVM. Refactor to use access control + withdraw pattern.
3. **Precompile gas costs**: `modexp` precompile has higher gas costs. Increase gas limit if using RSA verification or similar.
4. **Assembly with `DIFFICULTY`**: Same issue as `prevrandao`. Check inline assembly for this opcode.

**Debug approach:**
```bash
# Trace the transaction on zkEVM
cast run <TX_HASH> --rpc-url https://zkevm-rpc.com

# Compare gas usage between chains
cast estimate --rpc-url https://polygon-rpc.com <CONTRACT> "functionSig()"
cast estimate --rpc-url https://zkevm-rpc.com <CONTRACT> "functionSig()"
```

## zkEVM Bridge: Claim Window Issues

**Symptoms:** Cannot claim bridged assets on destination chain.

**Solutions:**
1. Verify the deposit is ready for claim:
   ```bash
   curl "https://bridge-api.zkevm-rpc.com/bridges/<YOUR_ADDRESS>?offset=0&limit=25"
   ```
   Check `ready_for_claim` field is `true`.

2. If not ready, wait for proof generation (10-30 minutes).

3. If ready but claim fails, re-fetch the Merkle proof:
   ```bash
   curl "https://bridge-api.zkevm-rpc.com/merkle-proof?deposit_cnt=<DEPOSIT_COUNT>&net_id=<NET_ID>"
   ```
   The exit root may have updated since you last fetched the proof.

4. Ensure you're calling `claimAsset` on the correct destination chain (Ethereum for L2->L1, zkEVM for L1->L2).

## High Gas on Polygon PoS

**Symptoms:** Gas prices spiking to 500+ gwei.

**Causes:**
- NFT mint events or popular token launches
- Bot activity (MEV, arbitrage)
- Network congestion from high-volume protocols

**Solutions:**
1. Use gas oracles for real-time pricing:
   ```typescript
   const gasPrice = await publicClient.getGasPrice();
   ```
2. Set reasonable `maxFeePerGas` to avoid overpaying during spikes
3. Use EIP-1559 transaction type for better gas control:
   ```typescript
   const block = await publicClient.getBlock();
   const baseFee = block.baseFeePerGas ?? 30000000000n;
   // Priority fee of 30 gwei is usually sufficient
   const maxPriorityFeePerGas = 30000000000n;
   const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas;
   ```
4. For non-urgent transactions, queue and submit during low-gas periods (typically early UTC morning)
