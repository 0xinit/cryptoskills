# Production Deployment Security Checklist

Every item must be verified before deploying to mainnet. Mark each with evidence (TX hash, test output, tool report).

## Access Control

- [ ] Every privileged function has an explicit access modifier (`onlyRole`, `onlyOwner`)
- [ ] Admin address is a multisig (Gnosis Safe), not an EOA
- [ ] Upgrade functions (`upgradeTo`, `upgradeToAndCall`) are protected with the correct role
- [ ] `renounceOwnership` is overridden to revert, or team confirms intentional
- [ ] Timelock is configured for sensitive operations (fee changes, parameter updates, large withdrawals)
- [ ] All role assignments are verified -- no extra roles granted during deployment

## Upgrade Mechanism (if upgradeable)

- [ ] `_disableInitializers()` is in the implementation constructor
- [ ] `_authorizeUpgrade` has proper access control (UUPS)
- [ ] Storage layout diff between current and previous version shows no collisions
- [ ] `__gap` array is present and shrinks correctly with new variables
- [ ] Upgrade path tested: deploy V1, upgrade to V2, verify state preserved
- [ ] No `selfdestruct` or `delegatecall` to untrusted addresses in implementation

## Emergency Controls

- [ ] Pause mechanism exists and is tested (`whenNotPaused` modifier)
- [ ] Pause is callable by a Guardian role (separate from admin)
- [ ] Unpause requires a higher-privilege role or timelock
- [ ] Emergency withdrawal function exists for recovering stuck funds
- [ ] Emergency functions are tested with fork tests against real state

## External Dependencies

- [ ] All imported contracts pinned to exact versions (no `^` in dependencies)
- [ ] OpenZeppelin version is current and matches audit scope
- [ ] Oracle feeds verified: correct pair, correct decimals, correct chain
- [ ] Chainlink feed addresses verified onchain (`cast call <feed> "description()"`)
- [ ] External protocol addresses are immutable or admin-only updateable

## Reentrancy and External Calls

- [ ] CEI (Checks-Effects-Interactions) pattern followed in every function with external calls
- [ ] `ReentrancyGuard` applied to all state-changing functions that make external calls
- [ ] `SafeERC20` used for all ERC20 operations
- [ ] Return values of all low-level calls checked (`require(ok)`)
- [ ] No `transfer()` or `send()` for ETH transfers (use `call{value:}("")`)

## Events and Monitoring

- [ ] Events emitted for every state change (deposits, withdrawals, parameter updates, role changes)
- [ ] Event parameters are indexed where appropriate for offchain filtering
- [ ] Monitoring/alerting configured for critical events (large withdrawals, pauses, upgrades)

## Code Hygiene

- [ ] No remaining `TODO`, `FIXME`, or `HACK` comments
- [ ] No `console.log` or `console2.log` imports
- [ ] No test-only functions or backdoors in production code
- [ ] All `require` strings replaced with custom errors (gas optimization)
- [ ] NatSpec present on all public/external functions
- [ ] Compiler version pinned: `pragma solidity 0.8.20;` (no floating `^`)

## Arithmetic and Token Handling

- [ ] Token decimal handling verified for every token the contract interacts with
- [ ] No division-before-multiplication precision loss
- [ ] All `unchecked` blocks reviewed and overflow-safe
- [ ] All downcasts (e.g., `uint256` to `uint128`) have explicit bounds checks
- [ ] Fee calculations use basis points with correct denominator

## Oracle Security

- [ ] Staleness check: `updatedAt > block.timestamp - maxStaleness`
- [ ] Negative price check: `answer > 0`
- [ ] Round completeness: `answeredInRound >= roundId`
- [ ] Sequencer uptime check (L2 deployments: Arbitrum, Optimism)
- [ ] Fallback oracle configured in case primary feed fails
- [ ] No spot prices from DEX pools used for pricing

## Formal Verification and Testing

- [ ] Line coverage above 90% (`forge coverage`)
- [ ] Fuzz tests on all math-heavy functions with 10,000+ runs
- [ ] Invariant tests on core protocol properties (solvency, supply accounting)
- [ ] Fork tests against mainnet state for integration correctness
- [ ] Slither report clean (all findings addressed or documented as accepted risk)
- [ ] Mythril or Aderyn scan completed on critical contracts

## Deployment Process

- [ ] Deployment script tested on testnet (Sepolia/Goerli) with identical parameters
- [ ] `--slow` flag used for mainnet deployment (avoids nonce issues)
- [ ] Contract verified on block explorer (Etherscan, Arbiscan, etc.) immediately after deploy
- [ ] Constructor arguments and initializer parameters double-checked against spec
- [ ] Deployment transaction signed by multisig, not single EOA
- [ ] Post-deployment: call every view function to verify initial state is correct
- [ ] Private keys stored in environment variables, never hardcoded or committed

## Post-Deployment Verification

```bash
# Verify contract source
forge verify-contract <address> src/Contract.sol:Contract \
  --chain-id 1 \
  --etherscan-api-key $ETHERSCAN_KEY

# Verify initial state
cast call <address> "owner()" --rpc-url $ETH_RPC_URL
cast call <address> "paused()" --rpc-url $ETH_RPC_URL

# Verify admin is multisig
cast call <address> "hasRole(bytes32,address)" \
  $(cast keccak "DEFAULT_ADMIN_ROLE") <multisig_address> \
  --rpc-url $ETH_RPC_URL
```
