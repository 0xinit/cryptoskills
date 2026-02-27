# Send Cross-Chain Message via Axelar GMP

Working TypeScript and Solidity examples for sending a cross-chain GMP message from Ethereum to Arbitrum using Axelar's Gateway and GasService with viem.

## Solidity Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import {AxelarExecutable} from "@axelar-network/axelar-gmp-sdk-solidity/contracts/executable/AxelarExecutable.sol";
import {IAxelarGateway} from "@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGateway.sol";
import {IAxelarGasService} from "@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGasService.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract CrossChainMessenger is AxelarExecutable, Ownable {
    IAxelarGasService public immutable GAS_SERVICE;

    mapping(string => string) public trustedRemotes;
    mapping(string => bytes) public lastMessage;

    event MessageSent(
        string indexed destinationChainHash,
        string destinationChain,
        string destinationAddress,
        bytes payload
    );
    event MessageReceived(
        string indexed sourceChainHash,
        string sourceChain,
        string sourceAddress,
        bytes payload
    );

    error UntrustedRemote(string sourceChain, string sourceAddress);
    error InsufficientGasPayment();
    error EmptyPayload();

    constructor(
        address gateway_,
        address gasService_,
        address owner_
    ) AxelarExecutable(gateway_) Ownable(owner_) {
        GAS_SERVICE = IAxelarGasService(gasService_);
    }

    /// @notice Send a GMP message to a destination chain
    /// @param destinationChain Axelar chain name (e.g., "arbitrum")
    /// @param destinationAddress Remote contract address as lowercase hex string
    /// @param payload ABI-encoded message data
    function sendMessage(
        string calldata destinationChain,
        string calldata destinationAddress,
        bytes calldata payload
    ) external payable {
        if (payload.length == 0) revert EmptyPayload();
        if (msg.value == 0) revert InsufficientGasPayment();

        GAS_SERVICE.payNativeGasForContractCall{value: msg.value}(
            address(this),
            destinationChain,
            destinationAddress,
            payload,
            msg.sender
        );

        gateway().callContract(destinationChain, destinationAddress, payload);

        emit MessageSent(destinationChain, destinationChain, destinationAddress, payload);
    }

    /// @dev Axelar Gateway calls this after validator consensus
    function _execute(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal override {
        string memory trusted = trustedRemotes[sourceChain];
        if (bytes(trusted).length == 0) {
            revert UntrustedRemote(sourceChain, sourceAddress);
        }
        if (keccak256(bytes(trusted)) != keccak256(bytes(sourceAddress))) {
            revert UntrustedRemote(sourceChain, sourceAddress);
        }

        lastMessage[sourceChain] = payload;

        emit MessageReceived(sourceChain, sourceChain, sourceAddress, payload);
    }

    /// @notice Register trusted remote for a chain
    /// @param chain Axelar chain name
    /// @param addr Lowercase hex address of remote contract
    function setTrustedRemote(
        string calldata chain,
        string calldata addr
    ) external onlyOwner {
        trustedRemotes[chain] = addr;
    }
}
```

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  encodeAbiParameters,
  parseAbiParameters,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { AxelarQueryAPI, Environment } from "@axelar-network/axelarjs-sdk";

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const ethereumClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETHEREUM_RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.ETHEREUM_RPC_URL),
});

const MESSENGER: Address = "0xYourMessengerContract" as Address;
```

## Estimate Gas

Always estimate gas before sending. Axelar's SDK returns the source-chain native token cost.

```typescript
const axelarQuery = new AxelarQueryAPI({
  environment: Environment.MAINNET,
});

async function estimateGas(
  sourceChain: string,
  destinationChain: string,
  gasLimit: bigint
): Promise<bigint> {
  const fee = await axelarQuery.estimateGasFee(
    sourceChain,
    destinationChain,
    Number(gasLimit),
    "auto",
  );
  return BigInt(fee as string);
}
```

## Send Message

```typescript
const messengerAbi = parseAbi([
  "function sendMessage(string calldata destinationChain, string calldata destinationAddress, bytes calldata payload) payable",
]);

async function sendCrossChainMessage(
  message: string,
  destinationChain: string,
  destinationAddress: string
): Promise<`0x${string}`> {
  const payload = encodeAbiParameters(
    parseAbiParameters("string message, uint256 timestamp"),
    [message, BigInt(Math.floor(Date.now() / 1000))]
  );

  const gasValue = await estimateGas("ethereum", destinationChain, 250000n);

  const { request } = await ethereumClient.simulateContract({
    address: MESSENGER,
    abi: messengerAbi,
    functionName: "sendMessage",
    args: [destinationChain, destinationAddress, payload],
    value: gasValue,
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await ethereumClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("sendMessage reverted");

  return hash;
}
```

## Verify Delivery

After sending, check delivery status on the destination chain.

```typescript
import { arbitrum } from "viem/chains";

const arbitrumClient = createPublicClient({
  chain: arbitrum,
  transport: http(process.env.ARBITRUM_RPC_URL),
});

const MESSENGER_ARBITRUM: Address = "0xYourMessengerOnArbitrum" as Address;

const receiveEventAbi = parseAbi([
  "event MessageReceived(string indexed sourceChainHash, string sourceChain, string sourceAddress, bytes payload)",
]);

async function watchForDelivery(fromBlock: bigint): Promise<void> {
  const logs = await arbitrumClient.getLogs({
    address: MESSENGER_ARBITRUM,
    event: receiveEventAbi[0],
    fromBlock,
  });

  for (const log of logs) {
    console.log(`Message received from: ${log.args.sourceChain}`);
    console.log(`Payload: ${log.args.payload}`);
  }
}
```

## Complete Usage

```typescript
async function main() {
  const remoteAddress = "0xYourMessengerOnArbitrum".toLowerCase();
  const hash = await sendCrossChainMessage(
    "Hello from Ethereum!",
    "arbitrum",
    remoteAddress
  );
  console.log(`Message sent: ${hash}`);
  console.log(`Track at: https://axelarscan.io/gmp/${hash}`);
}

main().catch(console.error);
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `InsufficientGasPayment` revert | `msg.value` is 0 | Estimate gas and pass as `msg.value` |
| `UntrustedRemote` revert | `setTrustedRemote` not called on destination | Call `setTrustedRemote("ethereum", senderAddress)` on Arbitrum contract |
| Message stuck at "confirmed" | Relayer has not delivered yet | Wait or use `manualRelayToDestChain()` from Axelar SDK |
| Gas paid but message not submitted | `callContract()` called before `payNativeGasForContractCall()` | Pay gas BEFORE calling Gateway |
| `NotApprovedByGateway` | Validators have not approved yet | Wait for consensus (~2-5 minutes) |
