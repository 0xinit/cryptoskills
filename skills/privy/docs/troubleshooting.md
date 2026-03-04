# Privy Troubleshooting

Common issues when integrating Privy's React SDK, embedded wallets, and server-side auth.

## HTTPS / Secure Context Errors

**Symptom:** SDK initializes but wallet creation or signing silently fails. No error in console.

**Cause:** Web Crypto API requires a secure context. `http://` origins (except `localhost`) are not secure contexts.

**Fix:**
- Local dev: use `localhost` (not `127.0.0.1` or `192.168.x.x` over HTTP)
- Staging/production: always HTTPS
- If using a tunnel (ngrok, cloudflared), ensure the tunnel URL is HTTPS

```bash
# ngrok provides HTTPS automatically
ngrok http 3000
```

## Embedded Wallet Not Created After Login

**Symptom:** User logs in successfully but `useWallets()` returns empty array. `useEmbeddedWallet()` shows `not-created`.

**Causes and fixes:**

1. **`createOnLogin` not set:** Default is `'off'`. Set to `'all-users'` or `'users-without-wallets'`.
2. **Farcaster login with `'users-without-wallets'`:** Farcaster accounts have a custody wallet, so Privy skips embedded wallet creation. Use `'all-users'` instead.
3. **Checking too early:** Wallet creation is async. Wait for `useWallets()` `ready === true`.

```typescript
const { ready, wallets } = useWallets();
// Do NOT check wallets until ready === true
if (!ready) return <div>Loading...</div>;
```

## Solana Wallet Created Before EVM

**Symptom:** EVM embedded wallet cannot be created. `createWallet()` for EVM throws error.

**Cause:** Creating a Solana embedded wallet first permanently blocks EVM wallet creation for that user.

**Fix:** No fix for affected users -- they must create a new account. Prevent this by:
- Using `createOnLogin: 'all-users'` (creates both in correct order)
- If creating manually, always create EVM first: `createWallet({ type: 'ethereum' })` before `createWallet({ type: 'solana' })`

## JWT Verification Failures

**Symptom:** `verifyAuthToken` throws "Invalid token" or returns unexpected results.

**Common causes:**

1. **Using identity token instead of access token:** `verifyAuthToken` only works with access tokens. For identity tokens, use `getUser({ idToken })`.

```typescript
// Access token (from getAccessToken on client)
const claims = await privy.verifyAuthToken(accessToken);

// Identity token (from getIdToken on client)
const user = await privy.getUser({ idToken: identityToken });
```

2. **Using app ID instead of app secret:** Server-side `PrivyClient` requires both app ID AND app secret.

```typescript
const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,     // "clx..." format
  process.env.PRIVY_APP_SECRET!  // "secret-..." format
);
```

3. **Token expired:** Access tokens have short TTLs. Call `getAccessToken()` on the client before each API request -- it auto-refreshes.

## v3 Solana Peer Dependency Errors

**Symptom:** `npm install` fails with peer dependency conflicts mentioning `@solana/web3.js`.

**Cause:** Privy v3 migrated from `@solana/web3.js` to `@solana/kit`.

**Fix:**

```bash
npm uninstall @solana/web3.js
npm install @solana/kit
```

Update imports:

```typescript
// Before (v2)
import { Connection, PublicKey } from "@solana/web3.js";

// After (v3)
import { createSolanaRpc, address } from "@solana/kit";
```

## Wallet Not Ready After Authentication

**Symptom:** `authenticated === true` but signing transactions throws "wallet not ready".

**Cause:** Authentication and wallet initialization are separate async operations.

**Fix:** Check both `authenticated` and wallet `ready` state:

```typescript
const { authenticated } = usePrivy();
const { ready: walletsReady, wallets } = useWallets();

const canTransact = authenticated && walletsReady && wallets.length > 0;
```

## WalletConnect Not Working

**Symptom:** External mobile wallets cannot connect. No WalletConnect QR code shown.

**Cause:** Privy does not include WalletConnect by default.

**Fix:** Add WalletConnect project ID to your Privy config:

```typescript
<PrivyProvider
  appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
  config={{
    loginMethods: ["wallet"],
    externalWallets: {
      walletConnect: {
        projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,
      },
    },
  }}
>
```

## Cross-Browser Wallet Access

**Symptom:** User logs in on a different browser or device and embedded wallet is missing.

**Cause:** The device share (1 of 3 SSS shares) is stored in browser local storage. A new browser has no device share.

**Fix:** Users must set up recovery (password or cloud backup) during initial onboarding. Prompt recovery setup after first wallet creation. Without recovery, the wallet is inaccessible from other devices.
