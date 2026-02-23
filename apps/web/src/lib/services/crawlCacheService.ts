import { browser } from '$app/environment';
import { getSupabase } from '$lib/services/supabase';
import type { PageNode, LinkEdge } from '$lib/types';

const SITEMAP_CACHE_PREFIX = 'sitemap-cache-';
const DEBOUNCE_MS = 1000;

interface CrawlData {
	nodes: PageNode[];
	edges: LinkEdge[];
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSave: { siteId: string; data: CrawlData } | null = null;

function getLocalStorageKey(siteId: string): string {
	return `${SITEMAP_CACHE_PREFIX}${siteId}`;
}

function loadFromLocalStorage(siteId: string): CrawlData | null {
	if (!browser) return null;
	try {
		const saved = localStorage.getItem(getLocalStorageKey(siteId));
		if (saved) {
			const data = JSON.parse(saved);
			if (data.nodes && data.edges) return data;
		}
	} catch {
		// Corrupted data
	}
	return null;
}

function saveToLocalStorage(siteId: string, data: CrawlData): void {
	if (!browser) return;
	try {
		localStorage.setItem(getLocalStorageKey(siteId), JSON.stringify(data));
	} catch (e) {
		console.error('Failed to save crawl cache to localStorage:', e);
	}
}

/** Strip browser-specific fields (blob: URLs, transient state) before saving to Supabase */
function sanitizeForStorage(data: CrawlData): CrawlData {
	const nodes = data.nodes.map((node) => ({
		...node,
		data: {
			...node.data,
			// Keep server URLs (https://...), strip blob: object URLs (browser-local)
			thumbnailUrl: node.data.thumbnailUrl?.startsWith('blob:')
				? undefined
				: node.data.thumbnailUrl,
			// Keep screenshot status so we know it was ready
			screenshotStatus: node.data.screenshotStatus,
			// Strip transient feedback stats — re-fetched on load
			feedbackStats: undefined
		}
	}));
	return { nodes, edges: data.edges };
}

async function doSave(siteId: string, data: CrawlData): Promise<void> {
	try {
		const sanitized = sanitizeForStorage(data);
		const supabase = getSupabase();
		const { error } = await supabase.from('site_crawl_cache').upsert(
			{
				site_id: siteId,
				nodes: sanitized.nodes,
				edges: sanitized.edges
			},
			{ onConflict: 'site_id' }
		);

		if (error) {
			console.error('Failed to save crawl cache to Supabase:', error);
		}
	} catch (e) {
		console.error('Failed to save crawl cache to Supabase:', e);
	}
}

export const crawlCacheService = {
	/** Load crawl data. Tries Supabase first, falls back to localStorage. */
	async load(siteId: string): Promise<CrawlData | null> {
		// Try Supabase first
		try {
			const supabase = getSupabase();
			const { data, error } = await supabase
				.from('site_crawl_cache')
				.select('nodes, edges')
				.eq('site_id', siteId)
				.maybeSingle();

			if (!error && data?.nodes && data?.edges) {
				const crawlData: CrawlData = {
					nodes: data.nodes as unknown as PageNode[],
					edges: data.edges as unknown as LinkEdge[]
				};
				// Write-through to localStorage for instant loads
				saveToLocalStorage(siteId, crawlData);
				return crawlData;
			}
		} catch {
			// Fall through to localStorage
		}

		// Fall back to localStorage
		return loadFromLocalStorage(siteId);
	},

	/** Synchronous localStorage load for instant render before Supabase responds. */
	loadSync(siteId: string): CrawlData | null {
		return loadFromLocalStorage(siteId);
	},

	/** Save crawl data. Writes immediately to localStorage, debounced to Supabase. */
	save(siteId: string, data: CrawlData): void {
		// Write-through to localStorage immediately
		saveToLocalStorage(siteId, data);

		// Debounced Supabase save
		pendingSave = { siteId, data };

		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		debounceTimer = setTimeout(() => {
			if (pendingSave) {
				doSave(pendingSave.siteId, pendingSave.data);
				pendingSave = null;
			}
			debounceTimer = null;
		}, DEBOUNCE_MS);
	},

	/** Flush any pending debounced save immediately. */
	flushPendingSave(): void {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
		if (pendingSave) {
			doSave(pendingSave.siteId, pendingSave.data);
			pendingSave = null;
		}
	},

	/** Delete crawl cache for a site (localStorage + Supabase). */
	async deleteForSite(siteId: string): Promise<void> {
		if (browser) {
			try {
				localStorage.removeItem(getLocalStorageKey(siteId));
			} catch {}
		}

		try {
			const supabase = getSupabase();
			await supabase.from('site_crawl_cache').delete().eq('site_id', siteId);
		} catch (e) {
			console.error('Failed to delete crawl cache from Supabase:', e);
		}
	}
};
