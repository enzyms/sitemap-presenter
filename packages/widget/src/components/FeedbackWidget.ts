import type {
  WidgetConfig,
  MarkerWithComments,
  Marker,
  Comment,
  ElementAnchor,
  FallbackPosition,
  ViewportInfo,
  MarkerStatus
} from '@sitemap-presenter/shared';
import { FeedbackAPI, getAPI } from '../api/supabase';
import { widgetStyles } from '../styles/widget.css';
import { MarkerBubble } from './MarkerBubble';
import { CommentsPanel, CommentsPanelEvents } from './CommentsPanel';

// Types for parent communication (matching sitemap-presenter app)
interface FeedbackMarkerForParent {
  id: string;
  pageUrl: string;
  pagePath: string;
  number: number;
  anchor: ElementAnchor;
  fallbackPosition: { xPercent: number; yPercent: number };
  viewport: ViewportInfo;
  status: MarkerStatus;
  comments: { id: string; author: string; content: string; createdAt: string }[];
  createdAt: string;
  updatedAt: string;
}

export class FeedbackWidget extends HTMLElement {
  private shadow: ShadowRoot;
  private api: FeedbackAPI | null = null;
  private config: WidgetConfig | null = null;
  private markers: MarkerWithComments[] = [];
  private unsubscribe: (() => void) | null = null;

  // UI state
  private isPlacementMode = false;
  private hoveredElement: Element | null = null;
  private activeMarkerId: string | null = null;

  // Parent communication (for iframe embedding in sitemap-presenter)
  private isInIframe = false;
  private parentOrigin: string | null = null;

  // DOM references
  private container: HTMLDivElement | null = null;
  private markersContainer: HTMLDivElement | null = null;
  private commentsPanel: CommentsPanel | null = null;
  private floatingButton: HTMLButtonElement | null = null;
  private placementCursor: HTMLDivElement | null = null;
  private highlightOverlay: HTMLDivElement | null = null;
  private cancelButton: HTMLButtonElement | null = null;

  // Track marker bubble instances for scroll updates
  private markerBubbles: MarkerBubble[] = [];

  // Debounce timer for visibility reporting
  private visibilityDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Click-outside handler for closing the comments panel
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;

  // Status filter from parent sidebar
  private statusFilter: string = 'active';

  // Maps temp marker IDs to a promise that resolves with the real DB ID
  private pendingMarkerIds = new Map<string, { promise: Promise<string>; resolve: (id: string) => void }>();

