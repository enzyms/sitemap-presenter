import type { Node, Edge } from '@xyflow/svelte';

export interface PageData extends Record<string, unknown> {
	url: string;
	title: string;
	depth: number;
	parentUrl: string | null;
	menuType?: 'main' | 'user' | 'other';
	thumbnailUrl?: string;
	fullScreenshotUrl?: string;
	screenshotStatus: 'pending' | 'processing' | 'ready' | 'error';
	links: string[];
	internalLinks: string[];
	externalLinks: string[];
	statusCode?: number;
	error?: string;
}

export type PageNode = Node<PageData, 'page'>;

export interface LinkData extends Record<string, unknown> {
	sourceUrl: string;
	targetUrl: string;
}

export type LinkEdge = Edge<LinkData>;

export interface CrawlConfig {
	url: string;
	maxDepth: number;
	maxPages: number;
}

export interface CrawlProgress {
	sessionId: string;
	status: 'idle' | 'crawling' | 'screenshotting' | 'complete' | 'error';
	found: number;
	crawled: number;
	screenshotted: number;
	errors: number;
}

export interface CrawlSession {
	id: string;
	config: CrawlConfig;
	progress: CrawlProgress;
	startedAt: Date;
	completedAt?: Date;
}

// WebSocket event types
export interface PageDiscoveredEvent {
	url: string;
	title: string;
	depth: number;
	parentUrl: string | null;
	links: string[];
	internalLinks: string[];
	externalLinks: string[];
}

export interface PageScreenshotEvent {
	url: string;
	thumbnailUrl: string;
	fullScreenshotUrl?: string;
}

export interface CrawlProgressEvent {
	found: number;
	crawled: number;
	screenshotted: number;
}

export interface CrawlCompleteEvent {
	totalPages: number;
	duration: number;
}

export interface CrawlErrorEvent {
	message: string;
	url?: string;
}

// Project types
export interface Project {
	id: string;
	name: string;
	description: string;
	baseUrl: string;
	createdAt: string;
	updatedAt: string;
	lastCrawledAt?: string;
	cachedData?: ProjectCachedData;
}

export interface ProjectCachedData {
	nodes: PageNode[];
	edges: LinkEdge[];
	screenshotUrls: Record<string, string>; // url -> screenshot URL
	feedbackMarkers?: Record<string, FeedbackMarker[]>; // pagePath -> markers
}

// ============================================================
// Feedback marker types (from inspected app via postMessage)
// ============================================================

export type MarkerStatus = 'open' | 'resolved';
export interface FeedbackComment {
	id: string;
	author: string;
	content: string;
	createdAt: string;
}

export interface ElementAnchor {
	selector: string;
	xpath: string;
	innerText?: string;
	tagName: string;
	offsetX: number;
	offsetY: number;
}

export interface ViewportInfo {
	width: number;
	height: number;
	scrollX: number;
	scrollY: number;
	devicePixelRatio: number;
	timestamp: string;
}

export interface FeedbackMarker {
	id: string;
	pageUrl: string;
	pagePath: string;
	number: number;
	anchor: ElementAnchor;
	fallbackPosition: { xPercent: number; yPercent: number };
	viewport: ViewportInfo;
	status: MarkerStatus;
	comments: FeedbackComment[];
	createdAt: string;
	updatedAt: string;
	userAgent?: string;
}

// ============================================================
// postMessage API - Bidirectional communication with iframe
// ============================================================

// --- Messages FROM sitemap-presenter TO iframe ---

/** Request all markers for a page */
export interface GetFeedbackMarkersMessage {
	type: 'FEEDBACK_GET_MARKERS';
	pagePath?: string;
}

/** Update marker status (open/resolved) */
export interface UpdateMarkerStatusMessage {
	type: 'FEEDBACK_UPDATE_STATUS';
	markerId: string;
	status: MarkerStatus;
}

/** Add a comment to a marker */
export interface AddMarkerCommentMessage {
	type: 'FEEDBACK_ADD_COMMENT';
	markerId: string;
	content: string;
	author?: string;
}

/** Delete a marker */
export interface DeleteMarkerMessage {
	type: 'FEEDBACK_DELETE_MARKER';
	markerId: string;
}

/** Highlight/focus a specific marker */
export interface HighlightMarkerMessage {
	type: 'FEEDBACK_HIGHLIGHT_MARKER';
	markerId: string | null;
}

export type SitemapToIframeMessage =
	| GetFeedbackMarkersMessage
	| UpdateMarkerStatusMessage
	| AddMarkerCommentMessage
	| DeleteMarkerMessage
	| HighlightMarkerMessage;

// --- Messages FROM iframe TO sitemap-presenter ---

/** Response with all markers */
export interface MarkersResponseMessage {
	type: 'FEEDBACK_MARKERS_RESPONSE';
	markers: FeedbackMarker[];
}

/** Notification: marker was created */
export interface MarkerCreatedMessage {
	type: 'FEEDBACK_MARKER_CREATED';
	marker: FeedbackMarker;
}

/** Notification: marker was updated */
export interface MarkerUpdatedMessage {
	type: 'FEEDBACK_MARKER_UPDATED';
	marker: FeedbackMarker;
}

/** Notification: marker was deleted */
export interface MarkerDeletedMessage {
	type: 'FEEDBACK_MARKER_DELETED';
	markerId: string;
}

/** Confirmation of action */
export interface ActionConfirmMessage {
	type: 'FEEDBACK_ACTION_CONFIRMED';
	action: 'status_updated' | 'comment_added' | 'marker_deleted';
	markerId: string;
	success: boolean;
}

/** Notification: iframe navigated to a new page */
export interface NavigationMessage {
	type: 'FEEDBACK_NAVIGATION';
	url: string;
	pathname: string;
	title: string;
	markers: FeedbackMarker[]; // All markers included directly
}

export type IframeToSitemapMessage =
	| MarkersResponseMessage
	| MarkerCreatedMessage
	| MarkerUpdatedMessage
	| MarkerDeletedMessage
	| ActionConfirmMessage
	| NavigationMessage;

// API response types
export interface StartCrawlResponse {
	sessionId: string;
	message: string;
}

export interface CrawlStatusResponse {
	session: CrawlSession;
}

export interface SitemapResponse {
	nodes: PageNode[];
	edges: LinkEdge[];
}
