import { html, css, LitElement } from '../assets/lit-core-2.7.4.min.js';
import { SettingsView } from '../features/settings/SettingsView.js';
import { AssistantView } from '../features/listen/AssistantView.js';
import { AskView } from '../features/ask/AskView.js';

import '../features/listen/renderer/renderer.js';

export class PickleGlassApp extends LitElement {
    static styles = css`
        :host {
            display: block;
            width: 100%;
            height: 100%;
            color: var(--text-color);
            background: transparent;
            border-radius: 7px;
        }

        assistant-view {
            display: block;
            width: 100%;
            height: 100%;
        }

        ask-view, settings-view, history-view, help-view, setup-view {
            display: block;
            width: 100%;
            height: 100%;
        }

    `;

    static properties = {
        currentView: { type: String },
        statusText: { type: String },
        startTime: { type: Number },
        currentResponseIndex: { type: Number },
        isMainViewVisible: { type: Boolean },
        selectedProfile: { type: String },
        selectedLanguage: { type: String },
        selectedScreenshotInterval: { type: String },
        selectedImageQuality: { type: String },
        isClickThrough: { type: Boolean, state: true },
        layoutMode: { type: String },
        _viewInstances: { type: Object, state: true },
        _isClickThrough: { state: true },
        structuredData: { type: Object }, 
    };

    constructor() {
        super();
        const urlParams = new URLSearchParams(window.location.search);
        this.currentView = urlParams.get('view') || 'listen';
        this.currentResponseIndex = -1;
        this.selectedProfile = localStorage.getItem('selectedProfile') || 'interview';
        
        // Language format migration for legacy users
        let lang = localStorage.getItem('selectedLanguage') || 'en';
        if (lang.includes('-')) {
            const newLang = lang.split('-')[0];
            console.warn(`[Migration] Correcting language format from "${lang}" to "${newLang}".`);
            localStorage.setItem('selectedLanguage', newLang);
            lang = newLang;
        }
        this.selectedLanguage = lang;

        this.selectedScreenshotInterval = localStorage.getItem('selectedScreenshotInterval') || '5';
        this.selectedImageQuality = localStorage.getItem('selectedImageQuality') || 'medium';
        this._isClickThrough = false;
        this.outlines = [];
        this.analysisRequests = [];

    }

