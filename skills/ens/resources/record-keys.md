# ENS Record Keys Reference

## Text Record Keys (ENSIP-5)

Standard text record keys defined in ENSIP-5 and widely adopted by wallets, dApps, and profiles.

### General

| Key | Description | Example |
|-----|-------------|---------|
| `email` | Email address | `me@example.com` |
| `url` | Website URL | `https://example.com` |
| `avatar` | Avatar image (ENSIP-12) | HTTPS URL, IPFS URI, or NFT reference |
| `description` | Short bio / description | `Web3 builder` |
| `display` | Display name (may differ from ENS name) | `Alice` |
| `notice` | A notice regarding this name | Free-form text |
| `keywords` | Comma-separated keywords | `ethereum,defi,developer` |
| `header` | Profile header / banner image | HTTPS or IPFS URL |

### Social Accounts

| Key | Description | Example |
|-----|-------------|---------|
| `com.twitter` | Twitter / X handle | `vitalikbuterin` |
| `com.github` | GitHub username | `vbuterin` |
| `com.discord` | Discord username | `alice#1234` |
| `org.telegram` | Telegram handle | `alice` |
| `com.reddit` | Reddit username | `vbuterin` |
| `com.linkedin` | LinkedIn profile path | `in/alice` |

### Avatar Format (ENSIP-12)

The `avatar` key supports three formats:

```
# HTTPS URL
https://example.com/avatar.png

# IPFS URI
ipfs://QmRAQB6YaCyidP37UdDnjFY5vQuiBrcqdyoW1CuDgwxkD4

# NFT reference (ERC-721 or ERC-1155)
eip155:1/erc721:0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d/1234
eip155:1/erc1155:0x495f947276749ce646f68ac8c248420045cb7b5e/123
```

viem's `getEnsAvatar()` resolves all three formats to an HTTPS URL.

## Content Hash Protocols

Content hashes are stored as multicodec-encoded bytes. Use `@ensdomains/content-hash` for encoding/decoding.

| Protocol | Codec | Example CID |
|----------|-------|-------------|
| IPFS | `0xe3` (ipfs-ns) | `QmRAQB6YaCyidP37UdDnjFY5vQuiBrcqdyoW1CuDgwxkD4` |
| Arweave | `0xb29910` (arweave-ns) | `Hhtt4E3g4NJiVB5HU2KPdE0eRRkuE3eyiRGhTghEKJ4` |
| Swarm | `0xe4` (swarm-ns) | Swarm reference hash |
| Onion | `0x1bc` (onion) | Tor .onion address |
| Onion3 | `0x1bd` (onion3) | Tor v3 .onion address |

## Multi-Coin Address Types (ENSIP-9 / EIP-2304)

Addresses for non-Ethereum chains use SLIP-44 coin types. EVM chains use ENSIP-11 encoding: `coinType = 0x80000000 | chainId`.

### SLIP-44 Coin Types

| Chain | Coin Type | Notes |
|-------|-----------|-------|
| Bitcoin | `0` | P2PKH, P2SH, bech32 |
| Litecoin | `2` | |
| Dogecoin | `3` | |
| Ethereum | `60` | Default when no coin type specified |
| Solana | `501` | |
| Cosmos | `118` | |
| Polkadot | `354` | |
| Tron | `195` | |

### EVM Chain Coin Types (ENSIP-11)

For EVM-compatible chains, the coin type is derived from the chain ID: `coinType = 0x80000000 | chainId`.

| Chain | Chain ID | Coin Type | Hex |
|-------|----------|-----------|-----|
| Optimism | 10 | `2147483658` | `0x8000000a` |
| BNB Chain | 56 | `2147483704` | `0x80000038` |
| Polygon | 137 | `2147483785` | `0x80000089` |
| Arbitrum One | 42161 | `2147525809` | `0x8000a4b1` |
| Avalanche C-Chain | 43114 | `2147526762` | `0x8000a86a` |
| Base | 8453 | `2147491901` | `0x8000210d` |

### Reading Multi-Coin Addresses

```typescript
// viem getEnsAddress supports coinType parameter
const btcAddress = await client.getEnsAddress({
  name: "vitalik.eth",
  coinType: 0,     // BTC
});

const solAddress = await client.getEnsAddress({
  name: "vitalik.eth",
  coinType: 501,   // Solana
});

const arbAddress = await client.getEnsAddress({
  name: "vitalik.eth",
  coinType: 2147525809, // Arbitrum (0x80000000 | 42161)
});
```

## References

- [ENSIP-5: Text Records](https://docs.ens.domains/ensip/5)
- [ENSIP-9: Multichain Address Resolution](https://docs.ens.domains/ensip/9)
- [ENSIP-11: EVM Chain Address Resolution](https://docs.ens.domains/ensip/11)
- [ENSIP-12: Avatar Text Records](https://docs.ens.domains/ensip/12)
- [SLIP-44 Coin Types](https://github.com/satoshilabs/slips/blob/master/slip-0044.md)
