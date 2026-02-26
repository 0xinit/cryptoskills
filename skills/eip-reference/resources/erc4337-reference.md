# ERC-4337 Account Abstraction Reference

Complete reference for ERC-4337 — UserOperation struct, EntryPoint interface, account/paymaster/factory contracts, bundler RPC methods, and v0.6 to v0.7 migration.

## UserOperation Struct (v0.7 — PackedUserOperation)

```solidity
struct PackedUserOperation {
    address sender;              // smart account address
    uint256 nonce;               // anti-replay, upper 192 bits = key, lower 64 bits = sequence
    bytes initCode;              // factory address (20 bytes) + factory calldata (for first-time deployment)
    bytes callData;              // encoded call to execute on the account
    bytes32 accountGasLimits;    // packed: verificationGasLimit (16 bytes) || callGasLimit (16 bytes)
    uint256 preVerificationGas;  // gas for bundler overhead (calldata cost, bundling)
    bytes32 gasFees;             // packed: maxPriorityFeePerGas (16 bytes) || maxFeePerGas (16 bytes)
    bytes paymasterAndData;      // paymaster address (20 bytes) + paymasterVerificationGasLimit (16 bytes) + paymasterPostOpGasLimit (16 bytes) + paymaster-specific data
    bytes signature;             // account-specific signature (validated by account.validateUserOp)
}
```

**Nonce key-space scheme**: The 256-bit nonce encodes a 192-bit key and a 64-bit sequence. Different keys are independent channels, allowing parallel non-conflicting UserOps from the same account.

## EntryPoint Interface

**Address (v0.7):** `0x0000000071727De22E5E9d8BAf0edAc6f37da032`

```solidity
interface IEntryPoint {
    function handleOps(PackedUserOperation[] calldata ops, address payable beneficiary) external;

    function handleAggregatedOps(
        UserOpsPerAggregator[] calldata opsPerAggregator,
        address payable beneficiary
    ) external;

    function simulateValidation(PackedUserOperation calldata userOp) external;

    function getUserOpHash(PackedUserOperation calldata userOp) external view returns (bytes32);

    function getNonce(address sender, uint192 key) external view returns (uint256);

    function depositTo(address account) external payable;

    function withdrawTo(address payable withdrawAddress, uint256 withdrawAmount) external;

    function balanceOf(address account) external view returns (uint256);

    function getDepositInfo(address account) external view returns (DepositInfo memory);
}
```

**Key behavior:**
- `handleOps` iterates: validate all UserOps first, then execute. A single validation failure reverts only that UserOp (the rest proceed).
- `simulateValidation` is called off-chain by bundlers. It reverts with `ValidationResult` containing gas estimates and validation data.
- `getUserOpHash` returns the hash the account must sign. Includes `entryPoint` address and `chainId` to prevent cross-chain/cross-entrypoint replay.

## IAccount Interface

```solidity
interface IAccount {
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);
}
```

**Return value (`validationData`):**
- `0` = valid signature
- `1` (`SIG_VALIDATION_FAILED`) = invalid signature (do NOT revert — bundlers need the failure code)
- Packed: `authorizer (20 bytes) || validUntil (6 bytes) || validAfter (6 bytes)` for time-bounded validation

**`missingAccountFunds`**: The amount the account must deposit to EntryPoint to cover gas. The account should call `entryPoint.depositTo{value: missingAccountFunds}(address(this))` or pre-fund.

## IPaymaster Interface

```solidity
interface IPaymaster {
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData);

    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external;
}

enum PostOpMode {
    opSucceeded,    // UserOp execution succeeded
    opReverted,     // UserOp execution reverted
    postOpReverted  // postOp itself reverted (called again with this mode)
}
```

**Paymaster flow:**
1. `validatePaymasterUserOp` — verify the UserOp is eligible for sponsorship, return context for `postOp`
2. UserOp executes
3. `postOp` — settle costs (e.g., deduct ERC-20 from user, log sponsorship)

