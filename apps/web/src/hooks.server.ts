import { createServerClient } from '@supabase/ssr';
import { type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { env } from '$env/dynamic/private';

const supabase: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: '/' });
				});
			}
		}
	});

	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();

		if (!session) {
			return { session: null, user: null };
		}

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();

		if (error) {
			return { session: null, user: null };
		}

		return { session, user };
	};

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};

const authGuard: Handle = async ({ event, resolve }) => {
	const { session, user } = await event.locals.safeGetSession();

	const isPublicRoute =
		event.url.pathname === '/login' || event.url.pathname.startsWith('/auth/');

	if (!session && !isPublicRoute) {
		redirect(303, '/login');
	}

	if (session && user) {
		const allowedEmails = env.ALLOWED_EMAILS;
		if (allowedEmails && user.email) {
			const emails = allowedEmails.split(',').map((e) => e.trim().toLowerCase());
			if (!emails.includes(user.email.toLowerCase())) {
				await event.locals.supabase.auth.signOut();
				redirect(303, '/login?error=unauthorized');
			}
		}
	}

	return resolve(event);
};

export const handle: Handle = sequence(supabase, authGuard);
