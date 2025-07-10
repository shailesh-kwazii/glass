import { html, css, LitElement } from '../assets/lit-core-2.7.4.min.js';

export class MainHeader extends LitElement {
    static properties = {
        isSessionActive: { type: Boolean, state: true },
    };

    static styles = css`
        :host {
            display: block;
            transform: translate3d(0, 0, 0);
            backface-visibility: hidden;
            transition: transform 0.2s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.2s ease-out;
            will-change: transform, opacity;
        }

        :host(.hiding) {
            animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.6, 1) forwards;
        }

        :host(.showing) {
            animation: slideDown 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        :host(.sliding-in) {
            animation: fadeIn 0.2s ease-out forwards;
        }

        :host(.hidden) {
            opacity: 0;
            transform: translateY(-150%) scale(0.85);
            pointer-events: none;
        }

        @keyframes slideUp {
            0% {
                opacity: 1;
                transform: translateY(0) scale(1);
                filter: blur(0px);
            }
            30% {
                opacity: 0.7;
                transform: translateY(-20%) scale(0.98);
                filter: blur(0.5px);
            }
            70% {
                opacity: 0.3;
                transform: translateY(-80%) scale(0.92);
                filter: blur(1.5px);
            }
            100% {
                opacity: 0;
                transform: translateY(-150%) scale(0.85);
                filter: blur(2px);
            }
        }

        @keyframes slideDown {
            0% {
                opacity: 0;
                transform: translateY(-150%) scale(0.85);
                filter: blur(2px);
            }
            30% {
                opacity: 0.5;
                transform: translateY(-50%) scale(0.92);
                filter: blur(1px);
            }
            65% {
                opacity: 0.9;
                transform: translateY(-5%) scale(0.99);
                filter: blur(0.2px);
            }
            85% {
                opacity: 0.98;
                transform: translateY(2%) scale(1.005);
                filter: blur(0px);
            }
            100% {
                opacity: 1;
                transform: translateY(0) scale(1);
                filter: blur(0px);
            }
        }

        @keyframes fadeIn {
            0% {
                opacity: 0;
            }
            100% {
                opacity: 1;
            }
        }

        * {
            font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            cursor: default;
            user-select: none;
        }

        .header {
            width: 100%;
            height: 47px;
            padding: 2px 10px 2px 13px;
            background: transparent;
            overflow: hidden;
            border-radius: 9000px;
            /* backdrop-filter: blur(1px); */
            justify-content: space-between;
            align-items: center;
            display: inline-flex;
            box-sizing: border-box;
            position: relative;
        }

        .header::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            border-radius: 9000px;
            z-index: -1;
        }

        .header::after {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            border-radius: 9000px;
            padding: 1px;
            background: linear-gradient(169deg, rgba(255, 255, 255, 0.17) 0%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 255, 255, 0.17) 100%); 
            -webkit-mask:
                linear-gradient(#fff 0 0) content-box,
                linear-gradient(#fff 0 0);
            -webkit-mask-composite: destination-out;
            mask-composite: exclude;
            pointer-events: none;
        }

        .listen-button {
            height: 26px;
            padding: 0 13px;
            background: transparent;
            border-radius: 9000px;
            justify-content: center;
            width: 78px;
            align-items: center;
            gap: 6px;
            display: flex;
            border: none;
            cursor: pointer;
            position: relative;
        }

        .listen-button.active::before {
            background: rgba(215, 0, 0, 0.5);
        }

        .listen-button.active:hover::before {
            background: rgba(255, 20, 20, 0.6);
        }

        .listen-button.processing {
            cursor: wait;
            opacity: 0.8;
        }

        .listen-button.processing::before {
            background: rgba(138, 43, 226, 0.5);
            animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
            0% { opacity: 0.6; }
            50% { opacity: 0.9; }
            100% { opacity: 0.6; }
        }

        .listen-button:hover::before {
            background: rgba(255, 255, 255, 0.18);
        }

        .listen-button::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255, 255, 255, 0.14);
            border-radius: 9000px;
            z-index: -1;
            transition: background 0.15s ease;
        }

        .listen-button::after {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            border-radius: 9000px;
            padding: 1px;
            background: linear-gradient(169deg, rgba(255, 255, 255, 0.17) 0%, rgba(255, 255, 255, 0.08) 50%, rgba(255, 255, 255, 0.17) 100%);
            -webkit-mask:
                linear-gradient(#fff 0 0) content-box,
                linear-gradient(#fff 0 0);
            -webkit-mask-composite: destination-out;
            mask-composite: exclude;
            pointer-events: none;
        }

        .header-actions {
            height: 26px;
            box-sizing: border-box;
            justify-content: flex-start;
            align-items: center;
            gap: 9px;
            display: flex;
            padding: 0 8px;
            border-radius: 6px;
            transition: background 0.15s ease;
        }

        .header-actions:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .ask-action {
            margin-left: 4px;
        }

        .action-button,
        .settings-button {
            background: transparent;
            color: white;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .action-text {
            padding-bottom: 1px;
            justify-content: center;
            align-items: center;
            gap: 10px;
            display: flex;
        }

        .action-text-content {
            color: white;
            font-size: 14px;
            font-family: 'Helvetica Neue', sans-serif;
            font-weight: 500; /* Medium */
            word-wrap: break-word;
        }

        .icon-container {
            justify-content: flex-start;
            align-items: center;
            gap: 4px;
            display: flex;
        }

        .icon-container.ask-icons svg,
        .icon-container.showhide-icons svg {
            width: 12px;
            height: 12px;
        }

        .listen-icon svg {
            width: 12px;
            height: 11px;
            position: relative;
            top: 1px;
        }

        .icon-box {
            color: white;
            font-size: 14px;
            font-family: 'Helvetica Neue', sans-serif;
            font-weight: 500;
            background-color: rgba(255, 255, 255, 0.1);
            border-radius: 13%;
            width: 18px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .settings-button {
            padding: 5px;
            border-radius: 50%;
            transition: background 0.15s ease;
        }
        
        .settings-button:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .settings-icon {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .settings-icon svg {
            width: 16px;
            height: 16px;
        }

        /* ────────────────[ GLASS BYPASS ]─────────────── */
        :host-context(body.has-glass) .header,
        :host-context(body.has-glass) .listen-button,
        :host-context(body.has-glass) .header-actions,
        :host-context(body.has-glass) .settings-button {
            background: transparent !important;
            filter: none !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
        }
        :host-context(body.has-glass) .icon-box {
            background: transparent !important;
            border: none !important;
        }

        :host-context(body.has-glass) .header::before,
        :host-context(body.has-glass) .header::after,
        :host-context(body.has-glass) .listen-button::before,
        :host-context(body.has-glass) .listen-button::after {
            display: none !important;
        }

        :host-context(body.has-glass) .header-actions:hover,
        :host-context(body.has-glass) .settings-button:hover,
        :host-context(body.has-glass) .listen-button:hover::before {
            background: transparent !important;
        }
        :host-context(body.has-glass) * {
            animation: none !important;
            transition: none !important;
            transform: none !important;
            filter: none !important;
            backdrop-filter: none !important;
            box-shadow: none !important;
        }

        :host-context(body.has-glass) .header,
        :host-context(body.has-glass) .listen-button,
        :host-context(body.has-glass) .header-actions,
        :host-context(body.has-glass) .settings-button,
        :host-context(body.has-glass) .icon-box {
            border-radius: 0 !important;
        }
        :host-context(body.has-glass) {
            animation: none !important;
            transition: none !important;
            transform: none !important;
            will-change: auto !important;
        }
        `;

