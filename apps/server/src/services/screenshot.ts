import { chromium, Browser, Page } from 'playwright';
import sharp from 'sharp';
import { createHash } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.join(__dirname, '../../screenshots');

interface ScreenshotResult {
	url: string;
	filename: string;
	thumbnailPath: string;
	fullPageFilename?: string;
	fullPagePath?: string;
	success: boolean;
	error?: string;
}

export class ScreenshotService {
	private browser: Browser | null = null;
	private isInitialized = false;

	async initialize(): Promise<void> {
		if (this.isInitialized) return;

		// Ensure screenshots directory exists
		if (!existsSync(SCREENSHOTS_DIR)) {
			await mkdir(SCREENSHOTS_DIR, { recursive: true });
		}

		this.browser = await chromium.launch({
			headless: true,
			args: ['--no-sandbox', '--disable-setuid-sandbox']
		});

		this.isInitialized = true;
	}

	async takeScreenshot(url: string): Promise<ScreenshotResult> {
		if (!this.browser) {
			await this.initialize();
		}

		const hash = this.generateHash(url);
		const filename = `${hash}.jpg`;
		const fullPageFilename = `${hash}_full.jpg`;
		const thumbnailPath = path.join(SCREENSHOTS_DIR, filename);
		const fullPagePath = path.join(SCREENSHOTS_DIR, fullPageFilename);

		// Check if screenshots already exist (cache hit)
		if (existsSync(thumbnailPath) && existsSync(fullPagePath)) {
			console.log(`Screenshot cache hit for ${url}`);
			return { url, filename, thumbnailPath, fullPageFilename, fullPagePath, success: true };
		}

		let page: Page | null = null;

		try {
			page = await this.browser!.newPage();

			// Set viewport to standard desktop size
			await page.setViewportSize({ width: 1280, height: 800 });

			// Navigate to the page with timeout
			await page.goto(url, {
				waitUntil: 'networkidle',
				timeout: 15000
			});

			// Wait a bit for any lazy-loaded content
			await page.waitForTimeout(1000);

			// Take full-page screenshot (for the viewer)
			const fullPageBuffer = await page.screenshot({
				type: 'jpeg',
				quality: 85,
				fullPage: true
			});

			// Save full-page screenshot
			await writeFile(fullPagePath, fullPageBuffer);

			// Create thumbnail from the full-page screenshot (crop from top)
			const thumbnail = await sharp(fullPageBuffer)
				.resize(600, 400, {
					fit: 'cover',
					position: 'top'
				})
				.jpeg({ quality: 75 })
				.toBuffer();

			// Save thumbnail
			await writeFile(thumbnailPath, thumbnail);

			return {
				url,
				filename,
				thumbnailPath,
				fullPageFilename,
				fullPagePath,
				success: true
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error(`Screenshot failed for ${url}:`, errorMessage);

			return {
				url,
				filename,
				thumbnailPath,
				fullPageFilename,
				fullPagePath,
				success: false,
				error: errorMessage
			};
		} finally {
			if (page) {
				await page.close().catch(() => {});
			}
		}
	}

	async takeScreenshotBatch(urls: string[]): Promise<ScreenshotResult[]> {
		const results: ScreenshotResult[] = [];

		// Process screenshots sequentially to avoid overwhelming the browser
		for (const url of urls) {
			const result = await this.takeScreenshot(url);
			results.push(result);
			// Small delay between screenshots
			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		return results;
	}

	generateHash(url: string): string {
		return createHash('md5').update(url).digest('hex').slice(0, 16);
	}

	getScreenshotPath(hash: string): string {
		return path.join(SCREENSHOTS_DIR, `${hash}.jpg`);
	}

	async close(): Promise<void> {
		if (this.browser) {
			await this.browser.close();
			this.browser = null;
			this.isInitialized = false;
		}
	}
}

export const screenshotService = new ScreenshotService();
