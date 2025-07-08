import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class ContinuousListenIndicator extends LitElement {
    static properties = {
        isListening: { type: Boolean },
        isPaused: { type: Boolean },
        transcriptionCount: { type: Number },
        errorMessage: { type: String }
    };

    static styles = css`
        :host {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
        }

        .indicator {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 20px;
            background: rgba(20, 20, 20, 0.9);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            transition: all 0.3s ease;
        }

        .indicator:hover {
            background: rgba(30, 30, 30, 0.95);
            border-color: rgba(255, 255, 255, 0.2);
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #ccc;
            transition: all 0.3s ease;
        }

        .status-dot.listening {
            background: #00ff00;
            box-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
            animation: pulse 2s infinite;
        }

        .status-dot.paused {
            background: #ffaa00;
            box-shadow: 0 0 10px rgba(255, 170, 0, 0.5);
        }

        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }

        .status-text {
            user-select: none;
        }

        .transcript-count {
            font-size: 12px;
            opacity: 0.7;
            margin-left: 8px;
        }

        .shortcuts {
            font-size: 11px;
            opacity: 0.5;
            margin-left: 12px;
            border-left: 1px solid rgba(255, 255, 255, 0.2);
            padding-left: 12px;
        }
        
        .error {
            background: rgba(255, 0, 0, 0.1);
            border-color: rgba(255, 0, 0, 0.3);
            color: #ff6666;
            max-width: 400px;
        }
        
        .error .status-dot {
            background: #ff0000;
            box-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
        }
    `;

    constructor() {
        super();
        this.isListening = false;
        this.isPaused = false;
        this.transcriptionCount = 0;
        this.errorMessage = '';
        
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            
            ipcRenderer.on('continuous-listen-state', (_, state) => {
                this.isListening = state.isListening;
                this.isPaused = state.isPaused;
                if (state.isListening) {
                    this.errorMessage = ''; // Clear error when listening starts
                }
            });
            
            ipcRenderer.on('continuous-transcription', () => {
                this.transcriptionCount++;
            });
            
            ipcRenderer.on('continuous-listen-status', (_, status) => {
                console.log('Continuous listen status:', status);
            });
            
            ipcRenderer.on('continuous-listen-error', (_, data) => {
                console.error('Continuous listen error:', data);
                this.errorMessage = data.error;
                this.isListening = false;
                // Auto-hide error after 10 seconds
                setTimeout(() => {
                    this.errorMessage = '';
                }, 10000);
            });
        }
    }

    render() {
        if (this.errorMessage) {
            return html`
                <div class="indicator error">
                    <div class="status-dot"></div>
                    <span class="status-text">${this.errorMessage}</span>
                </div>
            `;
        }
        
        if (!this.isListening) return html``;
        
        const statusClass = this.isPaused ? 'paused' : 'listening';
        const statusText = this.isPaused ? 'Paused' : 'Listening';
        
        return html`
            <div class="indicator">
                <div class="status-dot ${statusClass}"></div>
                <span class="status-text">${statusText}</span>
                ${this.transcriptionCount > 0 ? html`
                    <span class="transcript-count">(${this.transcriptionCount})</span>
                ` : ''}
                <span class="shortcuts">⌘/ ${this.isListening ? 'stop' : 'send'} | ⌘. send+📷</span>
            </div>
        `;
    }
}

customElements.define('continuous-listen-indicator', ContinuousListenIndicator);