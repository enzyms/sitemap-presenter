import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type {
  Site,
  Marker,
  Comment,
  AnonymousUser,
  MarkerWithComments,
  CreateMarkerRequest,
  CreateCommentRequest,
  UpdateMarkerRequest,
  ElementAnchor,
  FallbackPosition,
  ViewportInfo,
  MarkerStatus,
  SESSION_STORAGE_KEY
} from '@sitemap-presenter/shared';

// Default Supabase configuration (injected at build time)
const DEFAULT_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://bgjeaqpvsgfsfacnsilu.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const SESSION_KEY = 'feedback-widget-session';

export class FeedbackAPI {
  private supabase: SupabaseClient;
  private siteId: string | null = null;
  private sessionId: string | null = null;
  private userId: string | null = null;
  private realtimeChannel: RealtimeChannel | null = null;
  private defaultName: string | null = null;

  constructor(supabaseUrl?: string, supabaseAnonKey?: string) {
    this.supabase = createClient(
      supabaseUrl || DEFAULT_SUPABASE_URL,
      supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY
    );
    this.loadOrCreateSession();
  }

  // ============================================================
  // Session management
  // ============================================================

  private loadOrCreateSession(): void {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.sessionId = data.sessionId;
        this.userId = data.userId;
        return;
      }
    } catch {
      // Ignore parse errors
    }

    // Create new session ID
    this.sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    this.saveSession();
  }

  private saveSession(): void {
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          sessionId: this.sessionId,
          userId: this.userId
        })
      );
    } catch {
      // sessionStorage might not be available
    }
  }

  getUserId(): string | null {
    return this.userId;
  }

  setDefaultName(name: string | null): void {
    this.defaultName = name;
  }

  async updateUserName(name: string): Promise<void> {
    if (!this.userId) return;
    const { error } = await this.supabase
      .from('anonymous_users')
      .update({ name })
      .eq('id', this.userId);
    if (error) {
      console.error('Failed to update user name:', error);
    }
  }

  private async ensureUser(name?: string, email?: string): Promise<string> {
    if (this.userId) return this.userId;

    // Check if user exists for this session
    const { data: existing } = await this.supabase
      .from('anonymous_users')
      .select('id')
      .eq('session_id', this.sessionId)
      .single();

    if (existing) {
      this.userId = existing.id;
      this.saveSession();
      return this.userId!;
    }

    // Create new anonymous user
    const { data: created, error } = await this.supabase
      .from('anonymous_users')
      .insert({
        session_id: this.sessionId,
        name: name || this.defaultName || null,
        email: email || null,
        user_agent: navigator.userAgent
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to create anonymous user:', error);
      throw new Error('Failed to create user session');
    }

    this.userId = created.id;
    this.saveSession();
    return this.userId!;
  }

  // ============================================================
  // Site initialization
  // ============================================================

  async initializeSite(apiKey: string): Promise<Site | null> {
    const { data, error } = await this.supabase
      .from('sites')
      .select('*')
      .eq('api_key', apiKey)
      .single();

    if (error) {
      console.error('Failed to load site:', error);
      return null;
    }

    this.siteId = data.id;
    return data as Site;
  }

  getSiteId(): string | null {
    return this.siteId;
  }

  // ============================================================
  // Markers CRUD
  // ============================================================

  async getMarkers(pagePath?: string): Promise<MarkerWithComments[]> {
    if (!this.siteId) throw new Error('Site not initialized');

    let query = this.supabase
      .from('markers')
      .select(`
        *,
        comments (*)
      `)
      .eq('site_id', this.siteId)
      .order('number', { ascending: true });

    if (pagePath) {
      query = query.eq('page_path', pagePath);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch markers:', error);
      throw error;
    }

    return (data || []).map(marker => ({
      ...marker,
      comments: marker.comments || []
    })) as MarkerWithComments[];
  }

  async createMarker(request: CreateMarkerRequest): Promise<MarkerWithComments> {
    if (!this.siteId) throw new Error('Site not initialized');

    const userId = await this.ensureUser();

    // Get next marker number for this page
    const { data: numberData } = await this.supabase
      .rpc('get_next_marker_number', {
        p_site_id: this.siteId,
        p_page_path: request.page_path
      });

    const number = numberData || 1;

    // Create marker
    const { data: marker, error } = await this.supabase
      .from('markers')
      .insert({
        site_id: this.siteId,
        author_id: userId,
        page_url: request.page_url,
        page_path: request.page_path,
        page_title: request.page_title || null,
        number,
        anchor: request.anchor,
        fallback_position: request.fallback_position,
        viewport: request.viewport,
        status: 'open'
      })
      .select('*')
      .single();

    if (error) {
      console.error('Failed to create marker:', error);
      throw error;
    }

    // Add initial comment if provided
    let comments: Comment[] = [];
    if (request.initial_comment) {
      const { data: comment } = await this.supabase
        .from('comments')
        .insert({
          marker_id: marker.id,
          author_id: userId,
          content: request.initial_comment
        })
        .select('*')
        .single();

      if (comment) {
        comments = [comment as Comment];
      }
    }

    return {
      ...marker,
      comments
    } as MarkerWithComments;
  }

  async updateMarker(markerId: string, request: UpdateMarkerRequest): Promise<Marker> {
    if (!this.siteId) throw new Error('Site not initialized');

    const updates: Record<string, unknown> = {};
    if (request.status !== undefined) updates.status = request.status;
    if (request.anchor !== undefined) updates.anchor = request.anchor;
    if (request.fallback_position !== undefined) updates.fallback_position = request.fallback_position;
    if (request.viewport !== undefined) updates.viewport = request.viewport;

    const { data, error } = await this.supabase
      .from('markers')
      .update(updates)
      .eq('id', markerId)
      .eq('site_id', this.siteId)
      .select('*')
      .single();

    if (error) {
      console.error('Failed to update marker:', error);
      throw error;
    }

    return data as Marker;
  }

  async deleteMarker(markerId: string): Promise<void> {
    if (!this.siteId) throw new Error('Site not initialized');

    const { error } = await this.supabase
      .from('markers')
      .delete()
      .eq('id', markerId)
      .eq('site_id', this.siteId);

    if (error) {
      console.error('Failed to delete marker:', error);
      throw error;
    }
  }

  // ============================================================
  // Comments CRUD
  // ============================================================

  async createComment(request: CreateCommentRequest): Promise<Comment> {
    if (!this.siteId) throw new Error('Site not initialized');

    const userId = await this.ensureUser();

    const { data, error } = await this.supabase
      .from('comments')
      .insert({
        marker_id: request.marker_id,
        author_id: userId,
        author_name: request.author_name || null,
        content: request.content
      })
      .select('*')
      .single();

    if (error) {
      console.error('Failed to create comment:', error);
      throw error;
    }

    return data as Comment;
  }

  async getComments(markerId: string): Promise<Comment[]> {
    const { data, error } = await this.supabase
      .from('comments')
      .select('*')
      .eq('marker_id', markerId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch comments:', error);
      throw error;
    }

    return (data || []) as Comment[];
  }

  // ============================================================
  // Realtime subscriptions
  // ============================================================

  subscribeToMarkers(
    pagePath: string,
    onMarkerChange: (eventType: 'INSERT' | 'UPDATE' | 'DELETE', marker: Marker | null) => void,
    onCommentChange: (eventType: 'INSERT' | 'UPDATE' | 'DELETE', comment: Comment | null) => void
  ): () => void {
    if (!this.siteId) {
      console.error('Cannot subscribe: Site not initialized');
      return () => {};
    }

    const channelName = `feedback-${this.siteId}-${pagePath.replace(/\//g, '-')}`;

    this.realtimeChannel = this.supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'markers',
          filter: `site_id=eq.${this.siteId}`
        },
        (payload) => {
          const marker = (payload.new || payload.old) as Marker | null;
          // Only notify for markers on current page
          if (marker && marker.page_path === pagePath) {
            onMarkerChange(
              payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
              payload.eventType === 'DELETE' ? payload.old as Marker : marker
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments'
        },
        (payload) => {
          onCommentChange(
            payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            payload.eventType === 'DELETE' ? payload.old as Comment : payload.new as Comment
          );
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      if (this.realtimeChannel) {
        this.supabase.removeChannel(this.realtimeChannel);
        this.realtimeChannel = null;
      }
    };
  }

  // ============================================================
  // Cleanup
  // ============================================================

  destroy(): void {
    if (this.realtimeChannel) {
      this.supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }
}

// Singleton instance for the widget
let apiInstance: FeedbackAPI | null = null;

export function getAPI(supabaseUrl?: string, supabaseAnonKey?: string): FeedbackAPI {
  if (!apiInstance) {
    apiInstance = new FeedbackAPI(supabaseUrl, supabaseAnonKey);
  }
  return apiInstance;
}

export function resetAPI(): void {
  if (apiInstance) {
    apiInstance.destroy();
    apiInstance = null;
  }
}
