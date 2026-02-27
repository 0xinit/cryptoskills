# Web3 Action (Serverless Function) Example

Build and deploy serverless functions that react to onchain events, run on schedules, or handle webhooks. Uses the Tenderly Web3 Actions runtime with Node.js.

## Project Initialization

```bash
npm install -g @tenderly/actions-cli
mkdir tenderly-actions && cd tenderly-actions
tenderly actions init
```

This generates the following project structure:

```
tenderly-actions/
  actions/
    example.ts
  tenderly.yaml
  package.json
  tsconfig.json
```

## Configuration (tenderly.yaml)

```yaml
account_id: ""
actions:
  your-account/your-project:
    runtime: v2
    sources: actions
    specs:
      monitorLargeTransfers:
        description: "Detects USDC transfers over 100k and sends Slack notification"
        function: actions/monitor:onLargeTransfer
        trigger:
          type: transaction
          transaction:
            status:
              - mined
            filters:
              - network: 1
                eventEmitted:
                  contract:
                    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
                  name: Transfer
      dailyReport:
        description: "Generates daily protocol health report"
        function: actions/report:generateDailyReport
        trigger:
          type: periodic
          periodic:
            cron: "0 9 * * *"
      externalTrigger:
        description: "Handles incoming webhooks from external services"
        function: actions/external:handleIncoming
        trigger:
          type: webhook
```

## Transaction-Triggered Action

React to onchain events with full access to transaction data, logs, and decoded parameters.

```typescript
// actions/monitor.ts
import {
  ActionFn,
  Context,
  Event,
  TransactionEvent,
} from "@tenderly/actions";
import { ethers } from "ethers";
import axios from "axios";

const USDC_DECIMALS = 6;
// 100,000 USDC threshold for notification
const LARGE_TRANSFER_THRESHOLD = BigInt(100_000) * BigInt(10 ** USDC_DECIMALS);

const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");

interface DecodedTransfer {
  from: string;
  to: string;
  amount: bigint;
}

function decodeTransferLog(log: {
  topics: string[];
  data: string;
}): DecodedTransfer | null {
  if (log.topics[0] !== TRANSFER_TOPIC) return null;
  if (log.topics.length < 3) return null;

  const from = ethers.getAddress("0x" + log.topics[1].slice(26));
  const to = ethers.getAddress("0x" + log.topics[2].slice(26));
  const amount = BigInt(log.data);

  return { from, to, amount };
}

export const onLargeTransfer: ActionFn = async (
  context: Context,
  event: Event
) => {
  const txEvent = event as TransactionEvent;
  const slackWebhookUrl = await context.secrets.get("SLACK_WEBHOOK_URL");

  for (const log of txEvent.logs) {
    const transfer = decodeTransferLog(log);
    if (transfer === null) continue;

    if (transfer.amount < LARGE_TRANSFER_THRESHOLD) continue;

    const amountFormatted = ethers.formatUnits(transfer.amount, USDC_DECIMALS);

    const message = {
      text: `Large USDC Transfer Detected\nTx: ${txEvent.hash}\nFrom: ${transfer.from}\nTo: ${transfer.to}\nAmount: ${amountFormatted} USDC\nBlock: ${txEvent.blockNumber}`,
    };

    await axios.post(slackWebhookUrl, message);
    console.log(`Notification sent for ${amountFormatted} USDC transfer`);
  }
};
```

## Periodic Action (Cron Job)

Run scheduled tasks like health checks, report generation, or automated maintenance.

```typescript
// actions/report.ts
import {
  ActionFn,
  Context,
  Event,
  PeriodicEvent,
} from "@tenderly/actions";
import { ethers } from "ethers";
import axios from "axios";

const AAVE_POOL = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";

const POOL_ABI = [
  "function getReserveData(address asset) view returns (tuple(uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))",
];

export const generateDailyReport: ActionFn = async (
  context: Context,
  event: Event
) => {
  const periodic = event as PeriodicEvent;
  const rpcUrl = await context.secrets.get("RPC_URL");
  const slackUrl = await context.secrets.get("SLACK_WEBHOOK_URL");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const pool = new ethers.Contract(AAVE_POOL, POOL_ABI, provider);

  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const reserveData = await pool.getReserveData(USDC);

  // Per-second rate scaled by 1e27 (RAY) -> annualized percentage
  const RAY = BigInt(10) ** BigInt(27);
  const SECONDS_PER_YEAR = 31_536_000;
  const supplyRate = reserveData.currentLiquidityRate;
  const supplyApr = (Number(supplyRate) / Number(RAY)) * SECONDS_PER_YEAR * 100;

  const lastProcessedBlock = await context.storage.getStr("lastReportBlock");
  const currentBlock = await provider.getBlockNumber();
  await context.storage.putStr("lastReportBlock", currentBlock.toString());

  const report = {
    text: [
      `Daily Protocol Report - ${periodic.time}`,
      `USDC Supply APR: ${supplyApr.toFixed(2)}%`,
      `Current Block: ${currentBlock}`,
      lastProcessedBlock ? `Last Report Block: ${lastProcessedBlock}` : "First report",
    ].join("\n"),
  };

  await axios.post(slackUrl, report);
  console.log("Daily report sent");
};
```

