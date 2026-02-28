# Deploy to Subgraph Studio Examples

Complete deployment workflow from local development to production on the decentralized network.

## Prerequisites

```bash
npm install -g @graphprotocol/graph-cli

# Verify installation
graph --version
```

## Step 1: Create Subgraph on Studio

1. Go to https://thegraph.com/studio/
2. Connect wallet
3. Click "Create a Subgraph"
4. Enter subgraph name (lowercase, hyphens, e.g., `my-token-tracker`)
5. Copy the deploy key from the dashboard

## Step 2: Authenticate

```bash
# Store deploy key locally (~/.graph)
graph auth --studio <DEPLOY_KEY>
```

This stores the key in `~/.graph` (macOS/Linux) or `%APPDATA%\graph` (Windows). The key persists across sessions on this machine.

For CI/CD, pass the key via environment variable:

```bash
GRAPH_AUTH_TOKEN=$DEPLOY_KEY graph deploy --studio my-token-tracker
```

## Step 3: Build and Deploy

```bash
# Generate types from schema and ABIs
graph codegen

# Compile to WebAssembly
graph build

# Deploy with version label
graph deploy --studio my-token-tracker --version-label v0.1.0
```

Version labels:
- Use semantic versioning: `v0.1.0`, `v0.2.0`, `v1.0.0`
- Each deploy creates a new version -- previous versions remain accessible
- Studio shows indexing progress per version

## Step 4: Monitor Indexing

After deployment, Studio shows:
- **Syncing progress** -- percentage of blocks indexed
- **Logs** -- handler execution logs and errors
- **Playground** -- test GraphQL queries against the deployed subgraph
- **Indexing errors** -- if a handler fails, the subgraph halts at that block

Check indexing status programmatically:

```graphql
{
  _meta {
    block {
      number
      hash
    }
    hasIndexingErrors
  }
}
```

## Step 5: Publish to Decentralized Network

After testing on Studio, publish to the decentralized network for production use.

1. Go to your subgraph in Studio
2. Click "Publish"
3. Select the network (Arbitrum One is used for The Graph Network)
4. Signal GRT on your subgraph (minimum curation signal is required for indexers to pick it up)
5. Wait for indexers to start serving your subgraph

Published subgraphs are queryable at:
```
https://gateway.thegraph.com/api/{api-key}/subgraphs/id/{subgraph-id}
```

## CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy-subgraph.yml
name: Deploy Subgraph

on:
  push:
    branches: [main]
    paths:
      - "subgraph/**"

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        working-directory: ./subgraph
        run: npm ci

      - name: Generate types
        working-directory: ./subgraph
        run: npx graph codegen

      - name: Build subgraph
        working-directory: ./subgraph
        run: npx graph build

      - name: Authenticate and Deploy
        working-directory: ./subgraph
        env:
          DEPLOY_KEY: ${{ secrets.SUBGRAPH_DEPLOY_KEY }}
        run: |
          npx graph auth --studio $DEPLOY_KEY
          npx graph deploy --studio my-token-tracker \
            --version-label v${{ github.run_number }}
```

Secrets required:
- `SUBGRAPH_DEPLOY_KEY` -- from Subgraph Studio dashboard

## Updating a Deployed Subgraph

### Schema Changes (Breaking)

Adding required fields or renaming entities requires re-indexing from `startBlock`.

```bash
# After modifying schema.graphql
graph codegen
graph build
graph deploy --studio my-token-tracker --version-label v0.2.0
```

The new version starts indexing from scratch. Previous versions continue serving queries until the new version catches up.

### Mapping Logic Changes (Non-Breaking)

Changing handler logic without schema changes still requires a new deployment. Subgraphs are deterministic -- the same events must produce the same entities, so any logic change means full re-index.

### Grafting (Skip Re-Indexing During Development)

For development iteration, graft from a previous deployment to skip re-indexing.

```yaml
# subgraph.yaml (development only -- not for production)
features:
  - grafting
graft:
  base: QmPreviousDeploymentId
  block: 18500000
```

Grafting rules:
- Only for development and testing
- Cannot publish grafted subgraphs to the decentralized network
- `base` is the IPFS deployment ID (Qm... hash) from a previous deploy
- New handlers execute from `block` onward, inheriting all prior entity state

## Multi-Network Deployment

Deploy the same subgraph to multiple networks using `graph-cli` network configs.

```json
// networks.json
{
  "mainnet": {
    "ERC20": {
      "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "startBlock": 6082465
    }
  },
  "arbitrum-one": {
    "ERC20": {
      "address": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      "startBlock": 70000000
    }
  },
  "base": {
    "ERC20": {
      "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "startBlock": 1000000
    }
  }
}
```

```bash
# Deploy to each network
graph deploy --studio my-token-mainnet --network mainnet --network-file networks.json
graph deploy --studio my-token-arbitrum --network arbitrum-one --network-file networks.json
graph deploy --studio my-token-base --network base --network-file networks.json
```

Each network requires a separate subgraph on Studio.

## Troubleshooting Deployment

| Issue | Cause | Fix |
|-------|-------|-----|
| `Authentication failed` | Deploy key is invalid or expired | Generate a new key in Studio. Re-run `graph auth --studio <KEY>`. |
| `Build failed: TS2322` | Type mismatch in AssemblyScript | Check that entity fields match schema types. Run `graph codegen` first. |
| `Subgraph not found` | Subgraph name does not match Studio | Verify the slug matches exactly (case-sensitive). |
| `Network not supported` | Chain not available on The Graph | Check supported networks at https://thegraph.com/docs/en/developing/supported-networks/ |
| Indexing halts after deploy | Handler threw an error at a specific block | Check Studio logs. Fix the handler logic, redeploy with new version. |
| Slow indexing | Too many contract reads, no `startBlock`, or mutable entities for event data | Set `startBlock`, use `try_` calls sparingly, mark event entities as `immutable: true`. |