    constructor() {
        super();
        this.dragState = null;
        this.wasJustDragged = false;
        this.isVisible = true;
        this.isAnimating = false;
        this.hasSlidIn = false;
        this.settingsHideTimer = null;
        this.isSessionActive = false;
        this.isPaused = false;
        this.isProcessing = false;
        this.isListening = false;
        this.animationEndTimer = null;
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleAnimationEnd = this.handleAnimationEnd.bind(this);
    }

    async handleMouseDown(e) {
        e.preventDefault();

        const { ipcRenderer } = window.require('electron');
        const initialPosition = await ipcRenderer.invoke('get-header-position');

        this.dragState = {
            initialMouseX: e.screenX,
            initialMouseY: e.screenY,
            initialWindowX: initialPosition.x,
            initialWindowY: initialPosition.y,
            moved: false,
        };

        window.addEventListener('mousemove', this.handleMouseMove, { capture: true });
        window.addEventListener('mouseup', this.handleMouseUp, { once: true, capture: true });
    }

    handleMouseMove(e) {
        if (!this.dragState) return;

        const deltaX = Math.abs(e.screenX - this.dragState.initialMouseX);
        const deltaY = Math.abs(e.screenY - this.dragState.initialMouseY);
        
        if (deltaX > 3 || deltaY > 3) {
            this.dragState.moved = true;
        }

        const newWindowX = this.dragState.initialWindowX + (e.screenX - this.dragState.initialMouseX);
        const newWindowY = this.dragState.initialWindowY + (e.screenY - this.dragState.initialMouseY);

        const { ipcRenderer } = window.require('electron');
        ipcRenderer.invoke('move-header-to', newWindowX, newWindowY);
    }

