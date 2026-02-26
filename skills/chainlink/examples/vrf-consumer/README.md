# VRF v2.5 Consumer Examples

Chainlink VRF v2.5 integration for provably fair on-chain randomness.

## VRFConsumerBaseV2Plus Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

contract CoinFlip is VRFConsumerBaseV2Plus {
    uint256 public immutable subscriptionId;
    bytes32 public immutable keyHash;

    uint32 private constant CALLBACK_GAS_LIMIT = 200_000;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    struct FlipRequest {
        address player;
        bool chosenHeads;
        bool fulfilled;
        bool won;
    }

    mapping(uint256 => FlipRequest) public requests;

    event FlipRequested(uint256 indexed requestId, address indexed player, bool chosenHeads);
    event FlipResult(uint256 indexed requestId, address indexed player, bool won);

    error AlreadyFulfilled();

    constructor(
        uint256 _subscriptionId,
        address _vrfCoordinator,
        bytes32 _keyHash
    ) VRFConsumerBaseV2Plus(_vrfCoordinator) {
        subscriptionId = _subscriptionId;
        keyHash = _keyHash;
    }

    function flip(bool chooseHeads) external returns (uint256 requestId) {
        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: CALLBACK_GAS_LIMIT,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
                )
            })
        );

        requests[requestId] = FlipRequest({
            player: msg.sender,
            chosenHeads: chooseHeads,
            fulfilled: false,
            won: false
        });

        emit FlipRequested(requestId, msg.sender, chooseHeads);
    }

    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        FlipRequest storage req = requests[requestId];
        if (req.fulfilled) revert AlreadyFulfilled();

        req.fulfilled = true;
        // heads = true if random word is even
        bool isHeads = randomWords[0] % 2 == 0;
        req.won = (isHeads == req.chosenHeads);

        emit FlipResult(requestId, req.player, req.won);
    }
}
```

## requestRandomWords Parameters

| Parameter | Description |
|-----------|-------------|
| `keyHash` | Gas lane identifier. Determines max gas price you pay per request. Higher lane = higher priority but more expensive. |
| `subId` | Your VRF subscription ID. Must be funded with LINK (or native if using native payment). |
| `requestConfirmations` | Block confirmations before fulfillment. Min 3 on mainnet. Higher = more secure against reorgs. |
| `callbackGasLimit` | Max gas for `fulfillRandomWords`. Set based on your callback logic. Test on fork first. |
| `numWords` | Number of random words (1-500). Each additional word costs gas in the callback. |
| `nativePayment` | `false` = pay with LINK, `true` = pay with native ETH. |

## fulfillRandomWords Callback

The VRF Coordinator calls `fulfillRandomWords` once the random proof is verified on-chain. Key rules:

1. **Cannot revert** -- if your callback reverts, the randomness is lost and your subscription is still charged.
2. **Gas limited** -- must complete within `callbackGasLimit`. If it runs out, the fulfillment fails.
3. **Asynchronous** -- typically arrives 1-3 blocks after the request, depending on `requestConfirmations`.
4. **Single delivery** -- each `requestId` is fulfilled exactly once.

```solidity
function fulfillRandomWords(
    uint256 requestId,
    uint256[] calldata randomWords
) internal override {
    // Map requestId back to your application state
    address player = requestToPlayer[requestId];

    // Derive bounded values from raw randomness
    // Range [0, 99]: use modulo
    uint256 roll = randomWords[0] % 100;

    // Range [1, 6] for dice: modulo + offset
    uint256 dice = (randomWords[0] % 6) + 1;

    // Select from array: modulo by array length
    uint256 index = randomWords[0] % items.length;

    // Boolean: check if even/odd
    bool coinFlip = randomWords[0] % 2 == 0;
}
```

## Subscription Management (TypeScript)

```typescript
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const VRF_COORDINATOR_ABI = parseAbi([
  "function createSubscription() external returns (uint256 subId)",
  "function addConsumer(uint256 subId, address consumer) external",
  "function removeConsumer(uint256 subId, address consumer) external",
  "function getSubscription(uint256 subId) external view returns (uint96 balance, uint96 nativeBalance, uint64 reqCount, address subOwner, address[] consumers)",
  "function fundSubscriptionWithNative(uint256 subId) external payable",
  "function cancelSubscription(uint256 subId, address to) external",
]);

