# ai-chat-export

Export your AI chat conversations to Markdown and JSON files — for backup, analysis, or feeding to other AI tools.

**Supported providers:**

| Provider | Status |
|----------|--------|
| Google Gemini | Available |
| ChatGPT | Coming soon |
| Microsoft Copilot | Coming soon |
| DeepSeek | Coming soon |

Most AI chat platforms don't offer full conversation export. Google Takeout doesn't support Gemini chats at all. This tool fills that gap.

## Why AppleScript?

We tried every reasonable approach before landing on AppleScript:

| Approach | Result |
|---|---|
| Playwright `launchPersistentContext` | Chrome blocks `--remote-debugging-pipe` on its default user data directory |
| Copy Chrome profile to temp dir | Cookies are encrypted via macOS Keychain — copied profile loses authentication |
| `--remote-debugging-port` on default profile | Same restriction — Chrome refuses remote debugging on its standard data directory |
| Symlink trick | Chrome resolves symlinks, still detects the default directory |
| Copy profile + `--user-data-dir` | CDP works, but cookies can't be decrypted in the new location |

**AppleScript controls the real Chrome process with real cookies** — no profile copying, no CDP, no authentication issues. The tradeoff is macOS-only.

## Prerequisites

- **macOS** (AppleScript requirement)
- **Google Chrome** open and signed in to your AI provider
- **Allow JavaScript from Apple Events** — in Chrome: `View > Developer > Allow JavaScript from Apple Events`

## Quick Start

```bash
npx ai-chat-export
```

This exports all your Gemini conversations as Markdown files to `./ai-chats/`.

## CLI Options

| Option | Short | Default | Description |
|---|---|---|---|
| `--provider <name>` | `-p` | `gemini` | AI provider to export from |
| `--output <dir>` | `-o` | `./ai-chats` | Output directory |
| `--format <type>` | `-f` | `markdown` | Output format: `markdown`, `json`, or `both` |
| `--delay <ms>` | `-d` | `3000` | Delay between chat exports (ms) |
| `--verbose` | `-v` | `false` | Enable debug logging |
| `--help` | `-h` | | Show help message |

## Examples

```bash
# Export Gemini chats as JSON (for programmatic analysis)
npx ai-chat-export --format json

# Export both Markdown and JSON
npx ai-chat-export --format both --output ~/my-exports

# Slower export (for rate limiting concerns)
npx ai-chat-export --delay 5000

# Debug mode
npx ai-chat-export --verbose
```

## Output Formats

### Markdown (default)

```markdown
# How to make sourdough bread

## User

How do I make sourdough bread from scratch?

---

## Gemini

Here's a step-by-step guide to making sourdough bread...

---
```

### JSON

```json
{
  "title": "How to make sourdough bread",
  "url": "https://gemini.google.com/app/abc123",
  "exportedAt": "2025-01-15T10:30:00.000Z",
  "messages": [
    { "role": "User", "content": "How do I make sourdough bread from scratch?" },
    { "role": "Gemini", "content": "Here's a step-by-step guide to making sourdough bread..." }
  ]
}
```

## How It Works

1. **AppleScript bridge** — Executes JavaScript in Chrome's active tab via `osascript`
2. **Sidebar scanning** — Opens the sidebar and scrolls to load all lazy-loaded conversations
3. **Link collection** — Extracts all chat URLs, filtering out non-chat links
4. **Message extraction** — Navigates to each chat and extracts messages using multiple fallback DOM strategies
5. **Formatting** — Converts extracted messages to Markdown and/or JSON

## Adding a New Provider

Each provider is a single file in `src/providers/` that exports:

```js
export const name = "provider-id";
export const displayName = "Provider Name";
export const url = "https://provider.example.com";
export function checkSignedIn() { /* ... */ }
export async function collectChats({ verbose }) { /* ... */ }
export async function extractMessages() { /* ... */ }
```

See `src/providers/gemini.mjs` for a complete example.

## Limitations

- **macOS only** — AppleScript is a macOS technology
- **Chrome only** — Uses Chrome-specific AppleScript commands
- **DOM-dependent** — Message extraction relies on each provider's DOM structure, which may change
- **Sequential** — Exports one chat at a time (no parallel extraction)
- **No retry** — Failed chats are skipped without retry

## Future Work

- [ ] **More providers** — ChatGPT, Microsoft Copilot, DeepSeek
- [ ] **Windows/Linux support** — CDP-based approach where user launches Chrome with `--remote-debugging-port` on a separate `--user-data-dir`, signs in once, then tool connects via CDP
- [ ] **Retry logic** — Retry failed chat exports
- [ ] **Incremental export** — Skip chats already exported (by checking existing files)

## Use with Claude Code

This repo is a [Claude Code plugin](https://docs.anthropic.com/en/docs/claude-code/plugins). Install it and get the `/ai-chat-export` slash command:

```
/plugin install https://github.com/ktundwal/ai-chat-export
```

Then use it:

```
/ai-chat-export
/ai-chat-export --provider gemini --format json --output ~/exports
```

## Contributing

Contributions welcome — especially new providers! See [CLAUDE.md](CLAUDE.md) for development guidelines.

## License

[MIT](LICENSE)
