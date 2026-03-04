# ERC-20 Token — Deploy and Interact

Minimal ERC-20 token with OpenZeppelin v5, Permit extension, and viem interaction.

## Solidity — Token Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ExampleToken
/// @notice ERC-20 with permit (ERC-2612) and owner-gated minting.
contract ExampleToken is ERC20, ERC20Permit, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000e18; // 1B tokens

    error ExceedsMaxSupply(uint256 requested, uint256 available);

    constructor(address initialOwner)
        ERC20("ExampleToken", "EXT")
        ERC20Permit("ExampleToken")
        Ownable(initialOwner)
    {
        _mint(initialOwner, 100_000_000e18); // 100M initial
    }

    /// @notice Mint new tokens. Only callable by owner.
    /// @param to Recipient address.
    /// @param amount Amount in base units (18 decimals).
    function mint(address to, uint256 amount) external onlyOwner {
        if (totalSupply() + amount > MAX_SUPPLY) {
            revert ExceedsMaxSupply(amount, MAX_SUPPLY - totalSupply());
        }
        _mint(to, amount);
    }
}
```

## TypeScript — Deploy with viem

```typescript
import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

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

const hash = await walletClient.deployContract({
  abi: ExampleTokenAbi,
  bytecode: ExampleTokenBytecode,
  args: [account.address],
});

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== 'success') throw new Error('Deploy failed');
console.log('Token deployed at:', receipt.contractAddress);
```

## TypeScript — Transfer and Approve

```typescript
import { erc20Abi, formatUnits, parseUnits } from 'viem';

const TOKEN = '0xDeployedTokenAddress...' as const;

// Check balance
const balance = await publicClient.readContract({
  address: TOKEN,
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [account.address],
});
console.log('Balance:', formatUnits(balance, 18));

// Transfer tokens
const transferHash = await walletClient.writeContract({
  address: TOKEN,
  abi: erc20Abi,
  functionName: 'transfer',
  args: ['0xRecipient...', parseUnits('1000', 18)],
});

// Approve spender (use forceApprove pattern for USDT compatibility)
const approveHash = await walletClient.writeContract({
  address: TOKEN,
  abi: erc20Abi,
  functionName: 'approve',
  args: ['0xSpender...', parseUnits('5000', 18)],
});
```

## TypeScript — Gasless Approval via Permit

```typescript
const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour

const nonce = await publicClient.readContract({
  address: TOKEN,
  abi: erc20PermitAbi,
  functionName: 'nonces',
  args: [account.address],
});

const signature = await walletClient.signTypedData({
  domain: {
    name: 'ExampleToken',
    version: '1',
    chainId: sepolia.id,
    verifyingContract: TOKEN,
  },
  types: {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  },
  primaryType: 'Permit',
  message: {
    owner: account.address,
    spender: '0xSpender...',
    value: parseUnits('1000', 18),
    nonce,
    deadline,
  },
});

// Submit permit on-chain (can be sent by anyone — gasless for the token holder)
const { v, r, s } = parseSignature(signature);
const permitHash = await walletClient.writeContract({
  address: TOKEN,
  abi: erc20PermitAbi,
  functionName: 'permit',
  args: [account.address, '0xSpender...', parseUnits('1000', 18), deadline, v, r, s],
});
```

## Key Points

- OpenZeppelin v5 `ERC20Permit` inherits `EIP712` — domain separator is auto-managed with fork protection.
- `parseUnits`/`formatUnits` from viem handle decimal conversion. Never use JavaScript `Number` for token amounts.
- Always check `receipt.status` after transactions — reverted txs still return a receipt.
- For USDT compatibility, approve to 0 before setting a new nonzero allowance.

Last verified: March 2026
