import type { MarkerWithComments, Comment, MarkerStatus } from '@sitemap-presenter/shared';

export interface CommentsPanelEvents {
  onClose: () => void;
  onAddComment: (markerId: string, content: string) => void;
  onStatusChange: (markerId: string, status: MarkerStatus) => void;
  onDelete: (markerId: string) => void;
}

export class CommentsPanel {
  public element: HTMLDivElement;
  private marker: MarkerWithComments | null = null;
  private events: CommentsPanelEvents | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'comments-panel-wrapper';
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
    const panelWidth = 260;
    const panelHeight = 300;
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

    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
  }

  private render() {
    if (!this.marker) return;

    const isResolved = this.marker.status === 'resolved';

    this.element.innerHTML = `
      <div class="comments-panel">
        <div class="comments-panel-header">
          <span class="marker-number ${isResolved ? 'resolved' : ''}">${this.marker.number}</span>
          <button class="comments-panel-close" data-action="close">&times;</button>
        </div>

        <div class="comments-panel-body">
          <div class="comments-list" data-comments-container>
            ${this.renderCommentsHTML()}
          </div>
          <div class="comment-input-area">
            <textarea class="comment-input" placeholder="Add a comment..." rows="2" data-comment-input></textarea>
            <button class="comment-submit" data-action="submit" disabled>Send</button>
          </div>
        </div>

        <div class="comments-panel-footer">
          <button class="action-btn delete" data-action="delete">Delete</button>
          ${isResolved ? `
            <button class="action-btn reopen" data-action="reopen">Reopen</button>
          ` : `
            <button class="action-btn resolve" data-action="resolve">Resolve</button>
          `}
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
    const container = this.element.querySelector('[data-comments-container]');
    if (container) {
      container.innerHTML = this.renderCommentsHTML();
    }
  }

  private attachEventListeners() {
    // Close button
    this.element.querySelector('[data-action="close"]')?.addEventListener('click', () => {
      this.events?.onClose();
    });

    // Resolve/Reopen button
    this.element.querySelector('[data-action="resolve"]')?.addEventListener('click', () => {
      if (this.marker && this.events) {
        this.events.onStatusChange(this.marker.id, 'resolved');
      }
    });

    this.element.querySelector('[data-action="reopen"]')?.addEventListener('click', () => {
      if (this.marker && this.events) {
        this.events.onStatusChange(this.marker.id, 'open');
      }
    });

    // Delete button
    this.element.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      if (this.marker && this.events) {
        if (confirm('Delete this feedback marker?')) {
          this.events.onDelete(this.marker.id);
        }
      }
    });

    // Comment textarea
    const textarea = this.element.querySelector('[data-comment-input]') as HTMLTextAreaElement;
    const submitBtn = this.element.querySelector('[data-action="submit"]') as HTMLButtonElement;

    if (textarea && submitBtn) {
      textarea.addEventListener('input', () => {
        submitBtn.disabled = !textarea.value.trim();
      });

      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && textarea.value.trim()) {
          e.preventDefault();
          this.submitComment(textarea.value.trim());
          textarea.value = '';
          submitBtn.disabled = true;
        }
      });

      submitBtn.addEventListener('click', () => {
        if (textarea.value.trim()) {
          this.submitComment(textarea.value.trim());
          textarea.value = '';
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

  destroy() {
    this.element.remove();
  }
}
