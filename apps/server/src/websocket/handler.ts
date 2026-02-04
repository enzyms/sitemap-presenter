import { Server as SocketServer, Socket } from 'socket.io';
import type { Server } from 'http';
import type {
	PageDiscoveredEvent,
	PageScreenshotEvent,
	CrawlProgressEvent,
	CrawlCompleteEvent,
	CrawlErrorEvent
} from '../types/index.js';

class WebSocketHandler {
	private io: SocketServer | null = null;
	private sessionRooms = new Map<string, Set<string>>(); // sessionId -> Set of socket IDs

	initialize(server: Server): void {
		this.io = new SocketServer(server, {
			cors: {
				origin: ['http://localhost:5173', 'http://localhost:4173'],
				methods: ['GET', 'POST']
			}
		});

		this.io.on('connection', (socket: Socket) => {
			console.log(`Client connected: ${socket.id}`);

			socket.on('join:session', (sessionId: string) => {
				socket.join(sessionId);

				// Track socket in session room
				if (!this.sessionRooms.has(sessionId)) {
					this.sessionRooms.set(sessionId, new Set());
				}
				this.sessionRooms.get(sessionId)!.add(socket.id);

				console.log(`Socket ${socket.id} joined session ${sessionId}`);
			});

			socket.on('leave:session', (sessionId: string) => {
				socket.leave(sessionId);

				// Remove socket from session room tracking
				const room = this.sessionRooms.get(sessionId);
				if (room) {
					room.delete(socket.id);
					if (room.size === 0) {
						this.sessionRooms.delete(sessionId);
					}
				}

				console.log(`Socket ${socket.id} left session ${sessionId}`);
			});

			socket.on('disconnect', () => {
				console.log(`Client disconnected: ${socket.id}`);

				// Clean up socket from all session rooms
				for (const [sessionId, sockets] of this.sessionRooms) {
					if (sockets.has(socket.id)) {
						sockets.delete(socket.id);
						if (sockets.size === 0) {
							this.sessionRooms.delete(sessionId);
						}
					}
				}
			});
		});
	}

	emitPageDiscovered(sessionId: string, event: PageDiscoveredEvent): void {
		this.io?.to(sessionId).emit('page:discovered', event);
	}

	emitPageScreenshot(sessionId: string, event: PageScreenshotEvent): void {
		this.io?.to(sessionId).emit('page:screenshot', event);
	}

	emitCrawlProgress(sessionId: string, event: CrawlProgressEvent): void {
		this.io?.to(sessionId).emit('crawl:progress', event);
	}

	emitCrawlComplete(sessionId: string, event: CrawlCompleteEvent): void {
		this.io?.to(sessionId).emit('crawl:complete', event);
	}

	emitCrawlError(sessionId: string, event: CrawlErrorEvent): void {
		this.io?.to(sessionId).emit('crawl:error', event);
	}

	hasActiveClients(sessionId: string): boolean {
		const room = this.sessionRooms.get(sessionId);
		return room ? room.size > 0 : false;
	}
}

export const wsHandler = new WebSocketHandler();
