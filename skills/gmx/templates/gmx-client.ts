import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  parseEther,
  erc20Abi,
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum, avalanche } from "viem/chains";

// --- Configuration ---

interface GmxConfig {
  chainId: 42161 | 43114;
  rpcUrl: string;
  privateKey: `0x${string}`;
}

// Arbitrum addresses — verify at https://docs.gmx.io/docs/api/contracts/
const ARBITRUM_CONTRACTS = {
  ExchangeRouter: "0x69C527fC77291722b52649E45c838e41be8Bf5d5" as const,
  Router: "0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6" as const,
  Reader: "0x22199a49A999c351eF7927602CFB187ec3cae489" as const,
  DataStore: "0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8" as const,
  OrderVault: "0x31eF83a530Fde1B38EE9A18093A333D8Bbbc40D5" as const,
  DepositVault: "0xF89e77e8Dc11691C9e8757e84aaFbCD8A67d7A55" as const,
  WithdrawalVault: "0x0628D46b5D145f183AdB6Ef1f2c97eD1C4701c55" as const,
  WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" as const,
  USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const,
};

const AVALANCHE_CONTRACTS = {
  ExchangeRouter: "0x3BE24aED1a4CcA8DE542b94218b3753A218bC0a0" as const,
  Router: "0x820F5FfC5b525cD4d88Cd91aCf2c28F16530Cc68" as const,
  Reader: "0x0537C767cDAD5Ef2b80b4F740a0f5D7c6cA46241" as const,
  DataStore: "0x2F0b22339414ADeD7D5F06f9D604c7fF5b2fe3f6" as const,
  OrderVault: "0x0000000000000000000000000000000000000000" as const, // verify before use
  DepositVault: "0x90c670825d0C62ede1c5ee9571d6d9a17A722DFF" as const,
  WithdrawalVault: "0x0000000000000000000000000000000000000000" as const, // verify before use
  WETH: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB" as const, // WETH.e
  USDC: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E" as const,
};

// --- ABI fragments ---

const exchangeRouterAbi = [
  {
    name: "multicall",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
  {
    name: "sendWnt",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "receiver", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "sendTokens",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "receiver", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "createOrder",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          {
            name: "addresses",
            type: "tuple",
            components: [
              { name: "receiver", type: "address" },
              { name: "cancellationReceiver", type: "address" },
              { name: "callbackContract", type: "address" },
              { name: "uiFeeReceiver", type: "address" },
              { name: "market", type: "address" },
              { name: "initialCollateralToken", type: "address" },
              { name: "swapPath", type: "address[]" },
            ],
          },
          {
            name: "numbers",
            type: "tuple",
            components: [
              { name: "sizeDeltaUsd", type: "uint256" },
              { name: "initialCollateralDeltaAmount", type: "uint256" },
              { name: "triggerPrice", type: "uint256" },
              { name: "acceptablePrice", type: "uint256" },
              { name: "executionFee", type: "uint256" },
              { name: "callbackGasLimit", type: "uint256" },
              { name: "minOutputAmount", type: "uint256" },
            ],
          },
          { name: "orderType", type: "uint8" },
          { name: "decreasePositionSwapType", type: "uint8" },
          { name: "isLong", type: "bool" },
          { name: "shouldUnwrapNativeToken", type: "bool" },
          { name: "autoCancel", type: "bool" },
          { name: "referralCode", type: "bytes32" },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "createDeposit",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "receiver", type: "address" },
          { name: "callbackContract", type: "address" },
          { name: "uiFeeReceiver", type: "address" },
          { name: "market", type: "address" },
          { name: "initialLongToken", type: "address" },
          { name: "initialShortToken", type: "address" },
          { name: "longTokenSwapPath", type: "address[]" },
          { name: "shortTokenSwapPath", type: "address[]" },
          { name: "minMarketTokens", type: "uint256" },
          { name: "shouldUnwrapNativeToken", type: "bool" },
          { name: "executionFee", type: "uint256" },
          { name: "callbackGasLimit", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "createWithdrawal",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "receiver", type: "address" },
          { name: "callbackContract", type: "address" },
          { name: "uiFeeReceiver", type: "address" },
          { name: "market", type: "address" },
          { name: "longTokenSwapPath", type: "address[]" },
          { name: "shortTokenSwapPath", type: "address[]" },
          { name: "minLongTokenAmount", type: "uint256" },
          { name: "minShortTokenAmount", type: "uint256" },
          { name: "shouldUnwrapNativeToken", type: "bool" },
          { name: "executionFee", type: "uint256" },
          { name: "callbackGasLimit", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

const readerAbi = [
  {
    name: "getMarkets",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "dataStore", type: "address" },
      { name: "start", type: "uint256" },
      { name: "end", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "marketToken", type: "address" },
          { name: "indexToken", type: "address" },
          { name: "longToken", type: "address" },
          { name: "shortToken", type: "address" },
        ],
      },
    ],
  },
  {
    name: "getAccountPositions",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "dataStore", type: "address" },
      { name: "account", type: "address" },
      { name: "start", type: "uint256" },
      { name: "end", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          {
            name: "addresses",
            type: "tuple",
            components: [
              { name: "account", type: "address" },
              { name: "market", type: "address" },
              { name: "collateralToken", type: "address" },
            ],
          },
          {
            name: "numbers",
            type: "tuple",
            components: [
              { name: "sizeInUsd", type: "uint256" },
              { name: "sizeInTokens", type: "uint256" },
              { name: "collateralAmount", type: "uint256" },
              { name: "borrowingFactor", type: "uint256" },
              { name: "fundingFeeAmountPerSize", type: "uint256" },
              { name: "longTokenClaimableFundingAmountPerSize", type: "uint256" },
              { name: "shortTokenClaimableFundingAmountPerSize", type: "uint256" },
              { name: "increasedAtTime", type: "uint256" },
              { name: "decreasedAtTime", type: "uint256" },
            ],
          },
          {
            name: "flags",
            type: "tuple",
            components: [{ name: "isLong", type: "bool" }],
          },
        ],
      },
    ],
  },
] as const;

