# Pyth EVM Error Codes

> **Last verified:** March 2026

## Contract Errors

| Error | Selector | Cause | Fix |
|-------|----------|-------|-----|
| `StalePrice` | `0x19abf40e` | Price data is older than the configured staleness threshold | Call `updatePriceFeeds` before reading, or increase `maxAge` in `getPriceNoOlderThan` |
| `InsufficientFee` | `0x025dbdd4` | `msg.value` is less than the required update fee | Call `getUpdateFee(updateData)` and pass the result as `msg.value` |
| `NoFreshUpdate` | `0x2e7e2a39` | `updatePriceFeeds` called but no update in `updateData` is newer than current on-chain data | Fetch fresh data from Hermes -- the submitted data is already stale |
| `PriceFeedNotFound` | `0x14aebe68` | The requested `bytes32` feed ID does not exist in the Pyth contract | Verify the feed ID at https://pyth.network/developers/price-feed-ids |
| `InvalidUpdateData` | `0xe69ffece` | The `updateData` bytes are malformed or from a different Pyth version | Ensure you are passing raw Hermes binary data with `0x` prefix |
| `InvalidArgument` | `0xa9cb9e0d` | Function called with invalid parameters (e.g., empty arrays) | Check that `priceIds` and `updateData` arrays are non-empty |
| `InvalidUpdateDataSource` | `0x77fcb9cf` | Update data was signed by an unrecognized Wormhole guardian set | Use data from the official Hermes endpoint, not a third-party source |

## Common Revert Patterns

| Symptom | Likely Cause | Solution |
|---------|-------------|----------|
| Revert with no data on `updatePriceFeeds` | Wrong Pyth contract address for this chain | Verify address per chain (see resources/contract-addresses.md) |
| `getPriceUnsafe` returns `publishTime = 0` | Feed has never been updated on this chain | Submit an initial `updatePriceFeeds` call first |
| `parsePriceFeedUpdates` reverts | `minPublishTime` / `maxPublishTime` window does not contain any update in the data | Widen the time window or fetch data for the correct timestamp from Hermes |
| Transaction runs out of gas | Multiple feed updates in a single call | Budget ~120K gas per feed for `updatePriceFeeds` |
| `msg.value` refund fails | Calling contract does not accept ETH | Implement `receive()` on the calling contract or remove refund logic |

## Hermes API Errors

| HTTP Status | Meaning | Fix |
|-------------|---------|-----|
| 400 | Invalid feed ID format or missing required parameter | Feed IDs must be 64-character hex (without `0x` prefix in query params) |
| 404 | Feed ID not found | Verify feed ID exists at https://pyth.network/developers/price-feed-ids |
| 429 | Rate limit exceeded | Reduce request frequency or run your own Hermes instance |
| 500 | Hermes server error | Retry with exponential backoff; try a different Hermes endpoint |

## Reference

- [Pyth SDK Error Definitions](https://github.com/pyth-network/pyth-crosschain/blob/main/target_chains/ethereum/sdk/solidity/PythErrors.sol)
- [Pyth Best Practices](https://docs.pyth.network/price-feeds/best-practices)
