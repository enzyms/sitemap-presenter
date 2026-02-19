// Widget CSS styles (will be injected into Shadow DOM)
export const widgetStyles = `
  :host {
    position: fixed;
    z-index: 999999;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    overflow: visible;
    pointer-events: none;
    --primary-color: #f97316;
    --primary-hover: #ea580c;
    --primary-light: #fff7ed;
    --success-color: #22c55e;
    --success-light: #f0fdf4;
    --gray-50: #f9fafb;
    --gray-100: #f3f4f6;
    --gray-200: #e5e7eb;
    --gray-300: #d1d5db;
    --gray-400: #9ca3af;
    --gray-500: #6b7280;
    --gray-600: #4b5563;
    --gray-700: #374151;
    --gray-800: #1f2937;
    --gray-900: #111827;
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
    --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: var(--gray-800);
  }

  /* Floating button */
  .feedback-button {
    position: fixed;
    z-index: 999998;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 24px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: var(--shadow-lg);
    transition: all 0.2s ease;
    pointer-events: auto;
  }

  .feedback-button:hover {
    background: var(--primary-hover);
    transform: scale(1.02);
  }

  .feedback-button.active {
    background: var(--gray-800);
  }

  .feedback-button svg {
    width: 20px;
    height: 20px;
  }

  .feedback-button .count {
    background: white;
    color: var(--primary-color);
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
  }

  /* Position variants */
  .position-bottom-right { bottom: 24px; right: 24px; }
  .position-bottom-left { bottom: 24px; left: 24px; }
  .position-top-right { top: 24px; right: 24px; }
  .position-top-left { top: 24px; left: 24px; }

  /* Markers layer — fixed fullscreen, pointer-events pass through */
  .markers-layer {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 999997;
  }

  /* Marker bubble wrapper (replaces feedback-marker-bubble custom element) */
  .marker-bubble-wrapper {
    position: fixed;
    display: block;
    pointer-events: auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }

  /* Marker bubbles on the page */
  .marker-bubble {
    position: relative;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--primary-color);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: var(--shadow-md);
    border: 2px solid white;
    transition: all 0.15s ease;
    transform: translate(-50%, -50%);
  }

  .marker-bubble:hover {
    transform: translate(-50%, -50%) scale(1.15);
    box-shadow: var(--shadow-lg);
  }

  .marker-bubble.resolved {
    background: var(--success-color);
  }

  .marker-bubble.archived {
    background: var(--gray-400);
  }

  .marker-bubble.highlighted {
    transform: translate(-50%, -50%) scale(1.3);
    box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.3);
  }

  /* Placement mode cursor */
  .placement-cursor {
    position: fixed;
    z-index: 999999;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--primary-color);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    transform: translate(-50%, -50%);
    box-shadow: var(--shadow-lg);
    opacity: 0.9;
  }

  .placement-cursor svg {
    width: 16px;
    height: 16px;
  }

  /* Comments panel wrapper */
  @keyframes panelFadeIn {
    from { opacity: 0; transform: translateY(6px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  @keyframes panelFadeOut {
    from { opacity: 1; transform: translateY(0) scale(1); }
    to   { opacity: 0; transform: translateY(6px) scale(0.97); }
  }

  @keyframes bubbleFadeOut {
    from { opacity: 1; transform: scale(1); }
    to   { opacity: 0; transform: scale(0.5); }
  }

  .comments-panel-wrapper {
    position: fixed;
    z-index: 999999;
    display: block;
    pointer-events: auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: var(--gray-800);
    border: 4px solid color-mix(in srgb, var(--primary-color) 30%, transparent);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
    animation: panelFadeIn 0.2s ease both;
  }

  .comments-panel-wrapper.fade-out {
    animation: panelFadeOut 0.2s ease both;
    pointer-events: none;
  }

  .marker-bubble-wrapper.fade-out {
    animation: bubbleFadeOut 0.3s ease both;
    pointer-events: none;
  }

  /* Comments panel - inner container */
  .comments-panel {
    width: 300px;
    max-width: calc(100vw - 24px);
    max-height: 450px;
    background: #f8f9fa;
    display: flex;
    flex-direction: column;
    border: 2px solid white;
  }

  .comments-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px;
    background: #f8f9fa;
    cursor: grab;
    user-select: none;
  }

  .comments-panel-header .marker-number {
    width: 24px;
    height: 24px;
    border-radius: 50px;
    background: var(--primary-color);
    border: 1px solid white;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
  }

  .comments-panel-header .marker-number.resolved {
    background: var(--success-color);
  }

  .comments-panel-header .marker-number.archived {
    background: var(--gray-400);
  }

  .comments-panel-close {
    padding: 4px;
    border: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--gray-400);
    border-radius: 6px;
    transition: all 0.15s;
  }

  .comments-panel-close:hover {
    color: var(--gray-600);
    background: var(--gray-100);
  }

  .comments-panel-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: white;
    border-top: 1px solid #e4e6ea;
    border-bottom: 1px solid #e4e6ea;
    min-height: 80px;
    max-height: 250px;
  }

  .comments-list {
    overflow-y: auto;
    padding: 0;
  }

  .comments-list:empty {
    display: none;
  }

  .comment-item {
    padding: 8px 10px;
    border-bottom: 1px solid #f0f0f0;
  }

  .comment-item:last-child {
    border-bottom: none;
  }

  .comment-content {
    font-size: 13px;
    color: var(--gray-700);
    line-height: 1.4;
  }

  .comment-meta {
    font-size: 11px;
    color: var(--gray-400);
    margin-top: 2px;
  }

  .no-comments {
    display: none;
  }

  .comment-input-area {
    position: relative;
    padding: 10px;
    flex: 1;
    display: flex;
    flex-direction: column;
    border-top: 1px solid #e4e6ea;
  }

  .comment-input {
    width: 100%;
    min-height: 48px;
    padding: 0;
    border: none;
    font-size: 13px;
    font-family: inherit;
    color: var(--gray-800);
    background: transparent;
    outline: none;
    resize: none;
    line-height: 1.5;
  }

  .comment-input::placeholder {
    color: #9d9d9d;
  }

  .comment-submit {
    position: absolute;
    right: 12px;
    bottom: 12px;
    padding: 4px 12px;
    height: 24px;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
    display: flex;
    align-items: center;
  }

  .comment-submit:hover {
    background: var(--primary-hover);
  }

  .comment-submit:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .comments-panel-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: #f8f9fa;
  }

  /* Primary action button (Resolve / Archive / Reopen) */
  .primary-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    color: white;
  }

  .primary-action-btn svg {
    flex-shrink: 0;
  }

  .primary-action-btn.resolve {
    background: #16a34a;
  }

  .primary-action-btn.resolve:hover {
    background: #15803d;
  }

  .primary-action-btn.archive {
    background: var(--gray-500);
  }

  .primary-action-btn.archive:hover {
    background: var(--gray-600);
  }

  .primary-action-btn.reopen {
    background: var(--primary-color);
  }

  .primary-action-btn.reopen:hover {
    background: var(--primary-hover);
  }

  .primary-action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Kebab (falafel) menu */
  .kebab-menu {
    position: relative;
  }

  .kebab-trigger {
    padding: 4px;
    border: none;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--gray-500);
    transition: all 0.15s;
  }

  .kebab-trigger:hover {
    background: var(--gray-200);
  }

  .kebab-dropdown {
    position: absolute;
    bottom: 100%;
    right: 0;
    margin-bottom: 4px;
    background: white;
    border: 1px solid var(--gray-200);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    overflow: hidden;
    min-width: 140px;
    z-index: 10;
  }

  .kebab-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: transparent;
    font-size: 12px;
    font-weight: 500;
    color: var(--gray-700);
    cursor: pointer;
    text-align: left;
  }

  .kebab-item:hover {
    background: var(--gray-50);
  }

  .kebab-item.delete {
    color: #d51212;
  }

  .kebab-item.delete:hover {
    background: #fef2f2;
  }

  .kebab-item svg {
    flex-shrink: 0;
  }

  /* Element highlight during placement */
  .element-highlight {
    position: fixed;
    z-index: 999996;
    pointer-events: none;
    border: 2px solid var(--primary-color);
    background: rgba(249, 115, 22, 0.1);
    border-radius: 4px;
    transition: all 0.1s ease;
  }

  /* Tooltip */
  .tooltip {
    position: fixed;
    z-index: 999999;
    padding: 6px 10px;
    background: var(--gray-800);
    color: white;
    font-size: 12px;
    border-radius: 6px;
    pointer-events: none;
    white-space: nowrap;
  }

  /* Cancel button during placement */
  .cancel-placement {
    position: fixed;
    z-index: 999999;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 20px;
    background: var(--gray-800);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: var(--shadow-lg);
    pointer-events: auto;
  }

  .cancel-placement:hover {
    background: var(--gray-700);
  }
`;
