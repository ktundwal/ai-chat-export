#!/usr/bin/env node

/**
 * ai-chat-export — CLI entry point
 *
 * Exports AI chat conversations to Markdown and/or JSON files.
 * Uses AppleScript to control Chrome with your real authenticated session.
 */

import { parseArgs } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromeJS, navigateTo, sleep } from "../src/browser.mjs";
import { getProvider, listProviders } from "../src/providers/index.mjs";
import { formatAsMarkdown, formatAsJSON } from "../src/formatter.mjs";

// ─── CLI argument parsing ───────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    provider: { type: "string", short: "p", default: "gemini" },
    output: { type: "string", short: "o", default: "./ai-chats" },
    format: { type: "string", short: "f", default: "markdown" },
    delay: { type: "string", short: "d", default: "3000" },
    verbose: { type: "boolean", short: "v", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
  strict: true,
});

if (args.help) {
  const providers = listProviders();
  console.log(`
ai-chat-export — Export AI chat conversations to Markdown/JSON

USAGE
  npx ai-chat-export [options]

OPTIONS
  -p, --provider <name>  AI provider: ${providers.join(", ")} (default: gemini)
  -o, --output <dir>     Output directory (default: ./ai-chats)
  -f, --format <type>    Output format: markdown, json, or both (default: markdown)
  -d, --delay <ms>       Delay between chats in ms (default: 3000)
  -v, --verbose          Enable verbose/debug logging
  -h, --help             Show this help message

PREREQUISITES
  1. macOS (AppleScript requirement)
  2. Google Chrome open and signed in to the AI provider
  3. Chrome > View > Developer > Allow JavaScript from Apple Events (enabled)

EXAMPLES
  npx ai-chat-export
  npx ai-chat-export --provider gemini --format json
  npx ai-chat-export --format both --output ~/my-exports
  npx ai-chat-export --delay 5000 --verbose
`);
  process.exit(0);
}

const FORMAT = args.format;
const DELAY = parseInt(args.delay, 10) || 3000;
const VERBOSE = args.verbose;

if (!["markdown", "json", "both"].includes(FORMAT)) {
  console.error(`Invalid format "${FORMAT}". Use: markdown, json, or both`);
  process.exit(1);
}

if (VERBOSE) {
  process.env.GEMINI_VERBOSE = "1";
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sanitizeFilename(name) {
  return name
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function log(msg) {
  if (VERBOSE) console.log(msg);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const provider = getProvider(args.provider);

  console.log(`ai-chat-export (${provider.displayName})`);
  console.log("==================\n");

  if (process.platform !== "darwin") {
    console.error(
      "Error: This tool requires macOS (AppleScript). See README for details."
    );
    process.exit(1);
  }

  const OUTPUT_DIR = join(process.cwd(), args.output);
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log(`Provider: ${provider.displayName}`);
  console.log(`Output:   ${OUTPUT_DIR}`);
  console.log(`Format:   ${FORMAT}`);
  console.log(`Delay:    ${DELAY}ms\n`);

  // Navigate to provider if needed
  const currentURL = chromeJS("window.location.href");
  log(`Current URL: ${currentURL}`);

  if (!currentURL.includes(new URL(provider.url).hostname)) {
    console.log(`Navigating to ${provider.displayName}...`);
    await navigateTo(provider.url);
  }

  // Verify authentication
  if (!provider.checkSignedIn()) {
    console.error(
      `Error: Not signed in to ${provider.displayName}. Please sign in first.`
    );
    process.exit(1);
  }
  console.log(`Signed in to ${provider.displayName}.\n`);

  // Collect chats
  console.log("Collecting chat links...");
  const chats = await provider.collectChats({ verbose: VERBOSE });

  console.log(`Found ${chats.length} conversations to export.\n`);

  if (chats.length === 0) {
    console.log("No conversations found. Exiting.");
    process.exit(0);
  }

  // Export each chat
  let exported = 0;
  let failed = 0;

  for (let i = 0; i < chats.length; i++) {
    const chat = chats[i];
    const progress = `[${i + 1}/${chats.length}]`;
    const title = chat.text || `Chat ${i + 1}`;

    console.log(`${progress} ${title}`);
    log(`  URL: ${chat.href}`);

    try {
      await navigateTo(chat.href);
      const messages = await provider.extractMessages();

      if (messages.length === 0) {
        console.log(`  ⚠ No messages extracted, skipping`);
        failed++;
        continue;
      }

      log(`  ${messages.length} messages extracted`);

      const filename = sanitizeFilename(title) || `chat-${i + 1}`;

      if (FORMAT === "markdown" || FORMAT === "both") {
        const md = formatAsMarkdown(title, chat.href, messages);
        await writeFile(join(OUTPUT_DIR, `${filename}.md`), md, "utf-8");
        log(`  Saved ${filename}.md`);
      }

      if (FORMAT === "json" || FORMAT === "both") {
        const json = formatAsJSON(title, chat.href, messages);
        await writeFile(join(OUTPUT_DIR, `${filename}.json`), json, "utf-8");
        log(`  Saved ${filename}.json`);
      }

      exported++;
    } catch (err) {
      console.error(`  ✗ ${err.message}`);
      failed++;
    }

    if (i < chats.length - 1) await sleep(DELAY);
  }

  console.log("\n==================");
  console.log(`Export complete!`);
  console.log(`  Exported: ${exported}`);
  console.log(`  Failed:   ${failed}`);
  console.log(`  Output:   ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error(`\nFatal error: ${err.message}`);
  process.exit(1);
});
