# Axelar Troubleshooting Guide

Common issues and solutions when integrating Axelar GMP, ITS, and cross-chain token transfers.

## Message Never Executes on Destination

**Symptoms:**
- Source transaction succeeded
- Axelarscan shows the message but it never reaches "executed"
- Destination contract's `_execute()` is never called

**Solutions:**

1. **Verify gas was paid.** Search for `GasPaidForContractCall` or `GasPaidForContractCallWithToken` event in the source transaction receipt. If absent, gas was not paid and the relayer will not deliver.

   ```typescript
   const receipt = await publicClient.getTransactionReceipt({ hash: sourceTxHash });
   const gasServiceAbi = parseAbi([
     "event GasPaidForContractCall(address indexed sourceAddress, string destinationChain, string destinationAddress, bytes32 indexed payloadHash, address gasToken, uint256 gasFeeAmount, address refundAddress)",
   ]);

   const gasPaidLogs = receipt.logs.filter(
     (log) => log.address.toLowerCase() === "0x2d5d7d31F671F86C782533cc367F14109a082712".toLowerCase()
   );

   if (gasPaidLogs.length === 0) {
     console.log("Gas was NOT paid -- message will not be relayed");
   }
   ```

2. **Add more gas to an underfunded message:**
   ```typescript
   const addGasAbi = parseAbi([
     "function addNativeGas(bytes32 txHash, uint256 logIndex, address refundAddress) payable",
   ]);

   const { request } = await publicClient.simulateContract({
     address: "0x2d5d7d31F671F86C782533cc367F14109a082712",
     abi: addGasAbi,
     functionName: "addNativeGas",
     args: [sourceTxHash, 0n, account.address],
     value: additionalGas,
     account: account.address,
   });
   ```

3. **Manually relay the message:**
   ```typescript
   import { AxelarGMPRecoveryAPI, Environment } from "@axelar-network/axelarjs-sdk";

   const gmpApi = new AxelarGMPRecoveryAPI({
     environment: Environment.MAINNET,
   });

   await gmpApi.manualRelayToDestChain(sourceTxHash);
   ```

## `_execute()` Reverts on Destination

**Symptoms:**
- Axelarscan shows "error" or "insufficient_gas" on destination
- Message was approved but execution failed

**Solutions:**

1. **Increase gas estimation.** The most common cause. Start with a higher gas limit:
   ```typescript
   const gasFee = await axelarQuery.estimateGasFee(
     "ethereum",
     "arbitrum",
     500000, // increase from default 250k
     "auto",
   );
   ```

2. **Check trusted remote configuration.** If your contract validates `sourceChain` and `sourceAddress`, ensure the mapping is set correctly:
   ```bash
   # Check trusted remote on destination
   cast call <destination_contract> \
     "trustedRemotes(string)(string)" "ethereum" \
     --rpc-url $DST_RPC_URL
   ```

3. **Verify payload encoding matches decoding.** If source encodes `abi.encode(address, uint256)` but destination decodes `abi.decode(payload, (uint256, address))`, the decode will fail or produce garbage.

4. **Test `_execute` in isolation.** Use `cast call` to simulate:
   ```bash
   cast call <destination_contract> \
     "execute(bytes32,string,string,bytes)" \
     <commandId> "ethereum" "0xsource..." "0xpayload..." \
     --rpc-url $DST_RPC_URL
   ```

## Source Transaction Reverts

**Symptoms:**
- Transaction reverts immediately on the source chain
- Never reaches the Axelar network

**Solutions:**

1. **Check `msg.value` is non-zero.** Gas payment requires native token:
   ```typescript
   const gasFee = await estimateGasFee("ethereum", "arbitrum", 250000n);
   // gasFee must be passed as value
   ```

2. **Check token allowance for `callContractWithToken`.** The contract must have approval to spend tokens:
   ```bash
   cast call <token> "allowance(address,address)(uint256)" \
     <your_contract> <gateway> --rpc-url $RPC_URL
   ```

