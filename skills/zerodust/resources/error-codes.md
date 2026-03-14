# ZeroDust Error Codes

All API errors return JSON with `error` (message) and `code` (machine-readable) fields.

## Quote Errors

| Code | HTTP | Cause | Fix |
|------|------|-------|-----|
| `BALANCE_TOO_LOW` | 400 | Balance below chain minimum | Check `canSweep` from balances endpoint first |
| `INSUFFICIENT_FOR_FEES` | 400 | Balance doesn't cover gas + service fee | Try same-chain sweep (lower fees) or wait for lower gas |
| `INVALID_FROM_CHAIN` | 400 | Source chain not supported | Check `GET /chains` for supported chains |
| `INVALID_TO_CHAIN` | 400 | Destination chain not supported | Check `GET /chains` for supported chains |
| `INVALID_CALL_TARGET` | 400 | Invalid bridge contract address | Let the API auto-fetch Gas.zip calldata |
| `INVALID_CALL_DATA` | 400 | Invalid hex-encoded bridge data | Let the API auto-fetch Gas.zip calldata |

## Bridge Errors

| Code | HTTP | Cause | Fix |
|------|------|-------|-----|
| `BRIDGE_UNAVAILABLE` | 400 | Gas.zip route not available | Try different destination or same-chain |
| `SOURCE_CHAIN_DISABLED` | 400 | Gas.zip disabled this source chain | Use same-chain sweep or wait |
| `DEST_CHAIN_DISABLED` | 400 | Gas.zip disabled this destination | Try different destination chain |
| `NO_ROUTE` | 400 | No bridge path exists | Try different chain combination |

## Sweep Submission Errors

| Code | HTTP | Cause | Fix |
|------|------|-------|-----|
| `QUOTE_EXPIRED` | 400 | Quote deadline passed (55s) | Request new quote and sign immediately |
| `INVALID_SIGNATURE` | 400 | EIP-712 SweepIntent signature invalid | Ensure verifyingContract = user's EOA |
| `EIP7702_INVALID_SIGNATURE` | 400 | EIP-7702 auth not signed by user | Verify signing account matches userAddress |
| `CHAIN_ID_MISMATCH` | 400 | Auth chainId != quote chainId | Use same chainId as the quote |
| `CONTRACT_ADDRESS_MISMATCH` | 400 | Auth contract != ZeroDust contract | Use contractAddress from /authorization |
| `CONTRACT_NOT_DEPLOYED` | 400 | No contract on requested chain | Check supported chains |
| `INVALID_REVOKE_TARGET` | 400 | Revoke auth not delegating to address(0) | Set contractAddress to 0x000...000 |
| `REVOKE_CHAIN_ID_MISMATCH` | 400 | Revoke chainId != quote chainId | Use same chainId |
| `REVOKE_NONCE_MISMATCH` | 400 | Revoke nonce != delegation nonce + 1 | Set nonce to delegationAuth.nonce + 1 |
| `MODE_MISMATCH` | 400 | MODE_TRANSFER used for cross-chain | MODE_TRANSFER only for same-chain |
| `MISSING_CALL_DATA` | 400 | Cross-chain quote missing bridge data | Re-fetch quote (Gas.zip may have failed) |
| `MISSING_CALL_TARGET` | 400 | Cross-chain quote missing bridge address | Re-fetch quote |

## Validation Errors

| Code | HTTP | Cause | Fix |
|------|------|-------|-----|
| `INVALID_ADDRESS` | 400 | Malformed Ethereum address | Validate with `isAddress()` from viem |
| `SIG_NOT_HEX` | 400 | Signature not valid hex | Ensure 0x prefix and hex characters |
| `SIG_BAD_LENGTH` | 400 | Signature not 64 or 65 bytes | Standard ECDSA signatures are 65 bytes |
| `INVALID_RS` | 400 | EIP-7702 r/s values not valid hex | Check wallet signing output |

## Server Errors

| Code | HTTP | Cause | Fix |
|------|------|-------|-----|
| `DB_ERROR` | 500 | Database connection issue | Retry after brief delay |
| `INTERNAL_ERROR` | 500 | Unexpected server error | Retry; if persistent, contact support |
| `DATA_INTEGRITY_ERROR` | 500 | Quote data corrupted | Re-fetch quote |

## SDK Error Classes

| Class | Corresponding API Code(s) |
|-------|--------------------------|
| `BalanceTooLowError` | `BALANCE_TOO_LOW`, `INSUFFICIENT_FOR_FEES` |
| `QuoteExpiredError` | `QUOTE_EXPIRED` |
| `ChainNotSupportedError` | `INVALID_FROM_CHAIN`, `INVALID_TO_CHAIN`, `CONTRACT_NOT_DEPLOYED` |
| `SignatureError` | `INVALID_SIGNATURE`, `EIP7702_INVALID_SIGNATURE` |
| `BridgeError` | `BRIDGE_UNAVAILABLE`, `SOURCE_CHAIN_DISABLED`, `DEST_CHAIN_DISABLED` |
| `InvalidAddressError` | `INVALID_ADDRESS` |
| `NetworkError` | Connection/timeout issues |
| `TimeoutError` | Request exceeded timeout |
