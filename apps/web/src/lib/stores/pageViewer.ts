import { writable } from 'svelte/store';

function createPageViewerStore() {
	const isOpen = writable(false);
	const pageUrl = writable<string | null>(null);
	const pageTitle = writable<string>('');
	const screenshotUrl = writable<string | null>(null);
	const fullScreenshotUrl = writable<string | null>(null);

	function openViewer(
		url: string,
		title: string,
		thumbnail: string | null,
		fullScreenshot: string | null = null
	) {
		pageUrl.set(url);
		pageTitle.set(title);
		screenshotUrl.set(fullScreenshot || thumbnail);
		fullScreenshotUrl.set(fullScreenshot);
		isOpen.set(true);
	}

	function closeViewer() {
		isOpen.set(false);
	}

	return {
		isOpen,
		pageUrl,
		pageTitle,
		screenshotUrl,
		fullScreenshotUrl,
		openViewer,
		closeViewer
	};
}

export const pageViewerStore = createPageViewerStore();
