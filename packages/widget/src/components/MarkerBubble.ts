import type { MarkerWithComments } from '@sitemap-presenter/shared';

export class MarkerBubble extends HTMLElement {
  private marker: MarkerWithComments | null = null;
  private highlighted = false;

  static get observedAttributes() {
    return ['highlighted'];
  }

  constructor() {
    super();
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
    const bubble = this.querySelector('.marker-bubble');
    if (bubble) {
      bubble.classList.toggle('highlighted', this.highlighted);
    }
  }

  private render() {
    if (!this.marker) return;

    const isResolved = this.marker.status === 'resolved';

    this.innerHTML = `
      <div class="marker-bubble ${isResolved ? 'resolved' : ''} ${this.highlighted ? 'highlighted' : ''}"
           data-marker-id="${this.marker.id}"
           title="Click to view comments">
        ${this.marker.number}
      </div>
    `;
  }

  updatePosition() {
    if (!this.marker) return;

    // Try to find the element using the anchor
    let element: Element | null = null;

    // Try CSS selector first
    if (this.marker.anchor.selector) {
      try {
        element = document.querySelector(this.marker.anchor.selector);
      } catch {
        // Invalid selector
      }
    }

    // Try XPath if selector failed
    if (!element && this.marker.anchor.xpath) {
      try {
        const result = document.evaluate(
          this.marker.anchor.xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        element = result.singleNodeValue as Element | null;
      } catch {
        // Invalid XPath
      }
    }

    let x: number, y: number;

    if (element) {
      // Position relative to element
      const rect = element.getBoundingClientRect();
      x = rect.left + this.marker.anchor.offsetX + window.scrollX;
      y = rect.top + this.marker.anchor.offsetY + window.scrollY;
    } else {
      // Use fallback position (percentage of viewport)
      x = (this.marker.fallback_position.xPercent / 100) * document.documentElement.scrollWidth;
      y = (this.marker.fallback_position.yPercent / 100) * document.documentElement.scrollHeight;
    }

    this.style.position = 'absolute';
    this.style.left = `${x}px`;
    this.style.top = `${y}px`;
    this.style.zIndex = '999997';
  }

  getMarkerId(): string | null {
    return this.marker?.id || null;
  }
}

customElements.define('feedback-marker-bubble', MarkerBubble);
