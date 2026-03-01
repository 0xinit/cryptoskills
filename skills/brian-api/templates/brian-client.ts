import { BrianSDK } from "@brian-ai/sdk";
import { createPublicClient, createWalletClient, http, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  mainnet,
  arbitrum,
  optimism,
  polygon,
  base,
  avalanche,
} from "viem/chains";

const CHAIN_MAP: Record<string, Chain> = {
  "1": mainnet,
  "42161": arbitrum,
  "10": optimism,
  "137": polygon,
  "8453": base,
  "43114": avalanche,
};

interface BrianClientConfig {
  brianApiKey: string;
  privateKey: `0x${string}`;
  rpcUrls: Record<string, string>;
  brianApiUrl?: string;
}

interface TransactionStep {
  chainId: number;
  to: string;
  from: string;
  data: string;
  value: string;
  gasLimit?: string;
}

interface ExecutionResult {
  action: string;
  solver: string;
  hashes: string[];
}

export class BrianClient {
  private brian: BrianSDK;
  private account: ReturnType<typeof privateKeyToAccount>;
  private rpcUrls: Record<string, string>;

  constructor(config: BrianClientConfig) {
    this.brian = new BrianSDK({
      apiKey: config.brianApiKey,
      apiUrl: config.brianApiUrl,
    });

    this.account = privateKeyToAccount(config.privateKey);
    this.rpcUrls = config.rpcUrls;
  }

  get address(): `0x${string}` {
    return this.account.address;
  }

  async transact(
    prompt: string,
    chainId?: string,
  ): Promise<ExecutionResult[]> {
    const response = await this.brian.transact({
      prompt,
      address: this.account.address,
      chainId,
    });

    if (!response || response.length === 0) {
      throw new Error(
        "Brian returned no results. Ensure the prompt specifies action, amount, token, and chain.",
      );
    }

    const results: ExecutionResult[] = [];

    for (const result of response) {
      const hashes = await this.executeSteps(result.data.steps);

      results.push({
        action: result.action,
        solver: result.solver,
        hashes,
      });
    }

    return results;
  }

  async simulate(
    prompt: string,
    chainId?: string,
  ): Promise<{
    action: string;
    solver: string;
    fromToken: string;
    toToken: string;
    fromAmount: string;
    toAmount: string;
    stepCount: number;
  }> {
    const response = await this.brian.transact({
      prompt,
      address: this.account.address,
      chainId,
    });

    if (!response || response.length === 0) {
      throw new Error("Brian returned no results.");
    }

    const result = response[0];

    return {
      action: result.action,
      solver: result.solver,
      fromToken: result.data.fromToken.symbol,
      toToken: result.data.toToken.symbol,
      fromAmount: result.data.fromAmount,
      toAmount: result.data.toAmount,
      stepCount: result.data.steps.length,
    };
  }

  async ask(prompt: string): Promise<string> {
    const response = await this.brian.ask({
      prompt,
      kb: "public-knowledge-box",
    });

    return response.result.answer;
  }

  private async executeSteps(steps: TransactionStep[]): Promise<string[]> {
    if (steps.length === 0) {
      throw new Error("No transaction steps to execute.");
    }

    const chainId = String(steps[0].chainId);
    const chain = CHAIN_MAP[chainId];

    if (!chain) {
      throw new Error(
        `Unsupported chain ID: ${chainId}. Add it to CHAIN_MAP.`,
      );
    }

    const rpcUrl = this.rpcUrls[chainId];
    if (!rpcUrl) {
      throw new Error(
        `No RPC URL configured for chain ${chainId}. Add it to rpcUrls.`,
      );
    }

    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });

    const walletClient = createWalletClient({
      account: this.account,
      chain,
      transport: http(rpcUrl),
    });

    const hashes: string[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      const hash = await walletClient.sendTransaction({
        to: step.to as `0x${string}`,
        data: step.data as `0x${string}`,
        value: BigInt(step.value),
        gas: step.gasLimit ? BigInt(step.gasLimit) : undefined,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status !== "success") {
        throw new Error(
          `Step ${i}/${steps.length} reverted. Hash: ${hash}. Previous steps: ${hashes.join(", ")}`,
        );
      }

      hashes.push(hash);
    }

    return hashes;
  }
}

// --- Usage ---
//
// import { BrianClient } from "./brian-client";
//
// const client = new BrianClient({
//   brianApiKey: process.env.BRIAN_API_KEY!,
//   privateKey: process.env.PRIVATE_KEY as `0x${string}`,
//   rpcUrls: {
//     "1": process.env.ETH_RPC_URL!,
//     "8453": process.env.BASE_RPC_URL!,
//     "42161": process.env.ARB_RPC_URL!,
//     "10": process.env.OP_RPC_URL!,
//     "137": process.env.POLYGON_RPC_URL!,
//     "43114": process.env.AVAX_RPC_URL!,
//   },
// });
//
// // Execute a swap
// const results = await client.transact("Swap 10 USDC for ETH on Base", "8453");
// console.log(`Executed ${results[0].action} via ${results[0].solver}`);
// console.log(`Transaction hashes: ${results[0].hashes.join(", ")}`);
//
// // Dry run (no execution)
// const preview = await client.simulate("Swap 10 USDC for ETH on Base", "8453");
// console.log(`Would ${preview.action}: ${preview.fromAmount} ${preview.fromToken} → ${preview.toAmount} ${preview.toToken}`);
//
// // Ask a knowledge question
// const answer = await client.ask("What is the TVL of Aave V3?");
// console.log(answer);
