# Slither Troubleshooting

Common issues and fixes when running Slither against Solidity projects.

Last verified: February 2026

## solc Version Mismatch

### Symptom

```
Error: Source file requires different compiler version
```

### Root Cause

Slither uses the system `solc` binary, which may not match your project's pragma.

### Fix

Install the correct version via `solc-select`:

```bash
solc-select install 0.8.28
solc-select use 0.8.28
```

Verify:

```bash
solc --version
```

For projects with multiple pragma versions, use the highest version that covers all files:

```bash
solc-select use 0.8.28
slither .
```

Or specify in config:

```json
{
  "solc": "0.8.28"
}
```

### Multiple Solidity Versions

If your project has files with different pragma requirements (e.g., interfaces at ^0.8.0, core at ^0.8.20), Foundry handles this with per-file compilation. Slither reads Foundry artifacts, so this usually works:

```bash
forge build
slither .
```

If it fails, force the framework:

```bash
slither . --compile-force-framework foundry
```

## Foundry Remapping Issues

### Symptom

```
Error: Source "forge-std/Test.sol" not found
Error: Source "@openzeppelin/contracts/..." not found
```

### Root Cause

Slither cannot find the remappings that Foundry resolves automatically.

### Fix

Generate `remappings.txt`:

```bash
forge remappings > remappings.txt
```

Slither reads this file automatically. Verify it contains all needed mappings:

```bash
cat remappings.txt
```

Expected output:

```
forge-std/=lib/forge-std/src/
@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
solmate/=lib/solmate/src/
```

If `remappings.txt` exists but Slither still fails, add remappings to the config:

```json
{
  "solc_remaps": "forge-std/=lib/forge-std/src/;@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"
}
```

### Missing Submodules

```bash
git submodule update --init --recursive
```

After updating submodules, regenerate remappings:

```bash
forge remappings > remappings.txt
```

## Hardhat / node_modules Resolution

### Symptom

```
Error: Source "@openzeppelin/contracts/..." not found
```

### Root Cause

`node_modules` not installed, or Slither is not using Hardhat's resolver.

### Fix

```bash
npm install
npx hardhat compile
slither .
```

If Slither detects the wrong framework:

```bash
slither . --compile-force-framework hardhat
```

### npx Not Found

```
Error: npx is not available
```

Install Node.js (required for Hardhat projects):

```bash
# macOS
brew install node

# Ubuntu
sudo apt install nodejs npm
```

## Docker Permission Issues

### Symptom

```
PermissionError: [Errno 13] Permission denied: '/code/...'
```

### Root Cause

Docker container runs as root, but mounted volume files are owned by your user (or vice versa).

### Fix

Match user/group IDs:

```bash
docker run \
  --user $(id -u):$(id -g) \
  -v $(pwd):/code \
  trailofbits/eth-security-toolbox \
  slither /code
```

### solc Not Available in Container

```bash
docker run -v $(pwd):/code trailofbits/eth-security-toolbox bash -c "
  pip install solc-select &&
  solc-select install 0.8.28 &&
  solc-select use 0.8.28 &&
  slither /code
"
```

## Memory Issues on Large Projects

### Symptom

```
Killed (signal 9)
MemoryError
```

### Root Cause

Projects with hundreds of contracts (monorepos, projects importing entire dependency trees) exhaust available memory.

### Fixes

**1. Analyze only your contracts:**

```bash
slither src/MyContract.sol
```

**2. Filter test and script files:**

```json
{
  "filter_paths": "test/|script/|lib/"
}
```

Note: `filter_paths` only filters findings from output, not from analysis. To skip analysis entirely, target specific files.

**3. Increase memory in Docker:**

```bash
docker run -m 8g -v $(pwd):/code trailofbits/eth-security-toolbox slither /code
```

**4. Analyze contracts individually:**

```bash
for f in src/*.sol; do
  echo "=== $f ==="
  slither "$f" --filter-paths "lib/" 2>&1 | grep -E "^(INFO|WARNING)" || true
done
```

## "No contracts were analyzed"

### Symptom

```
No contract was analyzed. Check if:
- The compilation was successful
- The file has no contract
- The correct compilation framework is used
```

### Common Causes and Fixes

**Build artifacts missing:**

```bash
forge build    # or: npx hardhat compile
slither .
```

**Wrong framework detected:**

```bash
slither . --compile-force-framework foundry
```

**Empty src/ directory:**

Check that your contracts are in the path Slither expects. Foundry uses `src/`, Hardhat uses `contracts/`.

**foundry.toml with custom src path:**

```toml
[profile.default]
src = "contracts"
```

Slither reads `foundry.toml` but may not respect all config. Verify:

```bash
forge build
ls out/  # Artifacts should exist
slither .
```

## Slither Crashes with Traceback

### Symptom

```
Traceback (most recent call last):
  File ".../slither/...", line XX
  ...
SlithIRError: ...
```

### Root Cause

Internal Slither bug, usually triggered by unusual Solidity constructs, very new language features, or compiler bugs.

### Fixes

**1. Update Slither:**

```bash
pip install --upgrade slither-analyzer
```

**2. Check if it's a known issue:**

```bash
# Search GitHub issues
gh search issues --repo crytic/slither "SlithIRError" --state open
```

**3. Work around by excluding the problematic file:**

```json
{
  "filter_paths": "src/ProblematicContract.sol"
}
```

**4. Report the issue:**

Create a minimal reproduction and file at https://github.com/crytic/slither/issues.

## JSON Output Contains Compilation Warnings

### Symptom

`slither-report.json` contains solc warnings mixed into the JSON, making it unparseable.

### Fix

```bash
slither . --json report.json --solc-disable-warnings
```

Or in config:

```json
{
  "json": "report.json",
  "solc_disable_warnings": true
}
```

## Slither Finds Issues in Dependencies

### Symptom

Output includes dozens of findings from OpenZeppelin, forge-std, or other libraries.

### Fix

Filter paths:

```bash
slither . --filter-paths "lib/|node_modules/"
```

Persist in config:

```json
{
  "filter_paths": "lib/forge-std|lib/openzeppelin-contracts|node_modules"
}
```

Be specific with path patterns. `lib/` filters ALL Foundry dependencies. List individual directories if you want to analyze some dependencies but not others.

## GitHub Actions Failures

### "Resource not accessible by integration"

SARIF upload requires `security-events: write` permission:

```yaml
permissions:
  contents: read
  security-events: write
```

### slither-action Fails to Compile

The action auto-detects and compiles. If it fails:

1. Add explicit compilation step before the action
2. Use `ignore-compile: true` in the action
3. Ensure submodules are checked out:

```yaml
- uses: actions/checkout@v4
  with:
    submodules: recursive
```

### Rate Limiting on solc Download

CI runners may be rate-limited when downloading solc binaries. Cache the binary:

```yaml
- name: Cache solc
  uses: actions/cache@v4
  with:
    path: ~/.solc-select
    key: solc-${{ hashFiles('foundry.toml') }}

- name: Install solc
  run: |
    pip install solc-select
    solc-select install 0.8.28
    solc-select use 0.8.28
```

## Vyper Support Issues

Slither supports Vyper contracts but detection is less mature than Solidity. If Vyper analysis fails:

1. Ensure Vyper compiler is installed: `pip install vyper`
2. Compile first: `vyper contracts/MyContract.vy`
3. Run Slither on the individual file: `slither contracts/MyContract.vy`

Vyper support has fewer detectors. Check which apply:

```bash
slither --list-detectors | grep -i vyper
```
