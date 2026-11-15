# tbellini-m project memory

Imported on October 6, 2026 from [Plan Product Features](https://chatgpt.com/share/6ac4a27a-2e4c-83e9-8d66-2eb1eb759590).

## Source limits

This records all product context available in the shared conversation. The share begins with an assistant response referring to earlier planning; that earlier planning is not included. The shared page does not expose underlying tool payloads, issue IDs, detailed acceptance criteria, or the decision-history document. Reported Linear changes below are historical claims from that chat, not independently verified current state. This import does not modify Linear or ChatGPT account memory.

## Product direction and scope

- tbellini-m is an archive-first product. The earlier social-network interpretation and roadmap were superseded.
- Organize around events, people, places, media/music, memories and their connections, search/timeline, spaces, astrology, and archive stewardship.
- Preserve the MVP as the first branch; later capabilities reuse the same core entities.
- Roadmap structure: broad capability parents labeled `Feature`, with concrete user-facing children labeled `User story`. Avoid a flat backlog of 50+ sibling issues.
- Add dependencies only when sequencing matters and cross-links where capabilities share archive concepts.
- Explicit user constraint: only replace/restructure the `tbellini-m` Linear project; everything outside it stays unchanged.

## Milestones and features

### M0 — Events & Calendar

Create events; record basic people; add people to events; see my events; calendar view; view event details; edit/correct events.

MVP issues have highest priority; later branches have lower priority. Foundational dependency sequence: **Record basic people + Create events → Add people to events → See my events → Calendar**.

### M1 — Enrich the Archive

Event enrichment; people archive; places archive; notes; multiple places; recurring events; grouped events; person/shared event history; persistent places and place history.

### M2 — Media & Music

Event photos; video; external links/media; event/person media browsing; music archive; music tied to events and people.

### M3 — Connected Memory

Create memories; memory notes; link related memories/events/people/places; person/place/event archive hubs; explain why items are connected.

### M4 — Search & Timeline

Unified timeline; timeline filters; search events, people, places, and notes; cross-archive search; contextual search filters.

### M5 — Extended Archive

Collections; user-defined spaces; tags/categories; astrology; sensitive-information controls; incomplete-record cleanup; historical import; approximate dates; provenance; export.

## Roadmap migration decisions

- Reuse and rewrite/reparent existing tbellini-m issue IDs where appropriate, preserving history while replacing social-network framing and avoiding duplicate roadmaps.
- An initial approach proposed preserving old issues as historical records and canceling superseded social-roadmap work. The later approach favored rewriting/reusing existing IDs where possible.
- Broad capability parents should describe the capability; children should describe archive-specific user outcomes.
- Meaningful cross-links include event locations ↔ places archive and archive hubs ↔ media/music.
- Rename the earlier social milestones (including “Express / Connect / Share…”) to the six archive phases and align nested branches to them.
- Update the project summary/description and record the archive-first pivot in the project decision-history document.

## Reported completion and operational history

The final response reported the full nested feature set, user-story descriptions, labels, priorities, milestones, MVP dependencies, cross-links, project description, and decision-history update as complete, with only tbellini-m changed.

During the work, a large bulk mutation was rejected. Smaller atomic changes succeeded; parents were created before children. A connector interruption occurred while rewriting an existing issue. The prior assistant reopened project state and continued cleanup. Creating the replacement structure before retiring old work was used to avoid leaving the project half-empty after a failure.

The user's last instruction was to continue necessary work and wrap it up. The final assistant offered optional follow-ups concerning hierarchy, retiring old roadmap work, and handling partial batch failures; the visible share contains no user acceptance of those offers.

## Future work context

Use this roadmap as the imported product baseline. Check current Linear state before relying on historical completion claims or altering existing issues. Implementation architecture, technology choices, detailed schemas, and acceptance criteria are not specified in this shared conversation.

## Shared-space model — October 17, 2026 (current)

The user decided that tbellini-m is one shared space for one group. This supersedes the October 6 community correction and its private archive people. Current rules:

- There is no Community or Membership entity and no private data. A profile means "can log in" (plus a display name). Every signed-in account reads everything; signed-out visitors see nothing.
- Only a record's creator edits or deletes it. Members write only their own Going or Interested RSVP and everyone sees all RSVPs. The personal calendar is filtered by the current member's RSVPs.
- People are shared Person records. People without accounts are Persons with no linked member; a member can claim an unlinked Person and the Person's creator confirms, or an invite can name the Person the invitee becomes. Each member automatically gets a Person (the default in `ensure_member_person`; the claiming decisions are awaiting the user's review).
- Event tags point at Persons and never imply an RSVP; the event's creator manages them.
- Signup is invite-only; any member can create a single-use, expiring code (default 7 days). There is no admin role.
- Spotify is the music provider (later; M2a).

M0 still means events, people, tags, RSVPs and calendars as in the roadmap above; the archive-first direction and the capability to user-story structure are unchanged. The earlier October 6 text (fixed community, private people, owner-scoped attendance) is historical context only. The October 6 note that did not authorize invitations was superseded by the invite-only registration below. Public/anonymous access, additional groups, a social feed and external Linear changes remain unauthorized.

## Repository continuation

The implementation, now on the shared-space model, is mapped in [docs/PROJECT_HANDOFF.md](docs/PROJECT_HANDOFF.md). That handoff describes implementation evidence; it does not change the imported roadmap or claim hosted deployment. Supabase remains authoritative, Neo4j is derived, Vercel hosts the app, and Cloudflare's additional capabilities are opt-in scaffolding. Read current source and validation records before extending a capability.

## Invite-only registration — October 8–9, 2026

The user added invite-only registration (commits 28a2536 and 4d10e92), superseding the October 6 note that invitations were not authorized. Any signed-in member can create a single-use code that expires (default 7 days); signup requires one. There are no admin roles, public access or additional groups. The October 17 hardening moved code generation into the database and sealed the invitations table; see docs/RUNBOOK.md.
