# Deploy OFT Examples

Deploy an Omnichain Fungible Token on Ethereum and an OFTAdapter on Arbitrum for an existing ERC-20, enabling cross-chain token transfers.

## Architecture

```
Ethereum (Home Chain)              Arbitrum (Remote Chain)
+------------------+               +------------------+
| Existing ERC-20  |               |   OFT (mint)     |
| (MYTOKEN)        |               |   (MyTokenOFT)   |
+------------------+               +------------------+
        |                                   ^
        v                                   |
+------------------+    LayerZero V2  +------------------+
| OFTAdapter       | <------------->  | EndpointV2       |
| (lock/unlock)    |    messaging     |                  |
+------------------+                  +------------------+
```

- On Ethereum: `OFTAdapter` locks the existing ERC-20 when sending cross-chain
- On Arbitrum: `OFT` mints tokens when receiving, burns when sending back

## Solidity Contracts

### OFTAdapter (Ethereum — home chain of existing token)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {OFTAdapter} from "@layerzerolabs/oft-evm/contracts/OFTAdapter.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MyTokenAdapter is OFTAdapter {
    constructor(
        address _token,
        address _lzEndpoint,
        address _delegate
    ) OFTAdapter(_token, _lzEndpoint, _delegate) Ownable(_delegate) {}
}
```

### OFT (Arbitrum — remote chain)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {OFT} from "@layerzerolabs/oft-evm/contracts/OFT.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MyTokenOFT is OFT {
    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _delegate
    ) OFT(_name, _symbol, _lzEndpoint, _delegate) Ownable(_delegate) {}
}
```

## Foundry Deploy Scripts

### Deploy OFTAdapter on Ethereum

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script, console} from "forge-std/Script.sol";
import {MyTokenAdapter} from "../src/MyTokenAdapter.sol";

contract DeployAdapter is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address token = vm.envAddress("TOKEN_ADDRESS");
        address endpoint = 0x1a44076050125825900e736c501f859c50fE728c;
        address delegate = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);
        MyTokenAdapter adapter = new MyTokenAdapter(token, endpoint, delegate);
        console.log("OFTAdapter deployed:", address(adapter));
        vm.stopBroadcast();
    }
}
```

### Deploy OFT on Arbitrum

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script, console} from "forge-std/Script.sol";
import {MyTokenOFT} from "../src/MyTokenOFT.sol";

contract DeployOFT is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address endpoint = 0x1a44076050125825900e736c501f859c50fE728c;
        address delegate = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);
        MyTokenOFT oft = new MyTokenOFT("MyToken", "MYT", endpoint, delegate);
        console.log("OFT deployed:", address(oft));
        vm.stopBroadcast();
    }
}
```

## Post-Deploy Configuration (TypeScript)

### Set Peers Bidirectionally

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, arbitrum } from "viem/chains";

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const ethereumPublic = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETHEREUM_RPC_URL),
});

const ethereumWallet = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.ETHEREUM_RPC_URL),
});

const arbitrumPublic = createPublicClient({
  chain: arbitrum,
  transport: http(process.env.ARBITRUM_RPC_URL),
});

const arbitrumWallet = createWalletClient({
  account,
  chain: arbitrum,
  transport: http(process.env.ARBITRUM_RPC_URL),
});

const peerAbi = parseAbi([
  "function setPeer(uint32 eid, bytes32 peer) external",
]);

function addressToBytes32(addr: Address): `0x${string}` {
  return `0x${addr.slice(2).padStart(64, "0")}` as `0x${string}`;
}

const ADAPTER_ETH: Address = "0xYourAdapterOnEthereum" as Address;
const OFT_ARB: Address = "0xYourOFTOnArbitrum" as Address;
const ETHEREUM_EID = 30101;
const ARBITRUM_EID = 30110;

