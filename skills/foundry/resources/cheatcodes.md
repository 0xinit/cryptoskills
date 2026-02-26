# Cheatcodes Quick Reference

Essential `vm.*` cheatcodes from forge-std. These are special functions available in tests and scripts that manipulate EVM state.

## Identity & Addressing

| Cheatcode | Description | Example |
|-----------|-------------|---------|
| `makeAddr(string)` | Deterministic address from label | `address alice = makeAddr("alice");` |
| `makeAddrAndKey(string)` | Address + private key | `(address a, uint256 pk) = makeAddrAndKey("signer");` |
| `vm.label(address, string)` | Label address in traces | `vm.label(address(vault), "Vault");` |
| `vm.addr(uint256)` | Address from private key | `address a = vm.addr(privateKey);` |

## Impersonation

| Cheatcode | Description | Example |
|-----------|-------------|---------|
| `vm.prank(address)` | Next call from address | `vm.prank(alice); vault.deposit();` |
| `vm.startPrank(address)` | All calls from address | `vm.startPrank(alice);` |
| `vm.startPrank(address, address)` | Set msg.sender and tx.origin | `vm.startPrank(alice, alice);` |
| `vm.stopPrank()` | End prank | `vm.stopPrank();` |

## Balances & State

| Cheatcode | Description | Example |
|-----------|-------------|---------|
| `vm.deal(address, uint256)` | Set ETH balance | `vm.deal(alice, 10 ether);` |
| `deal(address, address, uint256)` | Set ERC20 balance (stdcheats) | `deal(address(usdc), alice, 1000e6);` |
| `deal(address, address, uint256, bool)` | Set ERC20 + adjust totalSupply | `deal(address(usdc), alice, 1000e6, true);` |
| `vm.etch(address, bytes)` | Set code at address | `vm.etch(target, type(Mock).runtimeCode);` |
| `vm.store(address, bytes32, bytes32)` | Write storage slot | `vm.store(addr, slot, value);` |
| `vm.load(address, bytes32)` | Read storage slot | `bytes32 val = vm.load(addr, slot);` |

## Time & Block

| Cheatcode | Description | Example |
|-----------|-------------|---------|
| `vm.warp(uint256)` | Set `block.timestamp` | `vm.warp(block.timestamp + 1 days);` |
| `vm.roll(uint256)` | Set `block.number` | `vm.roll(block.number + 100);` |
| `vm.fee(uint256)` | Set `block.basefee` | `vm.fee(20 gwei);` |
| `vm.chainId(uint256)` | Set `block.chainid` | `vm.chainId(137);` |
| `vm.prevrandao(bytes32)` | Set `block.prevrandao` | `vm.prevrandao(bytes32(uint256(42)));` |
| `skip(uint256)` | Advance timestamp (stdcheats) | `skip(1 hours);` |
| `rewind(uint256)` | Rewind timestamp (stdcheats) | `rewind(30 minutes);` |

## Expect Revert

| Cheatcode | Description | Example |
|-----------|-------------|---------|
| `vm.expectRevert()` | Next call must revert (any reason) | `vm.expectRevert(); vault.withdraw(0);` |
| `vm.expectRevert(bytes)` | Revert with specific message | `vm.expectRevert("Insufficient balance");` |
| `vm.expectRevert(bytes4)` | Revert with custom error selector | `vm.expectRevert(Vault.Unauthorized.selector);` |
| `vm.expectRevert(bytes)` | Custom error with args | `vm.expectRevert(abi.encodeWithSelector(Vault.AmountTooLarge.selector, 100));` |

## Expect Emit

```solidity
// Signature: vm.expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData)
vm.expectEmit(true, true, false, true);
emit Transfer(alice, bob, 100);     // Expected event
vault.transfer(bob, 100);           // Call that emits

// Shorthand — check all topics and data, scoped to emitter
vm.expectEmit(address(vault));
emit Transfer(alice, bob, 100);
vault.transfer(bob, 100);
```

## Record & Access Logs

```solidity
// Record all emitted logs
vm.recordLogs();
vault.deposit{value: 1 ether}();
Vm.Log[] memory logs = vm.getRecordedLogs();

// Each log has: topics (bytes32[]), data (bytes), emitter (address)
assertEq(logs.length, 1);
assertEq(logs[0].emitter, address(vault));
```

## Snapshots

