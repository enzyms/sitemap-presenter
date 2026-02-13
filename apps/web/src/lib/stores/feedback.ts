import { writable, get, derived } from 'svelte/store';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
	getSupabase,
	type Site,
	type Marker,
	type MarkerWithComments,
	type Comment,
	type MarkerStatus
} from '$lib/services/supabase';

interface FeedbackState {
	site: Site | null;
	markers: MarkerWithComments[];
	loading: boolean;
	error: string | null;
	currentPagePath: string | null;
}

function createFeedbackStore() {
	const state = writable<FeedbackState>({
		site: null,
		markers: [],
		loading: false,
		error: null,
		currentPagePath: null
	});

	let realtimeChannel: RealtimeChannel | null = null;
	const supabase = getSupabase();

	// Derived stores for convenience
	const site = derived(state, ($state) => $state.site);
	const markers = derived(state, ($state) => $state.markers);
	const loading = derived(state, ($state) => $state.loading);
	const error = derived(state, ($state) => $state.error);

	const markersForCurrentPage = derived(state, ($state) => {
		if (!$state.currentPagePath) return $state.markers;
		return $state.markers.filter((m) => m.page_path === $state.currentPagePath);
	});

	const openCount = derived(markers, ($markers) => $markers.filter((m) => m.status === 'open').length);

	const resolvedCount = derived(
		markers,
		($markers) => $markers.filter((m) => m.status === 'resolved').length
	);

	// Initialize with a site (by API key or site ID)
	async function initializeBySiteId(siteId: string): Promise<boolean> {
		state.update((s) => ({ ...s, loading: true, error: null }));

		try {
			const { data: siteData, error: siteError } = await supabase
				.from('sites')
				.select('*')
				.eq('id', siteId)
				.single();

			if (siteError) throw siteError;

			state.update((s) => ({ ...s, site: siteData, loading: false }));

			// Load all markers for this site
			await loadMarkers();

			// Subscribe to realtime updates
			subscribeToRealtime(siteId);

			return true;
		} catch (e) {
			console.error('Failed to initialize site:', e);
			state.update((s) => ({
				...s,
				loading: false,
				error: e instanceof Error ? e.message : 'Failed to load site'
			}));
			return false;
		}
	}

	async function initializeByApiKey(apiKey: string): Promise<boolean> {
		state.update((s) => ({ ...s, loading: true, error: null }));

		try {
			const { data: siteData, error: siteError } = await supabase
				.from('sites')
				.select('*')
				.eq('api_key', apiKey)
				.single();

			if (siteError) throw siteError;

			state.update((s) => ({ ...s, site: siteData, loading: false }));

			// Load all markers for this site
			await loadMarkers();

			// Subscribe to realtime updates
			subscribeToRealtime(siteData.id);

			return true;
		} catch (e) {
			console.error('Failed to initialize site:', e);
			state.update((s) => ({
				...s,
				loading: false,
				error: e instanceof Error ? e.message : 'Failed to load site'
			}));
			return false;
		}
	}

	// Load all markers for the current site
	async function loadMarkers(pagePath?: string): Promise<void> {
		const currentState = get(state);
		if (!currentState.site) return;

		state.update((s) => ({ ...s, loading: true, error: null }));

		try {
			let query = supabase
				.from('markers')
				.select(
					`
					*,
					comments (*)
				`
				)
				.eq('site_id', currentState.site.id)
				.order('number', { ascending: true });

			if (pagePath) {
				query = query.eq('page_path', pagePath);
			}

			const { data, error: fetchError } = await query;

			if (fetchError) throw fetchError;

			const markersWithComments: MarkerWithComments[] = (data || []).map((m) => ({
				...m,
				comments: m.comments || []
			}));

			state.update((s) => ({
				...s,
				markers: markersWithComments,
				currentPagePath: pagePath || null,
				loading: false
			}));
		} catch (e) {
			console.error('Failed to load markers:', e);
			state.update((s) => ({
				...s,
				loading: false,
				error: e instanceof Error ? e.message : 'Failed to load markers'
			}));
		}
	}

	// Set current page filter
	function setCurrentPage(pagePath: string | null): void {
		state.update((s) => ({ ...s, currentPagePath: pagePath }));
	}

	// Create a new marker
	async function createMarker(data: {
		page_url: string;
		page_path: string;
		page_title?: string;
		anchor: Marker['anchor'];
		fallback_position: Marker['fallback_position'];
		viewport: Marker['viewport'];
		initial_comment?: string;
	}): Promise<MarkerWithComments | null> {
		const currentState = get(state);
		if (!currentState.site) return null;

		try {
			// Get next number
			const { data: numberData } = await supabase.rpc('get_next_marker_number', {
				p_site_id: currentState.site.id,
				p_page_path: data.page_path
			});

			const number = numberData || 1;

			// Create marker
			const { data: marker, error: createError } = await supabase
				.from('markers')
				.insert({
					site_id: currentState.site.id,
					page_url: data.page_url,
					page_path: data.page_path,
					page_title: data.page_title || null,
					number,
					anchor: data.anchor,
					fallback_position: data.fallback_position,
					viewport: data.viewport,
					status: 'open'
				})
				.select('*')
				.single();

			if (createError) throw createError;

			// Add initial comment if provided
			let comments: Comment[] = [];
			if (data.initial_comment) {
				const { data: comment } = await supabase
					.from('comments')
					.insert({
						marker_id: marker.id,
						content: data.initial_comment
					})
					.select('*')
					.single();

				if (comment) {
					comments = [comment];
				}
			}

			const newMarker: MarkerWithComments = {
				...marker,
				comments
			};

			// Add to local state
			state.update((s) => ({
				...s,
				markers: [...s.markers, newMarker]
			}));

			return newMarker;
		} catch (e) {
			console.error('Failed to create marker:', e);
			return null;
		}
	}

	// Update marker status
	async function updateMarkerStatus(markerId: string, status: MarkerStatus): Promise<boolean> {
		const currentState = get(state);
		if (!currentState.site) return false;

		try {
			const { error: updateError } = await supabase
				.from('markers')
				.update({ status })
				.eq('id', markerId)
				.eq('site_id', currentState.site.id);

			if (updateError) throw updateError;

			// Update local state
			state.update((s) => ({
				...s,
				markers: s.markers.map((m) => (m.id === markerId ? { ...m, status } : m))
			}));

			return true;
		} catch (e) {
			console.error('Failed to update marker:', e);
			return false;
		}
	}

	// Delete a marker
	async function deleteMarker(markerId: string): Promise<boolean> {
		const currentState = get(state);
		if (!currentState.site) return false;

		try {
			const { error: deleteError } = await supabase
				.from('markers')
				.delete()
				.eq('id', markerId)
				.eq('site_id', currentState.site.id);

			if (deleteError) throw deleteError;

			// Update local state
			state.update((s) => ({
				...s,
				markers: s.markers.filter((m) => m.id !== markerId)
			}));

			return true;
		} catch (e) {
			console.error('Failed to delete marker:', e);
			return false;
		}
	}

	// Add a comment to a marker
	async function addComment(markerId: string, content: string, authorName?: string): Promise<Comment | null> {
		try {
			const { data: comment, error: createError } = await supabase
				.from('comments')
				.insert({
					marker_id: markerId,
					content,
					author_name: authorName || null
				})
				.select('*')
				.single();

			if (createError) throw createError;

			// Update local state
			state.update((s) => ({
				...s,
				markers: s.markers.map((m) => {
					if (m.id === markerId) {
						return { ...m, comments: [...m.comments, comment] };
					}
					return m;
				})
			}));

			return comment;
		} catch (e) {
			console.error('Failed to add comment:', e);
			return null;
		}
	}

	// Subscribe to realtime updates
	function subscribeToRealtime(siteId: string): void {
		// Unsubscribe from existing channel
		if (realtimeChannel) {
			supabase.removeChannel(realtimeChannel);
		}

		realtimeChannel = supabase
			.channel(`feedback-dashboard-${siteId}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'markers',
					filter: `site_id=eq.${siteId}`
				},
				(payload) => {
					const eventType = payload.eventType;
					const marker = payload.new as Marker | null;
					const oldMarker = payload.old as Marker | null;

					if (eventType === 'INSERT' && marker) {
						// Check if marker already exists (might have been added locally)
						state.update((s) => {
							if (s.markers.find((m) => m.id === marker.id)) return s;
							return {
								...s,
								markers: [...s.markers, { ...marker, comments: [] }]
							};
						});
					} else if (eventType === 'UPDATE' && marker) {
						state.update((s) => ({
							...s,
							markers: s.markers.map((m) => (m.id === marker.id ? { ...m, ...marker } : m))
						}));
					} else if (eventType === 'DELETE' && oldMarker) {
						state.update((s) => ({
							...s,
							markers: s.markers.filter((m) => m.id !== oldMarker.id)
						}));
					}
				}
			)
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'comments'
				},
				(payload) => {
					const comment = payload.new as Comment;

					state.update((s) => ({
						...s,
						markers: s.markers.map((m) => {
							if (m.id === comment.marker_id) {
								// Check if comment already exists
								if (m.comments.find((c) => c.id === comment.id)) return m;
								return { ...m, comments: [...m.comments, comment] };
							}
							return m;
						})
					}));
				}
			)
			.subscribe();
	}

	// Cleanup
	function destroy(): void {
		if (realtimeChannel) {
			supabase.removeChannel(realtimeChannel);
			realtimeChannel = null;
		}
		state.set({
			site: null,
			markers: [],
			loading: false,
			error: null,
			currentPagePath: null
		});
	}

	// Get marker by ID
	function getMarker(markerId: string): MarkerWithComments | undefined {
		return get(state).markers.find((m) => m.id === markerId);
	}

	return {
		// Stores
		subscribe: state.subscribe,
		site,
		markers,
		loading,
		error,
		markersForCurrentPage,
		openCount,
		resolvedCount,

		// Methods
		initializeBySiteId,
		initializeByApiKey,
		loadMarkers,
		setCurrentPage,
		createMarker,
		updateMarkerStatus,
		deleteMarker,
		addComment,
		getMarker,
		destroy
	};
}

export const feedbackStore = createFeedbackStore();
