import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { baseUrl, token, projectId } = await request.json();

		if (!baseUrl || !token || !projectId) {
			return json({ error: 'Missing required fields: baseUrl, token, projectId' }, { status: 400 });
		}

		const cleanBaseUrl = baseUrl.replace(/\/+$/, '');

		const res = await fetch(`${cleanBaseUrl}/api/admin/projects/${projectId}`, {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: 'application/json'
			}
		});

		if (!res.ok) {
			if (res.status === 401 || res.status === 403) {
				return json({ success: false, error: 'Invalid token or insufficient permissions' }, { status: 200 });
			}
			if (res.status === 404) {
				return json({ success: false, error: `Project "${projectId}" not found` }, { status: 200 });
			}
			return json({ success: false, error: `YouTrack returned ${res.status}: ${res.statusText}` }, { status: 200 });
		}

		const project = await res.json();
		return json({ success: true, projectName: project.name || projectId });
	} catch (e) {
		console.error('YouTrack test connection error:', e);
		return json({ success: false, error: 'Could not reach YouTrack server' }, { status: 200 });
	}
};
