import { chromium, Browser, BrowserContext, Page } from 'playwright';
import sharp from 'sharp';
import { createHash } from 'crypto';
import { getSupabaseAdmin, SCREENSHOTS_BUCKET } from './supabaseClient.js';

interface ScreenshotResult {
	url: string;
	thumbnailUrl: string;
	success: boolean;
	error?: string;
}

interface ScreenshotAuth {
	httpUser?: string;
	httpPassword?: string;
}

export class ScreenshotService {
	private browser: Browser | null = null;
	private context: BrowserContext | null = null;
	private isInitialized = false;

	async initialize(auth?: ScreenshotAuth): Promise<void> {
		if (this.isInitialized) {
			// Re-initialize context if auth changed
			if (auth?.httpUser && this.context) {
				await this.context.close().catch(() => {});
				this.context = await this.browser!.newContext({
					ignoreHTTPSErrors: true,
					httpCredentials: { username: auth.httpUser, password: auth.httpPassword || '' }
				});
			}
			return;
		}

		this.browser = await chromium.launch({
			headless: true,
			args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
		});

		const contextOptions: {
			ignoreHTTPSErrors: boolean;
			httpCredentials?: { username: string; password: string };
		} = { ignoreHTTPSErrors: true };

		if (auth?.httpUser) {
			contextOptions.httpCredentials = {
				username: auth.httpUser,
				password: auth.httpPassword || ''
			};
		}

		this.context = await this.browser.newContext(contextOptions);
		this.isInitialized = true;
	}

	async takeScreenshot(url: string): Promise<ScreenshotResult> {
		if (!this.context) {
			await this.initialize();
		}

		const hash = this.generateHash(url);
		const thumbnailKey = `thumbnails/${hash}.webp`;

		const supabase = getSupabaseAdmin();

		// Check if thumbnail already exists in Supabase (cache hit)
		const { data: existing } = await supabase.storage.from(SCREENSHOTS_BUCKET).list('thumbnails', {
			search: `${hash}.webp`
		});

		if (existing && existing.length > 0) {
			console.log(`Screenshot cache hit for ${url}`);
			const { data: { publicUrl: thumbnailUrl } } = supabase.storage.from(SCREENSHOTS_BUCKET).getPublicUrl(thumbnailKey);
			return { url, thumbnailUrl, success: true };
		}

		let page: Page | null = null;

		try {
			page = await this.context!.newPage();

			// Set viewport to standard desktop size
			await page.setViewportSize({ width: 1280, height: 800 });

			// Navigate to the page with timeout
			await page.goto(url, {
				waitUntil: 'networkidle',
				timeout: 15000
			});

			// Wait a bit for any lazy-loaded content
			await page.waitForTimeout(1000);

			// Take viewport screenshot as PNG (lossless input for Sharp)
			const screenshotBuffer = await page.screenshot({ type: 'png' });

			// Create thumbnail WebP
			const thumbnailWebp = await sharp(screenshotBuffer)
				.resize(600, 400, {
					fit: 'cover',
					position: 'top'
				})
				.webp({ quality: 60 })
				.toBuffer();

			// Upload thumbnail to Supabase Storage
			const { error: thumbError } = await supabase.storage
				.from(SCREENSHOTS_BUCKET)
				.upload(thumbnailKey, thumbnailWebp, {
					contentType: 'image/webp',
					upsert: true
				});

			if (thumbError) {
				throw new Error(`Thumbnail upload failed: ${thumbError.message}`);
			}

			// Get public URL
			const { data: { publicUrl: thumbnailUrl } } = supabase.storage.from(SCREENSHOTS_BUCKET).getPublicUrl(thumbnailKey);

			return {
				url,
				thumbnailUrl,
				success: true
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error(`Screenshot failed for ${url}:`, errorMessage);

			return {
				url,
				thumbnailUrl: '',
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

	async deleteByUrls(pageUrls: string[]): Promise<number> {
		const supabase = getSupabaseAdmin();
		const paths = pageUrls.map((url) => `thumbnails/${this.generateHash(url)}.webp`);

		const { error } = await supabase.storage.from(SCREENSHOTS_BUCKET).remove(paths);
		if (error) {
			console.error('Failed to delete screenshots from storage:', error.message);
			return 0;
		}

		return paths.length;
	}

	async close(): Promise<void> {
		if (this.context) {
			await this.context.close().catch(() => {});
			this.context = null;
		}
		if (this.browser) {
			await this.browser.close();
			this.browser = null;
			this.isInitialized = false;
		}
	}
}

export const screenshotService = new ScreenshotService();
