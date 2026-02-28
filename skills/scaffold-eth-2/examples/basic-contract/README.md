# Basic Counter Contract

Simple counter contract with deploy script, frontend page using SE2 hooks, and debug page interaction. Covers the full cycle from Solidity to browser.

## Contract

```solidity
// packages/foundry/contracts/Counter.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Counter {
    uint256 public count;
    address public owner;

    event CountChanged(address indexed by, uint256 newCount);

    error NotOwner();

    constructor(address _owner) {
        owner = _owner;
    }

    function increment() external {
        count += 1;
        emit CountChanged(msg.sender, count);
    }

    function decrement() external {
        require(count > 0, "Counter: cannot go below zero");
        count -= 1;
        emit CountChanged(msg.sender, count);
    }

    function reset() external {
        if (msg.sender != owner) revert NotOwner();
        count = 0;
        emit CountChanged(msg.sender, count);
    }
}
```

## Deploy Script (Foundry)

```solidity
// packages/foundry/script/Deploy.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ScaffoldETHDeploy} from "./DeployHelpers.s.sol";
import {Counter} from "../contracts/Counter.sol";

contract DeployScript is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner {
        Counter counter = new Counter(msg.sender);
        deployments.push(Deployment("Counter", address(counter)));
    }
}
```

## Frontend Page

```tsx
// packages/nextjs/app/counter/page.tsx
"use client";

import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { Address } from "~~/components/scaffold-eth";

export default function CounterPage() {
  const { data: count, isLoading: countLoading } = useScaffoldReadContract({
    contractName: "Counter",
    functionName: "count",
  });

  const { data: owner } = useScaffoldReadContract({
    contractName: "Counter",
    functionName: "owner",
  });

  const { writeContractAsync: writeIncrement, isMining: isIncrementing } =
    useScaffoldWriteContract("Counter");

  const { writeContractAsync: writeDecrement, isMining: isDecrementing } =
    useScaffoldWriteContract("Counter");

  const { writeContractAsync: writeReset, isMining: isResetting } =
    useScaffoldWriteContract("Counter");

  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <h1 className="text-3xl font-bold">Counter</h1>

      <p className="text-6xl font-mono">
        {countLoading ? "..." : count?.toString()}
      </p>

      <div className="flex gap-2">
        <button
          className="btn btn-primary"
          onClick={() => writeDecrement({ functionName: "decrement" })}
          disabled={isDecrementing}
        >
          {isDecrementing ? "Mining..." : "-"}
        </button>

        <button
          className="btn btn-primary"
          onClick={() => writeIncrement({ functionName: "increment" })}
          disabled={isIncrementing}
        >
          {isIncrementing ? "Mining..." : "+"}
        </button>
      </div>

      <button
        className="btn btn-secondary"
        onClick={() => writeReset({ functionName: "reset" })}
        disabled={isResetting}
      >
        {isResetting ? "Resetting..." : "Reset (Owner Only)"}
      </button>

      <p className="text-sm">
        Owner: <Address address={owner} />
      </p>
    </div>
  );
}
```

## Debug Page Usage

After running `yarn deploy`, navigate to `http://localhost:3000/debug`. The Counter contract appears with:

- **count** (read): Displays the current count value. Click "Read" to refresh.
- **owner** (read): Shows the owner address.
- **increment** (write): Click "Send" to increment. No arguments needed.
- **decrement** (write): Click "Send" to decrement. Reverts if count is zero.
- **reset** (write): Click "Send" to reset. Reverts if caller is not the owner.

Every function has auto-generated input fields for arguments and shows transaction hashes with block explorer links after execution.

## Testing (Foundry)

```solidity
// packages/foundry/test/Counter.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../contracts/Counter.sol";

contract CounterTest is Test {
    Counter public counter;
    address public owner = address(0x1);

    function setUp() public {
        counter = new Counter(owner);
    }

    function test_InitialCountIsZero() public view {
        assertEq(counter.count(), 0);
    }

    function test_Increment() public {
        counter.increment();
        assertEq(counter.count(), 1);
    }

    function test_Decrement() public {
        counter.increment();
        counter.decrement();
        assertEq(counter.count(), 0);
    }

    function test_RevertDecrementBelowZero() public {
        vm.expectRevert("Counter: cannot go below zero");
        counter.decrement();
    }

    function test_ResetOnlyOwner() public {
        counter.increment();
        counter.increment();

        vm.prank(owner);
        counter.reset();
        assertEq(counter.count(), 0);
    }

    function test_RevertResetNotOwner() public {
        counter.increment();
        vm.expectRevert(Counter.NotOwner.selector);
        vm.prank(address(0xdead));
        counter.reset();
    }
}
```

Last verified: February 2026
