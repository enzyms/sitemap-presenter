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

  // DOM references
  private container: HTMLDivElement | null = null;
  private markersContainer: HTMLDivElement | null = null;
  private commentsPanel: CommentsPanel | null = null;
  private floatingButton: HTMLButtonElement | null = null;
  private placementCursor: HTMLDivElement | null = null;
  private highlightOverlay: HTMLDivElement | null = null;
  private cancelButton: HTMLButtonElement | null = null;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
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

    // Inject styles
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
    // Markers are positioned in the document body, not shadow DOM
    this.markersContainer = document.createElement('div');
    this.markersContainer.id = 'feedback-markers-container';
    this.markersContainer.style.cssText = 'position: absolute; top: 0; left: 0; pointer-events: none; z-index: 999997;';
    document.body.appendChild(this.markersContainer);
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

    // Element highlight overlay
    this.highlightOverlay = document.createElement('div');
    this.highlightOverlay.className = 'element-highlight';
    this.highlightOverlay.style.display = 'none';
    document.body.appendChild(this.highlightOverlay);

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
    } catch (error) {
      console.error('[FeedbackWidget] Failed to load markers:', error);
    }
  }

  private renderMarkers() {
    if (!this.markersContainer) return;

    // Clear existing markers
    this.markersContainer.innerHTML = '';

    // Create marker bubbles
    for (const marker of this.markers) {
      const bubble = document.createElement('feedback-marker-bubble') as MarkerBubble;
      bubble.style.pointerEvents = 'auto';
      bubble.setMarker(marker);

      // Add click handler
      bubble.addEventListener('click', () => this.openCommentsPanel(marker));

      this.markersContainer.appendChild(bubble);
    }
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
            this.markers = [...this.markers, { ...marker, comments: [] }];
            this.renderMarkers();
            this.updateButtonCount();
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
        } else if (eventType === 'DELETE') {
          this.markers = this.markers.filter(m => m.id !== marker.id);
          this.renderMarkers();
          this.updateButtonCount();

          // Close comments panel if it was showing this marker
          if (this.activeMarkerId === marker.id) {
            this.closeCommentsPanel();
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

    // Change cursor
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

      // Update highlight overlay
      const rect = element.getBoundingClientRect();
      this.highlightOverlay.style.display = 'block';
      this.highlightOverlay.style.left = `${rect.left + window.scrollX}px`;
      this.highlightOverlay.style.top = `${rect.top + window.scrollY}px`;
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
    // Check if element is part of the widget
    if (element.closest('feedback-widget')) return true;
    if (element.closest('#feedback-markers-container')) return true;
    if (element.closest('feedback-marker-bubble')) return true;
    if (element.closest('feedback-comments-panel')) return true;
    return false;
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

    try {
      const marker = await this.api.createMarker({
        page_url: window.location.href,
        page_path: window.location.pathname,
        page_title: document.title,
        anchor,
        fallback_position,
        viewport
      });

      // Add to local state
      this.markers = [...this.markers, marker];
      this.renderMarkers();
      this.updateButtonCount();

      // Open comments panel for the new marker
      this.openCommentsPanel(marker);
    } catch (error) {
      console.error('[FeedbackWidget] Failed to create marker:', error);
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

  private openCommentsPanel(marker: MarkerWithComments) {
    this.closeCommentsPanel();

    this.activeMarkerId = marker.id;

    // Create panel
    this.commentsPanel = document.createElement('feedback-comments-panel') as CommentsPanel;
    this.commentsPanel.setMarker(marker);

    const events: CommentsPanelEvents = {
      onClose: () => this.closeCommentsPanel(),
      onAddComment: async (markerId, content) => {
        if (!this.api) return;
        try {
          const comment = await this.api.createComment({ marker_id: markerId, content });
          // Add comment locally
          this.markers = this.markers.map(m => {
            if (m.id === markerId) {
              return { ...m, comments: [...m.comments, comment] };
            }
            return m;
          });
          // Update panel
          const updatedMarker = this.markers.find(m => m.id === markerId);
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
          await this.api.updateMarker(markerId, { status });
          // Update locally
          this.markers = this.markers.map(m => {
            if (m.id === markerId) {
              return { ...m, status };
            }
            return m;
          });
          this.renderMarkers();
          this.updateButtonCount();
          this.commentsPanel?.updateStatus(status);
        } catch (error) {
          console.error('[FeedbackWidget] Failed to update status:', error);
        }
      },
      onDelete: async (markerId) => {
        if (!this.api) return;
        try {
          await this.api.deleteMarker(markerId);
          this.markers = this.markers.filter(m => m.id !== markerId);
          this.renderMarkers();
          this.updateButtonCount();
          this.closeCommentsPanel();
        } catch (error) {
          console.error('[FeedbackWidget] Failed to delete marker:', error);
        }
      }
    };

    this.commentsPanel.setEvents(events);

    // Add panel to body (outside shadow DOM for proper positioning)
    document.body.appendChild(this.commentsPanel);

    // Position near the marker bubble
    const bubble = this.markersContainer?.querySelector(`[data-marker-id="${marker.id}"]`);
    if (bubble) {
      const rect = bubble.getBoundingClientRect();
      this.commentsPanel.positionNear(rect.left + rect.width / 2, rect.top);

      // Highlight the marker
      const bubbleComponent = bubble.closest('feedback-marker-bubble') as MarkerBubble;
      if (bubbleComponent) {
        bubbleComponent.setHighlighted(true);
      }
    }

    // Add styles for the panel (it's outside shadow DOM)
    this.injectPanelStyles();
  }

  private closeCommentsPanel() {
    if (this.commentsPanel) {
      // Remove highlight from marker
      if (this.activeMarkerId && this.markersContainer) {
        const bubble = this.markersContainer.querySelector(`[data-marker-id="${this.activeMarkerId}"]`);
        if (bubble) {
          const bubbleComponent = bubble.closest('feedback-marker-bubble') as MarkerBubble;
          if (bubbleComponent) {
            bubbleComponent.setHighlighted(false);
          }
        }
      }

      this.commentsPanel.remove();
      this.commentsPanel = null;
      this.activeMarkerId = null;
    }
  }

  private injectPanelStyles() {
    // Check if styles already injected
    if (document.getElementById('feedback-widget-styles')) return;

    const style = document.createElement('style');
    style.id = 'feedback-widget-styles';
    style.textContent = widgetStyles;
    document.head.appendChild(style);
  }

  // ============================================================
  // Scroll/Resize handlers
  // ============================================================

  private handleScroll() {
    // Update marker positions
    if (this.markersContainer) {
      const bubbles = this.markersContainer.querySelectorAll('feedback-marker-bubble') as NodeListOf<MarkerBubble>;
      bubbles.forEach(bubble => bubble.updatePosition());
    }
  }

  private handleResize() {
    // Update marker positions
    this.handleScroll();
  }

  // ============================================================
  // Cleanup
  // ============================================================

  private cleanup() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.markersContainer) {
      this.markersContainer.remove();
      this.markersContainer = null;
    }

    if (this.highlightOverlay) {
      this.highlightOverlay.remove();
      this.highlightOverlay = null;
    }

    if (this.commentsPanel) {
      this.commentsPanel.remove();
      this.commentsPanel = null;
    }

    window.removeEventListener('scroll', this.handleScroll.bind(this));
    window.removeEventListener('resize', this.handleResize.bind(this));

    this.exitPlacementMode();
  }
}

customElements.define('feedback-widget', FeedbackWidget);
