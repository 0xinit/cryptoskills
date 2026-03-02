import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { config } from "dotenv";
import type { Address } from "viem";

config();

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const PAYMENT_ADDRESS = process.env.PAYMENT_ADDRESS as Address;
// Base mainnet CAIP-2 identifier
const NETWORK = "eip155:8453";

if (!PAYMENT_ADDRESS) {
  throw new Error("PAYMENT_ADDRESS environment variable is required");
}

const app = express();
app.use(express.json());

const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL ?? "https://api.cdp.coinbase.com/platform/v2/x402",
});

const resourceServer = new x402ResourceServer(facilitatorClient)
  .register(NETWORK, new ExactEvmScheme());

// -- Protected routes --
// Add your paid endpoints here. Each route needs a price and description.
app.use(
  paymentMiddleware(
    {
      "GET /api/data": {
        accepts: {
          scheme: "exact",
          network: NETWORK,
          price: "$0.01",
          payTo: PAYMENT_ADDRESS,
        },
        description: "Premium data endpoint",
      },
      "POST /api/process": {
        accepts: {
          scheme: "exact",
          network: NETWORK,
          price: "$0.05",
          payTo: PAYMENT_ADDRESS,
        },
        description: "Data processing endpoint",
      },
    },
    resourceServer,
  ),
);

// -- Free routes (no payment required) --

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// -- Paid route handlers --

app.get("/api/data", (_req, res) => {
  res.json({
    message: "This is paid content",
    generatedAt: new Date().toISOString(),
  });
});

app.post("/api/process", (req, res) => {
  const { input } = req.body as { input: string };
  if (!input) {
    res.status(400).json({ error: "input field is required" });
    return;
  }
  res.json({
    result: `Processed: ${input}`,
    processedAt: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`x402 server running on port ${PORT}`);
  console.log(`Payment address: ${PAYMENT_ADDRESS}`);
  console.log(`Network: ${NETWORK}`);
});
