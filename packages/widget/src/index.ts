/**
 * Feedback Widget
 *
 * A drop-in embeddable widget for collecting visual feedback on any website.
 *
 * Usage:
 * <script
 *   src="https://your-domain.com/widget.js"
 *   data-api-key="site_abc123"
 *   async
 * ></script>
 */

// Import FeedbackWidget to register it as a custom element
// (MarkerBubble and CommentsPanel are now plain classes, not custom elements)
import './components/FeedbackWidget';

const STORAGE_KEY = 'feedback-widget-active';

// Find the script tag that loaded this widget
function findWidgetScript(): Element | undefined {
  const scripts = document.querySelectorAll('script[data-api-key]');
  return Array.from(scripts).find(script => {
    const src = script.getAttribute('src') || '';
    return src.includes('widget.js') || src.includes('widget');
  });
}

// Create and append the widget element
function createAndAppendWidget(): void {
  const currentScript = findWidgetScript();

  if (!currentScript) {
    console.log('[FeedbackWidget] No auto-init script found. Initialize manually with <feedback-widget data-api-key="...">');
    return;
  }

  // Don't initialize twice
  if (document.querySelector('feedback-widget')) {
    return;
  }

  const widget = document.createElement('feedback-widget');

  const apiKey = currentScript.getAttribute('data-api-key');
  if (apiKey) widget.setAttribute('data-api-key', apiKey);

  const position = currentScript.getAttribute('data-position');
  if (position) widget.setAttribute('data-position', position);

  const color = currentScript.getAttribute('data-color');
  if (color) widget.setAttribute('data-color', color);

  document.body.appendChild(widget);
  console.log('[FeedbackWidget] Widget initialized');
}

// Remove the widget from the DOM
function removeWidget(): void {
  const widget = document.querySelector('feedback-widget');
  if (widget) {
    widget.remove();
    console.log('[FeedbackWidget] Widget removed');
  }
}

// Check URL params and localStorage to determine if widget should be active
function checkActivationState(): boolean {
  const url = new URL(location.href);
  const feedbackParam = url.searchParams.get('feedback');

  if (feedbackParam !== null) {
    const active = feedbackParam === 'on';
    localStorage.setItem(STORAGE_KEY, String(active));

    // Clean the param from URL
    url.searchParams.delete('feedback');
    history.replaceState(history.state, '', url.toString());

    return active;
  }

  return localStorage.getItem(STORAGE_KEY) === 'true';
}

// Toggle widget visibility
function toggleWidget(): void {
  const widget = document.querySelector('feedback-widget');
  if (widget) {
    removeWidget();
    localStorage.setItem(STORAGE_KEY, 'false');
  } else {
    createAndAppendWidget();
    localStorage.setItem(STORAGE_KEY, 'true');
  }
}

// Main initialization
function initializeWidget() {
  if (checkActivationState()) {
    createAndAppendWidget();
  }
}

// Keyboard shortcut: Ctrl+Shift+F (Cmd+Shift+F on Mac)
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.shiftKey && (e.ctrlKey || e.metaKey) && e.key === 'F') {
    e.preventDefault();
    toggleWidget();
  }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeWidget);
} else {
  initializeWidget();
}

// Watch for URL changes or DOM swaps that destroy the widget.
// Works universally with any framework (Astro, Turbo, Livewire, etc.).
let lastUrl = location.href;
setInterval(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    // Re-check activation state on URL change (handles ?feedback=on/off in SPA navigation)
    if (checkActivationState()) {
      createAndAppendWidget(); // has built-in duplicate check
    } else {
      removeWidget();
    }
  } else if (checkActivationState() && !document.querySelector('feedback-widget')) {
    // Widget was active but got removed by DOM swap — re-create it
    createAndAppendWidget();
  }
}, 500);

// Export for manual usage
export { FeedbackWidget } from './components/FeedbackWidget';
export { FeedbackAPI, getAPI, resetAPI } from './api/supabase';
export * from '@sitemap-presenter/shared';
