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

// Import components to register them as custom elements
import './components/MarkerBubble';
import './components/CommentsPanel';
import './components/FeedbackWidget';

// Auto-initialize: find the script tag and create widget
function initializeWidget() {
  // Find the script tag that loaded this widget
  const scripts = document.querySelectorAll('script[data-api-key]');
  const currentScript = Array.from(scripts).find(script => {
    const src = script.getAttribute('src') || '';
    return src.includes('widget.js') || src.includes('widget');
  });

  if (!currentScript) {
    // No script with data-api-key found, widget might be initialized manually
    console.log('[FeedbackWidget] No auto-init script found. Initialize manually with <feedback-widget data-api-key="...">');
    return;
  }

  // Don't initialize twice
  if (document.querySelector('feedback-widget')) {
    console.log('[FeedbackWidget] Widget already initialized');
    return;
  }

  // Create widget element with attributes from script tag
  const widget = document.createElement('feedback-widget');

  const apiKey = currentScript.getAttribute('data-api-key');
  if (apiKey) widget.setAttribute('data-api-key', apiKey);

  const position = currentScript.getAttribute('data-position');
  if (position) widget.setAttribute('data-position', position);

  const color = currentScript.getAttribute('data-color');
  if (color) widget.setAttribute('data-color', color);

  // Append to body
  document.body.appendChild(widget);

  console.log('[FeedbackWidget] Widget initialized');
}

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
  const urlChanged = location.href !== lastUrl;
  const widgetMissing = !document.querySelector('feedback-widget');
  if (urlChanged || widgetMissing) {
    lastUrl = location.href;
    initializeWidget(); // has built-in duplicate check
  }
}, 500);

// Export for manual usage
export { FeedbackWidget } from './components/FeedbackWidget';
export { FeedbackAPI, getAPI, resetAPI } from './api/supabase';
export * from '@sitemap-presenter/shared';
