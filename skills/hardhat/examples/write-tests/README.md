# Unit & Integration Tests with Fixtures

Complete testing patterns for Solidity contracts using Hardhat, Mocha, Chai, and loadFixture.

## Contract Under Test

```solidity
// contracts/Staking.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error Staking__ZeroAmount();
error Staking__LockNotExpired(uint256 unlockTime, uint256 currentTime);
error Staking__NoStake();

event Staked(address indexed user, uint256 amount, uint256 unlockTime);
event Withdrawn(address indexed user, uint256 amount);
event RewardsClaimed(address indexed user, uint256 reward);

contract Staking is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable stakingToken;
    uint256 public rewardRate; // reward per second per token staked (18 decimals)
    uint256 public lockDuration; // seconds

    struct StakeInfo {
        uint256 amount;
        uint256 unlockTime;
        uint256 lastClaimTime;
    }

    mapping(address => StakeInfo) public stakes;

    constructor(
        address _stakingToken,
        uint256 _rewardRate,
        uint256 _lockDuration,
        address _owner
    ) Ownable(_owner) {
        stakingToken = IERC20(_stakingToken);
        rewardRate = _rewardRate;
        lockDuration = _lockDuration;
    }

    function stake(uint256 amount) external {
        if (amount == 0) revert Staking__ZeroAmount();
        StakeInfo storage info = stakes[msg.sender];
        info.amount += amount;
        info.unlockTime = block.timestamp + lockDuration;
        info.lastClaimTime = block.timestamp;
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount, info.unlockTime);
    }

    function withdraw() external {
        StakeInfo storage info = stakes[msg.sender];
        if (info.amount == 0) revert Staking__NoStake();
        if (block.timestamp < info.unlockTime) {
            revert Staking__LockNotExpired(info.unlockTime, block.timestamp);
        }
        uint256 amount = info.amount;
        info.amount = 0;
        stakingToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function pendingRewards(address user) public view returns (uint256) {
        StakeInfo memory info = stakes[user];
        if (info.amount == 0) return 0;
        uint256 elapsed = block.timestamp - info.lastClaimTime;
        return (info.amount * rewardRate * elapsed) / 1e18;
    }
}
```

## Test File

