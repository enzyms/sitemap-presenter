class PageViewerStore {
	isOpen = $state(false);
	pageUrl = $state<string | null>(null);
	pageTitle = $state('');
	screenshotUrl = $state<string | null>(null);
	nodeId = $state<string | null>(null);

	openViewer(
		url: string,
		title: string,
		thumbnail: string | null,
		nodeId?: string | null
	) {
		this.pageUrl = url;
		this.pageTitle = title;
		this.screenshotUrl = thumbnail;
		this.nodeId = nodeId ?? null;
		this.isOpen = true;
	}

	closeViewer() {
		this.isOpen = false;
		this.nodeId = null;
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
