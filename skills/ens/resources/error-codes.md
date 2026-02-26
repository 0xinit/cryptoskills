# ENS Error Codes Reference

Common errors encountered when working with ENS contracts and resolution.

## Registration Errors (ETHRegistrarController)

| Error | Cause | Fix |
|-------|-------|-----|
| `NameNotAvailable` | Name is already registered or in the 90-day grace period | Call `available(name)` before attempting registration |
| `CommitmentTooNew` | Called `register()` less than 60 seconds after `commit()` | Wait at least 60 seconds (minCommitmentAge) between commit and register |
| `CommitmentTooOld` | Commitment is older than 24 hours | Submit a new `commit()` -- commitments expire after maxCommitmentAge (86400s) |
| `DurationTooShort` | Registration duration is under 28 days | Use at least `2419200` seconds (28 days) as the duration parameter |
| `InsufficientValue` | `msg.value` is less than the required `rentPrice()` | Query `rentPrice()` and add a 5-10% buffer to account for ETH/USD price changes during the commit-reveal wait |
| `ResolverRequiredWhenDataSupplied` | Passed `data` array but resolver is zero address | Set the resolver parameter to the Public Resolver address when including record data |
| `UnexpiredCommitmentExists` | A commitment for this name already exists and hasn't expired | Wait for the existing commitment to expire (24h) or use a different secret |

## Resolver Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Unauthorised` | Caller is not the name owner or approved operator | Verify ownership via `registry.owner(namehash)` before writing records |
| Resolver returns zero address | No address record set | Check for null/zero return and handle gracefully |
| `Could not find resolver` | Name has no resolver set in the registry | The name may not be registered, or the owner has not set a resolver |

## Name Wrapper Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Unauthorised` | Caller does not own the wrapped name | Check Name Wrapper ownership via `getData(tokenId)` |
| `NameIsNotWrapped` | Trying to unwrap a name that is not wrapped | Check `isWrapped(node)` before unwrap operations |
| `OperationProhibited` | A burned fuse prevents this operation | Check which fuses are burned via `getData(tokenId)` -- burned fuses are permanent |
| `CannotBurnFuses` | Attempting to burn fuses without CANNOT_UNWRAP set | CANNOT_UNWRAP must be burned before any other fuses can be burned |
| `ParentCannotControl` | Parent has given up control of this subname | The subname has PARENT_CANNOT_CONTROL fuse set -- parent cannot modify it |

## Resolution Errors (Client-Side)

| Error | Cause | Fix |
|-------|-------|-----|
| `getEnsAddress` returns `null` | Name exists but has no ETH address record | Set an address record via the resolver, or handle null in your code |
| `getEnsName` returns `null` | Address has no primary name (reverse record) | Owner must call `reverseRegistrar.setName()` to set a primary name |
| `getEnsAvatar` returns `null` | No avatar text record, or the referenced NFT/URL is inaccessible | Set the `avatar` text record to a valid HTTPS URL, IPFS URI, or NFT reference |
| `normalize()` throws | Name contains invalid characters (zero-width, confusable Unicode) | Use UTS-46 normalization via `normalize()` from `viem/ens` and handle the error |

## CCIP-Read Errors (ERC-3668)

| Error | Cause | Fix |
|-------|-------|-----|
| `OffchainLookup` revert (expected) | Resolver is delegating to an offchain gateway | This is normal for offchain names -- viem handles it automatically |
| Gateway timeout / 5xx | The offchain gateway is down or unreachable | Retry with backoff; the name's data is temporarily unavailable |
| `HttpError` during resolution | CCIP-Read gateway returned an error | Check if the gateway URL is accessible; may be a transient outage |
| Signature verification failed | Gateway returned data with an invalid signature | The gateway may be misconfigured; nothing the client can fix |

## Common Error Patterns in Code

### Registration error handling

```typescript
try {
  const hash = await walletClient.writeContract({
    address: ETH_REGISTRAR_CONTROLLER,
    abi: CONTROLLER_ABI,
    functionName: "register",
    args: [label, owner, duration, secret, resolver, data, reverseRecord, fuses],
    value: totalPrice,
  });
  await client.waitForTransactionReceipt({ hash });
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes("CommitmentTooNew")) {
      console.error("Wait at least 60 seconds after commit");
    } else if (error.message.includes("CommitmentTooOld")) {
      console.error("Commitment expired -- submit a new one");
    } else if (error.message.includes("InsufficientValue")) {
      console.error("Not enough ETH -- increase value buffer");
    } else if (error.message.includes("NameNotAvailable")) {
      console.error("Name is already taken");
    }
  }
  throw error;
}
```

### Resolution error handling

```typescript
async function safeResolve(name: string) {
  try {
    const address = await client.getEnsAddress({ name });
    if (!address) return null;
    return address;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Could not find resolver")) {
        return null;
      }
      if (error.message.includes("OffchainLookup") || error.message.includes("HttpError")) {
        return null;
      }
    }
    throw error;
  }
}
```
