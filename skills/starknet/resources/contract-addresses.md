# StarkNet Contract Addresses

## Core Infrastructure (Ethereum L1)

| Contract | Mainnet | Sepolia |
|----------|---------|---------|
| StarkNet Core | `0xc662c410C0ECf747543f5bA90660f6ABeBD9C8c4` | `0xE2Bb56ee936fd6433DC0F6e7e3b8365C906AA057` |
| STRK Token (L1 ERC-20) | `0xCa14007Eff0dB1f8135f4C25B34De49AB0d42766` | N/A |

Last verified: 2025-03

## Token Addresses (StarkNet L2)

| Token | Mainnet | Sepolia |
|-------|---------|---------|
| ETH | `0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7` | `0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7` |
| STRK | `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d` | `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d` |
| USDC | `0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8` | N/A |
| USDT | `0x068f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8` | N/A |
| DAI | `0x00da114221cb83fa859dbdb4c44beeaa0bb37c7537ad5ae66fe5e0efd20e6eb3` | N/A |
| WBTC | `0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac` | N/A |

Last verified: 2025-03

## Universal Deployer Contract (UDC)

Allows deploying contracts from other contracts with deterministic addresses. Same address on all networks.

| Network | Address |
|---------|---------|
| All networks | `0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf` |

## Account Class Hashes

These are the class hashes for popular account implementations. Use these when deploying new accounts.

| Account Type | Class Hash |
|-------------|------------|
| OpenZeppelin Account | `0x061dac032f228abef9c6f3bc2e2e5943e09e62e89b0c04aa42a93fba7a788688` |
| Argent X Account | `0x036078334509b514626504edc9fb252328d1a240e4e948bef8d0c08dff45927f` |
| Braavos Account | `0x00816dd0297efc55dc1e7559020a3a825e81ef734b558f03c83325d4da7e6253` |

Note: Account class hashes change with upgrades. Verify the latest version on the wallet provider's documentation before use.

Last verified: 2025-01

## Protocol Addresses (Mainnet)

### DEXs

| Protocol | Contract | Address |
|----------|----------|---------|
| Ekubo | Core | `0x00000005dd3d2f4429af886cd1a3b08289dbcea99a294197e9eb43b0e0325b4b` |
| JediSwap V2 | Factory | `0x0050637dc78c16fe8e9b5f2e7c8b2f1c3e6b0a3e4e4b6e0eb6f6d3a4e5d6e7f8` |
| mySwap | Router | `0x010884171baf1914edc28d7afb619b40a4051cfae78a094a55d230f19e944a28` |

### Lending

| Protocol | Contract | Address |
|----------|----------|---------|
| zkLend | Market | `0x04c0a5193d58f74fbace4b74dcf65481e734ed1714121bdc571da345540efa05` |
| Nostra | Main | `0x059a943ca214c10234b9a3b61c558ac20c005127d183b86a99a8f3c60a08b4ff` |

### Oracles

| Protocol | Contract | Address |
|----------|----------|---------|
| Pragma Oracle | Oracle | `0x2a85bd616f912537c50a49a4076db02c00b29b2cdc8a197ce92ed1837fa875b` |

Last verified: 2025-03. Always verify addresses on Voyager or Starkscan before interacting.

## Chain IDs

| Network | Chain ID (string) | Chain ID (felt252) |
|---------|-------------------|-------------------|
| Mainnet | `SN_MAIN` | `0x534e5f4d41494e` |
| Sepolia | `SN_SEPOLIA` | `0x534e5f5345504f4c4941` |

## Block Explorers

| Explorer | Mainnet | Sepolia |
|----------|---------|---------|
| Voyager | `https://voyager.online` | `https://sepolia.voyager.online` |
| Starkscan | `https://starkscan.co` | `https://sepolia.starkscan.co` |

## RPC Endpoints

| Provider | Mainnet URL | Free Tier |
|----------|-------------|-----------|
| Blast API | `https://starknet-mainnet.public.blastapi.io/rpc/v0_7` | Yes |
| Alchemy | `https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_7/<KEY>` | Yes |
| Infura | `https://starknet-mainnet.infura.io/v3/<KEY>` | Yes |
| Chainstack | `https://starknet-mainnet.core.chainstack.com/<KEY>` | Yes |
