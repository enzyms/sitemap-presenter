import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
import { CrawlerService } from '../services/crawler.js';
import { screenshotService } from '../services/screenshot.js';
import { sessionManager } from '../services/sessionManager.js';
import { wsHandler } from '../websocket/handler.js';
import type { CrawlConfig } from '../types/index.js';
import {
	loadPreviousCrawl,
	loadPreviousUrls,
	loadFeedbackPageUrls,
	hasPageChanged,
	diffCrawls
} from '../services/crawlCache.js';

const router: RouterType = Router();

// POST /api/crawl/start - Start a new crawl
router.post('/start', async (req: Request, res: Response) => {
	const config = req.body as CrawlConfig;

	// Validate config
	if (!config.url) {
		res.status(400).json({ error: 'URL is required' });
		return;
	}

	try {
		new URL(config.url);
	} catch {
		res.status(400).json({ error: 'Invalid URL format' });
		return;
	}

	const maxDepth = Math.min(Math.max(config.maxDepth || 3, 1), 5);
	const maxPages = Math.min(Math.max(config.maxPages || 50, 10), 500);

	const excludePatterns = Array.isArray(config.excludePatterns)
		? config.excludePatterns.filter((p: unknown) => typeof p === 'string' && p.length > 0)
		: [];
	const includeUrls = Array.isArray(config.includeUrls)
		? config.includeUrls.filter((u: unknown) => {
			if (typeof u !== 'string') return false;
			try { new URL(u); return true; } catch { return false; }
		})
		: [];

	// Deduplicate: join existing crawl if one is already running for this URL
	const existingSession = sessionManager.findActiveByUrl(config.url);
	if (existingSession) {
		res.json({
			sessionId: existingSession.id,
			message: 'Joined existing crawl'
		});
		return;
	}

	const session = sessionManager.createSession({
		url: config.url,
		maxDepth,
		maxPages,
		...(excludePatterns.length > 0 && { excludePatterns }),
		...(includeUrls.length > 0 && { includeUrls }),
		...(config.siteId && { siteId: config.siteId }),
		...(config.mode && { mode: config.mode }),
		...(config.crawlMode && { crawlMode: config.crawlMode })
	});

	// Return session ID immediately
	res.json({
		sessionId: session.id,
		message: 'Crawl started'
	});

	// Start crawling in background
	startCrawl(session.id).catch((error) => {
		console.error('Crawl error:', error);
		sessionManager.setStatus(session.id, 'error');
		wsHandler.emitCrawlError(session.id, {
			message: error instanceof Error ? error.message : 'Unknown error'
		});
	});
});

// GET /api/crawl/:id/status - Get crawl status
router.get('/:id/status', (req: Request, res: Response) => {
	const session = sessionManager.getSession(req.params.id);

	if (!session) {
		res.status(404).json({ error: 'Session not found' });
		return;
	}

	const progress = sessionManager.getProgress(session.id);

	res.json({
		session: {
			id: session.id,
			config: session.config,
			status: session.status,
			progress,
			startedAt: session.startedAt,
			completedAt: session.completedAt,
			errorCount: session.errors.length
		}
	});
});

// GET /api/crawl/:id/sitemap - Get full sitemap data
router.get('/:id/sitemap', (req: Request, res: Response) => {
	const session = sessionManager.getSession(req.params.id);

	if (!session) {
		res.status(404).json({ error: 'Session not found' });
		return;
	}

	const pages = sessionManager.getAllPages(session.id);

	// Build nodes and edges
	const urlToId = new Map<string, string>();
	let nodeIndex = 0;

	const nodes = pages.map((page) => {
		const id = `node-${++nodeIndex}`;
		urlToId.set(page.url, id);

		const screenshotInfo = session.screenshots.get(page.url);

		return {
			id,
			type: 'page',
			position: { x: 0, y: 0 },
			data: {
				url: page.url,
				title: page.title,
				depth: page.depth,
				thumbnailUrl: screenshotInfo?.thumbnailUrl,
				screenshotStatus: screenshotInfo ? 'ready' : 'pending',
				links: page.links,
				internalLinks: page.internalLinks,
				externalLinks: page.externalLinks
			}
		};
	});

	const edges: Array<{
		id: string;
		source: string;
		target: string;
		type: string;
		data: { sourceUrl: string; targetUrl: string };
	}> = [];

	for (const page of pages) {
		const sourceId = urlToId.get(page.url);
		if (!sourceId) continue;

		for (const link of page.internalLinks) {
			const targetId = urlToId.get(link);
			if (targetId && sourceId !== targetId) {
				const edgeId = `edge-${sourceId}-${targetId}`;
				if (!edges.some((e) => e.id === edgeId)) {
					edges.push({
						id: edgeId,
						source: sourceId,
						target: targetId,
						type: 'smoothstep',
						data: {
							sourceUrl: page.url,
							targetUrl: link
						}
					});
				}
			}
		}
	}

	res.json({ nodes, edges });
});

