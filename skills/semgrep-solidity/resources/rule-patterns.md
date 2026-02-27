# Semgrep Rule Patterns for Solidity

Common pattern syntax reference for writing Solidity-specific Semgrep rules.

## Metavariables

Metavariables capture parts of matched code. They start with `$` and bind on first use.

| Metavariable | Matches | Example |
|-------------|---------|---------|
| `$X` | Any single expression | `$X.call{value: $V}(...)` |
| `$FUNC` | Function name | `function $FUNC(...) external { ... }` |
| `$...ARGS` | Zero or more arguments | `abi.encodePacked($...ARGS)` |
| `$_` | Any expression (unnamed, no binding) | `require($_, $MSG)` |

### Binding Rules

Metavariables with the same name must match the same value within a single rule:

```yaml
# $TOKEN must be the same in both lines
- pattern: |
    $TOKEN.transferFrom($FROM, address(this), $AMOUNT);
    ...
    $TOKEN.transfer($TO, $AMOUNT);
```

`$_` is the wildcard — it matches anything without binding, so it can match different values in different positions:

```yaml
# $_ can be different addresses in each position
- pattern: require($_ != address(0), $_)
```

## Ellipsis Operator (`...`)

The ellipsis matches zero or more items in different contexts:

### In Function Arguments

```yaml
# Match any call to transfer, regardless of argument count
- pattern: $TOKEN.transfer(...)

# Match transferFrom with any args
- pattern: $TOKEN.transferFrom(...)
```

### In Function Bodies

```yaml
# Match any code between two statements
- pattern: |
    $X.call{value: ...}(...);
    ...
    $STATE[$KEY] = $VAL;
```

### In Function Parameters

```yaml
# Match function with address parameter anywhere in param list
- pattern: |
    function $F(..., address $ADDR, ...) external { ... }
```

### In Struct/Contract Bodies

```yaml
# Match a contract containing a specific function
- pattern: |
    contract $C {
      ...
      function withdraw(...) external { ... }
      ...
    }
```

## Deep Expression Operator (`<... ...>`)

Matches an expression anywhere inside a larger expression, at any nesting depth:

```yaml
# Match msg.value anywhere inside keccak256 args
- pattern: keccak256(abi.encodePacked(<... msg.value ...>))

# Match block.timestamp anywhere in an expression
- pattern: <... block.timestamp ...>

# Match tx.origin in any boolean expression
- pattern: require(<... tx.origin ...>, ...)
```

## Typed Metavariables

Constrain metavariables to specific types (when Semgrep can infer types):

```yaml
# Only match address-type variables
- pattern: |
    (address $ADDR).call{value: $V}($DATA)

# Match uint256 assignments
- pattern: |
    uint256 $X = ...;
```

## Metavariable-regex

Match metavariable content against a regex:

```yaml
rules:
  - id: unsafe-naming
    patterns:
      - pattern: function $F(...) external { ... }
      - metavariable-regex:
          metavariable: $F
          regex: "^(admin|owner|set|update|pause|kill|destroy)"
    message: Admin function $F — verify access control.
    languages: [solidity]
    severity: WARNING
```

## Metavariable-pattern

Apply a sub-pattern to the matched metavariable:

```yaml
rules:
  - id: external-call-in-loop
    patterns:
      - pattern: |
          for (...) {
            ...
            $CALL;
            ...
          }
      - metavariable-pattern:
          metavariable: $CALL
          pattern: $ADDR.call{...}(...)
    message: External call inside loop — potential DoS if one call reverts.
    languages: [solidity]
    severity: WARNING
```

## Metavariable-comparison

Compare metavariable values:

```yaml
rules:
  - id: small-optimizer-runs
    patterns:
      - pattern: optimizer_runs = $RUNS
      - metavariable-comparison:
          metavariable: $RUNS
          comparison: $RUNS < 200
    message: Optimizer runs below 200 — may miss gas optimizations.
    languages: [solidity]
    severity: INFO
```

## Solidity-Specific Pattern Examples

### Modifier Matching

```yaml
# Match function WITH a specific modifier
- pattern: |
    function $F(...) external onlyOwner { ... }

# Match function WITHOUT a specific modifier
patterns:
  - pattern: |
      function $F(...) external { ... }
  - pattern-not: |
      function $F(...) external nonReentrant { ... }
  - pattern-not: |
      function $F(...) external onlyOwner { ... }
```

### Event Emission

```yaml
# Detect state change without event emission
patterns:
  - pattern: |
      function $F(...) external {
        ...
        $STATE = $VAL;
        ...
      }
  - pattern-not: |
      function $F(...) external {
        ...
        emit $EVENT(...);
        ...
      }
```

### Mapping Access

```yaml
# Match mapping read + write pattern
- pattern: |
    $MAP[$KEY]
    ...
    $MAP[$KEY] = $VAL;
```

### Assembly Blocks

```yaml
# Detect inline assembly (flag for manual review)
- pattern: |
    assembly { ... }

# Detect specific assembly operations
- pattern: |
    assembly {
      ...
      selfdestruct(...)
      ...
    }
```

### Interface Calls

```yaml
# Match calls to specific interface methods
- pattern: IERC20($TOKEN).transfer($TO, $AMT)

# Match any external call with value
- pattern: $ADDR.call{value: $V}($DATA)

# Match delegatecall
- pattern: $ADDR.delegatecall($DATA)

# Match staticcall
- pattern: $ADDR.staticcall($DATA)
```

### Constructor Patterns

```yaml
# Match constructor without initializer
- pattern: |
    constructor(...) {
      ...
    }

# Match upgradeable without initializer call
patterns:
  - pattern: |
      contract $C is Initializable {
        ...
      }
  - pattern-not: |
      contract $C is Initializable {
        ...
        function initialize(...) ... initializer { ... }
        ...
      }
```

### Require / Custom Error Patterns

```yaml
# Match require with string (suggest custom errors for gas)
- pattern: require($COND, $MSG)

# Match revert with custom error
- pattern: revert $ERROR(...)

# Match if-revert pattern
- pattern: |
    if ($COND) {
      revert $ERROR(...);
    }
```

## Combining Patterns: Decision Matrix

| You Want | Use |
|----------|-----|
| All conditions must match | `patterns:` (AND — top-level list) |
| Any condition can match | `pattern-either:` (OR) |
| Exclude a pattern | `pattern-not:` |
| Match must be inside scope | `pattern-inside:` |
| Match must NOT be inside scope | `pattern-not-inside:` |
| Match regex on code | `pattern-regex:` |
| Sub-pattern on captured var | `metavariable-pattern:` |
| Regex on captured var name | `metavariable-regex:` |
| Compare captured var value | `metavariable-comparison:` |

Last verified: February 2026
