// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			userEmail: string | null;
		}
		interface PageData {
			userEmail: string | null;
		}
		interface PageState {
			selectedNodeId?: string | null;
		}
		// interface Platform {}
	}
}

// Environment variables
declare module '$env/static/public' {
	export const PUBLIC_SUPABASE_URL: string;
	export const PUBLIC_SUPABASE_ANON_KEY: string;
}

declare module '$env/dynamic/private' {
	export const ALLOWED_EMAILS: string | undefined;
	export const AUTH_PASSWORD: string | undefined;
}

export {};
