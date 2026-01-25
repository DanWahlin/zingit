import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('site-footer')
export class SiteFooter extends LitElement {
  static styles = css`
    :host {
      display: block;
      border-radius: 0 !important;
      border-bottom-left-radius: 0 !important;
      border-bottom-right-radius: 0 !important;
      overflow: visible;
    }

    .site-footer {
      background: #0f172a;
      color: #9ca3af;
      padding: 32px 24px;
      border-radius: 0 !important;
      border-bottom-left-radius: 0 !important;
      border-bottom-right-radius: 0 !important;
      overflow: visible;
    }

    .footer-content {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      justify-content: flex-start;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }

    .footer-links {
      display: flex;
      gap: 24px;
    }

    .footer-links a {
      color: #9ca3af;
      text-decoration: none;
      font-size: 14px;
    }

    .footer-links a:hover {
      color: white;
    }

    .footer-social {
      display: flex;
      gap: 16px;
    }

    .footer-social a {
      color: #9ca3af;
      transition: color 0.15s ease;
    }

    .footer-social a:hover {
      color: white;
    }
  `;

  render() {
    return html`
      <footer class="site-footer">
        <div class="footer-content">
          <div>&copy; 2026 ZingIt</div>
        </div>
      </footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'site-footer': SiteFooter;
  }
}
