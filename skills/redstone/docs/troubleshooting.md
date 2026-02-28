# RedStone Troubleshooting Guide

Common issues and solutions across RedStone Pull, Push, and RedStone X models.

## "CalldataMustHaveValidPayload" Revert

**Symptoms:**
- Transaction reverts immediately when calling a function that reads RedStone data
- Error appears in both local testing and on-chain

**Solutions:**

1. **Frontend is not wrapping the transaction** -- every call to `getOracleNumericValueFromTxMsg` requires RedStone price data in the transaction calldata. Wrap with `WrapperBuilder`:
   ```typescript
   const wrappedContract = WrapperBuilder.wrap(contract).usingDataService({
     dataServiceId: "redstone-primary-prod",
     uniqueSignersCount: 3,
     dataPackagesIds: ["ETH", "BTC"],
   });
   // Use wrappedContract instead of contract for all calls
   const tx = await wrappedContract.updatePrices();
   ```

2. **Using viem/ethers directly without wrapping** -- RedStone EVM Connector only works with ethers.js contract instances. You cannot use viem's `writeContract` directly. Create an ethers.js contract, wrap it, then use the wrapped instance.

3. **Calling from another contract** -- if Contract A calls Contract B which inherits `RedstoneConsumerBase`, the calldata must be propagated. The calling contract must pass the full calldata through. Consider having the user call Contract B directly with wrapped calldata.

4. **Testing in Foundry without mock** -- in unit tests, there is no frontend to wrap calldata. Create a test harness that overrides `getOracleNumericValueFromTxMsg`:
   ```solidity
   contract TestHarness is YourContract {
       uint256 private _mockPrice;
       function setMockPrice(uint256 p) external { _mockPrice = p; }
       function getOracleNumericValueFromTxMsg(bytes32)
           internal view override returns (uint256) { return _mockPrice; }
   }
   ```

## "InsufficientNumberOfUniqueSigners" Revert

**Symptoms:**
- Transaction reverts even though price data is attached to calldata
- Works with `uniqueSignersCount: 1` but fails with higher values

**Solutions:**

1. **SDK signer count too low** -- `uniqueSignersCount` in the SDK config must be >= `getUniqueSignersThreshold()` in the contract. If your contract requires 3, the SDK must request at least 3.

2. **Data service has fewer active signers than requested** -- check if your chosen data service has enough active nodes. `redstone-primary-prod` has 5 signers. Custom services may have fewer.

3. **Network issue caused some signers to be unreachable** -- the SDK fetches from multiple gateways. If some gateways were down during the fetch, you may get fewer signatures. Retry the transaction.

## "TimestampIsNotValid" Revert

**Symptoms:**
- Transaction reverts with timestamp validation error
- Works locally but fails on-chain
- Works intermittently

**Solutions:**

1. **Transaction took too long to be mined** -- by the time the transaction is included in a block, the price data may be older than `isTimestampValid` allows. Solutions:
   - Increase the gas price for faster inclusion
   - Override `isTimestampValid()` with a wider window
   - Use `redstone-rapid-prod` data service for lower latency

2. **Chain has slow block times** -- on chains with long block intervals, the default 3-minute window may be tight. Override `isTimestampValid`:
   ```solidity
   function isTimestampValid(uint256 receivedTimestampMilliseconds)
       public view override returns (bool) {
       uint256 receivedSeconds = receivedTimestampMilliseconds / 1000;
       // Allow 10 minutes for slow chains
       return block.timestamp <= receivedSeconds + 600
           && receivedSeconds <= block.timestamp + 60;
   }
   ```

3. **Node clock is out of sync** -- data provider timestamps depend on accurate clocks. If your RPC node has clock drift, `block.timestamp` may not match expectations. This is uncommon on major chains but possible on private or development networks.

## Push Feed Returns Stale Data

**Symptoms:**
- `latestRoundData()` returns a price but `updatedAt` is far in the past
- Staleness check reverts

**Solutions:**

