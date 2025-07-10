import { html, css, LitElement } from '../../../assets/lit-core-2.7.4.min.js';

export class SttView extends LitElement {
    static styles = css`
        :host {
            display: block;
            width: 100%;
        }

        /* Inherit font styles from parent */

        .transcription-container {
            overflow-y: auto;
            padding: 12px 12px 16px 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-height: 100vh;
            height: 100vh;
            position: relative;
            z-index: 1;
            flex: 1;
        }

        /* Visibility handled by parent component */

        .transcription-container::-webkit-scrollbar {
            width: 8px;
        }
        .transcription-container::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.9);
            border-radius: 4px;
        }
        .transcription-container::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 4px;
        }
        .transcription-container::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.5);
        }

        .stt-message {
            padding: 8px 12px;
            border-radius: 12px;
            max-width: 80%;
            word-wrap: break-word;
            word-break: break-word;
            line-height: 1.5;
            font-size: 15px;
            margin-bottom: 4px;
            box-sizing: border-box;
        }

        .stt-message.them {
            background: rgba(255, 255, 255, 0.05);
            color: rgba(255, 255, 255, 0.9);
            align-self: flex-start;
            border-bottom-left-radius: 4px;
            margin-right: auto;
        }

        .stt-message.me {
            background: rgba(0, 122, 255, 0.4);
            color: white;
            align-self: flex-end;
            border-bottom-right-radius: 4px;
            margin-left: auto;
        }

        .stt-message.ai {
            background: rgba(138, 43, 226, 0.1);
            color: rgba(255, 255, 255, 0.95);
            align-self: flex-start;
            border-bottom-left-radius: 4px;
            margin-right: auto;
            border: 1px solid rgba(138, 43, 226, 0.4);
        }

        .stt-message.system {
            background: rgba(255, 165, 0, 0.1);
            color: rgba(255, 255, 255, 0.9);
            align-self: center;
            text-align: center;
            border-radius: 12px;
            font-size: 14px;
            margin: 8px auto;
            border: 1px solid rgba(255, 165, 0, 0.4);
        }

        .empty-state {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100px;
            color: rgba(255, 255, 255, 0.6);
            font-size: 14px;
            font-style: italic;
        }
    `;

    static properties = {
        sttMessages: { type: Array },
        isVisible: { type: Boolean },
    };

    constructor() {
        super();
        this.sttMessages = [];
        this.isVisible = true;
        this.messageIdCounter = 0;
        this._shouldScrollAfterUpdate = false;
        this._wasPaused = false;

        // State tracking to prevent text display during pause/processing
        this._isPaused = false;
        this._isProcessing = false;
        this._pendingMessages = [];

        // Deduplication tracking
        this._processedMessageIds = new Set();
        this._recentMessageHashes = new Map(); // For messages without IDs
        this._hashCleanupInterval = null;

        this.handleSttUpdate = this.handleSttUpdate.bind(this);
        this.handleConversationUpdate = this.handleConversationUpdate.bind(this);
        this.handleListenStateChange = this.handleListenStateChange.bind(this);
    }

    connectedCallback() {
        super.connectedCallback();
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.on('stt-update', this.handleSttUpdate);
            ipcRenderer.on('stt-conversation-update', this.handleConversationUpdate);
            ipcRenderer.on('continuous-listen-state', this.handleListenStateChange);
        }

