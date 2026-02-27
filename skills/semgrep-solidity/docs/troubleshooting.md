# Semgrep Solidity Troubleshooting

Common issues when running Semgrep on Solidity codebases, with root causes and fixes.

## Solidity Parsing Issues

### New Solidity Syntax Not Recognized

**Symptom**: Semgrep fails to parse files using recent Solidity features (e.g., user-defined value types, `using for` with global, transient storage).

**Cause**: Semgrep's Solidity support uses tree-sitter-solidity, which is community-maintained and may lag behind the latest solc releases.

**Fix**:

```bash
# Update Semgrep to latest (gets latest parser)
pip install --upgrade semgrep

# If still failing, exclude the file and scan the rest
semgrep --config rules/ --exclude "contracts/Experimental.sol" ./contracts/

# File an issue on tree-sitter-solidity if the syntax should be supported
# https://github.com/JoranHonig/tree-sitter-solidity
```

### Import Paths Cause Parse Errors

**Symptom**: Files with complex import paths or remappings fail to parse.

**Cause**: Semgrep parses each file independently — it does not resolve imports. Parse errors from imports are usually harmless; Semgrep still scans the file content.

**Fix**: Import resolution errors are typically warnings, not blocking errors. If a file's content is being scanned correctly despite import warnings, no action is needed.

### Unicode or Special Characters

**Symptom**: `UnicodeDecodeError` or garbled output.

**Cause**: File contains BOM (byte order mark) or non-UTF-8 encoding.

**Fix**:

```bash
# Check file encoding
file contracts/MyContract.sol

# Convert to UTF-8 if needed
iconv -f ISO-8859-1 -t UTF-8 contracts/MyContract.sol > /tmp/fixed.sol
mv /tmp/fixed.sol contracts/MyContract.sol
```

## Rule Syntax Errors

### Pattern Doesn't Match Expected Code

**Symptom**: Rule loads without errors but produces no findings on code that should match.

**Cause**: The pattern's AST structure doesn't match the code's AST structure. Common issues:

1. **Missing ellipsis**: Statements exist between your matched lines

```yaml
# WRONG: assumes call and state update are adjacent
- pattern: |
    $ADDR.call{value: $V}($DATA);
    $STATE[$KEY] = $VAL;

# CORRECT: ellipsis allows intervening statements
- pattern: |
    $ADDR.call{value: $V}($DATA);
    ...
    $STATE[$KEY] = $VAL;
```

2. **Visibility/mutability mismatch**: Pattern specifies `external` but code uses `public`

```yaml
# WRONG: only matches external
- pattern: |
    function $F(...) external { ... }

# CORRECT: matches any visibility
- pattern: |
    function $F(...) { ... }
```

3. **Modifier ordering**: Solidity allows modifiers in any order

```yaml
# This only matches if nonReentrant comes right after external
- pattern: |
    function $F(...) external nonReentrant { ... }

# If the function has other modifiers between, use pattern-inside instead
patterns:
  - pattern: $ADDR.call{value: ...}(...)
  - pattern-not-inside: |
      function $F(...) ... nonReentrant ... { ... }
```

**Debug approach**:

```bash
# Use --debug to see pattern matching internals
semgrep --config rules/my-rule.yaml --debug contracts/Target.sol 2>&1 | head -100

# Use --verbose to see which files are scanned
semgrep --config rules/my-rule.yaml --verbose contracts/
```

### `pattern-either` Not Working

**Symptom**: Rule with `pattern-either` matches nothing.

**Cause**: `pattern-either` sub-patterns must each be valid standalone patterns.

```yaml
# WRONG: pattern-not inside pattern-either doesn't make sense
pattern-either:
  - pattern: selfdestruct(...)
  - pattern-not: $X.call(...)  # This is a filter, not a match

# CORRECT: pattern-either contains only positive patterns
pattern-either:
  - pattern: selfdestruct(...)
  - pattern: suicide(...)
```

### Taint Rule Finds Nothing

**Symptom**: Taint rule compiles but never fires.

**Cause**: The source and sink patterns don't match, or a sanitizer is too broad.

**Debug**:

```bash
# Test sources and sinks independently first
# Create a temporary rule with just the source pattern (non-taint)
```

```yaml
# Test: does the source pattern match?
rules:
  - id: test-source
    pattern: $PARAM
    # Note: this alone matches everything — test with pattern-inside
    patterns:
      - pattern: $PARAM
      - pattern-inside: |
          function $F(..., address $PARAM, ...) external { ... }
    message: Source matched
    languages: [solidity]
    severity: INFO
```

