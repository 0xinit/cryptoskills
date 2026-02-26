# Safe Transaction Service URLs

The Safe Transaction Service is a REST API that stores pending (off-chain) transactions, collects owner signatures, and provides transaction history. Each network runs an independent service instance.

## Endpoints

| Network | Chain ID | URL |
|---------|----------|-----|
| Ethereum Mainnet | 1 | `https://safe-transaction-mainnet.safe.global` |
| Sepolia | 11155111 | `https://safe-transaction-sepolia.safe.global` |
| Arbitrum One | 42161 | `https://safe-transaction-arbitrum.safe.global` |
| Base | 8453 | `https://safe-transaction-base.safe.global` |
| Optimism | 10 | `https://safe-transaction-optimism.safe.global` |
| Polygon | 137 | `https://safe-transaction-polygon.safe.global` |
| Gnosis Chain | 100 | `https://safe-transaction-gnosis-chain.safe.global` |
| Avalanche | 43114 | `https://safe-transaction-avalanche.safe.global` |
| BNB Chain | 56 | `https://safe-transaction-bsc.safe.global` |

## API Documentation

Each service hosts Swagger docs at the root URL:

- `https://safe-transaction-mainnet.safe.global/` (interactive API docs)
- Full OpenAPI spec: `https://safe-transaction-mainnet.safe.global/?format=openapi`

## Common API Paths

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/safes/{address}/` | GET | Safe info (owners, threshold, nonce) |
| `/api/v1/safes/{address}/multisig-transactions/` | GET | Transaction history |
| `/api/v1/multisig-transactions/{safeTxHash}/` | GET | Single transaction by hash |
| `/api/v1/multisig-transactions/{safeTxHash}/confirmations/` | POST | Add confirmation signature |
| `/api/v1/safes/{address}/multisig-transactions/` | POST | Propose a new transaction |
| `/api/v1/owners/{address}/safes/` | GET | List Safes owned by address |

## Rate Limiting

- **No API key required** -- the Transaction Service is public
- **Rate limits vary by endpoint** -- generally 100 requests/minute per IP for read endpoints
- **Write endpoints** (propose, confirm) have stricter limits -- roughly 10-20 requests/minute
- **Responses include rate limit headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Using API Kit (Recommended)

Since API Kit v2, you do not need to know the service URL. Pass `chainId` and the SDK resolves it:

```typescript
import SafeApiKit from "@safe-global/api-kit";

const apiKit = new SafeApiKit({
  chainId: 1n, // resolves to mainnet URL automatically
});
```

## Self-Hosted Transaction Service

For private deployments or unsupported chains, you can self-host:

- Source: https://github.com/safe-global/safe-transaction-service
- Pass `txServiceUrl` to override automatic resolution:

```typescript
const apiKit = new SafeApiKit({
  chainId: 1n,
  txServiceUrl: "https://your-custom-service.example.com",
});
```
