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

  /** Update the marker reference without re-rendering (e.g. when swapping temp → real ID). */
  updateMarkerRef(marker: MarkerWithComments) {
    this.marker = marker;
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

  positionNear(bubbleRect: DOMRect) {
    const gap = 12;
    const padding = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Measure actual rendered panel size
    const pr = this.element.getBoundingClientRect();
    const pw = pr.width || 312;
    const ph = pr.height || 300;

    const clampTop = (t: number) => Math.max(padding, Math.min(t, vh - ph - padding));
    const preferredTop = clampTop(bubbleRect.top - 20);

    // Try RIGHT of bubble
    const rightLeft = bubbleRect.right + gap;
    if (rightLeft + pw <= vw - padding) {
      this.setPosition(rightLeft, preferredTop);
      return;
    }

    // Try LEFT of bubble
    const leftLeft = bubbleRect.left - pw - gap;
    if (leftLeft >= padding) {
      this.setPosition(leftLeft, preferredTop);
      return;
    }

    // Try BELOW bubble (centered)
    const centeredLeft = Math.max(padding, Math.min(
      bubbleRect.left + bubbleRect.width / 2 - pw / 2,
      vw - pw - padding
    ));
    const belowTop = bubbleRect.bottom + gap;
    if (belowTop + ph <= vh - padding) {
      this.setPosition(centeredLeft, belowTop);
      return;
    }

    // Try ABOVE bubble (centered)
    const aboveTop = bubbleRect.top - ph - gap;
    if (aboveTop >= padding) {
      this.setPosition(centeredLeft, aboveTop);
      return;
    }

    // Fallback: clamp to viewport (may overlap bubble on very tight viewports)
    this.setPosition(
      Math.max(padding, Math.min(rightLeft, vw - pw - padding)),
      preferredTop
    );
  }

  private setPosition(left: number, top: number) {
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

    // Draggable header
    const header = this.element.querySelector('.comments-panel-header') as HTMLElement;
    if (header) {
      header.addEventListener('mousedown', (e: MouseEvent) => {
        // Don't drag when clicking the close button
        if ((e.target as Element).closest('[data-action="close"]')) return;

        e.preventDefault();
        header.style.cursor = 'grabbing';

        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = parseInt(this.element.style.left) || 0;
        const startTop = parseInt(this.element.style.top) || 0;

        const onMove = (me: MouseEvent) => {
          const pw = this.element.offsetWidth;
          const ph = this.element.offsetHeight;
          const newLeft = Math.max(0, Math.min(startLeft + me.clientX - startX, window.innerWidth - pw));
          const newTop = Math.max(0, Math.min(startTop + me.clientY - startY, window.innerHeight - ph));
          this.element.style.left = `${newLeft}px`;
          this.element.style.top = `${newTop}px`;
        };

        const onUp = () => {
          header.style.cursor = '';
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
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
      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        resolve();
      };
      this.element.classList.add('fade-out');
      this.element.addEventListener('animationend', done, { once: true });
      // Safety fallback if animation doesn't fire
      setTimeout(done, 250);
    });
  }

  destroy() {
    this.element.remove();
  }
}
