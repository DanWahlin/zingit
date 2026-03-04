// client/src/components/zing-ui.ts
// Main orchestrator component

import { LitElement, html, css } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import html2canvas from 'html2canvas';
import type { Marker, ZingSettings, WSMessage, AgentInfo } from '../types/index.js';
import { WebSocketClient } from '../services/websocket.js';
import { generateSelector, generateIdentifier, getElementHtml, getParentContext, getTextContent, getSiblingContext, getParentHtml, querySelector } from '../services/selector.js';
import { saveMarkers, loadMarkers, clearMarkers, saveSettings, loadSettings, saveMarkActive, loadMarkActive, saveToolbarPosition, loadToolbarPosition, clearToolbarPosition, saveResponseState, loadResponseState, clearResponseState, type ToolbarPosition } from '../services/storage.js';
import { getElementViewportRect, clipToViewport, addPadding } from '../utils/geometry.js';
import { formatMarkersMarkdown, copyToClipboard } from '../utils/markdown.js';

import './toolbar.js';
import './highlight.js';
import './markers.js';
import './modal.js';
import './settings.js';
import './agent-response-panel.js';
import './toast.js';
import './help.js';
import './agent-picker.js';
import './history-panel.js';
import './undo-bar.js';
import type { ZingToast } from './toast.js';
import type { ZingHistoryPanel } from './history-panel.js';
import type { ZingMarkers } from './markers.js';
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
      z-index: 2147483644;
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

  @state() private markers: Marker[] = [];
  @state() private settings: ZingSettings = loadSettings();
  @state() private wsConnected = false;
  @state() private wsMaxAttemptsReached = false;
  @state() private processing = false;
  @state() private agentName = '';
  @state() private agentModel = '';
  @state() private serverProjectDir = '';  // Server's default project directory
  @state() private markActive = loadMarkActive();
  @state() private availableAgents: AgentInfo[] = [];
  @state() private agentPickerOpen = false;
  @state() private agentPickerLoading = false;
  @state() private agentPickerError = '';
  @state() private isRemoteUrl = false;  // Whether editing a remote/published site
  @state() private currentPageUrl = '';
  private remoteWarningShown = false;  // Guard to prevent showing warning twice

  @query('zing-toast') private toast!: ZingToast;
  @query('zing-history-panel') private historyPanel!: ZingHistoryPanel;
  @query('zing-markers') private markerBadges!: ZingMarkers;

  // Highlight state
  @state() private highlightVisible = false;
  @state() private highlightRect = { top: 0, left: 0, width: 0, height: 0 };
  @state() private highlightLabel = '';

  // Modal state
  @state() private modalOpen = false;
  @state() private modalEditMode = false;
  @state() private modalMarkId = '';
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
  private isFollowUpMessage = false; // Track if current processing is a follow-up

  // Undo stack for markers
  private undoStack: Marker[] = [];

  // History panel state
  @state() private historyOpen = false;
  @state() private historyCheckpoints: CheckpointInfo[] = [];
  @state() private historyLoading = false;

  // Undo bar state
  @state() private undoBarVisible = false;
  @state() private undoBarFilesModified = 0;

  // Track marker IDs to remove after undo/revert completes
  private pendingMarkerRemovals: Set<string> = new Set();

  // Debounce tracking for undo operations
  private undoInProgress = false;

  // Recently deleted marker for undo capability
  private recentlyDeletedMarker: Marker | null = null;
  private deleteUndoTimeout: ReturnType<typeof setTimeout> | null = null;

  // Processing timeout to detect when agent hangs
  private processingTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly PROCESSING_TIMEOUT_MS = 130000; // 2m10s — must exceed server timeout (120s) to avoid premature client-side timeout

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

    // Load saved markers
    this.markers = loadMarkers();

    // Clean up orphaned markers (elements that no longer exist on the page)
    try {
      const validMarkers = this.markers.filter(marker => {
        try {
          const element = querySelector(marker.selector);
          return element !== null;
        } catch (error) {
          // Invalid selector - treat as orphaned
          console.warn(`[ZingIt] Invalid selector "${marker.selector}":`, error);
          return false;
        }
      });
      if (validMarkers.length < this.markers.length) {
        const orphanedCount = this.markers.length - validMarkers.length;
        console.log(`[ZingIt] Removed ${orphanedCount} orphaned marker(s) - elements no longer exist`);
        this.markers = validMarkers;
        saveMarkers(this.markers);
        // Defer toast notification until after first render
        this.updateComplete.then(() => {
          this.toast?.info(`Removed ${orphanedCount} stale marker${orphanedCount > 1 ? 's' : ''}`);
        });
      }
    } catch (err) {
      console.warn('[ZingIt] Error cleaning up orphaned markers:', err);
    }

    // Restore response dialog state if it was saved before auto-refresh
    const savedResponseState = loadResponseState();
    if (savedResponseState && savedResponseState.content) {
      this.responseOpen = true;  // Always show dialog if we have saved content
      this.responseContent = savedResponseState.content;
      this.responseError = savedResponseState.error;
      this.responseScreenshotCount = savedResponseState.screenshotCount;
      // Clear saved state after restoring (one-time restore)
      clearResponseState();
      // Force re-render to ensure dialog appears
      this.requestUpdate();
    }

    // Set up WebSocket
    this.initWebSocket();

    // Detect if editing a remote URL
    this.detectRemoteUrl();

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

    // Clean up delete undo timeout
    if (this.deleteUndoTimeout) {
      clearTimeout(this.deleteUndoTimeout);
      this.deleteUndoTimeout = null;
    }

    // Clean up processing timeout
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = null;
    }

    // Remove document event listeners
    document.removeEventListener('click', this.clickHandler, true);
    document.removeEventListener('mousemove', this.mouseMoveHandler, true);
    document.removeEventListener('keydown', this.keydownHandler);
  }

  // ============================================
  // WebSocket & Connection
  // ============================================

  private initWebSocket() {
    this.ws = new WebSocketClient(this.settings.wsUrl);

    this.ws.on('open', () => {
      this.wsConnected = true;
      this.wsMaxAttemptsReached = false;

      // If we had processing markers and reconnected (likely due to hot reload after agent made changes),
      // mark them as completed since the agent probably finished before the reload
      const hadProcessing = this.markers.some(a => a.status === 'processing');
      if (hadProcessing) {
        console.log('[ZingIt] Reconnected with processing markers - marking as completed');
        this.markers = this.markers.map(a =>
          a.status === 'processing' ? { ...a, status: 'completed' as const } : a
        );
        saveMarkers(this.markers);
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

    this.ws.connect();
  }

  private detectRemoteUrl() {
    this.currentPageUrl = window.location.href;
    const hostname = window.location.hostname;

    // Consider non-localhost as remote
    this.isRemoteUrl = !['localhost', '127.0.0.1', '::1'].includes(hostname)
                       && !hostname.endsWith('.local')
                       && hostname !== '';

    // If remote, show immediate warning after a short delay to ensure toast is ready
    if (this.isRemoteUrl) {
      this.updateComplete.then(() => {
        setTimeout(() => this.showRemoteUrlWarning(), 500);
      });
    }
  }

  private showRemoteUrlWarning() {
    if (!this.toast || this.remoteWarningShown) return;

    this.remoteWarningShown = true;

    this.toast.show(
      `You're editing a published site.\nChanges will be saved locally only.\n\nTo see your changes:\n• Run the project locally, or\n• Deploy the updated files`,
      'warning',
      0 // Persistent until dismissed
    );
  }

  private handleWSMessage(msg: WSMessage) {
    switch (msg.type) {
      case 'connected':
        this.agentName = msg.agent || '';
        this.agentModel = msg.model || '';
        this.serverProjectDir = msg.projectDir || '';
        // Re-detect URL now that we have serverProjectDir
        if (this.isRemoteUrl && this.serverProjectDir) {
          this.detectRemoteUrl();
        }
        break;

      case 'processing':
        this.processing = true;
        this.responseOpen = true;
        // Only clear content for new conversations, not follow-ups
        if (!this.isFollowUpMessage) {
          this.responseContent = '';
        }
        this.responseError = '';
        this.startProcessingTimeout(); // Start timeout to detect hangs
        break;

      case 'delta':
        this.responseContent += msg.content || '';
        // Save response state on every delta so it persists across page reloads
        // (Vite HMR may reload when agent edits project files mid-stream)
        if (this.responseContent) {
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
        this.clearProcessingTimeout(); // Clear timeout - processing completed successfully
        this.processing = false;
        this.responseToolStatus = '';
        this.isFollowUpMessage = false; // Reset follow-up flag
        this.updateMarkerStatuses('processing', 'completed');
        if (this.settings.playSoundOnComplete) {
          this.playCompletionSound();
        }
        // Add remote URL guidance to response if editing a published site
        if (this.isRemoteUrl) {
          const projectDir = this.settings.projectDir || this.serverProjectDir;
          this.responseContent += `\n\n---\n\n` +
            `**💡 Important:** You're editing a published site.\n\n` +
            `Changes have been saved locally to:\n\`${projectDir}\`\n\n` +
            `**To see your changes:**\n` +
            `1. Run your project locally, or\n` +
            `2. Deploy the changes to your hosting service\n\n` +
            `**Need help?** Check the settings panel for your project directory.`;
        }
        // Refresh history after a short delay to get finalized checkpoint data
        setTimeout(() => {
          if (this.ws && this.wsConnected) {
            this.ws.send({ type: 'get_history' });
          }
        }, 500);
        // Always save response state so it persists across page reloads
        // (Vite HMR may reload the page when agent edits project files)
        this.saveCurrentResponseState();
        if (this.settings.autoRefresh) {
          this.toast.info('Refreshing page...');
          setTimeout(() => window.location.reload(), 1000);
        }
        break;

      case 'error':
        this.clearProcessingTimeout(); // Clear timeout - processing failed with error
        this.responseError = msg.message || 'Unknown error';
        this.processing = false;
        this.responseToolStatus = '';
        this.isFollowUpMessage = false; // Reset follow-up flag
        this.undoInProgress = false;  // Reset undo state on error
        this.pendingMarkerRemovals.clear();  // Clear pending removals
        this.updateMarkerStatuses('processing', 'pending');
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

  // ============================================
  // Document Event Handlers (click, mousemove, keydown)
  // ============================================

  private handleDocumentClick(e: MouseEvent) {
    // Ignore if mark mode is paused
    if (!this.markActive) {
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

    // Capture click for marker
    e.preventDefault();
    e.stopPropagation();

    this.pendingElement = target;
    this.modalEditMode = false;
    this.modalMarkId = '';
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
    // Ignore if mark mode is paused
    if (!this.markActive) {
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
    // Add padding for visual breathing room, then clip to viewport for large elements
    const rect = getElementViewportRect(target);
    const paddedRect = addPadding(rect, 4);
    this.highlightRect = clipToViewport(paddedRect);
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

    // Cmd/Ctrl+Z for undo (both marker and git-based)
    const canGitUndo = this.historyCheckpoints.some(c => c.canUndo);
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey && (this.undoStack.length > 0 || canGitUndo)) {
      e.preventDefault();
      this.handleUndo();
    }

    // "Z" to toggle mark mode
    if (e.key === 'z' || e.key === 'Z') {
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

      // Stop at html - if we've reached here, nothing valid was found
      const tagName = node.tagName.toLowerCase();
      if (tagName === 'html') {
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
      // Skip html in fallback too
      const tagName = el.tagName.toLowerCase();
      if (tagName === 'html') {
        continue;
      }

      if (!this.isOwnElement(el)) {
        return el;
      }
    }

    return null;
  }

  // ============================================
  // Render
  // ============================================

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
        .markers=${this.markers}
        style="--marker-color: ${this.settings.markerColor}; --processing-color: ${this.settings.processingColor}; --completed-color: ${this.settings.completedColor}"
        @marker-click=${this.handleMarkerClick}
        @marker-delete=${this.handleMarkerDelete}
      ></zing-markers>

      <div
        class="toolbar-container ${this.toolbarPosition ? 'custom-position' : 'default-position'} ${this.isDragging ? 'dragging' : ''}"
        style="${this.toolbarPosition ? `left: ${this.toolbarPosition.x}px; top: ${this.toolbarPosition.y}px;` : ''}"
      >
        <zing-toolbar
          .active=${this.markActive}
          .connected=${this.wsConnected}
          .processing=${this.processing}
          .maxAttemptsReached=${this.wsMaxAttemptsReached}
          .markerCount=${this.markers.length}
          .agent=${this.agentName}
          .model=${this.agentModel}
          .responseOpen=${this.responseOpen}
          .historyOpen=${this.historyOpen}
          .isRemoteUrl=${this.isRemoteUrl}
          @toggle=${this.handleToggle}
          @send=${this.handleSend}
          @export=${this.handleExport}
          @clear=${this.handleClear}
          @help=${() => this.helpOpen = true}
          @settings=${() => this.settingsOpen = true}
          @close=${this.handleClose}
          @reconnect=${this.handleReconnect}
          @toggle-response=${() => this.responseOpen = !this.responseOpen}
          @toggle-history=${this.handleToggleHistory}
          @change-agent=${() => this.agentPickerOpen = true}
          @highlight-markers=${this.handleHighlightMarkers}
          @drag-start=${this.handleToolbarDragStart}
          @drag-reset=${this.handleToolbarDragReset}
        ></zing-toolbar>
      </div>

      <zing-modal
        .open=${this.modalOpen}
        .editMode=${this.modalEditMode}
        .markerId=${this.modalMarkId}
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
        .isRemoteUrl=${this.isRemoteUrl}
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

      <zing-agent-response-panel
        .isOpen=${this.responseOpen}
        .processing=${this.processing}
        .autoRefresh=${this.settings.autoRefresh}
        .content=${this.responseContent}
        .toolStatus=${this.responseToolStatus}
        .error=${this.responseError}
        .screenshotCount=${this.responseScreenshotCount}
        .agentName=${this.agentDisplayName}
        @close=${() => this.responseOpen = false}
        @stop=${this.handleStop}
        @followup=${this.handleFollowUp}
      ></zing-agent-response-panel>

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

  // ============================================
  // Modal & Screenshot Handlers
  // ============================================

  private handleModalCancel() {
    this.modalOpen = false;
    this.pendingElement = null;
    this.modalCaptureScreenshot = false;
    this.modalScreenshotPreview = '';
    this.modalScreenshotLoading = false;
  }

  /**
   * Compress screenshot to stay under server size limit (5MB)
   * Tries JPEG with progressively lower quality, then resizes if needed
   */
  private compressScreenshot(canvas: HTMLCanvasElement): string {
    const MAX_SIZE = 4800000; // Target 4.8MB to stay safely under 5MB server limit

    // Try JPEG with different quality levels (start with full quality, then compress if needed)
    const qualityLevels = [1.0, 0.9, 0.8, 0.6, 0.4];

    for (const quality of qualityLevels) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      // Remove data:image/jpeg;base64, prefix to get actual base64 length
      const base64Length = dataUrl.split(',')[1]?.length || 0;

      if (base64Length <= MAX_SIZE) {
        console.log(`ZingIt: Screenshot compressed to ${Math.round(base64Length / 1000)}KB (quality: ${quality})`);
        return dataUrl;
      }
    }

    // Still too large, resize canvas and try again
    console.warn('ZingIt: Screenshot still too large, resizing...');
    const scale = 0.7;
    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = canvas.width * scale;
    resizedCanvas.height = canvas.height * scale;
    const ctx = resizedCanvas.getContext('2d');

    if (ctx) {
      ctx.drawImage(canvas, 0, 0, resizedCanvas.width, resizedCanvas.height);
      const dataUrl = resizedCanvas.toDataURL('image/jpeg', 0.6);
      const base64Length = dataUrl.split(',')[1]?.length || 0;
      console.log(`ZingIt: Screenshot resized and compressed to ${Math.round(base64Length / 1000)}KB`);
      return dataUrl;
    }

    // Fallback to low quality if resize fails
    return canvas.toDataURL('image/jpeg', 0.3);
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
        // Compress screenshot to stay under server size limit
        this.modalScreenshotPreview = this.compressScreenshot(canvas);
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

  private handleModalSave(e: CustomEvent<{ notes: string; editMode: boolean; markerId: string; captureScreenshot: boolean }>) {
    try {
      const { notes, editMode, markerId, captureScreenshot } = e.detail;

      if (editMode) {
        // Update existing marker and reset status to pending so it can be sent again
        // Also update the screenshot: use current preview if capturing, or remove if unchecked
        const screenshot = captureScreenshot && this.modalScreenshotPreview ? this.modalScreenshotPreview : undefined;

        this.markers = this.markers.map(a => {
          if (a.id === markerId) {
            // Create updated marker, removing screenshot property if not capturing
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
        saveMarkers(this.markers);

        // Also update the undo stack to keep it in sync
        this.undoStack = this.undoStack.map(a => {
          if (a.id === markerId) {
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

        this.handleModalCancel();
        this.toast.success('Marker updated');
      } else {
        // Create new marker
        if (!this.pendingElement) return;

        // Use pre-captured screenshot if available
        const screenshot = captureScreenshot && this.modalScreenshotPreview ? this.modalScreenshotPreview : undefined;

        const marker: Marker = {
          id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `m-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

        this.markers = [...this.markers, marker];
        saveMarkers(this.markers);

        // Push to undo stack
        this.undoStack = [...this.undoStack, marker];

        this.handleModalCancel();
        this.toast.success(screenshot ? 'Marker saved with screenshot' : 'Marker saved');
      }
    } catch (err) {
      console.error('ZingIt: Error saving marker', err);
      this.toast.error('Failed to save marker');
    }
  }

  private handleMarkerClick(e: CustomEvent<{ id: string }>) {
    try {
      const marker = this.markers.find(a => a.id === e.detail.id);
      if (marker) {
        // Open modal in edit mode
        this.modalEditMode = true;
        this.modalMarkId = marker.id;
        this.modalSelector = marker.selector;
        this.modalIdentifier = marker.identifier;
        this.modalSelectedText = marker.selectedText || '';
        this.modalNotes = marker.notes;

        // Restore screenshot state if marker has a screenshot
        this.modalCaptureScreenshot = !!marker.screenshot;
        this.modalScreenshotPreview = marker.screenshot || '';

        this.pendingElement = querySelector(marker.selector);
        if (!this.pendingElement) {
          this.toast.info('Element no longer exists on page');
        }
        this.modalOpen = true;
      }
    } catch (err) {
      console.error('ZingIt: Error handling marker click', err);
      this.toast.error('Failed to open marker');
    }
  }

  private handleMarkerDelete(e: CustomEvent<{ id: string }>) {
    const id = e.detail.id;

    // Store the marker for potential undo
    const deletedMarker = this.markers.find(a => a.id === id);
    if (!deletedMarker) return;

    // Clear any previous delete undo timeout
    if (this.deleteUndoTimeout) {
      clearTimeout(this.deleteUndoTimeout);
      this.deleteUndoTimeout = null;
    }

    // Store for undo
    this.recentlyDeletedMarker = deletedMarker;

    // Remove from markers and undo stack
    this.markers = this.markers.filter(a => a.id !== id);
    this.undoStack = this.undoStack.filter(a => a.id !== id);
    saveMarkers(this.markers);

    // Show toast with undo action
    this.toast.info('Marker deleted', 5000, {
      label: 'Undo',
      callback: () => this.undoDelete()
    });

    // Clear recently deleted after timeout (can't undo after this)
    this.deleteUndoTimeout = setTimeout(() => {
      this.recentlyDeletedMarker = null;
      this.deleteUndoTimeout = null;
    }, 5000);
  }

  private undoDelete() {
    // Guard: check if marker still available and component is connected
    if (!this.recentlyDeletedMarker || !this.isConnected) return;

    // Restore the marker
    this.markers = [...this.markers, this.recentlyDeletedMarker];
    this.undoStack = [...this.undoStack, this.recentlyDeletedMarker];
    saveMarkers(this.markers);

    // Clear the stored marker
    this.recentlyDeletedMarker = null;
    if (this.deleteUndoTimeout) {
      clearTimeout(this.deleteUndoTimeout);
      this.deleteUndoTimeout = null;
    }

    this.toast?.success('Marker restored');
  }

  // ============================================
  // Marker & Batch Operations
  // ============================================

  private handleSend() {
    // Open the agent response panel
    this.responseOpen = true;
    this.isFollowUpMessage = false; // This is a new conversation, not a follow-up

    if (!this.ws || !this.wsConnected || this.markers.length === 0) return;

    // Use client-specified projectDir if set, otherwise server will use its default
    const projectDir = this.settings.projectDir || undefined;

    // Only send pending markers (not completed ones)
    const pendingMarkers = this.markers.filter(a => a.status !== 'completed');
    if (pendingMarkers.length === 0) {
      // No pending markers - panel is already open, just return
      return;
    }

    this.updateMarkerStatuses('pending', 'processing');

    // Send only the markers being processed
    const markersToSend = this.markers.filter(a => a.status === 'processing');
    const screenshotCount = markersToSend.filter(a => a.screenshot).length;

    // Store screenshot count for response panel
    this.responseScreenshotCount = screenshotCount;

    const sent = this.ws.sendBatch({
      pageUrl: window.location.href,
      pageTitle: document.title,
      markers: markersToSend
    }, projectDir, undefined, () => {
      // On failure: revert markers to pending status
      this.updateMarkerStatuses('processing', 'pending');
      this.toast.error('Failed to send markers - will retry on reconnection');
    });

    if (sent) {
      // Build toast message with screenshot info
      let message = `Sent ${markersToSend.length} marker${markersToSend.length > 1 ? 's' : ''}`;
      if (screenshotCount > 0) {
        message += ` (${screenshotCount} with screenshot${screenshotCount > 1 ? 's' : ''})`;
      }
      message += ' to agent';
      this.toast.info(message);
    } else {
      // Immediate failure, but message queued for retry
      this.toast.info('Connection lost - markers queued for retry');
    }
  }

  private handleExport() {
    const markdown = formatMarkersMarkdown(
      this.markers,
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

    // Fall back to marker undo stack
    if (this.undoStack.length === 0) return;

    // Pop the last marker from the undo stack
    const lastMarker = this.undoStack[this.undoStack.length - 1];
    this.undoStack = this.undoStack.slice(0, -1);

    // Remove it from markers
    this.markers = this.markers.filter(a => a.id !== lastMarker.id);
    saveMarkers(this.markers);

    this.toast.info('Marker removed');
  }

  private handleGitUndo() {
    if (!this.ws || !this.wsConnected) {
      this.toast.error('Not connected to server');
      return;
    }

    // Debounce: prevent multiple rapid undo requests
    if (this.undoInProgress) {
      this.toast.info('Undo already in progress...');
      return;
    }

    // Find the checkpoint being undone (most recent with canUndo)
    const checkpointToUndo = this.historyCheckpoints.find(c => c.canUndo);
    if (checkpointToUndo) {
      // Track which marker IDs should be removed after undo completes
      this.pendingMarkerRemovals = new Set(
        checkpointToUndo.markers.map(a => a.id)
      );
    }

    // Mark undo as in progress
    this.undoInProgress = true;

    // Send undo request to server
    this.ws.send({ type: 'undo' });
    this.undoBarVisible = false;
  }

  private handleRevertTo(e: CustomEvent<{ checkpointId: string }>) {
    if (!this.ws || !this.wsConnected) {
      this.toast.error('Not connected to server');
      return;
    }

    // Debounce: prevent multiple rapid revert requests
    if (this.undoInProgress) {
      this.toast.info('Revert already in progress...');
      return;
    }

    // Find all checkpoints that will be reverted (those after the target checkpoint)
    const targetIndex = this.historyCheckpoints.findIndex(c => c.id === e.detail.checkpointId);
    if (targetIndex >= 0) {
      // All checkpoints before the target index (more recent) will be reverted
      // historyCheckpoints is ordered newest first, so indices 0 to targetIndex-1 are being reverted
      const checkpointsToRevert = this.historyCheckpoints.slice(0, targetIndex);
      this.pendingMarkerRemovals = new Set(
        checkpointsToRevert.flatMap(c => c.markers.map(a => a.id))
      );
    }

    // Mark revert as in progress
    this.undoInProgress = true;

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
    this.markers = [];
    this.undoStack = [];
    clearMarkers();
    this.ws?.sendReset();

    // Reset response panel state
    this.responseContent = '';
    this.responseError = '';
    this.responseToolStatus = '';
    this.responseScreenshotCount = 0;
    this.processing = false;

    this.toast.info('Markers cleared');
  }

  private handleHighlightMarkers() {
    if (this.markerBadges) {
      this.markerBadges.highlightMarkers();
    }
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
    this.markActive = !this.markActive;
    saveMarkActive(this.markActive);

    // Clear highlight when disabling mark mode
    if (!this.markActive) {
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

    // Mark as follow-up to preserve conversation history
    this.isFollowUpMessage = true;

    // Show processing state and prepare for response
    this.processing = true;
    this.responseContent += `\n\n---\n**You:** ${e.detail.message}\n\n`;
    this.responseError = '';
    this.responseToolStatus = '';
    this.startProcessingTimeout(); // Start timeout for follow-up message

    this.ws.sendMessage(e.detail.message, window.location.href);
  }

  private handleStop() {
    if (!this.ws || !this.wsConnected) return;
    this.clearProcessingTimeout(); // Clear timeout - user manually stopped
    this.ws.sendStop();
    this.processing = false;
    this.responseToolStatus = '';
    this.updateMarkerStatuses('processing', 'pending');
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

  /** Get the display name for the currently selected agent */
  private get agentDisplayName(): string {
    if (!this.agentName) return '';
    const agent = this.availableAgents.find(a => a.name === this.agentName);
    return agent?.displayName || this.agentName;
  }

  /** Start processing timeout - shows helpful message if agent hangs */
  private startProcessingTimeout() {
    // Clear any existing timeout
    this.clearProcessingTimeout();

    // Start new timeout
    this.processingTimeout = setTimeout(() => {
      console.warn('[ZingIt] Processing timeout - agent may have hung');

      // Reset processing state
      this.processing = false;
      this.responseToolStatus = '';
      this.isFollowUpMessage = false; // Reset follow-up flag

      // Show helpful error message
      this.responseError = 'The AI agent took too long to respond. This can happen occasionally. Please try submitting your markers again.';

      // Revert markers to pending so they can be re-sent
      this.updateMarkerStatuses('processing', 'pending');

      // Show toast notification
      this.toast.error('Request timed out - please try again');
    }, this.PROCESSING_TIMEOUT_MS);
  }

  /** Clear processing timeout */
  private clearProcessingTimeout() {
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = null;
    }
  }

  /** Save current response state to storage (for persistence across refresh) */
  private saveCurrentResponseState() {
    saveResponseState({
      open: this.responseOpen,
      content: this.responseContent,
      error: this.responseError,
      screenshotCount: this.responseScreenshotCount
    });
  }

  /** Update marker statuses and save to storage */
  private updateMarkerStatuses(
    fromStatus: 'pending' | 'processing' | 'completed',
    toStatus: 'pending' | 'processing' | 'completed'
  ) {
    this.markers = this.markers.map(a =>
      a.status === fromStatus ? { ...a, status: toStatus } : a
    );
    saveMarkers(this.markers);
  }

  /** Handle checkpoint restoration (undo or revert) */
  private handleCheckpointRestored(successMessage: string) {
    this.historyPanel?.undoComplete();
    this.undoBarVisible = false;

    // Clear undo-in-progress flag (allows new undo operations)
    this.undoInProgress = false;

    // Remove only the markers associated with the reverted checkpoint(s)
    if (this.pendingMarkerRemovals.size > 0) {
      this.markers = this.markers.filter(
        a => !this.pendingMarkerRemovals.has(a.id)
      );
      // Also clean up local undo stack to stay in sync with git state
      this.undoStack = this.undoStack.filter(
        a => !this.pendingMarkerRemovals.has(a.id)
      );
      saveMarkers(this.markers);
      this.pendingMarkerRemovals.clear();
    }

    this.toast.success(successMessage);
    this.ws?.send({ type: 'get_history' });
    if (this.settings.autoRefresh) {
      setTimeout(() => window.location.reload(), 500);
    }
  }

  // ============================================
  // Toolbar Drag Handlers
  // ============================================

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
