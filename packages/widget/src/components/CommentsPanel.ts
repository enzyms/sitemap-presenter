import type { MarkerWithComments, Comment, MarkerStatus } from '@sitemap-presenter/shared';

export interface CommentsPanelEvents {
  onClose: () => void;
  onAddComment: (markerId: string, content: string) => void;
  onStatusChange: (markerId: string, status: MarkerStatus) => void;
  onDelete: (markerId: string) => void;
  onMove: (markerId: string) => void;
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

      // Enable resolve button once first comment is added
      if (comments.length > 0 && this.marker.status === 'open') {
        const resolveBtn = this.element.querySelector('[data-action="resolve"]') as HTMLButtonElement;
        if (resolveBtn) {
          resolveBtn.disabled = false;
          resolveBtn.removeAttribute('title');
        }
      }
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

    const status = this.marker.status;

    // Primary action button based on status
    let primaryBtn = '';
    const hasComments = this.marker.comments.length > 0;

    if (status === 'open') {
      primaryBtn = `
        <button class="primary-action-btn resolve" data-action="resolve" ${!hasComments ? 'disabled title="Add a comment first"' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
            <path d="M5 13l4 4L19 7"/>
          </svg>
          Resolve
        </button>`;
    } else if (status === 'resolved') {
      primaryBtn = `
        <button class="primary-action-btn archive" data-action="archive">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <path d="M5 8h14M5 8a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1a2 2 0 01-2 2M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
          </svg>
          Archive
        </button>`;
    } else if (status === 'archived') {
      primaryBtn = `
        <button class="primary-action-btn reopen" data-action="reopen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Reopen
        </button>`;
    }

    this.element.innerHTML = `
      <div class="comments-panel">
        <div class="comments-panel-header">
          <span class="marker-number ${status === 'resolved' ? 'resolved' : ''} ${status === 'archived' ? 'archived' : ''}">${this.marker.number}</span>
          <button class="comments-panel-close" data-action="close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
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
          ${primaryBtn}
          <div class="kebab-menu">
            <button class="kebab-trigger" data-action="toggle-menu" title="More actions">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <circle cx="12" cy="5" r="2"/>
                <circle cx="12" cy="12" r="2"/>
                <circle cx="12" cy="19" r="2"/>
              </svg>
            </button>
            <div class="kebab-dropdown" data-kebab-dropdown style="display:none">
              ${status !== 'open' ? `
              <button class="kebab-item" data-action="reopen-menu">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Reopen
              </button>` : ''}
              <button class="kebab-item" data-action="move">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <path d="M5 9l4-4 4 4M5 15l4 4 4-4M15 9l4-4M15 15l4 4"/>
                </svg>
                Move marker
              </button>
              <button class="kebab-item delete" data-action="delete">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
                Delete
              </button>
            </div>
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

    // Status action buttons
    this.element.querySelector('[data-action="resolve"]')?.addEventListener('click', () => {
      if (this.marker && this.events) {
        this.events.onStatusChange(this.marker.id, 'resolved');
      }
    });

    this.element.querySelector('[data-action="archive"]')?.addEventListener('click', () => {
      if (this.marker && this.events) {
        this.events.onStatusChange(this.marker.id, 'archived');
      }
    });

    this.element.querySelector('[data-action="reopen"]')?.addEventListener('click', () => {
      if (this.marker && this.events) {
        this.events.onStatusChange(this.marker.id, 'open');
      }
    });

    // Kebab menu toggle
    const kebabDropdown = this.element.querySelector('[data-kebab-dropdown]') as HTMLElement;
    this.element.querySelector('[data-action="toggle-menu"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (kebabDropdown) {
        kebabDropdown.style.display = kebabDropdown.style.display === 'none' ? 'block' : 'none';
      }
    });

    // Reopen from kebab menu
    this.element.querySelector('[data-action="reopen-menu"]')?.addEventListener('click', () => {
      if (this.marker && this.events) {
        this.events.onStatusChange(this.marker.id, 'open');
      }
    });

    // Move button
    this.element.querySelector('[data-action="move"]')?.addEventListener('click', () => {
      if (this.marker && this.events) {
        this.events.onMove(this.marker.id);
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

  hasComments(): boolean {
    return (this.marker?.comments.length ?? 0) > 0;
  }

  focusInput() {
    const textarea = this.element.querySelector('[data-comment-input]') as HTMLTextAreaElement;
    if (textarea) {
      textarea.focus();
    }
  }

  fadeOut(): Promise<void> {
    return new Promise(resolve => {
      this.element.classList.add('fade-out');
      const done = () => { resolve(); };
      this.element.addEventListener('animationend', done, { once: true });
      // Safety fallback
      setTimeout(done, 250);
    });
  }

  destroy() {
    this.element.remove();
  }
}