    handleMouseUp(e) {
        if (!this.dragState) return;

        const wasDragged = this.dragState.moved;

        window.removeEventListener('mousemove', this.handleMouseMove, { capture: true });
        this.dragState = null;

        if (wasDragged) {
            this.wasJustDragged = true;
            setTimeout(() => {
                this.wasJustDragged = false;
            }, 0);
        }
    }

    toggleVisibility() {
        if (this.isAnimating) {
            console.log('[MainHeader] Animation already in progress, ignoring toggle');
            return;
        }
        
        if (this.animationEndTimer) {
            clearTimeout(this.animationEndTimer);
            this.animationEndTimer = null;
        }
        
        this.isAnimating = true;
        
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    hide() {
        this.classList.remove('showing', 'hidden');
        this.classList.add('hiding');
        this.isVisible = false;
        
        this.animationEndTimer = setTimeout(() => {
            if (this.classList.contains('hiding')) {
                this.handleAnimationEnd({ target: this });
            }
        }, 350);
    }

    show() {
        this.classList.remove('hiding', 'hidden');
        this.classList.add('showing');
        this.isVisible = true;
        
        this.animationEndTimer = setTimeout(() => {
            if (this.classList.contains('showing')) {
                this.handleAnimationEnd({ target: this });
            }
        }, 400);
    }

    handleAnimationEnd(e) {
        if (e.target !== this) return;
        
        if (this.animationEndTimer) {
            clearTimeout(this.animationEndTimer);
            this.animationEndTimer = null;
        }
        
        this.isAnimating = false;
        
        if (this.classList.contains('hiding')) {
            this.classList.remove('hiding');
            this.classList.add('hidden');
            
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('header-animation-complete', 'hidden');
            }
        } else if (this.classList.contains('showing')) {
            this.classList.remove('showing');
            
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('header-animation-complete', 'visible');
            }
        } else if (this.classList.contains('sliding-in')) {
            this.classList.remove('sliding-in');
            this.hasSlidIn = true;
            console.log('[MainHeader] Slide-in animation completed');
        }
    }

    startSlideInAnimation() {
        if (this.hasSlidIn) return;
        this.classList.add('sliding-in');
    }

    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('animationend', this.handleAnimationEnd);

        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            this._sessionStateListener = (event, { isActive }) => {
                this.isSessionActive = isActive;
            };
            this._listenStateListener = (event, { isListening, isPaused, isProcessing }) => {
                console.log('[MainHeader] Listen state update:', { isListening, isPaused, isProcessing });
                // Update session active state based on isListening
                this.isSessionActive = isListening || false;
                this.isListening = isListening || false;
                if (isListening) {
                    this.isPaused = isPaused || false;
                    this.isProcessing = isProcessing || false;
                }
                this.requestUpdate();
            };
            ipcRenderer.on('session-state-changed', this._sessionStateListener);
            ipcRenderer.on('continuous-listen-state', this._listenStateListener);
            
            // Handle continuous listen errors
            this._errorListener = (event, { error, type }) => {
                console.error('[MainHeader] Continuous listen error:', type, error);
                // Reset button state on error
                this.isSessionActive = false;
                this.isListening = false;
                this.isPaused = false;
                this.isProcessing = false;
                this.requestUpdate();
            };
            ipcRenderer.on('continuous-listen-error', this._errorListener);
            
            // Request initial state
            ipcRenderer.invoke('get-continuous-listening-state').then(({ isListening }) => {
                console.log('[MainHeader] Initial continuous listening state:', isListening);
                this._listenStateListener(null, { isListening, isPaused: false, isProcessing: false });
            }).catch(error => {
                console.error('[MainHeader] Failed to get initial state:', error);
            });
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('animationend', this.handleAnimationEnd);
        
        if (this.animationEndTimer) {
            clearTimeout(this.animationEndTimer);
            this.animationEndTimer = null;
        }
        
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            if (this._sessionStateListener) {
                ipcRenderer.removeListener('session-state-changed', this._sessionStateListener);
            }
            if (this._listenStateListener) {
                ipcRenderer.removeListener('continuous-listen-state', this._listenStateListener);
            }
            if (this._errorListener) {
                ipcRenderer.removeListener('continuous-listen-error', this._errorListener);
            }
        }
    }

    async invoke(channel, ...args) {
        if (this.wasJustDragged) {
            return;
        }
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            try {
                const result = await ipcRenderer.invoke(channel, ...args);
                return result;
            } catch (error) {
                console.error(`[MainHeader] Error invoking ${channel}:`, error);
                throw error;
            }
        }
    }

    showWindow(name, element) {
        if (this.wasJustDragged) return;
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            console.log(`[MainHeader] showWindow('${name}') called at ${Date.now()}`);
            
            ipcRenderer.send('cancel-hide-window', name);

            if (name === 'settings' && element) {
                const rect = element.getBoundingClientRect();
                ipcRenderer.send('show-window', {
                    name: 'settings',
                    bounds: {
                        x: rect.left,
                        y: rect.top,
                        width: rect.width,
                        height: rect.height
                    }
                });
            } else {
                ipcRenderer.send('show-window', name);
            }
        }
    }

    hideWindow(name) {
        if (this.wasJustDragged) return;
        if (window.require) {
            console.log(`[MainHeader] hideWindow('${name}') called at ${Date.now()}`);
            window.require('electron').ipcRenderer.send('hide-window', name);
        }
    }

    cancelHideWindow(name) {

    }

    render() {
        return html`
            <div class="header" @mousedown=${this.handleMouseDown}>
                <button 
                    class="listen-button ${this.isSessionActive ? 'active' : ''} ${this.isProcessing ? 'processing' : ''}"
                    ?disabled=${this.isProcessing}
                    @click=${async () => {
                        console.log('[MainHeader] Listen button clicked, state:', { isSessionActive: this.isSessionActive, isPaused: this.isPaused });
                        if (!this.isSessionActive) {
                            await this.invoke('toggle-continuous-listening');
                        } else if (this.isPaused) {
                            await this.invoke('resume-listening');
                        } else {
                            // Just pause - don't send to LLM (only cmd+/ should do that)
                            await this.invoke('pause-listening');
                        }
                    }}
                    @contextmenu=${(e) => {
                        e.preventDefault();
                        if (this.isSessionActive) {
                            // Right-click to stop the session
                            this.invoke('stop-continuous-listening');
                        }
                    }}
                    title="${this.isSessionActive ? 'Right-click to stop' : 'Start listening'}"
                >
                    <div class="action-text">
                        <div class="action-text-content">${!this.isSessionActive ? 'Listen' : (this.isProcessing ? 'Processing...' : (this.isPaused ? 'Resume' : 'Pause'))}</div>
                    </div>
                    <div class="listen-icon">
                        ${this.isSessionActive
                            ? html`
                                <svg width="9" height="9" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect width="9" height="9" rx="1" fill="white"/>
                                </svg>

                            `
                            : html`
                                <svg width="12" height="11" viewBox="0 0 12 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1.69922 2.7515C1.69922 2.37153 2.00725 2.0635 2.38722 2.0635H2.73122C3.11119 2.0635 3.41922 2.37153 3.41922 2.7515V8.2555C3.41922 8.63547 3.11119 8.9435 2.73122 8.9435H2.38722C2.00725 8.9435 1.69922 8.63547 1.69922 8.2555V2.7515Z" fill="white"/>
                                    <path d="M5.13922 1.3755C5.13922 0.995528 5.44725 0.6875 5.82722 0.6875H6.17122C6.55119 0.6875 6.85922 0.995528 6.85922 1.3755V9.6315C6.85922 10.0115 6.55119 10.3195 6.17122 10.3195H5.82722C5.44725 10.3195 5.13922 10.0115 5.13922 9.6315V1.3755Z" fill="white"/>
                                    <path d="M8.57922 3.0955C8.57922 2.71553 8.88725 2.4075 9.26722 2.4075H9.61122C9.99119 2.4075 10.2992 2.71553 10.2992 3.0955V7.9115C10.2992 8.29147 9.99119 8.5995 9.61122 8.5995H9.26722C8.88725 8.5995 8.57922 8.29147 8.57922 7.9115V3.0955Z" fill="white"/>
                                </svg>
                            `}
                    </div>
                </button>

                <div class="header-actions" @click=${() => this.invoke('toggle-all-windows-visibility')}>
                    <div class="action-text">
                        <div class="action-text-content">Show/Hide</div>
                    </div>
                    <div class="icon-container showhide-icons">
                        <div class="icon-box">⌘</div>
                        <div class="icon-box">
                            <svg viewBox="0 0 6 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1.50391 1.32812L5.16391 10.673" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                    </div>
                </div>

                <button 
                    class="settings-button"
                    @mouseenter=${(e) => this.showWindow('settings', e.currentTarget)}
                    @mouseleave=${() => this.hideWindow('settings')}
                >
                    <div class="settings-icon">
                        <svg width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8.0013 3.16406C7.82449 3.16406 7.65492 3.2343 7.5299 3.35932C7.40487 3.48435 7.33464 3.65392 7.33464 3.83073C7.33464 4.00754 7.40487 4.17711 7.5299 4.30213C7.65492 4.42716 7.82449 4.4974 8.0013 4.4974C8.17811 4.4974 8.34768 4.42716 8.47271 4.30213C8.59773 4.17711 8.66797 4.00754 8.66797 3.83073C8.66797 3.65392 8.59773 3.48435 8.47271 3.35932C8.34768 3.2343 8.17811 3.16406 8.0013 3.16406ZM8.0013 7.83073C7.82449 7.83073 7.65492 7.90097 7.5299 8.02599C7.40487 8.15102 7.33464 8.32058 7.33464 8.4974C7.33464 8.67421 7.40487 8.84378 7.5299 8.9688C7.65492 9.09382 7.82449 9.16406 8.0013 9.16406C8.17811 9.16406 8.34768 9.09382 8.47271 8.9688C8.59773 8.84378 8.66797 8.67421 8.66797 8.4974C8.66797 8.32058 8.59773 8.15102 8.47271 8.02599C8.34768 7.90097 8.17811 7.83073 8.0013 7.83073ZM8.0013 12.4974C7.82449 12.4974 7.65492 12.5676 7.5299 12.6927C7.40487 12.8177 7.33464 12.9873 7.33464 13.1641C7.33464 13.3409 7.40487 13.5104 7.5299 13.6355C7.65492 13.7605 7.82449 13.8307 8.0013 13.8307C8.17811 13.8307 8.34768 13.7605 8.47271 13.6355C8.59773 13.5104 8.66797 13.3409 8.66797 13.1641C8.66797 12.9873 8.59773 12.8177 8.47271 12.6927C8.34768 12.5676 8.17811 12.4974 8.0013 12.4974Z" fill="white" stroke="white" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                </button>
            </div>
        `;
    }
}

customElements.define('main-header', MainHeader);