// --- Types ---

enum OrderType {
  MarketSwap = 0,
  LimitSwap = 1,
  MarketIncrease = 2,
  LimitIncrease = 3,
  MarketDecrease = 4,
  LimitDecrease = 5,
  StopLossDecrease = 6,
  Liquidation = 7,
}

interface Market {
  marketToken: Address;
  indexToken: Address;
  longToken: Address;
  shortToken: Address;
}

interface Position {
  market: Address;
  collateralToken: Address;
  isLong: boolean;
  sizeInUsd: bigint;
  sizeInTokens: bigint;
  collateralAmount: bigint;
}

// --- Utility ---

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

// GMX uses 30-decimal precision for USD values
function toUsd30(usd: number): bigint {
  return BigInt(Math.round(usd * 1e6)) * 10n ** 24n;
}

function fromUsd30(value: bigint): number {
  return Number(value / 10n ** 24n) / 1e6;
}

// --- Client ---

class GmxClient {
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private contracts: typeof ARBITRUM_CONTRACTS;
  private account: Address;
  private executionFee: bigint;

  constructor(config: GmxConfig) {
    const chain = config.chainId === 42161 ? arbitrum : avalanche;
    const account = privateKeyToAccount(config.privateKey);

    this.publicClient = createPublicClient({
      chain,
      transport: http(config.rpcUrl),
    });

    this.walletClient = createWalletClient({
      account,
      chain,
      transport: http(config.rpcUrl),
    });

    this.contracts =
      config.chainId === 42161 ? ARBITRUM_CONTRACTS : AVALANCHE_CONTRACTS;
    this.account = account.address;
    this.executionFee = parseEther("0.001");
  }

  setExecutionFee(fee: bigint): void {
    this.executionFee = fee;
  }

  // --- Read Operations ---

  async getMarkets(): Promise<Market[]> {
    const markets = await this.publicClient.readContract({
      address: this.contracts.Reader,
      abi: readerAbi,
      functionName: "getMarkets",
      args: [this.contracts.DataStore, 0n, 200n],
    });

    return markets.map((m) => ({
      marketToken: m.marketToken,
      indexToken: m.indexToken,
      longToken: m.longToken,
      shortToken: m.shortToken,
    }));
  }

