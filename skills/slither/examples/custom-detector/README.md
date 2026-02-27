# Custom Slither Detector

Write a custom detector that flags functions modifying state variables without emitting events. This is a real pattern — off-chain indexers miss state changes when events are absent.

## Detector: Missing Event on State Change

### detector_missing_event.py

```python
"""
Slither custom detector: flags functions that write to state variables
without emitting any event. Off-chain indexers and monitoring systems
rely on events to track state changes — missing events create blind spots.
"""

from slither.detectors.abstract_detector import (
    AbstractDetector,
    DetectorClassification,
)
from slither.core.cfg.node import NodeType


class MissingEventOnStateChange(AbstractDetector):
    # CLI flag: --detect missing-event-state-change
    ARGUMENT = "missing-event-state-change"
    HELP = "State-changing function without event emission"
    IMPACT = DetectorClassification.LOW
    CONFIDENCE = DetectorClassification.HIGH

    WIKI = "https://github.com/example/custom-detectors#missing-event"
    WIKI_TITLE = "Missing Event on State Change"
    WIKI_DESCRIPTION = (
        "Functions that modify storage without emitting events prevent "
        "off-chain services from tracking state changes. Every meaningful "
        "state transition should emit an event."
    )
    WIKI_EXPLOIT_SCENARIO = """
```solidity
contract Registry {
    mapping(address => bool) public operators;

    // No event: indexers cannot track operator changes
    function addOperator(address op) external onlyOwner {
        operators[op] = true;
    }
}
```
An off-chain monitoring service watches for `OperatorAdded` events to update its
allowlist. Because no event is emitted, the service never learns about the new
operator, creating a mismatch between on-chain and off-chain state."""

    WIKI_RECOMMENDATION = (
        "Emit a descriptive event after every state variable modification. "
        "Include the old and new values as indexed parameters where practical."
    )

    def _detect(self):
        results = []

        for contract in self.compilation_unit.contracts_derived:
            for function in contract.functions_declared:
                if self._should_skip(function):
                    continue

                state_vars_written = function.state_variables_written
                if not state_vars_written:
                    continue

                if self._function_emits_event(function):
                    continue

                info = [
                    function,
                    " writes to state variable(s) ",
                    ", ".join(v.name for v in state_vars_written),
                    " but does not emit any event.\n",
                ]
                res = self.generate_result(info)
                results.append(res)

        return results

    @staticmethod
    def _should_skip(function):
        """Skip functions where missing events are expected."""
        if function.is_constructor:
            return True
        if function.is_fallback or function.is_receive:
            return True
        if function.view or function.pure:
            return True
        # Private/internal helpers often rely on the caller to emit
        if function.visibility in ("private", "internal"):
            return True
        return False

    @staticmethod
    def _function_emits_event(function):
        """Check if any node in the function's CFG emits an event."""
        for node in function.nodes:
            for ir in node.irs:
                # SlithIR EventCall represents emit statements
                from slither.slithir.operations import EventCall

                if isinstance(ir, EventCall):
                    return True
        return False
```

## Test Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Registry {
    address public owner;
    mapping(address => bool) public operators;
    uint256 public fee;

    event OwnerChanged(address indexed oldOwner, address indexed newOwner);
    event FeeUpdated(uint256 oldFee, uint256 newFee);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // GOOD: emits event
    function setOwner(address _newOwner) external onlyOwner {
        emit OwnerChanged(owner, _newOwner);
        owner = _newOwner;
    }

    // BAD: no event — detector should flag this
    function addOperator(address op) external onlyOwner {
        operators[op] = true;
    }

    // BAD: no event — detector should flag this
    function removeOperator(address op) external onlyOwner {
        operators[op] = false;
    }

    // GOOD: emits event
    function setFee(uint256 _fee) external onlyOwner {
        emit FeeUpdated(fee, _fee);
        fee = _fee;
    }
}
```

## Running the Detector

### Option 1: Plugin file

```bash
slither . --detect missing-event-state-change \
  --plugin-detect ./detector_missing_event.py
```

### Option 2: Install as package

Project structure for a pip-installable detector package:

```
my-slither-detectors/
├── pyproject.toml
└── src/
    └── my_detectors/
        ├── __init__.py
        └── missing_event.py
```

```toml
# pyproject.toml
[project]
name = "my-slither-detectors"
version = "0.1.0"
dependencies = ["slither-analyzer>=0.10.0"]

[project.entry-points."slither_analyzer.plugin"]
my_detectors = "my_detectors"
```

```python
# src/my_detectors/__init__.py
from my_detectors.missing_event import MissingEventOnStateChange

def make_plugin():
    plugin_detectors = [MissingEventOnStateChange]
    plugin_printers = []
    return plugin_detectors, plugin_printers
```

Install and run:

```bash
pip install -e ./my-slither-detectors
slither . --detect missing-event-state-change
```

## Expected Output

```
Registry.addOperator(address) (src/Registry.sol#30-32) writes to state variable(s) operators but does not emit any event.
Registry.removeOperator(address) (src/Registry.sol#35-37) writes to state variable(s) operators but does not emit any event.
```

`setOwner` and `setFee` are not flagged because they emit events. The constructor is skipped by design.

## Detector API Reference

### Required Class Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `ARGUMENT` | str | CLI detector ID — used with `--detect` |
| `HELP` | str | One-line description shown in `--list-detectors` |
| `IMPACT` | DetectorClassification | Severity: HIGH, MEDIUM, LOW, INFORMATIONAL, OPTIMIZATION |
| `CONFIDENCE` | DetectorClassification | How certain the finding is correct |
| `WIKI` | str | URL to detailed documentation |
| `WIKI_TITLE` | str | Title for the wiki page |
| `WIKI_DESCRIPTION` | str | Detailed description of the issue |
| `WIKI_EXPLOIT_SCENARIO` | str | Code example showing the vulnerability |
| `WIKI_RECOMMENDATION` | str | How to fix the issue |

### Required Method

```python
def _detect(self) -> list:
    """
    Run detection logic.
    Returns a list of results created via self.generate_result(info).
    info is a list of strings and SlithIR objects (Function, Variable, Node)
    that Slither formats into human-readable output with source references.
    """
```

### Useful Objects in _detect

```python
# All contracts (excluding inherited-only)
self.compilation_unit.contracts_derived

# Per contract
contract.functions_declared      # Functions defined in this contract (not inherited)
contract.functions               # All functions including inherited
contract.state_variables         # All state variables
contract.modifiers               # All modifiers

# Per function
function.nodes                   # CFG nodes
function.state_variables_read    # State vars read
function.state_variables_written # State vars written
function.external_calls_as_expressions
function.visibility              # "public", "external", "internal", "private"
function.view                    # True if view
function.pure                    # True if pure
function.is_constructor          # True if constructor

# Per node
node.irs                         # SlithIR instructions
node.type                        # NodeType enum (IF, EXPRESSION, RETURN, etc.)
```

Last verified: February 2026
