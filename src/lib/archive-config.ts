export type ArchiveMode = 'demo' | 'supabase' | 'unconfigured';
export interface ArchiveConfigurationInput { mode?: string; supabaseUrl?: string; supabaseKey?: string; nodeEnv?: string }
export interface ArchiveConfiguration { mode: ArchiveMode; configured: boolean; error: string | null }
export function archiveConfiguration(input: ArchiveConfigurationInput): ArchiveConfiguration {
  const mode = input.mode ?? (input.nodeEnv === 'production' ? 'unconfigured' : 'demo');
  if (mode === 'demo') return { mode, configured: true, error: null };
  if (mode !== 'supabase') return { mode: 'unconfigured', configured: false, error: 'Set NEXT_PUBLIC_ARCHIVE_MODE to demo or supabase before deploying.' };
  if (!input.supabaseUrl || !input.supabaseKey) return { mode, configured: false, error: 'Supabase mode requires a URL and publishable key.' };
  try { const url = new URL(input.supabaseUrl); if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Unsupported URL'); }
  catch { return { mode, configured: false, error: 'Configure a valid HTTP or HTTPS Supabase URL.' }; }
  return { mode, configured: true, error: null };
}
