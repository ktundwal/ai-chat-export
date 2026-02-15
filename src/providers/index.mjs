/**
 * providers/index.mjs — Provider registry
 *
 * Each provider exports: { name, displayName, url, checkSignedIn, collectChats, extractMessages }
 */

import * as gemini from "./gemini.mjs";

const providers = {
  gemini,
};

/**
 * Get a provider by name.
 * @param {string} name
 * @returns {object} provider module
 */
export function getProvider(name) {
  const provider = providers[name];
  if (!provider) {
    const available = Object.keys(providers).join(", ");
    throw new Error(`Unknown provider "${name}". Available: ${available}`);
  }
  return provider;
}

/**
 * List all available provider names.
 * @returns {string[]}
 */
export function listProviders() {
  return Object.keys(providers);
}
