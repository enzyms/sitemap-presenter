<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import AppHeader from '$lib/components/ui/AppHeader.svelte';
	import { getSupabase, type Site } from '$lib/services/supabase';
	import { screenshotCache } from '$lib/services/screenshotCache';
	import { layoutPositions } from '$lib/services/layoutPositions';
	import { crawlCacheService } from '$lib/services/crawlCacheService';
	import { apiService } from '$lib/services/api';

	let siteId = $derived($page.params.id!);

	let site = $state<Site | null>(null);
	let loading = $state(true);
	let saving = $state(false);
	let deleting = $state(false);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);

	let name = $state('');
	let domain = $state('');

	// YouTrack settings
	let ytBaseUrl = $state('');
	let ytProjectId = $state('');
	let ytToken = $state('');
	let ytSaving = $state(false);
	let ytTesting = $state(false);
	let ytTestResult = $state<{ success: boolean; message: string } | null>(null);

	// Crawl settings
	let crawlExcludePatterns = $state<string[]>([]);
	let crawlIncludeUrls = $state<string[]>([]);
	let crawlHttpUser = $state('');
	let crawlHttpPassword = $state('');
	let crawlSaving = $state(false);
	let excludeInput = $state('');
	let includeInput = $state('');

	async function loadSite() {
		loading = true;
		error = null;

		try {
			const supabase = getSupabase();
			const { data, error: fetchError } = await supabase
				.from('sites')
				.select('*')
				.eq('id', siteId)
				.single();

			if (fetchError) throw fetchError;
			site = data;
			name = data.name;
			domain = data.domain;
			ytBaseUrl = data.settings?.youtrack?.baseUrl || '';
			ytProjectId = data.settings?.youtrack?.projectId || '';
			ytToken = data.settings?.youtrack?.token || '';
			crawlExcludePatterns = data.settings?.crawl?.excludePatterns || [];
			crawlIncludeUrls = data.settings?.crawl?.includeUrls || [];
			crawlHttpUser = data.settings?.crawl?.httpUser || '';
			crawlHttpPassword = data.settings?.crawl?.httpPassword || '';
		} catch (e) {
			console.error('Failed to load site:', e);
			error = e instanceof Error ? e.message : 'Failed to load site';
		} finally {
			loading = false;
		}
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (!name.trim() || !domain.trim()) {
			error = 'Name and domain are required';
			return;
		}

		saving = true;
		error = null;
		success = null;

		try {
			const supabase = getSupabase();
			const { error: updateError } = await supabase
				.from('sites')
				.update({ name: name.trim(), domain: domain.trim() })
				.eq('id', siteId);

			if (updateError) throw updateError;

			success = 'Settings saved successfully';
			if (site) {
				site = { ...site, name: name.trim(), domain: domain.trim() };
			}
		} catch (e) {
			console.error('Failed to save settings:', e);
			error = e instanceof Error ? e.message : 'Failed to save settings';
		} finally {
			saving = false;
		}
	}

	async function handleYoutrackSave() {
		ytSaving = true;
		error = null;
		success = null;

		try {
			const supabase = getSupabase();
			const currentSettings = site?.settings || {};
			const newSettings = {
				...currentSettings,
				youtrack: {
					baseUrl: ytBaseUrl.trim() || undefined,
					projectId: ytProjectId.trim() || undefined,
					token: ytToken.trim() || undefined
				}
			};

			const { error: updateError } = await supabase
				.from('sites')
				.update({ settings: newSettings })
				.eq('id', siteId);

			if (updateError) throw updateError;

			success = 'YouTrack settings saved';
			if (site) {
				site = { ...site, settings: newSettings };
			}
		} catch (e) {
			console.error('Failed to save YouTrack settings:', e);
			error = e instanceof Error ? e.message : 'Failed to save YouTrack settings';
		} finally {
			ytSaving = false;
		}
	}

	async function handleYoutrackTest() {
		ytTesting = true;
		ytTestResult = null;

		try {
			const res = await fetch('/youtrack/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					baseUrl: ytBaseUrl.trim(),
					token: ytToken.trim(),
					projectId: ytProjectId.trim()
				})
			});

			const data = await res.json();
			if (data.success) {
				ytTestResult = { success: true, message: `Connected to project: ${data.projectName}` };
			} else {
				ytTestResult = { success: false, message: data.error || 'Connection failed' };
			}
		} catch (e) {
			ytTestResult = { success: false, message: 'Could not reach the server' };
		} finally {
			ytTesting = false;
		}
	}

	function addExcludePattern() {
		const trimmed = excludeInput.trim();
		if (trimmed && !crawlExcludePatterns.includes(trimmed)) {
			crawlExcludePatterns = [...crawlExcludePatterns, trimmed];
			excludeInput = '';
		}
	}

	function removeExcludePattern(index: number) {
		crawlExcludePatterns = crawlExcludePatterns.filter((_, i) => i !== index);
	}

	function addIncludeUrl() {
		const trimmed = includeInput.trim();
		if (trimmed && !crawlIncludeUrls.includes(trimmed)) {
			crawlIncludeUrls = [...crawlIncludeUrls, trimmed];
			includeInput = '';
		}
	}

	function removeIncludeUrl(index: number) {
		crawlIncludeUrls = crawlIncludeUrls.filter((_, i) => i !== index);
	}

	async function handleCrawlSettingsSave() {
		crawlSaving = true;
		error = null;
		success = null;

		try {
			const supabase = getSupabase();
			const currentSettings = site?.settings || {};
			const crawl: Record<string, unknown> = {};
			if (crawlExcludePatterns.length > 0) crawl.excludePatterns = crawlExcludePatterns;
			if (crawlIncludeUrls.length > 0) crawl.includeUrls = crawlIncludeUrls;
			if (crawlHttpUser.trim()) crawl.httpUser = crawlHttpUser.trim();
			if (crawlHttpPassword.trim()) crawl.httpPassword = crawlHttpPassword.trim();

			const newSettings = {
				...currentSettings,
				crawl: Object.keys(crawl).length > 0 ? crawl : undefined
			};

			const { error: updateError } = await supabase
				.from('sites')
				.update({ settings: newSettings })
				.eq('id', siteId);

			if (updateError) throw updateError;

			success = 'Crawl settings saved';
			if (site) {
				site = { ...site, settings: newSettings };
			}
		} catch (e) {
			console.error('Failed to save crawl settings:', e);
			error = e instanceof Error ? e.message : 'Failed to save crawl settings';
		} finally {
			crawlSaving = false;
		}
	}

	async function handleDelete() {
		if (!confirm('Are you sure you want to delete this site? This will also delete all feedback markers and comments. This action cannot be undone.')) {
			return;
		}

		deleting = true;
		error = null;

		try {
			const supabase = getSupabase();

			// Delete site (cascade should handle markers and comments)
			const { data: deletedRows, error: deleteError } = await supabase
				.from('sites')
				.delete()
				.eq('id', siteId)
				.select();

			if (deleteError) throw deleteError;

			// Check if any rows were actually deleted
			if (!deletedRows || deletedRows.length === 0) {
				throw new Error('Site not found or you do not have permission to delete it');
			}

			// Clear crawl cache (localStorage + Supabase)
			await crawlCacheService.deleteForSite(siteId);

			// Clear layout positions (localStorage + Supabase)
			await layoutPositions.deleteLayoutsForSite(siteId);

			// Delete screenshots from Supabase Storage + IndexedDB cache
			try {
				const cached = await screenshotCache.getAllForSite(siteId);
				if (cached.length > 0) {
					const pageUrls = cached.map((c) => c.url);
					await apiService.deleteScreenshots(pageUrls);
				}
				await screenshotCache.deleteBySiteId(siteId);
			} catch (e) {
				console.error('Failed to clear screenshots:', e);
			}

			// Redirect to homepage
			goto('/');
		} catch (e) {
			console.error('Failed to delete site:', e);
			error = e instanceof Error ? e.message : 'Failed to delete site';
			deleting = false;
		}
	}

	onMount(() => {
		loadSite();
	});
