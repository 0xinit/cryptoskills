# GMX V2 Contract Addresses

Verified contract addresses for GMX V2 on Arbitrum and Avalanche.

Last verified: February 2026. Always confirm at [docs.gmx.io/docs/api/contracts](https://docs.gmx.io/docs/api/contracts/).

## Arbitrum (Chain ID: 42161)

### Core Protocol

| Contract | Address | Description |
|----------|---------|-------------|
| ExchangeRouter | `0x69C527fC77291722b52649E45c838e41be8Bf5d5` | Entry point for orders, deposits, withdrawals |
| Router | `0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6` | Token approval target for ERC-20 transfers |
| Reader | `0x22199a49A999c351eF7927602CFB187ec3cae489` | Read markets, positions, orders (view-only) |
| DataStore | `0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8` | Protocol state storage |
| OrderVault | `0x31eF83a530Fde1B38EE9A18093A333D8Bbbc40D5` | Holds order collateral and execution fees |
| DepositVault | `0xF89e77e8Dc11691C9e8757e84aaFbCD8A67d7A55` | Holds liquidity deposit tokens |
| WithdrawalVault | `0x0628D46b5D145f183AdB6Ef1f2c97eD1C4701c55` | Holds withdrawal request tokens |

### Tokens

| Token | Address | Decimals |
|-------|---------|----------|
| WETH | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` | 18 |
| USDC (native) | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | 6 |
| USDC.e (bridged) | `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8` | 6 |
| USDT | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` | 6 |
| WBTC | `0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f` | 8 |
| ARB | `0x912CE59144191C1204E64559FE8253a0e49E6548` | 18 |
| LINK | `0xf97f4df75117a78c1A5a0DBb814Af92458539FB4` | 18 |
| UNI | `0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0` | 18 |
| SOL | `0x2bcC6D6CdBbDC0a4071e48bb3B969b06B3330c07` | 9 |
| GMX | `0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a` | 18 |

### Select Market Tokens (GM)

| Market | Market Token Address | Index Token | Long Token | Short Token |
|--------|---------------------|-------------|------------|-------------|
| ETH/USD | `0x70d95587d40A2caf56bd97485aB3Eec10Bee6336` | WETH | WETH | USDC |
| BTC/USD | `0x47c031236e19d024b42f8AE6780E44A573170703` | WBTC | WBTC | USDC |
| SOL/USD | `0x09400D9DB990D5ed3f35D7be61DfAEB900Af03C9` | SOL | SOL | USDC |
| ARB/USD | `0xC25cEf6061Cf5dE5eb761b50E4743c1F5D7E5407` | ARB | ARB | USDC |
| LINK/USD | `0x7f1fa204bb700853D36994DA19F830b6Ad18455C` | LINK | LINK | USDC |
| DOGE/USD | `0x6853EA96FF216fAb11D2d930CE3C508556A4bdc4` | WETH | WETH | USDC |
| UNI/USD | `0xc7Abb2C5f3BF3CEB389dF0Eecd6120D451170B50` | UNI | UNI | USDC |

> Market token addresses change when pools are redeployed. Verify current addresses using `Reader.getMarkets()` or the GMX interface.

### Staking

| Contract | Address | Description |
|----------|---------|-------------|
| RewardRouter V2 | `0xB95DB5B167D75e6d04227CfFFA61069348d271F5` | Stake GMX, esGMX, GLP |
| RewardRouter V2.2 | `0x5E4766F932ce00aA4a1A82d3Da85adf15C5694A1` | Latest reward router |

## Avalanche (Chain ID: 43114)

### Core Protocol

| Contract | Address | Description |
|----------|---------|-------------|
| ExchangeRouter | `0x3BE24aED1a4CcA8DE542b94218b3753A218bC0a0` | Entry point for orders, deposits, withdrawals |
| Router | `0x820F5FfC5b525cD4d88Cd91aCf2c28F16530Cc68` | Token approval target |
| Reader | `0x0537C767cDAD5Ef2b80b4F740a0f5D7c6cA46241` | Read markets, positions, orders |
| DataStore | `0x2F0b22339414ADeD7D5F06f9D604c7fF5b2fe3f6` | Protocol state storage |
| OrderVault | Verify on docs | Holds order collateral |
| DepositVault | `0x90c670825d0C62ede1c5ee9571d6d9a17A722DFF` | Holds liquidity deposit tokens |

### Tokens

| Token | Address | Decimals |
|-------|---------|----------|
| WAVAX | `0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7` | 18 |
| USDC | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` | 6 |
| USDC.e | `0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664` | 6 |
| WBTC.e | `0x50b7545627a5162F82A992c33b87aDc75187B218` | 8 |
| WETH.e | `0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB` | 18 |
| GMX | `0x62edc0692BD897D2295872a9FFCac5425011c661` | 18 |

> Avalanche contract addresses are subject to change. The Avalanche deployment has fewer markets than Arbitrum. Always verify on the official docs.

## API Endpoints

| Chain | Oracle URL | SubSquid URL |
|-------|-----------|--------------|
| Arbitrum | `https://arbitrum-api.gmxinfra.io` | `https://gmx.squids.live/gmx-synthetics-arbitrum:prod/api/graphql` |
| Avalanche | `https://avalanche-api.gmxinfra.io` | `https://gmx.squids.live/gmx-synthetics-avalanche:prod/api/graphql` |

## Verification

Verify any address on-chain before integrating:

```bash
# Arbitrum
cast code 0x69C527fC77291722b52649E45c838e41be8Bf5d5 --rpc-url https://arb1.arbitrum.io/rpc

# Avalanche
cast code 0x3BE24aED1a4CcA8DE542b94218b3753A218bC0a0 --rpc-url https://api.avax.network/ext/bc/C/rpc
```

## References

- [GMX Contracts Documentation](https://docs.gmx.io/docs/api/contracts/)
- [gmx-synthetics on GitHub](https://github.com/gmx-io/gmx-synthetics)
- [gmx-interface contracts config](https://github.com/gmx-io/gmx-interface/blob/master/src/config/contracts.ts)
