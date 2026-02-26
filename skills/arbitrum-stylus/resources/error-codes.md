# Stylus Error Codes Reference

Common errors encountered during Stylus development, compilation, deployment, and execution.

## Deployment and Activation Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `ProgramNotActivated` | Contract deployed but `ArbWasm.activateProgram()` was never called | Run `cargo stylus activate --address 0x...` or redeploy with `cargo stylus deploy` which handles both steps |
| `ProgramNotWasm` | Bytecode at address is not valid WASM | Ensure the contract was deployed as a Stylus program, not as EVM bytecode |
| `ProgramOutOfInk` | WASM execution ran out of ink (gas) | Increase gas limit on the transaction. Check for infinite loops or expensive operations |
| `ProgramActivationFailedOOG` | Activation ran out of gas | Increase gas limit for the activation transaction. Large contracts need more gas (~14M+) |
| `ProgramUpToDate` | Calling `activateProgram()` on an already-activated contract | No action needed — contract is already active |

## Compilation Errors (cargo stylus check)

| Error | Cause | Fix |
|-------|-------|-----|
| `floating point detected` | Code uses `f32` or `f64` types | Remove all floating-point usage. Use `U256` with scaling factors for decimal math |
| `WASM binary too large` | Compiled WASM exceeds the size limit | Enable LTO, set `opt-level = "s"`, remove unused dependencies, use `strip = true` |
| `disallowed import` | WASM binary imports a host function that Stylus does not support | Find and replace the dependency that uses the unsupported import |
| `unresolved import` | Missing WASM import at link time | Check that `crate-type = ["lib", "cdylib"]` is set and all dependencies support `no_std` |
| `missing entrypoint` | No `#[entrypoint]` attribute found | Add `#[entrypoint]` to your main contract struct |
| `multiple entrypoints` | More than one struct marked `#[entrypoint]` | Only one struct per crate can be the entrypoint |

## Runtime Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `execution reverted` | Contract logic returned `Err(...)` | Check the revert reason bytes. These correspond to your `Err(b"message".to_vec())` returns |
| `out of gas` | Transaction gas limit too low for the operation | Increase gas limit. Use `eth_estimateGas` to get a better estimate |
| `ink exhaustion` | WASM execution consumed all available ink | Optimize hot loops, reduce memory allocation, check for quadratic complexity |
| `memory access out of bounds` | WASM tried to access memory beyond allocated pages | Check array indexing, Vec capacity, and string operations for overflow |
| `unreachable executed` | WASM hit an `unreachable` instruction (usually from `panic!`) | Replace `unwrap()` and `panic!()` with proper error handling using `Result` |

## ABI Errors

| Error | Cause | Fix |
|-------|-------|-----|
| ABI encoding mismatch | Caller encodes arguments differently than the contract expects | Verify the function signature matches between caller and contract. Use `cargo stylus export-abi` to confirm |
| `function selector not found` | Calling a function that does not exist on the contract | Check the ABI. Ensure the function is in a `#[public]` impl block |
| Wrong return type | Caller expects a different return type than the contract provides | Re-export the ABI and update the caller's interface definition |

## Storage Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Storage slot collision | Two fields accidentally map to the same slot | Check struct field ordering. Do not manually override slot positions unless you know the layout |
| Zero value returned for set data | Reading from a different slot than where data was written | Verify storage layout matches between reads and writes. If using a proxy, ensure implementation slot alignment |
| Proxy storage mismatch | Stylus implementation has different slot layout than Solidity proxy expects | Align field order and types exactly. See `resources/storage-types.md` for mapping rules |

## Testing Errors (motsu)

| Error | Cause | Fix |
|-------|-------|-----|
| `motsu::test` not found | Missing `motsu` in dev-dependencies | Add `motsu = "0.2"` (or latest) to `[dev-dependencies]` in `Cargo.toml` |
| Test fails with storage panic | Accessing storage in a way motsu does not support | Simplify the test to use direct storage setter/getter. Mock complex interactions |
| Compilation error on test target | Test code includes WASM-only features | Gate WASM-specific code behind `#[cfg(target_arch = "wasm32")]` |