// Ethereum mainnet VRF Coordinator v2.5
const VRF_COORDINATOR = "0xD7f86b4b8Cae7D942340FF628F82735b7a20893a" as const;

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

async function createSubscription(): Promise<`0x${string}`> {
  const hash = await walletClient.writeContract({
    address: VRF_COORDINATOR,
    abi: VRF_COORDINATOR_ABI,
    functionName: "createSubscription",
  });
  console.log("Create subscription tx:", hash);
  return hash;
}

async function addConsumer(subId: bigint, consumer: `0x${string}`): Promise<`0x${string}`> {
  const hash = await walletClient.writeContract({
    address: VRF_COORDINATOR,
    abi: VRF_COORDINATOR_ABI,
    functionName: "addConsumer",
    args: [subId, consumer],
  });
  console.log("Add consumer tx:", hash);
  return hash;
}

async function fundWithNative(subId: bigint, amountWei: bigint): Promise<`0x${string}`> {
  const hash = await walletClient.writeContract({
    address: VRF_COORDINATOR,
    abi: VRF_COORDINATOR_ABI,
    functionName: "fundSubscriptionWithNative",
    args: [subId],
    value: amountWei,
  });
  console.log("Fund subscription tx:", hash);
  return hash;
}

async function getSubscriptionDetails(subId: bigint) {
  const result = await publicClient.readContract({
    address: VRF_COORDINATOR,
    abi: VRF_COORDINATOR_ABI,
    functionName: "getSubscription",
    args: [subId],
  });

  const [balance, nativeBalance, reqCount, owner, consumers] = result;
  return { balance, nativeBalance, reqCount, owner, consumers };
}
```

## Direct Funding vs Subscription Model

| Aspect | Subscription | Direct Funding |
|--------|-------------|----------------|
| Payment | Pre-fund a shared subscription with LINK/native | Contract pays per-request from its own balance |
| Setup | Create sub, add consumers, fund once | No subscription needed; fund each consumer contract |
| Multiple contracts | Share one subscription across many consumers | Each contract manages its own balance |
| When to use | Most cases; simpler management for multi-contract setups | One-off contracts, or when you want per-contract billing isolation |

## Gas Lane (keyHash) Selection

Each chain has multiple gas lanes. The keyHash determines the maximum gas price the VRF node will fulfill at. Pick a lane that matches your urgency.

| Chain | Gas Lane | keyHash | Max Gas Price |
|-------|----------|---------|---------------|
| Ethereum | 200 gwei | `0x8077df514608a09f83e4e8d300645594e5d7234665448ba83f51a50f842bd3d9` | 200 gwei |
| Ethereum | 500 gwei | `0xff8dedfbfa60af186cf3c830acbc32c05aae823045ae5ea7da1e45fbfaba4f92` | 500 gwei |
| Ethereum | 1000 gwei | `0x9fe0eebf5e446e3c998ec9bb19951541aee00bb90ea201ae456421a2ded86805` | 1000 gwei |
| Arbitrum | 2 gwei | `0x027f94ff1465b3525f9fc03e9ff7d6d2c0953482246dd6ae07570c45d6631414` | 2 gwei |
| Base | 30 gwei | `0x9e9e46732b32662b9adc6f3abdf6c5e926a666d174a4d6b8e39c4cca76a38897` | 30 gwei |

> **Tip:** If gas spikes above your lane's max, fulfillment is delayed until gas drops. Use a higher lane for time-sensitive requests.
