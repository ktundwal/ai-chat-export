/**
 * formatter.mjs — Output formatting for exported chats
 *
 * Converts extracted messages into Markdown or JSON format.
 */

/**
 * Format messages as a Markdown document.
 *
 * @param {string} title - Chat title
 * @param {string} url - Original Gemini URL
 * @param {Array<{role: string, content: string}>} messages
 * @returns {string} Markdown content
 */
export function formatAsMarkdown(title, url, messages) {
  let md = `# ${title}\n\n`;
  for (const msg of messages) {
    if (!msg.content) continue;
    md += `## ${msg.role}\n\n${msg.content}\n\n---\n\n`;
  }
  return md;
}

/**
 * Format messages as a JSON document.
 *
 * @param {string} title - Chat title
 * @param {string} url - Original Gemini URL
 * @param {Array<{role: string, content: string}>} messages
 * @returns {string} Pretty-printed JSON
 */
export function formatAsJSON(title, url, messages) {
  return JSON.stringify(
    {
      title,
      url,
      exportedAt: new Date().toISOString(),
      messages: messages
        .filter((m) => m.content)
        .map(({ role, content }) => ({ role, content })),
    },
    null,
    2
  );
}
