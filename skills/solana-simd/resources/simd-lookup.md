# SIMD Lookup Table

Quick reference for key Solana Improvement Documents. Full list at https://github.com/solana-foundation/solana-improvement-documents/tree/main/proposals

## Core Protocol

| SIMD | Title | Status | Developer Impact |
|------|-------|--------|-----------------|
| 0002 | Fee-payer signs first | Activated | Transaction signing order |
| 0033 | Timely Vote Credits | Activated | Staking APY calculations |
| 0046 | Versioned Transactions | Activated | ALTs, 256+ accounts per tx |
| 0047 | Syscall Probing | Accepted | Forward-compatible programs |
| 0048 | Native Program Upgrades | Activated | BPF loader changes |
| 0052 | Durable Transaction Nonces | Activated | Offline signing, scheduled tx |
| 0072 | Priority Fee Market | Activated | Per-CU priority fees |
| 0084 | Remove Rent Collection | Activated | All accounts must be rent-exempt |
| 0096 | Reward Full Priority Fee to Validator | Activated | 100% priority fee to leader |
| 0105 | QUIC Protocol for TPU | Activated | Connection-based tx submission |
| 0118 | Partitioned Epoch Rewards | Activated | Smoother reward distribution |

## Token Standards

| SIMD | Title | Status | Developer Impact |
|------|-------|--------|-----------------|
| 0083 | Token Extensions (Token-2022) | Activated | Transfer fees, confidential, metadata |
| 0148 | Token Metadata in Token-2022 | Activated | On-chain metadata without Metaplex |

## Staking & Consensus

| SIMD | Title | Status | Developer Impact |
|------|-------|--------|-----------------|
| 0122 | Stake-weighted Quality of Service | Activated | Tx delivery proportional to stake |
| 0163 | Multiple Delegations per Account | Review | Staking protocol architecture |
| 0172 | Staking Rewards Distribution | Accepted | Incremental reward distribution |
| 0185 | Vote Account Size Reduction | Draft | Validator cost reduction |

## In Progress

| SIMD | Title | Status | Developer Impact |
|------|-------|--------|-----------------|
| 0133 | Increase Account Data Limit | Review | Larger on-chain data |
| 0159 | Reduce Rent Cost | Draft | Lower account creation costs |
| 0175 | Confidential Transfers v2 | Review | Enhanced privacy features |
| 0186 | Precompile for Secp256r1 | Activated | WebAuthn / passkey support |
| 0193 | ZK Token Proof Program | Review | On-chain ZK verification |

## How to Read SIMD Numbers

- Proposals are numbered sequentially (0001, 0002, ..., 0193+)
- Number does NOT indicate priority or importance
- Status progression: Draft -> Review -> Accepted -> Implemented -> Activated
- "Activated" means live on mainnet-beta with feature gate enabled
- "Accepted" means approved but not yet deployed

## Checking Feature Gate Status

```bash
# Check if a feature is activated on mainnet
solana feature status <feature-pubkey> --url mainnet-beta

# List all features and their activation status
solana feature status --url mainnet-beta
```

Last verified: 2026-03-01
