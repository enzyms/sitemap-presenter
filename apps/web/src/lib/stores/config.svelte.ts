import type { CrawlConfig } from '$lib/types';
import type { CrawlSiteSettings } from '@sitemap-presenter/shared';

const defaultConfig: CrawlConfig = {
	url: '',
	maxDepth: 1,
	maxPages: 3
};

class ConfigStore {
	url = $state(defaultConfig.url);
	maxDepth = $state(defaultConfig.maxDepth);
	maxPages = $state(defaultConfig.maxPages);
	httpUser = $state('');
	httpPassword = $state('');
	excludePatterns = $state<string[]>([]);
	includeUrls = $state<string[]>([]);
	crawlMode = $state<'standard' | 'feedback-only' | 'screenshot-only'>('feedback-only');

	setUrl(url: string) {
		this.url = url;
	}

	setMaxDepth(maxDepth: number) {
		this.maxDepth = maxDepth;
	}

	setMaxPages(maxPages: number) {
		this.maxPages = maxPages;
	}

	addExcludePattern(pattern: string) {
		if (pattern && !this.excludePatterns.includes(pattern)) {
			this.excludePatterns = [...this.excludePatterns, pattern];
		}
	}

	removeExcludePattern(index: number) {
		this.excludePatterns = this.excludePatterns.filter((_, i) => i !== index);
	}

	addIncludeUrl(url: string) {
		if (url && !this.includeUrls.includes(url)) {
			this.includeUrls = [...this.includeUrls, url];
		}
	}

	removeIncludeUrl(index: number) {
		this.includeUrls = this.includeUrls.filter((_, i) => i !== index);
	}

	/** Populate from saved site settings (called on page load). */
	loadFromSiteSettings(crawl: CrawlSiteSettings) {
		this.excludePatterns = crawl.excludePatterns ?? [];
		this.includeUrls = crawl.includeUrls ?? [];
		this.httpUser = crawl.httpUser ?? '';
		this.httpPassword = crawl.httpPassword ?? '';
	}

	reset() {
		this.url = defaultConfig.url;
		this.maxDepth = defaultConfig.maxDepth;
		this.maxPages = defaultConfig.maxPages;
		this.httpUser = '';
		this.httpPassword = '';
		this.excludePatterns = [];
		this.includeUrls = [];
		this.crawlMode = 'feedback-only';
	}

	/** Get current config as a plain object (for API calls). */
	get current(): CrawlConfig {
		const config: CrawlConfig = {
			url: this.url,
			maxDepth: this.maxDepth,
			maxPages: this.maxPages
		};
		if (this.httpUser) {
			config.httpUser = this.httpUser;
			config.httpPassword = this.httpPassword;
		}
		if (this.excludePatterns.length > 0) {
			config.excludePatterns = this.excludePatterns;
		}
		if (this.includeUrls.length > 0) {
			config.includeUrls = this.includeUrls;
		}
		if (this.crawlMode !== 'standard') {
			config.crawlMode = this.crawlMode;
		}
		return config;
	}
}

export const configStore = new ConfigStore();
