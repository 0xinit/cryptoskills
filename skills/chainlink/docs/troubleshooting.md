# Chainlink Troubleshooting Guide

Common issues and solutions across Chainlink products.

## Price Feed Returns 0 or Stale Data

**Symptoms:**
- `latestRoundData()` returns `answer = 0`
- `updatedAt` is far in the past
- Price seems frozen

**Solutions:**

1. **Check feed status on data.chain.link** -- the feed may be deprecated or migrated to a new address. Chainlink retires feeds periodically.

2. **Verify the feed address is correct for your chain:**
   ```bash
   cast call <FEED_ADDRESS> "description()(string)" --rpc-url $RPC_URL
   # Should return e.g., "ETH / USD"
   ```

3. **Check heartbeat vs your staleness threshold** -- each feed has a different update frequency. ETH/USD on mainnet updates every 3600s (1% deviation or 1 hour). On Arbitrum, heartbeat is 86400s. If your threshold is tighter than the heartbeat, you will get false stale readings.

4. **L2 sequencer outage** -- on Arbitrum, Base, and Optimism, oracle updates stop when the sequencer is down. Always check the sequencer uptime feed before trusting L2 price data. See SKILL.md for the `L2PriceConsumer` pattern.

5. **Feed returns `answer <= 0`** -- this is valid for some commodity feeds (oil went negative in 2020). For crypto pairs, `answer <= 0` means something is wrong. Revert and use a fallback oracle.

## VRF Request Never Fulfilled

**Symptoms:**
- `requestRandomWords` transaction succeeds but callback never arrives
- `fulfillRandomWords` is never called

**Solutions:**

1. **Check subscription funding:**
   ```bash
   cast call <VRF_COORDINATOR> \
     "getSubscription(uint256)(uint96,uint96,uint64,address,address[])" \
     <SUB_ID> --rpc-url $RPC_URL
   ```
   If `balance` and `nativeBalance` are both 0, fund the subscription.

2. **Verify consumer is registered** -- the calling contract must be added as a consumer on the subscription. Check the `consumers` array in the subscription.

3. **Wrong keyHash** -- each chain has specific gas lanes. Using a keyHash from the wrong chain silently fails. See `resources/vrf-config.md` for valid keyHashes per chain.

4. **Gas price above lane maximum** -- if network gas exceeds your lane's max gas price, fulfillment is delayed until gas drops. Use a higher gas lane for time-sensitive requests.

5. **Callback gas too low** -- if `callbackGasLimit` is insufficient, the fulfillment transaction reverts. The VRF node will not retry. Test your callback gas usage on a fork:
   ```bash
   forge test --gas-report -vvv
   ```

## Automation Upkeep Not Triggering

**Symptoms:**
- `checkUpkeep` returns true locally but Automation nodes never call `performUpkeep`

**Solutions:**

1. **Debug `checkUpkeep` locally:**
   ```bash
   cast call <UPKEEP_CONTRACT> "checkUpkeep(bytes)(bool,bytes)" 0x --rpc-url $RPC_URL
   ```
   If it returns `(false, 0x)`, your condition is not met from the node's perspective.

2. **Check upkeep LINK balance** -- the upkeep must have enough LINK to cover execution costs. Monitor balance and add funds when low.

3. **Verify upkeep is not paused** -- check the Chainlink Automation dashboard for your upkeep status.

4. **Gas spike** -- Automation nodes skip execution if gas price is too high relative to the upkeep's LINK balance. Fund more LINK or wait for gas to drop.

5. **`checkUpkeep` reverts** -- the function must never revert. If it does, Automation treats it as "upkeep not needed." Return `(false, "")` for negative cases.

6. **`performUpkeep` consistently reverts** -- Automation nodes may stop calling if `performUpkeep` reverts repeatedly. Fix the revert cause and the upkeep will resume.

## CCIP Message Stuck in Pending

**Symptoms:**
- `ccipSend` transaction succeeded but message not delivered to destination chain
- Message shows "pending" in CCIP Explorer

**Solutions:**

