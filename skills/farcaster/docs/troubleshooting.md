# Farcaster Troubleshooting

Common issues when building on Farcaster with Neynar API, Frames v2, and onchain registry contracts.

## Mini App Manifest Domain Mismatch

**Symptom:** Mini App silently fails to load in Warpcast. No error displayed.

**Cause:** The `accountAssociation.payload` contains a domain that does not match the FQDN where `/.well-known/farcaster.json` is hosted.

**Fix:**

1. Decode the base64url payload: `echo 'eyJkb21haW4iOiJleGFtcGxlLmNvbSJ9' | base64 -d`
2. Verify the `domain` field matches your hosting domain exactly -- no protocol prefix, no trailing slash, no port (unless non-standard)
3. If using a subdomain (e.g., `app.example.com`), the payload must contain `app.example.com`, not `example.com`
4. Regenerate the `accountAssociation` signature if the domain changed

## Webhook Signature Verification Fails

**Symptom:** HMAC comparison returns false even though the webhook secret is correct.

**Cause:** The request body was parsed (e.g., by `express.json()`) before signature verification. JSON parsing and re-serialization changes whitespace, key ordering, or encoding.

**Fix:**

- Use `express.raw({ type: "application/json" })` on the webhook route to get the raw `Buffer`
- Compute HMAC-SHA512 over the raw bytes, not a re-serialized JSON string
- Compare using `crypto.timingSafeEqual` with hex-encoded buffers of equal length

```typescript
// Correct: raw body middleware on the webhook route only
app.use("/webhook", express.raw({ type: "application/json" }));

// Wrong: global JSON parsing middleware will consume the raw body
// app.use(express.json()); // Do NOT use globally if you have webhook routes
```

## Frame Preview Image Not Updating

**Symptom:** Updated image content at the same URL still shows the old image in Warpcast feeds.

**Cause:** Warpcast aggressively caches OG images and frame preview images by URL.

**Fix:**

- Append a cache-busting query parameter: `https://example.com/og.png?v=2`
- Or serve images at versioned URLs: `https://example.com/og-v2.png`
- For dynamic images, include a timestamp: `https://example.com/og?t=${Date.now()}`

## Farcaster Timestamp Off by 50 Years

**Symptom:** Dates from Farcaster messages appear in the 1970s or 2070s.

**Cause:** Farcaster uses a custom epoch (January 1, 2021 00:00:00 UTC), not Unix epoch. Adding the Farcaster timestamp directly to `new Date()` produces wrong results.

**Fix:**

```typescript
const FARCASTER_EPOCH = 1609459200;
const unixSeconds = farcasterTimestamp + FARCASTER_EPOCH;
const date = new Date(unixSeconds * 1000);
```

## Cast Exceeds 1024 Byte Limit

**Symptom:** `publishCast` returns an error for text that appears under 1024 characters.

**Cause:** The limit is 1024 bytes, not characters. UTF-8 multibyte characters (emoji = 4 bytes, CJK = 3 bytes, accented Latin = 2 bytes) consume more than 1 byte each.

**Fix:**

```typescript
const byteLength = Buffer.byteLength(castText, "utf-8");
if (byteLength > 1024) {
  throw new Error(`Cast is ${byteLength} bytes, max is 1024`);
}
```

## Neynar SDK "Unauthorized" on Valid API Key

**Symptom:** 401 response from Neynar API despite a valid API key.

**Cause:** The API key is passed incorrectly. The SDK v3 uses a `Configuration` object, not a constructor argument.

**Fix:**

```typescript
// Correct (SDK v3.x)
import { NeynarAPIClient, Configuration } from "@neynar/nodejs-sdk";
const config = new Configuration({ apiKey: process.env.NEYNAR_API_KEY });
const client = new NeynarAPIClient(config);

// Wrong (old pattern)
// const client = new NeynarAPIClient(process.env.NEYNAR_API_KEY);
```

## App Key (Signer) Not Working

**Symptom:** Messages signed with an Ed25519 key are rejected by Snapchain.

**Cause:** The key was not registered in KeyRegistry on OP Mainnet for the target FID, or it was registered then removed.

**Fix:**

1. Verify the key is active: `cast call 0x00000000Fc1237824fb747aBDE0FF18990E59b7e "keyDataOf(uint256,bytes)(uint8,uint32)" <fid> <pubkey_bytes> --rpc-url https://mainnet.optimism.io`
2. State 1 = ADDED (active), State 2 = REMOVED
3. Re-register via KeyGateway if needed, or use Neynar's managed signer API

## Transaction Frame Wallet Not Connected

**Symptom:** `walletClient.requestAddresses()` returns empty array or throws in a Mini App.

**Cause:** The SDK wallet provider is not available until the Mini App context is fully initialized.

**Fix:**

```typescript
import sdk from "@farcaster/frame-sdk";

const context = await sdk.context;
sdk.actions.ready();

// Only access wallet AFTER ready() is called
const provider = sdk.wallet.ethProvider;
```
