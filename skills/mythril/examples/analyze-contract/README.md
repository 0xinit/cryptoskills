# Analyze a Vulnerable Contract

Analyze a Solidity contract with known vulnerabilities using Mythril, interpret the output, and understand the exploit path.

## Vulnerable Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VulnerableVault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    // SWC-107: state update after external call
    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance");

        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");

        balances[msg.sender] = 0;
    }

    // SWC-105: anyone can withdraw all funds
    function emergencyWithdraw(address to) external {
        uint256 bal = address(this).balance;
        (bool ok, ) = to.call{value: bal}("");
        require(ok, "Transfer failed");
    }
}
```

Save this as `VulnerableVault.sol`.

## Run Mythril

```bash
myth analyze VulnerableVault.sol --solv 0.8.20 -t 2 --execution-timeout 300
```

With Docker:

```bash
docker run -v $(pwd):/src mythril/myth analyze \
  /src/VulnerableVault.sol \
  --solv 0.8.20 \
  -t 2 \
  --execution-timeout 300
```

## Expected Output

Mythril will report at least two findings:

### Finding 1: Reentrancy (SWC-107)

```
==== State access after external call ====
SWC ID: 107
Severity: Medium
Contract: VulnerableVault
Function name: withdraw()
PC address: 482

A call to a user-supplied address is executed. After the external call,
a state variable is written. This allows an attacker to re-enter the
function and drain funds before the balance is set to zero.

----
Transaction Sequence:
  Caller: 0xaaaa...
  Function: deposit()
  calldata: 0xd0e30db0
  value: 1000000000000000000

  Caller: 0xaaaa...
  Function: withdraw()
  calldata: 0x3ccfd60b
  value: 0
```

The transaction sequence shows Mythril proved the exploit: deposit first, then withdraw triggers the reentrancy window.

### Finding 2: Unprotected Ether Withdrawal (SWC-105)

```
==== Unprotected Ether Withdrawal ====
SWC ID: 105
Severity: High
Contract: VulnerableVault
Function name: emergencyWithdraw(address)

Any sender can withdraw Ether from the contract account.

----
Transaction Sequence:
  Caller: 0xbbbb...
  Function: emergencyWithdraw(address)
  calldata: 0x...
  value: 0
```

Mythril proves that any address can call `emergencyWithdraw` and drain the contract.

## Understanding the Output

Each Mythril finding contains:

| Field | Meaning |
|-------|---------|
| **SWC ID** | Vulnerability classification from the SWC Registry |
| **Severity** | High, Medium, or Low |
| **Contract** | Which contract contains the issue |
| **Function name** | The vulnerable function |
| **PC address** | Program counter offset in bytecode (for debugging) |
| **Description** | What Mythril found and why it is dangerous |
| **Transaction Sequence** | Concrete steps to trigger the vulnerability |

The transaction sequence is the most valuable part. It is a proof — Mythril constructed actual calldata that triggers the bug. This is what separates symbolic execution from pattern matching.

## JSON Output for Programmatic Processing

```bash
myth analyze VulnerableVault.sol --solv 0.8.20 -t 2 --execution-timeout 300 -o json
```

```json
{
  "success": true,
  "error": null,
  "issues": [
    {
      "title": "State access after external call",
      "swc-id": "107",
      "contract": "VulnerableVault",
      "function_name": "withdraw()",
      "severity": "Medium",
      "address": 482,
      "description": "A call to a user-supplied address is executed...",
      "min_gas_used": 3456,
      "max_gas_used": 7890,
      "tx_sequence": {
        "initialState": { "accounts": {} },
        "steps": [
          {
            "input": "0xd0e30db0",
            "name": "deposit()",
            "origin": "0xaaaa...",
            "value": "0xde0b6b3a7640000"
          },
          {
            "input": "0x3ccfd60b",
            "name": "withdraw()",
            "origin": "0xaaaa...",
            "value": "0x0"
          }
        ]
      }
    }
  ]
}
```

## Fixing the Vulnerabilities

### Fix Reentrancy: Apply CEI Pattern

```solidity
function withdraw() external {
    uint256 amount = balances[msg.sender];
    require(amount > 0, "No balance");

    balances[msg.sender] = 0; // Effects BEFORE interactions

    (bool ok, ) = msg.sender.call{value: amount}("");
    require(ok, "Transfer failed");
}
```

### Fix Unprotected Withdrawal: Add Access Control

```solidity
address public owner;

constructor() {
    owner = msg.sender;
}

function emergencyWithdraw(address to) external {
    require(msg.sender == owner, "Not owner");
    uint256 bal = address(this).balance;
    (bool ok, ) = to.call{value: bal}("");
    require(ok, "Transfer failed");
}
```

## Re-run Mythril After Fixes

```bash
myth analyze VulnerableVaultFixed.sol --solv 0.8.20 -t 2 --execution-timeout 300
```

Expected output:

```
The analysis was completed successfully. No issues were detected.
```

Last verified: February 2026
