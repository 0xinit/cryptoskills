# Write a Custom Semgrep Rule

Build a Semgrep rule from scratch that detects a specific Solidity anti-pattern: using `block.timestamp` as the sole source of randomness.

## The Vulnerability

`block.timestamp` is manipulable by validators within a ~15 second window. Using it for randomness in lotteries, games, or token distribution is exploitable.

## Step 1: Identify the Pattern

The anti-pattern looks like:

```solidity
// Vulnerable: block.timestamp used as randomness
uint256 random = uint256(keccak256(abi.encodePacked(block.timestamp)));
uint256 winner = random % participants.length;
```

What we want to match: any `keccak256(abi.encodePacked(...))` call that includes `block.timestamp` as an argument.

## Step 2: Write the Rule

Create `rules/timestamp-randomness.yaml`:

```yaml
rules:
  - id: timestamp-as-randomness
    patterns:
      - pattern-either:
          # Direct use in keccak256
          - pattern: keccak256(abi.encodePacked(<... block.timestamp ...>))
          - pattern: keccak256(abi.encode(<... block.timestamp ...>))
          # Assigned to a "random" variable (heuristic)
          - patterns:
              - pattern: uint256 $RANDOM = ... block.timestamp ...
              - metavariable-regex:
                  metavariable: $RANDOM
                  regex: "(?i)(random|rand|seed|entropy|nonce)"
    message: >-
      block.timestamp used as a source of randomness. Validators can
      manipulate block.timestamp within a ~15 second window, making this
      predictable. Use Chainlink VRF or a commit-reveal scheme instead.
    languages: [solidity]
    severity: ERROR
    metadata:
      category: security
      cwe: "CWE-330: Use of Insufficiently Random Values"
      references:
        - https://swcregistry.io/docs/SWC-120
        - https://docs.chain.link/vrf
      confidence: HIGH
```

## Step 3: Write Test Cases

Create `rules/timestamp-randomness.sol` (same directory, same name, `.sol` extension):

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract RandomnessTest {
    address[] public participants;

    // ruleid: timestamp-as-randomness
    function pickWinnerBad() external view returns (uint256) {
        uint256 random = uint256(keccak256(abi.encodePacked(block.timestamp)));
        return random % participants.length;
    }

    // ruleid: timestamp-as-randomness
    function pickWinnerBad2() external view returns (uint256) {
        uint256 random = uint256(
            keccak256(abi.encodePacked(block.timestamp, msg.sender))
        );
        return random % participants.length;
    }

    // ruleid: timestamp-as-randomness
    function badSeedGeneration() external view returns (uint256) {
        uint256 seed = uint256(keccak256(abi.encode(block.timestamp, block.prevrandao)));
        return seed;
    }

    // ok: timestamp-as-randomness
    function getDeadline() external view returns (uint256) {
        return block.timestamp + 1 hours;
    }

    // ok: timestamp-as-randomness
    function pickWinnerGood(uint256 vrfRandomWord) external view returns (uint256) {
        return vrfRandomWord % participants.length;
    }

    // ok: timestamp-as-randomness
    function logTimestamp() external view returns (uint256) {
        return block.timestamp;
    }
}
```

## Step 4: Run the Test

```bash
# Run the test to verify true positives and true negatives
semgrep --test ./rules/timestamp-randomness.yaml

# Expected output:
#   1/1 tests passed
```

## Step 5: Run Against a Project

```bash
# Scan your contracts directory
semgrep --config rules/timestamp-randomness.yaml ./contracts/

# Example output:
# contracts/Lottery.sol
#   severity: error rule: timestamp-as-randomness
#   > uint256 random = uint256(keccak256(abi.encodePacked(block.timestamp)));
```

## Step 6: Add an Autofix (Optional)

You can suggest a fix directly in the rule, though complex fixes like integrating Chainlink VRF require manual work:

```yaml
rules:
  - id: timestamp-as-randomness
    patterns:
      - pattern: |
          uint256 $RANDOM = uint256(keccak256(abi.encodePacked(block.timestamp)))
    fix: |
      // TODO: Replace with Chainlink VRF or commit-reveal scheme
      // uint256 $RANDOM = uint256(keccak256(abi.encodePacked(block.timestamp)))
      revert("Insecure randomness — use Chainlink VRF");
    message: >-
      block.timestamp used as a source of randomness.
    languages: [solidity]
    severity: ERROR
```

## Key Takeaways

1. Start with the vulnerability you want to detect — write the vulnerable code first
2. Use `pattern-either` to catch multiple variants of the same anti-pattern
3. Use `metavariable-regex` for heuristic matching on variable names
4. Always write test files with `ruleid:` and `ok:` annotations
5. Run `semgrep --test` before deploying rules to CI
6. The deep expression operator `<... expr ...>` matches `expr` anywhere inside a larger expression

## File Structure

```
rules/
├── timestamp-randomness.yaml    # Rule definition
└── timestamp-randomness.sol     # Test cases
```

Last verified: February 2026
