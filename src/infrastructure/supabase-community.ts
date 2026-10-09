import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readAll } from './read-all';
import { ArchiveError } from '@/domain/archive';
import { membershipSchema, profileNameSchema, profileSchema, rsvpSchema, tagSchema, TBELLINI_COMMUNITY_ID, type CommunityMembership, type CommunityRepository, type EventRsvp, type RsvpStatus, type UserProfile, type UserTag } from '@/domain/community';
const profileRow = z.object({ id: z.string(), display_name: z.string(), created_at: z.string(), updated_at: z.string() });
const membershipRow = z.object({ community_id: z.string(), user_id: z.string(), created_at: z.string() });
const tagRow = z.object({ event_id: z.string(), user_id: z.string(), community_id: z.string(), tagged_by: z.string(), created_at: z.string() });
const rsvpRow = z.object({ event_id: z.string(), user_id: z.string(), community_id: z.string(), status: z.enum(['going', 'interested']), created_at: z.string(), updated_at: z.string() });
function decodeProfile(input: unknown): UserProfile { const row = profileRow.parse(input); return profileSchema.parse({ id: row.id, displayName: row.display_name, createdAt: row.created_at, updatedAt: row.updated_at }); }
export function createCommunityRepository(client: SupabaseClient, currentUserId: string): CommunityRepository {
  const communityId = TBELLINI_COMMUNITY_ID;
  return {
    async memberships(): Promise<CommunityMembership[]> { const data = await readAll((from, to) => client.from('memberships').select('*').eq('community_id', communityId).order('user_id').range(from, to)); return z.array(membershipRow).parse(data).map((row): CommunityMembership => membershipSchema.parse({ communityId: row.community_id, userId: row.user_id, createdAt: row.created_at })); },
    async members(): Promise<UserProfile[]> {
      // Profiles are shared to all TBellini members by RLS; avoid huge IN query strings.
      const data = await readAll((from, to) => client.from('profiles').select('*').order('id').range(from, to));
      return data.map(decodeProfile);
    },
    async tags(): Promise<UserTag[]> { const data = await readAll((from, to) => client.from('event_user_tags').select('*').eq('community_id', communityId).order('event_id').order('user_id').range(from, to)); return z.array(tagRow).parse(data).map((row): UserTag => tagSchema.parse({ eventId: row.event_id, userId: row.user_id, communityId: row.community_id, taggedBy: row.tagged_by, createdAt: row.created_at })); },
    async rsvps(): Promise<EventRsvp[]> { const data = await readAll((from, to) => client.from('event_rsvps').select('*').eq('community_id', communityId).order('event_id').order('user_id').range(from, to)); return z.array(rsvpRow).parse(data).map((row): EventRsvp => rsvpSchema.parse({ eventId: row.event_id, userId: row.user_id, communityId: row.community_id, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at })); },
    async tag(eventId: string, userId: string): Promise<void> { const { error } = await client.from('event_user_tags').upsert({ event_id: eventId, user_id: userId, community_id: communityId, tagged_by: currentUserId }, { onConflict: 'event_id,user_id', ignoreDuplicates: true }); if (error) throw new ArchiveError(error.message); },
    async untag(eventId: string, userId: string): Promise<void> { const { error } = await client.from('event_user_tags').delete().eq('community_id', communityId).eq('event_id', eventId).eq('user_id', userId).eq('tagged_by', currentUserId); if (error) throw new ArchiveError(error.message); },
    async respond(eventId: string, status: RsvpStatus | null): Promise<void> {
      const result = status ? await client.from('event_rsvps').upsert({ event_id: eventId, user_id: currentUserId, community_id: communityId, status }, { onConflict: 'event_id,user_id' }) : await client.from('event_rsvps').delete().eq('community_id', communityId).eq('event_id', eventId).eq('user_id', currentUserId);
      if (result.error) throw new ArchiveError(result.error.message);
    },
    async updateProfile(displayName: string): Promise<UserProfile> { const { data, error } = await client.from('profiles').update({ display_name: profileNameSchema.parse(displayName) }).eq('id', currentUserId).select('*').single(); if (error) throw new ArchiveError(error.message); return decodeProfile(data); },
    async generateInvitation(expiresInDays: number = 7): Promise<string> {
      // Generate a secure random code format like ABCD-1234 or similar within 8-12 chars
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
      code += '-';
      for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
      
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await client.from('invitations').insert({
        code,
        expires_at: expiresAt
      });
      if (error) throw new ArchiveError(error.message);
      return code;
    },
  };
}
