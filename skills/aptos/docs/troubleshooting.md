# Aptos Troubleshooting

## Compilation Errors

### Named Address Not Set

```
error: Unresolved address: my_addr
```

**Fix**: Pass named addresses at compile time.

```bash
aptos move compile --named-addresses my_addr=default
# or with explicit address
aptos move compile --named-addresses my_addr=0xYOUR_ADDRESS
```

### Missing Framework Dependency

```
error: Unresolved module: aptos_framework::coin
```

**Fix**: Add `AptosFramework` to `Move.toml`.

```toml
[dependencies]
AptosFramework = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/aptos-framework", rev = "mainnet" }
```

### Missing Token Objects Dependency

```
error: Unresolved module: aptos_token_objects::collection
```

**Fix**: Add `AptosTokenObjects` to `Move.toml`.

```toml
[dependencies]
AptosTokenObjects = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/aptos-token-objects", rev = "mainnet" }
```

### Missing `acquires` Annotation

```
error: function acquires global but does not have acquires annotation
```

**Fix**: Add `acquires` clause for every resource type accessed by `borrow_global`, `borrow_global_mut`, `move_from`, or `exists` within the function body. Include resources accessed in called functions within the same module.

```move
// WRONG
public fun get_value(addr: address): u64 {
    borrow_global<MyResource>(addr).value
}

// RIGHT
public fun get_value(addr: address): u64 acquires MyResource {
    borrow_global<MyResource>(addr).value
}
```

### Struct Missing Ability

```
error: type 'MyStruct' is missing required ability 'key'
```

**Fix**: Add the required ability. Resources stored in global storage need `key`. Values inside resources need `store`.

```move
// Needs `key` to be stored at an address via move_to
struct MyResource has key {
    // Inner values need `store`
    data: InnerData,
}

struct InnerData has store, copy, drop {
    value: u64,
}
```

## Deployment Errors

### Module Already Published

```
EMODULE_ALREADY_EXISTS
```

**Fix**: Use upgrade policy. The module must have been published with `compatible` upgrade policy (default).

```bash
aptos move publish \
  --named-addresses my_addr=default \
  --upgrade-policy compatible \
  --profile testnet
```

If the module was published as immutable, it cannot be upgraded.

### Insufficient Gas

```
INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE
```

**Fix**: Fund the account.

```bash
# Testnet
aptos account fund-with-faucet --profile testnet --amount 100000000

# Check balance
aptos account balance --profile testnet
```

### Package Dependency Missing

```
LINKER_ERROR: dependency not found on chain
```

**Fix**: Framework dependencies are always available at `0x1`. For third-party dependencies, the dependency module must be published on-chain before your module. Verify the dependency address is correct and the module exists.

## SDK Errors

### Wrong SDK Package

```
Cannot find module 'aptos'
```

**Fix**: The `aptos` npm package is deprecated. Use `@aptos-labs/ts-sdk`.

```bash
npm uninstall aptos
npm install @aptos-labs/ts-sdk
```

```typescript
// WRONG (old package)
import { AptosClient } from "aptos";

// RIGHT (current SDK)
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
```

### Transaction Simulation Fails

```
MOVE_ABORT with code 0x10001
```

**Fix**: Decode the abort code. `0x10001` = `INVALID_ARGUMENT` category, reason `1`. Check the function signature matches your arguments.

```typescript
const category = (0x10001 >> 16) & 0xff; // 0x1 = INVALID_ARGUMENT
const reason = 0x10001 & 0xffff; // 1
```

### Sequence Number Mismatch

```
SEQUENCE_NUMBER_TOO_OLD
```

**Fix**: The nonce was already used. This happens when submitting transactions too quickly or after a failed transaction. The SDK handles nonces automatically, but if you manage them manually, fetch the current sequence number.

```typescript
const accountInfo = await aptos.getAccountInfo({
  accountAddress: sender.accountAddress,
});
const currentSeqNum = BigInt(accountInfo.sequence_number);
```

### View Function Returns Unexpected Format

View function results are always returned as an array. Even a single return value is wrapped.

```typescript
const result = await aptos.view({
  payload: {
    function: "0x1::coin::balance",
    typeArguments: ["0x1::aptos_coin::AptosCoin"],
    functionArguments: [address],
  },
});

// result is [string], not a number
const balance = BigInt(result[0] as string);
```

## Move Testing Errors

### Test Account Not Created

```
EXECUTION_FAILURE: account does not exist
```

**Fix**: Create test accounts in your test setup.

```move
#[test(account = @0x1)]
fun test_something(account: &signer) {
    // Create account for test (test-only function)
    aptos_framework::account::create_account_for_test(signer::address_of(account));
}
```

### Expected Failure Mismatch

```
Test did not abort with expected code
```

**Fix**: Ensure the `#[expected_failure]` annotation matches the actual abort code.

```move
// Match by abort code
#[test]
#[expected_failure(abort_code = 0x10001)]
fun test_fails() { ... }

// Match by error constant
#[test]
#[expected_failure(abort_code = E_NOT_ADMIN, location = my_addr::my_module)]
fun test_admin_check() { ... }
```

## Resource Account Issues

### Cannot Retrieve Signer Capability

```
EALREADY_CLAIMED: signer capability already retrieved
```

**Fix**: The signer capability can only be retrieved once, typically in `init_module`. Store it immediately.

```move
fun init_module(resource_signer: &signer) {
    let cap = resource_account::retrieve_resource_account_cap(
        resource_signer,
        @source_addr
    );
    move_to(resource_signer, ModuleData { resource_signer_cap: cap });
}
```

### Resource Account Address Calculation

Resource accounts have deterministic addresses. Calculate off-chain:

```typescript
import { sha3_256 } from "@noble/hashes/sha3";

function deriveResourceAccountAddress(
  creatorAddress: string,
  seed: Uint8Array
): string {
  const creatorBytes = Buffer.from(creatorAddress.replace("0x", ""), "hex");
  const input = Buffer.concat([
    creatorBytes,
    seed,
    Buffer.from([0xff]), // DERIVE_RESOURCE_ACCOUNT_SCHEME
  ]);
  const hash = sha3_256(input);
  return "0x" + Buffer.from(hash).toString("hex");
}
```

## Gas Optimization

### High Gas Usage

- Use `Table` or `SmartTable` instead of `SimpleMap` for large collections
- Minimize storage reads in loops — cache values in local variables
- Use events instead of storing historical data on-chain
- Avoid unnecessary `exists<T>` checks if you will immediately `borrow_global`
- Per-user resources are more gas-efficient than global tables for parallel execution
