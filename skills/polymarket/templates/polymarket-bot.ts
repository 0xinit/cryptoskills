/**
 * Polymarket Trading Bot — Starter Template
 *
 * Simple market-making bot that places bid/ask orders around the midpoint
 * and maintains them with heartbeat protection.
 *
 * Usage:
 *   PRIVATE_KEY=0x... FUNDER_ADDRESS=0x... TOKEN_ID=... npx tsx polymarket-bot.ts
 *
 * Last verified: March 2026
 */

import { ClobClient, Side, OrderType } from "@polymarket/clob-client";
import { Wallet } from "ethers";

const HOST = "https://clob.polymarket.com";
const CHAIN_ID = 137;

// Spread width on each side of the midpoint
const HALF_SPREAD = 0.02;
// Number of shares per order
const ORDER_SIZE = 100;
// How often to refresh quotes (ms)
const REFRESH_INTERVAL_MS = 30_000;

async function createClient(): Promise<ClobClient> {
  const signer = new Wallet(process.env.PRIVATE_KEY!);
  const tempClient = new ClobClient(HOST, CHAIN_ID, signer);
  const apiCreds = await tempClient.createOrDeriveApiKey();

  return new ClobClient(
    HOST,
    CHAIN_ID,
    signer,
    apiCreds,
    2,
    process.env.FUNDER_ADDRESS!
  );
}

function roundToTick(price: number, tickSize: string): number {
  const tick = parseFloat(tickSize);
  const rounded = Math.round(price / tick) * tick;
  const decimals = tickSize.split(".")[1]?.length ?? 0;
  return parseFloat(rounded.toFixed(decimals));
}

async function run(): Promise<void> {
  const tokenId = process.env.TOKEN_ID!;
  if (!tokenId) {
    console.error("TOKEN_ID env var required");
    process.exit(1);
  }

  const client = await createClient();
  console.log("Client initialized");

  const tickSize = await client.getTickSize(tokenId);
  const negRisk = await client.getNegRisk(tokenId);
  console.log(`Market: tick=${tickSize} negRisk=${negRisk}`);

  // Heartbeat: cancels all orders if not received within 10 seconds
  let heartbeatId = "";
  const heartbeatInterval = setInterval(async () => {
    try {
      const resp = await client.postHeartbeat(heartbeatId);
      heartbeatId = resp.heartbeat_id;
    } catch (err) {
      console.error("Heartbeat failed:", (err as Error).message);
    }
  }, 5_000);

  const quoteLoop = async (): Promise<void> => {
    try {
      await client.cancelAll();

      const midResult = await client.getMidpoint(tokenId);
      const mid = parseFloat(midResult.mid);
      if (isNaN(mid) || mid <= 0 || mid >= 1) {
        console.log("Invalid midpoint, skipping cycle:", midResult.mid);
        return;
      }

      const bidPrice = roundToTick(mid - HALF_SPREAD, tickSize);
      const askPrice = roundToTick(mid + HALF_SPREAD, tickSize);

      if (bidPrice <= 0 || askPrice >= 1) {
        console.log("Prices out of range, skipping cycle");
        return;
      }

      const [bidResp, askResp] = await Promise.all([
        client.createAndPostOrder(
          { tokenID: tokenId, price: bidPrice, size: ORDER_SIZE, side: Side.BUY },
          { tickSize, negRisk },
          OrderType.GTC
        ),
        client.createAndPostOrder(
          { tokenID: tokenId, price: askPrice, size: ORDER_SIZE, side: Side.SELL },
          { tickSize, negRisk },
          OrderType.GTC
        ),
      ]);

      console.log(
        `[${new Date().toISOString()}] mid=${mid} ` +
        `bid=${bidPrice} (${bidResp.status}) ` +
        `ask=${askPrice} (${askResp.status})`
      );
    } catch (err) {
      console.error("Quote cycle error:", (err as Error).message);
    }
  };

  await quoteLoop();
  const refreshInterval = setInterval(quoteLoop, REFRESH_INTERVAL_MS);

  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    clearInterval(heartbeatInterval);
    clearInterval(refreshInterval);
    await client.cancelAll();
    console.log("All orders cancelled. Exiting.");
    process.exit(0);
  });
}

run().catch(console.error);
