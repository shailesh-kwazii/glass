const { BrowserWindow, ipcMain } = require('electron');
const SttService = require('./stt/sttService');
const sessionRepository = require('../../common/repositories/session');
const sttRepository = require('./stt/repositories');
const authService = require('../../common/services/authService');
const { createStreamingLLM } = require('../../common/ai/factory');
const { getStoredApiKey, getStoredProvider } = require('../../electron/windowManager');
const { getSystemPrompt } = require('../../common/prompts/promptBuilder');

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

    async toggleContinuousListening() {
        if (this.isListening) {
            await this.stopContinuousListening();
            return false;
        } else {
            await this.startContinuousListening();
            return true;
        }
    }

    getContinuousListeningState() {
        return this.isListening;
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
        // Only pause if we're actually listening
        if (this.isListening && !this.isPaused) {
            await this.pauseListening();
        }
        
        try {
            const conversationText = this.getConversationText();
            
            // If no conversation history, return early
            if (!conversationText || this.conversationHistory.length === 0) {
                this.sendToRenderer('stt-update', {
                    speaker: 'System',
                    text: 'No conversation history available. Start listening first to capture audio.',
                    isPartial: false,
                    isFinal: true
                });
                return;
            }
            const screenshot = includeScreenshot ? this.currentScreenshot : null;
            
            // Send conversation history to SttView
            const conversationMessages = this.conversationHistory.map(entry => ({
                id: Date.now() + Math.random(),
                speaker: entry.speaker,
                text: entry.text,
                isPartial: false,
                isFinal: true,
                timestamp: entry.timestamp
            }));
            
            this.sendToRenderer('stt-conversation-update', {
                messages: conversationMessages,
                conversationText: conversationText,
                screenshot: screenshot
            });
            
            // Get API key and provider
            const apiKey = await getStoredApiKey();
            if (!apiKey) {
                throw new Error('No API key found. Please configure your API key in settings.');
            }
            
            const provider = await getStoredProvider();
            
            // Build system prompt
            const systemPrompt = getSystemPrompt('pickle_glass', conversationText, false);
            
            // Prepare messages for LLM
            const messages = [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: includeScreenshot && screenshot ? [
                        { type: 'text', text: 'Based on the conversation and current screen, provide helpful analysis or suggestions.' },
                        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${screenshot.base64}` } }
                    ] : 'Based on the conversation, provide helpful analysis or suggestions.'
                }
            ];
            
            // Create streaming LLM instance
            const streamingLLM = createStreamingLLM(provider, {
                apiKey: apiKey,
                model: provider === 'openai' ? 'gpt-4o' : 'gemini-2.0-flash-exp',
                temperature: 0.7,
                maxTokens: 2048
            });
            
            // Create a unique message ID for the AI response
            const aiMessageId = Date.now() + Math.random();
            let aiResponseText = '';
            
            // Add initial AI message placeholder
            this.sendToRenderer('stt-update', {
                speaker: 'AI',
                text: '',
                isPartial: true,
                isFinal: false,
                messageId: aiMessageId
            });
            
            // Stream the response
            const response = await streamingLLM.streamChat(messages);
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim() !== '');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.substring(6);
                        if (data === '[DONE]') {
                            // Finalize the AI message
                            this.sendToRenderer('stt-update', {
                                speaker: 'AI',
                                text: aiResponseText,
                                isPartial: false,
                                isFinal: true,
                                messageId: aiMessageId
                            });
                            
                            // Add to conversation history
                            const aiEntry = {
                                speaker: 'AI',
                                text: aiResponseText,
                                timestamp: new Date().toISOString()
                            };
                            this.conversationHistory.push(aiEntry);
                            
                            // Save to database if we have a session
                            if (this.currentSessionId) {
                                try {
                                    await sttRepository.addTranscript({
                                        sessionId: this.currentSessionId,
                                        speaker: 'AI',
                                        text: aiResponseText.trim(),
                                    });
                                } catch (error) {
                                    console.error('Failed to save AI response to database:', error);
                                }
                            }
                        } else {
                            try {
                                const json = JSON.parse(data);
                                const token = json.choices[0]?.delta?.content || '';
                                if (token) {
                                    aiResponseText += token;
                                    // Update the AI message with streaming text
                                    this.sendToRenderer('stt-update', {
                                        speaker: 'AI',
                                        text: aiResponseText,
                                        isPartial: true,
                                        isFinal: false,
                                        messageId: aiMessageId
                                    });
                                }
                            } catch (error) {
                                // Ignore parsing errors
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error in sendToLLM:', error);
            // Send error message to UI
            this.sendToRenderer('stt-update', {
                speaker: 'System',
                text: `Error: ${error.message}`,
                isPartial: false,
                isFinal: true
            });
        }
    }

    setupIpcHandlers() {
        ipcMain.handle('start-continuous-listening', async () => {
            return await this.startContinuousListening();
        });

        ipcMain.handle('stop-continuous-listening', async () => {
            await this.stopContinuousListening();
            return { success: true };
        });

        ipcMain.handle('toggle-continuous-listening', async () => {
            const isNowListening = await this.toggleContinuousListening();
            return { success: true, isListening: isNowListening };
        });

        ipcMain.handle('get-conversation-history', () => {
            return this.getConversationHistory();
        });

        ipcMain.handle('send-conversation-to-llm', async (event, { includeScreenshot }) => {
            await this.sendToLLM(includeScreenshot);
            return { success: true };
        });

        ipcMain.handle('get-continuous-listening-state', () => {
            return { isListening: this.getContinuousListeningState() };
        });

        console.log('Continuous listen service IPC handlers registered');
    }
}

module.exports = ContinuousListenService;