# Semgrep Error Codes and Fixes

Common errors encountered when running Semgrep on Solidity codebases, with root causes and fixes.

## Parse Errors

### `Parsing error: could not parse file`

```
Error: failed to parse contracts/MyContract.sol
```

**Cause**: Semgrep's Solidity parser (tree-sitter-solidity) doesn't recognize the syntax. Common triggers:
- Very new Solidity syntax not yet supported by tree-sitter-solidity
- Non-standard pragma directives
- File encoding issues (BOM characters)

**Fix**:

```bash
# Check your Solidity version — update Semgrep to latest for best parser support
pip install --upgrade semgrep

# Exclude the problematic file if it uses unsupported syntax
semgrep --config rules/ --exclude "contracts/Experimental.sol" ./contracts/
```

### `Syntax error at line N`

**Cause**: The Solidity file has an actual syntax error, or uses syntax the parser doesn't support.

**Fix**:

```bash
# Verify the file compiles with solc first
solc --bin contracts/MyContract.sol

# If solc compiles fine but Semgrep fails, it's a parser limitation.
# File an issue or exclude the file.
```

## Rule Validation Errors

### `Invalid rule: missing required field 'id'`

```
Invalid rule at rules/my-rule.yaml: missing required field 'id'
```

**Cause**: Every rule must have a unique `id` field.

**Fix**:

```yaml
rules:
  - id: my-rule-name  # Required — must be unique across all loaded rules
    patterns:
      - pattern: ...
    message: ...
    languages: [solidity]
    severity: WARNING
```

### `Invalid rule: 'pattern' and 'patterns' are mutually exclusive`

**Cause**: A rule uses both `pattern:` (singular) and `patterns:` (list) at the same level.

**Fix**:

```yaml
# WRONG
rules:
  - id: bad-rule
    pattern: selfdestruct(...)
    patterns:
      - pattern-not-inside: ...

# CORRECT — use patterns (list) for combining
rules:
  - id: good-rule
    patterns:
      - pattern: selfdestruct(...)
      - pattern-not-inside: |
          function $F(...) ... onlyOwner ... { ... }
```

### `Invalid rule: unknown key 'pattern-source'`

**Cause**: Typo in taint mode keys. The correct keys are `pattern-sources` and `pattern-sinks` (plural).

**Fix**:

```yaml
# WRONG
pattern-source:
  - pattern: ...

# CORRECT
pattern-sources:
  - pattern: ...
pattern-sinks:
  - pattern: ...
```

### `Invalid rule: 'mode: taint' requires pattern-sources and pattern-sinks`

**Cause**: Taint rules must define both sources and sinks.

**Fix**:

```yaml
rules:
  - id: taint-rule
    mode: taint  # Requires both sources and sinks
    pattern-sources:
      - pattern: $PARAM
    pattern-sinks:
      - pattern: $ADDR.delegatecall(...)
    message: ...
    languages: [solidity]
    severity: ERROR
```

### `Rule 'X' has conflicting 'languages' for taint mode`

**Cause**: Taint mode doesn't support all languages. Solidity is supported.

**Fix**: Ensure `languages: [solidity]` is set correctly. Do not use `generic` with taint mode.

## Timeout Errors

### `Rule 'X' timed out on file 'Y'`

```
Timeout: rule my-rule exceeded 5.0s on contracts/BigContract.sol
```

**Cause**: Complex patterns or taint rules on large files exceed the default 5-second timeout.

**Fix**:

```bash
# Increase per-rule timeout (seconds)
semgrep --config rules/ --timeout 30 ./contracts/

# Increase max memory (MB)
semgrep --config rules/ --max-memory 4096 ./contracts/
```

For persistent timeouts, simplify the rule:

```yaml
# SLOW: deeply nested pattern-inside with ellipsis
patterns:
  - pattern-inside: |
      contract $C {
        ...
        function $F(...) {
          ...
        }
        ...
      }
  - pattern: selfdestruct(...)

# FASTER: less nesting
patterns:
  - pattern: selfdestruct(...)
  - pattern-inside: |
      function $F(...) { ... }
```

### `Out of memory`

**Cause**: Scanning a very large codebase or running many complex taint rules simultaneously.

**Fix**:

```bash
# Limit memory
semgrep --config rules/ --max-memory 2048 ./contracts/

# Scan in batches
semgrep --config rules/ ./contracts/core/
semgrep --config rules/ ./contracts/periphery/
```

## Finding Issues

### No findings when you expect them

**Cause**: Pattern doesn't match the AST structure, or the file isn't being scanned.

**Debug**:

```bash
# Verbose mode shows which files are scanned and which rules are loaded
semgrep --config rules/ --verbose ./contracts/

# Debug mode shows pattern matching details
semgrep --config rules/ --debug ./contracts/

# Verify the file is included
semgrep --config rules/ --verbose ./contracts/ 2>&1 | grep "Scanning"
```

**Common causes**:
1. Pattern whitespace differs from AST structure
2. Missing `...` where statements exist between matched lines
3. `languages` is wrong (e.g., `generic` instead of `solidity`)
4. File extension not recognized (Semgrep looks for `.sol`)

### Too many false positives

**Cause**: Pattern is too broad.

**Fix**: Add exclusions:

```yaml
patterns:
  - pattern: $ADDR.call{value: ...}(...)
  # Exclude safe patterns
  - pattern-not-inside: |
      function $F(...) ... nonReentrant ... { ... }
  - pattern-not-inside: |
      function $F(...) internal { ... }
```

### `nosemgrep` not working

**Cause**: The comment must be on the same line or the line immediately before the finding.

**Fix**:

```solidity
// nosemgrep: rule-id
$ADDR.call{value: amount}("");

// Or on the same line
$ADDR.call{value: amount}(""); // nosemgrep: rule-id
```

## Test Errors

### `Test failed: expected finding at line N but got none`

**Cause**: The `// ruleid:` annotation expects a finding but the rule doesn't match.

**Fix**:

```bash
# Run with debug to see why the pattern doesn't match
semgrep --config rules/my-rule.yaml --debug rules/my-rule.sol
```

Common issues:
- Rule ID in annotation doesn't match the `id:` in the YAML
- Pattern doesn't match due to AST structure differences
- Missing ellipsis in pattern

### `Test failed: unexpected finding at line N`

**Cause**: The rule fires on a line marked with `// ok:` (expected no finding).

**Fix**: Add `pattern-not` or `pattern-not-inside` exclusions to the rule to eliminate the false positive.

## CI/CD Errors

### `Semgrep exited with code 1`

**Cause**: When using `--error` flag, Semgrep exits with code 1 if any findings match.

**Fix**: This is expected behavior for CI gating. Findings must be fixed or suppressed.

### `Semgrep exited with code 2`

**Cause**: Internal error — invalid rule, parse failure, or configuration issue.

**Fix**: Run with `--verbose` to identify the failing rule or file.

### SARIF upload fails

**Cause**: SARIF file is empty or malformed.

**Fix**:

```yaml
# Generate SARIF even if no findings
- name: Run Semgrep
  run: |
    semgrep --config .semgrep/ --sarif --output results.sarif ./contracts/ || true

# Upload only if file exists and is non-empty
- name: Upload SARIF
  if: always() && hashFiles('results.sarif') != ''
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif
```

Last verified: February 2026