```typescript
// test/Staking.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Staking", function () {
  const REWARD_RATE = ethers.parseEther("0.0001"); // 0.01% per second
  const LOCK_DURATION = 7n * 24n * 60n * 60n; // 7 days in seconds
  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const STAKE_AMOUNT = ethers.parseEther("1000");

  async function deployStakingFixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    const MockToken = await ethers.getContractFactory("MockERC20");
    const token = await MockToken.deploy("Stake Token", "STK", INITIAL_SUPPLY);

    const Staking = await ethers.getContractFactory("Staking");
    const staking = await Staking.deploy(
      await token.getAddress(),
      REWARD_RATE,
      LOCK_DURATION,
      owner.address
    );

    // Fund alice for tests
    await token.transfer(alice.address, ethers.parseEther("10000"));
    const stakingAddress = await staking.getAddress();
    await token.connect(alice).approve(stakingAddress, ethers.MaxUint256);

    return { staking, token, owner, alice, bob };
  }

  // --- Unit Tests ---

  describe("Deployment", function () {
    it("should set constructor parameters correctly", async function () {
      const { staking, token, owner } = await loadFixture(deployStakingFixture);

      expect(await staking.stakingToken()).to.equal(await token.getAddress());
      expect(await staking.rewardRate()).to.equal(REWARD_RATE);
      expect(await staking.lockDuration()).to.equal(LOCK_DURATION);
      expect(await staking.owner()).to.equal(owner.address);
    });
  });

  describe("Staking", function () {
    it("should accept stake and update balance", async function () {
      const { staking, alice } = await loadFixture(deployStakingFixture);

      await staking.connect(alice).stake(STAKE_AMOUNT);

      const info = await staking.stakes(alice.address);
      expect(info.amount).to.equal(STAKE_AMOUNT);
    });

    it("should emit Staked event with correct args", async function () {
      const { staking, alice } = await loadFixture(deployStakingFixture);

      await expect(staking.connect(alice).stake(STAKE_AMOUNT))
        .to.emit(staking, "Staked")
        .withArgs(alice.address, STAKE_AMOUNT, () => true); // unlockTime is dynamic
    });

    it("should revert on zero amount", async function () {
      const { staking, alice } = await loadFixture(deployStakingFixture);

      await expect(staking.connect(alice).stake(0n))
        .to.be.revertedWithCustomError(staking, "Staking__ZeroAmount");
    });

    it("should transfer tokens from staker to contract", async function () {
      const { staking, token, alice } = await loadFixture(deployStakingFixture);

      await expect(staking.connect(alice).stake(STAKE_AMOUNT))
        .to.changeTokenBalances(
          token,
          [alice, staking],
          [-STAKE_AMOUNT, STAKE_AMOUNT]
        );
    });
  });

  describe("Withdrawal", function () {
    it("should revert before lock expires", async function () {
      const { staking, alice } = await loadFixture(deployStakingFixture);

      await staking.connect(alice).stake(STAKE_AMOUNT);

      await expect(staking.connect(alice).withdraw())
        .to.be.revertedWithCustomError(staking, "Staking__LockNotExpired");
    });

    it("should allow withdrawal after lock expires", async function () {
      const { staking, token, alice } = await loadFixture(deployStakingFixture);

      await staking.connect(alice).stake(STAKE_AMOUNT);

      // Advance time past lock duration
      await time.increase(LOCK_DURATION);

      await expect(staking.connect(alice).withdraw())
        .to.changeTokenBalances(
          token,
          [alice, staking],
          [STAKE_AMOUNT, -STAKE_AMOUNT]
        );
    });

    it("should emit Withdrawn event", async function () {
      const { staking, alice } = await loadFixture(deployStakingFixture);

      await staking.connect(alice).stake(STAKE_AMOUNT);
      await time.increase(LOCK_DURATION);

      await expect(staking.connect(alice).withdraw())
        .to.emit(staking, "Withdrawn")
        .withArgs(alice.address, STAKE_AMOUNT);
    });

    it("should revert when no stake exists", async function () {
      const { staking, bob } = await loadFixture(deployStakingFixture);

      await expect(staking.connect(bob).withdraw())
        .to.be.revertedWithCustomError(staking, "Staking__NoStake");
    });

    it("should zero out stake after withdrawal", async function () {
      const { staking, alice } = await loadFixture(deployStakingFixture);

      await staking.connect(alice).stake(STAKE_AMOUNT);
      await time.increase(LOCK_DURATION);
      await staking.connect(alice).withdraw();

      const info = await staking.stakes(alice.address);
      expect(info.amount).to.equal(0n);
    });
  });

  describe("Rewards", function () {
    it("should accrue rewards over time", async function () {
      const { staking, alice } = await loadFixture(deployStakingFixture);

      await staking.connect(alice).stake(STAKE_AMOUNT);

      const elapsed = 3600n; // 1 hour
      await time.increase(elapsed);

      const pending = await staking.pendingRewards(alice.address);
      const expected = (STAKE_AMOUNT * REWARD_RATE * elapsed) / ethers.parseEther("1");

      // Allow 1 second of drift from block timestamp rounding
      const tolerance = (STAKE_AMOUNT * REWARD_RATE * 1n) / ethers.parseEther("1");
      expect(pending).to.be.closeTo(expected, tolerance);
    });

    it("should return zero rewards for non-stakers", async function () {
      const { staking, bob } = await loadFixture(deployStakingFixture);

      expect(await staking.pendingRewards(bob.address)).to.equal(0n);
    });
  });

  // --- Integration Tests ---

  describe("Integration: Full Lifecycle", function () {
    it("should handle stake -> wait -> withdraw cycle", async function () {
      const { staking, token, alice } = await loadFixture(deployStakingFixture);

      const balanceBefore = await token.balanceOf(alice.address);

      await staking.connect(alice).stake(STAKE_AMOUNT);
      expect(await token.balanceOf(alice.address)).to.equal(balanceBefore - STAKE_AMOUNT);

      await time.increase(LOCK_DURATION);
      await staking.connect(alice).withdraw();

      expect(await token.balanceOf(alice.address)).to.equal(balanceBefore);
    });

    it("should handle multiple stakers independently", async function () {
      const { staking, token, alice, bob, owner } = await loadFixture(deployStakingFixture);

      await token.transfer(bob.address, ethers.parseEther("5000"));
      await token.connect(bob).approve(await staking.getAddress(), ethers.MaxUint256);

      const aliceAmount = ethers.parseEther("1000");
      const bobAmount = ethers.parseEther("500");

      await staking.connect(alice).stake(aliceAmount);
      await staking.connect(bob).stake(bobAmount);

      const aliceInfo = await staking.stakes(alice.address);
      const bobInfo = await staking.stakes(bob.address);
      expect(aliceInfo.amount).to.equal(aliceAmount);
      expect(bobInfo.amount).to.equal(bobAmount);
    });
  });
});
```

