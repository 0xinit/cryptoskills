# Custom MultisigISM

Create and configure a custom MultisigISM for enhanced security on Hyperlane message delivery.

## Why Custom ISMs

The default ISM on each Mailbox is controlled by the Mailbox owner. For production applications, you should deploy your own ISM so that:

1. You control the validator set and threshold
2. You are not affected by changes to the default ISM
3. You can combine multiple security models via AggregationISM

## Deploy a MultisigISM via Factory

Hyperlane provides factory contracts for deploying ISMs without writing custom Solidity.

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const MULTISIG_ISM_FACTORY = "0x8b83fefd896fAa52057798f6426E9f0B080FCCcE" as const;
```

### Deploy a Static MultisigISM

A static MultisigISM has an immutable validator set and threshold. Use this when your validator set will not change.

```typescript
const multisigFactoryAbi = parseAbi([
  "function deploy(address[] _validators, uint8 _threshold) returns (address)",
]);

async function deployMultisigISM(
  validators: Address[],
  threshold: number
): Promise<Address> {
  if (threshold === 0) throw new Error("Threshold must be at least 1");
  if (threshold > validators.length) {
    throw new Error("Threshold exceeds validator count");
  }

  // Validators must be sorted in ascending order for the factory
  const sortedValidators = [...validators].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  const { request, result } = await publicClient.simulateContract({
    address: MULTISIG_ISM_FACTORY,
    abi: multisigFactoryAbi,
    functionName: "deploy",
    args: [sortedValidators, threshold],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("ISM deployment reverted");

  return result;
}
```

### Deploy an AggregationISM (Defense in Depth)

Combine multiple ISMs so that ALL must verify before a message is accepted.

```typescript
const AGGREGATION_ISM_FACTORY = "0x8F7454AC98228f3504bB91eA3D0281e457E00385" as const;

const aggregationFactoryAbi = parseAbi([
  "function deploy(address[] _modules, uint8 _threshold) returns (address)",
]);

async function deployAggregationISM(
  modules: Address[],
  threshold: number
): Promise<Address> {
  if (threshold === 0) throw new Error("Threshold must be at least 1");
  if (threshold > modules.length) {
    throw new Error("Threshold exceeds module count");
  }

  const { request, result } = await publicClient.simulateContract({
    address: AGGREGATION_ISM_FACTORY,
    abi: aggregationFactoryAbi,
    functionName: "deploy",
    args: [modules, threshold],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("AggregationISM deployment reverted");
  }

  return result;
}
```

### Deploy a RoutingISM (Per-Origin Security)

Apply different ISMs based on which chain the message originates from.

```typescript
const ROUTING_ISM_FACTORY = "0xC2E36cd6e32e194EE11f15D9273B64461A4D694A" as const;

const routingFactoryAbi = parseAbi([
  "function deploy(address _owner, uint32[] _domains, address[] _modules) returns (address)",
]);

async function deployRoutingISM(
  domains: number[],
  modules: Address[]
): Promise<Address> {
  if (domains.length !== modules.length) {
    throw new Error("Domains and modules arrays must have equal length");
  }

  const { request, result } = await publicClient.simulateContract({
    address: ROUTING_ISM_FACTORY,
    abi: routingFactoryAbi,
    functionName: "deploy",
    args: [account.address, domains, modules],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("RoutingISM deployment reverted");
  }

  return result;
}
```

## Set Custom ISM on Your Recipient Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IInterchainSecurityModule} from "@hyperlane-xyz/core/contracts/interfaces/IInterchainSecurityModule.sol";
import {IMessageRecipient} from "@hyperlane-xyz/core/contracts/interfaces/IMessageRecipient.sol";

contract SecureRecipient is IMessageRecipient {
    address public immutable mailbox;
    IInterchainSecurityModule public interchainSecurityModule;
    address public owner;

    error Unauthorized();
    error OnlyOwner();

    event ISMUpdated(address indexed oldIsm, address indexed newIsm);
    event MessageReceived(uint32 indexed origin, bytes32 indexed sender, bytes body);

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(address _mailbox, address _ism) {
        mailbox = _mailbox;
        interchainSecurityModule = IInterchainSecurityModule(_ism);
        owner = msg.sender;
    }

    /// @notice Update the ISM — only owner can change security model
    function setInterchainSecurityModule(address _ism) external onlyOwner {
        address oldIsm = address(interchainSecurityModule);
        interchainSecurityModule = IInterchainSecurityModule(_ism);
        emit ISMUpdated(oldIsm, _ism);
    }

    function handle(
        uint32 _origin,
        bytes32 _sender,
        bytes calldata _body
    ) external payable override {
        if (msg.sender != mailbox) revert Unauthorized();
        emit MessageReceived(_origin, _sender, _body);
    }
}
```

## Verify ISM Configuration

```typescript
const ismAbi = parseAbi([
  "function moduleType() view returns (uint8)",
  "function verify(bytes _metadata, bytes _message) returns (bool)",
]);

async function verifyISMDeployed(ismAddress: Address): Promise<void> {
  const moduleType = await publicClient.readContract({
    address: ismAddress,
    abi: ismAbi,
    functionName: "moduleType",
  });

  // Module type 3 = MultisigISM, 6 = AggregationISM, 4 = RoutingISM
  const typeNames: Record<number, string> = {
    3: "MultisigISM",
    4: "RoutingISM",
    6: "AggregationISM",
  };

  const name = typeNames[moduleType] ?? `Unknown (${moduleType})`;
  console.log(`ISM at ${ismAddress}: ${name}`);
}
```

## Complete Example: MultisigISM + AggregationISM

```typescript
async function main() {
  // Deploy a 3-of-5 MultisigISM
  const validators: Address[] = [
    "0x1111111111111111111111111111111111111111",
    "0x2222222222222222222222222222222222222222",
    "0x3333333333333333333333333333333333333333",
    "0x4444444444444444444444444444444444444444",
    "0x5555555555555555555555555555555555555555",
  ];

  const multisigIsm = await deployMultisigISM(validators, 3);
  console.log(`MultisigISM deployed: ${multisigIsm}`);

  // Deploy an AggregationISM that requires both:
  // 1. The MultisigISM above
  // 2. The chain's default ISM (as a fallback check)
  const DEFAULT_ISM: Address = "0x6b1bb4ce664Bb4164AEB4d3D2E7DE7450DD8084C";
  const aggregationIsm = await deployAggregationISM(
    [multisigIsm, DEFAULT_ISM],
    2 // both must pass
  );
  console.log(`AggregationISM deployed: ${aggregationIsm}`);

  // Verify
  await verifyISMDeployed(multisigIsm);
  await verifyISMDeployed(aggregationIsm);
}

main().catch(console.error);
```
