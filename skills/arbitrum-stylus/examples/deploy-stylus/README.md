# Deploying Stylus Contracts

Complete workflow for deploying, activating, verifying, and interacting with Stylus contracts on Arbitrum.

## Prerequisites

```bash
# Rust + WASM target
rustup target add wasm32-unknown-unknown

# cargo-stylus CLI
cargo install cargo-stylus

# Foundry (for cast interaction)
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

## Step 1: Validate WASM

Always check before deploying. This catches disallowed opcodes, size violations, and ABI issues without spending gas.

```bash
# Check against testnet
cargo stylus check \
  --endpoint https://sepolia-rollup.arbitrum.io/rpc

# Check against mainnet
cargo stylus check \
  --endpoint https://arb1.arbitrum.io/rpc
```

Common check failures:
- **Floating point detected** — Remove all `f32`/`f64` usage. Use `U256` with scaling.
- **WASM too large** — Enable LTO and `opt-level = "s"` in `Cargo.toml`. Strip debug info.
- **Disallowed import** — A dependency uses an unsupported WASM host function. Replace the dependency.

## Step 2: Deploy

```bash
# Deploy to Arbitrum Sepolia (testnet)
cargo stylus deploy \
  --endpoint https://sepolia-rollup.arbitrum.io/rpc \
  --private-key $PRIVATE_KEY

# Deploy to Arbitrum One (mainnet)
cargo stylus deploy \
  --endpoint https://arb1.arbitrum.io/rpc \
  --private-key $PRIVATE_KEY
```

The `deploy` command performs two transactions:
1. **Contract creation** — deploys the WASM bytecode
2. **Activation** — calls `ArbWasm.activateProgram()` to compile WASM to native code

Output:

```
contract address: 0x1234...abcd
deployment tx:    0xaaaa...1111
activation tx:    0xbbbb...2222
```

## Step 3: Activation Costs

Activation is a one-time cost that compiles WASM to native machine code on-chain.

| Factor | Impact |
|--------|--------|
| Contract WASM size | Larger = more gas |
| Typical activation | ~14M gas |
| Small contract | ~8M gas |
| Large contract | ~20M+ gas |

If you deployed the bytecode manually (not via `cargo stylus deploy`), activate separately:

```bash
cargo stylus activate \
  --address 0xYourContractAddress \
  --endpoint https://arb1.arbitrum.io/rpc \
  --private-key $PRIVATE_KEY
```

## Step 4: Verify Deployment

```bash
# Confirm the contract has code
cast code 0xYourContractAddress \
  --rpc-url https://arb1.arbitrum.io/rpc

# Check Stylus program version (returns non-zero if activated)
cast call 0x0000000000000000000000000000000000000071 \
  "programVersion(address)(uint16)" \
  0xYourContractAddress \
  --rpc-url https://arb1.arbitrum.io/rpc

# Export the ABI for reference
cargo stylus export-abi
```

## Step 5: Interact

Stylus contracts have standard Solidity ABIs. Use any Ethereum tool.

### Using cast (Foundry)

```bash
# Read (view function)
cast call 0xYourContract "getValue()(uint256)" \
  --rpc-url https://arb1.arbitrum.io/rpc

# Write (state change)
cast send 0xYourContract "setValue(uint256)" 42 \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --private-key $PRIVATE_KEY

# Payable function (send ETH)
cast send 0xYourContract "deposit()" \
  --value 0.01ether \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --private-key $PRIVATE_KEY
```

### Using viem (TypeScript)

```typescript
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";

const abi = [
  {
    name: "getValue",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "setValue",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "newValue", type: "uint256" }],
    outputs: [],
  },
] as const;

const CONTRACT = "0xYourContract" as const;

const publicClient = createPublicClient({
  chain: arbitrum,
  transport: http(process.env.ARBITRUM_RPC_URL),
});

const value = await publicClient.readContract({
  address: CONTRACT,
  abi,
  functionName: "getValue",
});

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const walletClient = createWalletClient({
  account,
  chain: arbitrum,
  transport: http(process.env.ARBITRUM_RPC_URL),
});

const hash = await walletClient.writeContract({
  address: CONTRACT,
  abi,
  functionName: "setValue",
  args: [42n],
});
```

### Using ethers.js

```typescript
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(process.env.ARBITRUM_RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const abi = [
  "function getValue() view returns (uint256)",
  "function setValue(uint256 newValue)",
];

const contract = new ethers.Contract("0xYourContract", abi, signer);

const value = await contract.getValue();
const tx = await contract.setValue(42);
await tx.wait();
```

## Deployment Checklist

- [ ] `cargo stylus check` passes against target network
- [ ] Sufficient ETH for deployment + activation (~14M gas)
- [ ] Private key loaded from environment variable (never hardcoded)
- [ ] Contract code verified via `cast code`
- [ ] Activation confirmed via `ArbWasm.programVersion()`
- [ ] ABI exported and saved for frontend/backend integration
- [ ] Test all external functions via `cast call` / `cast send`
- [ ] If upgradeable: verify proxy + implementation pattern works
