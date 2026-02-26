# EigenLayer AVS Registry

> **Last verified:** February 2026

Notable Actively Validated Services (AVSs) registered on EigenLayer. AVSs leverage EigenLayer's restaked security to power their validation services.

## Tier 1 AVSs (High TVL, Established)

### EigenDA

| Field | Value |
|-------|-------|
| **Description** | Data availability layer for rollups. Operators store and serve blobs of rollup data. |
| **Category** | Data Availability |
| **Website** | [eigenda.xyz](https://docs.eigenda.xyz) |
| **Operator Requirements** | Minimum stake threshold, run EigenDA node software, meet bandwidth and storage requirements |
| **Slashing Conditions** | Failure to store/serve data blobs, signing conflicting dispersal headers |
| **Notes** | First AVS on EigenLayer. Integrated with multiple rollup frameworks (OP Stack, Arbitrum Orbit). |

### AltLayer MACH

| Field | Value |
|-------|-------|
| **Description** | Fast finality layer for rollups. Provides rapid transaction confirmation before L1 finality. |
| **Category** | Rollup Infrastructure |
| **Website** | [altlayer.io](https://altlayer.io) |
| **Operator Requirements** | Minimum restaked ETH, run MACH verifier node |
| **Slashing Conditions** | Signing conflicting finality attestations |
| **Notes** | AVS token: ALT. Operators may need to meet both ETH and ALT staking requirements. |

### Omni Network

| Field | Value |
|-------|-------|
| **Description** | Cross-rollup communication protocol. Enables message passing between Ethereum rollups. |
| **Category** | Cross-Chain / Interoperability |
| **Website** | [omni.network](https://omni.network) |
| **Operator Requirements** | Run Omni validator node, minimum stake |
| **Slashing Conditions** | Signing conflicting cross-chain attestations, double-signing |
| **Notes** | AVS token: OMNI. Uses both OMNI and restaked ETH for security. |

### Brevis

| Field | Value |
|-------|-------|
| **Description** | ZK coprocessor for smart contracts. Enables trustless access to historical blockchain data. |
| **Category** | ZK Infrastructure |
| **Website** | [brevis.network](https://brevis.network) |
| **Operator Requirements** | Run Brevis prover node, GPU recommended for ZK proof generation |
| **Slashing Conditions** | Submitting invalid ZK proofs |

### eoracle

| Field | Value |
|-------|-------|
| **Description** | Ethereum-native oracle network. Provides price feeds and arbitrary data to smart contracts. |
| **Category** | Oracle |
| **Website** | [eoracle.io](https://eoracle.io) |
| **Operator Requirements** | Run oracle node, data source connectivity |
| **Slashing Conditions** | Submitting incorrect or stale data beyond acceptable deviation |

### Lagrange State Committees

| Field | Value |
|-------|-------|
| **Description** | Light client infrastructure for cross-chain verification using state committees. |
| **Category** | Cross-Chain / Light Clients |
| **Website** | [lagrange.dev](https://lagrange.dev) |
| **Operator Requirements** | Run Lagrange node, BLS key registration |
| **Slashing Conditions** | Signing invalid state roots |

### Witness Chain

| Field | Value |
|-------|-------|
| **Description** | Proof of diligence and proof of location for decentralized physical infrastructure (DePIN). |
| **Category** | DePIN / Verification |
| **Website** | [witnesschain.com](https://witnesschain.com) |
| **Operator Requirements** | Run watchtower node |
| **Slashing Conditions** | False attestations about DePIN network state |

## Tier 2 AVSs (Growing)

### Automata Multi-Prover

| Field | Value |
|-------|-------|
| **Description** | TEE-based multi-prover AVS for rollup verification. Adds a secondary verification layer using trusted execution environments. |
| **Category** | Security / Verification |
| **Website** | [ata.network](https://ata.network) |
| **Operator Requirements** | TEE hardware (Intel SGX/TDX), run prover node |

### Xterio Mach

| Field | Value |
|-------|-------|
| **Description** | Fast finality for Xterio's gaming-focused chain, powered by AltLayer MACH. |
| **Category** | Gaming / Fast Finality |
| **Operator Requirements** | Same as AltLayer MACH operators |

### OpenLayer

| Field | Value |
|-------|-------|
| **Description** | Decentralized data collection and verification network. |
| **Category** | Data Infrastructure |
| **Website** | [openlayer.tech](https://openlayer.tech) |
| **Operator Requirements** | Run OpenLayer node |

### Hyperlane

| Field | Value |
|-------|-------|
| **Description** | Permissionless interoperability protocol. Enables cross-chain messaging and asset transfers. |
| **Category** | Cross-Chain |
| **Website** | [hyperlane.xyz](https://hyperlane.xyz) |
| **Operator Requirements** | Run Hyperlane validator, minimum stake |
| **Slashing Conditions** | Signing invalid interchain messages |

## Choosing an AVS as an Operator

Factors to evaluate before opting into an AVS:

1. **Reward structure** -- What token are rewards paid in? What is the expected APY?
2. **Slashing risk** -- What are the slashing conditions? How likely is accidental slashing?
3. **Hardware requirements** -- Does the AVS require special hardware (GPU, TEE, high bandwidth)?
4. **Software maturity** -- Is the node software battle-tested? Are there monitoring tools?
5. **Operator concentration** -- How many operators are in the AVS? High concentration may mean lower rewards per operator.
6. **Allocation magnitude** -- How much of your restaked security must you allocate to this AVS?

## Choosing an Operator as a Staker

When delegating your restaked assets, evaluate operators on:

1. **AVS portfolio** -- Which AVSs is the operator registered to? More AVSs = more reward potential but also more slashing vectors.
2. **Commission rate** -- What percentage of rewards does the operator keep?
3. **Track record** -- Has the operator been slashed? What is their uptime?
4. **Total delegated stake** -- Very large operators may have lower marginal reward per staker.
5. **Communication** -- Does the operator publish a metadata URI with contact information?

## Reference

- [EigenLayer AVS Marketplace](https://app.eigenlayer.xyz/avs)
- [EigenLayer AVS Developer Guide](https://docs.eigenlayer.xyz/eigenlayer/avs-guides/avs-developer-guide)
- [AVS Registration on AVSDirectory](https://github.com/Layr-Labs/eigenlayer-contracts/blob/dev/docs/core/AVSDirectory.md)
