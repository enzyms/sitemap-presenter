import { redirect, fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { session } = await safeGetSession();

	if (session) {
		redirect(303, '/');
	}
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase }, url }) => {
		const formData = await request.formData();
		const email = (formData.get('email') as string)?.trim().toLowerCase();

		if (!email) {
			return fail(400, { error: 'Please enter your email address.', email });
		}

		const allowedEmails = env.ALLOWED_EMAILS;
		if (allowedEmails) {
			const emails = allowedEmails.split(',').map((e) => e.trim().toLowerCase());
			if (!emails.includes(email)) {
				return fail(403, { error: 'This email is not authorized.', email });
			}
		}

		const { error } = await supabase.auth.signInWithOtp({
			email,
			options: {
				emailRedirectTo: `${url.origin}/auth/callback`
			}
		});

		if (error) {
			return fail(500, { error: 'Could not send magic link. Try again.', email });
		}

		return { success: true, email };
	}
};
