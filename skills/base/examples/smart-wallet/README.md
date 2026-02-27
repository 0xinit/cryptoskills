# Coinbase Smart Wallet Examples

Coinbase Smart Wallet is a smart contract wallet that uses passkeys (WebAuthn) for authentication. No seed phrases, no browser extensions. Users authenticate with fingerprint, Face ID, or a hardware security key.

## Architecture

- Smart Wallet is an ERC-4337 smart contract account
- Deployed counterfactually (contract deploys on first transaction)
- Passkey stored in device secure enclave
- Compatible with any ERC-4337 bundler and paymaster
- Supports `wallet_sendCalls` (EIP-5792) for batch transactions

## wagmi Configuration

```typescript
// wagmi.ts
import { http, createConfig } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { coinbaseWallet } from 'wagmi/connectors';

export const config = createConfig({
  chains: [base, baseSepolia],
  connectors: [
    coinbaseWallet({
      appName: 'My dApp',
      // 'smartWalletOnly' — no browser extension, passkey only
      // 'all' — smart wallet + browser extension + mobile
      // 'eoaOnly' — browser extension only (no smart wallet)
      preference: 'smartWalletOnly',
    }),
  ],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
});
```

## Creating a Smart Wallet

The wallet is created when the user connects for the first time. The passkey prompt appears automatically.

```tsx
import { useAccount, useConnect, useDisconnect } from 'wagmi';

function ConnectSmartWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <div>
        <p>Connected: {address}</p>
        <button onClick={() => disconnect()}>Disconnect</button>
      </div>
    );
  }

  return (
    <button onClick={() => connect({ connector: connectors[0] })}>
      Create Smart Wallet
    </button>
  );
}
```

## Sending Transactions

Transactions from Smart Wallet are UserOperations under the hood. wagmi abstracts this — you use the same hooks as with an EOA.

```tsx
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';

const contractAbi = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'quantity', type: 'uint256' }],
    outputs: [],
  },
] as const;

function MintNFT() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleMint = () => {
    writeContract({
      address: '0xYourNFTContract' as `0x${string}`,
      abi: contractAbi,
      functionName: 'mint',
      args: [1n],
      value: parseEther('0.001'),
    });
  };

  return (
    <div>
      <button onClick={handleMint} disabled={isPending}>
        {isPending ? 'Confirming...' : 'Mint NFT'}
      </button>
      {isConfirming && <p>Waiting for confirmation...</p>}
      {isSuccess && <p>Minted! Tx: {hash}</p>}
    </div>
  );
}
```

## Batch Transactions (EIP-5792)

Smart Wallet supports `wallet_sendCalls` to send multiple contract calls atomically. The user sees one passkey prompt for all calls.

```tsx
import { useWriteContracts, useCallsStatus } from 'wagmi/experimental';

const erc20Abi = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const vaultAbi = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
] as const;

function ApproveAndDeposit() {
  const { writeContracts, data: batchId } = useWriteContracts();
  const { data: callsStatus } = useCallsStatus({
    id: batchId as string,
    query: { enabled: !!batchId },
  });

  const handleBatch = () => {
    const amount = 1_000_000n; // 1 USDC (6 decimals)

    writeContracts({
      contracts: [
        {
          address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
          abi: erc20Abi,
          functionName: 'approve',
          args: ['0xVaultAddress' as `0x${string}`, amount],
        },
        {
          address: '0xVaultAddress' as `0x${string}`,
          abi: vaultAbi,
          functionName: 'deposit',
          args: [amount],
        },
      ],
    });
  };

  return (
    <div>
      <button onClick={handleBatch}>Approve + Deposit (1 click)</button>
      {callsStatus && <p>Status: {callsStatus.status}</p>}
    </div>
  );
}
```

## Sponsored Batch Transactions

Combine batch calls with paymaster sponsorship for a zero-gas, single-click UX.

```tsx
import { useWriteContracts } from 'wagmi/experimental';

const PAYMASTER_URL = `https://api.developer.coinbase.com/rpc/v1/base/${process.env.NEXT_PUBLIC_CDP_API_KEY}`;

function SponsoredBatch() {
  const { writeContracts } = useWriteContracts();

  const handleSponsoredBatch = () => {
    writeContracts({
      contracts: [
        {
          address: '0xNFTContract' as `0x${string}`,
          abi: [{ name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }], outputs: [] }] as const,
          functionName: 'mint',
          args: ['0xRecipient' as `0x${string}`],
        },
      ],
      capabilities: {
        paymasterService: {
          url: PAYMASTER_URL,
        },
      },
    });
  };

  return <button onClick={handleSponsoredBatch}>Mint (Free, No Gas)</button>;
}
```

## Checking Smart Wallet vs EOA

```typescript
import { useAccount } from 'wagmi';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

async function isSmartWallet(address: `0x${string}`): Promise<boolean> {
  const code = await publicClient.getCode({ address });
  // Smart wallets have deployed bytecode; EOAs have none
  return code !== undefined && code !== '0x';
}
```

## Smart Contract Compatibility

If your contract uses `tx.origin == msg.sender` to block contract callers, it will also block Smart Wallet users. Remove this check or use a more targeted approach.

```solidity
// BAD: Blocks Smart Wallet users
require(tx.origin == msg.sender, "No contracts");

// BETTER: If you need to block flash loan attacks, use a reentrancy guard instead
// Smart Wallet users can interact normally
```

Smart Wallet implements ERC-1271 for signature verification. If your contract verifies signatures, support both ECDSA (EOA) and ERC-1271 (smart wallet):

```solidity
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

// Validates both EOA (ecrecover) and smart contract (ERC-1271) signatures
bool valid = SignatureChecker.isValidSignatureNow(signer, digest, signature);
```
