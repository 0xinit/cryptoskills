# Bridge Tokens on Optimism

Bridge ETH and ERC20 tokens between Ethereum L1 and OP Mainnet L2 using the Standard Bridge.

## Bridge ETH: L1 → L2

### TypeScript (Viem)

```typescript
import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  parseEther,
  type Address,
} from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);

const l1Wallet = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL),
});

const l1Public = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL),
});

const L1_STANDARD_BRIDGE: Address =
  "0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1";

const bridgeAbi = parseAbi([
  "function depositETH(uint32 _minGasLimit, bytes calldata _extraData) external payable",
  "function depositETHTo(address _to, uint32 _minGasLimit, bytes calldata _extraData) external payable",
]);

async function bridgeETHToL2(amountEth: string) {
  const hash = await l1Wallet.writeContract({
    address: L1_STANDARD_BRIDGE,
    abi: bridgeAbi,
    functionName: "depositETH",
    args: [200_000, "0x"],
    value: parseEther(amountEth),
  });

  const receipt = await l1Public.waitForTransactionReceipt({ hash });

  if (receipt.status === "reverted") {
    throw new Error("Bridge deposit reverted");
  }

  console.log(`ETH deposited to L2: ${hash}`);
  console.log("ETH will arrive on OP Mainnet in ~1-3 minutes");

  return hash;
}

// Bridge to a different recipient on L2
async function bridgeETHToL2Recipient(amountEth: string, to: Address) {
  const hash = await l1Wallet.writeContract({
    address: L1_STANDARD_BRIDGE,
    abi: bridgeAbi,
    functionName: "depositETHTo",
    args: [to, 200_000, "0x"],
    value: parseEther(amountEth),
  });

  return hash;
}
```

## Bridge ETH: L2 → L1

```typescript
import { createWalletClient, http, parseAbi, parseEther, type Address } from "viem";
import { optimism } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);

const l2Wallet = createWalletClient({
  account,
  chain: optimism,
  transport: http(process.env.OP_MAINNET_RPC),
});

const L2_STANDARD_BRIDGE: Address =
  "0x4200000000000000000000000000000000000010";

// Legacy ETH address used by the Standard Bridge
const LEGACY_ETH: Address =
  "0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000";

const l2BridgeAbi = parseAbi([
  "function withdraw(address _l2Token, uint256 _amount, uint32 _minGasLimit, bytes calldata _extraData) external payable",
]);

async function withdrawETHToL1(amountEth: string) {
  const amount = parseEther(amountEth);

  const hash = await l2Wallet.writeContract({
    address: L2_STANDARD_BRIDGE,
    abi: l2BridgeAbi,
    functionName: "withdraw",
    args: [LEGACY_ETH, amount, 200_000, "0x"],
    value: amount,
  });

  console.log(`ETH withdrawal initiated: ${hash}`);
  console.log("Next steps:");
  console.log("1. Wait ~1 hour for output root proposal");
  console.log("2. Prove withdrawal on L1");
  console.log("3. Wait 7 days for challenge period");
  console.log("4. Finalize withdrawal on L1");

  return hash;
}
```

## Bridge ERC20: L1 → L2

```typescript
import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  type Address,
} from "viem";
import { mainnet } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);

const l1Wallet = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL),
});

const l1Public = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETH_RPC_URL),
});

const L1_STANDARD_BRIDGE: Address =
  "0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1";

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
]);

const bridgeErc20Abi = parseAbi([
  "function depositERC20(address _l1Token, address _l2Token, uint256 _amount, uint32 _minGasLimit, bytes calldata _extraData) external",
]);

async function bridgeERC20ToL2(
  l1Token: Address,
  l2Token: Address,
  amount: bigint
) {
  // Check and set allowance
  const allowance = await l1Public.readContract({
    address: l1Token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, L1_STANDARD_BRIDGE],
  });

  if (allowance < amount) {
    const approveHash = await l1Wallet.writeContract({
      address: l1Token,
      abi: erc20Abi,
      functionName: "approve",
      args: [L1_STANDARD_BRIDGE, amount],
    });
    await l1Public.waitForTransactionReceipt({ hash: approveHash });
  }

  const hash = await l1Wallet.writeContract({
    address: L1_STANDARD_BRIDGE,
    abi: bridgeErc20Abi,
    functionName: "depositERC20",
    args: [l1Token, l2Token, amount, 200_000, "0x"],
  });

  console.log(`ERC20 deposited to L2: ${hash}`);
  return hash;
}
```

