# Tenderly API v2 Reference

> **Last verified:** February 2026

Base URL: `https://api.tenderly.co/api/v2/`

Authentication: `X-Access-Key: <your-access-key>` header on every request.

All project-scoped endpoints use the path: `/api/v2/project/{accountSlug}/{projectSlug}/...`

## Simulation Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/project/{account}/{project}/simulate` | Simulate a single transaction |
| POST | `/project/{account}/{project}/simulate-bundle` | Simulate a bundle of sequential transactions |
| GET | `/project/{account}/{project}/simulations` | List saved simulations |
| GET | `/project/{account}/{project}/simulations/{simulationId}` | Get simulation details |
| DELETE | `/project/{account}/{project}/simulations/{simulationId}` | Delete a saved simulation |

### Simulation Request Body

```typescript
{
  network_id: string;          // "1", "137", "42161", etc.
  from: string;                // Sender address (required)
  to: string;                  // Target contract or recipient
  input: string;               // Calldata (hex-encoded, "0x" prefix)
  value: string;               // Wei value ("0" for no ETH)
  gas: number;                 // Gas limit
  gas_price: string;           // Gas price in wei ("0" valid for testing)
  save: boolean;               // Persist to dashboard
  save_if_fails: boolean;      // Persist only if simulation fails
  simulation_type: "quick" | "full" | "abi";
  state_objects?: {            // Optional state overrides
    [address: string]: {
      balance?: string;        // Hex-encoded wei
      storage?: {
        [slot: string]: string;
      };
    };
  };
  block_number?: number;       // Pin to specific block (latest if omitted)
}
```

## Virtual TestNet Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/project/{account}/{project}/vnets` | Create a Virtual TestNet |
| GET | `/project/{account}/{project}/vnets` | List Virtual TestNets |
| GET | `/project/{account}/{project}/vnets/{vnetId}` | Get VNet details |
| DELETE | `/project/{account}/{project}/vnets/{vnetId}` | Delete a VNet |

### VNet Custom RPC Methods

These methods are available on the VNet RPC URL (not on the REST API).

| Method | Params | Description |
|--------|--------|-------------|
| `tenderly_setBalance` | `[addresses[], amountHex]` | Set ETH balance for addresses |
| `tenderly_addBalance` | `[addresses[], amountHex]` | Add ETH to existing balance |
| `tenderly_setErc20Balance` | `[tokenAddr, walletAddr, amountHex]` | Set ERC-20 balance |
| `tenderly_setStorageAt` | `[contractAddr, slot, value]` | Set storage slot value |
| `evm_snapshot` | `[]` | Create state snapshot |
| `evm_revert` | `[snapshotId]` | Revert to snapshot |
| `evm_increaseTime` | `[secondsHex]` | Advance block timestamp |
| `evm_increaseBlocks` | `[countHex]` | Mine N blocks |

## Alert Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/project/{account}/{project}/alerts` | Create an alert |
| GET | `/project/{account}/{project}/alerts` | List all alerts |
| GET | `/project/{account}/{project}/alerts/{alertId}` | Get alert details |
| PUT | `/project/{account}/{project}/alerts/{alertId}` | Update an alert |
| DELETE | `/project/{account}/{project}/alerts/{alertId}` | Delete an alert |

### Alert Types

| Type String | Description |
|-------------|-------------|
| `successful_tx` | Transaction succeeds |
| `failed_tx` | Transaction reverts |
| `function_call` | Specific function called |
| `event_emitted` | Specific event emitted |
| `state_change` | Storage slot changes |
| `balance_change` | ETH balance crosses threshold |
| `whitelisted_caller` | Tx from allowed address |
| `blacklisted_caller` | Tx from disallowed address |

## Contract Verification Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/project/{account}/{project}/contracts/verify` | Verify contract source |
| GET | `/project/{account}/{project}/contracts` | List verified contracts |
| GET | `/project/{account}/{project}/contracts/{address}` | Get contract details |

## Transaction Trace Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/project/{account}/{project}/network/{networkId}/transaction/{txHash}` | Get transaction details |
| GET | `/project/{account}/{project}/network/{networkId}/transaction/{txHash}/trace` | Get debug trace |

## Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | Deleted (no content) |
| 400 | Bad request (check request body) |
| 401 | Unauthorized (invalid or missing X-Access-Key) |
| 403 | Forbidden (insufficient plan or permissions) |
| 404 | Not found (check account/project slugs) |
| 409 | Conflict (resource already exists) |
| 429 | Rate limited (check Retry-After header) |
| 500 | Internal server error (retry with backoff) |

## Pagination

List endpoints support pagination via query parameters:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `perPage` | number | 20 | Items per page (max 100) |

Example: `GET /project/{account}/{project}/simulations?page=2&perPage=50`
