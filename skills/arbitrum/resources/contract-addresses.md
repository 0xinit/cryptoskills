# Arbitrum Contract Addresses

> **Last verified:** February 2026

## Arbitrum One — Core Contracts

| Contract | L1 Address (Ethereum) |
|----------|----------------------|
| Rollup | `0x5eF0D09d1E6204141B4d37530808eD19f60FBa35` |
| Inbox | `0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f` |
| Outbox | `0x0B9857ae2D4A3DBe74ffE1d7DF045bb7F96E4840` |
| Bridge | `0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a` |
| SequencerInbox | `0x1c479675ad559DC151F6Ec7ed3FbF8ceE79582B6` |
| ChallengeManager | `0xe5896783a2F463446E1f624e64Aa6836BE4C6f58` |
| RollupEventInbox | `0x57Bd336d579A51938619271a7Cc137a46D0501B1` |

## Arbitrum One — Token Bridge

| Contract | L1 Address | L2 Address |
|----------|-----------|-----------|
| Gateway Router | `0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef` | `0x5288c571Fd7aD117beA99bF60FE0846C4E84F933` |
| Standard ERC20 Gateway | `0xa3A7B6F88361F48403514059F1F16C8E78d60EeC` | `0x09e9222E96E7B4AE2a407B98d48e330053351EEe` |
| WETH Gateway | `0xd92023E9d9911199a6711321D1277285e6d4e2db` | `0x6c411aD3E74De3E7Bd422b94A27770f5B86C623B` |
| Custom Gateway | `0xcEe284F754E854890e311e3280b767F80797180d` | `0x096760F208390250649E3e8763348E783AEF5562` |

## ArbOS Precompiles (Same on All Arbitrum Chains)

| Precompile | Address | Purpose |
|------------|---------|---------|
| ArbSys | `0x0000000000000000000000000000000000000064` | L2 block info, withdrawals, L2→L1 messaging |
| ArbInfo | `0x0000000000000000000000000000000000000065` | Account balance/code queries |
| ArbAddressTable | `0x0000000000000000000000000000000000000066` | Address compression lookup table |
| ArbBLS (deprecated) | `0x0000000000000000000000000000000000000067` | BLS signature support (no longer used) |
| ArbFunctionTable (deprecated) | `0x0000000000000000000000000000000000000068` | Function table (no longer used) |
| ArbosTest | `0x0000000000000000000000000000000000000069` | Testing utilities |
| ArbOwner | `0x0000000000000000000000000000000000000070` | Chain owner admin functions |
| ArbGasInfo | `0x000000000000000000000000000000000000006C` | Gas pricing (L1 + L2 components) |
| ArbAggregator | `0x000000000000000000000000000000000000006D` | Batch poster configuration |
| ArbRetryableTx | `0x000000000000000000000000000000000000006E` | Retryable ticket management |
| ArbStatistics | `0x000000000000000000000000000000000000006F` | Chain statistics |
| NodeInterface | `0x00000000000000000000000000000000000000C8` | Gas estimation (eth_call only) |

## Token Addresses — Arbitrum One

| Token | Address | Decimals |
|-------|---------|----------|
| ARB (governance) | `0x912CE59144191C1204E64559FE8253a0e49E6548` | 18 |
| WETH | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` | 18 |
| USDC (native) | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | 6 |
| USDC.e (bridged) | `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8` | 6 |
| USDT | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` | 6 |
| DAI | `0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1` | 18 |
| WBTC | `0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f` | 8 |
| GMX | `0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a` | 18 |
| LINK | `0xf97f4df75117a78c1A5a0DBb814Af92458539FB4` | 18 |
| UNI | `0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0` | 18 |

## Arbitrum Nova — Core Contracts

| Contract | L1 Address (Ethereum) |
|----------|----------------------|
| Rollup | `0xFb209827c58283535b744575e11953DCC4bEAD88` |
| Inbox | `0xc4448b71118c9071Bcb9734A0EAc55D18A153949` |
| Outbox | `0xD4B80C3D7240325D18E645B49e6535A3Bf95cc58` |
| SequencerInbox | `0x211E1c4c7f1bF5351Ac850Ed10FD68CFfCF6c21b` |

## Arbitrum Nova — Token Bridge

| Contract | L1 Address | L2 Address |
|----------|-----------|-----------|
| Gateway Router | `0xC840838Bc438d73C16c2f8b22D2Ce3669963cD48` | `0x21903d3F8176b1a0c17E953Cd896610Be9fFDFa8` |
| Standard Gateway | `0xB2535b988dcE19f9D71dfB22dB6da744aCac21bf` | `0xcF9bAb7e53DDe48A6DC4f286CB14e05298799257` |

## Arbitrum Sepolia (Testnet) — Core Contracts

| Contract | L1 Address (Sepolia) |
|----------|---------------------|
| Rollup | `0xd80810638dbDF9081b72C1B33c65375e807281C8` |
| Inbox | `0xaAe29B0366299461418F5324a79Afc425BE5ae21` |
| Outbox | `0x65f07C7D521164a4d5DaC6eB8Fac8DA067A3B78F` |
| SequencerInbox | `0x6c97864CE4bEf387dE0b3310A44230f7E3F1be0D` |

## Arbitrum Sepolia — Token Bridge

| Contract | L1 Address (Sepolia) | L2 Address |
|----------|---------------------|-----------|
| Gateway Router | `0xcE18836b233C83325Cc8848CA4487e94C6288264` | `0x9fDD1C4E4AA24EEc1d913FABea925594a20d43C7` |
| Standard Gateway | `0x902b3E5f8F19571859F4AB1003B960a2571F0571` | `0x6e244cD02BBB8a6dbd7F626f05B2ef82151Ab502` |

## DeFi Protocol Addresses — Arbitrum One

| Protocol | Contract | Address |
|----------|----------|---------|
| Uniswap V3 | Factory | `0x1F98431c8aD98523631AE4a59f267346ea31F984` |
| Uniswap V3 | SwapRouter02 | `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45` |
| Uniswap V3 | QuoterV2 | `0x61fFE014bA17989E743c5F6cB21bF9697530B21e` |
| Aave V3 | Pool | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` |
| GMX V2 | Router | `0x7C68C7866A64FA2160F78EEaE12217FFbf871fa8` |
| Camelot | Router | `0xc873fEcbd354f5A56E00E710B90EF4201db2448d` |

## RPC Endpoints

| Network | Public RPC | Chain ID |
|---------|-----------|----------|
| Arbitrum One | `https://arb1.arbitrum.io/rpc` | 42161 |
| Arbitrum Nova | `https://nova.arbitrum.io/rpc` | 42170 |
| Arbitrum Sepolia | `https://sepolia-rollup.arbitrum.io/rpc` | 421614 |

## Block Explorers

| Network | Explorer URL | API Base |
|---------|-------------|----------|
| Arbitrum One | `https://arbiscan.io` | `https://api.arbiscan.io/api` |
| Arbitrum Nova | `https://nova.arbiscan.io` | `https://api-nova.arbiscan.io/api` |
| Arbitrum Sepolia | `https://sepolia.arbiscan.io` | `https://api-sepolia.arbiscan.io/api` |
