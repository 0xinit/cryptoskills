---
name: eip-reference
description: Quick reference for essential EIPs and ERCs. Covers token standards, signature schemes, account abstraction, and chain-level EIPs with implementation patterns. Use when you need the correct interface, gotcha, or specification detail for any major Ethereum standard.
license: Apache-2.0
metadata:
  author: cryptoskills
  version: "1.0"
  chain: multichain
  category: Infrastructure
tags:
  - eip
  - erc
  - standards
  - tokens
  - signatures
---

# EIP / ERC Reference

Canonical reference for the Ethereum standards that matter most to smart contract and dApp developers. Provides correct interfaces, key behavioral rules, and the gotchas that trip up both humans and LLMs.

## What You Probably Got Wrong

> These misconceptions appear in LLM-generated code constantly. Fix your mental model before writing code.

- **EIP != ERC** — An EIP (Ethereum Improvement Proposal) is the proposal process. An ERC (Ethereum Request for Comments) is the subset of EIPs that define application-layer standards (tokens, signatures, wallets). ERC-20 started as EIP-20 and became ERC-20 upon acceptance. Chain-level changes like EIP-1559 stay as EIPs — they are never ERCs.
- **ERC-20 `approve` has a race condition** — If Alice approves Bob for 100, then changes to 50, Bob can front-run: spend the 100, then spend the new 50, totaling 150. Mitigation: approve to 0 first, or use `increaseAllowance`/`decreaseAllowance` (OpenZeppelin), or use ERC-2612 `permit`. USDT requires resetting to 0 before setting a new nonzero allowance — it will revert otherwise.
- **ERC-721 `transferFrom` skips receiver checks** — `transferFrom` does NOT call `onERC721Received` on the recipient. Tokens sent to contracts that cannot handle them are permanently locked. Use `safeTransferFrom` unless you have a specific reason not to (gas optimization in trusted contexts).
- **EIP-712 domain separator MUST include `chainId`** — Omitting `chainId` from the `EIP712Domain` allows signature replay across chains. A signature valid on mainnet becomes valid on every fork and L2 that shares the contract address. Always include `chainId` and `verifyingContract`.
- **ERC-4337 bundler != relayer** — A bundler packages `UserOperation` objects into a transaction and submits to the `EntryPoint`. A relayer (meta-transaction pattern) wraps a signed message into `msg.data` and calls a trusted forwarder. Different trust models, different gas accounting, different entry points. Do not conflate them.
- **EIP-1559 `baseFee` is protocol-controlled, not user-set** — Users set `maxFeePerGas` and `maxPriorityFeePerGas`. The protocol sets `baseFee` per block based on gas utilization of the previous block. The base fee is burned, not paid to validators. The priority fee goes to the validator. Effective gas price = `min(baseFee + maxPriorityFeePerGas, maxFeePerGas)`.
- **ERC-4626 share/asset math is rounding-sensitive** — `convertToShares` and `convertToAssets` must round in favor of the vault (down on deposit/mint, up on withdraw/redeem) to prevent share inflation attacks. First-depositor attacks exploit vaults that skip this.

## Token Standards

### ERC-20 — Fungible Token

The base token standard. Every DeFi protocol depends on this interface.

```solidity
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}
```

**Key rules:**
- `transfer` and `transferFrom` MUST return `true` on success. Some tokens (USDT) do not return a value — use OpenZeppelin `SafeERC20` to handle both.
- `decimals()` is OPTIONAL per the spec (part of `IERC20Metadata`). Never assume 18 — USDC and USDT use 6, WBTC uses 8.
- Zero-address transfers SHOULD emit `Transfer` events. Minting is `Transfer(address(0), to, amount)`. Burning is `Transfer(from, address(0), amount)`.

### ERC-721 — Non-Fungible Token

Each token has a unique `tokenId`. Ownership is 1:1.

```solidity
interface IERC721 {
    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function approve(address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool approved) external;
    function getApproved(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
}
```