3. **Verify the token symbol is registered.** Only Axelar-supported tokens work with `callContractWithToken`:
   ```bash
   cast call 0x4F4495243837681061C4743b74B3eEdf548D56A5 \
     "tokenAddresses(string)(address)" "axlUSDC" --rpc-url $ETH_RPC_URL
   ```

## ITS Token Deployment Fails on Remote Chain

**Symptoms:**
- `deployRemoteInterchainToken` succeeds on source
- Token does not appear on destination chain

**Solutions:**

1. **Wait for execution.** Remote deployment is a GMP call that must go through Axelar consensus. Check axelarscan for the status.

2. **Ensure sufficient gas.** Remote deployments require more gas than simple messages (500k-700k gas limit):
   ```typescript
   const gasFee = await axelarQuery.estimateGasFee(
     "ethereum",
     "arbitrum",
     700000,
     "auto",
   );
   ```

3. **Verify the salt matches.** Tokens are linked by `keccak256(abi.encode(deployer, salt))`. Using a different salt or deployer on different chains creates unlinked tokens.

4. **Check if already deployed.** If the token is already deployed on the remote chain, the deployment will revert with `AlreadyDeployed`:
   ```bash
   cast call 0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C \
     "tokenManagerAddress(bytes32)(address)" <tokenId> \
     --rpc-url $DST_RPC_URL
   ```

## Wrong Chain Name

**Symptoms:**
- Message submitted but never appears on any destination
- Or appears on wrong chain

**Solutions:**

1. **Use exact Axelar chain names.** They are lowercase strings:
   - `"ethereum"` NOT `"Ethereum"` or `"eth"` or `1`
   - `"arbitrum"` NOT `"arbitrum-one"` or `"arb"` or `42161`
   - `"binance"` NOT `"bnb"` or `"bsc"` or `56`

2. **Validate before sending:**
   ```typescript
   const VALID_CHAINS = new Set([
     "ethereum", "arbitrum", "optimism", "base", "polygon",
     "avalanche", "binance", "fantom", "celo", "moonbeam",
   ]);

   function validateChainName(chain: string): void {
     if (!VALID_CHAINS.has(chain)) {
       throw new Error(`Invalid Axelar chain name: "${chain}"`);
     }
   }
   ```

## Gas Estimation Returns Unexpected Values

**Symptoms:**
- SDK returns 0 or unreasonably high fee
- API returns error

**Solutions:**

1. **Check chain name spelling.** The SDK uses the same Axelar chain names.

2. **Fallback to the REST API:**
   ```typescript
   const url = `https://api.axelarscan.io/cross-chain/transfer-fee?source_chain=${src}&destination_chain=${dst}&gas_limit=${gasLimit}`;
   const response = await fetch(url);
   ```

3. **Use a manual estimate as fallback.** For Ethereum -> L2, 0.001 ETH typically covers 300k gas.

## Debug Checklist

- [ ] Gateway address is correct for this chain (see contract-addresses resource)
- [ ] GasService address is correct for this chain
- [ ] Using Axelar chain name strings, NOT numeric chain IDs
- [ ] Chain name is lowercase and exact (e.g., `"ethereum"` not `"Ethereum"`)
- [ ] Gas paid BEFORE calling `gateway.callContract()`
- [ ] `msg.value` is non-zero when paying gas
- [ ] Trusted remote set on destination contract for source chain
- [ ] `sourceAddress` in trusted remote is lowercase hex string
- [ ] Token approved and sufficient balance for `callContractWithToken`
- [ ] Payload encoding on source matches decoding on destination
- [ ] Transaction simulated before broadcasting

## Reference

- [Axelar GMP Recovery SDK](https://github.com/axelarnetwork/axelarjs-sdk)
- [Axelarscan Explorer](https://axelarscan.io)
- [Axelar Documentation](https://docs.axelar.dev/)