1. **Check CCIP Explorer:** [ccip.chain.link](https://ccip.chain.link) -- look up your message ID to see its current status and any error details.

2. **Receiver contract reverts** -- if `_ccipReceive` reverts on the destination chain, the message is marked as failed. Fix the receiver logic and use manual execution to retry:
   - Failed messages can be retried via the CCIP Explorer "Manual Execute" feature
   - The message data is preserved; only the execution is retried

3. **Insufficient gas limit in `extraArgs`** -- if the `gasLimit` in `EVMExtraArgsV2` is too low for the receiver's logic, execution fails. Increase the gas limit in the sender.

4. **Sender not allowlisted on receiver** -- the receiver contract should allowlist expected source chain + sender combinations. Check the receiver's allowlist mapping.

5. **Lane congestion** -- CCIP lanes can have temporary delays during high demand. Check [Chainlink Status](https://status.chain.link) for lane health.

## "Insufficient LINK" for VRF/Automation

**Symptoms:**
- VRF: requests silently fail or are never fulfilled
- Automation: upkeep stops executing

**Solutions:**

1. **Fund VRF subscription:**
   ```typescript
   // Via LINK transfer
   const linkContract = getContract({ address: LINK_TOKEN, abi: ERC20_ABI, client: walletClient });
   await linkContract.write.transferAndCall([VRF_COORDINATOR, amount, abi.encode(["uint256"], [subId])]);

   // Via native token
   await walletClient.writeContract({
     address: VRF_COORDINATOR,
     abi: VRF_COORDINATOR_ABI,
     functionName: "fundSubscriptionWithNative",
     args: [subId],
     value: parseEther("0.1"),
   });
   ```

2. **Fund Automation upkeep:**
   ```typescript
   await walletClient.writeContract({
     address: LINK_TOKEN,
     abi: ERC20_ABI,
     functionName: "approve",
     args: [AUTOMATION_REGISTRY, linkAmount],
   });
   await walletClient.writeContract({
     address: AUTOMATION_REGISTRY,
     abi: REGISTRY_ABI,
     functionName: "addFunds",
     args: [upkeepId, linkAmount],
   });
   ```

3. **Set up balance monitoring** -- watch your subscription/upkeep LINK balance and trigger alerts when it drops below a threshold. Chainlink does not auto-top-up.

## Gas Estimation Errors with Feeds

**Symptoms:**
- `eth_estimateGas` fails when calling a function that reads Chainlink feeds
- Transaction reverts during gas estimation

**Solutions:**

1. **Staleness check reverts during estimation** -- gas estimation uses the current block. If the feed is stale at that moment, your staleness check reverts, and gas estimation fails. Handle gracefully:
   ```solidity
   // In view functions called by estimateGas, consider try/catch
   try priceFeed.latestRoundData() returns (uint80, int256 answer, uint256, uint256 updatedAt, uint80) {
       // validate...
   } catch {
       revert OracleCallFailed();
   }
   ```

2. **Feed contract not deployed on fork** -- if testing on a local fork, ensure the fork block includes the feed contract. Use a recent block number for the fork.

## Wrong Decimals in Price Calculation

**Symptoms:**
- Calculated USD values are off by orders of magnitude
- Liquidation thresholds trigger incorrectly

**Solutions:**

1. **Never assume 8 decimals** -- USD pairs return 8, but ETH-denominated pairs return 18. Always check:
   ```solidity
   uint8 feedDecimals = feed.decimals();
   ```

2. **When combining two feeds** (e.g., TOKEN/ETH * ETH/USD), handle decimals explicitly:
   ```solidity
   // TOKEN/ETH returns 18 decimals, ETH/USD returns 8 decimals
   // Result: tokenUsdPrice has (18 + 8) = 26 decimals
   // Normalize to 8: divide by 10^18
   uint256 tokenUsdPrice = (tokenEthPrice * ethUsdPrice) / 1e18;
   ```

3. **Token amount decimals vs feed decimals** -- ERC20 tokens have their own decimals (USDC = 6, WETH = 18). When calculating USD value of a token balance, account for both:
   ```solidity
   // tokenAmount: in token decimals (e.g., 1e6 for 1 USDC)
   // feedAnswer: in feed decimals (e.g., 1e8 for $1.00)
   // Result in 18 decimals:
   uint256 valueWad = (tokenAmount * uint256(feedAnswer) * 1e18) / (10 ** tokenDecimals * 10 ** feedDecimals);
   ```

## Debug Checklist

- [ ] Feed address matches your target chain (mainnet vs L2)
- [ ] Staleness threshold matches the feed's heartbeat
- [ ] L2 sequencer uptime feed checked (Arbitrum, Base, Optimism)
- [ ] VRF subscription funded and consumer registered
- [ ] VRF keyHash matches a valid gas lane for your chain
- [ ] VRF callbackGasLimit covers your fulfillRandomWords logic
- [ ] Automation checkUpkeep returns (false, "") instead of reverting
- [ ] Automation upkeep has sufficient LINK balance
- [ ] CCIP receiver allowlists the correct source chain + sender
- [ ] CCIP extraArgs gasLimit is sufficient for receiver logic