        // Clean up old message hashes every 5 minutes
        this._hashCleanupInterval = setInterval(() => {
            this.cleanupOldMessageHashes();
        }, 5 * 60 * 1000);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.removeListener('stt-update', this.handleSttUpdate);
            ipcRenderer.removeListener('stt-conversation-update', this.handleConversationUpdate);
            ipcRenderer.removeListener('continuous-listen-state', this.handleListenStateChange);
        }

        if (this._hashCleanupInterval) {
            clearInterval(this._hashCleanupInterval);
            this._hashCleanupInterval = null;
        }
    }

    // Handle session reset from parent
    resetTranscript() {
        this.sttMessages = [];
        this._processedMessageIds.clear();
        this._recentMessageHashes.clear();
        this._pendingMessages = [];
        this.requestUpdate();
    }

    // Generate a hash for message deduplication
    generateMessageHash(speaker, text, timestamp) {
        // Create a unique hash from speaker, text, and timestamp
        const data = `${speaker}|${text}|${timestamp || Date.now()}`;
        return data;
    }

    // Clean up old message hashes to prevent memory leak
    cleanupOldMessageHashes() {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        for (const [hash, timestamp] of this._recentMessageHashes.entries()) {
            if (timestamp < fiveMinutesAgo) {
                this._recentMessageHashes.delete(hash);
            }
        }
    }

    // Check if a message is a duplicate
    isDuplicateMessage(speaker, text, messageId, timestamp) {
        // Check by messageId if available
        if (messageId !== undefined && this._processedMessageIds.has(messageId)) {
            console.log('[SttView] Duplicate detected by messageId:', messageId);
            return true;
        }

        // Check by content hash for messages without ID
        const hash = this.generateMessageHash(speaker, text, timestamp);
        if (this._recentMessageHashes.has(hash)) {
            const existingTimestamp = this._recentMessageHashes.get(hash);
            // Allow if timestamp is significantly different (more than 2 seconds)
            if (timestamp && existingTimestamp && Math.abs(timestamp - existingTimestamp) > 2000) {
                console.log('[SttView] Same content but different time, allowing');
                return false;
            }
            console.log('[SttView] Duplicate detected by hash');
            return true;
        }

        // Additional check: look for exact same text in last few messages
        // This catches duplicates that might have different timestamps
        const recentSameSpaker = this.sttMessages.slice(-10).filter(msg => msg.speaker === speaker && msg.isFinal);

        const hasSameText = recentSameSpaker.some(msg => msg.text === text);
        if (hasSameText) {
            console.log('[SttView] Duplicate detected by recent message text comparison');
            return true;
        }

        return false;
    }

    // Mark message as processed
    markMessageAsProcessed(speaker, text, messageId, timestamp) {
        if (messageId !== undefined) {
            this._processedMessageIds.add(messageId);
        }

        // Use the provided timestamp or current time
        const hash = this.generateMessageHash(speaker, text, timestamp);
        this._recentMessageHashes.set(hash, timestamp || Date.now());
    }

    handleListenStateChange(event, { isListening, isPaused, isProcessing }) {
        console.log('[SttView] handleListenStateChange EVENT RECEIVED');
        console.log('[SttView] Incoming state:', { isListening, isPaused, isProcessing });
        console.log('[SttView] Previous state:', { _isPaused: this._isPaused, _isProcessing: this._isProcessing, _wasPaused: this._wasPaused });
        console.log('[SttView] Current messages count:', this.sttMessages.length);

        // Update internal state tracking IMMEDIATELY
        const wasResuming = this._isPaused && !isPaused;
        this._isPaused = isPaused;
        this._isProcessing = isProcessing || false;

        // When resuming from pause, only clear pending messages, NOT the transcript
        if (isListening && !isPaused && this._wasPaused) {
            console.log('[SttView] RESUMING FROM PAUSE - clearing pending messages only');
            // Clear any pending messages that were blocked during pause
            const pendingCount = this._pendingMessages.length;
            this._pendingMessages = [];
            console.log('[SttView] Cleared', pendingCount, 'pending messages');
            // Do NOT clear the transcript or processed message tracking
        }

        // Update the pause state tracker
        this._wasPaused = isPaused;
        console.log('[SttView] State update complete:', {
            _isPaused: this._isPaused,
            _isProcessing: this._isProcessing,
            _wasPaused: this._wasPaused,
        });
        this.requestUpdate();
    }

    handleConversationUpdate(event, { messages, conversationText, screenshot }) {
        // Block updates during pause/processing unless it's an AI response
        const hasAIMessage = messages && messages.some(msg => msg.speaker?.toLowerCase() === 'ai');

        if ((!this._isPaused && !this._isProcessing) || hasAIMessage) {
            // Replace current messages with conversation history
            this.sttMessages = messages;
            this._shouldScrollAfterUpdate = true;

            // Clear deduplication tracking since we're loading a new conversation
            this._processedMessageIds.clear();
            this._recentMessageHashes.clear();

            // Notify parent component about the update
            this.dispatchEvent(
                new CustomEvent('conversation-updated', {
                    detail: { messages, conversationText, screenshot },
                    bubbles: true,
                })
            );
        }
    }

    handleSttUpdate(event, { speaker, text, isFinal, isPartial, messageId, timestamp }) {
        console.log('[SttView] handleSttUpdate received:', {
            speaker,
            text: text?.substring(0, 50) + (text?.length > 50 ? '...' : ''),
            isFinal,
            isPartial,
            messageId,
            timestamp,
            source: event?.sender?.id || 'unknown',
        });
        console.log('[SttView] Current state:', { _isPaused: this._isPaused, _isProcessing: this._isProcessing });

        if (text === undefined || text === null || text === '') return;

        // Enhanced duplicate detection for both partial and final messages
        const isDuplicate = this.isDuplicateMessage(speaker, text, messageId, timestamp);

        // For partial messages, also check if this exact text already exists in recent messages
        if (isPartial && !isDuplicate) {
            // Check last few messages for exact text match
            const recentMessages = this.sttMessages.slice(-5);
            const exactMatch = recentMessages.some(msg => msg.speaker === speaker && msg.text === text && msg.isFinal);
            if (exactMatch) {
                console.log('[SttView] Skipping partial - exact match found in recent messages');
                return;
            }
        }

        if (isDuplicate) {
            console.log('[SttView] Skipping duplicate message');
            return;
        }

        // CRITICAL: Block ALL non-AI updates during pause or processing
        if ((this._isPaused || this._isProcessing) && speaker?.toLowerCase() !== 'ai') {
            console.log('[SttView] BLOCKING update - paused or processing');
            return;
        }

        console.log('[SttView] ALLOWING update to proceed');

        const container = this.shadowRoot.querySelector('.transcription-container');
        this._shouldScrollAfterUpdate = container ? container.scrollTop + container.clientHeight >= container.scrollHeight - 10 : false;

        const findMessageIdx = (spk, msgId) => {
            // If messageId is provided, find by messageId
            if (msgId !== undefined) {
                for (let i = this.sttMessages.length - 1; i >= 0; i--) {
                    const m = this.sttMessages[i];
                    if (m.messageId === msgId) return i;
                }
            }
            // Otherwise, find last partial message for speaker
            for (let i = this.sttMessages.length - 1; i >= 0; i--) {
                const m = this.sttMessages[i];
                if (m.speaker === spk && m.isPartial) return i;
            }
            return -1;
        };

        const newMessages = [...this.sttMessages];
        const targetIdx = findMessageIdx(speaker, messageId);

        if (isPartial) {
            if (targetIdx !== -1) {
                newMessages[targetIdx] = {
                    ...newMessages[targetIdx],
                    text,
                    isPartial: true,
                    isFinal: false,
                };
            } else {
                // Check if we already have this exact partial text to avoid duplicates
                const existingPartial = newMessages.find(msg => msg.speaker === speaker && msg.text === text && msg.isPartial);
                if (!existingPartial) {
                    newMessages.push({
                        id: this.messageIdCounter++,
                        messageId: messageId,
                        speaker,
                        text,
                        isPartial: true,
                        isFinal: false,
                    });
                }
            }
        } else if (isFinal) {
            if (targetIdx !== -1) {
                newMessages[targetIdx] = {
                    ...newMessages[targetIdx],
                    text,
                    isPartial: false,
                    isFinal: true,
                };
            } else {
                newMessages.push({
                    id: this.messageIdCounter++,
                    messageId: messageId,
                    speaker,
                    text,
                    isPartial: false,
                    isFinal: true,
                });
            }

            // Mark this final message as processed to prevent duplicates
            this.markMessageAsProcessed(speaker, text, messageId, timestamp);
        }

        this.sttMessages = newMessages;

        // Notify parent component about message updates
        this.dispatchEvent(
            new CustomEvent('stt-messages-updated', {
                detail: { messages: this.sttMessages },
                bubbles: true,
            })
        );
    }

    scrollToBottom() {
        setTimeout(() => {
            const container = this.shadowRoot.querySelector('.transcription-container');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 0);
    }

    getSpeakerClass(speaker) {
        const speakerLower = speaker.toLowerCase();
        if (speakerLower === 'me') return 'me';
        if (speakerLower === 'ai') return 'ai';
        if (speakerLower === 'system') return 'system';
        return 'them';
    }

    getTranscriptText() {
        return this.sttMessages.map(msg => `${msg.speaker}: ${msg.text}`).join('\n');
    }

    updated(changedProperties) {
        super.updated(changedProperties);

        if (changedProperties.has('sttMessages')) {
            if (this._shouldScrollAfterUpdate) {
                this.scrollToBottom();
                this._shouldScrollAfterUpdate = false;
            }
        }
    }

    render() {
        console.log('[SttView] render() called, isVisible:', this.isVisible, 'isPaused:', this._isPaused, 'messages:', this.sttMessages.length);

        if (!this.isVisible) {
            console.warn('[SttView] Not visible, returning hidden div');
            return html`<div style="display: none;"></div>`;
        }

        // Additional UI-level guard: Don't show non-AI messages during pause/processing
        const displayMessages =
            this._isPaused || this._isProcessing ? this.sttMessages.filter(msg => msg.speaker?.toLowerCase() === 'ai') : this.sttMessages;

        console.log('[SttView] Displaying', displayMessages.length, 'messages out of', this.sttMessages.length, 'total');

        return html`
            <div class="transcription-container">
                ${displayMessages.length === 0
                    ? html`<div class="empty-state">
                          ${this._isPaused ? 'Paused' : this._isProcessing ? 'Processing...' : 'Waiting for speech...'}
                      </div>`
                    : displayMessages.map(msg => html` <div class="stt-message ${this.getSpeakerClass(msg.speaker)}">${msg.text}</div> `)}
            </div>
        `;
    }
}

customElements.define('stt-view', SttView);
