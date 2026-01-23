// client/src/components/poke-ui.ts
// Main orchestrator component

import { LitElement, html, css } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import type { Annotation, PokeSettings, WSMessage } from '../types/index.js';
import { WebSocketClient } from '../services/websocket.js';
import { generateSelector, generateIdentifier, getElementHtml, getParentContext, getTextContent, getSiblingContext, getParentHtml } from '../services/selector.js';
import { saveAnnotations, loadAnnotations, clearAnnotations, saveSettings, loadSettings, saveAnnotationActive, loadAnnotationActive } from '../services/storage.js';
import { getElementViewportRect } from '../utils/geometry.js';
import { formatAnnotationsMarkdown, copyToClipboard } from '../utils/markdown.js';

import './toolbar.js';
import './highlight.js';
import './markers.js';
import './modal.js';
import './settings.js';
import './response.js';
import './toast.js';
import './help.js';
import type { PokeToast } from './toast.js';

@customElement('poke-ui')
export class PokeUI extends LitElement {
  // Shadow DOM enabled for style isolation (critical for bookmarklet)
  static styles = css`
    :host {
      display: block;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2147483640;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .toolbar-container {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      pointer-events: auto;
      z-index: 2147483646;
    }
  `;

  @state() private annotations: Annotation[] = [];
  @state() private settings: PokeSettings = loadSettings();
  @state() private wsConnected = false;
  @state() private wsMaxAttemptsReached = false;
  @state() private processing = false;
  @state() private agentName = '';
  @state() private agentModel = '';
  @state() private serverProjectDir = '';  // Server's default project directory
  @state() private annotationActive = loadAnnotationActive();

  @query('poke-toast') private toast!: PokeToast;

  // Highlight state
  @state() private highlightVisible = false;
  @state() private highlightRect = { top: 0, left: 0, width: 0, height: 0 };
  @state() private highlightLabel = '';

  // Modal state
  @state() private modalOpen = false;
  @state() private modalEditMode = false;
  @state() private modalAnnotationId = '';
  @state() private modalSelector = '';
  @state() private modalIdentifier = '';
  @state() private modalSelectedText = '';
  @state() private modalNotes = '';
  @state() private pendingElement: Element | null = null;

  // Settings panel state
  @state() private settingsOpen = false;

  // Help panel state
  @state() private helpOpen = false;

  // Hidden state (toolbar closed but can reopen)
  @state() private isHidden = false;

  // Response panel state
  @state() private responseOpen = false;
  @state() private responseContent = '';
  @state() private responseToolStatus = '';
  @state() private responseError = '';

  // Undo stack for annotations
  private undoStack: Annotation[] = [];

  private ws: WebSocketClient | null = null;
  private clickHandler: (e: MouseEvent) => void;
  private mouseMoveHandler: (e: MouseEvent) => void;
  private keydownHandler: (e: KeyboardEvent) => void;

