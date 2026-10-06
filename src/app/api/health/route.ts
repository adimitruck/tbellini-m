import { archiveConfiguration } from '@/lib/archive-config';
/** Readiness checks configuration only; it never sends provider requests or discloses secrets. */
export function GET(): Response {
  const configuration = archiveConfiguration({ mode: process.env.NEXT_PUBLIC_ARCHIVE_MODE, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, nodeEnv: process.env.NODE_ENV });
  return Response.json({ status: configuration.configured ? 'ok' : 'configuration_required', service: 'tbellini-m', mode: configuration.mode }, { status: configuration.configured ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
