// Widget CSS styles (will be injected into Shadow DOM)
export const widgetStyles = `
  :host {
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

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
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

  /* Marker bubble - custom element */
  feedback-marker-bubble {
    position: absolute;
    display: block;
    pointer-events: auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }

  /* Marker bubbles on the page */
  .marker-bubble {
    position: relative;
    z-index: 999997;
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

  /* Comments panel - custom element */
  feedback-comments-panel {
    position: fixed;
    z-index: 999999;
    display: block;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: var(--gray-800);
  }

  /* Comments panel - inner container */
  .comments-panel {
    width: 320px;
    max-height: 400px;
    background: white;
    border-radius: 12px;
    box-shadow: var(--shadow-xl);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .comments-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--gray-200);
    background: var(--gray-50);
  }

  .comments-panel-header h3 {
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .comments-panel-header .marker-number {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--primary-color);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
  }

  .comments-panel-header .marker-number.resolved {
    background: var(--success-color);
  }

  .comments-panel-close {
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--gray-500);
  }

  .comments-panel-close:hover {
    background: var(--gray-200);
    color: var(--gray-700);
  }

  .comments-panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    max-height: 250px;
  }

  .comment-item {
    margin-bottom: 12px;
  }

  .comment-item:last-child {
    margin-bottom: 0;
  }

  .comment-content {
    font-size: 13px;
    color: var(--gray-700);
    line-height: 1.5;
  }

  .comment-meta {
    font-size: 11px;
    color: var(--gray-400);
    margin-top: 4px;
  }

  .no-comments {
    text-align: center;
    color: var(--gray-400);
    font-size: 13px;
    padding: 16px 0;
  }

  .comments-panel-footer {
    padding: 12px 16px;
    border-top: 1px solid var(--gray-200);
    background: var(--gray-50);
  }

  .comment-input-wrapper {
    display: flex;
    gap: 8px;
  }

  .comment-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--gray-300);
    border-radius: 8px;
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
  }

  .comment-input:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
  }

  .comment-submit {
    padding: 8px 16px;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }

  .comment-submit:hover {
    background: var(--primary-hover);
  }

  .comment-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Actions row */
  .marker-actions {
    display: flex;
    gap: 8px;
    padding: 8px 16px;
    border-top: 1px solid var(--gray-200);
  }

  .marker-action-btn {
    flex: 1;
    padding: 6px 12px;
    border: 1px solid var(--gray-200);
    background: white;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .marker-action-btn:hover {
    background: var(--gray-50);
    border-color: var(--gray-300);
  }

  .marker-action-btn.resolve {
    color: var(--success-color);
  }

  .marker-action-btn.reopen {
    color: var(--primary-color);
  }

  .marker-action-btn.delete {
    color: #ef4444;
  }

  .marker-action-btn svg {
    width: 14px;
    height: 14px;
  }

  /* Element highlight during placement */
  .element-highlight {
    position: absolute;
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
  }

  .cancel-placement:hover {
    background: var(--gray-700);
  }
`;
