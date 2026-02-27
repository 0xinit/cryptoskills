# Deploy UUPS Upgradeable Contract

Deploy and upgrade a UUPS proxy contract using OpenZeppelin's hardhat-upgrades plugin.

## Dependencies

```bash
npm install --save-dev @openzeppelin/hardhat-upgrades @openzeppelin/contracts-upgradeable @openzeppelin/contracts
```

```typescript
// hardhat.config.ts
import "@openzeppelin/hardhat-upgrades";
```

## V1 Contract

```solidity
// contracts/VaultV1.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract VaultV1 is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    IERC20 public token;
    mapping(address => uint256) public balances;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _token, address _owner) public initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        token = IERC20(_token);
    }

    function deposit(uint256 amount) external {
        balances[msg.sender] += amount;
        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        token.safeTransfer(msg.sender, amount);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
```

Key UUPS patterns:
- `_disableInitializers()` in constructor prevents initialization of the implementation contract
- `initialize()` replaces the constructor for proxy initialization
- `_authorizeUpgrade()` restricts who can upgrade (owner-only here)
- Use `Initializable` to prevent double-initialization

## V2 Contract

```solidity
// contracts/VaultV2.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract VaultV2 is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    IERC20 public token;
    mapping(address => uint256) public balances;

    // New state variable — appended AFTER existing storage
    uint256 public depositFee; // basis points (100 = 1%)

    function setDepositFee(uint256 _fee) external onlyOwner {
        require(_fee <= 1000, "Fee too high"); // max 10%
        depositFee = _fee;
    }

    function deposit(uint256 amount) external {
        uint256 fee = (amount * depositFee) / 10_000;
        uint256 netAmount = amount - fee;
        balances[msg.sender] += netAmount;
        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        token.safeTransfer(msg.sender, amount);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
```

Storage layout rules for upgrades:
- Never remove or reorder existing state variables
- Append new variables AFTER all existing ones
- Never change the type of an existing variable
- The `hardhat-upgrades` plugin validates this automatically

## Deploy Script (V1)

```typescript
// scripts/deploy-proxy.ts
import { ethers, upgrades } from "hardhat";

async function main() {
  const tokenAddress = process.env.TOKEN_ADDRESS;
  if (!tokenAddress) throw new Error("TOKEN_ADDRESS not set");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const VaultV1 = await ethers.getContractFactory("VaultV1");
  const proxy = await upgrades.deployProxy(
    VaultV1,
    [tokenAddress, deployer.address],
    { kind: "uups" }
  );
  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();
  console.log("Proxy deployed to:", proxyAddress);

  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("Implementation deployed to:", implAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

```bash
npx hardhat run scripts/deploy-proxy.ts --network sepolia
```

## Upgrade Script (V1 -> V2)

```typescript
// scripts/upgrade-to-v2.ts
import { ethers, upgrades } from "hardhat";

async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  if (!proxyAddress) throw new Error("PROXY_ADDRESS not set");

  const VaultV2 = await ethers.getContractFactory("VaultV2");

  // Validates storage layout compatibility before upgrading
  const upgraded = await upgrades.upgradeProxy(proxyAddress, VaultV2, {
    kind: "uups",
  });
  await upgraded.waitForDeployment();

  const newImplAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("Upgraded implementation to:", newImplAddress);

  // Configure the new fee parameter
  const vault = await ethers.getContractAt("VaultV2", proxyAddress);
  const tx = await vault.setDepositFee(100n); // 1% fee
  await tx.wait();
  console.log("Deposit fee set to 1%");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

## Test Upgrade Path

```typescript
// test/VaultUpgrade.ts
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Vault Upgrade", function () {
  async function deployV1Fixture() {
    const [owner, alice] = await ethers.getSigners();

    const MockToken = await ethers.getContractFactory("MockERC20");
    const token = await MockToken.deploy("Mock", "MCK", ethers.parseEther("1000000"));

    const VaultV1 = await ethers.getContractFactory("VaultV1");
    const proxy = await upgrades.deployProxy(
      VaultV1,
      [await token.getAddress(), owner.address],
      { kind: "uups" }
    );

    return { proxy, token, owner, alice };
  }

  it("should preserve state after upgrade", async function () {
    const { proxy, token, owner, alice } = await loadFixture(deployV1Fixture);
    const vaultAddress = await proxy.getAddress();

    const depositAmount = ethers.parseEther("100");
    await token.approve(vaultAddress, depositAmount);
    await proxy.deposit(depositAmount);

    const balanceBefore = await proxy.balances(owner.address);
    expect(balanceBefore).to.equal(depositAmount);

    const VaultV2 = await ethers.getContractFactory("VaultV2");
    const upgraded = await upgrades.upgradeProxy(vaultAddress, VaultV2, {
      kind: "uups",
    });

    // State preserved — balance unchanged after upgrade
    const balanceAfter = await upgraded.balances(owner.address);
    expect(balanceAfter).to.equal(depositAmount);

    // New functionality available
    await upgraded.setDepositFee(100n);
    expect(await upgraded.depositFee()).to.equal(100n);
  });

  it("should reject upgrade from non-owner", async function () {
    const { proxy, alice } = await loadFixture(deployV1Fixture);
    const vaultAddress = await proxy.getAddress();

    const VaultV2 = await ethers.getContractFactory("VaultV2", alice);
    await expect(
      upgrades.upgradeProxy(vaultAddress, VaultV2, { kind: "uups" })
    ).to.be.revertedWithCustomError(proxy, "OwnableUnauthorizedAccount");
  });
});
```

## Verify Proxy on Etherscan

```bash
# Verify implementation
npx hardhat verify --network sepolia IMPLEMENTATION_ADDRESS

# Etherscan automatically links proxy -> implementation
# if using a standard ERC1967 proxy
```

## Common Issues

**"New storage layout is incompatible"** — You changed or removed an existing state variable. Storage must only be appended, never reordered.

**"Contract is not upgrade safe"** — The contract has a constructor with logic, uses `selfdestruct`, or uses `delegatecall`. These are not allowed in upgradeable contracts.

**"Upgrade failed: caller is not the owner"** — The account running the upgrade script is not the proxy owner. Check `owner()` on the proxy contract.

**Implementation address shows different code on Etherscan** — Each upgrade deploys a new implementation. Verify the latest implementation address from `upgrades.erc1967.getImplementationAddress()`.
