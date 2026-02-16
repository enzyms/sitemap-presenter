import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
import { CrawlerService } from '../services/crawler.js';
import { screenshotService } from '../services/screenshot.js';
import { sessionManager } from '../services/sessionManager.js';
import { wsHandler } from '../websocket/handler.js';
import type { CrawlConfig } from '../types/index.js';

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

	const session = sessionManager.createSession({
		url: config.url,
		maxDepth,
		maxPages
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

	const crawler = new CrawlerService();

	// Phase 1: Crawl pages
	const pages = await crawler.crawl(session.config, {
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

	if (sessionManager.isCancelled(sessionId)) {
		return;
	}

	// Phase 2: Generate screenshots
	sessionManager.setStatus(sessionId, 'screenshotting');

	await screenshotService.initialize({
		httpUser: session.config.httpUser,
		httpPassword: session.config.httpPassword
	});

	for (const [url] of pages) {
		if (sessionManager.isCancelled(sessionId)) {
			break;
		}

		const result = await screenshotService.takeScreenshot(url);

		if (result.success) {
			sessionManager.addScreenshot(sessionId, url, result.thumbnailUrl);

			wsHandler.emitPageScreenshot(sessionId, {
				url,
				thumbnailUrl: result.thumbnailUrl
			});
		}

		const progress = sessionManager.getProgress(sessionId);
		wsHandler.emitCrawlProgress(sessionId, progress);
	}

	// Complete
	if (!sessionManager.isCancelled(sessionId)) {
		sessionManager.setStatus(sessionId, 'complete');

		const updatedSession = sessionManager.getSession(sessionId);
		const duration = updatedSession?.completedAt && updatedSession?.startedAt
			? updatedSession.completedAt.getTime() - updatedSession.startedAt.getTime()
			: 0;

		wsHandler.emitCrawlComplete(sessionId, {
			totalPages: pages.size,
			duration
		});
	}
}

export default router;
