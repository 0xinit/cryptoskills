# x402 Troubleshooting

Common issues and fixes when integrating with the x402 payment protocol.

Last verified: February 2026

## Payment Not Recognized — Still Getting 402

### Symptom

Client sends the `X-PAYMENT` header but the server still responds with HTTP 402.

### Root Cause

1. Header name is wrong. The header must be `X-PAYMENT`, not `X-Payment`, `Payment-Signature`, or `Authorization`.
2. Payload is not base64-encoded. The header value must be `btoa(JSON.stringify(payload))`.
3. Network mismatch. The client signed for `eip155:1` but the server only accepts `eip155:8453`.

### Fix

Decode your `X-PAYMENT` header and verify:

```bash
echo "<header_value>" | base64 -d | jq .
```

Check that `accepted.network` matches what the server returned in its 402 response.

## Nonce Already Used — "authorization is used or canceled"

### Symptom

Facilitator settlement fails with `authorization is used or canceled`.

### Root Cause

The `(from, nonce)` pair was already settled or canceled on-chain. This happens when:
1. The same nonce was reused across two payment attempts
2. A previous payment with this nonce was settled while the client retried

### Fix

Generate a fresh random nonce for every payment attempt. Never reuse nonces.

```typescript
const nonce = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`;
```

Verify nonce state on-chain:

```typescript
const used = await publicClient.readContract({
  address: usdcAddress,
  abi: [{ name: "authorizationState", type: "function", stateMutability: "view",
    inputs: [{ name: "authorizer", type: "address" }, { name: "nonce", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }] }] as const,
  functionName: "authorizationState",
  args: [signerAddress, nonce],
});
```

## Wrong Chain — Signature Recovery Mismatch

### Symptom

Facilitator returns `Invalid signature` even though the client signed correctly.

### Root Cause

The EIP-712 domain `chainId` used for signing does not match the chain where settlement occurs. Signing with `chainId: 1` (Ethereum) but settling on Base (8453) produces a valid signature that recovers to a different address.

### Fix

Parse the `network` field from the 402 response and extract the chain ID:

```typescript
const chainId = parseInt(accepted.network.split(":")[1]);
```

Use this chain ID in the EIP-712 domain. Also verify `name` and `version` from `accepted.extra`.

## Facilitator Timeout — Settlement Never Completes

### Symptom

Verification passes but settlement hangs or times out.

### Root Cause

1. Network congestion causing delayed block inclusion
2. Facilitator gas price too low for current conditions
3. `validBefore` window too short — authorization expires before the transaction lands

### Fix

For CDP's hosted facilitator, this is rare on Base (sub-second blocks). If using a custom facilitator:

1. Set `maxTimeoutSeconds` to at least 60
2. Use dynamic gas pricing in your facilitator's wallet client
3. Monitor pending transactions and bump gas if needed

## USDC Balance Check Passes But Settlement Reverts

### Symptom

Verification succeeds (balance was sufficient) but settlement reverts with `transfer amount exceeds balance`.

### Root Cause

The signer's USDC balance decreased between verification and settlement. This happens when:
1. Multiple concurrent payment authorizations drain the wallet
2. Another transfer moved USDC out of the wallet between verify and settle

### Fix

Maintain a buffer above the exact payment amount. For agent wallets making frequent payments, track outstanding (verified but unsettled) authorizations locally.

## Permit2 Allowance Required — HTTP 412

### Symptom

```json
{"error": "PERMIT2_ALLOWANCE_REQUIRED", "status": 412}
```

### Root Cause

The server requires Permit2-based payment (for non-USDC tokens or as a fallback), but the client has not approved the Permit2 contract.

### Fix

Approve Permit2 from the client wallet (requires native gas for this one-time transaction):

```typescript
const hash = await walletClient.writeContract({
  address: tokenAddress,
  abi: [{ name: "approve", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }] }] as const,
  functionName: "approve",
  args: ["0x000000000022D473030F116dDEE9F6B43aC78BA3", 2n ** 256n - 1n],
});
```

To avoid this entirely, use USDC with the EIP-3009 path (no approval needed).

## Python Import Errors

### Symptom

```
ModuleNotFoundError: No module named 'x402'
```

### Fix

Install with the correct extras for your use case:

```bash
pip install "x402[evm,requests]"    # EVM + requests
pip install "x402[svm]"             # Solana
pip install "x402[evm,httpx]"       # EVM + httpx (async)
```
