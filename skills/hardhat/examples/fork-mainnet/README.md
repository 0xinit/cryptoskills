# Fork Mainnet for Testing

Test against live mainnet state by forking at a specific block. Interact with deployed protocols (Uniswap, Aave, etc.) without deploying to a testnet.

## Configuration

```typescript
// hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.27",
  networks: {
    hardhat: {
      forking: {
        url: process.env.MAINNET_RPC_URL ?? "",
        // Pin to a specific block for deterministic tests
        blockNumber: 19_500_000,
        enabled: process.env.FORK_ENABLED === "true",
      },
    },
  },
};

export default config;
```

Pin `blockNumber` to make tests deterministic. Without it, each run forks at the latest block and results change with chain state.

## Requirement: Archive Node RPC

Forking with a pinned block requires archive data. Standard RPC endpoints only serve ~128 recent blocks.

Providers with archive support:
- Alchemy (Growth plan or above)
- Infura (add `/archive` to URL)
- QuickNode (archive add-on)
- Local archive node (Erigon, Reth)

## Example: Swap on Uniswap V3

```typescript
// test/ForkUniswap.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  loadFixture,
  impersonateAccount,
  setBalance,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const UNISWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const USDC_WHALE = "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503";

const routerAbi = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
];

const erc20Abi = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
  "function decimals() view returns (uint8)",
];

describe("Uniswap V3 Fork Test", function () {
  async function setupForkFixture() {
    await impersonateAccount(USDC_WHALE);
    await setBalance(USDC_WHALE, ethers.parseEther("10"));
    const whale = await ethers.getSigner(USDC_WHALE);

    const usdc = new ethers.Contract(USDC, erc20Abi, whale);
    const weth = new ethers.Contract(WETH, erc20Abi, whale);
    const router = new ethers.Contract(UNISWAP_ROUTER, routerAbi, whale);

    return { whale, usdc, weth, router };
  }

  it("should swap USDC for WETH", async function () {
    const { whale, usdc, weth, router } = await loadFixture(setupForkFixture);

    const swapAmount = 10_000n * 10n ** 6n; // 10,000 USDC (6 decimals)
    const wethBalanceBefore: bigint = await weth.balanceOf(USDC_WHALE);

    await usdc.approve(UNISWAP_ROUTER, swapAmount);

    const block = await ethers.provider.getBlock("latest");
    const deadline = BigInt(block!.timestamp) + 600n;

    await router.exactInputSingle({
      tokenIn: USDC,
      tokenOut: WETH,
      fee: 3000, // 0.3% pool
      recipient: USDC_WHALE,
      deadline,
      amountIn: swapAmount,
      amountOutMinimum: 0n, // no slippage protection in tests
      sqrtPriceLimitX96: 0n,
    });

    const wethBalanceAfter: bigint = await weth.balanceOf(USDC_WHALE);
    expect(wethBalanceAfter).to.be.greaterThan(wethBalanceBefore);
  });
});
```

## Running Fork Tests

```bash
FORK_ENABLED=true MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/KEY \
  npx hardhat test test/ForkUniswap.ts
```

## Example: Read Aave Position

```typescript
// test/ForkAave.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const AAVE_POOL = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";

const poolAbi = [
  "function getUserAccountData(address) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
];

describe("Aave Fork Test", function () {
  it("should read account data for a known borrower", async function () {
    const pool = new ethers.Contract(AAVE_POOL, poolAbi, ethers.provider);

    // Known address with an active Aave position at block 19,500,000
    const borrower = "0x5a52E96BAcdaBb82fd05763E25335261B270Efcb";

    const [
      totalCollateralBase,
      totalDebtBase,
      availableBorrowsBase,
      currentLiquidationThreshold,
      ltv,
      healthFactor,
    ] = await pool.getUserAccountData(borrower);

    expect(totalCollateralBase).to.be.greaterThan(0n);
    // healthFactor is 18-decimal fixed point
    console.log("Health Factor:", ethers.formatUnits(healthFactor, 18));
  });
});
```

## Resetting Fork Mid-Test

```typescript
import { reset } from "@nomicfoundation/hardhat-toolbox/network-helpers";

// Reset to a different block
await reset(process.env.MAINNET_RPC_URL, 19_000_000);

// Reset to latest
await reset(process.env.MAINNET_RPC_URL);

// Reset to no fork (back to clean Hardhat Network)
await reset();
```

## Setting Storage Directly

For tests that need specific contract state without executing real transactions:

```typescript
import { setStorageAt } from "@nomicfoundation/hardhat-toolbox/network-helpers";

// Set USDC balance for an address
// USDC uses slot 9 for balances (mapping(address => uint256))
const slot = ethers.solidityPackedKeccak256(
  ["uint256", "uint256"],
  [targetAddress, 9] // slot 9 = balances mapping in USDC
);

await setStorageAt(
  USDC,
  slot,
  ethers.zeroPadValue(ethers.toBeHex(1_000_000n * 10n ** 6n), 32)
);
```

Finding the correct storage slot requires checking the contract source or using `hardhat-storage-layout`.

## Performance Tips

- **Pin `blockNumber`** — avoids re-fetching state on every run
- **Use `loadFixture`** — caches fork state snapshots, avoids re-forking per test
- **Minimize RPC calls** — each call to forked state hits the remote RPC (cached locally after first call)
- **Run fork tests separately** — `npx hardhat test test/fork/` to avoid slowing down unit tests
- **Set `HARDHAT_CACHE_DIR`** — cache persists between runs for faster restarts

## Common Issues

**"Missing trie node" or "header not found"** — Your RPC does not support archive queries at the pinned block. Use an archive-tier RPC.

**Tests pass locally but fail in CI** — CI may not have the RPC URL set. Guard with `process.env.FORK_ENABLED` and skip fork tests when not configured.

**Impersonated account has no ETH** — `impersonateAccount` does not fund the account. Call `setBalance()` to give it ETH for gas.

**State differs between runs** — You are not pinning `blockNumber`. Each run forks at a different block with different state.

**"Transaction ran out of gas"** — Forked calls estimate gas against remote state. Complex protocol interactions may need higher gas limits. Set `gasLimit` explicitly in the transaction.
