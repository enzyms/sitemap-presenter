/**
 * IndexedDB-based screenshot cache
 * Stores screenshots locally to avoid re-crawling
 */

const DB_NAME = 'sitemap-presenter-screenshots';
const DB_VERSION = 2; // Bumped version for schema change
const STORE_NAME = 'screenshots';

interface CachedScreenshot {
  cacheKey: string; // composite key: siteId:url
  url: string;
  siteId: string;
  thumbnailBlob: Blob;
  fullPageBlob?: Blob;
  cachedAt: string;
}

function makeCacheKey(siteId: string, url: string): string {
  return `${siteId}:${url}`;
}

class ScreenshotCacheService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[ScreenshotCache] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Delete old store if exists (schema change)
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }

        // Create new store with composite key
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' });
        store.createIndex('siteId', 'siteId', { unique: false });
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
      };
    });

    return this.initPromise;
  }

  async get(siteId: string, url: string): Promise<CachedScreenshot | null> {
    await this.init();
    if (!this.db) return null;

    const cacheKey = makeCacheKey(siteId, url);
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(cacheKey);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async set(siteId: string, url: string, thumbnailBlob: Blob, fullPageBlob?: Blob): Promise<void> {
    await this.init();
    if (!this.db) return;

    const data: CachedScreenshot = {
      cacheKey: makeCacheKey(siteId, url),
      url,
      siteId,
      thumbnailBlob,
      fullPageBlob,
      cachedAt: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(siteId: string, url: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    const cacheKey = makeCacheKey(siteId, url);
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(cacheKey);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteBySiteId(siteId: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('siteId');
      const request = index.openCursor(IDBKeyRange.only(siteId));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getAllForSite(siteId: string): Promise<CachedScreenshot[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('siteId');
      const request = index.getAll(IDBKeyRange.only(siteId));

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Fetch screenshot from server and cache it
   */
  async fetchAndCache(
    pageUrl: string,
    siteId: string,
    thumbnailUrl: string,
    fullPageUrl?: string
  ): Promise<{ thumbnailObjectUrl: string; fullPageObjectUrl?: string } | null> {
    try {
      // Check if already cached
      const cached = await this.get(siteId, pageUrl);
      if (cached) {
        return {
          thumbnailObjectUrl: URL.createObjectURL(cached.thumbnailBlob),
          fullPageObjectUrl: cached.fullPageBlob ? URL.createObjectURL(cached.fullPageBlob) : undefined
        };
      }

      // Fetch from server
      const thumbnailResponse = await fetch(thumbnailUrl);
      if (!thumbnailResponse.ok) return null;
      const thumbnailBlob = await thumbnailResponse.blob();

      let fullPageBlob: Blob | undefined;
      if (fullPageUrl) {
        const fullPageResponse = await fetch(fullPageUrl);
        if (fullPageResponse.ok) {
          fullPageBlob = await fullPageResponse.blob();
        }
      }

      // Store in IndexedDB
      await this.set(siteId, pageUrl, thumbnailBlob, fullPageBlob);

      return {
        thumbnailObjectUrl: URL.createObjectURL(thumbnailBlob),
        fullPageObjectUrl: fullPageBlob ? URL.createObjectURL(fullPageBlob) : undefined
      };
    } catch (error) {
      console.error('[ScreenshotCache] Failed to fetch and cache:', error);
      return null;
    }
  }

  /**
   * Get cached screenshot as object URL
   */
  async getObjectUrl(siteId: string, pageUrl: string): Promise<{ thumbnailObjectUrl: string; fullPageObjectUrl?: string } | null> {
    const cached = await this.get(siteId, pageUrl);
    if (!cached) return null;

    return {
      thumbnailObjectUrl: URL.createObjectURL(cached.thumbnailBlob),
      fullPageObjectUrl: cached.fullPageBlob ? URL.createObjectURL(cached.fullPageBlob) : undefined
    };
  }

  /**
   * Clear old cache entries (older than specified days)
   */
  async clearOldCache(maxAgeDays: number = 7): Promise<number> {
    await this.init();
    if (!this.db) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
    const cutoffIso = cutoffDate.toISOString();

    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('cachedAt');
      const range = IDBKeyRange.upperBound(cutoffIso);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }
}

export const screenshotCache = new ScreenshotCacheService();
