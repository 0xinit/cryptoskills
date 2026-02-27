/**
 * wagmi v2 App Template
 *
 * Complete starter with WagmiProvider, QueryClientProvider, wallet connection,
 * balance display, chain switching, and contract interaction.
 *
 * Usage:
 * 1. Copy this file and config setup to your project
 * 2. Set NEXT_PUBLIC_WC_PROJECT_ID environment variable (from cloud.walletconnect.com)
 * 3. Optionally set NEXT_PUBLIC_RPC_URL for a custom RPC endpoint
 * 4. Import and render <App /> in your root layout
 */

import { useState, type ReactNode } from "react";
import { http, createConfig } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors";
import {
  WagmiProvider,
  useAccount,
  useConnect,
  useDisconnect,
  useBalance,
  useChainId,
  useSwitchChain,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { parseUnits, formatUnits } from "viem";

// -- Config ------------------------------------------------------------------

const config = createConfig({
  chains: [mainnet, sepolia],
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID!,
    }),
    coinbaseWallet({ appName: "wagmi Starter" }),
  ],
  transports: {
    [mainnet.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
    [sepolia.id]: http(),
  },
});

// -- Providers ---------------------------------------------------------------

function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

// -- Connect -----------------------------------------------------------------

function ConnectWallet() {
  const { isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return <button onClick={() => disconnect()}>Disconnect</button>;
  }

  return (
    <div>
      {connectors.map((c) => (
        <button
          key={c.uid}
          onClick={() => connect({ connector: c })}
          disabled={isPending}
        >
          {c.name}
        </button>
      ))}
      {error && <p>{error.message}</p>}
    </div>
  );
}

// -- Account -----------------------------------------------------------------

function Account() {
  const { address, isConnected, chain } = useAccount();
  const { data: balance } = useBalance({ address });

  if (!isConnected || !address) return null;

  return (
    <div>
      <p>
        {address.slice(0, 6)}...{address.slice(-4)}
      </p>
      <p>
        {balance ? `${balance.formatted} ${balance.symbol}` : "Loading..."}
      </p>
      <p>{chain?.name ?? "Unknown chain"}</p>
    </div>
  );
}

// -- Chain Switcher ----------------------------------------------------------

function ChainSwitcher() {
  const chainId = useChainId();
  const { chains, switchChain, isPending } = useSwitchChain();

  return (
    <div>
      {chains.map((chain) => (
        <button
          key={chain.id}
          onClick={() => switchChain({ chainId: chain.id })}
          disabled={isPending || chain.id === chainId}
        >
          {chain.name}
        </button>
      ))}
    </div>
  );
}

// -- App ---------------------------------------------------------------------

export default function App() {
  return (
    <Providers>
      <ConnectWallet />
      <Account />
      <ChainSwitcher />
    </Providers>
  );
}
