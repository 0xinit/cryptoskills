# Mythril Troubleshooting

Common issues with Mythril installation, configuration, and analysis — with root causes and fixes.

## Installation Issues

### Z3 Fails to Build on macOS

```
error: command 'clang' failed with exit status 1
  ERROR: Failed building wheel for z3-solver
```

**Root cause**: Z3 requires a C++ compiler and specific build tools. On macOS, Xcode command-line tools may be missing or outdated.

**Fix**:

```bash
# Install Xcode command-line tools
xcode-select --install

# Install Z3 via Homebrew first
brew install z3

# Then install Mythril (pip will use the system Z3)
pip3 install mythril
```

If the brew Z3 version conflicts with the pip z3-solver package:

```bash
# Install in a clean virtual environment
python3 -m venv mythril-env
source mythril-env/bin/activate
pip install mythril
```

### Z3 Fails to Build on Linux (ARM/aarch64)

**Root cause**: Pre-built Z3 wheels are not available for ARM Linux. Z3 must be compiled from source.

**Fix**:

```bash
# Install build dependencies
sudo apt-get install -y cmake build-essential libgmp-dev

# Build Z3 from source
git clone https://github.com/Z3Prover/z3.git
cd z3
python3 scripts/mk_make.py --python
cd build
make -j$(nproc)
sudo make install
cd ../..

# Then install Mythril
pip3 install mythril
```

Or use Docker (recommended for ARM):

```bash
docker pull mythril/myth
```

### Python Version Incompatible

```
ERROR: mythril requires Python >=3.8, <3.13
```

**Root cause**: Mythril supports Python 3.8 through 3.12. Python 3.13+ may break due to Z3 compatibility.

**Fix**:

```bash
# Use pyenv to install a compatible version
pyenv install 3.12.8
pyenv shell 3.12.8
pip install mythril
```

### pip install hangs during Z3 compilation

**Root cause**: Z3 compilation is CPU-intensive and can take 10-30 minutes on slower machines. This is normal, not a hang.

**Fix**: Wait. If it truly hangs for 30+ minutes, use Docker instead.

## Solc and Compilation Issues

### Wrong Solc Version Selected

**Symptom**: Analysis fails or produces unexpected results because Mythril auto-selected the wrong solc version.

**Fix**: Always specify the solc version explicitly:

```bash
myth analyze Contract.sol --solv 0.8.28
```

### Import Resolution Failures

**Symptom**: Contracts with imports (OpenZeppelin, Solmate, custom libraries) fail to compile.

**Root cause**: Mythril invokes solc directly and does not understand npm, Foundry remappings, or Hardhat import resolution.

**Fix for Foundry projects**:

```bash
myth analyze src/Contract.sol \
  --solc-args "--base-path . --include-path lib --allow-paths ."
```

**Fix for Hardhat projects**:

```bash
myth analyze contracts/Contract.sol \
  --solc-args "--base-path . --include-path node_modules"
```

**Fix for node_modules imports** (e.g., `import "@openzeppelin/contracts/..."`):

```bash
myth analyze Contract.sol \
  --solc-args "--base-path . --include-path node_modules --allow-paths ."
```

### Flattening as a Workaround

If import resolution cannot be fixed, flatten the contract first:

```bash
# Foundry
forge flatten src/Contract.sol > Contract.flat.sol
myth analyze Contract.flat.sol --solv 0.8.28

# Hardhat
npx hardhat flatten contracts/Contract.sol > Contract.flat.sol
myth analyze Contract.flat.sol --solv 0.8.28
```

Flattening has drawbacks: it combines all imports into one file, which increases analysis time and may trigger Z3 memory issues on large dependency trees.

## Memory and Performance Issues

### Out of Memory (OOM)

**Symptom**: Mythril process is killed by OS, or `MemoryError` exception.

**Root cause**: The symbolic execution tree exceeds available RAM. Common with:
- `-t 3` or higher transaction depth
- Large contracts with many state variables
- Contracts with unbounded loops

**Fix**:

```bash
# Reduce transaction depth
myth analyze Contract.sol -t 2 --execution-timeout 300

# Reduce max depth
myth analyze Contract.sol --max-depth 64

# Reduce loop unrolling
myth analyze Contract.sol --loop-bound 2

# Focus on specific modules
myth analyze Contract.sol -m reentrancy,ether_thief
```

With Docker, set a hard memory limit to prevent host OOM:

```bash
docker run --memory=4g -v $(pwd):/src mythril/myth analyze \
  /src/Contract.sol -t 2 --execution-timeout 300
```

### Analysis Takes Hours

**Root cause**: Transaction depth is too high for the contract's complexity, or no execution timeout is set.

**Fix**:

```bash
# Always set a timeout
myth analyze Contract.sol -t 2 --execution-timeout 300

# Use targeted modules instead of running all
myth analyze Contract.sol -m reentrancy --execution-timeout 300

# Try weighted-random strategy for better time utilization
myth analyze Contract.sol --strategy weighted-random --execution-timeout 300
```