// DELETE /api/crawl/:id - Cancel and clean up
router.delete('/:id', (req: Request, res: Response) => {
	const session = sessionManager.getSession(req.params.id);

	if (!session) {
		res.status(404).json({ error: 'Session not found' });
		return;
	}

	sessionManager.cancelSession(session.id);
	res.json({ message: 'Crawl cancelled' });
});

// POST /api/crawl/screenshots/delete - Delete screenshots from Supabase Storage
router.post('/screenshots/delete', async (req: Request, res: Response) => {
	const { pageUrls } = req.body as { pageUrls: string[] };

	if (!Array.isArray(pageUrls) || pageUrls.length === 0) {
		res.status(400).json({ error: 'pageUrls array is required' });
		return;
	}

	try {
		const deleted = await screenshotService.deleteByUrls(pageUrls);
		res.json({ deleted });
	} catch (error) {
		console.error('Screenshot deletion failed:', error);
		res.status(500).json({ error: 'Failed to delete screenshots' });
	}
});

// Background crawl function
async function startCrawl(sessionId: string): Promise<void> {
	const session = sessionManager.getSession(sessionId);
	if (!session) return;

	const { config } = session;
	const crawlMode = config.crawlMode || 'standard';
	const isSmartMode = config.siteId && config.mode !== 'full';

	// Load previous crawl cache for smart reuse / diff detection
	const previousCache = (isSmartMode || crawlMode === 'screenshot-only') && config.siteId
		? await loadPreviousCrawl(config.siteId)
		: new Map();

	// ── Strategy 4: Screenshot-only refresh ──
	// Skip Phase 1 entirely, reuse existing sitemap, just retake all screenshots
	if (crawlMode === 'screenshot-only' && config.siteId) {
		const urls = await loadPreviousUrls(config.siteId);
		if (urls.length === 0) {
			wsHandler.emitCrawlError(sessionId, { message: 'No previous crawl data found for screenshot-only mode' });
			sessionManager.setStatus(sessionId, 'error');
			return;
		}

		// Emit cached pages as "discovered" so the client builds the sitemap
		for (const url of urls) {
			const cached = previousCache.get(url);
			if (cached) {
				const pageEvent = {
					url,
					title: cached.title,
					depth: 0,
					parentUrl: null,
					links: [],
					internalLinks: cached.internalLinks,
					externalLinks: []
				};
				sessionManager.addPage(sessionId, { ...pageEvent, statusCode: 200 });
				wsHandler.emitPageDiscovered(sessionId, pageEvent);
			}
		}

		// Jump directly to screenshots (force fresh — no smart reuse)
		sessionManager.setStatus(sessionId, 'screenshotting');
		await screenshotService.initialize({
			httpUser: config.httpUser,
			httpPassword: config.httpPassword
		});

		for (const url of urls) {
			if (sessionManager.isCancelled(sessionId)) break;

			// Delete existing screenshot first to force re-capture
			await screenshotService.deleteByUrls([url]);
			const result = await screenshotService.takeScreenshot(url);

			if (result.success) {
				sessionManager.addScreenshot(sessionId, url, result.thumbnailUrl);
				wsHandler.emitPageScreenshot(sessionId, { url, thumbnailUrl: result.thumbnailUrl });
			}

			const progress = sessionManager.getProgress(sessionId);
			wsHandler.emitCrawlProgress(sessionId, progress);
		}

		finishCrawl(sessionId, urls.length);
		return;
	}

	const crawler = new CrawlerService();
	let pages: Map<string, import('../types/index.js').PageInfo>;

	// ── Strategy 3: Feedback-only crawl ──
	// Only visit pages that have active markers/comments
	if (crawlMode === 'feedback-only' && config.siteId) {
		const feedbackUrls = await loadFeedbackPageUrls(config.siteId);
		if (feedbackUrls.length === 0) {
			wsHandler.emitCrawlError(sessionId, { message: 'No feedback pages found for this site' });
			sessionManager.setStatus(sessionId, 'error');
			return;
		}

		console.log(`Feedback-only crawl: ${feedbackUrls.length} pages with active markers`);
		pages = await crawler.crawlSpecificUrls(feedbackUrls, config, {
			onPageDiscovered: (page) => {
				sessionManager.addPage(sessionId, page);
				wsHandler.emitPageDiscovered(sessionId, {
					url: page.url,
					title: page.title,
					depth: page.depth,
					parentUrl: page.parentUrl,
					links: page.links,
					internalLinks: page.internalLinks,
					externalLinks: page.externalLinks
				});
				const progress = sessionManager.getProgress(sessionId);
				wsHandler.emitCrawlProgress(sessionId, progress);
			},
			onError: (url, error) => {
				sessionManager.addError(sessionId, `${url}: ${error}`);
				wsHandler.emitCrawlError(sessionId, { message: error, url });
			},
			shouldContinue: () => !sessionManager.isCancelled(sessionId)
		});
	} else {
		// ── Standard Phase 1: Full BFS crawl ──
		pages = await crawler.crawl(config, {
			onPageDiscovered: (page) => {
				sessionManager.addPage(sessionId, page);
				wsHandler.emitPageDiscovered(sessionId, {
					url: page.url,
					title: page.title,
					depth: page.depth,
					parentUrl: page.parentUrl,
					links: page.links,
					internalLinks: page.internalLinks,
					externalLinks: page.externalLinks
				});
				const progress = sessionManager.getProgress(sessionId);
				wsHandler.emitCrawlProgress(sessionId, progress);
			},
			onError: (url, error) => {
				sessionManager.addError(sessionId, `${url}: ${error}`);
				wsHandler.emitCrawlError(sessionId, { message: error, url });
			},
			shouldContinue: () => !sessionManager.isCancelled(sessionId)
		});
	}

	if (sessionManager.isCancelled(sessionId)) return;

	// ── Strategy 2: Diff detection ──
	if (previousCache.size > 0) {
		const currentPages = new Map<string, { title: string; internalLinks: string[] }>();
		for (const [url, page] of pages) {
			currentPages.set(url, { title: page.title, internalLinks: page.internalLinks });
		}
		const diff = diffCrawls(currentPages, previousCache);
		if (diff.newPages.length > 0 || diff.deletedPages.length > 0 || diff.modifiedPages.length > 0) {
			wsHandler.emitCrawlDiff(sessionId, diff);
		}
	}

	// ── Phase 2: Generate screenshots ──
	sessionManager.setStatus(sessionId, 'screenshotting');

	await screenshotService.initialize({
		httpUser: config.httpUser,
		httpPassword: config.httpPassword
	});

	for (const [url, page] of pages) {
		if (sessionManager.isCancelled(sessionId)) break;

		// ── Strategy 1: Smart screenshot reuse ──
		if (isSmartMode && previousCache.size > 0) {
			const cached = previousCache.get(url);
			if (cached?.thumbnailUrl && !hasPageChanged(page, cached)) {
				console.log(`Screenshot reused for unchanged page: ${url}`);
				sessionManager.addScreenshot(sessionId, url, cached.thumbnailUrl);
				wsHandler.emitPageScreenshot(sessionId, { url, thumbnailUrl: cached.thumbnailUrl });
				const progress = sessionManager.getProgress(sessionId);
				wsHandler.emitCrawlProgress(sessionId, progress);
				continue;
			}
		}

		const result = await screenshotService.takeScreenshot(url);

		if (result.success) {
			sessionManager.addScreenshot(sessionId, url, result.thumbnailUrl);
			wsHandler.emitPageScreenshot(sessionId, { url, thumbnailUrl: result.thumbnailUrl });
		}

		const progress = sessionManager.getProgress(sessionId);
		wsHandler.emitCrawlProgress(sessionId, progress);
	}

	finishCrawl(sessionId, pages.size);
}

function finishCrawl(sessionId: string, totalPages: number): void {
	if (sessionManager.isCancelled(sessionId)) return;

	sessionManager.setStatus(sessionId, 'complete');

	const updatedSession = sessionManager.getSession(sessionId);
	const duration = updatedSession?.completedAt && updatedSession?.startedAt
		? updatedSession.completedAt.getTime() - updatedSession.startedAt.getTime()
		: 0;

	wsHandler.emitCrawlComplete(sessionId, { totalPages, duration });
}

export default router;
