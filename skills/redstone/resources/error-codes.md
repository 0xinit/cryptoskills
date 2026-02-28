# RedStone Error Codes and Common Failures

## Pull Model Errors (RedstoneConsumerBase)

| Error | Cause | Fix |
|-------|-------|-----|
| `CalldataMustHaveValidPayload` | Transaction calldata does not contain RedStone data packages | Wrap the transaction with `WrapperBuilder.wrap(contract).usingDataService({...})` on the frontend. Every transaction that calls `getOracleNumericValueFromTxMsg` must have price data appended. |
| `InsufficientNumberOfUniqueSigners` | Number of valid signers in the calldata is less than `getUniqueSignersThreshold()` | Ensure `uniqueSignersCount` in the SDK config matches or exceeds the contract's threshold. Verify the data service has enough active signers. |
| `SignerNotAuthorised` | A data package was signed by an address not returned by `getAuthorisedSignerIndex` | For custom data services: verify signer addresses match your contract's whitelist. For standard services: ensure you are using the correct `RedstoneConsumerNumericBase` from the latest `@redstone-finance/evm-connector` package. |
| `EachSignerMustProvideTheSameValue` | Two or more signers provided different values for the same data feed ID | This indicates a data provider inconsistency. Retry with fresh data. If persistent, the data service may have a faulty node. |
| `TimestampsMustBeEqual` | Data packages in the same batch have different timestamps | All packages in a single calldata payload should come from the same fetch. Ensure the SDK is not mixing packages from different time windows. |
| `TimestampIsNotValid` | Data package timestamp is outside the acceptable range relative to `block.timestamp` | Override `isTimestampValid()` if the default 3-minute window is too narrow. Check that your node's clock is synchronized. On slow chains, increase the allowed window. |
| `DataFeedIdNotFound` | The requested `bytes32` data feed ID is not present in the calldata payload | Verify `dataPackagesIds` in the SDK config includes the feed you are requesting. The `bytes32` encoding in the contract must match the string used in the SDK. |
| `InvalidCalldataLength` | The calldata payload is malformed or truncated | Check for SDK version mismatch between `@redstone-finance/evm-connector` on the frontend and the contract's inherited base version. Update both to the same major version. |
| `RedstonePayloadMustHaveAtLeastOneDataPackage` | Calldata payload is present but contains zero data packages | Ensure `dataPackagesIds` is not empty in the SDK config. |

## Push Model Errors (AggregatorV3Interface)

| Error / Symptom | Cause | Fix |
|-----------------|-------|-----|
| `answer <= 0` | Feed returning invalid or negative price | Check `answer > 0` before casting to `uint256`. Revert or use a fallback oracle. |
| `updatedAt == 0` | Round has not completed; data is uninitialized | Reject the round. The feed may be newly deployed or deprecated. |
| `block.timestamp - updatedAt > threshold` | Feed update is older than your staleness threshold | Verify your threshold matches the feed's heartbeat. RedStone push heartbeats vary: Ethereum 3600s, Arbitrum 86400s. |
| `answeredInRound < roundId` | Answer is carried over from a previous round | Reject stale round data. |
| Wrong price magnitude | Using wrong decimal assumption | Always call `feed.decimals()`. RedStone USD pairs use 8 decimals, ETH-denominated pairs use 18. |

## Frontend SDK Errors

| Error Message | Cause | Fix |
|---------------|-------|-----|
| `Cannot find data packages for data service` | Invalid `dataServiceId` in `WrapperBuilder` config | Use a valid service ID: `redstone-primary-prod`, `redstone-arbitrum-prod`, etc. See `contract-addresses.md` for the full list. |
| `Could not fetch data packages from any gateway` | All RedStone gateway nodes are unreachable | Check network connectivity. The SDK retries across multiple gateways. If persistent, the RedStone network may be experiencing an outage. |
| `Data packages timestamp is too old` | Fetched data is stale before it reaches the contract | This happens during high latency. The SDK fetches data, but by the time the transaction is mined, the data is too old. Increase `isTimestampValid` window or use a faster RPC. |
| `Signer address mismatch` | SDK is configured with a different data service than the contract expects | Verify `dataServiceId` in the SDK matches the signers whitelisted in `getAuthorisedSignerIndex`. |

## Debugging Checklist

- [ ] Frontend wraps every price-reading transaction with `WrapperBuilder`
- [ ] `dataPackagesIds` includes ALL feed IDs the contract will read
- [ ] `uniqueSignersCount` in SDK >= `getUniqueSignersThreshold()` in contract
- [ ] `dataServiceId` matches the signers authorized in the contract
- [ ] `@redstone-finance/evm-connector` version is compatible between frontend and contract
- [ ] `bytes32` encoding of feed IDs is consistent (e.g., `bytes32("ETH")` in Solidity, `"ETH"` in SDK)
- [ ] Node clock is synchronized (affects timestamp validation)
- [ ] RPC endpoint is responsive (latency causes stale data by the time tx is mined)
