# Foundry Cheatcodes Quick Reference

Essential `vm.*` cheatcodes organized by category. All cheatcodes are called on the `vm` instance inherited from `forge-std/Test.sol`.

## Environment

| Cheatcode | Signature | Description |
|-----------|-----------|-------------|
| `vm.prank` | `prank(address)` | Next call executes as `address` |
| `vm.startPrank` | `startPrank(address)` | All subsequent calls as `address` until `stopPrank()` |
| `vm.stopPrank` | `stopPrank()` | Stop impersonation |
| `vm.deal` | `deal(address, uint256)` | Set ETH balance |
| `deal` (stdcheats) | `deal(address token, address to, uint256 amount)` | Set ERC20 balance |
| `deal` (with supply) | `deal(address token, address to, uint256 amount, bool adjust)` | Set ERC20 balance, optionally adjust totalSupply |
| `vm.etch` | `etch(address, bytes)` | Set bytecode at address |
| `vm.label` | `label(address, string)` | Label address for trace readability |
| `makeAddr` (stdcheats) | `makeAddr(string)` | Deterministic address from label |
| `makeAddrAndKey` | `makeAddrAndKey(string)` | Returns `(address, uint256 privateKey)` |

```solidity
vm.prank(alice);
vault.deposit{value: 1 ether}();

vm.startPrank(alice);
token.approve(address(vault), 100e18);
vault.deposit(100e18);
vm.stopPrank();

vm.deal(alice, 100 ether);
deal(address(usdc), alice, 1_000_000e6);
vm.label(address(vault), "Vault");
```

## Storage

| Cheatcode | Signature | Description |
|-----------|-----------|-------------|
| `vm.store` | `store(address, bytes32 slot, bytes32 value)` | Write to storage slot |
| `vm.load` | `load(address, bytes32 slot)` | Read storage slot |
| `vm.record` | `record()` | Start recording storage accesses |
| `vm.accesses` | `accesses(address)` | Get recorded reads and writes |
| `vm.snapshotState` | `snapshotState()` | Snapshot current EVM state, returns `uint256 id` |
| `vm.revertToState` | `revertToState(uint256 id)` | Revert to snapshot |

```solidity
// Read storage slot 0 of a contract
bytes32 val = vm.load(address(token), bytes32(0));

// Write directly to storage
vm.store(address(token), bytes32(uint256(2)), bytes32(uint256(999)));

// Snapshot and revert
uint256 snap = vm.snapshotState();
// ... mutate state ...
vm.revertToState(snap);
```

## Time and Block

| Cheatcode | Signature | Description |
|-----------|-----------|-------------|
| `vm.warp` | `warp(uint256 timestamp)` | Set `block.timestamp` |
| `vm.roll` | `roll(uint256 blockNumber)` | Set `block.number` |
| `vm.fee` | `fee(uint256 baseFee)` | Set `block.basefee` |
| `vm.chainId` | `chainId(uint256)` | Set `block.chainid` |
| `vm.prevrandao` | `prevrandao(bytes32)` | Set `block.prevrandao` |
| `skip` (stdcheats) | `skip(uint256 seconds)` | Advance `block.timestamp` by N seconds |
| `rewind` (stdcheats) | `rewind(uint256 seconds)` | Rewind `block.timestamp` by N seconds |

```solidity
vm.warp(block.timestamp + 7 days);
vm.roll(block.number + 7200);
vm.fee(25 gwei);

skip(1 days);
rewind(1 hours);
```

## Events

| Cheatcode | Signature | Description |
|-----------|-----------|-------------|
| `vm.expectEmit` | `expectEmit(bool topic1, bool topic2, bool topic3, bool data)` | Assert next event matches |
| `vm.expectEmit` | `expectEmit(bool, bool, bool, bool, address emitter)` | Assert event from specific contract |
| `vm.expectEmit` | `expectEmit()` | Check all topics and data (shorthand) |
| `vm.recordLogs` | `recordLogs()` | Start recording emitted logs |
| `vm.getRecordedLogs` | `getRecordedLogs()` | Get and clear recorded logs |

