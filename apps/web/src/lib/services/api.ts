import type { CrawlConfig, StartCrawlResponse, CrawlStatusResponse, SitemapResponse } from '$lib/types';

const API_BASE = '/api';

async function parseErrorResponse(response: Response, fallback: string): Promise<never> {
	try {
		const error = await response.json();
		throw new Error(error.message || error.error || fallback);
	} catch (e) {
		if (e instanceof Error && e.message !== fallback) throw e;
		throw new Error(`${fallback} (${response.status})`);
	}
}

class ApiService {
	async startCrawl(config: CrawlConfig): Promise<StartCrawlResponse> {
		const response = await fetch(`${API_BASE}/crawl/start`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(config)
		});

		if (!response.ok) {
			await parseErrorResponse(response, 'Failed to start crawl');
		}

		return response.json();
	}

	async getCrawlStatus(sessionId: string): Promise<CrawlStatusResponse> {
		const response = await fetch(`${API_BASE}/crawl/${sessionId}/status`);

		if (!response.ok) {
			await parseErrorResponse(response, 'Failed to get crawl status');
		}

		return response.json();
	}

	async getSitemap(sessionId: string): Promise<SitemapResponse> {
		const response = await fetch(`${API_BASE}/crawl/${sessionId}/sitemap`);

		if (!response.ok) {
			await parseErrorResponse(response, 'Failed to get sitemap');
		}

		return response.json();
	}

	async cancelCrawl(sessionId: string): Promise<void> {
		const response = await fetch(`${API_BASE}/crawl/${sessionId}`, {
			method: 'DELETE'
		});

		if (!response.ok) {
			await parseErrorResponse(response, 'Failed to cancel crawl');
		}
	}

	getScreenshotUrl(hash: string): string {
		return `${API_BASE}/screenshots/${hash}`;
	}
}

export const apiService = new ApiService();
