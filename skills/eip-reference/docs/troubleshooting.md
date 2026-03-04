# EIP Reference Troubleshooting

Common issues when implementing Ethereum standards, with root causes and fixes.

## ERC-20: Approve Race Condition

**Symptom:** Spender drains more than intended when allowance is updated from N to M.

**Root cause:** Spender front-runs the `approve(M)` call, spending existing allowance N, then spends the new allowance M (total: N+M).

**Fix:**
```solidity
// Option 1: Reset to zero first (required for USDT)
token.approve(spender, 0);
token.approve(spender, newAmount);

// Option 2: Use SafeERC20 (OpenZeppelin v5)
SafeERC20.forceApprove(token, spender, newAmount);

// Option 3: Use ERC-2612 permit (gasless, nonce-protected)
token.permit(owner, spender, value, deadline, v, r, s);
```

## ERC-20: USDT Nonzero-to-Nonzero Approve Reverts

**Symptom:** `approve` reverts silently on USDT.

**Root cause:** USDT requires allowance to be 0 before setting a new nonzero value.

**Fix:** Use `SafeERC20.forceApprove` which handles the zero-first pattern automatically.

## ERC-721: safeTransferFrom Reverts on Contract Recipient

**Symptom:** `safeTransferFrom` reverts when sending to a contract.

**Root cause:** Receiving contract missing `IERC721Receiver` or returns wrong selector.

**Fix:**
```solidity
function onERC721Received(
    address operator, address from, uint256 tokenId, bytes calldata data
) external returns (bytes4) {
    return IERC721Receiver.onERC721Received.selector; // 0x150b7a02
}
```

If the receiving contract cannot be modified, use `transferFrom` instead — but the token may be permanently locked.

## EIP-712: Domain Separator Mismatch Across Chains

**Symptom:** Signature verification fails after deploying on a different chain or after a fork.

**Root cause:** Domain separator was computed at deploy time with the original `chainId`.

**Fix:**
```solidity
function _domainSeparator() internal view returns (bytes32) {
    if (block.chainid == _cachedChainId) {
        return _cachedDomainSeparator;
    }
    return _computeDomainSeparator();
}
```

OpenZeppelin's `EIP712` base contract handles this automatically.

## EIP-712: Frontend chainId Mismatch

**Symptom:** `signTypedData` works on mainnet but verification fails on testnet.

**Root cause:** Hardcoded `chainId` in the frontend domain object.

**Fix:**
```typescript
const chainId = await publicClient.getChainId();
// Use this dynamic chainId in the domain, not a hardcoded value
```

## ERC-2612: Permit Nonce Mismatch

**Symptom:** `permit` reverts with "invalid signature" despite correct signing.

**Root cause:** Nonce fetched before another transaction incremented it.

**Fix:**
```typescript
const nonce = await publicClient.readContract({
  address: tokenAddress,
  abi: erc20PermitAbi,
  functionName: 'nonces',
  args: [ownerAddress],
});
// Sign immediately after fetching — do not cache
```

## ERC-2612: Permit Front-Running

**Symptom:** `permit` reverts even though the signature is valid.

**Root cause:** Someone submitted the permit signature first, incrementing the nonce.

**Fix:**
```solidity
if (token.allowance(owner, spender) < amount) {
    token.permit(owner, spender, amount, deadline, v, r, s);
}
```

## ERC-4337: UserOp Simulation Failure

**Common error codes:**

| Code | Meaning | Fix |
|------|---------|-----|
| `AA10` | Sender already constructed | Remove `initCode` |
| `AA21` | Insufficient deposit | Fund via `entryPoint.depositTo` |
| `AA23` | Validation reverted | Return `SIG_VALIDATION_FAILED`, do not revert |
| `AA25` | Invalid nonce | Query `entryPoint.getNonce(sender, key)` |
| `AA31` | Paymaster deposit too low | Top up paymaster on EntryPoint |
| `AA33` | Paymaster validation reverted | Check `validatePaymasterUserOp` logic |

## ERC-4626: First-Depositor Share Inflation

**Symptom:** Second depositor receives 0 shares despite depositing significant assets.

**Root cause:** Attacker deposits 1 wei, donates tokens directly to vault, inflating share price beyond the second depositor's amount.

**Fix:** Use OpenZeppelin's `ERC4626` which includes virtual shares/assets offset by default in v5.

## EIP-1967: Proxy Not Detected by Explorer

**Symptom:** Etherscan shows proxy ABI instead of implementation ABI.

**Root cause:** Implementation not stored in standard EIP-1967 slot or missing `Upgraded` event.

**Fix:** Ensure standard slot and event emission:
```solidity
event Upgraded(address indexed implementation);
bytes32 constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
```

## References

- [EIP-20](https://eips.ethereum.org/EIPS/eip-20) — Token Standard
- [EIP-712](https://eips.ethereum.org/EIPS/eip-712) — Typed Structured Data
- [ERC-2612](https://eips.ethereum.org/EIPS/eip-2612) — Permit Extension
- [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) — Account Abstraction
- [ERC-4626](https://eips.ethereum.org/EIPS/eip-4626) — Tokenized Vault
- [EIP-1967](https://eips.ethereum.org/EIPS/eip-1967) — Proxy Storage Slots