  async getPositions(): Promise<Position[]> {
    const positions = await this.publicClient.readContract({
      address: this.contracts.Reader,
      abi: readerAbi,
      functionName: "getAccountPositions",
      args: [this.contracts.DataStore, this.account, 0n, 100n],
    });

    return positions.map((p) => ({
      market: p.addresses.market,
      collateralToken: p.addresses.collateralToken,
      isLong: p.flags.isLong,
      sizeInUsd: p.numbers.sizeInUsd,
      sizeInTokens: p.numbers.sizeInTokens,
      collateralAmount: p.numbers.collateralAmount,
    }));
  }

  // --- Token Approval ---

  async approveToken(
    token: Address,
    amount: bigint = 2n ** 256n - 1n
  ): Promise<Hash> {
    const hash = await this.walletClient.writeContract({
      address: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [this.contracts.Router, amount],
    });
    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  // --- Spot Swap ---

  async createSwapOrder(params: {
    tokenIn: Address;
    market: Address;
    swapPath: Address[];
    amount: bigint;
    minOutputAmount: bigint;
    shouldUnwrapNativeToken: boolean;
  }): Promise<Hash> {
    const isNativeIn = params.tokenIn === this.contracts.WETH;

    const calls: `0x${string}`[] = [];

    if (isNativeIn) {
      calls.push(
        encodeFunctionData({
          abi: exchangeRouterAbi,
          functionName: "sendWnt",
          args: [this.contracts.OrderVault, params.amount + this.executionFee],
        })
      );
    } else {
      calls.push(
        encodeFunctionData({
          abi: exchangeRouterAbi,
          functionName: "sendWnt",
          args: [this.contracts.OrderVault, this.executionFee],
        })
      );
      calls.push(
        encodeFunctionData({
          abi: exchangeRouterAbi,
          functionName: "sendTokens",
          args: [params.tokenIn, this.contracts.OrderVault, params.amount],
        })
      );
    }

    calls.push(
      encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "createOrder",
        args: [
          {
            addresses: {
              receiver: this.account,
              cancellationReceiver: this.account,
              callbackContract: ZERO_ADDRESS,
              uiFeeReceiver: ZERO_ADDRESS,
              market: params.market,
              initialCollateralToken: params.tokenIn,
              swapPath: params.swapPath,
            },
            numbers: {
              sizeDeltaUsd: 0n,
              initialCollateralDeltaAmount: 0n,
              triggerPrice: 0n,
              acceptablePrice: 0n,
              executionFee: this.executionFee,
              callbackGasLimit: 0n,
              minOutputAmount: params.minOutputAmount,
            },
            orderType: OrderType.MarketSwap,
            decreasePositionSwapType: 0,
            isLong: false,
            shouldUnwrapNativeToken: params.shouldUnwrapNativeToken,
            autoCancel: false,
            referralCode: ZERO_BYTES32,
          },
        ],
      })
    );

    const value = isNativeIn
      ? params.amount + this.executionFee
      : this.executionFee;

    const hash = await this.walletClient.writeContract({
      address: this.contracts.ExchangeRouter,
      abi: exchangeRouterAbi,
      functionName: "multicall",
      args: [calls],
      value,
    });