  constructor() {
    super();
    this.clickHandler = this.handleDocumentClick.bind(this);
    this.mouseMoveHandler = this.handleDocumentMouseMove.bind(this);
    this.keydownHandler = this.handleDocumentKeydown.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();

    // Load saved annotations
    this.annotations = loadAnnotations();

    // Set up WebSocket
    this.initWebSocket();

    // Add document event listeners
    document.addEventListener('click', this.clickHandler, true);
    document.addEventListener('mousemove', this.mouseMoveHandler, true);
    document.addEventListener('keydown', this.keydownHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    // Clean up WebSocket
    if (this.ws) {
      this.ws.disconnect();
      this.ws = null;
    }

    // Remove document event listeners
    document.removeEventListener('click', this.clickHandler, true);
    document.removeEventListener('mousemove', this.mouseMoveHandler, true);
    document.removeEventListener('keydown', this.keydownHandler);
  }

  private initWebSocket() {
    this.ws = new WebSocketClient(this.settings.wsUrl);

    this.ws.on('open', () => {
      this.wsConnected = true;
      this.wsMaxAttemptsReached = false;

      // If we had processing annotations and reconnected (likely due to hot reload after agent made changes),
      // mark them as completed since the agent probably finished before the reload
      const hadProcessing = this.annotations.some(a => a.status === 'processing');
      if (hadProcessing) {
        console.log('[PokeUI] Reconnected with processing annotations - marking as completed');
        this.annotations = this.annotations.map(a =>
          a.status === 'processing' ? { ...a, status: 'completed' as const } : a
        );
        saveAnnotations(this.annotations);
        this.toast.success('Connected - changes completed');
      } else {
        this.toast.success('Connected to server');
      }
    });

    this.ws.on('close', () => {
      this.wsConnected = false;
    });

    this.ws.on('max_attempts', () => {
      this.wsMaxAttemptsReached = true;
      this.toast.error('Connection failed - click Reconnect to retry');
    });

    this.ws.on('message', (data) => {
      this.handleWSMessage(data as WSMessage);
    });

    if (this.settings.autoConnect) {
      this.ws.connect();
    }
  }

  private handleWSMessage(msg: WSMessage) {
    switch (msg.type) {
      case 'connected':
        this.agentName = msg.agent || '';
        this.agentModel = msg.model || '';
        this.serverProjectDir = msg.projectDir || '';
        break;

      case 'processing':
        this.processing = true;
        this.responseOpen = true;
        this.responseContent = '';
        this.responseError = '';
        break;

      case 'delta':
        this.responseContent += msg.content || '';
        break;

      case 'tool_start':
        this.responseToolStatus = msg.tool || '';
        break;

      case 'tool_end':
        this.responseToolStatus = '';
        break;

      case 'idle':
        this.processing = false;
        this.responseToolStatus = '';
        // Mark all processing annotations as completed
        console.log('[PokeUI] Before status update:', this.annotations.map(a => ({ id: a.id, status: a.status })));
        this.annotations = this.annotations.map(a =>
          a.status === 'processing' ? { ...a, status: 'completed' as const } : a
        );
        console.log('[PokeUI] After status update:', this.annotations.map(a => ({ id: a.id, status: a.status })));
        saveAnnotations(this.annotations);
        break;

      case 'error':
        this.responseError = msg.message || 'Unknown error';
        this.processing = false;
        this.responseToolStatus = '';
        // Revert processing annotations back to pending so user can retry
        this.annotations = this.annotations.map(a =>
          a.status === 'processing' ? { ...a, status: 'pending' as const } : a
        );
        saveAnnotations(this.annotations);
        this.toast.error(msg.message || 'An error occurred');
        break;

      case 'reset_complete':
        this.responseContent = '';
        this.responseError = '';
        break;
    }
  }

  private handleDocumentClick(e: MouseEvent) {
    const target = e.target as Element;

    // Ignore clicks on our own UI
    if (this.isOwnElement(target)) {
      return;
    }

    // Ignore if annotation mode is paused
    if (!this.annotationActive) {
      return;
    }

    // Ignore if modal is open
    if (this.modalOpen || this.settingsOpen) {
      return;
    }

    // Capture click for annotation
    e.preventDefault();
    e.stopPropagation();

    this.pendingElement = target;
    this.modalEditMode = false;
    this.modalAnnotationId = '';
    this.modalSelector = generateSelector(target);
    this.modalIdentifier = generateIdentifier(target);
    this.modalNotes = '';

    // Get selected text if any
    const selection = window.getSelection();
    this.modalSelectedText = selection?.toString().trim() || '';

    this.modalOpen = true;
  }

  private handleDocumentMouseMove(e: MouseEvent) {
    // Ignore if annotation mode is paused
    if (!this.annotationActive) {
      this.highlightVisible = false;
      return;
    }

    // Ignore if modal or settings open
    if (this.modalOpen || this.settingsOpen) {
      this.highlightVisible = false;
      return;
    }

    const target = e.target as Element;

    // Ignore our own elements
    if (this.isOwnElement(target)) {
      this.highlightVisible = false;
      return;
    }

    // Show highlight
    // Use viewport coordinates since poke-ui is position: fixed
    const rect = getElementViewportRect(target);
    this.highlightRect = rect;
    this.highlightLabel = generateIdentifier(target);
    this.highlightVisible = true;
  }

  private handleDocumentKeydown(e: KeyboardEvent) {
    // Escape to close modals
    if (e.key === 'Escape') {
      if (this.helpOpen) {
        this.helpOpen = false;
      } else if (this.modalOpen) {
        this.modalOpen = false;
      } else if (this.settingsOpen) {
        this.settingsOpen = false;
      } else if (this.responseOpen) {
        this.responseOpen = false;
      }
    }

    // Cmd/Ctrl+Z for undo (ignore if typing in input)
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      const target = e.target as HTMLElement;
      const tagName = target.tagName?.toLowerCase();
      const isEditable = tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
      if (!isEditable && this.undoStack.length > 0) {
        e.preventDefault();
        this.handleUndo();
      }
    }

    // "P" to toggle annotation mode (ignore if typing in input)
    if (e.key === 'p' || e.key === 'P') {
      const target = e.target as HTMLElement;
      const tagName = target.tagName?.toLowerCase();
      const isEditable = tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
      if (!isEditable) {
        this.handleToggle();
      }
    }

    // "?" to show help (ignore if typing in input)
    if (e.key === '?') {
      const target = e.target as HTMLElement;
      const tagName = target.tagName?.toLowerCase();
      const isEditable = tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
      if (!isEditable) {
        this.helpOpen = !this.helpOpen;
      }
    }

    // Backtick (`) to toggle PokeUI visibility (ignore if typing in input)
    if (e.key === '`') {
      const target = e.target as HTMLElement;
      const tagName = target.tagName?.toLowerCase();
      const isEditable = tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
      if (!isEditable) {
        this.isHidden = !this.isHidden;
        if (!this.isHidden) {
          this.toast.info('PokeUI visible');
        }
      }
    }
  }

