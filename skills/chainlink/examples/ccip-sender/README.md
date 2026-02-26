# CCIP Cross-Chain Messaging Examples

Chainlink CCIP enables sending arbitrary messages and tokens between supported blockchains.

## Sending a Cross-Chain Message

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CrossChainMessenger {
    IRouterClient public immutable router;
    IERC20 public immutable linkToken;

    event MessageSent(bytes32 indexed messageId, uint64 indexed destChain, address receiver);

    error InsufficientLinkBalance(uint256 required, uint256 available);

    constructor(address _router, address _link) {
        router = IRouterClient(_router);
        linkToken = IERC20(_link);
    }

    /// @notice Send an arbitrary message to another chain
    function sendMessage(
        uint64 destinationChainSelector,
        address receiver,
        bytes calldata data
    ) external returns (bytes32 messageId) {
        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(receiver),
            data: data,
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: Client._argsToBytes(
                Client.EVMExtraArgsV2({
                    gasLimit: 200_000,
                    allowOutOfOrderExecution: true
                })
            ),
            feeToken: address(linkToken)
        });

        uint256 fees = router.getFee(destinationChainSelector, message);

        uint256 linkBalance = linkToken.balanceOf(address(this));
        if (linkBalance < fees) {
            revert InsufficientLinkBalance(fees, linkBalance);
        }

        linkToken.approve(address(router), fees);
        messageId = router.ccipSend(destinationChainSelector, message);
        emit MessageSent(messageId, destinationChainSelector, receiver);
    }
}
```

## Token Transfers Across Chains

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TokenBridge {
    IRouterClient public immutable router;
    IERC20 public immutable linkToken;

    event TokensSent(
        bytes32 indexed messageId,
        uint64 indexed destChain,
        address token,
        uint256 amount
    );

    error InsufficientFee(uint256 required, uint256 available);

    constructor(address _router, address _link) {
        router = IRouterClient(_router);
        linkToken = IERC20(_link);
    }

    /// @notice Transfer ERC20 tokens to another chain
    function sendTokens(
        uint64 destinationChainSelector,
        address receiver,
        address token,
        uint256 amount
    ) external returns (bytes32 messageId) {
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        IERC20(token).approve(address(router), amount);

        Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount({
            token: token,
            amount: amount
        });

        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(receiver),
            data: "",
            tokenAmounts: tokenAmounts,
            extraArgs: Client._argsToBytes(
                Client.EVMExtraArgsV2({
                    gasLimit: 0,
                    allowOutOfOrderExecution: true
                })
            ),
            feeToken: address(linkToken)
        });

        uint256 fees = router.getFee(destinationChainSelector, message);
        uint256 linkBalance = linkToken.balanceOf(address(this));
        if (linkBalance < fees) revert InsufficientFee(fees, linkBalance);

        linkToken.approve(address(router), fees);
        messageId = router.ccipSend(destinationChainSelector, message);

        emit TokensSent(messageId, destinationChainSelector, token, amount);
    }
}
```

## Arbitrary Messaging (Data + Tokens)

Combine data and token transfers in a single cross-chain message. Useful for cross-chain DeFi operations (e.g., "deposit 100 USDC and open a position").

```solidity
function sendDataAndTokens(
    uint64 destinationChainSelector,
    address receiver,
    bytes calldata data,
    address token,
    uint256 amount
) external returns (bytes32 messageId) {
    IERC20(token).transferFrom(msg.sender, address(this), amount);
    IERC20(token).approve(address(router), amount);

    Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
    tokenAmounts[0] = Client.EVMTokenAmount({token: token, amount: amount});

    Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
        receiver: abi.encode(receiver),
        data: data,
        tokenAmounts: tokenAmounts,
        extraArgs: Client._argsToBytes(
            Client.EVMExtraArgsV2({
                // Enough gas for the receiver to process data + tokens
                gasLimit: 300_000,
                allowOutOfOrderExecution: true
            })
        ),
        feeToken: address(linkToken)
    });

    uint256 fees = router.getFee(destinationChainSelector, message);
    linkToken.approve(address(router), fees);
    messageId = router.ccipSend(destinationChainSelector, message);
}
```

