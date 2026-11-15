import { createClient } from '@supabase/supabase-js';
import { seedMember } from './seed-member-core.mjs';
import { normaliseSiteUrl, requireEnv } from './hosted-config.mjs';

// Server-side only. Member name and email come from the environment, never from the repository.
const env = requireEnv(process.env, ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SITE_URL', 'SEED_MEMBER_NAME', 'SEED_MEMBER_EMAIL']);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const fail = (what, error) => {
  throw new Error(`${what} failed: ${error.message}`);
};
const store = {
  async insertInvitation(row) {
    const { error } = await db.from('invitations').insert(row);
    if (error) fail('Invitation insert', error);
  },
  async deleteInvitation(code) {
    const { error } = await db.from('invitations').delete().eq('code', code);
    if (error) fail('Invitation cleanup', error);
  },
  async createUser(attributes) {
    const { error } = await db.auth.admin.createUser(attributes);
    return { error };
  },
  async sendPasswordReset(email, redirectTo) {
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) fail('Password reset email', error);
  },
};
const result = await seedMember(store, { name: env.SEED_MEMBER_NAME, email: env.SEED_MEMBER_EMAIL }, { redirectTo: normaliseSiteUrl(env.SITE_URL) });
console.info(result.status === 'created' ? 'First member created; a password reset email was sent.' : 'First member already exists; left unchanged.');
