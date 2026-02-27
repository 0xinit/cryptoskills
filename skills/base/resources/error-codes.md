# Base Error Codes

## OP Stack Errors

These errors apply to all OP Stack chains including Base.

| Error | Cause | Fix |
|-------|-------|-----|
| `execution reverted` | Contract revert with no reason string | Check revert data — use `cast run <txHash>` to decode |
| `gas required exceeds allowance` | Insufficient gas limit or funds | Increase gas limit or check wallet balance |
| `nonce too low` | Stale nonce (tx already mined) | Refresh nonce from `eth_getTransactionCount` with `pending` tag |
| `nonce too high` | Gap in nonce sequence | Wait for pending txs to confirm or reset nonce |
| `max fee per gas less than block base fee` | Gas price below minimum | Use `eth_gasPrice` or `eth_maxPriorityFeePerGas` for current values |
| `intrinsic gas too low` | Gas limit below 21000 for basic transfer | Set gas limit >= 21000 |
| `insufficient funds for gas * price + value` | Wallet ETH balance too low | Fund wallet with ETH for gas |
| `transaction type not supported` | Using legacy tx type on post-Bedrock | Use EIP-1559 (type 2) transactions |

## ERC-4337 Paymaster Errors

These occur when using the Coinbase Paymaster or any ERC-4337 paymaster.

| Error Code | Name | Cause | Fix |
|------------|------|-------|-----|
| AA10 | SenderAlreadyConstructed | Trying to deploy account that already exists | Remove `initCode` from UserOp |
| AA13 | InitCodeFailedOrOOG | Account factory deploy failed | Check initCode and factory address |
| AA21 | DidNotPay | Account didn't pay prefund | Ensure account has ETH or paymaster is set |
| AA25 | InvalidAccountNonce | UserOp nonce mismatch | Fetch fresh nonce from EntryPoint |
| AA31 | PaymasterDeposit | Paymaster deposit on EntryPoint too low | Paymaster operator must top up deposit |
| AA32 | PaymasterValidation | `validatePaymasterUserOp` reverted | Transaction not covered by paymaster policy — check contract/method allowlist |
| AA33 | PaymasterPostOp | `postOp` reverted after execution | Paymaster internal error — contact provider |
| AA34 | PaymasterExpired | Paymaster signature or validity expired | Retry — get fresh paymaster data |
| AA40 | VerificationOOG | Verification gas too low | Increase `verificationGasLimit` |
| AA41 | CallOOG | Execution gas too low | Increase `callGasLimit` |
| AA51 | PrefundNotPaid | Account or paymaster didn't pay bundler | Check account balance or paymaster deposit |

## Coinbase Developer Platform Paymaster Errors

CDP-specific error responses.

| Error | Meaning | Fix |
|-------|---------|-----|
| `POLICY_VIOLATION` | UserOp violates paymaster policy rules | Check allowlisted contracts, methods, and user limits in CDP dashboard |
| `INSUFFICIENT_BUDGET` | Sponsorship budget exhausted | Increase monthly budget in CDP dashboard |
| `RATE_LIMITED` | Too many sponsored txs from this user | Wait or increase per-user rate limit |
| `UNSUPPORTED_CHAIN` | Chain ID not supported by this paymaster | Ensure you are using the correct paymaster URL for the chain |
| `INVALID_API_KEY` | CDP API key is invalid or revoked | Check API key in CDP dashboard |

## Smart Wallet Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Passkey creation failed | User cancelled WebAuthn prompt or device does not support passkeys | Show fallback auth option; check `PublicKeyCredential` support |
| `InvalidSignature` | Passkey signature does not match wallet owner | User may be using wrong passkey; try reconnecting wallet |
| `NotOwner` | Transaction signer is not a wallet owner | Check wallet ownership — owner may have been rotated |
| Wallet not deployed | First tx failed before counterfactual deployment | Retry — the wallet deploys on first successful tx |

## OnchainKit Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Missing OnchainKitProvider` | Component used outside provider | Wrap app in `<OnchainKitProvider>` |
| `Invalid API key` | CDP API key missing or invalid | Set `NEXT_PUBLIC_CDP_API_KEY` environment variable |
| `Chain mismatch` | Wallet on different chain than OnchainKit config | Ensure wallet chain matches `chain` prop on provider |
| Identity resolution failed | Address has no ENS, Basename, or Farcaster profile | Handle with `defaultComponent` prop on Avatar/Name |
| Swap quote failed | Token pair not supported or liquidity too low | Check token addresses and available liquidity |

## Basescan Verification Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Unable to verify` | Compiler settings mismatch | Match exact solc version, optimizer runs, and EVM version |
| `Constructor arguments mismatch` | Incorrect ABI-encoded constructor args | Use `cast abi-encode` with exact types and values |
| `Already verified` | Contract already verified at this address | No action needed |
| `Contract not found` | Address has no deployed code | Check deployment tx succeeded and address is correct |