## Key Patterns

### loadFixture

`loadFixture` snapshots EVM state after the first call and reverts to it on subsequent calls. This is faster than re-deploying in `beforeEach`:

```typescript
// GOOD: Fast, isolated
it("test 1", async function () {
  const { token } = await loadFixture(deployFixture); // deploys once, snapshots
});
it("test 2", async function () {
  const { token } = await loadFixture(deployFixture); // reverts to snapshot, no redeploy
});

// BAD: Slow, re-deploys every test
let token: Token;
beforeEach(async function () {
  const Token = await ethers.getContractFactory("Token");
  token = await Token.deploy(initialSupply); // full deploy every time
});
```

### Testing Events with Dynamic Args

When an event arg is not known at test time (like a timestamp), use a matcher function:

```typescript
await expect(staking.stake(amount))
  .to.emit(staking, "Staked")
  .withArgs(
    alice.address,
    amount,
    (unlockTime: bigint) => unlockTime > 0n // validate dynamically
  );
```

### Snapshot and Restore (Manual)

For cases where `loadFixture` does not fit:

```typescript
let snapshotId: string;

beforeEach(async function () {
  snapshotId = await ethers.provider.send("evm_snapshot", []);
});

afterEach(async function () {
  await ethers.provider.send("evm_revert", [snapshotId]);
});
```

### Testing Access Control

```typescript
it("should restrict to owner", async function () {
  const { staking, alice } = await loadFixture(deployFixture);

  await expect(staking.connect(alice).setRewardRate(0n))
    .to.be.revertedWithCustomError(staking, "OwnableUnauthorizedAccount")
    .withArgs(alice.address);
});
```

### Running Specific Tests

```bash
npx hardhat test test/Staking.ts
npx hardhat test --grep "should accept stake"
npx hardhat test --parallel
```

### Mock Contract

```solidity
// contracts/mocks/MockERC20.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
    }
}
```

## Common Issues

**"loadFixture is not a function"** — Import from `@nomicfoundation/hardhat-toolbox/network-helpers`, not from `@nomicfoundation/hardhat-network-helpers`.

**Tests pass individually but fail together** — State leaks between tests. Use `loadFixture` for isolation, not shared `let` variables mutated in `beforeEach`.

**"Transaction reverted without a reason string"** — The contract uses custom errors but you are asserting with `.to.be.revertedWith("string")`. Use `.to.be.revertedWithCustomError(contract, "ErrorName")`.

**Time-dependent tests are flaky** — Block timestamps have 1-second granularity. Use `closeTo` for reward calculations instead of exact equality.

**"Cannot read properties of null (reading 'timestamp')"** — `getBlock()` returns `null` if the block does not exist. Use `getBlock("latest")` with a null check.
