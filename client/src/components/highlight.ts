// client/src/components/highlight.ts
// Highlight overlay for hovered elements

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('zing-highlight')
export class ZingHighlight extends LitElement {
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

    /* Default: label on the left */
    .label.align-left {
      left: 0;
      right: auto;
    }

    /* When near right edge: label on the right */
    .label.align-right {
      left: auto;
      right: 0;
    }
  `;

  @property({ type: Number }) top = 0;
  @property({ type: Number }) left = 0;
  @property({ type: Number }) width = 0;
  @property({ type: Number }) height = 0;
  @property({ type: String }) label = '';
  @property({ type: Boolean }) visible = false;

  /**
   * Determine if the label should be right-aligned to prevent overflow.
   * If the element is in the right portion of the viewport, align label to the right.
   */
  private get labelAlignment(): 'align-left' | 'align-right' {
    // Calculate where the right edge of the highlight box is
    const highlightRight = this.left + this.width;
    const viewportWidth = window.innerWidth;

    // If the highlight's right edge is within 220px of the viewport edge
    // (200px max label width + 20px buffer), align the label to the right
    if (highlightRight > viewportWidth - 220) {
      return 'align-right';
    }

    // Also check if the highlight starts past the midpoint and is narrow
    // This handles cases where element is small but positioned far right
    if (this.left > viewportWidth - 250) {
      return 'align-right';
    }

    return 'align-left';
  }

  render() {
    if (!this.visible) {
      return html``;
    }

    return html`
      <div
        class="highlight"
        style="top: ${this.top}px; left: ${this.left}px; width: ${this.width}px; height: ${this.height}px;"
      >
        ${this.label ? html`<span class="label ${this.labelAlignment}">${this.label}</span>` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zing-highlight': ZingHighlight;
  }
}
