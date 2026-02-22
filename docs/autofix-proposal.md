# Autofix: From Feedback Marker to Pull Request

> **Status**: Proposal (not yet implemented)
> **Author**: Sylvain
> **Date**: February 2026

## The idea

When a team member spots a bug via the feedback widget, they currently have two options: report it to YouTrack, or fix it manually. **Autofix** adds a third path: click a button, and an AI agent reads the feedback, understands the codebase, and opens a pull request with a proposed fix.

The fix still goes through normal code review. No code lands without human approval.

## How it works

```
Feedback marker (widget)
        |
        v
User clicks "Autofix" --> describes what to fix
        |
        v
App creates a Git issue (labeled "autofix")
with full marker context (page, element, comments)
        |
        v
CI pipeline triggers on the label
        |
        v
Claude Code runs against the repo,
reads the issue, fixes the code
        |
        v
Pull request created automatically
        |
        v
Marker linked to the issue (like YouTrack today)
        |
        v
Team reviews & merges as usual
```

## Why this approach

**Why a Git issue + CI, not a direct API call?**

- Claude Code in CI has **full repo context** -- it knows the project structure, files, dependencies, and patterns. A standalone API call would need all of that fed manually.
- Fits existing team workflow: issues are tracked, PRs are reviewed, nothing bypasses the process.
- Works for feedback from any environment (local, staging, production) since the code lives in the same repo.
- Mirrors the YouTrack integration pattern we already have (create external item, link back to marker).

## What gets sent to the issue

The issue body includes everything the AI needs to understand the problem:

| Data | Source |
|------|--------|
| Page URL and path | Marker metadata |
| Element CSS selector and XPath | Element anchor |
| Element tag name and inner text | Element anchor |
| User's fix description | Autofix modal textarea |
| All comments on the marker | Comment thread |
| Viewport dimensions and device info | Viewport metadata |
| Environment (local/staging/prod) | Page URL domain |

The marker's screenshot flag is also included. Since the page URL is known, the CI agent can visit it if needed.

## Provider-agnostic design

The architecture abstracts the Git provider so we can start with GitHub and add GitLab later without rewriting.

### Concept mapping

| Concept | GitHub | GitLab |
|---------|--------|--------|
| Issue tracker | GitHub Issues | GitLab Issues |
| CI automation | GitHub Actions | GitLab CI |
| Code review | Pull Requests | Merge Requests |
| AI agent action | `anthropics/claude-code-action` | Custom CI job with `claude` CLI |
| Trigger | Issue labeled `autofix` | Issue labeled `autofix` |
| Auth | Personal Access Token | Project Access Token |

### Provider configuration

Each site stores its Git provider config in `settings`:

```typescript
// Generic provider config
interface GitProviderConfig {
  provider: 'github' | 'gitlab';
  owner: string;      // org or user (GitHub) / namespace (GitLab)
  repo: string;       // repository name
  token: string;      // PAT with issues + PR/MR scope
  projectId?: string; // GitLab only (numeric project ID)
}
```

The API route for creating issues would use a provider adapter:

```typescript
// Pseudocode -- provider adapter pattern
interface GitProvider {
  createIssue(title: string, body: string, labels: string[]): Promise<{ id: string; url: string }>;
}

function getProvider(config: GitProviderConfig): GitProvider {
  switch (config.provider) {
    case 'github': return new GitHubProvider(config);
    case 'gitlab': return new GitLabProvider(config);
  }
}
```

Adding a new provider means implementing one adapter -- the UI, API route, and marker linking stay the same.

## GitHub implementation (first target)

### CI workflow

```yaml
# .github/workflows/autofix.yml
name: Autofix with Claude

on:
  issues:
    types: [labeled]

jobs:
  autofix:
    if: github.event.label.name == 'autofix'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: write
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          direct_prompt: |
            Read the issue below and fix the problem described.
            Create a PR with the fix.

            ${{ github.event.issue.body }}
```

### Required GitHub setup

1. **Repository secret**: `ANTHROPIC_API_KEY` (from console.anthropic.com)
2. **PAT scope**: `repo` (issues + pull requests)
3. The PAT is stored in the site's settings (encrypted in Supabase) and used by the app to create issues via GitHub API.

### Estimated cost per fix

Claude API pricing (not covered by Pro/Max subscription):

| Model | Input | Output | Typical fix cost |
|-------|-------|--------|-----------------|
| Sonnet | ~$3/M tokens | ~$15/M tokens | $0.05 - $0.30 |
| Opus | ~$15/M tokens | ~$75/M tokens | $0.20 - $1.50 |

A typical autofix run uses ~10-50K input tokens and ~5-20K output tokens. Most fixes should cost under $0.50 with Sonnet.

## What changes in the codebase

### Database

```sql
ALTER TABLE markers ADD COLUMN git_issue_id text;
-- Generic column name (not github_ or gitlab_) for provider-agnostic design
```

### Files to create or modify

| File | Change |
|------|--------|
| `packages/shared/src/index.ts` | Add `GitProviderConfig` type, `git` field on `SiteSettings` |
| `apps/web/src/routes/autofix/+server.ts` | New API route (POST: create issue, link marker) |
| `apps/web/src/lib/components/ui/AutofixModal.svelte` | Richer default description with full marker context |
| `apps/web/src/lib/components/viewer/FeedbackSidebar.svelte` | Wire up `handleSendToAutofix()` to call API |
| `apps/web/src/lib/components/ui/MarkerListItem.svelte` | Show Git issue badge (like YouTrack badge) |
| `apps/web/src/routes/sites/[id]/settings/+page.svelte` | Git provider settings UI (owner, repo, token) |
| `.github/workflows/autofix.yml` | Claude Code CI workflow |
| Supabase migration | Add `git_issue_id` column |

### What stays the same

- **YouTrack integration** -- untouched, both coexist
- **Widget code** -- no changes needed
- **Marker schema** -- additive only (new column)
- **Crawl server** -- not involved

## GitLab adaptation (later)

When we move to GitLab:

1. Add `GitLabProvider` adapter (uses GitLab API v4 for issue creation)
2. Add `.gitlab-ci.yml` job triggered by issue label (or webhook)
3. Install `claude` CLI in CI runner (no official GitLab action yet, but the CLI works anywhere)
4. Settings UI already supports provider selection -- just enable the GitLab option

The CI trigger mechanism differs (GitLab doesn't natively trigger pipelines from issue labels), so we'd likely use a **webhook** that calls a GitLab pipeline via API, or a scheduled pipeline that polls for new `autofix`-labeled issues.

## Open questions

1. **Branch naming**: Should the PR branch be `autofix/marker-{number}` or `autofix/{issue-id}`?
2. **Base branch**: Always target `main`, or detect the relevant feature branch from the environment URL?
3. **Failure handling**: If Claude can't fix it, should it comment on the issue explaining why, or just leave it open?
4. **Rate limiting**: Should we limit autofix requests per site/day to control costs?
5. **Screenshot inclusion**: The page URL is available, but should we also attach a screenshot to the issue body for visual context?
6. **Multi-repo**: Some teams deploy frontend and backend from different repos. Do we need to support selecting which repo to target?

## Next steps

1. Team reviews this proposal and discusses open questions
2. Set up a GitHub repo for testing (or use an existing personal project)
3. Implement the GitHub flow end-to-end
4. Test with real feedback markers on staging
5. Once validated, plan the GitLab adaptation