async function setPeersBidirectional(): Promise<void> {
  // Ethereum adapter -> Arbitrum OFT
  const { request: ethReq } = await ethereumPublic.simulateContract({
    address: ADAPTER_ETH,
    abi: peerAbi,
    functionName: "setPeer",
    args: [ARBITRUM_EID, addressToBytes32(OFT_ARB)],
    account: account.address,
  });
  const ethHash = await ethereumWallet.writeContract(ethReq);
  const ethReceipt = await ethereumPublic.waitForTransactionReceipt({ hash: ethHash });
  if (ethReceipt.status !== "success") throw new Error("setPeer on Ethereum reverted");

  // Arbitrum OFT -> Ethereum adapter
  const { request: arbReq } = await arbitrumPublic.simulateContract({
    address: OFT_ARB,
    abi: peerAbi,
    functionName: "setPeer",
    args: [ETHEREUM_EID, addressToBytes32(ADAPTER_ETH)],
    account: account.address,
  });
  const arbHash = await arbitrumWallet.writeContract(arbReq);
  const arbReceipt = await arbitrumPublic.waitForTransactionReceipt({ hash: arbHash });
  if (arbReceipt.status !== "success") throw new Error("setPeer on Arbitrum reverted");

  console.log("Peers set bidirectionally");
}
```

### Send Tokens Ethereum to Arbitrum

```typescript
const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

const oftAbi = parseAbi([
  "function send((uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd) calldata sendParam, (uint256 nativeFee, uint256 lzTokenFee) calldata fee, address refundAddress) payable returns ((bytes32 guid, uint64 nonce, (uint256 nativeFee, uint256 lzTokenFee) fee) receipt)",
  "function quoteSend((uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd) calldata sendParam, bool payInLzToken) view returns ((uint256 nativeFee, uint256 lzTokenFee) fee)",
]);

async function sendTokensToArbitrum(
  tokenAddress: Address,
  amount: bigint
): Promise<`0x${string}`> {
  // Approve OFTAdapter to spend tokens
  const allowance = await ethereumPublic.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, ADAPTER_ETH],
  });

  if (allowance < amount) {
    const { request: approveReq } = await ethereumPublic.simulateContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [ADAPTER_ETH, amount],
      account: account.address,
    });
    const approveHash = await ethereumWallet.writeContract(approveReq);
    const approveReceipt = await ethereumPublic.waitForTransactionReceipt({ hash: approveHash });
    if (approveReceipt.status !== "success") throw new Error("Approve reverted");
  }

  const sendParam = {
    dstEid: ARBITRUM_EID,
    to: addressToBytes32(account.address),
    amountLD: amount,
    minAmountLD: (amount * 995n) / 1000n, // 0.5% slippage
    extraOptions: "0x" as `0x${string}`,
    composeMsg: "0x" as `0x${string}`,
    oftCmd: "0x" as `0x${string}`,
  };

  // Quote
  const fee = await ethereumPublic.readContract({
    address: ADAPTER_ETH,
    abi: oftAbi,
    functionName: "quoteSend",
    args: [sendParam, false],
  });

  // Send
  const { request } = await ethereumPublic.simulateContract({
    address: ADAPTER_ETH,
    abi: oftAbi,
    functionName: "send",
    args: [sendParam, fee, account.address],
    value: fee.nativeFee,
    account: account.address,
  });

  const hash = await ethereumWallet.writeContract(request);
  const receipt = await ethereumPublic.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("OFT send reverted");

  return hash;
}
```

## Complete Usage

```typescript
async function main() {
  const TOKEN: Address = "0xYourERC20Token" as Address;
  const amount = 1000_000000000000000000n; // 1000 tokens (18 decimals)

  // Set peers (one-time after deploy)
  await setPeersBidirectional();

  // Send tokens
  const hash = await sendTokensToArbitrum(TOKEN, amount);
  console.log(`Tokens sent: ${hash}`);
  console.log(`Track: https://layerzeroscan.com/tx/${hash}`);
}

main().catch(console.error);
```

## Shared Decimals Consideration

OFT defaults to 6 shared decimals. For an 18-decimal token, the last 12 digits are dust and will be lost during cross-chain transfer.

```
Sending:   1000.123456789012345678 tokens
Received:  1000.123456000000000000 tokens
Dust lost:    0.000000789012345678 tokens
```

If your token uses 6 decimals (like USDC), shared decimals matches and no dust is lost. For tokens requiring higher cross-chain precision, override `sharedDecimals()` in both OFT and OFTAdapter.
