# Brian API Action Reference

Complete reference for all supported actions, their parameters, and solver routing.

Last verified: February 2026

## Actions

### swap

Exchange one token for another on the same chain.

| Parameter | Source | Required | Notes |
|-----------|--------|----------|-------|
| From token | Prompt | Yes | Token symbol (e.g., "USDC") |
| To token | Prompt | Yes | Token symbol (e.g., "ETH") |
| Amount | Prompt | Yes | Numeric amount in human-readable units |
| Chain | Prompt or `chainId` | Yes | Must be unambiguous |

**Solvers**: Enso, LI.FI, Portals

**Prompt examples**:
```
"Swap 100 USDC for ETH on Base"
"Exchange 0.5 WETH for DAI on Arbitrum"
"Trade 1000 USDT for WBTC on Ethereum"
```

**Response steps**:
1. Token approval (if swapping from ERC-20)
2. Swap execution

---

### bridge

Move the same token from one chain to another.

| Parameter | Source | Required | Notes |
|-----------|--------|----------|-------|
| Token | Prompt | Yes | Token symbol |
| Amount | Prompt | Yes | Numeric amount |
| Source chain | Prompt or `chainId` | Yes | Chain to bridge from |
| Destination chain | Prompt | Yes | Chain to bridge to |

**Solvers**: Bungee, LI.FI, Symbiosis

**Prompt examples**:
```
"Bridge 0.5 ETH from Ethereum to Base"
"Move 1000 USDC from Arbitrum to Optimism"
"Send 500 DAI from Polygon to Ethereum"
```

**Response steps**:
1. Token approval (if bridging ERC-20)
2. Bridge initiation on source chain

Destination delivery is handled asynchronously by the bridge protocol (typically 2-20 minutes).

---

### cross-chain swap

Bridge AND swap in a single operation. The token received on the destination chain differs from the token sent.

| Parameter | Source | Required | Notes |
|-----------|--------|----------|-------|
| From token | Prompt | Yes | Token symbol on source chain |
| To token | Prompt | Yes | Token symbol on destination chain |
| Amount | Prompt | Yes | Numeric amount |
| Source chain | Prompt or `chainId` | Yes | Origin chain |
| Destination chain | Prompt | Yes | Target chain |

**Solvers**: LI.FI, Bungee

**Prompt examples**:
```
"Swap 0.1 ETH on Ethereum for USDC on Base"
"Convert 1000 USDC on Arbitrum to ETH on Optimism"
```

---

### transfer

Send tokens to another wallet address.

| Parameter | Source | Required | Notes |
|-----------|--------|----------|-------|
| Token | Prompt | Yes | Token symbol or "ETH" for native |
| Amount | Prompt | Yes | Numeric amount |
| Recipient | Prompt | Yes | 0x address or ENS name |
| Chain | Prompt or `chainId` | Yes | Must be unambiguous |

**Solver**: Native (no third-party solver)

**Prompt examples**:
```
"Transfer 100 USDC to 0xRecipient on Base"
"Send 0.5 ETH to vitalik.eth on Ethereum"
"Send 50 DAI to 0xRecipient on Polygon"
```

**Response steps**:
1. Token approval (if transferring ERC-20, may not always be needed)
2. Transfer execution

---

### deposit

Deposit tokens into a DeFi lending/yield protocol.

| Parameter | Source | Required | Notes |
|-----------|--------|----------|-------|
| Token | Prompt | Yes | Token to deposit |
| Amount | Prompt | Yes | Numeric amount |
| Protocol | Prompt | Recommended | e.g., "Aave", "Compound" |
| Chain | Prompt or `chainId` | Yes | Limited to supported chains |

**Solver**: Enso

**Supported chains**: Ethereum (1), Arbitrum (42161), Optimism (10), Polygon (137), Base (8453), Avalanche (43114)

**Prompt examples**:
```
"Deposit 1000 USDC into Aave on Ethereum"
"Supply 2 ETH to Aave on Arbitrum"
"Deposit 500 DAI into Compound on Base"
```

**Response steps**:
1. Token approval
2. Deposit into protocol (mints receipt tokens like aUSDC)

---

### withdraw

Withdraw tokens from a DeFi protocol position.

| Parameter | Source | Required | Notes |
|-----------|--------|----------|-------|
| Token | Prompt | Yes | Token to withdraw |
| Amount | Prompt | Yes | Numeric amount |
| Protocol | Prompt | Recommended | Protocol to withdraw from |
| Chain | Prompt or `chainId` | Yes | Limited to supported chains |

**Solver**: Enso

**Supported chains**: Same as deposit

**Prompt examples**:
```
"Withdraw 500 USDC from Aave on Ethereum"
"Remove 1 ETH from Aave on Polygon"
```

**Response steps**:
1. Withdrawal execution (burns receipt tokens, returns underlying)

---

### borrow

Borrow tokens from a lending protocol against existing collateral.

| Parameter | Source | Required | Notes |
|-----------|--------|----------|-------|
| Token | Prompt | Yes | Token to borrow |
| Amount | Prompt | Yes | Numeric amount |
| Protocol | Prompt | Recommended | Primarily Aave |
| Chain | Prompt or `chainId` | Yes | Limited to supported chains |

**Solver**: Enso

**Supported chains**: Same as deposit

**Prerequisite**: Must have collateral deposited in the protocol first.

**Prompt examples**:
```
"Borrow 500 USDC from Aave on Ethereum"
"Borrow 1000 DAI from Aave on Arbitrum"
```

---

### repay

Repay borrowed tokens to a lending protocol.

| Parameter | Source | Required | Notes |
|-----------|--------|----------|-------|
| Token | Prompt | Yes | Token to repay |
| Amount | Prompt | Yes | Numeric amount |
| Protocol | Prompt | Recommended | Protocol the debt is on |
| Chain | Prompt or `chainId` | Yes | Limited to supported chains |

**Solver**: Enso

**Supported chains**: Same as deposit

**Prompt examples**:
```
"Repay 500 USDC to Aave on Ethereum"
"Pay back 1000 DAI on Aave on Arbitrum"
```

**Response steps**:
1. Token approval
2. Repay execution (reduces debt position)

## Solvers

Brian routes transactions through third-party solvers for optimal execution.

| Solver | Actions | Description |
|--------|---------|-------------|
| Enso | swap, deposit, withdraw, borrow, repay | DeFi aggregator. Handles protocol interactions. |
| LI.FI | swap, bridge, cross-chain swap | Cross-chain liquidity aggregator. 20+ bridges, 30+ DEXs. |
| Bungee | bridge, cross-chain swap | Socket/Bungee bridge aggregator. |
| Portals | swap | DEX aggregator with MEV protection. |
| Symbiosis | bridge | Cross-chain liquidity protocol. |
| Avnu.fi | swap | StarkNet DEX aggregator. |
| Jupiter | swap | Solana DEX aggregator. |

## Response Schema

Every action returns the same top-level structure:

```typescript
interface BrianTransactionResponse {
  result: Array<{
    solver: string;
    action: string;
    type: "write";
    data: {
      description: string;
      steps: Array<{
        chainId: number;
        to: string;
        from: string;
        data: string;
        value: string;
        gasLimit?: string;
      }>;
      fromToken: {
        address: string;
        chainId: number;
        symbol: string;
        decimals: number;
      };
      toToken: {
        address: string;
        chainId: number;
        symbol: string;
        decimals: number;
      };
      fromAmount: string;
      toAmount: string;
    };
  }>;
}
```

Multiple results may be returned (e.g., different swap routes). Each result's `steps` array must be executed sequentially.
