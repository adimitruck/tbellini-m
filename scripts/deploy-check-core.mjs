import { HEALTH_PATH, normaliseSiteUrl } from './hosted-config.mjs';

const DEFAULT_ATTEMPTS = 5;
const DEFAULT_DELAY_MS = 5000;

/** GET SITE_URL + health path until it answers 200, retrying while a fresh deployment warms up. */
export async function checkHealth(siteUrl, { fetchImpl, attempts = DEFAULT_ATTEMPTS, delayMs = DEFAULT_DELAY_MS, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const url = `${normaliseSiteUrl(siteUrl)}${HEALTH_PATH}`;
  let last = 'no attempt made';
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url);
      if (response.status === 200) return { url, attempt };
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : 'request failed';
    }
    if (attempt < attempts) await sleep(delayMs);
  }
  throw new Error(`Health check failed for ${url}: ${last}`);
}
