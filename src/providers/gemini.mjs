/**
 * gemini.mjs — Google Gemini provider
 *
 * Implements chat discovery and message extraction for gemini.google.com.
 * Uses AppleScript to control Chrome via the shared browser bridge.
 */

import { chromeJS } from "../browser.mjs";
import { sleep } from "../browser.mjs";

export const name = "gemini";
export const displayName = "Google Gemini";
export const url = "https://gemini.google.com/app";

/**
 * Check if the user is signed in to Gemini.
 */
export function checkSignedIn() {
  const result = chromeJS(
    `document.querySelector('a[aria-label="Sign in"]') === null ? 'yes' : 'no'`
  );
  return result === "yes";
}

/**
 * Open the sidebar menu.
 */
async function ensureSidebarOpen() {
  chromeJS(`
    (function() {
      const btn = document.querySelector('button[aria-label="Main menu"]');
      if (btn) btn.click();
    })()
  `);
  await sleep(2000);
}

/**
 * Scroll the sidebar to load all lazy-loaded conversations.
 * Gemini only renders chats as you scroll.
 */
async function scrollSidebarToLoadAll({ verbose = false } = {}) {
  if (verbose) console.log("Scrolling sidebar to load all conversations...");

  let stableRounds = 0;
  for (let i = 0; i < 100; i++) {
    const countBefore = chromeJS(
      `document.querySelectorAll('a[href*="/app/"]').length`
    );

    chromeJS(`
      (function() {
        const candidates = [
          document.querySelector('side-navigation-content'),
          document.querySelector('bard-sidenav'),
          document.querySelector('[role="navigation"]'),
          document.querySelector('.side-nav-container'),
          document.querySelector('mat-sidenav'),
        ];
        for (const el of candidates) {
          if (el && el.scrollHeight > el.clientHeight) {
            el.scrollTop = el.scrollHeight;
            return;
          }
        }
        const container = document.querySelector('bard-sidenav-container');
        if (container) {
          for (const child of container.querySelectorAll('*')) {
            if (child.scrollHeight > child.clientHeight + 10) {
              child.scrollTop = child.scrollHeight;
              return;
            }
          }
        }
      })()
    `);
    await sleep(1500);

    const countAfter = chromeJS(
      `document.querySelectorAll('a[href*="/app/"]').length`
    );

    if (countAfter === countBefore) {
      stableRounds++;
      if (stableRounds >= 5) {
        if (verbose) console.log(`  Sidebar fully loaded — ${countAfter} links found`);
        break;
      }
    } else {
      stableRounds = 0;
      if (verbose) console.log(`  Scrolling... ${countAfter} links so far`);
    }
  }
}

/**
 * Collect all chat links from the sidebar.
 * Filters out non-chat links and deduplicates.
 *
 * @returns {Promise<Array<{href: string, text: string}>>}
 */
export async function collectChats({ verbose = false } = {}) {
  await ensureSidebarOpen();
  await scrollSidebarToLoadAll({ verbose });

  const linksJSON = chromeJS(`
    JSON.stringify(
      Array.from(document.querySelectorAll('a[href*="/app/"]'))
        .map(a => ({ href: a.href, text: (a.textContent || '').trim().split('\\n')[0].trim() }))
        .filter(l =>
          !l.href.endsWith('/app') &&
          !l.href.endsWith('/app/') &&
          !l.href.includes('/download') &&
          !l.href.includes('/settings') &&
          !l.href.includes('/extensions') &&
          !l.href.includes('accounts.google.com')
        )
    )
  `);

  try {
    const links = JSON.parse(linksJSON);
    const seen = new Set();
    return links.filter((l) => {
      if (seen.has(l.href)) return false;
      seen.add(l.href);
      return true;
    });
  } catch {
    console.error("Failed to parse chat links from sidebar");
    return [];
  }
}

/**
 * Extract messages from the currently loaded chat page.
 * Tries 4 strategies in order — Gemini's DOM changes over time.
 *
 * @returns {Promise<Array<{role: string, content: string}>>}
 */
export async function extractMessages() {
  await sleep(2000);

  // Scroll conversation to load all messages
  chromeJS(`
    (function() {
      const main = document.querySelector('.conversation-container') ||
                   document.querySelector('main') ||
                   document.scrollingElement;
      if (main) {
        let lastH = 0;
        function scrollDown() {
          main.scrollTop = main.scrollHeight;
          if (main.scrollHeight !== lastH) {
            lastH = main.scrollHeight;
            setTimeout(scrollDown, 500);
          } else {
            main.scrollTop = 0;
          }
        }
        scrollDown();
      }
    })()
  `);
  await sleep(3000);

  const messagesJSON = chromeJS(`
    JSON.stringify((function() {
      const results = [];

      // Strategy 1: Custom elements (user-query / model-response)
      const turns = document.querySelectorAll(
        'user-query, model-response, .conversation-turn, [class*="turn-container"]'
      );
      if (turns.length > 0) {
        for (const turn of turns) {
          const tag = turn.tagName.toLowerCase();
          const isUser = tag === 'user-query' ||
            turn.classList.contains('user-turn') ||
            turn.querySelector('[class*="user"]') !== null;
          const text = turn.innerText?.trim();
          if (text && text.length > 1) {
            results.push({ role: isUser ? 'User' : 'Gemini', content: text });
          }
        }
        if (results.length > 0) return results;
      }

      // Strategy 2: Query text + response container patterns
      const queryEls = document.querySelectorAll(
        '.query-text, [class*="query-content"], [class*="user-query"], user-query'
      );
      const responseEls = document.querySelectorAll(
        '.response-container, .model-response-text, [class*="model-response"], model-response, message-content'
      );
      if (queryEls.length > 0 || responseEls.length > 0) {
        const allTurns = [];
        queryEls.forEach(el => allTurns.push({
          role: 'User', content: el.innerText?.trim(),
          y: el.getBoundingClientRect().top
        }));
        responseEls.forEach(el => allTurns.push({
          role: 'Gemini', content: el.innerText?.trim(),
          y: el.getBoundingClientRect().top
        }));
        allTurns.sort((a, b) => a.y - b.y);
        const cleaned = allTurns
          .filter(t => t.content && t.content.length > 1)
          .map(({role, content}) => ({role, content}));
        if (cleaned.length > 0) return cleaned;
      }

      // Strategy 3: data-message-author-role attributes
      const dataEls = document.querySelectorAll('[data-message-author-role]');
      if (dataEls.length > 0) {
        for (const el of dataEls) {
          const role = el.getAttribute('data-message-author-role');
          const text = el.innerText?.trim();
          if (text) results.push({ role: role === 'user' ? 'User' : 'Gemini', content: text });
        }
        if (results.length > 0) return results;
      }

      // Strategy 4: Conversation container children
      const container = document.querySelector('.conversation-container') ||
        document.querySelector('[class*="conversation"]') ||
        document.querySelector('main');
      if (container) {
        const children = Array.from(container.children);
        for (let i = 0; i < children.length; i++) {
          const el = children[i];
          const text = el.innerText?.trim();
          if (!text || text.length < 2) continue;
          const cls = (el.className || '') + ' ' + (el.tagName || '');
          const isUser = /user|query|human|prompt|request/i.test(cls);
          results.push({ role: isUser ? 'User' : 'Gemini', content: text });
        }
        if (results.length > 0) return results;

        // Last resort: grab all text
        const text = container.innerText?.trim();
        if (text) return [{ role: 'Unknown', content: text }];
      }

      return results;
    })())
  `);

  try {
    return JSON.parse(messagesJSON);
  } catch {
    return [];
  }
}
