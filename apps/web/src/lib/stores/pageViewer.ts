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

	function updateCurrentPage(url: string, title: string) {
		pageUrl.set(url);
		pageTitle.set(title);
	}

	function updateScreenshot(screenshot: string | null) {
		screenshotUrl.set(screenshot);
	}

	return {
		isOpen,
		pageUrl,
		pageTitle,
		screenshotUrl,
		fullScreenshotUrl,
		openViewer,
		closeViewer,
		updateCurrentPage,
		updateScreenshot
	};
}

export const pageViewerStore = createPageViewerStore();
