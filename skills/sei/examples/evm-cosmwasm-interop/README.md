# EVM-CosmWasm Interop on Sei

Sei V2 supports both EVM and CosmWasm execution environments. Pointer contracts and precompiles enable bidirectional communication between them.

## Pointer Contracts: CW20 as ERC20

A CW20 token deployed in CosmWasm can be accessed as an ERC20 in the EVM via its pointer contract.

### Query Pointer Address

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPointer {
    function getPointer(
        uint16 pointerType,
        string memory tokenId
    ) external view returns (address, uint16, bool);
}

// pointerType values:
// 0 = ERC20 pointer for CW20
// 1 = ERC721 pointer for CW721
// 2 = CW20 pointer for ERC20
// 3 = CW721 pointer for ERC721
// 4 = ERC20 pointer for native/IBC denom

contract PointerLookup {
    IPointer constant POINTER = IPointer(0x000000000000000000000000000000000000100b);

    /// @notice Get the ERC20 address that represents a CW20 token.
    function getCW20AsERC20(string calldata cw20ContractAddr) external view returns (address) {
        (address pointerAddr, , bool exists) = POINTER.getPointer(0, cw20ContractAddr);
        require(exists, "No pointer registered for this CW20");
        return pointerAddr;
    }

    /// @notice Get the ERC20 address that represents a native Cosmos denom.
    function getNativeDenomAsERC20(string calldata denom) external view returns (address) {
        (address pointerAddr, , bool exists) = POINTER.getPointer(4, denom);
        require(exists, "No pointer registered for this denom");
        return pointerAddr;
    }

    /// @notice Check if a CW20 has a pointer and return the ERC20 address.
    function hasPointer(string calldata cw20ContractAddr) external view returns (bool, address) {
        (address pointerAddr, , bool exists) = POINTER.getPointer(0, cw20ContractAddr);
        return (exists, pointerAddr);
    }
}
```

### TypeScript: Query and Use Pointer

```typescript
import { createPublicClient, http, parseAbi, type Address } from "viem";
import { sei } from "./chains";

const client = createPublicClient({ chain: sei, transport: http() });

const POINTER: Address = "0x000000000000000000000000000000000000100b";

const pointerAbi = parseAbi([
  "function getPointer(uint16 pointerType, string tokenId) view returns (address, uint16, bool)",
]);

async function getCW20PointerAddress(cw20Addr: string): Promise<Address> {
  const [pointerAddr, , exists] = await client.readContract({
    address: POINTER,
    abi: pointerAbi,
    functionName: "getPointer",
    args: [0, cw20Addr],
  });

  if (!exists) {
    throw new Error(`No ERC20 pointer for CW20 ${cw20Addr}`);
  }

  return pointerAddr;
}

// Once you have the pointer address, use it like any ERC20
async function getPointerBalance(
  cw20Addr: string,
  userAddr: Address
): Promise<bigint> {
  const pointerAddr = await getCW20PointerAddress(cw20Addr);

  const erc20Abi = parseAbi([
    "function balanceOf(address account) view returns (uint256)",
  ]);

  return client.readContract({
    address: pointerAddr,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [userAddr],
  });
}
```

## Calling CosmWasm from EVM

The Wasm precompile allows EVM contracts to instantiate, execute, and query CosmWasm contracts.

### Query a CosmWasm Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IWasm {
    function query(
        string memory contractAddress,
        bytes memory req
    ) external view returns (bytes memory);
}

interface IJson {
    function extractAsUint256(
        bytes memory input,
        string memory key
    ) external view returns (uint256);
    function extractAsBytes(
        bytes memory input,
        string memory key
    ) external view returns (bytes memory);
}

contract CosmWasmReader {
    IWasm constant WASM = IWasm(0x0000000000000000000000000000000000001002);
    IJson constant JSON = IJson(0x0000000000000000000000000000000000001003);

    /// @notice Query a CW20 token balance via CosmWasm.
    function queryCW20Balance(
        string calldata cw20Addr,
        string calldata ownerAddr
    ) external view returns (uint256) {
        // CosmWasm queries use JSON
        bytes memory queryMsg = abi.encodePacked(
            '{"balance":{"address":"', ownerAddr, '"}}'
        );

        bytes memory response = WASM.query(cw20Addr, queryMsg);
        return JSON.extractAsUint256(response, "balance");
    }

    /// @notice Query a CW20 token info (name, symbol, decimals).
    function queryCW20TokenInfo(
        string calldata cw20Addr
    ) external view returns (bytes memory) {
        bytes memory queryMsg = '{"token_info":{}}';
        return WASM.query(cw20Addr, queryMsg);
    }
}
```

