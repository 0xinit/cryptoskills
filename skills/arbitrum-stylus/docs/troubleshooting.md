# Stylus Troubleshooting

Common issues and fixes for Arbitrum Stylus development.

## cargo stylus check Fails

### "floating point detected"

**Symptom**: `cargo stylus check` rejects the WASM binary.

**Cause**: A dependency (or your code) uses `f32` or `f64`. Stylus WASM requires deterministic execution and disallows IEEE 754 floating-point.

**Fix**:
1. Search for float usage: `grep -r "f32\|f64\|as f" src/`
2. Replace with integer math using `U256` and scaling factors
3. Check dependencies — some crates use floats internally. Replace with `no_std`-compatible alternatives that avoid floats

### "WASM binary too large"

**Symptom**: Contract compiles but exceeds the WASM size limit.

**Fix**: Optimize the release profile in `Cargo.toml`:

```toml
[profile.release]
codegen-units = 1
strip = true
lto = true
panic = "abort"
opt-level = "s"   # Optimize for size, not speed
```

Also:
- Remove unused dependencies
- Avoid large generic instantiations
- Split code into smaller functions to help the optimizer
- Check if `alloc` features are pulling in unnecessary code

### "disallowed import"

**Symptom**: WASM uses a host function that Stylus does not provide.

**Cause**: A dependency tries to call functions like `std::time`, `std::thread`, filesystem I/O, or random number generation via OS calls.

**Fix**:
- Ensure all dependencies are `no_std`-compatible
- Add `#![no_std]` to your lib.rs if not already present
- Replace the offending dependency with a WASM-compatible alternative

## Deployment Reverts

### "ProgramNotActivated"

**Symptom**: Every call to the contract reverts with "program not activated."

**Cause**: The WASM bytecode was deployed but `ArbWasm.activateProgram()` was never called.

**Fix**:

```bash
cargo stylus activate \
  --address 0xYourContractAddress \
  --endpoint https://arb1.arbitrum.io/rpc \
  --private-key $PRIVATE_KEY
```

### Insufficient Gas for Activation

**Symptom**: `cargo stylus deploy` succeeds on the first transaction (deployment) but the second transaction (activation) reverts.

**Cause**: Activation compiles WASM to native code on-chain. Larger contracts need more gas.

**Fix**:
- Ensure your wallet has enough ETH for activation (~14M gas for typical contracts, up to ~25M for large ones)
- If the deployment transaction succeeded but activation failed, run `cargo stylus activate` separately with a higher gas limit

### Wrong Network

**Symptom**: Deploy succeeds but contract is not on the expected chain.

**Fix**: Always verify the `--endpoint` URL matches your target network:
- Testnet: `https://sepolia-rollup.arbitrum.io/rpc`
- Mainnet: `https://arb1.arbitrum.io/rpc`

## Rust Compiler Version Mismatch

### Symptom

Build fails with errors about unstable features or incompatible crate versions.

### Cause

The `stylus-sdk` crate requires a specific Rust toolchain version. A mismatch causes compilation failures.

### Fix

Pin the toolchain in `rust-toolchain.toml`:

```toml
[toolchain]
channel = "1.80"
components = ["rust-src"]
targets = ["wasm32-unknown-unknown"]
```

Then:

```bash
rustup install 1.80
rustup target add wasm32-unknown-unknown --toolchain 1.80
```

## Storage Layout Changes Between Versions

### Symptom

After upgrading a contract (via proxy), storage reads return wrong values.

### Cause

Field order in the `#[storage]` struct changed between versions, shifting slot assignments.

### Fix

- Never reorder existing fields in a storage struct
- Only add new fields at the end
- If you must change layout, migrate data via a migration function
- Document storage slot assignments in comments for each field

## Calling Solidity Contracts Fails

### "ABI encoding mismatch"

**Symptom**: Cross-VM calls revert or return garbage data.

**Cause**: The `sol_interface!` declaration does not match the actual Solidity contract's ABI.

**Fix**:
1. Get the exact ABI from the Solidity contract (Arbiscan, `forge inspect`, etc.)
2. Verify every parameter type, name, and order in `sol_interface!`
3. Pay attention to `uint256` vs `uint128` vs `int256` — they encode differently

### "execution reverted" on Cross-VM Call

**Symptom**: Stylus contract calling a Solidity contract gets a revert.

**Cause**: Could be:
- Incorrect function selector (wrong function name/params)
- Insufficient allowance or balance for token operations
- The Solidity contract reverted internally

**Fix**:
1. Test the same call via `cast call` to isolate the issue
2. Check if the Solidity contract requires prior approvals or specific state
3. Decode the revert reason from the error bytes

## Testing with motsu

### "motsu::test not found"

**Fix**: Add motsu to dev dependencies:

```toml
[dev-dependencies]
motsu = "0.2"
```

### Storage Not Persisting Between Calls in Tests

**Cause**: Each `#[motsu::test]` function gets a fresh contract instance. Storage does not persist between test functions.

**Fix**: Perform all setup and assertions within a single test function. Use helper functions to reduce duplication.

### Tests Pass But cargo stylus check Fails

**Cause**: Tests compile for the native target, not WASM. Some code that works natively may not compile to WASM.

**Fix**: Run both:

```bash
cargo test                    # Tests pass natively
cargo stylus check --endpoint https://sepolia-rollup.arbitrum.io/rpc  # WASM is valid
```

Gate native-only test utilities behind `#[cfg(test)]` and WASM-specific code behind `#[cfg(target_arch = "wasm32")]`.

## Performance Not Matching Expectations

### Symptom

Gas costs are not significantly lower than Solidity for your use case.

### Cause

Stylus saves gas on **compute** (math, memory, logic), not on **storage** (SLOAD/SSTORE costs are identical). If your contract is storage-heavy and compute-light, savings will be minimal.

### When to Expect Savings

| Pattern | Expected Savings |
|---------|-----------------|
| Heavy computation (crypto, math) | 10-100x |
| Memory-intensive (sorting, parsing) | 10-1000x |
| Simple CRUD (mostly storage) | Minimal or none |
| Mixed compute + storage | 2-10x on total |

### Optimization Tips

- Batch storage reads/writes to minimize SLOAD/SSTORE count
- Use local variables for intermediate computation instead of repeated storage access
- Profile gas usage with `eth_estimateGas` comparing Solidity and Stylus implementations