**Key rules:**
- `safeTransferFrom` calls `IERC721Receiver.onERC721Received` on the recipient if it is a contract. Reverts if the receiver does not implement it or returns the wrong selector.
- `transferFrom` does NOT perform receiver checks. Tokens can be permanently lost if sent to a contract that cannot handle them.
- `approve` clears on transfer — approved address is reset when the token moves.

### ERC-1155 — Multi-Token

Single contract managing multiple token types (fungible and non-fungible) identified by `id`.

```solidity
interface IERC1155 {
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids)
        external view returns (uint256[] memory);
    function setApprovalForAll(address operator, bool approved) external;
    function isApprovedForAll(address account, address operator) external view returns (bool);
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external;
    function safeBatchTransferFrom(
        address from, address to, uint256[] calldata ids, uint256[] calldata amounts, bytes calldata data
    ) external;

    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event TransferBatch(
        address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values
    );
}
```

**Key rules:**
- No `transferFrom` — ALL transfers are safe transfers that call `onERC1155Received` or `onERC1155BatchReceived`.
- No per-token approval — only `setApprovalForAll` (operator model).
- Batch operations reduce gas for multi-token transfers.

### ERC-4626 — Tokenized Vault

Standard interface for yield-bearing vaults. The vault is itself an ERC-20 representing shares.

```solidity
interface IERC4626 is IERC20 {
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);
    function convertToShares(uint256 assets) external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);
    function maxDeposit(address receiver) external view returns (uint256);
    function previewDeposit(uint256 assets) external view returns (uint256);
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function maxMint(address receiver) external view returns (uint256);
    function previewMint(uint256 shares) external view returns (uint256);
    function mint(uint256 shares, address receiver) external returns (uint256 assets);
    function maxWithdraw(address owner) external view returns (uint256);
    function previewWithdraw(uint256 assets) external view returns (uint256);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function maxRedeem(address owner) external view returns (uint256);
    function previewRedeem(uint256 shares) external view returns (uint256);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);

    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);
}
```

**Key rules:**
- `deposit`/`mint` are asset-denominated vs share-denominated entry. `withdraw`/`redeem` are asset-denominated vs share-denominated exit.
- `preview*` functions MUST return the exact value that would be used in the corresponding action (not an estimate).
- Rounding: `convertToShares` rounds DOWN, `convertToAssets` rounds DOWN. This protects the vault from share manipulation. `previewMint` and `previewWithdraw` round UP (caller pays more).
- First-depositor attack: attacker deposits 1 wei, donates tokens to inflate share price, subsequent depositors get 0 shares. Mitigate with virtual shares/assets offset or minimum initial deposit.

## Signature Standards

### EIP-191 — Personal Sign

Prefixed message signing to prevent raw transaction signing. The `personal_sign` RPC method.

```
0x19 <1 byte version> <version specific data> <data to sign>
```

**Version `0x45` (E)** — `personal_sign`:
```
"\x19Ethereum Signed Message:\n" + len(message) + message
```

```solidity
// Recovering a personal_sign signature
bytes32 messageHash = keccak256(abi.encodePacked(
    "\x19Ethereum Signed Message:\n32",
    dataHash
));
address signer = ECDSA.recover(messageHash, signature);
```

**Key rules:**
- The prefix prevents users from being tricked into signing valid Ethereum transactions.
- `len(message)` is the decimal string length of the message in bytes, NOT the hex length.
- For fixed-length data (bytes32), the length is always "32".

### EIP-712 — Typed Structured Data

Structured, human-readable signing. Users see what they sign in their wallet.

```solidity
// Domain separator — MUST include chainId and verifyingContract
bytes32 DOMAIN_SEPARATOR = keccak256(abi.encode(
    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
    keccak256(bytes("MyProtocol")),
    keccak256(bytes("1")),
    block.chainid,
    address(this)
));

// Type hash for the struct being signed
bytes32 constant PERMIT_TYPEHASH = keccak256(
    "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
);

// Final hash to sign
bytes32 digest = keccak256(abi.encodePacked(
    "\x19\x01",
    DOMAIN_SEPARATOR,
    keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, nonce, deadline))
));
```

