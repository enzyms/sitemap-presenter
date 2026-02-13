<script lang="ts">
	import { onMount } from 'svelte';
	import { getSupabase, type Site, type SiteWithStats } from '$lib/services/supabase';

	let sites = $state<SiteWithStats[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// New site form
	let showNewSiteModal = $state(false);
	let newSiteName = $state('');
	let newSiteDomain = $state('');
	let creating = $state(false);

	// Copy feedback
	let copiedId = $state<string | null>(null);

	const supabase = getSupabase();

	async function loadSites() {
		loading = true;
		error = null;

		try {
			// Get sites with marker counts
			const { data: sitesData, error: sitesError } = await supabase
				.from('sites')
				.select('*')
				.order('created_at', { ascending: false });

			if (sitesError) throw sitesError;

			// Get marker counts for each site
			const sitesWithStats: SiteWithStats[] = await Promise.all(
				(sitesData || []).map(async (site) => {
					const { count: totalCount } = await supabase
						.from('markers')
						.select('*', { count: 'exact', head: true })
						.eq('site_id', site.id);

					const { count: openCount } = await supabase
						.from('markers')
						.select('*', { count: 'exact', head: true })
						.eq('site_id', site.id)
						.eq('status', 'open');

					return {
						...site,
						marker_count: totalCount || 0,
						open_count: openCount || 0,
						resolved_count: (totalCount || 0) - (openCount || 0)
					};
				})
			);

			sites = sitesWithStats;
		} catch (e) {
			console.error('Failed to load sites:', e);
			error = e instanceof Error ? e.message : 'Failed to load sites';
		} finally {
			loading = false;
		}
	}

	async function createSite() {
		if (!newSiteName.trim() || !newSiteDomain.trim()) return;

		creating = true;
		error = null;

		try {
			const { data, error: createError } = await supabase
				.from('sites')
				.insert({
					name: newSiteName.trim(),
					domain: newSiteDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, ''),
					settings: {
						primaryColor: '#f97316',
						position: 'bottom-right'
					}
				})
				.select()
				.single();

			if (createError) throw createError;

			// Add to list with stats
			sites = [
				{
					...data,
					marker_count: 0,
					open_count: 0,
					resolved_count: 0
				},
				...sites
			];

			// Reset form
			newSiteName = '';
			newSiteDomain = '';
			showNewSiteModal = false;
		} catch (e) {
			console.error('Failed to create site:', e);
			error = e instanceof Error ? e.message : 'Failed to create site';
		} finally {
			creating = false;
		}
	}

	async function deleteSite(siteId: string) {
		if (!confirm('Delete this site? All feedback markers will be permanently deleted.')) return;

		try {
			const { error: deleteError } = await supabase.from('sites').delete().eq('id', siteId);

			if (deleteError) throw deleteError;

			sites = sites.filter((s) => s.id !== siteId);
		} catch (e) {
			console.error('Failed to delete site:', e);
			error = e instanceof Error ? e.message : 'Failed to delete site';
		}
	}

	async function copyApiKey(apiKey: string, siteId: string) {
		try {
			await navigator.clipboard.writeText(apiKey);
			copiedId = siteId;
			setTimeout(() => {
				copiedId = null;
			}, 2000);
		} catch (e) {
			console.error('Failed to copy:', e);
		}
	}

	function getInstallCode(apiKey: string): string {
		// Use current origin - works for both localhost and production
		const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-site.netlify.app';
		return `<script
  src="${origin}/widget.js"
  data-api-key="${apiKey}"
  async
><\/script>`;
	}

	async function copyInstallCode(apiKey: string, siteId: string) {
		try {
			await navigator.clipboard.writeText(getInstallCode(apiKey));
			copiedId = siteId + '-code';
			setTimeout(() => {
				copiedId = null;
			}, 2000);
		} catch (e) {
			console.error('Failed to copy:', e);
		}
	}

	onMount(() => {
		loadSites();
	});
</script>

<svelte:head>
	<title>Sites - Feedback Widget</title>
</svelte:head>

