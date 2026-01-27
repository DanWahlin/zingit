import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('site-header')
export class SiteHeader extends LitElement {
  @property({ type: String }) activePage = '';

  static styles = css`
    :host {
      display: block;
    }

    .site-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: #fff;
      color: white;
      position: relative;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 20px;
      font-weight: 700;
      text-decoration: none;
      color: black;
    }

    .brand svg {
      width: 28px;
      height: 28px;
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 24px;
      margin-left: auto;
      margin-right: 16px;
    }

    .nav-links a {
      color: black;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: color 0.15s ease;
    }

    .nav-links a:hover,
    .nav-links a.active {
      color: black;
    }

    .nav-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .nav-actions a {
      display: flex;
      align-items: center;
      color: black;
      transition: color 0.15s ease;
    }

    .nav-actions a:hover {
      color: black;
    }
  `;

  render() {
    return html`
      <nav class="site-nav">
        <a href="/" class="brand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="#fbbf24" stroke="none"/>
          </svg>
          ZingIt
        </a>
        <div class="nav-links">
          <a href="/demo.html" class=${this.activePage === 'demo' ? 'active' : ''}>Demo</a>
          <a href="/about.html" class=${this.activePage === 'about' ? 'active' : ''}>About</a>
          <a href="/contact.html" class=${this.activePage === 'contact' ? 'active' : ''}>Contribute</a>
        </div>
        <div class="nav-actions">
          <a href="https://github.com/danwahlin/zingit" target="_blank" title="GitHub">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
        </div>
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'site-header': SiteHeader;
  }
}
