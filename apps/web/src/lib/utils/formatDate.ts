/**
 * Format a date string for display (date only).
 */
export function formatDate(dateString: string): string {
	return new Date(dateString).toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});
}

/**
 * Format a date string with time for display.
 */
export function formatDateTime(dateString: string): string {
	return new Date(dateString).toLocaleDateString(undefined, {
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit'
	});
}
