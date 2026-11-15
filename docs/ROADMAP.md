# Capability roadmap

[PROJECT_MEMORY.md](../PROJECT_MEMORY.md) is the imported product baseline. Linear work stays inside tbellini-m; inspect current state before editing historical issues. Preserve capability parents labeled Feature and concrete children labeled User story.

## M0 — Events & Calendar

Sequence: **Record people + Create events → Tag people on events → See my events → Calendar**. Details and corrections are part of M0. M0 is one shared space for one group (decision of October 17, 2026; see [PROJECT_MEMORY.md](../PROJECT_MEMORY.md)): there is no community, membership or private data, and it does not reintroduce a social feed.

| Capability | User outcome / acceptance |
| --- | --- |
| People | Save a named shared Person with optional notes, with or without an account; every signed-in member sees them; the creator edits or removes them |
| Create events | Save title, valid start/end instants, timezone and optional context; invalid values show useful feedback |
| Tags | An event's creator tags existing Persons (with a picker); duplicates are impossible; a tag never implies attendance or an RSVP |
| Shared events | Every signed-in member sees all events in time order; the creator alone edits/deletes |
| RSVP / My Calendar | A member sets Going/Interested or clears their own RSVP; members see responses; My Calendar shows only their own RSVP events |
| Shared calendar | Browse all events by their recorded local date |
| Details/corrections | Open an event, edit its fields, inspect tagged people and RSVPs, and delete deliberately |
| Claiming | A member can ask "this is me" for an unlinked Person and the Person's creator confirms; an invite can also name the Person the invitee becomes |
| Durable archive | Sign up with a single-use invite code (any member can create one), sign in, and share everything with the group; signed-out visitors see nothing |

The implementation matches this table in demo mode and over a fake database in the contract tests; the Supabase schema and RLS are covered by pgTAP. Remaining before production: a browser run against the local Supabase stack (pending, see VALIDATION.md), merge into `feature/base-tbellini-site`, then user-approved provisioning (Supabase, hosted Auth settings, first-invite seeding, Vercel, DNS) and a two-account live smoke test, all tracked in `plans/STATUS.md`. Automated browser regression and an accessibility review are not done.

## Later capability branches

- **M1 Enrich the Archive:** event enrichment, people/place archive, notes, multiple places, recurrence/groups, person/shared event history and persistent place history.
- **M2 Media & Music:** event photos/video/links, event/person browsing and music connected to events/people. Introduce object storage contracts and authorized uploads here.
- **M3 Connected Memory:** memories, notes, related entities, archive hubs and explanations of connections. Build authenticated graph reads on the existing projection.
- **M4 Search & Timeline:** unified timeline, filtering, entity/notes search and contextual cross-archive search.
- **M5 Extended Archive:** collections/spaces/tags, astrology, sensitive controls, cleanup, imports, approximate dates, provenance and export.

Give M0 highest priority. Create dependencies only for actual sequencing. Cross-link event locations to the place archive and archive hubs to media/music. Do not reintroduce the superseded social-network framing or implement later branches preemptively.
