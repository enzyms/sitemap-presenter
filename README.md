<p align="center">
  <img src="https://img.shields.io/badge/Svelte-5-FF3E00?style=for-the-badge&logo=svelte&logoColor=white" alt="Svelte 5" />
  <img src="https://img.shields.io/badge/SvelteKit-2-FF3E00?style=for-the-badge&logo=svelte&logoColor=white" alt="SvelteKit 2" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Supabase-Postgres-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Playwright-Crawler-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright" />
  <img src="https://img.shields.io/badge/Deploy-Netlify-00C7B7?style=for-the-badge&logo=netlify&logoColor=white" alt="Netlify" />
</p>

# Sitemap Presenter

**Crawl any website. Visualize its structure. Collect feedback directly on the page.**

Sitemap Presenter is a full-stack tool that crawls websites using a headless browser, renders their page hierarchy as an interactive node graph with live screenshot thumbnails, and provides an embeddable feedback widget that lets anyone drop visual markers directly on page elements -- with comments, status tracking, and YouTrack integration.

---

## Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [The Crawler](#-the-crawler)
- [The Sitemap Canvas](#-the-sitemap-canvas)
- [The Feedback Widget](#-the-feedback-widget)
- [Page Viewer](#-page-viewer)
- [Feedback Dashboard](#-feedback-dashboard)
- [YouTrack Integration](#-youtrack-integration)
- [Authentication](#-authentication)
- [Caching Strategy](#-caching-strategy)
- [Deployment](#-deployment)
- [Environment Variables](#-environment-variables)
- [Scripts Reference](#-scripts-reference)
- [Database Schema](#-database-schema)
- [Tech Stack](#-tech-stack)
- [License](#-license)

---

## Features

### Website Crawling
- **Headless browser crawling** -- Uses Playwright to discover pages, even on JavaScript-heavy SPAs
- **Configurable depth & limits** -- Set max depth (1-5) and max pages (3-500)
- **Glob-based exclusion patterns** -- Skip sections like `/blog/*` or `/admin/*`
- **Extra include URLs** -- Seed the crawl with specific pages that might not be linked
- **HTTP Basic Auth support** -- Crawl password-protected staging sites
- **Real-time progress** -- WebSocket-powered live updates as pages are discovered
- **Automatic screenshots** -- Captures full-page thumbnails with Playwright + Sharp

### Interactive Sitemap
- **Node graph visualization** -- Built on [Svelte Flow](https://svelteflow.dev) (@xyflow/svelte)
- **Screenshot thumbnails** -- Every page node shows a captured preview image
- **Hierarchical layout** -- Automatic tree layout with dagre
- **Expand/collapse subtrees** -- Focus on the sections you care about
- **Depth color coding** -- Visual depth indicators (blue > green > yellow > orange > red)
- **Search & filter** -- Find pages by URL or title, matching nodes highlighted
- **Zoom-aware level of detail** -- Nodes scale between thumbnail and full-detail views
- **Draggable nodes** -- Rearrange the layout, positions are saved
- **MiniMap navigation** -- Overview panel for quick orientation
- **Feedback overlay** -- Nodes glow orange/green based on open/resolved feedback count

### Feedback Widget
- **One-line embed** -- Just add a `<script>` tag to any website
- **Point-and-click markers** -- Click any element to place a numbered feedback marker
- **DOM-anchored positioning** -- Markers attach to CSS selectors, with XPath and percentage fallbacks
- **Threaded comments** -- Each marker has its own comment thread
- **Status workflow** -- Open > Resolved > Archived (with reopen)
- **Real-time sync** -- Supabase Realtime keeps all viewers in sync
- **SPA navigation support** -- Intercepts `pushState`/`replaceState`, auto-reloads markers on route change
- **Shadow DOM isolation** -- Widget styles never leak into the host page
- **Keyboard shortcuts** -- `Alt+F` to toggle placement mode, `Esc` to cancel
- **Customizable** -- Position (4 corners), primary color, button text

### Project Management
- **Multi-site dashboard** -- Manage multiple websites from a single interface
- **Site-level stats** -- See marker counts, open/resolved at a glance
- **Per-site settings** -- Name, domain, YouTrack integration, API keys
- **Persistent layout** -- Node positions saved to Supabase with lock support

---

## Architecture

```
                                   +---------------------+
                                   |    Feedback Widget   |
                                   |   (Vanilla JS IIFE) |
                                   |   <script> embed     |
                                   +----------+----------+
                                              |
                                      Supabase Realtime
                                              |
+-------------------+    Socket.io    +-------+--------+     Supabase     +------------------+
|   Web Frontend    | <=============> |  Express API   | <=============>  |   Supabase DB    |
|   (SvelteKit 2)   |                |  (Node.js)     |                  |   + Storage      |
|                   |   REST API      |                |   Playwright     +------------------+
|  - Dashboard      | <------------> |  - /api/crawl  |   Screenshots
|  - Sitemap Canvas |                |  - /api/cancel |       |
|  - Page Viewer    |                |  - /api/delete |       v
|  - Feedback View  |                +----------------+    Target
+-------------------+                                     Websites
        |
        +---- Supabase (direct client-side reads/writes)
        +---- IndexedDB (screenshot cache)
        +---- localStorage (crawl data cache)
```

### Data Flow: Crawling

```
User clicks "Start Crawl"
        |
        v
POST /api/crawl/start --> Server creates session, returns sessionId
        |
        v
Web app connects Socket.io to sessionId room
        |
        v
CrawlerService launches Playwright (headless Chromium)
        |
        v
BFS crawl: discovers pages --> emits "page:discovered" via WebSocket
        |                            |
        v                            v
After crawl: take screenshots    Web app builds node graph
via Playwright + Sharp           in real-time
        |
        v
Upload to Supabase Storage --> emit "page:screenshot" via WebSocket
                                     |
                                     v
                              Web app updates thumbnails,
                              caches to localStorage + Supabase
```

### Data Flow: Feedback

```
User embeds <script data-api-key="..."> on their site
        |
        v
Widget initializes: looks up site by API key in Supabase
        |
        v
User clicks "Feedback" button --> enters crosshair mode
        |
        v
Click on element --> captures CSS selector, XPath, offset, viewport
        |
        v
Optimistic creation: show marker bubble immediately
        |
        v
Persist to Supabase --> Supabase Realtime broadcasts to all viewers
        |
        v
Sitemap Presenter's PageViewer receives update via postMessage
```

---

## Quick Start

### Prerequisites

- **Node.js** >= 18
- **pnpm** >= 8
- **Redis** (for Bull job queue on the server)
- A **Supabase** project (free tier works)

### 1. Clone & Install

```bash
git clone https://github.com/your-org/sitemap-presenter.git
cd sitemap-presenter
pnpm install
```

### 2. Set Up Environment Variables

```bash
# Web app
cp apps/web/.env.example apps/web/.env
# Edit with your Supabase credentials + auth config

# Server -- create .env with required variables:
cat > apps/server/.env << 'EOF'
PORT=3002
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
EOF

# Widget (for development builds)
cp packages/widget/.env.example packages/widget/.env
```

See [Environment Variables](#-environment-variables) for the full reference.

### 3. Set Up the Database

Run the SQL migrations in your Supabase project dashboard (SQL Editor), in order:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_add_sites_delete_policy.sql
supabase/migrations/003_add_site_layouts.sql
supabase/migrations/004_add_site_crawl_cache.sql
supabase/migrations/005_add_archived_marker_status.sql
supabase/migrations/006_add_youtrack_issue_id.sql
```

### 4. Install Playwright Browsers

```bash
cd apps/server
npx playwright install chromium
```

### 5. Start Development

```bash
# Start everything (web + server in parallel)
pnpm dev

# Or individually:
pnpm dev:web      # SvelteKit on http://localhost:5173
pnpm dev:server   # Express on http://localhost:3002
pnpm dev:widget   # Widget build in watch mode
```

### 6. Create Your First Site

1. Navigate to `http://localhost:5173`
2. Log in with your configured email + password
3. Click **"Create your first site"**
4. Enter a name and domain URL
5. Go to the site's map view and click **"Start Crawl"**
6. Watch the sitemap build in real-time!

---

## Project Structure

```
sitemap-presenter/
|
|-- apps/
|   |-- web/                          # SvelteKit 2 frontend
|   |   |-- src/
|   |   |   |-- routes/
|   |   |   |   |-- +page.svelte            # Dashboard (site list)
|   |   |   |   |-- login/+page.svelte      # Authentication
|   |   |   |   |-- sites/
|   |   |   |       |-- new/+page.svelte    # Create new site
|   |   |   |       |-- [id]/
|   |   |   |           |-- map/[[nodeId]]/+page.svelte  # Sitemap canvas
|   |   |   |           |-- feedback/+page.svelte        # Feedback list
|   |   |   |           |-- settings/+page.svelte        # Site settings
|   |   |   |-- lib/
|   |   |       |-- components/
|   |   |       |   |-- canvas/       # Svelte Flow components
|   |   |       |   |   |-- SitemapCanvas.svelte   # Main graph container
|   |   |       |   |   |-- PageNode.svelte        # Custom node (screenshot card)
|   |   |       |   |   |-- LinkEdge.svelte        # Custom edge (page links)
|   |   |       |   |   |-- NodeFocuser.svelte     # Auto-focus on node
|   |   |       |   |-- viewer/       # Page viewer with feedback
|   |   |       |   |   |-- PageViewer.svelte      # Iframe + feedback overlay
|   |   |       |   |   |-- FeedbackSidebar.svelte # Marker list + comments
|   |   |       |   |-- ui/           # Shared UI components
|   |   |       |       |-- AppHeader.svelte
|   |   |       |       |-- ConfigPanel.svelte     # Crawl configuration
|   |   |       |       |-- SearchBar.svelte
|   |   |       |       |-- YoutrackModal.svelte
|   |   |       |       |-- MarkerListItem.svelte
|   |   |       |       |-- ...
|   |   |       |-- stores/           # Svelte 5 reactive stores
|   |   |       |   |-- sitemap.svelte.ts    # Node/edge graph state
|   |   |       |   |-- config.svelte.ts     # Crawl config form state
|   |   |       |   |-- feedback.svelte.ts   # Feedback markers state
|   |   |       |   |-- pageViewer.svelte.ts # Viewer panel state
|   |   |       |   |-- projects.svelte.ts   # Project/cache management
|   |   |       |-- services/         # API clients, caching, utilities
|   |   |       |   |-- api.ts               # REST API client
|   |   |       |   |-- socket.ts            # Socket.io client
|   |   |       |   |-- supabase.ts          # Supabase client + types
|   |   |       |   |-- screenshotCache.ts   # IndexedDB screenshot cache
|   |   |       |   |-- layoutPositions.ts   # Node position persistence
|   |   |       |   |-- crawlCacheService.ts # Crawl data persistence
|   |   |       |   |-- iframeMessenger.ts   # Widget <-> Viewer communication
|   |   |       |   |-- markerSync.ts        # Supabase Realtime subscriptions
|   |   |       |-- types/            # TypeScript interfaces
|   |   |       |-- utils/            # Helper functions
|   |
|   |-- server/                       # Express + Socket.io backend
|       |-- src/
|           |-- index.ts              # Server entry point
|           |-- routes/
|           |   |-- crawl.ts          # POST /api/crawl/start, /cancel, /delete
|           |-- services/
|               |-- crawler.ts        # Playwright BFS crawler
|               |-- supabaseClient.ts # Server-side Supabase (service role)
|
|-- packages/
|   |-- shared/                       # Shared TypeScript types
|   |   |-- src/index.ts              # All types, constants, interfaces
|   |
|   |-- widget/                       # Embeddable feedback widget
|       |-- src/
|       |   |-- index.ts              # Entry point, auto-initialization
|       |   |-- api/supabase.ts       # FeedbackAPI (Supabase CRUD + Realtime)
|       |   |-- components/
|       |   |   |-- FeedbackWidget.ts # Main Web Component (Shadow DOM)
|       |   |   |-- MarkerBubble.ts   # Individual marker circle
|       |   |   |-- CommentsPanel.ts  # Comment thread UI
|       |   |-- styles/widget.css.ts  # CSS-in-JS for Shadow DOM
|       |-- dist/widget.js            # Built IIFE bundle
|       |-- test/index.html           # Local test page
|
|-- supabase/
|   |-- migrations/                   # 6 SQL migration files
|
|-- netlify.toml                      # Build + redirect config
|-- pnpm-workspace.yaml               # Workspace definition
|-- package.json                       # Root scripts
```

---

## The Crawler

The crawling engine is the heart of page discovery. It runs on the Express server and uses Playwright's headless Chromium to perform a **breadth-first traversal** of the target website.

### How It Works

1. **Browser launch** -- Spins up headless Chromium with sandbox disabled (for server environments)
2. **BFS queue** -- Starts from the root URL, follows internal links up to `maxDepth`
3. **Page processing** -- For each URL:
   - Navigates with Playwright (waits for `networkidle`)
   - Extracts `<title>`, internal links, external links via page evaluation
   - Normalizes URLs (strips trailing slashes, fragments, query params)
   - Checks against exclude patterns (glob matching)
4. **Real-time updates** -- Each discovered page is emitted via Socket.io
5. **Screenshot capture** -- After discovery, revisits pages for full-page screenshots
   - Processed with Sharp (resize, optimize)
   - Uploaded to Supabase Storage
   - Emitted via Socket.io for live thumbnail updates

### Configuration Options

| Option | Range | Default | Description |
|--------|-------|---------|-------------|
| `url` | -- | -- | The starting URL to crawl |
| `maxDepth` | 1-5 | 1 | How many link-hops deep to follow |
| `maxPages` | 3-500 | 3 | Maximum number of pages to discover |
| `excludePatterns` | -- | `[]` | Glob patterns to skip (e.g. `/blog/*`) |
| `includeUrls` | -- | `[]` | Extra URLs to seed into the crawl queue |
| `httpUser` | -- | -- | HTTP Basic Auth username |
| `httpPassword` | -- | -- | HTTP Basic Auth password |

### Cancel Support

Crawls can be cancelled mid-flight. The server checks a `shouldContinue()` callback on each iteration, and the client can call `POST /api/crawl/cancel` to abort.

---

## The Sitemap Canvas

The sitemap is rendered as an interactive node graph using **Svelte Flow** (the Svelte port of React Flow).

### Custom Nodes (`PageNode`)

Each page is represented by a custom node containing:

- **Screenshot thumbnail** -- Captured during the crawl
- **Page title & URL** -- Truncated to fit the card
- **Depth badge** -- Color-coded by level:

  | Depth | Color |
  |-------|-------|
  | 0 (root) | Blue |
  | 1 | Green |
  | 2 | Yellow |
  | 3 | Orange |
  | 4+ | Red |

- **Status indicator** -- Green (ready), yellow (processing), red (error), gray (pending)
- **Feedback badge** -- Shows marker count with color coding:
  - **Orange glow** = has open markers
  - **Green glow** = all resolved
  - **Gray glow** = only archived
- **Expand/collapse button** -- Toggle child node visibility
- **Link counts** -- Internal and external link badges (visible at full zoom)

### Layout Engine

Pages are arranged in a **hierarchical tree layout** using the dagre algorithm:
- Root page at the top
- Child pages flow downward by depth level
- Custom edges (`LinkEdge`) show the parent-child relationships

### Interactions

| Action | Effect |
|--------|--------|
| Click a node | Opens the Page Viewer with embedded page + feedback |
| Drag a node | Rearranges layout (positions auto-save to Supabase) |
| Scroll wheel | Zoom in/out with level-of-detail scaling |
| Type in search bar | Filter nodes by URL or title (yellow ring highlight) |
| Click +/- button | Expand or collapse a node's subtree |
| MiniMap | Click or drag for quick navigation |

---

## The Feedback Widget

A lightweight, zero-dependency (besides Supabase client) feedback widget that can be embedded on **any website** with a single script tag.

### Installation

```html
<script
  src="https://your-sitemap-presenter.netlify.app/widget.js"
  data-api-key="your-site-api-key"
  async
></script>
```

Optional attributes:

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-api-key` | *required* | Your site's API key from the dashboard |
| `data-position` | `bottom-right` | Button position: `bottom-right`, `bottom-left`, `top-right`, `top-left` |
| `data-color` | `#f97316` | Primary color (hex) for buttons and markers |

### How Markers Work

```
  Click "Feedback"          Hover over elements         Click to place
  +--------------+         +------------------+        +----------------+
  | Enter        |  --->   | Elements get     |  --->  | Marker bubble  |
  | crosshair    |         | highlighted on   |        | appears with   |
  | mode         |         | hover            |        | number badge   |
  +--------------+         +------------------+        +----------------+
                                                              |
                                                              v
                                                       +----------------+
                                                       | Comments panel |
                                                       | opens -- type  |
                                                       | your feedback  |
                                                       +----------------+
```

When a marker is placed, the widget captures:

| Data Point | Purpose |
|------------|---------|
| **CSS selector** | Primary anchor -- built by traversing the DOM (IDs, classes, nth-of-type) |
| **XPath** | Fallback if the CSS selector breaks |
| **Inner text** | First 50 characters for human identification |
| **Click offset** | Exact position within the target element |
| **Viewport info** | Window dimensions, scroll position, device pixel ratio |
| **Fallback position** | Percentage-based coordinates if the element disappears |

### Marker Status Workflow

```
  +--------+     Resolve     +----------+     Archive     +----------+
  |  OPEN  | -------------> | RESOLVED | -------------> | ARCHIVED |
  +--------+                +----------+                +----------+
      ^                          |                           |
      |        Reopen            |          Reopen           |
      +--------------------------+---------------------------+
```

### Widget Architecture

- **Web Component** (`<feedback-widget>`) with Shadow DOM for complete style isolation
- **Vanilla TypeScript** -- No framework, ships as a single ~50KB IIFE bundle
- **PostMessage API** -- Bi-directional communication when embedded in the Page Viewer iframe
- **SPA-aware** -- Intercepts `history.pushState`/`replaceState` and listens for `popstate`
- **Optimistic UI** -- Markers appear instantly, Supabase sync happens in the background
- **Auto-cleanup** -- Markers dismissed without a comment are automatically deleted

### PostMessage Protocol

When the widget runs inside the Page Viewer iframe, it communicates via structured messages:

| Direction | Message | Purpose |
|-----------|---------|---------|
| Parent -> Widget | `FEEDBACK_GET_MARKERS` | Request current markers |
| Parent -> Widget | `FEEDBACK_UPDATE_STATUS` | Change marker status |
| Parent -> Widget | `FEEDBACK_ADD_COMMENT` | Add a comment |
| Parent -> Widget | `FEEDBACK_DELETE_MARKER` | Delete a marker |
| Parent -> Widget | `FEEDBACK_HIGHLIGHT_MARKER` | Scroll to and highlight a marker |
| Parent -> Widget | `FEEDBACK_STATUS_FILTER` | Filter visible markers |
| Widget -> Parent | `FEEDBACK_NAVIGATION` | Page navigation occurred |
| Widget -> Parent | `FEEDBACK_MARKER_CREATED` | New marker was placed |
| Widget -> Parent | `FEEDBACK_MARKER_UPDATED` | Marker status changed |
| Widget -> Parent | `FEEDBACK_MARKER_DELETED` | Marker was removed |
| Widget -> Parent | `FEEDBACK_MARKER_SELECTED` | User clicked a marker |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt + F` | Toggle placement mode |
| `Esc` | Cancel placement / close comments panel |

---

## Page Viewer

Clicking any node in the sitemap opens the **Page Viewer** -- a split-pane interface:

### Left Pane: Live Page Preview
- **Iframe embed** of the actual page with the feedback widget active
- **Viewport resize** -- Drag the edge to simulate different screen widths
- **Viewport snapping** -- Auto-adjust to match the viewport width when a marker was created
- **Marker highlights** -- Clicking a marker in the sidebar scrolls the iframe and highlights it

### Right Pane: Feedback Sidebar
- **Marker list** -- All markers for the current page
- **Status tabs** -- Active (open + resolved) vs. Archived
- **Quick actions** -- Resolve, archive, reopen, delete
- **Comment threads** -- View and add comments inline
- **YouTrack links** -- Jump to linked issues or create new ones
- **Navigate to node** -- Zoom the sitemap canvas to the current page's node

---

## Feedback Dashboard

The dedicated feedback page (`/sites/[id]/feedback`) provides a **site-wide view** of all feedback:

- **Status filter** -- All / Open / Resolved / Archived
- **Page filter** -- Narrow down to a specific page path
- **Grouped by page** -- Markers organized under their page paths
- **Expandable details** -- Click any marker to see its full comment thread
- **Inline actions** -- Change status, add comments, delete markers
- **Live counts** -- Total, filtered, and per-status counts

---

## YouTrack Integration

Connect feedback markers to YouTrack issues for seamless project management.

### Setup

1. Go to **Site Settings** > **YouTrack Integration**
2. Enter your YouTrack **Base URL** (e.g. `https://your-org.youtrack.cloud`)
3. Enter the **Project ID** (short name, e.g. `SP`)
4. Generate and paste a **Permanent Token** from YouTrack
5. Click **Test Connection** to verify

### Features

- **Create issues** from any feedback marker with one click
- **Auto-link** -- The YouTrack issue ID is stored on the marker
- **Quick navigation** -- Click the issue badge to jump to YouTrack
- **Test connection** -- Verify credentials before saving

---

## Authentication

Simple **email allowlist + shared password** system designed for small teams:

```
             +-------------------+
             |   /login page     |
             |                   |
             |  Email: [       ] |
             |  Password: [   ] |
             |  [ Sign In ]     |
             +--------+----------+
                      |
                      v
          +-----------+-----------+
          | Server-side check:    |
          | 1. Email in allowlist?|
          | 2. Password matches?  |
          +-----------+-----------+
                      |
               +------+------+
               |             |
            Success        Fail
               |             |
               v             v
         Set cookie     Show error
        (30 days)       message
```

- Configured via `ALLOWED_EMAILS` and `AUTH_PASSWORD` env vars
- Cookie-based sessions (`auth_email`, `httpOnly`, 30-day expiry)
- Secure flag enabled in production, SameSite=Lax

---

## Caching Strategy

Multi-layer caching for fast loads and offline resilience:

```
+------------------+     +------------------+     +------------------+     +------------------+
|   L1: Memory     |     |  L2: localStorage|     |  L3: IndexedDB   |     |  L4: Supabase    |
|  (Component $state) --> |  (Crawl data,   | --> |  (Screenshot     | --> |  (Crawl cache,   |
|   Session only   |     |   node positions)|     |   binary blobs)  |     |   layouts, all   |
|                  |     |   Persistent     |     |   Persistent     |     |   shared data)   |
+------------------+     +------------------+     +------------------+     +------------------+
```

| Layer | Storage | Data | Persistence |
|-------|---------|------|-------------|
| **L1** | Svelte `$state` | Current session data | Session only |
| **L2** | `localStorage` | Crawl results, node positions | Browser-persistent |
| **L3** | IndexedDB | Screenshot images (binary) | Browser-persistent |
| **L4** | Supabase | Everything (crawl cache, layouts, markers, screenshots) | Cloud-persistent |

- **Dual-write** on crawl: data goes to localStorage (instant) + Supabase (shared)
- **Screenshot caching**: IndexedDB keyed by page URL avoids repeated downloads
- **Layout persistence**: Node positions saved to both localStorage and Supabase with lock support
- **Instant restore**: Loading from cache restores the full sitemap without re-crawling

---

## Deployment

### Netlify (Frontend)

The project is configured for Netlify out of the box:

```toml
[build]
  command = "pnpm build:widget && mkdir -p apps/web/static/widget && cp packages/widget/dist/widget.js apps/web/static/widget/ && cd apps/web && pnpm build"
  publish = "apps/web/build"

[build.environment]
  NODE_VERSION = "20"
```

**Build pipeline:**
1. Build the widget into a single IIFE file (`packages/widget/dist/widget.js`)
2. Copy `widget.js` into the web app's static directory
3. Build the SvelteKit app with `adapter-netlify`

The widget is served at `/widget.js` with CORS headers (`Access-Control-Allow-Origin: *`) for cross-origin embedding.

### Server (Backend)

The Express server needs separate hosting (Railway, Fly.io, Render, etc.) because it requires:
- **Long-running processes** -- Playwright crawling can take minutes
- **WebSocket support** -- Socket.io for live crawl updates
- **Redis** -- Bull job queue backend

---

## Environment Variables

### Web App (`apps/web/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |
| `DATABASE_URL` | No | PostgreSQL connection string (for direct DB access) |
| `ALLOWED_EMAILS` | Yes | Comma-separated list of authorized emails |
| `AUTH_PASSWORD` | Yes | Shared login password |

### Server (`apps/server/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: `3002`) |
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (keep secret!) |

### Widget (`packages/widget/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase URL (injected at build time) |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key (injected at build time) |

---

## Scripts Reference

### Root

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start all packages in parallel |
| `pnpm dev:web` | Start web frontend only |
| `pnpm dev:server` | Start Express backend only |
| `pnpm dev:widget` | Start widget build in watch mode |
| `pnpm build` | Build all packages |
| `pnpm build:widget` | Build widget only |
| `pnpm lint` | Lint all packages |

### Web App (`apps/web`)

| Script | Description |
|--------|-------------|
| `pnpm dev` | Vite dev server (port 5173) |
| `pnpm build` | Production build |
| `pnpm preview` | Preview production build |
| `pnpm check` | TypeScript + Svelte type checking |
| `pnpm check:watch` | Type checking in watch mode |

### Server (`apps/server`)

| Script | Description |
|--------|-------------|
| `pnpm dev` | tsx watch mode with .env loading |
| `pnpm build` | Compile TypeScript |
| `pnpm start` | Run compiled output |

---

## Database Schema

The Supabase PostgreSQL database contains the following tables:

### `sites`

Core entity -- each row represents a website being tracked.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `name` | text | Display name |
| `domain` | text | Website URL |
| `api_key` | text | Unique key for widget authentication |
| `settings` | jsonb | Color, position, YouTrack config, allowed domains |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last update |

### `markers`

Feedback markers placed on pages via the widget.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `site_id` | uuid | FK to `sites` |
| `author_id` | text | Anonymous session ID |
| `page_url` | text | Full page URL |
| `page_path` | text | URL pathname only |
| `page_title` | text | Page title at creation time |
| `number` | integer | Sequential per-site marker number |
| `anchor` | jsonb | CSS selector, XPath, offset, inner text |
| `fallback_position` | jsonb | Percentage-based x/y coordinates |
| `viewport` | jsonb | Window width, height, scroll, DPR |
| `status` | text | `open` / `resolved` / `archived` |
| `youtrack_issue_id` | text | Linked YouTrack issue ID |
| `created_at` | timestamptz | Creation timestamp |

### `comments`

Threaded comments on markers.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `marker_id` | uuid | FK to `markers` |
| `author_id` | text | Anonymous session ID |
| `author_name` | text | Display name |
| `content` | text | Comment body |
| `created_at` | timestamptz | Creation timestamp |

### `anonymous_users`

Tracks widget users by session.

| Column | Type | Description |
|--------|------|-------------|
| `session_id` | text | PK (e.g. `sess_1708123456_a1b2c3`) |
| `name` | text | User-provided name |
| `email` | text | User-provided email |
| `user_agent` | text | Browser user agent |
| `created_at` | timestamptz | Creation timestamp |

### `site_layouts`

Saved node positions for the sitemap visualization.

| Column | Type | Description |
|--------|------|-------------|
| `site_id` | uuid | FK to `sites` |
| `layout_mode` | text | `hierarchical` or `radial` |
| `positions` | jsonb | `{ nodeId: { x, y } }` |
| `is_locked` | boolean | Prevent edits by others |
| `updated_by` | text | Last editor |

### `site_crawl_cache`

Persisted crawl results for instant sitemap restore without re-crawling.

---

## Tech Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| [Svelte 5](https://svelte.dev) | UI framework with runes (`$state`, `$derived`, `$props`) |
| [SvelteKit 2](https://kit.svelte.dev) | Full-stack framework (SSR, routing, form actions) |
| [Svelte Flow](https://svelteflow.dev) | Interactive node graph visualization |
| [Tailwind CSS](https://tailwindcss.com) | Utility-first styling |
| [Supabase JS](https://supabase.com/docs/reference/javascript) | Database client + Realtime subscriptions |
| [Socket.io Client](https://socket.io) | WebSocket for live crawl updates |
| [Vite 5](https://vitejs.dev) | Build tool and dev server |
| TypeScript 5 | Type safety across the stack |

### Backend

| Technology | Purpose |
|------------|---------|
| [Express](https://expressjs.com) | HTTP API server |
| [Socket.io](https://socket.io) | WebSocket server for crawl progress |
| [Playwright](https://playwright.dev) | Headless browser for crawling + screenshots |
| [Sharp](https://sharp.pixelplumbing.com) | Image processing (resize, optimize thumbnails) |
| [Cheerio](https://cheerio.js.org) | HTML parsing fallback |
| [Bull](https://github.com/OptimalBits/bull) | Redis-backed job queue |

### Infrastructure

| Technology | Purpose |
|------------|---------|
| [Supabase](https://supabase.com) | PostgreSQL + Storage + Realtime |
| [Redis](https://redis.io) | Job queue backend for Bull |
| [Netlify](https://netlify.com) | Frontend hosting (adapter-netlify) |
| [pnpm](https://pnpm.io) | Fast, disk-efficient package manager |

---

## License

Private project. All rights reserved.