## Webhook-Triggered Action

Handle external webhook calls to trigger onchain actions or cross-system integrations.

```typescript
// actions/external.ts
import {
  ActionFn,
  Context,
  Event,
  WebhookEvent,
} from "@tenderly/actions";
import { ethers } from "ethers";

interface IncomingPayload {
  action: "pause" | "unpause" | "update_config";
  contract: string;
  params?: Record<string, string>;
}

export const handleIncoming: ActionFn = async (
  context: Context,
  event: Event
) => {
  const webhook = event as WebhookEvent;
  const payload = webhook.payload as unknown as IncomingPayload;

  // Validate expected fields
  if (!payload.action || !payload.contract) {
    console.error("Invalid payload: missing action or contract");
    return;
  }

  const rpcUrl = await context.secrets.get("RPC_URL");
  const privateKey = await context.secrets.get("OPERATOR_PRIVATE_KEY");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  switch (payload.action) {
    case "pause": {
      const contract = new ethers.Contract(
        payload.contract,
        ["function pause()"],
        wallet
      );
      const tx = await contract.pause();
      const receipt = await tx.wait();
      if (receipt.status !== 1) throw new Error("Pause transaction reverted");
      console.log(`Paused contract ${payload.contract}: ${tx.hash}`);
      break;
    }
    case "unpause": {
      const contract = new ethers.Contract(
        payload.contract,
        ["function unpause()"],
        wallet
      );
      const tx = await contract.unpause();
      const receipt = await tx.wait();
      if (receipt.status !== 1) throw new Error("Unpause transaction reverted");
      console.log(`Unpaused contract ${payload.contract}: ${tx.hash}`);
      break;
    }
    default:
      console.log(`Unknown action: ${payload.action}`);
  }
};
```

## Managing Secrets

Store sensitive values (API keys, private keys) in Tenderly's secret store, never in code.

```bash
# Set a secret via CLI
tenderly actions secrets set SLACK_WEBHOOK_URL "https://hooks.slack.com/services/..."
tenderly actions secrets set RPC_URL "https://eth-mainnet.g.alchemy.com/v2/..."
tenderly actions secrets set OPERATOR_PRIVATE_KEY "0x..."
```

Access in code via `context.secrets.get("KEY_NAME")`.

## Using Persistent Storage

Actions have a key-value store that persists between executions.

```typescript
// Store a value
await context.storage.putStr("lastProcessedBlock", "19500000");
await context.storage.putNumber("totalProcessed", 42);
await context.storage.putBigInt("cumulativeVolume", BigInt("1000000000000"));

// Retrieve a value
const lastBlock = await context.storage.getStr("lastProcessedBlock");
const count = await context.storage.getNumber("totalProcessed");
const volume = await context.storage.getBigInt("cumulativeVolume");
```

## Deploy and Manage

```bash
# Deploy all actions
tenderly actions deploy

# View logs
tenderly actions logs

# Run locally for testing
tenderly actions run monitorLargeTransfers --payload '{"hash":"0x...","logs":[]}'
```

## Runtime Constraints

| Constraint | Limit |
|------------|-------|
| Execution timeout | 60 seconds |
| Memory | 256 MB |
| Webhook payload size | 1 MB |
| Storage per project | 10 MB |
| Available packages | ethers, axios, @tenderly/actions (built-in) |
| Node.js version | 18+ |

## Common Pitfalls

- Web3 Actions cannot install arbitrary npm packages — only `ethers`, `axios`, and `@tenderly/actions` are available in the runtime
- Secrets are project-scoped — you cannot access secrets from a different project
- Storage keys are strings with a max length of 256 characters
- `context.storage.getStr()` returns empty string (not null) for missing keys — check for empty string explicitly
- Periodic actions use UTC time for cron expressions
- Webhook-triggered actions do not have access to transaction data — only the webhook payload is available
- Action source files must be in the directory specified by `sources` in `tenderly.yaml`
- The `runtime: v2` setting is required for Node.js 18+ — omitting it defaults to v1 (Node.js 16)
