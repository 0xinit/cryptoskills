# EIP-712 Typed Data Signing — Full Example

End-to-end EIP-712 signing: Solidity verifier contract, viem signing on the frontend, and ERC-1271 support for smart contract wallets.

## Solidity — Verifier Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";

/// @title OrderVerifier
/// @notice Verifies EIP-712 signed orders. Supports both EOA and ERC-1271 contract signers.
contract OrderVerifier is EIP712 {
    bytes32 private constant ORDER_TYPEHASH = keccak256(
        "Order(address maker,address token,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    mapping(address maker => uint256 nonce) public nonces;
    mapping(bytes32 orderHash => bool filled) public filledOrders;

    event OrderFilled(address indexed maker, address indexed token, uint256 amount, uint256 nonce);

    error OrderExpired(uint256 deadline, uint256 currentTime);
    error InvalidNonce(uint256 expected, uint256 provided);
    error InvalidSignature();
    error OrderAlreadyFilled();

    struct Order {
        address maker;
        address token;
        uint256 amount;
        uint256 nonce;
        uint256 deadline;
    }

    constructor() EIP712("OrderVerifier", "1") {}

    /// @notice Fill a signed order after verifying the EIP-712 signature.
    function fillOrder(Order calldata order, bytes calldata signature) external {
        if (block.timestamp > order.deadline) {
            revert OrderExpired(order.deadline, block.timestamp);
        }
        if (order.nonce != nonces[order.maker]) {
            revert InvalidNonce(nonces[order.maker], order.nonce);
        }

        bytes32 structHash = keccak256(abi.encode(
            ORDER_TYPEHASH,
            order.maker,
            order.token,
            order.amount,
            order.nonce,
            order.deadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash);

        if (filledOrders[digest]) revert OrderAlreadyFilled();

        if (!_isValidSignature(order.maker, digest, signature)) {
            revert InvalidSignature();
        }

        filledOrders[digest] = true;
        nonces[order.maker]++;

        emit OrderFilled(order.maker, order.token, order.amount, order.nonce);
    }

    /// @dev Supports both EOA (ecrecover) and smart contract (ERC-1271) signers.
    function _isValidSignature(
        address signer, bytes32 digest, bytes memory signature
    ) internal view returns (bool) {
        if (signer.code.length > 0) {
            try IERC1271(signer).isValidSignature(digest, signature) returns (bytes4 magicValue) {
                return magicValue == IERC1271.isValidSignature.selector;
            } catch {
                return false;
            }
        }
        return ECDSA.recover(digest, signature) == signer;
    }
}
```

## TypeScript — Sign Order with viem

```typescript
import { createWalletClient, createPublicClient, http, custom } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const VERIFIER = '0xDeployedVerifierAddress...' as const;

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http(process.env.RPC_URL),
});
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL),
});

// Fetch current nonce
const nonce = await publicClient.readContract({
  address: VERIFIER,
  abi: orderVerifierAbi,
  functionName: 'nonces',
  args: [account.address],
});

const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

// Sign the order
const signature = await walletClient.signTypedData({
  domain: {
    name: 'OrderVerifier',
    version: '1',
    chainId: sepolia.id,
    verifyingContract: VERIFIER,
  },
  types: {
    Order: [
      { name: 'maker', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  },
  primaryType: 'Order',
  message: {
    maker: account.address,
    token: '0xTokenAddress...',
    amount: 1000000000000000000n, // 1 token (18 decimals)
    nonce,
    deadline,
  },
});

console.log('Signature:', signature);
```

## TypeScript — Submit Signed Order

```typescript
const order = {
  maker: account.address,
  token: '0xTokenAddress...' as `0x${string}`,
  amount: 1000000000000000000n,
  nonce,
  deadline,
};

const fillHash = await walletClient.writeContract({
  address: VERIFIER,
  abi: orderVerifierAbi,
  functionName: 'fillOrder',
  args: [order, signature],
});

const receipt = await publicClient.waitForTransactionReceipt({ hash: fillHash });
if (receipt.status !== 'success') throw new Error('Fill failed');
console.log('Order filled in tx:', fillHash);
```

## Browser Wallet — signTypedData with Injected Provider

```typescript
import { createWalletClient, custom } from 'viem';
import { mainnet } from 'viem/chains';

const walletClient = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum!),
});

const [address] = await walletClient.requestAddresses();

const signature = await walletClient.signTypedData({
  account: address,
  domain: {
    name: 'OrderVerifier',
    version: '1',
    chainId: 1,
    verifyingContract: '0xMainnetVerifier...',
  },
  types: {
    Order: [
      { name: 'maker', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  },
  primaryType: 'Order',
  message: {
    maker: address,
    token: '0xTokenAddress...',
    amount: 1000000000000000000n,
    nonce: 0n,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
  },
});
```

## Key Points

- OpenZeppelin's `EIP712` base contract handles domain separator caching and fork protection.
- `_hashTypedDataV4` computes the full `\x19\x01 || domainSeparator || structHash` digest.
- Never include `EIP712Domain` in the `types` object — viem derives it from `domain`.
- Always include `chainId` and `verifyingContract` in the domain to prevent replay.
- For smart contract wallets (Safe, ERC-4337 accounts), use ERC-1271 verification as fallback.
- Set `deadline` at least 30 minutes in the future to survive mempool delays.
- Nonces must be fetched immediately before signing to avoid mismatch.

Last verified: March 2026
