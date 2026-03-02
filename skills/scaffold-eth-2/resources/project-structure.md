# Scaffold-ETH 2 Project Structure

Complete directory tree for a Foundry-based SE2 project. Hardhat projects replace `packages/foundry` with `packages/hardhat` but the `packages/nextjs` structure is identical.

## Root

```
your-project/
├── packages/
│   ├── foundry/              # Smart contract workspace
│   └── nextjs/               # Frontend workspace
├── package.json              # Yarn workspaces root
├── yarn.lock
├── .gitignore
└── .env.example              # Template for environment variables
```

## packages/foundry

```
packages/foundry/
├── contracts/                # Solidity source files
│   └── YourContract.sol      # Default starter contract
├── script/
│   ├── Deploy.s.sol          # Main deploy script
│   └── DeployHelpers.s.sol   # SE2 deploy helpers (do not modify)
├── test/
│   └── YourContract.t.sol    # Foundry tests
├── deployments/              # Generated deployment artifacts (per chain)
├── foundry.toml              # Foundry configuration
├── remappings.txt            # Solidity import remappings
├── .env                      # Private keys and API keys (gitignored)
└── package.json
```

## packages/nextjs

```
packages/nextjs/
├── app/                      # Next.js App Router
│   ├── layout.tsx            # Root layout with providers
│   ├── page.tsx              # Home page
│   ├── debug/
│   │   └── page.tsx          # Auto-generated contract debug UI
│   └── blockexplorer/
│       └── page.tsx          # Built-in block explorer for local chain
│
├── components/
│   ├── Header.tsx            # Navigation header
│   ├── Footer.tsx            # Site footer
│   └── scaffold-eth/         # SE2 component library
│       ├── Address.tsx       # Address display with ENS, copy, explorer link
│       ├── Balance.tsx       # ETH balance display
│       ├── EtherInput.tsx    # ETH input with USD conversion
│       ├── AddressInput.tsx  # Address input with ENS resolution
│       ├── IntegerInput.tsx  # uint256 input with bigint handling
│       ├── RainbowKitCustomConnectButton.tsx
│       ├── BlockieAvatar.tsx
│       └── ...               # Additional UI primitives
│
├── contracts/
│   ├── deployedContracts.ts  # Auto-generated: ABI + address per chain
│   └── externalContracts.ts  # Manual: third-party contract ABIs
│
├── hooks/
│   └── scaffold-eth/         # SE2 custom hooks
│       ├── useScaffoldReadContract.ts
│       ├── useScaffoldWriteContract.ts
│       ├── useScaffoldMultiWriteContract.ts
│       ├── useDeployedContractInfo.ts
│       ├── useScaffoldEventHistory.ts
│       ├── useScaffoldWatchContractEvent.ts
│       ├── useTransactor.ts
│       ├── useTargetNetwork.ts
│       └── index.ts          # Re-exports all hooks
│
├── utils/
│   └── scaffold-eth/         # SE2 utilities
│       ├── contract.ts       # Type helpers for contract declarations
│       ├── networks.ts       # Chain configuration utilities
│       └── ...
│
├── scaffold.config.ts        # Global SE2 configuration
├── next.config.mjs           # Next.js configuration
├── tailwind.config.ts        # Tailwind CSS configuration (with daisyUI)
├── tsconfig.json
├── .env.example
└── package.json
```

## Key Files Explained

| File | Role | Modified By |
|------|------|-------------|
| `scaffold.config.ts` | Target chain, polling, wallet settings | Developer (manual) |
| `deployedContracts.ts` | Contract addresses and ABIs for deployed contracts | `yarn deploy` (auto-generated) |
| `externalContracts.ts` | ABIs for third-party contracts | Developer (manual) |
| `Deploy.s.sol` | Foundry deploy script | Developer (manual) |
| `DeployHelpers.s.sol` | SE2 deploy infrastructure | SE2 framework (do not modify) |
| `app/debug/page.tsx` | Auto-generated debug UI | SE2 framework (do not modify) |

## References

- SE2 repo: https://github.com/scaffold-eth/scaffold-eth-2
- SE2 docs: https://docs.scaffoldeth.io

Last verified: February 2026
