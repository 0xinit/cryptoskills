# Cast Commands Reference

`cast` is Foundry's CLI for interacting with EVM chains. It reads state, sends transactions, encodes/decodes data, and queries blocks.

## Reading State (Free, No Gas)

### cast call

Simulate a function call without sending a transaction. Returns the function's return value.

```bash
# Read balanceOf
cast call 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  "balanceOf(address)(uint256)" \
  0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 \
  --rpc-url $MAINNET_RPC_URL

# Read multiple return values
cast call 0x1F98431c8aD98523631AE4a59f267346ea31F984 \
  "getPool(address,address,uint24)(address)" \
  0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 \
  0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  3000 \
  --rpc-url $MAINNET_RPC_URL
```

### cast storage

Read a raw storage slot.

```bash
# Read slot 0 of USDC (proxy implementation address lives here on some contracts)
cast storage 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 0 --rpc-url $MAINNET_RPC_URL

# Read a specific mapping slot: keccak256(abi.encode(key, slotIndex))
cast index address 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 9
# Then: cast storage <contract> <computed_slot> --rpc-url $RPC
```

### cast code

Check if an address is a contract (has bytecode).

```bash
cast code 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --rpc-url $MAINNET_RPC_URL
# Returns bytecode if contract, "0x" if EOA
```

## Writing State (Costs Gas)

### cast send

Submit a state-changing transaction. Returns a transaction receipt, NOT the return value.

```bash
# Transfer ERC20
cast send 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  "transfer(address,uint256)" \
  0xRecipient 1000000 \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY

# Send ETH
cast send 0xRecipient \
  --value 0.1ether \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY

# With gas overrides
cast send 0xContract "deposit()" \
  --value 1ether \
  --gas-limit 100000 \
  --gas-price 30gwei \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY

# Legacy transaction (for chains without EIP-1559)
cast send 0xContract "deposit()" \
  --legacy \
  --rpc-url $CUSTOM_RPC \
  --private-key $PRIVATE_KEY
```

### cast estimate

Estimate gas for a transaction without sending it.

```bash
cast estimate 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  "transfer(address,uint256)" \
  0xRecipient 1000000 \
  --rpc-url $MAINNET_RPC_URL
```

## ABI Encoding / Decoding

### cast abi-encode

Encode function arguments (for constructor args, script inputs).

```bash
# Encode constructor args
cast abi-encode "constructor(address,uint256)" 0xOwnerAddress 1000000

# Encode function call data
cast abi-encode "transfer(address,uint256)" 0xRecipient 1000000
```

### cast abi-decode

Decode ABI-encoded data back to human-readable values.

```bash
# Decode output data
cast abi-decode "balanceOf(address)(uint256)" 0x00000000000000000000000000000000000000000000000000000000000f4240

# Decode input data (calldata)
cast abi-decode --input "transfer(address,uint256)" 0xa9059cbb...
```

## Function Selectors

### cast sig

Compute the 4-byte function selector.

```bash
cast sig "transfer(address,uint256)"
# 0xa9059cbb

cast sig "approve(address,uint256)"
# 0x095ea7b3

# Event topic
cast sig-event "Transfer(address,address,uint256)"
# 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
```

### cast 4byte

Reverse-lookup a selector from the 4byte.directory.

```bash
cast 4byte 0xa9059cbb
# transfer(address,uint256)
```

### cast 4byte-decode

Decode full calldata using the 4byte directory.

```bash
cast 4byte-decode 0xa9059cbb0000000000000000000000001234...0000000000000000000000000000000000000f4240
```

## Transaction & Block Queries

### cast tx

Get transaction details.

```bash
cast tx 0xTRANSACTION_HASH --rpc-url $MAINNET_RPC_URL

# Specific field
cast tx 0xTRANSACTION_HASH gasPrice --rpc-url $MAINNET_RPC_URL
```

### cast receipt

Get transaction receipt (status, gas used, logs).

```bash
cast receipt 0xTRANSACTION_HASH --rpc-url $MAINNET_RPC_URL

# Check if transaction succeeded
cast receipt 0xTRANSACTION_HASH status --rpc-url $MAINNET_RPC_URL
# 1 = success, 0 = revert
```

### cast block

Query block data.

```bash
# Latest block
cast block latest --rpc-url $MAINNET_RPC_URL

# Specific block
cast block 19000000 --rpc-url $MAINNET_RPC_URL

# Specific field
cast block latest baseFeePerGas --rpc-url $MAINNET_RPC_URL

# Current block number
cast block-number --rpc-url $MAINNET_RPC_URL
```

## Wallet Operations

### cast wallet

```bash
# Generate a new keypair
cast wallet new

# Get address from private key
cast wallet address --private-key $PRIVATE_KEY

# Sign a message
cast wallet sign "hello world" --private-key $PRIVATE_KEY

# Verify a signature
cast wallet verify --address 0xSigner "hello world" 0xSignature
```

## Unit Conversion

```bash
# ETH to wei
cast to-wei 1.5 ether
# 1500000000000000000

# Wei to ETH
cast from-wei 1000000000000000000
# 1.000000000000000000

# Gwei to wei
cast to-wei 30 gwei
# 30000000000

# Hex to decimal
cast to-dec 0xff
# 255

# Decimal to hex
cast to-hex 255
# 0xff

# Format with units
cast to-unit 1000000 6
# 1.000000
```

## ENS Resolution

```bash
# Resolve ENS name to address
cast resolve-name vitalik.eth --rpc-url $MAINNET_RPC_URL

# Reverse lookup: address to ENS name
cast lookup-address 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --rpc-url $MAINNET_RPC_URL
```

## References

- [Cast Reference](https://book.getfoundry.sh/reference/cast/)
- [Cast CLI Cheatsheet](https://book.getfoundry.sh/reference/cast/cast)
