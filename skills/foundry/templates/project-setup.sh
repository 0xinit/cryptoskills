#!/usr/bin/env bash
set -euo pipefail

# Foundry Project Bootstrap Script
# Creates a production-ready Foundry project with dependencies and configuration.
#
# Usage:
#   chmod +x project-setup.sh
#   ./project-setup.sh my-project

PROJECT_NAME="${1:?Usage: ./project-setup.sh <project-name>}"

if [ -d "$PROJECT_NAME" ]; then
  echo "Error: directory '$PROJECT_NAME' already exists"
  exit 1
fi

echo "Creating Foundry project: $PROJECT_NAME"

forge init "$PROJECT_NAME"
cd "$PROJECT_NAME"

# Install common dependencies
forge install OpenZeppelin/openzeppelin-contracts
forge install transmissions11/solmate

# Write foundry.toml with production defaults
cat > foundry.toml << 'TOML'
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.28"
optimizer = true
optimizer_runs = 200
ffi = false
fs_permissions = [{ access = "read", path = "./" }]

remappings = [
    "@openzeppelin/=lib/openzeppelin-contracts/",
    "solmate/=lib/solmate/src/",
]

[rpc_endpoints]
mainnet = "${MAINNET_RPC_URL}"
sepolia = "${SEPOLIA_RPC_URL}"
arbitrum = "${ARBITRUM_RPC_URL}"
base = "${BASE_RPC_URL}"
localhost = "http://127.0.0.1:8545"

[etherscan]
mainnet = { key = "${ETHERSCAN_API_KEY}" }
sepolia = { key = "${ETHERSCAN_API_KEY}" }
arbitrum = { key = "${ARBISCAN_API_KEY}" }
base = { key = "${BASESCAN_API_KEY}" }

[fuzz]
runs = 256
max_test_rejects = 65536

[invariant]
runs = 256
depth = 15
fail_on_revert = false

[fmt]
line_length = 120
tab_width = 4
bracket_spacing = false
int_types = "long"
quote_style = "double"
number_underscore = "thousands"

[profile.ci]
fuzz = { runs = 10000 }
invariant = { runs = 1000, depth = 50 }
verbosity = 2
TOML

# Create .env.example with required variables
cat > .env.example << 'ENV'
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY
ARBISCAN_API_KEY=YOUR_ARBISCAN_KEY
BASESCAN_API_KEY=YOUR_BASESCAN_KEY
ENV

# Add .env to .gitignore
if ! grep -q "\.env" .gitignore 2>/dev/null; then
  cat >> .gitignore << 'GITIGNORE'

# Environment variables (never commit secrets)
.env

# Foundry cache and output
cache/
out/

# Coverage reports
lcov.info
coverage/
GITIGNORE
fi

# Create Makefile with common targets
cat > Makefile << 'MAKE'
-include .env

.PHONY: build test snapshot fmt lint deploy-sepolia deploy-mainnet

build:
	forge build

test:
	forge test -vv

test-fork:
	forge test --match-test Fork -vvv

test-ci:
	FOUNDRY_PROFILE=ci forge test -vv

snapshot:
	forge snapshot

fmt:
	forge fmt

lint:
	forge fmt --check

coverage:
	forge coverage --report lcov
	genhtml lcov.info -o coverage --branch-coverage
	open coverage/index.html

sizes:
	forge build --sizes

clean:
	forge clean

deploy-sepolia:
	forge script script/Deploy.s.sol --rpc-url sepolia --broadcast --verify -vvvv

deploy-mainnet:
	forge script script/Deploy.s.sol --rpc-url mainnet --broadcast --verify --slow -vvvv

anvil:
	anvil --fork-url $(MAINNET_RPC_URL)
MAKE

# Remove default Counter files
rm -f src/Counter.sol test/Counter.t.sol script/Counter.s.sol

# Create placeholder source file
cat > src/.gitkeep << 'EOF'
EOF

# Create placeholder test
cat > test/.gitkeep << 'EOF'
EOF

# Create placeholder script
cat > script/.gitkeep << 'EOF'
EOF

# Build to verify setup
forge build

echo ""
echo "Project '$PROJECT_NAME' created successfully."
echo ""
echo "Next steps:"
echo "  cd $PROJECT_NAME"
echo "  cp .env.example .env    # Fill in your keys"
echo "  forge build              # Compile"
echo "  forge test               # Run tests"
echo "  make anvil               # Start local fork"
