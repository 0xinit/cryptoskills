# Access Control Vulnerability Testing

Foundry tests for common access control vulnerabilities: unprotected initializers, privilege escalation, missing modifiers, tx.origin misuse, and selfdestruct relay attacks.

## Unprotected Initializer

Upgradeable contracts use `initialize()` instead of constructors. If not protected, anyone can call it and become admin.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VulnerableInitializer {
    address public owner;
    bool public initialized;

    // VULNERABLE: no protection against re-initialization
    function initialize(address _owner) external {
        owner = _owner;
        initialized = true;
    }

    function withdraw(address to) external {
        require(msg.sender == owner, "Not owner");
        (bool ok, ) = to.call{value: address(this).balance}("");
        require(ok);
    }

    receive() external payable {}
}
```

```solidity
function test_anyoneCanReinitialize() public {
    VulnerableInitializer vuln = new VulnerableInitializer();
    vuln.initialize(makeAddr("legitimateOwner"));

    // Attacker re-calls initialize and takes over
    address attacker = makeAddr("attacker");
    vm.prank(attacker);
    vuln.initialize(attacker);

    assertEq(vuln.owner(), attacker);
}
```

Fix: use OpenZeppelin's `Initializable` and the `initializer` modifier.

```solidity
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract SafeInitializer is Initializable {
    address public owner;

    function initialize(address _owner) external initializer {
        owner = _owner;
    }
}
```

## Privilege Escalation via Missing Check

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VulnerableRoles {
    mapping(address => bool) public admins;
    mapping(address => bool) public operators;

    constructor() {
        admins[msg.sender] = true;
    }

    modifier onlyAdmin() {
        require(admins[msg.sender], "Not admin");
        _;
    }

    function addAdmin(address account) external onlyAdmin {
        admins[account] = true;
    }

    // VULNERABLE: operators can add themselves as admin
    function addOperator(address account) external {
        operators[account] = true;
    }

    function emergencyWithdraw(address to) external onlyAdmin {
        (bool ok, ) = to.call{value: address(this).balance}("");
        require(ok);
    }

    receive() external payable {}
}
```

```solidity
function test_privilegeEscalation() public {
    VulnerableRoles vuln = new VulnerableRoles();
    deal(address(vuln), 10 ether);

    // Anyone can become operator (missing access control)
    address attacker = makeAddr("attacker");
    vm.prank(attacker);
    vuln.addOperator(attacker);

    assertTrue(vuln.operators(attacker));
    // In a real contract, operator might have a path to admin
}
```

## Missing Access Modifier on State-Changing Function

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VulnerableFeeManager {
    address public owner;
    uint256 public feeBps;

    constructor(uint256 _feeBps) {
        owner = msg.sender;
        feeBps = _feeBps;
    }

    // VULNERABLE: forgot onlyOwner modifier
    function setFee(uint256 _feeBps) external {
        feeBps = _feeBps;
    }
}
```

```solidity
function test_anyoneCanSetFee() public {
    VulnerableFeeManager mgr = new VulnerableFeeManager(100);

    address attacker = makeAddr("attacker");
    vm.prank(attacker);
    mgr.setFee(10_000); // Attacker sets fee to 100%

    assertEq(mgr.feeBps(), 10_000);
}
```

## tx.origin vs msg.sender

`tx.origin` returns the EOA that initiated the transaction chain. If a victim calls a malicious contract, that contract can call the vulnerable contract, and `tx.origin` is still the victim.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TxOriginVault {
    address public owner;
    mapping(address => uint256) public balances;

    constructor() {
        owner = msg.sender;
    }

    // VULNERABLE: tx.origin is the signing EOA, not the immediate caller
    function withdraw(address to, uint256 amount) external {
        require(tx.origin == owner, "Not owner");
        (bool ok, ) = to.call{value: amount}("");
        require(ok);
    }

    receive() external payable {}
}
```

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TxOriginAttacker {
    TxOriginVault public vault;
    address public attacker;

    constructor(address _vault) {
        vault = TxOriginVault(payable(_vault));
        attacker = msg.sender;
    }

    // If the vault owner calls this contract (phishing), tx.origin == owner
    fallback() external payable {
        vault.withdraw(attacker, address(vault).balance);
    }
}
```

```solidity
function test_txOriginPhishing() public {
    address owner = makeAddr("owner");
    vm.prank(owner);
    TxOriginVault vault = new TxOriginVault();
    deal(address(vault), 10 ether);

    address attacker = makeAddr("attacker");
    vm.prank(attacker);
    TxOriginAttacker attackContract = new TxOriginAttacker(address(vault));

    // Owner interacts with the malicious contract (phishing)
    vm.prank(owner, owner); // sets both msg.sender and tx.origin
    (bool ok, ) = address(attackContract).call("");
    require(ok);

    // Attacker drained the vault
    assertEq(address(vault).balance, 0);
    assertEq(attacker.balance, 10 ether);
}
```

## Selfdestruct Relay Attack

Pre-EIP-6780 (Dencun), `selfdestruct` force-sends ETH to a target without triggering its `receive()` or `fallback()`. Contracts that rely on `address(this).balance` for accounting are vulnerable.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BalanceDependentGame {
    uint256 public targetAmount;

    constructor() payable {
        targetAmount = 10 ether;
    }

    function deposit() external payable {
        require(msg.value == 1 ether, "Must send 1 ETH");
    }

    // VULNERABLE: relies on address balance for game logic
    function isComplete() public view returns (bool) {
        return address(this).balance >= targetAmount;
    }

    function claimPrize() external {
        require(isComplete(), "Game not complete");
        (bool ok, ) = msg.sender.call{value: address(this).balance}("");
        require(ok);
    }

    receive() external payable {
        revert("Use deposit()");
    }
}
```

```solidity
contract SelfdestructRelay {
    // Force-send ETH bypassing receive/fallback
    constructor(address target) payable {
        selfdestruct(payable(target));
    }
}
```

```solidity
function test_selfdestructForceSend() public {
    BalanceDependentGame game = new BalanceDependentGame();

    // Force-send 10 ETH to break game logic
    new SelfdestructRelay{value: 10 ether}(address(game));

    // Game thinks it is complete even though nobody deposited properly
    assertTrue(game.isComplete());
}
```

**Note:** Post-Dencun (EIP-6780), `selfdestruct` only force-sends ETH if called in the same transaction as contract creation. The test above still works because the relay is created and self-destructs in the same transaction. However, `selfdestruct` from an already-deployed contract no longer destroys storage.

## Proper Role-Based Access Pattern

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract SecureProtocol is AccessControl {
    bytes32 public constant OPERATOR = keccak256("OPERATOR");
    bytes32 public constant GUARDIAN = keccak256("GUARDIAN");

    uint256 public feeBps;

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setFee(uint256 _feeBps) external onlyRole(OPERATOR) {
        require(_feeBps <= 1000, "Fee exceeds 10%");
        feeBps = _feeBps;
    }

    function pause() external onlyRole(GUARDIAN) {
        // ... pause logic
    }

    function emergencyWithdraw(address to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        (bool ok, ) = to.call{value: address(this).balance}("");
        require(ok);
    }

    receive() external payable {}
}
```

## Key Takeaways

- Use OpenZeppelin `Initializable` for upgradeable contracts -- never roll your own init guard
- Every state-changing function needs an explicit access modifier
- Never use `tx.origin` for authorization -- always `msg.sender`
- Do not rely on `address(this).balance` for critical logic -- ETH can be force-sent
- Use role-based access (`AccessControl`) instead of single-owner patterns
- Test every privileged function from an unauthorized address to verify it reverts
