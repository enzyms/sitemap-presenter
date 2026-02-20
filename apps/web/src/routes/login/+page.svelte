<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';

	const { form } = $props();

	const error = $derived(form?.error || ($page.url.searchParams.get('error') === 'unauthorized' ? 'This email is not authorized.' : null));
	const success = $derived(form?.success);
	const sentEmail = $derived(form?.email);
</script>

<div class="min-h-screen bg-gray-50 flex items-center justify-center">
	<div class="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
		<div class="flex flex-col items-center gap-6">
			<div class="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
				<svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
				</svg>
			</div>
			<div class="text-center">
				<h1 class="text-xl font-bold text-gray-800">Sitemap Presenter</h1>
				<p class="text-sm text-gray-500 mt-1">Sign in to continue</p>
			</div>

			{#if error}
				<div class="w-full bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
					{error}
				</div>
			{/if}

			{#if success}
				<div class="w-full bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
					Magic link sent to <strong>{sentEmail}</strong>. Check your inbox.
				</div>
			{:else}
				<form method="POST" use:enhance class="w-full flex flex-col gap-3">
					<input
						type="email"
						name="email"
						placeholder="you@email.com"
						value={form?.email ?? ''}
						required
						class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
					/>
					<button
						type="submit"
						class="w-full px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
					>
						Send magic link
					</button>
				</form>
			{/if}
		</div>
	</div>
</div>