  private isOwnElement(el: Element): boolean {
    // Check if element is part of PokeUI
    // Must handle Shadow DOM boundaries
    let current: Element | Node | null = el;
    while (current) {
      if (current instanceof Element && current.tagName?.toLowerCase().startsWith('poke-')) {
        return true;
      }
      // Try parentElement first, then check for shadow root host
      if (current instanceof Element && current.parentElement) {
        current = current.parentElement;
      } else {
        // Cross shadow DOM boundary
        const root = current.getRootNode();
        if (root instanceof ShadowRoot) {
          current = root.host;
        } else {
          current = null;
        }
      }
    }
    return false;
  }

  render() {
    // When hidden, only render toast for notifications
    if (this.isHidden) {
      return html`<poke-toast></poke-toast>`;
    }

    return html`
      <poke-highlight
        .top=${this.highlightRect.top}
        .left=${this.highlightRect.left}
        .width=${this.highlightRect.width}
        .height=${this.highlightRect.height}
        .label=${this.highlightLabel}
        .visible=${this.highlightVisible}
        style="--highlight-color: ${this.settings.highlightColor}"
      ></poke-highlight>

      <poke-markers
        .annotations=${this.annotations}
        style="--marker-color: ${this.settings.markerColor}"
        @marker-click=${this.handleMarkerClick}
        @marker-delete=${this.handleMarkerDelete}
      ></poke-markers>

      <div class="toolbar-container">
        <poke-toolbar
          .active=${this.annotationActive}
          .connected=${this.wsConnected}
          .processing=${this.processing}
          .maxAttemptsReached=${this.wsMaxAttemptsReached}
          .annotationCount=${this.annotations.length}
          .canUndo=${this.undoStack.length > 0}
          .agent=${this.agentName}
          .model=${this.agentModel}
          .hasResponse=${this.responseContent.length > 0 || this.responseError.length > 0}
          @toggle=${this.handleToggle}
          @send=${this.handleSend}
          @undo=${this.handleUndo}
          @export=${this.handleExport}
          @clear=${this.handleClear}
          @help=${() => this.helpOpen = true}
          @settings=${() => this.settingsOpen = true}
          @close=${this.handleClose}
          @reconnect=${this.handleReconnect}
          @show-response=${() => this.responseOpen = true}
        ></poke-toolbar>
      </div>

      <poke-modal
        .open=${this.modalOpen}
        .editMode=${this.modalEditMode}
        .annotationId=${this.modalAnnotationId}
        .selector=${this.modalSelector}
        .identifier=${this.modalIdentifier}
        .selectedText=${this.modalSelectedText}
        .notes=${this.modalNotes}
        @cancel=${() => this.modalOpen = false}
        @save=${this.handleModalSave}
      ></poke-modal>

      <poke-settings
        .open=${this.settingsOpen}
        .settings=${this.settings}
        .serverProjectDir=${this.serverProjectDir}
        @close=${() => this.settingsOpen = false}
        @save=${this.handleSettingsSave}
      ></poke-settings>

      <poke-response
        .open=${this.responseOpen}
        .processing=${this.processing}
        .content=${this.responseContent}
        .toolStatus=${this.responseToolStatus}
        .error=${this.responseError}
        @close=${() => this.responseOpen = false}
        @followup=${this.handleFollowUp}
      ></poke-response>

      <poke-help
        .open=${this.helpOpen}
        @close=${() => this.helpOpen = false}
      ></poke-help>

      <poke-toast></poke-toast>
    `;
  }

