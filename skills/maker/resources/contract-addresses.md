# Maker / Sky Protocol Contract Addresses

> **Last verified:** 2025-05-01

All addresses are checksummed. Verify on-chain before mainnet use. The canonical source of truth is the [Maker Changelog](https://chainlog.makerdao.com/).

## Core System (Ethereum Mainnet)

| Contract | Address | Description |
|----------|---------|-------------|
| Vat | `0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B` | Core accounting engine |
| Dog | `0x135954d155898D42C90D2a57824C690e0c7BEf1B` | Liquidation 2.0 trigger |
| Jug | `0x19c0976f590D67707E62397C87829d896Dc0f1F1` | Stability fee accumulator |
| Pot | `0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7` | DAI Savings Rate |
| Vow | `0xA950524441892A31ebddF91d3cEEFa04Bf454466` | System surplus/debt |
| Spotter | `0x65C79fcB50Ca1594B025960e539eD7A9a6D434A3` | Oracle price feed relay |
| CdpManager | `0x5ef30b9986345249bc32d8928B7ee64DE9435E39` | Vault registry |
| DSChief | `0x0a3f6849f78076aefaDf113F5BED87720274dDC0` | Governance voting |
| End | `0x0e2e8F1D1326A4B9633D96222Ce399c708B19c28` | Emergency shutdown |

## User-Facing Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| DssProxyActions | `0x82ecD135Dce65Fbc6DbdD0e4237E0AF93FFD5038` | Vault action library |
| DssProxyActionsEnd | `0x069B2fb501b6F16D1F5fE245B16F6993808f1008` | Emergency shutdown actions |
| ProxyRegistry | `0x4678f0a6958e4D2Bc4F1BAF7Bc52E8F3564f3fE4` | DSProxy factory |
| DsrManager | `0x373238337Bfe1146fb49989fc222523f83081dDb` | Simplified DSR interface |

## Join Adapters

| Contract | Address | Ilk |
|----------|---------|-----|
| DaiJoin | `0x9759A6Ac90977b93B58547b4A71c78317f391A28` | (DAI minting) |
| ETH-A GemJoin | `0x2F0b23f53734252Bda2277357e97e1517d6B042A` | ETH-A |
| ETH-B GemJoin | `0x08638eF1A205bE6762A8b935F5da9b700Cf7322c` | ETH-B |
| ETH-C GemJoin | `0xF04a5cC80B1E94C69B48f5ee68a08CD2F09A7c3E` | ETH-C |
| WBTC-A GemJoin | `0xBF72Da2Bd84c5170618Fbe5914B0ECA9638d5eb5` | WBTC-A |
| WSTETH-A GemJoin | `0x10CD5fbe1b404B7E19Ef964B63939907bdaf42E2` | WSTETH-A |
| WSTETH-B GemJoin | `0x248cCBf4864221fC0E840F29BB042ad5bFC89B5c` | WSTETH-B |
| RETH-A GemJoin | `0xC6424e862f1462281B0a5FAc078e4b63006bDEBF` | RETH-A |

## Clipper Contracts (Liquidation 2.0)

| Contract | Address | Ilk |
|----------|---------|-----|
| Clipper ETH-A | `0xc67963a226eddd77B91aD8c421630A1b0AdFF270` | ETH-A |
| Clipper ETH-B | `0x71eb894330e8a4b96b8d6056962e7F116F50e590` | ETH-B |
| Clipper ETH-C | `0xc2b12567523e3f3CBd524F0B6c8F1a7D46281081` | ETH-C |
| Clipper WBTC-A | `0x0227b54AdbFAEec5f1eD1dFa11f54dcff9076e2C` | WBTC-A |
| Clipper WSTETH-A | `0x49A33A28C4C7D9576ab28898F4C9ac7e52EA457A` | WSTETH-A |
| Clipper WSTETH-B | `0x3ea60191b7e5B41bA89D0BD81965040EB42C4dBb` | WSTETH-B |

## Token Contracts

| Token | Address | Decimals |
|-------|---------|----------|
| DAI | `0x6B175474E89094C44Da98b954EedeAC495271d0F` | 18 |
| MKR | `0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2` | 18 |
| USDS | `0xdC035D45d973E3EC169d2276DDab16f1e407384F` | 18 |
| SKY | `0x56072C95FAA7932F4D8Aa042BE0611d2a2CE73a5` | 18 |
| sUSDS | `0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD` | 18 |
| sDAI | `0x83F20F44975D03b1b09e64809B757c47f942BEeA` | 18 |

## Sky Migration Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| DaiUsds | `0x3225737a9Bbb6473CB4a45b7244ACa2BeFdB276A` | DAI <-> USDS converter (1:1) |
| MkrSky | `0xBDcFCA946b6CDd965f99a839e4435Bcdc1bc470B` | MKR <-> SKY converter (1:24000) |

## Spark Protocol (Aave V3 Fork)

| Contract | Address | Description |
|----------|---------|-------------|
| Spark Pool | `0xC13e21B648A5Ee794902342038FF3aDAB66BE987` | Aave V3 lending pool |
| Spark PoolAddressesProvider | `0x02C3eA4e34C0cBd694D2adFa2c690EECbC1793eE` | Addresses registry |

## Common Collateral Tokens

| Token | Address | Decimals |
|-------|---------|----------|
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | 18 |
| WBTC | `0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599` | 8 |
| wstETH | `0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0` | 18 |
| rETH | `0xae78736Cd615f374D3085123A210448E74Fc6393` | 18 |

## Verification

```bash
# Verify Vat has code
cast code 0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B --rpc-url $RPC_URL

# Verify CdpManager
cast code 0x5ef30b9986345249bc32d8928B7ee64DE9435E39 --rpc-url $RPC_URL

# Verify DaiUsds migration contract
cast code 0x3225737a9Bbb6473CB4a45b7244ACa2BeFdB276A --rpc-url $RPC_URL

# Read current DSR rate
cast call 0x197E90f9FAD81970bA7976f33CbD77088E5D7cf7 "dsr()(uint256)" --rpc-url $RPC_URL

# Read total DAI supply
cast call 0x6B175474E89094C44Da98b954EedeAC495271d0F "totalSupply()(uint256)" --rpc-url $RPC_URL

# Read MKR to SKY conversion rate
cast call 0xBDcFCA946b6CDd965f99a839e4435Bcdc1bc470B "rate()(uint256)" --rpc-url $RPC_URL
```

## References

- [Maker Changelog (canonical addresses)](https://chainlog.makerdao.com/)
- [Maker Technical Docs](https://docs.makerdao.com/)
- [Sky Protocol Docs](https://docs.sky.money/)
- [Etherscan Maker Contracts](https://etherscan.io/accounts/label/maker)
