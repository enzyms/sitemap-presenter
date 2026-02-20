import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

function getServerSupabase() {
	return createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { siteId, markerId, summary, description, nodeId } = body;

		if (!siteId || !markerId || !summary) {
			return json({ error: 'Missing required fields: siteId, markerId, summary' }, { status: 400 });
		}

		const supabase = getServerSupabase();

		// 1. Read site settings to get YouTrack config
		const { data: site, error: siteError } = await supabase
			.from('sites')
			.select('settings')
			.eq('id', siteId)
			.single();

		if (siteError || !site) {
			return json({ error: 'Site not found' }, { status: 404 });
		}

		const ytConfig = site.settings?.youtrack;
		if (!ytConfig?.baseUrl || !ytConfig?.projectId || !ytConfig?.token) {
			return json({ error: 'YouTrack is not configured for this site. Go to Settings to set it up.' }, { status: 400 });
		}

		// 2. Build issue description with backlink
		const mapPath = nodeId ? `/sites/${siteId}/map/${nodeId}` : `/sites/${siteId}/map`;
		const markerParam = markerId ? `?marker=${markerId}` : '';
		const backlink = `\n\n---\n[View in Sitemap Presenter](https://sitemap-presenter.netlify.app${mapPath}${markerParam})`;
		const fullDescription = description ? description + backlink : backlink;

		// 3. Create issue in YouTrack
		const baseUrl = ytConfig.baseUrl.replace(/\/+$/, '');
		const createRes = await fetch(`${baseUrl}/api/issues`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${ytConfig.token}`,
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify({
				project: { shortName: ytConfig.projectId },
				summary,
				description: fullDescription
			})
		});

		if (!createRes.ok) {
			const errText = await createRes.text();
			console.error('YouTrack API error:', createRes.status, errText);
			return json(
				{ error: `YouTrack API error: ${createRes.status} ${createRes.statusText}` },
				{ status: 502 }
			);
		}

		const issue = await createRes.json();
		const issueId = issue.idReadable; // e.g. "CASG-123"
		const issueUrl = `${baseUrl}/issue/${issueId}`;

		// 4. Update marker with YouTrack issue ID
		const { error: updateError } = await supabase
			.from('markers')
			.update({ youtrack_issue_id: issueId })
			.eq('id', markerId);

		if (updateError) {
			console.error('Failed to update marker with YouTrack issue ID:', updateError);
			// Don't fail - the issue was created successfully
		}

		return json({ issueId, issueUrl });
	} catch (e) {
		console.error('YouTrack endpoint error:', e);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
