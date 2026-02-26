#!/usr/bin/env bash
set -euo pipefail

# Monad deployment script for Foundry
# Usage:
#   ./deploy-monad.sh <contract_path:ContractName> [constructor_args...]
#
# Environment variables:
#   DEPLOYER_ACCOUNT  — Foundry keystore account name (default: monad-deployer)
#   NETWORK           — "mainnet" or "testnet" (default: testnet)
#   VERIFY            — "true" to verify after deploy (default: true)
#   ETHERSCAN_API_KEY — required for Monadscan verification
#   SOCIALSCAN_API_KEY — required for Socialscan verification (optional)

CONTRACT="${1:?Usage: deploy-monad.sh <ContractPath:Name> [constructor_args...]}"
shift
CONSTRUCTOR_ARGS=("$@")

DEPLOYER_ACCOUNT="${DEPLOYER_ACCOUNT:-monad-deployer}"
NETWORK="${NETWORK:-testnet}"
VERIFY="${VERIFY:-true}"

# Network configuration
if [[ "$NETWORK" == "mainnet" ]]; then
  RPC_URL="https://rpc.monad.xyz"
  CHAIN_ID=143
  EXPLORER_NAME="Monadscan"
  SOURCIFY_URL="https://sourcify-api-monad.blockvision.org/"
  EXTRA_FLAGS="--slow"
else
  RPC_URL="https://testnet-rpc.monad.xyz"
  CHAIN_ID=10143
  EXPLORER_NAME="Monad Testnet Explorer"
  SOURCIFY_URL="https://sourcify-api-monad.blockvision.org/"
  EXTRA_FLAGS=""
fi

echo "=== Monad Deployment ==="
echo "Network:  $NETWORK (chain $CHAIN_ID)"
echo "RPC:      $RPC_URL"
echo "Contract: $CONTRACT"
echo "Account:  $DEPLOYER_ACCOUNT"
echo ""

# Pre-flight: check deployer balance
DEPLOYER_ADDR=$(cast wallet address --account "$DEPLOYER_ACCOUNT")
BALANCE=$(cast balance "$DEPLOYER_ADDR" --rpc-url "$RPC_URL" --ether)
echo "Deployer: $DEPLOYER_ADDR"
echo "Balance:  $BALANCE MON"

# Monad requires ~10 MON reserve per account
BALANCE_CHECK=$(echo "$BALANCE" | awk '{print ($1 > 10) ? "ok" : "low"}')
if [[ "$BALANCE_CHECK" != "ok" ]]; then
  echo "ERROR: Balance too low. Monad requires ~10 MON reserve. Fund the account first."
  exit 1
fi

echo ""
echo "=== Deploying ==="

DEPLOY_CMD=(
  forge create "$CONTRACT"
  --account "$DEPLOYER_ACCOUNT"
  --rpc-url "$RPC_URL"
  --broadcast
)

if [[ ${#CONSTRUCTOR_ARGS[@]} -gt 0 ]]; then
  DEPLOY_CMD+=(--constructor-args "${CONSTRUCTOR_ARGS[@]}")
fi

if [[ -n "$EXTRA_FLAGS" ]]; then
  DEPLOY_CMD+=($EXTRA_FLAGS)
fi

DEPLOY_OUTPUT=$("${DEPLOY_CMD[@]}" 2>&1)
echo "$DEPLOY_OUTPUT"

# Extract deployed address
DEPLOYED_ADDR=$(echo "$DEPLOY_OUTPUT" | grep -oP 'Deployed to: \K0x[a-fA-F0-9]{40}' || true)

if [[ -z "$DEPLOYED_ADDR" ]]; then
  echo "ERROR: Could not extract deployed address from output."
  exit 1
fi

echo ""
echo "Deployed to: $DEPLOYED_ADDR"

# Verification
if [[ "$VERIFY" == "true" && -n "$DEPLOYED_ADDR" ]]; then
  # Extract contract name from path (e.g., src/MyContract.sol:MyContract -> MyContract)
  CONTRACT_NAME="${CONTRACT##*:}"

  echo ""
  echo "=== Verifying on MonadVision (Sourcify) ==="
  forge verify-contract "$DEPLOYED_ADDR" "$CONTRACT_NAME" \
    --chain "$CHAIN_ID" \
    --verifier sourcify \
    --verifier-url "$SOURCIFY_URL" || echo "Sourcify verification failed (non-fatal)"

  if [[ -n "${ETHERSCAN_API_KEY:-}" ]]; then
    echo ""
    echo "=== Verifying on $EXPLORER_NAME (Etherscan) ==="
    forge verify-contract "$DEPLOYED_ADDR" "$CONTRACT_NAME" \
      --chain "$CHAIN_ID" \
      --verifier etherscan \
      --etherscan-api-key "$ETHERSCAN_API_KEY" \
      --watch || echo "Etherscan verification failed (non-fatal)"
  fi

  if [[ -n "${SOCIALSCAN_API_KEY:-}" ]]; then
    echo ""
    echo "=== Verifying on Socialscan ==="
    forge verify-contract "$DEPLOYED_ADDR" "$CONTRACT_NAME" \
      --chain "$CHAIN_ID" \
      --verifier etherscan \
      --etherscan-api-key "$SOCIALSCAN_API_KEY" \
      --verifier-url "https://api.socialscan.io/monad-mainnet/v1/explorer/command_api/contract" \
      --watch || echo "Socialscan verification failed (non-fatal)"
  fi
fi

echo ""
echo "=== Done ==="
echo "Contract: $DEPLOYED_ADDR"
echo "Explorer: https://monadvision.com/address/$DEPLOYED_ADDR"
