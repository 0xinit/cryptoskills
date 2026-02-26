# Automation (Keepers) Examples

Chainlink Automation executes on-chain functions when conditions are met, without manual triggering.

## AutomationCompatibleInterface

Every automated contract implements two functions:
- `checkUpkeep` -- called off-chain by Automation nodes in simulation. Returns whether upkeep is needed and optional `performData` to pass to execution.
- `performUpkeep` -- called on-chain when `checkUpkeep` returns true. Must re-validate the condition since state can change between check and execution.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Automatically distributes token rewards when threshold is met
contract RewardDistributor is AutomationCompatibleInterface {
    IERC20 public immutable rewardToken;
    uint256 public immutable distributionThreshold;
    address[] public recipients;
    uint256 public lastDistribution;

    event RewardsDistributed(uint256 amountPerRecipient, uint256 timestamp);

    error UpkeepNotNeeded();

    constructor(
        address _rewardToken,
        uint256 _threshold,
        address[] memory _recipients
    ) {
        rewardToken = IERC20(_rewardToken);
        distributionThreshold = _threshold;
        recipients = _recipients;
    }

    /// @notice Off-chain check: is the contract balance above threshold?
    function checkUpkeep(bytes calldata)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        uint256 balance = rewardToken.balanceOf(address(this));
        upkeepNeeded = balance >= distributionThreshold;
        performData = abi.encode(balance);
    }

    /// @notice On-chain execution: distribute tokens equally
    function performUpkeep(bytes calldata) external override {
        uint256 balance = rewardToken.balanceOf(address(this));
        if (balance < distributionThreshold) revert UpkeepNotNeeded();

        uint256 share = balance / recipients.length;
        for (uint256 i = 0; i < recipients.length; i++) {
            rewardToken.transfer(recipients[i], share);
        }

        lastDistribution = block.timestamp;
        emit RewardsDistributed(share, block.timestamp);
    }
}
```

## Log Trigger Automation

Reacts to specific on-chain events instead of polling state.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ILogAutomation, Log} from "@chainlink/contracts/src/v0.8/automation/interfaces/ILogAutomation.sol";

/// @notice Executes when a specific deposit event is emitted
contract DepositProcessor is ILogAutomation {
    event DepositProcessed(address indexed depositor, uint256 amount, uint256 timestamp);

    /// @notice Validates the log and extracts perform data
    function checkLog(Log calldata log, bytes memory)
        external
        pure
        returns (bool upkeepNeeded, bytes memory performData)
    {
        // log.topics[0] is the event signature
        // log.topics[1..] are indexed parameters
        // log.data contains non-indexed parameters
        upkeepNeeded = true;
        performData = abi.encode(
            address(uint160(uint256(log.topics[1]))),  // depositor (indexed)
            abi.decode(log.data, (uint256))              // amount (non-indexed)
        );
    }

    function performUpkeep(bytes calldata performData) external {
        (address depositor, uint256 amount) = abi.decode(performData, (address, uint256));
        emit DepositProcessed(depositor, amount, block.timestamp);
    }
}
```

## Trigger Types Comparison

| Trigger | When to Use | checkUpkeep Gas | Latency |
|---------|-------------|-----------------|---------|
| Custom logic | Poll on-chain state (balances, timestamps, conditions) | Simulated off-chain, no gas cost | ~1-2 blocks after condition met |
| Log trigger | React to emitted events | N/A (event-driven) | ~1-2 blocks after log emitted |
| Time-based | Cron-like scheduling (every hour, daily) | N/A (time-driven) | Within the scheduled window |

## Registration via AutomationRegistrar (TypeScript)

```typescript
import { createWalletClient, http, parseAbi, encodeFunctionData } from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const REGISTRAR_ABI = parseAbi([
  "function registerUpkeep(tuple(string name, bytes encryptedEmail, address upkeepContract, uint32 gasLimit, address adminAddress, uint8 triggerType, bytes checkData, bytes triggerConfig, bytes offchainConfig, uint96 amount) requestParams) external returns (uint256)",
]);

const LINK_ABI = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
]);

// Ethereum mainnet
const REGISTRAR = "0x6B0B234fB2f380309D47A7E9391E29E9a179395a" as const;
const LINK_TOKEN = "0x514910771AF9Ca656af840dff83E8264EcF986CA" as const;

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

async function registerUpkeep(
  upkeepContract: `0x${string}`,
  name: string,
  gasLimit: number,
  linkAmount: bigint
) {
  // Approve LINK spend
  await walletClient.writeContract({
    address: LINK_TOKEN,
    abi: LINK_ABI,
    functionName: "approve",
    args: [REGISTRAR, linkAmount],
  });

  // triggerType: 0 = custom logic, 1 = log trigger
  const hash = await walletClient.writeContract({
    address: REGISTRAR,
    abi: REGISTRAR_ABI,
    functionName: "registerUpkeep",
    args: [{
      name,
      encryptedEmail: "0x",
      upkeepContract,
      gasLimit,
      adminAddress: account.address,
      triggerType: 0,
      checkData: "0x",
      triggerConfig: "0x",
      offchainConfig: "0x",
      amount: linkAmount,
    }],
  });

  console.log("Register upkeep tx:", hash);
  return hash;
}
```

## Funding with LINK

Upkeeps must maintain a LINK balance to pay for executions. The cost per execution depends on gas used by `performUpkeep` plus a premium.

```typescript
const REGISTRY_ABI = parseAbi([
  "function addFunds(uint256 id, uint96 amount) external",
]);

// Ethereum mainnet Automation Registry v2.1
const REGISTRY = "0x6593c7De001fC8542bB1703532EE1E5aA0D458fD" as const;

async function fundUpkeep(upkeepId: bigint, linkAmount: bigint) {
  // Approve LINK first
  await walletClient.writeContract({
    address: LINK_TOKEN,
    abi: LINK_ABI,
    functionName: "approve",
    args: [REGISTRY, linkAmount],
  });

  const hash = await walletClient.writeContract({
    address: REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "addFunds",
    args: [upkeepId, linkAmount],
  });

  console.log("Fund upkeep tx:", hash);
  return hash;
}
```

## Best Practices

1. **Always re-validate in `performUpkeep`** -- the `checkUpkeep` result may be stale by the time execution happens on-chain. Another transaction may have changed state.
2. **Keep `checkUpkeep` lightweight** -- it runs off-chain in simulation, but complex logic increases the chance of false positives.
3. **Use `performData` to pass context** -- encode the data you need from `checkUpkeep` into `performData` to avoid redundant on-chain reads in `performUpkeep`.
4. **Monitor LINK balance** -- if upkeep runs out of LINK, it stops executing. Set up alerts when balance drops below a threshold.
5. **Set appropriate gas limits** -- too low and `performUpkeep` reverts. Too high and you pay for unused gas. Profile on a fork first.
