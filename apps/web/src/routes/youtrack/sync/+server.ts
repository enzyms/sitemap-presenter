import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

function getServerSupabase() {
	return createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { siteId, markers } = await request.json();

		if (!siteId || !markers?.length) {
			return json({ archived: [], deleted: [] });
		}

		const supabase = getServerSupabase();

		// 1. Get YouTrack config from site settings
		const { data: site } = await supabase
			.from('sites')
			.select('settings')
			.eq('id', siteId)
			.single();

		const ytConfig = site?.settings?.youtrack;
		if (!ytConfig?.baseUrl || !ytConfig?.token) {
			return json({ archived: [], deleted: [] });
		}

		const baseUrl = ytConfig.baseUrl.replace(/\/+$/, '');
		const issueIds: string[] = markers.map((m: { youtrackIssueId: string }) => m.youtrackIssueId);
		const resolved = new Set<string>();
		const found = new Set<string>();

		// 2. Batch-query YouTrack for all issue IDs
		for (let i = 0; i < issueIds.length; i += 50) {
			const chunk = issueIds.slice(i, i + 50);
			const query = `issue id: ${chunk.join(', ')}`;
			try {
				const res = await fetch(
					`${baseUrl}/api/issues?query=${encodeURIComponent(query)}&fields=id,idReadable,resolved&$top=${chunk.length}`,
					{
						headers: {
							Authorization: `Bearer ${ytConfig.token}`,
							Accept: 'application/json'
						}
					}
				);
				if (!res.ok) continue;

				const issues: Array<{ idReadable: string; resolved: number | null }> = await res.json();
				for (const issue of issues) {
					found.add(issue.idReadable);
					if (issue.resolved != null) {
						resolved.add(issue.idReadable);
					}
				}
			} catch {
				// YouTrack unreachable for this batch — skip
			}
		}

		// 3. Verify missing issues individually (confirm 404 vs permission issue)
		const confirmedDeleted = new Set<string>();
		for (const issueId of issueIds) {
			if (found.has(issueId)) continue;

			try {
				const res = await fetch(`${baseUrl}/api/issues/${issueId}?fields=id,resolved`, {
					headers: {
						Authorization: `Bearer ${ytConfig.token}`,
						Accept: 'application/json'
					}
				});
				if (res.status === 404) {
					confirmedDeleted.add(issueId);
				} else if (res.ok) {
					const data: { resolved: number | null } = await res.json();
					found.add(issueId);
					if (data.resolved != null) resolved.add(issueId);
				}
			} catch {
				// Skip — leave marker alone
			}
		}

		// 4. Map back to marker IDs
		const toArchive = markers
			.filter((m: { youtrackIssueId: string }) => resolved.has(m.youtrackIssueId))
			.map((m: { id: string }) => m.id);
		const toDelete = markers
			.filter((m: { youtrackIssueId: string }) => confirmedDeleted.has(m.youtrackIssueId))
			.map((m: { id: string }) => m.id);

		// 5. Perform Supabase mutations
		if (toArchive.length > 0) {
			await supabase
				.from('markers')
				.update({ status: 'archived' })
				.in('id', toArchive)
				.eq('site_id', siteId);
		}

		if (toDelete.length > 0) {
			await supabase
				.from('markers')
				.delete()
				.in('id', toDelete)
				.eq('site_id', siteId);
		}

		return json({ archived: toArchive, deleted: toDelete });
	} catch (e) {
		console.error('YouTrack sync error:', e);
		return json({ archived: [], deleted: [] });
	}
};