### Execute a CosmWasm Contract from EVM

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IWasm {
    function execute(
        string memory contractAddress,
        bytes memory msg,
        bytes memory coins
    ) external returns (bytes memory);
}

contract CosmWasmExecutor {
    IWasm constant WASM = IWasm(0x0000000000000000000000000000000000001002);

    /// @notice Execute a CW20 transfer via the Wasm precompile.
    /// @dev Follows CEI: checks first, then external call.
    function transferCW20(
        string calldata cw20Addr,
        string calldata recipient,
        uint256 amount
    ) external {
        require(amount > 0, "Zero amount");
        require(bytes(recipient).length > 0, "Empty recipient");

        bytes memory executeMsg = abi.encodePacked(
            '{"transfer":{"recipient":"', recipient,
            '","amount":"', _uint256ToString(amount), '"}}'
        );

        // Empty coins for CW20 transfer (no native token attachment)
        bytes memory coins = "[]";

        bytes memory response = WASM.execute(cw20Addr, executeMsg, coins);
        require(response.length > 0, "Execution returned empty response");
    }

    /// @notice Execute a CosmWasm contract with native SEI attached.
    function executeWithSei(
        string calldata contractAddr,
        bytes calldata executeMsg,
        uint256 seiAmount
    ) external {
        require(bytes(contractAddr).length > 0, "Empty contract address");

        bytes memory coins;
        if (seiAmount > 0) {
            coins = abi.encodePacked(
                '[{"denom":"usei","amount":"', _uint256ToString(seiAmount), '"}]'
            );
        } else {
            coins = "[]";
        }

        WASM.execute(contractAddr, executeMsg, coins);
    }

    function _uint256ToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
```

## Address Conversion

Every EVM address has a deterministic Cosmos address and vice versa. The Address precompile handles conversion.

```typescript
import { createPublicClient, http, parseAbi, type Address } from "viem";
import { sei } from "./chains";

const client = createPublicClient({ chain: sei, transport: http() });

const ADDR_PRECOMPILE: Address = "0x0000000000000000000000000000000000001004";

const addrAbi = parseAbi([
  "function getSeiAddr(address evmAddr) view returns (string)",
  "function getEvmAddr(string seiAddr) view returns (address)",
]);

async function evmToSei(evmAddr: Address): Promise<string> {
  return client.readContract({
    address: ADDR_PRECOMPILE,
    abi: addrAbi,
    functionName: "getSeiAddr",
    args: [evmAddr],
  });
}

async function seiToEvm(seiAddr: string): Promise<Address> {
  return client.readContract({
    address: ADDR_PRECOMPILE,
    abi: addrAbi,
    functionName: "getEvmAddr",
    args: [seiAddr],
  });
}
```

## IBC Transfer from EVM

Send tokens cross-chain via IBC directly from an EVM contract.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IIBC {
    function transfer(
        string memory toAddress,
        string memory port,
        string memory channel,
        string memory denom,
        uint256 amount,
        uint64 revisionNumber,
        uint64 revisionHeight,
        uint64 timeoutTimestamp
    ) external returns (bool);
}

contract IBCSender {
    IIBC constant IBC = IIBC(0x0000000000000000000000000000000000001009);

    /// @notice Send usei to another IBC-connected chain.
    /// @dev Timeout is 10 minutes from block timestamp.
    function sendSeiViaIBC(
        string calldata destinationAddr,
        string calldata channel,
        uint256 amount
    ) external {
        require(amount > 0, "Zero amount");
        require(bytes(destinationAddr).length > 0, "Empty destination");

        // Timeout: 10 minutes in nanoseconds
        uint64 timeout = uint64(block.timestamp + 600) * 1_000_000_000;

        bool success = IBC.transfer(
            destinationAddr,
            "transfer",
            channel,
            "usei",
            amount,
            0,  // revisionNumber: 0 for timeout by timestamp only
            0,  // revisionHeight: 0 for timeout by timestamp only
            timeout
        );
        require(success, "IBC transfer failed");
    }
}
```

## Key Notes

- Pointer contracts are automatically available for registered CW20 tokens
- The Wasm precompile uses JSON-encoded messages matching CosmWasm's execute/query format
- Address conversion is deterministic -- the same EVM address always maps to the same Cosmos address
- IBC transfers use Cosmos denom strings (e.g., `usei`, `ibc/...`)
- The JSON precompile is useful for parsing CosmWasm query responses in Solidity
- All precompile calls consume gas like normal contract calls
- Only `CALL` works for state-changing precompile operations (not `DELEGATECALL`)
