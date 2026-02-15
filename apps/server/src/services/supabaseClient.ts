import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SCREENSHOTS_BUCKET = 'screenshots';

let supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
	if (supabaseAdmin) return supabaseAdmin;

	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!url || !key) {
		throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
	}

	supabaseAdmin = createClient(url, key);
	return supabaseAdmin;
}
