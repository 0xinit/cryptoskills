# Interchain Security Module (ISM) Types

Reference table for all ISM types in Hyperlane, their security models, configuration options, and when to use each.

## ISM Type Overview

| ISM Type | Module Type ID | Security Model | Gas Cost | Latency | Trust Assumption |
|----------|---------------|----------------|----------|---------|------------------|
| MultisigISM | `3` | M-of-N validator signatures | Medium | Low (seconds) | Trust the validator set |
| RoutingISM | `4` | Delegates to per-origin ISMs | Varies | Varies | Depends on sub-ISMs |
| AggregationISM | `6` | Requires M-of-N ISMs to pass | High | Highest sub-ISM | Strongest — multiple models must agree |
| OptimisticISM | Custom | Optimistic with fraud window | Low | High (minutes/hours) | Trust unless fraud proven |
| PausableISM | Custom | Always returns configurable value | Minimal | None | Fully trusted owner |

## Detailed ISM Reference

### MultisigISM (Type 3)

**How it works:** A set of validators watch the origin chain Mailbox. Each validator signs attestations (checkpoints) of the Merkle root. The relayer collects signatures and submits them as metadata when delivering the message. The MultisigISM verifies that at least `threshold` valid signatures exist.

**Variants:**
- `StaticMultisigISM` — Validator set and threshold are immutable (set at deployment). Most gas-efficient.
- `StorageMultisigISM` — Validator set and threshold are stored in contract storage and can be updated by the owner. Flexible but slightly higher gas.

**Configuration:**
```
Validators: [addr1, addr2, addr3, addr4, addr5]
Threshold: 3  (3-of-5 must sign)
```

**When to use:**
- Default choice for most applications
- When you have a known, trusted validator set
- When you need low-latency message delivery (seconds)

**When NOT to use:**
- When you need defense in depth (combine with AggregationISM)
- When validator compromise is a critical risk

**Deploy:**
```bash
# Via factory (no custom Solidity needed)
# StaticMultisigISMFactory.deploy(validators, threshold)
```

---

### RoutingISM (Type 4)

**How it works:** Routes inbound messages to different ISMs based on the origin domain ID. Each origin chain can have a different security model.

**Variants:**
- `DomainRoutingISM` — Maps domain IDs to ISM addresses. Owner can update routes.
- `DefaultFallbackRoutingISM` — Falls back to the Mailbox's default ISM for unmapped domains.

**Configuration:**
```
Route: {
  1 (Ethereum)  -> MultisigISM (strict, 5-of-7)
  42161 (Arbitrum) -> MultisigISM (standard, 3-of-5)
  8453 (Base)    -> AggregationISM (defense in depth)
}
```

**When to use:**
- Different trust assumptions for different source chains
- Ethereum messages need stricter verification than L2 messages
- Gradual rollout of custom security per origin

**When NOT to use:**
- Same security model for all origins (use MultisigISM directly)
- Simple applications with a single trusted origin

---

### AggregationISM (Type 6)

**How it works:** Contains an array of sub-ISMs. A message is verified only when at least `threshold` of the sub-ISMs pass their `verify()` check. This is AND/M-of-N logic over entire security models, not just signatures.

**Configuration:**
```
Modules: [MultisigISM, OptimisticISM, ZKProofISM]
Threshold: 2  (any 2-of-3 must pass)
```

**When to use:**
- High-value operations (bridges, governance)
- Defense in depth — combine independent security models
- When no single security model is sufficient

**When NOT to use:**
- Low-value messages where speed matters more than security
- When all sub-ISMs share the same trust assumption (redundancy without diversity)

**Cost:** Verification cost is the sum of all sub-ISM verification costs (up to threshold). This is the most expensive ISM type but the most secure.

---

### OptimisticISM

**How it works:** Messages are assumed valid unless challenged within a fraud proof window. A set of watchers monitor messages and can submit fraud proofs to block invalid ones. After the challenge period, the message is finalized.

**Configuration:**
```
Fraud window: 30 minutes
Watchers: [addr1, addr2, addr3]
```

**When to use:**
- Lower operational costs (no per-message validator signatures)
- Applications that can tolerate delay (not time-sensitive)
- Combined with MultisigISM via AggregationISM for layered security

**When NOT to use:**
- Time-sensitive operations (DeFi liquidations, arbitrage)
- When you cannot guarantee watchers are online
- As the sole security model for high-value operations

---

### PausableISM

**How it works:** A simple ISM controlled by an owner that can pause/unpause message verification. When paused, all messages are rejected. Useful as an emergency kill switch.

**When to use:**
- Emergency circuit breaker for your application
- Combined with other ISMs via AggregationISM
- Testing and development

**When NOT to use:**
- As a standalone security model in production (single point of failure)

## Decision Matrix

| Scenario | Recommended ISM | Rationale |
|----------|----------------|-----------|
| Standard messaging (non-critical) | MultisigISM (3-of-5) | Good balance of security and cost |
| High-value bridge | AggregationISM (MultisigISM + OptimisticISM) | Defense in depth |
| Multi-chain app with varied trust | RoutingISM -> per-origin MultisigISM | Tailored security per source |
| Governance cross-chain | AggregationISM (5-of-7 MultisigISM + timelock) | Maximum security, acceptable delay |
| Development/testing | Default Mailbox ISM or PausableISM | Simplicity, easy debugging |
| New chain deployment | MultisigISM with your own validators | You control the full security model |

## ISM Interface

All ISMs implement this interface:

```solidity
interface IInterchainSecurityModule {
    /// @notice Module type identifier
    /// @return The module type (3=Multisig, 4=Routing, 6=Aggregation, etc.)
    function moduleType() external view returns (uint8);

    /// @notice Verify a message using the provided metadata
    /// @param _metadata Proof data (signatures, merkle proofs, etc.)
    /// @param _message The raw Hyperlane message bytes
    /// @return True if the message is verified
    function verify(
        bytes calldata _metadata,
        bytes calldata _message
    ) external returns (bool);
}
```

## Custom ISM Development

To build a custom ISM, implement the `IInterchainSecurityModule` interface:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IInterchainSecurityModule} from "@hyperlane-xyz/core/contracts/interfaces/IInterchainSecurityModule.sol";

contract MyCustomISM is IInterchainSecurityModule {
    // Use a unique module type > 128 for custom ISMs
    uint8 public constant override moduleType = 128;

    function verify(
        bytes calldata _metadata,
        bytes calldata _message
    ) external override returns (bool) {
        // Decode metadata and message
        // Implement your verification logic
        // Return true only if verification passes
        return _verifyCustomLogic(_metadata, _message);
    }

    function _verifyCustomLogic(
        bytes calldata _metadata,
        bytes calldata _message
    ) internal returns (bool) {
        // Your verification here
        return true;
    }
}
```

## References

- [ISM Documentation](https://docs.hyperlane.xyz/docs/reference/ISM)
- [ISM Interfaces (GitHub)](https://github.com/hyperlane-xyz/hyperlane-monorepo/tree/main/solidity/contracts/interfaces)
- [ISM Factory Contracts](https://github.com/hyperlane-xyz/hyperlane-monorepo/tree/main/solidity/contracts/isms)