| Cheatcode | Description | Example |
|-----------|-------------|---------|
| `vm.snapshotState()` | Snapshot EVM state, returns ID | `uint256 id = vm.snapshotState();` |
| `vm.revertToState(uint256)` | Restore to snapshot | `vm.revertToState(id);` |
| `vm.revertToStateAndDelete(uint256)` | Restore + delete snapshot | `vm.revertToStateAndDelete(id);` |

## Forking

| Cheatcode | Description | Example |
|-----------|-------------|---------|
| `vm.createFork(string)` | Create fork (returns fork ID) | `uint256 id = vm.createFork("mainnet");` |
| `vm.createFork(string, uint256)` | Fork at block | `vm.createFork("mainnet", 19000000);` |
| `vm.createSelectFork(string)` | Create + select fork | `vm.createSelectFork("mainnet");` |
| `vm.selectFork(uint256)` | Switch active fork | `vm.selectFork(forkId);` |
| `vm.activeFork()` | Get active fork ID | `uint256 id = vm.activeFork();` |
| `vm.makePersistent(address)` | Persist across fork switches | `vm.makePersistent(address(myContract));` |
| `vm.rollFork(uint256)` | Roll active fork to block | `vm.rollFork(19500000);` |

## Mocking

| Cheatcode | Description | Example |
|-----------|-------------|---------|
| `vm.mockCall(address, bytes, bytes)` | Mock a call | See below |
| `vm.mockCallRevert(address, bytes, bytes)` | Mock a call to revert | See below |
| `vm.clearMockedCalls()` | Clear all mocks | `vm.clearMockedCalls();` |

```solidity
// Mock balanceOf to return 1000e18 for any input
vm.mockCall(
    address(token),
    abi.encodeWithSelector(IERC20.balanceOf.selector),
    abi.encode(1000e18)
);

// Mock balanceOf for a specific address only
vm.mockCall(
    address(token),
    abi.encodeCall(IERC20.balanceOf, (alice)),
    abi.encode(500e18)
);

// Mock a call to revert
vm.mockCallRevert(
    address(token),
    abi.encodeWithSelector(IERC20.transfer.selector),
    "Transfer failed"
);
```

## Environment Variables

| Cheatcode | Description | Example |
|-----------|-------------|---------|
| `vm.envUint(string)` | Read uint256 from env | `uint256 pk = vm.envUint("PRIVATE_KEY");` |
| `vm.envAddress(string)` | Read address from env | `address a = vm.envAddress("OWNER");` |
| `vm.envString(string)` | Read string from env | `string memory url = vm.envString("RPC_URL");` |
| `vm.envBool(string)` | Read bool from env | `bool prod = vm.envBool("IS_MAINNET");` |
| `vm.envOr(string, uint256)` | Read with default | `uint256 gas = vm.envOr("GAS", uint256(20 gwei));` |

## File I/O

| Cheatcode | Description | Example |
|-----------|-------------|---------|
| `vm.readFile(string)` | Read file contents | `string memory json = vm.readFile("config.json");` |
| `vm.writeFile(string, string)` | Write file | `vm.writeFile("out.txt", data);` |
| `vm.parseJson(string)` | Parse JSON string | `bytes memory parsed = vm.parseJson(json);` |
| `vm.serializeUint(string, string, uint256)` | Build JSON object | See Foundry docs |

Requires `fs_permissions` in `foundry.toml`:

```toml
fs_permissions = [{ access = "read", path = "./" }]
```

## Utility

| Cheatcode | Description | Example |
|-----------|-------------|---------|
| `vm.toString(uint256)` | Convert to string | `string memory s = vm.toString(42);` |
| `vm.parseUint(string)` | Parse string to uint | `uint256 n = vm.parseUint("42");` |
| `vm.sign(uint256, bytes32)` | Sign digest with private key | `(uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);` |
| `vm.deriveKey(string, uint32)` | Derive key from mnemonic | `uint256 pk = vm.deriveKey(mnemonic, 0);` |
| `vm.getNonce(address)` | Get nonce | `uint64 nonce = vm.getNonce(alice);` |
| `vm.setNonce(address, uint64)` | Set nonce | `vm.setNonce(alice, 10);` |
| `vm.isPersistent(address)` | Check persistence | `bool p = vm.isPersistent(addr);` |

## References

- [Full Cheatcodes Reference](https://book.getfoundry.sh/cheatcodes/)
- [forge-std Vm Interface](https://github.com/foundry-rs/forge-std/blob/master/src/Vm.sol)
