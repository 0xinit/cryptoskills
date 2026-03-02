# Privy Auth Methods Reference

> **Last verified:** March 2026 (`@privy-io/react-auth` v3.14.1)

All authentication methods supported by Privy, with configuration examples.

## Config Overview

Auth methods are configured in the `loginMethods` array of `PrivyProvider`. Social OAuth providers require additional setup in the Privy dashboard (client IDs, redirect URIs).

```typescript
<PrivyProvider
  appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
  config={{
    loginMethods: ["email", "google", "passkey", "wallet"],
  }}
>
```

## Method Reference

| Method | Config Key | Type | Dashboard Setup | Notes |
|--------|-----------|------|-----------------|-------|
| Email | `'email'` | OTP / Magic Link | None | Default method. Sends 6-digit OTP. |
| Phone (SMS) | `'sms'` | OTP | None | SMS-based OTP. International support. |
| Google | `'google'` | OAuth 2.0 | Google client ID | Most common social login. |
| Apple | `'apple'` | OAuth 2.0 | Apple Services ID + key | Requires Apple Developer account. |
| Twitter/X | `'twitter'` | OAuth 1.0a | Twitter API keys | Legacy OAuth flow. |
| Discord | `'discord'` | OAuth 2.0 | Discord application | Popular for gaming/community dApps. |
| GitHub | `'github'` | OAuth 2.0 | GitHub OAuth app | Developer-focused dApps. |
| LinkedIn | `'linkedin'` | OAuth 2.0 | LinkedIn app | Professional identity. |
| Spotify | `'spotify'` | OAuth 2.0 | Spotify app | Music/entertainment dApps. |
| TikTok | `'tiktok'` | OAuth 2.0 | TikTok developer app | Social content dApps. |
| Farcaster | `'farcaster'` | SIWF | None | Sign-in with Farcaster. Custody wallet NOT usable in-browser. |
| Passkey | `'passkey'` | WebAuthn | None | Device-bound biometric auth. |
| Wallet | `'wallet'` | EIP-1193 | Optional WC project ID | External wallets (MetaMask, Coinbase, etc.). |
| Telegram | `'telegram'` | Telegram Login Widget | Telegram bot token | Mini App and bot integrations. |
| Custom | `'custom'` | JWT | JWKS endpoint config | Bring your own auth provider. |

## Headless Login Hooks

Each auth method has a corresponding headless hook for custom UI.

| Method | Hook | Key Methods |
|--------|------|-------------|
| Email | `useLoginWithEmail()` | `sendCode({ email })`, `loginWithCode({ code })` |
| Phone | `useLoginWithSms()` | `sendCode({ phone })`, `loginWithCode({ code })` |
| OAuth (all) | `useLoginWithOAuth()` | `initOAuth({ provider: 'google' })` |
| Passkey | `useLoginWithPasskey()` | `loginWithPasskey()` |
| Wallet | `useLoginWithWallet()` | `loginWithWallet()` |
| Farcaster | `useLoginWithFarcaster()` | `loginWithFarcaster()` |
| Custom JWT | `useLoginWithCustomAuth()` | `loginWithCustomAuth({ token })` |

## Custom Auth (Bring Your Own JWT)

For apps with existing auth systems, Privy accepts your JWT and creates a Privy user linked to your identity.

```typescript
<PrivyProvider
  appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
  config={{
    loginMethods: ["custom"],
    customAuth: {
      // JWKS endpoint for Privy to verify your JWTs
      isLoading: false,
      getCustomAccessToken: async () => {
        const response = await fetch("/api/auth/token");
        const { token } = await response.json();
        return token;
      },
    },
  }}
>
```

## Account Linking

Users can link multiple auth methods to a single Privy account after initial login.

```typescript
const {
  linkEmail,
  linkGoogle,
  linkWallet,
  linkPasskey,
  linkPhone,
  linkDiscord,
  linkTwitter,
  linkGithub,
} = usePrivy();
```

## OAuth Redirect Configuration

Social OAuth methods redirect to `https://your-domain.com/` after authentication. Configure allowed redirect URIs in the Privy dashboard under your app settings. For local development, add `http://localhost:3000` as an allowed origin.
