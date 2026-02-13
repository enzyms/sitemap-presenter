<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import AppHeader from '$lib/components/ui/AppHeader.svelte';
	import { getSupabase, type SiteWithStats } from '$lib/services/supabase';

	let sites = $state<SiteWithStats[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let openMenuId = $state<string | null>(null);

	function toggleMenu(e: Event, siteId: string) {
		e.preventDefault();
		e.stopPropagation();
		openMenuId = openMenuId === siteId ? null : siteId;
	}

	function closeMenus() {
		openMenuId = null;
	}

	async function handleDelete(e: Event, site: SiteWithStats) {
		e.preventDefault();
		e.stopPropagation();
		openMenuId = null;

		if (!confirm(`Are you sure you want to delete "${site.name}"? This will also delete all feedback markers and comments. This action cannot be undone.`)) {
			return;
		}

		try {
			const supabase = getSupabase();
			const { error: deleteError } = await supabase
				.from('sites')
				.delete()
				.eq('id', site.id);

			if (deleteError) throw deleteError;

			// Remove from local state
			sites = sites.filter(s => s.id !== site.id);

			// Clear localStorage cache
			try {
				localStorage.removeItem(`sitemap-cache-${site.id}`);
			} catch {}
		} catch (e) {
			console.error('Failed to delete site:', e);
			alert('Failed to delete site');
		}
	}

	function handleEdit(e: Event, siteId: string) {
		e.preventDefault();
		e.stopPropagation();
		openMenuId = null;
		goto(`/sites/${siteId}/settings`);
	}

	async function loadSites() {
		loading = true;
		error = null;

		try {
			const supabase = getSupabase();

			// Fetch sites with marker counts
			const { data, error: fetchError } = await supabase
				.from('sites')
				.select(`
					*,
					markers (
						id,
						status
					)
				`)
				.order('created_at', { ascending: false });

			if (fetchError) throw fetchError;

			// Transform to SiteWithStats
			sites = (data || []).map(site => {
				const markers = site.markers || [];
				return {
					...site,
					markers: undefined,
					marker_count: markers.length,
					open_count: markers.filter((m: { status: string }) => m.status === 'open').length,
					resolved_count: markers.filter((m: { status: string }) => m.status === 'resolved').length
				} as SiteWithStats;
			});
		} catch (e) {
			console.error('Failed to load sites:', e);
			error = e instanceof Error ? e.message : 'Failed to load sites';
		} finally {
			loading = false;
		}
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	onMount(() => {
		loadSites();
	});
</script>

<svelte:head>
	<title>Sitemap Presenter - Dashboard</title>
	<meta name="description" content="Interactive sitemap visualization and feedback tool" />
</svelte:head>

<div class="h-screen w-screen bg-gray-50 flex flex-col">
	<AppHeader />

	<main class="flex-1 overflow-auto p-6">
		<div class="max-w-6xl mx-auto">
			<!-- Page header -->
			<div class="mb-8">
				<h1 class="text-2xl font-bold text-gray-900">Your Sites</h1>
				<p class="text-gray-500 mt-1">Manage your websites and collect feedback</p>
			</div>

			{#if loading}
				<div class="flex items-center justify-center py-12">
					<svg class="w-8 h-8 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
				</div>
			{:else if error}
				<div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
					{error}
				</div>
			{:else if sites.length === 0}
				<!-- Empty state -->
				<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
					<div class="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
						<svg class="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
						</svg>
					</div>
					<h2 class="text-xl font-semibold text-gray-900 mb-2">No sites yet</h2>
					<p class="text-gray-500 mb-6">Create your first site to start crawling and collecting feedback</p>
					<a
						href="/sites/new"
						class="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						Create your first site
					</a>
				</div>
			{:else}
				<!-- Sites grid -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" onclick={closeMenus}>
					{#each sites as site (site.id)}
						<a
							href="/sites/{site.id}/map"
							class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-orange-200 transition-all group relative"
						>
							<div class="flex items-start justify-between mb-4">
								<div class="flex-1 min-w-0 pr-2">
									<h3 class="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors truncate">
										{site.name}
									</h3>
									<p class="text-sm text-gray-500 truncate">{site.domain}</p>
								</div>
								<div class="flex items-center gap-2">
									<!-- Kebab menu -->
									<div class="relative">
										<button
											onclick={(e) => toggleMenu(e, site.id)}
											class="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
											aria-label="Site options"
										>
											<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
												<circle cx="12" cy="5" r="2" />
												<circle cx="12" cy="12" r="2" />
												<circle cx="12" cy="19" r="2" />
											</svg>
										</button>
										{#if openMenuId === site.id}
											<div class="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
												<button
													onclick={(e) => handleEdit(e, site.id)}
													class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
												>
													<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
													</svg>
													Edit
												</button>
												<button
													onclick={(e) => handleDelete(e, site)}
													class="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
												>
													<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
													</svg>
													Delete
												</button>
											</div>
										{/if}
									</div>
								</div>
							</div>

							<!-- Stats -->
							<div class="flex items-center gap-4 mb-4">
								{#if site.marker_count > 0}
									<div class="flex items-center gap-1.5">
										<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
										</svg>
										<span class="text-sm text-gray-600">{site.marker_count} markers</span>
									</div>
									{#if site.open_count > 0}
										<span class="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
											{site.open_count} open
										</span>
									{/if}
									{#if site.resolved_count > 0}
										<span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
											{site.resolved_count} resolved
										</span>
									{/if}
								{:else}
									<span class="text-sm text-gray-400">No feedback yet</span>
								{/if}
							</div>

							<!-- Footer -->
							<div class="flex items-center justify-between text-xs text-gray-400 pt-4 border-t border-gray-100">
								<span>Created {formatDate(site.created_at)}</span>
								<span class="flex items-center gap-1 text-orange-500 group-hover:text-orange-600">
									View site
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
									</svg>
								</span>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</main>
</div>
