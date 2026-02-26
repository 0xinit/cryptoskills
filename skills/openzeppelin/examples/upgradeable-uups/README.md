# UUPS Upgradeable Contract Examples

Complete UUPS upgrade lifecycle using OpenZeppelin v5 upgradeable contracts.

## UUPSUpgradeable Pattern with Initializer

Upgradeable contracts use initializers instead of constructors. The constructor only disables initializers on the implementation to prevent direct initialization.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract VaultV1 is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    uint256 public totalDeposits;

    event Deposited(address indexed depositor, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
    }

    function deposit() external payable {
        totalDeposits += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    /// @dev Only the owner can authorize an upgrade
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
```

## Storage Gaps for Future Versions

When creating base contracts that others will inherit, reserve storage slots for future state variables. In v5, OZ uses ERC-7201 namespaced storage internally, but your own custom contracts should still use gaps if they serve as base contracts.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @notice Base contract intended to be inherited by upgradeable contracts
abstract contract BaseVaultV1 is Initializable {
    uint256 public totalDeposits;
    uint256 public depositCount;

    // Reserve 48 storage slots so derived contracts can add state in future base versions
    // 50 slots total budget minus 2 used = 48 remaining
    uint256[48] private __gap;

    function __BaseVault_init() internal onlyInitializing {
        totalDeposits = 0;
        depositCount = 0;
    }
}
```

When adding new variables in V2 of the base, shrink the gap:

```solidity
abstract contract BaseVaultV2 is Initializable {
    uint256 public totalDeposits;
    uint256 public depositCount;
    uint256 public lastDepositTimestamp; // new variable

    // 50 - 3 used = 47 remaining
    uint256[47] private __gap;
}
```

## Authorization in _authorizeUpgrade

The `_authorizeUpgrade` function is the security gate for all upgrades. If left unprotected, anyone can upgrade the proxy to a malicious implementation.

```solidity
// Simplest: owner-only upgrades
function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

// Role-based: only UPGRADER_ROLE can upgrade
function _authorizeUpgrade(address newImplementation)
    internal
    override
    onlyRole(UPGRADER_ROLE)
{}

// Timelock: require a delay before upgrade takes effect
function _authorizeUpgrade(address newImplementation) internal override {
    if (msg.sender != address(timelockController)) {
        revert UnauthorizedUpgrade();
    }
}
```

## Deploying Proxy with ERC1967Proxy

The proxy stores the implementation address in a specific storage slot (EIP-1967) and delegates all calls.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {VaultV1} from "../src/VaultV1.sol";

contract DeployVaultV1 is Script {
    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        vm.startBroadcast();

        VaultV1 implementation = new VaultV1();

        bytes memory initData = abi.encodeCall(VaultV1.initialize, (deployer));

        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);

        console.log("Implementation:", address(implementation));
        console.log("Proxy:", address(proxy));

        vm.stopBroadcast();
    }
}
```

Deploy command:

```bash
forge script script/DeployVaultV1.s.sol --rpc-url $RPC_URL --broadcast --verify
```

## Upgrade Flow (Deploy V2, Call upgradeToAndCall)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract VaultV2 is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    uint256 public totalDeposits;
    uint256 public withdrawalFeeBps; // new state -- appended, never reordered

    event Deposited(address indexed depositor, uint256 amount);
    event FeeUpdated(uint256 newFeeBps);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
    }

    /// @notice V2-specific initializer. reinitializer(2) prevents replaying.
    function initializeV2(uint256 feeBps) public reinitializer(2) {
        withdrawalFeeBps = feeBps;
        emit FeeUpdated(feeBps);
    }

    function deposit() external payable {
        totalDeposits += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
```

Upgrade script:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {VaultV1} from "../src/VaultV1.sol";
import {VaultV2} from "../src/VaultV2.sol";

contract UpgradeToV2 is Script {
    function run() external {
        address proxy = vm.envAddress("PROXY_ADDRESS");
        vm.startBroadcast();

        VaultV2 newImpl = new VaultV2();

        // 100 bps = 1% withdrawal fee
        bytes memory initV2Data = abi.encodeCall(VaultV2.initializeV2, (100));

        VaultV1(proxy).upgradeToAndCall(address(newImpl), initV2Data);

        console.log("New implementation:", address(newImpl));
        console.log("V2 initialized with fee:", VaultV2(proxy).withdrawalFeeBps());

        vm.stopBroadcast();
    }
}
```

## Testing Upgrades with Forge

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {VaultV1} from "../src/VaultV1.sol";
import {VaultV2} from "../src/VaultV2.sol";

contract VaultUpgradeTest is Test {
    VaultV1 internal vaultV1;
    address internal proxy;
    address internal owner = makeAddr("owner");
    address internal attacker = makeAddr("attacker");

    function setUp() public {
        VaultV1 impl = new VaultV1();
        bytes memory initData = abi.encodeCall(VaultV1.initialize, (owner));
        proxy = address(new ERC1967Proxy(address(impl), initData));
        vaultV1 = VaultV1(proxy);
    }

    function test_deposit() public {
        vm.deal(address(this), 1 ether);
        vaultV1.deposit{value: 1 ether}();
        assertEq(vaultV1.totalDeposits(), 1 ether);
    }

    function test_upgradeToV2() public {
        vm.deal(address(this), 1 ether);
        vaultV1.deposit{value: 1 ether}();

        VaultV2 newImpl = new VaultV2();
        bytes memory initV2Data = abi.encodeCall(VaultV2.initializeV2, (100));

        vm.prank(owner);
        vaultV1.upgradeToAndCall(address(newImpl), initV2Data);

        VaultV2 vaultV2 = VaultV2(proxy);
        assertEq(vaultV2.totalDeposits(), 1 ether); // state preserved
        assertEq(vaultV2.withdrawalFeeBps(), 100);   // new state initialized
    }

    function test_unauthorizedUpgradeReverts() public {
        VaultV2 newImpl = new VaultV2();
        bytes memory initV2Data = abi.encodeCall(VaultV2.initializeV2, (100));

        vm.prank(attacker);
        vm.expectRevert();
        vaultV1.upgradeToAndCall(address(newImpl), initV2Data);
    }

    function test_cannotReinitialize() public {
        vm.expectRevert();
        vaultV1.initialize(attacker);
    }
}
```

Run tests:

```bash
forge test --match-contract VaultUpgradeTest -vvv
```

## Safety Checklist

- Never reorder or remove existing state variables -- only append
- Always call `_disableInitializers()` in the implementation constructor
- Use `reinitializer(n)` for version-specific initialization, not `initializer`
- Gate `_authorizeUpgrade` with `onlyOwner` or role check
- No `immutable` variables that depend on constructor args in upgradeable contracts
- Test the full cycle: deploy V1, interact, upgrade to V2, verify state preservation
- Use `forge inspect ContractName storage-layout` to compare layouts between versions
