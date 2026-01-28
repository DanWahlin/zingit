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
      border: 3px dashed var(--highlight-color, #fbbf24);
      background: rgba(251, 191, 36, 0.15);
      border-radius: 4px;
      transition: all 0.1s ease;
      box-shadow: inset 0 0 0 1px rgba(251, 191, 36, 0.3);
    }

    .label {
      position: absolute;
      padding: 2px 8px;
      background: var(--highlight-color, #fbbf24);
      color: #1f2937;
      font-size: 11px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-weight: 500;
      white-space: nowrap;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Default: label above element */
    .label.position-top {
      top: -24px;
      border-radius: 4px 4px 0 0;
    }

    /* When element fills viewport: label inside at top */
    .label.position-top.fills-viewport {
      top: 4px;
      border-radius: 4px;
    }

    /* When near top edge: label below element */
    .label.position-bottom {
      bottom: -24px;
      border-radius: 0 0 4px 4px;
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
   * Check if element fills most of the viewport (used for label positioning)
   */
  private get fillsViewport(): boolean {
    return this.height > window.innerHeight - 100;
  }

  /**
   * Determine if the label should be positioned above or below the element.
   * If near the top of the viewport, position below to keep it visible.
   * But if element fills most of viewport, keep label at top (inside the box).
   */
  private get labelVerticalPosition(): 'position-top' | 'position-bottom' {
    // If element fills most of the viewport, always position at top (will be inside box)
    if (this.fillsViewport) {
      return 'position-top';
    }

    // If the highlight top is within 30px of the viewport top, position label below
    if (this.top < 30) {
      return 'position-bottom';
    }
    return 'position-top';
  }

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

    const labelClasses = [
      this.labelVerticalPosition,
      this.labelAlignment,
      this.fillsViewport ? 'fills-viewport' : ''
    ].filter(c => c).join(' ');

    return html`
      <div
        class="highlight"
        style="top: ${this.top}px; left: ${this.left}px; width: ${this.width}px; height: ${this.height}px;"
      >
        ${this.label ? html`<span class="label ${labelClasses}">${this.label}</span>` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zing-highlight': ZingHighlight;
  }
}
