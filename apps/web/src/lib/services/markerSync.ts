import { feedbackStore } from '$lib/stores/feedback.svelte';
import { projectsStore } from '$lib/stores/projects.svelte';
import type { FeedbackMarker } from '$lib/types';

/**
 * Bridges Supabase feedback data with the project store cache.
 * Handles initialization, page filtering, and caching markers on nodes.
 */
export const markerSync = {
	/** Initialize feedback store for a project's site and set the current page. */
	async initialize(projectId: string, pageUrl: string): Promise<boolean> {
		const project = projectsStore.getProject(projectId);
		if (!project?.siteId) return false;

		const success = await feedbackStore.initializeBySiteId(project.siteId);
		if (success) {
			this.setCurrentPage(pageUrl);
		}
		return success;
	},

	/** Update the feedback store's current page filter from a full URL. */
	setCurrentPage(pageUrl: string): void {
		try {
			const url = new URL(pageUrl);
			feedbackStore.setCurrentPage(url.pathname);
		} catch {
			// Invalid URL
		}
	},

	/** Save markers to the project store cache (for node badge display). */
	saveToProjectCache(projectId: string, pageUrl: string, markers: FeedbackMarker[]): void {
		try {
			const url = new URL(pageUrl);
			const pagePath = url.pathname;
			const project = projectsStore.getProject(projectId);
			const existingMarkers = project?.cachedData?.feedbackMarkers || {};

			projectsStore.saveFeedbackMarkers(projectId, {
				...existingMarkers,
				[pagePath]: markers
			});
		} catch (e) {
			console.error('Failed to save feedback markers:', e);
		}
	}
};
