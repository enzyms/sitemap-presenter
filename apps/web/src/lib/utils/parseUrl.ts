/**
 * Normalize a URL string to ensure it has a protocol.
 */
export function normalizeUrl(url: string): string {
	const trimmed = url.trim();
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
		return trimmed;
	}
	return `https://${trimmed}`;
}

/**
 * Extract the origin (protocol + host + port) from a URL string.
 */
export function extractDomain(url: string): string {
	try {
		const normalized = normalizeUrl(url);
		return new URL(normalized).origin;
	} catch {
		return url.replace(/^https?:\/\//, '').split('/')[0];
	}
}
