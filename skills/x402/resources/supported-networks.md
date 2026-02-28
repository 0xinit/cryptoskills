# x402 Supported Networks

Networks where x402 payment settlement is supported. All EVM networks use USDC with EIP-3009 `transferWithAuthorization`.

Last verified: February 2026

## EVM Networks

| Network | CAIP-2 ID | Chain ID | USDC Contract | Block Explorer |
|---------|-----------|----------|---------------|----------------|
| Base | `eip155:8453` | 8453 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | https://basescan.org |
| Base Sepolia | `eip155:84532` | 84532 | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | https://sepolia.basescan.org |
| Ethereum | `eip155:1` | 1 | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | https://etherscan.io |
| Arbitrum One | `eip155:42161` | 42161 | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | https://arbiscan.io |
| Optimism | `eip155:10` | 10 | `0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85` | https://optimistic.etherscan.io |
| Polygon PoS | `eip155:137` | 137 | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | https://polygonscan.com |

## Solana Networks

| Network | CAIP-2 ID | USDC Mint | Explorer |
|---------|-----------|-----------|----------|
| Solana Mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | https://explorer.solana.com |
| Solana Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` | https://explorer.solana.com/?cluster=devnet |

## CDP Facilitator Endpoints

| Environment | URL | Gas Cost |
|-------------|-----|----------|
| Mainnet (Base) | `https://api.cdp.coinbase.com/platform/v2/x402` | Free (gas absorbed) |
| Testnet | `https://api.cdp.coinbase.com/platform/v2/x402` | Free |

## Facilitator Pricing

| Tier | Transactions | Cost |
|------|-------------|------|
| Free | First 1,000/month | $0.00 |
| Standard | 1,001+ /month | $0.001 per transaction |

## Key Contracts (EVM)

| Contract | Address | Purpose |
|----------|---------|---------|
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Universal token approval (Uniswap) |
| x402ExactPermit2Proxy | `0x4020CD856C882D5fb903D99CE35316A085Bb0001` | Permit2-based settlement proxy |

Both contracts are deployed to the same address on all supported EVM chains via CREATE2.

## Network Identifier Format (CAIP-2)

x402 uses CAIP-2 (Chain Agnostic Improvement Proposal) identifiers:

- EVM: `eip155:<chainId>` (e.g., `eip155:8453` for Base)
- Solana: `solana:<genesisHash>` (e.g., `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`)

When configuring server middleware, use the full CAIP-2 string:

```typescript
{
  scheme: "exact",
  network: "eip155:8453",  // Base mainnet
  price: "$0.01",
  payTo: "0xYOUR_ADDRESS",
}
```