**Key rules:**
- Domain separator MUST be recomputed if `block.chainid` changes (fork protection). Cache it but verify against current chain ID.
- Nested structs: type string must include referenced types in alphabetical order after the primary type.
- Arrays in typed data: `keccak256(abi.encodePacked(array))` for fixed-size element arrays, element-wise encoding for struct arrays.
- `bytes` and `string` fields are hashed with `keccak256` before encoding.

### ERC-1271 — Contract Signature Verification

Allows smart contracts (multisigs, smart accounts) to validate signatures.

```solidity
interface IERC1271 {
    // MUST return 0x1626ba7e if signature is valid
    function isValidSignature(bytes32 hash, bytes memory signature)
        external view returns (bytes4 magicValue);
}

bytes4 constant ERC1271_MAGIC_VALUE = 0x1626ba7e;
```

**Verification pattern (supporting both EOA and contract signers):**

```solidity
function _isValidSignature(address signer, bytes32 hash, bytes memory signature) internal view returns (bool) {
    if (signer.code.length > 0) {
        // Contract signer — delegate to ERC-1271
        try IERC1271(signer).isValidSignature(hash, signature) returns (bytes4 magicValue) {
            return magicValue == 0x1626ba7e;
        } catch {
            return false;
        }
    } else {
        // EOA signer — ecrecover
        return ECDSA.recover(hash, signature) == signer;
    }
}
```

**Key rules:**
- Always check `signer.code.length` to determine EOA vs contract before choosing verification path.
- The `hash` parameter is the EIP-712 digest, NOT the raw message.
- Wrap in try/catch — malicious contracts can revert, consume gas, or return unexpected values.

### ERC-2612 — Permit (Gasless Approval)

EIP-712 signed approvals for ERC-20 tokens. Users approve via signature instead of an on-chain transaction.

```solidity
interface IERC20Permit {
    function permit(
        address owner, address spender, uint256 value,
        uint256 deadline, uint8 v, bytes32 r, bytes32 s
    ) external;
    function nonces(address owner) external view returns (uint256);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}
```

**Key rules:**
- `deadline` is a Unix timestamp. Always check `block.timestamp <= deadline`.
- Nonces are sequential per-owner. Cannot skip or reorder.
- Not all ERC-20 tokens support permit. DAI uses a non-standard permit with `allowed` (bool) instead of `value` (uint256).
- Permit signatures can be front-run — the approval still takes effect, but the `permit` call reverts if already used. Handle this gracefully (check allowance before calling permit).

## Account Abstraction

### ERC-4337 — Account Abstraction via Entry Point

Decouples transaction validation from EOAs. Smart contract wallets validate their own transactions.

**Core flow:**
```
User creates UserOperation
  → Bundler collects UserOperations into a bundle
    → Bundler calls EntryPoint.handleOps(userOps, beneficiary)
      → EntryPoint calls account.validateUserOp(userOp, userOpHash, missingAccountFunds)
        → If paymaster: EntryPoint calls paymaster.validatePaymasterUserOp(...)
          → EntryPoint executes the operation via account
```

**UserOperation struct (v0.7):**

```solidity
struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;           // factory address + calldata (for first-time account deployment)
    bytes callData;           // the actual operation to execute
    bytes32 accountGasLimits; // packed: verificationGasLimit (16 bytes) + callGasLimit (16 bytes)
    uint256 preVerificationGas;
    bytes32 gasFees;          // packed: maxPriorityFeePerGas (16 bytes) + maxFeePerGas (16 bytes)
    bytes paymasterAndData;   // paymaster address + verification gas + postOp gas + custom data
    bytes signature;
}
```

**EntryPoint address (v0.7):** `0x0000000071727De22E5E9d8BAf0edAc6f37da032`

