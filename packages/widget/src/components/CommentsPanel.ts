import type { MarkerWithComments, Comment, MarkerStatus } from '@sitemap-presenter/shared';

export interface CommentsPanelEvents {
  onClose: () => void;
  onAddComment: (markerId: string, content: string) => void;
  onStatusChange: (markerId: string, status: MarkerStatus) => void;
  onDelete: (markerId: string) => void;
}

export class CommentsPanel extends HTMLElement {
  private marker: MarkerWithComments | null = null;
  private events: CommentsPanelEvents | null = null;

  constructor() {
    super();
  }

  setMarker(marker: MarkerWithComments) {
    this.marker = marker;
    this.render();
  }

  setEvents(events: CommentsPanelEvents) {
    this.events = events;
  }

  updateComments(comments: Comment[]) {
    if (this.marker) {
      this.marker = { ...this.marker, comments };
      this.renderComments();
    }
  }

  updateStatus(status: MarkerStatus) {
    if (this.marker) {
      this.marker = { ...this.marker, status };
      this.render();
    }
  }

  positionNear(x: number, y: number) {
    const panelWidth = 320;
    const panelHeight = 400;
    const padding = 16;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Position to the right of the marker by default
    let left = x + 20;
    let top = y - 20;

    // If it would go off the right edge, position to the left
    if (left + panelWidth > viewportWidth - padding) {
      left = x - panelWidth - 20;
    }

    // If it would go off the left edge, position at left edge
    if (left < padding) {
      left = padding;
    }

    // If it would go off the bottom, adjust up
    if (top + panelHeight > viewportHeight - padding) {
      top = viewportHeight - panelHeight - padding;
    }

    // If it would go off the top, adjust down
    if (top < padding) {
      top = padding;
    }

    this.style.left = `${left}px`;
    this.style.top = `${top}px`;
  }

  private render() {
    if (!this.marker) return;

    const isResolved = this.marker.status === 'resolved';

    this.innerHTML = `
      <div class="comments-panel">
        <div class="comments-panel-header">
          <h3>
            <span class="marker-number ${isResolved ? 'resolved' : ''}">${this.marker.number}</span>
            Feedback
          </h3>
          <button class="comments-panel-close" data-action="close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="comments-panel-body" data-comments-container>
          ${this.renderCommentsHTML()}
        </div>

        <div class="marker-actions">
          ${isResolved ? `
            <button class="marker-action-btn reopen" data-action="reopen">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              Reopen
            </button>
          ` : `
            <button class="marker-action-btn resolve" data-action="resolve">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 13l4 4L19 7"/>
              </svg>
              Resolve
            </button>
          `}
          <button class="marker-action-btn delete" data-action="delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Delete
          </button>
        </div>

        <div class="comments-panel-footer">
          <div class="comment-input-wrapper">
            <input type="text"
                   class="comment-input"
                   placeholder="Add a comment..."
                   data-comment-input />
            <button class="comment-submit" data-action="submit" disabled>Send</button>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private renderCommentsHTML(): string {
    if (!this.marker || this.marker.comments.length === 0) {
      return '<div class="no-comments">No comments yet</div>';
    }

    return this.marker.comments.map(comment => `
      <div class="comment-item">
        <div class="comment-content">${this.escapeHtml(comment.content)}</div>
        <div class="comment-meta">
          ${comment.author_name || 'Anonymous'} &bull; ${this.formatDate(comment.created_at)}
        </div>
      </div>
    `).join('');
  }

  private renderComments() {
    const container = this.querySelector('[data-comments-container]');
    if (container) {
      container.innerHTML = this.renderCommentsHTML();
    }
  }

  private attachEventListeners() {
    // Close button
    this.querySelector('[data-action="close"]')?.addEventListener('click', () => {
      this.events?.onClose();
    });

    // Resolve/Reopen button
    this.querySelector('[data-action="resolve"]')?.addEventListener('click', () => {
      if (this.marker && this.events) {
        this.events.onStatusChange(this.marker.id, 'resolved');
      }
    });

    this.querySelector('[data-action="reopen"]')?.addEventListener('click', () => {
      if (this.marker && this.events) {
        this.events.onStatusChange(this.marker.id, 'open');
      }
    });

    // Delete button
    this.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      if (this.marker && this.events) {
        if (confirm('Delete this feedback marker?')) {
          this.events.onDelete(this.marker.id);
        }
      }
    });

    // Comment input
    const input = this.querySelector('[data-comment-input]') as HTMLInputElement;
    const submitBtn = this.querySelector('[data-action="submit"]') as HTMLButtonElement;

    if (input && submitBtn) {
      input.addEventListener('input', () => {
        submitBtn.disabled = !input.value.trim();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
          this.submitComment(input.value.trim());
          input.value = '';
          submitBtn.disabled = true;
        }
      });

      submitBtn.addEventListener('click', () => {
        if (input.value.trim()) {
          this.submitComment(input.value.trim());
          input.value = '';
          submitBtn.disabled = true;
        }
      });
    }
  }

  private submitComment(content: string) {
    if (this.marker && this.events) {
      this.events.onAddComment(this.marker.id, content);
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getMarkerId(): string | null {
    return this.marker?.id || null;
  }
}

customElements.define('feedback-comments-panel', CommentsPanel);
