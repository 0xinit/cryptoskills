# Tenderly Error Codes

> **Last verified:** February 2026

## HTTP Error Responses

All Tenderly API errors return a JSON body with the following structure:

```typescript
{
  error: {
    message: string;  // Human-readable description
    slug: string;     // Machine-readable error identifier
    id: string;       // Unique error instance ID (for support tickets)
  }
}
```

## Common API Errors

| HTTP Code | Slug | Message | Fix |
|-----------|------|---------|-----|
| 400 | `invalid_request` | Request body is malformed or missing required fields | Check JSON structure against the API reference |
| 400 | `invalid_network_id` | Network ID is not supported or is not a string | Pass `network_id` as a string: `"1"`, not `1` |
| 400 | `invalid_simulation_type` | Simulation type must be "quick", "full", or "abi" | Check for typos in `simulation_type` value |
| 400 | `missing_from_address` | The `from` field is required for simulation | Always include `from` in simulation requests |
| 400 | `invalid_state_objects` | State overrides object has invalid format | Ensure `state_objects` is a map keyed by address, not an array |
| 400 | `invalid_block_number` | Block number is not a valid integer or is in the future | Use a mined block number or omit for latest |
| 401 | `unauthorized` | Missing or invalid API key | Check `X-Access-Key` header is set and the key is active |
| 403 | `forbidden` | API key does not have permission for this operation | Verify the key has the required scope (read/write/admin) |
| 403 | `plan_limit_exceeded` | Operation exceeds your plan's limits | Upgrade plan or delete unused resources |
| 404 | `not_found` | Resource does not exist | Verify account slug, project slug, and resource ID |
| 404 | `project_not_found` | Project with the given slug was not found | Check `TENDERLY_ACCOUNT_SLUG` and `TENDERLY_PROJECT_SLUG` env vars |
| 409 | `already_exists` | Resource with this identifier already exists | Use a different slug/name or delete the existing resource |
| 429 | `rate_limited` | Too many requests | Read `Retry-After` header and wait before retrying |
| 500 | `internal_error` | Unexpected server error | Retry with exponential backoff; contact support if persistent |

## Simulation-Specific Errors

| Slug | Cause | Fix |
|------|-------|-----|
| `simulation_failed` | Transaction reverted during simulation | Check the `error_message` field in the response for the revert reason |
| `simulation_timeout` | Simulation exceeded execution time limit | Reduce transaction complexity or gas limit |
| `unsupported_chain` | Network ID is valid but not yet supported for simulation | Check the supported networks list |
| `block_not_indexed` | Requested block has not been indexed by Tenderly | Use a more recent block or wait for indexing |
| `state_override_error` | Invalid storage slot format or address in state_objects | Ensure slots are 32-byte hex strings with `0x` prefix |

## Virtual TestNet Errors

| Slug | Cause | Fix |
|------|-------|-----|
| `vnet_limit_reached` | Maximum concurrent VNets for your plan | Delete unused VNets before creating new ones |
| `vnet_creation_failed` | Internal error during VNet provisioning | Retry after a few seconds; contact support if persistent |
| `vnet_not_found` | VNet ID does not exist or has expired | VNets are ephemeral; create a new one |
| `invalid_chain_config` | Chain configuration is invalid | Verify `chain_id` is a positive integer |
| `fork_block_too_old` | Requested block is too old for forking | Use a more recent block or omit `block_number` for latest |

## Alert Errors

| Slug | Cause | Fix |
|------|-------|-----|
| `alert_limit_reached` | Maximum alerts for your plan | Delete unused alerts before creating new ones |
| `invalid_alert_type` | Alert type string is not recognized | Use one of the supported type strings from the API reference |
| `invalid_webhook_url` | Webhook URL is not a valid HTTPS URL | Ensure the URL uses HTTPS and is publicly reachable |
| `invalid_event_signature` | Event signature format is incorrect | Use canonical form: `EventName(type1,type2)` without parameter names |

## Web3 Action Errors

| Slug | Cause | Fix |
|------|-------|-----|
| `action_timeout` | Execution exceeded 60-second limit | Optimize the action or split into smaller tasks |
| `action_memory_exceeded` | Exceeded 256 MB memory limit | Reduce data processing; avoid loading large datasets |
| `secret_not_found` | Referenced secret does not exist | Set the secret via `tenderly actions secrets set KEY VALUE` |
| `storage_limit_exceeded` | Exceeded 10 MB storage quota | Clean up old storage keys |
| `deployment_failed` | Action deployment failed | Check `tenderly.yaml` syntax and function paths |

## Contract Verification Errors

| Slug | Cause | Fix |
|------|-------|-----|
| `compilation_failed` | Solidity compilation failed | Check compiler version and source code |
| `bytecode_mismatch` | Compiled bytecode does not match deployed bytecode | Verify compiler version, optimization settings, and constructor args |
| `already_verified` | Contract is already verified | No action needed; the contract is available |
| `invalid_compiler_version` | Compiler version string is not recognized | Use format like `v0.8.24+commit.e11b9ed9` |

## Retry Strategy

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Do not retry client errors (4xx) except rate limits
      if (lastError.message.includes("(4") && !lastError.message.includes("(429)")) {
        throw lastError;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```
