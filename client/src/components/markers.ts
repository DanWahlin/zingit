// client/src/components/markers.ts
// Numbered markers for annotated elements

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Annotation, AnnotationStatus } from '../types/index.js';
import { getElementViewportRect, getViewportRect, getMarkerPosition } from '../utils/geometry.js';

interface MarkerPosition {
  id: string;
  number: number;
  top: number;
  left: number;
  visible: boolean;
  status: AnnotationStatus;
}

@customElement('poke-markers')
export class PokeMarkers extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 2147483644;
    }

    .marker {
      position: absolute;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--marker-color, #3b82f6);
      color: white;
      font-size: 12px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      pointer-events: auto;
      cursor: pointer;
      transition: transform 0.15s ease, background 0.3s ease;
    }

    .marker:hover {
      transform: scale(1.2);
    }

    /* Pause animation on hover for processing markers */
    .marker.processing:hover {
      animation-play-state: paused;
    }

    /* Status-based colors - use CSS variables for customization */
    .marker.pending {
      background: var(--marker-color, #3b82f6);
    }

    .marker.processing {
      background: var(--processing-color, #ef4444);
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% {
        transform: scale(1);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
      50% {
        transform: scale(1.15);
        box-shadow: 0 0 12px var(--processing-color, #ef4444);
      }
    }

    .marker.completed {
      background: var(--completed-color, #22c55e);
    }

    .delete-btn {
      position: absolute;
      top: -6px;
      right: -6px;
      width: 16px;
      height: 16px;
      display: none;
      align-items: center;
      justify-content: center;
      background: #ef4444;
      color: white;
      font-size: 10px;
      font-weight: bold;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      line-height: 1;
      padding: 0;
    }

    .marker:hover .delete-btn {
      display: flex;
    }

    .delete-btn:hover {
      background: #dc2626;
    }
  `;

  @property({ type: Array }) annotations: Annotation[] = [];
  @state() private positions: MarkerPosition[] = [];

  private scrollHandler: () => void;
  private resizeHandler: () => void;

  constructor() {
    super();
    this.scrollHandler = this.updatePositions.bind(this);
    this.resizeHandler = this.updatePositions.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    window.addEventListener('resize', this.resizeHandler, { passive: true });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('scroll', this.scrollHandler);
    window.removeEventListener('resize', this.resizeHandler);
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('annotations')) {
      this.updatePositions();
    }
  }

  private updatePositions() {
    const viewport = getViewportRect();

    this.positions = this.annotations.map((ann, index) => {
      const element = document.querySelector(ann.selector);
      if (!element) {
        return {
          id: ann.id,
          number: index + 1,
          top: 0,
          left: 0,
          visible: false,
          status: ann.status || 'pending'
        };
      }

      // Use viewport coordinates since poke-ui is position: fixed
      const rect = getElementViewportRect(element);
      const pos = getMarkerPosition(rect);
      // Check if element is in viewport (rect is already in viewport coords)
      const visible = rect.bottom > 0 && rect.top < viewport.height &&
                      rect.right > 0 && rect.left < viewport.width;

      return {
        id: ann.id,
        number: index + 1,
        top: pos.top,
        left: pos.left,
        visible,
        status: ann.status || 'pending'
      };
    });
  }

  render() {
    return html`
      ${this.positions
        .filter(pos => pos.visible)
        .map(pos => html`
          <div
            class="marker ${pos.status}"
            style="top: ${pos.top}px; left: ${pos.left}px;"
            @click=${() => this.handleMarkerClick(pos.id)}
          >
            ${pos.number}
            <button
              class="delete-btn"
              title="Delete annotation"
              @click=${(e: Event) => this.handleDelete(e, pos.id)}
            >×</button>
          </div>
        `)}
    `;
  }

  private handleMarkerClick(id: string) {
    this.dispatchEvent(new CustomEvent('marker-click', {
      detail: { id },
      bubbles: true,
      composed: true
    }));
  }

  private handleDelete(e: Event, id: string) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('marker-delete', {
      detail: { id },
      bubbles: true,
      composed: true
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'poke-markers': PokeMarkers;
  }
}
