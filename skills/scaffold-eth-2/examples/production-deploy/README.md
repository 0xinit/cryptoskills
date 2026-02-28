# Production Deployment

End-to-end checklist for deploying an SE2 project to mainnet and hosting the frontend on Vercel.

## 1. Environment Variables

```bash
# packages/foundry/.env (or packages/hardhat/.env)
DEPLOYER_PRIVATE_KEY=0x_your_deployer_private_key
ETHERSCAN_API_KEY=your_etherscan_api_key
RPC_URL_MAINNET=https://eth-mainnet.g.alchemy.com/v2/your_key
```

Never commit `.env` files. The SE2 `.gitignore` excludes them by default.

## 2. Deploy Contracts to Mainnet

### Foundry

```bash
cd packages/foundry

forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL_MAINNET \
  --broadcast \
  --slow \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

The `--slow` flag waits for each transaction to confirm before sending the next, preventing nonce issues on mainnet.

### Hardhat

```bash
cd packages/hardhat
npx hardhat deploy --network mainnet
npx hardhat verify --network mainnet DEPLOYED_ADDRESS "constructor_arg_1"
```

## 3. Update deployedContracts.ts

After deploying to a live network, run the deploy from the project root to regenerate the contract bindings:

```bash
yarn deploy --network mainnet
```

This updates `packages/nextjs/contracts/deployedContracts.ts` with mainnet addresses and ABIs.

## 4. Configure scaffold.config.ts for Production

```typescript
// packages/nextjs/scaffold.config.ts
import { defineConfig } from "@scaffold-eth/config";
import * as chains from "viem/chains";

const scaffoldConfig = defineConfig({
  targetNetworks: [chains.mainnet],
  pollingInterval: 30000,
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? "",
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ?? "",
  onlyLocalBurnerWallet: true,
  walletAutoConnect: true,
});

export default scaffoldConfig;
```

Setting `onlyLocalBurnerWallet: true` disables the burner wallet on mainnet. Users connect with MetaMask, WalletConnect, or Coinbase Wallet.

## 5. Deploy Frontend to Vercel

### Option A: Vercel CLI

```bash
cd packages/nextjs
npx vercel --prod
```

### Option B: GitHub Integration

1. Push the repo to GitHub
2. Import the repository in the Vercel dashboard
3. Set the **Root Directory** to `packages/nextjs`
4. Set the **Framework Preset** to Next.js
5. Add environment variables in Vercel project settings:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | Your Alchemy API key |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | From cloud.walletconnect.com |

6. Click Deploy

## 6. Contract Verification

If contracts were not verified during deployment:

```bash
# Foundry
cd packages/foundry
forge verify-contract \
  --chain-id 1 \
  --compiler-version v0.8.19 \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  DEPLOYED_ADDRESS \
  src/YourContract.sol:YourContract

# Hardhat
cd packages/hardhat
npx hardhat verify --network mainnet DEPLOYED_ADDRESS "constructor_arg_1"
```

## 7. Post-Deployment Verification

Run through this checklist after deployment:

```bash
# Verify contract is deployed and verified
cast code DEPLOYED_ADDRESS --rpc-url $RPC_URL_MAINNET

# Read a public variable to confirm
cast call DEPLOYED_ADDRESS "owner()(address)" --rpc-url $RPC_URL_MAINNET

# Check Etherscan
open "https://etherscan.io/address/DEPLOYED_ADDRESS"
```

On the frontend:

1. Visit the production URL
2. Connect a wallet on mainnet
3. Read contract state (should match Etherscan)
4. Execute a write transaction (on testnet first if possible)
5. Verify transaction appears on Etherscan

## Production Hardening

| Check | Why |
|-------|-----|
| RPC endpoint is not a free public endpoint | Rate limits and reliability |
| Etherscan verification complete | Users can read source code |
| `onlyLocalBurnerWallet: true` | Prevent burner wallet on mainnet |
| Environment variables set in Vercel | Not hardcoded in source |
| `pollingInterval` is 30000+ | Reduce RPC calls on mainnet |
| CORS and CSP headers configured | Prevent frontend attacks |
| Contract ownership transferred (if applicable) | Deployer key is not the permanent admin |

Last verified: February 2026