## Fee Estimation (TypeScript)

```typescript
import { createPublicClient, http, parseAbi, encodeAbiParameters } from "viem";
import { mainnet } from "viem/chains";

const ROUTER_ABI = parseAbi([
  "function getFee(uint64 destinationChainSelector, tuple(bytes receiver, bytes data, tuple(address token, uint256 amount)[] tokenAmounts, bytes extraArgs, address feeToken) message) external view returns (uint256)",
  "function isChainSupported(uint64 chainSelector) external view returns (bool)",
]);

// Ethereum mainnet CCIP Router
const CCIP_ROUTER = "0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D" as const;
const LINK_TOKEN = "0x514910771AF9Ca656af840dff83E8264EcF986CA" as const;

// Chain selectors
const CHAIN_SELECTORS = {
  ethereum: 5009297550715157269n,
  arbitrum: 4949039107694359620n,
  base: 15971525489660198786n,
  optimism: 3734403246176062136n,
  polygon: 4051577828743386545n,
} as const;

const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

async function estimateFee(
  destinationChainSelector: bigint,
  receiver: `0x${string}`,
  data: `0x${string}`
): Promise<bigint> {
  const encodedReceiver = encodeAbiParameters(
    [{ type: "address" }],
    [receiver]
  );

  // EVMExtraArgsV2 tag (0x181dcf10) + encoded args
  const extraArgs = encodeAbiParameters(
    [{ type: "bytes4" }, { type: "uint256" }, { type: "bool" }],
    ["0x181dcf10", 200_000n, true]
  );

  const fee = await client.readContract({
    address: CCIP_ROUTER,
    abi: ROUTER_ABI,
    functionName: "getFee",
    args: [
      destinationChainSelector,
      {
        receiver: encodedReceiver,
        data,
        tokenAmounts: [],
        extraArgs,
        feeToken: LINK_TOKEN,
      },
    ],
  });

  return fee;
}
```

## CCIPReceiver Implementation

The destination contract must inherit `CCIPReceiver` and implement `_ccipReceive`.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CCIPReceiver} from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

contract CrossChainReceiver is CCIPReceiver {
    address public owner;

    // sourceChainSelector => sender => allowed
    mapping(uint64 => mapping(address => bool)) public allowlistedSenders;

    // Track processed messages to prevent replays
    mapping(bytes32 => bool) public processedMessages;

    event MessageReceived(
        bytes32 indexed messageId,
        uint64 indexed sourceChainSelector,
        address sender,
        bytes data
    );

    error Unauthorized();
    error SenderNotAllowlisted(uint64 chain, address sender);
    error MessageAlreadyProcessed(bytes32 messageId);

    constructor(address _router) CCIPReceiver(_router) {
        owner = msg.sender;
    }

    function allowlistSender(uint64 chainSelector, address sender, bool allowed) external {
        if (msg.sender != owner) revert Unauthorized();
        allowlistedSenders[chainSelector][sender] = allowed;
    }

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        if (processedMessages[message.messageId]) {
            revert MessageAlreadyProcessed(message.messageId);
        }

        address sender = abi.decode(message.sender, (address));
        if (!allowlistedSenders[message.sourceChainSelector][sender]) {
            revert SenderNotAllowlisted(message.sourceChainSelector, sender);
        }

        processedMessages[message.messageId] = true;

        emit MessageReceived(
            message.messageId,
            message.sourceChainSelector,
            sender,
            message.data
        );
    }
}
```

## Chain Selector IDs

| Chain | Selector |
|-------|----------|
| Ethereum Mainnet | `5009297550715157269` |
| Arbitrum One | `4949039107694359620` |
| Base | `15971525489660198786` |
| Optimism | `3734403246176062136` |
| Polygon | `4051577828743386545` |
| Avalanche | `6433500567565415381` |
| BNB Chain | `11344663589394136015` |

Full list: [CCIP Supported Networks](https://docs.chain.link/ccip/supported-networks)
