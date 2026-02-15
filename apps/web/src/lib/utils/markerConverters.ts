import type { FeedbackMarker } from '$lib/types';
import type { MarkerWithComments } from '$lib/services/supabase';

/**
 * Convert a Supabase MarkerWithComments to the local FeedbackMarker format.
 */
export function convertSupabaseMarkerToFeedback(m: MarkerWithComments): FeedbackMarker {
	return {
		id: m.id,
		pageUrl: m.page_url,
		pagePath: m.page_path,
		number: m.number,
		anchor: m.anchor,
		fallbackPosition: m.fallback_position,
		viewport: m.viewport,
		status: m.status,
		comments: m.comments.map((c) => ({
			id: c.id,
			author: c.author_name || 'Anonymous',
			content: c.content,
			createdAt: c.created_at
		})),
		createdAt: m.created_at,
		updatedAt: m.updated_at
	};
}
