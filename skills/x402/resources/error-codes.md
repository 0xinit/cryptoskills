# x402 Error Codes and Solutions

Error responses from the x402 payment flow: HTTP status codes, facilitator errors, and on-chain revert reasons.

Last verified: February 2026

## HTTP Status Codes

| Status | Meaning | When |
|--------|---------|------|
| 402 | Payment Required | Request lacks `X-PAYMENT` header or payment is invalid |
| 412 | Precondition Failed | Permit2 allowance missing (`PERMIT2_ALLOWANCE_REQUIRED`) |
| 400 | Bad Request | Malformed `X-PAYMENT` header, invalid JSON, or unsupported scheme |
| 200 | OK | Payment verified and resource served |

## Facilitator Verification Errors

These are returned by the facilitator's `/verify` endpoint and forwarded by the resource server.

| Error | Cause | Fix |
|-------|-------|-----|
| `Invalid signature` | EIP-712 signature does not recover to `authorization.from` | Verify signing domain (name, version, chainId, verifyingContract) matches the token contract |
| `Insufficient balance` | Signer does not hold enough USDC | Fund the wallet with USDC on the correct chain |
| `Authorization expired` | `validBefore` timestamp has passed | Set `validBefore` to `now + maxTimeoutSeconds` and minimize latency between signing and submitting |
| `Invalid nonce` | Nonce format is incorrect or not 32 bytes | Use a random 32-byte hex value prefixed with `0x` |
| `Token mismatch` | `asset` in `accepted` does not match the chain's USDC contract | Use the correct USDC address for the target network |
| `Network mismatch` | Client signed for a different chain than the server accepts | Match the `network` field from the 402 response exactly |
| `Simulation failed` | On-chain simulation of `transferWithAuthorization` reverted | Check balance, nonce state, and authorization parameters |

## Facilitator Settlement Errors

These occur when the facilitator attempts to broadcast the `transferWithAuthorization` call.

| Error | Cause | Fix |
|-------|-------|-----|
| `authorization is used or canceled` | Nonce was already consumed on-chain | Generate a fresh random nonce for each payment |
| `authorization is not yet valid` | `validAfter` is in the future | Set `validAfter` to `0` or current timestamp |
| `caller is not the payee` | Transaction submitted by wrong address | This is a facilitator configuration issue — the facilitator must be authorized |
| `transfer amount exceeds balance` | Balance decreased between verify and settle | Client spent USDC between verification and settlement |
| `Settlement timeout` | On-chain transaction did not confirm in time | Retry settlement or increase gas price in custom facilitator |

## Client-Side Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `X-PAYMENT header is required` | Fetch wrapper did not detect 402 or scheme mismatch | Ensure `network` in `schemes` config matches server's `accepts` |
| `No matching scheme` | Client has no registered scheme for the server's network | Register the correct scheme: `ExactEvmScheme` for EVM, `ExactSvmScheme` for Solana |
| `Private key required` | Account not initialized | Pass private key to `privateKeyToAccount()` or set environment variable |

## Debugging Tips

1. Decode the `X-PAYMENT` header (base64 JSON) to inspect the authorization fields
2. Verify the USDC balance on the correct chain using a block explorer
3. Check nonce state on-chain: call `authorizationState(authorizer, nonce)` on the USDC contract
4. Compare `validBefore` against the current block timestamp, not your local clock
5. Use Base Sepolia (`eip155:84532`) for testing before mainnet deployment
