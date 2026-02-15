class PageViewerStore {
	isOpen = $state(false);
	pageUrl = $state<string | null>(null);
	pageTitle = $state('');
	screenshotUrl = $state<string | null>(null);
	fullScreenshotUrl = $state<string | null>(null);

	openViewer(
		url: string,
		title: string,
		thumbnail: string | null,
		fullScreenshot: string | null = null
	) {
		this.pageUrl = url;
		this.pageTitle = title;
		this.screenshotUrl = fullScreenshot || thumbnail;
		this.fullScreenshotUrl = fullScreenshot;
		this.isOpen = true;
	}

	closeViewer() {
		this.isOpen = false;
	}

	updateCurrentPage(url: string, title: string) {
		this.pageUrl = url;
		this.pageTitle = title;
	}

	updateScreenshot(screenshot: string | null) {
		this.screenshotUrl = screenshot;
	}
}

export const pageViewerStore = new PageViewerStore();
