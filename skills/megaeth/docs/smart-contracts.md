# Smart Contract Patterns (MegaEVM)

## MegaEVM vs Standard EVM

MegaEVM is fully compatible with Ethereum contracts but has different:
- **Gas costs** (especially SSTORE)
- **Block metadata limits** (volatile data access)
- **Contract size limits** (512 KB)

## Contract Limits

| Resource | Limit |
|----------|-------|
| Contract code | 512 KB |
| Calldata | 128 KB |
| eth_call/estimateGas | 10M gas (public), higher on VIP |

## Volatile Data Access Control

After accessing block metadata, transaction is limited to 20M additional compute gas.

Affected opcodes:
- `TIMESTAMP` / `block.timestamp`
- `NUMBER` / `block.number`
- `BLOCKHASH` / `blockhash(n)`

```solidity
// Access metadata late in execution to avoid the limit
function process() external {
    for (uint i = 0; i < 10000; i++) {
        // Heavy work first
    }
    emit Processed(block.timestamp);
}
```

Spec: https://github.com/megaeth-labs/mega-evm/blob/main/specs/MiniRex.md#28-volatile-data-access-control

## High-Precision Timestamps

For microsecond precision, use the oracle instead of `block.timestamp`:

```solidity
interface ITimestampOracle {
    /// @notice Returns timestamp in microseconds
    function timestamp() external view returns (uint256);
}

contract MyContract {
    ITimestampOracle constant ORACLE =
        ITimestampOracle(0x6342000000000000000000000000000000000002);

    function getTime() external view returns (uint256) {
        return ORACLE.timestamp();
    }
}
```

## Storage Patterns

### Avoid Dynamic Mappings

```solidity
// Each new key = new storage slot = 2M+ gas
mapping(address => uint256) public balances;

// Better: fixed-size or use RedBlackTreeLib
uint256[100] public fixedBalances;
```

### Solady RedBlackTreeLib

```solidity
import {RedBlackTreeLib} from "solady/src/utils/RedBlackTreeLib.sol";

contract OptimizedStorage {
    using RedBlackTreeLib for RedBlackTreeLib.Tree;
    RedBlackTreeLib.Tree private _tree;
}
```

## Gas Estimation

Always use remote estimation. MegaEVM opcode costs differ from standard EVM.

```bash
forge script Deploy.s.sol \
    --rpc-url https://mainnet.megaeth.com/rpc \
    --gas-limit 5000000 \
    --skip-simulation \
    --broadcast
```

## Events and Logs

LOG opcodes have quadratic cost above 4KB data:

```solidity
// Expensive: large event data > 4KB triggers quadratic cost
event LargeData(bytes data);

// Better: emit hash, store off-chain
event DataStored(bytes32 indexed hash);
```

## SELFDESTRUCT

EIP-6780 style SELFDESTRUCT is being implemented:
- Same-tx destruction works
- Cross-tx destruction behavior may vary

## SSTORE2: On-Chain Data Storage

Store large immutable data as contract bytecode instead of storage slots.

| Approach | Write Cost | Read Cost |
|----------|------------|-----------|
| SSTORE (storage slots) | 2M+ gas per new slot | 100-2100 gas |
| SSTORE2 (bytecode) | ~10K gas per byte | FREE (EXTCODECOPY) |

### How It Works

```solidity
library SSTORE2 {
    function write(bytes memory data) internal returns (address) {
        bytes memory bytecode = abi.encodePacked(hex"00", data);

        address pointer;
        assembly {
            pointer := create(0, add(bytecode, 32), mload(bytecode))
        }
        require(pointer != address(0), "Deploy failed");
        return pointer;
    }

    function read(address pointer) internal view returns (bytes memory) {
        uint256 size;
        assembly { size := extcodesize(pointer) }

        bytes memory data = new bytes(size - 1);
        assembly {
            extcodecopy(pointer, add(data, 32), 1, sub(size, 1))
        }
        return data;
    }
}
```

### MegaETH Gas Estimation for SSTORE2

```javascript
const MEGAETH_GAS = {
  INTRINSIC_COMPUTE: 21_000n,
  INTRINSIC_STORAGE: 39_000n,
  CONTRACT_CREATION_COMPUTE: 32_000n,
  CODE_DEPOSIT_PER_BYTE: 10_000n,
  CALLDATA_NONZERO_PER_BYTE: 160n,
};

function estimateDeployGas(dataSizeBytes) {
  const dataSize = BigInt(dataSizeBytes);

  const computeGas = MEGAETH_GAS.INTRINSIC_COMPUTE
    + MEGAETH_GAS.CONTRACT_CREATION_COMPUTE;

  const storageGas = MEGAETH_GAS.INTRINSIC_STORAGE
    + (dataSize * MEGAETH_GAS.CODE_DEPOSIT_PER_BYTE)
    + (dataSize * MEGAETH_GAS.CALLDATA_NONZERO_PER_BYTE);

  return (computeGas + storageGas) * 150n / 100n; // 50% buffer
}
```