```yaml
# Test: does the sink pattern match?
rules:
  - id: test-sink
    pattern: $ADDR.delegatecall(...)
    message: Sink matched
    languages: [solidity]
    severity: INFO
```

If both match independently but the taint rule doesn't fire, the data flow path may be broken (variable reassignment, function call boundary, etc.).

## Performance Issues

### Slow Scanning on Large Codebases

**Symptom**: Semgrep takes minutes on projects with hundreds of Solidity files.

**Cause**: Complex rules (especially taint rules) on large files, or scanning unnecessary directories.

**Fix**:

```bash
# Exclude non-source directories
semgrep --config rules/ \
  --exclude "lib/*" \
  --exclude "node_modules/*" \
  --exclude "out/*" \
  --exclude "cache/*" \
  --exclude "artifacts/*" \
  ./

# Increase timeout but limit memory
semgrep --config rules/ --timeout 30 --max-memory 2048 ./contracts/

# Run in parallel (Semgrep does this by default, but you can tune)
semgrep --config rules/ --jobs 4 ./contracts/
```

### Rule Timeout on Specific Files

**Symptom**: One rule times out on a specific large contract.

**Fix**: Simplify the pattern. Deeply nested `pattern-inside` with ellipsis is the most common cause of slow matching:

```yaml
# SLOW: triple nesting
patterns:
  - pattern-inside: |
      contract $C {
        ...
        function $F(...) {
          ...
        }
        ...
      }
  - pattern-inside: |
      for (...) { ... }
  - pattern: $X.call{...}(...)

# FASTER: flatten to essential context only
patterns:
  - pattern: $X.call{...}(...)
  - pattern-inside: |
      for (...) { ... }
```

## False Positives

### Reducing False Positives

Common false positive patterns and how to suppress them:

**1. Safe patterns flagged as unsafe**:

```yaml
# Add exclusions for known-safe patterns
patterns:
  - pattern: $ADDR.call{value: ...}(...)
  - pattern-not-inside: |
      function $F(...) ... nonReentrant ... { ... }
  - pattern-not-inside: |
      function $F(...) internal { ... }
  - pattern-not-inside: |
      function $F(...) private { ... }
```

**2. Test files flagged**:

```yaml
# Exclude test files at the rule level
paths:
  exclude:
    - "test/"
    - "*.t.sol"
    - "test/**"
```

Or at the CLI level:

```bash
semgrep --config rules/ --exclude "test/*" --exclude "*.t.sol" ./
```

**3. Library code flagged**:

```bash
semgrep --config rules/ --exclude "lib/*" --exclude "node_modules/*" ./
```

### Inline Suppression

```solidity
// Suppress a specific rule on the next line
// nosemgrep: rule-id
selfdestruct(owner);

// Suppress on the same line
selfdestruct(owner); // nosemgrep: rule-id

// Suppress ALL rules on the next line
// nosemgrep
selfdestruct(owner);
```

### Audit Trail for Suppressions

Track why rules were suppressed — critical for audit preparation:

```solidity
// nosemgrep: unsafe-external-call-before-state-update
// Justification: nonReentrant modifier applied via inheritance (BaseVault)
// Auditor: @alice, 2026-02-15
(bool ok, ) = msg.sender.call{value: amount}("");
```

## CI/CD Issues

### Different Results Locally vs CI

**Cause**: Different Semgrep versions, or different file sets being scanned.

**Fix**:

```bash
# Pin version in CI
pip install semgrep==1.108.0

# Verify the same files are being scanned
semgrep --config rules/ --verbose ./contracts/ 2>&1 | grep "Scanning"
```

### GitHub SARIF Upload Rejected

**Symptom**: `upload-sarif` action fails with validation error.

**Cause**: SARIF file exceeds GitHub's size limit (25MB) or contains invalid entries.

**Fix**:

```bash
# Check SARIF file size
ls -la results.sarif

# Filter to ERROR only to reduce size
semgrep --config rules/ --sarif --severity ERROR ./contracts/ > results.sarif
```

### Pre-commit Hook Runs on Non-Solidity Files

**Fix**: Add file filter to `.pre-commit-config.yaml`:

```yaml
hooks:
  - id: semgrep
    files: \.sol$
    exclude: "^(lib|node_modules|test)/"
```

## Version Compatibility

| Semgrep Version | Solidity Support | Notes |
|----------------|------------------|-------|
| 1.50+ | Basic patterns | Initial Solidity support |
| 1.60+ | Taint tracking | Taint mode works for Solidity |
| 1.80+ | Improved parser | Better handling of newer syntax |
| 1.100+ | Current | Best coverage, recommended minimum |

```bash
# Check your version
semgrep --version

# Update to latest
pip install --upgrade semgrep
```

Last verified: February 2026
