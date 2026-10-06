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

## M0 implementation correction — October 6, 2026

The user clarified that M0 is one TBellini community: all registered users automatically join, browse the same community events/calendar, create events, tag registered users, and set their own Going or Interested RSVP. The personal calendar is filtered by the current user's RSVP. Registered user profiles and event tags are distinct from privately recorded archive people and historical attendance. Authors alone edit/delete their events and manage registered-user tags; users alone change their own RSVP. Private people/notes stay owner scoped. Community members can see who is Going or Interested; RSVP mutation remains self-only.

This explicit correction supersedes the initial implementation's private-events-only assumption while preserving the archive-first product and M0 priority. It does not authorize public/anonymous event access, invitations, additional communities, a social feed, external Linear changes, or deployment. The single fixed community is provisioned by a forward database migration with signup enrollment and existing-account/event backfill. Existing events become community visible; private archive people do not. Older imported roadmap text above remains historical source context.

## Repository continuation

The initial implementation and community correction are mapped in [docs/PROJECT_HANDOFF.md](docs/PROJECT_HANDOFF.md). That handoff describes implementation evidence; it does not change the imported roadmap or claim hosted deployment. Supabase remains authoritative, Neo4j is derived, Vercel hosts the app, and Cloudflare's additional capabilities are opt-in scaffolding. Read current source and validation records before extending a capability.
