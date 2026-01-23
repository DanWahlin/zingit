// client/src/components/settings.ts
// Settings panel for configuration

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PokeSettings } from '../types/index.js';

@customElement('poke-settings')
export class PokeSettingsPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      pointer-events: auto;
    }

    .panel {
      background: #1f2937;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      width: 100%;
      max-width: 400px;
      margin: 16px;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #374151;
    }

    .title {
      font-size: 16px;
      font-weight: 600;
      color: white;
      margin: 0;
    }

    .close-btn {
      background: none;
      border: none;
      padding: 4px;
      cursor: pointer;
      color: #9ca3af;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
    }

    .close-btn:hover {
      background: #374151;
      color: white;
    }

    .body {
      padding: 20px;
    }

    .field {
      margin-bottom: 16px;
    }

    .field:last-child {
      margin-bottom: 0;
    }

    label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #d1d5db;
      margin-bottom: 6px;
    }

    input[type="text"],
    input[type="url"] {
      width: 100%;
      padding: 10px 12px;
      font-size: 14px;
      font-family: inherit;
      background: #111827;
      border: 1px solid #374151;
      border-radius: 6px;
      color: white;
      box-sizing: border-box;
    }

    input:focus {
      outline: none;
      border-color: #3b82f6;
    }

    input::placeholder {
      color: #6b7280;
    }

    .color-field {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    input[type="color"] {
      width: 40px;
      height: 40px;
      padding: 0;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      background: none;
    }

    input[type="color"]::-webkit-color-swatch-wrapper {
      padding: 0;
    }

    input[type="color"]::-webkit-color-swatch {
      border: none;
      border-radius: 6px;
    }

    .color-value {
      font-size: 13px;
      color: #9ca3af;
      font-family: 'SF Mono', Monaco, monospace;
    }

    .checkbox-field {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: #3b82f6;
      cursor: pointer;
    }

    .checkbox-label {
      font-size: 14px;
      color: #d1d5db;
      cursor: pointer;
    }

    .footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px 20px;
      border-top: 1px solid #374151;
    }

    button {
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 500;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-cancel {
      background: #374151;
      color: #d1d5db;
    }

    .btn-cancel:hover {
      background: #4b5563;
    }

    .btn-save {
      background: #3b82f6;
      color: white;
    }

    .btn-save:hover {
      background: #2563eb;
    }
  `;

  @property({ type: Boolean }) open = false;
  @property({ type: String }) serverProjectDir = '';  // Server's default
  @property({ type: Object }) settings: PokeSettings = {
    wsUrl: 'ws://localhost:8765',
    highlightColor: '#fbbf24',
    markerColor: '#3b82f6',
    processingColor: '#ef4444',
    completedColor: '#22c55e',
    autoConnect: true,
    projectDir: '',
    playSoundOnComplete: true
  };

  private localSettings: PokeSettings = { ...this.settings };

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('settings')) {
      this.localSettings = { ...this.settings };
    }
  }

  render() {
    if (!this.open) {
      return html``;
    }

    return html`
      <div class="overlay" @click=${this.handleClose}>
        <div class="panel" @click=${(e: Event) => e.stopPropagation()}>
          <div class="header">
            <h2 class="title">Settings</h2>
            <button class="close-btn" @click=${this.handleClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="body">
            <div class="field">
              <label for="wsUrl">WebSocket URL</label>
              <input
                type="url"
                id="wsUrl"
                .value=${this.localSettings.wsUrl}
                @input=${(e: Event) => this.updateSetting('wsUrl', (e.target as HTMLInputElement).value)}
                placeholder="ws://localhost:8765"
              />
            </div>

            <div class="field">
              <label for="projectDir">Project Directory</label>
              <input
                type="text"
                id="projectDir"
                .value=${this.localSettings.projectDir || this.serverProjectDir}
                @input=${(e: Event) => this.updateSetting('projectDir', (e.target as HTMLInputElement).value)}
                placeholder="Enter project directory path"
              />
            </div>

            <div class="field">
              <label>Highlight Color</label>
              <div class="color-field">
                <input
                  type="color"
                  .value=${this.localSettings.highlightColor}
                  @input=${(e: Event) => this.updateSetting('highlightColor', (e.target as HTMLInputElement).value)}
                />
                <span class="color-value">${this.localSettings.highlightColor}</span>
              </div>
            </div>

            <div class="field">
              <label>Pending Color</label>
              <div class="color-field">
                <input
                  type="color"
                  .value=${this.localSettings.markerColor}
                  @input=${(e: Event) => this.updateSetting('markerColor', (e.target as HTMLInputElement).value)}
                />
                <span class="color-value">${this.localSettings.markerColor}</span>
              </div>
            </div>

            <div class="field">
              <label>Processing Color</label>
              <div class="color-field">
                <input
                  type="color"
                  .value=${this.localSettings.processingColor}
                  @input=${(e: Event) => this.updateSetting('processingColor', (e.target as HTMLInputElement).value)}
                />
                <span class="color-value">${this.localSettings.processingColor}</span>
              </div>
            </div>

            <div class="field">
              <label>Completed Color</label>
              <div class="color-field">
                <input
                  type="color"
                  .value=${this.localSettings.completedColor}
                  @input=${(e: Event) => this.updateSetting('completedColor', (e.target as HTMLInputElement).value)}
                />
                <span class="color-value">${this.localSettings.completedColor}</span>
              </div>
            </div>

            <div class="field">
              <div class="checkbox-field">
                <input
                  type="checkbox"
                  id="autoConnect"
                  .checked=${this.localSettings.autoConnect}
                  @change=${(e: Event) => this.updateSetting('autoConnect', (e.target as HTMLInputElement).checked)}
                />
                <label class="checkbox-label" for="autoConnect">Auto-connect on startup</label>
              </div>
            </div>

            <div class="field">
              <div class="checkbox-field">
                <input
                  type="checkbox"
                  id="playSoundOnComplete"
                  .checked=${this.localSettings.playSoundOnComplete}
                  @change=${(e: Event) => this.updateSetting('playSoundOnComplete', (e.target as HTMLInputElement).checked)}
                />
                <label class="checkbox-label" for="playSoundOnComplete">Play sound when agent completes</label>
              </div>
            </div>
          </div>

          <div class="footer">
            <button class="btn-cancel" @click=${this.handleClose}>
              Cancel
            </button>
            <button class="btn-save" @click=${this.handleSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private updateSetting<K extends keyof PokeSettings>(key: K, value: PokeSettings[K]) {
    this.localSettings = { ...this.localSettings, [key]: value };
    this.requestUpdate();
  }

  private handleClose() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private handleSave() {
    this.dispatchEvent(new CustomEvent('save', {
      bubbles: true,
      composed: true,
      detail: { settings: this.localSettings }
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'poke-settings': PokeSettingsPanel;
  }
}
