// client/src/components/highlight.ts
// Highlight overlay for hovered elements

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('poke-highlight')
export class PokeHighlight extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: absolute;
      pointer-events: none;
      z-index: 2147483645;
    }

    .highlight {
      position: absolute;
      border: 2px dashed var(--highlight-color, #fbbf24);
      background: rgba(251, 191, 36, 0.1);
      border-radius: 4px;
      transition: all 0.1s ease;
    }

    .label {
      position: absolute;
      top: -24px;
      left: 0;
      padding: 2px 8px;
      background: var(--highlight-color, #fbbf24);
      color: #1f2937;
      font-size: 11px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-weight: 500;
      border-radius: 4px 4px 0 0;
      white-space: nowrap;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `;

  @property({ type: Number }) top = 0;
  @property({ type: Number }) left = 0;
  @property({ type: Number }) width = 0;
  @property({ type: Number }) height = 0;
  @property({ type: String }) label = '';
  @property({ type: Boolean }) visible = false;

  render() {
    if (!this.visible) {
      return html``;
    }

    return html`
      <div
        class="highlight"
        style="top: ${this.top}px; left: ${this.left}px; width: ${this.width}px; height: ${this.height}px;"
      >
        ${this.label ? html`<span class="label">${this.label}</span>` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'poke-highlight': PokeHighlight;
  }
}
