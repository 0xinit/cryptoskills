# EIP Reference Troubleshooting

Common issues when implementing Ethereum standards, with root causes and fixes.

## ERC-20: Approve Race Condition

**Symptom:** Spender drains more than intended when allowance is updated from N to M.

**Root cause:** Spender front-runs the `approve(M)` call, spending the existing allowance N, then spends the new allowance M, totaling N+M.

**Fix:**
```solidity
// Option 1: Reset to zero first (required for USDT)
token.approve(spender, 0);
token.approve(spender, newAmount);

// Option 2: Use increaseAllowance/decreaseAllowance (OpenZeppelin)
token.increaseAllowance(spender, additionalAmount);

// Option 3: Use ERC-2612 permit (gasless, single-use nonce)
token.permit(owner, spender, value, deadline, v, r, s);
```

## ERC-20: USDT Nonzero-to-Nonzero Approve Reverts

**Symptom:** `approve` call reverts with no error message on USDT.

**Root cause:** USDT's implementation requires allowance to be 0 before setting a new nonzero value.

**Fix:** Always set allowance to 0 before approving a new amount. OpenZeppelin `SafeERC20.forceApprove` handles this automatically.

## ERC-721: safeTransferFrom Reverts on Contract Recipient

**Symptom:** `safeTransferFrom` reverts when sending to a contract address.

**Root cause:** The receiving contract does not implement `IERC721Receiver` or returns the wrong selector from `onERC721Received`.

**Fix:**
```solidity
// Receiving contract must implement:
function onERC721Received(
    address operator, address from, uint256 tokenId, bytes calldata data
) external returns (bytes4) {
    return IERC721Receiver.onERC721Received.selector; // 0x150b7a02
}
```

If the receiving contract intentionally should not accept NFTs, this is working as designed. If you must send to a contract that cannot be modified, use `transferFrom` instead — but the token may be permanently locked.

## EIP-712: Domain Separator Mismatch Across Chains

**Symptom:** Signature verification fails after deploying the same contract on a different chain, or after a chain fork.

**Root cause:** The domain separator was computed at deploy time with the original `chainId`. On another chain, `block.chainid` differs and the digest changes.

**Fix:**
```solidity
// Recompute domain separator if chainId changed (fork protection)
function _domainSeparator() internal view returns (bytes32) {
    if (block.chainid == _cachedChainId) {
        return _cachedDomainSeparator;
    }
    return _computeDomainSeparator();
}
```

OpenZeppelin's `EIP712` base contract does this automatically. If you are hand-rolling EIP-712, always check `block.chainid` before using a cached separator.

## EIP-712: Signature Valid on Mainnet but Fails on Testnet

**Symptom:** `signTypedData` works on mainnet but verification fails on Sepolia (or vice versa).

**Root cause:** The `chainId` in the domain passed to `signTypedData` on the frontend does not match the chain the contract is deployed on.

**Fix:** Ensure the frontend reads `chainId` from the connected wallet, not from a hardcoded value:

```typescript
import { getChainId } from "viem/actions";

const chainId = await getChainId(publicClient);
// Use this chainId in the domain object
```

## ERC-4337: UserOp Simulation Failure

**Symptom:** Bundler rejects UserOperation with `AA** error` codes.

**Common error codes:**
| Code | Meaning | Fix |
|------|---------|-----|
| `AA10` | Sender already constructed | Remove `initCode` — account already deployed |
| `AA13` | initCode failed or returned wrong address | Check factory `createAccount` uses CREATE2 with correct salt |
| `AA21` | Insufficient stake/deposit | Fund account via `entryPoint.depositTo` |
| `AA23` | Reverted during validation | `validateUserOp` is reverting instead of returning `SIG_VALIDATION_FAILED` |
| `AA25` | Invalid nonce | Query current nonce with `entryPoint.getNonce(sender, key)` |
| `AA31` | Paymaster deposit too low | Top up paymaster deposit on EntryPoint |
| `AA33` | Paymaster validation reverted | Check `validatePaymasterUserOp` logic |
| `AA34` | Paymaster validation out of gas | Increase `paymasterVerificationGasLimit` |
| `AA40` | Over verificationGasLimit | Increase `verificationGasLimit` |
| `AA41` | Over paymasterVerificationGasLimit | Increase paymaster gas limit in `paymasterAndData` |
| `AA51` | Prefund below actualGasCost | Increase `preVerificationGas` or pre-fund account |