**Paymaster must pre-deposit ETH** to EntryPoint via `entryPoint.depositTo`. The EntryPoint debits the paymaster's deposit for sponsored gas.

## Factory Interface

```solidity
interface IAccountFactory {
    function createAccount(address owner, uint256 salt) external returns (address account);
}
```

**Deployment via `initCode`:**
- First 20 bytes = factory address
- Remaining bytes = `abi.encodeCall(factory.createAccount, (owner, salt))`
- EntryPoint calls factory only if `sender` has no code (first UserOp)
- Factory must use CREATE2 for deterministic addresses so the sender address can be computed before deployment

## Bundler JSON-RPC Methods

| Method | Description |
|--------|-------------|
| `eth_sendUserOperation` | Submit a UserOperation to the bundler mempool |
| `eth_estimateUserOperationGas` | Estimate `preVerificationGas`, `verificationGasLimit`, `callGasLimit` |
| `eth_getUserOperationByHash` | Look up a UserOperation by its hash |
| `eth_getUserOperationReceipt` | Get execution receipt (success, actualGasCost, logs) |
| `eth_supportedEntryPoints` | List EntryPoint addresses the bundler supports |
| `eth_chainId` | Return the chain ID the bundler operates on |

**`eth_sendUserOperation` params:**
```json
{
    "jsonrpc": "2.0",
    "method": "eth_sendUserOperation",
    "params": [
        { "sender": "0x...", "nonce": "0x...", "...": "..." },
        "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
    ],
    "id": 1
}
```

The second parameter is the EntryPoint address. Bundlers reject UserOps targeting unsupported EntryPoints.

## Key Changes: v0.6 to v0.7

| Aspect | v0.6 | v0.7 |
|--------|------|------|
| Struct name | `UserOperation` | `PackedUserOperation` |
| Gas fields | Separate `verificationGasLimit`, `callGasLimit` | Packed into `bytes32 accountGasLimits` |
| Fee fields | Separate `maxFeePerGas`, `maxPriorityFeePerGas` | Packed into `bytes32 gasFees` |
| Paymaster fields | `paymasterAndData` (address + data) | `paymasterAndData` now includes gas limits (address + verificationGas + postOpGas + data) |
| `initCode` | `initCode` (factory + calldata) | Same format, but factory validation is stricter |
| EntryPoint address | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| Nonce | Simple sequential | Key-space scheme (192-bit key + 64-bit sequence) |
| postOp | `postOp(PostOpMode, context, actualGasCost)` | `postOp(PostOpMode, context, actualGasCost, actualUserOpFeePerGas)` |
| Aggregation | Optional aggregator field | `handleAggregatedOps` with per-aggregator grouping |

**Migration note**: v0.6 and v0.7 EntryPoints are deployed at different addresses. Bundlers, paymasters, and accounts must target the same version. You cannot mix v0.6 accounts with a v0.7 EntryPoint.

## Banned Opcodes During Validation

The bundler simulation bans these opcodes during `validateUserOp` and `validatePaymasterUserOp` to prevent DoS and ensure deterministic validation:

`GASPRICE`, `GASLIMIT`, `DIFFICULTY`, `TIMESTAMP`, `BASEFEE`, `BLOCKHASH`, `NUMBER`, `SELFBALANCE`, `BALANCE`, `ORIGIN`, `CREATE`, `COINBASE`, `SELFDESTRUCT`, `RANDOM`, `PREVRANDAO`

Storage access is restricted to the account's own associated storage during validation.

## References

- [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) — Account Abstraction Using Alt Mempool
- [EntryPoint v0.7 Source](https://github.com/eth-infinitism/account-abstraction/tree/develop/contracts) — Reference implementation
- [ERC-4337 Bundler Spec](https://github.com/eth-infinitism/bundler-spec) — JSON-RPC specification
- [ERC-7579](https://eips.ethereum.org/EIPS/eip-7579) — Modular Smart Account interface
