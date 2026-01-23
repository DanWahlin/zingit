// client/src/index.ts
// Entry point for ZingIt

import './components/zing-ui.js';

// Inject ZingIt into the page
function inject() {
  // Remove existing instance if present
  const existing = document.querySelector('zing-ui');
  if (existing) {
    existing.remove();
  }

  // Create and append ZingIt
  const zingUI = document.createElement('zing-ui');
  document.body.appendChild(zingUI);
}

// Auto-inject when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inject);
} else {
  inject();
}

// Export for manual usage
export { inject };
