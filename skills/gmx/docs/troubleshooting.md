# GMX V2 Troubleshooting

Common issues and fixes when integrating with GMX V2 contracts on Arbitrum and Avalanche.

Last verified: February 2026

## Order Created But Never Executed

### Symptoms

- Transaction succeeds (order creation tx confirmed)
- No subsequent execution transaction appears
- Position is not opened; tokens remain in vault

### Solutions

1. **Insufficient execution fee**: The keeper rejected the order because the execution fee does not cover gas costs. Increase the execution fee:

```typescript
// Use at least 0.001 ETH as a baseline and adjust for gas price spikes
const executionFee = parseEther("0.002");
```

2. **Keeper backlog**: During high-volatility periods, keepers may be processing a queue. Orders are typically executed within 1-30 seconds. Check [GMX Status](https://app.gmx.io/) or the GMX Discord for outage reports.

3. **Oracle price unavailable**: The Chainlink Data Stream for the market's index token may be temporarily unavailable. Synthetic markets (DOGE, XRP, etc.) are more susceptible to oracle delays.

4. **Order auto-cancelled**: If the market price moved past your `acceptablePrice` between order creation and execution, the keeper auto-cancels the order. Collateral minus gas costs is refunded. Widen the `acceptablePrice` range.

## "CALL_EXCEPTION" on multicall

### Symptoms

```
Error: CALL_EXCEPTION
```

### Solutions

1. **Wrong contract address**: GMX upgrades the ExchangeRouter periodically. Verify you are using the current address from [docs.gmx.io/docs/api/contracts](https://docs.gmx.io/docs/api/contracts/):

```typescript
// Current Arbitrum ExchangeRouter
const EXCHANGE_ROUTER = "0x69C527fC77291722b52649E45c838e41be8Bf5d5" as const;
```

2. **ABI mismatch**: The `createOrder` params struct has changed between V2 versions. Ensure your ABI includes the `autoCancel` field (added in V2.1).

3. **Missing msg.value**: The `value` field in the transaction must equal the total ETH sent via `sendWnt` calls. If you call `sendWnt` for both execution fee and ETH collateral, `value` must be the sum:

```typescript
const hash = await walletClient.writeContract({
  address: EXCHANGE_ROUTER,
  abi: exchangeRouterAbi,
  functionName: "multicall",
  args: [[sendWntData, createOrderData]],
  value: collateral + executionFee, // must match sendWnt total
});
```

## Token Approval Errors

### Symptoms

- `TokenTransferError` revert
- Order creation fails silently (no tokens transferred)

### Solutions

1. **Approve to Router, not ExchangeRouter**: Token approvals must target the Router contract. The ExchangeRouter calls the Router internally to transfer tokens:

```typescript
// Correct: approve to Router
await walletClient.writeContract({
  address: USDC,
  abi: erc20Abi,
  functionName: "approve",
  args: ["0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6", 2n ** 256n - 1n],
});

// Wrong: approving to ExchangeRouter does nothing
```

2. **Insufficient balance**: Verify the account has enough tokens:

```typescript
const balance = await publicClient.readContract({
  address: USDC,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [account.address],
});
console.log("USDC balance:", balance);
```

3. **Using USDC.e instead of USDC**: Arbitrum has two USDC variants. Native USDC (`0xaf88d065e77c8cC2239327C5EDb3A432268e5831`) is the standard. Bridged USDC.e (`0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8`) is separate. Ensure you are using the correct one for the market.

## Incorrect Position Size (USD Decimals)

### Symptoms

- Position size is orders of magnitude too large or too small
- `MaxLeverageExceeded` error on small positions
- Positions appear with wrong dollar value on GMX UI

### Solutions

GMX uses 30-decimal precision for USD values:

```typescript
// Wrong: 18 decimals
const wrongSize = 5000n * 10n ** 18n;

// Correct: 30 decimals
const correctSize = 5000n * 10n ** 30n;

// Helper function that avoids floating-point precision loss
const toUsd30 = (usd: number) => BigInt(Math.round(usd * 1e6)) * 10n ** 24n;
const positionSize = toUsd30(5000); // $5,000 with 30 decimals
```

## GM Token Deposit Fails

### Symptoms

- `EmptyDeposit` revert
- Deposit transaction succeeds but no GM tokens received

### Solutions

1. **Tokens not sent to DepositVault**: The multicall must include `sendWnt` or `sendTokens` to transfer tokens to the DepositVault BEFORE the `createDeposit` call:

```typescript
// Order matters: send tokens first, then create deposit
const calls = [
  sendWntToDepositVault,    // ETH collateral + execution fee
  createDepositData,         // must come after token transfer
];
```

2. **Wrong vault**: Orders use OrderVault. Deposits use DepositVault. Withdrawals use WithdrawalVault. Sending tokens to the wrong vault will lose them.

| Action | Vault |
|--------|-------|
| Swap / Increase / Decrease | OrderVault (`0x31eF83a530Fde1B38EE9A18093A333D8Bbbc40D5`) |
| Deposit (buy GM) | DepositVault (`0xF89e77e8Dc11691C9e8757e84aaFbCD8A67d7A55`) |
| Withdrawal (sell GM) | WithdrawalVault (`0x0628D46b5D145f183AdB6Ef1f2c97eD1C4701c55`) |

3. **Missing GM token approval for withdrawals**: When selling GM tokens, you must approve the Router to spend them, then use `sendTokens` to transfer GM tokens to the WithdrawalVault.

## Position Not Found on Decrease

### Symptoms

- `PositionNotFound` revert when trying to close or decrease a position
- `EmptyPosition` error

### Solutions

1. **Wrong market/direction/collateral combination**: A position is identified by the tuple `(account, market, collateralToken, isLong)`. All four must match exactly:

```typescript
const positions = await publicClient.readContract({
  address: READER,
  abi: readerAbi,
  functionName: "getAccountPositions",
  args: [DATA_STORE, account.address, 0n, 100n],
});

// Find the exact position to close
for (const pos of positions) {
  console.log(
    pos.addresses.market,
    pos.addresses.collateralToken,
    pos.flags.isLong
  );
}
```

2. **Position was already liquidated**: If the position's collateral dropped below the maintenance margin, it was liquidated by a keeper. Check transaction history for liquidation events.

3. **Pending order exists**: If a MarketIncrease order was created but not yet executed, the position does not exist yet. Wait for order execution.

## SDK Initialization Errors

### Symptoms

- `TypeError: Cannot read properties of undefined`
- SDK methods return empty data
- Network errors from oracle or SubSquid

### Solutions

1. **Missing oracleUrl or subsquidUrl**: Both are required for the SDK to function:

```typescript
const sdk = new GmxSdk({
  chainId: 42161,
  rpcUrl: process.env.ARBITRUM_RPC_URL!,
  oracleUrl: "https://arbitrum-api.gmxinfra.io",
  subsquidUrl:
    "https://gmx.squids.live/gmx-synthetics-arbitrum:prod/api/graphql",
});
```

2. **Wrong chainId**: Use `42161` for Arbitrum, `43114` for Avalanche. Other chain IDs are not supported.

3. **Account not set**: Write operations require `sdk.setAccount()` before use:

```typescript
sdk.setAccount(account.address);
```

4. **Rate limiting**: The oracle and SubSquid endpoints may rate-limit aggressive polling. Add delays between repeated reads or cache results.

## Transaction Reverts with No Error Message

### Symptoms

- Transaction reverts with empty error data
- Etherscan shows "Fail" with no decoded error

### Solutions

1. **Simulate first**: Use `publicClient.simulateContract` to get a decoded error before submitting:

```typescript
try {
  await publicClient.simulateContract({
    address: EXCHANGE_ROUTER,
    abi: exchangeRouterAbi,
    functionName: "multicall",
    args: [[sendWntData, createOrderData]],
    value: executionFee,
    account: account.address,
  });
} catch (error) {
  console.error("Simulation failed:", error);
}
```

2. **Decode custom errors**: GMX uses custom Solidity errors. If using viem, errors are automatically decoded if the ABI includes the error definitions. Check [Errors.sol](https://github.com/gmx-io/gmx-synthetics/blob/main/contracts/error/Errors.sol) for the full error list.

3. **Check Tenderly or Dedaub**: Paste the transaction hash into [Tenderly](https://dashboard.tenderly.co/) or [Dedaub](https://app.dedaub.com/) for step-by-step trace with decoded errors.
