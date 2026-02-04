# Sitemap Presenter

An interactive sitemap visualization tool that crawls websites and displays their structure with screenshots.

## Features

### Project Management Dashboard
- **Create and manage multiple projects** - Each project stores a base URL, name, and description
- **Switch between projects** easily through the dashboard interface
- **Automatic data caching** - Crawled data and screenshots are cached locally in localStorage
- **Persistent storage** - All projects and their data persist across browser sessions

### Smart Caching System
- **Image caching** - Screenshots are cached locally, so returning to the same URL loads instantly without re-crawling
- **Full sitemap caching** - Entire sitemap structure (nodes and edges) is cached per project
- **Easy to migrate** - The local cache system is designed to be easily migrated to Supabase later

### Crawling Configuration
- **Default values optimized for development**:
  - Max Depth: 1 (configurable from 1-5)
  - Max Pages: 3 (configurable from 3-500)
- **Real-time progress tracking** via WebSocket
- **Live screenshot capture** during crawl

### User Interface
- **Projects Dashboard** - Toggle with the menu button (top left)
  - Create new projects
  - View all projects with their cached data status
  - Select a project to load its cached data
  - Delete projects you no longer need
- **Visual sitemap canvas** - Interactive node graph showing page relationships
- **Search functionality** - Find pages by URL or title
- **Page detail panel** - View detailed information about each page
- **Progress indicators** - See crawling and screenshot progress in real-time

## Getting Started

### Installation

```bash
# Install dependencies
pnpm install

# Start the server
cd apps/server
pnpm dev

# In another terminal, start the web app
cd apps/web
pnpm dev
```

### Usage

1. **Create a Project**
   - Click the menu button (top left)
   - Click "New Project"
   - Enter project name, description, and base URL
   - Click "Create"

2. **Start Crawling**
   - The project's base URL will be automatically loaded
   - Adjust max depth and max pages if needed
   - Click "Start Crawl"
   - Watch the sitemap build in real-time

3. **View Results**
   - Click on any node to see page details
   - Use the search bar to find specific pages
   - Zoom and pan the canvas to explore the sitemap

4. **Return to Cached Data**
   - Open the Projects Dashboard
   - Select a project that has cached data (shows green checkmark)
   - The cached sitemap loads instantly without re-crawling
   - Click "Load Cache" in the config panel to reload cached data

## Technical Details

### Architecture
- **Monorepo structure** with separate web and server packages
- **Web**: SvelteKit with TypeScript, Tailwind CSS, and XYFlow for graph visualization
- **Server**: Node.js with Express, WebSocket (Socket.io), and Playwright for screenshots

### Caching Strategy
- **localStorage** for persistent storage
- **Data cached per project**:
  - Page nodes with all metadata
  - Link edges showing relationships
  - Screenshot URLs mapped to page URLs
- **Timestamps**: Track when projects were created, updated, and last crawled

### Future Enhancements
- Migration to Supabase for cloud storage
- Team collaboration features
- Export sitemap data (JSON, CSV, etc.)
- Custom crawling rules and filters
- Advanced screenshot options

## Development

The default configuration uses conservative values for development:
- **Max Depth: 1** - Only crawl one level deep
- **Max Pages: 3** - Limit to 3 pages per crawl

These can be adjusted in the UI or modified in `apps/web/src/lib/stores/config.ts`.

## License

MIT
