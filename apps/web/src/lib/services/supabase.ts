import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

// Supabase client singleton
let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
	if (!supabaseClient) {
		supabaseClient = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
	}
	return supabaseClient;
}

// Re-export types from shared package
export type {
	Site,
	SiteSettings,
	Marker,
	MarkerWithComments,
	Comment,
	AnonymousUser,
	MarkerStatus,
	ElementAnchor,
	FallbackPosition,
	ViewportInfo,
	CreateMarkerRequest,
	CreateCommentRequest,
	UpdateMarkerRequest,
	SiteWithStats
} from '@sitemap-presenter/shared';
