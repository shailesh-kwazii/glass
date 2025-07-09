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
            min-height: 150px;
            max-height: 80vh;
            position: relative;
            z-index: 1;
            flex: 1;
        }

        /* Visibility handled by parent component */

        .transcription-container::-webkit-scrollbar {
            width: 8px;
        }
        .transcription-container::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.1);
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
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.9);
            align-self: flex-start;
            border-bottom-left-radius: 4px;
            margin-right: auto;
        }

        .stt-message.me {
            background: rgba(0, 122, 255, 0.8);
            color: white;
            align-self: flex-end;
            border-bottom-right-radius: 4px;
            margin-left: auto;
        }

        .stt-message.ai {
            background: rgba(138, 43, 226, 0.2);
            color: rgba(255, 255, 255, 0.95);
            align-self: flex-start;
            border-bottom-left-radius: 4px;
            margin-right: auto;
            border: 1px solid rgba(138, 43, 226, 0.4);
        }

        .stt-message.system {
            background: rgba(255, 165, 0, 0.2);
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
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.removeListener('stt-update', this.handleSttUpdate);
            ipcRenderer.removeListener('stt-conversation-update', this.handleConversationUpdate);
            ipcRenderer.removeListener('continuous-listen-state', this.handleListenStateChange);
        }
    }

    // Handle session reset from parent
    resetTranscript() {
        this.sttMessages = [];
        this.requestUpdate();
    }
    
    handleListenStateChange(event, { isListening, isPaused, isProcessing }) {
        console.log('[SttView] handleListenStateChange EVENT RECEIVED');
        console.log('[SttView] Incoming state:', { isListening, isPaused, isProcessing });
        console.log('[SttView] Previous state:', { _isPaused: this._isPaused, _isProcessing: this._isProcessing, _wasPaused: this._wasPaused });
        console.log('[SttView] Current messages count:', this.sttMessages.length);
        
        // Update internal state tracking
        this._isPaused = isPaused;
        this._isProcessing = isProcessing || false;
        
        // Clear messages when resuming from pause (going from paused to not paused while listening)
        if (isListening && !isPaused && this._wasPaused) {
            console.log('[SttView] RESUMING FROM PAUSE - clearing transcript');
            console.log('[SttView] Messages before clear:', this.sttMessages.length);
            // Resuming from pause - clear the transcript
            this.resetTranscript();
            // Clear any pending messages
            const pendingCount = this._pendingMessages.length;
            this._pendingMessages = [];
            console.log('[SttView] Cleared', pendingCount, 'pending messages');
            console.log('[SttView] Messages after clear:', this.sttMessages.length);
        }
        
        // Update the pause state tracker
        this._wasPaused = isPaused;
        console.log('[SttView] State update complete:', { _isPaused: this._isPaused, _isProcessing: this._isProcessing, _wasPaused: this._wasPaused });
        this.requestUpdate();
    }

    handleConversationUpdate(event, { messages, conversationText, screenshot }) {
        // Block updates during pause/processing unless it's an AI response
        const hasAIMessage = messages && messages.some(msg => msg.speaker?.toLowerCase() === 'ai');
        
        if (!this._isPaused && !this._isProcessing || hasAIMessage) {
            // Replace current messages with conversation history
            this.sttMessages = messages;
            this._shouldScrollAfterUpdate = true;
            
            // Notify parent component about the update
            this.dispatchEvent(new CustomEvent('conversation-updated', {
                detail: { messages, conversationText, screenshot },
                bubbles: true
            }));
        }
    }

    handleSttUpdate(event, { speaker, text, isFinal, isPartial, messageId }) {
        console.log('[SttView] handleSttUpdate received:', { speaker, text, isFinal, isPartial, messageId });
        console.log('[SttView] Current state:', { _isPaused: this._isPaused, _isProcessing: this._isProcessing });
        
        if (text === undefined) return;
        
        // CRITICAL: Block ALL non-AI updates during pause or processing
        if ((this._isPaused || this._isProcessing) && speaker?.toLowerCase() !== 'ai') {
            console.log('[SttView] BLOCKING update - paused or processing');
            // Store message for later if needed, but don't display
            this._pendingMessages.push({ speaker, text, isFinal, isPartial, messageId });
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
                newMessages.push({
                    id: this.messageIdCounter++,
                    messageId: messageId,
                    speaker,
                    text,
                    isPartial: true,
                    isFinal: false,
                });
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
        }

        this.sttMessages = newMessages;
        
        // Notify parent component about message updates
        this.dispatchEvent(new CustomEvent('stt-messages-updated', {
            detail: { messages: this.sttMessages },
            bubbles: true
        }));
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
        const displayMessages = (this._isPaused || this._isProcessing) 
            ? this.sttMessages.filter(msg => msg.speaker?.toLowerCase() === 'ai')
            : this.sttMessages;
            
        console.log('[SttView] Displaying', displayMessages.length, 'messages out of', this.sttMessages.length, 'total');

        return html`
            <div class="transcription-container">
                ${displayMessages.length === 0
                    ? html`<div class="empty-state">${this._isPaused ? 'Paused' : this._isProcessing ? 'Processing...' : 'Waiting for speech...'}</div>`
                    : displayMessages.map(msg => html`
                        <div class="stt-message ${this.getSpeakerClass(msg.speaker)}">
                            ${msg.text}
                        </div>
                    `)
                }
            </div>
        `;
    }
}

customElements.define('stt-view', SttView); 