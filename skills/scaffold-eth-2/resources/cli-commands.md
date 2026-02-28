# Scaffold-ETH 2 CLI Commands

All commands run from the project root using yarn workspaces.

## Project Setup

| Command | Description |
|---------|-------------|
| `npx create-eth@latest` | Create a new SE2 project (Foundry default) |
| `npx create-eth@latest --hardhat` | Create a new SE2 project with Hardhat |
| `yarn install` | Install all workspace dependencies |

## Development

| Command | Description |
|---------|-------------|
| `yarn chain` | Start local Anvil (Foundry) or Hardhat Network |
| `yarn deploy` | Deploy contracts to the local chain |
| `yarn deploy --network sepolia` | Deploy contracts to Sepolia testnet |
| `yarn deploy --network mainnet` | Deploy contracts to Ethereum mainnet |
| `yarn start` | Start Next.js frontend at localhost:3000 |

## Testing

| Command | Description |
|---------|-------------|
| `yarn foundry:test` | Run Foundry tests (`forge test`) |
| `yarn hardhat:test` | Run Hardhat tests (if using Hardhat) |
| `yarn test` | Run tests for the active framework |

## Contract Verification

| Command | Description |
|---------|-------------|
| `yarn verify --network sepolia` | Verify contracts on Etherscan (Foundry) |
| `yarn hardhat-verify --network sepolia` | Verify contracts on Etherscan (Hardhat) |

## Frontend

| Command | Description |
|---------|-------------|
| `yarn start` | Start Next.js dev server |
| `yarn next:build` | Build Next.js for production |
| `yarn next:serve` | Serve the production build locally |
| `yarn vercel` | Deploy frontend to Vercel |

## Foundry-Specific

| Command | Description |
|---------|-------------|
| `yarn foundry:build` | Compile contracts (`forge build`) |
| `yarn foundry:lint` | Lint Solidity files |
| `yarn foundry:format` | Format Solidity files |

## Common Workflows

### Full Local Dev Loop

```bash
yarn chain          # Terminal 1
yarn deploy         # Terminal 2
yarn start          # Terminal 3
```

### Redeploy After Contract Changes

```bash
yarn deploy         # Recompiles, deploys, and regenerates deployedContracts.ts
```

### Deploy to Testnet

```bash
# Set DEPLOYER_PRIVATE_KEY in packages/foundry/.env
yarn deploy --network sepolia
```

## References

- SE2 docs: https://docs.scaffoldeth.io
- Foundry commands: https://book.getfoundry.sh/reference/

Last verified: February 2026
