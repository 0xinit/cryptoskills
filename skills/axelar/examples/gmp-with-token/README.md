# GMP with Token Transfer

Working examples for sending a cross-chain message WITH an Axelar-wrapped token using `callContractWithToken`. This combines arbitrary payload delivery with token transfer in a single cross-chain transaction.

## Key Difference from Plain GMP

- `callContract()` sends only a bytes payload
- `callContractWithToken()` sends payload + an Axelar-supported token (axlUSDC, axlWETH, etc.)
- The destination contract receives the tokens AND the payload in `_executeWithToken()`
- Only tokens registered in the Axelar Gateway can be sent this way

## Solidity Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

import {AxelarExecutable} from "@axelar-network/axelar-gmp-sdk-solidity/contracts/executable/AxelarExecutable.sol";
import {IAxelarGateway} from "@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGateway.sol";
import {IAxelarGasService} from "@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGasService.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract CrossChainSwap is AxelarExecutable, Ownable {
    using SafeERC20 for IERC20;

    IAxelarGasService public immutable GAS_SERVICE;

    mapping(string => string) public trustedRemotes;

    event TokenSent(
        string destinationChain,
        string destinationAddress,
        string symbol,
        uint256 amount,
        address indexed recipient
    );
    event TokenReceived(
        string sourceChain,
        string sourceAddress,
        string symbol,
        uint256 amount,
        address indexed recipient
    );

    error UntrustedRemote(string sourceChain, string sourceAddress);
    error InsufficientGasPayment();
    error ZeroAmount();

    constructor(
        address gateway_,
        address gasService_,
        address owner_
    ) AxelarExecutable(gateway_) Ownable(owner_) {
        GAS_SERVICE = IAxelarGasService(gasService_);
    }

    /// @notice Send tokens + message cross-chain
    /// @param destinationChain Axelar chain name
    /// @param destinationAddress Remote contract (lowercase hex string)
    /// @param recipient Final recipient on destination chain
    /// @param symbol Axelar token symbol (e.g., "axlUSDC")
    /// @param amount Token amount to send
    function sendTokenWithMessage(
        string calldata destinationChain,
        string calldata destinationAddress,
        address recipient,
        string calldata symbol,
        uint256 amount
    ) external payable {
        if (amount == 0) revert ZeroAmount();
        if (msg.value == 0) revert InsufficientGasPayment();

        // Encode the recipient into the payload
        bytes memory payload = abi.encode(recipient);

        // Get the token address from the Gateway
        address tokenAddress = gateway().tokenAddresses(symbol);

        // CEI: Transfer tokens from sender to this contract
        IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), amount);

        // Approve Gateway to spend the tokens
        IERC20(tokenAddress).forceApprove(address(gateway()), amount);

        // Pay gas for destination execution
        GAS_SERVICE.payNativeGasForContractCallWithToken{value: msg.value}(
            address(this),
            destinationChain,
            destinationAddress,
            payload,
            symbol,
            amount,
            msg.sender
        );

        // Send the GMP call with token
        gateway().callContractWithToken(
            destinationChain,
            destinationAddress,
            payload,
            symbol,
            amount
        );

        emit TokenSent(destinationChain, destinationAddress, symbol, amount, recipient);
    }

    /// @dev Called by Gateway when tokens + message arrive
    function _executeWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload,
        string calldata tokenSymbol,
        uint256 amount
    ) internal override {
        // Validate the remote sender
        string memory trusted = trustedRemotes[sourceChain];
        if (bytes(trusted).length == 0) {
            revert UntrustedRemote(sourceChain, sourceAddress);
        }
        if (keccak256(bytes(trusted)) != keccak256(bytes(sourceAddress))) {
            revert UntrustedRemote(sourceChain, sourceAddress);
        }

        // Decode the recipient
        address recipient = abi.decode(payload, (address));

        // Resolve token address on this chain
        address tokenAddress = gateway().tokenAddresses(tokenSymbol);

        // CEI: state updates first, then transfer
        emit TokenReceived(sourceChain, sourceAddress, tokenSymbol, amount, recipient);

        IERC20(tokenAddress).safeTransfer(recipient, amount);
    }

    /// @notice Register trusted remote
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

