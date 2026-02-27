# elizaOS Error Codes and Solutions

Common errors encountered when developing and running elizaOS agents, with root causes and fixes.

Last verified: February 2026

## Installation Errors

### "bun: command not found"

```
bash: bun: command not found
```

**Cause**: Bun is not installed. elizaOS requires Bun as its primary package manager.

**Fix**:

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version
```

### "elizaos: command not found"

```
bash: elizaos: command not found
```

**Cause**: CLI not installed globally, or Bun's global bin directory is not on PATH.

**Fix**:

```bash
bun i -g @elizaos/cli
export PATH="$HOME/.bun/bin:$PATH"
elizaos --version
```

Add the PATH export to your shell profile (`~/.bashrc`, `~/.zshrc`) for persistence.

### Node.js version incompatible

```
Error: elizaOS requires Node.js >= 23.0.0
```

**Cause**: Node.js version is too old. elizaOS v2 requires Node.js 23+.

**Fix**:

```bash
nvm install 23
nvm use 23
node --version
```

## Runtime Errors

### "Model provider not configured"

```
Error: No API key found for model provider "openai"
```

**Cause**: The character's `modelProvider` is set but the corresponding API key environment variable is missing.

**Fix**: Set the required env variable for your provider:

| Provider | Variable |
|----------|----------|
| `openai` | `OPENAI_API_KEY` |
| `anthropic` | `ANTHROPIC_API_KEY` |
| `google` | `GOOGLE_API_KEY` |
| `groq` | `GROQ_API_KEY` |

Verify the `.env` file is in the project root and properly formatted (no quotes around values unless they contain spaces).

### "Model provider falling back to llama_local"

```
Warning: Falling back to llama_local model provider
```

**Cause**: The configured model provider's API key is invalid or the env variable name is wrong. The runtime falls back to downloading and running a local Llama model.

**Fix**:

1. Verify the env variable name matches exactly (case-sensitive)
2. Test the API key independently:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```
3. Check for invisible characters in `.env` (copy-paste artifacts)

### "Vector dimension mismatch"

```
SqliteError: Vector dimension mismatch. First vector has 768 dimensions, while the second has 384 dimensions.
```

**Cause**: The embedding model was changed after memories were already stored. The existing embeddings have different dimensions than new ones.

**Fix**:

1. Delete the SQLite database and restart:
   ```bash
   rm -f data/db.sqlite
   elizaos start
   ```
2. For PostgreSQL, drop and recreate the embeddings table:
   ```sql
   DROP TABLE IF EXISTS memories;
   ```
3. To prevent: do not change `settings.embeddingModel` after the agent has stored memories, or migrate all embeddings when switching.

### "Database connection is not open"

```
TypeError: The database connection is not open at Database.prepare
```

**Cause**: SQLite database file is corrupted or locked by another process.

**Fix**:

1. Check if another agent process is running:
   ```bash
   ps aux | grep elizaos
   ```
2. Kill orphaned processes and restart
3. If corrupted, delete and recreate:
   ```bash
   rm -f data/db.sqlite
   ```

### "Cannot find module '@elizaos/core'"

```
Error: Cannot find module '@elizaos/core'
```

**Cause**: Dependencies not installed, or wrong package manager was used.

**Fix**:

```bash
rm -rf node_modules bun.lockb
bun install
```

Do not mix `npm install` and `bun install` — pick one and stick with it. Bun is strongly recommended.

## Platform Connector Errors

### Discord: "Invalid token"

```
Error [TOKEN_INVALID]: An invalid token was provided.
```

**Cause**: `DISCORD_API_TOKEN` is wrong, expired, or is the application ID instead of the bot token.

**Fix**:

1. Go to Discord Developer Portal > Your App > Bot > Token
2. Reset and copy the new token
3. Ensure you're using the **bot token**, not the application ID or client secret

### Discord: "Missing Permissions"

```
DiscordAPIError: Missing Permissions
```

**Cause**: Bot lacks required permissions in the Discord server.

**Fix**: Reinvite the bot with required permissions:
- Read Messages
- Send Messages
- Read Message History
- Embed Links (for rich responses)
- Add Reactions (if evaluators use reactions)

### Telegram: "Conflict: terminated by other getUpdates request"

```
Error: 409: Conflict: terminated by other getUpdates request
```

**Cause**: Two instances of the bot are running simultaneously (e.g., local + production, or duplicate process).

**Fix**:

1. Stop all running instances
2. Verify only one process is running:
   ```bash
   ps aux | grep elizaos
   ```
3. Restart a single instance

### Twitter: "Could not authenticate"

```
Error: Could not authenticate with Twitter
```

**Cause**: Twitter credentials are invalid or the account has 2FA that requires additional handling.

**Fix**:

1. Verify all four variables are set:
   ```
   TWITTER_USERNAME=
   TWITTER_PASSWORD=
   TWITTER_EMAIL=
   TWITTER_COOKIES=
   ```
2. If using 2FA, export browser cookies and set `TWITTER_COOKIES`
3. Twitter may require solving a CAPTCHA — log in manually first, then export cookies

## Plugin Errors

### "Plugin not found"

```
Error: Plugin "@elizaos/plugin-solana" not found
```

**Cause**: Plugin package not installed.

**Fix**:

```bash
bun add @elizaos/plugin-solana
```

### "Action validation failed"

```
Warning: Action CHECK_BALANCE validation returned false
```

**Cause**: The action's `validate` function returned `false` for the given message. This is usually correct behavior — the action does not apply to the message.

**Not an error** unless the action should have triggered. In that case, check the `validate` function logic and ensure the message matches expected patterns.

### Solana: "Insufficient SOL for transaction"

```
Error: Attempt to debit an account but found no record of a prior credit
```

**Cause**: Wallet has no SOL for transaction fees.

**Fix**: Fund the wallet with SOL for gas:

```bash
# Devnet
solana airdrop 2 YOUR_PUBLIC_KEY --url devnet

# Mainnet: transfer SOL from another wallet
```

## Build Errors

### "Cannot find type definition file for '@elizaos/core'"

**Cause**: TypeScript cannot resolve elizaOS types.

**Fix**:

```bash
bun install
bun run build
```

If the error persists, check `tsconfig.json` includes the `node_modules/@elizaos` path:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "skipLibCheck": true
  }
}
```

### Memory leak in development

```
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory
```

**Cause**: Embedding generation with local models can consume excessive memory, especially with `llama_local`.

**Fix**:

1. Switch to a cloud provider for embeddings:
   ```json
   { "modelProvider": "openai" }
   ```
2. Or increase Node.js memory:
   ```bash
   NODE_OPTIONS="--max-old-space-size=8192" elizaos start
   ```
3. For local models, use Ollama instead of `llama_local` — Ollama manages its own memory