<div class="min-h-screen bg-gray-100">
	<!-- Header -->
	<header class="bg-white border-b border-gray-200 px-6 py-4">
		<div class="max-w-6xl mx-auto flex items-center justify-between">
			<div class="flex items-center gap-4">
				<a href="/" class="text-gray-500 hover:text-gray-700">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 19l-7-7m0 0l7-7m-7 7h18"
						/>
					</svg>
				</a>
				<h1 class="text-xl font-bold text-gray-800">Sites</h1>
			</div>

			<button
				onclick={() => (showNewSiteModal = true)}
				class="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 4v16m8-8H4"
					/>
				</svg>
				Add Site
			</button>
		</div>
	</header>

	<!-- Main content -->
	<main class="max-w-6xl mx-auto px-6 py-8">
		{#if error}
			<div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
				{error}
			</div>
		{/if}

		{#if loading}
			<div class="flex items-center justify-center py-20">
				<svg
					class="w-8 h-8 animate-spin text-orange-500"
					fill="none"
					viewBox="0 0 24 24"
				>
					<circle
						class="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
			</div>
		{:else if sites.length === 0}
			<div class="text-center py-20">
				<svg
					class="w-16 h-16 mx-auto text-gray-300 mb-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
					/>
				</svg>
				<h2 class="text-xl font-medium text-gray-600 mb-2">No sites yet</h2>
				<p class="text-gray-400 mb-6">Add a site to start collecting feedback</p>
				<button
					onclick={() => (showNewSiteModal = true)}
					class="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
				>
					Add your first site
				</button>
			</div>
		{:else}
			<div class="grid gap-6">
				{#each sites as site (site.id)}
					<div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
						<div class="p-6">
							<div class="flex items-start justify-between">
								<div>
									<h2 class="text-lg font-semibold text-gray-800">{site.name}</h2>
									<p class="text-gray-500 text-sm mt-1">{site.domain}</p>
								</div>

								<div class="flex items-center gap-3">
									{#if site.open_count > 0}
										<span class="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
											{site.open_count} open
										</span>
									{/if}
									{#if site.resolved_count > 0}
										<span class="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
											{site.resolved_count} resolved
										</span>
									{/if}
								</div>
							</div>

							<!-- API Key section -->
							<div class="mt-6 p-4 bg-gray-50 rounded-lg">
								<div class="flex items-center justify-between mb-3">
									<span class="text-sm font-medium text-gray-700">API Key</span>
									<button
										onclick={() => copyApiKey(site.api_key, site.id)}
										class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
									>
										{#if copiedId === site.id}
											<svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
											</svg>
											Copied!
										{:else}
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
											</svg>
											Copy
										{/if}
									</button>
								</div>
								<code class="block p-3 bg-white border border-gray-200 rounded text-sm font-mono text-gray-600 break-all">
									{site.api_key}
								</code>
							</div>

							<!-- Install code section -->
							<div class="mt-4 p-4 bg-gray-50 rounded-lg">
								<div class="flex items-center justify-between mb-3">
									<span class="text-sm font-medium text-gray-700">Install Code</span>
									<button
										onclick={() => copyInstallCode(site.api_key, site.id)}
										class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
									>
										{#if copiedId === site.id + '-code'}
											<svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
											</svg>
											Copied!
										{:else}
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
											</svg>
											Copy
										{/if}
									</button>
								</div>
								<pre class="p-3 bg-white border border-gray-200 rounded text-xs font-mono text-gray-600 overflow-x-auto">{getInstallCode(site.api_key)}</pre>
							</div>

							<!-- Actions -->
							<div class="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
								<span class="text-xs text-gray-400">
									Created {new Date(site.created_at).toLocaleDateString()}
								</span>
								<div class="flex items-center gap-2">
									<a
										href="/sites/{site.id}/feedback"
										class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-orange-500 text-white hover:bg-orange-600 rounded-md transition-colors font-medium"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
										</svg>
										View Feedback
									</a>
									<button
										onclick={() => deleteSite(site.id)}
										class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
										</svg>
										Delete
									</button>
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</main>
</div>

<!-- New Site Modal -->
{#if showNewSiteModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
		onclick={() => (showNewSiteModal = false)}
	>
		<div
			class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 mx-4"
			onclick={(e) => e.stopPropagation()}
		>
			<h2 class="text-xl font-bold text-gray-800 mb-4">Add New Site</h2>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					createSite();
				}}
			>
				<div class="space-y-4">
					<div>
						<label for="site-name" class="block text-sm font-medium text-gray-700 mb-1"
							>Site Name *</label
						>
						<input
							id="site-name"
							type="text"
							bind:value={newSiteName}
							placeholder="My Website"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
							required
						/>
					</div>
					<div>
						<label for="site-domain" class="block text-sm font-medium text-gray-700 mb-1"
							>Domain *</label
						>
						<input
							id="site-domain"
							type="text"
							bind:value={newSiteDomain}
							placeholder="example.com"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
							required
						/>
						<p class="text-xs text-gray-400 mt-1">Without http:// or https://</p>
					</div>
				</div>

				<div class="flex justify-end gap-3 mt-6">
					<button
						type="button"
						onclick={() => (showNewSiteModal = false)}
						class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={!newSiteName.trim() || !newSiteDomain.trim() || creating}
						class="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{creating ? 'Creating...' : 'Create Site'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
