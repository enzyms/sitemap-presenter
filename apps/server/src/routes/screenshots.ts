import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, '../../screenshots');

const router: RouterType = Router();

// GET /api/screenshots/full/:filename - Serve a full-page screenshot
// NOTE: This route MUST be defined before /:filename to avoid being shadowed
router.get('/full/:filename', (req: Request, res: Response) => {
	const { filename } = req.params;

	// Sanitize filename to prevent directory traversal
	const sanitizedFilename = path.basename(filename);

	// Only allow .jpg files
	if (!sanitizedFilename.endsWith('.jpg')) {
		res.status(400).json({ error: 'Invalid file type' });
		return;
	}

	const filePath = path.join(SCREENSHOTS_DIR, sanitizedFilename);

	// Check if file exists
	if (!existsSync(filePath)) {
		res.status(404).json({ error: 'Full-page screenshot not found' });
		return;
	}

	// Set cache headers
	res.setHeader('Cache-Control', 'public, max-age=3600');
	res.setHeader('Content-Type', 'image/jpeg');

	res.sendFile(filePath);
});

// GET /api/screenshots/:filename - Serve a thumbnail screenshot
router.get('/:filename', (req: Request, res: Response) => {
	const { filename } = req.params;

	// Sanitize filename to prevent directory traversal
	const sanitizedFilename = path.basename(filename);

	// Only allow .jpg files
	if (!sanitizedFilename.endsWith('.jpg')) {
		res.status(400).json({ error: 'Invalid file type' });
		return;
	}

	const filePath = path.join(SCREENSHOTS_DIR, sanitizedFilename);

	// Check if file exists
	if (!existsSync(filePath)) {
		res.status(404).json({ error: 'Screenshot not found' });
		return;
	}

	// Set cache headers
	res.setHeader('Cache-Control', 'public, max-age=3600');
	res.setHeader('Content-Type', 'image/jpeg');

	res.sendFile(filePath);
});

export default router;