    return hash;
  }

  // --- Perpetual Position ---

  async createIncreaseOrder(params: {
    market: Address;
    collateralToken: Address;
    collateralAmount: bigint;
    sizeDeltaUsd: bigint;
    isLong: boolean;
    acceptablePrice: bigint;
  }): Promise<Hash> {
    const isNativeCollateral =
      params.collateralToken === this.contracts.WETH;

    const calls: `0x${string}`[] = [];

    if (isNativeCollateral) {
      calls.push(
        encodeFunctionData({
          abi: exchangeRouterAbi,
          functionName: "sendWnt",
          args: [
            this.contracts.OrderVault,
            params.collateralAmount + this.executionFee,
          ],
        })
      );
    } else {
      calls.push(
        encodeFunctionData({
          abi: exchangeRouterAbi,
          functionName: "sendWnt",
          args: [this.contracts.OrderVault, this.executionFee],
        })
      );
      calls.push(
        encodeFunctionData({
          abi: exchangeRouterAbi,
          functionName: "sendTokens",
          args: [
            params.collateralToken,
            this.contracts.OrderVault,
            params.collateralAmount,
          ],
        })
      );
    }

    calls.push(
      encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "createOrder",
        args: [
          {
            addresses: {
              receiver: this.account,
              cancellationReceiver: this.account,
              callbackContract: ZERO_ADDRESS,
              uiFeeReceiver: ZERO_ADDRESS,
              market: params.market,
              initialCollateralToken: params.collateralToken,
              swapPath: [],
            },
            numbers: {
              sizeDeltaUsd: params.sizeDeltaUsd,
              initialCollateralDeltaAmount: 0n,
              triggerPrice: 0n,
              acceptablePrice: params.acceptablePrice,
              executionFee: this.executionFee,
              callbackGasLimit: 0n,
              minOutputAmount: 0n,
            },
            orderType: OrderType.MarketIncrease,
            decreasePositionSwapType: 0,
            isLong: params.isLong,
            shouldUnwrapNativeToken: false,
            autoCancel: false,
            referralCode: ZERO_BYTES32,
          },
        ],
      })
    );

    const value = isNativeCollateral
      ? params.collateralAmount + this.executionFee
      : this.executionFee;

    return this.walletClient.writeContract({
      address: this.contracts.ExchangeRouter,
      abi: exchangeRouterAbi,
      functionName: "multicall",
      args: [calls],
      value,
    });
  }

  async createDecreaseOrder(params: {
    market: Address;
    collateralToken: Address;
    sizeDeltaUsd: bigint;
    isLong: boolean;
    acceptablePrice: bigint;
    orderType?: OrderType.MarketDecrease | OrderType.LimitDecrease | OrderType.StopLossDecrease;
    triggerPrice?: bigint;
    shouldUnwrapNativeToken?: boolean;
  }): Promise<Hash> {
    const calls: `0x${string}`[] = [];

    calls.push(
      encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "sendWnt",
        args: [this.contracts.OrderVault, this.executionFee],
      })
    );

    calls.push(
      encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "createOrder",
        args: [
          {
            addresses: {
              receiver: this.account,
              cancellationReceiver: this.account,
              callbackContract: ZERO_ADDRESS,
              uiFeeReceiver: ZERO_ADDRESS,
              market: params.market,
              initialCollateralToken: params.collateralToken,
              swapPath: [],
            },
            numbers: {
              sizeDeltaUsd: params.sizeDeltaUsd,
              initialCollateralDeltaAmount: 0n,
              triggerPrice: params.triggerPrice ?? 0n,
              acceptablePrice: params.acceptablePrice,
              executionFee: this.executionFee,
              callbackGasLimit: 0n,
              minOutputAmount: 0n,
            },
            orderType: params.orderType ?? OrderType.MarketDecrease,
            decreasePositionSwapType: 0,
            isLong: params.isLong,
            shouldUnwrapNativeToken: params.shouldUnwrapNativeToken ?? true,
            autoCancel: false,
            referralCode: ZERO_BYTES32,
          },
        ],
      })
    );

    return this.walletClient.writeContract({
      address: this.contracts.ExchangeRouter,
      abi: exchangeRouterAbi,
      functionName: "multicall",
      args: [calls],
      value: this.executionFee,
    });
  }

  // --- Liquidity ---

  async buyGmTokens(params: {
    market: Address;
    longToken: Address | null;
    longAmount: bigint;
    shortToken: Address | null;
    shortAmount: bigint;
    minGmTokens: bigint;
  }): Promise<Hash> {
    const calls: `0x${string}`[] = [];
    let ethValue = this.executionFee;

    // Determine total native ETH needed
    const longIsNative =
      params.longToken === this.contracts.WETH && params.longAmount > 0n;
    const shortIsNative =
      params.shortToken === this.contracts.WETH && params.shortAmount > 0n;

    if (longIsNative) ethValue += params.longAmount;
    if (shortIsNative) ethValue += params.shortAmount;

    // Send native token (execution fee + any ETH amounts)
    calls.push(
      encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "sendWnt",
        args: [this.contracts.DepositVault, ethValue],
      })
    );

    // Send ERC-20 tokens
    if (params.longToken && params.longAmount > 0n && !longIsNative) {
      calls.push(
        encodeFunctionData({
          abi: exchangeRouterAbi,
          functionName: "sendTokens",
          args: [
            params.longToken,
            this.contracts.DepositVault,
            params.longAmount,
          ],
        })
      );
    }

    if (params.shortToken && params.shortAmount > 0n && !shortIsNative) {
      calls.push(
        encodeFunctionData({
          abi: exchangeRouterAbi,
          functionName: "sendTokens",
          args: [
            params.shortToken,
            this.contracts.DepositVault,
            params.shortAmount,
          ],
        })
      );
    }

    calls.push(
      encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "createDeposit",
        args: [
          {
            receiver: this.account,
            callbackContract: ZERO_ADDRESS,
            uiFeeReceiver: ZERO_ADDRESS,
            market: params.market,
            initialLongToken: params.longToken ?? ZERO_ADDRESS,
            initialShortToken: params.shortToken ?? ZERO_ADDRESS,
            longTokenSwapPath: [],
            shortTokenSwapPath: [],
            minMarketTokens: params.minGmTokens,
            shouldUnwrapNativeToken: false,
            executionFee: this.executionFee,
            callbackGasLimit: 0n,
          },
        ],
      })
    );

    return this.walletClient.writeContract({
      address: this.contracts.ExchangeRouter,
      abi: exchangeRouterAbi,
      functionName: "multicall",
      args: [calls],
      value: ethValue,
    });
  }

  async sellGmTokens(params: {
    market: Address;
    gmAmount: bigint;
    minLongTokenAmount: bigint;
    minShortTokenAmount: bigint;
    shouldUnwrapNativeToken: boolean;
  }): Promise<Hash> {
    const calls: `0x${string}`[] = [];

    calls.push(
      encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "sendWnt",
        args: [this.contracts.WithdrawalVault, this.executionFee],
      })
    );

    calls.push(
      encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "sendTokens",
        args: [
          params.market,
          this.contracts.WithdrawalVault,
          params.gmAmount,
        ],
      })
    );

    calls.push(
      encodeFunctionData({
        abi: exchangeRouterAbi,
        functionName: "createWithdrawal",
        args: [
          {
            receiver: this.account,
            callbackContract: ZERO_ADDRESS,
            uiFeeReceiver: ZERO_ADDRESS,
            market: params.market,
            longTokenSwapPath: [],
            shortTokenSwapPath: [],
            minLongTokenAmount: params.minLongTokenAmount,
            minShortTokenAmount: params.minShortTokenAmount,
            shouldUnwrapNativeToken: params.shouldUnwrapNativeToken,
            executionFee: this.executionFee,
            callbackGasLimit: 0n,
          },
        ],
      })
    );

    return this.walletClient.writeContract({
      address: this.contracts.ExchangeRouter,
      abi: exchangeRouterAbi,
      functionName: "multicall",
      args: [calls],
      value: this.executionFee,
    });
  }

  // --- Utilities ---

  async waitForReceipt(hash: Hash) {
    return this.publicClient.waitForTransactionReceipt({ hash });
  }
}

// --- Usage Example ---
//
// const client = new GmxClient({
//   chainId: 42161,
//   rpcUrl: process.env.ARBITRUM_RPC_URL!,
//   privateKey: process.env.PRIVATE_KEY as `0x${string}`,
// });
//
// // Read markets
// const markets = await client.getMarkets();
//
// // Open 10x long ETH with 0.5 ETH collateral
// const hash = await client.createIncreaseOrder({
//   market: "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336",
//   collateralToken: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
//   collateralAmount: parseEther("0.5"),
//   sizeDeltaUsd: toUsd30(5000),
//   isLong: true,
//   acceptablePrice: BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
// });
//
// const receipt = await client.waitForReceipt(hash);

export { GmxClient, GmxConfig, OrderType, Market, Position, toUsd30, fromUsd30 };
