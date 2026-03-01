# GOAT Supported Chains

Complete list of chains supported by GOAT SDK through wallet providers and plugins.

Last verified: February 2026

## EVM Chains

All EVM chains share the `@goat-sdk/wallet-viem` wallet provider. Pass the appropriate viem chain object.

| Chain | Chain ID | viem Import | Native Token |
|-------|----------|-------------|--------------|
| Ethereum | 1 | `mainnet` | ETH |
| Arbitrum One | 42161 | `arbitrum` | ETH |
| Arbitrum Sepolia | 421614 | `arbitrumSepolia` | ETH |
| Base | 8453 | `base` | ETH |
| Base Sepolia | 84532 | `baseSepolia` | ETH |
| Optimism | 10 | `optimism` | ETH |
| Optimism Sepolia | 11155420 | `optimismSepolia` | ETH |
| Polygon | 137 | `polygon` | POL |
| Polygon Amoy | 80002 | `polygonAmoy` | POL |
| BNB Smart Chain | 56 | `bsc` | BNB |
| Avalanche C-Chain | 43114 | `avalanche` | AVAX |
| Gnosis | 100 | `gnosis` | xDAI |
| Celo | 42220 | `celo` | CELO |
| Fantom | 250 | `fantom` | FTM |
| Linea | 59144 | `linea` | ETH |
| Scroll | 534352 | `scroll` | ETH |
| zkSync Era | 324 | `zkSync` | ETH |
| Mantle | 5000 | `mantle` | MNT |
| Mode | 34443 | `mode` | ETH |
| Blast | 81457 | `blast` | ETH |
| Sepolia | 11155111 | `sepolia` | ETH |
| Holesky | 17000 | `holesky` | ETH |
| Sei EVM | 1329 | `sei` | SEI |
| Metis | 1088 | `metis` | METIS |
| Moonbeam | 1284 | `moonbeam` | GLMR |
| Zora | 7777777 | `zora` | ETH |

### EVM Usage

```typescript
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { viem } from "@goat-sdk/wallet-viem";

const walletClient = createWalletClient({
  account: privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`),
  chain: base,
  transport: http(process.env.RPC_URL),
});

const wallet = viem(walletClient);
```

## Non-EVM Chains

Each non-EVM chain has a dedicated wallet provider package.

| Chain | Wallet Package | Native Token | Status |
|-------|---------------|--------------|--------|
| Solana | `@goat-sdk/wallet-solana` | SOL | Stable |
| Aptos | `@goat-sdk/wallet-aptos` | APT | Stable |
| Sui | `@goat-sdk/wallet-sui` | SUI | Stable |
| Cosmos | `@goat-sdk/wallet-cosmos` | ATOM | Stable |
| Starknet | `@goat-sdk/wallet-starknet` | STRK | Stable |
| Chromia | `@goat-sdk/wallet-chromia` | CHR | Stable |
| Fuel | `@goat-sdk/wallet-fuel` | ETH | Stable |
| Radix | `@goat-sdk/wallet-radix` | XRD | Stable |
| Zilliqa | `@goat-sdk/wallet-zilliqa` | ZIL | Stable |
| Zetrix | `@goat-sdk/wallet-zetrix` | ZTX | Stable |
| Lit Protocol | `@goat-sdk/wallet-lit` | — | Stable |
| MultiversX | `goat-sdk-wallet-multiversx` (Python) | EGLD | Python only |

### Solana Usage

```typescript
import { Connection, Keypair } from "@solana/web3.js";
import { solana } from "@goat-sdk/wallet-solana";
import bs58 from "bs58";

const keypair = Keypair.fromSecretKey(
  bs58.decode(process.env.SOLANA_PRIVATE_KEY as string)
);
const connection = new Connection(process.env.SOLANA_RPC_URL as string);

const wallet = solana({ keypair, connection });
```

### Aptos Usage

```typescript
import { aptos } from "@goat-sdk/wallet-aptos";

const wallet = aptos({
  privateKey: process.env.APTOS_PRIVATE_KEY as string,
  nodeUrl: process.env.APTOS_NODE_URL as string,
});
```

## Smart Wallet Providers

| Provider | Package | Supported Chains |
|----------|---------|------------------|
| Crossmint | `@goat-sdk/wallet-crossmint` | EVM + Solana |
| Gnosis Safe | `@goat-sdk/wallet-safe` | EVM |

### Crossmint Usage

```typescript
import { crossmint } from "@goat-sdk/wallet-crossmint";

const wallet = crossmint({
  apiKey: process.env.CROSSMINT_API_KEY as string,
  walletAddress: process.env.CROSSMINT_WALLET_ADDRESS as string,
  chain: "base",
});
```

## Chain Type Definitions

GOAT uses a discriminated union for chain types:

```typescript
type Chain =
  | EvmChain
  | SolanaChain
  | AptosChain
  | ChromiaChain
  | CosmosChain
  | FuelChain
  | LitChain
  | RadixChain
  | StarknetChain
  | SuiChain
  | ZetrixChain
  | ZilliqaChain;

type EvmChain = { type: "evm"; id: number };
type SolanaChain = { type: "solana" };
type AptosChain = { type: "aptos" };
```

Plugins declare chain support via `supportsChain()`:

```typescript
supportsChain = (chain: Chain) => chain.type === "evm";
```
