import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSupabaseProbe, healthReport, HEALTH_REASONS, type SupabaseProbe } from '../src/lib/health';

const SECRET_KEY = 'publishable-key-not-for-response';
const SECRET_URL = 'https://secret-project.supabase.example';
const supabaseInput = { mode: 'supabase', supabaseUrl: SECRET_URL, supabaseKey: SECRET_KEY } as const;

function probe(result: boolean): SupabaseProbe & { ping: ReturnType<typeof vi.fn> } {
  return { ping: vi.fn(async (): Promise<boolean> => result) };
}

afterEach((): void => { vi.unstubAllGlobals(); });

describe('healthReport', (): void => {
  it('pings Supabase in supabase mode and reports ok when reachable', async (): Promise<void> => {
    const port = probe(true);
    const report = await healthReport(supabaseInput, port);
    expect(port.ping).toHaveBeenCalledWith({ url: SECRET_URL, key: SECRET_KEY });
    expect(report).toEqual({ httpStatus: 200, body: { status: 'ok', service: 'tbellini-m', mode: 'supabase' } });
  });

  it('returns 503 with a generic reason and no secrets when the ping fails', async (): Promise<void> => {
    const report = await healthReport(supabaseInput, probe(false));
    expect(report.httpStatus).toBe(503);
    expect(report.body).toEqual({
      status: 'unavailable', service: 'tbellini-m', mode: 'supabase', reason: HEALTH_REASONS.unreachable,
    });
    const text = JSON.stringify(report);
    expect(text).not.toContain(SECRET_KEY);
    expect(text).not.toContain(SECRET_URL);
  });

  it('never pings in demo or unconfigured mode', async (): Promise<void> => {
    const port = probe(false);
    expect((await healthReport({ mode: 'demo' }, port)).httpStatus).toBe(200);
    expect((await healthReport({ mode: 'supabase', supabaseKey: SECRET_KEY }, port)).body.status).toBe('configuration_required');
    expect((await healthReport({ nodeEnv: 'production' }, port)).httpStatus).toBe(503);
    expect(port.ping).not.toHaveBeenCalled();
  });
});

describe('fetchSupabaseProbe', (): void => {
  it('sends a HEAD to the REST URL with the key and a timeout signal', async (): Promise<void> => {
    const fetchMock = vi.fn(async (): Promise<Response> => new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchSupabaseProbe.ping({ url: SECRET_URL, key: SECRET_KEY })).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.href).toBe(`${SECRET_URL}/rest/v1/`);
    expect(init.method).toBe('HEAD');
    expect(init.headers).toEqual({ apikey: SECRET_KEY });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('treats server errors, network failures and timeouts as unreachable', async (): Promise<void> => {
    vi.stubGlobal('fetch', vi.fn(async (): Promise<Response> => new Response(null, { status: 502 })));
    expect(await fetchSupabaseProbe.ping({ url: SECRET_URL, key: SECRET_KEY })).toBe(false);
    vi.stubGlobal('fetch', vi.fn(async (): Promise<Response> => { throw new DOMException('timed out', 'TimeoutError'); }));
    expect(await fetchSupabaseProbe.ping({ url: SECRET_URL, key: SECRET_KEY })).toBe(false);
  });
});
