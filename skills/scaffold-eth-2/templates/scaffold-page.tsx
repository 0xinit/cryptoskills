/**
 * Scaffold-ETH 2 Page Template
 *
 * Starter Next.js page component using SE2 hooks.
 * Reads contract state, writes to contract, and handles loading/error states.
 *
 * Usage:
 * 1. Copy this file to packages/nextjs/app/your-page/page.tsx
 * 2. Replace "YourContract" with your deployed contract name
 * 3. Replace function names and args to match your contract's ABI
 * 4. The contract must be in deployedContracts.ts or externalContracts.ts
 */

"use client";

import { useState } from "react";
import { parseEther, formatEther } from "viem";
import { useAccount } from "wagmi";
import {
  useScaffoldReadContract,
  useScaffoldWriteContract,
  useDeployedContractInfo,
} from "~~/hooks/scaffold-eth";
import { Address, Balance, AddressInput, IntegerInput } from "~~/components/scaffold-eth";

export default function YourPage() {
  const { address: connectedAddress } = useAccount();
  const [inputValue, setInputValue] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");

  // -- Contract Info ----------------------------------------------------------

  const { data: contractInfo, isLoading: contractLoading } =
    useDeployedContractInfo("YourContract");

  // -- Read Contract State ----------------------------------------------------

  const { data: owner, isLoading: ownerLoading } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "owner",
  });

  const { data: greeting } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "greeting",
  });

  const { data: totalCounter } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "totalCounter",
  });

  // -- Write to Contract ------------------------------------------------------

  const { writeContractAsync, isMining } = useScaffoldWriteContract("YourContract");

  async function handleSetGreeting() {
    if (!inputValue) return;

    await writeContractAsync({
      functionName: "setGreeting",
      args: [inputValue],
    });

    setInputValue("");
  }

  // -- Render -----------------------------------------------------------------

  if (contractLoading) {
    return <p className="text-center p-8">Loading contract...</p>;
  }

  if (!contractInfo) {
    return (
      <p className="text-center p-8">
        Contract not found. Make sure you have deployed YourContract to the
        connected chain.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      <h1 className="text-3xl font-bold">YourContract Dashboard</h1>

      {/* Contract Info */}
      <div className="card bg-base-200 p-4 w-full max-w-lg">
        <h2 className="text-xl font-bold mb-2">Contract</h2>
        <p>
          Address: <Address address={contractInfo.address} />
        </p>
        <p>
          Owner: {ownerLoading ? "Loading..." : <Address address={owner} />}
        </p>
      </div>

      {/* Read State */}
      <div className="card bg-base-200 p-4 w-full max-w-lg">
        <h2 className="text-xl font-bold mb-2">State</h2>
        <p>Greeting: {greeting ?? "..."}</p>
        <p>Counter: {totalCounter?.toString() ?? "..."}</p>
      </div>

      {/* Write: Set Greeting */}
      <div className="card bg-base-200 p-4 w-full max-w-lg">
        <h2 className="text-xl font-bold mb-2">Set Greeting</h2>
        <input
          type="text"
          className="input input-bordered w-full mb-2"
          placeholder="New greeting"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <button
          className="btn btn-primary w-full"
          onClick={handleSetGreeting}
          disabled={isMining || !inputValue}
        >
          {isMining ? "Mining..." : "Set Greeting"}
        </button>
      </div>

      {/* Connected Account */}
      {connectedAddress && (
        <div className="card bg-base-200 p-4 w-full max-w-lg">
          <h2 className="text-xl font-bold mb-2">Your Account</h2>
          <p>
            Address: <Address address={connectedAddress} />
          </p>
          <p>
            Balance: <Balance address={connectedAddress} />
          </p>
        </div>
      )}
    </div>
  );
}
