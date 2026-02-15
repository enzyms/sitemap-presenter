import type { RealtimeChannel } from '@supabase/supabase-js';
import {
	getSupabase,
	type Site,
	type Marker,
	type MarkerWithComments,
	type Comment,
	type MarkerStatus
} from '$lib/services/supabase';

class FeedbackStore {
	site = $state<Site | null>(null);
	markers = $state<MarkerWithComments[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);
	currentPagePath = $state<string | null>(null);

	private realtimeChannel: RealtimeChannel | null = null;
	private supabase = getSupabase();

	// Derived values
	markersForCurrentPage = $derived.by(() => {
		if (!this.currentPagePath) return this.markers;
		return this.markers.filter((m) => m.page_path === this.currentPagePath);
	});

	openCount = $derived.by(() => this.markers.filter((m) => m.status === 'open').length);

	resolvedCount = $derived.by(() => this.markers.filter((m) => m.status === 'resolved').length);

	async initializeBySiteId(siteId: string): Promise<boolean> {
		this.loading = true;
		this.error = null;

		try {
			const { data: siteData, error: siteError } = await this.supabase
				.from('sites')
				.select('*')
				.eq('id', siteId)
				.single();

			if (siteError) throw siteError;

			this.site = siteData;
			this.loading = false;

			await this.loadMarkers();
			this.subscribeToRealtime(siteId);

			return true;
		} catch (e) {
			console.error('Failed to initialize site:', e);
			this.loading = false;
			this.error = e instanceof Error ? e.message : 'Failed to load site';
			return false;
		}
	}

	async initializeByApiKey(apiKey: string): Promise<boolean> {
		this.loading = true;
		this.error = null;

		try {
			const { data: siteData, error: siteError } = await this.supabase
				.from('sites')
				.select('*')
				.eq('api_key', apiKey)
				.single();

			if (siteError) throw siteError;

			this.site = siteData;
			this.loading = false;

			await this.loadMarkers();
			this.subscribeToRealtime(siteData.id);

			return true;
		} catch (e) {
			console.error('Failed to initialize site:', e);
			this.loading = false;
			this.error = e instanceof Error ? e.message : 'Failed to load site';
			return false;
		}
	}

	async loadMarkers(pagePath?: string): Promise<void> {
		if (!this.site) return;

		this.loading = true;
		this.error = null;

		try {
			let query = this.supabase
				.from('markers')
				.select(
					`
					*,
					comments (*)
				`
				)
				.eq('site_id', this.site.id)
				.order('number', { ascending: true });

			if (pagePath) {
				query = query.eq('page_path', pagePath);
			}

			const { data, error: fetchError } = await query;

			if (fetchError) throw fetchError;

			this.markers = (data || []).map((m) => ({
				...m,
				comments: m.comments || []
			}));
			this.currentPagePath = pagePath || null;
			this.loading = false;
		} catch (e) {
			console.error('Failed to load markers:', e);
			this.loading = false;
			this.error = e instanceof Error ? e.message : 'Failed to load markers';
		}
	}

	setCurrentPage(pagePath: string | null): void {
		this.currentPagePath = pagePath;
	}

	async createMarker(data: {
		page_url: string;
		page_path: string;
		page_title?: string;
		anchor: Marker['anchor'];
		fallback_position: Marker['fallback_position'];
		viewport: Marker['viewport'];
		initial_comment?: string;
	}): Promise<MarkerWithComments | null> {
		if (!this.site) return null;

		try {
			const { data: numberData } = await this.supabase.rpc('get_next_marker_number', {
				p_site_id: this.site.id,
				p_page_path: data.page_path
			});

			const number = numberData || 1;

			const { data: marker, error: createError } = await this.supabase
				.from('markers')
				.insert({
					site_id: this.site.id,
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

			let comments: Comment[] = [];
			if (data.initial_comment) {
				const { data: comment } = await this.supabase
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

			this.markers = [...this.markers, newMarker];

			return newMarker;
		} catch (e) {
			console.error('Failed to create marker:', e);
			return null;
		}
	}

	async updateMarkerStatus(markerId: string, status: MarkerStatus): Promise<boolean> {
		if (!this.site) return false;

		try {
			const { error: updateError } = await this.supabase
				.from('markers')
				.update({ status })
				.eq('id', markerId)
				.eq('site_id', this.site.id);

			if (updateError) throw updateError;

			this.markers = this.markers.map((m) => (m.id === markerId ? { ...m, status } : m));

			return true;
		} catch (e) {
			console.error('Failed to update marker:', e);
			return false;
		}
	}

	async deleteMarker(markerId: string): Promise<boolean> {
		if (!this.site) return false;

		try {
			const { error: deleteError } = await this.supabase
				.from('markers')
				.delete()
				.eq('id', markerId)
				.eq('site_id', this.site.id);

			if (deleteError) throw deleteError;

			this.markers = this.markers.filter((m) => m.id !== markerId);

			return true;
		} catch (e) {
			console.error('Failed to delete marker:', e);
			return false;
		}
	}

	async addComment(markerId: string, content: string, authorName?: string): Promise<Comment | null> {
		try {
			const { data: comment, error: createError } = await this.supabase
				.from('comments')
				.insert({
					marker_id: markerId,
					content,
					author_name: authorName || null
				})
				.select('*')
				.single();

			if (createError) throw createError;

			this.markers = this.markers.map((m) => {
				if (m.id === markerId) {
					return { ...m, comments: [...m.comments, comment] };
				}
				return m;
			});

			return comment;
		} catch (e) {
			console.error('Failed to add comment:', e);
			return null;
		}
	}

	private subscribeToRealtime(siteId: string): void {
		if (this.realtimeChannel) {
			this.supabase.removeChannel(this.realtimeChannel);
		}

		this.realtimeChannel = this.supabase
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
						if (!this.markers.find((m) => m.id === marker.id)) {
							this.markers = [...this.markers, { ...marker, comments: [] }];
						}
					} else if (eventType === 'UPDATE' && marker) {
						this.markers = this.markers.map((m) =>
							m.id === marker.id ? { ...m, ...marker } : m
						);
					} else if (eventType === 'DELETE' && oldMarker) {
						this.markers = this.markers.filter((m) => m.id !== oldMarker.id);
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

					this.markers = this.markers.map((m) => {
						if (m.id === comment.marker_id) {
							if (m.comments.find((c) => c.id === comment.id)) return m;
							return { ...m, comments: [...m.comments, comment] };
						}
						return m;
					});
				}
			)
			.subscribe();
	}

	destroy(): void {
		if (this.realtimeChannel) {
			this.supabase.removeChannel(this.realtimeChannel);
			this.realtimeChannel = null;
		}
		this.site = null;
		this.markers = [];
		this.loading = false;
		this.error = null;
		this.currentPagePath = null;
	}

	getMarker(markerId: string): MarkerWithComments | undefined {
		return this.markers.find((m) => m.id === markerId);
	}
}

export const feedbackStore = new FeedbackStore();
