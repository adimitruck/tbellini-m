import { createClient } from '@supabase/supabase-js';
import { seedInvite } from './seed-invite-core.mjs';

// Server-side only: the service-role key never uses a NEXT_PUBLIC_ name and is never printed.
const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
};
const db = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const store = {
  async insert(row) {
    const { error } = await db.from('invitations').insert(row);
    if (error) throw new Error(`Invitation insert failed: ${error.message}`);
  },
};
const { code, expiresAt } = await seedInvite(store, {
  code: process.env.INVITE_CODE,
  expiryDays: process.env.INVITE_EXPIRY_DAYS,
});
console.info(`Invitation ${code} created; expires ${expiresAt}.`);
