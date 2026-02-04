import { writable } from 'svelte/store';
import type { CrawlConfig } from '$lib/types';

const defaultConfig: CrawlConfig = {
	url: '',
	maxDepth: 1,
	maxPages: 3
};

function createConfigStore() {
	const { subscribe, set, update } = writable<CrawlConfig>(defaultConfig);

	return {
		subscribe,
		setUrl: (url: string) => update((config) => ({ ...config, url })),
		setMaxDepth: (maxDepth: number) => update((config) => ({ ...config, maxDepth })),
		setMaxPages: (maxPages: number) => update((config) => ({ ...config, maxPages })),
		reset: () => set(defaultConfig)
	};
}

export const configStore = createConfigStore();
