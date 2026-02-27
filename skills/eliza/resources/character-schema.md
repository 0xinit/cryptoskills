# elizaOS Character File Schema

Complete reference for all fields in an elizaOS character JSON file. Fields marked required must be present for the agent to start.

Last verified: February 2026

## Top-Level Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | `string` | Yes | — | Agent display name used in conversations and platform profiles |
| `description` | `string` | No | `""` | One-line summary shown in agent listings |
| `bio` | `string[]` | Yes | — | Background statements sampled randomly to vary context windows |
| `lore` | `string[]` | Yes | — | Backstory facts that shape personality boundaries and knowledge |
| `messageExamples` | `MessageExample[][]` | Yes | — | Few-shot conversation pairs defining tone, length, and style |
| `postExamples` | `string[]` | No | `[]` | Example social media posts for Twitter/Farcaster output |
| `style` | `Style` | Yes | — | Communication style rules (see Style section) |
| `topics` | `string[]` | No | `[]` | Areas of expertise — guides engagement boundaries |
| `adjectives` | `string[]` | No | `[]` | Personality descriptors used in system prompt construction |
| `modelProvider` | `string` | Yes | — | LLM provider identifier (see Model Providers) |
| `settings` | `Settings` | No | `{}` | Model config, voice, and secrets |
| `plugins` | `string[]` | No | `[]` | npm package names of plugins to load |
| `clients` | `string[]` | No | `[]` | Platform connectors to activate |
| `knowledge` | `string[]` | No | `[]` | Inline knowledge strings added to RAG |
| `system` | `string` | No | `""` | Custom system prompt override (advanced) |

## Style Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `style.all` | `string[]` | Yes | Rules applied to all outputs regardless of platform |
| `style.chat` | `string[]` | No | Rules specific to direct messages and chat conversations |
| `style.post` | `string[]` | No | Rules specific to social media posts (Twitter, Farcaster) |

Each entry is a natural language instruction that the runtime includes in the system prompt.

## Settings Object

| Field | Type | Description |
|-------|------|-------------|
| `settings.model` | `string` | Specific model name (e.g., `gpt-4o`, `claude-sonnet-4-20250514`) |
| `settings.voice` | `VoiceSettings` | Voice synthesis configuration |
| `settings.voice.model` | `string` | Voice model identifier |
| `settings.voice.url` | `string` | Custom TTS endpoint URL |
| `settings.secrets` | `Record<string, string>` | Per-agent secrets (not included in prompts) |
| `settings.imageSettings` | `ImageSettings` | Image generation configuration |
| `settings.embeddingModel` | `string` | Override embedding model (default: provider's default) |

## Message Example Format

```json
[
  {
    "user": "user1",
    "content": { "text": "User's message text" }
  },
  {
    "user": "AgentName",
    "content": {
      "text": "Agent's response text",
      "action": "OPTIONAL_ACTION_NAME"
    }
  }
]
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user` | `string` | Yes | `"user1"` for human, agent's `name` for agent responses |
| `content.text` | `string` | Yes | The message text |
| `content.action` | `string` | No | Action name triggered by this response (teaches model when to invoke actions) |

## Model Provider Values

| Value | Provider | Required Env Variable |
|-------|----------|----------------------|
| `openai` | OpenAI | `OPENAI_API_KEY` |
| `anthropic` | Anthropic | `ANTHROPIC_API_KEY` |
| `google` | Google Gemini | `GOOGLE_API_KEY` |
| `groq` | Groq | `GROQ_API_KEY` |
| `ollama` | Ollama (local) | `OLLAMA_SERVER_URL` |
| `llama_local` | Local Llama.cpp | None (auto-downloads) |
| `together` | Together AI | `TOGETHER_API_KEY` |
| `fireworks` | Fireworks AI | `FIREWORKS_API_KEY` |
| `grok` | xAI Grok | `XAI_API_KEY` |
| `redpill` | RedPill | `REDPILL_API_KEY` |

## Client Values

| Value | Platform | Required Env Variables |
|-------|----------|----------------------|
| `discord` | Discord | `DISCORD_APPLICATION_ID`, `DISCORD_API_TOKEN` |
| `telegram` | Telegram | `TELEGRAM_BOT_TOKEN` |
| `twitter` | Twitter/X | `TWITTER_USERNAME`, `TWITTER_PASSWORD`, `TWITTER_EMAIL` |
| `farcaster` | Farcaster | `FARCASTER_NEYNAR_API_KEY`, `FARCASTER_NEYNAR_SIGNER_UUID` |
| `direct` | REST API | None |
| `slack` | Slack | `SLACK_BOT_TOKEN` |
| `lens` | Lens Protocol | `LENS_PROFILE_ID` |

## Bio and Lore Guidelines

**Bio** entries should:
- Be factual statements about the agent's background and expertise
- Be self-contained — each entry makes sense alone (they are sampled randomly)
- Cover different aspects: professional background, expertise areas, personality traits

**Lore** entries should:
- Be specific anecdotes or backstory details
- Create personality depth and conversation hooks
- Define knowledge boundaries (what the agent knows and does not know)

## Message Examples Guidelines

Minimum 3 examples, recommended 5-10. Cover:

| Example Type | Purpose |
|-------------|---------|
| Domain expertise | Shows depth of knowledge in the agent's topics |
| Boundary deflection | Shows how the agent handles off-topic questions |
| Casual interaction | Shows the agent's social tone (greetings, small talk) |
| Multi-turn | Shows how the agent follows up and references prior context |
| Action trigger | Shows when the agent invokes specific actions |

## Minimal Valid Character

```json
{
  "name": "MinimalAgent",
  "bio": ["A helpful assistant for testing."],
  "lore": ["Built for development and testing purposes."],
  "messageExamples": [
    [
      { "user": "user1", "content": { "text": "Hello" } },
      { "user": "MinimalAgent", "content": { "text": "Hello! How can I help?" } }
    ]
  ],
  "style": {
    "all": ["Friendly and concise."]
  },
  "modelProvider": "openai"
}
```
