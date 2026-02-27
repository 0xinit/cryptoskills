# Hardhat Error Codes

Common errors encountered during Hardhat development with causes and fixes.

Last verified: 2025-05-01

Source: [Hardhat Error List](https://hardhat.org/hardhat-runner/docs/errors)

## Compilation Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `HH700: Artifact not found` | Contract name typo or not compiled | Run `npx hardhat compile`. Check contract name matches filename and `contract` declaration. |
| `HH701: Multiple artifacts match` | Two contracts with the same name in different files | Use fully qualified name: `contracts/path/File.sol:ContractName` |
| `HH606: The project cannot be compiled` | Solidity compilation failure | Read the solc error output. Common: missing imports, version mismatch, syntax error. |

## Network & Connection Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `HH110: Invalid JSON-RPC response` | RPC endpoint returned non-JSON (rate limit, auth failure) | Check RPC URL, API key, and rate limits. Try a different provider. |
| `HH108: Cannot connect to the network` | RPC endpoint unreachable | Verify URL, check network connectivity, ensure provider is not down. |
| `ProviderError: insufficient funds` | Deployer account has no ETH for gas | Fund the account on the target network. |
| `ProviderError: nonce too low` | Transaction nonce conflict from previous failed tx | Wait for pending txs to confirm, or manually set nonce. Reset Hardhat Network with `hardhat_reset`. |

## Configuration Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `HH1: You are not inside a Hardhat project` | No `hardhat.config.ts/js` in directory | Run from project root or create config file. |
| `HH100: Network not found` | `--network` flag references undefined network | Add the network to `hardhat.config.ts` under `networks`. |
| `HH101: Hardhat was set to use a nonexistent account` | Private key in config is invalid or missing | Check `accounts` array in network config. Ensure env var is set. |
| `HH12: Hardhat config file not found` | Config file missing or wrong extension | Create `hardhat.config.ts` (or `.js`) in project root. |

## Plugin Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `HH303: Unrecognized task` | Task name typo or plugin not imported | Import the plugin in `hardhat.config.ts`. Check task name spelling. |
| `NomicLabsHardhatPluginError` | Plugin version incompatible with Hardhat version | Update plugin: `npm update <plugin-name>`. Check compatibility matrix. |

## Verification Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Error: ETHERSCAN_API_KEY not set` | Missing API key for block explorer | Set `etherscan.apiKey` in config or `ETHERSCAN_API_KEY` env var. |
| `Error: Contract source code already verified` | Contract was previously verified | No action needed. The contract is already verified. |
| `Error: Bytecode does not match` | Constructor args or compiler settings differ from deployment | Ensure exact same compiler version, optimizer settings, and constructor args. Use `--constructor-args` file. |
| `Error: Contract not found` | Wrong address or contract not yet indexed | Wait a few minutes after deployment. Confirm the address on the block explorer. |

## Testing Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `AssertionError: expected ... to be reverted` | Transaction succeeded when it should have reverted | Check test conditions. The function may not revert for the given inputs. |
| `Error: VM Exception ... reverted with reason` | Solidity require/revert triggered | Expected in negative tests. Use `.to.be.revertedWith()` or `.to.be.revertedWithCustomError()`. |
| `Error: Transaction ran out of gas` | Gas limit too low for the operation | Increase `gasLimit` in tx options or check for infinite loops. |
| `TypeError: token.connect is not a function` | Using raw ethers Contract instead of Hardhat-wrapped | Use `ethers.getContractAt()` or deploy via `ethers.getContractFactory()` for proper typing. |

## Forking Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Error: Missing trie node` | Non-archive RPC cannot serve historical state | Use archive-tier RPC (Alchemy Growth, Infura archive). |
| `Error: header not found` | Block number is beyond what the RPC serves | Use a block number within the provider's archive range. |
| `InvalidInputError: sender doesn't have enough funds` | Impersonated account has 0 ETH | Call `setBalance()` from network-helpers before transacting. |

## TypeScript Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot find module 'hardhat/config'` | Missing `hardhat` in devDependencies | Run `npm install --save-dev hardhat`. |
| `Cannot find module '../typechain-types'` | Types not generated yet | Run `npx hardhat compile` to generate TypeChain types. |
| `Property 'ethers' does not exist on type 'HardhatRuntimeEnvironment'` | Plugin not imported | Add `import "@nomicfoundation/hardhat-toolbox"` to config. |

## Resolution Steps (General)

1. Read the full error message — Hardhat errors include the error code and a link to documentation
2. Run `npx hardhat clean` then `npx hardhat compile` — clears cached artifacts
3. Delete `node_modules` and reinstall — resolves dependency conflicts
4. Check Hardhat version: `npx hardhat --version` — ensure v2.19+ for latest features
5. Check plugin compatibility — all `@nomicfoundation/` plugins should be on compatible versions
