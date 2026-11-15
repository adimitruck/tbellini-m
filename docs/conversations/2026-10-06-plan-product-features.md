# Plan Product Features — shared conversation

Source: https://chatgpt.com/share/6ac4a27a-2e4c-83e9-8d66-2eb1eb759590

Captured October 6, 2026. The following preserves the visible conversation text, including displayed activity summaries. Site navigation, account controls, and generic site disclaimers are omitted. The share starts partway through the discussion; earlier messages and underlying tool details are unavailable.

## Assistant

I’m going to replace the earlier broad roadmap with this archive-centric structure, using parent issues for major capability areas and nested child issues for the concrete user-facing features. I’ll preserve the MVP as the first branch and relate later branches back to the same core entities instead of flattening everything into 50+ sibling issues.

## User

Only replace the tbellini-m project in linear, everything else stays

## Assistant

Got it — I’ll only restructure the tbellini-m project. I won’t touch any issues, labels, projects, or structure outside that project.

I’ll preserve the old tbellini-m issues as historical records but mark the superseded social-network roadmap as canceled, then build the new archive roadmap underneath capability parents. The hierarchy will be capability → user-facing feature, with cross-feature dependencies only where sequencing actually matters.

Updated archive-first roadmap structure

The bulk update was rejected as one large mutation, so I’m splitting the tbellini-m changes into smaller batches. Scope is unchanged: only tbellini-m is being modified.

Canceled and annotated the superseded issue

I’m keeping the replacement conservative: I’ll create the new nested archive roadmap first, then retire the old tbellini-m roadmap afterward. That avoids leaving the project half-empty if a mutation fails midstream.

Created MVP events and calendar project structure

The first replacement branch is in place. I’m now building the rest of the archive around the same pattern: MVP, then event enrichment, people, places, media/music, memories & linking, search/timeline, spaces, astrology, and archive stewardship.

Created parent capabilities and child issues for event enrichment and archiving

The write path is accepting smaller atomic changes, so I’m using that rather than sending big batch mutations. That also makes the hierarchy safer to build because each parent exists before its children are attached.

Organized Linear issues for places, media, and music archive features

I found a cleaner way to make this a true replacement without clutter: I’m going to reuse the existing tbellini-m issue IDs where possible by rewriting/reparenting them into the archive roadmap, rather than leaving a second parallel roadmap behind. That keeps history inside the same project while removing the social-network framing.

Updated Linear milestones, nested issues, features, organization, and archived work

The hierarchy is taking shape. I’m keeping parent issues deliberately broad and the children as the actual user stories, so the project stays navigable instead of becoming a flat 50-item backlog.

Created and updated Linear issues, dependencies, events, and metadata

The MVP branch is now being rewritten in place rather than duplicated. I’m also making the MVP issues highest priority, while later archive branches stay lower so Linear reflects the intended build order.

I hit a connector hiccup while rewriting one of the existing tbellini-m issues, but the project itself is intact. I’m re-opening the current tbellini-m state and will continue from there only.

Listed Linear project issues and details

The good news: most of the nested archive structure was created before the connector interruption. I’m doing cleanup now—removing leftover social-network descriptions from reused issue IDs, filling blank child descriptions, and tightening priorities/labels so the hierarchy is actually usable rather than just nested.

Updated issue structures, descriptions, nesting, and linked related memories

The old reused issues are clean now. I’m filling the remaining child issues with the archive-specific user outcomes and using Feature for the capability parents and User story for their nested children; after that I’ll add only the meaningful cross-links/dependencies (for example, event locations ↔ places archive) rather than creating a web of redundant relations.

Updated user stories, child issues, archives, and priorities extensively

The full nested feature set is now in place with user-story descriptions. I’m doing the final structure pass: capability parent descriptions, MVP dependency order, and a few cross-links between branches where the same archive concept is reused.

Updated JUS issue labels, descriptions, priorities, dependencies, and project configuration

I’m also cleaning the old release scaffolding inside tbellini-m. The previous milestone names (“Express / Connect / Share…”) no longer match the product, so I’m repurposing those milestones into archive-oriented phases and aligning the reused issues to them.

The issue hierarchy itself is done. I’m finishing the project-level cleanup now so the milestone names and project summary match the archive-first roadmap rather than the earlier social-network framing.

Reviewed project milestones and updated roadmap structure

The roadmap is now archive-first at the project level. I’m aligning every nested branch to the six renamed milestones and adding just the foundational MVP dependencies so the build sequence reads correctly in Linear.

Assigning Milestones and Cross-Issue Relations

## User

Continue what you need to an wrap this up.

## Assistant

Worked for 1m 42s

Wrapped up. I only changed the tbellini-m Linear project.

The project is now fully archive-first, with:

- M0 — Events & Calendar
  - Create events
  - Record basic people
  - Add people to events
  - See my events
  - Calendar view
  - View event details
  - Edit/correct events
- M1 — Enrich the Archive
  - Event enrichment
  - People archive
  - Places archive
  - Notes, multiple places, recurring events, grouped events
  - Person/shared event history
  - Persistent places and place history
- M2 — Media & Music
  - Event photos
  - Video
  - External links/media
  - Event/person media browsing
  - Music archive
  - Music tied to events and people
- M3 — Connected Memory
  - Create memories
  - Memory notes
  - Link related memories/events/people/places
  - Person/place/event archive hubs
  - Explain why items are connected
- M4 — Search & Timeline
  - Unified timeline
  - Timeline filters
  - Search events, people, places, notes
  - Cross-archive search
  - Contextual search filters
- M5 — Extended Archive
  - Collections
  - User-defined spaces
  - Tags/categories
  - Astrology
  - Sensitive-information controls
  - Incomplete-record cleanup
  - Historical import
  - Approximate dates
  - Provenance
  - Export

I also:

- Reused and rewrote the old tbellini-m issue IDs where appropriate instead of leaving a duplicate social-network roadmap.
- Nested user stories under broader Feature parents.
- Labeled children as User story.
- Added real MVP dependencies, e.g. Record basic people + Create events → Add people to events → See my events → Calendar.
- Added cross-links where branches genuinely intersect, such as event locations ↔ places and archive hubs ↔ media/music.
- Updated the tbellini-m project summary/description.
- Renamed the old milestones from the social framing to the archive phases above.
- Updated the project decision-history document with the archive-first pivot.

So Linear should now reflect the product direction we actually settled on, rather than the earlier social-network interpretation.

If you want, I can:

- Continue setting up linear issue hierarchy
- Describe next steps for retiring old roadmap
- Outline plan to handle partial failure in batch updates
