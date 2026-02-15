import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { sitemapStore } from '$lib/stores/sitemap.svelte';
import { projectsStore } from '$lib/stores/projects.svelte';
import { screenshotCache } from '$lib/services/screenshotCache';
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
			this.socket?.emit('join:session', sessionId);
		});

		this.socket.on('page:discovered', (data: PageDiscoveredEvent) => {
			sitemapStore.addPage(data);
			sitemapStore.layoutNodes();
		});

		this.socket.on('page:screenshot', async (data: PageScreenshotEvent) => {
			sitemapStore.updateScreenshot(data);

			// Cache screenshots to IndexedDB for offline use
			if (this.currentSiteId && data.thumbnailUrl) {
				try {
					await screenshotCache.fetchAndCache(
						data.url,
						this.currentSiteId,
						data.thumbnailUrl
					);
				} catch (error) {
					console.error('Failed to cache screenshot:', error);
				}
			}
		});

		this.socket.on('crawl:progress', (data: CrawlProgressEvent) => {
			sitemapStore.updateProgress({
				found: data.found,
				crawled: data.crawled,
				screenshotted: data.screenshotted
			});
		});

		this.socket.on('crawl:complete', (data: CrawlCompleteEvent) => {
			sitemapStore.setStatus('complete');

			// Apply URL path hierarchy to reorganize nodes/edges
			sitemapStore.applyUrlHierarchy();

			// Save to current project cache if a project is selected
			const currentProjectId = projectsStore.currentProjectId;
			if (currentProjectId) {
				const { nodes, edges } = sitemapStore.getCurrentData();
				projectsStore.cacheProjectData(currentProjectId, nodes, edges);
			}
		});

		this.socket.on('crawl:error', (data: CrawlErrorEvent) => {
			console.error('Crawl error:', data);
			sitemapStore.updateProgress({
				errors: sitemapStore.progress.errors + 1
			});
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
