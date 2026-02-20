import { type Handle, redirect } from '@sveltejs/kit';

const AUTH_COOKIE = 'auth_email';

export const handle: Handle = async ({ event, resolve }) => {
	const email = event.cookies.get(AUTH_COOKIE) ?? null;
	event.locals.userEmail = email;

	const isPublicRoute =
		event.url.pathname === '/login' || event.url.pathname === '/auth/signout';

	if (!email && !isPublicRoute) {
		redirect(303, '/login');
	}

	return resolve(event);
};
