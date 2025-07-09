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
    
    handleListenStateChange(event, { isListening, isPaused }) {
        // Clear messages when resuming from pause (going from paused to not paused while listening)
        if (isListening && !isPaused && this._wasPaused) {
            // Resuming from pause - clear the transcript
            this.resetTranscript();
        }
        
        // Update the pause state tracker
        this._wasPaused = isPaused;
    }

    handleConversationUpdate(event, { messages, conversationText, screenshot }) {
        // Replace current messages with conversation history
        this.sttMessages = messages;
        this._shouldScrollAfterUpdate = true;
        
        // Notify parent component about the update
        this.dispatchEvent(new CustomEvent('conversation-updated', {
            detail: { messages, conversationText, screenshot },
            bubbles: true
        }));
    }

    handleSttUpdate(event, { speaker, text, isFinal, isPartial, messageId }) {
        if (text === undefined) return;

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
        if (!this.isVisible) {
            return html`<div style="display: none;"></div>`;
        }

        return html`
            <div class="transcription-container">
                ${this.sttMessages.length === 0
                    ? html`<div class="empty-state">Waiting for speech...</div>`
                    : this.sttMessages.map(msg => html`
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