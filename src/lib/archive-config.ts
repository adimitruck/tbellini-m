export type ArchiveMode = 'demo' | 'supabase' | 'unconfigured';
export interface ArchiveConfigurationInput {
  mode?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  nodeEnv?: string;
}
export interface ArchiveConfiguration {
  mode: ArchiveMode;
  configured: boolean;
  error: string | null;
}

export const CONFIG_MESSAGES = {
  unsetMode: 'Set NEXT_PUBLIC_ARCHIVE_MODE to demo or supabase before deploying.',
  missingSupabase: 'Supabase mode requires a URL and publishable key.',
  invalidUrl: 'Configure a valid HTTP or HTTPS Supabase URL.',
} as const;

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

export function archiveConfiguration(input: ArchiveConfigurationInput): ArchiveConfiguration {
  const mode = input.mode ?? (input.nodeEnv === 'production' ? 'unconfigured' : 'demo');
  if (mode === 'demo') return { mode, configured: true, error: null };
  if (mode !== 'supabase') return { mode: 'unconfigured', configured: false, error: CONFIG_MESSAGES.unsetMode };
  if (!input.supabaseUrl || !input.supabaseKey) {
    return { mode, configured: false, error: CONFIG_MESSAGES.missingSupabase };
  }
  if (!isHttpUrl(input.supabaseUrl)) return { mode, configured: false, error: CONFIG_MESSAGES.invalidUrl };
  return { mode, configured: true, error: null };
}

/** Next inlines NEXT_PUBLIC_* only for literal property access, so each variable is named here exactly once. */
export function readArchiveEnvironment(): ArchiveConfigurationInput {
  return {
    mode: process.env.NEXT_PUBLIC_ARCHIVE_MODE,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    nodeEnv: process.env.NODE_ENV,
  };
}