### Chunking Large Data

For data > 24KB, chunk into multiple contracts:

```javascript
const CHUNK_SIZE = 15000; // 15KB per chunk

function chunkData(data) {
  const chunks = [];
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    chunks.push(data.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}
```

### Solady Implementation

```solidity
import {SSTORE2} from "solady/src/utils/SSTORE2.sol";

address pointer = SSTORE2.write(data);
bytes memory data = SSTORE2.read(pointer);
```

## EIP-6909: Minimal Multi-Token Standard

For contracts managing multiple token types, prefer EIP-6909 over ERC-1155.

### Why EIP-6909 on MegaETH?

| Feature | MegaETH Benefit |
|---------|-----------------|
| No mandatory callbacks | Less gas, simpler integrations |
| No batching in spec | Allows MegaETH-optimized implementations |
| Single contract | Fewer SSTORE operations (expensive) |
| Granular approvals | Per-token-ID OR full operator access |
| Minimal interface | Smaller bytecode |

### Basic Implementation

```solidity
import {ERC6909} from "solady/src/tokens/ERC6909.sol";

contract MultiToken is ERC6909 {
    function name(uint256 id) public view override returns (string memory) {}
    function symbol(uint256 id) public view override returns (string memory) {}
    function tokenURI(uint256 id) public view override returns (string memory) {}

    function mint(address to, uint256 id, uint256 amount) external {
        _mint(to, id, amount);
    }
}
```

### Key Differences from ERC-1155

| | ERC-1155 | EIP-6909 |
|-|----------|----------|
| Callbacks | Required | None |
| Batch transfers | In spec | Implementation choice |
| Approvals | Operator only | Operator + per-ID allowance |
| Complexity | Higher | Minimal |

## Deployment Patterns

### Factory Contracts

```solidity
contract Factory {
    function deploy(bytes32 salt, bytes memory bytecode)
        external
        returns (address)
    {
        address addr;
        assembly {
            addr := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        require(addr != address(0), "Deploy failed");
        return addr;
    }
}
```

### Proxy Patterns

Standard proxy patterns (EIP-1967, UUPS, Transparent) work normally. Consider storage slot allocation costs on first write.

## On-Chain SVG / Metadata Generation

MegaETH's 512KB contract size limit makes on-chain SVG generation practical.

### Stack Depth Management

```solidity
// Split into small functions -- each gets its own stack frame
function _svg() internal pure returns (string memory) {
    string memory part1 = string.concat(_svgOpen(), _svgBg());
    string memory part2 = _svgCorners();
    string memory part3 = string.concat(_svgName(), _svgInfo(), _svgClose());
    return string.concat(part1, part2, part3);
}
```

### Parameter Packing

```solidity
// Pack into array instead of many params
function _render(uint256[6] memory params) internal pure returns (string memory) {}
```

### Upgradeable Renderer Pattern

```solidity
address public tokenURIRenderer;

function tokenURI(uint256 tokenId) public view override returns (string memory) {
    if (tokenURIRenderer != address(0)) {
        return ITokenURIRenderer(tokenURIRenderer).tokenURI(tokenId);
    }
    return _defaultTokenURI(tokenId);
}

function setTokenURIRenderer(address renderer) external onlyOwner {
    tokenURIRenderer = renderer;
}
```

Keep renderers stateless (read from the main contract) so redeployment needs zero migration.

## Contract Verification (Etherscan V2 API)

```bash
# V2 endpoint (preferred)
# https://api.etherscan.io/v2/api?chainid=4326

forge verify-contract <address> src/MyContract.sol:MyContract \
  --chain 4326 \
  --etherscan-api-key $ETHERSCAN_KEY \
  --verifier-url "https://api.etherscan.io/v2/api?chainid=4326"
```

## OP Stack Compatibility

MegaETH uses OP Stack. Standard bridge contracts and predeploys are available:

| Contract | Address |
|----------|---------|
| WETH9 | `0x4200000000000000000000000000000000000006` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| L2CrossDomainMessenger | `0x4200000000000000000000000000000000000007` |

## Common Issues

### "Intrinsic gas too low"
Local simulation uses wrong opcode costs. Use `--skip-simulation` or remote estimation. For large contracts (25KB+ bytecode), use `--gas-limit 500000000` (500M).

### `via_ir` silently breaks return values
Never use `via_ir=true` in foundry.toml. It can cause functions to return 0 instead of correct values with no compiler error. Use `optimizer=true` with `optimizer_runs=200` instead.

### "Out of gas" after block.timestamp
Hitting volatile data access limit. Restructure to access metadata late.

### Transaction stuck
Check nonce with `eth_getTransactionCount` using `pending` tag.
