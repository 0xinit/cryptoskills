# Privy Error Codes Reference

> **Last verified:** March 2026 (`@privy-io/react-auth` v3.14.1)

Common errors from Privy SDK and server-auth, with causes and fixes.

## Client-Side Errors (React SDK)

| Error | Cause | Fix |
|-------|-------|-----|
| `MISSING_OR_INVALID_PRIVY_APP_ID` | `appId` prop on `PrivyProvider` is undefined or malformed | Check `NEXT_PUBLIC_PRIVY_APP_ID` env var is set and starts with `cl` |
| `NOT_READY` | Calling hooks before SDK initialization | Check `ready === true` from `usePrivy()` before any operations |
| `USER_NOT_AUTHENTICATED` | Calling wallet/account operations before login | Check `authenticated === true` before calling wallet methods |
| `EMBEDDED_WALLET_NOT_FOUND` | Accessing embedded wallet before creation | Set `createOnLogin: 'all-users'` or call `createWallet()` manually |
| `EMBEDDED_WALLET_ALREADY_EXISTS` | Calling `createWallet()` when wallet exists | Check `isNotCreated(wallet)` before calling `create()` |
| `CHAIN_NOT_SUPPORTED` | `switchChain` called with a chain not in `supportedChains` | Add the chain to `supportedChains` in `PrivyProvider` config |
| `INSECURE_CONTEXT` | WebCrypto unavailable (HTTP origin) | Use HTTPS or `localhost` for development |
| `PASSKEY_NOT_SUPPORTED` | Browser does not support WebAuthn | Feature-detect with `PublicKeyCredential` before showing passkey option |
| `OAUTH_POPUP_BLOCKED` | Browser blocked the OAuth popup window | Prompt user to allow popups for the domain |
| `LOGIN_CANCELLED` | User closed the login modal or cancelled OAuth | Silent reset. Not an error. |

## Server-Side Errors (@privy-io/server-auth)

| Error | Cause | Fix |
|-------|-------|-----|
| `Invalid token` | Token is malformed, expired, or wrong type | Check you are passing an access token (not identity token) to `verifyAuthToken` |
| `Invalid app ID` | App ID does not match the token's audience | Verify `PRIVY_APP_ID` matches the app that issued the token |
| `Unauthorized` | Missing or wrong app secret | Check `PRIVY_APP_SECRET` (starts with `secret-`) |
| `User not found` | Querying a non-existent user ID | Verify the user ID format (`did:privy:...`) |
| `Rate limited` | Too many API calls | Implement exponential backoff. Default limit: 100 req/sec per app |

## Embedded Wallet Transaction Errors

| Error Pattern | Cause | Fix |
|---------------|-------|-----|
| `User rejected the request` | User declined signing in the Privy popup | Silent reset to idle state. Not an error. |
| `insufficient funds` | Wallet balance too low for tx + gas | Show balance and required amount to user |
| `nonce too low` | Concurrent transactions with same nonce | Wait for pending tx to confirm before sending next |
| `execution reverted` | Smart contract reverted the call | Decode revert reason from error data. Check contract inputs. |
| `chain mismatch` | Wallet on wrong chain for the transaction | Call `wallet.switchChain(chainId)` before sending |

## HTTP Status Codes (Server API)

| Status | Meaning | Action |
|--------|---------|--------|
| 200 | Success | Process response |
| 400 | Bad request (malformed body) | Check request format |
| 401 | Unauthorized (invalid/expired token) | Re-authenticate client |
| 403 | Forbidden (valid token, wrong permissions) | Check app configuration |
| 404 | Resource not found | Verify user/wallet ID |
| 429 | Rate limited | Backoff and retry |
| 500 | Privy internal error | Retry with backoff. Report if persistent. |
