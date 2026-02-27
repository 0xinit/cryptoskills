# Maker Ilk Registry

An ilk is a collateral type in Maker. Each ilk has its own risk parameters, join adapter, and Clipper. The bytes32 ilk identifier is the ASCII name right-padded with zeros.

> **Last verified:** 2025-05-01

## Active Ilks (Ethereum Mainnet)

### ETH Collateral

| Ilk | Bytes32 | GemJoin | Stability Fee | Liquidation Ratio | Dust |
|-----|---------|---------|---------------|-------------------|------|
| ETH-A | `0x4554482d41000000000000000000000000000000000000000000000000000000` | `0x2F0b23f53734252Bda2277357e97e1517d6B042A` | Variable | 145% | 7,500 DAI |
| ETH-B | `0x4554482d42000000000000000000000000000000000000000000000000000000` | `0x08638eF1A205bE6762A8b935F5da9b700Cf7322c` | Variable | 130% | 25,000 DAI |
| ETH-C | `0x4554482d43000000000000000000000000000000000000000000000000000000` | `0xF04a5cC80B1E94C69B48f5ee68a08CD2F09A7c3E` | Variable | 170% | 3,500 DAI |

### Liquid Staking Derivatives

| Ilk | Bytes32 | GemJoin | Stability Fee | Liquidation Ratio | Dust |
|-----|---------|---------|---------------|-------------------|------|
| WSTETH-A | `0x5753544554482d41000000000000000000000000000000000000000000000000` | `0x10CD5fbe1b404B7E19Ef964B63939907bdaf42E2` | Variable | 160% | 7,500 DAI |
| WSTETH-B | `0x5753544554482d42000000000000000000000000000000000000000000000000` | `0x248cCBf4864221fC0E840F29BB042ad5bFC89B5c` | Variable | 175% | 3,500 DAI |
| RETH-A | `0x524554482d410000000000000000000000000000000000000000000000000000` | `0xC6424e862f1462281B0a5FAc078e4b63006bDEBF` | Variable | 155% | 7,500 DAI |

### WBTC Collateral

| Ilk | Bytes32 | GemJoin | Stability Fee | Liquidation Ratio | Dust |
|-----|---------|---------|---------------|-------------------|------|
| WBTC-A | `0x574254432d410000000000000000000000000000000000000000000000000000` | `0xBF72Da2Bd84c5170618Fbe5914B0ECA9638d5eb5` | Variable | 145% | 7,500 DAI |
| WBTC-B | `0x574254432d420000000000000000000000000000000000000000000000000000` | `0xfA8c996e158B80D77FbD0082BB9d793eFfbe0c0f` | Variable | 130% | 25,000 DAI |
| WBTC-C | `0x574254432d430000000000000000000000000000000000000000000000000000` | `0x7f62f9592b823331E012D3c5DdF2A7714CfB9de2` | Variable | 175% | 3,500 DAI |

## Risk Parameters Explained

| Parameter | Storage Location | Unit | Description |
|-----------|-----------------|------|-------------|
| Stability Fee (duty) | `Jug.ilks[ilk].duty` | ray (10^27) | Per-second fee rate. Compounds into `rate`. |
| Rate Accumulator (rate) | `Vat.ilks[ilk].rate` | ray (10^27) | Accumulated stability fee multiplier. Starts at RAY (1.0). |
| Spot Price (spot) | `Vat.ilks[ilk].spot` | ray (10^27) | Oracle price divided by liquidation ratio. Used for safety checks. |
| Debt Ceiling (line) | `Vat.ilks[ilk].line` | rad (10^45) | Maximum total debt for this ilk. |
| Dust (dust) | `Vat.ilks[ilk].dust` | rad (10^45) | Minimum debt per vault. Prevents unprofitable liquidations. |
| Liquidation Ratio (mat) | `Spotter.ilks[ilk].mat` | ray (10^27) | Minimum collateralization ratio. `spot = oracle_price / mat`. |
| Liquidation Penalty (chop) | `Dog.ilks[ilk].chop` | wad (10^18) | Added to debt during liquidation. 1.13e18 = 13% penalty. |

## Reading Ilk Parameters On-Chain

