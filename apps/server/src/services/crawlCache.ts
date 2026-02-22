import { getSupabaseAdmin } from './supabaseClient.js';

interface CachedPage {
	title: string;
	internalLinks: string[];
	thumbnailUrl?: string;
}

export interface CrawlDiff {
	newPages: string[];
	deletedPages: string[];
	modifiedPages: string[];
}

/**
 * Load the previous crawl's node data from `site_crawl_cache`.
 * Returns a Map<url, CachedPage> for quick lookups.
 */
export async function loadPreviousCrawl(siteId: string): Promise<Map<string, CachedPage>> {
	const cache = new Map<string, CachedPage>();

	try {
		const supabase = getSupabaseAdmin();
		const { data, error } = await supabase
			.from('site_crawl_cache')
			.select('nodes')
			.eq('site_id', siteId)
			.single();

		if (error || !data?.nodes) return cache;

		const nodes = data.nodes as Array<{
			data: {
				url: string;
				title: string;
				internalLinks: string[];
				thumbnailUrl?: string;
			};
		}>;

		for (const node of nodes) {
			cache.set(node.data.url, {
				title: node.data.title,
				internalLinks: node.data.internalLinks ?? [],
				thumbnailUrl: node.data.thumbnailUrl
			});
		}
	} catch (err) {
		console.error('Failed to load previous crawl cache:', err);
	}

	return cache;
}

/**
 * Compare a current page against its previous version.
 * Returns true if title or internal links changed.
 */
export function hasPageChanged(
	current: { title: string; internalLinks: string[] },
	previous: CachedPage
): boolean {
	if (current.title !== previous.title) return true;

	const currentLinks = [...current.internalLinks].sort();
	const previousLinks = [...previous.internalLinks].sort();

	if (currentLinks.length !== previousLinks.length) return true;

	for (let i = 0; i < currentLinks.length; i++) {
		if (currentLinks[i] !== previousLinks[i]) return true;
	}

	return false;
}

/**
 * Diff current crawl URLs against previous cache.
 */
export function diffCrawls(
	currentUrls: Map<string, { title: string; internalLinks: string[] }>,
	previousCache: Map<string, CachedPage>
): CrawlDiff {
	const newPages: string[] = [];
	const modifiedPages: string[] = [];
	const deletedPages: string[] = [];

	for (const [url, current] of currentUrls) {
		const previous = previousCache.get(url);
		if (!previous) {
			newPages.push(url);
		} else if (hasPageChanged(current, previous)) {
			modifiedPages.push(url);
		}
	}

	for (const url of previousCache.keys()) {
		if (!currentUrls.has(url)) {
			deletedPages.push(url);
		}
	}

	return { newPages, deletedPages, modifiedPages };
}

/**
 * Load just the page URLs from a previous crawl cache (for screenshot-only mode).
 */
export async function loadPreviousUrls(siteId: string): Promise<string[]> {
	try {
		const supabase = getSupabaseAdmin();
		const { data, error } = await supabase
			.from('site_crawl_cache')
			.select('nodes')
			.eq('site_id', siteId)
			.single();

		if (error || !data?.nodes) return [];

		const nodes = data.nodes as Array<{ data: { url: string } }>;
		return nodes.map((n) => n.data.url);
	} catch {
		return [];
	}
}

/**
 * Load feedback page URLs from the `markers` table for feedback-only crawl.
 */
export async function loadFeedbackPageUrls(siteId: string): Promise<string[]> {
	try {
		const supabase = getSupabaseAdmin();
		const { data, error } = await supabase
			.from('markers')
			.select('page_url')
			.eq('site_id', siteId)
			.in('status', ['open', 'resolved']);

		if (error || !data) return [];

		// Deduplicate
		const urls = new Set(data.map((row: { page_url: string }) => row.page_url));
		return [...urls];
	} catch {
		return [];
	}
}
