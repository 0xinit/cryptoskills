# Monad Architecture Deep Dive

## Overview

Monad achieves 10,000+ TPS with 400ms blocks through four innovations working together:

1. **MonadBFT** — Tail-fork-resistant pipelined consensus
2. **Deferred (Asynchronous) Execution** — Consensus and execution pipeline separately
3. **Optimistic Parallel Execution** — Transactions execute concurrently
4. **MonadDb** — Custom SSD-optimized state database

Plus **JIT Compilation** and **RaptorCast** for additional throughput gains.

## MonadBFT Consensus

### Core Parameters

| Parameter | Value |
|-----------|-------|
| Minimum block time | 400ms |
| Speculative finality | 1 slot (400ms) |
| Full finality | 2 slots (800ms) |
| Byzantine threshold | n = 3f+1 (tolerates f Byzantine nodes) |
| Quorum | >2/3 stake weight (2f+1 honest nodes) |
| Active validators | 150-200 nodes |
| Communication (happy path) | O(n) linear |
| Signature aggregation | BLS |

### Block State Machine

```
Proposed → Voted (speculative finality) → Finalized (irreversible)
```

- **Proposed**: Validators receive block, pass validity checks
- **Voted**: Child block's QC assembled; parent achieves speculative finality
- **Finalized**: Grandchild block's QC assembled; grandparent is irreversible

### Happy Path (Normal Operation)

**Round K — Alice proposes block N:**
1. Alice selects transactions, constructs block N with prior QC
2. Broadcasts via RaptorCast to all validators
3. Validators validate, send signed votes to Bob (next leader)
4. Block N marked as **Proposed**

**Round K+1 — Bob proposes block N+1:**
1. Bob receives >=2f+1 votes, aggregates into QC for block N
2. Constructs block N+1 with new payload + Alice's QC
3. Validators vote, send to Charlie (K+2 leader)
4. Block N marked as **Voted** (speculative finality)

**Round K+2 — Charlie proposes block N+2:**
1. Charlie assembles QC from votes on Bob's block
2. Block N reaches **Finalized** state (irreversible)

### Message Types

| Type | Purpose | Communication |
|------|---------|---------------|
| **Block Proposal** | Leader's proposed block + prior QC | Fan-out (leader -> all) |
| **Vote** | Signed approval of proposal | Fan-in (all -> next leader) |
| **Quorum Certificate (QC)** | Aggregated >=2f+1 YES votes (BLS) | Included in next proposal |
| **Timeout Message** | Attestation of non-receipt of valid proposal | All-to-all broadcast |
| **Timeout Certificate (TC)** | Aggregated >=2f+1 timeout messages | Next leader uses for reproposal |
| **No-Endorsement Certificate (NEC)** | >=2f+1 validators lack complete block data | Permits fresh proposal at same height |

### Unhappy Path (Leader Failure)

1. Alice proposes block N -> validators vote -> Bob is next leader
2. Bob fails to propose -> votes lost, no QC for Alice's block
3. Timeout window expires -> all validators broadcast timeout messages
4. Supermajority timeout messages form TC
5. TC contains "high_tip" — highest-round proposal known
6. Next leader MUST either:
   - **Repropose** high_tip block (retrieve via Blocksync), OR
   - **Fresh propose** with NEC proof (>=2f+1 validators attest they lack the block)

### Tail-Fork Resistance

**Problem in prior protocols**: A new leader could ignore/fork the previous leader's block, even if it had votes.

**MonadBFT solution**:
- TC encodes "high_tip" — knowledge of the prior block
- Next leader is *obligated* to repropose unless NEC obtained
- NEC requires >=2f+1 no-endorsement attestations
- Mathematical guarantee: >=f+1 non-Byzantine nodes overlap between any QC and TC, preventing fork

### Speculative Finality

Blocks reach speculative finality after 1 round (400ms). Reversion requires:
- Original leader **equivocated** (signed two blocks at same height) — provable, slashable
- PLUS next leader failed
- PLUS >=1/3 Byzantine nodes
- PLUS TC selected the second block

