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
 * Extract the hostname (domain) from a URL string.
 */
export function extractDomain(url: string): string {
	try {
		const normalized = normalizeUrl(url);
		return new URL(normalized).hostname;
	} catch {
		return url.replace(/^https?:\/\//, '').split('/')[0];
	}
}
