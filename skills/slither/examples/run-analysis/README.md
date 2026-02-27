# Run Slither Analysis on a Foundry Project

End-to-end example: run Slither against a Foundry project, interpret the output, and export a JSON report.

## Sample Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Vault {
    address public owner;
    mapping(address => uint256) public balances;
    IERC20 public token;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);

    constructor(address _token) {
        owner = msg.sender;
        token = IERC20(_token);
    }

    function deposit(uint256 amount) external {
        token.transferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;
        emit Deposit(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        // BUG: unchecked transfer return value
        token.transfer(msg.sender, amount);
        emit Withdraw(msg.sender, amount);
    }

    function emergencyWithdraw() external {
        require(msg.sender == owner, "Not owner");
        uint256 bal = address(this).balance;
        // BUG: using low-level call without checking return
        (bool success, ) = owner.call{value: bal}("");
    }

    // BUG: no access control on fee setter, no event
    function setOwner(address _newOwner) external {
        owner = _newOwner;
    }
}
```

## Step 1: Compile

```bash
forge build
```

## Step 2: Run Slither (default)

```bash
slither .
```

### Sample Output

```
Vault.withdraw(uint256) (src/Vault.sol#27-32) ignores return value by token.transfer(msg.sender,amount) (src/Vault.sol#30)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#unchecked-transfer

Vault.emergencyWithdraw() (src/Vault.sol#35-38) sends eth to arbitrary user
  Dangerous calls:
  - (success) = owner.call{value: bal}("") (src/Vault.sol#37)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#functions-that-send-ether-to-arbitrary-destinations

Vault.setOwner(address) (src/Vault.sol#41-43) should emit an event for:
  - owner = _newOwner (src/Vault.sol#42)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#missing-events-access-control

Vault.emergencyWithdraw() (src/Vault.sol#35-38) ignores return value by (success) = owner.call{value: bal}("") (src/Vault.sol#37)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#unchecked-low-level-calls
```

## Step 3: Read the Output

Each finding follows this format:

```
<Contract.function()> (<file>:<lines>) <description>
  <details>
Reference: <wiki link explaining the detector>
```

### Interpreting Severity

Slither prints findings in severity order (high first). Map each finding to action:

| Finding | Detector | Severity | Action |
|---------|----------|----------|--------|
| Unchecked `transfer` return | `unchecked-transfer` | High | Fix: use SafeERC20 or check return |
| ETH sent to arbitrary user | `arbitrary-send-eth` | High | Review: is `owner` trusted? Add access control |
| Missing event on access control | `events-access` | Low | Fix: emit event on `setOwner` |
| Unchecked low-level call | `unchecked-lowlevel` | Medium | Fix: require `success` |

## Step 4: Run with Filters

Skip dependency noise and informational findings:

```bash
slither . \
  --filter-paths "lib/|node_modules/" \
  --exclude-informational \
  --exclude-optimization
```

## Step 5: Export JSON Report

```bash
slither . \
  --filter-paths "lib/|node_modules/" \
  --json slither-report.json
```

The JSON file contains structured data for each finding:

```json
{
  "results": {
    "detectors": [
      {
        "check": "unchecked-transfer",
        "impact": "High",
        "confidence": "Medium",
        "description": "Vault.withdraw(uint256)...",
        "elements": [
          {
            "type": "function",
            "name": "withdraw",
            "source_mapping": {
              "filename_relative": "src/Vault.sol",
              "lines": [27, 28, 29, 30, 31, 32]
            }
          }
        ]
      }
    ]
  }
}
```

## Step 6: Print Contract Summary

```bash
slither . --print contract-summary
```

Output shows all functions, their visibility, and modifiers — useful for understanding attack surface before diving into findings.

## Step 7: Print Storage Layout

```bash
slither . --print variable-order
```

Shows storage slot assignments. Critical for upgradeable contracts where slot ordering must be preserved.

## Fixed Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Vault {
    using SafeERC20 for IERC20;

    address public owner;
    mapping(address => uint256) public balances;
    IERC20 public token;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);

    constructor(address _token) {
        owner = msg.sender;
        token = IERC20(_token);
    }

    function deposit(uint256 amount) external {
        token.safeTransferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;
        emit Deposit(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        token.safeTransfer(msg.sender, amount);
        emit Withdraw(msg.sender, amount);
    }

    function emergencyWithdraw() external {
        require(msg.sender == owner, "Not owner");
        uint256 bal = address(this).balance;
        (bool success, ) = owner.call{value: bal}("");
        require(success, "ETH transfer failed");
    }

    function setOwner(address _newOwner) external {
        require(msg.sender == owner, "Not owner");
        require(_newOwner != address(0), "Zero address");
        emit OwnerChanged(owner, _newOwner);
        owner = _newOwner;
    }
}
```

Re-run Slither on the fixed contract to verify all high/medium findings are resolved.

Last verified: February 2026
