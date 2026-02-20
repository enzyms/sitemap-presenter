import { chromium, Browser, BrowserContext, Page } from 'playwright';
import type { PageInfo, CrawlConfig } from '../types/index.js';

interface CrawlCallbacks {
	onPageDiscovered: (page: PageInfo) => void;
	onError: (url: string, error: string) => void;
	shouldContinue: () => boolean;
}

/** Convert a glob path pattern (e.g. `/blog/*`) to a RegExp. */
function matchPattern(pathname: string, pattern: string): boolean {
	// Escape regex special chars except *, then convert * to .*
	const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
	return new RegExp(`^${escaped}$`).test(pathname);
}

export class CrawlerService {
	private visited = new Set<string>();
	private baseUrl: URL | null = null;
	private browser: Browser | null = null;
	private browserContext: BrowserContext | null = null;

	async crawl(
		config: CrawlConfig,
		callbacks: CrawlCallbacks
	): Promise<Map<string, PageInfo>> {
		const pages = new Map<string, PageInfo>();

		try {
			this.baseUrl = new URL(config.url);
		} catch {
			callbacks.onError(config.url, 'Invalid URL');
			return pages;
		}

		// Initialize browser for SPA support
		this.browser = await chromium.launch({
			headless: true,
			args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
		});

		// Create a context with HTTP Basic Auth and SSL tolerance
		const contextOptions: {
			ignoreHTTPSErrors: boolean;
			httpCredentials?: { username: string; password: string };
		} = { ignoreHTTPSErrors: true };

		if (config.httpUser) {
			contextOptions.httpCredentials = {
				username: config.httpUser,
				password: config.httpPassword || ''
			};
		}

		this.browserContext = await this.browser.newContext(contextOptions);

		const queue: Array<{ url: string; depth: number; parentUrl: string | null }> = [
			{ url: this.normalizeUrl(config.url), depth: 0, parentUrl: null }
		];

		// Seed additional include URLs at depth 0
		if (config.includeUrls) {
			for (const includeUrl of config.includeUrls) {
				const normalized = this.normalizeUrl(includeUrl);
				if (!queue.some((q) => q.url === normalized)) {
					queue.push({ url: normalized, depth: 0, parentUrl: null });
				}
			}
		}

		try {
			while (queue.length > 0 && pages.size < config.maxPages) {
				if (!callbacks.shouldContinue()) {
					break;
				}

				const item = queue.shift();
				if (!item) break;

				const { url, depth, parentUrl } = item;

				if (this.visited.has(url) || depth > config.maxDepth) {
					continue;
				}

				this.visited.add(url);

				try {
					const pageInfo = await this.fetchAndParse(url, depth, parentUrl);

					if (pageInfo) {
						pages.set(url, pageInfo);
						callbacks.onPageDiscovered(pageInfo);

						// Check if this page's path matches an exclude pattern
						// If so, skip enqueuing its children
						const currentPathname = new URL(url).pathname;
						const isExcluded =
							config.excludePatterns?.some((p) => matchPattern(currentPathname, p)) ?? false;

						if (!isExcluded) {
							// Add internal links to queue
							for (const link of pageInfo.internalLinks) {
								if (!this.visited.has(link) && depth + 1 <= config.maxDepth) {
									queue.push({ url: link, depth: depth + 1, parentUrl: url });
								}
							}
						}
					}

					// Small delay to be respectful to servers
					await this.delay(300);
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : 'Unknown error';
					callbacks.onError(url, errorMessage);
				}
			}
		} finally {
			await this.closeBrowser();
		}

		return pages;
	}

	private async fetchAndParse(url: string, depth: number, parentUrl: string | null): Promise<PageInfo | null> {
		if (!this.browserContext) {
			throw new Error('Browser context not initialized');
		}

		let page: Page | null = null;

		try {
			page = await this.browserContext.newPage();

			// Set a reasonable viewport
			await page.setViewportSize({ width: 1280, height: 800 });

			// Navigate with a timeout
			const response = await page.goto(url, {
				waitUntil: 'networkidle',
				timeout: 15000
			});

			const statusCode = response?.status() ?? 0;

			// For SPAs, a 200 on the base URL but 404 content might still be valid
			// Check if we got a real page or an error page
			if (statusCode >= 400 && statusCode < 600) {
				// Try to detect if this is an SPA that handles the route client-side
				const bodyText = await page.textContent('body') || '';
				const hasContent = bodyText.trim().length > 100;

				if (!hasContent) {
					console.log(`Skipping ${url} - HTTP ${statusCode}`);
					return null;
				}
			}

			// Wait a bit for any lazy-loaded content
			await page.waitForTimeout(500);

			// Extract title
			const title = await page.title() || url;

			// Extract all links from the rendered DOM using Playwright's locators
			const currentUrl = page.url();
			const baseHost = this.baseUrl!.host;

			const links: string[] = [];
			const internalLinks: string[] = [];
			const externalLinks: string[] = [];

			const anchors = await page.locator('a[href]').all();

			for (const anchor of anchors) {
				const href = await anchor.getAttribute('href');
				if (!href) continue;

				// Skip non-navigable links
				if (
					href.startsWith('javascript:') ||
					href.startsWith('mailto:') ||
					href.startsWith('tel:') ||
					href.startsWith('#') ||
					href.startsWith('data:')
				) {
					continue;
				}

				try {
					const resolved = new URL(href, currentUrl);
					if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
						continue;
					}

					const fullUrl = resolved.href;
					links.push(fullUrl);

					// Check if internal
					if (resolved.host === baseHost) {
						// Keep URL as-is, only remove hash for deduplication
						const normalized = `${resolved.protocol}//${resolved.host}${resolved.pathname}`;
						if (!internalLinks.includes(normalized)) {
							internalLinks.push(normalized);
						}
					} else {
						if (!externalLinks.includes(fullUrl)) {
							externalLinks.push(fullUrl);
						}
					}
				} catch {
					// Invalid URL, skip
				}
			}

			const linkData = { links, internalLinks, externalLinks };

			return {
				url,
				title,
				depth,
				parentUrl,
				links: linkData.links,
				internalLinks: linkData.internalLinks,
				externalLinks: linkData.externalLinks,
				statusCode
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			// Don't throw for timeout errors on sub-pages, just skip them
			if (message.includes('timeout') && depth > 0) {
				console.log(`Timeout on ${url}, skipping`);
				return null;
			}
			throw error;
		} finally {
			if (page) {
				await page.close().catch(() => {});
			}
		}
	}

	private normalizeUrl(url: string): string {
		try {
			const parsed = new URL(url);
			// Keep URL as-is, only remove hash and search params for deduplication
			return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
		} catch {
			return url;
		}
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private async closeBrowser(): Promise<void> {
		if (this.browserContext) {
			await this.browserContext.close().catch(() => {});
			this.browserContext = null;
		}
		if (this.browser) {
			await this.browser.close().catch(() => {});
			this.browser = null;
		}
	}

	reset(): void {
		this.visited.clear();
		this.baseUrl = null;
	}
}

export const crawlerService = new CrawlerService();
