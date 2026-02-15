import type { CrawlConfig } from '$lib/types';

const defaultConfig: CrawlConfig = {
	url: '',
	maxDepth: 1,
	maxPages: 3
};

class ConfigStore {
	url = $state(defaultConfig.url);
	maxDepth = $state(defaultConfig.maxDepth);
	maxPages = $state(defaultConfig.maxPages);

	setUrl(url: string) {
		this.url = url;
	}

	setMaxDepth(maxDepth: number) {
		this.maxDepth = maxDepth;
	}

	setMaxPages(maxPages: number) {
		this.maxPages = maxPages;
	}

	reset() {
		this.url = defaultConfig.url;
		this.maxDepth = defaultConfig.maxDepth;
		this.maxPages = defaultConfig.maxPages;
	}

	/** Get current config as a plain object (for API calls). */
	get current(): CrawlConfig {
		return {
			url: this.url,
			maxDepth: this.maxDepth,
			maxPages: this.maxPages
		};
	}
}

export const configStore = new ConfigStore();
