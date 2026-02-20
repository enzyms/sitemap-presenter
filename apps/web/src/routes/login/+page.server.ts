import { redirect, fail } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { Actions, PageServerLoad } from './$types';

const AUTH_COOKIE = 'auth_email';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.userEmail) {
		redirect(303, '/');
	}
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const email = (formData.get('email') as string)?.trim().toLowerCase();
		const password = (formData.get('password') as string) ?? '';

		if (!email || !password) {
			return fail(400, { error: 'Please fill in all fields.', email });
		}

		const allowedEmails = env.ALLOWED_EMAILS;
		if (allowedEmails) {
			const emails = allowedEmails.split(',').map((e) => e.trim().toLowerCase());
			if (!emails.includes(email)) {
				return fail(403, { error: 'This email is not authorized.', email });
			}
		}

		if (password !== env.AUTH_PASSWORD) {
			return fail(403, { error: 'Wrong password.', email });
		}

		cookies.set(AUTH_COOKIE, email, {
			path: '/',
			httpOnly: true,
			secure: !dev,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30 // 30 days
		});

		redirect(303, '/');
	}
};
