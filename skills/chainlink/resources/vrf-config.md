# VRF v2.5 Configuration Reference

> **Last verified:** 2025-05-01

## VRF Coordinator Addresses

| Chain | Coordinator | Explorer |
|-------|-------------|----------|
| Ethereum | `0xD7f86b4b8Cae7D942340FF628F82735b7a20893a` | [Etherscan](https://etherscan.io/address/0xD7f86b4b8Cae7D942340FF628F82735b7a20893a) |
| Arbitrum | `0x3C0Ca683b403E37668AE3DC4FB62F4B29B6f7a3e` | [Arbiscan](https://arbiscan.io/address/0x3C0Ca683b403E37668AE3DC4FB62F4B29B6f7a3e) |
| Base | `0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634` | [Basescan](https://basescan.org/address/0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634) |
| Polygon | `0xec0Ed46f36576541C75739E915ADbCb3DE24bD77` | [Polygonscan](https://polygonscan.com/address/0xec0Ed46f36576541C75739E915ADbCb3DE24bD77) |
| Optimism | `0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE` | [Optimistic Etherscan](https://optimistic.etherscan.io/address/0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE) |
| BNB Chain | `0xd691f04bc0C9a24Edb78af9E005Cf85768F694C9` | [BscScan](https://bscscan.com/address/0xd691f04bc0C9a24Edb78af9E005Cf85768F694C9) |
| Avalanche | `0xE40895D055bccd2053D5Db228f5F2Ca6F8a5e960` | [Snowtrace](https://snowtrace.io/address/0xE40895D055bccd2053D5Db228f5F2Ca6F8a5e960) |

## Gas Lanes (keyHash) Per Chain

### Ethereum Mainnet

| Max Gas Price | keyHash |
|---------------|---------|
| 200 gwei | `0x8077df514608a09f83e4e8d300645594e5d7234665448ba83f51a50f842bd3d9` |
| 500 gwei | `0xff8dedfbfa60af186cf3c830acbc32c05aae823045ae5ea7da1e45fbfaba4f92` |
| 1000 gwei | `0x9fe0eebf5e446e3c998ec9bb19951541aee00bb90ea201ae456421a2ded86805` |

### Arbitrum One

| Max Gas Price | keyHash |
|---------------|---------|
| 2 gwei | `0x027f94ff1465b3525f9fc03e9ff7d6d2c0953482246dd6ae07570c45d6631414` |

### Base

| Max Gas Price | keyHash |
|---------------|---------|
| 30 gwei | `0x9e9e46732b32662b9adc6f3abdf6c5e926a666d174a4d6b8e39c4cca76a38897` |

### Polygon

| Max Gas Price | keyHash |
|---------------|---------|
| 500 gwei | `0x719ed7d7664abc3001c18aac8130a2265e1e70b7e036ae20f3ca8b92b3154571` |

### Optimism

| Max Gas Price | keyHash |
|---------------|---------|
| 30 gwei | `0x6e099d640cde6de9d40ac749b4b594126b0169747122711109c9985d47751f93` |

## Request Parameters

| Parameter | Min | Max | Recommended |
|-----------|-----|-----|-------------|
| `requestConfirmations` | 3 (mainnet), 1 (testnet) | 200 | 3 for most use cases |
| `callbackGasLimit` | 1 | ~2,500,000 | 200,000 for simple callbacks; profile on fork for complex logic |
| `numWords` | 1 | 500 | 1 unless you need multiple values per request |

## Subscription vs Direct Funding

| Aspect | Subscription | Direct Funding |
|--------|-------------|----------------|
| **Setup** | Create sub, add consumers, fund sub | Fund each consumer contract individually |
| **Payment** | Shared LINK/native pool across consumers | Each contract pays from its own balance |
| **Management** | One subscription dashboard for all consumers | Per-contract balance tracking |
| **Billing** | Pre-paid; charged on fulfillment | Pre-paid; wrapper handles coordinator interaction |
| **Flexibility** | Add/remove consumers dynamically | Each contract is standalone |
| **Best for** | Multi-contract projects, ongoing randomness | One-off contracts, simple integrations |
| **Base contract** | `VRFConsumerBaseV2Plus` | `VRFV2PlusWrapperConsumerBase` |
| **Coordinator** | Direct interaction via `s_vrfCoordinator` | Interaction through VRF Wrapper |

## LINK Token Addresses

| Chain | Address |
|-------|---------|
| Ethereum | `0x514910771AF9Ca656af840dff83E8264EcF986CA` |
| Arbitrum | `0xf97f4df75117a78c1A5a0DBb814Af92458539FB4` |
| Base | `0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196` |
| Polygon | `0xb0897686c545045aFc77CF20eC7A532E3120E0F1` |
| Optimism | `0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6` |
| BNB Chain | `0x404460C6A5EdE2D891e8297795264fDe62ADBB75` |
| Avalanche | `0x5947BB275c521040051D82396192181b413227A3` |

## Cost Estimation

VRF cost = gas used for verification + callback gas + LINK premium.

The premium varies by chain:
- Ethereum: 0.25 LINK flat fee per request
- Arbitrum: 0.005 LINK
- Base: 0.005 LINK
- Polygon: 0.005 LINK

Actual costs depend on gas price at fulfillment time. Use the [Chainlink VRF Cost Calculator](https://docs.chain.link/vrf/v2-5/estimating-costs) to estimate.

## Verification

```bash
# Check VRF Coordinator is deployed
cast code 0xD7f86b4b8Cae7D942340FF628F82735b7a20893a --rpc-url $ETH_RPC_URL

# Check LINK token balance of your subscription
cast call 0xD7f86b4b8Cae7D942340FF628F82735b7a20893a \
  "getSubscription(uint256)(uint96,uint96,uint64,address,address[])" \
  YOUR_SUB_ID --rpc-url $ETH_RPC_URL
```

Source: [Chainlink VRF v2.5 Supported Networks](https://docs.chain.link/vrf/v2-5/supported-networks)
