# elizaOS Troubleshooting

Common issues and fixes when developing and deploying elizaOS agents.

Last verified: February 2026

## Agent Responds Out of Character

**Symptoms:**
- Agent gives generic ChatGPT-style responses
- Agent ignores personality traits defined in character file
- Responses do not match the tone of message examples

**Solutions:**

1. Add more `messageExamples` — minimum 5, ideally 10+. Each example teaches the model your agent's specific voice. Short example lists produce generic output.

2. Make `style.all` entries more specific. Instead of "Be helpful", use "Responds with data-driven analysis, always citing specific numbers and sources."

3. Check that `bio` and `lore` entries are specific and diverse. Vague entries like "Is an AI assistant" add no personality signal.

4. Verify the character file is valid JSON — a parsing error silently falls back to the default character:
   ```bash
   cat characters/my-agent.json | python3 -m json.tool
   ```

5. Ensure you are loading the correct character file:
   ```bash
   elizaos start --characters characters/my-agent.json
   ```
   Without `--characters`, the runtime loads the default character.

## Agent Does Not Respond in Discord/Telegram

**Symptoms:**
- Bot shows as online but ignores messages
- Bot responds in DMs but not in group channels
- No errors in console

**Solutions:**

1. **Discord**: The bot requires the Message Content Intent. Enable it in Discord Developer Portal > Your App > Bot > Privileged Gateway Intents > Message Content Intent.

2. **Telegram**: In groups, the bot only responds when mentioned by name or replied to directly. Verify the bot's privacy mode is disabled via BotFather (`/setprivacy` > Disable).

3. Check that the `clients` array in the character file includes the platform:
   ```json
   { "clients": ["discord", "telegram"] }
   ```

4. Verify environment variables are set for the platform:
   ```bash
   echo $DISCORD_API_TOKEN
   echo $TELEGRAM_BOT_TOKEN
   ```

5. Check console logs for connection errors. The agent logs platform connection status at startup.

## Memory / Database Errors

**Symptoms:**
- "Vector dimension mismatch" error
- Agent forgets previous conversations
- "Database connection is not open" error

**Solutions:**

1. **Vector dimension mismatch**: This happens when switching embedding models after memories are stored. Clear the database:
   ```bash
   rm -f data/db.sqlite
   ```
   For PostgreSQL:
   ```sql
   TRUNCATE TABLE memories;
   ```

2. **Agent forgets conversations**: Each conversation is scoped to a `roomId`. Ensure the roomId is consistent across messages. In platform connectors, this is handled automatically. In the direct API, you must pass the same `roomId`.

3. **Database locked**: Another process is using the SQLite file. Kill orphaned agent processes:
   ```bash
   pkill -f "elizaos start"
   elizaos start
   ```

4. **PostgreSQL connection refused**: Verify the connection string and that PostgreSQL is running:
   ```bash
   pg_isready -h localhost -p 5432
   ```
   Ensure the `pgvector` extension is installed:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

## Plugin Actions Never Trigger

**Symptoms:**
- Custom action's `handler` is never called
- Agent responds with text but does not execute the action
- No action-related logs in console

**Solutions:**

1. **Missing examples**: The LLM decides which action to invoke based on the action's `examples` array. Without examples, the model has no few-shot guidance and will never trigger the action. Add at least 2-3 diverse examples.

2. **validate returns false**: The action's `validate` function runs before the LLM decides. Add logging to `validate` to verify it returns `true` for your test messages:
   ```typescript
   validate: async (runtime, message) => {
     const result = message.content.text.includes("price");
     console.log(`CHECK_PRICE validate: ${result}`);
     return result;
   },
   ```

3. **Plugin not registered**: Verify the plugin is in the character's `plugins` array and the package is installed:
   ```bash
   bun list | grep plugin-name
   ```

4. **Action name collision**: If two plugins register actions with the same name, behavior is undefined. Check for name conflicts in the console output at startup.

5. **similes not set**: The `similes` array provides alternative names the LLM can use to reference the action. Without similes, the model has fewer ways to match the action.

