# Contract Addresses Troubleshooting

Common issues when working with contract addresses across EVM chains.

## Address Works on Mainnet but Not Testnet

Testnet deployments use different addresses. Protocols rarely deploy at the same address on testnets.

**Fix:** Check the protocol's official docs for testnet-specific addresses, or their GitHub deployments directory.

```bash
cast code 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --rpc-url $SEPOLIA_RPC_URL
# Returns "0x" — USDC mainnet address does not exist on Sepolia
```

## Proxy vs Implementation Address Confusion

The proxy is the stable address you interact with. The implementation holds the logic and can change via governance. Most DeFi protocols use this pattern.

**Symptoms:** ABI mismatch errors, or Etherscan returning a minimal proxy ABI.

**Fix:**
```bash
IMPL_SLOT="0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
cast storage $PROXY_ADDRESS $IMPL_SLOT --rpc-url $ETH_RPC_URL
```

Always interact with the proxy address. Only read the implementation to get the correct ABI.

## Checksummed vs Non-Checksummed Addresses

EIP-55 mixed-case checksums prevent mistyped addresses. Some tools reject non-checksummed input.

**Symptoms:** "Invalid address" errors from viem, ethers, or Foundry. Address comparisons fail despite identical hex.

**Fix:**
```bash
cast to-check-sum-address 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
# Output: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```

Always store and compare addresses in checksummed form. Use `getAddress()` in viem/ethers to normalize.

## Address on Wrong Chain

The same hex address on different chains may point to a different contract or nothing at all.

**Symptoms:** Transaction reverts, `cast code` returns `0x`, or `symbol()` returns something unexpected.

**Fix:**
```bash
cast call $ADDRESS "symbol()(string)" --rpc-url $ARB_RPC_URL
cast call $ADDRESS "symbol()(string)" --rpc-url $OP_RPC_URL
```

Exceptions (deterministic CREATE2 deploys share addresses across chains):
- Multicall3: `0xcA11bde05977b3631167028862bE2a173976CA11`
- Permit2: `0x000000000022D473030F116dDEE9F6B43aC78BA3`
- OP Stack predeploys: `0x4200...` on all OP Stack chains
- Uniswap Universal Router: same on most chains

## Contract Self-Destructed

Before Dencun (March 2024), `SELFDESTRUCT` removed contract code. Post-Dencun, it only transfers ETH without removing code.

**Symptoms:** Historical references point to an address where `cast code` returns `0x`.

**Fix:** Run `cast code $ADDRESS --rpc-url $ETH_RPC_URL`. If `0x`, check Etherscan's "Self Destruct" tab. For pre-Dencun contracts, always verify code exists before interacting.

## Address From Old Deployment (Protocol Upgraded)

Protocols deploy new contracts and migrate state. Old addresses may have code but are no longer canonical.

**Symptoms:** Calls succeed but return stale data. Liquidity/TVL is zero. Official frontend uses a different address.

**How to find canonical addresses:**

1. **Official docs** -- Always the primary source. Most protocols maintain a deployments page.
2. **GitHub deployments** -- Search for `deployments/` or `addresses.json` in the protocol repo.
3. **On-chain registries** -- Some protocols resolve addresses dynamically:
   ```bash
   # Aave PoolAddressesProvider returns the current Pool
   cast call 0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e \
     "getPool()(address)" --rpc-url $ETH_RPC_URL
   ```
4. **Block explorer** -- Check if activity has dropped to zero (sign of deprecation).

## Bridged vs Native Token Confusion

Many L2s have both a legacy bridged version and a native version of the same token (especially USDC). Swap fails or balance shows zero when querying the wrong variant.

**Fix:** Differentiate by reading the contract name:
```bash
cast call 0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8 "name()(string)" --rpc-url $ARB_RPC_URL
# "Bridged USDC" (USDC.e — legacy)
cast call 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 "name()(string)" --rpc-url $ARB_RPC_URL
# "USD Coin" (native USDC — preferred)
```

Always use native unless the protocol explicitly requires bridged. Circle is deprecating bridged USDC across all L2s.