1. **Heartbeat mismatch** -- RedStone push feed heartbeats vary by chain. Ethereum mainnet ETH/USD: 3600s. Arbitrum: 86400s. If your staleness threshold is tighter than the heartbeat, you get false positives. Align your threshold with the feed's actual heartbeat.

2. **Feed is deprecated or migrated** -- check the [RedStone Price Feeds page](https://docs.redstone.finance/docs/smart-contract-devs/price-feeds) for current addresses. Deprecated feeds stop updating.

3. **Verify the feed on-chain:**
   ```bash
   cast call <FEED_ADDRESS> "description()(string)" --rpc-url $RPC_URL
   cast call <FEED_ADDRESS> "latestRoundData()(uint80,int256,uint256,uint256,uint80)" --rpc-url $RPC_URL
   ```

## Pull Model Works Locally but Fails On-Chain

**Symptoms:**
- Foundry tests pass (using mock harness)
- Transaction reverts when deployed on a live network

**Solutions:**

1. **Forgot to wrap on frontend** -- tests use a mock, but the live deployment needs actual RedStone calldata from the SDK.

2. **Wrong data service ID** -- the contract's `getAuthorisedSignerIndex` only accepts signers from a specific data service. If the SDK is configured with a different `dataServiceId`, the signers will not match. For standard feeds, use `redstone-primary-prod` with the default `RedstoneConsumerNumericBase` (which already whitelists the primary service signers).

3. **Feed ID encoding mismatch** -- `bytes32("ETH")` in Solidity produces left-aligned bytes. Ensure the SDK's `dataPackagesIds` uses the same string: `["ETH"]`, not `["eth"]` or `["ETH/USD"]`.

## Gas Estimation Fails on Pull Model

**Symptoms:**
- `eth_estimateGas` reverts when calling a RedStone pull function
- Cannot get gas estimate for wrapped transactions

**Solutions:**

1. **Gas estimation runs without calldata wrapping** -- some wallets/libraries estimate gas by simulating the transaction. If the simulation does not include RedStone calldata, it reverts. The `@redstone-finance/evm-connector` SDK handles gas estimation by including the data in the estimation call. Ensure you are using the wrapped contract for gas estimation, not the raw contract.

2. **Manual gas limit** -- as a workaround, set a manual gas limit:
   ```typescript
   const tx = await wrappedContract.updatePrices({ gasLimit: 500_000n });
   ```

## RedStone X Intent Not Executing

**Symptoms:**
- Intent submitted successfully but keeper never executes it
- `executeIntent` reverts

**Solutions:**

1. **Execution delay not met** -- the keeper must wait at least `MIN_EXECUTION_DELAY_BLOCKS` after intent submission. Check that `block.number > intent.submittedBlock + MIN_EXECUTION_DELAY`.

2. **Intent expired** -- if your contract has an expiry mechanism and the keeper was too slow, the intent cannot be executed.

3. **Price does not meet intent conditions** -- if the intent includes a minimum price and the current price is below it, execution reverts with `PriceBelowMinimum`. The keeper should catch this and retry on the next block.

4. **Keeper not wrapping with RedStone data** -- the keeper must use `WrapperBuilder` for the execution call, just like any other RedStone pull transaction.

## Debug Checklist

- [ ] Transaction is wrapped with `WrapperBuilder.wrap(contract).usingDataService({...})`
- [ ] `dataServiceId` matches the signers authorized in the contract
- [ ] `uniqueSignersCount` >= `getUniqueSignersThreshold()`
- [ ] `dataPackagesIds` includes all feed IDs the contract will read in this call
- [ ] `bytes32` feed ID encoding matches between Solidity and SDK
- [ ] `isTimestampValid` window is appropriate for the chain's block time
- [ ] Push feed staleness threshold matches the feed's heartbeat
- [ ] Foundry tests use a harness that overrides oracle reads
- [ ] `@redstone-finance/evm-connector` version is consistent between frontend and contract
- [ ] Gas estimation uses the wrapped contract, not the raw contract
