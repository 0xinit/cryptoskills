# Brian API Supported Networks

Complete list of chains supported by Brian API, with chain IDs and action availability.

Last verified: February 2026

## EVM Chains

| Chain | Chain ID | Swap | Bridge | Transfer | Deposit/Withdraw | Borrow/Repay |
|-------|----------|------|--------|----------|-------------------|--------------|
| Ethereum | 1 | Yes | Yes | Yes | Yes | Yes |
| Arbitrum One | 42161 | Yes | Yes | Yes | Yes | Yes |
| Optimism | 10 | Yes | Yes | Yes | Yes | Yes |
| Polygon | 137 | Yes | Yes | Yes | Yes | Yes |
| Base | 8453 | Yes | Yes | Yes | Yes | Yes |
| Avalanche C-Chain | 43114 | Yes | Yes | Yes | Yes | Yes |
| BNB Chain | 56 | Yes | Yes | Yes | No | No |
| Gnosis | 100 | Yes | Yes | Yes | No | No |
| Linea | 59144 | Yes | Yes | Yes | No | No |
| zkSync Era | 324 | Yes | Yes | Yes | No | No |
| Scroll | 534352 | Yes | Yes | Yes | No | No |
| Mode | 34443 | Yes | Yes | Yes | No | No |
| Taiko | 167000 | Yes | Yes | Yes | No | No |
| Blast | 81457 | Yes | Yes | Yes | No | No |

## Non-EVM Chains

| Chain | Swap | Bridge | Transfer | Deposit/Withdraw | Borrow/Repay |
|-------|------|--------|----------|-------------------|--------------|
| Solana | Yes (Jupiter) | Limited | Yes | No | No |
| StarkNet | Yes (Avnu.fi) | Limited | Yes | No | No |

Bridge support for Solana and StarkNet is limited. Not all bridge routes are available.

## Action Availability by Chain Tier

### Tier 1: Full DeFi Support

Ethereum, Arbitrum, Optimism, Polygon, Base, Avalanche

All actions supported: swap, bridge, transfer, deposit, withdraw, borrow, repay. DeFi actions route through Enso solver to interact with Aave and other lending protocols.

### Tier 2: Swap, Bridge, Transfer Only

BNB Chain, Gnosis, Linea, zkSync Era, Scroll, Mode, Taiko, Blast

Swap and bridge routed through LI.FI/Bungee/Portals. DeFi protocol interactions (deposit, withdraw, borrow, repay) are not available.

### Tier 3: Limited Support

Solana, StarkNet

Swap supported via chain-native solvers (Jupiter for Solana, Avnu.fi for StarkNet). Bridge support is partial. Transfer works for native tokens and major SPL/StarkNet tokens.

## Passing Chain Information

### Via `chainId` parameter

```typescript
const response = await brian.transact({
  prompt: "Swap 10 USDC for ETH",
  address: "0x...",
  chainId: "8453",
});
```

### Via prompt text

```typescript
const response = await brian.transact({
  prompt: "Swap 10 USDC for ETH on Base",
  address: "0x...",
});
```

### Priority

1. If `chainId` is provided in the request body, it takes precedence
2. If not, Brian extracts the chain from the prompt text
3. If neither is present and the chain is ambiguous, the API returns an error

## RPC Considerations

Brian's API generates transaction calldata but does not broadcast. Your application must connect to the appropriate chain's RPC to sign and send.

| Chain | Public RPC | Notes |
|-------|-----------|-------|
| Ethereum | `https://eth.llamarpc.com` | Use a paid RPC for production |
| Arbitrum | `https://arb1.arbitrum.io/rpc` | |
| Optimism | `https://mainnet.optimism.io` | |
| Polygon | `https://polygon-rpc.com` | |
| Base | `https://mainnet.base.org` | |
| Avalanche | `https://api.avax.network/ext/bc/C/rpc` | |
| BNB Chain | `https://bsc-dataseed.binance.org` | |
| Gnosis | `https://rpc.gnosischain.com` | |
| Linea | `https://rpc.linea.build` | |
| zkSync Era | `https://mainnet.era.zksync.io` | |

## Testnets

Brian API primarily targets mainnets. Testnet support is limited and not guaranteed for all actions. Check the API documentation for current testnet availability.