  // Reposition mode state (triggered from panel's "Move marker" button)
  private isRepositioning = false;
  private repositioningMarkerId: string | null = null;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });

    // Detect if running in iframe
    this.isInIframe = window !== window.parent;

    // Listen for parent messages
    if (this.isInIframe) {
      window.addEventListener('message', this.handleParentMessage.bind(this));
    }
  }

  async connectedCallback() {
    // Read config from data attributes
    const apiKey = this.getAttribute('data-api-key');
    const position = this.getAttribute('data-position') as WidgetConfig['position'] || 'bottom-right';
    const primaryColor = this.getAttribute('data-color') || '#f97316';

    if (!apiKey) {
      console.error('[FeedbackWidget] Missing data-api-key attribute');
      return;
    }

    this.config = {
      apiKey,
      position,
      primaryColor
    };

    // Initialize API and site
    await this.initialize();
  }

  disconnectedCallback() {
    this.cleanup();
  }

  private async initialize() {
    if (!this.config) return;

    // Inject styles into shadow DOM
    const style = document.createElement('style');
    style.textContent = widgetStyles;
    this.shadow.appendChild(style);

    // Create container
    this.container = document.createElement('div');
    this.container.className = 'feedback-widget-root';
    this.shadow.appendChild(this.container);

    // Initialize API
    this.api = getAPI(this.config.supabaseUrl, this.config.supabaseAnonKey);

    // Load site by API key
    const site = await this.api.initializeSite(this.config.apiKey);
    if (!site) {
      console.error('[FeedbackWidget] Invalid API key or site not found');
      return;
    }

    console.log('[FeedbackWidget] Site loaded:', site.name);

    // Apply site settings
    if (site.settings?.primaryColor) {
      this.container.style.setProperty('--primary-color', site.settings.primaryColor);
    } else if (this.config.primaryColor) {
      this.container.style.setProperty('--primary-color', this.config.primaryColor);
    }

    // Create UI elements
    this.createFloatingButton();
    this.createMarkersContainer();
    this.createPlacementElements();

    // Load markers
    await this.loadMarkers();

    // Subscribe to realtime updates
    this.subscribeToUpdates();

    // Update marker positions on scroll/resize
    window.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
    window.addEventListener('resize', this.handleResize.bind(this), { passive: true });

    // Global keyboard shortcuts
    document.addEventListener('keydown', this.handleGlobalKeyDown);

    // Listen for navigation changes (SPA)
    if (this.isInIframe) {
      window.addEventListener('popstate', this.handleNavigation.bind(this));
      // Intercept pushState/replaceState for SPA navigation
      this.interceptHistoryMethods();
    }
  }

  private handleNavigation = async () => {
    // Reload markers for new page
    await this.loadMarkers();
  };

  private interceptHistoryMethods() {
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    history.pushState = (...args) => {
      originalPushState(...args);
      setTimeout(() => this.handleNavigation(), 0);
    };

    history.replaceState = (...args) => {
      originalReplaceState(...args);
      setTimeout(() => this.handleNavigation(), 0);
    };
  }

  private createFloatingButton() {
    if (!this.container || !this.config) return;

    this.floatingButton = document.createElement('button');
    this.floatingButton.className = `feedback-button position-${this.config.position}`;
    this.floatingButton.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/>
      </svg>
      <span>Feedback</span>
      <span class="count" style="display: none">0</span>
    `;

    this.floatingButton.addEventListener('click', () => this.togglePlacementMode());
    this.container.appendChild(this.floatingButton);
  }

  private createMarkersContainer() {
    // Markers container lives inside the shadow DOM
    this.markersContainer = document.createElement('div');
    this.markersContainer.className = 'markers-layer';
    this.shadow.appendChild(this.markersContainer);
  }

  private createPlacementElements() {
    if (!this.container) return;

    // Placement cursor (follows mouse)
    this.placementCursor = document.createElement('div');
    this.placementCursor.className = 'placement-cursor';
    this.placementCursor.style.display = 'none';
    this.placementCursor.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 4v16m8-8H4"/>
      </svg>
    `;
    this.container.appendChild(this.placementCursor);

    // Element highlight overlay — inside shadow DOM with fixed positioning
    this.highlightOverlay = document.createElement('div');
    this.highlightOverlay.className = 'element-highlight';
    this.highlightOverlay.style.display = 'none';
    this.shadow.appendChild(this.highlightOverlay);

    // Cancel button
    this.cancelButton = document.createElement('button');
    this.cancelButton.className = 'cancel-placement';
    this.cancelButton.textContent = 'Press ESC or click here to cancel';
    this.cancelButton.style.display = 'none';
    this.cancelButton.addEventListener('click', () => this.exitPlacementMode());
    this.container.appendChild(this.cancelButton);
  }

  private async loadMarkers() {
    if (!this.api) return;

    try {
      const pagePath = window.location.pathname;
      this.markers = await this.api.getMarkers(pagePath);
      this.renderMarkers();
      this.updateButtonCount();

      // Notify parent if in iframe
      if (this.isInIframe) {
        this.notifyParentOfNavigation();
      }
    } catch (error) {
      console.error('[FeedbackWidget] Failed to load markers:', error);
    }
  }

  private renderMarkers() {
    if (!this.markersContainer) return;

    // Clear existing markers
    this.markersContainer.innerHTML = '';
    this.markerBubbles = [];

    // Create marker bubbles
    for (const marker of this.markers) {
      const bubble = new MarkerBubble();
      bubble.setMarker(marker);

      // Click to open comments panel
      bubble.element.addEventListener('click', () => this.openCommentsPanel(marker));

      this.markersContainer.appendChild(bubble.element);
      this.markerBubbles.push(bubble);
    }

    // Always apply status filter + anchor visibility after rendering
    this.updateMarkerVisibility();
  }

  private updateButtonCount() {
    if (!this.floatingButton) return;

    const countEl = this.floatingButton.querySelector('.count') as HTMLElement;
    const openCount = this.markers.filter(m => m.status === 'open').length;

    if (openCount > 0) {
      countEl.textContent = String(openCount);
      countEl.style.display = 'inline';
    } else {
      countEl.style.display = 'none';
    }
  }

  private subscribeToUpdates() {
    if (!this.api) return;

    const pagePath = window.location.pathname;

    this.unsubscribe = this.api.subscribeToMarkers(
      pagePath,
      // Marker changes
      (eventType, marker) => {
        if (!marker) return;

        if (eventType === 'INSERT') {
          // Check if marker already exists (might have been added locally)
          if (!this.markers.find(m => m.id === marker.id)) {
            const newMarker = { ...marker, comments: [] } as MarkerWithComments;
            this.markers = [...this.markers, newMarker];
            this.renderMarkers();
            this.updateButtonCount();

            // Notify parent
            if (this.isInIframe) {
              this.notifyParentOfMarkerCreated(newMarker);
            }
          }
        } else if (eventType === 'UPDATE') {
          this.markers = this.markers.map(m =>
            m.id === marker.id ? { ...m, ...marker } : m
          );
          this.renderMarkers();
          this.updateButtonCount();

          // Update comments panel if open for this marker
          if (this.commentsPanel && this.activeMarkerId === marker.id) {
            this.commentsPanel.updateStatus(marker.status);
          }

          // Notify parent
          if (this.isInIframe) {
            const updatedMarker = this.markers.find(m => m.id === marker.id);
            if (updatedMarker) {
              this.notifyParentOfMarkerUpdated(updatedMarker);
            }
          }
        } else if (eventType === 'DELETE') {
          this.markers = this.markers.filter(m => m.id !== marker.id);
          this.renderMarkers();
          this.updateButtonCount();

          // Close comments panel if it was showing this marker
          if (this.activeMarkerId === marker.id) {
            this.closeCommentsPanel();
          }

          // Notify parent
          if (this.isInIframe) {
            this.notifyParentOfMarkerDeleted(marker.id);
          }
        }
      },
      // Comment changes
      (eventType, comment) => {
        if (!comment) return;

        if (eventType === 'INSERT') {
          // Add comment to marker
          this.markers = this.markers.map(m => {
            if (m.id === comment.marker_id) {
              // Check if comment already exists
              if (!m.comments.find(c => c.id === comment.id)) {
                return { ...m, comments: [...m.comments, comment] };
              }
            }
            return m;
          });

          // Update comments panel if open
          if (this.commentsPanel && this.activeMarkerId === comment.marker_id) {
            const marker = this.markers.find(m => m.id === comment.marker_id);
            if (marker) {
              this.commentsPanel.updateComments(marker.comments);
            }
          }

          // Notify parent
          if (this.isInIframe) {
            const updatedMarker = this.markers.find(m => m.id === comment.marker_id);
            if (updatedMarker) {
              this.notifyParentOfMarkerUpdated(updatedMarker);
            }
          }
        }
      }
    );
  }

  // ============================================================
  // Placement Mode
  // ============================================================

  private togglePlacementMode() {
    if (this.isPlacementMode) {
      this.exitPlacementMode();
    } else {
      this.enterPlacementMode();
    }
  }

  private enterPlacementMode() {
    this.isPlacementMode = true;
    this.closeCommentsPanel();

    if (this.floatingButton) {
      this.floatingButton.classList.add('active');
    }

    if (this.placementCursor) {
      this.placementCursor.style.display = 'flex';
    }

    if (this.cancelButton) {
      this.cancelButton.style.display = 'block';
    }

    // Change cursor on host page
    document.body.style.cursor = 'crosshair';

    // Add event listeners
    document.addEventListener('mousemove', this.handlePlacementMouseMove);
    document.addEventListener('click', this.handlePlacementClick, true);
    document.addEventListener('keydown', this.handlePlacementKeyDown);
  }

  private exitPlacementMode() {
    this.isPlacementMode = false;
    this.hoveredElement = null;

    if (this.floatingButton) {
      this.floatingButton.classList.remove('active');
    }

    if (this.placementCursor) {
      this.placementCursor.style.display = 'none';
    }

    if (this.highlightOverlay) {
      this.highlightOverlay.style.display = 'none';
    }

    if (this.cancelButton) {
      this.cancelButton.style.display = 'none';
    }

    document.body.style.cursor = '';

    // Remove event listeners
    document.removeEventListener('mousemove', this.handlePlacementMouseMove);
    document.removeEventListener('click', this.handlePlacementClick, true);
    document.removeEventListener('keydown', this.handlePlacementKeyDown);
  }

  private handlePlacementMouseMove = (e: MouseEvent) => {
    if (!this.isPlacementMode || !this.placementCursor || !this.highlightOverlay) return;

    // Update cursor position
    this.placementCursor.style.left = `${e.clientX}px`;
    this.placementCursor.style.top = `${e.clientY}px`;

    // Find element under cursor (excluding widget elements)
    const element = this.getElementAtPoint(e.clientX, e.clientY);

    if (element && element !== this.hoveredElement) {
      this.hoveredElement = element;

      // Update highlight overlay — use viewport coords (fixed positioning)
      const rect = element.getBoundingClientRect();
      this.highlightOverlay.style.display = 'block';
      this.highlightOverlay.style.left = `${rect.left}px`;
      this.highlightOverlay.style.top = `${rect.top}px`;
      this.highlightOverlay.style.width = `${rect.width}px`;
      this.highlightOverlay.style.height = `${rect.height}px`;
    }
  };

  private handlePlacementClick = async (e: MouseEvent) => {
    if (!this.isPlacementMode) return;

    // Ignore clicks on widget elements
    const target = e.target as Element;
    if (this.isWidgetElement(target)) return;

    e.preventDefault();
    e.stopPropagation();

    const element = this.hoveredElement || this.getElementAtPoint(e.clientX, e.clientY);
    if (!element) return;

    // Create marker at click position
    await this.createMarkerAtPosition(element, e.clientX, e.clientY);

    this.exitPlacementMode();
  };

  private handlePlacementKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.exitPlacementMode();
    }
  };

  private handleGlobalKeyDown = (e: KeyboardEvent) => {
    // Alt+F → toggle feedback placement mode
    if (e.altKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      this.togglePlacementMode();
      return;
    }

    // Esc → close comments panel (placement mode Esc is handled by handlePlacementKeyDown)
    if (e.key === 'Escape' && !this.isPlacementMode && this.commentsPanel) {
      this.closeCommentsPanel();
    }
  };

  private getElementAtPoint(x: number, y: number): Element | null {
    // Temporarily hide widget elements
    if (this.placementCursor) this.placementCursor.style.pointerEvents = 'none';
    if (this.highlightOverlay) this.highlightOverlay.style.pointerEvents = 'none';

    const element = document.elementFromPoint(x, y);

    if (this.placementCursor) this.placementCursor.style.pointerEvents = '';
    if (this.highlightOverlay) this.highlightOverlay.style.pointerEvents = '';

    // Filter out widget elements
    if (element && !this.isWidgetElement(element)) {
      return element;
    }

    return null;
  }

  private isWidgetElement(element: Element): boolean {
    // Check if element is the host element or lives inside our shadow DOM
    return element === this || this.shadow.contains(element);
  }

  // ============================================================
  // Marker Creation
  // ============================================================

  private async createMarkerAtPosition(element: Element, clientX: number, clientY: number) {
    if (!this.api) return;

    const rect = element.getBoundingClientRect();

    // Calculate offset within element
    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;

    // Build element anchor
    const anchor: ElementAnchor = {
      selector: this.getCssSelector(element),
      xpath: this.getXPath(element),
      innerText: this.getInnerTextSnippet(element),
      tagName: element.tagName,
      offsetX,
      offsetY
    };

    // Fallback position (percentage of document)
    const fallback_position: FallbackPosition = {
      xPercent: ((clientX + window.scrollX) / document.documentElement.scrollWidth) * 100,
      yPercent: ((clientY + window.scrollY) / document.documentElement.scrollHeight) * 100
    };

    // Viewport info
    const viewport: ViewportInfo = {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      devicePixelRatio: window.devicePixelRatio,
      timestamp: new Date().toISOString()
    };

    const now = new Date().toISOString();
    const tempId = `temp-${Date.now()}`;
    const nextNumber = this.markers.length > 0
      ? Math.max(...this.markers.map(m => m.number)) + 1
      : 1;

    // Optimistic marker — show immediately
    const optimistic: MarkerWithComments = {
      id: tempId,
      site_id: '',
      author_id: null,
      page_url: window.location.href,
      page_path: window.location.pathname,
      page_title: document.title,
      number: nextNumber,
      anchor,
      fallback_position,
      viewport,
      status: 'open' as MarkerStatus,
      created_at: now,
      updated_at: now,
      comments: []
    };

    // Register a pending ID resolver so comments can await the real ID
    let resolveRealId!: (id: string) => void;
    const realIdPromise = new Promise<string>(r => { resolveRealId = r; });
    this.pendingMarkerIds.set(tempId, { promise: realIdPromise, resolve: resolveRealId });

    this.markers = [...this.markers, optimistic];
    this.renderMarkers();
    this.updateButtonCount();
    this.openCommentsPanel(optimistic);

    // Persist in background, then swap temp → real
    try {
      const marker = await this.api.createMarker({
        page_url: window.location.href,
        page_path: window.location.pathname,
        page_title: document.title,
        anchor,
        fallback_position,
        viewport
      });

      // Resolve the pending ID so queued comments can proceed
      resolveRealId(marker.id);
      this.pendingMarkerIds.delete(tempId);

      // Replace optimistic marker with the real one (preserve any comments added meanwhile)
      const currentComments = this.markers.find(m => m.id === tempId)?.comments ?? [];
      this.markers = this.markers.map(m => m.id === tempId ? { ...marker, comments: currentComments } : m);

      // Update panel and bubble references to use real ID
      if (this.activeMarkerId === tempId) {
        this.activeMarkerId = marker.id;
        // Use updateMarkerRef to avoid re-rendering (preserves textarea content + focus)
        this.commentsPanel?.updateMarkerRef({ ...marker, comments: currentComments });
      }

      // Re-render bubbles with real IDs
      this.renderMarkers();

      // Notify parent if in iframe
      if (this.isInIframe) {
        this.notifyParentOfMarkerCreated(marker);
      }
    } catch (error) {
      console.error('[FeedbackWidget] Failed to create marker:', error);
      resolveRealId(tempId); // unblock any waiting comment
      this.pendingMarkerIds.delete(tempId);
      // Remove optimistic marker on failure
      this.markers = this.markers.filter(m => m.id !== tempId);
      this.renderMarkers();
      this.updateButtonCount();
      this.closeCommentsPanel();
    }
  }

  private getCssSelector(element: Element): string {
    if (element.id) {
      return `#${element.id}`;
    }

    const path: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector = `#${current.id}`;
        path.unshift(selector);
        break;
      }

      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c && !c.startsWith('feedback-'));
        if (classes.length > 0) {
          selector += `.${classes.slice(0, 2).join('.')}`;
        }
      }

      // Add nth-child if needed
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === current!.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  private getXPath(element: Element): string {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }

    const parts: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body) {
      let part = current.tagName.toLowerCase();

      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === current!.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          part += `[${index}]`;
        }
      }

      parts.unshift(part);
      current = current.parentElement;
    }

    return '//' + parts.join('/');
  }

  private getInnerTextSnippet(element: Element): string | undefined {
    const text = element.textContent?.trim();
    if (text && text.length > 0) {
      return text.substring(0, 50);
    }
    return undefined;
  }

  // ============================================================
  // Comments Panel
  // ============================================================

  private async openCommentsPanel(marker: MarkerWithComments) {
    // If a panel is already open, fade it out first then clean up
    if (this.commentsPanel) {
      await this.transitionPanel();
    }

    this.activeMarkerId = marker.id;

    // Notify parent (sitemap-presenter) that a marker was selected
    this.sendToParent({
      type: 'FEEDBACK_MARKER_SELECTED',
      markerId: marker.id
    });

    // Create panel as plain class instance
    this.commentsPanel = new CommentsPanel();
    this.commentsPanel.setMarker(marker);

    const events: CommentsPanelEvents = {
      onClose: () => this.closeCommentsPanel(),
      onAddComment: async (markerId, content) => {
        if (!this.api) return;
        try {
          // Resolve temp ID to real DB ID if marker creation is still in flight
          let realId = markerId;
          const pending = this.pendingMarkerIds.get(markerId);
          if (pending) realId = await pending.promise;

          const comment = await this.api.createComment({ marker_id: realId, content });
          // Add comment locally (use realId — markers array already swapped)
          this.markers = this.markers.map(m => {
            if (m.id === realId) {
              return { ...m, comments: [...m.comments, comment] };
            }
            return m;
          });
          // Update panel
          const updatedMarker = this.markers.find(m => m.id === realId);
          if (updatedMarker) {
            this.commentsPanel?.updateComments(updatedMarker.comments);
          }
        } catch (error) {
          console.error('[FeedbackWidget] Failed to add comment:', error);
        }
      },
      onStatusChange: async (markerId, status) => {
        if (!this.api) return;
        try {
          // Resolve temp ID if needed
          let realId = markerId;
          const pending = this.pendingMarkerIds.get(markerId);
          if (pending) realId = await pending.promise;

          await this.api.updateMarker(realId, { status });
          // Update locally (use realId — markers array may have swapped from temp)
          this.markers = this.markers.map(m => {
            if (m.id === realId) {
              return { ...m, status };
            }
            return m;
          });
          this.updateButtonCount();

          if (status === 'archived') {
            // Fade out panel + bubble, then clean up
            await this.fadeOutAndClose(realId);
          } else {
            this.renderMarkers();
            this.commentsPanel?.updateStatus(status);
          }
        } catch (error) {
          console.error('[FeedbackWidget] Failed to update status:', error);
        }
      },
      onDelete: async (markerId) => {
        if (!this.api) return;
        try {
          let realId = markerId;
          const pending = this.pendingMarkerIds.get(markerId);
          if (pending) realId = await pending.promise;

          await this.api.deleteMarker(realId);
          this.markers = this.markers.filter(m => m.id !== realId);
          this.renderMarkers();
          this.updateButtonCount();
          this.closeCommentsPanel();
        } catch (error) {
          console.error('[FeedbackWidget] Failed to delete marker:', error);
        }
      },
      onMove: (markerId) => {
        this.enterRepositionMode(markerId);
      }
    };

    this.commentsPanel.setEvents(events);

    // Add panel to shadow DOM
    this.shadow.appendChild(this.commentsPanel.element);

    // Position near the marker bubble
    const bubbleEl = this.markersContainer?.querySelector(`[data-marker-id="${marker.id}"]`);
    if (bubbleEl) {
      const rect = bubbleEl.getBoundingClientRect();
      this.commentsPanel.positionNear(rect);

      // Highlight the marker
      const bubble = this.markerBubbles.find(b => b.getMarkerId() === marker.id);
      if (bubble) {
        bubble.setHighlighted(true);
      }
    }

    // Focus the comment textarea
    requestAnimationFrame(() => this.commentsPanel?.focusInput());

    // Click outside to close — defer so the opening click doesn't trigger it
    requestAnimationFrame(() => {
      this.outsideClickHandler = (e: MouseEvent) => {
        const path = e.composedPath();
        const isInsidePanel = this.commentsPanel && path.includes(this.commentsPanel.element);
        const isInsideBubble = path.some(el =>
          el instanceof HTMLElement && el.classList?.contains('marker-bubble-wrapper')
        );
        if (!isInsidePanel && !isInsideBubble) {
          this.closeCommentsPanel();
        }
      };
      document.addEventListener('mousedown', this.outsideClickHandler, true);
    });
  }

  /** Tear down panel UI only (no side effects like uncommitted-marker deletion). */
  private closePanelUI() {
    if (this.outsideClickHandler) {
      document.removeEventListener('mousedown', this.outsideClickHandler, true);
      this.outsideClickHandler = null;
    }

    if (this.commentsPanel) {
      if (this.activeMarkerId) {
        const bubble = this.markerBubbles.find(b => b.getMarkerId() === this.activeMarkerId);
        if (bubble) bubble.setHighlighted(false);
      }

      this.commentsPanel.destroy();
      this.commentsPanel = null;
      this.activeMarkerId = null;

      // Notify parent that no marker is selected
      this.sendToParent({
        type: 'FEEDBACK_MARKER_SELECTED',
        markerId: null
      });
    }
  }

  /** Close panel + delete marker if it has no comments (user dismissed without commenting). */
  private closeCommentsPanel() {
    if (this.commentsPanel) {
      const markerId = this.commentsPanel.getMarkerId();
      if (markerId && !this.commentsPanel.hasComments()) {
        this.deleteUncommentedMarker(markerId);
      }
    }
    this.closePanelUI();
  }

  private async deleteUncommentedMarker(markerId: string) {
    if (!this.api) return;
    // Check the marker still exists (may have been deleted by explicit onDelete)
    if (!this.markers.find(m => m.id === markerId)) return;

    // Resolve temp ID if marker creation is still in flight
    let realId = markerId;
    const pending = this.pendingMarkerIds.get(markerId);
    if (pending) realId = await pending.promise;

    // Remove locally — no full re-render to avoid flashes during transitions
    this.markers = this.markers.filter(m => m.id !== markerId && m.id !== realId);
    const bubbleIdx = this.markerBubbles.findIndex(
      b => b.getMarkerId() === markerId || b.getMarkerId() === realId
    );
    if (bubbleIdx >= 0) {
      this.markerBubbles[bubbleIdx].destroy();
      this.markerBubbles.splice(bubbleIdx, 1);
    }
    this.updateButtonCount();

    // Delete from DB in background
    try {
      await this.api.deleteMarker(realId);
      if (this.isInIframe) {
        this.sendToParent({ type: 'FEEDBACK_MARKER_DELETED', markerId: realId });
      }
    } catch (error) {
      console.error('[FeedbackWidget] Failed to delete uncommitted marker:', error);
    }
  }

  /**
   * Fade out the current panel and clean up (including uncommitted marker deletion).
   * Used when switching from one marker's panel to another.
   */
  private async transitionPanel() {
    if (!this.commentsPanel) return;

    // Disable outside-click immediately so it doesn't interfere
    if (this.outsideClickHandler) {
      document.removeEventListener('mousedown', this.outsideClickHandler, true);
      this.outsideClickHandler = null;
    }

    // Delete uncommitted marker if needed (fire-and-forget, no re-render)
    const markerId = this.commentsPanel.getMarkerId();
    if (markerId && !this.commentsPanel.hasComments()) {
      this.deleteUncommentedMarker(markerId);
    }

    await this.commentsPanel.fadeOut();
    this.closePanelUI();
  }

  /**
   * Fade out both the comments panel and the marker bubble, then remove them.
   * Used when archiving a marker.
   */
  private async fadeOutAndClose(markerId: string) {
    const bubble = this.markerBubbles.find(b => b.getMarkerId() === markerId);
    const panelFade = this.commentsPanel?.fadeOut() ?? Promise.resolve();
    const bubbleFade = bubble?.fadeOut() ?? Promise.resolve();

    await Promise.all([panelFade, bubbleFade]);
    this.closePanelUI();

    // Re-render markers (visibility filter is applied inside renderMarkers)
    this.renderMarkers();
  }

  // ============================================================
  // Reposition marker mode (triggered from panel's "Move marker")
  // ============================================================

  private enterRepositionMode(markerId: string) {
    this.closePanelUI();
    this.isRepositioning = true;
    this.repositioningMarkerId = markerId;
    this.hoveredElement = null;

    document.body.style.cursor = 'crosshair';

    if (this.cancelButton) {
      this.cancelButton.textContent = 'Press ESC or click here to cancel move';
      this.cancelButton.style.display = 'block';
    }

    document.addEventListener('mousemove', this.handleRepositionMouseMove);
    document.addEventListener('click', this.handleRepositionClick, true);
    document.addEventListener('keydown', this.handleRepositionKeyDown);
  }

  private exitRepositionMode() {
    this.isRepositioning = false;
    this.repositioningMarkerId = null;
    this.hoveredElement = null;

    document.body.style.cursor = '';

    if (this.highlightOverlay) {
      this.highlightOverlay.style.display = 'none';
    }

    if (this.cancelButton) {
      this.cancelButton.style.display = 'none';
    }

    document.removeEventListener('mousemove', this.handleRepositionMouseMove);
    document.removeEventListener('click', this.handleRepositionClick, true);
    document.removeEventListener('keydown', this.handleRepositionKeyDown);
  }

  private handleRepositionMouseMove = (e: MouseEvent) => {
    if (!this.isRepositioning || !this.highlightOverlay) return;

    const element = this.getElementAtPoint(e.clientX, e.clientY);
    if (element) {
      this.hoveredElement = element;
      const rect = element.getBoundingClientRect();
      this.highlightOverlay.style.display = 'block';
      this.highlightOverlay.style.left = `${rect.left}px`;
      this.highlightOverlay.style.top = `${rect.top}px`;
      this.highlightOverlay.style.width = `${rect.width}px`;
      this.highlightOverlay.style.height = `${rect.height}px`;
    }
  };

  private handleRepositionClick = async (e: MouseEvent) => {
    if (!this.isRepositioning) return;

    const target = e.target as Element;
    if (this.isWidgetElement(target)) return;

    e.preventDefault();
    e.stopPropagation();

    const element = this.hoveredElement || this.getElementAtPoint(e.clientX, e.clientY);
    const markerId = this.repositioningMarkerId;
    this.exitRepositionMode();

    if (!element || !markerId) return;
    await this.repositionMarker(markerId, element, e.clientX, e.clientY);
  };

  private handleRepositionKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.exitRepositionMode();
    }
  };

  private async repositionMarker(markerId: string, element: Element, clientX: number, clientY: number) {
    if (!this.api) return;

    const rect = element.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;

    const anchor: ElementAnchor = {
      selector: this.getCssSelector(element),
      xpath: this.getXPath(element),
      innerText: this.getInnerTextSnippet(element),
      tagName: element.tagName,
      offsetX,
      offsetY
    };

    const fallback_position: FallbackPosition = {
      xPercent: ((clientX + window.scrollX) / document.documentElement.scrollWidth) * 100,
      yPercent: ((clientY + window.scrollY) / document.documentElement.scrollHeight) * 100
    };

    const viewport: ViewportInfo = {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      devicePixelRatio: window.devicePixelRatio,
      timestamp: new Date().toISOString()
    };

    try {
      await this.api.updateMarker(markerId, { anchor, fallback_position, viewport });

      // Update local state
      this.markers = this.markers.map(m =>
        m.id === markerId ? { ...m, anchor, fallback_position, viewport } : m
      );
      this.renderMarkers();

      // Notify parent
      if (this.isInIframe) {
        const updatedMarker = this.markers.find(m => m.id === markerId);
        if (updatedMarker) {
          this.notifyParentOfMarkerUpdated(updatedMarker);
        }
      }
    } catch (error) {
      console.error('[FeedbackWidget] Failed to reposition marker:', error);
    }
  }

  // ============================================================
  // Scroll/Resize handlers
  // ============================================================

  private handleScroll() {
    // Update marker positions
    for (const bubble of this.markerBubbles) {
      bubble.updatePosition();
    }
  }

  private handleResize() {
    // Update marker positions
    this.handleScroll();
    // Update bubble visibility after debounce
    this.debouncedUpdateVisibility();
  }

  private debouncedUpdateVisibility() {
    if (this.visibilityDebounceTimer) {
      clearTimeout(this.visibilityDebounceTimer);
    }
    this.visibilityDebounceTimer = setTimeout(() => {
      this.updateMarkerVisibility();
    }, 200);
  }

  private updateMarkerVisibility() {
    for (const bubble of this.markerBubbles) {
      const markerId = bubble.getMarkerId();
      const marker = markerId ? this.markers.find(m => m.id === markerId) : null;

      // Hide if status doesn't match filter
      if (marker && this.statusFilter !== 'all') {
        const hidden =
          this.statusFilter === 'active'
            ? marker.status === 'archived'
            : marker.status !== this.statusFilter;
        if (hidden) {
          bubble.element.style.display = 'none';
          continue;
        }
      }

      // Otherwise apply anchor-based visibility
      bubble.updateVisibility();
    }
  }

  // ============================================================
  // Cleanup
  // ============================================================

  private cleanup() {
    if (this.visibilityDebounceTimer) {
      clearTimeout(this.visibilityDebounceTimer);
      this.visibilityDebounceTimer = null;
    }

    if (this.outsideClickHandler) {
      document.removeEventListener('mousedown', this.outsideClickHandler, true);
      this.outsideClickHandler = null;
    }

    if (this.isRepositioning) {
      this.exitRepositionMode();
    }

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // Shadow children are auto-removed when the host element is removed,
    // but we null references for GC
    this.markersContainer = null;
    this.highlightOverlay = null;
    this.markerBubbles = [];

    if (this.commentsPanel) {
      this.commentsPanel = null;
    }

    window.removeEventListener('scroll', this.handleScroll.bind(this));
    window.removeEventListener('resize', this.handleResize.bind(this));
    window.removeEventListener('message', this.handleParentMessage.bind(this));
    document.removeEventListener('keydown', this.handleGlobalKeyDown);

    this.exitPlacementMode();
  }

  // ============================================================
  // Parent Communication (iframe mode)
  // ============================================================

  private convertMarkerForParent(marker: MarkerWithComments): FeedbackMarkerForParent {
    return {
      id: marker.id,
      pageUrl: marker.page_url,
      pagePath: marker.page_path,
      number: marker.number,
      anchor: marker.anchor,
      fallbackPosition: marker.fallback_position,
      viewport: marker.viewport,
      status: marker.status,
      comments: marker.comments.map(c => ({
        id: c.id,
        author: c.author_name || 'Anonymous',
        content: c.content,
        createdAt: c.created_at
      })),
      createdAt: marker.created_at,
      updatedAt: marker.updated_at
    };
  }

  private sendToParent(message: unknown) {
    if (!this.isInIframe || !window.parent) return;
    try {
      window.parent.postMessage(message, '*');
    } catch (e) {
      console.error('[FeedbackWidget] Failed to send message to parent:', e);
    }
  }

  private notifyParentOfNavigation() {
    const markersForParent = this.markers.map(m => this.convertMarkerForParent(m));
    this.sendToParent({
      type: 'FEEDBACK_NAVIGATION',
      url: window.location.href,
      pathname: window.location.pathname,
      title: document.title,
      markers: markersForParent
    });
  }

  private notifyParentOfMarkerCreated(marker: MarkerWithComments) {
    this.sendToParent({
      type: 'FEEDBACK_MARKER_CREATED',
      marker: this.convertMarkerForParent(marker)
    });
  }

  private notifyParentOfMarkerUpdated(marker: MarkerWithComments) {
    this.sendToParent({
      type: 'FEEDBACK_MARKER_UPDATED',
      marker: this.convertMarkerForParent(marker)
    });
  }

  private notifyParentOfMarkerDeleted(markerId: string) {
    this.sendToParent({
      type: 'FEEDBACK_MARKER_DELETED',
      markerId
    });
  }

  private handleParentMessage(event: MessageEvent) {
    const data = event.data;
    if (!data?.type?.startsWith('FEEDBACK_')) return;

    // Store parent origin for responses
    this.parentOrigin = event.origin;

    console.log('[FeedbackWidget] Received message from parent:', data.type);

    switch (data.type) {
      case 'FEEDBACK_GET_MARKERS':
        this.handleGetMarkersRequest();
        break;
      case 'FEEDBACK_UPDATE_STATUS':
        this.handleUpdateStatusRequest(data.markerId, data.status);
        break;
      case 'FEEDBACK_ADD_COMMENT':
        this.handleAddCommentRequest(data.markerId, data.content, data.author);
        break;
      case 'FEEDBACK_DELETE_MARKER':
        this.handleDeleteMarkerRequest(data.markerId);
        break;
      case 'FEEDBACK_HIGHLIGHT_MARKER':
        this.handleHighlightMarkerRequest(data.markerId);
        break;
      case 'FEEDBACK_STATUS_FILTER':
        this.statusFilter = data.status;
        this.updateMarkerVisibility();
        break;
    }
  }

  private handleGetMarkersRequest() {
    const markersForParent = this.markers.map(m => this.convertMarkerForParent(m));
    this.sendToParent({
      type: 'FEEDBACK_MARKERS_RESPONSE',
      markers: markersForParent
    });
  }

  private async handleUpdateStatusRequest(markerId: string, status: MarkerStatus) {
    if (!this.api) return;
    try {
      await this.api.updateMarker(markerId, { status });
      this.markers = this.markers.map(m => m.id === markerId ? { ...m, status } : m);
      this.renderMarkers();
      this.updateButtonCount();

      const updatedMarker = this.markers.find(m => m.id === markerId);
      if (updatedMarker) {
        this.notifyParentOfMarkerUpdated(updatedMarker);
      }

      this.sendToParent({
        type: 'FEEDBACK_ACTION_CONFIRMED',
        action: 'status_updated',
        markerId,
        success: true
      });
    } catch (error) {
      console.error('[FeedbackWidget] Failed to update status:', error);
      this.sendToParent({
        type: 'FEEDBACK_ACTION_CONFIRMED',
        action: 'status_updated',
        markerId,
        success: false
      });
    }
  }

  private async handleAddCommentRequest(markerId: string, content: string, author?: string) {
    if (!this.api) return;
    try {
      const comment = await this.api.createComment({
        marker_id: markerId,
        content,
        author_name: author
      });

      this.markers = this.markers.map(m => {
        if (m.id === markerId) {
          return { ...m, comments: [...m.comments, comment] };
        }
        return m;
      });

      const updatedMarker = this.markers.find(m => m.id === markerId);
      if (updatedMarker) {
        this.notifyParentOfMarkerUpdated(updatedMarker);
        if (this.commentsPanel && this.activeMarkerId === markerId) {
          this.commentsPanel.updateComments(updatedMarker.comments);
        }
      }

      this.sendToParent({
        type: 'FEEDBACK_ACTION_CONFIRMED',
        action: 'comment_added',
        markerId,
        success: true
      });
    } catch (error) {
      console.error('[FeedbackWidget] Failed to add comment:', error);
      this.sendToParent({
        type: 'FEEDBACK_ACTION_CONFIRMED',
        action: 'comment_added',
        markerId,
        success: false
      });
    }
  }

  private async handleDeleteMarkerRequest(markerId: string) {
    if (!this.api) return;
    try {
      await this.api.deleteMarker(markerId);
      this.markers = this.markers.filter(m => m.id !== markerId);
      this.renderMarkers();
      this.updateButtonCount();

      if (this.activeMarkerId === markerId) {
        this.closeCommentsPanel();
      }

      this.notifyParentOfMarkerDeleted(markerId);

      this.sendToParent({
        type: 'FEEDBACK_ACTION_CONFIRMED',
        action: 'marker_deleted',
        markerId,
        success: true
      });
    } catch (error) {
      console.error('[FeedbackWidget] Failed to delete marker:', error);
      this.sendToParent({
        type: 'FEEDBACK_ACTION_CONFIRMED',
        action: 'marker_deleted',
        markerId,
        success: false
      });
    }
  }

  private handleHighlightMarkerRequest(markerId: string | null) {
    // Set highlight on the matching bubble, remove from all others
    for (const bubble of this.markerBubbles) {
      bubble.setHighlighted(bubble.getMarkerId() === markerId);
    }

    if (markerId) {
      const markerWithComments = this.markers.find(m => m.id === markerId);
      if (markerWithComments) {
        const bubble = this.markerBubbles.find(b => b.getMarkerId() === markerId);
        // Delay to let layout settle after potential viewport resize
        setTimeout(() => {
          bubble?.scrollToAnchor();
          // Open panel after scroll animation settles so it positions correctly
          setTimeout(() => {
            this.handleScroll(); // refresh bubble positions
            this.openCommentsPanel(markerWithComments);
          }, 400);
        }, 150);
      }
    } else {
      this.closeCommentsPanel();
    }
  }
}

customElements.define('feedback-widget', FeedbackWidget);
