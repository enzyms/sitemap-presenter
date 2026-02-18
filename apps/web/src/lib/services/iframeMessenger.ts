import type { SitemapToIframeMessage, IframeToSitemapMessage, MarkerStatus } from '$lib/types';

/**
 * Handles postMessage communication with the page viewer iframe.
 * Sends typed commands and dispatches incoming messages via a callback.
 */
export class IframeMessenger {
	private iframe: HTMLIFrameElement | null = null;
	private targetOrigin: string = '';
	private messageHandler: ((event: MessageEvent) => void) | null = null;

	setIframe(iframe: HTMLIFrameElement | null): void {
		this.iframe = iframe;
	}

	setTargetUrl(url: string): void {
		try {
			this.targetOrigin = new URL(url).origin;
		} catch {
			this.targetOrigin = '';
		}
	}

	private send(message: SitemapToIframeMessage): void {
		if (!this.iframe?.contentWindow || !this.targetOrigin) return;
		try {
			this.iframe.contentWindow.postMessage(message, this.targetOrigin);
		} catch (e) {
			console.error('Failed to send message to iframe:', e);
		}
	}

	getMarkers(): void {
		this.send({ type: 'FEEDBACK_GET_MARKERS' });
	}

	updateStatus(markerId: string, status: MarkerStatus): void {
		this.send({ type: 'FEEDBACK_UPDATE_STATUS', markerId, status });
	}

	addComment(markerId: string, content: string): void {
		this.send({ type: 'FEEDBACK_ADD_COMMENT', markerId, content });
	}

	deleteMarker(markerId: string): void {
		this.send({ type: 'FEEDBACK_DELETE_MARKER', markerId });
	}

	highlightMarker(markerId: string | null): void {
		this.send({ type: 'FEEDBACK_HIGHLIGHT_MARKER', markerId });
	}

	filterByStatus(status: 'all' | 'active' | MarkerStatus): void {
		this.send({ type: 'FEEDBACK_STATUS_FILTER', status });
	}

	/**
	 * Starts listening for messages from the iframe.
	 * Returns a cleanup function to stop listening.
	 */
	listen(callback: (data: IframeToSitemapMessage) => void): () => void {
		this.messageHandler = (event: MessageEvent) => {
			const data = event.data as IframeToSitemapMessage | undefined;
			if (!data?.type?.startsWith('FEEDBACK_')) return;
			callback(data);
		};
		window.addEventListener('message', this.messageHandler);
		return () => this.destroy();
	}

	destroy(): void {
		if (this.messageHandler) {
			window.removeEventListener('message', this.messageHandler);
			this.messageHandler = null;
		}
		this.iframe = null;
		this.targetOrigin = '';
	}
}
