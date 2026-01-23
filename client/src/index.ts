// client/src/index.ts
// Entry point for PokeUI

import './components/poke-ui.js';

// Inject PokeUI into the page
function inject() {
  // Remove existing instance if present
  const existing = document.querySelector('poke-ui');
  if (existing) {
    existing.remove();
  }

  // Create and append PokeUI
  const pokeUI = document.createElement('poke-ui');
  document.body.appendChild(pokeUI);
}

// Auto-inject when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inject);
} else {
  inject();
}

// Export for manual usage
export { inject };
