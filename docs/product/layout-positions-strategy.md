# Layout Positions: Shared vs Personal

How should node positions be handled when multiple admins work on the same site?

---

## The Core Tension

The sitemap layout is both a **tool** (I arrange nodes to understand the site structure) and a **deliverable** (I present a polished sitemap to stakeholders). These pull in opposite directions:

- **Tool mindset** → personal layout, I don't want someone else moving my nodes
- **Deliverable mindset** → shared layout, we need one canonical arrangement to present

---

## Option A: Fully Personal Layouts

Each admin has their own positions, stored per-user.

```
sitemap_layouts
  site_id + user_id + layout_mode → positions (JSONB)
```

**How it works:**
- First visit: auto-layout (dagre/radial) generates positions
- Admin drags nodes → saved to their personal layout
- Other admins never see these changes
- Each admin can have a different arrangement

**Pros:**
- Zero conflict — no one can mess up your layout
- Simple to implement (just add user_id to current localStorage approach, move to Supabase)
- Each role can optimize for their workflow (dev groups by feature area, designer groups by visual flow)

**Cons:**
- No collaboration — defeats the purpose of a shared tool
- Duplicated effort — everyone arranges the same sitemap independently
- Can't say "look at how I organized this" without screen-sharing
- New team members start from scratch every time

**Best for:** Solo use or teams where the map is a personal thinking tool, not a shared artifact.

---

## Option B: Single Shared Layout

One set of positions per site, shared by all admins.

```
sitemap_layouts
  site_id + layout_mode → positions (JSONB) + updated_by + updated_at
```

**How it works:**
- First admin to arrange nodes sets the layout
- Other admins see the same arrangement
- Any admin can drag nodes → updates for everyone
- Last write wins (no locking)

**Pros:**
- True collaboration — arrange once, everyone benefits
- New team members see a polished map immediately
- Natural for the "deliverable" use case (presenting to clients)
- Simple mental model: one map, one arrangement

**Cons:**
- Accidental changes affect everyone (admin B moves a node, admin A's careful layout is disrupted)
- No undo across users (admin A can't revert admin B's changes)
- Layout thrashing during active crawls (auto-layout + manual edits competing)
- Need to show "who last edited" to avoid confusion

**Mitigations:**
- "Lock layout" toggle — prevents accidental edits (only intentional rearrangement)
- Show last editor + timestamp: "Layout edited by Alice, 2 hours ago"
- Snapshot/versioning: save named snapshots to revert to

**Best for:** Small teams with a clear "map owner" or async workflows where one person arranges and others consume.

---

## Option C: Shared Default + Personal Overrides (Recommended)

A shared "team layout" that any admin can override locally.

```
sitemap_layouts
  site_id + layout_mode + user_id=NULL → shared/team positions
  site_id + layout_mode + user_id=X   → personal override (optional)
```

**How it works:**
1. Auto-layout generates initial positions (shared)
2. Any admin can drag nodes → updates the **shared** layout by default
3. Admin can toggle "Personal layout" mode → changes only affect them
4. Personal layout starts as a copy of the shared layout
5. Admin can "push to team" to promote their personal layout to shared
6. Admin can "reset to team" to discard personal overrides

**UX flow:**
```
[Shared layout]  ←── default, what everyone sees
       |
   Admin drags  ──→ updates shared (if in shared mode)
       |
   Toggle "Personal" ──→ creates personal fork
       |
   "Push to team" ──→ overwrites shared with personal
   "Reset to team" ──→ discards personal, reverts to shared
```

**Pros:**
- Best of both worlds: collaboration by default, personal space when needed
- New members get the team-curated layout instantly
- Power users can experiment without affecting others
- "Push to team" creates a clear intentional moment for sharing
- Handles the "I want to try a different arrangement" use case

**Cons:**
- More complex UI (need to show which mode you're in)
- Personal layouts can drift from shared (after re-crawl adds new nodes, personal layout is stale)
- More storage (shared + N personal copies)
- "Push to team" needs confirmation or even a review flow for larger teams

**Mitigations:**
- Show a subtle indicator: "Personal layout" vs "Team layout" in the toolbar
- When shared layout updates (re-crawl), notify personal layout users: "Team layout updated — reset to see changes?"
- Only store the diff (moved nodes only) instead of full position copy

**Best for:** Teams of 2-5 where one person typically owns the layout but others occasionally rearrange.

---

## Option D: Real-time Collaborative (Figma-style)

All admins see the same layout with live cursors and multiplayer editing.

**How it works:**
- WebSocket-based presence: see who's viewing the map
- Live cursor positions broadcast to all viewers
- Node drags broadcast in real-time (like Figma)
- Conflict: if two people drag the same node, last release wins
- Undo/redo per user

**Pros:**
- Most natural collaborative experience
- "Let me show you" works without screen-sharing
- No stale layouts — always in sync
- Impressive, premium feel

**Cons:**
- Significantly complex to implement (CRDTs or OT for position state)
- Requires always-on WebSocket infrastructure
- Overkill for async teams (most sitemap work is done solo)
- Performance: broadcasting every drag frame for large sitemaps
- Need to handle offline/reconnection gracefully

**Best for:** Large teams doing synchronous design reviews. Probably Phase 3+ territory.

---

## Recommendation

**Start with Option B (Single Shared Layout)** for its simplicity, then evolve to **Option C** when multi-admin usage grows.

### Phase 1 implementation (Option B):
1. Move positions from localStorage to Supabase `sitemap_layouts` table
2. Key: `site_id + layout_mode` (one shared layout per mode)
3. Add `updated_by` and `updated_at` columns
4. Show "Last arranged by {name}, {time ago}" in the UI
5. Add a "Lock layout" toggle to prevent accidental edits
6. Auto-layout still works as fallback when no saved positions exist

### Phase 2 evolution (Option C):
1. Add `user_id` column (nullable — NULL = shared/team layout)
2. Add "Personal layout" toggle in toolbar
3. "Push to team" and "Reset to team" actions
4. Badge/indicator showing which mode is active

### Skip Option D until:
- 5+ active admins on same site simultaneously
- Users explicitly ask for real-time collaboration
- WebSocket infrastructure is already robust

---

## Impact on Current Code

| Component | Change needed |
|-----------|--------------|
| `sitemap.svelte.ts` | `savePositions()` / `loadPositions()` → Supabase instead of localStorage |
| `map/+page.svelte` | Load shared layout on mount, show "last edited by" |
| `SitemapCanvas.svelte` | "Lock layout" toggle, mode indicator |
| Supabase | New `sitemap_layouts` table |
| `screenshotCache.ts` | No change (stays as browser-side performance cache) |
| localStorage | Keep as offline fallback / write-through cache |

---

## Open Questions

1. **What happens to positions when a re-crawl adds new pages?** New nodes get auto-layout positions; existing nodes keep their saved positions. Need to handle node ID stability across crawls (currently based on URL, which is stable).

2. **Should layout mode (rows vs circular) be shared too?** Probably yes for the "deliverable" use case — the team agrees on a view. But personal preference for the "tool" use case. Could follow the same shared/personal pattern.

3. **Granularity of "lock"**: Lock the entire layout, or lock individual nodes? Per-node locking adds complexity but lets admins protect key arrangements while leaving others flexible.

4. **History/snapshots**: Worth building a simple version history? "Snapshots" that can be named and restored. Useful for "before/after redesign" comparisons.