### Docker Container Uses Too Much CPU

**Fix**:

```bash
docker run --cpus=2 --memory=4g -v $(pwd):/src mythril/myth analyze /src/Contract.sol
```

## Analysis Timeout and Partial Results

### "Execution timeout reached"

**Symptom**: Mythril reports findings but warns that analysis was incomplete.

This is expected behavior, not an error. Mythril returns whatever findings it discovered before the timeout. An incomplete analysis does NOT mean the contract is safe — it means unexplored paths may contain additional vulnerabilities.

**Actions**:

1. Review the findings that were reported
2. If you need more coverage, increase `--execution-timeout`
3. For focused investigation, use `-m` to analyze specific vulnerability classes
4. Consider running multiple focused scans in parallel:

```bash
# Run targeted scans in parallel
myth analyze Contract.sol -m reentrancy --execution-timeout 600 -o json > reentrancy.json &
myth analyze Contract.sol -m ether_thief --execution-timeout 600 -o json > ether_thief.json &
myth analyze Contract.sol -m delegatecall --execution-timeout 600 -o json > delegatecall.json &
wait
```

### No Findings on a Known-Vulnerable Contract

**Possible causes**:

1. **Transaction depth too shallow**: The exploit requires more transactions than `-t` allows
2. **Timeout too short**: Analysis stopped before reaching the vulnerable path
3. **Module not loaded**: The vulnerability class is not covered by the active modules
4. **Solc version mismatch**: Contract compiled with wrong version, producing different bytecode

**Diagnosis**:

```bash
# Increase verbosity to see what Mythril explored
myth analyze Contract.sol -v 4 -t 3 --execution-timeout 600

# Check if the right modules are running
myth analyze Contract.sol -m reentrancy -v 2
```

## Docker-Specific Issues

### Permission Denied on Output Files

**Symptom**: Mythril writes report files owned by root inside Docker, which the host user cannot read.

**Fix**:

```bash
docker run --user "$(id -u):$(id -g)" -v $(pwd):/src mythril/myth analyze \
  /src/Contract.sol -o json > report.json
```

### Docker Image Out of Date

**Symptom**: Missing detection modules, old solc versions, known bugs.

**Fix**:

```bash
docker pull mythril/myth:latest

# Pin a specific version for reproducible CI
docker pull mythril/myth:0.24.8
```

### Volume Mount Path Confusion

**Symptom**: `FileNotFoundError` inside the container.

**Fix**: Always use absolute paths and verify the mount:

```bash
# List files visible inside the container
docker run -v "$(pwd)":/src --entrypoint ls mythril/myth -la /src/

# Use /src/ prefix for all file paths inside container
docker run -v "$(pwd)":/src mythril/myth analyze /src/src/Contract.sol
```

## False Positive Triage

### SWC-110 (Assert Violation) on Defensive Checks

**Symptom**: Mythril reports assert violations on `assert()` statements that are intentionally used as invariant guards.

**Action**: Verify the assert is truly unreachable in practice. If it is a defensive check (not a bug), suppress by excluding the exceptions module:

```bash
myth analyze Contract.sol --exclude-modules exceptions
```

### SWC-101 (Integer Overflow) on Solidity 0.8.x

**Symptom**: Integer overflow findings on contracts compiled with Solidity 0.8.x, which has built-in overflow protection.

**Action**: These are usually false positives unless the code uses `unchecked {}` blocks. Exclude the module:

```bash
myth analyze Contract.sol --exclude-modules integer
```

### SWC-116 (Block Timestamp Dependence) on Non-Critical Paths

**Symptom**: Timestamp dependence reported on logging, event emission, or non-financial timestamp usage.

**Action**: Review whether the timestamp usage is security-critical. Logging and non-financial timestamps are not exploitable.

## CI-Specific Issues

### GitHub Actions Runner Runs Out of Memory

**Fix**: Use Docker with memory limits and reduce analysis scope:

```yaml
- name: Run Mythril
  run: |
    docker run --rm \
      --memory=4g \
      --cpus=2 \
      -v "${{ github.workspace }}":/src \
      mythril/myth analyze /src/src/Contract.sol \
      -t 2 \
      --execution-timeout 300 \
      --max-depth 64
```

### CI Pipeline Hangs

**Fix**: Set both job-level and Mythril-level timeouts:

```yaml
jobs:
  mythril:
    timeout-minutes: 20  # Kill job after 20 min
    steps:
      - name: Run Mythril
        run: |
          myth analyze Contract.sol --execution-timeout 300  # Kill analysis after 5 min
```

### Inconsistent Results Between Runs

**Root cause**: Mythril's `naive-random` and `weighted-random` strategies use randomness, producing different results on each run.

**Fix for reproducibility**: Use `bfs` (default) or `dfs` strategy:

```bash
myth analyze Contract.sol --strategy bfs
```

Last verified: February 2026
