# Hardhat Testing Patterns

Hardhat uses Mocha for test structure and Chai for assertions. The `@nomicfoundation/hardhat-toolbox` package bundles everything: ethers.js, Chai matchers, network helpers, and type generation.

## Basic Test Structure

```typescript
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Token", function () {
  async function deployTokenFixture() {
    const [owner, alice, bob] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("Token");
    const token = await Token.deploy("Test Token", "TST", ethers.parseEther("1000000"));

    return { token, owner, alice, bob };
  }

  describe("Deployment", function () {
    it("should set the correct name and symbol", async function () {
      const { token } = await loadFixture(deployTokenFixture);

      expect(await token.name()).to.equal("Test Token");
      expect(await token.symbol()).to.equal("TST");
    });

    it("should mint initial supply to deployer", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);

      expect(await token.balanceOf(owner.address)).to.equal(
        ethers.parseEther("1000000")
      );
    });
  });
});
```

`loadFixture` snapshots EVM state after the first call and reverts to that snapshot for subsequent tests. This is much faster than redeploying in every test.

## Revert Assertions

```typescript
describe("Reverts", function () {
  it("should revert with custom error", async function () {
    const { token, alice } = await loadFixture(deployTokenFixture);

    await expect(
      token.connect(alice).transfer(ethers.ZeroAddress, 100n)
    ).to.be.revertedWithCustomError(token, "ZeroAddress");
  });

  it("should revert with custom error and args", async function () {
    const { token, alice, bob } = await loadFixture(deployTokenFixture);

    await expect(
      token.connect(alice).transfer(bob.address, ethers.parseEther("999999"))
    ).to.be.revertedWithCustomError(token, "InsufficientBalance")
      .withArgs(alice.address, 0n, ethers.parseEther("999999"));
  });

  it("should revert with require string (legacy)", async function () {
    const { token, alice } = await loadFixture(deployTokenFixture);

    await expect(
      token.connect(alice).legacyTransfer(ethers.ZeroAddress, 100n)
    ).to.be.revertedWith("transfer to zero address");
  });

  it("should revert without reason", async function () {
    const { token, alice } = await loadFixture(deployTokenFixture);

    await expect(
      token.connect(alice).riskyCall()
    ).to.be.reverted;
  });
});
```

## Event Assertions

```typescript
describe("Events", function () {
  it("should emit Transfer event", async function () {
    const { token, owner, alice } = await loadFixture(deployTokenFixture);

    await expect(
      token.connect(owner).transfer(alice.address, ethers.parseEther("100"))
    )
      .to.emit(token, "Transfer")
      .withArgs(owner.address, alice.address, ethers.parseEther("100"));
  });

  it("should emit multiple events", async function () {
    const { vault, alice } = await loadFixture(deployVaultFixture);

    await expect(
      vault.connect(alice).deposit({ value: ethers.parseEther("1.0") })
    )
      .to.emit(vault, "Deposit")
      .withArgs(alice.address, ethers.parseEther("1.0"))
      .and.to.emit(vault, "BalanceUpdated");
  });
});
```

## Time Manipulation

```typescript
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Timelock", function () {
  it("should unlock after waiting period", async function () {
    const { vault, alice } = await loadFixture(deployVaultFixture);
    await vault.connect(alice).deposit({ value: ethers.parseEther("1.0") });

    // Advance time by 7 days
    await time.increase(7 * 24 * 60 * 60);

    await expect(
      vault.connect(alice).withdraw(ethers.parseEther("1.0"))
    ).to.not.be.reverted;
  });

  it("should set specific timestamp", async function () {
    const targetTime = (await time.latest()) + 30 * 24 * 60 * 60;
    await time.increaseTo(targetTime);

    expect(await time.latest()).to.equal(targetTime);
  });

  it("should mine specific number of blocks", async function () {
    const startBlock = await time.latestBlock();
    await time.advanceBlock(100);

    expect(await time.latestBlock()).to.equal(startBlock + 100);
  });
});
```

## Impersonation

```typescript
import { impersonateAccount, setBalance } from "@nomicfoundation/hardhat-network-helpers";

describe("Fork with impersonation", function () {
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const WHALE = "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503";

  it("should transfer from whale", async function () {
    await impersonateAccount(WHALE);
    // Whale needs ETH for gas
    await setBalance(WHALE, ethers.parseEther("10"));

    const whaleSigner = await ethers.getSigner(WHALE);
    const usdc = await ethers.getContractAt("IERC20", USDC);
    const [, recipient] = await ethers.getSigners();

    await usdc.connect(whaleSigner).transfer(recipient.address, 1_000_000n * 10n ** 6n);

    expect(await usdc.balanceOf(recipient.address)).to.equal(1_000_000n * 10n ** 6n);
  });
});
```

## Network Forking Configuration

```typescript
// hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      forking: {
        url: process.env.ETH_RPC_URL!,
        blockNumber: 19_500_000,
      },
    },
  },
};

export default config;
```

```bash
# Run tests with forking enabled
npx hardhat test --network hardhat

# Run tests without forking (local network)
HARDHAT_FORK= npx hardhat test
```

## Balance Change Assertions

```typescript
it("should change ether balance", async function () {
  const { vault, alice } = await loadFixture(deployVaultFixture);

  await expect(
    vault.connect(alice).deposit({ value: ethers.parseEther("1.0") })
  ).to.changeEtherBalance(alice, -ethers.parseEther("1.0"));
});

it("should change token balances", async function () {
  const { token, owner, alice } = await loadFixture(deployTokenFixture);

  await expect(
    token.connect(owner).transfer(alice.address, ethers.parseEther("100"))
  ).to.changeTokenBalances(
    token,
    [owner, alice],
    [-ethers.parseEther("100"), ethers.parseEther("100")]
  );
});
```

## References

- [Hardhat Testing Guide](https://hardhat.org/tutorial/testing-contracts)
- [hardhat-network-helpers](https://hardhat.org/hardhat-network-helpers/docs/overview)
- [Chai Matchers for Hardhat](https://hardhat.org/hardhat-chai-matchers/docs/overview)