```solidity
// Full form: check topic1 (from), topic2 (to), skip topic3, check data (amount)
vm.expectEmit(true, true, false, true, address(token));
emit Transfer(alice, bob, 100e18);
token.transfer(bob, 100e18);

// Shorthand: check everything
vm.expectEmit();
emit Transfer(alice, bob, 100e18);
token.transfer(bob, 100e18);

// Record and inspect logs
vm.recordLogs();
vault.deposit{value: 1 ether}();
Vm.Log[] memory logs = vm.getRecordedLogs();
assertEq(logs.length, 1);
assertEq(logs[0].topics[0], keccak256("Deposit(address,uint256)"));
```

## Reverts

| Cheatcode | Signature | Description |
|-----------|-----------|-------------|
| `vm.expectRevert` | `expectRevert()` | Next call must revert (any reason) |
| `vm.expectRevert` | `expectRevert(bytes message)` | Next call must revert with message |
| `vm.expectRevert` | `expectRevert(bytes4 selector)` | Next call must revert with custom error |

```solidity
vm.expectRevert();
vault.withdraw(999 ether);

vm.expectRevert("Ownable: caller is not the owner");
vault.pause();

vm.expectRevert(Vault.Unauthorized.selector);
vault.pause();

vm.expectRevert(abi.encodeWithSelector(Vault.AmountExceeded.selector, 100, 50));
vault.withdraw(100);
```

## Mocking

| Cheatcode | Signature | Description |
|-----------|-----------|-------------|
| `vm.mockCall` | `mockCall(address, bytes calldata, bytes returndata)` | Mock a call to return specific data |
| `vm.mockCall` | `mockCall(address, uint256 value, bytes calldata, bytes returndata)` | Mock with msg.value |
| `vm.clearMockedCalls` | `clearMockedCalls()` | Remove all mocks |
| `vm.mockCallRevert` | `mockCallRevert(address, bytes calldata, bytes revertdata)` | Mock a call to revert |

```solidity
// Mock oracle.latestRoundData() to return $2000
vm.mockCall(
    address(oracle),
    abi.encodeWithSelector(AggregatorV3Interface.latestRoundData.selector),
    abi.encode(uint80(1), int256(2000e8), uint256(0), block.timestamp, uint80(1))
);

// Mock to revert
vm.mockCallRevert(
    address(oracle),
    abi.encodeWithSelector(AggregatorV3Interface.latestRoundData.selector),
    abi.encodeWithSignature("OracleDown()")
);
```

## Fork

| Cheatcode | Signature | Description |
|-----------|-----------|-------------|
| `vm.createFork` | `createFork(string rpcAlias)` | Create fork, returns `uint256 forkId` |
| `vm.createFork` | `createFork(string rpcAlias, uint256 blockNumber)` | Create fork at block |
| `vm.selectFork` | `selectFork(uint256 forkId)` | Switch to fork |
| `vm.createSelectFork` | `createSelectFork(string rpcAlias)` | Create and switch in one call |
| `vm.createSelectFork` | `createSelectFork(string rpcAlias, uint256 blockNumber)` | Create and switch at block |
| `vm.activeFork` | `activeFork()` | Returns current `uint256 forkId` |
| `vm.rollFork` | `rollFork(uint256 blockNumber)` | Roll active fork to block |

```solidity
uint256 mainnet = vm.createFork("mainnet", 19_500_000);
uint256 arb = vm.createFork("arbitrum", 200_000_000);

vm.selectFork(mainnet);
// ... interact with mainnet state ...

vm.selectFork(arb);
// ... interact with arbitrum state ...

assertEq(vm.activeFork(), arb);
```

## File and Environment

| Cheatcode | Signature | Description |
|-----------|-----------|-------------|
| `vm.readFile` | `readFile(string path)` | Read file as string |
| `vm.writeFile` | `writeFile(string path, string data)` | Write string to file |
| `vm.envUint` | `envUint(string name)` | Read env var as uint256 |
| `vm.envAddress` | `envAddress(string name)` | Read env var as address |
| `vm.envString` | `envString(string name)` | Read env var as string |
| `vm.envBool` | `envBool(string name)` | Read env var as bool |
| `vm.envOr` | `envOr(string name, uint256 defaultValue)` | Read env var with fallback |

```solidity
address deployer = vm.envAddress("DEPLOYER_ADDRESS");
uint256 chainId = vm.envOr("CHAIN_ID", uint256(1));
string memory rpc = vm.envString("ETH_RPC_URL");
```

## References

- [Foundry Cheatcodes Reference](https://book.getfoundry.sh/cheatcodes/)
- [forge-std Test Utilities](https://book.getfoundry.sh/reference/forge-std/)