```typescript
import { toHex, padHex, type Address } from "viem";

function encodeIlk(name: string): `0x${string}` {
  return padHex(toHex(name), { size: 32, dir: "right" });
}

const MCD_VAT = "0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B" as const;
const MCD_JUG = "0x19c0976f590D67707E62397C87829d896Dc0f1F1" as const;
const MCD_DOG = "0x135954d155898D42C90D2a57824C690e0c7BEf1B" as const;
const MCD_SPOT = "0x65C79fcB50Ca1594B025960e539eD7A9a6D434A3" as const;

const RAY = 10n ** 27n;
const RAD = 10n ** 45n;
const WAD = 10n ** 18n;

async function getIlkParams(ilkName: string) {
  const ilk = encodeIlk(ilkName);

  const [vatIlk, jugIlk, dogIlk, spotIlk] = await Promise.all([
    publicClient.readContract({
      address: MCD_VAT,
      abi: [
        {
          name: "ilks",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "ilk", type: "bytes32" }],
          outputs: [
            { name: "Art", type: "uint256" },
            { name: "rate", type: "uint256" },
            { name: "spot", type: "uint256" },
            { name: "line", type: "uint256" },
            { name: "dust", type: "uint256" },
          ],
        },
      ] as const,
      functionName: "ilks",
      args: [ilk],
    }),
    publicClient.readContract({
      address: MCD_JUG,
      abi: [
        {
          name: "ilks",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "ilk", type: "bytes32" }],
          outputs: [
            { name: "duty", type: "uint256" },
            { name: "rho", type: "uint256" },
          ],
        },
      ] as const,
      functionName: "ilks",
      args: [ilk],
    }),
    publicClient.readContract({
      address: MCD_DOG,
      abi: [
        {
          name: "ilks",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "ilk", type: "bytes32" }],
          outputs: [
            { name: "clip", type: "address" },
            { name: "chop", type: "uint256" },
            { name: "hole", type: "uint256" },
            { name: "dirt", type: "uint256" },
          ],
        },
      ] as const,
      functionName: "ilks",
      args: [ilk],
    }),
    publicClient.readContract({
      address: MCD_SPOT,
      abi: [
        {
          name: "ilks",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "ilk", type: "bytes32" }],
          outputs: [
            { name: "pip", type: "address" },
            { name: "mat", type: "uint256" },
          ],
        },
      ] as const,
      functionName: "ilks",
      args: [ilk],
    }),
  ]);

  // Convert duty (per-second ray) to APY
  const dutyFloat = Number(jugIlk[0]) / Number(RAY);
  const stabilityFeeApy = (Math.pow(dutyFloat, 31536000) - 1) * 100;

  // Liquidation ratio = mat / RAY * 100
  const liquidationRatio = Number(spotIlk[1]) * 100 / Number(RAY);

  // Debt ceiling in DAI
  const debtCeiling = vatIlk[3] / RAD;

  // Dust in DAI
  const dust = vatIlk[4] / RAD;

  // Liquidation penalty percentage
  const chopPenalty = Number(dogIlk[1] - WAD) * 100 / Number(WAD);

  return {
    totalDebt: vatIlk[0],
    rate: vatIlk[1],
    spot: vatIlk[2],
    debtCeiling,
    dust,
    stabilityFeeApy,
    liquidationRatio,
    chopPenalty,
    clipper: dogIlk[0],
    oracle: spotIlk[0],
  };
}
```

## Reading Parameters with Foundry

```bash
# Read ETH-A parameters from Vat
cast call 0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B \
  "ilks(bytes32)(uint256,uint256,uint256,uint256,uint256)" \
  0x4554482d41000000000000000000000000000000000000000000000000000000 \
  --rpc-url $RPC_URL

# Read stability fee (duty) from Jug
cast call 0x19c0976f590D67707E62397C87829d896Dc0f1F1 \
  "ilks(bytes32)(uint256,uint256)" \
  0x4554482d41000000000000000000000000000000000000000000000000000000 \
  --rpc-url $RPC_URL

# Read liquidation ratio from Spotter
cast call 0x65C79fcB50Ca1594B025960e539eD7A9a6D434A3 \
  "ilks(bytes32)(address,uint256)" \
  0x4554482d41000000000000000000000000000000000000000000000000000000 \
  --rpc-url $RPC_URL

# Encode ilk name to bytes32
cast --from-utf8 "ETH-A" | cast --to-bytes32
```

## Ilk Naming Convention

Ilk names follow the pattern `{TOKEN}-{VARIANT}`:
- `ETH-A` -- standard ETH vault (moderate fee, moderate ratio)
- `ETH-B` -- low-ratio ETH vault (higher fee, lower ratio, higher dust)
- `ETH-C` -- high-ratio ETH vault (lower fee, higher ratio, lower dust)

The `-A` variant is the "default" risk tier. `-B` is aggressive (lower ratio, higher fee). `-C` is conservative (higher ratio, lower fee).

## References

- [Maker Changelog](https://chainlog.makerdao.com/)
- [IlkRegistry Contract](https://etherscan.io/address/0x5a464C28D19848f44199D003BeF5ecc87d090F87)
- [Maker Risk Parameters](https://makerburn.com/)
