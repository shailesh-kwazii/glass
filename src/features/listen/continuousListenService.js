const { BrowserWindow, ipcMain } = require('electron');
const SttService = require('./stt/sttService');
const sessionRepository = require('../../common/repositories/session');
const sttRepository = require('./stt/repositories');
const authService = require('../../common/services/authService');

class ContinuousListenService {
    constructor() {
        this.sttService = new SttService();
        this.isListening = false;
        this.isPaused = false;
        this.conversationHistory = [];
        this.maxHistorySize = 100; // Keep last 100 turns
        this.currentSessionId = null;
        this.screenshotInterval = null;
        this.currentScreenshot = null;
        
        this.setupServiceCallbacks();
    }

    setupServiceCallbacks() {
        this.sttService.setCallbacks({
            onTranscriptionComplete: (speaker, text) => {
                this.handleTranscriptionComplete(speaker, text);
            },
            onStatusUpdate: (status) => {
                this.sendToRenderer('continuous-listen-status', status);
            }
        });
    }

    sendToRenderer(channel, data) {
        BrowserWindow.getAllWindows().forEach(win => {
            if (!win.isDestroyed()) {
                win.webContents.send(channel, data);
            }
        });
    }

    async handleTranscriptionComplete(speaker, text) {
        if (this.isPaused) return;
        
        const timestamp = new Date().toISOString();
        const entry = { speaker, text, timestamp };
        
        // Add to conversation history with rolling buffer
        this.conversationHistory.push(entry);
        if (this.conversationHistory.length > this.maxHistorySize) {
            this.conversationHistory.shift();
        }
        
        // Save to database
        if (this.currentSessionId) {
            try {
                await sessionRepository.touch(this.currentSessionId);
                await sttRepository.addTranscript({
                    sessionId: this.currentSessionId,
                    speaker: speaker,
                    text: text.trim(),
                });
            } catch (error) {
                console.error('Failed to save transcript:', error);
            }
        }
        
        // Send to renderer for display
        this.sendToRenderer('continuous-transcription', entry);
    }

    async startContinuousListening() {
        if (this.isListening) return true;
        
        try {
            // Initialize session
            const uid = authService.getCurrentUserId();
            if (!uid) {
                this.sendToRenderer('continuous-listen-error', {
                    error: 'User not logged in',
                    type: 'auth'
                });
                throw new Error("Cannot start listening: user not logged in");
            }
            
            this.currentSessionId = await sessionRepository.getOrCreateActive(uid, 'continuous-listen');
            
            // Initialize STT for system audio only
            try {
                await this.sttService.initializeSttSessions('en', { systemAudioOnly: true });
            } catch (sttError) {
                this.sendToRenderer('continuous-listen-error', {
                    error: 'Failed to initialize speech-to-text service. Please check your API key.',
                    type: 'stt_init'
                });
                throw sttError;
            }
            
            // Start system audio capture
            if (process.platform === 'darwin') {
                try {
                    await this.sttService.startMacOSAudioCapture();
                } catch (audioError) {
                    this.sendToRenderer('continuous-listen-error', {
                        error: 'Failed to capture system audio. Please check audio permissions in System Preferences > Security & Privacy > Privacy > Screen Recording.',
                        type: 'audio_permission'
                    });
                    throw audioError;
                }
            } else {
                this.sendToRenderer('continuous-listen-error', {
                    error: 'System audio capture is currently only supported on macOS',
                    type: 'platform'
                });
            }
            
            // Start screenshot capture interval
            this.startScreenshotCapture();
            
            this.isListening = true;
            this.isPaused = false;
            
            this.sendToRenderer('continuous-listen-state', { 
                isListening: true, 
                isPaused: false 
            });
            
            console.log('Continuous listening started');
            return true;
        } catch (error) {
            console.error('Failed to start continuous listening:', error);
            this.sendToRenderer('continuous-listen-state', { 
                isListening: false, 
                isPaused: false 
            });
            return false;
        }
    }

    async pauseListening() {
        this.isPaused = true;
        this.sendToRenderer('continuous-listen-state', { 
            isListening: this.isListening, 
            isPaused: true 
        });
    }

    async resumeListening() {
        this.isPaused = false;
        this.sendToRenderer('continuous-listen-state', { 
            isListening: this.isListening, 
            isPaused: false 
        });
    }

    async stopContinuousListening() {
        if (!this.isListening) return;
        
        try {
            // Stop audio capture
            if (process.platform === 'darwin') {
                this.sttService.stopMacOSAudioCapture();
            }
            
            // Close STT sessions
            await this.sttService.closeSessions();
            
            // Stop screenshot capture
            this.stopScreenshotCapture();
            
            // End session
            if (this.currentSessionId) {
                await sessionRepository.end(this.currentSessionId);
            }
            
            this.isListening = false;
            this.isPaused = false;
            this.currentSessionId = null;
            
            this.sendToRenderer('continuous-listen-state', { 
                isListening: false, 
                isPaused: false 
            });
            
            console.log('Continuous listening stopped');
        } catch (error) {
            console.error('Error stopping continuous listening:', error);
        }
    }

    startScreenshotCapture() {
        // Capture screenshot every 5 seconds
        this.screenshotInterval = setInterval(async () => {
            if (!this.isPaused) {
                const result = await this.captureScreenshot();
                if (result.success) {
                    this.currentScreenshot = {
                        base64: result.base64,
                        width: result.width,
                        height: result.height,
                        timestamp: Date.now()
                    };
                }
            }
        }, 5000);
    }

    stopScreenshotCapture() {
        if (this.screenshotInterval) {
            clearInterval(this.screenshotInterval);
            this.screenshotInterval = null;
        }
    }

    async captureScreenshot() {
        // Import the captureScreenshot function directly
        const { captureScreenshot } = require('../../electron/windowManager');
        return await captureScreenshot();
    }

    getConversationHistory() {
        return this.conversationHistory;
    }

    getConversationText() {
        return this.conversationHistory
            .map(entry => `[${entry.timestamp}] ${entry.speaker}: ${entry.text}`)
            .join('\n');
    }

    async sendToLLM(includeScreenshot = false) {
        await this.pauseListening();
        
        const conversationText = this.getConversationText();
        const screenshot = includeScreenshot ? this.currentScreenshot : null;
        
        // Send to ask service
        const askWindow = BrowserWindow.getAllWindows().find(win => 
            win.webContents.getURL().includes('ask.html')
        );
        
        if (askWindow) {
            askWindow.show();
            askWindow.webContents.send('populate-from-continuous-listen', {
                text: conversationText,
                screenshot: screenshot
            });
        }
        
        // Resume listening after a delay
        setTimeout(() => {
            this.resumeListening();
        }, 1000);
    }

    setupIpcHandlers() {
        ipcMain.handle('start-continuous-listening', async () => {
            return await this.startContinuousListening();
        });

        ipcMain.handle('stop-continuous-listening', async () => {
            await this.stopContinuousListening();
            return { success: true };
        });

        ipcMain.handle('get-conversation-history', () => {
            return this.getConversationHistory();
        });

        ipcMain.handle('send-conversation-to-llm', async (event, { includeScreenshot }) => {
            await this.sendToLLM(includeScreenshot);
            return { success: true };
        });

        console.log('Continuous listen service IPC handlers registered');
    }
}

module.exports = ContinuousListenService;