# Security Audit Tools Reference

When to use each tool and how to get started.

## Slither (Static Analysis)

Fast, low false-positive static analyzer by Trail of Bits. Run on every PR.

```bash
pip3 install slither-analyzer

# Full analysis
slither . --filter-paths "node_modules|lib|test"

# High-confidence detectors only
slither . --detect reentrancy-eth,reentrancy-no-eth,arbitrary-send-eth,suicidal,uninitialized-state

# Print human-readable summary
slither . --print human-summary

# Export to JSON for CI processing
slither . --json slither-report.json
```

**CI Integration (GitHub Actions):**

```yaml
- name: Slither
  uses: crytic/slither-action@v0.4.0
  with:
    target: "src/"
    slither-args: "--filter-paths node_modules|lib"
    fail-on: "high"
```

**Key detectors:** `reentrancy-eth`, `arbitrary-send-eth`, `suicidal`, `uninitialized-state`, `unchecked-lowlevel`, `controlled-delegatecall`, `tx-origin`

## Mythril (Symbolic Execution)

Finds deep logic bugs by exploring all reachable states. Slow but thorough.

```bash
pip3 install mythril

# Analyze a single contract
myth analyze src/Vault.sol --solc-json mythril.config.json

# Quick scan with timeout
myth analyze src/Vault.sol --execution-timeout 300

# Target specific SWC categories
myth analyze src/Vault.sol --swc-ids 107,104,106
```

**Best for:** Reentrancy, integer overflow, unhandled exceptions, access control. Use on high-value contracts before mainnet deployment.

## Echidna (Property-Based Fuzzing)

Stateful fuzzer that generates transaction sequences to violate your properties.

```bash
# Install via crytic-compile
pip3 install crytic-compile
brew install echidna  # macOS

# Run with config
echidna . --contract TestVault --config echidna.yaml
```

**echidna.yaml:**

```yaml
testMode: assertion
testLimit: 50000
seqLen: 100
deployer: "0x10000"
sender: ["0x20000", "0x30000"]
```

**Best for:** Stateful invariants, multi-transaction attack sequences, protocol-level properties that depend on transaction ordering.

## Foundry Fuzzing

Built-in fuzz testing with assertion and invariant modes. No extra tooling needed.

```bash
# Fuzz tests (assertion mode)
forge test --match-test testFuzz_ -vvv

# Invariant tests
forge test --match-test invariant_ -vvv

# Increase fuzz runs for pre-deploy confidence
forge test --fuzz-runs 100000
```

**Assertion testing:** Foundry generates random inputs for function parameters.
**Invariant testing:** Foundry generates random sequences of function calls against a handler contract.

**Best for:** Quick iteration during development, testing math-heavy functions, protocol invariants. Should be default for all projects.

## Certora Prover (Formal Verification)

Mathematical proofs that properties hold for ALL possible inputs and states.

```bash
# Install
pip3 install certora-cli

# Run verification
certoraRun src/Vault.sol --verify Vault:spec/vault.spec
```

**spec/vault.spec:**

```
rule depositIncreasesBalance(address user, uint256 amount) {
    env e;
    require e.msg.sender == user;
    uint256 balBefore = balanceOf(user);
    deposit(e, amount);
    uint256 balAfter = balanceOf(user);
    assert balAfter == balBefore + amount;
}
```

**Best for:** Critical DeFi invariants (solvency, no-loss), token accounting correctness, access control proofs. Expensive and has a steep learning curve but provides the strongest guarantees.

## Aderyn (Rust-Based Static Analyzer)

Fast Rust-based analyzer with Solidity-specific detectors. Newer alternative to Slither.

```bash
# Install
cargo install aderyn

# Run analysis
aderyn .

# Output markdown report
aderyn . --output report.md
```

**Best for:** Fast secondary opinion alongside Slither. Catches different patterns due to independent implementation.

## Tool Selection Guide

| Scenario | Tool(s) |
|----------|---------|
| Every PR (CI) | Slither |
| During development | Foundry fuzz + invariant tests |
| Pre-audit preparation | Slither + Mythril + Aderyn |
| Multi-transaction exploits | Echidna |
| Critical protocol invariants | Certora Prover |
| Maximum coverage | All of the above |

## Recommended Pipeline

1. **Development:** Foundry fuzz tests on every function, invariant tests on core properties
2. **PR gate:** Slither in CI, fail on high-severity findings
3. **Pre-audit:** Mythril + Aderyn + Echidna campaign, fix all findings
4. **Pre-mainnet:** Certora for critical invariants, professional audit for anything holding user funds
