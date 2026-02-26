# OpenZeppelin Troubleshooting Guide

Common errors and their fixes when working with OpenZeppelin Contracts v5.

## "Initializable: contract is already initialized" / InvalidInitialization()

**Symptom:** Calling `initialize()` on a proxy reverts.

**Causes and fixes:**

1. **Implementation was initialized directly.** The implementation constructor must call `_disableInitializers()` to prevent anyone from initializing it. The proxy is the one that should call `initialize()`.

```solidity
/// @custom:oz-upgrades-unsafe-allow constructor
constructor() {
    _disableInitializers();
}
```

2. **Proxy already initialized.** `initializer` can only run once. If upgrading, use `reinitializer(n)` for version-specific init:

```solidity
function initializeV2(uint256 newParam) public reinitializer(2) {
    newParam_ = newParam;
}
```

3. **Calling `initializer` on V2 after upgrade.** The `initializer` modifier was already consumed by V1. Use `reinitializer(2)`, `reinitializer(3)`, etc. for each subsequent version.

## Storage Collision in Upgradeable Contracts

**Symptom:** State variables return garbage or unexpected values after upgrading to a new implementation.

**Cause:** State variables were reordered, removed, or inserted in the middle of the storage layout.

**Fix:** Only append new state variables at the end. Never reorder or delete existing ones.

```solidity
// V1
contract VaultV1 {
    uint256 public totalDeposits;  // slot 0
    address public admin;          // slot 1
}

// V2 WRONG: inserting a variable before admin
contract VaultV2 {
    uint256 public totalDeposits;  // slot 0
    uint256 public fee;            // slot 1 -- OVERWRITES admin
    address public admin;          // slot 2 -- reads garbage
}

// V2 CORRECT: append only
contract VaultV2 {
    uint256 public totalDeposits;  // slot 0
    address public admin;          // slot 1
    uint256 public fee;            // slot 2 -- new, safe
}
```

Verify layouts before deploying upgrades:

```bash
forge inspect VaultV1 storage-layout > v1_layout.txt
forge inspect VaultV2 storage-layout > v2_layout.txt
diff v1_layout.txt v2_layout.txt
```

## "AccessControl: account is missing role" / AccessControlUnauthorizedAccount

**Symptom:** `onlyRole(SOME_ROLE)` function reverts with `AccessControlUnauthorizedAccount(account, role)`.

**Fixes:**

1. **Grant the role first:**

```solidity
treasury.grantRole(TREASURER_ROLE, accountAddress);
```

2. **Check who the admin is.** Only the role's admin can call `grantRole`. By default, `DEFAULT_ADMIN_ROLE` is the admin for all roles.

```solidity
bytes32 adminRole = treasury.getRoleAdmin(TREASURER_ROLE);
bool callerIsAdmin = treasury.hasRole(adminRole, msg.sender);
```

3. **Constructor used `_setupRole` (v4).** In v5, `_setupRole` is removed. Use `_grantRole` instead.

## "Ownable: caller is not the owner" / OwnableUnauthorizedAccount

**Symptom:** `onlyOwner` function reverts.

**Fixes:**

1. **Verify the current owner:**

```bash
cast call <CONTRACT> "owner()(address)" --rpc-url $RPC_URL
```

2. **V5: Forgot to pass initial owner to constructor.** `Ownable` no longer defaults to `msg.sender`:

```solidity
// This won't compile in v5
contract Bad is Ownable { }

// Must pass owner
contract Good is Ownable {
    constructor(address initialOwner) Ownable(initialOwner) {}
}
```

3. **Ownership was transferred or renounced.** Check transaction history for `OwnershipTransferred` events.

## Token Transfer Fails (Missing Approval)

**Symptom:** `safeTransferFrom` or `transferFrom` reverts with insufficient allowance error.

**For ERC20:**

```solidity
// Caller must approve the spender first
token.approve(spenderAddress, amount);
// Then the spender can call:
token.transferFrom(owner, recipient, amount);
```

**For ERC721:**

```solidity
// Approve a specific token
nft.approve(spenderAddress, tokenId);
// Or approve all tokens
nft.setApprovalForAll(spenderAddress, true);
```

