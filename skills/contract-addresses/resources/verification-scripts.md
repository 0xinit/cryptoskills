# Contract Address Verification Scripts

Scripts for verifying contract addresses onchain before production use.

## Check If a Contract Exists

```bash
cast code 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --rpc-url $ETH_RPC_URL
# Returns bytecode if contract exists, "0x" if EOA or empty
```

## Read Immutable State to Confirm Identity

```bash
cast call $ADDRESS "name()(string)" --rpc-url $ETH_RPC_URL
cast call $ADDRESS "symbol()(string)" --rpc-url $ETH_RPC_URL
cast call $ADDRESS "decimals()(uint8)" --rpc-url $ETH_RPC_URL
cast call $ADDRESS "owner()(address)" --rpc-url $ETH_RPC_URL
```

## Etherscan API Verification

```bash
# Check if source is verified ("1" = verified, "0" = not)
curl -s "https://api.etherscan.io/api?module=contract&action=getabi\
&address=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48\
&apikey=$ETHERSCAN_API_KEY" | jq '.status'

# Get source code and compiler settings
curl -s "https://api.etherscan.io/api?module=contract&action=getsourcecode\
&address=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48\
&apikey=$ETHERSCAN_API_KEY" | jq '.result[0].ContractName'
```

Chain-specific API base URLs:
- Ethereum: `api.etherscan.io`
- Arbitrum: `api.arbiscan.io`
- Optimism: `api-optimistic.etherscan.io`
- Base: `api.basescan.org`
- Polygon: `api.polygonscan.com`

## Proxy Implementation Verification (EIP-1967)

```bash
# EIP-1967 implementation slot: keccak256("eip1967.proxy.implementation") - 1
IMPL_SLOT="0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"

# EIP-1967 admin slot: keccak256("eip1967.proxy.admin") - 1
ADMIN_SLOT="0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103"

# EIP-1967 beacon slot: keccak256("eip1967.proxy.beacon") - 1
BEACON_SLOT="0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50"

# Read and convert implementation address
IMPL_RAW=$(cast storage $PROXY_ADDRESS $IMPL_SLOT --rpc-url $ETH_RPC_URL)
IMPL_ADDRESS=$(cast to-check-sum-address "0x${IMPL_RAW:26}")
echo "Implementation: $IMPL_ADDRESS"
```

## Code Hash Verification

```bash
EXPECTED="0x..." # known-good hash from official deployment
ACTUAL=$(cast keccak $(cast code $ADDRESS --rpc-url $ETH_RPC_URL))
[ "$EXPECTED" = "$ACTUAL" ] && echo "MATCH" || echo "MISMATCH"
```

## Multi-Chain Verification Script

```bash
#!/usr/bin/env bash
set -euo pipefail

ADDRESS="${1:?Usage: verify-multichain.sh <address>}"

declare -A RPCS=(
  [ethereum]="$ETH_RPC_URL" [arbitrum]="$ARB_RPC_URL" [optimism]="$OP_RPC_URL"
  [base]="$BASE_RPC_URL"    [polygon]="$POLYGON_RPC_URL"
)

for chain in "${!RPCS[@]}"; do
  CODE=$(cast code "$ADDRESS" --rpc-url "${RPCS[$chain]}" 2>/dev/null || echo "RPC_ERROR")
  if [ "$CODE" = "RPC_ERROR" ]; then printf "%-12s  RPC error\n" "$chain"
  elif [ "$CODE" = "0x" ];       then printf "%-12s  NO CONTRACT\n" "$chain"
  else printf "%-12s  EXISTS  code_hash=%s\n" "$chain" "$(cast keccak "$CODE")"
  fi
done
```

## Full Verification Checklist Script

Single-address deep check: existence, identity reads, proxy detection, code hash.

```bash
#!/usr/bin/env bash
set -euo pipefail

ADDRESS="${1:?Usage: verify-contract.sh <address>}"
RPC="${2:-$ETH_RPC_URL}"
IMPL_SLOT="0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
ZERO="0x0000000000000000000000000000000000000000000000000000000000000000"

CODE=$(cast code "$ADDRESS" --rpc-url "$RPC")
[ "$CODE" = "0x" ] && echo "FAIL: No contract at $ADDRESS" && exit 1
echo "PASS: Contract exists ($(echo -n "$CODE" | wc -c) bytes)"

for FN in "name()(string)" "symbol()(string)" "decimals()(uint8)"; do
  echo "  $FN -> $(cast call "$ADDRESS" "$FN" --rpc-url "$RPC" 2>/dev/null || echo "N/A")"
done

IMPL_RAW=$(cast storage "$ADDRESS" "$IMPL_SLOT" --rpc-url "$RPC")
if [ "$IMPL_RAW" != "$ZERO" ]; then
  echo "PROXY: Implementation at $(cast to-check-sum-address "0x${IMPL_RAW:26}")"
fi
echo "CODE HASH: $(cast keccak "$CODE")"
```
