import { v4 as uuidv4 } from 'uuid';
import type { CrawlSession, CrawlConfig, PageInfo } from '../types/index.js';

class SessionManager {
	private sessions = new Map<string, CrawlSession>();
	private cancelFlags = new Map<string, boolean>();

	createSession(config: CrawlConfig): CrawlSession {
		const id = uuidv4();
		const session: CrawlSession = {
			id,
			config,
			status: 'crawling',
			pages: new Map(),
			screenshots: new Map(),
			startedAt: new Date(),
			errors: []
		};

		this.sessions.set(id, session);
		this.cancelFlags.set(id, false);

		return session;
	}

	getSession(id: string): CrawlSession | undefined {
		return this.sessions.get(id);
	}

	addPage(sessionId: string, page: PageInfo): void {
		const session = this.sessions.get(sessionId);
		if (session) {
			session.pages.set(page.url, page);
		}
	}

	addScreenshot(sessionId: string, url: string, thumbnailFilename: string, fullPageFilename?: string): void {
		const session = this.sessions.get(sessionId);
		if (session) {
			session.screenshots.set(url, { thumbnailFilename, fullPageFilename });
		}
	}

	addError(sessionId: string, error: string): void {
		const session = this.sessions.get(sessionId);
		if (session) {
			session.errors.push(error);
		}
	}

	setStatus(sessionId: string, status: CrawlSession['status']): void {
		const session = this.sessions.get(sessionId);
		if (session) {
			session.status = status;
			if (status === 'complete' || status === 'error' || status === 'cancelled') {
				session.completedAt = new Date();
			}
		}
	}

	cancelSession(sessionId: string): void {
		this.cancelFlags.set(sessionId, true);
		this.setStatus(sessionId, 'cancelled');
	}

	isCancelled(sessionId: string): boolean {
		return this.cancelFlags.get(sessionId) ?? false;
	}

	deleteSession(sessionId: string): void {
		this.sessions.delete(sessionId);
		this.cancelFlags.delete(sessionId);
	}

	getProgress(sessionId: string): { found: number; crawled: number; screenshotted: number } {
		const session = this.sessions.get(sessionId);
		if (!session) {
			return { found: 0, crawled: 0, screenshotted: 0 };
		}

		return {
			found: session.pages.size,
			crawled: session.pages.size,
			screenshotted: session.screenshots.size
		};
	}

	getAllPages(sessionId: string): PageInfo[] {
		const session = this.sessions.get(sessionId);
		if (!session) return [];
		return Array.from(session.pages.values());
	}
}

export const sessionManager = new SessionManager();
