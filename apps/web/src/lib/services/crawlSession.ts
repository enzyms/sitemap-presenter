/**
 * Persists the active crawl sessionId per site in localStorage
 * so the frontend can reconnect after a page reload.
 *
 * Key pattern: `crawl-session-{siteId}`
 */

const PREFIX = 'crawl-session-';

function keyFor(siteId: string): string {
	return `${PREFIX}${siteId}`;
}

export const crawlSessionService = {
	save(siteId: string, sessionId: string): void {
		try {
			localStorage.setItem(keyFor(siteId), sessionId);
		} catch {
			// localStorage full or unavailable — ignore
		}
	},

	load(siteId: string): string | null {
		try {
			return localStorage.getItem(keyFor(siteId));
		} catch {
			return null;
		}
	},

	clear(siteId: string): void {
		try {
			localStorage.removeItem(keyFor(siteId));
		} catch {
			// ignore
		}
	}
};
