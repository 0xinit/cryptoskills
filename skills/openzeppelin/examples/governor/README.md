# Governor (On-Chain Governance) Examples

Full governance stack: ERC20Votes token, Governor, TimelockController.

## Governance Token

The governance token must implement ERC20Votes for checkpoint-based voting power.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

contract GovToken is ERC20, ERC20Permit, ERC20Votes {
    constructor(address recipient)
        ERC20("GovToken", "GOV")
        ERC20Permit("GovToken")
    {
        _mint(recipient, 10_000_000 * 10 ** decimals());
    }

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
```

## Governor Contract

Combines counting, quorum, and timelock extensions.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorCountingSimple} from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import {GovernorVotesQuorumFraction} from "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import {GovernorTimelockControl} from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

contract MyGovernor is
    Governor,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    constructor(IVotes token, TimelockController timelock)
        Governor("MyGovernor")
        GovernorVotes(token)
        GovernorVotesQuorumFraction(4) // 4% of total supply must vote
        GovernorTimelockControl(timelock)
    {}

    /// @dev ~1 day at 12s blocks
    function votingDelay() public pure override returns (uint256) {
        return 7200;
    }

    /// @dev ~1 week at 12s blocks
    function votingPeriod() public pure override returns (uint256) {
        return 50400;
    }

    /// @dev 100k tokens required to create a proposal
    function proposalThreshold() public pure override returns (uint256) {
        return 100_000 * 10 ** 18;
    }

    // --- Required diamond resolution overrides ---

    function state(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function proposalNeedsQueuing(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (bool)
    {
        return super.proposalNeedsQueuing(proposalId);
    }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint48) {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) {
        return super._executor();
    }
}
```

## TimelockController Setup

The timelock holds funds and executes proposals after a delay. This prevents immediate execution of malicious proposals.

```solidity
// In deploy script or constructor:

// 1 day minimum delay before execution
uint256 minDelay = 1 days;

// Proposers: only the governor can propose
address[] memory proposers = new address[](1);
proposers[0] = address(governor);

// Executors: anyone can execute after delay (address(0) = open)
address[] memory executors = new address[](1);
executors[0] = address(0);

// Admin: set to address(0) so the timelock governs itself
address admin = address(0);

TimelockController timelock = new TimelockController(minDelay, proposers, executors, admin);
```

## Proposal Creation and Voting

### Creating a Proposal

```solidity
// Target contract and function to call
address[] memory targets = new address[](1);
targets[0] = address(treasury);

uint256[] memory values = new uint256[](1);
values[0] = 0;

bytes[] memory calldatas = new bytes[](1);
calldatas[0] = abi.encodeCall(Treasury.withdraw, (recipient, 1000 ether));

string memory description = "Proposal #1: Fund development team";

uint256 proposalId = governor.propose(targets, values, calldatas, description);
```

### Vote Types

```solidity
// GovernorCountingSimple defines three vote types:
uint8 constant AGAINST = 0;
uint8 constant FOR = 1;
uint8 constant ABSTAIN = 2;

// Cast a vote
governor.castVote(proposalId, FOR);

// Cast with reason (emitted as event, useful for off-chain display)
governor.castVoteWithReason(proposalId, FOR, "This funds critical infrastructure");

// Cast with reason and additional params
governor.castVoteWithReasonAndParams(proposalId, FOR, "reason", params);
```

### Queue and Execute

```solidity
// After voting period ends and quorum is reached:

// 1. Queue the proposal in the timelock
bytes32 descriptionHash = keccak256(bytes(description));
governor.queue(targets, values, calldatas, descriptionHash);

// 2. Wait for timelock delay to pass

// 3. Execute the proposal
governor.execute(targets, values, calldatas, descriptionHash);
```

## Full Governance Deployment Script

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {GovToken} from "../src/GovToken.sol";
import {MyGovernor} from "../src/MyGovernor.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";

contract DeployGovernance is Script {
    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        vm.startBroadcast();

        GovToken token = new GovToken(deployer);

        // Timelock: 1 day delay, no admin (self-governed)
        address[] memory proposers = new address[](0); // set after governor deploy
        address[] memory executors = new address[](1);
        executors[0] = address(0); // anyone can execute
        TimelockController timelock = new TimelockController(1 days, proposers, executors, deployer);

        MyGovernor governor = new MyGovernor(IVotes(address(token)), timelock);

        // Grant proposer and canceller roles to the governor
        timelock.grantRole(timelock.PROPOSER_ROLE(), address(governor));
        timelock.grantRole(timelock.CANCELLER_ROLE(), address(governor));

        // Deployer renounces admin so the timelock governs itself
        timelock.renounceRole(timelock.DEFAULT_ADMIN_ROLE(), deployer);

        // Deployer self-delegates to activate voting power
        token.delegate(deployer);

        console.log("Token:", address(token));
        console.log("Timelock:", address(timelock));
        console.log("Governor:", address(governor));

        vm.stopBroadcast();
    }
}
```

## Quorum Configuration

`GovernorVotesQuorumFraction` sets quorum as a percentage of total supply at the proposal's snapshot block.

```solidity
// 4% quorum -- 4% of total supply must participate for a vote to be valid
GovernorVotesQuorumFraction(4)

// Check quorum requirement at current block
uint256 required = governor.quorum(block.number - 1);

// Quorum tracks historical total supply via ERC20Votes checkpoints
// So token burns/mints after proposal creation don't affect the quorum requirement
```

## Governance Lifecycle Summary

```
1. Propose       -> proposalId created, votingDelay starts
2. Active        -> votingDelay elapsed, voting open for votingPeriod
3. Succeeded     -> quorum met, FOR > AGAINST
4. Queued        -> governor.queue() called, timelock delay starts
5. Executable    -> timelock delay elapsed
6. Executed      -> governor.execute() calls target contracts via timelock
```

States that end the lifecycle: Defeated (quorum not met or AGAINST wins), Canceled (proposer cancels), Expired (not executed within timelock grace period).

## Import Path Reference

| Contract | Import Path |
|----------|-------------|
| Governor | `@openzeppelin/contracts/governance/Governor.sol` |
| GovernorCountingSimple | `@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol` |
| GovernorVotes | `@openzeppelin/contracts/governance/extensions/GovernorVotes.sol` |
| GovernorVotesQuorumFraction | `@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol` |
| GovernorTimelockControl | `@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol` |
| TimelockController | `@openzeppelin/contracts/governance/TimelockController.sol` |
| IVotes | `@openzeppelin/contracts/governance/utils/IVotes.sol` |
