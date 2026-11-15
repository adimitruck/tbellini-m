import { readArchiveEnvironment } from '@/lib/archive-config';
import { fetchSupabaseProbe, healthReport } from '@/lib/health';

/** Readiness: configuration, plus a short Supabase ping in supabase mode. Discloses no secrets. */
export async function GET(): Promise<Response> {
  const { body, httpStatus } = await healthReport(readArchiveEnvironment(), fetchSupabaseProbe);
  return Response.json(body, { status: httpStatus, headers: { 'Cache-Control': 'no-store' } });
}
