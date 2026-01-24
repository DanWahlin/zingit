// client/src/components/zing-ui.ts
// Main orchestrator component

import { LitElement, html, css } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import html2canvas from 'html2canvas';
import type { Annotation, ZingSettings, WSMessage, AgentInfo } from '../types/index.js';
import { WebSocketClient } from '../services/websocket.js';
import { generateSelector, generateIdentifier, getElementHtml, getParentContext, getTextContent, getSiblingContext, getParentHtml } from '../services/selector.js';
import { saveAnnotations, loadAnnotations, clearAnnotations, saveSettings, loadSettings, saveAnnotationActive, loadAnnotationActive, saveToolbarPosition, loadToolbarPosition, clearToolbarPosition, saveResponseState, loadResponseState, clearResponseState, type ToolbarPosition } from '../services/storage.js';
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
import './agent-picker.js';
import './history-panel.js';
import './undo-bar.js';
import type { ZingToast } from './toast.js';
import type { ZingHistoryPanel } from './history-panel.js';
import type { CheckpointInfo } from '../types/index.js';

@customElement('zing-ui')
export class ZingUI extends LitElement {
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
      pointer-events: auto;
      z-index: 2147483646;
    }

    .toolbar-container.default-position {
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
    }

    .toolbar-container.custom-position {
      transform: none;
    }

    .toolbar-container.dragging {
      user-select: none;
    }
  `;

  @state() private annotations: Annotation[] = [];
  @state() private settings: ZingSettings = loadSettings();
  @state() private wsConnected = false;
  @state() private wsMaxAttemptsReached = false;
  @state() private processing = false;
  @state() private agentName = '';
  @state() private agentModel = '';
  @state() private serverProjectDir = '';  // Server's default project directory
  @state() private annotationActive = loadAnnotationActive();
  @state() private availableAgents: AgentInfo[] = [];
  @state() private agentPickerOpen = false;
  @state() private agentPickerLoading = false;
  @state() private agentPickerError = '';

  @query('zing-toast') private toast!: ZingToast;
  @query('zing-history-panel') private historyPanel!: ZingHistoryPanel;

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
  @state() private modalCaptureScreenshot = false;
  @state() private modalScreenshotPreview = '';
  @state() private modalScreenshotLoading = false;

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
  @state() private responseScreenshotCount = 0;

  // Undo stack for annotations
  private undoStack: Annotation[] = [];

  // History panel state
  @state() private historyOpen = false;
  @state() private historyCheckpoints: CheckpointInfo[] = [];
  @state() private historyLoading = false;

  // Undo bar state
  @state() private undoBarVisible = false;
  @state() private undoBarFilesModified = 0;

  // Toolbar position and drag state
  @state() private toolbarPosition: ToolbarPosition | null = loadToolbarPosition();
  @state() private isDragging = false;
  private dragOffset = { x: 0, y: 0 };

  private ws: WebSocketClient | null = null;
  private clickHandler: (e: MouseEvent) => void;
  private mouseMoveHandler: (e: MouseEvent) => void;
  private keydownHandler: (e: KeyboardEvent) => void;
  private dragMoveHandler: (e: MouseEvent) => void;
  private dragEndHandler: (e: MouseEvent) => void;

  constructor() {
    super();
    this.clickHandler = this.handleDocumentClick.bind(this);
    this.mouseMoveHandler = this.handleDocumentMouseMove.bind(this);
    this.keydownHandler = this.handleDocumentKeydown.bind(this);
    this.dragMoveHandler = this.handleDragMove.bind(this);
    this.dragEndHandler = this.handleDragEnd.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();

    // Load saved annotations
    this.annotations = loadAnnotations();

    // Restore response dialog state if it was saved before auto-refresh
    const savedResponseState = loadResponseState();
    if (savedResponseState) {
      this.responseOpen = savedResponseState.open;
      this.responseContent = savedResponseState.content;
      this.responseError = savedResponseState.error;
      this.responseScreenshotCount = savedResponseState.screenshotCount;
      // Clear saved state after restoring (one-time restore)
      clearResponseState();
    }

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
        console.log('[ZingIt] Reconnected with processing annotations - marking as completed');
        this.annotations = this.annotations.map(a =>
          a.status === 'processing' ? { ...a, status: 'completed' as const } : a
        );
        saveAnnotations(this.annotations);
        this.toast.success('Connected - changes completed');
      } else {
        this.toast.success('Connected to server');
      }

      // Request available agents from server
      this.ws?.requestAgents();
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
        // Continuously save response state if autoRefresh is enabled
        // This ensures state persists even if Vite HMR triggers before our explicit reload
        if (this.settings.autoRefresh && this.responseContent) {
          this.saveCurrentResponseState();
        }
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
        this.updateAnnotationStatuses('processing', 'completed');
        if (this.settings.playSoundOnComplete) {
          this.playCompletionSound();
        }
        // Refresh history after a short delay to get finalized checkpoint data
        setTimeout(() => {
          if (this.ws && this.wsConnected) {
            this.ws.send({ type: 'get_history' });
          }
        }, 500);
        if (this.settings.autoRefresh) {
          this.saveCurrentResponseState();
          this.toast.info('Refreshing page...');
          setTimeout(() => window.location.reload(), 1000);
        }
        break;

      case 'error':
        this.responseError = msg.message || 'Unknown error';
        this.processing = false;
        this.responseToolStatus = '';
        this.updateAnnotationStatuses('processing', 'pending');
        this.toast.error(msg.message || 'An error occurred');
        break;

      case 'reset_complete':
        this.responseContent = '';
        this.responseError = '';
        break;

      case 'agents':
        // Received list of available agents from server
        this.availableAgents = msg.agents || [];
        this.agentPickerLoading = false;
        this.agentPickerError = '';

        // If no agent is currently selected, show the agent picker
        if (!this.agentName && this.availableAgents.length > 0) {
          // Check if user has a previously selected agent in settings
          if (this.settings.selectedAgent) {
            // Try to use the previously selected agent
            const previousAgent = this.availableAgents.find(a => a.name === this.settings.selectedAgent);
            if (previousAgent?.available) {
              this.ws?.selectAgent(this.settings.selectedAgent);
            } else {
              // Previously selected agent not available, show picker
              this.agentPickerOpen = true;
            }
          } else {
            // No previously selected agent, show picker
            this.agentPickerOpen = true;
          }
        }
        break;

      case 'agent_selected':
        // Agent was successfully selected
        this.agentName = msg.agent || '';
        this.agentModel = msg.model || '';
        this.agentPickerOpen = false;

        // Save selection to settings
        this.settings = { ...this.settings, selectedAgent: this.agentName };
        saveSettings(this.settings);

        this.toast.success(`Using ${msg.agent || 'agent'}`);
        break;

      case 'agent_error':
        // Error selecting agent
        this.agentPickerError = msg.message || 'Failed to select agent';
        this.toast.error(msg.message || 'Failed to select agent');
        break;

      // History/Undo feature handlers
      case 'checkpoint_created':
        if (msg.checkpoint) {
          // Update or add checkpoint
          const existingIndex = this.historyCheckpoints.findIndex(c => c.id === msg.checkpoint!.id);
          if (existingIndex >= 0) {
            this.historyCheckpoints = [
              ...this.historyCheckpoints.slice(0, existingIndex),
              msg.checkpoint,
              ...this.historyCheckpoints.slice(existingIndex + 1)
            ];
          } else {
            this.historyCheckpoints = [...this.historyCheckpoints, msg.checkpoint];
          }

          // Show undo bar if checkpoint is applied and settings allow
          if (msg.checkpoint.status === 'applied' && msg.checkpoint.filesModified > 0 && this.settings.showUndoBar) {
            this.undoBarFilesModified = msg.checkpoint.filesModified;
            this.undoBarVisible = true;
          }
        }
        break;

      case 'history':
        this.historyCheckpoints = msg.checkpoints || [];
        this.historyLoading = false;
        break;

      case 'undo_complete':
        this.handleCheckpointRestored('Change undone');
        break;

      case 'revert_complete':
        this.handleCheckpointRestored('Reverted to checkpoint');
        break;

      case 'history_cleared':
        this.historyCheckpoints = [];
        this.toast.info('History cleared');
        break;
    }
  }

  private handleDocumentClick(e: MouseEvent) {
    // Ignore if annotation mode is paused
    if (!this.annotationActive) {
      return;
    }

    // Ignore if no agent is selected (agent picker should be showing)
    if (!this.agentName) {
      return;
    }

    // Ignore if modal or panel is open
    if (this.modalOpen || this.settingsOpen || this.agentPickerOpen || this.historyOpen) {
      return;
    }

    // Get the deepest element from the event, piercing through Shadow DOM
    const target = this.getTargetElement(e);

    // Ignore if no valid target found (only ZingIt elements at this point)
    if (!target) {
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
    this.modalCaptureScreenshot = false;
    this.modalScreenshotPreview = '';

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

    // Ignore if no agent is selected
    if (!this.agentName) {
      this.highlightVisible = false;
      return;
    }

    // Ignore if modal, settings, or agent picker open
    if (this.modalOpen || this.settingsOpen || this.agentPickerOpen) {
      this.highlightVisible = false;
      return;
    }

    // Get the deepest element from the event, piercing through Shadow DOM
    // This allows highlighting elements inside Lit components (headers, footers, etc.)
    const target = this.getTargetElement(e);

    // Hide highlight if no valid target found
    if (!target) {
      this.highlightVisible = false;
      return;
    }

    // Show highlight
    // Use viewport coordinates since zing-ui is position: fixed
    const rect = getElementViewportRect(target);
    this.highlightRect = rect;
    this.highlightLabel = generateIdentifier(target);
    this.highlightVisible = true;
  }

  private isEditableTarget(e: KeyboardEvent): boolean {
    // Use composedPath to handle Shadow DOM - the actual target might be inside a shadow root
    const path = e.composedPath();
    for (const el of path) {
      if (el instanceof HTMLElement) {
        const tagName = el.tagName?.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || el.isContentEditable) {
          return true;
        }
      }
    }
    return false;
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
      } else if (this.historyOpen) {
        this.historyOpen = false;
      } else if (this.responseOpen) {
        this.responseOpen = false;
      } else if (this.undoBarVisible) {
        this.undoBarVisible = false;
      }
    }

    // Skip keyboard shortcuts if typing in an input field (including inside Shadow DOM)
    if (this.isEditableTarget(e)) return;

    // Cmd/Ctrl+Z for undo (both annotation and git-based)
    const canGitUndo = this.historyCheckpoints.some(c => c.canUndo);
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey && (this.undoStack.length > 0 || canGitUndo)) {
      e.preventDefault();
      this.handleUndo();
    }

    // "P" to toggle annotation mode
    if (e.key === 'p' || e.key === 'P') {
      this.handleToggle();
    }

    // "?" to show help
    if (e.key === '?') {
      this.helpOpen = !this.helpOpen;
    }

    // Backtick (`) to toggle ZingIt visibility
    if (e.key === '`') {
      this.isHidden = !this.isHidden;
      if (!this.isHidden) {
        this.toast.info('ZingIt visible');
      }
    }
  }

  private isOwnElement(el: Element): boolean {
    // Check if element is part of ZingIt
    // Must handle Shadow DOM boundaries
    let current: Element | Node | null = el;
    while (current) {
      if (current instanceof Element && current.tagName?.toLowerCase().startsWith('zing-')) {
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

  /**
   * Check if event originated from within any zing-* element.
   * Uses composedPath to check all elements in the event path.
   */
  private isEventFromOwnElement(e: MouseEvent): boolean {
    const path = e.composedPath();
    for (const node of path) {
      if (node instanceof Element && node.tagName?.toLowerCase().startsWith('zing-')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get the deepest target element from a mouse event, excluding ZingIt's own elements.
   * Uses composedPath() which traverses through shadow DOM boundaries and gives
   * the actual event propagation path from deepest element to window.
   */
  private getTargetElement(e: MouseEvent): Element | null {
    // Quick check: if the event originated from any zing-* element, return null immediately
    if (this.isEventFromOwnElement(e)) {
      return null;
    }

    // composedPath() returns the event path from deepest target to window,
    // including elements inside shadow DOMs
    const path = e.composedPath();

    for (const node of path) {
      if (!(node instanceof Element)) {
        continue;
      }

      // Stop at body/html - if we've reached here, nothing valid was found
      const tagName = node.tagName.toLowerCase();
      if (tagName === 'body' || tagName === 'html') {
        break;
      }

      if (!this.isOwnElement(node)) {
        return node;
      }
    }

    // Fallback to elementsFromPoint if composedPath doesn't help
    // (e.g., when event target is document itself)
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    for (const el of elements) {
      // Skip body/html in fallback too
      const tagName = el.tagName.toLowerCase();
      if (tagName === 'body' || tagName === 'html') {
        continue;
      }

      if (!this.isOwnElement(el)) {
        return el;
      }
    }

    return null;
  }

  render() {
    // When hidden, only render toast for notifications
    if (this.isHidden) {
      return html`<zing-toast></zing-toast>`;
    }

    return html`
      <zing-highlight
        .top=${this.highlightRect.top}
        .left=${this.highlightRect.left}
        .width=${this.highlightRect.width}
        .height=${this.highlightRect.height}
        .label=${this.highlightLabel}
        .visible=${this.highlightVisible}
        style="--highlight-color: ${this.settings.highlightColor}"
      ></zing-highlight>

      <zing-markers
        .annotations=${this.annotations}
        style="--marker-color: ${this.settings.markerColor}; --processing-color: ${this.settings.processingColor}; --completed-color: ${this.settings.completedColor}"
        @marker-click=${this.handleMarkerClick}
        @marker-delete=${this.handleMarkerDelete}
      ></zing-markers>

      <div
        class="toolbar-container ${this.toolbarPosition ? 'custom-position' : 'default-position'} ${this.isDragging ? 'dragging' : ''}"
        style="${this.toolbarPosition ? `left: ${this.toolbarPosition.x}px; top: ${this.toolbarPosition.y}px;` : ''}"
      >
        <zing-toolbar
          .active=${this.annotationActive}
          .connected=${this.wsConnected}
          .processing=${this.processing}
          .maxAttemptsReached=${this.wsMaxAttemptsReached}
          .annotationCount=${this.annotations.length}
          .canUndo=${this.undoStack.length > 0 || this.historyCheckpoints.some(c => c.canUndo)}
          .agent=${this.agentName}
          .model=${this.agentModel}
          .responseOpen=${this.responseOpen}
          .historyOpen=${this.historyOpen}
          @toggle=${this.handleToggle}
          @send=${this.handleSend}
          @undo=${this.handleUndo}
          @export=${this.handleExport}
          @clear=${this.handleClear}
          @help=${() => this.helpOpen = true}
          @settings=${() => this.settingsOpen = true}
          @close=${this.handleClose}
          @reconnect=${this.handleReconnect}
          @toggle-response=${() => this.responseOpen = !this.responseOpen}
          @toggle-history=${this.handleToggleHistory}
          @change-agent=${() => this.agentPickerOpen = true}
          @drag-start=${this.handleToolbarDragStart}
          @drag-reset=${this.handleToolbarDragReset}
        ></zing-toolbar>
      </div>

      <zing-modal
        .open=${this.modalOpen}
        .editMode=${this.modalEditMode}
        .annotationId=${this.modalAnnotationId}
        .selector=${this.modalSelector}
        .identifier=${this.modalIdentifier}
        .selectedText=${this.modalSelectedText}
        .notes=${this.modalNotes}
        .captureScreenshot=${this.modalCaptureScreenshot}
        .screenshotPreview=${this.modalScreenshotPreview}
        .screenshotLoading=${this.modalScreenshotLoading}
        @cancel=${this.handleModalCancel}
        @save=${this.handleModalSave}
        @screenshot-toggle=${this.handleScreenshotToggle}
      ></zing-modal>

      <zing-settings
        .open=${this.settingsOpen}
        .settings=${this.settings}
        .serverProjectDir=${this.serverProjectDir}
        .agents=${this.availableAgents}
        @close=${() => this.settingsOpen = false}
        @save=${this.handleSettingsSave}
        @agent-change=${this.handleAgentChange}
      ></zing-settings>

      ${this.agentPickerOpen ? html`
        <zing-agent-picker
          .agents=${this.availableAgents}
          .loading=${this.agentPickerLoading}
          .error=${this.agentPickerError}
          .currentAgent=${this.agentName}
          @select=${this.handleAgentPickerSelect}
          @close=${() => this.agentPickerOpen = false}
        ></zing-agent-picker>
      ` : ''}

      <zing-response
        .open=${this.responseOpen}
        .processing=${this.processing}
        .autoRefresh=${this.settings.autoRefresh}
        .content=${this.responseContent}
        .toolStatus=${this.responseToolStatus}
        .error=${this.responseError}
        .screenshotCount=${this.responseScreenshotCount}
        @close=${() => this.responseOpen = false}
        @stop=${this.handleStop}
        @followup=${this.handleFollowUp}
      ></zing-response>

      <zing-help
        .open=${this.helpOpen}
        @close=${() => this.helpOpen = false}
      ></zing-help>

      <zing-history-panel
        .isOpen=${this.historyOpen}
        .checkpoints=${this.historyCheckpoints}
        .isLoading=${this.historyLoading}
        @close=${() => this.historyOpen = false}
        @undo=${this.handleGitUndo}
        @revert-to=${this.handleRevertTo}
        @clear-history=${this.handleClearHistory}
      ></zing-history-panel>

      <zing-undo-bar
        .visible=${this.undoBarVisible}
        .filesModified=${this.undoBarFilesModified}
        .timeout=${this.settings.undoBarTimeout}
        @undo=${this.handleGitUndo}
        @dismiss=${() => this.undoBarVisible = false}
      ></zing-undo-bar>

      <zing-toast></zing-toast>
    `;
  }

  private handleModalCancel() {
    this.modalOpen = false;
    this.pendingElement = null;
    this.modalCaptureScreenshot = false;
    this.modalScreenshotPreview = '';
    this.modalScreenshotLoading = false;
  }

  private async handleScreenshotToggle(e: CustomEvent<{ enabled: boolean }>) {
    // Sync parent state with checkbox
    this.modalCaptureScreenshot = e.detail.enabled;

    if (e.detail.enabled && this.pendingElement) {
      // Capture new screenshot preview (even if editing, recapture for current element state)
      this.modalScreenshotLoading = true;
      try {
        const canvas = await html2canvas(this.pendingElement as HTMLElement, {
          logging: false,
          useCORS: true,
          allowTaint: true,
          backgroundColor: null,
          scale: 1
        });
        this.modalScreenshotPreview = canvas.toDataURL('image/png');
      } catch (err) {
        console.warn('ZingIt: Failed to capture screenshot preview', err);
        this.modalScreenshotPreview = '';
      }
      this.modalScreenshotLoading = false;
    } else if (!e.detail.enabled) {
      // Clear preview when unchecked
      this.modalScreenshotPreview = '';
    }
  }

  private handleModalSave(e: CustomEvent<{ notes: string; editMode: boolean; annotationId: string; captureScreenshot: boolean }>) {
    try {
      const { notes, editMode, annotationId, captureScreenshot } = e.detail;

      if (editMode) {
        // Update existing annotation and reset status to pending so it can be sent again
        // Also update the screenshot: use current preview if capturing, or remove if unchecked
        const screenshot = captureScreenshot && this.modalScreenshotPreview ? this.modalScreenshotPreview : undefined;

        this.annotations = this.annotations.map(a => {
          if (a.id === annotationId) {
            // Create updated annotation, removing screenshot property if not capturing
            const updated = { ...a, notes, status: 'pending' as const };
            if (screenshot) {
              updated.screenshot = screenshot;
            } else {
              delete updated.screenshot;
            }
            return updated;
          }
          return a;
        });
        saveAnnotations(this.annotations);
        this.handleModalCancel();
        this.toast.success('Annotation updated');
      } else {
        // Create new annotation
        if (!this.pendingElement) return;

        // Use pre-captured screenshot if available
        const screenshot = captureScreenshot && this.modalScreenshotPreview ? this.modalScreenshotPreview : undefined;

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
          ...(this.modalSelectedText ? { selectedText: this.modalSelectedText } : {}),
          ...(screenshot ? { screenshot } : {})
        };

        this.annotations = [...this.annotations, annotation];
        saveAnnotations(this.annotations);

        // Push to undo stack
        this.undoStack = [...this.undoStack, annotation];

        this.handleModalCancel();
        this.toast.success(screenshot ? 'Annotation saved with screenshot' : 'Annotation saved');
      }
    } catch (err) {
      console.error('ZingIt: Error saving annotation', err);
      this.toast.error('Failed to save annotation');
    }
  }

  private handleMarkerClick(e: CustomEvent<{ id: string }>) {
    try {
      const annotation = this.annotations.find(a => a.id === e.detail.id);
      if (annotation) {
        // Open modal in edit mode
        this.modalEditMode = true;
        this.modalAnnotationId = annotation.id;
        this.modalSelector = annotation.selector;
        this.modalIdentifier = annotation.identifier;
        this.modalSelectedText = annotation.selectedText || '';
        this.modalNotes = annotation.notes;

        // Restore screenshot state if annotation has a screenshot
        this.modalCaptureScreenshot = !!annotation.screenshot;
        this.modalScreenshotPreview = annotation.screenshot || '';

        this.pendingElement = document.querySelector(annotation.selector);
        if (!this.pendingElement) {
          this.toast.info('Element no longer exists on page');
        }
        this.modalOpen = true;
      }
    } catch (err) {
      console.error('ZingIt: Error handling marker click', err);
      this.toast.error('Failed to open annotation');
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

    // Only send pending annotations (not completed ones)
    const pendingAnnotations = this.annotations.filter(a => a.status !== 'completed');
    if (pendingAnnotations.length === 0) {
      this.toast.info('No pending annotations to send');
      return;
    }

    this.updateAnnotationStatuses('pending', 'processing');

    // Send only the annotations being processed
    const annotationsToSend = this.annotations.filter(a => a.status === 'processing');
    const screenshotCount = annotationsToSend.filter(a => a.screenshot).length;

    // Store screenshot count for response panel
    this.responseScreenshotCount = screenshotCount;

    this.ws.sendBatch({
      pageUrl: window.location.href,
      pageTitle: document.title,
      annotations: annotationsToSend
    }, projectDir);

    // Build toast message with screenshot info
    let message = `Sent ${annotationsToSend.length} annotation${annotationsToSend.length > 1 ? 's' : ''}`;
    if (screenshotCount > 0) {
      message += ` (${screenshotCount} with screenshot${screenshotCount > 1 ? 's' : ''})`;
    }
    message += ' to agent';
    this.toast.info(message);
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
    // First try git-based undo if available
    const canGitUndo = this.historyCheckpoints.some(c => c.canUndo);
    if (canGitUndo) {
      this.handleGitUndo();
      return;
    }

    // Fall back to annotation undo stack
    if (this.undoStack.length === 0) return;

    // Pop the last annotation from the undo stack
    const lastAnnotation = this.undoStack[this.undoStack.length - 1];
    this.undoStack = this.undoStack.slice(0, -1);

    // Remove it from annotations
    this.annotations = this.annotations.filter(a => a.id !== lastAnnotation.id);
    saveAnnotations(this.annotations);

    this.toast.info('Annotation removed');
  }

  private handleGitUndo() {
    if (!this.ws || !this.wsConnected) {
      this.toast.error('Not connected to server');
      return;
    }

    // Send undo request to server
    this.ws.send({ type: 'undo' });
    this.undoBarVisible = false;
  }

  private handleRevertTo(e: CustomEvent<{ checkpointId: string }>) {
    if (!this.ws || !this.wsConnected) {
      this.toast.error('Not connected to server');
      return;
    }

    // Send revert request to server
    this.ws.send({
      type: 'revert_to',
      checkpointId: e.detail.checkpointId
    });
  }

  private handleClearHistory() {
    if (!this.ws || !this.wsConnected) {
      this.toast.error('Not connected to server');
      return;
    }

    // Send clear history request to server
    this.ws.send({ type: 'clear_history' });
  }

  private handleToggleHistory() {
    this.historyOpen = !this.historyOpen;

    // Load history when opening
    if (this.historyOpen && this.ws && this.wsConnected) {
      this.historyLoading = true;
      this.ws.send({ type: 'get_history' });
    }
  }

  private handleClear() {
    this.annotations = [];
    this.undoStack = [];
    clearAnnotations();
    this.ws?.sendReset();
    this.toast.info('Annotations cleared');
  }

  private handleClose() {
    // Hide ZingIt (press ` to show again)
    this.isHidden = true;
    this.toast.info('Press ` to show ZingIt');
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

  private handleSettingsSave(e: CustomEvent<{ settings: ZingSettings }>) {
    this.settings = e.detail.settings;
    saveSettings(this.settings);
    this.settingsOpen = false;

    // Update WebSocket URL if changed
    if (this.ws) {
      this.ws.setUrl(this.settings.wsUrl);
      this.ws.forceReconnect();
    }
  }

  private handleAgentPickerSelect(e: CustomEvent<{ agent: string }>) {
    const agentName = e.detail.agent;
    if (this.ws && this.wsConnected) {
      this.ws.selectAgent(agentName);
    }
  }

  private handleAgentChange(e: CustomEvent<{ agent: string }>) {
    const agentName = e.detail.agent;
    if (this.ws && this.wsConnected && agentName !== this.agentName) {
      this.ws.selectAgent(agentName);
    }
  }

  private handleFollowUp(e: CustomEvent<{ message: string }>) {
    if (!this.ws || !this.wsConnected) return;

    // Show processing state and prepare for response
    this.processing = true;
    this.responseContent += `\n\n---\n**You:** ${e.detail.message}\n\n`;
    this.responseError = '';
    this.responseToolStatus = '';

    this.ws.sendMessage(e.detail.message);
  }

  private handleStop() {
    if (!this.ws || !this.wsConnected) return;
    this.ws.sendStop();
    this.processing = false;
    this.responseToolStatus = '';
    this.updateAnnotationStatuses('processing', 'pending');
    this.toast.info('Agent stopped');
  }

  private playCompletionSound() {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

      // Create a pleasant two-tone ding
      const playTone = (frequency: number, startTime: number, duration: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        // Envelope: quick attack, gentle decay
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      const now = audioContext.currentTime;
      // Two-tone ding: C6 followed by E6 (major third interval)
      playTone(1047, now, 0.15);        // C6
      playTone(1319, now + 0.1, 0.2);   // E6

      // Clean up audio context after sound finishes
      setTimeout(() => audioContext.close(), 500);
    } catch (err) {
      console.warn('ZingIt: Could not play completion sound', err);
    }
  }

  // ============================================
  // Helper methods for common operations
  // ============================================

  /** Save current response state to storage (for persistence across refresh) */
  private saveCurrentResponseState() {
    saveResponseState({
      open: this.responseOpen,
      content: this.responseContent,
      error: this.responseError,
      screenshotCount: this.responseScreenshotCount
    });
  }

  /** Update annotation statuses and save to storage */
  private updateAnnotationStatuses(
    fromStatus: 'pending' | 'processing' | 'completed',
    toStatus: 'pending' | 'processing' | 'completed'
  ) {
    this.annotations = this.annotations.map(a =>
      a.status === fromStatus ? { ...a, status: toStatus as const } : a
    );
    saveAnnotations(this.annotations);
  }

  /** Handle checkpoint restoration (undo or revert) */
  private handleCheckpointRestored(successMessage: string) {
    this.historyPanel?.undoComplete();
    this.undoBarVisible = false;
    this.toast.success(successMessage);
    this.ws?.send({ type: 'get_history' });
    if (this.settings.autoRefresh) {
      setTimeout(() => window.location.reload(), 500);
    }
  }

  // Toolbar drag handlers
  private handleToolbarDragStart(e: CustomEvent<{ clientX: number; clientY: number }>) {
    const { clientX, clientY } = e.detail;

    // Get the toolbar container element
    const container = this.shadowRoot?.querySelector('.toolbar-container') as HTMLElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();

    // Calculate offset from mouse to element top-left
    this.dragOffset = {
      x: clientX - rect.left,
      y: clientY - rect.top
    };

    this.isDragging = true;

    // Add document-level listeners for drag
    document.addEventListener('mousemove', this.dragMoveHandler);
    document.addEventListener('mouseup', this.dragEndHandler);
  }

  private handleDragMove(e: MouseEvent) {
    if (!this.isDragging) return;

    const x = e.clientX - this.dragOffset.x;
    const y = e.clientY - this.dragOffset.y;

    // Clamp to viewport bounds
    const container = this.shadowRoot?.querySelector('.toolbar-container') as HTMLElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;

    this.toolbarPosition = {
      x: Math.max(0, Math.min(x, maxX)),
      y: Math.max(0, Math.min(y, maxY))
    };
  }

  private handleDragEnd() {
    if (!this.isDragging) return;

    this.isDragging = false;

    // Remove document-level listeners
    document.removeEventListener('mousemove', this.dragMoveHandler);
    document.removeEventListener('mouseup', this.dragEndHandler);

    // Save position to storage
    if (this.toolbarPosition) {
      saveToolbarPosition(this.toolbarPosition);
    }
  }

  private handleToolbarDragReset() {
    this.toolbarPosition = null;
    clearToolbarPosition();
    this.toast.info('Toolbar position reset');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zing-ui': ZingUI;
  }
}
