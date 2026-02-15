/**
 * browser.mjs — AppleScript ↔ Chrome bridge
 *
 * Controls Google Chrome via AppleScript to execute JavaScript
 * in the active tab. This is the core mechanism that lets us
 * interact with Gemini using the user's real authenticated session.
 */

import { execSync } from "child_process";

/**
 * Execute JavaScript in Chrome's active tab via AppleScript.
 * Returns the string result.
 */
export function chromeJS(js) {
  const escaped = js.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const script = `tell application "Google Chrome" to execute active tab of front window javascript "${escaped}"`;
  try {
    const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      encoding: "utf-8",
      timeout: 30000,
      maxBuffer: 50 * 1024 * 1024,
    });
    return result.trim();
  } catch (err) {
    if (process.env.GEMINI_VERBOSE) {
      console.error(`  JS execution error: ${err.message.slice(0, 200)}`);
    }
    return "";
  }
}

/**
 * Navigate Chrome's active tab to a URL and wait for it to load.
 */
export async function navigateTo(url) {
  const escaped = url.replace(/"/g, '\\"');
  execSync(
    `osascript -e 'tell application "Google Chrome" to set URL of active tab of front window to "${escaped}"'`,
    { encoding: "utf-8", timeout: 10000 }
  );
  await sleep(3000);
  for (let i = 0; i < 10; i++) {
    const loading = chromeJS("document.readyState");
    if (loading === "complete") break;
    await sleep(1000);
  }
  await sleep(2000);
}

/**
 * Check if the user is signed in to Gemini.
 * Returns true if signed in, false otherwise.
 */
export function checkSignedIn() {
  const result = chromeJS(
    `document.querySelector('a[aria-label="Sign in"]') === null ? 'yes' : 'no'`
  );
  return result === "yes";
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