    connectedCallback() {
        super.connectedCallback();
        
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            
            ipcRenderer.on('update-status', (_, status) => this.setStatus(status));
            ipcRenderer.on('click-through-toggled', (_, isEnabled) => {
                this._isClickThrough = isEnabled;
            });
            ipcRenderer.on('start-listening-session', () => {
                console.log('Received start-listening-session command, calling handleListenClick.');
                this.handleListenClick();
            });
            
            // Handle continuous listening keyboard shortcuts
            ipcRenderer.on('send-conversation-to-llm', async (_, data) => {
                console.log('[PickleGlassApp] IPC EVENT: send-conversation-to-llm', data);
                try {
                    const result = await ipcRenderer.invoke('send-conversation-to-llm', data);
                    console.log('[PickleGlassApp] send-conversation-to-llm result:', result);
                    if (!result.success) {
                        console.error('[PickleGlassApp] Failed to send conversation to LLM');
                    }
                } catch (error) {
                    console.error('[PickleGlassApp] Error invoking send-conversation-to-llm:', error);
                }
            });
            
            // Handle toggle continuous listening
            ipcRenderer.on('toggle-continuous-listening', async () => {
                console.log('[PickleGlassApp] IPC EVENT: toggle-continuous-listening');
                try {
                    const result = await ipcRenderer.invoke('toggle-continuous-listening');
                    console.log('[PickleGlassApp] toggle result:', result);
                    if (result.success) {
                        console.log('[PickleGlassApp] Continuous listening is now:', result.isListening ? 'ON' : 'OFF');
                    } else {
                        console.error('[PickleGlassApp] Failed to toggle continuous listening');
                    }
                } catch (error) {
                    console.error('[PickleGlassApp] Error invoking toggle-continuous-listening:', error);
                }
            });
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.removeAllListeners('update-status');
            ipcRenderer.removeAllListeners('click-through-toggled');
            ipcRenderer.removeAllListeners('start-listening-session');
            ipcRenderer.removeAllListeners('send-conversation-to-llm');
            ipcRenderer.removeAllListeners('toggle-continuous-listening');
        }
    }

    updated(changedProperties) {
        if (changedProperties.has('isMainViewVisible') || changedProperties.has('currentView')) {
            this.requestWindowResize();
        }

        if (changedProperties.has('currentView')) {
            const viewContainer = this.shadowRoot?.querySelector('.view-container');
            if (viewContainer) {
                viewContainer.classList.add('entering');
                requestAnimationFrame(() => {
                    viewContainer.classList.remove('entering');
                });
            }
        }

        // Only update localStorage when these specific properties change
        if (changedProperties.has('selectedProfile')) {
            localStorage.setItem('selectedProfile', this.selectedProfile);
        }
        if (changedProperties.has('selectedLanguage')) {
            localStorage.setItem('selectedLanguage', this.selectedLanguage);
        }
        if (changedProperties.has('selectedScreenshotInterval')) {
            localStorage.setItem('selectedScreenshotInterval', this.selectedScreenshotInterval);
        }
        if (changedProperties.has('selectedImageQuality')) {
            localStorage.setItem('selectedImageQuality', this.selectedImageQuality);
        }
        if (changedProperties.has('layoutMode')) {
            this.updateLayoutMode();
        }
    }

    requestWindowResize() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.invoke('resize-window', {
                isMainViewVisible: this.isMainViewVisible,
                view: this.currentView,
            });
        }
    }

    setStatus(text) {
        this.statusText = text;
    }

    async handleListenClick() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            const isActive = await ipcRenderer.invoke('is-session-active');
            if (isActive) {
                console.log('Session is already active. No action needed.');
                return;
            }
        }

        if (window.pickleGlass) {
            await window.pickleGlass.initializeopenai(this.selectedProfile, this.selectedLanguage);
            window.pickleGlass.startCapture(this.selectedScreenshotInterval, this.selectedImageQuality);
        }


        this.currentResponseIndex = -1;
        this.startTime = Date.now();
        this.currentView = 'listen';
        this.isMainViewVisible = true;
    }

    handleShowHideClick() {
        this.isMainViewVisible = !this.isMainViewVisible;
    }

    handleSettingsClick() {
        this.currentView = 'settings';
        this.isMainViewVisible = true;
    }

    handleHelpClick() {
        this.currentView = 'help';
        this.isMainViewVisible = true;
    }

    handleHistoryClick() {
        this.currentView = 'history';
        this.isMainViewVisible = true;
    }

    async handleClose() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('quit-application');
        }
    }

    handleBackClick() {
        this.currentView = 'listen';
    }

    async handleSendText(message) {
        if (window.pickleGlass) {
            const result = await window.pickleGlass.sendTextMessage(message);

            if (!result.success) {
                console.error('Failed to send message:', result.error);
                this.setStatus('Error sending message: ' + result.error);
            } else {
                this.setStatus('Message sent...');
            }
        }
    }

    // updateOutline(outline) {
    //     console.log('📝 PickleGlassApp updateOutline:', outline);
    //     this.outlines = [...outline];
    //     this.requestUpdate();
    // }

    // updateAnalysisRequests(requests) {
    //     console.log('📝 PickleGlassApp updateAnalysisRequests:', requests);
    //     this.analysisRequests = [...requests];
    //     this.requestUpdate();
    // }


    handleResponseIndexChanged(e) {
        this.currentResponseIndex = e.detail.index;
    }

    render() {
        let content;
        switch (this.currentView) {
            case 'listen':
                content = html`<assistant-view
                    .currentResponseIndex=${this.currentResponseIndex}
                    .selectedProfile=${this.selectedProfile}
                    .onSendText=${message => this.handleSendText(message)}
                    @response-index-changed=${e => (this.currentResponseIndex = e.detail.index)}
                ></assistant-view>`;
                break;
            case 'ask':
                content = html`<ask-view></ask-view>`;
                break;
            case 'settings':
                content = html`<settings-view
                    .selectedProfile=${this.selectedProfile}
                    .selectedLanguage=${this.selectedLanguage}
                    .onProfileChange=${profile => (this.selectedProfile = profile)}
                    .onLanguageChange=${lang => (this.selectedLanguage = lang)}
                ></settings-view>`;
                break;
            case 'history':
                content = html`<history-view></history-view>`;
                break;
            case 'help':
                content = html`<help-view></help-view>`;
                break;
            case 'setup':
                content = html`<setup-view></setup-view>`;
                break;
            default:
                content = html`<div>Unknown view: ${this.currentView}</div>`;
        }
        
        return html`
            ${content}
        `;
    }
}

customElements.define('pickle-glass-app', PickleGlassApp);
