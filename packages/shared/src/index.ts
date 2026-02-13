// ============================================================
// Shared types for Feedback Widget system
// Used by both the embeddable widget and the dashboard
// ============================================================

// ============================================================
// Database types (matching Supabase schema)
// ============================================================

export interface Site {
  id: string;
  name: string;
  domain: string;
  api_key: string;
  settings: SiteSettings;
  created_at: string;
  updated_at: string;
}

export interface SiteSettings {
  /** Widget primary color */
  primaryColor?: string;
  /** Widget position on screen */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Whether to show the floating button */
  showButton?: boolean;
  /** Custom button text */
  buttonText?: string;
  /** Allowed domains (for CORS) */
  allowedDomains?: string[];
}

export interface AnonymousUser {
  id: string;
  session_id: string;
  name: string | null;
  email: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface Marker {
  id: string;
  site_id: string;
  author_id: string | null;
  page_url: string;
  page_path: string;
  page_title: string | null;
  number: number;
  anchor: ElementAnchor;
  fallback_position: FallbackPosition;
  viewport: ViewportInfo;
  status: MarkerStatus;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  marker_id: string;
  author_id: string | null;
  author_name: string | null;
  content: string;
  created_at: string;
}

// ============================================================
// Nested types
// ============================================================

export type MarkerStatus = 'open' | 'resolved';

export interface ElementAnchor {
  /** CSS selector to find the element */
  selector: string;
  /** XPath as fallback */
  xpath: string;
  /** Inner text snippet for verification */
  innerText?: string;
  /** Tag name (e.g., 'DIV', 'BUTTON') */
  tagName: string;
  /** Click offset X within element */
  offsetX: number;
  /** Click offset Y within element */
  offsetY: number;
}

export interface FallbackPosition {
  /** X position as percentage of viewport width */
  xPercent: number;
  /** Y position as percentage of viewport height */
  yPercent: number;
}

export interface ViewportInfo {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
  devicePixelRatio: number;
  timestamp: string;
}

// ============================================================
// Extended types with relations (for UI)
// ============================================================

/** Marker with its comments loaded */
export interface MarkerWithComments extends Marker {
  comments: Comment[];
  author?: AnonymousUser | null;
}

/** Site with statistics */
export interface SiteWithStats extends Site {
  marker_count: number;
  open_count: number;
  resolved_count: number;
}

// ============================================================
// API Request/Response types
// ============================================================

export interface CreateMarkerRequest {
  page_url: string;
  page_path: string;
  page_title?: string;
  anchor: ElementAnchor;
  fallback_position: FallbackPosition;
  viewport: ViewportInfo;
  initial_comment?: string;
}

export interface CreateCommentRequest {
  marker_id: string;
  content: string;
  author_name?: string;
}

export interface UpdateMarkerRequest {
  status?: MarkerStatus;
}

// ============================================================
// Widget configuration
// ============================================================

export interface WidgetConfig {
  /** API key for the site */
  apiKey: string;
  /** Supabase URL (optional, uses default if not provided) */
  supabaseUrl?: string;
  /** Supabase anon key (optional, uses default if not provided) */
  supabaseAnonKey?: string;
  /** Widget position */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Primary color for the widget */
  primaryColor?: string;
  /** Whether the widget starts enabled */
  enabled?: boolean;
  /** User info (optional) */
  user?: {
    name?: string;
    email?: string;
  };
}

// ============================================================
// Realtime event types
// ============================================================

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimeMarkerEvent {
  eventType: RealtimeEventType;
  new: Marker | null;
  old: Marker | null;
}

export interface RealtimeCommentEvent {
  eventType: RealtimeEventType;
  new: Comment | null;
  old: Comment | null;
}

// ============================================================
// Constants
// ============================================================

export const DEFAULT_SUPABASE_URL = 'https://bgjeaqpvsgfsfacnsilu.supabase.co';
export const DEFAULT_PRIMARY_COLOR = '#f97316'; // Orange-500
export const DEFAULT_POSITION = 'bottom-right' as const;

// Session storage key for anonymous user
export const SESSION_STORAGE_KEY = 'feedback-widget-session';
