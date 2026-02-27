# Liquidation 2.0 -- Dutch Auctions via Clipper

Monitor unsafe vaults, trigger liquidations via the Dog contract, and participate in Dutch auctions by calling `Clipper.take()`. Covers keeper infrastructure for Maker Liquidation 2.0.

## Setup

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`
);

const walletClient = createWalletClient({
  account,
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

const MCD_VAT = "0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B" as const;
const MCD_DOG = "0x135954d155898D42C90D2a57824C690e0c7BEf1B" as const;
const CDP_MANAGER = "0x5ef30b9986345249bc32d8928B7ee64DE9435E39" as const;

const RAY = 10n ** 27n;
const WAD = 10n ** 18n;
```

## ABIs

```typescript
const vatAbi = [
  {
    name: "ilks",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "ilk", type: "bytes32" }],
    outputs: [
      { name: "Art", type: "uint256" },
      { name: "rate", type: "uint256" },
      { name: "spot", type: "uint256" },
      { name: "line", type: "uint256" },
      { name: "dust", type: "uint256" },
    ],
  },
  {
    name: "urns",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "ilk", type: "bytes32" },
      { name: "urn", type: "address" },
    ],
    outputs: [
      { name: "ink", type: "uint256" },
      { name: "art", type: "uint256" },
    ],
  },
  {
    name: "hope",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "usr", type: "address" }],
    outputs: [],
  },
] as const;

const dogAbi = [
  {
    name: "bark",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "ilk", type: "bytes32" },
      { name: "urn", type: "address" },
      { name: "kpr", type: "address" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    name: "ilks",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "ilk", type: "bytes32" }],
    outputs: [
      { name: "clip", type: "address" },
      { name: "chop", type: "uint256" },
      { name: "hole", type: "uint256" },
      { name: "dirt", type: "uint256" },
    ],
  },
] as const;

const clipperAbi = [
  {
    name: "take",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "amt", type: "uint256" },
      { name: "max", type: "uint256" },
      { name: "who", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "getStatus",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "needsRedo", type: "bool" },
      { name: "price", type: "uint256" },
      { name: "lot", type: "uint256" },
      { name: "tab", type: "uint256" },
    ],
  },
  {
    name: "sales",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "pos", type: "uint256" },
      { name: "tab", type: "uint256" },
      { name: "lot", type: "uint256" },
      { name: "usr", type: "address" },
      { name: "tic", type: "uint96" },
      { name: "top", type: "uint256" },
    ],
  },
  {
    name: "count",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "list",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "redo",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "kpr", type: "address" },
    ],
    outputs: [],
  },
] as const;
```

## Check If a Vault Is Unsafe

```typescript
async function isVaultUnsafe(
  ilk: `0x${string}`,
  urn: Address
): Promise<{ unsafe: boolean; ink: bigint; art: bigint; rate: bigint; spot: bigint }> {
  const [ilkData, urnData] = await Promise.all([
    publicClient.readContract({
      address: MCD_VAT,
      abi: vatAbi,
      functionName: "ilks",
      args: [ilk],
    }),
    publicClient.readContract({
      address: MCD_VAT,
      abi: vatAbi,
      functionName: "urns",
      args: [ilk, urn],
    }),
  ]);

  const ink = urnData[0];
  const art = urnData[1];
  const rate = ilkData[1];
  const spot = ilkData[2];

  // Vault is unsafe when: ink * spot < art * rate
  // Both sides are in rad (10^45) units
  const collateralValue = ink * spot;
  const debtValue = art * rate;
  const unsafe = art > 0n && collateralValue < debtValue;

  return { unsafe, ink, art, rate, spot };
}
```

## Trigger Liquidation (bark)

```typescript
async function triggerLiquidation(
  ilk: `0x${string}`,
  urn: Address
): Promise<{ hash: `0x${string}`; auctionId: bigint }> {
  const check = await isVaultUnsafe(ilk, urn);
  if (!check.unsafe) {
    throw new Error("Vault is safe -- cannot liquidate");
  }

  // The keeper (msg.sender) receives a gas incentive for calling bark
  const { request, result } = await publicClient.simulateContract({
    address: MCD_DOG,
    abi: dogAbi,
    functionName: "bark",
    args: [ilk, urn, account.address],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("bark reverted -- vault may have been liquidated already");
  }

  return { hash, auctionId: result };
}
```

## Get Clipper Address for Ilk

```typescript
async function getClipperForIlk(ilk: `0x${string}`): Promise<{
  clipper: Address;
  chop: bigint;
  hole: bigint;
  dirt: bigint;
}> {
  const data = await publicClient.readContract({
    address: MCD_DOG,
    abi: dogAbi,
    functionName: "ilks",
    args: [ilk],
  });

  return {
    clipper: data[0],
    chop: data[1],   // liquidation penalty (wad, e.g., 1.13e18 = 13%)
    hole: data[2],   // max DAI amount in auctions for this ilk (rad)
    dirt: data[3],   // current DAI amount in active auctions (rad)
  };
}
```

## List Active Auctions