</script>

<svelte:head>
	<title>{site?.name || 'Site'} - Settings - Sitemap Presenter</title>
</svelte:head>

<div class="min-h-screen bg-gray-100 flex flex-col">
	<AppHeader siteName={site?.name} {siteId} showNewSite={false} />

	<main class="flex-1 p-6">
		<div class="max-w-2xl mx-auto">
			{#if loading}
				<div class="flex items-center justify-center py-12">
					<svg class="w-8 h-8 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
				</div>
			{:else if error && !site}
				<div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
					<p class="text-red-700 mb-4">{error}</p>
					<a href="/" class="text-orange-500 hover:text-orange-600 font-medium">Back to Dashboard</a>
				</div>
			{:else}
				<div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
					<!-- Header -->
					<div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
						<h1 class="text-xl font-semibold text-gray-900">Site Settings</h1>
						<p class="text-sm text-gray-500 mt-1">Manage your site configuration</p>
					</div>

					<!-- Form -->
					<form onsubmit={handleSubmit} class="p-6 space-y-6">
						{#if error}
							<div class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
								{error}
							</div>
						{/if}

						{#if success}
							<div class="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
								{success}
							</div>
						{/if}

						<div>
							<label for="name" class="block text-sm font-medium text-gray-700 mb-2">
								Site Name
							</label>
							<input
								type="text"
								id="name"
								bind:value={name}
								placeholder="My Website"
								class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
								required
							/>
						</div>

						<div>
							<label for="domain" class="block text-sm font-medium text-gray-700 mb-2">
								Domain / URL
							</label>
							<input
								type="text"
								id="domain"
								bind:value={domain}
								placeholder="https://example.com"
								class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
								required
							/>
							<p class="text-xs text-gray-500 mt-1">The URL of your website for crawling</p>
						</div>

						<!-- Widget Embed Code -->
						{#if site?.api_key}
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-2">
									Widget Embed Code
								</label>
								<div class="bg-gray-900 rounded-lg p-4 relative">
									<pre class="text-sm text-green-400 overflow-x-auto whitespace-pre-wrap break-all"><code>&lt;script src="https://sitemap-presenter.netlify.app/widget.js" data-api-key="{site.api_key}"&gt;&lt;/script&gt;</code></pre>
									<button
										type="button"
										onclick={() => {
											const code = `<script src="https://sitemap-presenter.netlify.app/widget.js" data-api-key="${site?.api_key}"><\/script>`;
											navigator.clipboard.writeText(code);
										}}
										class="absolute top-2 right-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm flex items-center gap-2 transition-colors"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
										</svg>
										Copy
									</button>
								</div>
								<p class="text-xs text-gray-500 mt-2">Add this script tag to your website to enable the feedback widget</p>
								<p class="text-xs text-gray-500 mt-1">Widget is hidden by default. Append <code class="bg-gray-100 px-1 rounded">?feedback=on</code> to any page URL to activate, or press <kbd class="bg-gray-100 px-1 rounded">Ctrl+Shift+F</kbd>. Once activated, it stays visible across pages.</p>
							</div>

							<!-- API Key (read-only) -->
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-2">
									API Key
								</label>
								<div class="flex gap-2">
									<input
										type="text"
										value={site.api_key}
										readonly
										class="flex-1 px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 font-mono text-sm"
									/>
									<button
										type="button"
										onclick={() => navigator.clipboard.writeText(site?.api_key || '')}
										class="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
										title="Copy API key"
									>
										<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
										</svg>
									</button>
								</div>
								<p class="text-xs text-gray-500 mt-1">Your unique API key for this site</p>
							</div>
						{/if}

						<div class="flex justify-end">
							<button
								type="submit"
								disabled={saving}
								class="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
							>
								{#if saving}
									<span class="flex items-center gap-2">
										<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
										</svg>
										Saving...
									</span>
								{:else}
									Save Changes
								{/if}
							</button>
						</div>
					</form>
				</div>

				<!-- Crawl Settings -->
				<div class="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
					<div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
						<h2 class="text-lg font-semibold text-gray-900">Crawl Settings</h2>
						<p class="text-sm text-gray-500 mt-1">Configure URL filtering and authentication for crawling</p>
					</div>
					<div class="p-6 space-y-5">
						<!-- Exclude Patterns -->
						<div>
							<label for="excludePattern" class="block text-sm font-medium text-gray-700 mb-2">Exclude Patterns</label>
							<p class="text-xs text-gray-500 mb-2">URLs matching these patterns will be skipped during crawling (e.g. <code class="bg-gray-100 px-1 rounded">/blog/*</code>)</p>
							<div class="flex gap-2">
								<input
									type="text"
									id="excludePattern"
									bind:value={excludeInput}
									onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExcludePattern(); } }}
									placeholder="/blog/*"
									class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
								/>
								<button
									type="button"
									onclick={addExcludePattern}
									disabled={!excludeInput.trim()}
									class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
								>
									Add
								</button>
							</div>
							{#if crawlExcludePatterns.length > 0}
								<div class="flex flex-wrap gap-2 mt-3">
									{#each crawlExcludePatterns as pattern, index (pattern)}
										<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-sm text-gray-700">
											{pattern}
											<button
												type="button"
												onclick={() => removeExcludePattern(index)}
												class="text-gray-400 hover:text-gray-600 ml-1"
												title="Remove pattern"
											>&times;</button>
										</span>
									{/each}
								</div>
							{/if}
						</div>

						<!-- Include URLs -->
						<div>
							<label for="includeUrl" class="block text-sm font-medium text-gray-700 mb-2">Include URLs</label>
							<p class="text-xs text-gray-500 mb-2">Additional URLs to seed into the crawl queue (crawled alongside the base URL)</p>
							<div class="flex gap-2">
								<input
									type="text"
									id="includeUrl"
									bind:value={includeInput}
									onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIncludeUrl(); } }}
									placeholder="https://example.com/special-page"
									class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
								/>
								<button
									type="button"
									onclick={addIncludeUrl}
									disabled={!includeInput.trim()}
									class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
								>
									Add
								</button>
							</div>
							{#if crawlIncludeUrls.length > 0}
								<div class="flex flex-wrap gap-2 mt-3">
									{#each crawlIncludeUrls as url, index (url)}
										<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-sm text-gray-700 max-w-full">
											<span class="truncate">{url}</span>
											<button
												type="button"
												onclick={() => removeIncludeUrl(index)}
												class="text-gray-400 hover:text-gray-600 ml-1 shrink-0"
												title="Remove URL"
											>&times;</button>
										</span>
									{/each}
								</div>
							{/if}
						</div>

						<!-- HTTP Authentication -->
						<div class="border-t border-gray-100 pt-5">
							<h3 class="text-sm font-medium text-gray-700 mb-2">HTTP Authentication</h3>
							<p class="text-xs text-gray-500 mb-3">For password-protected staging sites (.htaccess, DDEV, etc.)</p>
							<div class="grid grid-cols-2 gap-3">
								<div>
									<label for="crawlHttpUser" class="block text-xs font-medium text-gray-600 mb-1">Username</label>
									<input
										type="text"
										id="crawlHttpUser"
										bind:value={crawlHttpUser}
										placeholder="Username"
										class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
									/>
								</div>
								<div>
									<label for="crawlHttpPassword" class="block text-xs font-medium text-gray-600 mb-1">Password</label>
									<input
										type="password"
										id="crawlHttpPassword"
										bind:value={crawlHttpPassword}
										placeholder="Password"
										class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
									/>
								</div>
							</div>
						</div>

						<div class="flex justify-end">
							<button
								type="button"
								onclick={handleCrawlSettingsSave}
								disabled={crawlSaving}
								class="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
							>
								{#if crawlSaving}
									<span class="flex items-center gap-2">
										<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
										</svg>
										Saving...
									</span>
								{:else}
									Save Crawl Settings
								{/if}
							</button>
						</div>
					</div>
				</div>

				<!-- YouTrack Integration -->
				<div class="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
					<div class="px-6 py-4 border-b border-gray-200 bg-blue-50">
						<h2 class="text-lg font-semibold text-blue-900">YouTrack Integration</h2>
						<p class="text-sm text-blue-700 mt-1">Connect feedback markers to YouTrack issues</p>
					</div>
					<div class="p-6 space-y-4">
						<div>
							<label for="yt-base-url" class="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
							<input
								type="text"
								id="yt-base-url"
								bind:value={ytBaseUrl}
								placeholder="https://track.liip.ch"
								class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							/>
						</div>
						<div>
							<label for="yt-project-id" class="block text-sm font-medium text-gray-700 mb-1">Project ID</label>
							<input
								type="text"
								id="yt-project-id"
								bind:value={ytProjectId}
								placeholder="CASG"
								class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							/>
							<p class="text-xs text-gray-500 mt-1">The short name of your YouTrack project</p>
						</div>
						<div>
							<label for="yt-token" class="block text-sm font-medium text-gray-700 mb-1">API Token</label>
							<input
								type="password"
								id="yt-token"
								bind:value={ytToken}
								placeholder="perm:xxx-xxx"
								class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
							/>
							<p class="text-xs text-gray-500 mt-1">Permanent token with YouTrack scope (read + write)</p>
						</div>

						{#if ytTestResult}
							<div class="p-3 rounded-lg text-sm" class:bg-green-50={ytTestResult.success} class:text-green-700={ytTestResult.success} class:bg-red-50={!ytTestResult.success} class:text-red-700={!ytTestResult.success}>
								{ytTestResult.message}
							</div>
						{/if}

						<div class="flex justify-end gap-3">
							<button
								type="button"
								onclick={handleYoutrackTest}
								disabled={ytTesting || !ytBaseUrl.trim() || !ytProjectId.trim() || !ytToken.trim()}
								class="px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
							>
								{#if ytTesting}
									Testing...
								{:else}
									Test Connection
								{/if}
							</button>
							<button
								type="button"
								onclick={handleYoutrackSave}
								disabled={ytSaving}
								class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
							>
								{#if ytSaving}
									Saving...
								{:else}
									Save YouTrack Settings
								{/if}
							</button>
						</div>
					</div>
				</div>

			<!-- Danger Zone -->
				<div class="mt-8 bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
					<div class="px-6 py-4 border-b border-red-200 bg-red-50">
						<h2 class="text-lg font-semibold text-red-700">Danger Zone</h2>
					</div>
					<div class="p-6">
						<div class="flex items-center justify-between">
							<div>
								<h3 class="font-medium text-gray-900">Delete this site</h3>
								<p class="text-sm text-gray-500">Permanently delete this site and all its feedback data</p>
							</div>
							<button
								onclick={handleDelete}
								disabled={deleting}
								class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
							>
								{#if deleting}
									Deleting...
								{:else}
									Delete Site
								{/if}
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</main>
</div>
