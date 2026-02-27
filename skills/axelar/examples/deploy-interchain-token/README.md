# Deploy Interchain Token via Axelar ITS

Working examples for deploying a new interchain token using Axelar's Interchain Token Service (ITS) and Interchain Token Factory. The token deploys on the origin chain and can be extended to any supported chain with the same tokenId.

## Concepts

- ITS tokens are **burn-on-source, mint-on-destination** -- NOT wrapped tokens
- The same `salt` + deployer address produces the same `tokenId` on every chain
- Use `InterchainTokenFactory.deployInterchainToken()` for the initial deployment
- Use `InterchainTokenFactory.deployRemoteInterchainToken()` to extend to other chains
- Remote deployment requires gas payment (native token) for the destination chain

## Solidity Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import {IInterchainTokenFactory} from "@axelar-network/interchain-token-service/contracts/interfaces/IInterchainTokenFactory.sol";
import {IInterchainTokenService} from "@axelar-network/interchain-token-service/contracts/interfaces/IInterchainTokenService.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract InterchainTokenDeployer is Ownable {
    IInterchainTokenFactory public immutable FACTORY;
    IInterchainTokenService public immutable ITS;

    event TokenDeployed(bytes32 indexed tokenId, string name, string symbol, uint8 decimals);
    event RemoteTokenDeployed(bytes32 indexed tokenId, string destinationChain);

    error ZeroInitialSupply();

    constructor(
        address factory_,
        address its_,
        address owner_
    ) Ownable(owner_) {
        FACTORY = IInterchainTokenFactory(factory_);
        ITS = IInterchainTokenService(its_);
    }

    /// @notice Deploy a new interchain token on this chain
    /// @param salt Unique salt -- MUST be the same on all chains for linking
    /// @param name Token name
    /// @param symbol Token symbol
    /// @param decimals Token decimals (typically 18)
    /// @param initialSupply Amount to mint to the caller
    /// @return tokenId Deterministic token ID derived from deployer + salt
    function deployLocal(
        bytes32 salt,
        string calldata name,
        string calldata symbol,
        uint8 decimals,
        uint256 initialSupply
    ) external returns (bytes32 tokenId) {
        if (initialSupply == 0) revert ZeroInitialSupply();

        tokenId = FACTORY.deployInterchainToken(
            salt,
            name,
            symbol,
            decimals,
            initialSupply,
            msg.sender
        );

        emit TokenDeployed(tokenId, name, symbol, decimals);
    }

    /// @notice Deploy the token remotely on another chain
    /// @param salt Same salt used in deployLocal
    /// @param destinationChain Axelar chain name (e.g., "arbitrum")
    /// @return tokenId The token ID (same on all chains)
    function deployRemote(
        bytes32 salt,
        string calldata destinationChain
    ) external payable returns (bytes32 tokenId) {
        tokenId = FACTORY.deployRemoteInterchainToken{value: msg.value}(
            "",
            salt,
            msg.sender,
            destinationChain,
            msg.value
        );

        emit RemoteTokenDeployed(tokenId, destinationChain);
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
  keccak256,
  encodePacked,
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

const DEPLOYER: Address = "0xYourDeployerContract" as Address;

const ITS_FACTORY: Address = "0x83a93500d23Fbc3e82B410aD07A6a9F7A0670D12";
const ITS_SERVICE: Address = "0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C";
```

## Deploy on Origin Chain

```typescript
const deployerAbi = parseAbi([
  "function deployLocal(bytes32 salt, string calldata name, string calldata symbol, uint8 decimals, uint256 initialSupply) returns (bytes32 tokenId)",
  "function deployRemote(bytes32 salt, string calldata destinationChain) payable returns (bytes32 tokenId)",
]);

// Deterministic salt -- use the same value on all chains
const SALT = keccak256(encodePacked(["string"], ["my-interchain-token-v1"]));

async function deployOnOriginChain(): Promise<`0x${string}`> {
  const INITIAL_SUPPLY = 1_000_000_000000000000000000n; // 1M tokens, 18 decimals

  const { request } = await ethereumClient.simulateContract({
    address: DEPLOYER,
    abi: deployerAbi,
    functionName: "deployLocal",
    args: [SALT, "My Interchain Token", "MIT", 18, INITIAL_SUPPLY],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await ethereumClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("deployLocal reverted");

  return hash;
}
```

## Deploy Remotely to Another Chain

```typescript
const axelarQuery = new AxelarQueryAPI({
  environment: Environment.MAINNET,
});

async function deployToRemoteChain(
  destinationChain: string
): Promise<`0x${string}`> {
  // Estimate gas for remote deployment (higher than a simple message)
  const gasFee = await axelarQuery.estimateGasFee(
    "ethereum",
    destinationChain,
    500000,
    "auto",
  );
  const gasValue = BigInt(gasFee as string);

  const { request } = await ethereumClient.simulateContract({
    address: DEPLOYER,
    abi: deployerAbi,
    functionName: "deployRemote",
    args: [SALT, destinationChain],
    value: gasValue,
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await ethereumClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("deployRemote reverted");

  return hash;
}
```

## Send ITS Tokens Cross-Chain

Once deployed on multiple chains, use the ITS contract directly to transfer:

```typescript
const itsAbi = parseAbi([
  "function interchainTransfer(bytes32 tokenId, string calldata destinationChain, bytes calldata destinationAddress, uint256 amount, bytes calldata metadata, uint256 gasValue) payable",
]);

async function transferCrossChain(
  tokenId: `0x${string}`,
  destinationChain: string,
  recipient: Address,
  amount: bigint
): Promise<`0x${string}`> {
  const gasFee = await axelarQuery.estimateGasFee(
    "ethereum",
    destinationChain,
    250000,
    "auto",
  );
  const gasValue = BigInt(gasFee as string);

  // Destination address encoded as bytes (left-padded for EVM)
  const destAddress = `0x${recipient.slice(2).padStart(64, "0")}` as `0x${string}`;

  const { request } = await ethereumClient.simulateContract({
    address: ITS_SERVICE,
    abi: itsAbi,
    functionName: "interchainTransfer",
    args: [tokenId, destinationChain, destAddress, amount, "0x", gasValue],
    value: gasValue,
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await ethereumClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("interchainTransfer reverted");

  return hash;
}
```

## Complete Usage

```typescript
async function main() {
  // Step 1: Deploy on Ethereum
  const deployHash = await deployOnOriginChain();
  console.log(`Deployed on Ethereum: ${deployHash}`);

  // Step 2: Deploy remotely to Arbitrum and Base
  const arbHash = await deployToRemoteChain("arbitrum");
  console.log(`Remote deploy to Arbitrum: ${arbHash}`);

  const baseHash = await deployToRemoteChain("base");
  console.log(`Remote deploy to Base: ${baseHash}`);

  // Step 3: Transfer tokens cross-chain
  const TOKEN_ID = SALT; // tokenId is derived from deployer + salt
  const transferHash = await transferCrossChain(
    TOKEN_ID,
    "arbitrum",
    account.address,
    100_000000000000000000n // 100 tokens
  );
  console.log(`Cross-chain transfer: ${transferHash}`);
  console.log(`Track at: https://axelarscan.io/gmp/${transferHash}`);
}

main().catch(console.error);
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Remote deploy fails | Insufficient gas payment | Use higher gas limit (500k+) for deployment |
| Token ID mismatch across chains | Different salt or deployer address | Use identical salt and deployer on every chain |
| `interchainTransfer` reverts | Token not approved for ITS spending | Approve the ITS contract to spend your tokens first |
| Zero supply on remote chain | Remote deploy not yet executed | Check axelarscan -- wait for execution |
| `NotSelf` error | Calling ITS internal function directly | Use the Factory or SDK wrappers |
