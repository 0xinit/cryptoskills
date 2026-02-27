# Semgrep Operator Reference

Complete reference for all Semgrep rule operators, with Solidity examples.

## Pattern Operators

### `pattern`

Matches a single code pattern. The most basic operator.

```yaml
- pattern: selfdestruct(...)
```

Matches:

```solidity
selfdestruct(owner);
selfdestruct(payable(msg.sender));
```

### `patterns`

Combines multiple conditions with AND logic. All sub-patterns must match.

```yaml
patterns:
  - pattern: $ADDR.call{value: $V}($DATA)
  - pattern-not-inside: |
      function $F(...) ... nonReentrant ... { ... }
```

### `pattern-either`

OR logic. Matches if ANY sub-pattern matches.

```yaml
pattern-either:
  - pattern: selfdestruct(...)
  - pattern: suicide(...)
  - pattern: $PROXY.delegatecall(...)
```

### `pattern-not`

Excludes matches. Must be inside a `patterns:` block.

```yaml
patterns:
  - pattern: $TOKEN.transfer($TO, $AMOUNT)
  # Exclude SafeERC20 usage
  - pattern-not: $TOKEN.safeTransfer($TO, $AMOUNT)
```

### `pattern-inside`

Matches only if the pattern occurs inside the specified context.

```yaml
patterns:
  - pattern: selfdestruct(...)
  - pattern-inside: |
      function $F(...) public { ... }
```

### `pattern-not-inside`

Excludes matches that occur inside the specified context.

```yaml
patterns:
  - pattern: $ADDR.call{value: ...}(...)
  - pattern-not-inside: |
      function $F(...) ... nonReentrant ... { ... }
  - pattern-not-inside: |
      function $F(...) internal { ... }
```

### `pattern-regex`

Matches raw text using regular expressions. Ignores AST structure.

```yaml
- pattern-regex: "pragma solidity \\^"
```

Use sparingly — regex matches text, not structure. Prefer AST patterns when possible.

### `pattern-not-regex`

Excludes regex matches.

```yaml
patterns:
  - pattern: pragma solidity $VERSION
  - pattern-not-regex: "0\\.8\\."
```

## Metavariable Operators

### `metavariable-regex`

Matches a captured metavariable's text against a regex.

```yaml
patterns:
  - pattern: function $F(...) external { ... }
  - metavariable-regex:
      metavariable: $F
      # Flag admin-sounding functions
      regex: "^(set|update|pause|unpause|kill|destroy|migrate|upgrade)"
```

### `metavariable-pattern`

Applies a sub-pattern to the code matched by a metavariable.

```yaml
patterns:
  - pattern: |
      for (...) {
        ...
        $BODY;
        ...
      }
  - metavariable-pattern:
      metavariable: $BODY
      # Only flag if the loop body contains an external call
      pattern: $ADDR.call{...}(...)
```

### `metavariable-comparison`

Compares a numeric metavariable using Python-style expressions.

```yaml
patterns:
  - pattern: require($COND, $MSG)
  - metavariable-comparison:
      metavariable: $MSG
      # Flag require strings longer than 32 bytes (gas waste)
      comparison: len(str($MSG)) > 34  # 32 chars + 2 quotes
```

### `metavariable-analysis`

Performs semantic analysis on a metavariable. Currently supports `redos` (ReDoS detection) — less relevant for Solidity.

```yaml
patterns:
  - pattern: $REGEX
  - metavariable-analysis:
      metavariable: $REGEX
      analyzer: redos
```

## Taint Mode Operators

These operators are only valid when `mode: taint` is set.

### `pattern-sources`

Defines where tainted data originates.

```yaml
pattern-sources:
  # External function parameters are user-controlled
  - patterns:
      - pattern: $PARAM
      - pattern-inside: |
          function $F(..., address $PARAM, ...) external { ... }

  # msg.value is user-controlled
  - pattern: msg.value

  # calldata is user-controlled
  - pattern: msg.data
```

### `pattern-sinks`

Defines dangerous operations where tainted data should not reach.

```yaml
pattern-sinks:
  - pattern: $ADDR.delegatecall($DATA)
  - pattern: $ADDR.call{value: $V}($DATA)
  - pattern: selfdestruct($ADDR)
```

### `pattern-sanitizers`

Defines operations that "clean" tainted data, breaking the taint chain.

```yaml
pattern-sanitizers:
  # Validation checks sanitize the data
  - pattern: require($ADDR != address(0), ...)
  - pattern: require(whitelist[$ADDR], ...)
  - pattern: |
      if (!isApproved[$ADDR]) { revert(...); }
```

### `pattern-propagators`

Defines how taint spreads through custom operations (beyond assignments).

