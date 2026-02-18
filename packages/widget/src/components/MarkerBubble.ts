import type { MarkerWithComments } from '@sitemap-presenter/shared';

export class MarkerBubble {
  public element: HTMLDivElement;
  private marker: MarkerWithComments | null = null;
  private highlighted = false;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'marker-bubble-wrapper';
  }

  setMarker(marker: MarkerWithComments) {
    this.marker = marker;
    this.render();
    this.updatePosition();
  }

  setHighlighted(value: boolean) {
    this.highlighted = value;
    this.updateHighlightClass();
  }

  private updateHighlightClass() {
    const bubble = this.element.querySelector('.marker-bubble');
    if (bubble) {
      bubble.classList.toggle('highlighted', this.highlighted);
    }
  }

  private render() {
    if (!this.marker) return;

    const statusClass = this.marker.status === 'archived' ? 'archived' : this.marker.status === 'resolved' ? 'resolved' : '';

    this.element.innerHTML = `
      <div class="marker-bubble ${statusClass} ${this.highlighted ? 'highlighted' : ''}"
           data-marker-id="${this.marker.id}"
           title="Click to view comments">
        ${this.marker.number}
      </div>
    `;
  }

  private resolveAnchorElement(): Element | null {
    if (!this.marker) return null;

    let targetElement: Element | null = null;

    // Try CSS selector first
    if (this.marker.anchor.selector) {
      try {
        targetElement = document.querySelector(this.marker.anchor.selector);
      } catch {
        // Invalid selector
      }
    }

    // Try XPath if selector failed
    if (!targetElement && this.marker.anchor.xpath) {
      try {
        const result = document.evaluate(
          this.marker.anchor.xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        targetElement = result.singleNodeValue as Element | null;
      } catch {
        // Invalid XPath
      }
    }

    return targetElement;
  }

  getAnchorVisibility(): { id: string; visible: boolean } | null {
    if (!this.marker) return null;
    const el = this.resolveAnchorElement();
    if (!el) return { id: this.marker.id, visible: false };
    const rect = el.getBoundingClientRect();
    return { id: this.marker.id, visible: rect.width > 0 || rect.height > 0 };
  }

  scrollToAnchor() {
    const el = this.resolveAnchorElement();
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  updatePosition() {
    if (!this.marker) return;

    const targetElement = this.resolveAnchorElement();

    let x: number, y: number;

    if (targetElement) {
      // Position relative to element using fixed positioning (viewport coords)
      const rect = targetElement.getBoundingClientRect();
      x = rect.left + this.marker.anchor.offsetX;
      y = rect.top + this.marker.anchor.offsetY;
    } else {
      // Use fallback position: convert document percentages to viewport coords
      const docX = (this.marker.fallback_position.xPercent / 100) * document.documentElement.scrollWidth;
      const docY = (this.marker.fallback_position.yPercent / 100) * document.documentElement.scrollHeight;
      x = docX - window.scrollX;
      y = docY - window.scrollY;
    }

    this.element.style.position = 'fixed';
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
  }

  /** Hide/show the bubble based on whether the anchor element is visible */
  updateVisibility(): boolean {
    const v = this.getAnchorVisibility();
    const visible = v ? v.visible : false;
    this.element.style.display = visible ? '' : 'none';
    return visible;
  }

  getMarkerId(): string | null {
    return this.marker?.id || null;
  }

  fadeOut(): Promise<void> {
    return new Promise(resolve => {
      this.element.classList.add('fade-out');
      const done = () => { resolve(); };
      this.element.addEventListener('animationend', done, { once: true });
      setTimeout(done, 350);
    });
  }

  destroy() {
    this.element.remove();
  }
}
