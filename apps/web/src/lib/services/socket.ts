import { io, Socket } from 'socket.io-client';
import { sitemapStore } from '$lib/stores/sitemap';
import { projectsStore } from '$lib/stores/projects';
import { screenshotCache } from '$lib/services/screenshotCache';
import { get } from 'svelte/store';
import type {
	PageDiscoveredEvent,
	PageScreenshotEvent,
	CrawlProgressEvent,
	CrawlCompleteEvent,
	CrawlErrorEvent
} from '$lib/types';

class SocketService {
	private socket: Socket | null = null;
	private sessionId: string | null = null;
	private currentSiteId: string | null = null;

	connect(sessionId: string, siteId?: string): void {
		this.currentSiteId = siteId || null;
		if (this.socket?.connected) {
			this.disconnect();
		}

		this.sessionId = sessionId;
		this.socket = io({
			path: '/socket.io',
			transports: ['websocket', 'polling']
		});

		this.socket.on('connect', () => {
			console.log('WebSocket connected');
			this.socket?.emit('join:session', sessionId);
		});

		this.socket.on('disconnect', () => {
			console.log('WebSocket disconnected');
		});

		this.socket.on('page:discovered', (data: PageDiscoveredEvent) => {
			console.log('Page discovered:', data.url);
			sitemapStore.addPage(data);
			// Trigger layout update after each new page
			sitemapStore.layoutNodes();
		});

		this.socket.on('page:screenshot', async (data: PageScreenshotEvent) => {
			console.log('Screenshot ready:', data.url);
			sitemapStore.updateScreenshot(data);

			// Cache screenshots to IndexedDB for offline use
			if (this.currentSiteId && data.thumbnailUrl) {
				try {
					await screenshotCache.fetchAndCache(
						data.url,
						this.currentSiteId,
						data.thumbnailUrl,
						data.fullScreenshotUrl
					);
					console.log('Screenshot cached:', data.url);
				} catch (error) {
					console.error('Failed to cache screenshot:', error);
				}
			}
		});

		this.socket.on('crawl:progress', (data: CrawlProgressEvent) => {
			sitemapStore.progress.update((p) => ({
				...p,
				found: data.found,
				crawled: data.crawled,
				screenshotted: data.screenshotted
			}));
		});

		this.socket.on('crawl:complete', (data: CrawlCompleteEvent) => {
			console.log('Crawl complete:', data);
			sitemapStore.setStatus('complete');

			// Apply URL path hierarchy to reorganize nodes/edges
			sitemapStore.applyUrlHierarchy();
			console.log('Applied URL hierarchy');

			// Save to current project cache if a project is selected
			const currentProjectId = get(projectsStore.currentProjectId);
			if (currentProjectId) {
				const { nodes, edges } = sitemapStore.getCurrentData();
				projectsStore.cacheProjectData(currentProjectId, nodes, edges);
				console.log('Saved crawl data to project cache:', currentProjectId);
			}
		});

		this.socket.on('crawl:error', (data: CrawlErrorEvent) => {
			console.error('Crawl error:', data);
			sitemapStore.progress.update((p) => ({
				...p,
				errors: p.errors + 1
			}));
		});
	}

	disconnect(): void {
		if (this.socket) {
			this.socket.disconnect();
			this.socket = null;
			this.sessionId = null;
		}
	}

	isConnected(): boolean {
		return this.socket?.connected ?? false;
	}
}

export const socketService = new SocketService();
