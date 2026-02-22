export interface CrawlConfig {
	url: string;
	maxDepth: number;
	maxPages: number;
	httpUser?: string;
	httpPassword?: string;
	excludePatterns?: string[];
	includeUrls?: string[];
	siteId?: string;
	mode?: 'full' | 'smart';
	crawlMode?: 'standard' | 'feedback-only' | 'screenshot-only';
}

export interface PageInfo {
	url: string;
	title: string;
	depth: number;
	parentUrl: string | null;
	links: string[];
	internalLinks: string[];
	externalLinks: string[];
	statusCode?: number;
	error?: string;
}

export interface ScreenshotInfo {
	thumbnailUrl: string;
}

export interface CrawlSession {
	id: string;
	config: CrawlConfig;
	status: 'crawling' | 'screenshotting' | 'complete' | 'error' | 'cancelled';
	pages: Map<string, PageInfo>;
	screenshots: Map<string, ScreenshotInfo>; // url -> screenshot info
	startedAt: Date;
	completedAt?: Date;
	errors: string[];
}

export interface CrawlProgress {
	found: number;
	crawled: number;
	screenshotted: number;
}

// WebSocket events
export interface PageDiscoveredEvent {
	url: string;
	title: string;
	depth: number;
	parentUrl: string | null;
	links: string[];
	internalLinks: string[];
	externalLinks: string[];
}

export interface PageScreenshotEvent {
	url: string;
	thumbnailUrl: string;
}

export interface CrawlProgressEvent {
	found: number;
	crawled: number;
	screenshotted: number;
}

export interface CrawlCompleteEvent {
	totalPages: number;
	duration: number;
}

export interface CrawlDiffEvent {
	newPages: string[];
	deletedPages: string[];
	modifiedPages: string[];
}

export interface CrawlErrorEvent {
	message: string;
	url?: string;
}