**Key rules:**
- `validateUserOp` MUST return `SIG_VALIDATION_FAILED` (1) on invalid signature, NOT revert. Reverting wastes bundler gas.
- `nonce` uses a key-space scheme: upper 192 bits = key, lower 64 bits = sequence. Allows parallel nonce channels.
- `initCode` is only used for first UserOp (account deployment). Empty on subsequent operations.
- Bundlers simulate `validateUserOp` off-chain before inclusion. Banned opcodes during validation: `BALANCE`, `GASPRICE`, `TIMESTAMP`, `BLOCKHASH`, `CREATE`, etc.
- Paymasters can sponsor gas (gasless UX) or accept ERC-20 payment.

### ERC-7579 — Modular Smart Accounts

Standard interface for modular account components. Accounts install/uninstall modules for validators, executors, hooks, and fallback handlers.

**Module types:**
| Type ID | Role | Called by |
|---------|------|-----------|
| 1 | Validator | Account (during validateUserOp) |
| 2 | Executor | External trigger (automation) |
| 3 | Fallback handler | Account (delegatecall on unknown function) |
| 4 | Hook | Account (before/after execution) |

```solidity
interface IERC7579Account {
    function execute(bytes32 mode, bytes calldata executionCalldata) external;
    function installModule(uint256 moduleTypeId, address module, bytes calldata initData) external;
    function uninstallModule(uint256 moduleTypeId, address module, bytes calldata deInitData) external;
    function isModuleInstalled(uint256 moduleTypeId, address module, bytes calldata additionalContext)
        external view returns (bool);
    function supportsExecutionMode(bytes32 mode) external view returns (bool);
    function supportsModule(uint256 moduleTypeId) external view returns (bool);
}
```

**Key rules:**
- Execution modes encode call type (single, batch, delegatecall) and exec type (default, try) in a `bytes32`.
- Modules MUST be stateless with respect to the account — store per-account state via mappings keyed by `msg.sender`.
- `installModule` and `uninstallModule` should be access-controlled (only the account itself or authorized validators).

## Chain & Gas

### EIP-1559 — Fee Market

Replaced the first-price gas auction with a base fee + priority fee model.

**Transaction fields:**
- `maxFeePerGas` — Maximum total fee per gas unit the sender will pay.
- `maxPriorityFeePerGas` — Tip to the validator (above base fee).
- `baseFeePerGas` — Protocol-determined, burned. Not set by users.

**Base fee adjustment:**
- Target: 50% gas utilization per block (15M gas of 30M limit).
- Block >50% full → base fee increases (up to 12.5% per block).
- Block <50% full → base fee decreases (up to 12.5% per block).
- Base fee is entirely burned (EIP-1559 burn mechanism).

**Effective gas price:**
```
effectiveGasPrice = min(baseFeePerGas + maxPriorityFeePerGas, maxFeePerGas)
```

**Refund:** `(maxFeePerGas - effectiveGasPrice) * gasUsed` is refunded to sender.

### EIP-4844 — Blob Transactions (Proto-Danksharding)

Type 3 transactions carrying binary large objects (blobs) for L2 data availability.

**Key properties:**
- Blobs are ~128 KB each, max 6 per transaction (post-Pectra: higher targets).
- Blob data is NOT accessible from the EVM — only the blob's versioned hash (commitment).
- Blobs are pruned from consensus nodes after ~18 days.
- Separate fee market: `blobBaseFee` adjusts independently from execution `baseFee`.

**Transaction fields (added to EIP-1559):**
- `maxFeePerBlobGas` — Maximum fee per blob gas unit.
- `blobVersionedHashes` — List of versioned hashes (one per blob).

**Precompile:** `BLOBHASH` opcode (0x49) returns versioned hash at given index. `Point evaluation precompile` at `0x0A` verifies KZG proofs.

**Who uses this:** L2 rollups (Arbitrum, Optimism, Base, Scroll) post their data as blobs instead of calldata, reducing costs by ~10-100x.

### EIP-2930 — Access Lists

Type 1 transactions that declare which addresses and storage keys will be accessed.

```json
{
  "accessList": [
    {
      "address": "0xContractAddress",
      "storageKeys": [
        "0x0000000000000000000000000000000000000000000000000000000000000001"
      ]
    }
  ]
}
```

