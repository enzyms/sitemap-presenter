<script lang="ts">
	import { page } from '$app/stores';
	interface Props {
		siteName?: string;
		siteId?: string;
		showNewSite?: boolean;
	}

	let { siteName, siteId, showNewSite = true }: Props = $props();

	// Determine current section from URL
	let currentSection = $derived.by(() => {
		const path = $page.url.pathname;
		if (path === '/') return 'home';
		if (path.includes('/map')) return 'map';
		if (path.includes('/feedbacks')) return 'feedback';
		if (path.includes('/settings')) return 'settings';
		return 'sites';
	});

</script>

<header class="bg-white border-b border-gray-200 px-4 py-3 flex items-center z-10 shadow-sm">
	<!-- Left: Logo + Site name -->
	<div class="flex items-center gap-1	 flex-1">
		<a href="/" class="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
			<div class="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center">
				<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
				</svg>
			</div>
			<span class="font-bold text-gray-800">Feedbacks</span>
		</a>

		{#if siteName}
			<div class="flex items-center gap-1 text-gray-400">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 -1 24 23">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
				<span class="text-gray-800 font-medium">{siteName}</span>
			</div>
		{/if}
	</div>

	<!-- Center: Navigation tabs (when on a site page) -->
	{#if siteId}
		<div class="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
			<a
				href="/sites/{siteId}/map"
				class="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
				class:bg-white={currentSection === 'map'}
				class:text-orange-600={currentSection === 'map'}
				class:shadow-sm={currentSection === 'map'}
				class:text-gray-600={currentSection !== 'map'}
				class:hover:text-gray-800={currentSection !== 'map'}
			>
				<span class="flex items-center gap-2">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
					</svg>
					Map
				</span>
			</a>
			<a
				href="/sites/{siteId}/feedbacks"
				class="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
				class:bg-white={currentSection === 'feedback'}
				class:text-orange-600={currentSection === 'feedback'}
				class:shadow-sm={currentSection === 'feedback'}
				class:text-gray-600={currentSection !== 'feedback'}
				class:hover:text-gray-800={currentSection !== 'feedback'}
			>
				<span class="flex items-center gap-2">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
					</svg>
					Feedback
				</span>
			</a>
			<a
				href="/sites/{siteId}/settings"
				class="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
				class:bg-white={currentSection === 'settings'}
				class:text-orange-600={currentSection === 'settings'}
				class:shadow-sm={currentSection === 'settings'}
				class:text-gray-600={currentSection !== 'settings'}
				class:hover:text-gray-800={currentSection !== 'settings'}
			>
				<span class="flex items-center gap-2">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
					Settings
				</span>
			</a>
		</div>
	{/if}

	<!-- Right: Actions -->
	<div class="flex items-center gap-3 flex-1 justify-end">
		{#if showNewSite}
			<a
				href="/sites/new"
				class="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				New Site
			</a>
		{/if}
		<form method="POST" action="/auth/signout">
			<button
				type="submit"
				class="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
				title="Sign out"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
				</svg>
			</button>
		</form>
	</div>
</header>
