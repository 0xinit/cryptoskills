# Frames v2 Specification

> **Last verified:** March 2026

Frames v2 (Mini Apps) are full-screen interactive web applications embedded inside Farcaster clients. This resource covers the meta tags, manifest structure, and SDK methods.

## Meta Tags

Add to the `<head>` of your HTML page. The `fc:frame` meta tag tells Farcaster clients how to render the frame preview and launch button.

```html
<meta name="fc:frame" content='<JSON payload>' />
```

### JSON Payload Structure

```json
{
  "version": "next",
  "imageUrl": "https://example.com/og.png",
  "button": {
    "title": "Launch App",
    "action": {
      "type": "launch_frame",
      "name": "My App",
      "url": "https://example.com/app",
      "splashImageUrl": "https://example.com/splash.png",
      "splashBackgroundColor": "#1a1a2e"
    }
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `version` | Yes | Must be `"next"` for Frames v2 |
| `imageUrl` | Yes | Preview image shown in the feed (static, no JS). Max 10MB, 3:2 aspect ratio recommended |
| `button.title` | Yes | Text on the launch button (max 32 characters) |
| `button.action.type` | Yes | Must be `"launch_frame"` |
| `button.action.name` | Yes | App name shown during launch |
| `button.action.url` | Yes | URL loaded in the Mini App iframe |
| `button.action.splashImageUrl` | No | Shown while the app loads. Square, max 200x200px |
| `button.action.splashBackgroundColor` | No | Hex color for splash screen background |

## Manifest Structure (`/.well-known/farcaster.json`)

```json
{
  "accountAssociation": {
    "header": "<base64url JWS header>",
    "payload": "<base64url payload>",
    "signature": "<base64url signature>"
  },
  "frame": {
    "version": "1",
    "name": "App Name",
    "iconUrl": "https://...",
    "homeUrl": "https://...",
    "splashImageUrl": "https://...",
    "splashBackgroundColor": "#hex",
    "webhookUrl": "https://..."
  }
}
```

### Account Association

The `accountAssociation` proves the FID owner controls the domain. Components:

| Field | Content |
|-------|---------|
| `header` | Base64url-encoded JWS header: `{"fid":<fid>,"type":"custody","key":"0x<custody_address>"}` |
| `payload` | Base64url-encoded JSON: `{"domain":"<exact_fqdn>"}` |
| `signature` | Base64url-encoded Ed25519 or ECDSA signature over `header.payload` |

The `domain` in the payload MUST exactly match the FQDN where the manifest file is hosted. No protocol prefix, no trailing slash.

## Frame SDK Methods

Package: `@farcaster/frame-sdk`

### Context

```typescript
import sdk from "@farcaster/frame-sdk";

const context = await sdk.context;
// context.user.fid: number
// context.user.username: string | null
// context.user.displayName: string | null
// context.user.pfpUrl: string | null
// context.client.clientFid: number
// context.client.notificationDetails: { url: string; token: string } | null
```

### Actions

| Method | Description |
|--------|-------------|
| `sdk.actions.ready()` | Signal app is loaded, dismiss splash screen |
| `sdk.actions.openUrl(url)` | Open URL in client's browser |
| `sdk.actions.close()` | Close the Mini App |
| `sdk.actions.composeCast({ text, embeds })` | Open cast composer with prefilled content |
| `sdk.actions.addFrame()` | Prompt user to add app to favorites |

### Wallet

```typescript
const provider = sdk.wallet.ethProvider;
// EIP-1193 compatible provider
// Use with viem custom() transport or wagmi connector
```

## Wagmi Connector

```bash
npm install @farcaster/frame-wagmi-connector
```

```typescript
import { farcasterFrame } from "@farcaster/frame-wagmi-connector";

const config = createConfig({
  chains: [base],
  transports: { [base.id]: http() },
  connectors: [farcasterFrame()],
});
```

## Reference

- [Frames v2 Spec](https://docs.farcaster.xyz/developers/frames/v2/spec)
- [Frame SDK (npm)](https://www.npmjs.com/package/@farcaster/frame-sdk)
- [Frames Debugger](https://debugger.framesjs.org)
