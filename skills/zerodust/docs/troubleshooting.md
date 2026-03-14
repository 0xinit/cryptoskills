# ZeroDust Troubleshooting

## 1. "Quote expired" (QUOTE_EXPIRED)

**Symptoms:** POST /sweep returns `{ "error": "Quote expired", "code": "QUOTE_EXPIRED" }`.

**Cause:** Quotes are valid for 55 seconds. The contract enforces a 60-second deadline window, and the backend uses 55 to provide a safety margin. If signing takes longer than 55 seconds, the quote becomes invalid.

**Solution:**
- Request a new quote with `GET /quote`
- Sign immediately after receiving the quote
- For SDK users, the `agent.sweep()` method handles the full flow automatically

**Debug checklist:**
- [ ] Check system clock is synchronized (NTP)
- [ ] Ensure signing flow completes within 55 seconds
- [ ] Don't cache quotes — always request fresh ones

---

## 2. "Balance too low" (BALANCE_TOO_LOW)

**Symptoms:** `GET /quote` returns `{ "error": "Balance too low...", "code": "BALANCE_TOO_LOW" }`.

**Cause:** Each chain has a minimum sweepable balance that covers gas fees. If the balance is below this threshold, the sweep would result in a negative user receive amount.

**Solution:**
- Check `canSweep` field from `GET /balances/:address` before requesting a quote
- Use `getSweepableBalances()` in the SDK to filter automatically
- Very small dust (< $0.01) may not be sweepable — this is expected

---

## 3. "EIP-7702 not supported" / Chain not in list

**Symptoms:** Chain ID returns 404 from `/chains/:chainId` or is not in the supported chains list.

**Cause:** Not all EVM chains support EIP-7702. 41 chains have been tested and confirmed as incompatible, including zkSync, Avalanche, Blast, Abstract, Lens, and others.

**Solution:**
- Check `GET /chains?testnet=false` for current supported chains
- Only 25 mainnet chains support EIP-7702 sweeps
- If a chain was recently added, ensure the backend has been updated

---

## 4. "Revoke nonce mismatch" (REVOKE_NONCE_MISMATCH)

**Symptoms:** POST /sweep returns `{ "error": "Revoke authorization nonce must be N", "code": "REVOKE_NONCE_MISMATCH" }`.

**Cause:** The revoke authorization must have nonce = delegation nonce + 1. This is because the delegation transaction increments the account nonce, so the revoke transaction (executed after) needs the next nonce.

**Solution:**
```typescript
// Correct: revoke nonce = delegation nonce + 1
const delegationAuth = await walletClient.signAuthorization({
  contractAddress: ZERODUST_CONTRACT,
  chainId: 42161,
});

const revokeAuth = await walletClient.signAuthorization({
  contractAddress: '0x0000000000000000000000000000000000000000',
  chainId: 42161,
  nonce: delegationAuth.nonce + 1,  // Must be +1
});
```

---

## 5. "Invalid signature" (INVALID_SIGNATURE / EIP7702_INVALID_SIGNATURE)

**Symptoms:** POST /sweep returns signature-related error.

**Cause:** Most commonly, the EIP-712 typed data was modified or the `verifyingContract` in the domain is wrong. Under EIP-7702, the `verifyingContract` must be the **user's EOA address**, not the ZeroDust contract address.

**Solution:**
- Use the `typedData` returned by `POST /authorization` exactly as-is
- Do not modify any field in the typed data before signing
- Ensure the wallet is signing with the correct account (matches `userAddress` from the quote)
- For EIP-7702 auth: ensure `contractAddress` matches the ZeroDust contract

**Debug checklist:**
- [ ] `typedData.domain.verifyingContract` === user's EOA address
- [ ] Signing account matches the `userAddress` used in the quote
- [ ] Signature is 65 bytes (130 hex chars + 0x prefix)

---

## 6. "Cross-chain unavailable" (SOURCE_CHAIN_DISABLED / DEST_CHAIN_DISABLED)

**Symptoms:** Cross-chain quote fails with chain disabled error.

**Cause:** Gas.zip may temporarily disable certain source or destination chains. This is outside ZeroDust's control.

**Solution:**
- Fall back to same-chain sweep (`toChainId === fromChainId`)
- Try a different destination chain
- Check Gas.zip status for route availability
- The error message includes the specific chain name

---

## 7. "Rate limited" (429 Too Many Requests)

**Symptoms:** API returns HTTP 429.

**Cause:** Agent API has per-minute (300) and daily (1000) rate limits. Public endpoints also have rate limits.

**Solution:**
- Check remaining quota: `GET /agent/me` returns `rateLimits.dailyRemaining`
- Implement exponential backoff on 429 responses
- For batch operations, use `POST /agent/batch-sweep` instead of individual calls
- Contact team for higher limits if needed for production integration

---

## 8. "Insufficient for fees" (INSUFFICIENT_FOR_FEES)

**Symptoms:** Quote returns `INSUFFICIENT_FOR_FEES` even though balance shows a non-zero amount.

**Cause:** The balance exists but is less than the total fees (gas + service fee + revoke gas). Cross-chain sweeps have higher overhead than same-chain due to bridge gas.

**Solution:**
- Try a same-chain sweep instead (lower fees)
- Wait for gas prices to decrease on the source chain
- Very small balances (< $0.10) may not be sweepable on expensive chains like Ethereum mainnet