const SWAP_CONTRACT: Address = "0xYourCrossChainSwap" as Address;
const GATEWAY: Address = "0x4F4495243837681061C4743b74B3eEdf548D56A5";
```

## Approve and Send Tokens

```typescript
const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

const swapAbi = parseAbi([
  "function sendTokenWithMessage(string calldata destinationChain, string calldata destinationAddress, address recipient, string calldata symbol, uint256 amount) payable",
]);

async function approveTokens(
  tokenAddress: Address,
  spender: Address,
  amount: bigint
): Promise<void> {
  const currentAllowance = await ethereumClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, spender],
  });

  if (currentAllowance >= amount) return;

  const { request } = await ethereumClient.simulateContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await ethereumClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Token approval reverted");
}

async function sendTokenCrossChain(
  destinationChain: string,
  destinationAddress: string,
  recipient: Address,
  symbol: string,
  amount: bigint
): Promise<`0x${string}`> {
  // Resolve the token address for approval
  const gatewayAbi = parseAbi([
    "function tokenAddresses(string calldata symbol) view returns (address)",
  ]);

  const tokenAddress = await ethereumClient.readContract({
    address: GATEWAY,
    abi: gatewayAbi,
    functionName: "tokenAddresses",
    args: [symbol],
  });

  // Approve the swap contract to spend tokens
  await approveTokens(tokenAddress, SWAP_CONTRACT, amount);

  // Estimate gas for destination execution
  const axelarQuery = new AxelarQueryAPI({
    environment: Environment.MAINNET,
  });

  const gasFee = await axelarQuery.estimateGasFee(
    "ethereum",
    destinationChain,
    300000,
    "auto",
  );
  const gasValue = BigInt(gasFee as string);

  // Send the cross-chain token transfer
  const { request } = await ethereumClient.simulateContract({
    address: SWAP_CONTRACT,
    abi: swapAbi,
    functionName: "sendTokenWithMessage",
    args: [destinationChain, destinationAddress, recipient, symbol, amount],
    value: gasValue,
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await ethereumClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("sendTokenWithMessage reverted");

  return hash;
}
```

## Complete Usage

```typescript
async function main() {
  const AMOUNT = 1000_000000n; // 1000 axlUSDC (6 decimals)
  const REMOTE_CONTRACT = "0xYourSwapOnArbitrum".toLowerCase();

  const hash = await sendTokenCrossChain(
    "arbitrum",
    REMOTE_CONTRACT,
    account.address,
    "axlUSDC",
    AMOUNT
  );

  console.log(`Token + message sent: ${hash}`);
  console.log(`Track at: https://axelarscan.io/gmp/${hash}`);
}

main().catch(console.error);
```

## Supported Token Symbols

Only tokens registered in the Axelar Gateway can be used with `callContractWithToken`:

| Symbol | Asset | Decimals |
|--------|-------|----------|
| `axlUSDC` | Axelar-wrapped USDC | 6 |
| `axlWETH` | Axelar-wrapped WETH | 18 |
| `axlWBTC` | Axelar-wrapped WBTC | 8 |
| `axlDAI` | Axelar-wrapped DAI | 18 |
| `WMATIC` | Wrapped MATIC (on Polygon) | 18 |
| `WAVAX` | Wrapped AVAX (on Avalanche) | 18 |

Check the Gateway for the full list:
```bash
cast call 0x4F4495243837681061C4743b74B3eEdf548D56A5 \
  "tokenAddresses(string)(address)" "axlUSDC" --rpc-url $ETH_RPC_URL
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `TokenDoesNotExist` | Symbol not registered in Gateway | Use only Axelar-supported symbols (axlUSDC, axlWETH, etc.) |
| Token transfer reverts | Insufficient allowance | Approve the contract to spend tokens before calling |
| Tokens arrive but `_executeWithToken` reverts | Trusted remote not set on destination | Call `setTrustedRemote` on the destination contract |
| Tokens stuck in contract | `_executeWithToken` not properly forwarding | Ensure `safeTransfer` to recipient is in the callback |
| Different amounts on destination | Fee deduction or decimal mismatch | Axelar does not deduct from transfer amount -- check your logic |
