# CLAUDE.md — Development Guide

## Project Overview

CLI tool that exports AI chat conversations to Markdown/JSON files using AppleScript to control Chrome. Supports multiple providers via a plugin architecture.

## Architecture

```
bin/ai-chat-export.mjs              # CLI entry point — arg parsing, orchestration loop
src/browser.mjs                     # Shared: AppleScript ↔ Chrome bridge (chromeJS, navigateTo)
src/formatter.mjs                   # Shared: Markdown + JSON output formatters
src/providers/index.mjs             # Provider registry
src/providers/gemini.mjs            # Google Gemini: sidebar nav + message extraction
.claude-plugin/plugin.json          # Claude Code plugin manifest
skills/ai-chat-export/SKILL.md      # /ai-chat-export slash command
```

## Provider Interface

Each provider in `src/providers/` exports:

- `name` — provider ID (e.g. `"gemini"`)
- `displayName` — human-readable name (e.g. `"Google Gemini"`)
- `url` — starting URL
- `checkSignedIn()` — returns boolean
- `collectChats({ verbose })` — returns `[{ href, text }]`
- `extractMessages()` — returns `[{ role, content }]`

Register new providers in `src/providers/index.mjs`.

## Key Conventions

- **Zero runtime dependencies** — uses only Node.js built-ins (`node:util`, `node:fs`, `node:path`, `child_process`)
- **Pure ESM** — `"type": "module"` in package.json, all imports use `.mjs` extension
- **No build step** — runs directly with `node`
- **No TypeScript** — plain JavaScript for simplicity
- **macOS only** — AppleScript requirement makes this inherently platform-specific

## How the AppleScript Bridge Works

The core mechanism in `src/browser.mjs`:

1. JavaScript code is escaped and embedded in an AppleScript string
2. `osascript` executes: `tell application "Google Chrome" to execute active tab of front window javascript "..."`
3. This runs JS in the real Chrome tab with the user's actual cookies/session
4. Results are returned as strings via stdout

This avoids all Chrome DevTools Protocol (CDP) issues with profile copying and cookie encryption.

## Message Extraction (Gemini)

Gemini's DOM structure changes over time. The extractor in `src/providers/gemini.mjs` tries 4 strategies in order:

1. **Custom elements** — `user-query`, `model-response` tags
2. **Class patterns** — `.query-text`, `.response-container`, etc.
3. **Data attributes** — `[data-message-author-role]`
4. **Container children** — Falls back to analyzing direct children of the conversation container

If Gemini updates their DOM and extraction breaks, add a new strategy before the existing ones.

## Testing

Manual testing only (no automated tests — would need a live Chrome session):

1. Open Chrome and sign in to your AI provider
2. Enable: Chrome > View > Developer > Allow JavaScript from Apple Events
3. Run: `node bin/ai-chat-export.mjs --verbose --output /tmp/test-export`
4. Verify exported files in the output directory

## Environment Variables

- `GEMINI_VERBOSE=1` — enables debug logging in browser/provider modules (set automatically by `--verbose` flag)

## Common Issues

- **"execution error: Not authorized"** — Enable "Allow JavaScript from Apple Events" in Chrome
- **Empty exports** — Provider may have updated their DOM. Check extraction strategies in the provider file
- **"Not signed in" error** — Make sure Chrome's active tab can reach the provider's website