This combination is extremely unlikely. For most applications, speculative finality is safe.

### Fast Recovery Mechanisms

1. **Dual vote delivery** — Validators send votes to both current and next leader
2. **Enhanced timeout messages** — Include highest observed QC
3. **Tip votes** — Timeout messages include vote for tip, enabling QC formation
4. **TC optimization** — TC includes highest QC if >= highest tip

Result: A single failed leader causes only one timeout; all subsequent rounds succeed immediately.

## Deferred (Asynchronous) Execution

Consensus and execution are **pipelined separately**:

```
Consensus:  [Block N] → [Block N+1] → [Block N+2] → [Block N+3]
                ↓            ↓              ↓
Execution:            [Exec N]    → [Exec N+1]  → [Exec N+2]
```

During consensus, only lightweight validity checks occur:
- Signature verification
- Nonce correctness
- Balance sufficiency (via reserve balance)

Actual EVM execution happens after finalization, allowing the full block time for execution rather than splitting it with consensus.

### Delayed Merkle Root

Execution lags consensus by **k=3 blocks**. Block proposals include merkle roots for state 3 blocks prior as a sanity check. Nodes discovering mismatches rewind to block n-k-1 and re-execute.

## Optimistic Parallel Execution

Transactions execute concurrently with **optimistic** assumption of no conflicts:

1. Multiple virtual executors process transactions simultaneously
2. Each generates "pending results" containing:
   - Inputs: storage slots read (SLOADs)
   - Outputs: storage slots written (SSTOREs)
3. Serial commitment validates each result's inputs remain valid
4. If conflict detected -> re-execute the affected transaction
5. Results committed in **original transaction order**

**Key property**: Every transaction executes **at most twice**. Most transactions don't conflict, achieving near-linear speedup.

### Parallel-Friendly Contract Design

| Pattern | Parallelizes Well | Why |
|---------|-------------------|-----|
| Per-user mappings | Yes | Independent state per user |
| ERC-20 transfers between different pairs | Yes | Different storage slots |
| Global counter increment | No | All txns write same slot |
| AMM swaps on same pool | No | Same reserves storage |
| Independent NFT mints (incremental ID) | Partially | tokenId counter serializes |

No Solidity code changes needed — parallelism is transparent at the runtime level.

## MonadDb

Custom storage engine replacing generic databases:

- Optimized for **SSD access patterns** with merkle trie data
- **Async I/O** (asio) for non-blocking reads/writes
- **In-memory caching** for hot state
- **Batched updates** for efficient merkle root computation
- Eliminates a level of indirection vs commodity databases
- Reduces SSD I/O operations per state lookup
- Supports parallel reads — synergizes with optimistic parallel execution

## JIT Compilation

Frequently-used contracts compile to native **x86-64 machine code** in the background:

- Compilation is asynchronous — doesn't block execution
- Preserves exact EVM semantics including gas calculations and error behavior
- Most useful for core DeFi contracts (DEXs, lending) that run constantly
- Transparent to developers — no action required

## RaptorCast

Efficient block distribution using erasure coding:

- Block split into ~150 chunks (e.g., 1000KB block -> 150 x 20KB chunks)
- **Any 50 chunks** can reassemble the original block
- Each validator receives stake-weighted chunks and relays to others
- Two-level broadcast tree
- Leader upload bandwidth limited to `block_size x ~2` (replication factor)

## Node Architecture

Three components:

| Component | Language | Role |
|-----------|----------|------|
| `monad-bft` | Rust | Consensus |
| `monad-execution` | C++ | Execution and state |
| `monad-rpc` | — | User-facing JSON-RPC interface |

All nodes execute all transactions with full state.

### Hardware Requirements

| Resource | Specification |
|----------|--------------|
| CPU | 16-core, 4.5 GHz |
| RAM | 32 GB |
| Storage | Dual 2TB NVMe SSD |
| Bandwidth | 300 Mbps |
| Estimated cost | ~$1,500 assembly |
