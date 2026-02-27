# Access Control Fuzzing with Echidna

Verify that privileged operations are restricted to authorized callers. Echidna calls functions from multiple sender addresses — if a non-authorized sender can trigger a state change, the property fails.

## Contract Under Test

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract ManagedToken {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;

    address public owner;
    address public pauser;
    bool public paused;

    mapping(address => uint256) public balanceOf;
    mapping(address => bool) public minters;

    error Unauthorized();
    error ContractPaused();
    error ZeroAddress();
    error InsufficientBalance();

    event Transfer(address indexed from, address indexed to, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PauserUpdated(address indexed previousPauser, address indexed newPauser);
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event Paused(address indexed account);
    event Unpaused(address indexed account);

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        owner = msg.sender;
        pauser = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setPauser(address newPauser) external onlyOwner {
        if (newPauser == address(0)) revert ZeroAddress();
        emit PauserUpdated(pauser, newPauser);
        pauser = newPauser;
    }

    function addMinter(address minter) external onlyOwner {
        minters[minter] = true;
        emit MinterAdded(minter);
    }

    function removeMinter(address minter) external onlyOwner {
        minters[minter] = false;
        emit MinterRemoved(minter);
    }

    function pause() external {
        if (msg.sender != pauser) revert Unauthorized();
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external {
        if (msg.sender != pauser) revert Unauthorized();
        paused = false;
        emit Unpaused(msg.sender);
    }

    function mint(address to, uint256 amount) external whenNotPaused {
        if (!minters[msg.sender]) revert Unauthorized();
        if (to == address(0)) revert ZeroAddress();
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external whenNotPaused returns (bool) {
        if (to == address(0)) revert ZeroAddress();
        if (balanceOf[msg.sender] < amount) revert InsufficientBalance();
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function burn(uint256 amount) external whenNotPaused {
        if (balanceOf[msg.sender] < amount) revert InsufficientBalance();
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        emit Transfer(msg.sender, address(0), amount);
    }
}
```

## Echidna Test Harness

The key insight: Echidna's `sender` addresses are NOT the deployer. By setting `deployer` to a different address than `sender`, every call Echidna makes comes from an unprivileged account. If a property asserts that only the owner can change owner-only state, and Echidna (calling as a non-owner) manages to change it, the property fails.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../src/ManagedToken.sol";

contract AccessControlTest is ManagedToken {
    // Deployer (owner) is 0x30000 — NOT in the sender list.
    // Senders 0x10000 and 0x20000 are unprivileged.
    address constant DEPLOYER = address(0x30000);

    // Snapshot owner-controlled state at deploy time
    address internal _initialOwner;
    address internal _initialPauser;
    uint256 internal _ownerMintedSupply;

    constructor() ManagedToken("Managed", "MGD") {
        _initialOwner = owner;
        _initialPauser = pauser;
        _ownerMintedSupply = 0;
    }

    // --- Access Control Properties ---

    // Property 1: Owner cannot change unless the current owner initiates it.
    // Since Echidna senders (0x10000, 0x20000) are not the owner (0x30000),
    // owner should never change.
    function echidna_owner_unchanged() public view returns (bool) {
        return owner == _initialOwner;
    }

    // Property 2: Pauser cannot change unless owner changes it.
    // Same reasoning — non-owner senders cannot call setPauser.
    function echidna_pauser_unchanged() public view returns (bool) {
        return pauser == _initialPauser;
    }

    // Property 3: No non-minter can mint tokens.
    // Since owner (deployer) never calls addMinter for the sender addresses,
    // supply should remain zero.
    function echidna_no_unauthorized_minting() public view returns (bool) {
        return totalSupply == 0;
    }

    // Property 4: Only pauser can pause.
    // Senders are not the pauser, so contract should stay unpaused.
    function echidna_not_paused_by_non_pauser() public view returns (bool) {
        return !paused;
    }

    // Property 5: Minter mapping cannot be modified by non-owner.
    // Neither sender is the owner, so no address should become a minter.
    function echidna_no_minters_added() public view returns (bool) {
        return !minters[address(0x10000)] && !minters[address(0x20000)];
    }
}
```

## Configuration

```yaml
# echidna-access-control.yaml
testLimit: 50000
seqLen: 50
shrinkLimit: 5000
testMode: "property"

# CRITICAL: deployer must differ from sender addresses.
# This ensures Echidna calls come from non-privileged accounts.
deployer: "0x30000"
sender: ["0x10000", "0x20000"]

corpusDir: "corpus-access-control"
workers: 4
```

## Running

```bash
echidna test/AccessControlTest.sol --contract AccessControlTest --config echidna-access-control.yaml
```

## Expected Output

```
echidna_owner_unchanged: passing
echidna_pauser_unchanged: passing
echidna_no_unauthorized_minting: passing
echidna_not_paused_by_non_pauser: passing
echidna_no_minters_added: passing

Unique instructions: 89
Corpus size: 7
```

## Planting a Bug: Missing Access Control

Remove the `onlyOwner` modifier from `addMinter`:

```solidity
// BUG: anyone can add minters
function addMinterBroken(address minter) external {
    minters[minter] = true;
    emit MinterAdded(minter);
}
```

Echidna finds the violation:

```
echidna_no_minters_added: failed!
  Call sequence:
    addMinterBroken(0x10000)

echidna_no_unauthorized_minting: failed!
  Call sequence:
    addMinterBroken(0x10000)
    mint(0x10000, 1)
```

The shrunk sequence shows exactly how a non-owner promotes themselves to minter and then mints tokens.

## Testing Multi-Role Systems

For protocols with more than two roles, create test harnesses per role combination:

```solidity
contract AdminOnlyTest is ManagedToken {
    // Test that admin-only functions revert for non-admins
    // deployer = admin, senders = regular users
    constructor() ManagedToken("Test", "TST") {}

    function echidna_owner_stable() public view returns (bool) {
        return owner == address(0x30000);
    }
}

contract MinterRoleTest is ManagedToken {
    // Test that minters can mint but not change roles
    // Deploy as owner, then grant minter to sender addresses
    constructor() ManagedToken("Test", "TST") {
        minters[address(0x10000)] = true;
    }

    // Minters can increase supply
    // But minters should not be able to change owner
    function echidna_minter_cannot_change_owner() public view returns (bool) {
        return owner == address(0x30000);
    }

    // Minters should not be able to add other minters
    function echidna_minter_cannot_add_minters() public view returns (bool) {
        return !minters[address(0x20000)];
    }
}
```

## Key Takeaways

1. **Separate deployer from sender** — this is the fundamental pattern for access control testing. The deployer is privileged; senders are attackers.
2. **Snapshot state at construction** — capture initial values of owner, pauser, and other privileged state. Properties compare current state against the snapshot.
3. **Test what should NOT happen** — access control properties are negative: "this state MUST NOT change when called by unprivileged users."
4. **One property per role boundary** — do not combine "owner cannot change" and "pauser cannot change" into one property. Separate properties give clearer failure diagnostics.
5. **Echidna's multi-sender model is the feature** — unlike unit tests where you manually impersonate users, Echidna naturally exercises multi-user interactions.

Last verified: February 2026
