import { archiveConfiguration, type ArchiveConfigurationInput } from '@/lib/archive-config';

export const HEALTH_TIMEOUT_MS = 3000;
export const HEALTH_REASONS = { unreachable: 'supabase_unreachable' } as const;

export interface SupabaseTarget {
  url: string;
  key: string;
}

/** Port for the dependency ping: resolves true only when the backend answered. Never throws. */
export interface SupabaseProbe {
  ping(target: SupabaseTarget): Promise<boolean>;
}

export interface HealthReport {
  status: 'ok' | 'configuration_required' | 'unavailable';
  service: 'tbellini-m';
  mode: string;
  reason?: string;
}

/** HEAD the REST endpoint with the publishable key; any answer below 500 means the service is up. */
export const fetchSupabaseProbe: SupabaseProbe = {
  async ping({ url, key }: SupabaseTarget): Promise<boolean> {
    try {
      const response = await fetch(new URL('/rest/v1/', url), {
        method: 'HEAD',
        headers: { apikey: key },
        cache: 'no-store',
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });
      return response.status < 500;
    } catch {
      return false;
    }
  },
};

/** Report readiness; pings Supabase only in supabase mode and never echoes URLs, keys or errors. */
export async function healthReport(
  input: ArchiveConfigurationInput,
  probe: SupabaseProbe,
): Promise<{ body: HealthReport; httpStatus: 200 | 503 }> {
  const configuration = archiveConfiguration(input);
  const base = { service: 'tbellini-m', mode: configuration.mode } as const;
  if (!configuration.configured) return { body: { status: 'configuration_required', ...base }, httpStatus: 503 };
  if (configuration.mode === 'supabase' && input.supabaseUrl && input.supabaseKey) {
    const reachable = await probe.ping({ url: input.supabaseUrl, key: input.supabaseKey });
    if (!reachable) return { body: { status: 'unavailable', ...base, reason: HEALTH_REASONS.unreachable }, httpStatus: 503 };
  }
  return { body: { status: 'ok', ...base }, httpStatus: 200 };
}
