# Capability roadmap

[PROJECT_MEMORY.md](../PROJECT_MEMORY.md) is the imported product baseline. Linear work stays inside tbellini-m; inspect current state before editing historical issues. Preserve capability parents labeled Feature and concrete children labeled User story.

## M0 — Events & Calendar

Sequence: **Record basic people + Create events → Add people to events → See my events → Calendar**. Details and corrections are part of M0. The explicit October 6 community correction adds registered profiles, author-managed user tags and own Going/Interested RSVP; it does not reintroduce a social feed.

| Capability | User outcome / acceptance |
| --- | --- |
| Basic people | Save a named private person and optional notes; edits persist after reload |
| Create events | Save title, valid start/end instants, timezone and optional context; invalid values show useful feedback |
| Attendance | Add/remove an existing person to an event; duplicates and cross-owner links are impossible |
| Community events | Every registered member sees shared events in time order; authors alone edit/delete |
| Registered-user tags | Event authors tag other registered members; tags do not imply attendance or RSVP |
| RSVP / My Calendar | A member sets Going/Interested or clears their own RSVP; members see responses; My Calendar shows only their own RSVP events |
| Community calendar | Browse shared events by their recorded local date |
| Details/corrections | Open an event, edit its fields, inspect participants and delete deliberately |
| Durable archive | Sign in and automatically join TBellini; authenticated members share events while private people/notes remain isolated |

This repository supplies the initial implementation and infrastructure skeleton. Live Supabase/Neo4j/Cloudflare verification, domain/DNS provisioning and production enablement remain operator tasks. Local migrations/RLS tests and demo browser smoke tests have passed as recorded in VALIDATION.md. Automated browser regression, accessibility review, and authenticated hosted multi-user smoke tests remain before a production release.

## Later capability branches

- **M1 Enrich the Archive:** event enrichment, people/place archive, notes, multiple places, recurrence/groups, person/shared event history and persistent place history.
- **M2 Media & Music:** event photos/video/links, event/person browsing and music connected to events/people. Introduce object storage contracts and authorized uploads here.
- **M3 Connected Memory:** memories, notes, related entities, archive hubs and explanations of connections. Build authenticated graph reads on the existing projection.
- **M4 Search & Timeline:** unified timeline, filtering, entity/notes search and contextual cross-archive search.
- **M5 Extended Archive:** collections/spaces/tags, astrology, sensitive controls, cleanup, imports, approximate dates, provenance and export.

Give M0 highest priority. Create dependencies only for actual sequencing. Cross-link event locations to the place archive and archive hubs to media/music. Do not reintroduce the superseded social-network framing or implement later branches preemptively.
