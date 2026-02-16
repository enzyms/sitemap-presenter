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
	httpUser = $state('');
	httpPassword = $state('');

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
		this.httpUser = '';
		this.httpPassword = '';
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
		return config;
	}
}

export const configStore = new ConfigStore();
