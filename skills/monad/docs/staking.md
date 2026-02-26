# Monad Staking Precompile Reference

## Overview

Staking on Monad is managed through a **precompile** at a fixed address, not a deployed contract. Validators and delegators interact with it directly.

**Address**: `0x0000000000000000000000000000000000001000`

**Restriction**: Only standard `CALL` is allowed. `STATICCALL`, `DELEGATECALL`, and `CALLCODE` are **not permitted**.

## State-Modifying Functions

| Function | Selector | Gas Cost | Purpose |
|----------|----------|----------|---------|
| `addValidator(bytes,bytes,bytes)` | `0xf145204c` | 505,125 | Register as validator with SECP + BLS keys |
| `delegate(uint64)` | `0x84994fec` | 260,850 | Delegate stake to a validator |
| `undelegate(uint64,uint256,uint8)` | `0x5cf41514` | 147,750 | Initiate unstaking from a validator |
| `withdraw(uint64,uint8)` | `0xaed2ee73` | 68,675 | Claim unstaked funds after delay |
| `compound(uint64)` | `0xb34fea67` | 285,050 | Convert accumulated rewards to stake |
| `claimRewards(uint64)` | `0xa76e2ca5` | 155,375 | Withdraw accumulated rewards as MON |
| `changeCommission(uint64,uint256)` | `0x9bdcc3c8` | 39,475 | Modify validator commission rate |
| `externalReward(uint64)` | `0xe4b3303b` | 62,300 | Distribute extra MON to a validator's delegators |

### Parameters

- `uint64` validator ID — identifies the target validator
- `uint256` amount — stake/unstake amount in wei
- `uint8` index — withdrawal request index (for multiple pending withdrawals)

## View Functions

| Function | Selector | Gas Cost |
|----------|----------|----------|
| `getValidator(uint64)` | `0x2b6d639a` | 97,200 |
| `getDelegator(uint64,address)` | `0x573c1ce0` | 184,900 |
| `getWithdrawalRequest(uint64,address,uint8)` | `0x56fa2045` | 24,300 |
| `getConsensusValidatorSet(uint32)` | `0xfb29b729` | 814,000 |
| `getSnapshotValidatorSet(uint32)` | `0xde66a368` | 814,000 |
| `getExecutionValidatorSet(uint32)` | `0x7cb074df` | 814,000 |
| `getDelegations(address,uint64)` | `0x4fd66050` | 814,000 |
| `getDelegators(uint64,address)` | `0xa0843a26` | 814,000 |
| `getEpoch()` | `0x757991a8` | 16,200 |
| `getProposerValId()` | `0xfbacb0be` | 100 |

## Events

| Event | Emitted When |
|-------|-------------|
| `ValidatorCreated` | New validator registered via `addValidator` |
| `ValidatorRewarded` | Block reward distributed to validator |
| `ValidatorStatusChanged` | Validator flags modified |
| `Delegate` | Stake delegated to validator |
| `Undelegate` | Unstaking initiated |
| `Withdraw` | Unstaked funds claimed |
| `ClaimRewards` | Rewards transferred to delegator |
| `CommissionChanged` | Validator commission rate updated |
| `EpochChanged` | New epoch activated |

## System Calls (Node-Only)

These are invoked by the protocol, not by users:

| Syscall | Selector | Trigger |
|---------|----------|---------|
| `syscallOnEpochChange(uint64)` | `0x1d4e9f02` | Epoch boundary |
| `syscallReward(address)` | `0x791bdcf3` | Every block (block author reward) |
| `syscallSnapshot()` | `0x157eeb21` | Validator set rotation |

## Key Parameters

| Parameter | Value |
|-----------|-------|
| `DUST_THRESHOLD` | 1e9 (minimum delegation amount) |
| `WITHDRAWAL_DELAY` | 1 epoch before funds claimable |
| `PAGINATED_RESULTS_SIZE` | 100 results per query |
| `ACCUMULATOR_DENOMINATOR` | 1e36 (precision unit for reward math) |

Commission is expressed as `commission * 1e18`. Example: 10% commission = `1e17`.

## Data Structures

### ValExecution (Validator State)
- `stake` — total stake delegated
- `accumulator` — reward accumulator for proportional distribution
- `commission` — commission rate (x 1e18)
- `secp_pubkey` — SECP256k1 public key
- `bls_pubkey` — BLS public key
- `address_flags` — validator status flags
- `unclaimed_rewards` — pending rewards
- `auth_address` — validator's authorized address

### DelInfo (Delegator State)
- `stake` — delegated amount
- `accumulator` — snapshot of validator accumulator at delegation time
- `rewards` — accumulated unclaimed rewards
- `delta_stake` / `next_delta_stake` — pending stake changes
- `delta_epoch` / `next_delta_epoch` — epoch when changes activate

### WithdrawalRequest
- `amount` — MON to withdraw
- `accumulator` — accumulator value at undelegate time
- `withdrawal_epoch` — earliest epoch for claim

## Epoch Mechanics

Stake changes take effect at epoch boundaries, not immediately:

1. Call `delegate(validatorId)` with MON value
2. Stake queued as `delta_stake` for next epoch boundary
3. At epoch boundary, `delta_stake` rolls into active `stake`
4. Rewards accrue from the epoch the stake becomes active

Requests made "too close to epoch start" may queue until the following epoch. Use `getEpoch()` to check timing.

## Example: Delegate Stake (Solidity)

```solidity
address constant STAKING = 0x0000000000000000000000000000000000001000;

function delegateToValidator(uint64 validatorId) external payable {
    (bool success,) = STAKING.call{value: msg.value}(
        abi.encodeWithSelector(0x84994fec, validatorId)
    );
    require(success, "Delegation failed");
}
```

## Example: Delegate Stake (viem)

```typescript
import { encodeFunctionData } from "viem";

const STAKING_ADDRESS = "0x0000000000000000000000000000000000001000";

const hash = await walletClient.sendTransaction({
  to: STAKING_ADDRESS,
  value: parseEther("100"),
  data: encodeFunctionData({
    abi: [{ name: "delegate", type: "function", inputs: [{ name: "validatorId", type: "uint64" }], outputs: [] }],
    functionName: "delegate",
    args: [1n],
  }),
});
```

## Example: Compound Rewards (viem)

```typescript
const hash = await walletClient.sendTransaction({
  to: STAKING_ADDRESS,
  data: encodeFunctionData({
    abi: [{ name: "compound", type: "function", inputs: [{ name: "validatorId", type: "uint64" }], outputs: [] }],
    functionName: "compound",
    args: [1n],
  }),
});
```

## Example: Claim Rewards (viem)

```typescript
const hash = await walletClient.sendTransaction({
  to: STAKING_ADDRESS,
  data: encodeFunctionData({
    abi: [{ name: "claimRewards", type: "function", inputs: [{ name: "validatorId", type: "uint64" }], outputs: [] }],
    functionName: "claimRewards",
    args: [1n],
  }),
});
```