**For non-standard tokens (USDT):** Use `SafeERC20.forceApprove` because USDT requires setting allowance to 0 before setting a new value:

```solidity
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
using SafeERC20 for IERC20;

token.forceApprove(spender, amount);
```

## Constructor vs Initializer Confusion

**Symptom:** Upgradeable contract state is empty despite setting values in the constructor.

**Cause:** Proxy contracts don't execute the implementation's constructor. Constructor logic only runs on the implementation itself (which is a different storage context).

**Fix:** Move all setup logic from constructor to an `initializer` function:

```solidity
// WRONG: constructor runs on implementation, not proxy
constructor(address admin) {
    _admin = admin; // This state lives on the implementation, not the proxy
}

// CORRECT: initializer runs on proxy context
function initialize(address admin) public initializer {
    _admin = admin;
}
```

The only thing that should remain in the constructor is `_disableInitializers()`.

## "ERC721: invalid token ID" / ERC721NonexistentToken

**Symptom:** `ownerOf`, `tokenURI`, or `transferFrom` reverts for a token ID.

**Fixes:**

1. **Token hasn't been minted yet.** Verify the token exists:

```bash
cast call <NFT> "ownerOf(uint256)(address)" <TOKEN_ID> --rpc-url $RPC_URL
```

2. **Token was burned.** Burned tokens no longer exist. Check `Transfer` events to `address(0)`.

3. **Off-by-one in token IDs.** If using auto-increment IDs starting at 0, the last valid ID is `totalMinted - 1`.

## Multiple Inheritance "Identifier Already Declared"

**Symptom:** Compiler error when two parent contracts define the same function.

**Fix:** Override the conflicting function and list all parents that define it:

```solidity
function _update(address from, address to, uint256 value)
    internal
    override(ERC20, ERC20Votes, ERC20Pausable) // list ALL parents
{
    super._update(from, to, value);
}
```

The `super` call invokes parents in C3 linearization order (rightmost first). Order your inheritance list from most base to most derived:

```solidity
// Correct ordering
contract Token is ERC20, ERC20Burnable, ERC20Pausable, ERC20Votes { }
```

## ERC721Enumerable Missing _increaseBalance Override

**Symptom:** Compilation error when using ERC721Enumerable in v5.

**Fix:** V5 requires overriding both `_update` and `_increaseBalance`:

```solidity
function _update(address to, uint256 tokenId, address auth)
    internal
    override(ERC721, ERC721Enumerable)
    returns (address)
{
    return super._update(to, tokenId, auth);
}

function _increaseBalance(address account, uint128 value)
    internal
    override(ERC721, ERC721Enumerable)
{
    super._increaseBalance(account, value);
}
```

## Nonces Conflict (ERC20Permit + ERC20Votes)

**Symptom:** Compiler error about ambiguous `nonces` function when combining Permit and Votes.

**Fix:** Both inherit from `Nonces`. Add an explicit override:

```solidity
function nonces(address owner)
    public
    view
    override(ERC20Permit, Nonces)
    returns (uint256)
{
    return super.nonces(owner);
}
```

## EnforcedPause / ExpectedPause

**Symptom:** `whenNotPaused` function reverts with `EnforcedPause()`.

**Fix:** The contract is paused. Call `unpause()` from the authorized account:

```bash
# Check pause state
cast call <CONTRACT> "paused()(bool)" --rpc-url $RPC_URL

# Unpause (from owner/admin)
cast send <CONTRACT> "unpause()" --rpc-url $RPC_URL --private-key $PK
```

## Debug Checklist

- [ ] Solidity pragma is `^0.8.20` (minimum for v5)
- [ ] Using `@openzeppelin/contracts@^5.0.0` (not v4)
- [ ] `Ownable` constructor receives an address argument
- [ ] Using `_grantRole` instead of `_setupRole`
- [ ] `_update` override instead of `_beforeTokenTransfer`
- [ ] `_increaseBalance` override present when using ERC721Enumerable
- [ ] `nonces` override present when combining ERC20Permit + ERC20Votes
- [ ] Implementation constructor calls `_disableInitializers()`
- [ ] Upgrade adds state variables at the end only
- [ ] `Pausable` and `ReentrancyGuard` imported from `utils/`, not `security/`
