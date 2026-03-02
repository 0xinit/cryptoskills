# Privy SDK Reference

> **Last verified:** March 2026 (`@privy-io/react-auth` v3.14.1, `@privy-io/server-auth` v1.14.x)

Key hooks, methods, and types from the Privy React and server SDKs.

## React Hooks

| Hook | Import | Purpose |
|------|--------|---------|
| `usePrivy()` | `@privy-io/react-auth` | Auth state, login/logout, account linking |
| `useWallets()` | `@privy-io/react-auth` | All connected wallets (embedded + external) |
| `useEmbeddedWallet()` | `@privy-io/react-auth` | Embedded wallet creation, export, state |
| `useLoginWithEmail()` | `@privy-io/react-auth` | Headless email OTP login flow |
| `useLoginWithSms()` | `@privy-io/react-auth` | Headless SMS OTP login flow |
| `useLoginWithOAuth()` | `@privy-io/react-auth` | Headless OAuth login (Google, Apple, etc.) |
| `useLoginWithPasskey()` | `@privy-io/react-auth` | Headless WebAuthn passkey login |
| `useLoginWithWallet()` | `@privy-io/react-auth` | Headless external wallet login |
| `useLoginWithFarcaster()` | `@privy-io/react-auth` | Headless Farcaster SIWF login |
| `useLoginWithCustomAuth()` | `@privy-io/react-auth` | Headless custom JWT login |

## usePrivy() Return Values

| Property/Method | Type | Description |
|----------------|------|-------------|
| `ready` | `boolean` | SDK initialized and ready to use |
| `authenticated` | `boolean` | User is logged in |
| `user` | `PrivyUser \| null` | User object with linked accounts |
| `login()` | `() => void` | Opens the Privy login modal |
| `logout()` | `() => Promise<void>` | Logs out and clears session |
| `getAccessToken()` | `() => Promise<string \| null>` | Returns a fresh access token (auto-refreshes) |
| `linkEmail()` | `() => void` | Link email to current account |
| `linkGoogle()` | `() => void` | Link Google to current account |
| `linkWallet()` | `() => void` | Link external wallet to current account |
| `linkPasskey()` | `() => void` | Link passkey to current account |
| `linkPhone()` | `() => void` | Link phone to current account |
| `linkDiscord()` | `() => void` | Link Discord to current account |
| `linkTwitter()` | `() => void` | Link Twitter/X to current account |
| `linkGithub()` | `() => void` | Link GitHub to current account |
| `unlinkEmail(address)` | `(address: string) => Promise<void>` | Unlink email from account |
| `unlinkWallet(address)` | `(address: string) => Promise<void>` | Unlink wallet from account |

## useWallets() Return Values

| Property | Type | Description |
|----------|------|-------------|
| `ready` | `boolean` | Wallets loaded and ready |
| `wallets` | `ConnectedWallet[]` | Array of all connected wallets |

## ConnectedWallet Properties

| Property/Method | Type | Description |
|----------------|------|-------------|
| `address` | `string` | Wallet address |
| `chainId` | `string` | Current chain ID (e.g., `"eip155:1"`) |
| `chainType` | `'ethereum' \| 'solana'` | Blockchain type |
| `walletClientType` | `string` | `'privy'`, `'privy_smart_wallet'`, `'metamask'`, etc. |
| `getEthereumProvider()` | `() => Promise<EIP1193Provider>` | EIP-1193 provider for viem/ethers |
| `getSolanaProvider()` | `() => Promise<SolanaProvider>` | Solana provider (for Solana wallets) |
| `switchChain(chainId)` | `(chainId: number) => Promise<void>` | Switch EVM chain |

## useEmbeddedWallet() States

| State Guard | Type | Description |
|------------|------|-------------|
| `isNotCreated(wallet)` | Type guard | Wallet not yet created. Call `wallet.create()`. |
| `isConnecting(wallet)` | Type guard | Wallet connecting after login. Wait. |
| `isConnected(wallet)` | Type guard | Wallet ready to use. Access `wallet.address`. |
| `isDisconnected(wallet)` | Type guard | Wallet disconnected. Re-login required. |

## PrivyProvider Config

| Config Key | Type | Default | Description |
|-----------|------|---------|-------------|
| `loginMethods` | `string[]` | `['email']` | Enabled auth methods |
| `appearance.theme` | `'light' \| 'dark'` | `'light'` | Modal theme |
| `appearance.accentColor` | `string` | `'#6366f1'` | Accent color for modal |
| `appearance.logo` | `string` | None | URL of logo shown in modal |
| `embeddedWallets.createOnLogin` | `'off' \| 'users-without-wallets' \| 'all-users'` | `'off'` | Auto-create embedded wallet |
| `embeddedWallets.requireUserPasswordOnCreate` | `boolean` | `false` | Require password for recovery share |
| `smartWallets.enabled` | `boolean` | `false` | Enable Safe-based smart wallets |
| `defaultChain` | `Chain` | First in `supportedChains` | Default EVM chain |
| `supportedChains` | `Chain[]` | All chains | Allowed EVM chains |

## Server SDK (PrivyClient)

| Method | Signature | Description |
|--------|-----------|-------------|
| `verifyAuthToken(token)` | `(token: string) => Promise<AuthTokenClaims>` | Verify access token. Returns user ID. |
| `getUser({ idToken })` | `(opts: { idToken: string }) => Promise<PrivyUser>` | Get user profile from identity token |
| `getUser({ userId })` | `(opts: { userId: string }) => Promise<PrivyUser>` | Get user profile by Privy user ID |
| `deleteUser(userId)` | `(userId: string) => Promise<void>` | Delete a user |

## Packages

| Package | Purpose | Install |
|---------|---------|---------|
| `@privy-io/react-auth` | React SDK (client-side) | `npm install @privy-io/react-auth` |
| `@privy-io/server-auth` | Server-side JWT verification | `npm install @privy-io/server-auth` |
| `@privy-io/expo` | React Native / Expo SDK | `npm install @privy-io/expo` |
