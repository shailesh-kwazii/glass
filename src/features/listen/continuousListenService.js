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
        this.pendingTranscriptions = []; // Buffer for transcriptions
        this.isProcessingLLM = false; // Flag to prevent concurrent LLM requests
        this.currentAbortController = null; // For aborting LLM streaming
        
        this.setupServiceCallbacks();
    }
    
    showListenWindow() {
        const { windowPool } = require('../../electron/windowManager');
        const listenWindow = windowPool.get('listen');
        
        if (listenWindow && !listenWindow.isDestroyed()) {
            console.log('[ContinuousListenService] Showing listen window');
            listenWindow.show();
            // Force layout update after showing
            const windowManager = require('../../electron/windowManager');
            if (windowManager && typeof windowManager.updateLayout === 'function') {
                windowManager.updateLayout();
            }
        } else {
            console.log('[ContinuousListenService] Listen window not available - header may not be in main state');
            // Still update UI state even if window doesn't exist
        }
    }
    
    hideListenWindow() {
        const { windowPool } = require('../../electron/windowManager');
        const listenWindow = windowPool.get('listen');
        
        if (listenWindow && !listenWindow.isDestroyed()) {
            listenWindow.hide();
        }
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
        
        // Add to pending transcriptions buffer instead of sending immediately
        this.pendingTranscriptions.push(entry);
        
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
        
        // Don't send to renderer immediately - wait for cmd+/
        // Update transcription count for the indicator
        this.sendToRenderer('continuous-transcription-buffered', { 
            count: this.pendingTranscriptions.length 
        });
    }

    async startContinuousListening() {
        if (this.isListening) return true;
        
        try {
            // Initialize session
            const uid = authService.getCurrentUserId();
            if (!uid) {
                console.error('[ContinuousListenService] Cannot start listening: user not logged in');
                this.sendToRenderer('continuous-listen-error', {
                    error: 'Please log in to use continuous listening',
                    type: 'auth'
                });
                // Still update state so UI reflects the attempt
                this.sendToRenderer('continuous-listen-state', { 
                    isListening: false, 
                    isPaused: false 
                });
                return false;
            }
            
            this.currentSessionId = await sessionRepository.getOrCreateActive(uid, 'continuous-listen');
            
            // Check API key before initializing STT
            const apiKey = await getStoredApiKey();
            if (!apiKey) {
                console.error('[ContinuousListenService] No API key found');
                this.sendToRenderer('continuous-listen-error', {
                    error: 'Please configure your API key in settings',
                    type: 'api_key'
                });
                this.sendToRenderer('continuous-listen-state', { 
                    isListening: false, 
                    isPaused: false 
                });
                return false;
            }
            
            // Initialize STT for system audio only
            try {
                await this.sttService.initializeSttSessions('en', { systemAudioOnly: true });
            } catch (sttError) {
                console.error('[ContinuousListenService] STT initialization failed:', sttError);
                this.sendToRenderer('continuous-listen-error', {
                    error: 'Failed to initialize speech-to-text service. Please check your API key.',
                    type: 'stt_init'
                });
                this.sendToRenderer('continuous-listen-state', { 
                    isListening: false, 
                    isPaused: false 
                });
                return false;
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
            
            // Also send session state for MainHeader
            this.sendToRenderer('session-state-changed', { isActive: true });
            
            // Show the listen window when continuous listening starts
            this.showListenWindow();
            
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
        
        // Stop audio capture when pausing
        if (this.sttService) {
            await this.sttService.pauseAudioCapture();
        }
        
        // Flush pending transcriptions to SttView when pausing
        if (this.pendingTranscriptions.length > 0) {
            for (const entry of this.pendingTranscriptions) {
                this.sendToRenderer('stt-update', {
                    speaker: entry.speaker,
                    text: entry.text,
                    isPartial: false,
                    isFinal: true,
                    timestamp: entry.timestamp
                });
            }
            // Note: Don't clear pending transcriptions here - they'll be cleared after LLM processing
        } else {
            // No audio captured yet - provide feedback
            this.sendToRenderer('stt-update', {
                speaker: 'System',
                text: 'No audio captured yet. Start speaking and I\'ll help you when you pause.',
                isPartial: false,
                isFinal: true
            });
        }
        
        this.sendToRenderer('continuous-listen-state', { 
            isListening: this.isListening, 
            isPaused: true 
        });
    }

    async resumeListening() {
        this.isPaused = false;
        
        // Resume audio capture
        if (this.sttService) {
            await this.sttService.resumeAudioCapture();
        }
        
        this.sendToRenderer('continuous-listen-state', { 
            isListening: this.isListening, 
            isPaused: false 
        });
    }

    async stopContinuousListening() {
        console.log('[stopContinuousListening] Called, current state:', this.isListening);
        if (!this.isListening) {
            console.log('[stopContinuousListening] Already not listening, returning');
            return;
        }
        
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
            this.pendingTranscriptions = []; // Clear pending transcriptions
            
            console.log('[stopContinuousListening] State updated - isListening:', this.isListening);
            
            this.sendToRenderer('continuous-listen-state', { 
                isListening: false, 
                isPaused: false 
            });
            
            // Also send session state for MainHeader
            this.sendToRenderer('session-state-changed', { isActive: false });
            
            // Hide the listen window when continuous listening stops
            this.hideListenWindow();
            
            console.log('[stopContinuousListening] Successfully stopped');
        } catch (error) {
            console.error('Error stopping continuous listening:', error);
        }
    }

    async toggleContinuousListening() {
        console.log('[toggleContinuousListening] Called, current state:', this.isListening);
        if (this.isListening) {
            console.log('[toggleContinuousListening] Stopping...');
            await this.stopContinuousListening();
            const newState = this.isListening;
            console.log('[toggleContinuousListening] After stop, state:', newState);
            return false;
        } else {
            console.log('[toggleContinuousListening] Starting...');
            await this.startContinuousListening();
            const newState = this.isListening;
            console.log('[toggleContinuousListening] After start, state:', newState);
            return true;
        }
    }

    getContinuousListeningState() {
        return this.isListening;
    }

    getPausedState() {
        return this.isPaused;
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
        // Prevent concurrent LLM requests
        if (this.isProcessingLLM) {
            console.log('[sendToLLM] Already processing LLM request, ignoring');
            return;
        }
        
        // Abort any existing streaming operation
        if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = null;
        }
        
        // Only pause if we're actually listening
        if (this.isListening && !this.isPaused) {
            await this.pauseListening();
        }
        
        this.isProcessingLLM = true;
        this.sendToRenderer('continuous-listen-state', { 
            isListening: this.isListening, 
            isPaused: this.isPaused,
            isProcessing: true 
        });
        
        try {
            // First, send all pending transcriptions to the UI
            if (this.pendingTranscriptions.length > 0) {
                for (const entry of this.pendingTranscriptions) {
                    this.sendToRenderer('stt-update', {
                    speaker: entry.speaker,
                    text: entry.text,
                    isPartial: false,
                    isFinal: true,
                    timestamp: entry.timestamp
                });
                }
                // Clear pending transcriptions after sending
                this.pendingTranscriptions = [];
            }
            
            const conversationText = this.getConversationText();
            
            // If no conversation history, use a default prompt
            const hasConversation = conversationText && this.conversationHistory.length > 0;
            
            // If buffer is empty and no conversation, don't send to LLM
            if (!hasConversation && this.pendingTranscriptions.length === 0) {
                console.log('[sendToLLM] No content to send to LLM');
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
            const systemPrompt = hasConversation 
                ? getSystemPrompt('pickle_glass', conversationText, false)
                : "You are a helpful AI assistant. Provide useful insights and assistance based on the context provided.";
            
            // Prepare messages for LLM
            const messages = [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: includeScreenshot && screenshot ? [
                        { type: 'text', text: hasConversation 
                            ? 'Based on the conversation and current screen, provide helpful analysis or suggestions.'
                            : 'Based on the current screen, provide helpful analysis or suggestions.' },
                        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${screenshot.base64}` } }
                    ] : hasConversation 
                        ? 'Based on the conversation, provide helpful analysis or suggestions.'
                        : 'Hello! I\'m ready to assist you. Start speaking to begin a conversation.'
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
            
            // Create abort controller for this request
            this.currentAbortController = new AbortController();
            
            // Stream the response
            const response = await streamingLLM.streamChat(messages);
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            try {
                while (true) {
                    // Check if aborted
                    if (this.currentAbortController.signal.aborted) {
                        console.log('[sendToLLM] Streaming aborted by user');
                        break;
                    }
                    
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
            } finally {
                // Always release the reader lock
                try {
                    reader.releaseLock();
                } catch (e) {
                    // Ignore errors when releasing lock
                }
            }
            
            // Clear abort controller
            this.currentAbortController = null;
            
            // Don't auto-resume after LLM response - keep in paused state
            // User must explicitly resume with cmd+/ or button click
        } catch (error) {
            console.error('Error in sendToLLM:', error);
            
            // Determine error type and provide specific guidance
            let errorMessage = 'An error occurred while processing your request.';
            
            if (error.name === 'AbortError') {
                // User aborted the request
                errorMessage = 'Request cancelled. Press cmd+/ to try again.';
            } else if (error.message?.includes('API key')) {
                errorMessage = 'API key not configured. Please check your settings.';
            } else if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
                errorMessage = 'API rate limit exceeded. Please try again later.';
            } else if (error.message?.includes('network') || error.code === 'ENOTFOUND') {
                errorMessage = 'Network error. Please check your internet connection.';
            } else if (error.status === 401) {
                errorMessage = 'Invalid API key. Please check your settings.';
            } else if (error.status === 429) {
                errorMessage = 'Too many requests. Please wait a moment and try again.';
            } else if (error.status >= 500) {
                errorMessage = 'Server error. The AI service may be temporarily unavailable.';
            } else {
                errorMessage = `Error: ${error.message || 'Unknown error occurred'}`;
            }
            
            // Send error message to UI
            this.sendToRenderer('stt-update', {
                speaker: 'System',
                text: errorMessage,
                isPartial: false,
                isFinal: true
            });
            
            // Don't auto-resume after error - keep in paused state
            // User must explicitly resume with cmd+/ or button click
        } finally {
            // Always reset processing flag and update state
            this.isProcessingLLM = false;
            this.currentAbortController = null;
            this.sendToRenderer('continuous-listen-state', { 
                isListening: this.isListening, 
                isPaused: this.isPaused,
                isProcessing: false 
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
            console.log('[IPC] toggle-continuous-listening handler called');
            const isNowListening = await this.toggleContinuousListening();
            console.log('[IPC] Returning isListening:', isNowListening);
            return { success: true, isListening: isNowListening };
        });

        ipcMain.handle('get-conversation-history', () => {
            return this.getConversationHistory();
        });

        ipcMain.handle('send-conversation-to-llm', async (event, { includeScreenshot }) => {
            console.log('[IPC] send-conversation-to-llm handler called, includeScreenshot:', includeScreenshot);
            await this.sendToLLM(includeScreenshot);
            return { success: true };
        });

        ipcMain.handle('get-continuous-listening-state', () => {
            return { isListening: this.getContinuousListeningState() };
        });

        ipcMain.handle('pause-listening', async () => {
            console.log('[IPC] pause-listening handler called');
            await this.pauseListening();
            return { success: true };
        });

        ipcMain.handle('resume-listening', async () => {
            console.log('[IPC] resume-listening handler called');
            await this.resumeListening();
            return { success: true };
        });

        console.log('Continuous listen service IPC handlers registered');
    }
}

module.exports = ContinuousListenService;