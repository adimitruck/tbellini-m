import { checkHealth } from './deploy-check-core.mjs';
import { requireEnv } from './hosted-config.mjs';

const { SITE_URL } = requireEnv(process.env, ['SITE_URL']);
const { url } = await checkHealth(SITE_URL, { fetchImpl: fetch });
console.info(`Health check passed: ${url}`);
