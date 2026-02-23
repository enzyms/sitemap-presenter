# Project: Sitemap Presenter

Monorepo (pnpm) with `apps/web` (SvelteKit 2 + Svelte 5), `apps/server` (Express), `packages/shared`, `packages/widget`.

## Svelte MCP Integration

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

### Available Svelte MCP Tools:

#### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

#### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

#### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

#### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

### Svelte Code Writing Workflow

Every time you write a Svelte component (.svelte) or a Svelte module (.svelte.ts/.svelte.js) you MUST:

1. If uncertain about syntax, use `list-sections` then `get-documentation` for relevant topics
2. Write the code
3. Run `svelte-autofixer` on the code to detect issues
4. Fix any issues and run `svelte-autofixer` again
5. Keep iterating until no issues or suggestions are returned
6. Only then finalize the code

When passing code with runes ($state, $derived, etc.) via the terminal, escape the `$` character as `\$` to prevent shell variable substitution.

## Tech Stack

- **Frontend**: Svelte 5, SvelteKit 2, Vite 5, TypeScript, Tailwind CSS
- **Backend**: Express, Socket.io, Playwright, Cheerio, Bull/Redis
- **Database**: Supabase
- **Visualization**: @xyflow/svelte, dagre
- **Deployment**: Netlify (frontend), Fly.io (crawl server)

## Conventions

### Supabase queries
- **Always use `.maybeSingle()`** instead of `.single()` for queries that may return 0 rows (cache lookups, optional settings, etc.). `.single()` throws a 406 error when no row matches.
- Only use `.single()` when querying by primary key where the row is guaranteed to exist (e.g., after an insert with `.select()`).

## Commands

- `pnpm install` - Install dependencies
- `pnpm dev:web` - Start web dev server
- `pnpm dev:server` - Start backend server
- `pnpm build` - Build all packages
- `pnpm --filter @sitemap-presenter/web check` - Type check web app
- `npx svelte-check` - Run Svelte diagnostics