**Key rules:**
- Pre-warming accessed slots costs 2400 gas per slot (vs 2600 for cold access). Net savings only when you access each declared slot.
- Useful for cross-contract calls where you know which storage slots will be read.
- `eth_createAccessList` RPC method generates an optimal access list for a given transaction.

## Proxy & Upgrade Patterns

### EIP-1967 — Proxy Storage Slots

Standardized storage slots for proxy contracts to avoid collisions with implementation storage.

```solidity
// Implementation slot: bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1)
bytes32 constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

// Admin slot: bytes32(uint256(keccak256("eip1967.proxy.admin")) - 1)
bytes32 constant ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

// Beacon slot: bytes32(uint256(keccak256("eip1967.proxy.beacon")) - 1)
bytes32 constant BEACON_SLOT = 0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50;
```

**Key rules:**
- The `-1` offset prevents the slot from being a known hash preimage, avoiding potential collisions with Solidity mappings.
- Read implementation address: `sload(IMPLEMENTATION_SLOT)`.
- Block explorers and tools rely on these standard slots for proxy detection.

### EIP-1822 — UUPS (Universal Upgradeable Proxy Standard)

Upgrade logic lives in the implementation, not the proxy. The proxy is minimal.

```solidity
// Implementation contains upgrade logic
function upgradeTo(address newImplementation) external onlyOwner {
    require(newImplementation.code.length > 0, "Not a contract");
    // ERC-1822: implementation stores its own address for verification
    require(
        IERC1822(newImplementation).proxiableUUID() == IMPLEMENTATION_SLOT,
        "UUID mismatch"
    );
    StorageSlot.getAddressSlot(IMPLEMENTATION_SLOT).value = newImplementation;
}

function proxiableUUID() external pure returns (bytes32) {
    return IMPLEMENTATION_SLOT;
}
```

**UUPS vs Transparent Proxy:**
| | UUPS (EIP-1822) | Transparent (EIP-1967) |
|---|---|---|
| Upgrade logic location | Implementation | Proxy |
| Gas per call | Lower (no admin check) | Higher (checks if caller is admin) |
| Risk | Bricked if implementation lacks `upgradeTo` | Cannot brick upgrade path |
| Deploy cost | Lower (minimal proxy) | Higher (proxy has upgrade logic) |

**Key rules:**
- UUPS implementations MUST include upgrade logic. If you deploy an implementation without `upgradeTo`, the proxy is permanently locked.
- Always use `_disableInitializers()` in implementation constructors to prevent initialization of the implementation itself.
- OpenZeppelin's `UUPSUpgradeable` provides the standard implementation.

### EIP-7201 — Namespaced Storage Layout

Deterministic storage locations for upgradeable contracts, preventing slot collisions across inheritance.

```solidity
// Formula: keccak256(abi.encode(uint256(keccak256("myprotocol.storage.MyStruct")) - 1)) & ~bytes32(uint256(0xff))
// The -1 and masking prevent hash preimage attacks and align to 256-byte boundaries

/// @custom:storage-location erc7201:myprotocol.storage.Counter
struct CounterStorage {
    uint256 count;
    mapping(address => uint256) perUser;
}

function _getCounterStorage() private pure returns (CounterStorage storage $) {
    // keccak256(abi.encode(uint256(keccak256("myprotocol.storage.Counter")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 COUNTER_STORAGE_LOCATION = 0x...;
    assembly {
        $.slot := COUNTER_STORAGE_LOCATION
    }
}
```

**Key rules:**
- Each struct gets its own deterministic namespace. No inheritance slot conflicts.
- The `@custom:storage-location` NatSpec annotation lets tools (OpenZeppelin Upgrades) verify layout.
- Replaces the fragile "append-only" storage pattern used by older upgradeable contracts.
- OpenZeppelin v5+ uses EIP-7201 by default for all upgradeable contracts.

## Quick Lookup Table

