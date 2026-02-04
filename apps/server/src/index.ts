import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { wsHandler } from './websocket/handler.js';
import crawlRoutes from './routes/crawl.js';
import screenshotRoutes from './routes/screenshots.js';

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
	origin: ['http://localhost:5173', 'http://localhost:4173'],
	credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/crawl', crawlRoutes);
app.use('/api/screenshots', screenshotRoutes);

// Health check
app.get('/api/health', (req, res) => {
	res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket
wsHandler.initialize(server);

// Start server
server.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
	console.log(`WebSocket ready on ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
	console.log('SIGTERM received, shutting down...');
	server.close(() => {
		console.log('Server closed');
		process.exit(0);
	});
});

process.on('SIGINT', () => {
	console.log('SIGINT received, shutting down...');
	server.close(() => {
		console.log('Server closed');
		process.exit(0);
	});
});
