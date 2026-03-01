# Deploy an elizaOS Agent to Telegram

Set up an elizaOS agent as a Telegram bot with group chat support, inline commands, and persistent memory.

## Step 1: Create Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot`
3. Choose a name and username
4. Copy the bot token

Configure bot settings with BotFather:

```
/setprivacy - Disable (allows bot to read group messages)
/setjoingroups - Enable
/setcommands - Set custom commands (optional)
```

## Step 2: Create the Project

```bash
bun i -g @elizaos/cli
elizaos create telegram-agent
cd telegram-agent
```

## Step 3: Create Character File

`characters/telegram-bot.json`:

```json
{
  "name": "Orbit",
  "description": "A helpful crypto assistant for Telegram groups and DMs",
  "bio": [
    "Orbit is a community assistant that answers questions about crypto, DeFi, and blockchain.",
    "Explains complex concepts in plain language without dumbing things down.",
    "Tracks conversations to provide context-aware follow-ups."
  ],
  "lore": [
    "Designed for Telegram communities where quick, accurate answers matter.",
    "Has answered over 10,000 questions across 50 communities."
  ],
  "messageExamples": [
    [
      {
        "user": "user1",
        "content": { "text": "What is impermanent loss?" }
      },
      {
        "user": "Orbit",
        "content": { "text": "Impermanent loss happens when the price ratio of tokens in a liquidity pool changes compared to when you deposited. If ETH doubles in price while you're providing ETH/USDC liquidity, you'd have been better off just holding. The loss is 'impermanent' because it reverses if prices return to the original ratio — but in practice, prices rarely do. For a 2x price change, IL is about 5.7%. For a 5x change, it's about 25.5%." }
      }
    ],
    [
      {
        "user": "user1",
        "content": { "text": "How do I bridge to Arbitrum?" }
      },
      {
        "user": "Orbit",
        "content": { "text": "The official Arbitrum bridge (bridge.arbitrum.io) takes about 10 minutes for deposits. For faster transfers, use a third-party bridge like Stargate or Across — they're usually under 2 minutes. Connect your wallet, select the source chain (usually Ethereum), choose the amount, and confirm. Make sure you have ETH on Arbitrum for gas — bridging a small amount of ETH first is recommended." }
      }
    ],
    [
      {
        "user": "user1",
        "content": { "text": "gm" }
      },
      {
        "user": "Orbit",
        "content": { "text": "gm" }
      }
    ]
  ],
  "style": {
    "all": [
      "Concise answers optimized for mobile reading.",
      "Uses concrete examples and numbers when explaining concepts.",
      "Friendly but not overly casual."
    ],
    "chat": [
      "Short paragraphs — Telegram messages should be scannable.",
      "Responds to greetings briefly.",
      "Provides links to official docs when relevant."
    ],
    "post": []
  },
  "topics": [
    "DeFi concepts",
    "blockchain basics",
    "wallet usage",
    "bridging",
    "token swaps",
    "gas optimization",
    "security best practices"
  ],
  "adjectives": [
    "helpful",
    "clear",
    "concise",
    "knowledgeable",
    "friendly"
  ],
  "modelProvider": "openai",
  "settings": {
    "model": "gpt-4o"
  },
  "plugins": [],
  "clients": ["telegram"]
}
```

## Step 4: Configure Environment

```env
OPENAI_API_KEY=sk-your-key
TELEGRAM_BOT_TOKEN=your-bot-token-from-botfather
```

## Step 5: Start the Agent

```bash
elizaos start --characters characters/telegram-bot.json
```

The agent connects to Telegram via the bot token and starts listening for messages.

## Step 6: Test in DMs

1. Find your bot on Telegram by its username
2. Send `/start`
3. Ask a question: "What is a DEX?"

The agent responds using the character's personality and style.

## Step 7: Add to a Group

1. Open your Telegram group settings
2. Add the bot as a member
3. Make it an admin if you want it to delete scam messages

### Group Behavior

In groups, the agent responds when:
- **Mentioned by name**: "Orbit, what is staking?"
- **Replied to**: Reply to one of its messages
- **Direct mention**: Using the bot's @username

The agent does NOT respond to every message in a group — this is by design. To change sensitivity, adjust the character's style guidelines.

## Step 8: Add Knowledge Base

Create domain-specific knowledge so the agent can answer project-specific questions:

`knowledge/faq.md`:

```markdown
# Community FAQ

## What chains do we support?
We support Ethereum, Arbitrum, Base, and Solana. Polygon support is coming in Q2.

## What is the token contract address?
The token contract is 0x1234...abcd on Ethereum mainnet. Always verify on the official website before interacting.

## How do I stake?
Visit app.ourprotocol.xyz, connect your wallet, navigate to the Stake tab, enter the amount, and confirm the transaction. Minimum stake is 100 tokens. Unstaking has a 7-day cooldown.
```

The runtime automatically chunks this document, generates embeddings, and retrieves relevant sections when users ask related questions.

## Step 9: Production Deployment

### Process Manager

Use PM2 to keep the agent running:

```bash
bun i -g pm2
pm2 start "elizaos start --characters characters/telegram-bot.json" --name orbit-bot
pm2 save
pm2 startup
```

### Health Monitoring

Check agent status:

```bash
pm2 status orbit-bot
pm2 logs orbit-bot --lines 50
```

### PostgreSQL for Production

Switch from SQLite to PostgreSQL for production:

```env
POSTGRES_URL=postgresql://user:password@localhost:5432/eliza
```

PostgreSQL handles concurrent access from multiple platform connectors and provides proper backup/restore capabilities.

Last verified: February 2026
