# ENS Troubleshooting Guide

Common issues and solutions when integrating ENS.

## Name Resolution Returns Null

**Symptoms:** `getEnsAddress()` returns `null` even though the name is registered.

**Solutions:**

1. The name has no address record set. Registration alone does not set an address record unless `reverseRecord: true` and a resolver were provided during registration. Set one manually:
   ```typescript
   const hash = await walletClient.writeContract({
     address: PUBLIC_RESOLVER,
     abi: parseAbi(["function setAddr(bytes32 node, address addr) external"]),
     functionName: "setAddr",
     args: [namehash("myname.eth"), account.address],
   });
   ```

2. The name has no resolver set. Check the registry:
   ```typescript
   const resolver = await client.getEnsResolver({ name: "myname.eth" });
   // If this throws "Could not find resolver", set one via the registry
   ```

3. The name is expired. ENS names require annual renewal. Check expiry on the ENS app or via the base registrar's `nameExpires()` function.

4. You are passing an unnormalized name. `"Alice.ETH"` and `"alice.eth"` produce different namehashes. viem normalizes automatically, but verify your input is what you expect.

## Registration Commitment Expired

**Symptoms:** `CommitmentTooOld` error when calling `register()`.

**Solutions:**

The commit-reveal window is 60 seconds to 24 hours. If you wait longer than 24 hours, the commitment expires.

1. Submit a new `commit()` with the same parameters.
2. Wait 60-65 seconds (not longer than 24 hours).
3. Call `register()` promptly.

Keep the `secret` value consistent between `makeCommitment`, `commit`, and `register`. If you regenerate the secret, you must recommit.

## Name Normalization Issues

**Symptoms:** `normalize()` throws an error, or resolution fails for names with special characters.

**Solutions:**

ENS uses UTS-46 normalization via `@adraffy/ens-normalize`. Common failures:

1. **Invisible characters** -- Zero-width joiners, zero-width spaces, and other invisible Unicode characters are rejected.
2. **Confusable characters** -- Certain Unicode characters that look identical to ASCII are blocked (e.g., Cyrillic "а" vs Latin "a").
3. **Emoji sequences** -- Only valid emoji sequences are accepted. Partial or malformed emoji will fail.

```typescript
import { normalize } from "viem/ens";

try {
  const normalized = normalize("myname.eth");
} catch (error) {
  console.error("Invalid ENS name:", error);
}
```

Always validate names before using them in your UI or passing them to resolution functions.

## Reverse Resolution Not Working

**Symptoms:** `getEnsName()` returns `null` for an address that owns an ENS name.

**Solutions:**

Reverse resolution is opt-in. The address owner must explicitly set their primary name.

1. **Set the primary name** via the Reverse Registrar:
   ```typescript
   const REVERSE_REGISTRAR = "0xa58E81fe9b61B5c3fE2AFD33CF304c454AbFc7Cb" as const;

   const hash = await walletClient.writeContract({
     address: REVERSE_REGISTRAR,
     abi: parseAbi(["function setName(string name) external returns (bytes32)"]),
     functionName: "setName",
     args: ["myname.eth"],
   });
   await client.waitForTransactionReceipt({ hash });
   ```

2. **Forward-reverse verification** -- Best practice is to verify that the reverse record points back to the original address:
   ```typescript
   const name = await client.getEnsName({ address: walletAddress });
   if (name) {
     const resolvedAddress = await client.getEnsAddress({ name });
     if (resolvedAddress?.toLowerCase() !== walletAddress.toLowerCase()) {
       // Reverse record does not match forward resolution -- do not trust it
       return null;
     }
   }
   ```

## Avatar Not Loading

**Symptoms:** `getEnsAvatar()` returns `null` or the image does not render.

**Solutions:**

1. **No avatar record set.** Check the text record:
   ```typescript
   const avatarRecord = await client.getEnsText({
     name: "myname.eth",
     key: "avatar",
   });
   console.log("Raw avatar record:", avatarRecord);
   ```

2. **NFT reference format is wrong.** The ENSIP-12 format is:
   ```
   eip155:1/erc721:0x<contract>/<tokenId>
   eip155:1/erc1155:0x<contract>/<tokenId>
   ```
   Common mistakes: wrong chain ID, wrong contract address, token not owned by the name's address.

3. **IPFS gateway is unreachable.** If the avatar is an `ipfs://` URI, the gateway used by viem must be accessible. Some RPC providers include an IPFS gateway; public gateways may be rate-limited.

4. **NFT metadata or image URL is unavailable.** viem resolves NFT references by fetching the token's `tokenURI`, then its `image` field. If either is down, avatar resolution fails.

## Records Not Updating After Transaction

**Symptoms:** You set a record and the transaction confirmed, but reading it back returns the old value.

**Solutions:**

1. **Wait for the transaction to be mined.** Always await `waitForTransactionReceipt()` before reading.

2. **Your RPC node may be behind.** Try a different RPC provider or add a short delay before reading.

3. **The resolver address might be wrong.** Verify you are writing to the same resolver the name is using:
   ```typescript
   const resolver = await client.getEnsResolver({ name: "myname.eth" });
   // Write records to this address, not a hardcoded one
   ```

4. **Client-side cache.** If you are using a frontend library that caches ENS lookups, invalidate the cache after writing.

## CCIP-Read / Offchain Data Errors

**Symptoms:** Resolution fails for offchain names (cb.id, uni.eth) with gateway or HTTP errors.

**Solutions:**

1. **Gateway is temporarily down.** Offchain names depend on an external gateway server. If it is unreachable, resolution fails. Retry with exponential backoff.

2. **viem CCIP-Read is enabled by default.** If you disabled it (`ccipRead: false` on the transport), offchain names will not resolve. Remove the flag.

3. **Network restrictions.** Some environments (corporate networks, restrictive firewalls) may block the gateway URLs. Test from a different network.

4. **Rate limiting on the gateway.** If you are resolving many offchain names rapidly, the gateway may rate-limit you. Add delays between requests.

## Transaction Reverted When Setting Records

**Symptoms:** `setText`, `setAddr`, or `multicall` transactions revert.

**Solutions:**

1. **You are not the name owner or authorized operator.** Only the name owner (or an approved operator) can write records. Verify ownership:
   ```typescript
   const owner = await client.readContract({
     address: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
     abi: parseAbi(["function owner(bytes32 node) view returns (address)"]),
     functionName: "owner",
     args: [namehash("myname.eth")],
   });
   ```

2. **The name is wrapped and fuses prevent the operation.** Check if `CANNOT_SET_RESOLVER` or other restrictive fuses are burned.

3. **Wrong resolver address.** You may be calling a resolver that does not belong to this name. Always query the resolver from the registry first.

## Debug Checklist

- [ ] Name is valid (passes `normalize()`)
- [ ] Name is registered and not expired
- [ ] Resolver is set in the ENS registry
- [ ] Address record is set on the resolver
- [ ] Primary name (reverse record) is set if using `getEnsName()`
- [ ] Transaction confirmed before reading back records
- [ ] Correct resolver address used for writing
- [ ] Caller is the name owner or approved operator
- [ ] Sufficient ETH for registration / renewal (with price buffer)
- [ ] Commit-reveal timing: waited 60s-24h between commit and register
