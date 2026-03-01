/**
 * dApp Page Starter Template
 *
 * Complete page with wallet connection, contract read, contract write
 * with four-state transaction lifecycle, and error handling.
 *
 * Usage:
 * 1. Install dependencies: npm install @rainbow-me/rainbowkit wagmi viem @tanstack/react-query
 * 2. Set NEXT_PUBLIC_WC_PROJECT_ID in .env.local
 * 3. Update CONTRACT_ADDRESS and contractAbi for your contract
 * 4. Import and render <DAppPage /> in your app
 */

"use client";

import { useState, type ReactNode } from "react";
import {
  WagmiProvider,
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RainbowKitProvider,
  ConnectButton,
  getDefaultConfig,
} from "@rainbow-me/rainbowkit";
import { mainnet, base } from "wagmi/chains";
import { formatUnits, parseUnits, type Address } from "viem";
import { BaseError, UserRejectedRequestError } from "viem";
import "@rainbow-me/rainbowkit/styles.css";

// -- Config ------------------------------------------------------------------

const config = getDefaultConfig({
  appName: "My dApp",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,
  chains: [mainnet, base],
  ssr: true,
});

// -- Contract ----------------------------------------------------------------

const CONTRACT_ADDRESS: Address = "0x0000000000000000000000000000000000000000";
const TOKEN_DECIMALS = 18;

const contractAbi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// -- Providers ---------------------------------------------------------------

function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

// -- Chain Guard -------------------------------------------------------------

function RequireChain({
  chainId: requiredChainId,
  children,
}: {
  chainId: number;
  children: ReactNode;
}) {
  const { isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected) return <>{children}</>;

  if (currentChainId !== requiredChainId) {
    return (
      <div role="alert">
        <p>Please switch to the correct network.</p>
        <button
          onClick={() => switchChain({ chainId: requiredChainId })}
          disabled={isPending}
        >
          {isPending ? "Switching..." : "Switch Network"}
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

// -- Contract Read -----------------------------------------------------------

function TokenBalance() {
  const { address, isConnected } = useAccount();

  const { data: balance, isLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: contractAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  if (!isConnected) return null;
  if (isLoading) return <p>Loading balance...</p>;
  if (balance === undefined) return null;

  return (
    <p>Balance: {formatUnits(balance, TOKEN_DECIMALS)}</p>
  );
}

// -- Contract Write with Full Transaction Lifecycle --------------------------

type TxState = "idle" | "awaiting-signature" | "pending" | "confirmed" | "failed";

function TransferForm() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");

  const {
    writeContract,
    data: hash,
    isPending: isSigning,
    error: writeError,
    reset,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  function getTxState(): TxState {
    if (isSigning) return "awaiting-signature";
    if (isConfirming && hash) return "pending";
    if (isSuccess && receipt?.status === "success") return "confirmed";
    if (receipt?.status === "reverted" || writeError || receiptError) return "failed";
    return "idle";
  }

  const txState = getTxState();

  // 4001: user intentionally cancelled -- silent reset
  if (writeError && writeError instanceof UserRejectedRequestError) {
    reset();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!to || !amount) return;

    writeContract({
      address: CONTRACT_ADDRESS,
      abi: contractAbi,
      functionName: "transfer",
      args: [to as Address, parseUnits(amount, TOKEN_DECIMALS)],
    });
  }

  if (!isConnected) return null;

  const explorerUrls: Record<number, string> = {
    1: "https://etherscan.io",
    8453: "https://basescan.org",
  };
  const explorerBase = explorerUrls[chainId] ?? "https://etherscan.io";

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="to">Recipient</label>
        <input
          id="to"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="0x..."
          disabled={txState !== "idle"}
        />
      </div>
      <div>
        <label htmlFor="amount">Amount</label>
        <input
          id="amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          inputMode="decimal"
          disabled={txState !== "idle"}
        />
      </div>

      <button
        type="submit"
        disabled={txState !== "idle" || !to || !amount}
        aria-busy={txState === "awaiting-signature" || txState === "pending"}
      >
        {txState === "idle" && "Transfer"}
        {txState === "awaiting-signature" && "Confirm in wallet..."}
        {txState === "pending" && "Confirming..."}
        {txState === "confirmed" && "Done"}
        {txState === "failed" && "Failed"}
      </button>

      {txState === "confirmed" && hash && (
        <div>
          <p>
            Confirmed.{" "}
            <a href={`${explorerBase}/tx/${hash}`} target="_blank" rel="noopener noreferrer">
              View on explorer
            </a>
          </p>
          <button type="button" onClick={() => reset()}>
            New transfer
          </button>
        </div>
      )}

      {txState === "failed" && writeError && !(writeError instanceof UserRejectedRequestError) && (
        <div role="alert">
          <p>
            {writeError instanceof BaseError
              ? writeError.shortMessage
              : writeError.message}
          </p>
          <button type="button" onClick={() => reset()}>Try again</button>
        </div>
      )}
    </form>
  );
}

// -- Page --------------------------------------------------------------------

export default function DAppPage() {
  return (
    <Providers>
      <header>
        <ConnectButton />
      </header>
      <main>
        <RequireChain chainId={mainnet.id}>
          <TokenBalance />
          <TransferForm />
        </RequireChain>
      </main>
    </Providers>
  );
}
