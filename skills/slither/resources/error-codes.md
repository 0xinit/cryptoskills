# Slither Error Codes and Solutions

Common errors encountered when running Slither, with root causes and fixes.

Last verified: February 2026

## Compilation Errors

### "Source file requires different compiler version"

```
Error: Source file requires different compiler version (current compiler is 0.8.28)
```

**Cause**: The installed solc version does not match the pragma in the contract.

**Fix**:

```bash
solc-select install 0.8.20
solc-select use 0.8.20
slither .
```

Or specify in `.slither.conf.json`:

```json
{
  "solc": "0.8.20"
}
```

For Foundry projects, Slither usually reads the version from `foundry.toml`. If it does not, set `solc` explicitly.

### "Compilation warnings/errors on file"

```
'solc --standard-json' returned an error. Try running 'solc' on the file to see the error.
```

**Cause**: The Solidity code has compilation errors that Slither cannot recover from.

**Fix**:

1. Ensure the project compiles cleanly first:
   ```bash
   forge build    # Foundry
   npx hardhat compile  # Hardhat
   ```
2. If it compiles with the framework but not with Slither, the issue is usually remappings. See the remappings section below.

### "solc not found"

```
FileNotFoundError: [Errno 2] No such file or directory: 'solc'
```

**Cause**: No Solidity compiler installed system-wide.

**Fix**:

```bash
pip install solc-select
solc-select install 0.8.28
solc-select use 0.8.28
```

Verify:

```bash
solc --version
```

## Import Resolution Errors

### "Source not found: @openzeppelin/..."

```
Error: Source "@openzeppelin/contracts/token/ERC20/ERC20.sol" not found
```

**Cause**: Slither cannot resolve npm-style or remapped imports.

**Fix for Foundry**:

Slither reads `remappings.txt` automatically. Verify it exists:

```bash
forge remappings > remappings.txt
```

Or add remappings to `.slither.conf.json`:

```json
{
  "solc_remaps": "@openzeppelin/=lib/openzeppelin-contracts/;forge-std/=lib/forge-std/src/"
}
```

**Fix for Hardhat**:

Ensure `node_modules` is present:

```bash
npm install
```

Slither resolves Hardhat imports via `node_modules` automatically.

### "Source not found: forge-std/..."

```
Error: Source "forge-std/Test.sol" not found
```

**Cause**: Foundry submodules not initialized.

**Fix**:

```bash
git submodule update --init --recursive
forge remappings > remappings.txt
```

### "File import callback not supported"

**Cause**: Slither is using raw solc instead of the framework's compilation pipeline.

**Fix**: Force the compilation framework:

```json
{
  "compile_force_framework": "foundry"
}
```

Or:

```json
{
  "compile_force_framework": "hardhat"
}
```

## Framework Detection Errors

### "No contracts were analyzed"

```
No contract was analyzed. Check if:
- The compilation was successful
- The file has no contract
- The correct compilation framework is used
```

**Cause**: Slither could not detect or use the right compilation framework.

**Fix**:

1. Compile the project first:
   ```bash
   forge build
   ```

2. Force the framework:
   ```bash
   slither . --compile-force-framework foundry
   ```

3. Check that build artifacts exist:
   ```bash
   ls out/    # Foundry
   ls artifacts/  # Hardhat
   ```

### "Hardhat not installed"

```
Error: Hardhat is not installed
```

**Cause**: Slither detected a Hardhat project but `npx hardhat` is not available.

**Fix**:

```bash
npm install
npx hardhat compile
slither .
```

## Python Environment Errors

### "ModuleNotFoundError: No module named 'slither'"

**Cause**: Slither installed in a different Python environment than the one being used.

**Fix**:

```bash
which slither
which python

# Reinstall in the active environment
pip install slither-analyzer
```

Or use `uv` for isolated tool installation:

```bash
uv tool install slither-analyzer
```

### "slither: command not found"

**Cause**: Slither's bin directory is not on PATH.

**Fix**:

```bash
# pip install location
python -m slither .

# Or add to PATH
export PATH="$HOME/.local/bin:$PATH"
```

### Version conflict with web3/eth-abi

```
ERROR: pip's dependency resolver found incompatible versions
```

**Cause**: Slither's dependencies conflict with other packages in the environment.

**Fix**: Install in an isolated environment:

```bash
uv tool install slither-analyzer
```

Or use Docker:

```bash
docker run -v $(pwd):/code trailofbits/eth-security-toolbox slither /code
```

## Runtime Errors

### "RecursionError: maximum recursion depth exceeded"

**Cause**: Deeply nested inheritance or extremely complex contracts exceed Python's recursion limit.

**Fix**:

```bash
# Increase Python recursion limit
python -c "
import sys
sys.setrecursionlimit(5000)
from slither.__main__ import main
main()
"
```

Or analyze specific contracts:

```bash
slither . --contract-name MyContract
```

### Memory errors on large projects

```
MemoryError
# or
Killed (signal 9)
```

**Cause**: Project has hundreds of contracts (e.g., monorepo with all dependencies).

**Fix**:

1. Filter to only your contracts:
   ```bash
   slither src/MyContract.sol
   ```

2. Exclude test files:
   ```bash
   slither . --filter-paths "test/|script/"
   ```

3. Run in Docker with more memory:
   ```bash
   docker run -m 8g -v $(pwd):/code trailofbits/eth-security-toolbox slither /code
   ```

### "Traceback ... SlithIRError"

**Cause**: Internal Slither bug, usually triggered by unusual Solidity patterns or very new syntax.

**Fix**:

1. Update Slither:
   ```bash
   pip install --upgrade slither-analyzer
   ```

2. If it persists, report on GitHub with a minimal reproduction:
   ```bash
   slither . --json /dev/null 2>&1 | head -50
   ```

## JSON / SARIF Output Errors

### "json.decoder.JSONDecodeError"

**Cause**: Slither output mixed with compilation warnings in the JSON stream.

**Fix**: Suppress solc warnings:

```bash
slither . --json report.json --solc-disable-warnings
```

### SARIF file empty or malformed

**Cause**: Slither exited with an error before writing SARIF.

**Fix**: Run without SARIF first to see the actual error:

```bash
slither . 2>&1 | head -20
```

Fix the underlying issue (usually compilation), then re-run with `--sarif`.

## Docker Errors

### "Permission denied" on mounted volume

```
PermissionError: [Errno 13] Permission denied: '/code/...'
```

**Fix**:

```bash
docker run --user $(id -u):$(id -g) -v $(pwd):/code trailofbits/eth-security-toolbox slither /code
```

### "solc not found" inside Docker

**Cause**: The Docker image may not have the required solc version.

**Fix**:

```bash
docker run -v $(pwd):/code trailofbits/eth-security-toolbox bash -c "
  solc-select install 0.8.28 &&
  solc-select use 0.8.28 &&
  slither /code
"
```