```typescript
async function listActiveAuctions(clipperAddress: Address) {
  const activeIds = await publicClient.readContract({
    address: clipperAddress,
    abi: clipperAbi,
    functionName: "list",
  });

  const auctions = await Promise.all(
    activeIds.map(async (id) => {
      const status = await publicClient.readContract({
        address: clipperAddress,
        abi: clipperAbi,
        functionName: "getStatus",
        args: [id],
      });

      return {
        id,
        needsRedo: status[0],
        currentPrice: status[1], // ray
        lot: status[2],          // wad (collateral remaining)
        tab: status[3],          // rad (debt remaining)
      };
    })
  );

  return auctions;
}
```

## Participate in Auction (take)

```typescript
async function takeFromAuction(
  clipperAddress: Address,
  auctionId: bigint,
  collateralAmount: bigint,
  maxPrice: bigint
): Promise<`0x${string}`> {
  const status = await publicClient.readContract({
    address: clipperAddress,
    abi: clipperAbi,
    functionName: "getStatus",
    args: [auctionId],
  });

  const [needsRedo, currentPrice, lot, tab] = status;

  if (lot === 0n || tab === 0n) {
    throw new Error("Auction is finished -- no collateral remaining");
  }

  if (needsRedo) {
    throw new Error(
      "Auction needs redo -- call clipper.redo() first to reset the price curve"
    );
  }

  if (currentPrice > maxPrice) {
    throw new Error(
      `Current price ${currentPrice} exceeds your max ${maxPrice}. ` +
      "Wait for the Dutch auction price to decrease."
    );
  }

  // take() pays with internal Vat DAI. The keeper must have:
  // 1. Internal DAI in vat.dai(keeper) -- obtained via DaiJoin.join()
  // 2. Approved the Clipper in the Vat via vat.hope(clipperAddress)
  const { request } = await publicClient.simulateContract({
    address: clipperAddress,
    abi: clipperAbi,
    functionName: "take",
    args: [auctionId, collateralAmount, maxPrice, account.address, "0x"],
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error("take() reverted");
  }

  return hash;
}
```

## Prepare Keeper: Fund Internal DAI and Approve Clipper

```typescript
const MCD_JOIN_DAI = "0x9759A6Ac90977b93B58547b4A71c78317f391A28" as const;
const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F" as const;

const daiJoinAbi = [
  {
    name: "join",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "usr", type: "address" },
      { name: "wad", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const erc20Abi = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

async function prepareKeeper(
  clipperAddress: Address,
  daiAmount: bigint
): Promise<void> {
  // 1. Approve DaiJoin to spend DAI
  const approveHash = await walletClient.writeContract({
    address: DAI,
    abi: erc20Abi,
    functionName: "approve",
    args: [MCD_JOIN_DAI, daiAmount],
  });
  const approveReceipt = await publicClient.waitForTransactionReceipt({
    hash: approveHash,
  });
  if (approveReceipt.status !== "success") {
    throw new Error("DAI approval for DaiJoin failed");
  }

  // 2. Convert ERC-20 DAI to internal Vat DAI
  const joinHash = await walletClient.writeContract({
    address: MCD_JOIN_DAI,
    abi: daiJoinAbi,
    functionName: "join",
    args: [account.address, daiAmount],
  });
  const joinReceipt = await publicClient.waitForTransactionReceipt({
    hash: joinHash,
  });
  if (joinReceipt.status !== "success") {
    throw new Error("DaiJoin.join() reverted");
  }

  // 3. Approve Clipper to spend internal Vat DAI
  const hopeHash = await walletClient.writeContract({
    address: MCD_VAT,
    abi: vatAbi,
    functionName: "hope",
    args: [clipperAddress],
  });
  const hopeReceipt = await publicClient.waitForTransactionReceipt({
    hash: hopeHash,
  });
  if (hopeReceipt.status !== "success") {
    throw new Error("Vat.hope() reverted");
  }
}
```

## Complete Usage

```typescript
const ETH_A_ILK = "0x4554482d41000000000000000000000000000000000000000000000000000000" as const;

async function main() {
  // 1. Find the Clipper for ETH-A
  const { clipper, chop } = await getClipperForIlk(ETH_A_ILK);
  console.log(`ETH-A Clipper: ${clipper}`);
  // chop is 1.13e18 = 13% liquidation penalty
  console.log(`Liquidation penalty: ${Number(chop - WAD) * 100 / Number(WAD)}%`);

  // 2. Prepare keeper with internal DAI + Clipper approval
  const daiAmount = 50000n * WAD; // 50,000 DAI
  await prepareKeeper(clipper, daiAmount);
  console.log("Keeper prepared with internal DAI");

  // 3. List active auctions
  const auctions = await listActiveAuctions(clipper);
  console.log(`Active auctions: ${auctions.length}`);

  for (const auction of auctions) {
    console.log(
      `Auction #${auction.id}: ` +
      `lot=${formatEther(auction.lot)} ETH, ` +
      `tab=${formatEther(auction.tab / RAY)} DAI, ` +
      `price=${formatEther(auction.currentPrice / 10n ** 9n)} DAI/ETH`
    );
  }

  // 4. Take from auction if price is acceptable
  if (auctions.length > 0) {
    const target = auctions[0];
    if (!target.needsRedo && target.lot > 0n) {
      // Buy up to 1 ETH of collateral at current price
      const amount = 1n * WAD;
      const maxPrice = target.currentPrice; // accept current price
      const hash = await takeFromAuction(clipper, target.id, amount, maxPrice);
      console.log(`Took from auction: ${hash}`);
    }
  }
}

main().catch(console.error);
```
