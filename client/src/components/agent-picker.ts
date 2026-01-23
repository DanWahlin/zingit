// client/src/components/agent-picker.ts
// Agent selection dialog - shown on first run or when user needs to pick an agent

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { AgentInfo } from '../types/index.js';

@customElement('zing-agent-picker')
export class ZingAgentPicker extends LitElement {
  static override styles = css`
    :host {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.6);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      pointer-events: auto;
    }

    .dialog {
      background: #1e1e1e;
      border-radius: 16px;
      padding: 32px;
      max-width: 600px;
      width: 90%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      animation: slideIn 0.2s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    h2 {
      margin: 0 0 8px 0;
      color: #fff;
      font-size: 24px;
      font-weight: 600;
    }

    .subtitle {
      color: #888;
      margin: 0 0 24px 0;
      font-size: 14px;
    }

    .agents {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .agent-card {
      background: #2a2a2a;
      border: 2px solid #3a3a3a;
      border-radius: 12px;
      padding: 20px;
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: center;
    }

    .agent-card:hover:not(.unavailable) {
      border-color: #4a4a4a;
      background: #333;
    }

    .agent-card.selected {
      border-color: #3b82f6;
      background: #1e3a5f;
    }

    .agent-card.unavailable {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .agent-name {
      font-weight: 600;
      color: #fff;
      margin-bottom: 4px;
      font-size: 16px;
    }

    .agent-version {
      font-size: 12px;
      color: #888;
      margin-bottom: 8px;
    }

    .agent-status {
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 4px;
      display: inline-block;
    }

    .agent-status.available {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
    }

    .agent-status.unavailable {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }

    .agent-reason {
      font-size: 11px;
      color: #888;
      margin-top: 8px;
      word-break: break-word;
    }

    .install-cmd {
      font-size: 10px;
      font-family: monospace;
      background: #1a1a1a;
      padding: 4px 8px;
      border-radius: 4px;
      margin-top: 8px;
      color: #888;
      display: block;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    button {
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      border: none;
    }

    button.primary {
      background: #3b82f6;
      color: #fff;
    }

    button.primary:hover:not(:disabled) {
      background: #2563eb;
    }

    button.primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    button.secondary {
      background: #3a3a3a;
      color: #fff;
    }

    button.secondary:hover {
      background: #4a4a4a;
    }

    .error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid #ef4444;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
      color: #ef4444;
      font-size: 13px;
    }

    .loading {
      text-align: center;
      color: #888;
      padding: 40px;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #3a3a3a;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;

  @property({ type: Array }) agents: AgentInfo[] = [];
  @property({ type: Boolean }) loading = false;
  @property({ type: String }) error = '';
  @property({ type: String }) currentAgent = '';

  @state() private selectedAgent = '';

  override connectedCallback(): void {
    super.connectedCallback();
    // Pre-select current agent if set
    if (this.currentAgent) {
      this.selectedAgent = this.currentAgent;
    }
    // Handle escape key
    this.handleKeyDown = this.handleKeyDown.bind(this);
    document.addEventListener('keydown', this.handleKeyDown);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.dispatchEvent(new CustomEvent('close'));
    }
  }

  private selectAgent(agent: AgentInfo): void {
    if (!agent.available) return;
    this.selectedAgent = agent.name;
  }

  private confirm(): void {
    if (!this.selectedAgent) return;
    this.dispatchEvent(new CustomEvent('select', {
      detail: { agent: this.selectedAgent }
    }));
  }

  override render() {
    return html`
      <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
        <h2>Choose Your AI Agent</h2>
        <p class="subtitle">Select which AI assistant will help you make UI changes</p>

        ${this.error ? html`<div class="error">${this.error}</div>` : ''}

        ${this.loading ? html`
          <div class="loading">
            <div class="spinner"></div>
            <div>Loading available agents...</div>
          </div>
        ` : html`
          <div class="agents">
            ${this.agents.map(agent => html`
              <div
                class="agent-card ${agent.available ? '' : 'unavailable'} ${this.selectedAgent === agent.name ? 'selected' : ''}"
                @click=${() => this.selectAgent(agent)}
              >
                <div class="agent-name">${agent.displayName}</div>
                ${agent.version ? html`<div class="agent-version">${agent.version}</div>` : ''}
                <span class="agent-status ${agent.available ? 'available' : 'unavailable'}">
                  ${agent.available ? 'Available' : 'Not Available'}
                </span>
                ${!agent.available && agent.reason ? html`
                  <div class="agent-reason">${agent.reason}</div>
                  <code class="install-cmd">${agent.installCommand}</code>
                ` : ''}
              </div>
            `)}
          </div>

          <div class="actions">
            <button class="secondary" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>
              Cancel
            </button>
            <button
              class="primary"
              ?disabled=${!this.selectedAgent}
              @click=${this.confirm}
            >
              Continue with ${this.agents.find(a => a.name === this.selectedAgent)?.displayName || 'Agent'}
            </button>
          </div>
        `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zing-agent-picker': ZingAgentPicker;
  }
}