| Number | Name | Type | Status | Summary |
|--------|------|------|--------|---------|
| ERC-20 | Token Standard | ERC | Final | Fungible token interface (transfer, approve, allowance) |
| ERC-165 | Interface Detection | ERC | Final | `supportsInterface(bytes4)` — standard introspection |
| ERC-173 | Contract Ownership | ERC | Final | `owner()` + `transferOwnership()` standard |
| EIP-191 | Signed Data Standard | EIP | Final | Prefixed signing to prevent transaction-signing tricks |
| ERC-721 | Non-Fungible Token | ERC | Final | Unique token with `ownerOf`, `safeTransferFrom` |
| ERC-1155 | Multi-Token | ERC | Final | Multiple token types in one contract |
| ERC-1271 | Contract Signatures | ERC | Final | `isValidSignature` for smart contract wallets |
| EIP-712 | Typed Data Signing | EIP | Final | Structured, human-readable signature requests |
| EIP-1014 | CREATE2 | EIP | Final | Deterministic contract addresses from salt + initcode |
| EIP-1559 | Fee Market | EIP | Final | Base fee + priority fee, base fee burned |
| EIP-1822 | UUPS Proxy | EIP | Final | Upgrade logic in implementation, not proxy |
| EIP-1967 | Proxy Storage Slots | EIP | Final | Standard slots for impl/admin/beacon addresses |
| EIP-2098 | Compact Signatures | EIP | Final | 64-byte signatures (r + yParityAndS) |
| ERC-2612 | Permit | ERC | Final | Gasless ERC-20 approvals via EIP-712 signature |
| EIP-2930 | Access Lists | EIP | Final | Declare accessed addresses/slots for gas savings |
| ERC-4337 | Account Abstraction | ERC | Draft | Smart accounts via EntryPoint + Bundler |
| ERC-4626 | Tokenized Vault | ERC | Final | Standardized yield vault (deposit/withdraw/redeem) |
| EIP-4844 | Blob Transactions | EIP | Final | L2 data availability via blobs (~128 KB, pruned) |
| ERC-6900 | Modular Accounts v1 | ERC | Draft | Plugin architecture for smart accounts |
| EIP-7201 | Namespaced Storage | EIP | Final | Deterministic storage slots for upgradeable contracts |
| ERC-7579 | Modular Accounts v2 | ERC | Draft | Minimal modular smart account interface |
| EIP-7702 | EOA Code Setting | EIP | Final | EOAs delegate to contract code per-transaction |

## References

- [EIPs Repository](https://eips.ethereum.org) — Canonical source for all EIP/ERC text
- [ERC-20](https://eips.ethereum.org/EIPS/eip-20) — Token Standard
- [ERC-721](https://eips.ethereum.org/EIPS/eip-721) — Non-Fungible Token
- [ERC-1155](https://eips.ethereum.org/EIPS/eip-1155) — Multi-Token
- [ERC-4626](https://eips.ethereum.org/EIPS/eip-4626) — Tokenized Vault
- [EIP-191](https://eips.ethereum.org/EIPS/eip-191) — Signed Data Standard
- [EIP-712](https://eips.ethereum.org/EIPS/eip-712) — Typed Structured Data
- [ERC-1271](https://eips.ethereum.org/EIPS/eip-1271) — Contract Signature Verification
- [ERC-2612](https://eips.ethereum.org/EIPS/eip-2612) — Permit Extension
- [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) — Account Abstraction
- [ERC-7579](https://eips.ethereum.org/EIPS/eip-7579) — Modular Smart Accounts
- [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559) — Fee Market Change
- [EIP-4844](https://eips.ethereum.org/EIPS/eip-4844) — Shard Blob Transactions
- [EIP-1967](https://eips.ethereum.org/EIPS/eip-1967) — Proxy Storage Slots
- [EIP-1822](https://eips.ethereum.org/EIPS/eip-1822) — UUPS
- [EIP-7201](https://eips.ethereum.org/EIPS/eip-7201) — Namespaced Storage
- [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) — Set EOA Account Code
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts) — Reference implementations
