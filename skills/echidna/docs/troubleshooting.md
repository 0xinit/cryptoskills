# Echidna Troubleshooting Guide

Common issues and solutions when using Echidna for smart contract fuzzing.

## Solc Version Mismatch

**Symptoms:**
- `Error: Source file requires different compiler version`
- Compilation fails before fuzzing starts

**Solutions:**

1. Install the correct solc version with solc-select:
   ```bash
   pip3 install solc-select
   solc-select install 0.8.28
   solc-select use 0.8.28
   solc --version
   ```

2. If your project uses multiple solc versions across files, pin all contracts to the same version in the test harness:
   ```solidity
   pragma solidity ^0.8.28;
   ```

3. For Foundry projects where `foundry.toml` specifies the solc version, use:
   ```yaml
   cryticArgs: ["--compile-force-framework", "foundry"]
   ```
   This delegates compilation entirely to Foundry, which handles solc version management.

## Foundry Remapping Issues

**Symptoms:**
- `Error: Could not find @openzeppelin/...`
- `Error: Source "forge-std/Test.sol" not found`
- Compilation works with `forge build` but fails with Echidna

**Solutions:**

1. **Preferred: Use Foundry compilation framework:**
   ```yaml
   cryticArgs: ["--compile-force-framework", "foundry"]
   ```
   This uses Foundry's own compilation pipeline, automatically resolving all remappings from `foundry.toml` and `remappings.txt`.

2. **Manual remappings (when Foundry framework mode does not work):**
   ```yaml
   cryticArgs: [
     "--solc-remaps",
     "@openzeppelin/=lib/openzeppelin-contracts/src/;forge-std/=lib/forge-std/src/;solmate/=lib/solmate/src/"
   ]
   ```
   Match these exactly to your `remappings.txt` or the `[remappings]` section in `foundry.toml`.

3. **Verify remappings are correct:**
   ```bash
   forge remappings
   ```
   Copy the output and format as a semicolon-separated string for `--solc-remaps`.

4. **Submodules not initialized:**
   ```bash
   git submodule update --init --recursive
   forge install
   ```

## Slow Fuzzing / Low Throughput

**Symptoms:**
- Less than 100 transactions per second
- Fuzzing runs for hours without meaningful coverage growth
- Corpus size plateaus early

**Root Causes and Fixes:**

### Expensive Constructor

If the constructor deploys many contracts or performs heavy computation, every test sequence starts with this overhead.

**Fix:** Pre-compute addresses and minimize constructor logic:
```solidity
constructor() {
    // Deploy dependencies once — Echidna reuses the deployed state
    token = new Token();
    // Do NOT deploy an entire Uniswap factory in the constructor
}
```

### Expensive Property Checks

Properties are evaluated after every transaction in the sequence. If a property iterates over a large array, this multiplies runtime.

**Fix:** Track state incrementally instead of recomputing:
```solidity
// SLOW: iterates all holders every check
function echidna_supply_check() public view returns (bool) {
    uint256 sum;
    for (uint256 i = 0; i < holders.length; i++) {
        sum += balanceOf[holders[i]];
    }
    return sum == totalSupply;
}

// FAST: ghost variable tracks sum incrementally
uint256 internal _trackedSum;

function echidna_supply_check() public view returns (bool) {
    return _trackedSum == totalSupply;
}
```

### Single Worker

Default is 1 worker. Each additional worker explores independently.

**Fix:**
```yaml
workers: 4  # match your CPU core count
```

### Excessive Sequence Length

Long `seqLen` means each test runs more transactions before checking properties.

**Fix:** Start with shorter sequences:
```yaml
seqLen: 50  # instead of 300
```

## Coverage Gaps

**Symptoms:**
- Corpus size stays small
- Known code paths are not being explored
- `Unique instructions` count is low relative to contract size

**Solutions:**

### Add Helper Functions

Echidna can only call public/external functions. If important state transitions require specific preconditions, add helpers:

```solidity
// Without this, Echidna cannot exercise the withdrawal path
// because it cannot deposit first with the right parameters
function setup_deposit_and_borrow(uint256 depositAmount, uint256 borrowAmount) public {
    if (depositAmount == 0 || depositAmount > 1e24) return;
    if (borrowAmount == 0 || borrowAmount > depositAmount / 2) return;
    deposit(depositAmount);
    borrow(borrowAmount);
}
```

### Use a Dictionary

Provide protocol-specific constants that Echidna would not discover randomly:

```yaml
dictionary: "dict.txt"
```

```
# dict.txt — boundary values for a lending protocol
# 150% collateral ratio threshold
0x0000000000000000000000000000000000000000000000000000000000003A98
# Common token amounts (1e18, 1e6)
0x0000000000000000000000000000000000000000000000000DE0B6B3A7640000
0x00000000000000000000000000000000000000000000000000000000000F4240
# Max uint256
0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF
```

### Add More Senders

For multi-role protocols:
```yaml
sender: ["0x10000", "0x20000", "0x30000", "0x40000"]
```

### Reduce seqLen for Broader Exploration

Counterintuitively, shorter sequences can improve coverage because Echidna explores more diverse starting points:
```yaml
seqLen: 30  # try more diverse short sequences
testLimit: 200000  # compensate with more total transactions
```

