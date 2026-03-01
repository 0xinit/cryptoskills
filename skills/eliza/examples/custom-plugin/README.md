# Build a Custom elizaOS Plugin

Create a plugin that fetches onchain data and provides it as context to the agent. This example builds a token info plugin with an action, a provider, and an evaluator.

## Step 1: Create Plugin Directory

```
my-agent/
└── plugins/
    └── plugin-token-info/
        ├── src/
        │   ├── actions/
        │   │   └── getTokenInfo.ts
        │   ├── providers/
        │   │   └── watchlistProvider.ts
        │   ├── evaluators/
        │   │   └── tokenMentionEvaluator.ts
        │   └── index.ts
        ├── package.json
        └── tsconfig.json
```

## Step 2: Package Configuration

`plugins/plugin-token-info/package.json`:

```json
{
  "name": "@myagent/plugin-token-info",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "@elizaos/core": "latest"
  }
}
```

`plugins/plugin-token-info/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

## Step 3: Write the Action

`plugins/plugin-token-info/src/actions/getTokenInfo.ts`:

```typescript
import {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from "@elizaos/core";

interface TokenData {
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
}

async function fetchTokenData(symbol: string): Promise<TokenData | null> {
  const apiKey = process.env.COINGECKO_API_KEY;
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&symbols=${symbol.toLowerCase()}`;
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["x-cg-demo-api-key"] = apiKey;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) return null;

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  const coin = data[0];
  return {
    symbol: coin.symbol.toUpperCase(),
    name: coin.name,
    price: coin.current_price,
    marketCap: coin.market_cap,
    volume24h: coin.total_volume,
    priceChange24h: coin.price_change_percentage_24h,
  };
}

function extractSymbol(text: string): string | null {
  // Matches $SOL, $ETH, etc.
  const match = text.match(/\$([A-Za-z]{2,10})/);
  if (match) return match[1].toUpperCase();

  const keywords = ["price of", "info on", "about", "look up", "check"];
  for (const keyword of keywords) {
    const idx = text.toLowerCase().indexOf(keyword);
    if (idx !== -1) {
      const after = text.slice(idx + keyword.length).trim().split(/\s+/)[0];
      if (after && /^[A-Za-z]{2,10}$/.test(after)) return after.toUpperCase();
    }
  }
  return null;
}

export const getTokenInfoAction: Action = {
  name: "GET_TOKEN_INFO",
  description: "Fetches current market data for a cryptocurrency token",
  similes: ["TOKEN_INFO", "CHECK_TOKEN", "TOKEN_PRICE", "COIN_INFO"],

  validate: async (
    _runtime: IAgentRuntime,
    message: Memory
  ): Promise<boolean> => {
    const text = message.content.text.toLowerCase();
    return (
      text.includes("$") ||
      text.includes("price") ||
      text.includes("token info") ||
      text.includes("market cap")
    );
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: Record<string, unknown>,
    callback: HandlerCallback
  ): Promise<void> => {
    const symbol = extractSymbol(message.content.text);
    if (!symbol) {
      await callback({
        text: "I couldn't identify a token symbol. Try using the $ prefix, like $SOL or $ETH.",
      });
      return;
    }

    const data = await fetchTokenData(symbol);
    if (!data) {
      await callback({
        text: `Couldn't find market data for ${symbol}. Verify the ticker symbol and try again.`,
      });
      return;
    }

    const direction = data.priceChange24h >= 0 ? "up" : "down";
    const changeAbs = Math.abs(data.priceChange24h).toFixed(2);

    await callback({
      text: [
        `${data.name} (${data.symbol})`,
        `Price: $${data.price.toLocaleString()}`,
        `Market Cap: $${(data.marketCap / 1e9).toFixed(2)}B`,
        `24h Volume: $${(data.volume24h / 1e6).toFixed(1)}M`,
        `24h Change: ${direction} ${changeAbs}%`,
      ].join("\n"),
    });
  },

  examples: [
    [
      {
        user: "user1",
        content: { text: "What's the price of $SOL?" },
      },
      {
        user: "agent",
        content: {
          text: "Solana (SOL)\nPrice: $142.50\nMarket Cap: $66.20B\n24h Volume: $2,100.5M\n24h Change: up 3.20%",
          action: "GET_TOKEN_INFO",
        },
      },
    ],
    [
      {
        user: "user1",
        content: { text: "Give me token info on ETH" },
      },
      {
        user: "agent",
        content: {
          text: "Ethereum (ETH)\nPrice: $3,450.00\nMarket Cap: $415.00B\n24h Volume: $15,200.0M\n24h Change: down 1.50%",
          action: "GET_TOKEN_INFO",
        },
      },
    ],
  ],
};
```

## Step 4: Write the Provider

`plugins/plugin-token-info/src/providers/watchlistProvider.ts`:

```typescript
import { Provider, IAgentRuntime, Memory, State } from "@elizaos/core";

