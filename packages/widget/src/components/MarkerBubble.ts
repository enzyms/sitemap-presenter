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

    const isResolved = this.marker.status === 'resolved';

    this.element.innerHTML = `
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

  getMarkerId(): string | null {
    return this.marker?.id || null;
  }

  destroy() {
    this.element.remove();
  }
}
