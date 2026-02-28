# Sei Troubleshooting

## PUSH0 Opcode Error on Deployment

**Symptoms**: Deployment fails with `invalid opcode` or bytecode verification fails with an unexpected opcode.

**Root Cause**: Sei's EVM is based on the `paris` hard fork and does not support the `PUSH0` opcode introduced in the Shanghai upgrade. If your Solidity compiler targets `shanghai` or later (the default for Solidity 0.8.20+), the compiled bytecode includes `PUSH0`.

**Fix**:

Foundry:
```toml
# foundry.toml
[profile.default]
evm_version = "paris"
```

Hardhat:
```typescript
// hardhat.config.ts
solidity: {
  version: "0.8.24",
  settings: {
    evmVersion: "paris",
  },
}
```

This must be set before compilation. If you already compiled, clean and rebuild:
```bash
# Foundry
forge clean && forge build

# Hardhat
npx hardhat clean && npx hardhat compile
```

## Address Not Found in Address Precompile

**Symptoms**: Calling `getSeiAddr()` or `getEvmAddr()` returns an empty or zero address.

**Root Cause**: The Address precompile can only convert addresses that have been "associated" -- meaning the owner has performed at least one transaction on Sei. Addresses that have never transacted on the chain do not have a linked address pair.

**Fix**:
1. Ensure the address has at least one transaction on Sei (a simple SEI transfer is sufficient)
2. For new addresses, send a small amount of SEI to the address first
3. The association happens automatically on the first transaction from or to that address

## Precompile Call Reverts with DELEGATECALL

**Symptoms**: Calling a Sei precompile from a proxy contract (which uses `DELEGATECALL`) fails with a revert or returns unexpected results.

**Root Cause**: Sei precompiles only support `CALL`. They do not support `DELEGATECALL`, `CALLCODE`, or `STATICCALL` for state-changing operations.

**Fix**:
- Call precompiles with a direct `CALL` from your contract
- If you are behind a proxy, use a helper contract that calls the precompile via a regular function call rather than delegating
- For read-only precompile operations, `STATICCALL` works on some precompiles (Bank read, Address, JSON, Pointer)

```solidity
// This works -- direct CALL to precompile
IStaking(0x0000000000000000000000000000000000001005).delegate{value: amount}(validator);

// This does NOT work -- DELEGATECALL to precompile
// (would happen if IStaking call is inside a DELEGATECALL context)
```

## Pointer Contract Not Found

**Symptoms**: Calling `getPointer()` returns `exists = false` for a token you expect to be available.

**Root Cause**: Pointer contracts are not created automatically for all tokens. They must be registered. Some well-known tokens (like native `usei`) have pointers registered at genesis, but newly deployed CW20 or ERC20 tokens need explicit registration.

**Fix**:
1. Check if the pointer exists: call `getPointer(pointerType, tokenId)` on the Pointer precompile (`0x...100b`)
2. If it does not exist, register it via the Sei CLI:
   ```bash
   # Register ERC20 pointer for a CW20 token
   seid tx evm register-evm-pointer CW20 <cw20_contract_address> --from <key> --fees 20000usei

   # Register CW20 pointer for an ERC20 token
   seid tx evm register-evm-pointer ERC20 <erc20_contract_address> --from <key> --fees 20000usei
   ```
3. After registration, the pointer contract is available immediately

## SEI Decimal Mismatch Between EVM and Cosmos

**Symptoms**: Token amounts appear 10^12 too large or too small when transferring between EVM and Cosmos contexts.

**Root Cause**: SEI uses 18 decimals in the EVM (like ETH) but 6 decimals in the Cosmos bank module (usei). This is a common source of confusion:
- 1 SEI = 1_000_000_000_000_000_000 wei (EVM, 18 decimals)
- 1 SEI = 1_000_000 usei (Cosmos, 6 decimals)

**Fix**: The chain handles conversion automatically when using precompiles and pointer contracts. You do not need to manually convert. But be aware:
- `msg.value` in Solidity is always 18 decimals
- Bank precompile `balance()` for `usei` returns the Cosmos-side balance (6 decimal base units, scaled to match)
- When calling the Bank precompile's `send()`, amounts follow the EVM 18-decimal convention
- When calling IBC precompile's `transfer()`, amounts are in the Cosmos 6-decimal convention for `usei`

## Contract Verification Fails on Seitrace

**Symptoms**: `forge verify-contract` returns an error or the verified source does not match.

**Root Cause**: Verification requires exact match of compiler version, optimizer settings, EVM version, and constructor arguments.

**Fix**:
```bash
# Check your exact compiler version
solc --version
# or
forge --version

# Verify with all settings explicit
forge verify-contract $ADDRESS src/MyContract.sol:MyContract \
  --chain 1329 \
  --verifier etherscan \
  --etherscan-api-key $SEITRACE_API_KEY \
  --verifier-url https://seitrace.com/api \
  --compiler-version v0.8.24+commit.e11b9ed9 \
  --num-of-optimizations 200

# If constructor args are needed
forge verify-contract $ADDRESS src/MyContract.sol:MyContract \
  --chain 1329 \
  --verifier etherscan \
  --etherscan-api-key $SEITRACE_API_KEY \
  --verifier-url https://seitrace.com/api \
  --constructor-args $(cast abi-encode "constructor(address)" 0xSomeAddress)
```

Ensure `evmVersion: "paris"` is set in your build config -- if verification was compiled with `shanghai` default, it will not match.

## IBC Transfer Timeout

**Symptoms**: IBC transfer via the precompile returns success but tokens never arrive on the destination chain.

**Root Cause**: The timeout was too short, or the relayer was slow, causing the packet to expire before relay.

**Fix**:
- Use a generous timeout. The IBC precompile accepts timeout in nanoseconds:
  ```solidity
  // 10 minutes from now, in nanoseconds
  uint64 timeout = uint64(block.timestamp + 600) * 1_000_000_000;
  ```
- Verify the IBC channel is active and has relayers running
- Check the packet status on the source chain's Cosmos RPC
- If the packet timed out, the tokens are refunded to the sender automatically

## Transaction Stuck or Pending

**Symptoms**: Transaction hash returned but never confirms.

**Root Cause**: Sei has ~390ms block times, so transactions should confirm almost instantly. A stuck transaction usually means:
1. Gas price too low (transaction not picked up by validators)
2. Nonce gap (a previous nonce was not filled)
3. RPC node is out of sync

**Fix**:
1. Check the transaction status: `cast receipt <hash> --rpc-url https://evm-rpc.sei-apis.com`
2. If gas is the issue, resubmit with higher gas: `cast send --nonce <same_nonce> --gas-price <higher>`
3. If nonce gap, fill the missing nonce with a zero-value transaction
4. Try a different RPC endpoint

## CosmWasm Query Returns Empty or Malformed Data

**Symptoms**: Calling the Wasm precompile's `query()` returns empty bytes or unparseable data.

**Root Cause**: The query message JSON does not match the CosmWasm contract's expected query schema, or the response encoding is unexpected.

**Fix**:
1. Verify the query message matches the contract's schema exactly (CosmWasm is strict about JSON structure)
2. Response is returned as raw bytes -- decode as UTF-8 JSON
3. Use the JSON precompile (`0x...1003`) to extract specific fields from the response
4. Test the query via Cosmos REST first:
   ```bash
   curl "https://rest.sei-apis.com/cosmwasm/wasm/v1/contract/<addr>/smart/$(echo -n '{"token_info":{}}' | base64)"
   ```
