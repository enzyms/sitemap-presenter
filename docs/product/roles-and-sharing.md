# Roles, Sharing & Data Architecture

## User Roles

### Admin (Sitemap Presenter user)

**Who:** Designer, PM, developer, QA lead — anyone with access to the Sitemap Presenter app.

**Current capabilities:**
- Create/delete sites
- Trigger crawls
- View sitemap (map + circular views)
- Arrange nodes, switch layouts
- View feedback markers left by Feedbackers
- Manage marker status (open/resolved)
- Send to YouTrack, trigger Autofix

**Pain points today:**
- Each admin must crawl independently — crawl data and screenshots are not shared
- Screenshots live on the server filesystem but sitemap structure (nodes/edges/positions) is only in the admin's browser (localStorage + IndexedDB)
- If admin A crawls and arranges the map, admin B sees nothing — they must crawl again and rearrange
- Deleting browser data loses the entire sitemap layout

### Feedbacker (Widget user)

**Who:** Client, stakeholder, end-user — anyone visiting the website with the feedback widget installed.

**Current capabilities:**
- Click anywhere on the site to place a marker
- Add comments to markers
- See their own markers highlighted

**Pain points today:**
- No visibility into what happens after leaving feedback — is it seen? resolved?
- No notification when a marker is resolved or replied to
- Cannot see other feedbackers' markers (isolated view)
- No way to attach files or annotate screenshots
- No identity — all feedback is anonymous

---

## Current Data Architecture (the sharing problem)

```
              SERVER (Express, port 3002)
              +---------------------------------+
              | /screenshots/*.jpg   (on disk)  |  <-- shared across sessions
              | Session memory (ephemeral)      |  <-- lost on restart
              +---------------------------------+
                          |
                    WebSocket + REST
                          |
              BROWSER (per admin, isolated)
              +---------------------------------+
              | IndexedDB: screenshot blobs     |  <-- per-browser cache
              | localStorage: nodes, edges,     |
              |   positions, layout, projects   |  <-- per-browser only
              +---------------------------------+
```

**What IS shared today:**
- Screenshots on disk (via URL hash — same URL = same file)
- Feedback markers in Supabase (site-level, all admins see them)

**What is NOT shared:**
- Sitemap structure (nodes, edges, hierarchy)
- Node positions / layout arrangement
- Crawl progress and status
- Project metadata

---

## Proposal: Shared Crawl Data

### Goal
When admin A crawls a site, admin B can see the sitemap immediately without re-crawling.

### What to persist server-side (Supabase)

| Data | Currently stored | Proposed |
|------|-----------------|----------|
| Site metadata | Supabase `sites` table | Keep as-is |
| Crawl results (nodes/edges) | Browser localStorage only | New `crawls` + `pages` tables in Supabase |
| Node positions | Browser localStorage only | New `sitemap_layouts` table (per-site, per-layout-mode) |
| Screenshots | Server filesystem | Keep on server; store URL references in `pages` table |
| Feedback markers | Supabase `markers` table | Keep as-is |

### New Supabase tables

**`crawls`** — one row per crawl execution
- `id`, `site_id`, `started_at`, `completed_at`, `status`, `config` (maxDepth, maxPages), `page_count`, `triggered_by`

**`pages`** — crawled pages for the latest crawl
- `id`, `site_id`, `crawl_id`, `url`, `title`, `depth`, `parent_url`, `internal_links`, `external_links`, `thumbnail_hash`, `full_screenshot_hash`

**`sitemap_layouts`** — saved node arrangements
- `id`, `site_id`, `layout_mode`, `positions` (JSONB: `{nodeId: {x, y}}`), `updated_at`, `updated_by`

### Benefits
- Any admin sees the map instantly after first crawl
- Re-crawling updates for everyone
- Layout positions can be shared (or kept personal — see open question below)
- Screenshots are already shared via URL hash on server disk

### Pitfalls / Open questions
1. **Conflict resolution for positions**: If admin A rearranges nodes and admin B does too, whose layout wins? Options:
   - Last-write-wins (simple, can frustrate)
   - Per-user layouts (more storage, no collaboration feel)
   - Single shared layout with real-time sync (complex, best UX)
2. **Screenshot storage scaling**: Server filesystem doesn't scale for multi-server deployment. Consider S3/Cloudflare R2 for production.
3. **Crawl ownership**: Who can trigger a re-crawl? Anyone? Only the creator? Need role-based permissions eventually.
4. **Stale data**: If the site changes, the crawl data is stale. Consider showing "crawled 3 days ago" timestamps and allowing quick re-crawl.

---

## Proposal: Improving the Feedbacker UX

### Quick wins (widget improvements)

| Improvement | Effort | Impact |
|-------------|--------|--------|
| Show marker count badge on widget button | Low | Feedbackers see activity, feel heard |
| Allow feedbacker to see status of their own markers (open/resolved) | Medium | Closes the feedback loop |
| Email notification when marker is resolved | Medium | Engagement, trust |
| Allow screenshot annotation (draw on screenshot) | High | Much richer feedback quality |
| Optional name/email field on marker creation | Low | Enables follow-up, builds relationship |

### Bigger ideas

**Feedbacker dashboard (read-only page)**
- A lightweight page (no login needed, accessed via unique link per site) where feedbackers can see all their submitted markers and their status
- Reduces "shouting into the void" feeling
- Could filter by "my markers" if optional identity is captured

**Guided feedback mode**
- Admin creates a "feedback tour" — a list of pages to review
- Feedbacker gets a step-by-step flow: "Review the homepage > Review the about page > ..."
- Structured feedback instead of ad-hoc markers
- Great for client review rounds

**Priority / category tags**
- Let feedbackers tag markers: bug, design, content, question
- Admins can filter/sort by category
- Helps triage when there are many markers

---

## Multi-Admin Collaboration Vision

### Phase 1: Shared crawl data (near-term)
- Persist crawl results to Supabase
- Any admin with site access sees the same sitemap
- Screenshots served from server (already works)
- Positions still per-browser (personal layout)

### Phase 2: Shared layouts + real-time (medium-term)
- Save layout positions to Supabase
- Real-time cursor/presence (who's looking at what)
- Optimistic locking for position edits
- Activity feed: "Alice re-crawled the site", "Bob resolved 3 markers"

### Phase 3: Roles & permissions (long-term)
- Admin roles: Owner, Editor, Viewer
- Owner: full control (delete site, manage team)
- Editor: crawl, arrange, manage markers
- Viewer: read-only map + markers
- Feedbacker: widget-only, optional identity

---

## Screenshot Sharing — Current State

Screenshots are already effectively shared:
- Server stores them by **MD5 hash of URL** → same URL always maps to same file
- Any admin hitting `/api/screenshots/{hash}.jpg` gets the same image
- The gap is that **the sitemap structure referencing those screenshots** is browser-local

Once crawl data is in Supabase (Phase 1), screenshot URLs become part of the shared `pages` table, and every admin gets thumbnails without re-crawling.

**Caveat:** Server filesystem storage won't survive redeployment (Netlify/serverless). For production, screenshots should move to object storage (S3, R2, Supabase Storage).