## Bridge ERC20: L2 → L1

```typescript
const l2WithdrawErc20Abi = parseAbi([
  "function withdraw(address _l2Token, uint256 _amount, uint32 _minGasLimit, bytes calldata _extraData) external payable",
]);

async function withdrawERC20ToL1(l2Token: Address, amount: bigint) {
  const hash = await l2Wallet.writeContract({
    address: L2_STANDARD_BRIDGE,
    abi: l2WithdrawErc20Abi,
    functionName: "withdraw",
    args: [l2Token, amount, 200_000, "0x"],
  });

  console.log(`ERC20 withdrawal initiated: ${hash}`);
  return hash;
}
```

## SuperchainERC20 Cross-Chain Transfer

Transfer tokens between OP Stack chains (e.g., OP Mainnet → Base) using the SuperchainTokenBridge:

```typescript
import { parseAbi, type Address } from "viem";

const SUPERCHAIN_TOKEN_BRIDGE: Address =
  "0x4200000000000000000000000000000000000028";

const superchainBridgeAbi = parseAbi([
  "function sendERC20(address _token, address _to, uint256 _amount, uint256 _chainId) external",
]);

// Transfer SuperchainERC20 tokens to another OP Stack chain
async function crossChainTransfer(
  token: Address,
  to: Address,
  amount: bigint,
  destinationChainId: bigint
) {
  const hash = await l2Wallet.writeContract({
    address: SUPERCHAIN_TOKEN_BRIDGE,
    abi: superchainBridgeAbi,
    functionName: "sendERC20",
    args: [token, to, amount, destinationChainId],
  });

  console.log(`Cross-chain transfer initiated: ${hash}`);
  return hash;
}
```

## Claiming L2→L1 Withdrawals

After the 7-day challenge period, finalize your withdrawal on L1:

```typescript
import { parseAbi, type Address } from "viem";

const OPTIMISM_PORTAL: Address = "0xbEb5Fc579115071764c7423A4f12eDde41f106Ed";

const portalAbi = parseAbi([
  "function proveWithdrawalTransaction((uint256 nonce, address sender, address target, uint256 value, uint256 gasLimit, bytes data) _tx, uint256 _l2OutputIndex, (bytes32 version, bytes32 stateRoot, bytes32 messagePasserStorageRoot, bytes32 latestBlockhash) _outputRootProof, bytes[] _withdrawalProof) external",
  "function finalizeWithdrawalTransaction((uint256 nonce, address sender, address target, uint256 value, uint256 gasLimit, bytes data) _tx) external",
]);

// The full withdrawal flow requires:
// 1. Parsing the withdrawal event from the L2 transaction receipt
// 2. Waiting for the L2 output root to be proposed on L1
// 3. Generating the withdrawal proof (storage proof against L2ToL1MessagePasser)
// 4. Calling proveWithdrawalTransaction on OptimismPortal
// 5. Waiting 7 days
// 6. Calling finalizeWithdrawalTransaction on OptimismPortal
//
// For production use, the Optimism SDK or viem's op-stack actions
// handle proof generation and the full lifecycle.
```

## Common Token Addresses

| Token | L1 Address | L2 Address |
|-------|-----------|-----------|
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` |
| USDT | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | `0x94b008aA00579c1307B0EF2c499aD98a8ce58e58` |
| DAI | `0x6B175474E89094C44Da98b954EedeAC495271d0F` | `0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1` |
| WBTC | `0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599` | `0x68f180fcCe6836688e9084f035309E29Bf0A2095` |
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | `0x4200000000000000000000000000000000000006` |

## Notes

- L1→L2 deposits arrive in ~1-3 minutes. No prove/finalize step needed.
- L2→L1 withdrawals require prove + 7-day wait + finalize. Three L1 transactions total.
- Always approve the bridge contract before depositing ERC20 tokens.
- The `_minGasLimit` parameter is for the execution on the destination chain. Overestimate for safety.
- Not all ERC20 tokens have L2 representations. Check the [Optimism Token List](https://github.com/ethereum-optimism/ethereum-optimism.github.io) for supported tokens.