```yaml
pattern-propagators:
  - from: $INPUT
    to: $OUTPUT
    pattern: $OUTPUT = keccak256(abi.encodePacked($INPUT))
```

### Taint Labels

Track multiple independent taint sources with labels:

```yaml
pattern-sources:
  - label: USER_INPUT
    pattern: msg.sender
  - label: ORACLE_DATA
    patterns:
      - pattern: $FEED.latestRoundData()

pattern-sinks:
  - requires: USER_INPUT
    pattern: $ADDR.delegatecall(...)
  - requires: ORACLE_DATA
    pattern: $AMOUNT * $PRICE
```

## Focus Operators

### `focus-metavariable`

Narrows the reported finding to a specific metavariable location, rather than the entire matched block.

```yaml
patterns:
  - pattern: |
      function $F(...) external {
        ...
        selfdestruct($ADDR);
        ...
      }
  - focus-metavariable: $ADDR
# Finding highlights only $ADDR, not the entire function
```

## Rule-Level Fields

### Required Fields

| Field | Description | Values |
|-------|-------------|--------|
| `id` | Unique rule identifier | String (kebab-case recommended) |
| `message` | Description shown to user | String (supports $METAVAR references) |
| `languages` | Target language | `[solidity]` for Solidity |
| `severity` | Finding severity | `ERROR`, `WARNING`, `INFO` |

Plus one of: `pattern`, `patterns`, `pattern-either`, or `pattern-regex` (or taint sources/sinks if `mode: taint`).

### Optional Fields

| Field | Description | Example |
|-------|-------------|---------|
| `mode` | Analysis mode | `taint` (default is `search`) |
| `fix` | Autofix replacement | `require($ADDR != address(0));` |
| `fix-regex` | Regex-based autofix | `{ regex: ..., replacement: ... }` |
| `paths` | Include/exclude file paths | `{ include: ["contracts/"], exclude: ["test/"] }` |
| `options` | Fine-tune matching behavior | `{ symbolic_propagation: true }` |
| `metadata` | Metadata tags | `{ category: security, cwe: "CWE-841" }` |

### `fix` (Autofix)

```yaml
- id: transfer-to-call
  pattern: $ADDR.transfer($AMT)
  fix: |
    (bool success, ) = $ADDR.call{value: $AMT}("");
    require(success, "Transfer failed");
  message: Replace .transfer() with .call{value:}
  languages: [solidity]
  severity: WARNING
```

### `fix-regex` (Regex Autofix)

```yaml
- id: remove-solidity-caret
  pattern-regex: "pragma solidity \\^(\\d+\\.\\d+\\.\\d+)"
  fix-regex:
    regex: "\\^(\\d+\\.\\d+\\.\\d+)"
    replacement: "\\1"
  message: Pin Solidity version — remove caret.
  languages: [solidity]
  severity: INFO
```

### `paths` (File Filtering)

```yaml
- id: no-console-in-production
  pattern: console.log(...)
  paths:
    include:
      - "contracts/"
      - "src/"
    exclude:
      - "test/"
      - "script/"
  message: Remove console.log before deployment.
  languages: [solidity]
  severity: WARNING
```

### `options`

```yaml
- id: my-rule
  options:
    # Follow assignments for metavariables
    symbolic_propagation: true
    # Match commutative operations (a + b matches b + a)
    commutative_boolop: true
  pattern: ...
```

## Operator Precedence

When combining operators, Semgrep evaluates in this order:

1. `pattern` / `pattern-regex` — base matching
2. `pattern-inside` / `pattern-not-inside` — scope filtering
3. `pattern-not` — exclusion
4. `metavariable-*` — metavariable constraints
5. `focus-metavariable` — finding location narrowing

## Quick Reference Table

| Operator | Logic | Scope | Use Case |
|----------|-------|-------|----------|
| `pattern` | Match | Base | Match a code pattern |
| `patterns` | AND | Container | Combine conditions |
| `pattern-either` | OR | Container | Match alternatives |
| `pattern-not` | NOT | Filter | Exclude false positives |
| `pattern-inside` | SCOPE | Filter | Require surrounding context |
| `pattern-not-inside` | NOT SCOPE | Filter | Exclude based on context |
| `pattern-regex` | REGEX | Base | Match raw text |
| `metavariable-regex` | REGEX | Filter | Constrain captured variable |
| `metavariable-pattern` | AST | Filter | Sub-pattern on variable |
| `metavariable-comparison` | NUMERIC | Filter | Compare numeric values |
| `focus-metavariable` | FOCUS | Output | Narrow finding location |
| `pattern-sources` | TAINT | Taint | Define taint origins |
| `pattern-sinks` | TAINT | Taint | Define dangerous ops |
| `pattern-sanitizers` | TAINT | Taint | Define taint cleaners |

Last verified: February 2026
