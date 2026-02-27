# Tenderly Troubleshooting Guide

Common issues and solutions when integrating the Tenderly API v2.

## Simulation Returns 400: "missing_from_address"

**Symptoms:**
- POST to `/simulate` returns HTTP 400
- Error body contains `missing_from_address`

**Solution:**

The `from` field is mandatory on every simulation request. Unlike onchain transactions where `msg.sender` is implicit, Tenderly requires explicit sender specification.

```typescript
const request = {
  network_id: "1",
  from: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // required
  to: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  input: "0x...",
  value: "0",
  gas: 100_000,
  gas_price: "0",
  save: false,
  save_if_fails: false,
  simulation_type: "quick",
};
```

## Simulation Returns 401: "unauthorized"

**Symptoms:**
- Every API request returns 401
- Works in the dashboard but not via REST API

**Solutions:**

1. **Wrong header name.** Use `X-Access-Key`, not `Authorization: Bearer`:
   ```typescript
   // Wrong
   const headers = { "Authorization": `Bearer ${accessKey}` };

   // Correct
   const headers = { "X-Access-Key": accessKey };
   ```

2. **Key has expired or been revoked.** Generate a new key from Dashboard > Settings > Authorization.

3. **Key scope is insufficient.** Some operations require write scope. Check the key's permissions in the dashboard.

## Simulation Returns 404: "project_not_found"

**Symptoms:**
- 404 on any project-scoped endpoint
- Error slug is `project_not_found` or `not_found`

**Solutions:**

1. **Wrong account slug.** The account slug is your username or organization name, NOT your account ID (UUID). Find it in the URL when viewing your project: `dashboard.tenderly.co/{accountSlug}/{projectSlug}`.

2. **Wrong project slug.** The project slug is the URL-friendly name, not the display name. A project named "My DeFi Project" has slug `my-defi-project`.

3. **Trailing slashes.** Some HTTP clients add trailing slashes which cause routing issues:
   ```typescript
   // Wrong
   const url = `https://api.tenderly.co/api/v2/project/${account}/${project}/simulate/`;

   // Correct (no trailing slash)
   const url = `https://api.tenderly.co/api/v2/project/${account}/${project}/simulate`;
   ```

## Simulation Succeeds but Shows Wrong Results

**Symptoms:**
- Simulation returns `status: true` but the expected state changes are wrong
- Gas usage is unexpectedly low or high

**Solutions:**

1. **Stale block.** If you pin to a `block_number`, the state may not reflect recent transactions. Omit `block_number` to use the latest indexed block.

2. **State overrides masking real state.** If `state_objects` overrides a storage slot, the simulation uses the override, not the onchain value. Double-check your override values.

3. **Using `simulation_type: "quick"`.** Quick simulations do not return full traces. Use `"full"` to get complete state diffs and call traces for debugging.

## Virtual TestNet RPC Returns Connection Error

**Symptoms:**
- `fetch()` or ethers/viem RPC calls fail with connection refused or timeout
- The VNet was working earlier

**Solutions:**

1. **VNet expired.** Free-tier VNets expire after a period of inactivity. Create a new one.

2. **VNet was deleted.** Check if the VNet still exists:
   ```typescript
   const response = await fetch(
     `${BASE_URL}/vnets/${vnetId}`,
     { headers }
   );
   // 404 means it was deleted
   ```

3. **Concurrent VNet limit.** Free tier allows only 1 concurrent VNet. Delete old ones before creating new:
   ```typescript
   // List and delete all existing VNets
   const listResponse = await fetch(`${BASE_URL}/vnets`, { headers });
   const vnets = await listResponse.json();
   for (const vnet of vnets) {
     await fetch(`${BASE_URL}/vnets/${vnet.id}`, {
       method: "DELETE",
       headers,
     });
   }
   ```

## tenderly_setErc20Balance Does Not Work

**Symptoms:**
- RPC call succeeds but token balance reads as zero
- Works for some tokens but not others

**Solutions:**

1. **Proxy token contracts.** Some tokens use proxy patterns where the balance mapping is on the implementation contract, not the proxy. `tenderly_setErc20Balance` may not locate the correct storage slot for all proxy patterns.

2. **Non-standard storage layouts.** Tokens that use custom storage layouts (e.g., USDT's non-standard mapping slot) may not be supported. Use `tenderly_setStorageAt` to directly set the correct storage slot:
   ```typescript
   // For standard ERC-20 with balanceOf mapping at slot 0:
   // storage slot = keccak256(abi.encode(address, uint256(0)))
   import { keccak256, encodePacked, pad, toHex } from "viem";

   const slot = keccak256(
     encodePacked(
       ["address", "uint256"],
       [walletAddress, BigInt(0)]
     )
   );

   await fetch(rpcUrl, {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({
       jsonrpc: "2.0",
       method: "tenderly_setStorageAt",
       params: [tokenAddress, slot, pad(toHex(amount), { size: 32 })],
       id: 1,
     }),
   });
   ```

3. **Balance mapping slot is not slot 0.** Different tokens store balances at different slots. USDC uses slot 9. Check the contract's storage layout via the Tenderly debugger or Etherscan's storage viewer.

## Web3 Action Fails with "secret_not_found"

**Symptoms:**
- Action execution fails in logs
- Error: `secret_not_found: KEY_NAME`

**Solution:**

Secrets are set per project. Ensure you set the secret for the correct project:

```bash
# Verify you are in the right project directory
cat tenderly.yaml  # check account_id and project path

# Set the secret
tenderly actions secrets set KEY_NAME "value"

# Verify it was set (value will be masked)
tenderly actions secrets list
```

## Web3 Action Timeout (60s Exceeded)

**Symptoms:**
- Action appears in logs with status "timeout"
- Partial execution visible in logs

**Solutions:**

1. **Reduce RPC calls.** Batch reads with `Promise.all` instead of sequential awaits:
   ```typescript
   // Slow: 3 sequential RPC calls
   const a = await provider.getBalance(addr1);
   const b = await provider.getBalance(addr2);
   const c = await provider.getBalance(addr3);

   // Fast: 3 parallel RPC calls
   const [a, b, c] = await Promise.all([
     provider.getBalance(addr1),
     provider.getBalance(addr2),
     provider.getBalance(addr3),
   ]);
   ```

2. **Use multicall for contract reads.** Bundle multiple `view` function calls into a single RPC request.

3. **Offload heavy processing.** If you need to process more data than fits in 60 seconds, store partial state in `context.storage` and process incrementally across multiple runs.

## Rate Limiting (HTTP 429)

**Symptoms:**
- Requests return 429 after rapid-fire calls
- `Retry-After` header present in response

**Solution:**

Implement exponential backoff:

```typescript
async function fetchWithBackoff<T>(
  url: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const waitMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  throw new Error("Max retries exceeded due to rate limiting");
}
```

## Bundle Simulation Returns Partial Failures

**Symptoms:**
- First N simulations succeed, then remaining fail
- Individual simulations of the same transactions succeed

**Solution:**

Bundle simulations execute sequentially, with each transaction seeing the state changes from previous ones. If transaction N changes state that transaction N+1 depends on in an unexpected way, the bundle will fail partway through. Debug by:

1. Running each simulation individually to verify it works in isolation
2. Checking the state diffs from earlier simulations to understand what state changed
3. Ensuring the order of transactions in the bundle matches your intended execution order
