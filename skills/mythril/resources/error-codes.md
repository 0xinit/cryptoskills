# Mythril Error Codes and Fixes

Common Mythril errors, their root causes, and how to fix them.

## Compilation Errors

### "Solc experienced a fatal error"

```
mythril.exceptions.CompilerError: Solc experienced a fatal error (code 1)
```

**Cause**: The installed solc version does not match the contract's pragma, or solc cannot compile the contract.

**Fix**:

```bash
# Specify the exact solc version
myth analyze Contract.sol --solv 0.8.28

# If using Docker, the image includes solc management
docker run -v $(pwd):/src mythril/myth analyze /src/Contract.sol --solv 0.8.28
```

### "Source file requires different compiler version"

```
Error: Source file requires different compiler version (current compiler is X.Y.Z)
```

**Cause**: The pragma in the contract specifies a version range that does not include the default solc version Mythril is using.

**Fix**:

```bash
# Check what pragma the contract needs
grep -r "pragma solidity" Contract.sol

# Specify matching version
myth analyze Contract.sol --solv 0.8.20
```

### "File import callback not supported"

```
mythril.exceptions.CompilerError: Import callback not supported
```

**Cause**: The contract imports external files (OpenZeppelin, etc.) and Mythril cannot resolve the import paths.

**Fix**:

```bash
# Provide include paths via solc args
myth analyze Contract.sol \
  --solc-args "--base-path . --include-path node_modules --include-path lib"

# For Foundry projects
myth analyze src/Contract.sol \
  --solc-args "--base-path . --include-path lib --allow-paths ."
```

### "ParserError: Expected pragma, import directive or contract/interface/library/struct/enum/constant/function/error definition"

**Cause**: Solc version mismatch where newer Solidity syntax is used with an older compiler. Common with custom errors, user-defined value types, or `using ... for ... global`.

**Fix**: Ensure `--solv` matches the pragma exactly.

## Z3 Solver Errors

### "Z3 not found" / "z3 solver not available"

```
ImportError: cannot import name 'z3' from 'z3'
```

**Cause**: Z3 solver is not installed or the Python bindings are missing.

**Fix**:

```bash
# Install Z3 Python bindings
pip3 install z3-solver

# macOS: install system Z3 first
brew install z3
pip3 install z3-solver

# Ubuntu/Debian
sudo apt-get install libz3-dev
pip3 install z3-solver
```

Or use Docker (includes Z3):

```bash
docker pull mythril/myth
```

### "Z3Exception: model is not available"

**Cause**: Z3 could not find a satisfying assignment within the solver timeout. The constraint system is either unsatisfiable or too complex.

**Fix**:

```bash
# Increase solver timeout (in milliseconds)
myth analyze Contract.sol --solver-timeout 60000

# Default is 10000ms (10s). Complex contracts may need 30-120s.
```

### "Solver timeout reached"

```
mythril.laser.smt: Timeout reached for solver query
```

**Cause**: Individual Z3 queries are exceeding the solver timeout. This happens with large contracts that produce complex path constraints.

**Fix**:

```bash
# Increase per-query timeout
myth analyze Contract.sol --solver-timeout 60000

# Reduce analysis scope to specific modules
myth analyze Contract.sol -m reentrancy --solver-timeout 30000

# Reduce loop unrolling
myth analyze Contract.sol --loop-bound 2
```

## Timeout and Resource Errors

### Analysis runs indefinitely

**Cause**: No execution timeout is set and the contract's state space is too large for the transaction depth.

**Fix**:

```bash
# Always set an execution timeout
myth analyze Contract.sol --execution-timeout 300 -t 2
```

### Out of Memory (OOM)

```
MemoryError
# or process killed by OS
```

**Cause**: The symbolic execution tree is too large for available RAM. Common with `-t 3+` on complex contracts.

**Fix**:

```bash
# Reduce transaction depth
myth analyze Contract.sol -t 2 --execution-timeout 300

# Limit max depth
myth analyze Contract.sol --max-depth 64

# With Docker, set explicit memory limit
docker run --memory=8g -v $(pwd):/src mythril/myth analyze \
  /src/Contract.sol -t 2 --execution-timeout 300
```

### "Max depth reached"

```
mythril.laser.ethereum.state: Maximum depth reached
```

**Cause**: The symbolic execution tree exceeded `--max-depth`. Mythril stops exploring that branch.

This is not an error — it is expected behavior. Mythril prunes paths that exceed the depth limit to keep analysis tractable.

**Fix** (if you suspect missed paths):

```bash
# Increase max depth
myth analyze Contract.sol --max-depth 256

# Use a different search strategy
myth analyze Contract.sol --strategy weighted-random --max-depth 128
```

## Docker Errors

### "Permission denied" on mounted files

```
PermissionError: [Errno 13] Permission denied: '/src/Contract.sol'
```

**Cause**: The Docker container runs as a different user than the host, and the mounted files are not readable.

**Fix**:

```bash
# Run as current user
docker run --user "$(id -u):$(id -g)" -v $(pwd):/src mythril/myth analyze /src/Contract.sol

# Or fix file permissions
chmod -R a+r contracts/
```

### "No such file or directory" inside Docker

```
FileNotFoundError: [Errno 2] No such file or directory: '/src/Contract.sol'
```

**Cause**: The volume mount path is wrong, or the file path inside the container does not match.

**Fix**:

```bash
# Use absolute paths and verify the mount
docker run -v "$(pwd)":/src mythril/myth analyze /src/Contract.sol

# Verify the file is accessible inside the container
docker run -v "$(pwd)":/src --entrypoint ls mythril/myth /src/
```

### Docker image too old

**Cause**: Cached Docker image does not have the latest detection modules or solc versions.

**Fix**:

```bash
docker pull mythril/myth:latest
```

## Analysis Output Errors

### Empty report / no findings

**Cause**: This can mean either (a) the contract is clean, (b) analysis was too shallow, or (c) analysis timed out before finding issues.

**Diagnosis**:

```bash
# Run with verbose output to see analysis progress
myth analyze Contract.sol -v 4 -t 2 --execution-timeout 300

# Check if timeout was hit — stderr will show timeout messages
myth analyze Contract.sol -t 2 --execution-timeout 300 2>mythril-stderr.log
grep -i "timeout" mythril-stderr.log
```

If timeout was hit, increase it or focus on specific modules.

### "Invalid JSON output"

**Cause**: Mythril printed warnings or errors to stdout mixed with JSON output.

**Fix**:

```bash
# Redirect stderr separately
myth analyze Contract.sol -o json 2>mythril-errors.log > report.json

# Verify JSON is valid
python3 -m json.tool report.json > /dev/null
```

## Python Environment Errors

### "ModuleNotFoundError: No module named 'mythril'"

**Cause**: Mythril is not installed in the active Python environment, or the wrong Python version is active.

**Fix**:

```bash
# Check Python version (3.8-3.12 required)
python3 --version

# Install in a virtual environment
python3 -m venv mythril-env
source mythril-env/bin/activate
pip install mythril
```

### Version conflicts with other tools

**Cause**: Mythril's dependencies (z3-solver, web3, etc.) conflict with other installed packages.

**Fix**:

```bash
# Use a dedicated virtual environment
python3 -m venv mythril-env
source mythril-env/bin/activate
pip install mythril

# Or use Docker to avoid all dependency conflicts
docker run -v $(pwd):/src mythril/myth analyze /src/Contract.sol
```

Last verified: February 2026