## Property Design Mistakes

### Problem: Property Is Trivially True

```solidity
// Always true: uint256 is always >= 0
function echidna_balance_non_negative() public view returns (bool) {
    return balanceOf[msg.sender] >= 0;
}
```

**Fix:** Write properties that can actually fail. Test them by introducing a bug and verifying Echidna catches it.

### Problem: Property Depends on Msg.Sender

```solidity
// BUG: msg.sender in a property function is inconsistent.
// Properties are called by Echidna's internal runner, not by sender addresses.
function echidna_my_balance_bounded() public view returns (bool) {
    return balanceOf[msg.sender] <= totalSupply;
}
```

**Fix:** Check all known addresses explicitly:
```solidity
function echidna_all_balances_bounded() public view returns (bool) {
    return balanceOf[address(0x10000)] <= totalSupply
        && balanceOf[address(0x20000)] <= totalSupply;
}
```

### Problem: Ghost Variable Out of Sync

```solidity
// BUG: forgot to update ghost in transferFrom
function transferFrom(address from, address to, uint256 amount) public override {
    super.transferFrom(from, to, amount);
    // _ghostTransferCount not updated here!
}
```

**Fix:** Override every function that changes tracked state. Search for all call sites that modify the variable's underlying state.

### Problem: Property Only Checks Happy Path

```solidity
// Only checks that solvent users stay solvent.
// Misses the case where insolvency is created.
function echidna_users_solvent() public view returns (bool) {
    if (getDebt(address(0x10000)) == 0) return true;
    return getCollateralValue(address(0x10000)) >= getDebt(address(0x10000));
}
```

**Fix:** Do not skip checks — the interesting case is exactly when debt exists:
```solidity
function echidna_users_collateralized() public view returns (bool) {
    address[2] memory users = [address(0x10000), address(0x20000)];
    for (uint256 i = 0; i < users.length; i++) {
        uint256 debt = getDebt(users[i]);
        if (debt == 0) continue;
        uint256 collateral = getCollateralValue(users[i]);
        uint256 required = debt * COLLATERAL_RATIO / DENOMINATOR;
        if (collateral < required) return false;
    }
    return true;
}
```

## Foundry Cheatcode Incompatibility

**Symptoms:**
- `vm.prank()`, `vm.deal()`, `vm.warp()` cause compilation errors or runtime failures
- Test harness written for Foundry does not work in Echidna

**Solutions:**

Echidna does NOT support Foundry's `vm` cheatcodes. Restructure the test harness:

| Foundry Pattern | Echidna Equivalent |
|----------------|-------------------|
| `vm.prank(addr)` | Configure `sender` in echidna.yaml |
| `vm.deal(addr, amount)` | Set `balanceAddr` in config, or mint in constructor |
| `vm.warp(timestamp)` | Echidna auto-advances time based on `maxTimeDelay` |
| `vm.roll(blockNum)` | Echidna auto-advances blocks based on `maxBlockDelay` |
| `deal(token, addr, amount)` | Call `token.mint(addr, amount)` in constructor |
| `vm.expectRevert()` | Use try/catch in the test harness |

```solidity
// Foundry style (does NOT work in Echidna)
function test_only_owner_mints() public {
    vm.prank(attacker);
    vm.expectRevert();
    token.mint(attacker, 1e18);
}

// Echidna style (works)
// echidna.yaml: deployer: "0x30000", sender: ["0x10000", "0x20000"]
// Since senders are not the owner, Echidna naturally tests unauthorized access
function echidna_no_unauthorized_mint() public view returns (bool) {
    return totalSupply == _initialSupply;
}
```

## Docker Issues

### Permission Denied on Volume Mounts

```bash
# Ensure directories exist and are writable
mkdir -p corpus
chmod 777 corpus

docker run --rm \
  -v $(pwd):/src \
  ghcr.io/crytic/echidna/echidna \
  echidna /src/test/MyTest.sol \
  --contract MyTest \
  --corpus-dir /src/corpus
```

### Solc Not Found in Docker

The Echidna Docker image may not include your required solc version. Mount a local solc binary:

```bash
# Install solc locally first
solc-select install 0.8.28

# Find the binary path
which solc

# Mount it into the container
docker run --rm \
  -v $(pwd):/src \
  -v $(which solc):/usr/local/bin/solc \
  ghcr.io/crytic/echidna/echidna \
  echidna /src/test/MyTest.sol --contract MyTest
```

## CI Integration Issues

### Echidna Exit Code

Echidna returns exit code 1 when a property fails. Use this in CI:

```yaml
- name: Run Echidna
  run: |
    echidna test/MyTest.sol --contract MyTest --config echidna.yaml
  continue-on-error: false  # fail the pipeline on property violations
```

### Caching Corpus Between Runs

```yaml
- name: Cache Echidna Corpus
  uses: actions/cache@v4
  with:
    path: corpus
    key: echidna-corpus-${{ hashFiles('test/echidna/**') }}
    restore-keys: |
      echidna-corpus-
```

### Timeout in CI

CI runners have limited time. Use a conservative config:

```yaml
testLimit: 10000
seqLen: 20
shrinkLimit: 1000
workers: 2
testTimeout: 120
```

Last verified: February 2026
