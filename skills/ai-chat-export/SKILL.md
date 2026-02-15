---
name: ai-chat-export
description: Export AI chat conversations to Markdown and/or JSON. Use when the user wants to save, export, or backup their chats from Gemini, ChatGPT, Copilot, or DeepSeek.
argument-hint: "[--provider gemini] [--format markdown|json|both] [--output dir]"
allowed-tools: Bash, Read
---

Export AI chat conversations from Chrome using the `ai-chat-export` CLI tool.

## Prerequisites

Before running, verify with the user:
1. We're on macOS (AppleScript requirement)
2. Google Chrome is open and signed in to the relevant AI provider
3. Chrome > View > Developer > Allow JavaScript from Apple Events is enabled

If any prerequisite is missing, guide the user through setup.

## Running the Export

Install and run the tool. Pass through any arguments the user provided:

```bash
npx ai-chat-export $ARGUMENTS
```

If no arguments were provided, run with defaults (exports Gemini chats):

```bash
npx ai-chat-export
```

### Available Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--provider <name>` | `-p` | `gemini` | AI provider to export from |
| `--output <dir>` | `-o` | `./ai-chats` | Output directory |
| `--format <type>` | `-f` | `markdown` | `markdown`, `json`, or `both` |
| `--delay <ms>` | `-d` | `3000` | Delay between chats in ms |
| `--verbose` | `-v` | | Debug logging |
| `--help` | `-h` | | Show help |

### Supported Providers

| Provider | Status |
|----------|--------|
| `gemini` | Available |
| `chatgpt` | Coming soon |
| `copilot` | Coming soon |
| `deepseek` | Coming soon |

## After Export

Once complete, summarize:
- Which provider was exported
- How many chats were exported
- Where the output files are located
- Any failures that occurred
