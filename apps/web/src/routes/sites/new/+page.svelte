<script lang="ts">
	import { goto } from '$app/navigation';
	import AppHeader from '$lib/components/ui/AppHeader.svelte';
	import { getSupabase } from '$lib/services/supabase';
	import { extractDomain } from '$lib/utils/parseUrl';

	let name = $state('');
	let domain = $state('');
	let creating = $state(false);
	let error = $state<string | null>(null);
	let createdSite = $state<{ id: string; api_key: string } | null>(null);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!name.trim() || !domain.trim() || creating) return;

		creating = true;
		error = null;

		try {
			const cleanDomain = extractDomain(domain.trim());

			const supabase = getSupabase();
			const { data, error: createError } = await supabase
				.from('sites')
				.insert({
					name: name.trim(),
					domain: cleanDomain,
					settings: {}
				})
				.select('id, api_key')
				.single();

			if (createError) throw createError;

			createdSite = data;
		} catch (e) {
			console.error('Failed to create site:', e);
			error = e instanceof Error ? e.message : 'Failed to create site';
		} finally {
			creating = false;
		}
	}

	function copyWidgetCode() {
		if (!createdSite) return;
		const code = `<script src="https://sitemap-presenter.netlify.app/widget.js" data-api-key="${createdSite.api_key}" async><\/script>`;
		navigator.clipboard.writeText(code);
	}

	function goToSite() {
		if (createdSite) {
			goto(`/sites/${createdSite.id}/map`);
		}
	}
</script>

<svelte:head>
	<title>Create New Site - Sitemap Presenter</title>
</svelte:head>

<div class="h-screen w-screen bg-gray-50 flex flex-col">
	<AppHeader showNewSite={false} />

	<main class="flex-1 overflow-auto p-6">
		<div class="max-w-lg mx-auto">
			{#if !createdSite}
				<!-- Create form -->
				<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
					<h1 class="text-xl font-bold text-gray-900 mb-6">Create New Site</h1>

					<form onsubmit={handleSubmit} class="space-y-4">
						<div>
							<label for="name" class="block text-sm font-medium text-gray-700 mb-1">
								Site Name
							</label>
							<input
								type="text"
								id="name"
								bind:value={name}
								placeholder="My Website"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
								required
							/>
						</div>

						<div>
							<label for="domain" class="block text-sm font-medium text-gray-700 mb-1">
								Domain
							</label>
							<input
								type="text"
								id="domain"
								bind:value={domain}
								placeholder="example.com or https://example.com"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
								required
							/>
							<p class="text-xs text-gray-500 mt-1">Enter the domain of the website you want to crawl</p>
						</div>

						{#if error}
							<div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
								{error}
							</div>
						{/if}

						<div class="flex gap-3 pt-2">
							<a
								href="/"
								class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-center"
							>
								Cancel
							</a>
							<button
								type="submit"
								disabled={!name.trim() || !domain.trim() || creating}
								class="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
							>
								{#if creating}
									<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									Creating...
								{:else}
									Create Site
								{/if}
							</button>
						</div>
					</form>
				</div>
			{:else}
				<!-- Success state with widget code -->
				<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
					<div class="flex items-center gap-3 mb-6">
						<div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
							<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
							</svg>
						</div>
						<div>
							<h1 class="text-xl font-bold text-gray-900">Site Created!</h1>
							<p class="text-gray-500">{name}</p>
						</div>
					</div>

					<p class="text-gray-600 mb-4">
						To collect feedback from visitors, add this widget script to your website:
					</p>

					<div class="bg-gray-900 rounded-lg p-4 mb-4 relative group">
						<pre class="text-sm text-green-400 overflow-x-auto"><code>&lt;script src="https://sitemap-presenter.netlify.app/widget.js"
  data-api-key="{createdSite.api_key}" async&gt;&lt;/script&gt;</code></pre>
						<button
							onclick={copyWidgetCode}
							class="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
							title="Copy to clipboard"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
							</svg>
						</button>
					</div>

					<p class="text-sm text-gray-500 mb-2">
						Once installed, visitors can click anywhere on your site to leave feedback markers.
					</p>
					<p class="text-xs text-gray-500 mb-6">Widget is hidden by default. Append <code class="bg-gray-100 px-1 rounded">?feedback=on</code> to any page URL to activate, or press <kbd class="bg-gray-100 px-1 rounded">Ctrl+Shift+F</kbd>. Once activated, it stays visible across pages.</p>

					<div class="flex gap-3">
						<button
							onclick={copyWidgetCode}
							class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
							</svg>
							Copy Code
						</button>
						<button
							onclick={goToSite}
							class="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
						>
							Start Crawling
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
							</svg>
						</button>
					</div>
				</div>
			{/if}
		</div>
	</main>
</div>