## ERC-2612: Permit Signature Expired

**Symptom:** `permit` call reverts with `"ERC2612: expired deadline"`.

**Root cause:** The `deadline` timestamp in the signed permit is in the past by the time the transaction is mined.

**Fix:**
- Set `deadline` far enough in the future to survive mempool delays. 30 minutes is common, 1 hour is safe.
- For immediate use: `deadline = block.timestamp + 1800` (30 minutes).
- Never set `deadline = block.timestamp` on the frontend — by the time the tx mines, it has already expired.

## ERC-2612: Permit Nonce Mismatch

**Symptom:** `permit` call reverts with `"ERC2612: invalid signature"` even though the signature looks correct.

**Root cause:** The nonce used when signing does not match the current on-chain nonce. This happens when:
1. A previous permit was submitted but not yet mined (nonce is stale)
2. The nonce was fetched from a stale RPC response
3. Another transaction incremented the nonce between signing and submission

**Fix:**
```typescript
// Always fetch nonce immediately before signing
const nonce = await publicClient.readContract({
  address: tokenAddress,
  abi: erc20PermitAbi,
  functionName: "nonces",
  args: [ownerAddress],
});
// Use this nonce in the signTypedData call
```

## ERC-2612: Permit Front-Running

**Symptom:** `permit` call reverts even though the signature is valid.

**Root cause:** Someone else submitted the permit signature first (front-ran). The nonce was incremented, so the original `permit` call sees a used nonce.

**Fix:** Check allowance before calling `permit`. If allowance is already set, skip the permit call:
```solidity
if (token.allowance(owner, spender) < amount) {
    token.permit(owner, spender, amount, deadline, v, r, s);
}
```

## ERC-165: Interface ID Calculation Errors

**Symptom:** `supportsInterface` returns `false` for an interface the contract implements.

**Root cause:** The interface ID was calculated incorrectly. The ID is the XOR of all function selectors in the interface — NOT including inherited functions.

**Fix:**
```solidity
// Correct: XOR of selectors in IERC721 only (not IERC165 selectors)
bytes4 constant IERC721_ID = 0x80ac58cd;

// Verify in Foundry
bytes4 id = type(IERC721).interfaceId;
assertEq(id, 0x80ac58cd);
```

Common mistake: including `supportsInterface` itself in the XOR. `supportsInterface` belongs to ERC-165 (`0x01ffc9a7`), not to the derived interface.

## EIP-1967: Proxy Not Detected by Block Explorer

**Symptom:** Etherscan shows the proxy's own ABI (fallback, receive) instead of the implementation's ABI.

**Root cause:** The implementation address is not stored in the standard EIP-1967 slot (`0x360894a...`), or the proxy does not emit the standard `Upgraded(address)` event.

**Fix:** Ensure the proxy writes to the standard slot and emits the event:
```solidity
event Upgraded(address indexed implementation);

bytes32 constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
```

After deployment, verify on Etherscan by clicking "Is this a proxy?" → "Verify" → "Save". The explorer reads the EIP-1967 slot to detect the implementation.

## References

- [EIP-20](https://eips.ethereum.org/EIPS/eip-20) — Token Standard
- [EIP-712](https://eips.ethereum.org/EIPS/eip-712) — Typed Structured Data
- [ERC-2612](https://eips.ethereum.org/EIPS/eip-2612) — Permit Extension
- [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) — Account Abstraction
- [EIP-165](https://eips.ethereum.org/EIPS/eip-165) — Interface Detection
- [EIP-1967](https://eips.ethereum.org/EIPS/eip-1967) — Proxy Storage Slots