interface WatchlistToken {
  symbol: string;
  alertAbove: number | null;
  alertBelow: number | null;
}

export const watchlistProvider: Provider = {
  name: "TOKEN_WATCHLIST",
  description: "Provides the agent's current token watchlist for context",

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State
  ): Promise<string> => {
    const watchlistRaw = runtime.getSetting("TOKEN_WATCHLIST");
    if (!watchlistRaw) return "";

    let watchlist: WatchlistToken[];
    try {
      watchlist = JSON.parse(watchlistRaw) as WatchlistToken[];
    } catch {
      return "";
    }

    if (watchlist.length === 0) return "";

    const lines = watchlist.map((t) => {
      const alerts: string[] = [];
      if (t.alertAbove !== null) alerts.push(`alert above $${t.alertAbove}`);
      if (t.alertBelow !== null) alerts.push(`alert below $${t.alertBelow}`);
      const alertStr = alerts.length > 0 ? ` (${alerts.join(", ")})` : "";
      return `- ${t.symbol}${alertStr}`;
    });

    return `Token watchlist:\n${lines.join("\n")}`;
  },
};
```

## Step 5: Write the Evaluator

`plugins/plugin-token-info/src/evaluators/tokenMentionEvaluator.ts`:

```typescript
import { Evaluator, IAgentRuntime, Memory } from "@elizaos/core";

export const tokenMentionEvaluator: Evaluator = {
  name: "TOKEN_MENTION_TRACKER",
  description:
    "Tracks which tokens users mention frequently to build interest profiles",
  similes: ["MENTION_TRACKER"],

  validate: async (
    _runtime: IAgentRuntime,
    message: Memory
  ): Promise<boolean> => {
    return /\$[A-Za-z]{2,10}/.test(message.content.text);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory
  ): Promise<void> => {
    const mentions = message.content.text.match(/\$([A-Za-z]{2,10})/g);
    if (!mentions) return;

    const symbols = mentions.map((m) => m.replace("$", "").toUpperCase());
    const uniqueSymbols = [...new Set(symbols)];

    await runtime.memoryManager.createMemory({
      userId: message.userId,
      agentId: runtime.agentId,
      roomId: message.roomId,
      content: {
        text: `User mentioned tokens: ${uniqueSymbols.join(", ")}`,
        metadata: {
          type: "token_mention",
          symbols: uniqueSymbols,
          timestamp: Date.now(),
        },
      },
    });
  },

  examples: [
    [
      {
        user: "user1",
        content: { text: "I'm bullish on $SOL and $ETH this quarter" },
      },
      {
        user: "agent",
        content: { text: "Tracked token mentions: SOL, ETH" },
      },
    ],
  ],
};
```

## Step 6: Export the Plugin

`plugins/plugin-token-info/src/index.ts`:

```typescript
import { Plugin } from "@elizaos/core";
import { getTokenInfoAction } from "./actions/getTokenInfo";
import { watchlistProvider } from "./providers/watchlistProvider";
import { tokenMentionEvaluator } from "./evaluators/tokenMentionEvaluator";

const tokenInfoPlugin: Plugin = {
  name: "plugin-token-info",
  description:
    "Provides token market data lookup, watchlist context, and mention tracking",
  actions: [getTokenInfoAction],
  providers: [watchlistProvider],
  evaluators: [tokenMentionEvaluator],
};

export default tokenInfoPlugin;
```

## Step 7: Register in Character File

Add the plugin to your character's `plugins` array:

```json
{
  "plugins": ["@myagent/plugin-token-info"]
}
```

Or register programmatically:

```typescript
import tokenInfoPlugin from "@myagent/plugin-token-info";

const runtime = new AgentRuntime({
  character,
  plugins: [tokenInfoPlugin],
});
```

## Step 8: Build and Test

```bash
cd plugins/plugin-token-info
bun install
bun run build
cd ../..
elizaos start --characters characters/my-agent.json
```

Test the action:

```bash
curl -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{"text": "What is the price of $SOL?", "userId": "test", "roomId": "test"}'
```

Last verified: February 2026
