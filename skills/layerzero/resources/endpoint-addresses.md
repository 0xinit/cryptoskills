# LayerZero V2 Endpoint Addresses

> **Last verified:** February 2026

Verified deployment addresses for LayerZero V2 protocol contracts. All addresses are checksummed.

## EndpointV2

EndpointV2 is deployed at the same address on all supported EVM chains via `CREATE2`.

| Chain | Endpoint ID (eid) | Chain ID | EndpointV2 |
|-------|-------------------|----------|------------|
| Ethereum | `30101` | 1 | `0x1a44076050125825900e736c501f859c50fE728c` |
| Arbitrum | `30110` | 42161 | `0x1a44076050125825900e736c501f859c50fE728c` |
| Optimism | `30111` | 10 | `0x1a44076050125825900e736c501f859c50fE728c` |
| Polygon | `30109` | 137 | `0x1a44076050125825900e736c501f859c50fE728c` |
| Base | `30184` | 8453 | `0x1a44076050125825900e736c501f859c50fE728c` |
| Avalanche | `30106` | 43114 | `0x1a44076050125825900e736c501f859c50fE728c` |
| BNB Chain | `30102` | 56 | `0x1a44076050125825900e736c501f859c50fE728c` |

## Send Libraries (SendUln302)

| Chain | Address |
|-------|---------|
| Ethereum | `0xbB2Ea70C9E858123480642Cf96acbcCE1372dCe1` |
| Arbitrum | `0x975bcD720be66659e3EB3C0e4F1866a3020E493A` |
| Optimism | `0x1322871e4ab09Bc7f5717189434f97bBD9546e95` |
| Polygon | `0x6c26c61a97006888ea9E4FA36584c7df57Cd9dA3` |
| Base | `0xB5320B0B3a13cC860893E2Bd79FCd7e13484Dda2` |

## Receive Libraries (ReceiveUln302)

| Chain | Address |
|-------|---------|
| Ethereum | `0xc02Ab410f0734EFa3F14628780e6e695156024C2` |
| Arbitrum | `0x7B9E184e07a6EE1aC23eAe0fe8D6Be60f4f19eF3` |
| Optimism | `0x3c4962Ff6258dcfCafD23a814237571571899985` |
| Polygon | `0x1322871e4ab09Bc7f5717189434f97bBD9546e95` |
| Base | `0xc70AB6f32772f59fBfc23889Caf4Ba3376C84bAf` |

## Default Executor

| Chain | Address |
|-------|---------|
| Ethereum | `0x173272739Bd7Aa6e4e214714048a9fE699453059` |
| Arbitrum | `0x31CAe3B7fB82d847621859571BF619D4600e37c8` |
| Optimism | `0x2D2ea0697bdbede3F01553D2Ae4B8d0c486B666e` |
| Polygon | `0xCd3F213AD101472e1713C72B1697E727C803885b` |
| Base | `0x2CCA08ae69E0C44b18a57Ab36A1CCb013C54B1d3` |

## Endpoint ID Reference

LayerZero uses its own Endpoint ID (eid) system. These do NOT correspond to chain IDs.

| Chain | eid | Chain ID |
|-------|-----|----------|
| Ethereum | `30101` | 1 |
| BNB Chain | `30102` | 56 |
| Avalanche | `30106` | 43114 |
| Polygon | `30109` | 137 |
| Arbitrum | `30110` | 42161 |
| Optimism | `30111` | 10 |
| Fantom | `30112` | 250 |
| Metis | `30151` | 1088 |
| Base | `30184` | 8453 |
| Scroll | `30214` | 534352 |
| zkSync Era | `30165` | 324 |
| Linea | `30183` | 59144 |
| Mantle | `30181` | 5000 |

### Testnet Endpoint IDs

| Chain | eid | Chain ID |
|-------|-----|----------|
| Sepolia | `40161` | 11155111 |
| Arbitrum Sepolia | `40231` | 421614 |
| Base Sepolia | `40245` | 84532 |
| Optimism Sepolia | `40232` | 11155420 |
| Mumbai (Polygon) | `40109` | 80001 |

## Verification

Verify any address on-chain before use:

```bash
# Check contract has code deployed
cast code 0x1a44076050125825900e736c501f859c50fE728c --rpc-url $RPC_URL

# Check endpoint eid
cast call 0x1a44076050125825900e736c501f859c50fE728c "eid()(uint32)" --rpc-url $RPC_URL

# Check delegate for an OApp
cast call <oapp_address> "endpoint()(address)" --rpc-url $RPC_URL
```

## Reference

- [Official V2 Deployed Contracts](https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts)
- [Endpoint ID List](https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts)