## High Latency or Timeouts

**Symptoms:**
- Agent takes 10+ seconds to respond
- Timeout errors in platform connectors
- "Request timed out" in console

**Solutions:**

1. **Reduce context window size**: Large `bio`, `lore`, and many message examples increase token count per request. Trim to essential content.

2. **Switch to a faster model**: Use `gpt-4o-mini` or `groq` for development:
   ```json
   {
     "modelProvider": "groq",
     "settings": { "model": "llama-3.3-70b-versatile" }
   }
   ```

3. **Reduce memory retrieval count**: The runtime fetches recent memories for context. If your agent has long conversation histories, this adds latency. Configure memory limits in the runtime settings.

4. **Check provider rate limits**: API providers throttle requests. Groq has strict rate limits on free tier. OpenAI rate limits vary by tier.

5. **Local model performance**: `llama_local` and `ollama` performance depends on hardware. Use GPU acceleration:
   ```bash
   OLLAMA_NUM_GPU=1 elizaos start
   ```

## Build Failures

**Symptoms:**
- `bun install` fails with dependency errors
- TypeScript compilation errors
- "Cannot find module" errors

**Solutions:**

1. **Clean install**:
   ```bash
   rm -rf node_modules bun.lockb
   bun install
   ```

2. **Node.js version**: elizaOS requires Node.js 23+:
   ```bash
   node --version
   nvm install 23
   nvm use 23
   ```

3. **Mixed package managers**: Do not mix `npm`, `yarn`, and `bun` in the same project. Remove lock files from other managers:
   ```bash
   rm -f package-lock.json yarn.lock
   bun install
   ```

4. **Monorepo build order**: If working from the elizaOS source repo, build in order:
   ```bash
   bun run build
   ```
   The monorepo's build script handles dependency ordering. Do not build individual packages out of order.

## Solana Plugin Issues

**Symptoms:**
- "Insufficient SOL for transaction" errors
- Token swaps fail silently
- Trust score always returns 0

**Solutions:**

1. **Wallet not funded**: The agent wallet needs SOL for transaction fees:
   ```bash
   solana balance YOUR_PUBLIC_KEY --url mainnet-beta
   ```

2. **RPC rate limits**: Public Solana RPC endpoints have strict rate limits. Use a dedicated RPC provider:
   ```env
   SOLANA_RPC_URL=https://your-rpc-provider.com
   ```

3. **Trust scoring requires Birdeye API**: Token trust scores depend on market data from Birdeye. Without `BIRDEYE_API_KEY`, the trust engine returns default scores:
   ```env
   BIRDEYE_API_KEY=your-key
   ```

4. **Wrong network**: Verify you're on the correct network. Mainnet keys do not work on devnet and vice versa.

5. **Jupiter swap failures**: Swaps can fail due to slippage, insufficient liquidity, or stale routes. The plugin retries with higher slippage tolerance, but very low liquidity tokens may always fail.

## Agent Crashes on Startup

**Symptoms:**
- Process exits immediately with a stack trace
- "Cannot read properties of undefined" errors
- "EADDRINUSE" port conflict

**Solutions:**

1. **Invalid character JSON**: Validate the character file:
   ```bash
   cat characters/my-agent.json | python3 -m json.tool
   ```

2. **Missing required fields**: The character must have at minimum: `name`, `bio`, `lore`, `messageExamples`, `style.all`, and `modelProvider`.

3. **Port conflict**: Another process is using port 3000:
   ```bash
   lsof -i :3000
   kill -9 <PID>
   ```
   Or change the port:
   ```env
   SERVER_PORT=3001
   ```

4. **Corrupt node_modules**:
   ```bash
   rm -rf node_modules bun.lockb
   bun install
   ```

5. **Environment variable parsing**: Ensure `.env` has no trailing whitespace, BOM characters, or Windows line endings. On macOS/Linux:
   ```bash
   file .env
   ```
   Should show "ASCII text", not "with BOM" or "with CRLF".