  private handleModalSave(e: CustomEvent<{ notes: string; editMode: boolean; annotationId: string }>) {
    const { notes, editMode, annotationId } = e.detail;

    if (editMode) {
      // Update existing annotation
      this.annotations = this.annotations.map(a =>
        a.id === annotationId ? { ...a, notes } : a
      );
      saveAnnotations(this.annotations);
      this.modalOpen = false;
      this.pendingElement = null;
      this.toast.success('Annotation updated');
    } else {
      // Create new annotation
      if (!this.pendingElement) return;

      const annotation: Annotation = {
        id: crypto.randomUUID(),
        selector: this.modalSelector,
        identifier: this.modalIdentifier,
        html: getElementHtml(this.pendingElement),
        notes,
        parentContext: getParentContext(this.pendingElement),
        textContent: getTextContent(this.pendingElement),
        siblingContext: getSiblingContext(this.pendingElement),
        parentHtml: getParentHtml(this.pendingElement),
        status: 'pending',
        ...(this.modalSelectedText ? { selectedText: this.modalSelectedText } : {})
      };

      this.annotations = [...this.annotations, annotation];
      saveAnnotations(this.annotations);

      // Push to undo stack
      this.undoStack = [...this.undoStack, annotation];

      this.modalOpen = false;
      this.pendingElement = null;
      this.toast.success('Annotation saved');
    }
  }

  private handleMarkerClick(e: CustomEvent<{ id: string }>) {
    const annotation = this.annotations.find(a => a.id === e.detail.id);
    if (annotation) {
      // Open modal in edit mode
      this.modalEditMode = true;
      this.modalAnnotationId = annotation.id;
      this.modalSelector = annotation.selector;
      this.modalIdentifier = annotation.identifier;
      this.modalSelectedText = annotation.selectedText || '';
      this.modalNotes = annotation.notes;
      this.pendingElement = document.querySelector(annotation.selector);
      this.modalOpen = true;
    }
  }

  private handleMarkerDelete(e: CustomEvent<{ id: string }>) {
    const id = e.detail.id;
    this.annotations = this.annotations.filter(a => a.id !== id);
    // Also remove from undo stack if it's there
    this.undoStack = this.undoStack.filter(a => a.id !== id);
    saveAnnotations(this.annotations);
    this.toast.info('Annotation deleted');
  }

  private handleSend() {
    if (!this.ws || !this.wsConnected || this.annotations.length === 0) return;

    // Use client-specified projectDir if set, otherwise server will use its default
    const projectDir = this.settings.projectDir || undefined;

    // Mark all pending annotations as processing
    console.log('[PokeUI] Before send, statuses:', this.annotations.map(a => ({ id: a.id, status: a.status })));
    this.annotations = this.annotations.map(a =>
      a.status !== 'completed' ? { ...a, status: 'processing' as const } : a
    );
    console.log('[PokeUI] After marking as processing:', this.annotations.map(a => ({ id: a.id, status: a.status })));
    saveAnnotations(this.annotations);

    this.ws.sendBatch({
      pageUrl: window.location.href,
      pageTitle: document.title,
      annotations: this.annotations
    }, projectDir);

    this.toast.info(`Sent ${this.annotations.length} annotation${this.annotations.length > 1 ? 's' : ''} to agent`);
  }

  private handleExport() {
    const markdown = formatAnnotationsMarkdown(
      this.annotations,
      window.location.href,
      document.title
    );
    copyToClipboard(markdown).then(() => {
      this.toast.success('Copied to clipboard');
    }).catch(() => {
      this.toast.error('Failed to copy to clipboard');
    });
  }

  private handleUndo() {
    if (this.undoStack.length === 0) return;

    // Pop the last annotation from the undo stack
    const lastAnnotation = this.undoStack[this.undoStack.length - 1];
    this.undoStack = this.undoStack.slice(0, -1);

    // Remove it from annotations
    this.annotations = this.annotations.filter(a => a.id !== lastAnnotation.id);
    saveAnnotations(this.annotations);

    this.toast.info('Annotation removed');
  }

  private handleClear() {
    this.annotations = [];
    this.undoStack = [];
    clearAnnotations();
    this.ws?.sendReset();
    this.toast.info('Annotations cleared');
  }

  private handleClose() {
    // Hide PokeUI (press ` to show again)
    this.isHidden = true;
    this.toast.info('Press ` to show PokeUI');
  }

  private handleReconnect() {
    this.ws?.forceReconnect();
  }

  private handleToggle() {
    this.annotationActive = !this.annotationActive;
    saveAnnotationActive(this.annotationActive);

    // Clear highlight when disabling annotation mode
    if (!this.annotationActive) {
      this.highlightVisible = false;
    }
  }

  private handleSettingsSave(e: CustomEvent<{ settings: PokeSettings }>) {
    this.settings = e.detail.settings;
    saveSettings(this.settings);
    this.settingsOpen = false;

    // Update WebSocket URL if changed
    if (this.ws) {
      this.ws.setUrl(this.settings.wsUrl);
      this.ws.forceReconnect();
    }
  }

  private handleFollowUp(e: CustomEvent<{ message: string }>) {
    if (!this.ws || !this.wsConnected) return;
    this.ws.sendMessage(e.detail.message);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'poke-ui': PokeUI;
  }
}
